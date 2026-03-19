const { app, BrowserWindow, ipcMain, Tray, shell, Menu, dialog } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');

// キャッシュ競合回避: 専用 userData を設定（Windows の "Unable to move the cache" エラー対策）
// 開発時はプロジェクト直下に置き、Cursor 等の他 Electron プロセスとの競合を避ける
if (app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('appData'), 'gachaboard-launcher'));
} else {
  const devRoot = path.resolve(__dirname, '../../..');
  app.setPath('userData', path.join(devRoot, '.gachaboard-launcher'));
}

// 二重起動防止（同じ userData を複数プロセスで使うとキャッシュエラーになる）
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// アプリルート: 開発時は launcher の親、本番は exe のディレクトリ or cwd（run-launcher.bat 等で設定）
function getAppRoot() {
  if (process.env.GACHABOARD_ROOT) {
    return process.env.GACHABOARD_ROOT;
  }
  if (app.isPackaged) {
    const exeDir = path.dirname(app.getPath('exe'));
    const cwd = process.cwd();
    const hasProject = (dir) =>
      fs.existsSync(path.join(dir, 'scripts', 'win', 'run.ps1')) ||
      fs.existsSync(path.join(dir, 'nextjs-web', 'package.json'));
    if (hasProject(exeDir)) return exeDir;
    if (hasProject(cwd)) return cwd;
    return exeDir;
  }
  return path.resolve(__dirname, '../../..');
}

let mainWindow = null;
let tray = null;
let serverProcess = null;
let appRoot = null;
let currentUrl = 'http://localhost:18580';
let overlayGreen = null;
let overlayRed = null;
let overlayStatus = 'idle'; // running | error | idle

function createWindow() {
  const iconPath = path.join(appRoot, 'nextjs-web', 'public', 'icon.svg');
  mainWindow = new BrowserWindow({
    width: 480,
    height: 560,
    minWidth: 380,
    minHeight: 420,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', (e) => {
    if (app.isQuitting) return;
    if (tray) {
      e.preventDefault();
      if (serverProcess) {
        const result = dialog.showMessageBoxSync(mainWindow, {
          type: 'question',
          buttons: ['終了する', 'キャンセル'],
          defaultId: 1,
          cancelId: 1,
          title: 'Gachaboard',
          message: 'サーバーが停止します。よろしいですか？',
        });
        if (result === 0) quitApp(true);
        /* result === 1: キャンセル → ウィンドウはそのまま */
      } else {
        mainWindow.hide();
      }
    }
  });
}

function createTray() {
  const { nativeImage } = require('electron');
  const iconPath = path.join(appRoot, 'nextjs-web', 'public', 'icon.svg');
  let icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  if (icon.isEmpty()) {
    const fallback = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    icon = fallback.resize({ width: 16, height: 16 });
  }
  tray = new Tray(icon);
  updateTrayMenu();
}

function updateTrayMenu() {
  const statusSuffix = overlayStatus === 'running' ? ' - 起動中' : overlayStatus === 'error' ? ' - エラー' : '';
  tray?.setToolTip(`Gachaboard${statusSuffix}`);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'ウィンドウを開く', click: () => mainWindow?.show() },
    { label: 'ブラウザで開く', click: () => shell.openExternal(currentUrl) },
    { type: 'separator' },
    { label: '終了', click: () => quitApp() },
  ]);
  tray?.setContextMenu(contextMenu);
}

function quitApp(skipConfirmation) {
  if (serverProcess && !skipConfirmation) {
    const result = dialog.showMessageBoxSync(mainWindow || null, {
      type: 'question',
      buttons: ['終了する', 'キャンセル'],
      defaultId: 1,
      cancelId: 1,
      title: 'Gachaboard を終了',
      message: 'サーバーが停止します。よろしいですか？',
    });
    if (result !== 0) return;
  }
  app.isQuitting = true;
  stopServer();
  tray?.destroy();
  mainWindow?.destroy();
  app.quit();
}

// .env.local の必須項目が揃っているか
function isEnvConfigured() {
  const envPath = path.join(appRoot, 'nextjs-web', '.env.local');
  if (!fs.existsSync(envPath)) return false;
  const content = fs.readFileSync(envPath, 'utf8');
  const hasClientId = /DISCORD_CLIENT_ID=.+/.test(content) && !/DISCORD_CLIENT_ID=\s*$/.test(content);
  const hasClientSecret = /DISCORD_CLIENT_SECRET=.+/.test(content) && !/DISCORD_CLIENT_SECRET=\s*$/.test(content);
  const hasAuthSecret = /NEXTAUTH_SECRET=.+/.test(content) && !/NEXTAUTH_SECRET=\s*$/.test(content);
  return hasClientId && hasClientSecret && hasAuthSecret;
}

// ウィザード用: .env.local を生成
ipcMain.handle('save-env', async (_, { discordClientId, discordClientSecret, serverOwnerDiscordId }) => {
  const envLocalPath = path.join(appRoot, 'nextjs-web', '.env.local');
  const envExamplePath = path.join(appRoot, '.env.example');
  let base = '';
  if (fs.existsSync(envExamplePath)) {
    base = fs.readFileSync(envExamplePath, 'utf8');
  } else {
    base = `PORT=18580
POSTGRES_HOST_PORT=18581
SYNC_SERVER_HOST_PORT=18582
MINIO_API_HOST_PORT=18583
MINIO_CONSOLE_HOST_PORT=18584
DATABASE_URL=postgresql://gachaboard:gachaboard@localhost:18581/gachaboard
S3_BUCKET=my-bucket
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
S3_ENDPOINT=http://localhost:18583
S3_REGION=us-east-1
S3_PUBLIC_URL=http://localhost:18583
NEXT_PUBLIC_SYNC_WS_URL=ws://localhost:18582
SYNC_SERVER_INTERNAL_URL=http://127.0.0.1:18582
`;
  }
  const nextAuthSecret = crypto.randomBytes(32).toString('base64');
  const lines = base.split('\n');
  const out = [];
  const seen = new Set();
  for (const line of lines) {
    if (line.startsWith('DISCORD_CLIENT_ID=')) {
      out.push(`DISCORD_CLIENT_ID=${discordClientId}`);
      seen.add('DISCORD_CLIENT_ID');
      continue;
    }
    if (line.startsWith('DISCORD_CLIENT_SECRET=')) {
      out.push(`DISCORD_CLIENT_SECRET=${discordClientSecret}`);
      seen.add('DISCORD_CLIENT_SECRET');
      continue;
    }
    if (line.startsWith('SERVER_OWNER_DISCORD_ID=')) {
      out.push(`SERVER_OWNER_DISCORD_ID=${serverOwnerDiscordId || ''}`);
      seen.add('SERVER_OWNER_DISCORD_ID');
      continue;
    }
    if (line.startsWith('NEXTAUTH_SECRET=')) {
      out.push(`NEXTAUTH_SECRET=${nextAuthSecret}`);
      seen.add('NEXTAUTH_SECRET');
      continue;
    }
    if (line.startsWith('HOST_BIND=') || line.match(/^#.*HOST_BIND/)) {
      if (!seen.has('HOST_BIND')) {
        out.push('HOST_BIND=0.0.0.0');
        seen.add('HOST_BIND');
      }
      continue;
    }
    out.push(line);
  }
  if (!seen.has('HOST_BIND')) {
    out.push('HOST_BIND=0.0.0.0');
  }
  const dir = path.dirname(envLocalPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(envLocalPath, out.join('\n'), 'utf8');
  return { ok: true };
});

ipcMain.handle('check-env', async () => {
  return { configured: isEnvConfigured() };
});

ipcMain.handle('get-app-root', async () => appRoot);

// 設定モーダル用: .env.local から Discord 関連を読み取り
ipcMain.handle('get-env', async () => {
  const envPath = path.join(appRoot, 'nextjs-web', '.env.local');
  if (!fs.existsSync(envPath)) return { discordClientId: '', discordClientSecret: '', serverOwnerDiscordId: '' };
  const content = fs.readFileSync(envPath, 'utf8');
  const get = (key) => {
    const m = content.match(new RegExp(`^${key}=(.+)$`, 'm'));
    return m ? m[1].trim() : '';
  };
  return {
    discordClientId: get('DISCORD_CLIENT_ID'),
    discordClientSecret: get('DISCORD_CLIENT_SECRET'),
    serverOwnerDiscordId: get('SERVER_OWNER_DISCORD_ID'),
  };
});

// 設定モーダル用: Discord 関連のみ更新（NEXTAUTH_SECRET は維持）
ipcMain.handle('update-env', async (_, { discordClientId, discordClientSecret, serverOwnerDiscordId }) => {
  const envPath = path.join(appRoot, 'nextjs-web', '.env.local');
  if (!fs.existsSync(envPath)) {
    return { ok: false, error: '.env.local がありません。初回ウィザードを完了してください。' };
  }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  const out = [];
  const seen = new Set();
  for (const line of lines) {
    if (line.startsWith('DISCORD_CLIENT_ID=')) {
      out.push(`DISCORD_CLIENT_ID=${discordClientId || ''}`);
      seen.add('DISCORD_CLIENT_ID');
      continue;
    }
    if (line.startsWith('DISCORD_CLIENT_SECRET=')) {
      out.push(`DISCORD_CLIENT_SECRET=${discordClientSecret || ''}`);
      seen.add('DISCORD_CLIENT_SECRET');
      continue;
    }
    if (line.startsWith('SERVER_OWNER_DISCORD_ID=')) {
      out.push(`SERVER_OWNER_DISCORD_ID=${serverOwnerDiscordId || ''}`);
      seen.add('SERVER_OWNER_DISCORD_ID');
      continue;
    }
    out.push(line);
  }
  if (!seen.has('DISCORD_CLIENT_ID')) out.push(`DISCORD_CLIENT_ID=${discordClientId || ''}`);
  if (!seen.has('DISCORD_CLIENT_SECRET')) out.push(`DISCORD_CLIENT_SECRET=${discordClientSecret || ''}`);
  if (!seen.has('SERVER_OWNER_DISCORD_ID')) out.push(`SERVER_OWNER_DISCORD_ID=${serverOwnerDiscordId || ''}`);
  fs.writeFileSync(envPath, out.join('\n'), 'utf8');
  return { ok: true };
});

// OAuth2 リダイレクト URL 一覧
ipcMain.handle('get-oauth-redirect-urls', async () => {
  const localhost = 'http://localhost:18580/api/auth/callback/discord';
  let tailscale = null;
  if (currentUrl.startsWith('https://') && currentUrl.includes('.ts.net')) {
    const base = currentUrl.replace(/\/$/, '');
    tailscale = `${base}/api/auth/callback/discord`;
  } else {
    const host = await detectTailscaleHost();
    if (host) tailscale = `${host}/api/auth/callback/discord`;
  }
  return { localhost, tailscale };
});

// サーバ起動
ipcMain.handle('start-server', async () => {
  if (serverProcess) return { ok: false, error: 'Already running' };
  const isWin = process.platform === 'win32';
  const script = isWin
    ? 'powershell'
    : 'bash';
  const args = isWin
    ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(appRoot, 'scripts', 'win', 'run.ps1'), '-Tailscale']
    : [path.join(appRoot, 'scripts', 'start', 'tailscale.sh')];
  serverProcess = spawn(script, args, {
    cwd: appRoot,
    env: { ...process.env, GACHABOARD_ROOT: appRoot },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const safeSend = (channel, ...args) => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send(channel, ...args);
    }
  };
  serverProcess.stdout?.on('data', (chunk) => {
    safeSend('server-log', chunk.toString());
  });
  serverProcess.stderr?.on('data', (chunk) => {
    safeSend('server-log', chunk.toString());
  });
  serverProcess.on('exit', (code) => {
    serverProcess = null;
    safeSend('server-exit', code);
  });
  return { ok: true };
});

ipcMain.handle('stop-server', async () => {
  stopServer();
  return { ok: true };
});

function stopServer() {
  const { execSync } = require('child_process');
  if (process.platform === 'win32') {
    const resetScript = path.join(appRoot, 'scripts', 'win', 'reset-services.ps1');
    if (fs.existsSync(resetScript)) {
      try {
        execSync(
          `powershell -NoProfile -ExecutionPolicy Bypass -File "${resetScript}"`,
          { cwd: appRoot, stdio: 'ignore', windowsHide: true }
        );
      } catch (_) {}
    }
    if (serverProcess) {
      try {
        execSync(`taskkill /pid ${serverProcess.pid} /T /F`, { stdio: 'ignore', windowsHide: true });
      } catch (_) {}
      serverProcess = null;
    }
  } else {
    const stopScript = path.join(appRoot, 'portable', 'scripts', 'stop-services.sh');
    if (fs.existsSync(stopScript)) {
      try {
        execSync(`bash "${stopScript}" "${appRoot}"`, { stdio: 'ignore' });
      } catch (_) {}
    }
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      serverProcess = null;
    }
  }
}

ipcMain.handle('open-browser', async () => {
  shell.openExternal(currentUrl);
});

ipcMain.handle('set-current-url', async (_, url) => {
  currentUrl = url || 'http://localhost:18580';
  updateTrayMenu();
});

// タスクバーオーバーレイ（Windows のみ）: 起動時は緑、エラー時は赤
ipcMain.handle('set-overlay-images', async (_, { green, red }) => {
  if (process.platform !== 'win32') return;
  const { nativeImage } = require('electron');
  if (green) overlayGreen = nativeImage.createFromDataURL(green);
  if (red) overlayRed = nativeImage.createFromDataURL(red);
});
ipcMain.handle('set-overlay-status', async (_, status) => {
  overlayStatus = status;
  if (process.platform === 'win32' && mainWindow) {
    if (status === 'running' && overlayGreen) {
      mainWindow.setOverlayIcon(overlayGreen, '起動中');
    } else if (status === 'error' && overlayRed) {
      mainWindow.setOverlayIcon(overlayRed, 'エラー');
    } else {
      mainWindow.setOverlayIcon(null, '');
    }
  }
  if (process.platform === 'darwin' && app.dock) {
    if (status === 'running') app.dock.setBadge('●');
    else if (status === 'error') app.dock.setBadge('!');
    else app.dock.setBadge('');
  }
  if (tray) updateTrayMenu();
});

// Tailscale ホスト名を取得（子プロセス出力から or tailscale status）
async function detectTailscaleHost() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const ts = spawn('tailscale', ['status', '--json', '--peers=false'], {
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      });
      let out = '';
      ts.stdout?.on('data', (c) => { out += c; });
      ts.on('close', () => {
        try {
          const j = JSON.parse(out);
          const dns = j?.Self?.DNSName;
          if (dns) resolve(`https://${dns}`);
        } catch (_) {}
        resolve(null);
      });
    } else {
      const ts = spawn('tailscale', ['status', '--json', '--peers=false'], {
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      let out = '';
      ts.stdout?.on('data', (c) => { out += c; });
      ts.on('close', () => {
        try {
          const j = JSON.parse(out);
          const dns = j?.Self?.DNSName;
          if (dns) resolve(`https://${dns}`);
        } catch (_) {}
        resolve(null);
      });
    }
    setTimeout(() => resolve(null), 3000);
  });
}

// 起動完了をポーリングで検知
async function waitForReady() {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      await new Promise((resolve, reject) => {
        const req = http.get('http://127.0.0.1:18580', (res) => {
          resolve();
        });
        req.on('error', reject);
        req.setTimeout(2000, () => { req.destroy(); reject(new Error('timeout')); });
      });
      const tsUrl = await detectTailscaleHost();
      return tsUrl || 'http://localhost:18580';
    } catch (_) {}
  }
  return 'http://localhost:18580';
}

ipcMain.handle('wait-for-ready', async () => {
  return waitForReady();
});

app.whenReady().then(() => {
  appRoot = getAppRoot();
  createTray();
  createWindow();
  mainWindow.webContents.on('did-finish-load', () => {
    const iconPath = path.join(appRoot, 'nextjs-web', 'public', 'icon.svg');
    const iconUrl = fs.existsSync(iconPath) ? pathToFileURL(iconPath).href : '';
    mainWindow.webContents.send('app-root', appRoot);
    mainWindow.webContents.send('icon-url', iconUrl);
    mainWindow.webContents.send('env-configured', isEnvConfigured());
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (!app.isQuitting) return;
    app.quit();
  }
});

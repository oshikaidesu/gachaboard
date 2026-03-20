const { app, BrowserWindow, ipcMain, Tray, shell, Menu, dialog } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');

/**
 * Decode child stdout/stderr for the log pane.
 * On Japanese Windows, piped output may be CP932; try UTF-8 first, then Shift_JIS.
 */
function decodeChildLogChunk(chunk) {
  if (chunk == null) return '';
  const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
  if (buf.length === 0) return '';
  if (process.platform !== 'win32') {
    return buf.toString('utf8');
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    try {
      return new TextDecoder('shift_jis').decode(buf);
    } catch {
      try {
        return new TextDecoder('windows-31j').decode(buf);
      } catch {
        return buf.toString('utf8');
      }
    }
  }
}

// Dedicated userData avoids Electron cache collisions ("Unable to move the cache" on Windows).
// In dev, keep under the repo root to avoid clashing with other Electron apps (e.g. editors).
if (app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('appData'), 'gachaboard-launcher'));
} else {
  const devRoot = path.resolve(__dirname, '../../..');
  app.setPath('userData', path.join(devRoot, '.gachaboard-launcher'));
}

// Single instance: multiple processes sharing userData can break the cache.
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

const LAUNCHER_SETTINGS_BASENAME = 'launcher-settings.json';

function getLauncherSettingsPath() {
  return path.join(app.getPath('userData'), LAUNCHER_SETTINGS_BASENAME);
}

/** True if dir looks like a full Gachaboard checkout (nextjs-web + scripts). */
function hasProjectRoot(dir) {
  if (!dir || typeof dir !== 'string') return false;
  const runWin = path.join(dir, 'scripts', 'win', 'run.ps1');
  const runSh = path.join(dir, 'scripts', 'start', 'tailscale.sh');
  const nextPkg = path.join(dir, 'nextjs-web', 'package.json');
  return fs.existsSync(nextPkg) && (fs.existsSync(runWin) || fs.existsSync(runSh));
}

function readLauncherSettings() {
  try {
    const p = getLauncherSettingsPath();
    if (!fs.existsSync(p)) return {};
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return {};
  }
}

/** Saved path from settings file (may be invalid; see getLauncherConfig). */
function readSavedProjectRootRaw() {
  const j = readLauncherSettings();
  const r = j.projectRoot;
  if (typeof r === 'string' && r.trim()) {
    return path.normalize(path.resolve(r.trim()));
  }
  return null;
}

function writeSavedProjectRoot(absPathOrNull) {
  const p = getLauncherSettingsPath();
  let data = readLauncherSettings();
  if (absPathOrNull === null || absPathOrNull === '') {
    delete data.projectRoot;
  } else {
    data.projectRoot = absPathOrNull;
  }
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

// App root: 1) GACHABOARD_ROOT 2) saved settings (if valid) 3) packaged: exe dir 4) dev: launcher parent
function computeAppRoot() {
  if (process.env.GACHABOARD_ROOT) {
    return path.normalize(path.resolve(process.env.GACHABOARD_ROOT));
  }
  const saved = readSavedProjectRootRaw();
  if (saved && hasProjectRoot(saved)) {
    return saved;
  }
  if (app.isPackaged) {
    // Do not guess project root from exe/cwd (user must pick the folder explicitly)
    return path.dirname(app.getPath('exe'));
  }
  return path.resolve(__dirname, '../../..');
}

function getLauncherConfigPayload() {
  const rawSaved = readSavedProjectRootRaw();
  const savedInvalid = !!(rawSaved && !hasProjectRoot(rawSaved));
  return {
    savedProjectRoot: rawSaved,
    effectiveAppRoot: appRoot,
    usesEnvOverride: !!process.env.GACHABOARD_ROOT,
    projectLayoutValid: hasProjectRoot(appRoot),
    savedPathInvalid: savedInvalid,
  };
}

function notifyAppRootToRenderer() {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents || mainWindow.webContents.isDestroyed()) {
    return;
  }
  const iconPath = path.join(appRoot, 'nextjs-web', 'public', 'icon.svg');
  const iconUrl = fs.existsSync(iconPath) ? pathToFileURL(iconPath).href : '';
  mainWindow.webContents.send('app-root', appRoot);
  mainWindow.webContents.send('icon-url', iconUrl);
  const configured = isEnvConfigured();
  if (configured) ensureFfmpegEnvDefaults();
  mainWindow.webContents.send('env-configured', configured);
}

function refreshAppRootFromDisk() {
  appRoot = computeAppRoot();
  notifyAppRootToRenderer();
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
          buttons: ['Quit', 'Cancel'],
          defaultId: 1,
          cancelId: 1,
          title: 'Gachaboard',
          message: 'This will stop the server. Continue?',
        });
        if (result === 0) quitApp(true);
        /* result === 1: cancel — leave window open */
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
  const statusSuffix = overlayStatus === 'running' ? ' — running' : overlayStatus === 'error' ? ' — error' : '';
  tray?.setToolTip(`Gachaboard${statusSuffix}`);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show window', click: () => mainWindow?.show() },
    { label: 'Open in browser', click: () => shell.openExternal(currentUrl) },
    { type: 'separator' },
    { label: 'Quit', click: () => quitApp() },
  ]);
  tray?.setContextMenu(contextMenu);
}

function quitApp(skipConfirmation) {
  if (serverProcess && !skipConfirmation) {
    const result = dialog.showMessageBoxSync(mainWindow || null, {
      type: 'question',
      buttons: ['Quit', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Quit Gachaboard',
      message: 'This will stop the server. Continue?',
    });
    if (result !== 0) return;
  }
  app.isQuitting = true;
  stopServer();
  tray?.destroy();
  mainWindow?.destroy();
  app.quit();
}

// Whether .env.local has required Discord / NextAuth values
function isEnvConfigured() {
  const envPath = path.join(appRoot, 'nextjs-web', '.env.local');
  if (!fs.existsSync(envPath)) return false;
  const content = fs.readFileSync(envPath, 'utf8');
  const hasClientId = /DISCORD_CLIENT_ID=.+/.test(content) && !/DISCORD_CLIENT_ID=\s*$/.test(content);
  const hasClientSecret = /DISCORD_CLIENT_SECRET=.+/.test(content) && !/DISCORD_CLIENT_SECRET=\s*$/.test(content);
  const hasAuthSecret = /NEXTAUTH_SECRET=.+/.test(content) && !/NEXTAUTH_SECRET=\s*$/.test(content);
  return hasClientId && hasClientSecret && hasAuthSecret;
}

/** Append default FFMPEG_* lines if missing (existing installs) */
function ensureFfmpegEnvDefaults() {
  const envPath = path.join(appRoot, 'nextjs-web', '.env.local');
  if (!fs.existsSync(envPath)) return;
  let content = fs.readFileSync(envPath, 'utf8');
  let changed = false;
  if (!/^FFMPEG_VIDEO_BACKEND=/m.test(content)) {
    content = `${content.replace(/\s*$/, '')}\nFFMPEG_VIDEO_BACKEND=gpu\n`;
    changed = true;
  }
  if (!/^FFMPEG_RESOURCE_INTENSITY=/m.test(content)) {
    content = `${content.replace(/\s*$/, '')}\nFFMPEG_RESOURCE_INTENSITY=medium\n`;
    changed = true;
  }
  if (!/^FFMPEG_OUTPUT_PRESET=/m.test(content)) {
    content = `${content.replace(/\s*$/, '')}\nFFMPEG_OUTPUT_PRESET=medium\n`;
    changed = true;
  }
  if (!/^FFMPEG_OS_PRIORITY=/m.test(content)) {
    content = `${content.replace(/\s*$/, '')}\nFFMPEG_OS_PRIORITY=auto\n`;
    changed = true;
  }
  if (changed) fs.writeFileSync(envPath, content, 'utf8');
}

// Wizard: create .env.local
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
  let text = out.join('\n');
  if (!/^FFMPEG_VIDEO_BACKEND=/m.test(text)) {
    out.push('FFMPEG_VIDEO_BACKEND=gpu');
    text = out.join('\n');
  }
  if (!/^FFMPEG_RESOURCE_INTENSITY=/m.test(text)) {
    out.push('FFMPEG_RESOURCE_INTENSITY=medium');
    text = out.join('\n');
  }
  if (!/^FFMPEG_OUTPUT_PRESET=/m.test(text)) {
    out.push('FFMPEG_OUTPUT_PRESET=medium');
    text = out.join('\n');
  }
  if (!/^FFMPEG_OS_PRIORITY=/m.test(text)) {
    out.push('FFMPEG_OS_PRIORITY=auto');
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

ipcMain.handle('get-launcher-config', async () => getLauncherConfigPayload());

ipcMain.handle('set-saved-project-root', async (_, dir) => {
  if (process.env.GACHABOARD_ROOT) {
    return {
      ok: false,
      error: 'GACHABOARD_ROOT is set; changes here have no effect. Unset it or change that path.',
    };
  }
  if (dir === null || dir === undefined || dir === '') {
    writeSavedProjectRoot(null);
    refreshAppRootFromDisk();
    return { ok: true, ...getLauncherConfigPayload() };
  }
  const abs = path.normalize(path.resolve(String(dir)));
  if (!hasProjectRoot(abs)) {
    return {
      ok: false,
      error:
        'That folder is not a Gachaboard project root. Pick the folder that contains nextjs-web and scripts (e.g. scripts\\win\\run.ps1).',
    };
  }
  writeSavedProjectRoot(abs);
  refreshAppRootFromDisk();
  return { ok: true, ...getLauncherConfigPayload() };
});

ipcMain.handle('pick-project-root-folder', async () => {
  if (!mainWindow) return { canceled: true };
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Choose Gachaboard project folder',
  });
  if (r.canceled || !r.filePaths?.length) return { canceled: true };
  return { canceled: false, path: r.filePaths[0] };
});

// Settings: read Discord-related keys from .env.local
ipcMain.handle('get-env', async () => {
  const envPath = path.join(appRoot, 'nextjs-web', '.env.local');
  if (!fs.existsSync(envPath)) {
    return {
      discordClientId: '',
      discordClientSecret: '',
      serverOwnerDiscordId: '',
      ffmpegVideoBackend: '',
      ffmpegResourceIntensity: '',
      ffmpegOutputPreset: '',
      ffmpegOsPriority: '',
    };
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const get = (key) => {
    const m = content.match(new RegExp(`^${key}=(.+)$`, 'm'));
    return m ? m[1].trim() : '';
  };
  return {
    discordClientId: get('DISCORD_CLIENT_ID'),
    discordClientSecret: get('DISCORD_CLIENT_SECRET'),
    serverOwnerDiscordId: get('SERVER_OWNER_DISCORD_ID'),
    ffmpegVideoBackend: get('FFMPEG_VIDEO_BACKEND'),
    ffmpegResourceIntensity: get('FFMPEG_RESOURCE_INTENSITY'),
    ffmpegOutputPreset: get('FFMPEG_OUTPUT_PRESET'),
    ffmpegOsPriority: get('FFMPEG_OS_PRIORITY'),
  };
});

// Settings: update Discord / FFmpeg keys only (keep NEXTAUTH_SECRET)
ipcMain.handle(
  'update-env',
  async (
    _,
    {
      discordClientId,
      discordClientSecret,
      serverOwnerDiscordId,
      ffmpegVideoBackend = '',
      ffmpegResourceIntensity = '',
      ffmpegOutputPreset = '',
      ffmpegOsPriority = '',
    }
  ) => {
  const envPath = path.join(appRoot, 'nextjs-web', '.env.local');
  if (!fs.existsSync(envPath)) {
    return { ok: false, error: 'Missing nextjs-web/.env.local. Finish the first-time wizard first.' };
  }
  const vbRaw = typeof ffmpegVideoBackend === 'string' ? ffmpegVideoBackend.trim().toLowerCase() : '';
  const riRaw = typeof ffmpegResourceIntensity === 'string' ? ffmpegResourceIntensity.trim().toLowerCase() : '';
  const vb = vbRaw === 'cpu' ? 'cpu' : 'gpu';
  const ri = ['light', 'medium', 'heavy'].includes(riRaw) ? riRaw : 'medium';
  const opRaw = typeof ffmpegOutputPreset === 'string' ? ffmpegOutputPreset.trim().toLowerCase() : '';
  const op = ['light', 'medium', 'heavy'].includes(opRaw) ? opRaw : 'medium';
  const osRaw = typeof ffmpegOsPriority === 'string' ? ffmpegOsPriority.trim().toLowerCase() : '';
  const osPr = ['low', 'normal', 'auto'].includes(osRaw) ? osRaw : 'auto';
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
    if (line.startsWith('FFMPEG_VIDEO_BACKEND=')) {
      out.push(`FFMPEG_VIDEO_BACKEND=${vb}`);
      seen.add('FFMPEG_VIDEO_BACKEND');
      continue;
    }
    if (line.startsWith('FFMPEG_RESOURCE_INTENSITY=')) {
      out.push(`FFMPEG_RESOURCE_INTENSITY=${ri}`);
      seen.add('FFMPEG_RESOURCE_INTENSITY');
      continue;
    }
    if (line.startsWith('FFMPEG_OUTPUT_PRESET=')) {
      out.push(`FFMPEG_OUTPUT_PRESET=${op}`);
      seen.add('FFMPEG_OUTPUT_PRESET');
      continue;
    }
    if (line.startsWith('FFMPEG_OS_PRIORITY=')) {
      out.push(`FFMPEG_OS_PRIORITY=${osPr}`);
      seen.add('FFMPEG_OS_PRIORITY');
      continue;
    }
    out.push(line);
  }
  if (!seen.has('DISCORD_CLIENT_ID')) out.push(`DISCORD_CLIENT_ID=${discordClientId || ''}`);
  if (!seen.has('DISCORD_CLIENT_SECRET')) out.push(`DISCORD_CLIENT_SECRET=${discordClientSecret || ''}`);
  if (!seen.has('SERVER_OWNER_DISCORD_ID')) out.push(`SERVER_OWNER_DISCORD_ID=${serverOwnerDiscordId || ''}`);
  if (!seen.has('FFMPEG_VIDEO_BACKEND')) out.push(`FFMPEG_VIDEO_BACKEND=${vb}`);
  if (!seen.has('FFMPEG_RESOURCE_INTENSITY')) out.push(`FFMPEG_RESOURCE_INTENSITY=${ri}`);
  if (!seen.has('FFMPEG_OUTPUT_PRESET')) out.push(`FFMPEG_OUTPUT_PRESET=${op}`);
  if (!seen.has('FFMPEG_OS_PRIORITY')) out.push(`FFMPEG_OS_PRIORITY=${osPr}`);
  fs.writeFileSync(envPath, out.join('\n'), 'utf8');
  return { ok: true };
});

// OAuth2 redirect URLs to show in Settings
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

// Start backend (run.ps1 or tailscale.sh)
ipcMain.handle('start-server', async () => {
  if (serverProcess) return { ok: false, error: 'Already running' };
  if (!hasProjectRoot(appRoot)) {
    return {
      ok: false,
      error:
        'Gachaboard project folder not found. Open Settings (gear) and choose the unpacked project root.',
    };
  }
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
    safeSend('server-log', decodeChildLogChunk(chunk));
  });
  serverProcess.stderr?.on('data', (chunk) => {
    safeSend('server-log', decodeChildLogChunk(chunk));
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

// Taskbar overlay (Windows): green = running, red = error
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
      mainWindow.setOverlayIcon(overlayGreen, 'Running');
    } else if (status === 'error' && overlayRed) {
      mainWindow.setOverlayIcon(overlayRed, 'Error');
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

// Resolve Tailscale HTTPS host from `tailscale status --json`
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

// Poll until Next.js responds on app port
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
  appRoot = computeAppRoot();
  createTray();
  createWindow();
  mainWindow.webContents.on('did-finish-load', () => {
    const iconPath = path.join(appRoot, 'nextjs-web', 'public', 'icon.svg');
    const iconUrl = fs.existsSync(iconPath) ? pathToFileURL(iconPath).href : '';
    mainWindow.webContents.send('app-root', appRoot);
    mainWindow.webContents.send('icon-url', iconUrl);
    const configured = isEnvConfigured();
    if (configured) ensureFfmpegEnvDefaults();
    mainWindow.webContents.send('env-configured', configured);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (!app.isQuitting) return;
    app.quit();
  }
});

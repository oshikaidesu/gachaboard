const api = window.gachaboard;
if (!api) throw new Error('preload not loaded');

function createOverlayDot(color) {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, 32, 32);
  ctx.beginPath();
  ctx.arc(24, 8, 8, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
  return canvas.toDataURL('image/png');
}

function initOverlayImages() {
  const green = createOverlayDot('#16a34a');
  const red = createOverlayDot('#dc2626');
  if (green && red) api.setOverlayImages({ green, red });
}

const wizardScreen = document.getElementById('wizard-screen');
const runningScreen = document.getElementById('running-screen');
const clientIdInput = document.getElementById('client-id');
const clientSecretInput = document.getElementById('client-secret');
const ownerIdInput = document.getElementById('owner-id');
const wizardSubmit = document.getElementById('wizard-submit');
const statusText = document.getElementById('status-text');
const urlArea = document.getElementById('url-area');
const currentUrlSpan = document.getElementById('current-url');
const startServerBtn = document.getElementById('start-server');
const startArea = document.getElementById('start-area');
const openBrowserBtn = document.getElementById('open-browser');
const stopServerBtn = document.getElementById('stop-server');
const logArea = document.getElementById('log-area');
let isServerRunning = false;

function showScreen(id) {
  wizardScreen.classList.remove('active');
  runningScreen.classList.remove('active');
  const el = id === 'wizard' ? wizardScreen : runningScreen;
  el.classList.add('active');
}

function appendLog(text) {
  logArea.textContent += text;
  logArea.scrollTop = logArea.scrollHeight;
}

api.onAppRoot(() => {});
api.onIconUrl((url) => {
  if (url) {
    const headerIcon = document.getElementById('header-icon');
    const runningIcon = document.getElementById('running-icon');
    if (headerIcon) { headerIcon.src = url; headerIcon.style.display = 'block'; }
    if (runningIcon) { runningIcon.src = url; runningIcon.style.display = 'block'; }
  }
});
api.onEnvConfigured((configured) => {
  initOverlayImages();
  if (configured) {
    showScreen('running');
    showIdleState();
    api.setOverlayStatus('idle');
  } else {
    showScreen('wizard');
  }
});

api.onServerLog((text) => appendLog(text));
api.onServerExit((code) => {
  if (window.isRestarting) return;
  api.setOverlayStatus(window.isIntentionalStop ? 'idle' : (code !== 0 ? 'error' : 'idle'));
  showIdleState();
  statusText.textContent = 'サーバーが停止しました';
  statusText.classList.add('stopped');
  startServerBtn.disabled = false;
  window.isIntentionalStop = false;
});

wizardSubmit.addEventListener('click', async () => {
  const clientId = clientIdInput.value.trim();
  const clientSecret = clientSecretInput.value.trim();
  const ownerId = ownerIdInput.value.trim();
  if (!clientId || !clientSecret) {
    alert('Discord Client ID と Client Secret を入力してください。');
    return;
  }
  wizardSubmit.disabled = true;
  try {
    await api.saveEnv({ discordClientId: clientId, discordClientSecret: clientSecret, serverOwnerDiscordId: ownerId });
    showScreen('running');
    showIdleState();
    api.setOverlayStatus('idle');
  } catch (e) {
    alert('設定の保存に失敗しました: ' + e.message);
  } finally {
    wizardSubmit.disabled = false;
  }
});

function showIdleState() {
  isServerRunning = false;
  startServerBtn.textContent = 'サーバを起動';
  statusText.textContent = '';
  statusText.classList.remove('stopped');
  startArea.style.display = 'block';
  urlArea.style.display = 'none';
  openBrowserBtn.style.display = 'none';
  stopServerBtn.style.display = 'none';
  logArea.textContent = '';
}

function showRunningState(url) {
  isServerRunning = true;
  startServerBtn.textContent = '再起動';
  statusText.textContent = '起動しました';
  statusText.classList.remove('stopped');
  startArea.style.display = 'block';
  currentUrlSpan.textContent = url;
  urlArea.style.display = 'block';
  openBrowserBtn.style.display = 'inline-block';
  stopServerBtn.style.display = 'inline-block';
}

async function startServerFlow() {
  statusText.textContent = 'サーバを起動しています...';
  statusText.classList.remove('stopped');
  startServerBtn.disabled = true;
  logArea.textContent = '';
  const result = await api.startServer();
  if (!result.ok) {
    api.setOverlayStatus('error');
    statusText.textContent = '起動に失敗しました';
    statusText.classList.add('stopped');
    startServerBtn.disabled = false;
    return;
  }
  const url = await api.waitForReady();
  await api.setCurrentUrl(url);
  api.setOverlayStatus('running');
  showRunningState(url);
  startServerBtn.disabled = false;
}

async function openSettingsModal() {
  document.getElementById('help-modal').classList.add('open');
  try {
    const env = await api.getEnv();
    document.getElementById('settings-client-id').value = env.discordClientId || '';
    document.getElementById('settings-client-secret').value = env.discordClientSecret || '';
    document.getElementById('settings-owner-id').value = env.serverOwnerDiscordId || '';
  } catch (_) {}
  try {
    const urls = await api.getOAuthRedirectUrls();
    document.getElementById('oauth-localhost-url').textContent = urls.localhost;
    const tailscaleRow = document.getElementById('oauth-tailscale-row');
    const tailscaleHint = document.getElementById('oauth-tailscale-hint');
    if (urls.tailscale) {
      document.getElementById('oauth-tailscale-url').textContent = urls.tailscale;
      tailscaleRow.style.display = 'flex';
      tailscaleHint.style.display = 'none';
    } else {
      tailscaleRow.style.display = 'none';
      tailscaleHint.style.display = 'block';
    }
  } catch (_) {}
}

document.getElementById('gear-btn').addEventListener('click', openSettingsModal);
document.getElementById('help-modal-close').addEventListener('click', () => {
  document.getElementById('help-modal').classList.remove('open');
});
document.getElementById('help-modal').addEventListener('click', (e) => {
  if (e.target.id === 'help-modal') e.target.classList.remove('open');
});

document.getElementById('help-modal').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-copy]');
  if (!btn) return;
  const id = btn.getAttribute('data-copy');
  const el = document.getElementById(id);
  if (el) {
    navigator.clipboard.writeText(el.textContent).then(() => {
      const orig = btn.textContent;
      btn.textContent = 'コピー済';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    });
  }
});

document.getElementById('settings-save-btn').addEventListener('click', async () => {
  const clientId = document.getElementById('settings-client-id').value.trim();
  const clientSecret = document.getElementById('settings-client-secret').value.trim();
  const ownerId = document.getElementById('settings-owner-id').value.trim();
  if (!clientId || !clientSecret) {
    alert('Discord Client ID と Client Secret を入力してください。');
    return;
  }
  const btn = document.getElementById('settings-save-btn');
  btn.disabled = true;
  try {
    const result = await api.updateEnv({ discordClientId: clientId, discordClientSecret: clientSecret, serverOwnerDiscordId: ownerId });
    if (result.ok) {
      btn.textContent = '保存しました';
      setTimeout(() => { btn.textContent = '保存'; }, 1500);
    } else {
      alert(result.error || '保存に失敗しました');
    }
  } catch (e) {
    alert('保存に失敗しました: ' + e.message);
  } finally {
    btn.disabled = false;
  }
});
startServerBtn.addEventListener('click', async () => {
  if (isServerRunning) {
    window.isRestarting = true;
    statusText.textContent = '再起動中...';
    statusText.classList.remove('stopped');
    startServerBtn.disabled = true;
    logArea.textContent = '';
    try {
      await api.stopServer();
      await new Promise((r) => setTimeout(r, 2000));
      const result = await api.startServer();
      if (!result.ok) {
        api.setOverlayStatus('error');
        statusText.textContent = '再起動に失敗しました';
        statusText.classList.add('stopped');
        return;
      }
      const url = await api.waitForReady();
      await api.setCurrentUrl(url);
      api.setOverlayStatus('running');
      showRunningState(url);
    } catch (e) {
      api.setOverlayStatus('error');
      statusText.textContent = '再起動に失敗しました';
      statusText.classList.add('stopped');
    } finally {
      window.isRestarting = false;
      startServerBtn.disabled = false;
    }
  } else {
    startServerFlow();
  }
});
openBrowserBtn.addEventListener('click', () => api.openBrowser());
stopServerBtn.addEventListener('click', async () => {
  window.isIntentionalStop = true;
  api.setOverlayStatus('idle');
  await api.stopServer();
  statusText.textContent = '停止中...';
});

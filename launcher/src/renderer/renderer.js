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
api.onEnvConfigured(async (configured) => {
  initOverlayImages();
  if (configured) {
    showScreen('running');
    showIdleState();
    api.setOverlayStatus('idle');
  } else {
    showScreen('wizard');
    await refreshProjectPathUi('wizard-');
  }
});

api.onServerLog((text) => appendLog(text));
api.onServerExit((code) => {
  if (window.isRestarting) return;
  api.setOverlayStatus(window.isIntentionalStop ? 'idle' : (code !== 0 ? 'error' : 'idle'));
  showIdleState();
  statusText.textContent = 'Server stopped';
  statusText.classList.add('stopped');
  startServerBtn.disabled = false;
  window.isIntentionalStop = false;
});

wizardSubmit.addEventListener('click', async () => {
  const layout = await api.getLauncherConfig();
  if (!layout.projectLayoutValid) {
    alert(
      'The Gachaboard project folder is missing or incomplete.\n\nChoose the unpacked project folder under “Gachaboard project folder”, then click Continue.',
    );
    return;
  }
  const clientId = clientIdInput.value.trim();
  const clientSecret = clientSecretInput.value.trim();
  const ownerId = ownerIdInput.value.trim();
  if (!clientId || !clientSecret) {
    alert('Enter Discord Client ID and Client Secret.');
    return;
  }
  wizardSubmit.disabled = true;
  try {
    await api.saveEnv({ discordClientId: clientId, discordClientSecret: clientSecret, serverOwnerDiscordId: ownerId });
    showScreen('running');
    showIdleState();
    api.setOverlayStatus('idle');
  } catch (e) {
    alert('Failed to save settings: ' + e.message);
  } finally {
    wizardSubmit.disabled = false;
  }
});

function showIdleState() {
  isServerRunning = false;
  startServerBtn.textContent = 'Start server';
  statusText.textContent = '';
  statusText.classList.remove('stopped');
  startArea.style.display = 'block';
  urlArea.style.display = 'none';
  openBrowserBtn.style.display = 'none';
  stopServerBtn.style.display = 'none';
  logArea.textContent = '';
  const hint = document.getElementById('tailscale-hint');
  if (hint) {
    hint.textContent = 'For remote participants: install Tailscale and share the URL shown after startup.';
  }
}

function showRunningState(url) {
  isServerRunning = true;
  startServerBtn.textContent = 'Restart';
  statusText.textContent = 'Browser will open when ready';
  statusText.classList.remove('stopped');
  startArea.style.display = 'block';
  currentUrlSpan.textContent = url;
  urlArea.style.display = 'block';
  openBrowserBtn.style.display = 'inline-block';
  stopServerBtn.style.display = 'inline-block';
  const hint = document.getElementById('tailscale-hint');
  if (hint) {
    hint.textContent = 'For remote participants: install Tailscale and share the URL below.';
  }
}

async function startServerFlow() {
  const layout = await api.getLauncherConfig();
  if (!layout.projectLayoutValid) {
    alert(
      'The Gachaboard project folder is missing or incomplete.\n\nOpen Settings (gear) and set “Gachaboard project folder” to your unpacked project root.',
    );
    return;
  }
  statusText.textContent = 'Starting server…';
  statusText.classList.remove('stopped');
  startServerBtn.disabled = true;
  logArea.textContent = '';
  const result = await api.startServer();
  if (!result.ok) {
    api.setOverlayStatus('error');
    statusText.textContent = result.error || 'Failed to start';
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

function setRadioGroupValue(name, value) {
  document.querySelectorAll(`input[type="radio"][name="${name}"]`).forEach((el) => {
    el.checked = el.value === value;
  });
}

function getRadioGroupValue(name, fallback) {
  const el = document.querySelector(`input[type="radio"][name="${name}"]:checked`);
  return el && el.value ? el.value : fallback;
}

async function refreshProjectPathUi(prefix) {
  const cfg = await api.getLauncherConfig();
  const input = document.getElementById(`${prefix}project-root`);
  const envNote = document.getElementById(`${prefix}env-override-note`);
  const invalid = document.getElementById(`${prefix}root-invalid`);
  const pickBtn = document.getElementById(`${prefix}project-root-pick`);
  // When unset/invalid, do not show exe path (avoid looking “correct” by default)
  if (input) input.value = cfg.projectLayoutValid ? cfg.effectiveAppRoot || '' : '';
  if (cfg.usesEnvOverride) {
    if (envNote) {
      envNote.style.display = 'block';
      envNote.textContent =
        'GACHABOARD_ROOT is set; the folder you choose here is ignored.';
    }
    if (pickBtn) pickBtn.disabled = true;
  } else {
    if (envNote) envNote.style.display = 'none';
    if (pickBtn) pickBtn.disabled = false;
  }
  if (cfg.savedPathInvalid) {
    if (invalid) {
      invalid.style.display = 'block';
      invalid.textContent =
        'The saved folder is missing or incomplete. Choose the folder again if you moved the project.';
    }
  } else if (invalid) {
    invalid.style.display = 'none';
  }
}

async function refreshAllProjectPathUis() {
  await refreshProjectPathUi('settings-');
  await refreshProjectPathUi('wizard-');
}

async function openSettingsModal() {
  document.getElementById('help-modal').classList.add('open');
  await refreshAllProjectPathUis();
  try {
    const env = await api.getEnv();
    document.getElementById('settings-client-id').value = env.discordClientId || '';
    document.getElementById('settings-client-secret').value = env.discordClientSecret || '';
    document.getElementById('settings-owner-id').value = env.serverOwnerDiscordId || '';
    
    // FFmpeg Backend
    const vBackend = (env.ffmpegVideoBackend || '').trim().toLowerCase();
    document.getElementById('settings-ffmpeg-backend').value = 
      vBackend === 'cpu' || vBackend === 'gpu' ? vBackend : 'gpu';
    
    // FFmpeg Intensity
    const vIntensity = (env.ffmpegResourceIntensity || '').trim().toLowerCase();
    document.getElementById('settings-ffmpeg-intensity').value = 
      vIntensity === 'light' || vIntensity === 'medium' || vIntensity === 'heavy' ? vIntensity : 'medium';
    
    // OS Priority
    const vOs = (env.ffmpegOsPriority || '').trim().toLowerCase();
    setRadioGroupValue('ffmpeg-os-priority', vOs === 'low' || vOs === 'normal' || vOs === 'auto' ? vOs : 'auto');
    
    // Output Preset
    const vOut = (env.ffmpegOutputPreset || '').trim().toLowerCase();
    document.getElementById('settings-ffmpeg-output').value = 
      vOut === 'light' || vOut === 'medium' || vOut === 'heavy' ? vOut : 'medium';
      
  } catch (_) {}
  
  try {
    const urls = await api.getOAuthRedirectUrls();
    document.getElementById('oauth-localhost-url').textContent = urls.localhost;
    const tailscaleRow = document.getElementById('oauth-tailscale-row');
    const tailscaleHint = document.getElementById('oauth-tailscale-hint');
    if (urls.tailscale) {
      document.getElementById('oauth-tailscale-url').textContent = urls.tailscale;
      tailscaleRow.style.display = 'flex';
      if (tailscaleHint) tailscaleHint.style.display = 'none';
    } else {
      tailscaleRow.style.display = 'none';
      if (tailscaleHint) tailscaleHint.style.display = 'block';
    }
  } catch (_) {}
}

document.getElementById('gear-btn').addEventListener('click', openSettingsModal);

async function handleProjectPathPick(prefix) {
  const pickBtn = document.getElementById(`${prefix}project-root-pick`);
  if (!pickBtn) return;
  try {
    pickBtn.disabled = true;
    const picked = await api.pickProjectRootFolder();
    if (picked.canceled) return;
    const result = await api.setSavedProjectRoot(picked.path);
    if (!result.ok) {
      alert(result.error || 'Failed to save folder');
      return;
    }
    await refreshAllProjectPathUis();
    initOverlayImages();
    api.setOverlayStatus('idle');
  } catch (e) {
    alert('Failed to pick folder: ' + e.message);
  } finally {
    const cfg = await api.getLauncherConfig();
    pickBtn.disabled = cfg.usesEnvOverride;
  }
}

document.getElementById('settings-project-root-pick')?.addEventListener('click', () => handleProjectPathPick('settings-'));
document.getElementById('wizard-project-root-pick')?.addEventListener('click', () => handleProjectPathPick('wizard-'));
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
      btn.textContent = 'Copied';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    });
  }
});

document.getElementById('settings-save-btn').addEventListener('click', async () => {
  const clientId = document.getElementById('settings-client-id').value.trim();
  const clientSecret = document.getElementById('settings-client-secret').value.trim();
  const ownerId = document.getElementById('settings-owner-id').value.trim();
  const ffmpegVideoBackend = document.getElementById('settings-ffmpeg-backend').value;
  const ffmpegResourceIntensity = document.getElementById('settings-ffmpeg-intensity').value;
  const ffmpegOsPriority = getRadioGroupValue('ffmpeg-os-priority', 'auto');
  const ffmpegOutputPreset = document.getElementById('settings-ffmpeg-output').value;
  
  if (!clientId || !clientSecret) {
    alert('Enter Discord Client ID and Client Secret.');
    return;
  }
  
  const btn = document.getElementById('settings-save-btn');
  btn.disabled = true;
  try {
    const result = await api.updateEnv({
      discordClientId: clientId,
      discordClientSecret: clientSecret,
      serverOwnerDiscordId: ownerId,
      ffmpegVideoBackend,
      ffmpegResourceIntensity,
      ffmpegOsPriority,
      ffmpegOutputPreset,
    });
    if (result.ok) {
      btn.textContent = 'Saved';
      setTimeout(() => { btn.textContent = 'Save settings'; }, 1500);
      if (isServerRunning) {
        alert('Saved. Use Restart on the main screen to apply.');
      }
    } else {
      alert(result.error || 'Save failed');
    }
  } catch (e) {
    alert('Save failed: ' + e.message);
  } finally {
    btn.disabled = false;
  }
});

startServerBtn.addEventListener('click', async () => {
  if (isServerRunning) {
    window.isRestarting = true;
    statusText.textContent = 'Restarting…';
    statusText.classList.remove('stopped');
    startServerBtn.disabled = true;
    logArea.textContent = '';
    try {
      await api.stopServer();
      await new Promise((r) => setTimeout(r, 2000));
      const result = await api.startServer();
      if (!result.ok) {
        api.setOverlayStatus('error');
        statusText.textContent = result.error || 'Restart failed';
        statusText.classList.add('stopped');
        return;
      }
      const url = await api.waitForReady();
      await api.setCurrentUrl(url);
      api.setOverlayStatus('running');
      showRunningState(url);
    } catch (e) {
      api.setOverlayStatus('error');
      statusText.textContent = 'Restart failed';
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
  statusText.textContent = 'Stopping…';
});

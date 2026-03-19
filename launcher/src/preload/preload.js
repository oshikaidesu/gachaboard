const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gachaboard', {
  saveEnv: (data) => ipcRenderer.invoke('save-env', data),
  getEnv: () => ipcRenderer.invoke('get-env'),
  updateEnv: (data) => ipcRenderer.invoke('update-env', data),
  getOAuthRedirectUrls: () => ipcRenderer.invoke('get-oauth-redirect-urls'),
  setOverlayImages: (imgs) => ipcRenderer.invoke('set-overlay-images', imgs),
  setOverlayStatus: (status) => ipcRenderer.invoke('set-overlay-status', status),
  checkEnv: () => ipcRenderer.invoke('check-env'),
  getAppRoot: () => ipcRenderer.invoke('get-app-root'),
  startServer: () => ipcRenderer.invoke('start-server'),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  openBrowser: () => ipcRenderer.invoke('open-browser'),
  setCurrentUrl: (url) => ipcRenderer.invoke('set-current-url', url),
  waitForReady: () => ipcRenderer.invoke('wait-for-ready'),
  onAppRoot: (cb) => ipcRenderer.on('app-root', (_, v) => cb(v)),
  onIconUrl: (cb) => ipcRenderer.on('icon-url', (_, v) => cb(v)),
  onEnvConfigured: (cb) => ipcRenderer.on('env-configured', (_, v) => cb(v)),
  onServerLog: (cb) => ipcRenderer.on('server-log', (_, v) => cb(v)),
  onServerExit: (cb) => ipcRenderer.on('server-exit', (_, v) => cb(v)),
});

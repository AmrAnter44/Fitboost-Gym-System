const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('app:getState'),
  onStatus: (cb) => ipcRenderer.on('tunnel:status', (_e, s) => cb(s)),
  onLog: (cb) => ipcRenderer.on('tunnel:log', (_e, line) => cb(line)),
  start: () => ipcRenderer.send('tunnel:start'),
  stop: () => ipcRenderer.send('tunnel:stop'),
  restart: () => ipcRenderer.send('tunnel:restart'),
  minimize: () => ipcRenderer.send('app:minimize'),
  hide: () => ipcRenderer.send('app:hide'),
  quit: () => ipcRenderer.send('app:quit'),
  openUrl: (u) => ipcRenderer.send('app:openUrl', u),
  openConfig: () => ipcRenderer.send('app:openConfig'),
  reloadConfig: () => ipcRenderer.send('app:reloadConfig'),
  setKeepAwake: (v) => ipcRenderer.send('settings:keepAwake', v),
  setAutoLaunch: (v) => ipcRenderer.send('settings:autoLaunch', v),
  // in-app tunnel setup
  setupStatus: () => ipcRenderer.invoke('setup:status'),
  login: () => ipcRenderer.invoke('setup:login'),
  createTunnel: (data) => ipcRenderer.invoke('setup:create', data),
  onSetupProgress: (cb) => ipcRenderer.on('setup:progress', (_e, line) => cb(line)),
});

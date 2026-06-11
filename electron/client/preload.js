/**
 * Preload script for the Fitboost Assistant splash window.
 * Exposes a safe, minimal API to the renderer.
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('fitboostClient', {
  // Triggers the discovery flow (saved IP → subnet scan).
  startDiscovery: () => ipcRenderer.invoke('start-discovery'),

  // Connect manually to a user-entered IP. Returns { ok, ip?, error? }.
  manualConnect: (ip) => ipcRenderer.invoke('manual-connect', ip),

  // Clear the saved IP so the next launch starts fresh.
  forgetSavedServer: () => ipcRenderer.invoke('forget-saved-server'),

  // Returns { name, version, lastIp }.
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),

  // Closes the app.
  quit: () => ipcRenderer.invoke('quit-app'),

  // Subscribe to discovery progress events. Returns an unsubscribe fn.
  onProgress: (handler) => {
    const listener = (_event, payload) => handler(payload)
    ipcRenderer.on('discover-progress', listener)
    return () => ipcRenderer.removeListener('discover-progress', listener)
  },
})

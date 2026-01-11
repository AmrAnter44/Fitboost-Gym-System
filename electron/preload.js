const { contextBridge, ipcRenderer } = require('electron');

// ✅ عرض API للـ renderer process
contextBridge.exposeInMainWorld('electron', {
  // Existing: الحصول على IP Address المحلي
  getLocalIP: () => ipcRenderer.invoke('get-local-ip'),

  // New: Environment detection
  isElectron: true,
  platform: process.platform,

  // New: Keyboard event logging utility
  logKeyboardEvent: (data) => {
    ipcRenderer.send('log-keyboard-event', data);
  },

  // New: Barcode scanner control
  enableBarcodeScanner: (enabled) => {
    ipcRenderer.send('enable-barcode-scanner', enabled);
  },

  // New: Listen for barcode events from main process
  onBarcodeDetected: (callback) => {
    ipcRenderer.on('barcode-detected', (event, barcode) => {
      callback(barcode);
    });
  },

  // New: Remove barcode listener
  offBarcodeDetected: () => {
    ipcRenderer.removeAllListeners('barcode-detected');
  },

  // Auto Updater: Check for updates
  checkForUpdates: () => {
    ipcRenderer.send('check-for-updates');
  },

  // Auto Updater: Quit and install
  quitAndInstall: () => {
    ipcRenderer.send('quit-and-install');
  },

  // Auto Updater: Listen for update available
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (event, info) => {
      callback(info);
    });
  },

  // Auto Updater: Listen for update downloaded
  onUpdateDownloaded: (callback) => {
    ipcRenderer.on('update-downloaded', (event, info) => {
      callback(info);
    });
  },

  // Auto Updater: Listen for download progress
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, progress) => {
      callback(progress);
    });
  },

  // Auto Updater: Listen for update error
  onUpdateError: (callback) => {
    ipcRenderer.on('update-error', (event, error) => {
      callback(error);
    });
  },

  // Auto Updater: Remove all update listeners
  offUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update-available');
    ipcRenderer.removeAllListeners('update-downloaded');
    ipcRenderer.removeAllListeners('download-progress');
    ipcRenderer.removeAllListeners('update-error');
  }
});

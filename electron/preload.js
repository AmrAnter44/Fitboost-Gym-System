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

  // New: Detect HID devices (keyboards, mice, barcode scanners)
  detectHIDDevices: () => {
    return ipcRenderer.invoke('detect-hid-devices');
  },

  // New: Set current device name for logging
  setCurrentDeviceName: (deviceName) => {
    ipcRenderer.send('set-current-device-name', deviceName);
  },

  // New: Set strict mode for HID device isolation
  setStrictMode: (enabled) => {
    ipcRenderer.send('set-strict-mode', enabled);
  },

  // New: Set barcode detection configuration
  setBarcodeConfig: (config) => {
    ipcRenderer.send('set-barcode-config', config);
  },

  // New: Set SearchModal active state
  setSearchModalActive: (isActive) => {
    ipcRenderer.send('set-search-modal-active', isActive);
  },

  // Auto Updater: Check for updates
  checkForUpdates: () => {
    return ipcRenderer.invoke('check-for-updates');
  },

  // Auto Updater: Download update
  downloadUpdate: () => {
    return ipcRenderer.invoke('download-update');
  },

  // Auto Updater: Install update and restart
  installUpdate: () => {
    return ipcRenderer.invoke('install-update');
  },

  // Auto Updater: Listen for update available
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (event, info) => {
      callback(info);
    });
  },

  // Auto Updater: Listen for no update available
  onUpdateNotAvailable: (callback) => {
    ipcRenderer.on('update-not-available', (event, info) => {
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
    ipcRenderer.removeAllListeners('update-not-available');
    ipcRenderer.removeAllListeners('update-downloaded');
    ipcRenderer.removeAllListeners('download-progress');
    ipcRenderer.removeAllListeners('update-error');
  },

  // PDF: Save PDF to Documents folder
  savePDFToDocuments: (fileName, pdfData) => {
    console.log('📤 preload: savePDFToDocuments called');
    console.log('📄 preload: fileName:', fileName);
    console.log('📊 preload: pdfData type:', typeof pdfData);
    console.log('📏 preload: pdfData length:', pdfData?.length || 0);
    return ipcRenderer.invoke('save-pdf-to-documents', { fileName, pdfData });
  },

  // WhatsApp: Open WhatsApp with PDF ready to share
  openWhatsAppWithPDF: (message, pdfPath, phoneNumber) => {
    console.log('📤 preload: openWhatsAppWithPDF called');
    console.log('💬 Message:', message);
    console.log('📄 PDF path:', pdfPath);
    console.log('📞 Phone:', phoneNumber);
    return ipcRenderer.invoke('open-whatsapp-with-pdf', { message, pdfPath, phoneNumber });
  },

  // Open external URL (WhatsApp, browsers, etc.)
  openExternal: (url) => {
    console.log('🌐 preload: openExternal called with URL:', url);
    return ipcRenderer.invoke('open-external-url', url);
  }
});

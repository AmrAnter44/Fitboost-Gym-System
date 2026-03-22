const { contextBridge, ipcRenderer } = require('electron');

// ✅ عرض API للـ renderer process
contextBridge.exposeInMainWorld('electron', {
  // Existing: الحصول على IP Address المحلي
  getLocalIP: () => ipcRenderer.invoke('get-local-ip'),

  // App Version
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

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
  },

  // ==================== WhatsApp Web.js Integration ====================

  // WhatsApp: Initialize client
  whatsapp: {
    init: () => {
      console.log('📱 preload: whatsapp.init called');
      return ipcRenderer.invoke('whatsapp:init');
    },

    // Get WhatsApp status
    getStatus: () => {
      return ipcRenderer.invoke('whatsapp:status');
    },

    // Send message
    sendMessage: (phone, message) => {
      console.log('📤 preload: whatsapp.sendMessage called');
      console.log('📞 Phone:', phone);
      console.log('💬 Message length:', message?.length || 0);
      return ipcRenderer.invoke('whatsapp:send', { phone, message });
    },

    // Send image with caption
    sendImage: (phone, imageBase64, caption = '') => {
      console.log('📤 preload: whatsapp.sendImage called');
      console.log('📞 Phone:', phone);
      console.log('🖼️ Image data length:', imageBase64?.length || 0);
      console.log('💬 Caption:', caption);
      return ipcRenderer.invoke('whatsapp:sendImage', { phone, imageBase64, caption });
    },

    // Reconnect
    reconnect: () => {
      console.log('🔄 preload: whatsapp.reconnect called');
      return ipcRenderer.invoke('whatsapp:reconnect');
    },

    // Reset session and start fresh
    resetSession: () => {
      console.log('🔄 preload: whatsapp.resetSession called');
      return ipcRenderer.invoke('whatsapp:reset-session');
    },

    // Listen for QR code
    onQR: (callback) => {
      ipcRenderer.on('whatsapp:qr', (event, qr) => {
        callback(qr);
      });
    },

    // Listen for ready event
    onReady: (callback) => {
      ipcRenderer.on('whatsapp:ready', () => {
        callback();
      });
    },

    // Listen for disconnected event
    onDisconnected: (callback) => {
      ipcRenderer.on('whatsapp:disconnected', (event, reason) => {
        callback(reason);
      });
    },

    // Listen for auth failure
    onAuthFailure: (callback) => {
      ipcRenderer.on('whatsapp:auth_failure', (event, msg) => {
        callback(msg);
      });
    },

    // Listen for loading screen (connection progress)
    onLoadingScreen: (callback) => {
      ipcRenderer.on('whatsapp:loading_screen', (event, percent, message) => {
        callback(percent, message);
      });
    },

    // Remove all WhatsApp listeners
    offAllListeners: () => {
      ipcRenderer.removeAllListeners('whatsapp:qr');
      ipcRenderer.removeAllListeners('whatsapp:ready');
      ipcRenderer.removeAllListeners('whatsapp:disconnected');
      ipcRenderer.removeAllListeners('whatsapp:auth_failure');
      ipcRenderer.removeAllListeners('whatsapp:loading_screen');
    }
  }
});

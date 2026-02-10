const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const HID = require('node-hid');
const { startReverseProxy, stopReverseProxy } = require('./reverse-proxy');

// Fix electron-is-dev issue - check manually (use process.env or defaultAppPaths)
const isDev = process.env.NODE_ENV === 'development' || process.defaultApp || /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || /[\\/]electron[\\/]/.test(process.execPath);

// Load autoUpdater - will be initialized after app is ready
let autoUpdater = null;

// uiohook-napi disabled
let uIOhook = null;

let mainWindow;
let serverProcess;

// ------------------ Barcode Scanner Setup ------------------

let keystrokeBuffer = [];
let keystrokeTimer = null;
let barcodeEnabled = false;

function setupBarcodeScanner() {
  console.log('⚠️ Barcode scanner disabled');
  // Barcode scanner functionality has been disabled
}

// ------------------ وظائف مساعدة ------------------

// الحصول على IP Address المحلي
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // تجاهل internal (127.0.0.1) و IPv6
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost'; // fallback
}

// التحقق من المنفذ
function checkPort(port) {
  return new Promise((resolve) => {
    const server = http.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

// إيقاف أي عملية تستخدم المنفذ
async function killProcessOnPort(port) {
  return new Promise((resolve) => {
    exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
      if (!stdout) return resolve();
      const lines = stdout.split('\n');
      const pids = new Set();
      lines.forEach(line => {
        const pid = line.trim().split(/\s+/).pop();
        if (!isNaN(pid)) pids.add(pid);
      });
      pids.forEach(pid => {
        try { process.kill(pid); } catch {}
      });
      setTimeout(resolve, 500);
    });
  });
}

// نسخ مجلدات
function copyFolderRecursive(source, target) {
  if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
  if (fs.lstatSync(source).isDirectory()) {
    fs.readdirSync(source).forEach(file => {
      const curSource = path.join(source, file);
      const curTarget = path.join(target, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursive(curSource, curTarget);
      } else {
        fs.copyFileSync(curSource, curTarget);
      }
    });
  }
}

// ------------------ Database Setup ------------------

/**
 * الحصول على مسار دائم لقاعدة البيانات
 * يستخدم userData path الذي لا يُمسح عند التحديث
 */
function getDatabasePath() {
  // مسار دائم في AppData (لا يُمسح عند التحديث)
  const userDataPath = app.getPath('userData');
  const dbDir = path.join(userDataPath, 'database');
  const dbPath = path.join(dbDir, 'gym.db');

  console.log('📁 Database directory:', dbDir);
  console.log('📊 Database path:', dbPath);

  // إنشاء مجلد database إذا لم يكن موجوداً
  if (!fs.existsSync(dbDir)) {
    console.log('📁 Creating database directory...');
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // ✅ التحقق من قاعدة البيانات - لو فارغة نحذفها
  if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    const sizeMB = stats.size / 1024 / 1024;

    if (sizeMB < 0.1) {
      console.log('⚠️ Database exists but is empty or corrupted (size: ' + sizeMB.toFixed(2) + ' MB)');
      console.log('🗑️ Deleting empty database...');
      fs.unlinkSync(dbPath);
      console.log('✅ Empty database deleted');
    } else {
      console.log(`✅ Database already exists at: ${dbPath} (${sizeMB.toFixed(2)} MB)`);
      return dbPath;
    }
  }

  // ✅ Migration: نسخ قاعدة البيانات من seed
  console.log('🔍 Database not found, searching for seed database...');

  const seedPaths = [
    // في Production - من extraResources (جنب app.asar)
    path.join(process.resourcesPath, 'seed-database', 'gym.db'),
    // في Development
    path.join(process.cwd(), 'prisma', 'prisma', 'gym.db'),
    path.join(process.cwd(), 'prisma', 'gym.db'),
    path.join(__dirname, '..', 'prisma', 'prisma', 'gym.db'),
    path.join(__dirname, '..', 'prisma', 'gym.db')
  ];

  let dbCopied = false;
  for (const seedPath of seedPaths) {
    console.log(`   Checking: ${seedPath}`);
    if (fs.existsSync(seedPath)) {
      console.log('   ✅ Found!');
      console.log('🔄 Copying initial database...');
      console.log('   From:', seedPath);
      console.log('   To:', dbPath);
      try {
        fs.copyFileSync(seedPath, dbPath);

        // التحقق من أن القاعدة فيها بيانات
        const stats = fs.statSync(dbPath);
        console.log(`✅ Database copied successfully! Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

        dbCopied = true;
        break;
      } catch (error) {
        console.error('   ❌ Failed to copy:', error.message);
      }
    } else {
      console.log('   ❌ Not found');
    }
  }

  if (!dbCopied) {
    console.log('⚠️ No seed database found in any location!');
    console.log('ℹ️ Database will be created empty - you need to run setup wizard');
  }

  return dbPath;
}

// ------------------ تشغيل Next Production ------------------

async function startProductionServer() {
  try {
    // ✅ الحصول على مسار قاعدة البيانات الدائم
    const dbPath = getDatabasePath();

    // ✅ تشغيل migration script
    try {
      const { migrateDatabase } = require('./check-and-migrate');
      if (fs.existsSync(dbPath)) {
        migrateDatabase(dbPath);
      }
    } catch (migrationError) {
      console.warn('⚠️ Migration warning:', migrationError.message);
    }

    // kill port إذا مش فاضي
    const portAvailable = await checkPort(4001);
    if (!portAvailable) {
      console.log('Port 4001 in use, killing...');
      await killProcessOnPort(4001);
    }

    // البحث عن مسار Next.js standalone
    const possiblePaths = [
      // في حالة Production - داخل app.asar.unpacked
      path.join(process.resourcesPath, 'app.asar.unpacked', '.next', 'standalone'),
      // في حالة Production - داخل app.asar (fallback)
      path.join(app.getAppPath(), '.next', 'standalone'),
      // في حالة development
      path.join(process.cwd(), '.next', 'standalone'),
      // fallback
      process.cwd()
    ];

    let appPath = null;
    let serverFile = null;

    // البحث عن server.js
    for (const testPath of possiblePaths) {
      const serverPath = path.join(testPath, 'server.js');
      console.log('Checking path:', serverPath);
      if (fs.existsSync(serverPath)) {
        appPath = testPath;
        serverFile = serverPath;
        console.log('✓ Found server at:', serverPath);
        break;
      }
    }

    // إذا مش لاقيين standalone، نستخدم npx next start
    if (!serverFile) {
      console.log('Standalone not found, using npx next start');
      appPath = possiblePaths.find(p => fs.existsSync(path.join(p, 'package.json')));
      if (!appPath) throw new Error('Next.js files not found');

      // استخدام المسار الدائم لقاعدة البيانات
      const dbPath = getDatabasePath();
      const DATABASE_URL = `file:${dbPath}`;

      // إنشاء مسار دائم للصور المرفوعة
      const userDataPath = app.getPath('userData');
      const uploadsPath = path.join(userDataPath, 'uploads');
      if (!fs.existsSync(uploadsPath)) {
        fs.mkdirSync(uploadsPath, { recursive: true });
        console.log('📁 Created uploads directory:', uploadsPath);
      }

      serverProcess = spawn('npx', ['next', 'start', '-p', '4001', '-H', '0.0.0.0'], {
        cwd: appPath,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          PORT: '4001',
          HOSTNAME: '0.0.0.0',
          DATABASE_URL: DATABASE_URL,
          UPLOADS_PATH: uploadsPath
        },
        shell: true,
        stdio: 'pipe'
      });
    } else {
      // تشغيل standalone server.js
      console.log('Starting standalone server with custom public folder support');

      // التحقق من وجود مجلد public
      const publicPath = path.join(appPath, 'public');
      if (fs.existsSync(publicPath)) {
        console.log('✓ Public folder found at:', publicPath);
      } else {
        console.warn('⚠️ Public folder NOT found at:', publicPath);
      }

      // استخدام المسار الدائم لقاعدة البيانات
      const dbPath = getDatabasePath();
      const DATABASE_URL = `file:${dbPath}`;

      // إنشاء مسار دائم للصور المرفوعة
      const userDataPath = app.getPath('userData');
      const uploadsPath = path.join(userDataPath, 'uploads');
      if (!fs.existsSync(uploadsPath)) {
        fs.mkdirSync(uploadsPath, { recursive: true });
        console.log('📁 Created uploads directory:', uploadsPath);
      }

      console.log('App path:', appPath);
      console.log('Database URL:', DATABASE_URL);
      console.log('Uploads path:', uploadsPath);

      // استخدام custom server wrapper للـ public folder support
      // في production، الـ standalone-server.js موجود في app.asar.unpacked
      let customServerPath = path.join(__dirname, 'standalone-server.js');

      // في production، دايماً استخدم unpacked version
      if (!isDev) {
        // في production، __dirname = app.asar/electron
        // محتاجين نروح لـ app.asar.unpacked/electron
        const unpackedPath = __dirname.replace('app.asar', 'app.asar.unpacked');
        customServerPath = path.join(unpackedPath, 'standalone-server.js');
        console.log('Looking for custom server in unpacked:', customServerPath);
      }

      const useCustomServer = fs.existsSync(customServerPath);

      if (useCustomServer) {
        console.log('✓ Using custom server with public folder support');
        console.log('Custom server path:', customServerPath);
        serverProcess = spawn('node', [customServerPath, appPath], {
          cwd: appPath,
          env: {
            ...process.env,
            NODE_ENV: 'production',
            PORT: '4001',
            HOSTNAME: '0.0.0.0',
            DATABASE_URL: DATABASE_URL,
            UPLOADS_PATH: uploadsPath
          },
          shell: false,
          stdio: 'pipe'
        });
      } else {
        console.warn('⚠️ Custom server not found, using default server.js');
        serverProcess = spawn('node', [serverFile], {
          cwd: appPath,
          env: {
            ...process.env,
            NODE_ENV: 'production',
            PORT: '4001',
            HOSTNAME: '0.0.0.0',
            DATABASE_URL: DATABASE_URL,
            UPLOADS_PATH: uploadsPath
          },
          shell: false,
          stdio: 'pipe'
        });
      }
    }

    serverProcess.stdout.on('data', data => console.log(`Next: ${data}`));
    serverProcess.stderr.on('data', data => console.error(`Next ERR: ${data}`));
    serverProcess.on('error', err => console.error('Server failed:', err));
    serverProcess.on('exit', code => { if (code !== 0) console.error('Server exited code:', code); });

  } catch (error) {
    console.error('Error starting server:', error);
    dialog.showErrorBox('خطأ في السيرفر', error.message);
  }
}

// ------------------ إنشاء نافذة Electron ------------------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    center: true,
    icon: path.join(__dirname, '../build/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Disabled for localhost development
      partition: 'gym', // ✅ session مؤقت - مش بيتحفظ بعد إغلاق الأبلكيشن
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      enableBlinkFeatures: 'WebHID,WebSerial', // تفعيل Web HID و Web Serial APIs
      // ✅ السماح بالكاميرا والميكروفون
      experimentalFeatures: true,
      allowRunningInsecureContent: true
    },
    autoHideMenuBar: !isDev,
    title: 'نظام إدارة الصالة الرياضية',
    backgroundColor: '#ffffff',
    show: false
  });

  // ✅ منع فتح نوافذ جديدة في Electron - فتح كل الروابط في المتصفح الخارجي
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log('🔗 Window open requested for:', url);

    // فتح الرابط في المتصفح الخارجي بدلاً من نافذة Electron جديدة
    require('electron').shell.openExternal(url);
    console.log('✅ Opened in external browser');

    // منع فتح نافذة Electron جديدة
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    console.log('✅ Electron window shown and focused (ready-to-show)');
  });

  // Also listen for did-finish-load as backup
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ Page finished loading');
    if (!mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
      console.log('✅ Window shown after did-finish-load');
    }
  });

  // Add keyboard event logging for barcode scanner debugging
  let currentDeviceName = 'Unknown Device';
  let strictModeEnabled = true; // Default to strict mode ON
  let keystrokeBufferStrict = [];
  let keystrokeTimerStrict = null;

  // إعدادات الكشف عن الباركود
  let barcodeConfig = {
    minDigits: 1,
    maxDigits: 4,
    maxTimeBetweenKeys: 25,
    maxTotalTime: 150
  };

  // تتبع حالة SearchModal
  let isSearchModalActive = false;

  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Handle barcode scanner input only
    if (input.type === 'keyDown') {
      // ✅ إذا كان الوضع الصارم مفعّل وكان الجهاز HID محدد (ماعدا لو في SearchModal)
      if (strictModeEnabled && currentDeviceName !== 'Unknown Device' && currentDeviceName !== 'keyboard-wedge-scanner' && !isSearchModalActive) {
        const now = Date.now();

        // Enter key
        if (input.code === 'Enter' || input.key === 'Enter') {
          if (keystrokeBufferStrict.length >= barcodeConfig.minDigits && keystrokeBufferStrict.length <= barcodeConfig.maxDigits) {
            // Check if all are numbers
            const barcodeValue = keystrokeBufferStrict.map(k => k.key).join('');
            const isAllNumbers = /^\d+$/.test(barcodeValue);

            // Check timing - rapid input
            let isRapid = true;
            for (let i = 1; i < keystrokeBufferStrict.length; i++) {
              const timeDiff = keystrokeBufferStrict[i].timestamp - keystrokeBufferStrict[i - 1].timestamp;
              if (timeDiff > barcodeConfig.maxTimeBetweenKeys) {
                isRapid = false;
                break;
              }
            }

            const totalTime = keystrokeBufferStrict.length > 1
              ? keystrokeBufferStrict[keystrokeBufferStrict.length - 1].timestamp - keystrokeBufferStrict[0].timestamp
              : 0;
            const isWithinTimeLimit = totalTime < barcodeConfig.maxTotalTime;

            if (isRapid && isWithinTimeLimit && isAllNumbers) {
              console.log('🔒 STRICT MODE: Barcode detected from HID device:', barcodeValue);
              console.log('⚙️ Config:', barcodeConfig);
              console.log('🚫 Blocking keyboard event and sending to SearchModal');

              // منع الحدث من الوصول للـ renderer
              event.preventDefault();

              // إرسال الباركود للـ renderer عبر IPC
              mainWindow.webContents.send('barcode-detected', barcodeValue);
            }
          }

          keystrokeBufferStrict = [];
          return;
        }

        // Normal keys - collect them
        if (input.key && input.key.length === 1) {
          keystrokeBufferStrict.push({
            key: input.key,
            timestamp: now
          });

          // Clear buffer after 500ms of inactivity
          clearTimeout(keystrokeTimerStrict);
          keystrokeTimerStrict = setTimeout(() => {
            keystrokeBufferStrict = [];
          }, 500);
        }
      }
    }
    // If not strict mode or not HID device, let events flow to renderer normally
  });

  // Listen for device name updates from renderer
  ipcMain.on('set-current-device-name', (event, deviceName) => {
    currentDeviceName = deviceName || 'Unknown Device';
    console.log('📱 Current scanner device set to:', currentDeviceName);
  });

  // Listen for strict mode updates from renderer
  ipcMain.on('set-strict-mode', (event, enabled) => {
    strictModeEnabled = enabled;
    console.log('🔒 Strict mode set to:', enabled ? 'ENABLED' : 'DISABLED');
  });

  // Listen for barcode config updates from renderer
  ipcMain.on('set-barcode-config', (event, config) => {
    barcodeConfig = config;
    console.log('⚙️ Barcode config updated:', config);
  });

  // Listen for SearchModal active state updates
  ipcMain.on('set-search-modal-active', (event, isActive) => {
    isSearchModalActive = isActive;
    console.log('🔍 SearchModal active state:', isActive ? 'ACTIVE' : 'INACTIVE');
  });

  // Ensure window has focus for keyboard events
  mainWindow.on('focus', () => {
    console.log('✅ Electron window focused');
  });

  // Handle HID device selection
  mainWindow.webContents.session.on('select-hid-device', (event, details, callback) => {
    console.log('🔍 HID device selection requested:', details);
    event.preventDefault();

    // إذا كان هناك أجهزة متاحة، اختر الأول (أو يمكنك عرض قائمة للمستخدم)
    if (details.deviceList && details.deviceList.length > 0) {
      console.log('📱 Available HID devices:', details.deviceList.length);
      details.deviceList.forEach((device, index) => {
        console.log(`  Device ${index + 1}:`, {
          productName: device.productName,
          vendorId: device.vendorId,
          productId: device.productId
        });
      });

      // السماح للمستخدم باختيار أي جهاز
      callback(details.deviceList[0].deviceId);
    } else {
      console.log('⚠️ No HID devices available');
      callback(null);
    }
  });

  // Handle HID device permission check
  mainWindow.webContents.session.setDevicePermissionHandler((details) => {
    console.log('🔐 Device permission check:', details);
    // السماح بالوصول لجميع أجهزة HID
    if (details.deviceType === 'hid') {
      console.log('✅ HID device permission granted');
      return true;
    }
    return false;
  });

  // Handle media (camera/microphone) permission requests
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    console.log('🔐 Permission request:', permission);

    // السماح بالوصول للكاميرا والميكروفون
    const allowedPermissions = ['media', 'mediaKeySystem', 'videoCapture', 'audioCapture'];
    if (allowedPermissions.includes(permission)) {
      console.log('✅ Permission granted:', permission);
      callback(true);
    } else {
      console.log('⚠️ Permission denied:', permission);
      callback(false);
    }
  });

  // Handle permission check (for querying permissions)
  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    console.log('🔍 Permission check:', permission, 'from', requestingOrigin);

    // السماح بكل الـ media permissions
    if (permission === 'media' || permission === 'mediaKeySystem' ||
        permission === 'videoCapture' || permission === 'audioCapture') {
      console.log('✅ Permission check approved:', permission);
      return true;
    }

    return true; // السماح بكل الصلاحيات في dev mode
  });

  // حقن Permissions-Policy header للسماح بالكاميرا والمايكروفون
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Permissions-Policy': ['camera=*, microphone=*, display-capture=*']
      }
    });
  });
  console.log('✅ Permissions-Policy headers injected');

  const startUrl = 'http://localhost:4001';
  let attempts = 0, maxAttempts = 60;

  const loadApp = () => {
    attempts++;
    console.log(`🔄 Attempting to connect to server (${attempts}/${maxAttempts})...`);
    http.get(startUrl, (res) => {
      console.log('✅ Server is ready, loading app...');

      // Load URL with options to prevent errors
      mainWindow.loadURL(startUrl, {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }).then(() => {
        console.log('✅ URL loaded successfully');
      }).catch((err) => {
        // Log error but don't fail - page might still load
        console.log('⚠️ Load error (may be safe to ignore):', err.errno);
      });

      // Show window after a delay
      setTimeout(() => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          console.log('✅ Window shown and focused');
        }
      }, 1500);
    })
      .on('error', (err) => {
        console.log(`⏳ Server not ready yet (${err.code}), retrying...`);
        if (attempts < maxAttempts) setTimeout(loadApp, 1000);
        else {
          dialog.showErrorBox('خطأ في التشغيل', 'فشل في بدء خادم التطبيق. يرجى إعادة تشغيل البرنامج.');
          app.quit();
        }
      });
  };
  setTimeout(loadApp, isDev ? 3000 : 3000);

  if (isDev) mainWindow.webContents.openDevTools();
  else {
    mainWindow.removeMenu();
    Menu.setApplicationMenu(null);
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('❌ Page failed to load:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('dom-ready', () => {
    console.log('✅ DOM is ready');
  });

  mainWindow.on('closed', () => {
    console.log('⚠️ Window closed by user');
    mainWindow = null;
    if (serverProcess) serverProcess.kill();
  });
}

// ------------------ IPC Handlers ------------------

// ✅ Handler للحصول على IP Address
ipcMain.handle('get-local-ip', () => {
  return getLocalIPAddress();
});

// ✅ Handler لتسجيل أحداث لوحة المفاتيح (للتشخيص)
ipcMain.on('log-keyboard-event', (event, data) => {
  console.log('📥 Renderer keyboard event:', data);
});

// ✅ Handler لتفعيل/تعطيل barcode scanner
ipcMain.on('enable-barcode-scanner', (event, enabled) => {
  barcodeEnabled = enabled;
  console.log('🔍 Barcode scanner', enabled ? 'enabled' : 'disabled');
});

// ✅ Handler للكشف عن أجهزة HID (USB, لوحات المفاتيح, الماوس, الباركود سكانر)
ipcMain.handle('detect-hid-devices', async () => {
  try {
    console.log('🔍 Detecting HID devices...');
    const devices = HID.devices();

    console.log(`📱 Found ${devices.length} HID devices`);

    // فلترة وتنسيق الأجهزة
    const formattedDevices = devices.map((device, index) => {
      const deviceName = device.product || `USB Device ${index + 1}`;
      const vendorName = device.manufacturer || 'Unknown Vendor';
      const vendorId = device.vendorId?.toString(16).padStart(4, '0') || '0000';
      const productId = device.productId?.toString(16).padStart(4, '0') || '0000';

      // تحديد نوع الجهاز بناءً على usage أو interface
      let deviceType = 'unknown';
      let emoji = '🔌';

      if (device.product) {
        const productLower = device.product.toLowerCase();
        if (productLower.includes('keyboard') || productLower.includes('keypad')) {
          deviceType = 'keyboard';
          emoji = '⌨️';
        } else if (productLower.includes('mouse') || productLower.includes('pointing')) {
          deviceType = 'mouse';
          emoji = '🖱️';
        } else if (productLower.includes('barcode') || productLower.includes('scanner')) {
          deviceType = 'barcode';
          emoji = '🔦';
        }
      }

      // إذا كان الجهاز من نوع HID Usage Page 1 (Generic Desktop)
      if (device.usagePage === 1) {
        if (device.usage === 6) {
          deviceType = 'keyboard';
          emoji = '⌨️';
        } else if (device.usage === 2) {
          deviceType = 'mouse';
          emoji = '🖱️';
        }
      }

      return {
        id: `hid-${vendorId}-${productId}-${index}`,
        label: `${emoji} ${deviceName} (${vendorName})`,
        vendorId: device.vendorId,
        productId: device.productId,
        manufacturer: device.manufacturer,
        product: device.product,
        serialNumber: device.serialNumber,
        path: device.path,
        type: deviceType,
        usagePage: device.usagePage,
        usage: device.usage
      };
    });

    // ترتيب الأجهزة: باركود سكانر أولاً، ثم لوحات المفاتيح، ثم الباقي
    const sortedDevices = formattedDevices.sort((a, b) => {
      const order = { barcode: 0, keyboard: 1, mouse: 2, unknown: 3 };
      return order[a.type] - order[b.type];
    });

    console.log('✅ HID devices formatted and sorted');
    return sortedDevices;
  } catch (error) {
    console.error('❌ Error detecting HID devices:', error);
    return [];
  }
});

// ------------------ Auto Updater Setup ------------------

function setupAutoUpdater() {
  if (isDev) {
    console.log('⚠️ Auto-updater disabled in development mode');
    return;
  }

  console.log('🔄 Setting up auto-updater...');

  // Load autoUpdater module
  if (!autoUpdater) {
    try {
      autoUpdater = require('electron-updater').autoUpdater;
    } catch (error) {
      console.error('❌ Failed to load autoUpdater:', error.message);
      return;
    }
  }

  // Configure autoUpdater
  autoUpdater.autoDownload = false; // لا تحمل تلقائياً، نخلي المستخدم يوافق الأول
  autoUpdater.autoInstallOnAppQuit = true; // تثبيت عند إغلاق التطبيق

  // عند اكتشاف تحديث جديد
  autoUpdater.on('update-available', (info) => {
    console.log('✅ Update available:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update-available', {
        version: info.version,
        releaseNotes: info.releaseNotes,
        releaseDate: info.releaseDate
      });
    }
  });

  // عند عدم وجود تحديث
  autoUpdater.on('update-not-available', (info) => {
    console.log('ℹ️ No updates available. Current version:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update-not-available', {
        version: info.version
      });
    }
  });

  // عند حدوث خطأ
  autoUpdater.on('error', (error) => {
    console.error('❌ Auto-updater error:', error);
    if (mainWindow) {
      mainWindow.webContents.send('update-error', {
        message: error.message
      });
    }
  });

  // تقدم التحميل
  autoUpdater.on('download-progress', (progressInfo) => {
    console.log(`📥 Download progress: ${progressInfo.percent.toFixed(2)}%`);
    if (mainWindow) {
      mainWindow.webContents.send('download-progress', {
        percent: progressInfo.percent,
        transferred: progressInfo.transferred,
        total: progressInfo.total,
        bytesPerSecond: progressInfo.bytesPerSecond
      });
    }
  });

  // عند اكتمال التحميل
  autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ Update downloaded. Version:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', {
        version: info.version,
        releaseNotes: info.releaseNotes
      });
    }
  });

  // التحقق من التحديثات عند بدء التطبيق
  setTimeout(() => {
    console.log('🔍 Checking for updates...');
    autoUpdater.checkForUpdates().catch(err => {
      console.error('❌ Failed to check for updates:', err);
    });
  }, 3000); // انتظر 3 ثواني بعد بدء التطبيق
}

// ------------------ IPC Handlers for Updates ------------------

// التحقق من التحديثات يدوياً
ipcMain.handle('check-for-updates', async () => {
  if (isDev) {
    return { error: 'Updates disabled in development mode' };
  }

  try {
    console.log('🔍 Manual update check requested...');
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: result.updateInfo };
  } catch (error) {
    console.error('❌ Update check failed:', error);
    return { error: error.message };
  }
});

// بدء تحميل التحديث
ipcMain.handle('download-update', async () => {
  if (isDev) {
    return { error: 'Updates disabled in development mode' };
  }

  try {
    console.log('📥 Starting update download...');
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    console.error('❌ Download failed:', error);
    return { error: error.message };
  }
});

// تثبيت التحديث وإعادة التشغيل
ipcMain.handle('install-update', () => {
  if (isDev) {
    return { error: 'Updates disabled in development mode' };
  }

  console.log('🔄 Installing update and restarting...');
  autoUpdater.quitAndInstall(false, true);
});

// فتح WhatsApp مع PDF جاهز للمشاركة
ipcMain.handle('open-whatsapp-with-pdf', async (event, { message, pdfPath, phoneNumber }) => {
  try {
    console.log('📱 Opening WhatsApp with PDF attachment');
    console.log('📄 PDF path:', pdfPath);
    console.log('📞 Phone number:', phoneNumber);
    console.log('💬 Message:', message);

    const { shell } = require('electron');

    // ✅ التحقق من وجود الملف
    if (!fs.existsSync(pdfPath)) {
      console.error('❌ PDF file not found:', pdfPath);
      return { success: false, error: 'PDF file not found' };
    }

    // ✅ محاولة فتح WhatsApp Desktop أولاً
    const whatsappPaths = [
      path.join(process.env.LOCALAPPDATA || '', 'WhatsApp', 'WhatsApp.exe'),
      path.join(process.env.PROGRAMFILES || '', 'WhatsApp', 'WhatsApp.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || '', 'WhatsApp', 'WhatsApp.exe')
    ];

    let whatsappInstalled = false;
    for (const whatsappPath of whatsappPaths) {
      if (fs.existsSync(whatsappPath)) {
        console.log('✅ WhatsApp Desktop found at:', whatsappPath);
        whatsappInstalled = true;

        // فتح WhatsApp Desktop
        try {
          const whatsappProtocol = phoneNumber
            ? `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`
            : `whatsapp://send?text=${encodeURIComponent(message)}`;

          await shell.openExternal(whatsappProtocol);
          console.log('✅ WhatsApp Desktop opened with protocol:', whatsappProtocol);
        } catch (err) {
          console.error('❌ Error opening WhatsApp protocol:', err);
        }
        break;
      }
    }

    // ✅ فتح مجلد الـ PDF في File Explorer
    shell.showItemInFolder(pdfPath);
    console.log('✅ PDF folder opened');

    // ✅ إذا WhatsApp Desktop مش مثبت، افتح WhatsApp Web
    if (!whatsappInstalled) {
      console.log('⚠️ WhatsApp Desktop not found, opening WhatsApp Web instead');
      await new Promise(resolve => setTimeout(resolve, 500));

      const whatsappUrl = phoneNumber
        ? `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;

      await shell.openExternal(whatsappUrl);
      console.log('✅ WhatsApp Web opened');
    }

    console.log('ℹ️ User can drag PDF file from folder to WhatsApp');
    return { success: true, pdfPath };
  } catch (error) {
    console.error('❌ Error opening WhatsApp with PDF:', error);
    return { success: false, error: error.message };
  }
});

// فتح رابط خارجي (WhatsApp, متصفح, إلخ)
ipcMain.handle('open-external-url', async (event, url) => {
  try {
    console.log('🌐 Opening external URL:', url);
    const { shell } = require('electron');

    // فتح الرابط مباشرة في المتصفح الافتراضي
    // المتصفح نفسه سيتعامل مع فتح WhatsApp Desktop أو WhatsApp Web
    await shell.openExternal(url);
    console.log('✅ URL opened successfully');

    return { success: true };
  } catch (error) {
    console.error('❌ Error opening external URL:', error);
    return { success: false, error: error.message };
  }
});

// حفظ PDF في مجلد Documents
ipcMain.handle('save-pdf-to-documents', async (event, { fileName, pdfData }) => {
  try {
    console.log('📥 [MAIN] Received PDF save request');
    console.log('📄 [MAIN] File name:', fileName);
    console.log('📊 [MAIN] pdfData type:', typeof pdfData, Array.isArray(pdfData) ? '(Array)' : '');
    console.log('📏 [MAIN] pdfData length:', pdfData?.length || 0);

    if (Array.isArray(pdfData) && pdfData.length > 0) {
      console.log('🔍 [MAIN] First 10 bytes:', pdfData.slice(0, 10));
      console.log('🔍 [MAIN] Last 10 bytes:', pdfData.slice(-10));
    }

    const documentsPath = app.getPath('documents');
    const receiptsFolder = path.join(documentsPath, 'Gym Receipts');

    // إنشاء المجلد إذا لم يكن موجود
    if (!fs.existsSync(receiptsFolder)) {
      fs.mkdirSync(receiptsFolder, { recursive: true });
    }

    const filePath = path.join(receiptsFolder, fileName);
    console.log('📄 [MAIN] Full file path:', filePath);

    let buffer;

    // ✅ التعامل مع Array من الـ bytes
    if (Array.isArray(pdfData) && pdfData.length > 0) {
      console.log('✅ [MAIN] Converting byte array to Buffer...');
      // استخدام Uint8Array للتأكد من التحويل الصحيح
      const uint8Array = new Uint8Array(pdfData);
      buffer = Buffer.from(uint8Array);
      console.log('💾 [MAIN] Buffer created, size:', buffer.length, 'bytes');
      console.log('🔍 [MAIN] Buffer first 20 bytes hex:', buffer.slice(0, 20).toString('hex'));
    }
    // ✅ التعامل مع base64 string
    else if (typeof pdfData === 'string' && pdfData.length > 0) {
      console.log('📝 [MAIN] Processing as base64 string...');
      let base64Data = pdfData;

      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1];
      }

      base64Data = base64Data.replace(/\s/g, '');
      buffer = Buffer.from(base64Data, 'base64');
    } else {
      console.error('❌ [MAIN] Invalid pdfData:', typeof pdfData, pdfData?.length);
      throw new Error('Invalid pdfData: type=' + typeof pdfData + ', length=' + (pdfData?.length || 0));
    }

    console.log('💾 [MAIN] Final buffer size:', buffer.length, 'bytes');

    if (!buffer || buffer.length === 0) {
      throw new Error('Buffer is empty after conversion');
    }

    // تحقق من PDF signature
    const pdfSignature = buffer.toString('ascii', 0, 8);
    console.log('📄 [MAIN] PDF signature:', JSON.stringify(pdfSignature));

    if (!pdfSignature.startsWith('%PDF')) {
      console.error('⚠️ [MAIN] WARNING: Not a valid PDF! First bytes:', buffer.slice(0, 20).toString('hex'));
    }

    // حذف الملف القديم إذا موجود
    if (fs.existsSync(filePath)) {
      console.log('🗑️ [MAIN] Deleting existing file...');
      fs.unlinkSync(filePath);
    }

    // حفظ الملف
    console.log('💾 [MAIN] Writing file...');
    fs.writeFileSync(filePath, buffer, { encoding: null, flag: 'w' });
    console.log('✅ [MAIN] File written');

    // التحقق من الملف
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`✅ [MAIN] PDF saved successfully!`);
      console.log(`   Path: ${filePath}`);
      console.log(`   Size: ${stats.size} bytes (${(stats.size / 1024).toFixed(2)} KB)`);

      // قراءة أول 20 bytes للتحقق
      const fd = fs.openSync(filePath, 'r');
      const verifyBuffer = Buffer.alloc(20);
      fs.readSync(fd, verifyBuffer, 0, 20, 0);
      fs.closeSync(fd);
      console.log(`   First 20 bytes: ${verifyBuffer.toString('hex')}`);
      console.log(`   As ASCII: ${verifyBuffer.toString('ascii')}`);

      return { success: true, filePath, size: stats.size };
    } else {
      throw new Error('File was not created');
    }
  } catch (error) {
    console.error('❌ [MAIN] Error saving PDF:', error);
    console.error('Stack:', error.stack);
    return { success: false, error: error.message };
  }
});

// ------------------ أحداث التطبيق ------------------

app.whenReady().then(async () => {
  if (!isDev) {
    // Production mode
    await startProductionServer(); // النظام الرئيسي - port 4001
  } else {
    // Development mode
    console.log('🔧 Development mode');
    console.log('💡 Main system should be running on port 4001 (npm run dev)');
  }
  createWindow();
  setupBarcodeScanner();
  setupAutoUpdater(); // إعداد نظام التحديثات
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  if (error.code !== 'EPIPE') dialog.showErrorBox('خطأ غير متوقع', error.message);
});

app.on('before-quit', async () => {
  // Clean up on quit
  console.log('🛑 Shutting down X Gym...');

  // Stop reverse proxy
  await stopReverseProxy();

  // Stop Next.js server
  if (serverProcess) serverProcess.kill();
  await killProcessOnPort(4001);

  console.log('✅ All services stopped');
});

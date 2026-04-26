const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
let HID;
try { HID = require('node-hid'); } catch { HID = null; }
const { startReverseProxy, stopReverseProxy } = require('./reverse-proxy');
const { startWhatsAppService, stopWhatsAppService } = require('./whatsapp-service');

// 🔑 Load .env so GH_TOKEN / INTERNAL_API_TOKEN / etc. are available to main process
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch {
  // dotenv قد لا يكون متوفراً في الإنتاج - غير حرج
}

// Fix electron-is-dev issue - check manually (use process.env or defaultAppPaths)
const isDev = process.env.NODE_ENV === 'development' || process.defaultApp || /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || /[\\/]electron[\\/]/.test(process.execPath);

// Load autoUpdater - will be initialized after app is ready
let autoUpdater = null;

// uiohook-napi disabled
let uIOhook = null;

let mainWindow;
let serverProcess;

// ------------------ Single Instance Lock ------------------
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // نسخة تانية من التطبيق - اقفلها فوراً
  app.quit();
} else {
  // لما حد يحاول يفتح نسخة تانية، فوكس على النافذة الأصلية
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ------------------ Barcode Scanner Setup ------------------

let keystrokeBuffer = [];
let keystrokeTimer = null;
let barcodeEnabled = false;

function setupBarcodeScanner() {
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


  // إنشاء مجلد database إذا لم يكن موجوداً
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // ✅ التحقق من قاعدة البيانات - لو فارغة نحذفها
  if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    const sizeMB = stats.size / 1024 / 1024;

    if (sizeMB < 0.1) {
      fs.unlinkSync(dbPath);
    } else {
      return dbPath;
    }
  }

  // ✅ Migration: نسخ قاعدة البيانات من seed

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
    if (fs.existsSync(seedPath)) {
      try {
        fs.copyFileSync(seedPath, dbPath);

        // التحقق من أن القاعدة فيها بيانات
        const stats = fs.statSync(dbPath);

        dbCopied = true;
        break;
      } catch (error) {
        console.error('   ❌ Failed to copy:', error.message);
      }
    } else {
    }
  }

  if (!dbCopied) {
  }

  return dbPath;
}

// ------------------ تشغيل Next Production ------------------

async function startProductionServer() {
  try {
    // ✅ تشغيل تنظيف البورت بالتوازي مع الميجريشن (مش لازم يستنوا بعض)
    const portCleanup = (async () => {
      const portAvailable = await checkPort(4001);
      if (!portAvailable) {
        await killProcessOnPort(4001);
      }
    })();

    // ✅ الحصول على مسار قاعدة البيانات الدائم
    const dbPath = getDatabasePath();

    // ✅ تشغيل migration engine
    try {
      const { runMigrations } = require('./migrate-database');
      if (fs.existsSync(dbPath)) {
        const migrationResult = runMigrations(dbPath);
        if (migrationResult.errors.length > 0) {
          console.error('❌ Migration error:', migrationResult.errors[0]);
        } else if (migrationResult.applied.length > 0) {
        }
      }
    } catch (migrationError) {
    }

    // ✅ تشغيل check-and-migrate لإضافة أعمدة ناقصة
    try {
      const { migrateDatabase } = require('./check-and-migrate');
      if (fs.existsSync(dbPath)) {
        migrateDatabase(dbPath);
      }
    } catch (checkMigrateError) {
    }

    // ✅ استنى البورت يتنضف قبل ما نشغل السيرفر
    await portCleanup;

    // البحث عن مسار Next.js standalone
    const possiblePaths = [
      // في حالة Production - داخل app.asar.unpacked
      path.join(process.resourcesPath, 'app.asar.unpacked', '.next', 'standalone'),
      // في حالة development
      path.join(process.cwd(), '.next', 'standalone')
    ];

    let appPath = null;
    let serverFile = null;

    // البحث عن server.js
    for (const testPath of possiblePaths) {
      const serverPath = path.join(testPath, 'server.js');
      if (fs.existsSync(serverPath)) {
        appPath = testPath;
        serverFile = serverPath;
        break;
      }
    }

    if (!serverFile) {
      throw new Error('Standalone server.js not found!');
    }

    // استخدام المسار الدائم لقاعدة البيانات
    const DATABASE_URL = `file:${dbPath}`;

    // إنشاء مسار دائم للصور المرفوعة
    const userDataPath = app.getPath('userData');
    const uploadsPath = path.join(userDataPath, 'uploads');
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true });
    }

    // 🔒 Internal API token — shared secret between Next.js and the WhatsApp sidecar
    // يُولَّد مرة واحدة ويُخزَّن في userData؛ نفس القيمة تُصَدَّر لكل الـ child processes
    const tokenFile = path.join(userDataPath, '.internal-api-token');
    if (!process.env.INTERNAL_API_TOKEN) {
      try {
        if (fs.existsSync(tokenFile)) {
          process.env.INTERNAL_API_TOKEN = fs.readFileSync(tokenFile, 'utf-8').trim();
        }
      } catch {}
      if (!process.env.INTERNAL_API_TOKEN || process.env.INTERNAL_API_TOKEN.length < 16) {
        const { randomBytes } = require('crypto');
        const generated = randomBytes(32).toString('hex');
        try {
          fs.writeFileSync(tokenFile, generated, { mode: 0o600 });
        } catch {}
        process.env.INTERNAL_API_TOKEN = generated;
      }
    }


    // Use server-wrapper.js to properly set up module resolution
    // In production, wrapper is copied to standalone directory
    const wrapperPath = path.join(appPath, 'server-wrapper.js');


    // Verify wrapper exists
    if (!fs.existsSync(wrapperPath)) {
      throw new Error('server-wrapper.js not found at: ' + wrapperPath);
    }

    // Use Electron's Node.js (which has access to bundled modules)
    // but run wrapper which will set up NODE_PATH correctly
    serverProcess = spawn(process.execPath, [wrapperPath, appPath], {
      cwd: appPath,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: '4001',
        // LAN access مطلوب لأجهزة الموظفين. الحماية للـ internal endpoints
        // بتتم عبر INTERNAL_API_TOKEN في middleware.ts
        HOSTNAME: process.env.HOSTNAME || '0.0.0.0',
        DATABASE_URL: DATABASE_URL,
        UPLOADS_PATH: uploadsPath,
        INTERNAL_API_TOKEN: process.env.INTERNAL_API_TOKEN,
        ELECTRON_RUN_AS_NODE: '1'
      },
      shell: false,
      stdio: 'pipe'
    });

    serverProcess.stdout.on('data', () => {});
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
      partition: 'persist:gym', // ✅ session دائم - بيتحفظ بعد إغلاق الأبلكيشن
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      enableBlinkFeatures: 'WebHID,WebSerial', // تفعيل Web HID و Web Serial APIs
      // ✅ السماح بالكاميرا والميكروفون
      experimentalFeatures: true,
      allowRunningInsecureContent: true,
      webviewTag: true, // ✅ تفعيل webview لعرض واتساب ويب
    },
    autoHideMenuBar: !isDev,
    title: 'نظام إدارة الصالة الرياضية',
    backgroundColor: '#ffffff',
    show: false
  });

  // ✅ مسح كوكيز تسجيل الدخول عند فتح التطبيق (المستخدم يسجل دخول كل مرة)
  mainWindow.webContents.session.cookies.remove('http://localhost', 'auth-token').catch(() => {});
  mainWindow.webContents.session.cookies.remove('http://localhost:4001', 'auth-token').catch(() => {});

  // ✅ منع فتح نوافذ جديدة في Electron - فتح كل الروابط في المتصفح الخارجي
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {

    // السماح بفتح نوافذ about:blank للطباعة
    if (!url || url === 'about:blank') {
      return { action: 'allow' };
    }

    // فتح الرابط في المتصفح الخارجي بدلاً من نافذة Electron جديدة
    require('electron').shell.openExternal(url);

    // منع فتح نافذة Electron جديدة
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Also listen for did-finish-load as backup
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
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
  });

  // Listen for strict mode updates from renderer
  ipcMain.on('set-strict-mode', (event, enabled) => {
    strictModeEnabled = enabled;
  });

  // Listen for barcode config updates from renderer
  ipcMain.on('set-barcode-config', (event, config) => {
    barcodeConfig = config;
  });

  // Listen for SearchModal active state updates
  ipcMain.on('set-search-modal-active', (event, isActive) => {
    isSearchModalActive = isActive;
  });

  // Ensure window has focus for keyboard events
  mainWindow.on('focus', () => {
  });

  // Handle HID device selection
  mainWindow.webContents.session.on('select-hid-device', (event, details, callback) => {
    event.preventDefault();

    // إذا كان هناك أجهزة متاحة، اختر الأول (أو يمكنك عرض قائمة للمستخدم)
    if (details.deviceList && details.deviceList.length > 0) {

      // السماح للمستخدم باختيار أي جهاز
      callback(details.deviceList[0].deviceId);
    } else {
      callback(null);
    }
  });

  // Handle HID device permission check
  mainWindow.webContents.session.setDevicePermissionHandler((details) => {
    // السماح بالوصول لجميع أجهزة HID
    if (details.deviceType === 'hid') {
      return true;
    }
    return false;
  });

  // Handle media (camera/microphone) permission requests
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {

    // السماح بالوصول للكاميرا والميكروفون
    const allowedPermissions = ['media', 'mediaKeySystem', 'videoCapture', 'audioCapture'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Handle permission check (for querying permissions)
  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {

    // السماح بكل الـ media permissions
    if (permission === 'media' || permission === 'mediaKeySystem' ||
        permission === 'videoCapture' || permission === 'audioCapture') {
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

  // ✅ Setup permissions for WhatsApp Web webview partitions
  const { session: electronSession } = require('electron');
  for (let i = 0; i < 6; i++) {
    const waSession = electronSession.fromPartition(`persist:whatsapp-${i}`);
    waSession.setPermissionRequestHandler((wc, permission, callback) => {
      const allowed = ['media', 'mediaKeySystem', 'videoCapture', 'audioCapture', 'notifications', 'clipboard-read', 'clipboard-sanitized-write'];
      callback(allowed.includes(permission));
    });
    waSession.setPermissionCheckHandler(() => true);
    // Remove X-Frame-Options and CSP headers that might block embedding
    waSession.webRequest.onHeadersReceived((details, callback) => {
      const headers = { ...details.responseHeaders };
      delete headers['x-frame-options'];
      delete headers['X-Frame-Options'];
      delete headers['content-security-policy'];
      delete headers['Content-Security-Policy'];
      callback({ responseHeaders: headers });
    });
  }

  const startUrl = 'http://localhost:4001';
  let attempts = 0, maxAttempts = 120;

  const loadApp = () => {
    attempts++;
    http.get(startUrl, (res) => {

      // Load URL with options to prevent errors
      mainWindow.loadURL(startUrl, {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }).then(() => {
      }).catch((err) => {
        // Log error but don't fail - page might still load
      });
    })
      .on('error', (err) => {
        if (attempts < maxAttempts) setTimeout(loadApp, 500);
        else {
          dialog.showErrorBox('خطأ في التشغيل', 'فشل في بدء خادم التطبيق. يرجى إعادة تشغيل البرنامج.');
          app.quit();
        }
      });
  };
  // ✅ بدء المحاولة بعد ثانية واحدة فقط بدل 3
  setTimeout(loadApp, 1000);

  if (isDev) mainWindow.webContents.openDevTools();
  else {
    mainWindow.removeMenu();
    Menu.setApplicationMenu(null);
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('❌ Page failed to load:', errorCode, errorDescription);
  });

  mainWindow.webContents.on('dom-ready', () => {
  });

  mainWindow.on('closed', async () => {
    mainWindow = null;

    // Force cleanup on Windows
    if (process.platform === 'win32') {

      // Kill server process tree
      if (serverProcess && serverProcess.pid) {
        try {
          require('child_process').execSync(`taskkill /pid ${serverProcess.pid} /T /F`, {
            stdio: 'ignore'
          });
        } catch (err) {
          // Process may already be dead
        }
      }

      // Kill port 4001
      try {
        await killProcessOnPort(4001);
      } catch (err) {
        // Ignore errors
      }
    } else {
      if (serverProcess) serverProcess.kill();
    }
  });
}

// ------------------ IPC Handlers ------------------

// ✅ Handler للحصول على App Version
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// ✅ Handler للحصول على IP Address
ipcMain.handle('get-local-ip', () => {
  return getLocalIPAddress();
});

// ✅ Handler لتسجيل أحداث لوحة المفاتيح (للتشخيص)
ipcMain.on('log-keyboard-event', (event, data) => {
});

// ✅ Handler لتفعيل/تعطيل barcode scanner
ipcMain.on('enable-barcode-scanner', (event, enabled) => {
  barcodeEnabled = enabled;
});

// ✅ Handler للكشف عن أجهزة HID (USB, لوحات المفاتيح, الماوس, الباركود سكانر)
ipcMain.handle('detect-hid-devices', async () => {
  try {
    const devices = HID ? HID.devices() : [];


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

    return sortedDevices;
  } catch (error) {
    console.error('❌ Error detecting HID devices:', error);
    return [];
  }
});

// ------------------ Auto Updater Setup ------------------

function setupAutoUpdater() {
  if (isDev) {
    return;
  }


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
  autoUpdater.allowDowngrade = true; // السماح بالرجوع لإصدار أقدم لو حصلت مشكلة

  // 🔑 لو الـ repo خاص (private)، لازم نمرر GH_TOKEN عشان autoUpdater يقدر يحمّل
  const ghToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (ghToken) {
    try {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'AmrAnter44',
        repo: 'Fitboost-Gym-System',
        private: true,
        token: ghToken
      });
      // fallback — في حالة الـ provider العادي لسه ما يقبلش الـ token
      autoUpdater.requestHeaders = { Authorization: `token ${ghToken}` };
    } catch (err) {
      console.error('⚠️ Failed to configure autoUpdater with GH_TOKEN:', err.message);
    }
  }

  // عند اكتشاف تحديث جديد
  autoUpdater.on('update-available', (info) => {
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
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', {
        version: info.version,
        releaseNotes: info.releaseNotes
      });
    }
  });

  // التحقق من التحديثات عند بدء التطبيق
  setTimeout(() => {
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

  autoUpdater.quitAndInstall(true, true); // silent install عشان ما يظهرش اختيار مسار التثبيت
});

// فتح WhatsApp مع PDF جاهز للمشاركة
ipcMain.handle('open-whatsapp-with-pdf', async (event, { message, pdfPath, phoneNumber }) => {
  try {

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
        whatsappInstalled = true;

        // فتح WhatsApp Desktop
        try {
          const whatsappProtocol = phoneNumber
            ? `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`
            : `whatsapp://send?text=${encodeURIComponent(message)}`;

          await shell.openExternal(whatsappProtocol);
        } catch (err) {
          console.error('❌ Error opening WhatsApp protocol:', err);
        }
        break;
      }
    }

    // ✅ فتح مجلد الـ PDF في File Explorer
    shell.showItemInFolder(pdfPath);

    // ✅ إذا WhatsApp Desktop مش مثبت، افتح WhatsApp Web
    if (!whatsappInstalled) {
      await new Promise(resolve => setTimeout(resolve, 500));

      const whatsappUrl = phoneNumber
        ? `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;

      await shell.openExternal(whatsappUrl);
    }

    return { success: true, pdfPath };
  } catch (error) {
    console.error('❌ Error opening WhatsApp with PDF:', error);
    return { success: false, error: error.message };
  }
});

// فتح رابط خارجي (WhatsApp, متصفح, إلخ)
ipcMain.handle('open-external-url', async (event, url) => {
  try {
    const { shell } = require('electron');

    // فتح الرابط مباشرة في المتصفح الافتراضي
    // المتصفح نفسه سيتعامل مع فتح WhatsApp Desktop أو WhatsApp Web
    await shell.openExternal(url);

    return { success: true };
  } catch (error) {
    console.error('❌ Error opening external URL:', error);
    return { success: false, error: error.message };
  }
});

// حفظ PDF في مجلد Documents
ipcMain.handle('save-pdf-to-documents', async (event, { fileName, pdfData }) => {
  try {

    if (Array.isArray(pdfData) && pdfData.length > 0) {
    }

    const documentsPath = app.getPath('documents');
    const receiptsFolder = path.join(documentsPath, 'Gym Receipts');

    // إنشاء المجلد إذا لم يكن موجود
    if (!fs.existsSync(receiptsFolder)) {
      fs.mkdirSync(receiptsFolder, { recursive: true });
    }

    const filePath = path.join(receiptsFolder, fileName);

    let buffer;

    // ✅ التعامل مع Array من الـ bytes
    if (Array.isArray(pdfData) && pdfData.length > 0) {
      // استخدام Uint8Array للتأكد من التحويل الصحيح
      const uint8Array = new Uint8Array(pdfData);
      buffer = Buffer.from(uint8Array);
    }
    // ✅ التعامل مع base64 string
    else if (typeof pdfData === 'string' && pdfData.length > 0) {
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


    if (!buffer || buffer.length === 0) {
      throw new Error('Buffer is empty after conversion');
    }

    // تحقق من PDF signature
    const pdfSignature = buffer.toString('ascii', 0, 8);

    if (!pdfSignature.startsWith('%PDF')) {
      console.error('⚠️ [MAIN] WARNING: Not a valid PDF! First bytes:', buffer.slice(0, 20).toString('hex'));
    }

    // حذف الملف القديم إذا موجود
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // حفظ الملف
    fs.writeFileSync(filePath, buffer, { encoding: null, flag: 'w' });

    // التحقق من الملف
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);

      // قراءة أول 20 bytes للتحقق
      const fd = fs.openSync(filePath, 'r');
      const verifyBuffer = Buffer.alloc(20);
      fs.readSync(fd, verifyBuffer, 0, 20, 0);
      fs.closeSync(fd);

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

// ==================== WhatsApp Handlers ====================

// ==================== WhatsApp ====================
// WhatsApp is handled entirely by the Next.js API backend (lib/whatsapp.ts).
// No IPC handlers needed – the settings page uses fetch('/api/whatsapp/*') directly.
// This works in both the Electron webview and any network browser via port forwarding.

// ------------------ أحداث التطبيق ------------------

app.whenReady().then(async () => {
  // ✅ إنشاء النافذة فوراً (بتظهر splash/loading) بالتوازي مع تشغيل السيرفر
  createWindow();
  setupBarcodeScanner();

  if (!isDev) {
    // Production mode — تشغيل السيرفر بالتوازي
    startProductionServer();
  } else {
    // Development mode
  }

  // ✅ Auto-updater + WhatsApp بالتوازي (مش blocking)
  setupAutoUpdater();
  startWhatsAppService().then(port => {
  }).catch(err => {
    console.error('❌ WhatsApp sidecar failed to start:', err.message);
  });
});

app.on('window-all-closed', async () => {

  // Force cleanup on Windows
  if (process.platform === 'win32') {
    if (serverProcess && serverProcess.pid) {
      try {
        require('child_process').execSync(`taskkill /pid ${serverProcess.pid} /T /F`, {
          stdio: 'ignore'
        });
      } catch (err) {
        // Ignore
      }
    }

    // Kill port
    try {
      await killProcessOnPort(4001);
    } catch (err) {
      // Ignore
    }

    // Force quit
    app.quit();
  } else {
    if (serverProcess) serverProcess.kill();
    if (process.platform !== 'darwin') app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  if (error.code !== 'EPIPE') dialog.showErrorBox('خطأ غير متوقع', error.message);
});

app.on('before-quit', async (event) => {
  // Prevent default quit to allow cleanup
  event.preventDefault();


  try {
    // 1. Stop WhatsApp sidecar
    await stopWhatsAppService();

    // 2. Stop reverse proxy
    await stopReverseProxy();

    // 3. Stop Next.js server forcefully
    if (serverProcess) {

      // On Windows, use taskkill for force kill
      if (process.platform === 'win32') {
        try {
          require('child_process').execSync(`taskkill /pid ${serverProcess.pid} /T /F`, {
            stdio: 'ignore'
          });
        } catch (err) {
        }
      }

      serverProcess.kill('SIGTERM');

      // Wait a bit then force kill
      setTimeout(() => {
        if (serverProcess && !serverProcess.killed) {
          serverProcess.kill('SIGKILL');
        }
      }, 1000);
    }

    // 4. Kill any process on port 4001
    await killProcessOnPort(4001);

  } catch (error) {
    console.error('Error during shutdown:', error);
  } finally {
    // Force quit after cleanup
    setTimeout(() => {
      app.exit(0);
    }, 1500);
  }
});

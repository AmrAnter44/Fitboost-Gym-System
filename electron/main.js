const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const isDev = require('electron-is-dev');
const fs = require('fs');
const http = require('http');
const os = require('os');
const HID = require('node-hid');
const { autoUpdater } = require('electron-updater');

// Load uiohook-napi from unpacked location in production
let uIOhook;
try {
  if (!isDev && process.resourcesPath) {
    // في Production - من app.asar.unpacked
    const unpackedPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'uiohook-napi');
    uIOhook = require(unpackedPath);
  } else {
    // في Development
    uIOhook = require('uiohook-napi');
  }
  console.log('✅ uiohook-napi loaded successfully');
} catch (error) {
  console.error('❌ Failed to load uiohook-napi:', error.message);
  uIOhook = null;
}

let mainWindow;
let serverProcess;

// ------------------ Barcode Scanner Setup ------------------

let keystrokeBuffer = [];
let keystrokeTimer = null;
let barcodeEnabled = false;

function setupBarcodeScanner() {
  console.log('🔍 Setting up barcode scanner with uiohook-napi...');

  if (!uIOhook) {
    console.error('❌ uiohook-napi not available - barcode scanner disabled');
    return;
  }

  uIOhook.on('keydown', (e) => {
    if (!barcodeEnabled || !mainWindow) return;

    const now = Date.now();

    // Enter key (keycode 28)
    if (e.keycode === 28) {
      if (keystrokeBuffer.length >= 6) {
        // Check timing - all keys should be within 150ms of each other
        let isRapid = true;
        for (let i = 1; i < keystrokeBuffer.length; i++) {
          const timeDiff = keystrokeBuffer[i].timestamp - keystrokeBuffer[i - 1].timestamp;
          if (timeDiff > 150) {
            isRapid = false;
            break;
          }
        }

        const totalTime = keystrokeBuffer[keystrokeBuffer.length - 1].timestamp - keystrokeBuffer[0].timestamp;
        const isWithinTimeLimit = totalTime < 800;

        if (isRapid && isWithinTimeLimit) {
          const barcode = keystrokeBuffer.map(k => k.key).join('');

          console.log('🔍 Barcode detected:', barcode);
          console.log('⏱️ Timing:', {
            totalTime,
            charCount: keystrokeBuffer.length,
            avgTimeBetween: keystrokeBuffer.length > 1 ? totalTime / (keystrokeBuffer.length - 1) : 0
          });

          // Send to renderer
          mainWindow.webContents.send('barcode-detected', barcode);
        }
      }

      keystrokeBuffer = [];
      return;
    }

    // Normal keys - collect them
    if (e.keychar && e.keychar.length === 1) {
      keystrokeBuffer.push({
        key: e.keychar,
        timestamp: now
      });

      // Clear buffer after 500ms of inactivity
      clearTimeout(keystrokeTimer);
      keystrokeTimer = setTimeout(() => {
        keystrokeBuffer = [];
      }, 500);
    }
  });

  // Start listening
  uIOhook.start();
  console.log('✅ Barcode scanner listening...');
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

      serverProcess = spawn('npx', ['next', 'start', '-p', '4001', '-H', '0.0.0.0'], {
        cwd: appPath,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          PORT: '4001',
          HOSTNAME: '0.0.0.0',
          DATABASE_URL: DATABASE_URL
        },
        shell: true,
        stdio: 'pipe'
      });
    } else {
      // تشغيل standalone server.js
      console.log('Starting standalone server');

      // استخدام المسار الدائم لقاعدة البيانات
      const dbPath = getDatabasePath();
      const DATABASE_URL = `file:${dbPath}`;

      console.log('App path:', appPath);
      console.log('Database URL:', DATABASE_URL);

      serverProcess = spawn('node', [serverFile], {
        cwd: appPath,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          PORT: '4001',
          HOSTNAME: '0.0.0.0',
          DATABASE_URL: DATABASE_URL
        },
        shell: false,
        stdio: 'pipe'
      });
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
      webSecurity: false,
      partition: 'persist:gym', // حفظ الـ cookies والـ session
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      enableBlinkFeatures: 'WebHID,WebSerial' // تفعيل Web HID و Web Serial APIs
    },
    autoHideMenuBar: !isDev,
    title: 'نظام إدارة الصالة الرياضية',
    backgroundColor: '#ffffff',
    show: false
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus(); // Explicitly focus window
    console.log('✅ Electron window shown and focused');
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
    // Log all keyboard events for debugging
    if (input.type === 'keyDown') {
      console.log('🔍 Electron keyboard event:', {
        key: input.key,
        code: input.code,
        type: input.type,
        timestamp: Date.now(),
        device: currentDeviceName,
        strictMode: strictModeEnabled
      });

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

  const startUrl = 'http://localhost:4001';
  let attempts = 0, maxAttempts = 30;

  const loadApp = () => {
    attempts++;
    http.get(startUrl, () => mainWindow.loadURL(startUrl))
      .on('error', () => {
        if (attempts < maxAttempts) setTimeout(loadApp, 1000);
        else {
          dialog.showErrorBox('خطأ في التشغيل', 'فشل في بدء خادم التطبيق. يرجى إعادة تشغيل البرنامج.');
          app.quit();
        }
      });
  };
  setTimeout(loadApp, isDev ? 100 : 3000);

  if (isDev) mainWindow.webContents.openDevTools();
  else {
    mainWindow.removeMenu();
    Menu.setApplicationMenu(null);
  }

  mainWindow.on('closed', () => {
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

// ------------------ أحداث التطبيق ------------------

app.whenReady().then(async () => {
  if (!isDev) await startProductionServer();
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
  // Stop barcode scanner
  try {
    uIOhook.stop();
    console.log('✅ Barcode scanner stopped');
  } catch (error) {
    console.error('Error stopping barcode scanner:', error);
  }

  if (serverProcess) serverProcess.kill();
  await killProcessOnPort(4001);
});

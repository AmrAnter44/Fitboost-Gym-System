const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const isDev = require('electron-is-dev');
const fs = require('fs');
const http = require('http');
const os = require('os');
const uIOhook = require('uiohook-napi');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let serverProcess;

// ------------------ Barcode Scanner Setup ------------------

let keystrokeBuffer = [];
let keystrokeTimer = null;
let barcodeEnabled = false;

function setupBarcodeScanner() {
  console.log('🔍 Setting up barcode scanner with uiohook-napi...');

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

// ------------------ Auto Updater Setup ------------------

function setupAutoUpdater() {
  console.log('🔄 Setting up auto updater...');

  // تعطيل التحديث التلقائي في وضع التطوير
  if (isDev) {
    console.log('⚠️ Auto-updater disabled in development mode');
    autoUpdater.checkForUpdates = () => {
      console.log('Development mode - skipping update check');
      return Promise.resolve(null);
    };
    return;
  }

  // إعداد autoUpdater
  autoUpdater.autoDownload = true; // تحميل تلقائي
  autoUpdater.autoInstallOnAppQuit = true; // تثبيت عند الإغلاق

  // فحص التحديثات كل 10 دقائق
  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 10 * 60 * 1000);

  // عند العثور على تحديث
  autoUpdater.on('update-available', (info) => {
    console.log('🔄 Update available:', info.version);
    mainWindow.webContents.send('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    });
  });

  // عند عدم وجود تحديثات
  autoUpdater.on('update-not-available', (info) => {
    console.log('✅ App is up to date:', info.version);
  });

  // عند تحميل التحديث
  autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ Update downloaded:', info.version);
    mainWindow.webContents.send('update-downloaded', {
      version: info.version,
      releaseNotes: info.releaseNotes
    });
  });

  // نسبة التحميل
  autoUpdater.on('download-progress', (progressObj) => {
    const percent = progressObj.percent.toFixed(2);
    console.log(`📥 Download progress: ${percent}%`);
    mainWindow.webContents.send('download-progress', {
      percent: parseFloat(percent),
      transferred: progressObj.transferred,
      total: progressObj.total,
      bytesPerSecond: progressObj.bytesPerSecond
    });
  });

  // عند حدوث خطأ
  autoUpdater.on('error', (error) => {
    console.error('❌ Update error:', error);
    mainWindow.webContents.send('update-error', {
      message: error.message
    });
  });

  console.log('✅ Auto updater ready');
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

  // ✅ Migration: نسخ قاعدة البيانات من المكان القديم (إن وُجدت)
  if (!fs.existsSync(dbPath)) {
    const oldPaths = [
      path.join(process.resourcesPath, 'app', 'prisma', 'gym.db'),
      path.join(process.cwd(), 'prisma', 'gym.db'),
      path.join(__dirname, '..', 'prisma', 'gym.db')
    ];

    for (const oldPath of oldPaths) {
      if (fs.existsSync(oldPath)) {
        console.log('🔄 Migrating database from old location...');
        console.log('   From:', oldPath);
        console.log('   To:', dbPath);
        fs.copyFileSync(oldPath, dbPath);
        console.log('✅ Database migrated successfully!');
        break;
      }
    }
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
      // في حالة extraResources (Production)
      path.join(process.resourcesPath, 'app'),
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
      preload: path.join(__dirname, 'preload.js')
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
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Log all keyboard events for debugging
    if (input.type === 'keyDown') {
      console.log('🔍 Electron keyboard event:', {
        key: input.key,
        code: input.code,
        type: input.type,
        timestamp: Date.now()
      });
    }
    // Don't prevent - let events flow to renderer
  });

  // Ensure window has focus for keyboard events
  mainWindow.on('focus', () => {
    console.log('✅ Electron window focused');
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

// ✅ Handlers للتحديث التلقائي
ipcMain.on('check-for-updates', () => {
  if (!isDev) {
    autoUpdater.checkForUpdates();
  }
});

ipcMain.on('quit-and-install', () => {
  autoUpdater.quitAndInstall();
});

// ------------------ أحداث التطبيق ------------------

app.whenReady().then(async () => {
  if (!isDev) await startProductionServer();
  createWindow();
  setupBarcodeScanner();
  setupAutoUpdater();

  // فحص التحديثات بعد 3 ثواني من بدء التشغيل
  setTimeout(() => {
    if (!isDev) {
      autoUpdater.checkForUpdates();
    }
  }, 3000);
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

/**
 * Fitboost Assistant — Client-only Electron app.
 *
 * On launch:
 *   1. Shows splash window
 *   2. Tries saved IP from previous session
 *   3. Falls back to LAN subnet scan
 *   4. On finding the server, loads http://<ip>:4001 in the main window
 *   5. If nothing found, lets user enter the IP manually from the splash
 *
 * Designed to be small and dependency-free (no Next.js, no Prisma, no WhatsApp).
 */

const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { discoverServer, probeHost, PORT } = require('./discover')

const SERVER_PORT = PORT
const LAST_SERVER_FILE_NAME = 'last-server.json'

let splashWindow = null
let mainWindow = null

// ─────────────────────────────────────────────────────────────────────────────
// Single instance lock — only one Fitboost Assistant at a time
// ─────────────────────────────────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    } else if (splashWindow) {
      if (splashWindow.isMinimized()) splashWindow.restore()
      splashWindow.focus()
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence — remember the last working server IP across launches
// ─────────────────────────────────────────────────────────────────────────────
function getLastServerFilePath() {
  return path.join(app.getPath('userData'), LAST_SERVER_FILE_NAME)
}

function readLastServer() {
  try {
    const filePath = getLastServerFilePath()
    if (!fs.existsSync(filePath)) return null
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    return typeof parsed?.ip === 'string' ? parsed.ip : null
  } catch {
    return null
  }
}

function saveLastServer(ip) {
  try {
    fs.writeFileSync(
      getLastServerFilePath(),
      JSON.stringify({ ip, savedAt: new Date().toISOString() }),
      { mode: 0o600 }
    )
  } catch (e) {
    console.error('Failed to save last server IP:', e.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Windows
// ─────────────────────────────────────────────────────────────────────────────
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 520,
    height: 480,
    resizable: false,
    frame: false,
    center: true,
    transparent: false,
    backgroundColor: '#0f172a',
    icon: path.join(__dirname, '..', '..', 'public', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'Fitboost Assistant',
    show: false,
  })

  splashWindow.loadFile(path.join(__dirname, 'splash.html'))
  splashWindow.once('ready-to-show', () => splashWindow.show())
  splashWindow.on('closed', () => { splashWindow = null })
}

function createMainWindow(serverIp) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    center: true,
    icon: path.join(__dirname, '..', '..', 'public', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // LAN HTTP is not HTTPS
      partition: 'persist:fitboost-assistant',
      enableBlinkFeatures: 'WebHID,WebSerial',
      experimentalFeatures: true,
      allowRunningInsecureContent: true,
    },
    autoHideMenuBar: true,
    title: 'Fitboost Assistant',
    backgroundColor: '#ffffff',
    show: false,
  })

  // Open external links in the default browser instead of new Electron windows
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url || url === 'about:blank') return { action: 'allow' }
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Camera/mic permissions for the gym system features
  mainWindow.webContents.session.setPermissionRequestHandler((wc, permission, callback) => {
    const allowed = ['media', 'mediaKeySystem', 'videoCapture', 'audioCapture', 'notifications']
    callback(allowed.includes(permission))
  })

  const url = `http://${serverIp}:${SERVER_PORT}`
  mainWindow.loadURL(url, {
    userAgent: 'Mozilla/5.0 (Fitboost Assistant) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.focus()
    if (splashWindow) {
      splashWindow.close()
      splashWindow = null
    }
  })

  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
    console.error('Main window failed to load:', errorCode, errorDescription)
  })

  mainWindow.on('closed', () => { mainWindow = null })
  Menu.setApplicationMenu(null)
}

// ─────────────────────────────────────────────────────────────────────────────
// Discovery orchestration — called by splash on launch, retry, manual entry
// ─────────────────────────────────────────────────────────────────────────────
async function startDiscovery() {
  const lastIp = readLastServer()
  const found = await discoverServer(lastIp, (phase, info) => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.send('discover-progress', { phase, info })
    }
  })
  if (found) {
    saveLastServer(found)
    createMainWindow(found)
  } else {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.send('discover-progress', { phase: 'not-found', info: {} })
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IPC — splash → main process
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('start-discovery', async () => {
  startDiscovery()
  return { started: true }
})

ipcMain.handle('manual-connect', async (_event, ip) => {
  if (typeof ip !== 'string' || !ip.trim()) {
    return { ok: false, error: 'IP فاضي' }
  }
  const cleanIp = ip.trim()
  const ok = await probeHost(cleanIp, SERVER_PORT, 2000)
  if (ok) {
    saveLastServer(cleanIp)
    createMainWindow(cleanIp)
    return { ok: true, ip: cleanIp }
  }
  return { ok: false, error: 'مفيش رد من السيرفر على ' + cleanIp + ':' + SERVER_PORT }
})

ipcMain.handle('forget-saved-server', async () => {
  try {
    const f = getLastServerFilePath()
    if (fs.existsSync(f)) fs.unlinkSync(f)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('get-app-info', () => {
  return {
    name: 'Fitboost Assistant',
    version: app.getVersion(),
    lastIp: readLastServer(),
  }
})

ipcMain.handle('quit-app', () => app.quit())

// ─────────────────────────────────────────────────────────────────────────────
// Auto-start with Windows
// ─────────────────────────────────────────────────────────────────────────────
function setupAutoStart() {
  if (process.platform !== 'win32') return
  try {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: false,
      // electron-builder packages NSIS shortcut, so the path is the installer-resolved exe
      path: app.getPath('exe'),
      args: ['--auto-started'],
    })
  } catch (e) {
    console.error('Failed to set login item:', e.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// App lifecycle
// ─────────────────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  setupAutoStart()
  createSplashWindow()
  // Kick off discovery automatically a short moment after the splash shows
  setTimeout(() => startDiscovery(), 400)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createSplashWindow()
})

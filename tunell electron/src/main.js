const {
  app,
  BrowserWindow,
  ipcMain,
  powerSaveBlocker,
  Tray,
  Menu,
  nativeImage,
  shell,
  screen,
} = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { TunnelManager } = require('./tunnel');
const { makeIconPng } = require('./icon');

let win = null;
let tray = null;
let manager = null;
let config = null;
let powerBlockerId = null;
let healthTimer = null;
let isQuiting = false;

const state = {
  status: 'idle', // idle | starting | connecting | connected | error | stopped
  connections: 0,
  serverUp: false,
  publicUrl: '',
  message: '',
  restarts: 0,
  keepAwake: false,
  autoLaunch: false,
};

// ---------------------------------------------------------------- paths
function externalDir() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) return process.env.PORTABLE_EXECUTABLE_DIR;
  if (app.isPackaged) return path.dirname(process.execPath);
  return app.getAppPath();
}
function cloudflaredPath() {
  const bin = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
  if (app.isPackaged) return path.join(process.resourcesPath, bin);
  return path.join(app.getAppPath(), 'resources', bin);
}
function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

// ---------------------------------------------------------------- config
function loadConfig() {
  const defaults = {
    token: '',
    tunnelId: '',
    credentialsFile: '',
    localPort: 4001,
    hostname: '',
    keepAwake: true,
  };
  let cfg = { ...defaults };
  const merge = (p) => {
    try {
      cfg = { ...cfg, ...JSON.parse(fs.readFileSync(p, 'utf8')) };
    } catch (e) {
      /* ignore missing/invalid */
    }
  };
  merge(path.join(app.getAppPath(), 'config.json')); // shipped defaults
  merge(path.join(externalDir(), 'config.json')); // user-editable, next to the exe
  merge(settingsPath()); // UI toggles
  if (process.env.TUNNEL_TOKEN) cfg.token = process.env.TUNNEL_TOKEN;
  if (process.env.TUNNEL_PORT) cfg.localPort = Number(process.env.TUNNEL_PORT);
  if (process.env.TUNNEL_HOSTNAME) cfg.hostname = process.env.TUNNEL_HOSTNAME;
  return cfg;
}
function saveSettings(patch) {
  let s = {};
  try {
    s = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
  } catch (e) {
    /* ignore */
  }
  try {
    fs.writeFileSync(settingsPath(), JSON.stringify({ ...s, ...patch }, null, 2));
  } catch (e) {
    /* ignore */
  }
}
function ensureExternalConfig() {
  try {
    const ext = path.join(externalDir(), 'config.json');
    if (fs.existsSync(ext)) return;
    let content =
      '{\n  "tunnelId": "",\n  "credentialsFile": "",\n  "hostname": "",\n  "localPort": 4001,\n  "keepAwake": true\n}\n';
    try {
      content = fs.readFileSync(path.join(app.getAppPath(), 'config.json'), 'utf8');
    } catch (e) {
      /* use inline default */
    }
    fs.writeFileSync(ext, content);
  } catch (e) {
    /* directory may be read-only; harmless */
  }
}

// ---------------------------------------------------------------- mode / config.yml
// Resolve a credentials-file path: absolute as-is, otherwise relative to the exe folder.
function resolveCredsPath(p) {
  if (!p) return '';
  return path.isAbsolute(p) ? p : path.join(externalDir(), p);
}
// Which run mode do the current config values select?
function resolveMode() {
  if (config.token) return 'token';
  if (config.tunnelId && config.credentialsFile) return 'local';
  if (process.env.TUNNEL_DEMO === '1' || config.demo === true) return 'demo';
  return 'none';
}
// Write a config.yml from local-mode values; returns its path (or throws with a friendly reason).
function writeLocalConfigYml() {
  const creds = resolveCredsPath(config.credentialsFile);
  if (!fs.existsSync(creds)) {
    throw new Error('ملف الـ credentials مش موجود: ' + creds);
  }
  const port = config.localPort || 4001;
  const yml =
    [
      'tunnel: ' + JSON.stringify(config.tunnelId),
      'credentials-file: ' + JSON.stringify(creds),
      'ingress:',
      '  - hostname: ' + JSON.stringify(config.hostname),
      '    service: ' + JSON.stringify('http://localhost:' + port),
      '    originRequest:',
      '      noTLSVerify: true',
      '      connectTimeout: 30s',
      '  - service: http_status:404',
      '',
    ].join('\n');
  const out = path.join(app.getPath('userData'), 'generated-config.yml');
  fs.writeFileSync(out, yml);
  return out;
}

// ---------------------------------------------------------------- state push
function publicState() {
  return {
    ...state,
    hostname: config ? config.hostname : '',
    localPort: config ? config.localPort : 0,
    mode: config ? resolveMode() : 'none',
    configured: config ? resolveMode() !== 'none' : false,
  };
}
function pushStatus() {
  if (win && !win.isDestroyed()) win.webContents.send('tunnel:status', publicState());
  updateTray();
}
function pushLog(line) {
  if (win && !win.isDestroyed()) win.webContents.send('tunnel:log', line);
}
function setState(patch) {
  Object.assign(state, patch);
  pushStatus();
}

// ---------------------------------------------------------------- tray
function statusColor() {
  switch (state.status) {
    case 'connected':
      return [46, 204, 113];
    case 'connecting':
    case 'starting':
      return [241, 196, 15];
    case 'error':
      return [231, 76, 60];
    default:
      return [149, 165, 166];
  }
}
function updateTray() {
  if (!tray) return;
  try {
    tray.setImage(nativeImage.createFromBuffer(makeIconPng(statusColor(), 32)));
    tray.setToolTip(
      'Fit Boost Server Management — ' + state.status + (state.publicUrl ? ' — ' + state.publicUrl : '')
    );
    const running = ['starting', 'connecting', 'connected'].includes(state.status);
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: config && config.hostname ? config.hostname : 'No hostname set', enabled: false },
        { label: 'Status: ' + state.status + ' (' + state.connections + '/4)', enabled: false },
        { type: 'separator' },
        { label: 'Show window', click: () => showWindow() },
        {
          label: running ? 'Stop tunnel' : 'Start tunnel',
          click: () => (running ? stopTunnel() : startTunnel()),
        },
        { label: 'Restart tunnel', click: () => restartTunnel() },
        { type: 'separator' },
        { label: 'Quit', click: () => { isQuiting = true; app.quit(); } },
      ])
    );
  } catch (e) {
    /* ignore tray errors */
  }
}

// ---------------------------------------------------------------- window
function createWindow(startHidden) {
  // never open taller than the screen — otherwise the footer falls off the bottom
  const work = screen.getPrimaryDisplay().workAreaSize;
  const height = Math.max(460, Math.min(730, work.height - 48));
  win = new BrowserWindow({
    width: 470,
    height: height,
    minWidth: 430,
    minHeight: Math.min(460, height),
    show: !startHidden,
    title: 'Fit Boost Server Management',
    backgroundColor: '#0b1220',
    icon: nativeImage.createFromBuffer(makeIconPng([46, 204, 113], 32)),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('close', (e) => {
    if (!isQuiting) {
      e.preventDefault();
      win.hide(); // keep the tunnel alive in the tray
    }
  });
  win.webContents.on('did-finish-load', () => pushStatus());
}
function showWindow() {
  if (!win || win.isDestroyed()) createWindow(false);
  else {
    win.show();
    win.focus();
  }
}

// ---------------------------------------------------------------- tunnel control
function startTunnel() {
  const mode = resolveMode();
  if (mode === 'none') {
    setState({
      status: 'error',
      message: 'الإعدادات ناقصة — افتح config.json وحط tunnelId + credentialsFile + hostname (أو token).',
    });
    return;
  }
  if (manager && manager.isRunning()) return;

  // local mode needs a generated config.yml built from config.json values
  let configPath = '';
  if (mode === 'local') {
    try {
      configPath = writeLocalConfigYml();
    } catch (e) {
      setState({ status: 'error', message: e.message });
      return;
    }
  }

  const startMsg =
    mode === 'demo'
      ? 'وضع تجربة (quick tunnel) — بدون token…'
      : mode === 'local'
      ? 'جاري تشغيل cloudflared (config محلي)…'
      : 'جاري تشغيل cloudflared (token)…';
  setState({ status: 'starting', connections: 0, message: startMsg });

  manager = new TunnelManager({
    binPath: cloudflaredPath(),
    mode,
    token: config.token,
    configPath,
    localPort: config.localPort,
    onLog: (line) => pushLog(line),
    onUrl: (url) => setState({ publicUrl: url }),
    onConnecting: () => {
      if (state.status === 'starting') setState({ status: 'connecting' });
    },
    onConnection: (n) =>
      setState({
        status: n > 0 ? 'connected' : 'connecting',
        connections: n,
        message: n >= 4 ? 'كل الاتصالات شغّالة ✓' : 'اتصال ' + n + '/4',
        publicUrl: config.hostname ? 'https://' + config.hostname : state.publicUrl,
      }),
    onError: (msg) => setState({ status: 'error', message: msg }),
    onExit: (code, willRestart) => {
      if (willRestart) {
        setState({
          status: 'connecting',
          connections: 0,
          message: 'cloudflared قفل (code ' + code + ') — جاري إعادة التشغيل…',
          restarts: state.restarts + 1,
        });
      } else {
        setState({ status: 'stopped', connections: 0, publicUrl: '', message: 'الـ tunnel متوقف.' });
      }
    },
  });
  manager.start();
}
function stopTunnel() {
  if (manager) manager.stop();
  setState({ status: 'stopped', connections: 0, publicUrl: '', message: 'الـ tunnel متوقف.' });
}
function restartTunnel() {
  if (manager) manager.stop();
  setTimeout(startTunnel, 800);
}

// ---------------------------------------------------------------- local server health
function checkServer() {
  if (!config || !config.localPort) return;
  const done = (up) => {
    if (up !== state.serverUp) setState({ serverUp: up });
  };
  const req = http.get(
    { host: '127.0.0.1', port: config.localPort, path: '/', timeout: 2500 },
    (res) => {
      res.resume();
      done(true);
    }
  );
  req.on('error', () => done(false));
  req.on('timeout', () => {
    req.destroy();
    done(false);
  });
}

// ---------------------------------------------------------------- keep awake / autostart
function setKeepAwake(on) {
  state.keepAwake = on;
  if (on) {
    if (powerBlockerId == null || !powerSaveBlocker.isStarted(powerBlockerId)) {
      powerBlockerId = powerSaveBlocker.start('prevent-app-suspension');
    }
  } else if (powerBlockerId != null && powerSaveBlocker.isStarted(powerBlockerId)) {
    powerSaveBlocker.stop(powerBlockerId);
    powerBlockerId = null;
  }
  saveSettings({ keepAwake: on });
  pushStatus();
}
function setAutoLaunch(on) {
  state.autoLaunch = on;
  try {
    app.setLoginItemSettings({ openAtLogin: on, path: process.execPath, args: ['--startup'] });
  } catch (e) {
    /* ignore */
  }
  saveSettings({ autoLaunch: on });
  pushStatus();
}

// ---------------------------------------------------------------- in-app tunnel setup
function cfHome() {
  return path.join(os.homedir(), '.cloudflared');
}
function certPath() {
  return path.join(cfHome(), 'cert.pem');
}
function isLoggedIn() {
  return fs.existsSync(certPath());
}
function pushSetup(line) {
  if (win && !win.isDestroyed()) win.webContents.send('setup:progress', line);
}
function firstErr(out) {
  const lines = out.split(/\r?\n/).filter((l) => l.trim());
  const err = lines.find((l) => /error|failed|cannot|denied|invalid/i.test(l));
  return err || lines[lines.length - 1] || '';
}
// Run cloudflared once, stream lines, resolve with {code, out}.
function runCloudflared(args, onLine) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cloudflaredPath(), args, { windowsHide: true });
    } catch (e) {
      return resolve({ code: -1, out: 'spawn error: ' + e.message });
    }
    let out = '';
    const handle = (buf) => {
      const t = buf.toString();
      out += t;
      t.split(/\r?\n/).forEach((l) => {
        if (l.trim() && onLine) onLine(l);
      });
    };
    if (child.stdout) child.stdout.on('data', handle);
    if (child.stderr) child.stderr.on('data', handle);
    child.on('error', (e) => resolve({ code: -1, out: out + '\n' + e.message }));
    child.on('exit', (code) => resolve({ code, out }));
  });
}

ipcMain.handle('setup:status', () => ({ loggedIn: isLoggedIn() }));

let loginRunning = false;
ipcMain.handle('setup:login', async () => {
  if (isLoggedIn()) return { ok: true, already: true };
  if (loginRunning) return { ok: false, error: 'اللوجن شغّال بالفعل.' };
  loginRunning = true;
  pushSetup('بيفتح المتصفح… سجّل دخول واختار الدومين، وبعدين ارجع هنا.');
  const res = await runCloudflared(['tunnel', 'login'], (l) => {
    pushSetup(l);
    const u = l.match(/https:\/\/\S*argotunnel\S*/i);
    if (u) shell.openExternal(u[0]); // fallback if it didn't auto-open
  });
  loginRunning = false;
  const ok = isLoggedIn();
  return { ok, out: res.out, error: ok ? undefined : 'اللوجن اتلغى أو فشل. ' + firstErr(res.out) };
});

let createRunning = false;
ipcMain.handle('setup:create', async (_e, data) => {
  const subdomain = (data && data.subdomain ? String(data.subdomain) : '').trim();
  const domain = (data && data.domain ? String(data.domain) : '').trim();
  const localPort = Number(data && data.port) || 4001;
  if (!domain) return { ok: false, error: 'اكتب الدومين.' };
  if (!isLoggedIn()) return { ok: false, error: 'لازم تسجّل دخول Cloudflare الأول.' };
  if (createRunning) return { ok: false, error: 'الإنشاء شغّال بالفعل.' };
  createRunning = true;
  try {
    const hostname = (subdomain ? subdomain + '.' : '') + domain;
    const name = 'tk-' + (subdomain || 'tunnel') + '-' + crypto.randomBytes(3).toString('hex');

    pushSetup('بيعمل التونل: ' + name);
    const created = await runCloudflared(['tunnel', 'create', name], (l) => pushSetup(l));
    const m = created.out.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (!m) return { ok: false, error: 'فشل إنشاء التونل. ' + firstErr(created.out) };
    const tunnelId = m[0];

    // copy the credentials JSON next to the exe so everything stays self-contained.
    // Prefer the exact path cloudflared printed; fall back to <UUID>.json in ~/.cloudflared.
    const credMatch = created.out.match(/credentials written to\s+(.+?\.json)/i);
    const credSrc = credMatch ? credMatch[1].trim() : path.join(cfHome(), tunnelId + '.json');
    let credFile = tunnelId + '.json';
    try {
      fs.copyFileSync(credSrc, path.join(externalDir(), credFile));
    } catch (e) {
      credFile = credSrc; // fall back to the absolute source path
    }

    pushSetup('بيربط الـ DNS: ' + hostname);
    const routed = await runCloudflared(
      ['tunnel', 'route', 'dns', '--overwrite-dns', name, hostname],
      (l) => pushSetup(l)
    );
    if (routed.code !== 0 && !/already|updated|added|created/i.test(routed.out)) {
      return { ok: false, error: 'فشل ربط الـ DNS. ' + firstErr(routed.out) };
    }

    // persist config.json next to the exe, then reload + connect
    const newCfg = {
      tunnelId,
      credentialsFile: credFile,
      hostname,
      localPort,
      keepAwake: config.keepAwake !== false,
    };
    try {
      fs.writeFileSync(path.join(externalDir(), 'config.json'), JSON.stringify(newCfg, null, 2) + '\n');
    } catch (e) {
      /* ignore */
    }
    config = loadConfig();

    pushSetup('تم ✓ جاري التشغيل…');
    if (manager) manager.stop();
    setTimeout(startTunnel, 600);
    return { ok: true, tunnelId, hostname };
  } finally {
    createRunning = false;
  }
});

// ---------------------------------------------------------------- IPC
ipcMain.handle('app:getState', () => publicState());
ipcMain.on('tunnel:start', () => startTunnel());
ipcMain.on('tunnel:stop', () => stopTunnel());
ipcMain.on('tunnel:restart', () => restartTunnel());
ipcMain.on('app:minimize', () => win && win.minimize());
ipcMain.on('app:hide', () => win && win.hide());
ipcMain.on('app:quit', () => {
  isQuiting = true;
  app.quit();
});
ipcMain.on('app:openUrl', (_e, url) => url && shell.openExternal(url));
ipcMain.on('app:openConfig', () => {
  const p = path.join(externalDir(), 'config.json');
  ensureExternalConfig();
  shell.openPath(p);
});
ipcMain.on('app:reloadConfig', () => {
  config = loadConfig();
  setState({ message: 'تم إعادة تحميل config.json' });
});
ipcMain.on('settings:keepAwake', (_e, on) => setKeepAwake(!!on));
ipcMain.on('settings:autoLaunch', (_e, on) => setAutoLaunch(!!on));

// ---------------------------------------------------------------- lifecycle
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());

  app.whenReady().then(() => {
    config = loadConfig();
    ensureExternalConfig();
    state.autoLaunch = !!app.getLoginItemSettings().openAtLogin;

    const startHidden = process.argv.includes('--startup');

    try {
      tray = new Tray(nativeImage.createFromBuffer(makeIconPng(statusColor(), 32)));
      tray.on('click', () => showWindow());
    } catch (e) {
      /* tray unavailable */
    }

    createWindow(startHidden);
    updateTray();

    if (config.keepAwake) setKeepAwake(true);

    healthTimer = setInterval(checkServer, 3000);
    checkServer();

    if (resolveMode() !== 'none') startTunnel();
    else
      setState({
        status: 'error',
        message: 'الإعدادات ناقصة — افتح config.json وحط tunnelId + credentialsFile + hostname (أو token).',
      });
  });
}

app.on('window-all-closed', () => {
  // keep running in the tray; do not quit
});
app.on('before-quit', () => {
  isQuiting = true;
  if (healthTimer) clearInterval(healthTimer);
  if (manager) manager.stop();
  if (powerBlockerId != null && powerSaveBlocker.isStarted(powerBlockerId)) {
    powerSaveBlocker.stop(powerBlockerId);
  }
});

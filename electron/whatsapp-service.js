/**
 * WhatsApp Sidecar Service
 *
 * Runs as an HTTP server INSIDE the Electron main process on localhost:4002.
 * All WhatsApp logic lives here – no IPC, no Next.js module conflicts.
 *
 * The Next.js server (port 4001) proxies all /api/whatsapp/* requests here.
 * Works for both the Electron webview and any network browser.
 *
 * Endpoints:
 *   GET  /status        → { isReady, qrCode, hasClient }
 *   POST /init          → initialize WhatsApp
 *   POST /reconnect     → clear session + reconnect (new QR)
 *   POST /reset         → delete all auth + reconnect (new QR)
 *   POST /send          → { phone, message }
 *   POST /send-image    → { phone, imageBase64, caption }
 *   GET  /events        → SSE stream (qr, ready, connecting, disconnected, heartbeat)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 4002;
const AUTH_PATH = path.join(os.homedir(), '.fitboost-whatsapp', '.baileys_auth');

// Fallback version used only if fetchLatestBaileysVersion() fails
const BAILEYS_VERSION_FALLBACK = [2, 3000, 1023123128];

// ── State ──────────────────────────────────────────────────────────────────
let sock = null;
let isReady = false;
let qrCode = null;
let isInitializing = false;
let generation = 0;
let reconnectCount = 0;
const MAX_RECONNECTS = 5;
const sseClients = new Set();
let httpServer = null;

// ── Lazy-load Baileys (only when first needed) ─────────────────────────────
let baileys = null;
let pino = null;

function loadDeps() {
  if (!baileys) {
    baileys = require('@whiskeysockets/baileys');
    pino = require('pino');
  }
  return baileys;
}

// ── SSE helpers ────────────────────────────────────────────────────────────
function broadcast(type, data) {
  const payload = `data: ${JSON.stringify({ type, data })}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch {
      sseClients.delete(res);
    }
  }
}

// ── WhatsApp core ──────────────────────────────────────────────────────────
function ensureAuthDir() {
  try { fs.mkdirSync(AUTH_PATH, { recursive: true }); } catch {}
}

async function initialize() {
  if (isInitializing) {
    return { success: false, error: 'Already initializing' };
  }
  if (sock) {
    return { success: false, error: 'Already connected' };
  }

  isInitializing = true;
  generation++;
  const gen = generation;

  console.log(`[WhatsApp] initialize() gen=${gen}`);

  try {
    ensureAuthDir();

    const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } = loadDeps();
    const logger = pino({ level: 'silent' });

    // Fetch latest WhatsApp Web version dynamically (avoids 515 "restart required")
    let version = BAILEYS_VERSION_FALLBACK;
    try {
      const result = await fetchLatestBaileysVersion();
      version = result.version;
      console.log('[WhatsApp] Version fetched:', version);
    } catch (e) {
      console.warn('[WhatsApp] fetchLatestBaileysVersion failed, using fallback:', e.message);
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_PATH);

    sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      printQRInTerminal: false,
      logger,
      browser: ['FitBoost Gym', 'Chrome', '120'],
      markOnlineOnConnect: true,
      syncFullHistory: false,
      defaultQueryTimeoutMs: 60000
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      // Ignore events from a replaced socket
      if (generation !== gen) {
        console.log(`[WhatsApp] Stale event from gen ${gen}, current ${generation} – ignored`);
        return;
      }

      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('[WhatsApp] QR code ready');
        qrCode = qr;
        isReady = false;
        broadcast('qr', { qrCode: qr });
      }

      if (connection === 'connecting') {
        broadcast('connecting', { percent: 30, message: 'Connecting...' });
      }

      if (connection === 'open') {
        console.log('[WhatsApp] Connected!');
        if (!isReady) broadcast('ready', { isReady: true });
        isReady = true;
        qrCode = null;
        reconnectCount = 0;
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.message || 'unknown';
        console.log(`[WhatsApp] Connection closed – code: ${code}, reason: ${reason}`);
        isReady = false;
        qrCode = null;

        // Bump generation immediately to block any future events from this socket
        generation++;
        const old = sock;
        sock = null;
        try { old?.ws?.close(); } catch {}

        const { DisconnectReason: DR } = loadDeps();

        if (code === DR.loggedOut) {
          console.log('[WhatsApp] Logged out – clearing session');
          _deleteCreds();
          reconnectCount = 0;
          broadcast('disconnected', { reason: 'Logged out' });
        } else if (code === DR.restartRequired || code === 515) {
          // WhatsApp requested restart (e.g. version update) – reconnect immediately
          console.log('[WhatsApp] Restart required – reconnecting immediately');
          setTimeout(initialize, 1000);
        } else if (reconnectCount < MAX_RECONNECTS) {
          reconnectCount++;
          const delay = Math.min(2000 * Math.pow(2, reconnectCount - 1), 30000);
          console.log(`[WhatsApp] Reconnect ${reconnectCount}/${MAX_RECONNECTS} in ${delay}ms`);
          setTimeout(initialize, delay);
        } else {
          console.log('[WhatsApp] Max reconnects reached');
          reconnectCount = 0;
          broadcast('disconnected', { reason: 'Max reconnects reached' });
        }
      }
    });

    console.log(`[WhatsApp] Socket created (gen=${gen}) – waiting for QR or connection`);
    return { success: true };

  } catch (err) {
    console.error('[WhatsApp] initialize() failed:', err.message);
    sock = null;
    isReady = false;
    return { success: false, error: err.message };
  } finally {
    isInitializing = false;
  }
}

function _closeSocket() {
  generation++;
  const old = sock;
  sock = null;
  isReady = false;
  qrCode = null;
  try { old?.ws?.close(); } catch {}
}

function _deleteCreds() {
  try {
    const f = path.join(AUTH_PATH, 'creds.json');
    if (fs.existsSync(f)) fs.unlinkSync(f);
  } catch {}
}

async function reconnect() {
  console.log('[WhatsApp] reconnect()');
  _closeSocket();
  _deleteCreds();
  reconnectCount = 0;
  return initialize();
}

async function resetSession() {
  console.log('[WhatsApp] resetSession()');
  _closeSocket();
  try {
    if (fs.existsSync(AUTH_PATH)) {
      fs.rmSync(AUTH_PATH, { recursive: true, force: true });
      fs.mkdirSync(AUTH_PATH, { recursive: true });
    }
  } catch {}
  reconnectCount = 0;
  return initialize();
}

function _formatPhone(phone) {
  let p = (phone || '').replace(/\D/g, '');
  if (p.startsWith('0')) p = '20' + p.slice(1);
  else if (!p.startsWith('20')) p = '20' + p;
  return p;
}

async function sendMessage(phone, message) {
  if (!isReady || !sock) return { success: false, error: 'WhatsApp not connected' };
  try {
    await sock.sendMessage(_formatPhone(phone) + '@s.whatsapp.net', { text: message });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function sendImage(phone, imageBase64, caption = '') {
  if (!isReady || !sock) return { success: false, error: 'WhatsApp not connected' };
  try {
    const b64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    await sock.sendMessage(_formatPhone(phone) + '@s.whatsapp.net', {
      image: Buffer.from(b64, 'base64'),
      caption
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── HTTP Server ─────────────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

async function handleRequest(req, res) {
  // Only allow connections from localhost
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = (req.url || '/').split('?')[0];

  try {
    // GET /status
    if (req.method === 'GET' && url === '/status') {
      return sendJSON(res, 200, { isReady, qrCode, hasClient: sock !== null });
    }

    // POST /init
    if (req.method === 'POST' && url === '/init') {
      const result = await initialize();
      return sendJSON(res, result.success ? 200 : 400, result);
    }

    // POST /reconnect
    if (req.method === 'POST' && url === '/reconnect') {
      const result = await reconnect();
      return sendJSON(res, result.success ? 200 : 400, result);
    }

    // POST /reset
    if (req.method === 'POST' && url === '/reset') {
      const result = await resetSession();
      return sendJSON(res, result.success ? 200 : 400, result);
    }

    // POST /send
    if (req.method === 'POST' && url === '/send') {
      const { phone, message } = await readBody(req);
      const result = await sendMessage(phone, message);
      return sendJSON(res, result.success ? 200 : 400, result);
    }

    // POST /send-image
    if (req.method === 'POST' && url === '/send-image') {
      const { phone, imageBase64, caption } = await readBody(req);
      const result = await sendImage(phone, imageBase64, caption);
      return sendJSON(res, result.success ? 200 : 400, result);
    }

    // GET /events  (SSE)
    if (req.method === 'GET' && url === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });

      // Send initial snapshot immediately
      res.write(`data: ${JSON.stringify({ type: 'status', data: { isReady, qrCode, hasClient: sock !== null } })}\n\n`);

      sseClients.add(res);

      // Heartbeat every 20s
      const hb = setInterval(() => {
        try {
          res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
        } catch {
          clearInterval(hb);
          sseClients.delete(res);
        }
      }, 20000);

      req.on('close', () => {
        clearInterval(hb);
        sseClients.delete(res);
      });

      return; // Keep connection open
    }

    // 404
    sendJSON(res, 404, { error: 'Not found' });

  } catch (err) {
    console.error('[WhatsApp Service] Request error:', err);
    try { sendJSON(res, 500, { error: err.message }); } catch {}
  }
}

// ── Public API ─────────────────────────────────────────────────────────────
function startWhatsAppService() {
  return new Promise((resolve, reject) => {
    httpServer = http.createServer(handleRequest);

    httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[WhatsApp Service] Port ${PORT} in use – retrying on ${PORT + 1}`);
        httpServer.listen(PORT + 1, '127.0.0.1');
      } else {
        reject(err);
      }
    });

    httpServer.listen(PORT, '127.0.0.1', () => {
      const actualPort = httpServer.address().port;
      console.log(`[WhatsApp Service] HTTP server running on http://127.0.0.1:${actualPort}`);

      // Auto-connect if saved session exists
      const credsFile = path.join(AUTH_PATH, 'creds.json');
      if (fs.existsSync(credsFile)) {
        console.log('[WhatsApp Service] Saved session found – auto-connecting in 3s');
        setTimeout(initialize, 3000);
      } else {
        console.log('[WhatsApp Service] No saved session – waiting for manual init');
      }

      resolve(actualPort);
    });
  });
}

function stopWhatsAppService() {
  return new Promise((resolve) => {
    // Close WhatsApp socket
    _closeSocket();

    // Close all SSE connections
    for (const res of sseClients) {
      try { res.end(); } catch {}
    }
    sseClients.clear();

    // Close HTTP server
    if (httpServer) {
      httpServer.close(() => {
        httpServer = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = { startWhatsAppService, stopWhatsAppService };

// ── Standalone mode (node electron/whatsapp-service.js) ─────────────────────
if (require.main === module) {
  startWhatsAppService().then(port => {
    console.log(`[WhatsApp Service] Standalone mode – port ${port}`);
  });
}

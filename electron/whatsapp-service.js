/**
 * WhatsApp Sidecar Service – Multi-Number Edition
 *
 * Runs as an HTTP server INSIDE the Electron main process on localhost:4002.
 * Supports up to 4 independent WhatsApp sessions (Baileys instances).
 *
 * Backward compatible: existing /status, /init, /send, /events endpoints
 * still work against session 0 (the primary number).
 *
 * New multi-session endpoints use /status/all, /init/:idx, /send-multi, etc.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WhatsAppSession = require('./whatsapp-session');

const PORT = 4002;
const MAX_SESSIONS = 4;
const AUTH_BASE = path.join(os.homedir(), '.fitboost-whatsapp');

// ── State ──────────────────────────────────────────────────────────────────
const sessions = new Map(); // sessionIndex -> WhatsAppSession
const sseClients = new Set();
let httpServer = null;

const API_BASE = 'http://127.0.0.1:4001';

// ── Lazy-load Baileys ──────────────────────────────────────────────────────
let baileys = null;

function loadDeps() {
  if (!baileys) {
    baileys = require('@whiskeysockets/baileys');
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

// ── Session migration (old single-session → session_0) ─────────────────────
function migrateOldSession() {
  const oldPath = path.join(AUTH_BASE, '.baileys_auth');
  const newPath = path.join(AUTH_BASE, 'session_0');
  try {
    if (fs.existsSync(path.join(oldPath, 'creds.json')) && !fs.existsSync(path.join(newPath, 'creds.json'))) {
      fs.mkdirSync(newPath, { recursive: true });
      const files = fs.readdirSync(oldPath);
      for (const file of files) {
        fs.copyFileSync(path.join(oldPath, file), path.join(newPath, file));
      }
    }
  } catch (err) {
  }
}

// ── Session factory ────────────────────────────────────────────────────────
function createSessions() {
  for (let i = 0; i < MAX_SESSIONS; i++) {
    const session = new WhatsAppSession(i, AUTH_BASE, { broadcast, loadDeps });
    sessions.set(i, session);
  }
}

function getSession(idx) {
  const index = parseInt(idx);
  if (isNaN(index) || index < 0 || index >= MAX_SESSIONS) return null;
  return sessions.get(index);
}

// ── HTTP helpers ───────────────────────────────────────────────────────────
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

// ── Route matching helper ──────────────────────────────────────────────────
function matchRoute(method, url, expectedMethod, pattern) {
  if (method !== expectedMethod) return null;
  const regex = new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$');
  const match = url.match(regex);
  return match ? (match.groups || {}) : null;
}

// ── HTTP Request Handler ───────────────────────────────────────────────────
async function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4001');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = (req.url || '/').split('?')[0];
  const method = req.method;
  let params;

  try {
    // ════════════════════════════════════════════════════════════════════
    // BACKWARD COMPATIBLE ENDPOINTS (session 0)
    // ════════════════════════════════════════════════════════════════════

    // GET /status → session 0 status (backward compat)
    if (method === 'GET' && url === '/status') {
      const s = sessions.get(0);
      return sendJSON(res, 200, s ? s.getStatus() : { isReady: false, qrCode: null, hasClient: false });
    }

    // POST /init → init session 0
    if (method === 'POST' && url === '/init') {
      const s = sessions.get(0);
      const result = await s.initialize();
      return sendJSON(res, result.success ? 200 : 400, result);
    }

    // POST /reconnect → reconnect session 0
    if (method === 'POST' && url === '/reconnect') {
      const s = sessions.get(0);
      const result = await s.reconnect();
      return sendJSON(res, result.success ? 200 : 400, result);
    }

    // POST /reset → reset session 0
    if (method === 'POST' && url === '/reset') {
      const s = sessions.get(0);
      const result = await s.resetSession();
      return sendJSON(res, result.success ? 200 : 400, result);
    }

    // POST /send → send via session 0 (for receipts, barcodes, etc.)
    if (method === 'POST' && url === '/send') {
      const { phone, message } = await readBody(req);
      const s = sessions.get(0);
      const result = await s.sendMessage(phone, message);
      return sendJSON(res, result.success ? 200 : 400, result);
    }

    // POST /send-image → send image via session 0
    if (method === 'POST' && url === '/send-image') {
      const { phone, imageBase64, caption } = await readBody(req);
      const s = sessions.get(0);
      const result = await s.sendImage(phone, imageBase64, caption);
      return sendJSON(res, result.success ? 200 : 400, result);
    }

    // GET /events → SSE for session 0 (backward compat)
    if (method === 'GET' && url === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });
      const s = sessions.get(0);
      const status = s ? s.getStatus() : { isReady: false, qrCode: null, hasClient: false };
      res.write(`data: ${JSON.stringify({ type: 'status', data: status })}\n\n`);
      sseClients.add(res);
      const hb = setInterval(() => {
        try { res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`); }
        catch { clearInterval(hb); sseClients.delete(res); }
      }, 20000);
      req.on('close', () => { clearInterval(hb); sseClients.delete(res); });
      return;
    }

    // ════════════════════════════════════════════════════════════════════
    // MULTI-SESSION ENDPOINTS
    // ════════════════════════════════════════════════════════════════════

    // GET /status/all → all sessions status
    if (method === 'GET' && url === '/status/all') {
      const all = [];
      for (let i = 0; i < MAX_SESSIONS; i++) {
        const s = sessions.get(i);
        all.push(s ? s.getStatus() : { sessionIndex: i, isReady: false, qrCode: null, hasClient: false });
      }
      return sendJSON(res, 200, all);
    }

    // GET /status/:idx → specific session status
    if ((params = matchRoute(method, url, 'GET', '/status/:idx'))) {
      const s = getSession(params.idx);
      if (!s) return sendJSON(res, 400, { error: 'Invalid session index' });
      return sendJSON(res, 200, s.getStatus());
    }

    // POST /init/:idx → init specific session
    if ((params = matchRoute(method, url, 'POST', '/init/:idx'))) {
      const s = getSession(params.idx);
      if (!s) return sendJSON(res, 400, { error: 'Invalid session index' });
      const result = await s.initialize();
      return sendJSON(res, result.success ? 200 : 400, result);
    }

    // POST /reconnect/:idx → reconnect specific session
    if ((params = matchRoute(method, url, 'POST', '/reconnect/:idx'))) {
      const s = getSession(params.idx);
      if (!s) return sendJSON(res, 400, { error: 'Invalid session index' });
      const result = await s.reconnect();
      return sendJSON(res, result.success ? 200 : 400, result);
    }

    // POST /reset/:idx → reset specific session
    if ((params = matchRoute(method, url, 'POST', '/reset/:idx'))) {
      const s = getSession(params.idx);
      if (!s) return sendJSON(res, 400, { error: 'Invalid session index' });
      const result = await s.resetSession();
      return sendJSON(res, result.success ? 200 : 400, result);
    }

    // POST /send-multi → send via specific session
    if (method === 'POST' && url === '/send-multi') {
      const { sessionIndex, phone, message } = await readBody(req);
      const s = getSession(sessionIndex);
      if (!s) return sendJSON(res, 400, { error: 'Invalid session index' });
      const result = await s.sendMessage(phone, message);
      return sendJSON(res, result.success ? 200 : 400, result);
    }

    // POST /send-image-multi → send image via specific session
    if (method === 'POST' && url === '/send-image-multi') {
      const { sessionIndex, phone, imageBase64, caption } = await readBody(req);
      const s = getSession(sessionIndex);
      if (!s) return sendJSON(res, 400, { error: 'Invalid session index' });
      const result = await s.sendImage(phone, imageBase64, caption);
      return sendJSON(res, result.success ? 200 : 400, result);
    }

    // POST /send-audio-multi → send audio via specific session
    if (method === 'POST' && url === '/send-audio-multi') {
      const { sessionIndex, phone, audioBase64, ptt } = await readBody(req);
      const s = getSession(sessionIndex);
      if (!s) return sendJSON(res, 400, { error: 'Invalid session index' });
      const result = await s.sendAudio(phone, audioBase64, ptt !== false);
      return sendJSON(res, result.success ? 200 : 400, result);
    }

    // POST /check-number → check if phone exists on WhatsApp
    if (method === 'POST' && url === '/check-number') {
      const { phone, sessionIndex: si } = await readBody(req);
      // Use first connected session to check
      let checker = null;
      if (si !== undefined) {
        checker = getSession(si);
      }
      if (!checker || !checker.isReady) {
        for (const [, s] of sessions) {
          if (s.isReady) { checker = s; break; }
        }
      }
      if (!checker || !checker.isReady) {
        return sendJSON(res, 400, { exists: false, error: 'No connected session' });
      }
      const result = await checker.checkNumber(phone);
      return sendJSON(res, 200, result);
    }

    // POST /sync-history → request on-demand history sync for a session
    if (method === 'POST' && url === '/sync-history') {
      const { sessionIndex } = await readBody(req);
      const s = getSession(sessionIndex);
      if (!s) return sendJSON(res, 400, { error: 'Invalid session index' });
      if (!s.isReady) return sendJSON(res, 400, { error: 'Session not connected' });
      const result = await s.requestHistorySync();
      return sendJSON(res, result.success ? 200 : 400, result);
    }

    // PUT /session/:idx/label → update session label (via Next.js API)
    if ((params = matchRoute(method, url, 'PUT', '/session/:idx/label'))) {
      const { label } = await readBody(req);
      const idx = parseInt(params.idx);
      if (isNaN(idx) || idx < 0 || idx >= MAX_SESSIONS) return sendJSON(res, 400, { error: 'Invalid index' });
      try {
        await fetch(`${API_BASE}/api/whatsapp/internal/update-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionIndex: idx, label }),
        });
        return sendJSON(res, 200, { success: true });
      } catch (err) {
        return sendJSON(res, 500, { error: err.message });
      }
    }

    // GET /events/all → merged SSE stream for all sessions
    if (method === 'GET' && url === '/events/all') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });
      // Send initial snapshot of all sessions
      const allStatus = [];
      for (let i = 0; i < MAX_SESSIONS; i++) {
        const s = sessions.get(i);
        allStatus.push(s ? s.getStatus() : { sessionIndex: i, isReady: false, qrCode: null, hasClient: false });
      }
      res.write(`data: ${JSON.stringify({ type: 'status_all', data: allStatus })}\n\n`);
      sseClients.add(res);
      const hb = setInterval(() => {
        try { res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`); }
        catch { clearInterval(hb); sseClients.delete(res); }
      }, 20000);
      req.on('close', () => { clearInterval(hb); sseClients.delete(res); });
      return;
    }

    // ════════════════════════════════════════════════════════════════════
    // QUEUE ENDPOINTS (handled by whatsapp-queue.js)
    // ════════════════════════════════════════════════════════════════════

    // Queue endpoints – proxy to Next.js API
    if (method === 'POST' && url === '/queue/add') {
      const body = await readBody(req);
      try {
        const r = await fetch(`${API_BASE}/api/whatsapp/queue/add`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        return sendJSON(res, r.ok ? 200 : 400, await r.json());
      } catch (err) { return sendJSON(res, 500, { error: err.message }); }
    }

    if (method === 'GET' && url === '/queue/status') {
      try {
        const r = await fetch(`${API_BASE}/api/whatsapp/queue/status`);
        return sendJSON(res, 200, await r.json());
      } catch (err) { return sendJSON(res, 500, { error: err.message }); }
    }

    if (method === 'POST' && url === '/queue/cancel') {
      const body = await readBody(req);
      try {
        const r = await fetch(`${API_BASE}/api/whatsapp/queue/cancel`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        return sendJSON(res, 200, await r.json());
      } catch (err) { return sendJSON(res, 500, { error: err.message }); }
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
    // Migrate old single-session auth to session_0
    migrateOldSession();

    // Create all session instances
    createSessions();

    httpServer = http.createServer(handleRequest);

    httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        httpServer.listen(PORT + 1, '127.0.0.1');
      } else {
        reject(err);
      }
    });

    httpServer.listen(PORT, '127.0.0.1', () => {
      const actualPort = httpServer.address().port;

      // Auto-connect sessions that have saved credentials (3s delay)
      setTimeout(() => {
        for (const [idx, session] of sessions) {
          if (session.hasSavedSession()) {
            session.initialize().catch(err => {
              console.error(`[WhatsApp Service] Auto-connect session ${idx} failed:`, err.message);
            });
          }
        }
      }, 3000);

      // Start queue processor
      try {
        const WhatsAppQueue = require('./whatsapp-queue');
        const queue = new WhatsAppQueue(sessions);
        queue.startAll();
      } catch (err) {
      }

      resolve(actualPort);
    });
  });
}

function stopWhatsAppService() {
  return new Promise((resolve) => {
    // Stop all sessions
    for (const [, session] of sessions) {
      session.stop();
    }

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
  });
}

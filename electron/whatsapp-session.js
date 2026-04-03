/**
 * WhatsAppSession - encapsulates a single Baileys connection
 * One instance per phone number (up to 4).
 *
 * DB operations go through Next.js API (Prisma) via HTTP – no direct DB access.
 */
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://127.0.0.1:4001';

class WhatsAppSession {
  constructor(sessionIndex, authBasePath, { broadcast, loadDeps }) {
    this.sessionIndex = sessionIndex;
    this.authPath = path.join(authBasePath, `session_${sessionIndex}`);
    this.sock = null;
    this.isReady = false;
    this.qrCode = null;
    this.isInitializing = false;
    this.generation = 0;
    this.reconnectCount = 0;
    this.MAX_RECONNECTS = 5;
    this.phoneNumber = null;
    this.broadcast = broadcast;
    this.loadDeps = loadDeps;

    // Baileys version fallback
    this.BAILEYS_VERSION_FALLBACK = [2, 3000, 1023123128];
  }

  // ── HTTP helper to call Next.js internal API ────────────────────────────
  async _api(endpoint, data) {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/internal/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (err) {
      console.error(`[WhatsApp:${this.sessionIndex}] API call ${endpoint} failed:`, err.message);
      return { success: false, error: err.message };
    }
  }

  _ensureAuthDir() {
    try { fs.mkdirSync(this.authPath, { recursive: true }); } catch {}
  }

  getStatus() {
    return {
      sessionIndex: this.sessionIndex,
      isReady: this.isReady,
      qrCode: this.qrCode,
      hasClient: this.sock !== null,
      phoneNumber: this.phoneNumber,
    };
  }

  async initialize() {
    if (this.isInitializing) {
      return { success: false, error: 'Already initializing' };
    }
    if (this.sock) {
      return { success: false, error: 'Already connected' };
    }

    this.isInitializing = true;
    this.generation++;
    const gen = this.generation;
    const idx = this.sessionIndex;

    console.log(`[WhatsApp:${idx}] initialize() gen=${gen}`);

    try {
      this._ensureAuthDir();

      const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } = this.loadDeps();
      const pino = require('pino');
      const logger = pino({ level: 'silent' });

      let version = this.BAILEYS_VERSION_FALLBACK;
      try {
        const result = await fetchLatestBaileysVersion();
        version = result.version;
        console.log(`[WhatsApp:${idx}] Version fetched:`, version);
      } catch (e) {
        console.warn(`[WhatsApp:${idx}] fetchLatestBaileysVersion failed, using fallback:`, e.message);
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.authPath);

      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        printQRInTerminal: false,
        logger,
        browser: [`FitBoost-${idx}`, 'Chrome', '120'],
        markOnlineOnConnect: true,
        syncFullHistory: true,
        shouldSyncHistoryMessage: () => true,
        fireInitQueries: true,
        defaultQueryTimeoutMs: 60000,
        getMessage: async (key) => {
          // Fetch message from DB for retry/decrypt
          try {
            if (!key.id) return undefined;
            const res = await fetch(`${API_BASE}/api/whatsapp/internal/get-message`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ whatsappMsgId: key.id }),
            });
            const data = await res.json();
            if (data.content) {
              const { proto } = this.loadDeps();
              return proto?.Message?.fromObject?.({ conversation: data.content }) || { conversation: data.content };
            }
          } catch {}
          return undefined;
        },
      });

      this.sock.ev.on('creds.update', saveCreds);

      // Capture phone number from credentials
      if (state.creds?.me?.id) {
        this.phoneNumber = state.creds.me.id.split(':')[0] || state.creds.me.id.split('@')[0];
      }

      // Connection update handler
      this.sock.ev.on('connection.update', async (update) => {
        if (this.generation !== gen) return;

        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log(`[WhatsApp:${idx}] QR code ready`);
          this.qrCode = qr;
          this.isReady = false;
          this.broadcast('qr', { qrCode: qr, sessionIndex: idx });
        }

        if (connection === 'connecting') {
          this.broadcast('connecting', { percent: 30, message: 'Connecting...', sessionIndex: idx });
        }

        if (connection === 'open') {
          console.log(`[WhatsApp:${idx}] Connected!`);
          if (!this.isReady) this.broadcast('ready', { isReady: true, sessionIndex: idx });
          this.isReady = true;
          this.qrCode = null;
          this.reconnectCount = 0;

          // Extract phone number
          if (this.sock?.user?.id) {
            this.phoneNumber = this.sock.user.id.split(':')[0] || this.sock.user.id.split('@')[0];
          }

          // Update session in database via API
          this._api('update-session', { sessionIndex: idx, status: 'connected', phoneNumber: this.phoneNumber });

          // Start warmup tracking if not already done
          this._api('update-session', { sessionIndex: idx, startWarmup: true });
        }

        if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode;
          const reason = lastDisconnect?.error?.message || 'unknown';
          console.log(`[WhatsApp:${idx}] Connection closed – code: ${code}, reason: ${reason}`);
          this.isReady = false;
          this.qrCode = null;

          this.generation++;
          const old = this.sock;
          this.sock = null;
          try { old?.ws?.close(); } catch {}

          this._api('update-session', { sessionIndex: idx, status: 'disconnected' });

          const { DisconnectReason } = this.loadDeps();

          if (code === DisconnectReason.loggedOut) {
            console.log(`[WhatsApp:${idx}] Logged out – clearing session`);
            this._deleteCreds();
            this.reconnectCount = 0;
            this.broadcast('disconnected', { reason: 'Logged out', sessionIndex: idx });
          } else if (code === DisconnectReason.restartRequired || code === 515) {
            console.log(`[WhatsApp:${idx}] Restart required – reconnecting`);
            setTimeout(() => this.initialize(), 1000);
          } else if (this.reconnectCount < this.MAX_RECONNECTS) {
            this.reconnectCount++;
            const delay = Math.min(2000 * Math.pow(2, this.reconnectCount - 1), 30000);
            console.log(`[WhatsApp:${idx}] Reconnect ${this.reconnectCount}/${this.MAX_RECONNECTS} in ${delay}ms`);
            setTimeout(() => this.initialize(), delay);
          } else {
            console.log(`[WhatsApp:${idx}] Max reconnects reached`);
            this.reconnectCount = 0;
            this.broadcast('disconnected', { reason: 'Max reconnects reached', sessionIndex: idx });
          }
        }
      });

      // Message handler – process ALL messages (real-time + history sync)
      this.sock.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
        if (this.generation !== gen) return;
        console.log(`[WhatsApp:${idx}] messages.upsert: ${msgs?.length} messages, type=${type}`);
        for (const msg of msgs) {
          try {
            await this._handleIncomingMessage(msg, type);
          } catch (err) {
            console.error(`[WhatsApp:${idx}] Error handling message:`, err.message);
          }
        }
      });

      // Chat list – creates conversation entries when Baileys receives the chat list on connect
      const _upsertChats = (chats) => {
        const batch = [];
        for (const chat of chats) {
          if (!chat.id || chat.id.endsWith('@g.us') || chat.id.endsWith('@broadcast')) continue;
          const phone = chat.id.replace('@s.whatsapp.net', '');
          const ts = chat.conversationTimestamp
            ? new Date((typeof chat.conversationTimestamp === 'number' ? chat.conversationTimestamp : Number(chat.conversationTimestamp)) * 1000).toISOString()
            : null;
          batch.push({ phone, name: chat.name || null, timestamp: ts, unreadCount: chat.unreadCount || 0 });
        }
        if (batch.length > 0) {
          this._api('upsert-chats', { sessionIndex: idx, chats: batch }).then(r => {
            if (r.created > 0) console.log(`[WhatsApp:${idx}] Created ${r.created} conversations`);
          });
        }
      };

      this.sock.ev.on('chats.upsert', (chats) => {
        if (this.generation !== gen) return;
        console.log(`[WhatsApp:${idx}] chats.upsert: ${chats?.length} chats`);
        if (chats?.length) _upsertChats(chats);
      });

      this.sock.ev.on('chats.set', ({ chats: setCh }) => {
        if (this.generation !== gen) return;
        console.log(`[WhatsApp:${idx}] chats.set: ${setCh?.length} chats`);
        if (setCh?.length) _upsertChats(setCh);
      });

      this.sock.ev.on('messaging-history.set', ({ chats: histChats, messages: histMsgs, contacts: histContacts, isLatest }) => {
        if (this.generation !== gen) return;
        console.log(`[WhatsApp:${idx}] messaging-history.set: ${histChats?.length || 0} chats, ${histMsgs?.length || 0} messages, isLatest=${isLatest}`);
        if (histChats?.length) _upsertChats(histChats);

        // Save history messages in bulk batches
        if (histMsgs?.length) {
          const currentGen = this.generation;
          const sessionIndex = this.sessionIndex;
          (async () => {
            const BATCH_SIZE = 50;
            let totalSaved = 0, totalSkipped = 0;

            for (let i = 0; i < histMsgs.length; i += BATCH_SIZE) {
              if (this.generation !== currentGen) break;
              const batch = histMsgs.slice(i, i + BATCH_SIZE);
              const prepared = [];

              for (const msg of batch) {
                try {
                  const parsed = this._parseMessage(msg);
                  if (parsed) prepared.push(parsed);
                } catch {}
              }

              if (prepared.length > 0) {
                const result = await this._api('save-messages-bulk', { messages: prepared });
                totalSaved += result.saved || 0;
                totalSkipped += result.skipped || 0;
              }
            }
            console.log(`[WhatsApp:${idx}] History sync done: ${totalSaved} saved, ${totalSkipped} skipped out of ${histMsgs.length}`);
          })();
        }

        // Update contact names from history
        if (histContacts?.length) {
          const batch = [];
          for (const c of histContacts) {
            if (!c.id || c.id.endsWith('@g.us')) continue;
            const phone = c.id.replace('@s.whatsapp.net', '');
            const name = c.name || c.notify || null;
            if (name) batch.push({ phone, name });
          }
          if (batch.length > 0) {
            this._api('update-contact-names', { contacts: batch });
          }
        }
      });

      // Update contact names when they arrive
      this.sock.ev.on('contacts.upsert', (contacts) => {
        if (this.generation !== gen) return;
        const batch = [];
        for (const c of contacts) {
          if (!c.id || c.id.endsWith('@g.us')) continue;
          const phone = c.id.replace('@s.whatsapp.net', '');
          const name = c.name || c.notify || null;
          if (name) batch.push({ phone, name });
        }
        if (batch.length > 0) {
          this._api('update-contact-names', { contacts: batch });
        }
      });

      console.log(`[WhatsApp:${idx}] Socket created (gen=${gen})`);
      return { success: true };

    } catch (err) {
      console.error(`[WhatsApp:${idx}] initialize() failed:`, err.message);
      this.sock = null;
      this.isReady = false;
      return { success: false, error: err.message };
    } finally {
      this.isInitializing = false;
    }
  }

  _closeSocket() {
    this.generation++;
    const old = this.sock;
    this.sock = null;
    this.isReady = false;
    this.qrCode = null;
    try { old?.ws?.close(); } catch {}
  }

  _deleteCreds() {
    try {
      const f = path.join(this.authPath, 'creds.json');
      if (fs.existsSync(f)) fs.unlinkSync(f);
    } catch {}
  }

  async reconnect() {
    console.log(`[WhatsApp:${this.sessionIndex}] reconnect()`);
    this._closeSocket();
    this._deleteCreds();
    this.reconnectCount = 0;
    return this.initialize();
  }

  async resetSession() {
    console.log(`[WhatsApp:${this.sessionIndex}] resetSession()`);
    this._closeSocket();
    try {
      if (fs.existsSync(this.authPath)) {
        fs.rmSync(this.authPath, { recursive: true, force: true });
        fs.mkdirSync(this.authPath, { recursive: true });
      }
    } catch {}
    this.reconnectCount = 0;
    this.phoneNumber = null;
    this._api('update-session', {
      sessionIndex: this.sessionIndex,
      status: 'disconnected',
      phoneNumber: null,
      warmupComplete: false,
      warmupStartedAt: null
    });
    return this.initialize();
  }

  _formatPhone(phone) {
    let p = (phone || '').replace(/\D/g, '');
    if (p.startsWith('0')) p = '20' + p.slice(1);
    else if (!p.startsWith('20')) p = '20' + p;
    return p;
  }

  async sendMessage(phone, message) {
    if (!this.isReady || !this.sock) return { success: false, error: 'WhatsApp not connected' };
    try {
      const jid = this._formatPhone(phone) + '@s.whatsapp.net';
      const result = await this.sock.sendMessage(jid, { text: message });
      return { success: true, messageId: result?.key?.id };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async sendImage(phone, imageBase64, caption = '') {
    if (!this.isReady || !this.sock) return { success: false, error: 'WhatsApp not connected' };

    const b64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const jid = this._formatPhone(phone) + '@s.whatsapp.net';
    const imageBuffer = Buffer.from(b64, 'base64');

    const MAX_ATTEMPTS = 3;
    let lastError = '';

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await this.sock.sendMessage(jid, {
          image: imageBuffer,
          mimetype: 'image/png',
          caption
        });
        return { success: true, messageId: result?.key?.id };
      } catch (err) {
        lastError = err.message;
        console.warn(`[WhatsApp:${this.sessionIndex}] sendImage attempt ${attempt}/${MAX_ATTEMPTS} failed: ${err.message}`);
        if (attempt < MAX_ATTEMPTS) {
          await new Promise(r => setTimeout(r, 1500 * attempt));
        }
      }
    }

    return { success: false, error: lastError };
  }

  async sendAudio(phone, audioBase64, ptt = true) {
    if (!this.isReady || !this.sock) return { success: false, error: 'WhatsApp not connected' };
    try {
      const b64 = audioBase64.replace(/^data:audio\/[^;]+;base64,/, '');
      const jid = this._formatPhone(phone) + '@s.whatsapp.net';
      const result = await this.sock.sendMessage(jid, {
        audio: Buffer.from(b64, 'base64'),
        mimetype: 'audio/ogg; codecs=opus',
        ptt
      });
      return { success: true, messageId: result?.key?.id };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async checkNumber(phone) {
    if (!this.isReady || !this.sock) return { exists: false, error: 'WhatsApp not connected' };
    try {
      const jid = this._formatPhone(phone) + '@s.whatsapp.net';
      const [result] = await this.sock.onWhatsApp(jid);
      return { exists: !!result?.exists, jid: result?.jid };
    } catch (err) {
      return { exists: false, error: err.message };
    }
  }

  // Request on-demand history sync from WhatsApp servers
  async requestHistorySync() {
    if (!this.isReady || !this.sock) return { success: false, error: 'WhatsApp not connected' };
    try {
      // Get the oldest message we have per conversation to request history before it
      const res = await fetch(`${API_BASE}/api/whatsapp/internal/oldest-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIndex: this.sessionIndex }),
      });
      const data = await res.json();
      const oldestMessages = data.messages || [];

      if (oldestMessages.length === 0) {
        // No messages yet — just trigger a general sync
        console.log(`[WhatsApp:${this.sessionIndex}] No messages found, requesting general history`);
        return { success: true, requested: 0, message: 'History will sync automatically' };
      }

      let requested = 0;
      for (const oldest of oldestMessages) {
        try {
          const msgKey = {
            remoteJid: oldest.phone + '@s.whatsapp.net',
            id: oldest.whatsappMsgId,
            fromMe: oldest.direction === 'outgoing',
          };
          await this.sock.fetchMessageHistory(50, msgKey, oldest.timestamp);
          requested++;
          console.log(`[WhatsApp:${this.sessionIndex}] Requested history for ${oldest.phone}`);
        } catch (err) {
          console.warn(`[WhatsApp:${this.sessionIndex}] fetchMessageHistory failed for ${oldest.phone}:`, err.message);
        }
      }

      return { success: true, requested };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  hasSavedSession() {
    const credsFile = path.join(this.authPath, 'creds.json');
    return fs.existsSync(credsFile);
  }

  stop() {
    this._closeSocket();
    this._api('update-session', { sessionIndex: this.sessionIndex, status: 'disconnected' });
  }

  // Unwrap Baileys message wrappers (ephemeral, viewOnce, edited, etc.)
  _unwrapMessage(raw) {
    if (!raw) return null;
    const inner = raw.ephemeralMessage?.message
      || raw.viewOnceMessage?.message
      || raw.viewOnceMessageV2?.message
      || raw.editedMessage?.message?.protocolMessage?.editedMessage
      || raw.documentWithCaptionMessage?.message
      || raw;
    return inner;
  }

  // Parse a Baileys message into a flat object for saving (no HTTP call)
  _parseMessage(msg) {
    const remoteJid = msg.key?.remoteJid;
    if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid.endsWith('@broadcast')) return null;
    if (msg.message?.protocolMessage || msg.message?.reactionMessage || msg.message?.senderKeyDistributionMessage) return null;

    const phone = remoteJid.replace('@s.whatsapp.net', '');
    const direction = msg.key.fromMe ? 'outgoing' : 'incoming';
    const m = this._unwrapMessage(msg.message);
    if (!m) return null;

    const text = m.conversation
      || m.extendedTextMessage?.text
      || m.imageMessage?.caption
      || m.videoMessage?.caption
      || m.documentMessage?.caption
      || m.documentWithCaptionMessage?.message?.documentMessage?.caption
      || '';

    const messageType = m.imageMessage ? 'image'
      : m.videoMessage ? 'video'
      : m.audioMessage || m.pttMessage ? 'audio'
      : m.documentMessage || m.documentWithCaptionMessage ? 'document'
      : m.stickerMessage ? 'sticker'
      : m.contactMessage || m.contactsArrayMessage ? 'contact'
      : m.locationMessage || m.liveLocationMessage ? 'location'
      : 'text';

    if (!text && messageType === 'text') return null;

    const displayText = text || `[${messageType}]`;

    let timestamp = null;
    if (msg.messageTimestamp) {
      const ts = typeof msg.messageTimestamp === 'number'
        ? msg.messageTimestamp
        : Number(msg.messageTimestamp);
      if (ts > 0) timestamp = new Date(ts * 1000).toISOString();
    }

    return {
      sessionIndex: this.sessionIndex,
      phone,
      contactName: msg.pushName || null,
      text: displayText,
      messageType,
      whatsappMsgId: msg.key.id || null,
      direction,
      timestamp,
    };
  }

  async _handleIncomingMessage(msg, upsertType) {
    const remoteJid = msg.key.remoteJid;
    if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid.endsWith('@broadcast')) return;
    if (msg.message?.protocolMessage || msg.message?.reactionMessage || msg.message?.senderKeyDistributionMessage) return;

    const phone = remoteJid.replace('@s.whatsapp.net', '');
    const direction = msg.key.fromMe ? 'outgoing' : 'incoming';
    const m = this._unwrapMessage(msg.message);
    if (!m) return;

    const text = m.conversation
      || m.extendedTextMessage?.text
      || m.imageMessage?.caption
      || m.videoMessage?.caption
      || m.documentMessage?.caption
      || m.documentWithCaptionMessage?.message?.documentMessage?.caption
      || '';

    const messageType = m.imageMessage ? 'image'
      : m.videoMessage ? 'video'
      : m.audioMessage || m.pttMessage ? 'audio'
      : m.documentMessage || m.documentWithCaptionMessage ? 'document'
      : m.stickerMessage ? 'sticker'
      : m.contactMessage || m.contactsArrayMessage ? 'contact'
      : m.locationMessage || m.liveLocationMessage ? 'location'
      : 'text';

    if (!text && messageType === 'text') return;

    const displayText = text || `[${messageType}]`;
    const contactName = msg.pushName || null;

    // Use original message timestamp for history messages
    let timestamp = null;
    if (msg.messageTimestamp) {
      const ts = typeof msg.messageTimestamp === 'number'
        ? msg.messageTimestamp
        : Number(msg.messageTimestamp);
      if (ts > 0) timestamp = new Date(ts * 1000).toISOString();
    }

    console.log(`[WhatsApp:${this.sessionIndex}] ${direction} ${upsertType === 'notify' ? '' : '(history) '}${phone}: type=${messageType}, text=${displayText.slice(0, 50)}`);

    // Download audio media if available (only for real-time, not history – too heavy)
    let mediaUrl = null;
    if (messageType === 'audio' && upsertType === 'notify') {
      try {
        const { downloadMediaMessage } = this.loadDeps();
        const buffer = await downloadMediaMessage(msg, 'buffer', {});
        if (buffer) {
          mediaUrl = `data:audio/ogg;base64,${buffer.toString('base64')}`;
          console.log(`[WhatsApp:${this.sessionIndex}] Audio downloaded (${Math.round(buffer.length / 1024)}KB)`);
        }
      } catch (err) {
        console.warn(`[WhatsApp:${this.sessionIndex}] Audio download failed:`, err.message);
      }
    }

    // Save via Next.js API (handles deduplication via whatsappMsgId)
    const result = await this._api('save-incoming', {
      sessionIndex: this.sessionIndex,
      phone,
      contactName,
      text: displayText,
      messageType,
      whatsappMsgId: msg.key.id,
      mediaUrl,
      direction,
      timestamp,
    });

    // Only broadcast SSE for real-time messages, not history sync
    if (upsertType === 'notify' && result.conversationId) {
      this.broadcast(direction === 'incoming' ? 'incoming_message' : 'message_sent', {
        sessionIndex: this.sessionIndex,
        conversationId: result.conversationId,
        phone,
        contactName,
        text: displayText,
        messageType,
        messageId: result.messageId,
        direction,
      });
    }
  }
}

module.exports = WhatsAppSession;

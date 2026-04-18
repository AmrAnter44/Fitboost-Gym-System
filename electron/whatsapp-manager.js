/**
 * ✨ WhatsApp Manager - Built with Baileys
 * 🎯 Windows-only, lightweight, stable WhatsApp integration
 * 🚀 No browser needed - Direct WhatsApp protocol
 */

const makeWASocket = require('@whiskeysockets/baileys').default;
const {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeInMemoryStore
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

class WhatsAppManager {
  constructor(userDataPath) {
    this.sock = null;
    this.isReady = false;
    this.qrCode = null;
    this.userDataPath = userDataPath;
    this.authPath = path.join(userDataPath, '.baileys_auth');
    this.eventCallbacks = {
      qr: [],
      ready: [],
      disconnected: [],
      auth_failure: [],
      connecting: []
    };

    // Create auth directory
    if (!fs.existsSync(this.authPath)) {
      fs.mkdirSync(this.authPath, { recursive: true });
    }

  }

  /**
   * ✨ Initialize WhatsApp connection
   */
  async initialize() {
    if (this.sock) {
      return { success: false, error: 'Already initialized' };
    }

    try {

      // Platform check - Windows only
      if (process.platform !== 'win32') {
        console.error('❌ This application is designed for Windows only!');
        console.error(`💡 Current platform: ${process.platform}`);
        throw new Error(`WhatsApp integration is only supported on Windows. Current platform: ${process.platform}`);
      }


      // Load auth state
      const { state, saveCreds } = await useMultiFileAuthState(this.authPath);

      // Get latest Baileys version
      const { version, isLatest } = await fetchLatestBaileysVersion();

      // Create socket
      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        printQRInTerminal: false, // We'll handle QR ourselves
        logger: pino({ level: 'silent' }), // Silent logger
        browser: ['Fitboost Gym System', 'Windows', '10'],
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        defaultQueryTimeoutMs: 60000,
        syncFullHistory: false
      });

      // Save credentials on update
      this.sock.ev.on('creds.update', saveCreds);

      // Connection updates
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // QR Code event
        if (qr) {
          this.qrCode = qr;
          this.isReady = false;
          this._triggerEvent('qr', qr);
        }

        // Connection state
        if (connection === 'connecting') {
          this._triggerEvent('connecting', { message: 'Connecting...', percent: 30 });
        }

        if (connection === 'open') {
          this.isReady = true;
          this.qrCode = null;
          this._triggerEvent('ready');
        }

        if (connection === 'close') {
          this.isReady = false;
          this.qrCode = null;

          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
          const reason = lastDisconnect?.error?.output?.statusCode || 'unknown';


          if (shouldReconnect) {
            // Reconnect automatically
            this.sock = null;
            setTimeout(() => this.initialize(), 3000);
          } else {
            this._triggerEvent('disconnected', 'Logged out');
          }
        }
      });

      // Messages upsert (received messages)
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        // We can handle incoming messages here if needed
      });

      return { success: true };

    } catch (error) {
      console.error('❌ Failed to initialize WhatsApp:', error);
      this.sock = null;
      this.isReady = false;
      this.qrCode = null;
      return { success: false, error: error.message };
    }
  }

  /**
   * 📊 Get connection status
   */
  getStatus() {
    return {
      isReady: this.isReady,
      qrCode: this.qrCode,
      hasClient: this.sock !== null
    };
  }

  /**
   * 📤 Send text message
   */
  async sendMessage(phone, message, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!this.isReady || !this.sock) {
          console.error('❌ WhatsApp client is not ready');
          return {
            success: false,
            error: 'WhatsApp client is not ready. Please scan QR code first.'
          };
        }

        // Format phone number
        let formattedPhone = phone.replace(/\D/g, '');

        if (formattedPhone.startsWith('0')) {
          formattedPhone = '20' + formattedPhone.substring(1);
        } else if (!formattedPhone.startsWith('20')) {
          formattedPhone = '20' + formattedPhone;
        }

        const jid = `${formattedPhone}@s.whatsapp.net`;


        await this.sock.sendMessage(jid, { text: message });


        return {
          success: true,
          message: 'Message sent successfully'
        };

      } catch (error) {
        console.error(`❌ Failed to send message (Attempt ${attempt}/${maxRetries}):`, error.message);

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }

        return {
          success: false,
          error: error.message || 'Failed to send message'
        };
      }
    }

    return {
      success: false,
      error: 'Failed to send message after multiple attempts'
    };
  }

  /**
   * 🖼️ Send image with caption
   */
  async sendImage(phone, imageBase64, caption = '', maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!this.isReady || !this.sock) {
          console.error('❌ WhatsApp client is not ready');
          return {
            success: false,
            error: 'WhatsApp client is not ready. Please scan QR code first.'
          };
        }

        // Format phone number
        let formattedPhone = phone.replace(/\D/g, '');

        if (formattedPhone.startsWith('0')) {
          formattedPhone = '20' + formattedPhone.substring(1);
        } else if (!formattedPhone.startsWith('20')) {
          formattedPhone = '20' + formattedPhone;
        }

        const jid = `${formattedPhone}@s.whatsapp.net`;


        // Convert base64 to buffer
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        await this.sock.sendMessage(jid, {
          image: imageBuffer,
          caption: caption
        });


        return {
          success: true,
          message: 'Image sent successfully'
        };

      } catch (error) {
        console.error(`❌ Failed to send image (Attempt ${attempt}/${maxRetries}):`, error.message);

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }

        return {
          success: false,
          error: error.message || 'Failed to send image'
        };
      }
    }

    return {
      success: false,
      error: 'Failed to send image after multiple attempts'
    };
  }

  /**
   * 🔄 Reconnect
   */
  async reconnect() {
    try {

      if (this.sock) {
        await this.sock.logout();
        this.sock = null;
      }

      this.isReady = false;
      this.qrCode = null;

      await this.initialize();

      return { success: true };
    } catch (error) {
      console.error('❌ Failed to reconnect:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 🔥 Reset session (delete auth and start fresh)
   */
  async resetSession() {
    try {

      // Logout and destroy socket
      if (this.sock) {
        try {
          await this.sock.logout();
        } catch (e) {
        }
        this.sock = null;
      }

      this.isReady = false;
      this.qrCode = null;

      // Delete auth folder
      if (fs.existsSync(this.authPath)) {
        fs.rmSync(this.authPath, { recursive: true, force: true });

        // Recreate folder
        fs.mkdirSync(this.authPath, { recursive: true });
      }

      // Start fresh
      await this.initialize();

      return { success: true };
    } catch (error) {
      console.error('❌ Failed to reset session:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 📞 Register event callback
   */
  on(event, callback) {
    if (this.eventCallbacks[event]) {
      this.eventCallbacks[event].push(callback);
    }
  }

  /**
   * 🔔 Trigger event callbacks
   */
  _triggerEvent(event, data) {
    if (this.eventCallbacks[event]) {
      this.eventCallbacks[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} callback:`, error);
        }
      });
    }
  }

  /**
   * 🛑 Destroy WhatsApp client
   */
  async destroy() {
    try {
      if (this.sock) {
        await this.sock.logout();
        this.sock = null;
        this.isReady = false;
        this.qrCode = null;
      }
    } catch (error) {
      console.error('❌ Error destroying WhatsApp client:', error);
    }
  }
}

module.exports = WhatsAppManager;

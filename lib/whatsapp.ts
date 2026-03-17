/**
 * ✨ WhatsApp Backend Singleton - Built with Baileys
 * 🌐 Works in both Browser (via API) and Electron
 * 🚀 Fast, stable, cross-platform
 */

import makeWASocket from '@whiskeysockets/baileys';
import {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket
} from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';

type EventCallback = (data?: any) => void;

interface EventCallbacks {
  qr: EventCallback[];
  ready: EventCallback[];
  disconnected: EventCallback[];
  auth_failure: EventCallback[];
  connecting: EventCallback[];
}

class WhatsAppBackend {
  private static instance: WhatsAppBackend | null = null;
  private sock: WASocket | null = null;
  private isReady: boolean = false;
  private qrCode: string | null = null;
  private authPath: string;
  private eventCallbacks: EventCallbacks = {
    qr: [],
    ready: [],
    disconnected: [],
    auth_failure: [],
    connecting: []
  };

  private constructor() {
    // ✅ Use user's home directory for .baileys_auth (not program files)
    // This avoids EPERM errors in production builds
    const os = require('os');
    const homeDir = os.homedir();
    this.authPath = path.join(homeDir, '.fitboost-whatsapp', '.baileys_auth');

    if (!fs.existsSync(this.authPath)) {
      fs.mkdirSync(this.authPath, { recursive: true });
    }

    console.log('📱 WhatsApp Backend initialized');
    console.log('📂 Auth path:', this.authPath);

    // ✅ Auto-initialize if saved session exists (server-side only)
    if (typeof window === 'undefined') {
      this.checkAndAutoInitialize();
    }
  }

  /**
   * Check for existing session and auto-initialize
   */
  private checkAndAutoInitialize() {
    try {
      const credentialsFile = path.join(this.authPath, 'creds.json');

      if (fs.existsSync(credentialsFile)) {
        console.log('📱 Found existing WhatsApp session, attempting auto-connect...');

        // Wait a bit for the app to be ready
        setTimeout(async () => {
          try {
            await this.initialize();
            console.log('✅ WhatsApp auto-initialized successfully');
          } catch (error) {
            console.error('❌ Auto-initialization failed:', error);
          }
        }, 2000); // Wait 2 seconds
      } else {
        console.log('📱 No saved WhatsApp session found');
      }
    } catch (error) {
      console.error('❌ Error checking for existing session:', error);
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): WhatsAppBackend {
    if (!WhatsAppBackend.instance) {
      WhatsAppBackend.instance = new WhatsAppBackend();
    }
    return WhatsAppBackend.instance;
  }

  /**
   * Initialize WhatsApp connection
   */
  public async initialize(): Promise<{ success: boolean; error?: string }> {
    if (this.sock) {
      console.log('⚠️ WhatsApp client already initialized');
      return { success: false, error: 'Already initialized' };
    }

    try {
      console.log('🚀 Initializing WhatsApp with Baileys...');

      // Load auth state
      const { state, saveCreds } = await useMultiFileAuthState(this.authPath);

      // Get latest Baileys version
      const { version, isLatest } = await fetchLatestBaileysVersion();
      console.log(`📦 Using Baileys version: ${version.join('.')} ${isLatest ? '(latest)' : ''}`);

      // Create socket
      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Fitboost Gym System', 'Chrome', '10'],
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

        console.log('🔔 Connection Update:', { connection, hasQR: !!qr, hasError: !!lastDisconnect?.error });

        // QR Code event
        if (qr) {
          console.log('📱 QR Code generated (length:', qr.length, ')');
          this.qrCode = qr;
          this.isReady = false;
          this._triggerEvent('qr', qr);
        }

        // Connection state
        if (connection === 'connecting') {
          console.log('⏳ Connecting to WhatsApp...');
          this._triggerEvent('connecting', { message: 'Connecting...', percent: 30 });
        }

        if (connection === 'open') {
          console.log('✅ WhatsApp connected successfully!');
          this.isReady = true;
          this.qrCode = null;
          this._triggerEvent('ready');
        }

        if (connection === 'close') {
          this.isReady = false;
          this.qrCode = null;

          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const errorMessage = lastDisconnect?.error?.message || 'Unknown error';

          console.log('❌ Connection closed.');
          console.log('📋 Status Code:', statusCode);
          console.log('📋 Error Message:', errorMessage);

          // Handle different disconnect reasons
          if (statusCode === DisconnectReason.loggedOut) {
            console.log('🚪 Logged out - Session deleted');
            this._triggerEvent('disconnected', 'Logged out');
            this.sock = null;
          } else if (statusCode === DisconnectReason.restartRequired) {
            console.log('🔄 Restart required - Reconnecting...');
            this.sock = null;
            setTimeout(() => this.initialize(), 1000);
          } else if (statusCode === 440) {
            // Conflict error - Multiple WhatsApp Web instances
            console.log('⚠️ Conflict detected - Another session is active. Reconnecting...');
            this.sock = null;
            setTimeout(() => this.initialize(), 1000);
          } else if (statusCode === 515) {
            // Restart required
            console.log('🔄 Restart required - Reconnecting...');
            this.sock = null;
            setTimeout(() => this.initialize(), 1000);
          } else if (statusCode === DisconnectReason.connectionClosed ||
                     statusCode === DisconnectReason.connectionLost ||
                     !statusCode) {
            // Network issue or unknown error - delete bad credentials and start fresh
            console.log('🗑️ Bad credentials detected - Clearing auth and starting fresh...');

            // Delete auth folder to force new QR
            if (fs.existsSync(this.authPath)) {
              fs.rmSync(this.authPath, { recursive: true, force: true });
              fs.mkdirSync(this.authPath, { recursive: true });
              console.log('✅ Auth folder cleared');
            }

            this.sock = null;

            // Reinitialize to get fresh QR code
            setTimeout(() => this.initialize(), 2000);
          } else {
            // Other errors - try to reconnect with existing credentials
            console.log('🔄 Attempting reconnect...');
            this.sock = null;
            setTimeout(() => this.initialize(), 3000);
          }
        }
      });

      // Messages upsert
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        console.log('📥 Received message:', type);
      });

      console.log('✅ WhatsApp client initialized successfully');
      return { success: true };

    } catch (error) {
      console.error('❌ Failed to initialize WhatsApp:', error);
      this.sock = null;
      this.isReady = false;
      this.qrCode = null;
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get connection status
   */
  public getStatus() {
    return {
      isReady: this.isReady,
      qrCode: this.qrCode,
      hasClient: this.sock !== null
    };
  }

  /**
   * Send text message
   */
  public async sendMessage(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isReady || !this.sock) {
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

      console.log(`📤 Sending message to ${formattedPhone}...`);

      await this.sock.sendMessage(jid, { text: message });

      console.log(`✅ Message sent successfully to ${formattedPhone}`);

      return {
        success: true
      };

    } catch (error) {
      console.error(`❌ Failed to send message:`, (error as Error).message);
      return {
        success: false,
        error: (error as Error).message || 'Failed to send message'
      };
    }
  }

  /**
   * Send image with caption
   */
  public async sendImage(phone: string, imageBase64: string, caption: string = ''): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isReady || !this.sock) {
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

      console.log(`📤 Sending image to ${formattedPhone}...`);

      // Convert base64 to buffer
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      await this.sock.sendMessage(jid, {
        image: imageBuffer,
        caption: caption
      });

      console.log(`✅ Image sent successfully to ${formattedPhone}`);

      return {
        success: true
      };

    } catch (error) {
      console.error(`❌ Failed to send image:`, (error as Error).message);
      return {
        success: false,
        error: (error as Error).message || 'Failed to send image'
      };
    }
  }

  /**
   * Reconnect
   */
  public async reconnect(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔄 Reconnecting WhatsApp...');

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
        error: (error as Error).message
      };
    }
  }

  /**
   * Reset session
   */
  public async resetSession(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔄 Resetting WhatsApp session...');

      if (this.sock) {
        try {
          await this.sock.logout();
        } catch (e) {
          console.log('⚠️ Logout error (expected):', (e as Error).message);
        }
        this.sock = null;
      }

      this.isReady = false;
      this.qrCode = null;

      // Delete auth folder
      if (fs.existsSync(this.authPath)) {
        console.log('🗑️ Deleting old session folder:', this.authPath);
        fs.rmSync(this.authPath, { recursive: true, force: true });
        console.log('✅ Old session deleted');

        // Recreate folder
        fs.mkdirSync(this.authPath, { recursive: true });
      }

      await this.initialize();

      return { success: true };
    } catch (error) {
      console.error('❌ Failed to reset session:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Register event callback
   */
  public on(event: keyof EventCallbacks, callback: EventCallback) {
    if (this.eventCallbacks[event]) {
      this.eventCallbacks[event].push(callback);
    }
  }

  /**
   * Remove event callback
   */
  public off(event: keyof EventCallbacks, callback: EventCallback) {
    if (this.eventCallbacks[event]) {
      this.eventCallbacks[event] = this.eventCallbacks[event].filter(cb => cb !== callback);
    }
  }

  /**
   * Trigger event callbacks
   */
  private _triggerEvent(event: keyof EventCallbacks, data?: any) {
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
   * Destroy WhatsApp client
   */
  public async destroy() {
    try {
      if (this.sock) {
        console.log('🛑 Destroying WhatsApp client...');
        await this.sock.logout();
        this.sock = null;
        this.isReady = false;
        this.qrCode = null;
        console.log('✅ WhatsApp client destroyed');
      }
    } catch (error) {
      console.error('❌ Error destroying WhatsApp client:', error);
    }
  }
}

// Use global to maintain singleton across Next.js hot reloads
declare global {
  var whatsappBackend: WhatsAppBackend | undefined;
}

// Export singleton instance - use global in development to persist across hot reloads
export const whatsappBackend = global.whatsappBackend || WhatsAppBackend.getInstance();

if (process.env.NODE_ENV !== 'production') {
  global.whatsappBackend = whatsappBackend;
}

/**
 * Helper function to send WhatsApp message
 * @param phone Phone number (e.g., "201234567890")
 * @param message Message text
 * @returns true if sent successfully, false otherwise
 */
export async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  try {
    const result = await whatsappBackend.sendMessage(phone, message);
    return result.success;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
}

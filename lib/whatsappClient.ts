/**
 * 📡 WhatsApp Browser Client
 * API client for WhatsApp in browser mode
 */

type EventCallback = (data?: any) => void

interface EventCallbacks {
  qr: EventCallback[]
  ready: EventCallback[]
  disconnected: EventCallback[]
  auth_failure: EventCallback[]
  connecting: EventCallback[]
}

class WhatsAppBrowserClient {
  private eventSource: EventSource | null = null
  private eventCallbacks: EventCallbacks = {
    qr: [],
    ready: [],
    disconnected: [],
    auth_failure: [],
    connecting: []
  }

  /**
   * Initialize WhatsApp connection
   */
  async init(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch('/api/whatsapp/init', {
        method: 'POST'
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to initialize' }
      }

      // Start listening to events via SSE
      this.connectSSE()

      return { success: true }
    } catch (error) {
      console.error('❌ Error initializing WhatsApp:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * Get WhatsApp status
   */
  async getStatus(): Promise<{
    isReady: boolean
    qrCode: string | null
    hasClient: boolean
  }> {
    try {
      const response = await fetch('/api/whatsapp/status')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get status')
      }

      return {
        isReady: data.isReady || false,
        qrCode: data.qrCode || null,
        hasClient: data.hasClient || false
      }
    } catch (error) {
      console.error('❌ Error getting WhatsApp status:', error)
      return {
        isReady: false,
        qrCode: null,
        hasClient: false
      }
    }
  }

  /**
   * Send text message
   */
  async sendMessage(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phone, message })
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to send message' }
      }

      return { success: true }
    } catch (error) {
      console.error('❌ Error sending message:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * Send image with caption
   */
  async sendImage(phone: string, imageBase64: string, caption: string = ''): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch('/api/whatsapp/send-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phone, imageBase64, caption })
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to send image' }
      }

      return { success: true }
    } catch (error) {
      console.error('❌ Error sending image:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * Reconnect to WhatsApp
   */
  async reconnect(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch('/api/whatsapp/reconnect', {
        method: 'POST'
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to reconnect' }
      }

      return { success: true }
    } catch (error) {
      console.error('❌ Error reconnecting:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * Reset WhatsApp session
   */
  async resetSession(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch('/api/whatsapp/reset', {
        method: 'POST'
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to reset session' }
      }

      return { success: true }
    } catch (error) {
      console.error('❌ Error resetting session:', error)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * Connect to SSE for real-time events
   */
  private connectSSE() {
    // Close existing connection
    if (this.eventSource) {
      this.eventSource.close()
    }

    console.log('📡 Connecting to WhatsApp events via SSE...')

    this.eventSource = new EventSource('/api/whatsapp/events')

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        switch (data.type) {
          case 'qr':
            console.log('📱 QR Code received via SSE')
            this._triggerEvent('qr', data.data.qrCode)
            break

          case 'ready':
            console.log('✅ WhatsApp ready via SSE')
            this._triggerEvent('ready')
            break

          case 'connecting':
            console.log('⏳ Connecting via SSE')
            this._triggerEvent('connecting', data.data)
            break

          case 'disconnected':
            console.log('❌ Disconnected via SSE')
            this._triggerEvent('disconnected', data.data.reason)
            break

          case 'heartbeat':
            // Keep-alive ping
            break

          default:
            console.log('📨 Received event:', data.type)
        }
      } catch (error) {
        console.error('❌ Error parsing SSE message:', error)
      }
    }

    this.eventSource.onerror = (error) => {
      console.error('❌ SSE connection error:', error)
      this.eventSource?.close()

      // Reconnect after 5 seconds
      setTimeout(() => {
        console.log('🔄 Reconnecting SSE...')
        this.connectSSE()
      }, 5000)
    }
  }

  /**
   * Register event listener
   */
  on(event: keyof EventCallbacks, callback: EventCallback) {
    if (this.eventCallbacks[event]) {
      this.eventCallbacks[event].push(callback)
    }
  }

  /**
   * Remove event listener
   */
  off(event: keyof EventCallbacks, callback: EventCallback) {
    if (this.eventCallbacks[event]) {
      this.eventCallbacks[event] = this.eventCallbacks[event].filter(cb => cb !== callback)
    }
  }

  /**
   * Remove all event listeners
   */
  offAllListeners() {
    Object.keys(this.eventCallbacks).forEach(key => {
      this.eventCallbacks[key as keyof EventCallbacks] = []
    })
  }

  /**
   * Trigger event callbacks
   */
  private _triggerEvent(event: keyof EventCallbacks, data?: any) {
    if (this.eventCallbacks[event]) {
      this.eventCallbacks[event].forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in ${event} callback:`, error)
        }
      })
    }
  }

  /**
   * Disconnect SSE
   */
  disconnect() {
    if (this.eventSource) {
      console.log('🛑 Disconnecting SSE...')
      this.eventSource.close()
      this.eventSource = null
    }
  }
}

// Create singleton instance
let whatsappBrowserClient: WhatsAppBrowserClient | null = null

export function getWhatsAppBrowserClient(): WhatsAppBrowserClient {
  if (!whatsappBrowserClient) {
    whatsappBrowserClient = new WhatsAppBrowserClient()
  }
  return whatsappBrowserClient
}

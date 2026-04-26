/**
 * WhatsApp Message Queue with Rate Limiting and Anti-Ban Logic
 *
 * Per-session workers, each running independently:
 * - Max 30 messages/day/session (configurable)
 * - Random delay between messages: 10-40 seconds
 * - Warm-up period: first 3 days, limit to 10 msgs/day
 * - Number existence check before sending
 * - Message variation (zero-width chars) to avoid duplicate detection
 * - Retry with exponential backoff on failure
 *
 * DB operations go through Next.js API (Prisma) via HTTP – no direct DB access.
 */

const MIN_DELAY_MS = 10000;  // 10 seconds
const MAX_DELAY_MS = 40000;  // 40 seconds
const POLL_INTERVAL = 5000;  // Check queue every 5s
const API_BASE = 'http://127.0.0.1:4001';

function internalHeaders() {
  const tok = process.env.INTERNAL_API_TOKEN;
  const headers = { 'Content-Type': 'application/json' };
  if (tok) headers['x-internal-token'] = tok;
  return headers;
}

class WhatsAppQueue {
  constructor(sessions) {
    this.sessions = sessions;  // Map<number, WhatsAppSession>
    this.workers = new Map();  // sessionIndex -> intervalId
    this.processing = new Map(); // sessionIndex -> boolean
  }

  async _api(endpoint, data) {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/internal/${endpoint}`, {
        method: 'POST',
        headers: internalHeaders(),
        body: JSON.stringify(data || {}),
      });
      return await res.json();
    } catch (err) {
      console.error(`[Queue] API call ${endpoint} failed:`, err.message);
      return { success: false, error: err.message };
    }
  }

  startAll() {
    for (const [idx] of this.sessions) {
      this.startWorker(idx);
    }
    this._scheduleDailyReset();
  }

  stopAll() {
    for (const [idx] of this.workers) {
      this.stopWorker(idx);
    }
  }

  startWorker(sessionIndex) {
    if (this.workers.has(sessionIndex)) return;
    this.processing.set(sessionIndex, false);

    const intervalId = setInterval(() => {
      this._tick(sessionIndex);
    }, POLL_INTERVAL);

    this.workers.set(sessionIndex, intervalId);
  }

  stopWorker(sessionIndex) {
    const id = this.workers.get(sessionIndex);
    if (id) {
      clearInterval(id);
      this.workers.delete(sessionIndex);
      this.processing.delete(sessionIndex);
    }
  }

  async _tick(sessionIndex) {
    if (this.processing.get(sessionIndex)) return;

    const session = this.sessions.get(sessionIndex);
    if (!session || !session.isReady) return;

    // Poll for next item + daily info
    const poll = await this._api('queue-poll', { sessionIndex });
    if (!poll.item) return;

    this.processing.set(sessionIndex, true);

    try {
      await this._processItem(session, poll.item, sessionIndex);
    } catch (err) {
      console.error(`[Queue:${sessionIndex}] Process error:`, err.message);
    } finally {
      this.processing.set(sessionIndex, false);
    }
  }

  async _processItem(session, item, sessionIndex) {
    // Mark as processing
    await this._api('queue-update', { id: item.id, status: 'processing' });

    // Random delay for anti-ban
    const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
    await new Promise(r => setTimeout(r, delay));

    // Check if session is still connected after delay
    if (!session.isReady) {
      await this._api('queue-update', { id: item.id, status: 'queued' });
      return;
    }

    // Check if number exists on WhatsApp
    const numberCheck = await session.checkNumber(item.phone);
    if (!numberCheck.exists) {
      await this._api('queue-update', { id: item.id, status: 'failed', error: 'Number not on WhatsApp' });
      return;
    }

    // Apply message variation (anti-duplicate detection)
    const content = this._applyVariation(item.content);

    // Send message
    let result;
    if (item.messageType === 'image' && item.mediaBase64) {
      result = await session.sendImage(item.phone, item.mediaBase64, content);
    } else {
      result = await session.sendMessage(item.phone, content);
    }

    if (result.success) {
      // Mark sent + save outgoing message + increment daily count
      await this._api('queue-sent', {
        queueItemId: item.id,
        sessionIndex,
        phone: item.phone,
        content: item.content,
        messageType: item.messageType,
        whatsappMsgId: result.messageId,
        createdById: item.createdById,
      });

    } else {
      const attempts = (item.attempts || 0) + 1;
      if (attempts >= (item.maxAttempts || 3)) {
        await this._api('queue-update', { id: item.id, status: 'failed', attempts, error: result.error });
      } else {
        const retryDelay = Math.min(60 * Math.pow(2, attempts), 600); // max 10 minutes
        await this._api('queue-update', { id: item.id, attempts, retrySeconds: retryDelay });
      }
    }
  }

  _applyVariation(text) {
    const zwsp = '\u200B';
    const count = 1 + Math.floor(Math.random() * 3);
    return text + zwsp.repeat(count);
  }

  _scheduleDailyReset() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();

    setTimeout(() => {
      this._resetDailyCounts();
      setInterval(() => this._resetDailyCounts(), 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }

  async _resetDailyCounts() {
    const result = await this._api('queue-daily-reset');
    if (result.success) {
    }
  }
}

module.exports = WhatsAppQueue;

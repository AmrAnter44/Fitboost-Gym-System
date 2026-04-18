/**
 * In-memory TTL cache for public API endpoints.
 * Reduces DB hits when multiple clients request the same data simultaneously.
 * Survives HMR in dev (stored on globalThis).
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

class SimpleCache {
  private store = new Map<string, CacheEntry<unknown>>()

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs })
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry.value as T
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  /** Invalidate all keys that start with a given prefix */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key)
      }
    }
  }

  get size(): number {
    return this.store.size
  }
}

const globalForCache = globalThis as unknown as { _apiCache: SimpleCache | undefined }

export const apiCache = globalForCache._apiCache ?? new SimpleCache()

if (process.env.NODE_ENV !== 'production') {
  globalForCache._apiCache = apiCache
}

/** TTL constants in milliseconds */
export const CACHE_TTL = {
  PROFILE: 30_000,       // 30s — member profile (name, expiry, etc.)
  CHECKINS: 60_000,      // 60s — check-in history
  RECEIPTS: 60_000,      // 60s — receipts
  SPA: 30_000,           // 30s — SPA bookings
  FREEZE: 30_000,        // 30s — freeze requests
  GYM_CAPACITY: 15_000,  // 15s — live capacity (short TTL)
} as const

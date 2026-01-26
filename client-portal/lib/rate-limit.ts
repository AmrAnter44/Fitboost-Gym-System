/**
 * Simple in-memory rate limiter
 * For production, consider using Redis for distributed rate limiting
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitStore {
  [key: string]: RateLimitEntry;
}

const store: RateLimitStore = {};

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 5 * 60 * 1000);

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetIn?: number;
}

/**
 * Check if request is within rate limit
 *
 * @param identifier - Unique identifier (e.g., IP address, member ID)
 * @param maxAttempts - Maximum number of attempts allowed
 * @param windowSeconds - Time window in seconds
 * @returns Rate limit check result
 */
export async function checkRateLimit(
  identifier: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const key = identifier;

  // Clean expired entry
  if (store[key] && store[key].resetTime < now) {
    delete store[key];
  }

  // Initialize or get current entry
  if (!store[key]) {
    store[key] = {
      count: 1,
      resetTime: now + windowSeconds * 1000,
    };
    return {
      success: true,
      remaining: maxAttempts - 1,
      resetIn: windowSeconds,
    };
  }

  // Check if limit exceeded
  if (store[key].count >= maxAttempts) {
    return {
      success: false,
      remaining: 0,
      resetIn: Math.ceil((store[key].resetTime - now) / 1000),
    };
  }

  // Increment count
  store[key].count++;
  return {
    success: true,
    remaining: maxAttempts - store[key].count,
    resetIn: Math.ceil((store[key].resetTime - now) / 1000),
  };
}

/**
 * Reset rate limit for identifier
 * Useful for successful operations
 */
export function resetRateLimit(identifier: string): void {
  delete store[identifier];
}

/**
 * Get current rate limit status without incrementing
 */
export function getRateLimitStatus(identifier: string): RateLimitResult {
  const now = Date.now();
  const entry = store[identifier];

  if (!entry || entry.resetTime < now) {
    return {
      success: true,
      remaining: 0,
      resetIn: 0,
    };
  }

  return {
    success: entry.count < 5, // Assuming default max of 5
    remaining: Math.max(0, 5 - entry.count),
    resetIn: Math.ceil((entry.resetTime - now) / 1000),
  };
}

/**
 * internalAuth.ts
 * ---------------
 * تحقّق من أن الطلب قادم من الـ sidecar الداخلي (مثل whatsapp-service.js).
 * الحماية على طبقتين:
 *   1) shared-secret header (x-internal-token) يتطابق مع INTERNAL_API_TOKEN
 *   2) timing-safe comparison لمنع side-channel attacks
 *
 * نستخدم timingSafeEqual من crypto حتى لا يُسرَّب طول الـ token.
 */

import crypto from 'crypto'

export class InternalAuthError extends Error {
  status: number
  constructor(message: string, status = 401) {
    super(message)
    this.status = status
    this.name = 'InternalAuthError'
  }
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Validates that the request has a valid internal token header.
 * Throws InternalAuthError on failure.
 */
export function requireInternalToken(request: Request): void {
  const expected = process.env.INTERNAL_API_TOKEN
  if (!expected || expected.length < 16) {
    throw new InternalAuthError('Internal API is not configured (INTERNAL_API_TOKEN missing)', 503)
  }

  const provided = request.headers.get('x-internal-token') || ''
  if (!provided || !timingSafeEqualStrings(provided, expected)) {
    throw new InternalAuthError('Invalid internal token', 401)
  }
}

/**
 * Returns the configured internal token for sidecar use.
 * Only callable server-side. Never expose to client.
 */
export function getInternalToken(): string | null {
  const tok = process.env.INTERNAL_API_TOKEN
  return tok && tok.length >= 16 ? tok : null
}

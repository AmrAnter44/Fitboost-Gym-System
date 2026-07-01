/**
 * Phone number normalization for WhatsApp (Next.js side).
 *
 * ⚠️ IMPORTANT: This logic is MIRRORED in `electron/phoneFormat.js` (CommonJS)
 * because the Electron build (`package.json` build.files) ships `electron/**`
 * but NOT `lib/**`, so the sidecar can't import this file. Keep both in sync.
 *
 * Returns the bare digits WhatsApp needs — no '+', no '@s.whatsapp.net'.
 *
 * Rules (order matters):
 *  1. Leading '+'        → trust it, keep its country code as-is.
 *  2. Leading '00'       → international prefix, strip it.
 *  3. Leading single '0' → Egyptian local trunk-0 → '20' + rest.
 *  4. Egyptian mobile without 0 (1[0125]xxxxxxxx) → '20' + it.
 *  5. Otherwise          → already has a country code (20.., 966..) → as-is.
 */
export function toWhatsAppNumber(raw: string): string {
  const s = String(raw || '').trim()
  if (!s) return ''
  const hadPlus = s.startsWith('+')
  const p = s.replace(/\D/g, '') // digits only
  if (!p) return ''
  if (hadPlus) return p
  if (p.startsWith('00')) return p.slice(2)
  if (p.startsWith('0')) return '20' + p.slice(1)
  if (/^1[0125]\d{8}$/.test(p)) return '20' + p
  return p
}

/**
 * Builds the Baileys JID for a phone number.
 */
export function toWhatsAppJid(raw: string): string {
  return toWhatsAppNumber(raw) + '@s.whatsapp.net'
}

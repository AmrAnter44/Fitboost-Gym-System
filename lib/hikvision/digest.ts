/**
 * مصادقة HTTP Digest (RFC 2617) — أجهزة Hikvision بتستخدمها افتراضياً.
 *
 * ليه مكتوبة بالإيد: المشروع مافيهوش أي مكتبة HTTP (لا axios ولا got)، ولا
 * حزمة digest. إضافة dependency جديدة كانت هتحتاج تعديل `build.files` و
 * `asarUnpack` في package.json عشان توصل للنسخة المعبّأة — والكود ده ٧٠ سطر
 * بـ node:crypto اللي مستخدم أصلاً في lib/internalAuth.ts.
 *
 * الطريقة: بنبعت الطلب من غير مصادقة، الجهاز بيرد 401 ومعاه تحدي في
 * WWW-Authenticate، بنحسب الرد ونعيد الطلب.
 */

import crypto from 'crypto'

export interface DigestChallenge {
  realm: string
  nonce: string
  qop?: string
  opaque?: string
  algorithm?: string
}

const md5 = (s: string) => crypto.createHash('md5').update(s).digest('hex')

/**
 * تفكيك هيدر WWW-Authenticate.
 * مثال: Digest realm="IP Camera", nonce="4d3f...", qop="auth", opaque=""
 * بيرجّع null لو الهيدر مش Digest (مثلاً Basic) أو ناقص الأساسيات.
 */
export function parseChallenge(header: string | null): DigestChallenge | null {
  if (!header) return null
  // [\s\S] بدل العلم s — المشروع بيستهدف ES2017 واللي قبله مابيدعمهوش
  const m = /^\s*Digest\s+([\s\S]*)$/i.exec(header)
  if (!m) return null

  const out: Record<string, string> = {}
  // المفاتيح ممكن تيجي بعلامات تنصيص أو من غيرها
  const re = /([a-z0-9_-]+)\s*=\s*(?:"([^"]*)"|([^,\s]+))/gi
  let g: RegExpExecArray | null
  while ((g = re.exec(m[1])) !== null) {
    out[g[1].toLowerCase()] = g[2] !== undefined ? g[2] : g[3]
  }

  if (!out.realm || !out.nonce) return null
  return {
    realm: out.realm,
    nonce: out.nonce,
    qop: out.qop,
    opaque: out.opaque,
    algorithm: out.algorithm,
  }
}

/**
 * بناء هيدر Authorization من التحدي.
 *
 * `uri` لازم يكون المسار زي ما اتبعت في سطر الطلب (مع الـ query لو موجود)،
 * مش الـ URL كامل — الجهاز بيحسب الهاش على ده بالظبط.
 */
export function buildAuthHeader(opts: {
  username: string
  password: string
  method: string
  uri: string
  challenge: DigestChallenge
  nc?: number
  cnonce?: string
}): string {
  const { username, password, method, uri, challenge } = opts
  const nc = String(opts.nc ?? 1).padStart(8, '0')
  const cnonce = opts.cnonce ?? crypto.randomBytes(8).toString('hex')

  let ha1 = md5(`${username}:${challenge.realm}:${password}`)
  // MD5-sess بيضيف الـ nonce للـ HA1 — نادر في Hikvision بس رخيص ندعمه
  if (challenge.algorithm && /MD5-sess/i.test(challenge.algorithm)) {
    ha1 = md5(`${ha1}:${challenge.nonce}:${cnonce}`)
  }
  const ha2 = md5(`${method.toUpperCase()}:${uri}`)

  // qop ممكن ييجي "auth,auth-int" — بناخد auth
  const qop = challenge.qop?.split(',').map(s => s.trim()).find(s => s === 'auth')

  const response = qop
    ? md5(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${challenge.nonce}:${ha2}`)

  const parts = [
    `username="${username}"`,
    `realm="${challenge.realm}"`,
    `nonce="${challenge.nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
  ]
  if (qop) parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`)
  if (challenge.opaque !== undefined) parts.push(`opaque="${challenge.opaque}"`)
  if (challenge.algorithm) parts.push(`algorithm=${challenge.algorithm}`)

  return `Digest ${parts.join(', ')}`
}

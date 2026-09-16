/**
 * أسرار البوابات: باسورد الجهاز + سر مسار استقبال الأحداث.
 *
 * ليه الباسورد مايتخزّنش صريح في الداتابيز؟ لأن الداتابيز بتتنسخ في أماكن
 * كتير — `scripts/lib/safe-db.js` بياخد `.autobackup.*.bak`، و
 * `lib/autoBackup.ts` بياخد نسخة يومية، وفيه نسخ سحابية على Backblaze.
 * باسورد صريح في عمود معناه إنه هيتوزّع في كل النسخ دي.
 *
 * التشفير AES-256-GCM بمفتاح في ملف منفصل بصلاحيات 0600 — نفس نمط
 * `.internal-api-token` في `electron/main.js:264-281`. المفتاح مش في
 * الداتابيز، فنسخة مسروقة من الداتابيز لوحدها مابتديش الباسورد.
 *
 * ⚠️ ده مش حماية ضد حد واصل للجهاز نفسه (المفتاح موجود على نفس الجهاز) —
 * هو بيمنع تسريب الباسورد عن طريق النسخ الاحتياطية، وده السيناريو الواقعي.
 */

import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { resolveDbDir } from '../dbPath'

const KEY_FILE = '.gates-key'
const SECRET_FILE = '.gates-event-secret'

/**
 * مجلد الأسرار. في الإلكترون بيتحدّد من `FITBOOST_SECRET_DIR` (userData)،
 * وفي غيره بيقع جنب الداتابيز — اللي هو مجلد مش متتبّع في git.
 */
function secretDir(): string {
  const fromEnv = process.env.FITBOOST_SECRET_DIR
  if (fromEnv) return fromEnv
  return resolveDbDir()
}

/** بيقرا ملف سر، وبيولّده أول مرة. الصلاحيات 0600 دايماً. */
function readOrCreate(fileName: string, generate: () => string): string {
  const file = path.join(secretDir(), fileName)
  try {
    const existing = fs.readFileSync(file, 'utf8').trim()
    if (existing) return existing
  } catch {
    // مش موجود — هنعمله تحت
  }
  const value = generate()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, value, { mode: 0o600 })
  try {
    fs.chmodSync(file, 0o600) // لو الملف كان موجود بصلاحيات أوسع
  } catch { /* ويندوز مابيدعمش chmod — عادي */ }
  return value
}

const getKey = () =>
  Buffer.from(readOrCreate(KEY_FILE, () => crypto.randomBytes(32).toString('hex')), 'hex')

/**
 * السر اللي بيتحط في مسار استقبال الأحداث.
 * الجهاز مابيعرفش يبعت هيدرات مخصصة، فالسر بيبقى في المسار نفسه.
 */
export const getEventSecret = () =>
  readOrCreate(SECRET_FILE, () => crypto.randomBytes(24).toString('hex'))

/** مقارنة ثابتة الزمن — نفس أسلوب `lib/internalAuth.ts`. */
export function matchesEventSecret(provided: string): boolean {
  const expected = getEventSecret()
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/** التنسيق: v1:<iv b64>:<tag b64>:<ciphertext b64> */
export function encryptPassword(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join(':')
}

export function decryptPassword(stored: string): string {
  const [version, ivB64, tagB64, dataB64] = stored.split(':')
  if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('صيغة الباسورد المخزّن مش مفهومة — أعد إدخال بيانات الجهاز')
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  try {
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    // المفتاح اتغيّر أو الملف اتنقل — رسالة مفهومة بدل خطأ crypto خام
    throw new Error('مقدرتش أفك تشفير باسورد الجهاز — أعد إدخاله من الإعدادات')
  }
}

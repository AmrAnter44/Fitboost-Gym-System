// lib/memberPhotoUpload.ts — رفع صورة العضو من الأبليكيشن (مرة واحدة بإذن من الريسيبشن)
//  الريسيبشن بيفتح «سماح» 10 دقايق من بروفايل العضو → الأبليكيشن يقدر يرفع صورة واحدة → السماح يتقفل.
//  الصورة بتتحفظ زي صور السيستم بالظبط (ملف في uploads/members) — فبتوصل للبوابات كمان.
//  العمود جديد → raw SQL (الـ Prisma client ممكن يكون قديم).

import path from 'path'
import crypto from 'crypto'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { getMembersUploadsDir, isPathInsideMembersUploads } from './uploadsPath'

export const PHOTO_UPLOAD_WINDOW_MS = 10 * 60 * 1000
const MAX_BYTES = 5 * 1024 * 1024

/** وقت انتهاء السماح (ms) — null لو مفيش سماح */
export async function getPhotoUploadUntil(db: any, memberId: string): Promise<number | null> {
  try {
    const rows: any = await db.$queryRawUnsafe(`SELECT photoUploadUntil FROM Member WHERE id = ? LIMIT 1`, memberId)
    const v = Array.isArray(rows) && rows[0] ? rows[0].photoUploadUntil : null
    if (v === null || v === undefined) return null
    const ms = typeof v === 'number' ? v : new Date(v).getTime()
    return Number.isFinite(ms) ? ms : null
  } catch {
    return null
  }
}

/** السماح شغّال دلوقتي؟ */
export async function isPhotoUploadOpen(db: any, memberId: string): Promise<boolean> {
  const until = await getPhotoUploadUntil(db, memberId)
  return !!until && until > Date.now()
}

export async function setPhotoUploadUntil(db: any, memberId: string, untilMs: number | null): Promise<void> {
  await db.$executeRawUnsafe(`UPDATE Member SET photoUploadUntil = ? WHERE id = ?`, untilMs, memberId)
}

const TYPES: Array<{ mime: string; ext: string; magic: number[] }> = [
  { mime: 'image/jpeg', ext: '.jpg', magic: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', ext: '.png', magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/webp', ext: '.webp', magic: [0x52, 0x49, 0x46, 0x46] },
]

/**
 * يحفظ صورة جاية base64 (data URL أو base64 خام) في فولدر صور الأعضاء ويرجّع اللينك
 * بنفس شكل /api/upload-image. بيرمي Error برسالة عربي لو الصورة مش مقبولة.
 */
export async function saveMemberImageFromBase64(input: string): Promise<string> {
  const raw = String(input || '')
  const b64 = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw
  let buffer: Buffer
  try { buffer = Buffer.from(b64, 'base64') } catch { throw new Error('الصورة مش سليمة') }
  if (buffer.length < 100) throw new Error('الصورة مش سليمة')
  if (buffer.length > MAX_BYTES) throw new Error('حجم الصورة كبير جداً. الحد الأقصى 5MB')
  //  النوع من محتوى الملف نفسه (مش من اللي العميل بيقوله)
  const type = TYPES.find(t => t.magic.every((b, i) => buffer[i] === b))
  if (!type) throw new Error('نوع الصورة مش مدعوم. استخدم JPG أو PNG أو WebP')

  const dir = getMembersUploadsDir()
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  const filename = `${Date.now()}_${crypto.randomBytes(16).toString('hex')}${type.ext}`
  const filepath = path.join(dir, filename)
  if (!isPathInsideMembersUploads(filepath)) throw new Error('مسار غير صحيح')
  await writeFile(filepath, buffer)

  const isElectron = process.env.UPLOADS_PATH !== undefined
  return isElectron
    ? `/api/serve-image?path=${encodeURIComponent(`uploads/members/${filename}`)}`
    : `/uploads/members/${filename}`
}

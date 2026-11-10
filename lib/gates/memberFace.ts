// lib/gates/memberFace.ts
//  📷 صورة العضو ↔ صورة الوش على البوابة
//
//  Member.profileImage ممكن تبقى واحدة من:
//    - /uploads/members/<file>                         (ويب / dev)
//    - /api/serve-image?path=uploads/members/<file>    (Electron)
//    - data:image/...;base64,...                       (داتا قديمة)
//  الجهاز عايز JPEG ≤ 200KB بمقاس معقول — الفورم بيبعت أصلاً JPEG ≤ 640px
//  (components/ImageUpload)، فالتجهيز هنا مجرد ضمان للداتا القديمة.

import path from 'path'
import crypto from 'crypto'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { getMembersUploadsDir, isPathInsideMembersUploads } from '../uploadsPath'
import { FACE_MAX_BYTES, isJpeg } from '../hikvision/client'

const FACE_MAX_DIM = 640

declare const __non_webpack_require__: NodeRequire | undefined

/**
 * sharp موجود في devDependencies بس — مش مضمون يكون في النسخة المتغلّفة.
 * فبنحمّله لو موجود، ولو مش موجود بنكمّل من غيره (الفورم بيبعت JPEG جاهز أصلاً).
 */
let sharpCache: any | null | undefined
function loadSharp(): any | null {
  if (sharpCache !== undefined) return sharpCache
  try {
    // eslint-disable-next-line no-eval
    const req: NodeRequire = typeof __non_webpack_require__ === 'function' ? __non_webpack_require__ : eval('require')
    sharpCache = req('sharp')
  } catch {
    sharpCache = null
  }
  return sharpCache
}

/** بيقرا بايتات صورة العضو من الديسك أو من الـ base64. null = مفيش صورة أو مش لاقيها. */
export async function readMemberImage(profileImage: string | null | undefined): Promise<Buffer | null> {
  if (!profileImage) return null
  const v = profileImage.trim()

  const data = /^data:image\/[a-zA-Z0-9+.\-]+;base64,([\s\S]+)$/.exec(v)
  if (data) return Buffer.from(data[1], 'base64')

  let rel: string | null = null
  if (v.startsWith('/api/serve-image')) {
    try {
      rel = new URL(v, 'http://localhost').searchParams.get('path')
    } catch { rel = null }
  } else if (v.startsWith('/uploads/members/')) {
    rel = v
  }
  if (!rel) return null

  //  اسم الملف بس — المسار المتسجّل ممكن يكون من جهاز تاني (C:\Users\...)
  const name = path.win32.basename(rel.split('?')[0])
  if (!name || name.includes('..')) return null

  const candidates = [
    path.join(getMembersUploadsDir(), name),
    path.join(process.cwd(), 'public', 'uploads', 'members', name),
  ]
  for (const c of candidates) {
    if (existsSync(c)) {
      try { return await readFile(c) } catch { /* نجرب اللي بعده */ }
    }
  }
  return null
}

/**
 * يجهّز صورة للجهاز: JPEG، أطول ضلع ≤ 640، حجم ≤ 200KB.
 * من غير sharp: بنقبل الـ JPEG لو حجمه مناسب، وإلا رسالة واضحة بدل ما الجهاز يرفض بكود غامض.
 */
export async function prepareFaceJpeg(input: Buffer): Promise<Buffer> {
  const sharp = loadSharp()
  if (sharp) {
    try {
      for (const q of [85, 75, 65, 55, 45]) {
        const out: Buffer = await sharp(input)
          .rotate()
          .resize(FACE_MAX_DIM, FACE_MAX_DIM, { fit: 'inside', withoutEnlargement: true })
          .flatten({ background: '#ffffff' })
          .jpeg({ quality: q, mozjpeg: false })
          .toBuffer()
        if (out.length <= FACE_MAX_BYTES) return out
      }
    } catch (e) {
      console.error('[gates] sharp فشل في تجهيز صورة الوش:', (e as Error)?.message)
    }
  }

  if (!isJpeg(input)) {
    throw new Error('صورة العضو مش JPEG (PNG/WebP قديمة) — صوّره تاني من الفورم عشان تترفع للبوابة')
  }
  if (input.length > FACE_MAX_BYTES) {
    throw new Error(`صورة العضو ${Math.round(input.length / 1024)}KB والبوابة بتاخد لحد 200KB — صوّره تاني من الفورم`)
  }
  return input
}

/** صورة العضو جاهزة للجهاز — أو null لو العضو مالوش صورة. */
export async function loadMemberFaceJpeg(profileImage: string | null | undefined): Promise<Buffer | null> {
  if (!profileImage) return null
  const raw = await readMemberImage(profileImage)
  if (!raw) throw new Error('ملف صورة العضو مش موجود على الجهاز ده — ارفع الصورة تاني')
  return prepareFaceJpeg(raw)
}

/** بيحفظ صورة متصوّرة من البوابة في فولدر صور الأعضاء — نفس مسار /api/upload-image بالظبط. */
export async function saveMemberJpeg(jpeg: Buffer): Promise<string> {
  const dir = getMembersUploadsDir()
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  const filename = `${Date.now()}_${crypto.randomBytes(16).toString('hex')}.jpg`
  const filepath = path.join(dir, filename)
  if (!isPathInsideMembersUploads(filepath)) throw new Error('مسار غير صحيح')
  await writeFile(filepath, jpeg)
  return process.env.UPLOADS_PATH !== undefined
    ? `/api/serve-image?path=${encodeURIComponent(`uploads/members/${filename}`)}`
    : `/uploads/members/${filename}`
}

// app/api/upload-image/route.ts
import { NextResponse } from 'next/server'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { verifyAuth } from '../../../lib/auth'

export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

// Magic bytes signatures للتحقق من نوع الملف الحقيقي (مش client-controlled)
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/jpg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // "RIFF" (WebP بيبدأ بها)
}

function verifyMagicBytes(buffer: Buffer, claimedMime: string): boolean {
  const signatures = MAGIC_BYTES[claimedMime]
  if (!signatures) return false

  return signatures.some(sig =>
    sig.every((byte, i) => buffer[i] === byte)
  )
}

function getUploadsDir(): string {
  const isElectron = process.env.UPLOADS_PATH !== undefined
  if (isElectron && process.env.UPLOADS_PATH) {
    return path.join(process.env.UPLOADS_PATH, 'members')
  }
  return path.join(process.cwd(), 'public', 'uploads', 'members')
}

function isPathInsideUploads(filepath: string): boolean {
  const resolved = path.resolve(filepath)
  const uploadsRoot = path.resolve(getUploadsDir())
  return resolved.startsWith(uploadsRoot + path.sep) || resolved === uploadsRoot
}

export async function POST(request: Request) {
  try {
    // 🔒 Authentication مطلوبة
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('image') as File | null

    if (!file) {
      return NextResponse.json({ error: 'لم يتم رفع صورة' }, { status: 400 })
    }

    const claimedMime = file.type?.toLowerCase() || ''
    if (!ALLOWED_EXTENSIONS[claimedMime]) {
      return NextResponse.json(
        { error: 'نوع الملف غير مدعوم. استخدم JPG, PNG, أو WebP' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'حجم الصورة كبير جداً. الحد الأقصى 5MB' },
        { status: 400 }
      )
    }

    if (file.size < 10) {
      return NextResponse.json({ error: 'الصورة صغيرة جداً' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // 🔒 Magic bytes check - ما نثقش في file.type لوحده
    if (!verifyMagicBytes(buffer, claimedMime)) {
      return NextResponse.json(
        { error: 'محتوى الملف لا يطابق نوعه المُعلن' },
        { status: 400 }
      )
    }

    const uploadsDir = getUploadsDir()
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // 🔒 اسم ملف عشوائي آمن (بدون أي input من المستخدم)
    const extension = ALLOWED_EXTENSIONS[claimedMime]
    const randomName = crypto.randomBytes(16).toString('hex')
    const timestamp = Date.now()
    const filename = `${timestamp}_${randomName}${extension}`
    const filepath = path.join(uploadsDir, filename)

    // تأكيد إضافي: المسار النهائي جوه الـ uploads folder
    if (!isPathInsideUploads(filepath)) {
      return NextResponse.json({ error: 'مسار غير صحيح' }, { status: 400 })
    }

    await writeFile(filepath, buffer)

    const isElectron = process.env.UPLOADS_PATH !== undefined
    const imageUrl = isElectron
      ? `/api/serve-image?path=${encodeURIComponent(filepath)}`
      : `/uploads/members/${filename}`

    return NextResponse.json({
      success: true,
      imageUrl,
      message: 'تم رفع الصورة بنجاح'
    })

  } catch (error) {
    console.error('خطأ في رفع الصورة:', error)
    return NextResponse.json({ error: 'فشل رفع الصورة' }, { status: 500 })
  }
}

// حذف صورة
export async function DELETE(request: Request) {
  try {
    // 🔒 Authentication مطلوبة
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get('url')

    if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.length > 500) {
      return NextResponse.json({ error: 'لم يتم تحديد الصورة' }, { status: 400 })
    }

    let filepath: string

    if (imageUrl.startsWith('/api/serve-image?path=')) {
      const urlObj = new URL(imageUrl, 'http://localhost')
      filepath = urlObj.searchParams.get('path') || ''
    } else if (imageUrl.startsWith('/uploads/members/')) {
      const filename = path.basename(imageUrl)
      // 🔒 منع path traversal: لازم الـ filename يبقى فقط اسم ملف بدون /
      if (filename !== imageUrl.replace('/uploads/members/', '')) {
        return NextResponse.json({ error: 'مسار غير صحيح' }, { status: 400 })
      }
      filepath = path.join(getUploadsDir(), filename)
    } else {
      return NextResponse.json({ error: 'مسار غير مسموح به' }, { status: 400 })
    }

    // 🔒 تأكيد إن الملف جوه الـ uploads folder (منع path traversal)
    if (!isPathInsideUploads(filepath)) {
      return NextResponse.json({ error: 'مسار خارج النطاق المسموح' }, { status: 403 })
    }

    if (existsSync(filepath)) {
      await unlink(filepath)
    }

    return NextResponse.json({
      success: true,
      message: 'تم حذف الصورة بنجاح'
    })

  } catch (error) {
    console.error('خطأ في حذف الصورة:', error)
    return NextResponse.json({ error: 'فشل حذف الصورة' }, { status: 500 })
  }
}

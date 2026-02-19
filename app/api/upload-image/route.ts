// app/api/upload-image/route.ts
import { NextResponse } from 'next/server'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'


export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('image') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'لم يتم رفع صورة' },
        { status: 400 }
      )
    }

    // التحقق من نوع الملف
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'نوع الملف غير مدعوم. استخدم JPG, PNG, أو WebP' },
        { status: 400 }
      )
    }

    // التحقق من حجم الملف (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'حجم الصورة كبير جداً. الحد الأقصى 5MB' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // إنشاء مجلد uploads إذا لم يكن موجوداً
    // في Electron، نستخدم UPLOADS_PATH من userData لتجنب مشاكل الصلاحيات
    const isElectron = process.env.UPLOADS_PATH !== undefined
    let uploadsDir: string

    if (isElectron && process.env.UPLOADS_PATH) {
      // في Electron: استخدام مسار userData/uploads
      uploadsDir = path.join(process.env.UPLOADS_PATH, 'members')
    } else {
      // في Web: استخدام public/uploads
      uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'members')
    }

    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // إنشاء اسم فريد للملف
    const timestamp = Date.now()
    const originalName = file.name.replace(/[^a-zA-Z0-9.]/g, '_')
    const filename = `${timestamp}_${originalName}`
    const filepath = path.join(uploadsDir, filename)

    // حفظ الملف
    await writeFile(filepath, buffer)

    // إرجاع المسار المناسب
    // في Electron: نستخدم API route لخدمة الصورة من userData
    // في Web: نرجع المسار النسبي /uploads/members/...
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
    return NextResponse.json(
      { error: 'فشل رفع الصورة' },
      { status: 500 }
    )
  }
}

// حذف صورة
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get('url')

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'لم يتم تحديد الصورة' },
        { status: 400 }
      )
    }

    // التحقق إذا كان المسار من Electron API route
    let filepath: string
    if (imageUrl.startsWith('/api/serve-image?path=')) {
      // استخراج المسار الحقيقي من query parameter
      const urlObj = new URL(imageUrl, 'http://localhost')
      filepath = urlObj.searchParams.get('path') || ''
    } else {
      // مسار عادي من public
      filepath = path.join(process.cwd(), 'public', imageUrl)
    }

    if (filepath && existsSync(filepath)) {
      await unlink(filepath)
    }

    return NextResponse.json({ 
      success: true,
      message: 'تم حذف الصورة بنجاح'
    })

  } catch (error) {
    console.error('خطأ في حذف الصورة:', error)
    return NextResponse.json(
      { error: 'فشل حذف الصورة' },
      { status: 500 }
    )
  }
}
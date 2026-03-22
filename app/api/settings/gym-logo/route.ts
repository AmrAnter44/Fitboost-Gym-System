import { NextResponse } from 'next/server'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'
import { apiCache } from '../../../../lib/cache'

export const dynamic = 'force-dynamic'

// POST - رفع لوجو الجيم (OWNER فقط)
export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user || user.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'هذه الميزة متاحة لمالك النظام فقط' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('logo') as File

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

    // حفظ في مجلد uploads
    const isElectron = process.env.UPLOADS_PATH !== undefined
    let uploadsDir: string

    if (isElectron && process.env.UPLOADS_PATH) {
      uploadsDir = process.env.UPLOADS_PATH
    } else {
      uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    }

    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // حذف اللوجو القديم إذا وُجد
    const currentSettings = await prisma.systemSettings.findUnique({
      where: { id: 'singleton' }
    })
    if (currentSettings?.gymLogo) {
      const oldPath = isElectron
        ? currentSettings.gymLogo.replace('/api/serve-image?path=', '')
        : path.join(process.cwd(), 'public', currentSettings.gymLogo)
      if (existsSync(oldPath)) {
        await unlink(oldPath).catch(() => {})
      }
    }

    // حفظ الملف بإسم ثابت
    const ext = file.name.split('.').pop() || 'png'
    const filename = `gym-logo.${ext}`
    const filepath = path.join(uploadsDir, filename)
    await writeFile(filepath, buffer)

    // إرجاع المسار المناسب
    const logoUrl = isElectron
      ? `/api/serve-image?path=${encodeURIComponent(filepath)}`
      : `/uploads/${filename}`

    // تحديث قاعدة البيانات
    await prisma.systemSettings.upsert({
      where: { id: 'singleton' },
      update: { gymLogo: logoUrl },
      create: { id: 'singleton', gymLogo: logoUrl }
    })

    // مسح الكاش
    apiCache.delete('public:settings')

    return NextResponse.json({
      success: true,
      logoUrl,
      message: 'تم رفع اللوجو بنجاح'
    })
  } catch (error) {
    console.error('خطأ في رفع اللوجو:', error)
    return NextResponse.json(
      { error: 'فشل رفع اللوجو' },
      { status: 500 }
    )
  }
}

// DELETE - حذف لوجو الجيم (OWNER فقط)
export async function DELETE(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user || user.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'هذه الميزة متاحة لمالك النظام فقط' },
        { status: 403 }
      )
    }

    const currentSettings = await prisma.systemSettings.findUnique({
      where: { id: 'singleton' }
    })

    if (currentSettings?.gymLogo) {
      const isElectron = process.env.UPLOADS_PATH !== undefined
      const filePath = isElectron
        ? decodeURIComponent(currentSettings.gymLogo.replace('/api/serve-image?path=', ''))
        : path.join(process.cwd(), 'public', currentSettings.gymLogo)

      if (existsSync(filePath)) {
        await unlink(filePath).catch(() => {})
      }
    }

    // مسح اللوجو من قاعدة البيانات
    await prisma.systemSettings.update({
      where: { id: 'singleton' },
      data: { gymLogo: null }
    })

    // مسح الكاش
    apiCache.delete('public:settings')

    return NextResponse.json({
      success: true,
      message: 'تم حذف اللوجو بنجاح'
    })
  } catch (error) {
    console.error('خطأ في حذف اللوجو:', error)
    return NextResponse.json(
      { error: 'فشل حذف اللوجو' },
      { status: 500 }
    )
  }
}

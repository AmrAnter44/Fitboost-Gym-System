// app/api/serve-image/route.ts
// خدمة الصور من مسار userData في Electron
import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

// حل المسار الفعلي للصورة - يدور في أكتر من مكان
function resolveImagePath(imagePath: string): string | null {
  // 1. لو المسار absolute وموجود → استخدمه مباشرة
  if (path.isAbsolute(imagePath) && existsSync(imagePath)) {
    return imagePath
  }

  // 2. لو المسار نسبي (مثل /uploads/members/1.jpg) → دور عليه
  const relativePath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath

  // محاولة 1: مسار Electron userData (UPLOADS_PATH)
  if (process.env.UPLOADS_PATH) {
    // UPLOADS_PATH = userData/uploads → نحتاج ننزل لـ members/file
    const uploadsBase = process.env.UPLOADS_PATH
    const filename = path.basename(relativePath)
    const subdir = path.basename(path.dirname(relativePath)) // members, etc
    const electronPath = path.join(uploadsBase, subdir, filename)
    if (existsSync(electronPath)) return electronPath

    // محاولة مباشرة بالمسار النسبي من uploads
    const directPath = path.join(uploadsBase, relativePath.replace(/^uploads\//, ''))
    if (existsSync(directPath)) return directPath
  }

  // محاولة 2: مجلد public
  const publicPath = path.join(process.cwd(), 'public', relativePath)
  if (existsSync(publicPath)) return publicPath

  // محاولة 3: من root المشروع
  const rootPath = path.join(process.cwd(), relativePath)
  if (existsSync(rootPath)) return rootPath

  return null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const imagePath = searchParams.get('path')

    if (!imagePath) {
      return NextResponse.json(
        { error: 'مسار الصورة مطلوب' },
        { status: 400 }
      )
    }

    // التحقق من أن الصورة في مسار uploads فقط (أمان)
    if (!imagePath.includes('uploads')) {
      return NextResponse.json(
        { error: 'مسار غير صالح' },
        { status: 400 }
      )
    }

    // حل المسار الفعلي
    const resolvedPath = resolveImagePath(imagePath)

    if (!resolvedPath) {
      // بدلاً من إرجاع 404، نرجع صورة شفافة 1x1 pixel
      // عشان ما يطلعش error في الـ console
      const transparentPixel = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64'
      )

      return new NextResponse(transparentPixel, {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-cache',
        }
      })
    }

    // قراءة الملف
    const imageBuffer = await readFile(resolvedPath)

    // تحديد نوع الملف من الامتداد
    const ext = path.extname(resolvedPath).toLowerCase()
    const contentTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif'
    }
    const contentType = contentTypes[ext] || 'application/octet-stream'

    // إرجاع الصورة
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000', // cache لمدة سنة
      }
    })

  } catch (error) {
    // بدلاً من إرجاع error، نرجع صورة شفافة (silent failure)
    const transparentPixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    )

    return new NextResponse(transparentPixel, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache',
      }
    })
  }
}

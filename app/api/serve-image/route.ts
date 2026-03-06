// app/api/serve-image/route.ts
// خدمة الصور من مسار userData في Electron
import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

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

    // التحقق من وجود الملف
    if (!existsSync(imagePath)) {
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
    const imageBuffer = await readFile(imagePath)

    // تحديد نوع الملف من الامتداد
    const ext = path.extname(imagePath).toLowerCase()
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

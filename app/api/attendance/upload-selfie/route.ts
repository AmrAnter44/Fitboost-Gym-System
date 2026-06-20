// app/api/attendance/upload-selfie/route.ts
//  رفع صورة السكان (selfie) للحماية ضد buddy-punching
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import {
  getStaffCheckinUploadsDir,
  STAFF_CHECKIN_UPLOADS_URL_PREFIX,
} from '../../../../lib/uploadsPath'

export const dynamic = 'force-dynamic'

//  POST: يقبل { attendanceId, image (base64 data URL) }، يحفظ الملف، ويـ update السجل
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { attendanceId, image } = body as { attendanceId?: string; image?: string }

    if (!attendanceId || typeof attendanceId !== 'string') {
      return NextResponse.json({ error: 'attendanceId مطلوب' }, { status: 400 })
    }

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'الصورة مطلوبة' }, { status: 400 })
    }

    //  Parse base64 data URL — مثال: data:image/jpeg;base64,/9j/4AAQ...
    const match = image.match(/^data:(image\/(jpeg|jpg|png|webp));base64,(.+)$/)
    if (!match) {
      return NextResponse.json({ error: 'صيغة الصورة غير مدعومة' }, { status: 400 })
    }
    const mime = match[1]
    const ext = mime === 'image/png' ? '.png' : mime === 'image/webp' ? '.webp' : '.jpg'
    const base64Data = match[3]
    const buffer = Buffer.from(base64Data, 'base64')

    //  حد أقصى 2MB للصورة (الـ camera modal بيـ compress قبل ما يرسل)
    if (buffer.length > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'حجم الصورة كبير جداً' }, { status: 400 })
    }
    if (buffer.length < 1024) {
      return NextResponse.json({ error: 'حجم الصورة صغير جداً' }, { status: 400 })
    }

    //  تأكد إن الـ attendance موجود
    const att = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      select: { id: true, staffId: true, selfieImage: true },
    })
    if (!att) {
      return NextResponse.json({ error: 'سجل الحضور غير موجود' }, { status: 404 })
    }

    //  اكتب الملف
    const uploadsDir = getStaffCheckinUploadsDir()
    await mkdir(uploadsDir, { recursive: true })

    const filename = `${att.staffId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`
    const filepath = path.join(uploadsDir, filename)
    await writeFile(filepath, buffer)

    const imageUrl = `${STAFF_CHECKIN_UPLOADS_URL_PREFIX}${filename}`

    //  حدّث الـ Attendance
    await prisma.attendance.update({
      where: { id: attendanceId },
      data: { selfieImage: imageUrl },
    })

    return NextResponse.json({ success: true, selfieImage: imageUrl })
  } catch (error: any) {
    console.error('Error uploading selfie:', error)
    return NextResponse.json(
      { error: 'فشل حفظ الصورة', detail: error?.message },
      { status: 500 }
    )
  }
}

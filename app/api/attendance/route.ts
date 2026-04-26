import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'

// GET - جلب سجلات الحضور

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    let whereClause: any = {}

    if (staffId) {
      whereClause.staffId = staffId
    }

    // فلترة حسب التاريخ
    if (dateFrom) {
      const fromDate = new Date(dateFrom)
      if (!isNaN(fromDate.getTime())) {
        fromDate.setHours(0, 0, 0, 0)
        whereClause.checkIn = { gte: fromDate }
      }
    }

    if (dateTo) {
      const toDate = new Date(dateTo)
      if (!isNaN(toDate.getTime())) {
        toDate.setHours(23, 59, 59, 999)
        whereClause.checkIn = {
          ...whereClause.checkIn,
          lte: toDate,
        }
      }
    }

    const attendance = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        staff: true,
      },
      orderBy: { checkIn: 'desc' },
    })

    return NextResponse.json(attendance)
  } catch (error) {
    console.error('Error fetching attendance:', error)
    return NextResponse.json({ error: 'فشل جلب سجلات الحضور' }, { status: 500 })
  }
}

// POST - تسجيل حضور وانصراف (Toggle)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { staffCode } = body

    if (!staffCode) {
      return NextResponse.json({ error: 'رقم الموظف مطلوب' }, { status: 400 })
    }

    // البحث عن الموظف بالرقم
    const staff = await prisma.staff.findUnique({
      where: { staffCode: staffCode },
    })

    if (!staff) {
      return NextResponse.json(
        {
          error: `❌ الموظف رقم ${staffCode} غير موجود`,
          action: 'error',
        },
        { status: 404 }
      )
    }

    if (!staff.isActive) {
      return NextResponse.json(
        {
          error: `❌ الموظف ${staff.name} غير نشط`,
          action: 'error',
        },
        { status: 400 }
      )
    }

    const now = new Date()

    // البحث عن سجل حضور نشط (لم يتم تسجيل انصراف له)
    const activeRecord = await prisma.attendance.findFirst({
      where: {
        staffId: staff.id,
        checkOut: null,
      },
      orderBy: {
        checkIn: 'desc',
      },
    })

    // حساب الفرق بالساعات إذا كان هناك سجل نشط
    if (activeRecord) {
      const hoursSinceCheckIn = (now.getTime() - activeRecord.checkIn.getTime()) / (1000 * 60 * 60)

      // إذا كان السجل النشط خلال آخر 12 ساعة -> تسجيل انصراف
      if (hoursSinceCheckIn <= 12) {
        const durationMinutes = Math.round((now.getTime() - activeRecord.checkIn.getTime()) / (1000 * 60))

        const updatedAttendance = await prisma.attendance.update({
          where: { id: activeRecord.id },
          data: {
            checkOut: now,
            duration: durationMinutes,
          },
          include: {
            staff: true,
          },
        })

        // تنسيق مدة العمل
        const hours = Math.floor(durationMinutes / 60)
        const minutes = durationMinutes % 60
        const durationText = hours > 0 ? `${hours} ساعة و ${minutes} دقيقة` : `${minutes} دقيقة`

        return NextResponse.json({
          action: 'check-out',
          message: `👋 مع السلامة ${staff.name}!\nمدة العمل: ${durationText}`,
          staffCode: staff.staffCode,
          staffName: staff.name,
          attendance: updatedAttendance,
          duration: durationMinutes,
          durationText,
        })
      }
      // إذا كان السجل أكبر من 12 ساعة -> اعتباره سجل قديم وإنشاء سجل جديد
      // (لا نحدثه، بل نتركه كما هو ونفتح سجل جديد)
    }

    // التحقق من آخر سجل انصراف (حتى لو تم تسجيل الانصراف)
    const lastCheckOut = await prisma.attendance.findFirst({
      where: {
        staffId: staff.id,
        checkOut: { not: null },
      },
      orderBy: {
        checkOut: 'desc',
      },
    })

    // إذا كان هناك انصراف خلال آخر دقيقة، منع تسجيل حضور جديد (منع الـ accidental double-scan)
    if (lastCheckOut && lastCheckOut.checkOut) {
      const minutesSinceCheckOut = (now.getTime() - lastCheckOut.checkOut.getTime()) / (1000 * 60)

      if (minutesSinceCheckOut < 1) {
        const remainingSeconds = Math.ceil(60 - (minutesSinceCheckOut * 60))
        return NextResponse.json(
          {
            error: `⏳ يجب الانتظار ${remainingSeconds} ثانية قبل تسجيل حضور جديد`,
            action: 'error',
            remainingSeconds,
          },
          { status: 400 }
        )
      }
    }

    // إنشاء سجل حضور جديد
    const newAttendance = await prisma.attendance.create({
      data: {
        staffId: staff.id,
        checkIn: now,
      },
      include: {
        staff: true,
      },
    })

    return NextResponse.json({
      action: 'check-in',
      message: `✅ مرحباً ${staff.name}! تم تسجيل حضورك`,
      staffCode: staff.staffCode,
      staffName: staff.name,
      attendance: newAttendance,
    })
  } catch (error: any) {
    console.error('Error recording attendance:', error)

    return NextResponse.json(
      { error: 'فشل تسجيل الحضور', action: 'error' },
      { status: 500 }
    )
  }
}

// DELETE - حذف سجل حضور (يتطلب صلاحيات Admin)
export async function DELETE(request: Request) {
  try {
    // ✅ التحقق من الصلاحية - فقط Admin يقدر يحذف سجلات الحضور
    const { requireAdmin } = await import('../../../lib/auth')
    await requireAdmin(request)

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'معرف السجل مطلوب' }, { status: 400 })
    }

    // ✅ التحقق من وجود السجل قبل الحذف
    const record = await prisma.attendance.findUnique({ where: { id } })
    if (!record) {
      return NextResponse.json({ error: 'السجل غير موجود' }, { status: 404 })
    }

    await prisma.attendance.delete({ where: { id } })
    return NextResponse.json({ message: 'تم حذف السجل بنجاح' })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية حذف سجلات الحضور' }, { status: 403 })
    }
    console.error('Error deleting attendance:', error)
    return NextResponse.json({ error: 'فشل حذف السجل' }, { status: 500 })
  }
}

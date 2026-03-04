import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { requirePermission } from '../../../../../lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // 1. التحقق من الصلاحيات
    const user = await requirePermission(request, 'canEditMembers')

    // 2. جلب البيانات
    const { memberId, serviceType, staffId, notes } = await request.json()

    // 3. Validation
    if (!memberId || !serviceType || !staffId) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
    }

    // 4. جلب بيانات العضو
    const member = await prisma.member.findUnique({
      where: { id: memberId }
    })

    if (!member || !member.isActive) {
      return NextResponse.json({ error: 'العضو غير موجود أو غير نشط' }, { status: 404 })
    }

    // 5. جلب بيانات الموظف
    const staff = await prisma.staff.findUnique({
      where: { id: staffId }
    })

    if (!staff || !staff.isActive) {
      return NextResponse.json({ error: 'الموظف غير موجود أو غير نشط' }, { status: 404 })
    }

    // 6. التحقق من الرصيد والخصم حسب نوع الخدمة
    let updateField: string
    let currentValue: number
    let sessionModel: any
    let sessionData: any
    let serviceName: string

    switch (serviceType) {
      case 'PT':
        currentValue = member.freePTSessions
        if (currentValue <= 0) {
          return NextResponse.json({ error: 'لا توجد جلسات PT مجانية' }, { status: 400 })
        }
        updateField = 'freePTSessions'
        sessionModel = prisma.pTSession
        sessionData = {
          ptNumber: 0, // Free session - no PT subscription
          clientName: member.name,
          coachName: staff.name,
          sessionDate: new Date(),
          attended: true,
          attendedAt: new Date(),
          attendedBy: staff.name,
          notes: notes || `جلسة PT مجانية`,
          isFreeSession: true,
          memberId: member.id
        }
        serviceName = 'PT'
        break

      case 'Nutrition':
        currentValue = member.freeNutritionSessions
        if (currentValue <= 0) {
          return NextResponse.json({ error: 'لا توجد جلسات تغذية مجانية' }, { status: 400 })
        }
        updateField = 'freeNutritionSessions'
        sessionModel = prisma.nutritionSession
        sessionData = {
          nutritionNumber: 0,
          clientName: member.name,
          nutritionistName: staff.name,
          sessionDate: new Date(),
          attended: true,
          attendedAt: new Date(),
          attendedBy: staff.name,
          notes: notes || `جلسة تغذية مجانية`,
          isFreeSession: true,
          memberId: member.id
        }
        serviceName = 'تغذية'
        break

      case 'Physiotherapy':
        currentValue = member.freePhysioSessions
        if (currentValue <= 0) {
          return NextResponse.json({ error: 'لا توجد جلسات علاج طبيعي مجانية' }, { status: 400 })
        }
        updateField = 'freePhysioSessions'
        sessionModel = prisma.physiotherapySession
        sessionData = {
          physioNumber: 0,
          clientName: member.name,
          therapistName: staff.name,
          sessionDate: new Date(),
          attended: true,
          attendedAt: new Date(),
          attendedBy: staff.name,
          notes: notes || `جلسة علاج طبيعي مجانية`,
          isFreeSession: true,
          memberId: member.id
        }
        serviceName = 'علاج طبيعي'
        break

      case 'GroupClass':
        currentValue = member.freeGroupClassSessions
        if (currentValue <= 0) {
          return NextResponse.json({ error: 'لا توجد جلسات جروب كلاسيس مجانية' }, { status: 400 })
        }
        updateField = 'freeGroupClassSessions'
        sessionModel = prisma.groupClassSession
        sessionData = {
          classNumber: 0,
          clientName: member.name,
          instructorName: staff.name,
          sessionDate: new Date(),
          attended: true,
          attendedAt: new Date(),
          attendedBy: staff.name,
          notes: notes || `جلسة جروب كلاسيس مجانية`,
          isFreeSession: true,
          memberId: member.id
        }
        serviceName = 'جروب كلاسيس'
        break

      default:
        return NextResponse.json({ error: 'نوع خدمة غير صحيح' }, { status: 400 })
    }

    // 7. تنفيذ Transaction (خصم + إنشاء سجل)
    const [updatedMember, session] = await prisma.$transaction([
      prisma.member.update({
        where: { id: memberId },
        data: { [updateField]: currentValue - 1 }
      }),
      sessionModel.create({ data: sessionData })
    ])

    // 8. إرجاع النجاح
    return NextResponse.json({
      success: true,
      message: `تم تسجيل جلسة ${serviceName} مجانية مع ${staff.name}`,
      session: {
        id: session.id,
        sessionDate: session.sessionDate,
        attendedBy: session.attendedBy
      },
      remainingFree: currentValue - 1
    })

  } catch (error: any) {
    console.error('Error registering free session:', error)
    return NextResponse.json({ error: 'فشل تسجيل الجلسة' }, { status: 500 })
  }
}

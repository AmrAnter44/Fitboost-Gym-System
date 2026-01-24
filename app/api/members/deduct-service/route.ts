import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'


export async function POST(request: Request) {
  try {
    // التحقق من تسجيل الدخول
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const body = await request.json()
    const { memberId, serviceType } = body

    if (!memberId || !serviceType) {
      return NextResponse.json({ error: 'بيانات غير كاملة' }, { status: 400 })
    }

    // التحقق من نوع الخدمة
    if (!['invitation', 'freePT', 'inBody'].includes(serviceType)) {
      return NextResponse.json({ error: 'نوع خدمة غير صحيح' }, { status: 400 })
    }

    // جلب بيانات العضو
    const member = await prisma.member.findUnique({
      where: { id: memberId }
    })

    if (!member) {
      return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })
    }

    // التحقق من أن العضو نشط
    if (!member.isActive) {
      return NextResponse.json({ error: 'العضو غير نشط' }, { status: 400 })
    }

    // تحديد الحقل المراد تحديثه
    let updateData: any = {}
    let serviceName = ''
    let currentValue = 0

    switch (serviceType) {
      case 'invitation':
        currentValue = member.invitations
        serviceName = 'دعوة'
        if (currentValue <= 0) {
          return NextResponse.json({ error: 'لا توجد دعوات متبقية' }, { status: 400 })
        }
        updateData = { invitations: currentValue - 1 }
        break

      case 'freePT':
        currentValue = member.freePTSessions
        serviceName = 'جلسة PT مجانية'
        if (currentValue <= 0) {
          return NextResponse.json({ error: 'لا توجد جلسات PT مجانية متبقية' }, { status: 400 })
        }
        updateData = { freePTSessions: currentValue - 1 }
        break

      case 'inBody':
        currentValue = member.inBodyScans
        serviceName = 'InBody'
        if (currentValue <= 0) {
          return NextResponse.json({ error: 'لا توجد InBody متبقية' }, { status: 400 })
        }
        updateData = { inBodyScans: currentValue - 1 }
        break
    }

    // تحديث بيانات العضو
    await prisma.member.update({
      where: { id: memberId },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      message: `تم خصم ${serviceName} بنجاح`,
      newValue: currentValue - 1
    })

  } catch (error) {
    console.error('Error deducting service:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء الخصم' }, { status: 500 })
  }
}

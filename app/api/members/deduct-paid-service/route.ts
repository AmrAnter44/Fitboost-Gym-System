import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

// POST - خصم جلسة مدفوعة من اشتراك نشط
export async function POST(request: Request) {
  try {
    // التحقق من صلاحية تعديل الأعضاء
    await requirePermission(request, 'canEditMembers')

    const body = await request.json()
    const { memberId, serviceType } = body


    if (!memberId || !serviceType) {
      return NextResponse.json(
        { error: 'معرف العضو ونوع الخدمة مطلوبان' },
        { status: 400 }
      )
    }

    // التحقق من نوع الخدمة
    const validTypes = ['paidPT', 'paidNutrition', 'paidPhysio', 'paidGroupClass']
    if (!validTypes.includes(serviceType)) {
      return NextResponse.json(
        { error: 'نوع خدمة غير صحيح' },
        { status: 400 }
      )
    }

    // جلب بيانات العضو
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, phone: true, name: true, isActive: true }
    })

    if (!member) {
      return NextResponse.json(
        { error: 'العضو غير موجود' },
        { status: 404 }
      )
    }

    if (!member.isActive) {
      return NextResponse.json(
        { error: 'العضو غير نشط' },
        { status: 400 }
      )
    }

    // خصم الجلسة حسب نوع الخدمة
    let serviceName = ''
    let deductResult = null

    switch (serviceType) {
      case 'paidPT':
        serviceName = 'PT'
        deductResult = await deductFromPTSubscription(member.phone)
        break
      case 'paidNutrition':
        serviceName = 'التغذية'
        deductResult = await deductFromNutritionSubscription(member.phone)
        break
      case 'paidPhysio':
        serviceName = 'العلاج الطبيعي'
        deductResult = await deductFromPhysioSubscription(member.phone)
        break
      case 'paidGroupClass':
        serviceName = 'جروب كلاسيس'
        deductResult = await deductFromGroupClassSubscription(member.phone)
        break
    }

    if (!deductResult.success) {
      return NextResponse.json(
        { error: deductResult.error },
        { status: 400 }
      )
    }


    return NextResponse.json({
      success: true,
      message: `تم خصم جلسة ${serviceName} مدفوعة بنجاح`,
      remainingSessions: deductResult.remainingSessions,
      subscriptionNumber: deductResult.subscriptionNumber
    })

  } catch (error: any) {
    console.error('❌ Error deducting paid service:', error)

    // التعامل مع أخطاء الصلاحيات
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تعديل الأعضاء' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'حدث خطأ أثناء خصم الجلسة' },
      { status: 500 }
    )
  }
}

// ===== دوال مساعدة للخصم من كل خدمة =====

/**
 * خصم جلسة من أقدم اشتراك PT نشط (FIFO)
 */
async function deductFromPTSubscription(phone: string) {
  // البحث عن كل اشتراكات PT النشطة
  const activePTs = await prisma.pT.findMany({
    where: {
      phone: phone,
      sessionsRemaining: { gt: 0 },
      OR: [
        { expiryDate: null },
        { expiryDate: { gt: new Date() } }
      ]
    },
    orderBy: { createdAt: 'asc' } // أقدم أولاً (FIFO)
  })

  if (activePTs.length === 0) {
    return {
      success: false,
      error: 'لا توجد جلسات PT مدفوعة نشطة متبقية'
    }
  }

  // الخصم من أقدم اشتراك
  const targetPT = activePTs[0]

  const updated = await prisma.pT.update({
    where: { ptNumber: targetPT.ptNumber },
    data: { sessionsRemaining: targetPT.sessionsRemaining - 1 }
  })

  return {
    success: true,
    remainingSessions: updated.sessionsRemaining,
    subscriptionNumber: updated.ptNumber
  }
}

/**
 * خصم جلسة من أقدم اشتراك تغذية نشط (FIFO)
 */
async function deductFromNutritionSubscription(phone: string) {
  const activeNutrition = await prisma.nutrition.findMany({
    where: {
      phone: phone,
      sessionsRemaining: { gt: 0 },
      OR: [
        { expiryDate: null },
        { expiryDate: { gt: new Date() } }
      ]
    },
    orderBy: { createdAt: 'asc' }
  })

  if (activeNutrition.length === 0) {
    return {
      success: false,
      error: 'لا توجد جلسات تغذية مدفوعة نشطة متبقية'
    }
  }

  const target = activeNutrition[0]

  const updated = await prisma.nutrition.update({
    where: { nutritionNumber: target.nutritionNumber },
    data: { sessionsRemaining: target.sessionsRemaining - 1 }
  })

  return {
    success: true,
    remainingSessions: updated.sessionsRemaining,
    subscriptionNumber: updated.nutritionNumber
  }
}

/**
 * خصم جلسة من أقدم اشتراك علاج طبيعي نشط (FIFO)
 */
async function deductFromPhysioSubscription(phone: string) {
  const activePhysio = await prisma.physiotherapy.findMany({
    where: {
      phone: phone,
      sessionsRemaining: { gt: 0 },
      OR: [
        { expiryDate: null },
        { expiryDate: { gt: new Date() } }
      ]
    },
    orderBy: { createdAt: 'asc' }
  })

  if (activePhysio.length === 0) {
    return {
      success: false,
      error: 'لا توجد جلسات علاج طبيعي مدفوعة نشطة متبقية'
    }
  }

  const target = activePhysio[0]

  const updated = await prisma.physiotherapy.update({
    where: { physioNumber: target.physioNumber },
    data: { sessionsRemaining: target.sessionsRemaining - 1 }
  })

  return {
    success: true,
    remainingSessions: updated.sessionsRemaining,
    subscriptionNumber: updated.physioNumber
  }
}

/**
 * خصم جلسة من أقدم اشتراك جروب كلاسيس نشط (FIFO)
 */
async function deductFromGroupClassSubscription(phone: string) {
  const activeClasses = await prisma.groupClass.findMany({
    where: {
      phone: phone,
      sessionsRemaining: { gt: 0 },
      OR: [
        { expiryDate: null },
        { expiryDate: { gt: new Date() } }
      ]
    },
    orderBy: { createdAt: 'asc' }
  })

  if (activeClasses.length === 0) {
    return {
      success: false,
      error: 'لا توجد جلسات جروب كلاسيس مدفوعة نشطة متبقية'
    }
  }

  const target = activeClasses[0]

  const updated = await prisma.groupClass.update({
    where: { classNumber: target.classNumber },
    data: { sessionsRemaining: target.sessionsRemaining - 1 }
  })

  return {
    success: true,
    remainingSessions: updated.sessionsRemaining,
    subscriptionNumber: updated.classNumber
  }
}

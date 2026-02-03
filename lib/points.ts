import { prisma } from './prisma'

export async function addPoints(
  memberId: string,
  points: number,
  action: 'check-in' | 'invitation' | 'payment',
  description?: string,
  tx?: any
) {
  try {
    const db = tx || prisma

    // تحديث نقاط العضو
    await db.member.update({
      where: { id: memberId },
      data: {
        points: {
          increment: points
        }
      }
    })

    // إضافة سجل في تاريخ النقاط
    await db.pointsHistory.create({
      data: {
        memberId,
        points,
        action,
        description: description || `حصل على ${points} نقطة من ${action === 'check-in' ? 'تسجيل الحضور' : action === 'invitation' ? 'استخدام دعوة' : 'الدفع'}`
      }
    })

    return true
  } catch (error) {
    console.error('Error adding points:', error)
    return false
  }
}

/**
 * خصم نقاط من عضو
 * @param memberId - معرف العضو
 * @param points - عدد النقاط المراد خصمها
 * @param description - وصف العملية
 * @param tx - Transaction client (optional)
 * @returns نتيجة العملية
 */
export async function deductPoints(
  memberId: string,
  points: number,
  description: string,
  tx?: any
): Promise<{ success: boolean; currentBalance?: number; message?: string }> {
  try {
    const db = tx || prisma

    // جلب رصيد العضو الحالي
    const member = await db.member.findUnique({
      where: { id: memberId },
      select: { points: true }
    })

    if (!member) {
      return { success: false, message: 'العضو غير موجود' }
    }

    const currentBalance = member.points || 0

    // التحقق من أن الرصيد كافٍ
    if (currentBalance < points) {
      return {
        success: false,
        currentBalance,
        message: `رصيد النقاط غير كافٍ (المتاح: ${currentBalance}، المطلوب: ${points})`
      }
    }

    // خصم النقاط
    await db.member.update({
      where: { id: memberId },
      data: {
        points: {
          decrement: points
        }
      }
    })

    // تسجيل العملية في السجل (بقيمة سالبة)
    await db.pointsHistory.create({
      data: {
        memberId,
        points: -points,  // سالب للدلالة على الخصم
        action: 'payment',
        description
      }
    })

    return { success: true, currentBalance: currentBalance - points }
  } catch (error) {
    console.error('Error deducting points:', error)
    return { success: false, message: 'حدث خطأ أثناء خصم النقاط' }
  }
}

export async function getPointsHistory(memberId: string, limit = 10) {
  try {
    const history = await prisma.pointsHistory.findMany({
      where: { memberId },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return history
  } catch (error) {
    console.error('Error fetching points history:', error)
    return []
  }
}

export async function getMemberPoints(memberId: string) {
  try {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { points: true }
    })

    return member?.points || 0
  } catch (error) {
    console.error('Error fetching member points:', error)
    return 0
  }
}

/**
 * إضافة نقاط بناءً على المبلغ المدفوع
 * @param memberId - معرف العضو
 * @param amountPaid - المبلغ المدفوع بالجنيه
 * @param description - وصف العملية
 * @param tx - Transaction client (optional)
 * @returns نتيجة العملية
 */
export async function addPointsForPayment(
  memberId: string,
  amountPaid: number,
  description: string,
  tx?: any
): Promise<{ success: boolean; pointsEarned?: number; message?: string }> {
  try {
    const db = tx || prisma

    // جلب إعدادات النقاط
    const settings = await db.systemSettings.findUnique({
      where: { id: 'singleton' },
      select: {
        pointsEnabled: true,
        pointsPerEGPSpent: true
      }
    })

    // إذا كان نظام النقاط غير مفعل أو القيمة صفر
    if (!settings || !settings.pointsEnabled || settings.pointsPerEGPSpent <= 0) {
      return { success: true, pointsEarned: 0 }
    }

    // حساب النقاط المكتسبة
    const pointsEarned = Math.floor(amountPaid * settings.pointsPerEGPSpent)

    // إذا كانت النقاط المكتسبة صفر
    if (pointsEarned <= 0) {
      return { success: true, pointsEarned: 0 }
    }

    // إضافة النقاط
    const result = await addPoints(
      memberId,
      pointsEarned,
      'payment',
      description,
      tx
    )

    if (result) {
      return { success: true, pointsEarned }
    } else {
      return { success: false, message: 'فشل إضافة النقاط' }
    }
  } catch (error) {
    console.error('Error adding points for payment:', error)
    return { success: false, message: 'حدث خطأ أثناء إضافة النقاط' }
  }
}

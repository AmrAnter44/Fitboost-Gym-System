// app/api/members/upgrade/route.ts - Package Upgrade Endpoint
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import { formatDateYMD } from '../../../../lib/dateFormatter'
import {
  type PaymentMethod,
  validatePaymentDistribution,
  serializePaymentMethods
} from '../../../../lib/paymentHelpers'
import { addPointsForPayment, addPoints } from '../../../../lib/points'
import { getNextReceiptNumberDirect } from '../../../../lib/receiptHelpers'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'
import { logError } from '../../../../lib/errorLogger'

export const dynamic = 'force-dynamic'

// دالة حساب الأيام بين تاريخين
function calculateDaysBetween(date1Str: string | Date, date2Str: string | Date): number {
  const date1 = new Date(date1Str)
  const date2 = new Date(date2Str)
  const diffTime = Math.abs(date2.getTime() - date1.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

// POST - ترقية باكدج العضو
export async function POST(request: Request) {
  try {
    // التحقق من صلاحية إضافة/إنشاء الأعضاء (تشمل التجديد والترقية)
    const user = await requirePermission(request, 'canCreateMembers')

    const body = await request.json()
    const {
      memberId,
      newOfferId,
      paymentMethod,
      staffName,
      remainingAmount = 0,
      remainingDueDate,
      customPrice
    } = body


    // 1. جلب بيانات العضو
    const member = await prisma.member.findUnique({
      where: { id: memberId }
    })

    if (!member) {
      return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })
    }

    // التحقق من الحظر
    {
      const phone = member.phone?.trim() || null
      const nationalId = (member as any).nationalId?.trim() || null
      if (phone || nationalId) {
        const bannedResults = await prisma.$queryRawUnsafe<Array<{id: string}>>(
          `SELECT id FROM BannedMember WHERE (phone IS NOT NULL AND phone = ?) OR (nationalId IS NOT NULL AND nationalId = ?) LIMIT 1`,
          phone, nationalId
        )
        if (bannedResults[0]) {
          return NextResponse.json({ error: 'هذا العضو محظور ولا يمكن ترقية اشتراكه' }, { status: 403 })
        }
      }
    }

    // 2. التحقق من وجود اشتراك نشط
    if (!member.startDate || !member.expiryDate) {
      return NextResponse.json({
        error: 'العضو ليس لديه اشتراك نشط للترقية'
      }, { status: 422 })
    }

    const now = new Date()
    const isExpired = new Date(member.expiryDate) < now

    // 4. جلب بيانات الباكدج الجديد
    const newOffer = await prisma.offer.findUnique({
      where: { id: newOfferId }
    })

    if (!newOffer || !newOffer.isActive) {
      return NextResponse.json({
        error: 'الباكدج غير موجود أو غير نشط'
      }, { status: 404 })
    }

    // ✅ التحقق من صلاحية المستخدم - Admin و Owner لهم صلاحية كاملة بدون قيود
    const isAdminOrOwner = user.role === 'ADMIN' || user.role === 'OWNER'

    // 5. التحقق من تفعيل الترقية للباكدج (إلا للأدمن والأونر)
    if (!isAdminOrOwner && newOffer.upgradeEligibilityDays === null) {
      return NextResponse.json({
        error: 'هذا الباكدج غير قابل للترقية إليه'
      }, { status: 422 })
    }

    // 6. التحقق من فترة الترقية المسموحة (إلا للأدمن والأونر)
    if (!isAdminOrOwner && newOffer.upgradeEligibilityDays !== null) {
      const daysSinceStart = calculateDaysBetween(member.startDate, now)
      if (daysSinceStart > newOffer.upgradeEligibilityDays) {
        return NextResponse.json({
          error: `انتهت فترة الترقية المسموحة. يمكن الترقية خلال ${newOffer.upgradeEligibilityDays} يوم فقط من بداية الاشتراك`
        }, { status: 422 })
      }
    }

    // 7. التحقق من أن السعر الجديد أعلى (إلا للأدمن والأونر)
    if (!isAdminOrOwner && newOffer.price <= member.subscriptionPrice) {
      return NextResponse.json({
        error: 'يمكن الترقية فقط لباكدجات أعلى سعراً من الباكدج الحالي'
      }, { status: 422 })
    }

    // 8. حساب مبلغ الترقية
    // لو فيه customPrice → استخدمه، لو الاشتراك منتهي → السعر كامل، غيره → الفرق
    const effectivePrice = customPrice != null ? customPrice : newOffer.price
    const upgradeAmount = customPrice != null
      ? customPrice
      : isExpired
        ? newOffer.price
        : newOffer.price - member.subscriptionPrice


    // 9. حساب تاريخ النهاية الجديد (من تاريخ البداية الأصلي)
    const newExpiryDate = new Date(member.startDate)
    newExpiryDate.setDate(newExpiryDate.getDate() + newOffer.duration)


    // 10. حفظ بيانات الباكدج القديم للإيصال
    const oldPackageData = {
      oldPackagePrice: member.subscriptionPrice,
      oldFreePTSessions: member.freePTSessions,
      oldNutritionSessions: member.freeNutritionSessions,
      oldPhysioSessions: member.freePhysioSessions,
      oldGroupClassSessions: member.freeGroupClassSessions,
      oldInBodyScans: member.inBodyScans,
      oldInvitations: member.invitations,
      oldFreezeDays: member.remainingFreezeDays,
      oldExpiryDate: formatDateYMD(member.expiryDate)
    }

    // 11. تحديث بيانات العضو (REPLACE الخدمات، ليس ADD)
    const updatedMember = await prisma.member.update({
      where: { id: memberId },
      data: {
        subscriptionPrice: newOffer.price,
        freePTSessions: newOffer.freePTSessions,           // REPLACE
        freeNutritionSessions: newOffer.freeNutritionSessions, // REPLACE
        freePhysioSessions: newOffer.freePhysioSessions,   // REPLACE
        freeGroupClassSessions: newOffer.freeGroupClassSessions, // REPLACE
        inBodyScans: newOffer.inBodyScans,                 // REPLACE
        invitations: newOffer.invitations,                 // REPLACE
        remainingFreezeDays: newOffer.freezeDays,          // REPLACE
        expiryDate: newExpiryDate,
        // startDate يبقى كما هو - لا يتغير
        remainingAmount: remainingAmount || 0,
        remainingDueDate: remainingDueDate ? new Date(remainingDueDate) : null,
        isActive: !newExpiryDate || new Date(newExpiryDate) >= new Date(new Date().setHours(0,0,0,0))
      }
    })


    // 12. الحصول على رقم الإيصال التالي (atomic operation)
    const receiptNumber = await getNextReceiptNumberDirect(prisma)

    // 13. إنشاء تفاصيل الإيصال
    const itemDetails = {
      memberNumber: member.memberNumber,
      memberName: member.name,
      phone: member.phone,

      // بيانات الباكدج القديم
      ...oldPackageData,

      // بيانات الباكدج الجديد
      newPackageName: newOffer.name,
      newPackagePrice: newOffer.price,
      newFreePTSessions: newOffer.freePTSessions,
      newNutritionSessions: newOffer.freeNutritionSessions,
      newPhysioSessions: newOffer.freePhysioSessions,
      newGroupClassSessions: newOffer.freeGroupClassSessions,
      newInBodyScans: newOffer.inBodyScans,
      newInvitations: newOffer.invitations,
      newFreezeDays: newOffer.freezeDays,
      newExpiryDate: formatDateYMD(newExpiryDate),

      // تفاصيل الترقية
      upgradeAmount,
      startDate: formatDateYMD(member.startDate),      // تاريخ البداية لم يتغير
      subscriptionDays: newOffer.duration,
      isUpgrade: true,
      staffName: staffName || 'غير محدد',
      paymentMethod,
      balanceDeducted: remainingAmount || 0,
      paidAmount: upgradeAmount - (remainingAmount || 0),
    }

    // 14. معالجة وسائل الدفع المتعددة
    let finalPaymentMethod: string
    if (Array.isArray(paymentMethod)) {
      const amountToPay = upgradeAmount - (remainingAmount || 0)
      const validation = validatePaymentDistribution(paymentMethod, amountToPay)
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.message || 'توزيع المبالغ غير صحيح' },
          { status: 400 }
        )
      }
      finalPaymentMethod = serializePaymentMethods(paymentMethod)
    } else {
      finalPaymentMethod = paymentMethod || 'cash'
    }

    // 15. إنشاء الإيصال
    const receipt = await prisma.receipt.create({
      data: {
        receiptNumber,
        type: 'ترقية باكدج',
        amount: upgradeAmount - (remainingAmount || 0),
        itemDetails: JSON.stringify(itemDetails),
        paymentMethod: finalPaymentMethod,
        memberId: member.id,
        staffName: staffName || 'غير محدد'
      }
    })

    // إضافة نقاط الترقية إذا كانت محددة في العرض
    if (newOffer.upgradePoints && newOffer.upgradePoints > 0) {
      try {
        await addPoints(
          member.id,
          newOffer.upgradePoints,
          'payment',
          `مكافأة ترقية إلى باقة ${newOffer.name} - ${newOffer.upgradePoints} نقطة`
        )
      } catch (pointsError) {
        console.error('Error adding upgrade points:', pointsError)
        // لا نوقف العملية إذا فشلت إضافة نقاط الترقية
      }
    }

    // إضافة نقاط مكافأة على الدفع
    try {
      const pointsResult = await addPointsForPayment(
        member.id,
        upgradeAmount,
        `مكافأة ترقية باقة - ${member.name}`
      )

      if (pointsResult.pointsEarned && pointsResult.pointsEarned > 0) {
      }
    } catch (pointsError) {
      console.error('Error adding reward points:', pointsError)
      // لا نوقف العملية إذا فشلت إضافة النقاط
    }

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'Member', resourceId: member.id,
      details: { operation: 'Upgrade', memberNumber: member.memberNumber, memberName: member.name, oldPackagePrice: oldPackageData.oldPackagePrice, newPackagePrice: newOffer.price, upgradeAmount, receiptNumber },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    // 16. إرجاع النتيجة
    return NextResponse.json({
      member: updatedMember,
      receipt: {
        receiptNumber,
        amount: upgradeAmount,
        paymentMethod: finalPaymentMethod,
        staffName: staffName || 'غير محدد',
        itemDetails,
        createdAt: receipt.createdAt
      }
    })

  } catch (error: any) {
    console.error('❌ خطأ في ترقية الباكدج:', error)
    logError({ error, endpoint: '/api/members/upgrade', method: 'POST', statusCode: 500 })
    return NextResponse.json({
      error: error.message || 'حدث خطأ أثناء ترقية الباكدج'
    }, { status: 500 })
  }
}

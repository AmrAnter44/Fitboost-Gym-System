// app/api/members/upgrade/route.ts - Package Upgrade Endpoint
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import { formatDateYMD } from '../../../../lib/dateFormatter'
import { requireValidLicense } from '../../../../lib/license'
import {

export const dynamic = 'force-dynamic'

  type PaymentMethod,
  validatePaymentDistribution,
  serializePaymentMethods
} from '../../../../lib/paymentHelpers'

// دالة حساب الأيام بين تاريخين
function calculateDaysBetween(date1Str: string | Date, date2Str: string | Date): number {
  const date1 = new Date(date1Str)
  const date2 = new Date(date2Str)
  const diffTime = Math.abs(date2.getTime() - date1.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

// دالة للبحث عن رقم إيصال متاح
async function getNextAvailableReceiptNumber(startingNumber: number): Promise<number> {
  let currentNumber = startingNumber
  let attempts = 0
  const MAX_ATTEMPTS = 100

  while (attempts < MAX_ATTEMPTS) {
    const existingReceipt = await prisma.receipt.findUnique({
      where: { receiptNumber: currentNumber }
    })

    if (!existingReceipt) {
      console.log(`✅ رقم إيصال متاح: ${currentNumber}`)
      return currentNumber
    }

    console.log(`⚠️ رقم ${currentNumber} موجود، تجربة ${currentNumber + 1}...`)
    currentNumber++
    attempts++
  }

  throw new Error(`فشل إيجاد رقم إيصال متاح بعد ${MAX_ATTEMPTS} محاولة`)
}

// POST - ترقية باكدج العضو
export async function POST(request: Request) {
  try {
    // التحقق من صلاحية تعديل الأعضاء
    await requirePermission(request, 'canEditMembers')

    const body = await request.json()
    const {
      memberId,
      newOfferId,
      paymentMethod,
      staffName
    } = body

    console.log('🚀 ترقية باكدج عضو:', {
      memberId,
      newOfferId,
      paymentMethod,
      staffName
    })

    // 1. جلب بيانات العضو
    const member = await prisma.member.findUnique({
      where: { id: memberId }
    })

    if (!member) {
      return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })
    }

    // 2. التحقق من وجود اشتراك نشط
    if (!member.startDate || !member.expiryDate) {
      return NextResponse.json({
        error: 'العضو ليس لديه اشتراك نشط للترقية'
      }, { status: 422 })
    }

    // 3. التحقق من أن الاشتراك لم ينته
    const now = new Date()
    if (new Date(member.expiryDate) < now) {
      return NextResponse.json({
        error: 'لا يمكن ترقية اشتراك منتهي. الرجاء التجديد بدلاً من الترقية'
      }, { status: 422 })
    }

    // 4. جلب بيانات الباكدج الجديد
    const newOffer = await prisma.offer.findUnique({
      where: { id: newOfferId }
    })

    if (!newOffer || !newOffer.isActive) {
      return NextResponse.json({
        error: 'الباكدج غير موجود أو غير نشط'
      }, { status: 404 })
    }

    // 5. التحقق من تفعيل الترقية للباكدج
    if (newOffer.upgradeEligibilityDays === null) {
      return NextResponse.json({
        error: 'هذا الباكدج غير قابل للترقية إليه'
      }, { status: 422 })
    }

    // 6. التحقق من فترة الترقية المسموحة
    const daysSinceStart = calculateDaysBetween(member.startDate, now)
    if (daysSinceStart > newOffer.upgradeEligibilityDays) {
      return NextResponse.json({
        error: `انتهت فترة الترقية المسموحة. يمكن الترقية خلال ${newOffer.upgradeEligibilityDays} يوم فقط من بداية الاشتراك`
      }, { status: 422 })
    }

    // 7. التحقق من أن السعر الجديد أعلى
    if (newOffer.price <= member.subscriptionPrice) {
      return NextResponse.json({
        error: 'يمكن الترقية فقط لباكدجات أعلى سعراً من الباكدج الحالي'
      }, { status: 422 })
    }

    // 8. حساب مبلغ الترقية (السعر الجديد - السعر القديم الكامل)
    const upgradeAmount = newOffer.price - member.subscriptionPrice

    console.log('💰 حساب الترقية:', {
      oldPrice: member.subscriptionPrice,
      newPrice: newOffer.price,
      upgradeAmount
    })

    // 9. حساب تاريخ النهاية الجديد (من تاريخ البداية الأصلي)
    const newExpiryDate = new Date(member.startDate)
    newExpiryDate.setDate(newExpiryDate.getDate() + newOffer.duration)

    console.log('📅 التواريخ:', {
      startDate: formatDateYMD(member.startDate),
      oldExpiryDate: formatDateYMD(member.expiryDate),
      newExpiryDate: formatDateYMD(newExpiryDate),
      duration: newOffer.duration
    })

    // 10. حفظ بيانات الباكدج القديم للإيصال
    const oldPackageData = {
      oldPackagePrice: member.subscriptionPrice,
      oldFreePTSessions: member.freePTSessions,
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
        freePTSessions: newOffer.freePTSessions,      // REPLACE
        inBodyScans: newOffer.inBodyScans,            // REPLACE
        invitations: newOffer.invitations,            // REPLACE
        remainingFreezeDays: newOffer.freezeDays,     // REPLACE
        expiryDate: newExpiryDate,
        // startDate يبقى كما هو - لا يتغير
        remainingAmount: 0,                            // الترقية يجب دفعها كاملة
        isActive: true
      }
    })

    console.log('✅ تم تحديث بيانات العضو:', {
      newPrice: updatedMember.subscriptionPrice,
      newPT: updatedMember.freePTSessions,
      newInBody: updatedMember.inBodyScans,
      newInvitations: updatedMember.invitations,
      newExpiry: formatDateYMD(updatedMember.expiryDate)
    })

    // 12. الحصول على رقم الإيصال التالي
    const counter = await prisma.receiptCounter.findFirst()
    if (!counter) {
      return NextResponse.json({
        error: 'خطأ في النظام: عداد الإيصالات غير موجود'
      }, { status: 500 })
    }

    const receiptNumber = await getNextAvailableReceiptNumber(counter.current)

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
      paymentMethod
    }

    // 14. معالجة وسائل الدفع المتعددة
    let finalPaymentMethod: string
    if (Array.isArray(paymentMethod)) {
      const validation = validatePaymentDistribution(paymentMethod, upgradeAmount)
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
    // 🔒 License validation check
    await requireValidLicense()

    const receipt = await prisma.receipt.create({
      data: {
        receiptNumber,
        type: 'ترقية باكدج',
        amount: upgradeAmount,
        itemDetails: JSON.stringify(itemDetails),
        paymentMethod: finalPaymentMethod,
        memberId: member.id,
        staffName: staffName || 'غير محدد'
      }
    })

    console.log('🧾 تم إنشاء إيصال الترقية:', receiptNumber)

    // 15. تحديث عداد الإيصالات
    await prisma.receiptCounter.update({
      where: { id: counter.id },
      data: { current: receiptNumber + 1 }
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
    return NextResponse.json({
      error: error.message || 'حدث خطأ أثناء ترقية الباكدج'
    }, { status: 500 })
  }
}

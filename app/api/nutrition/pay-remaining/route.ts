import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import { requireValidLicense } from '../../../../lib/license'
import {
  type PaymentMethod,
  validatePaymentDistribution,
  serializePaymentMethods
} from '../../../../lib/paymentHelpers'
import { getNextReceiptNumberDirect } from '../../../../lib/receiptHelpers'

export const dynamic = 'force-dynamic'

// POST - دفع المبلغ المتبقي
export async function POST(request: Request) {
  try {
    // ✅ التحقق من صلاحية إنشاء Nutrition (تشمل دفع الباقي)
    await requirePermission(request, 'canCreateNutrition')

    const body = await request.json()
    const {
      nutritionNumber,
      paymentAmount,
      paymentMethod,
      staffName
    } = body

    if (!nutritionNumber) {
      return NextResponse.json(
        { error: 'رقم Nutrition مطلوب' },
        { status: 400 }
      )
    }

    if (!paymentAmount || paymentAmount <= 0) {
      return NextResponse.json(
        { error: 'مبلغ الدفع يجب أن يكون أكبر من صفر' },
        { status: 400 }
      )
    }

    // البحث عن جلسة Nutrition
    const nutrition = await prisma.nutrition.findUnique({
      where: { nutritionNumber: parseInt(nutritionNumber) }
    })

    if (!nutrition) {
      return NextResponse.json(
        { error: 'جلسة Nutrition غير موجودة' },
        { status: 404 }
      )
    }

    // التحقق من أن المبلغ المدفوع لا يتجاوز المتبقي
    const currentRemaining = nutrition.remainingAmount || 0
    if (paymentAmount > currentRemaining) {
      return NextResponse.json(
        { error: `المبلغ المدفوع (${paymentAmount}) أكبر من المتبقي (${currentRemaining})` },
        { status: 400 }
      )
    }

    // تحديث المبلغ المتبقي
    const newRemainingAmount = currentRemaining - paymentAmount
    const updatedNutrition = await prisma.nutrition.update({
      where: { nutritionNumber: parseInt(nutritionNumber) },
      data: { remainingAmount: newRemainingAmount }
    })

    console.log(`✅ تم تحديث Nutrition #${nutritionNumber}: الباقي من ${currentRemaining} إلى ${newRemainingAmount}`)

    // إنشاء إيصال للدفعة
    try {
      // 🔒 License validation check
      await requireValidLicense()

      // ✅ معالجة وسائل الدفع المتعددة
      let finalPaymentMethod: string
      if (Array.isArray(paymentMethod)) {
        const validation = validatePaymentDistribution(paymentMethod, paymentAmount)
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

      const receiptNumber = await getNextReceiptNumberDirect(prisma)

      const receipt = await prisma.receipt.create({
        data: {
          receiptNumber,
          type: 'دفع باقي تغذية',
          amount: paymentAmount,
          paymentMethod: finalPaymentMethod,
          staffName: staffName || '',
          itemDetails: JSON.stringify({
            nutritionNumber: nutrition.nutritionNumber,
            clientName: nutrition.clientName,
            phone: nutrition.phone,
            nutritionistName: nutrition.nutritionistName,
            paymentAmount,
            previousRemaining: currentRemaining,
            newRemaining: newRemainingAmount,
            paymentType: 'remaining_amount_payment'
          }),
        },
      })

      console.log('✅ تم إنشاء إيصال الدفع:', receipt.receiptNumber)

      // ✅ إنشاء سجل عمولة لأخصائي التغذية
      try {
        // البحث عن coachUserId من اسم أخصائي التغذية
        const nutritionistStaff = await prisma.staff.findFirst({
          where: { name: nutrition.nutritionistName },
          include: { user: true }
        })

        if (nutritionistStaff?.user) {
          const { createPTCommission } = await import('../../../../lib/commissionHelpers')
          await createPTCommission(
            prisma,
            nutritionistStaff.user.id,
            paymentAmount,
            `عمولة دفع باقي تغذية - ${nutrition.clientName} (#${nutrition.nutritionNumber})`,
            nutrition.nutritionNumber
          )
        }
      } catch (commissionError) {
        console.error('⚠️ فشل إنشاء سجل العمولة (غير حرج):', commissionError)
      }

      return NextResponse.json({
        success: true,
        nutrition: updatedNutrition,
        receipt,
        message: 'تم دفع المبلغ المتبقي بنجاح'
      })
    } catch (receiptError) {
      console.error('❌ خطأ في إنشاء الإيصال:', receiptError)

      // إرجاع Nutrition المحدث حتى لو فشل الإيصال
      return NextResponse.json({
        success: true,
        nutrition: updatedNutrition,
        message: 'تم تحديث المبلغ ولكن فشل إنشاء الإيصال'
      })
    }
  } catch (error: any) {
    console.error('❌ خطأ في دفع المبلغ المتبقي:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تعديل جلسات التغذية' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'فشل دفع المبلغ المتبقي' },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import { requireValidLicense } from '../../../../lib/license'
import {
  type PaymentMethod,
  validatePaymentDistribution,
  serializePaymentMethods
} from '../../../../lib/paymentHelpers'

export const dynamic = 'force-dynamic'

// POST - دفع المبلغ المتبقي
export async function POST(request: Request) {
  try {
    // ✅ التحقق من صلاحية التعديل
    await requirePermission(request, 'canEditGroupClass')

    const body = await request.json()
    const {
      groupClassNumber,
      paymentAmount,
      paymentMethod,
      staffName
    } = body

    if (!groupClassNumber) {
      return NextResponse.json(
        { error: 'رقم GroupClass مطلوب' },
        { status: 400 }
      )
    }

    if (!paymentAmount || paymentAmount <= 0) {
      return NextResponse.json(
        { error: 'مبلغ الدفع يجب أن يكون أكبر من صفر' },
        { status: 400 }
      )
    }

    // البحث عن جلسة GroupClass
    const groupClass = await prisma.groupClass.findUnique({
      where: { groupClassNumber: parseInt(groupClassNumber) }
    })

    if (!groupClass) {
      return NextResponse.json(
        { error: 'جلسة GroupClass غير موجودة' },
        { status: 404 }
      )
    }

    // التحقق من أن المبلغ المدفوع لا يتجاوز المتبقي
    const currentRemaining = groupClass.remainingAmount || 0
    if (paymentAmount > currentRemaining) {
      return NextResponse.json(
        { error: `المبلغ المدفوع (${paymentAmount}) أكبر من المتبقي (${currentRemaining})` },
        { status: 400 }
      )
    }

    // تحديث المبلغ المتبقي
    const newRemainingAmount = currentRemaining - paymentAmount
    const updatedGroupClass = await prisma.groupClass.update({
      where: { groupClassNumber: parseInt(groupClassNumber) },
      data: { remainingAmount: newRemainingAmount }
    })

    console.log(`✅ تم تحديث GroupClass #${groupClassNumber}: الباقي من ${currentRemaining} إلى ${newRemainingAmount}`)

    // إنشاء إيصال للدفعة
    try {
      let counter = await prisma.receiptCounter.findUnique({ where: { id: 1 } })

      if (!counter) {
        counter = await prisma.receiptCounter.create({
          data: { id: 1, current: 1000 }
        })
      }

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

      const receipt = await prisma.receipt.create({
        data: {
          receiptNumber: counter.current,
          type: 'دفع باقي جروب كلاسيس',
          amount: paymentAmount,
          paymentMethod: finalPaymentMethod,
          staffName: staffName || '',
          itemDetails: JSON.stringify({
            groupClassNumber: groupClass.groupClassNumber,
            clientName: groupClass.clientName,
            phone: groupClass.phone,
            groupClassistName: groupClass.groupClassistName,
            paymentAmount,
            previousRemaining: currentRemaining,
            newRemaining: newRemainingAmount,
            paymentType: 'remaining_amount_payment'
          }),
        },
      })

      console.log('✅ تم إنشاء إيصال الدفع:', receipt.receiptNumber)

      await prisma.receiptCounter.update({
        where: { id: 1 },
        data: { current: counter.current + 1 }
      })

      // ✅ إنشاء سجل عمولة لالمدرب
      try {
        // البحث عن coachUserId من اسم المدرب
        const groupClassistStaff = await prisma.staff.findFirst({
          where: { name: groupClass.groupClassistName },
          include: { user: true }
        })

        if (groupClassistStaff?.user) {
          const { createPTCommission } = await import('../../../../lib/commissionHelpers')
          await createPTCommission(
            prisma,
            groupClassistStaff.user.id,
            paymentAmount,
            `عمولة دفع باقي جروب كلاسيس - ${groupClass.clientName} (#${groupClass.groupClassNumber})`,
            groupClass.groupClassNumber
          )
        }
      } catch (commissionError) {
        console.error('⚠️ فشل إنشاء سجل العمولة (غير حرج):', commissionError)
      }

      return NextResponse.json({
        success: true,
        groupClass: updatedGroupClass,
        receipt,
        message: 'تم دفع المبلغ المتبقي بنجاح'
      })
    } catch (receiptError) {
      console.error('❌ خطأ في إنشاء الإيصال:', receiptError)

      // إرجاع GroupClass المحدث حتى لو فشل الإيصال
      return NextResponse.json({
        success: true,
        groupClass: updatedGroupClass,
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
        { error: 'ليس لديك صلاحية تعديل جلسات جروب كلاسيس' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'فشل دفع المبلغ المتبقي' },
      { status: 500 }
    )
  }
}

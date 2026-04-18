import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import {
  type PaymentMethod,
  validatePaymentDistribution,
  serializePaymentMethods
} from '../../../../lib/paymentHelpers'
import { getNextReceiptNumberDirect } from '../../../../lib/receiptHelpers'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

export const dynamic = 'force-dynamic'

// POST - دفع المبلغ المتبقي
export async function POST(request: Request) {
  try {
    // ✅ التحقق من صلاحية إنشاء Physiotherapy (تشمل دفع الباقي)
    const user = await requirePermission(request, 'canCreatePhysiotherapy')

    const body = await request.json()
    const {
      physioNumber,
      paymentAmount,
      paymentMethod,
      staffName
    } = body

    if (!physioNumber) {
      return NextResponse.json(
        { error: 'رقم Physiotherapy مطلوب' },
        { status: 400 }
      )
    }

    if (!paymentAmount || paymentAmount <= 0) {
      return NextResponse.json(
        { error: 'مبلغ الدفع يجب أن يكون أكبر من صفر' },
        { status: 400 }
      )
    }

    // البحث عن جلسة Physiotherapy
    const physiotherapy = await prisma.physiotherapy.findUnique({
      where: { physioNumber: parseInt(physioNumber) }
    })

    if (!physiotherapy) {
      return NextResponse.json(
        { error: 'جلسة Physiotherapy غير موجودة' },
        { status: 404 }
      )
    }

    // التحقق من أن المبلغ المدفوع لا يتجاوز المتبقي
    const currentRemaining = physiotherapy.remainingAmount || 0
    if (paymentAmount > currentRemaining) {
      return NextResponse.json(
        { error: `المبلغ المدفوع (${paymentAmount}) أكبر من المتبقي (${currentRemaining})` },
        { status: 400 }
      )
    }

    // تحديث المبلغ المتبقي
    const newRemainingAmount = currentRemaining - paymentAmount
    const updatedPhysiotherapy = await prisma.physiotherapy.update({
      where: { physioNumber: parseInt(physioNumber) },
      data: { remainingAmount: newRemainingAmount }
    })


    // إنشاء إيصال للدفعة
    try {
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
          type: 'دفع باقي علاج طبيعي',
          amount: paymentAmount,
          paymentMethod: finalPaymentMethod,
          staffName: staffName || '',
          itemDetails: JSON.stringify({
            physioNumber: physiotherapy.physioNumber,
            clientName: physiotherapy.clientName,
            phone: physiotherapy.phone,
            therapistName: physiotherapy.therapistName,
            paymentAmount,
            previousRemaining: currentRemaining,
            newRemaining: newRemainingAmount,
            paymentType: 'remaining_amount_payment'
          }),
        },
      })


      // ✅ إنشاء سجل عمولة لأخصائي العلاج الطبيعي
      try {
        // البحث عن therapistUserId من اسم أخصائي العلاج الطبيعي
        const therapistStaff = await prisma.staff.findFirst({
          where: { name: physiotherapy.therapistName },
          include: { user: true }
        })

        if (therapistStaff?.user) {
          const { createPTCommission } = await import('../../../../lib/commissionHelpers')
          await createPTCommission(
            prisma,
            therapistStaff.user.id,
            paymentAmount,
            `عمولة دفع باقي علاج طبيعي - ${physiotherapy.clientName} (#${physiotherapy.physioNumber})`,
            physiotherapy.physioNumber
          )
        }
      } catch (commissionError) {
        console.error('⚠️ فشل إنشاء سجل العمولة (غير حرج):', commissionError)
      }

      createAuditLog({
        userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
        action: 'UPDATE', resource: 'Physiotherapy', resourceId: physiotherapy.physioNumber.toString(),
        details: { operation: 'PayRemaining', physioNumber, clientName: physiotherapy.clientName, paymentAmount, previousRemaining: currentRemaining, newRemaining: newRemainingAmount, receiptNumber: receipt.receiptNumber },
        ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
      })

      return NextResponse.json({
        success: true,
        physiotherapy: updatedPhysiotherapy,
        receipt,
        message: 'تم دفع المبلغ المتبقي بنجاح'
      })
    } catch (receiptError) {
      console.error('❌ خطأ في إنشاء الإيصال:', receiptError)

      // إرجاع Physiotherapy المحدث حتى لو فشل الإيصال
      return NextResponse.json({
        success: true,
        physiotherapy: updatedPhysiotherapy,
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
        { error: 'ليس لديك صلاحية تعديل جلسات العلاج الطبيعي' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'فشل دفع المبلغ المتبقي' },
      { status: 500 }
    )
  }
}

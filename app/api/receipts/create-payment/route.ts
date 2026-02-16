import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import { requireValidLicense } from '../../../../lib/license'
import {
  type PaymentMethod,
  validatePaymentDistribution,
  serializePaymentMethods
} from '../../../../lib/paymentHelpers'
import { processPaymentWithPoints } from '../../../../lib/paymentProcessor'
import { getNextReceiptNumberDirect } from '../../../../lib/receiptHelpers'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    /**
     * إنشاء إيصال دفع متبقي
     * @permission canEditReceipts - صلاحية تعديل وإنشاء الإيصالات
     */
    await requirePermission(request, 'canEditReceipts')
    
    const { memberId, amount, paymentMethod, notes } = await request.json()

    if (!memberId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'بيانات غير صحيحة' }, { status: 400 })
    }

    // جلب بيانات العضو
    const member = await prisma.member.findUnique({
      where: { id: memberId }
    })

    if (!member) {
      return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })
    }

    const receiptNumber = await getNextReceiptNumberDirect(prisma)

    // ✅ معالجة وسائل الدفع المتعددة
    let finalPaymentMethod: string
    if (Array.isArray(paymentMethod)) {
      const validation = validatePaymentDistribution(paymentMethod, amount)
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

    // تفاصيل الإيصال
    const itemDetails = {
      memberNumber: member.memberNumber,
      memberName: member.name,
      paidAmount: amount,
      remainingAmount: member.remainingAmount - amount,
      paymentMethod: finalPaymentMethod,
      notes: notes || ''
    }

    // إنشاء الإيصال
    // 🔒 License validation check
    await requireValidLicense()

    const receipt = await prisma.receipt.create({
      data: {
        receiptNumber,
        type: 'Payment', // نوع جديد: دفع متبقي
        amount,
        itemDetails: JSON.stringify(itemDetails),
        paymentMethod: finalPaymentMethod,
        memberId
      }
    })

    // خصم النقاط إذا تم استخدامها في الدفع
    const pointsResult = await processPaymentWithPoints(
      member.id,
      member.phone,
      member.memberNumber,  // ✅ تمرير رقم العضوية
      finalPaymentMethod,
      `دفع متبقي - ${member.name}`,
      prisma
    )

    if (!pointsResult.success) {
      return NextResponse.json(
        { error: pointsResult.message || 'فشل خصم النقاط' },
        { status: 400 }
      )
    }

    return NextResponse.json(receipt)
  } catch (error: any) {
    console.error('Error creating payment receipt:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية إنشاء إيصالات الدفع' },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { error: 'فشل إنشاء الإيصال' },
      { status: 500 }
    )
  }
}
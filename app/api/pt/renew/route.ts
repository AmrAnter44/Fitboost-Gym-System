import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requireValidLicense } from '../../../../lib/license'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      ptNumber,
      phone,
      sessionsPurchased,
      coachName,
      totalPrice,
      startDate,
      expiryDate,
      paymentMethod,
      staffName
    } = body

    // حساب سعر الحصة الواحدة من السعر الإجمالي
    const pricePerSession = sessionsPurchased > 0 ? totalPrice / sessionsPurchased : 0

    console.log('🔄 تجديد جلسات PT:', { ptNumber, sessionsPurchased, totalPrice, pricePerSession })

    // التحقق من وجود جلسة PT
    const existingPT = await prisma.pT.findUnique({
      where: { ptNumber: parseInt(ptNumber) }
    })
    
    if (!existingPT) {
      return NextResponse.json(
        { error: 'جلسة PT غير موجودة' }, 
        { status: 404 }
      )
    }

    // التحقق من التواريخ
    if (startDate && expiryDate) {
      const start = new Date(startDate)
      const end = new Date(expiryDate)
      
      if (end <= start) {
        return NextResponse.json(
          { error: 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية' },
          { status: 400 }
        )
      }
    }

    // تحديث جلسة PT (استبدال البيانات بالبيانات الجديدة)
    const updatedPT = await prisma.pT.update({
      where: { ptNumber: parseInt(ptNumber) },
      data: {
        phone,
        sessionsPurchased: sessionsPurchased,
        sessionsRemaining: sessionsPurchased,
        coachName,
        pricePerSession,
        startDate: startDate ? new Date(startDate) : existingPT.startDate,
        expiryDate: expiryDate ? new Date(expiryDate) : existingPT.expiryDate,
      },
    })

    console.log('✅ تم تحديث جلسة PT:', updatedPT.ptNumber)

    // إنشاء إيصال للتجديد باستخدام Transaction
    try {
      // 🔒 License validation check
      await requireValidLicense()

      // التأكد من وجود totalPrice، وإلا احسبها
      const totalAmount = totalPrice !== undefined && totalPrice !== null && totalPrice > 0
        ? Number(totalPrice)
        : Number(sessionsPurchased * pricePerSession)

      let subscriptionDays = null
      if (startDate && expiryDate) {
        const start = new Date(startDate)
        const end = new Date(expiryDate)
        subscriptionDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      }

      // استخدام Transaction مع البحث عن أول رقم متاح
      const result = await prisma.$transaction(async (tx) => {
        // جلب العداد الحالي
        let counter = await tx.receiptCounter.findUnique({
          where: { id: 1 }
        })

        if (!counter) {
          counter = await tx.receiptCounter.create({
            data: { id: 1, current: 1000 }
          })
        }

        let receiptNumber = counter.current
        let foundAvailable = false
        let attempts = 0
        const maxAttempts = 100 // حد أقصى للمحاولات لتجنب infinite loop

        // البحث عن أول رقم متاح
        while (!foundAvailable && attempts < maxAttempts) {
          const existingReceipt = await tx.receipt.findUnique({
            where: { receiptNumber: receiptNumber }
          })

          if (!existingReceipt) {
            // الرقم متاح!
            foundAvailable = true
            console.log(`✅ وجدنا رقم إيصال متاح: ${receiptNumber}`)
          } else {
            // الرقم مستخدم، جرب الرقم التالي
            console.log(`⏭️ رقم ${receiptNumber} مستخدم، جرب ${receiptNumber + 1}`)
            receiptNumber++
            attempts++
          }
        }

        if (!foundAvailable) {
          throw new Error('فشل في إيجاد رقم إيصال متاح بعد 100 محاولة')
        }

        // تحديث العداد للرقم التالي
        await tx.receiptCounter.update({
          where: { id: 1 },
          data: { current: receiptNumber + 1 }
        })

        console.log('🔢 استخدام رقم الإيصال:', receiptNumber, '| العداد الجديد:', receiptNumber + 1)

        // إنشاء الإيصال
        const receipt = await tx.receipt.create({
          data: {
            receiptNumber: receiptNumber,
            type: 'تجديد برايفت',
            amount: totalAmount,
            paymentMethod: paymentMethod || 'cash',
            staffName: staffName || '',
            itemDetails: JSON.stringify({
              ptNumber: updatedPT.ptNumber,
              clientName: existingPT.clientName,
              phone: phone || existingPT.phone,
              sessionsPurchased: Number(sessionsPurchased),
              pricePerSession: Number(pricePerSession),
              totalAmount: totalAmount,
              coachName: coachName || existingPT.coachName,
              startDate: startDate || null,
              expiryDate: expiryDate || null,
              subscriptionDays: subscriptionDays,
              oldSessionsRemaining: existingPT.sessionsRemaining,
              newSessionsRemaining: updatedPT.sessionsRemaining,
            }),
            ptNumber: updatedPT.ptNumber,
          },
        })

        return receipt
      })

      console.log('✅ تم إنشاء إيصال التجديد بنجاح:', result.receiptNumber)

      return NextResponse.json({
        pt: updatedPT,
        receipt: {
          receiptNumber: result.receiptNumber,
          amount: result.amount,
          itemDetails: result.itemDetails,
          createdAt: result.createdAt
        }
      }, { status: 200 })

    } catch (receiptError: any) {
      console.error('❌ خطأ في إنشاء الإيصال:', receiptError)
      console.error('❌ تفاصيل الخطأ:', {
        message: receiptError.message,
        code: receiptError.code,
        meta: receiptError.meta,
        name: receiptError.name,
        stack: receiptError.stack
      })

      // إرجاع البيانات المحدثة حتى لو فشل الإيصال
      return NextResponse.json({
        pt: updatedPT,
        error: 'تم التجديد بنجاح ولكن فشل إنشاء الإيصال. يرجى إنشاء الإيصال يدوياً.',
        errorDetails: receiptError.message
      }, { status: 200 })
    }

  } catch (error) {
    console.error('❌ خطأ في تجديد جلسة PT:', error)
    return NextResponse.json({ error: 'فشل تجديد جلسة PT' }, { status: 500 })
  }
}
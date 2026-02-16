import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'
import { requireValidLicense } from '../../../lib/license'
import {
  type PaymentMethod,
  validatePaymentDistribution,
  serializePaymentMethods,
  getActualAmountPaid
} from '../../../lib/paymentHelpers'
import { processPaymentWithPoints } from '../../../lib/paymentProcessor'
import { addPointsForPayment } from '../../../lib/points'
import { RECEIPT_TYPES } from '../../../lib/receiptTypes'
import { getNextReceiptNumber } from '../../../lib/receiptHelpers'
// @ts-ignore
import bwipjs from 'bwip-js'

export const dynamic = 'force-dynamic'

// GET - جلب كل جلسات Physiotherapy
export async function GET(request: Request) {
  try {
    // ✅ التحقق من صلاحية عرض Physiotherapy
    const user = await requirePermission(request, 'canViewPhysiotherapy')

    // جلب therapistUserId من query parameters
    const { searchParams } = new URL(request.url)
    const therapistUserIdParam = searchParams.get('therapistUserId')

    console.log('🔍 Physiotherapy API GET - User:', user.userId, 'Role:', user.role, 'Query therapistUserId:', therapistUserIdParam)

    // فلترة البيانات حسب الدور
    let whereClause: any = {}

    if (user.role === 'COACH') {
      // أخصائي العلاج الطبيعي يرى عملائه فقط
      // جلب اسم أخصائي العلاج الطبيعي من جدول Staff
      const therapistStaff = await prisma.staff.findFirst({
        where: {
          user: {
            id: user.userId
          }
        }
      })

      if (therapistStaff) {
        // البحث بناءً على therapistUserId أو therapistName كـ fallback
        whereClause = {
          OR: [
            { therapistUserId: user.userId },
            { therapistName: therapistStaff.name }
          ]
        }
        console.log('👤 Coach accessing own Physiotherapys - userId:', user.userId, 'name:', therapistStaff.name)
      } else {
        whereClause = { therapistUserId: user.userId }
        console.log('👤 Coach accessing own Physiotherapys - userId only:', user.userId)
      }
    } else if (therapistUserIdParam) {
      // إذا تم تمرير therapistUserId في الـ query، فلتر بناءً عليه
      whereClause = { therapistUserId: therapistUserIdParam }
      console.log('🔎 Filtering by therapistUserId from query:', therapistUserIdParam)
    }

    console.log('📋 Where clause:', JSON.stringify(whereClause))

    const physiotherapySessions = await prisma.physiotherapy.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        receipts: true,
        sessions: {
          orderBy: { sessionDate: 'desc' },
          take: 5
        }
      }
    })

    console.log('✅ Found', physiotherapySessions.length, 'Physiotherapy records')
    return NextResponse.json(physiotherapySessions)
  } catch (error: any) {
    console.error('Error fetching Physiotherapy sessions:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية عرض جلسات العلاج الطبيعي' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل جلب جلسات العلاج الطبيعي' }, { status: 500 })
  }
}

// POST - إضافة جلسة Physiotherapy جديدة
export async function POST(request: Request) {
  try {
    // ✅ التحقق من صلاحية إنشاء Physiotherapy
    await requirePermission(request, 'canCreatePhysiotherapy')

    const body = await request.json()
    const {
      physioNumber,
      clientName,
      phone,
      memberNumber,
      sessionsPurchased,
      therapistName,
      totalPrice,
      remainingAmount,
      startDate,
      expiryDate,
      paymentMethod,
      staffName
    } = body

    // حساب سعر الحصة الواحدة من السعر الإجمالي
    const pricePerSession = sessionsPurchased > 0 ? totalPrice / sessionsPurchased : 0

    console.log('📝 إضافة جلسة Physiotherapy جديدة:', { physioNumber, clientName, sessionsPurchased, totalPrice, pricePerSession })

    // ✅ التحقق من الحقول المطلوبة
    if (!clientName || clientName.trim() === '') {
      return NextResponse.json(
        { error: 'اسم العميل مطلوب' },
        { status: 400 }
      )
    }

    if (!phone || phone.trim() === '') {
      return NextResponse.json(
        { error: 'رقم الهاتف مطلوب' },
        { status: 400 }
      )
    }

    if (!therapistName || therapistName.trim() === '') {
      return NextResponse.json(
        { error: 'اسم أخصائي العلاج الطبيعي مطلوب' },
        { status: 400 }
      )
    }

    if (!sessionsPurchased || sessionsPurchased <= 0) {
      return NextResponse.json(
        { error: 'عدد الجلسات مطلوب ويجب أن يكون أكبر من صفر' },
        { status: 400 }
      )
    }

    if (totalPrice === undefined || totalPrice < 0) {
      return NextResponse.json(
        { error: 'السعر الإجمالي مطلوب ولا يمكن أن يكون سالب' },
        { status: 400 }
      )
    }

    // التحقق من أن رقم Physiotherapy غير مستخدم (فقط إذا تم إدخاله يدوياً وليس سالب)
    // الأرقام السالبة تُستخدم للـ Day Use ولا تُعتبر أرقام Physiotherapy حقيقية
    if (physioNumber && parseInt(physioNumber) > 0) {
      const existingPhysiotherapy = await prisma.physiotherapy.findUnique({
        where: { physioNumber: parseInt(physioNumber) }
      })

      if (existingPhysiotherapy) {
        console.error('❌ رقم Physiotherapy مستخدم:', physioNumber)
        return NextResponse.json(
          { error: `رقم Physiotherapy ${physioNumber} مستخدم بالفعل` },
          { status: 400 }
        )
      }
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

    // البحث عن أخصائي العلاج الطبيعي بالاسم لربط therapistUserId
    let therapistUserId = null
    if (therapistName) {
      const therapistStaff = await prisma.staff.findFirst({
        where: { name: therapistName },
        include: { user: true }
      })

      if (therapistStaff && therapistStaff.user) {
        therapistUserId = therapistStaff.user.id
        console.log(`✅ تم ربط أخصائي العلاج الطبيعي ${therapistName} بـ userId: ${therapistUserId}`)
      } else {
        console.warn(`⚠️ لم يتم العثور على حساب مستخدم لأخصائي العلاج الطبيعي: ${therapistName}`)
      }
    }

    // توليد Barcode من 16 رقم عشوائي
    let barcodeText = ''
    let isUnique = false

    // التأكد من أن الـ barcode فريد
    while (!isUnique) {
      barcodeText = Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join('')
      const existing = await prisma.physiotherapy.findUnique({
        where: { qrCode: barcodeText }
      })
      if (!existing) {
        isUnique = true
      }
    }

    console.log(`🔢 تم توليد Barcode عشوائي (16 رقم): ${barcodeText}`)

    // توليد Barcode كصورة
    let qrCodeImage = ''
    try {
      const png = await bwipjs.toBuffer({
        bcid: 'code128',
        text: barcodeText,
        scale: 5,
        height: 15,
        includetext: true,
      })

      const base64 = png.toString('base64')
      qrCodeImage = `data:image/png;base64,${base64}`
      console.log('✅ تم توليد Barcode كصورة')
    } catch (barcodeError) {
      console.error('❌ فشل توليد صورة Barcode:', barcodeError)
    }

    // إنشاء جلسة Physiotherapy
    const physiotherapyData: any = {
      clientName,
      phone,
      sessionsPurchased,
      sessionsRemaining: sessionsPurchased,
      therapistName,
      therapistUserId,  // ✅ ربط أخصائي العلاج الطبيعي بـ userId
      pricePerSession,
      remainingAmount: remainingAmount || 0,  // ✅ الباقي من الفلوس
      startDate: startDate ? new Date(startDate) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      qrCode: barcodeText,
      qrCodeImage: qrCodeImage
    }

    // إضافة physioNumber
    if (physioNumber) {
      const physiotherapyNum = parseInt(physioNumber)

      // إذا كان الرقم سالب (Day Use)، ابحث عن أول رقم سالب متاح
      if (physiotherapyNum < 0) {
        let availableNumber = -1
        let found = false

        // البحث عن أول رقم سالب متاح
        while (!found) {
          const existing = await prisma.physiotherapy.findUnique({
            where: { physioNumber: availableNumber }
          })

          if (!existing) {
            found = true
            physiotherapyData.physioNumber = availableNumber
            console.log(`✅ تم العثور على رقم Day Use متاح: ${availableNumber}`)
          } else {
            availableNumber-- // جرب الرقم التالي (-2, -3, ...)
          }
        }
      } else {
        // رقم موجب عادي
        physiotherapyData.physioNumber = physiotherapyNum
      }
    }

    // إنشاء إيصال باستخدام Transaction
    try {
      // 🔒 License validation check
      await requireValidLicense()

      const totalAmount = sessionsPurchased * pricePerSession
      const paidAmount = totalAmount - (remainingAmount || 0)

      let subscriptionDays = null
      if (startDate && expiryDate) {
        const start = new Date(startDate)
        const end = new Date(expiryDate)
        subscriptionDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      }

      // استخدام Transaction مع البحث عن أول رقم متاح
      // ⏱️ زيادة timeout إلى 10 ثوانٍ بسبب العمليات الكثيرة (نقاط، عمولات، إلخ)
      const physiotherapy = await prisma.$transaction(async (tx) => {
        // ✅ إنشاء جلسة Physiotherapy داخل الـ Transaction لضمان Atomicity
        const physiotherapy = await tx.physiotherapy.create({
          data: physiotherapyData,
        })

        console.log('✅ تم إنشاء جلسة Physiotherapy:', physiotherapy.physioNumber)

        const receiptNumber = await getNextReceiptNumber(tx)

        // ✅ معالجة وسائل الدفع المتعددة
        let finalPaymentMethod: string
        if (Array.isArray(paymentMethod)) {
          const validation = validatePaymentDistribution(paymentMethod, Number(paidAmount))
          if (!validation.valid) {
            throw new Error(validation.message || 'توزيع المبالغ غير صحيح')
          }
          finalPaymentMethod = serializePaymentMethods(paymentMethod)
        } else {
          finalPaymentMethod = paymentMethod || 'cash'
        }

        // إنشاء الإيصال
        // تحديد نوع الإيصال بناءً على إذا كان Day Use أم لا
        const receiptType = physiotherapy.physioNumber < 0 ? RECEIPT_TYPES.PHYSIOTHERAPY_DAY_USE : RECEIPT_TYPES.NEW_PHYSIOTHERAPY

        const receipt = await tx.receipt.create({
          data: {
            receiptNumber: receiptNumber,
            type: receiptType,
            amount: Number(paidAmount),
            paymentMethod: finalPaymentMethod,
            staffName: staffName || '',
            itemDetails: JSON.stringify({
              physioNumber: physiotherapy.physioNumber,
              clientName,
              phone: phone,
              sessionsPurchased: Number(sessionsPurchased),
              pricePerSession: Number(pricePerSession),
              totalAmount: Number(totalAmount),
              paidAmount: Number(paidAmount),
              remainingAmount: Number(remainingAmount || 0),
              therapistName,
              startDate: startDate || null,
              expiryDate: expiryDate || null,
              subscriptionDays: subscriptionDays
            }),
            physioNumber: physiotherapy.physioNumber,
          },
        })

        console.log('✅ تم إنشاء الإيصال:', receipt.receiptNumber)

        // خصم النقاط إذا تم استخدامها في الدفع
        const pointsResult = await processPaymentWithPoints(
          null,  // لا يوجد memberId لـ Physiotherapy
          phone,
          memberNumber,  // ✅ تمرير رقم العضوية للبحث عن العضو
          finalPaymentMethod,
          `دفع علاج طبيعي - ${clientName}`,
          tx
        )

        if (!pointsResult.success) {
          throw new Error(pointsResult.message || 'فشل خصم النقاط')
        }

        // ✅ إضافة نقاط مكافأة للعضو بناءً على المبلغ المدفوع
        // حساب المبلغ الفعلي المدفوع (بدون النقاط المستخدمة)
        const actualAmountPaid = getActualAmountPaid(finalPaymentMethod, paidAmount)

        console.log('🎁 Physiotherapy Points reward check:', {
          actualAmountPaid,
          paidAmount,
          memberNumber,
          phone,
          finalPaymentMethod: typeof finalPaymentMethod === 'string' ? finalPaymentMethod : 'array'
        })

        if (actualAmountPaid > 0 && (memberNumber || phone)) {
          try {
            // البحث عن العضو برقم العضوية أولاً، ثم بالهاتف
            let member = null
            if (memberNumber) {
              console.log(`🔍 Physiotherapy: البحث عن عضو برقم العضوية: ${memberNumber}`)
              member = await tx.member.findUnique({
                where: { memberNumber: parseInt(memberNumber) },
                select: { id: true, name: true }
              })
            }

            // إذا لم يُعثر على العضو برقم العضوية، نبحث بالهاتف
            if (!member && phone) {
              console.log(`🔍 Physiotherapy: البحث عن عضو بالهاتف: ${phone}`)
              member = await tx.member.findFirst({
                where: { phone: phone },
                select: { id: true, name: true }
              })
            }

            if (member) {
              console.log(`👤 Physiotherapy: تم العثور على العضو: ${member.name} (${member.id})`)
              const rewardResult = await addPointsForPayment(
                member.id,
                Number(actualAmountPaid),
                `مكافأة اشتراك علاج طبيعي - ${clientName}`,
                tx
              )

              if (rewardResult.success && rewardResult.pointsEarned && rewardResult.pointsEarned > 0) {
                console.log(`✅ Physiotherapy: تمت إضافة ${rewardResult.pointsEarned} نقطة مكافأة للعضو ${member.name}`)
              } else {
                console.log(`⚠️ Physiotherapy: لم تُضف نقاط:`, rewardResult)
              }
            } else {
              console.log(`⚠️ Physiotherapy: لم يُعثر على عضو برقم ${memberNumber} أو هاتف ${phone}`)
            }
          } catch (rewardError) {
            console.error('⚠️ Physiotherapy: فشل إضافة نقاط المكافأة (غير حرج):', rewardError)
            // لا نفشل العملية إذا فشلت المكافأة
          }
        } else {
          console.log(`⚠️ Physiotherapy: لم يتم إضافة نقاط: actualAmountPaid=${actualAmountPaid}, memberNumber=${memberNumber}, phone=${phone}`)
        }

        // ✅ إنشاء سجل عمولة لأخصائي العلاج الطبيعي (إذا كان لديه حساب)
        if (therapistUserId && paidAmount > 0) {
          try {
            const { createPTCommission } = await import('../../../lib/commissionHelpers')
            await createPTCommission(
              tx, // استخدام tx بدلاً من prisma داخل transaction
              therapistUserId,
              Number(paidAmount),
              `عمولة علاج طبيعي جديد - ${clientName} (#${physiotherapy.physioNumber})`,
              physiotherapy.physioNumber
            )
          } catch (commissionError) {
            console.error('⚠️ فشل إنشاء سجل العمولة (غير حرج):', commissionError)
            // لا نفشل العملية إذا فشلت العمولة
          }
        }

        // ✅ إرجاع الـ physiotherapy من الـ Transaction
        return physiotherapy
      }, {
        timeout: 15000, // ⏱️ 15 seconds timeout (increased for SQLite performance)
      })

      return NextResponse.json(physiotherapy, { status: 201 })

    } catch (receiptError: any) {
      console.error('❌ خطأ في إنشاء الاشتراك والإيصال:', receiptError)
      console.error('❌ تفاصيل الخطأ:', {
        message: receiptError.message,
        code: receiptError.code,
        meta: receiptError.meta
      })

      // ✅ في حالة فشل الـ Transaction، لن يتم إنشاء أي شيء (atomicity)
      return NextResponse.json(
        { error: 'فشل إنشاء الاشتراك: ' + receiptError.message },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('❌ خطأ في إضافة جلسة Physiotherapy:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية إضافة جلسات العلاج الطبيعي' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل إضافة جلسة العلاج الطبيعي' }, { status: 500 })
  }
}

// PUT - تحديث جلسة Physiotherapy
export async function PUT(request: Request) {
  try {
    // ✅ التحقق من صلاحية تعديل Physiotherapy
    await requirePermission(request, 'canEditPhysiotherapy')

    const body = await request.json()
    const { physioNumber, action, ...data } = body

    if (action === 'use_session') {
      const physiotherapy = await prisma.physiotherapy.findUnique({ where: { physioNumber: parseInt(physioNumber) } })

      if (!physiotherapy) {
        return NextResponse.json({ error: 'جلسة Physiotherapy غير موجودة' }, { status: 404 })
      }

      if (physiotherapy.sessionsRemaining <= 0) {
        return NextResponse.json({ error: 'لا توجد جلسات متبقية' }, { status: 400 })
      }

      const updatedPhysiotherapy = await prisma.physiotherapy.update({
        where: { physioNumber: parseInt(physioNumber) },
        data: { sessionsRemaining: physiotherapy.sessionsRemaining - 1 },
      })

      return NextResponse.json(updatedPhysiotherapy)
    } else {
      // تحديث بيانات Physiotherapy
      const updateData: any = {}

      // الحقول النصية
      if (data.clientName !== undefined) updateData.clientName = data.clientName
      if (data.phone !== undefined) updateData.phone = data.phone
      if (data.therapistName !== undefined) updateData.therapistName = data.therapistName

      // الحقول الرقمية
      if (data.sessionsPurchased !== undefined) updateData.sessionsPurchased = parseInt(data.sessionsPurchased)
      if (data.sessionsRemaining !== undefined) updateData.sessionsRemaining = parseInt(data.sessionsRemaining)
      if (data.pricePerSession !== undefined) updateData.pricePerSession = parseFloat(data.pricePerSession)
      if (data.totalPrice !== undefined) {
        // إذا تم إرسال totalPrice، احسب pricePerSession
        const totalPrice = parseFloat(data.totalPrice)
        const sessions = data.sessionsPurchased !== undefined ? parseInt(data.sessionsPurchased) : undefined
        if (sessions && sessions > 0) {
          updateData.pricePerSession = totalPrice / sessions
        }
      }
      if (data.remainingAmount !== undefined) updateData.remainingAmount = parseFloat(data.remainingAmount)

      // التواريخ
      if (data.startDate) {
        updateData.startDate = new Date(data.startDate)
      }
      if (data.expiryDate) {
        updateData.expiryDate = new Date(data.expiryDate)
      }

      const physiotherapy = await prisma.physiotherapy.update({
        where: { physioNumber: parseInt(physioNumber) },
        data: updateData,
      })

      return NextResponse.json(physiotherapy)
    }
  } catch (error: any) {
    console.error('Error updating Physiotherapy:', error)

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

    return NextResponse.json({ error: 'فشل تحديث جلسة العلاج الطبيعي' }, { status: 500 })
  }
}

// DELETE - حذف جلسة Physiotherapy
export async function DELETE(request: Request) {
  try {
    // ✅ التحقق من صلاحية حذف Physiotherapy
    await requirePermission(request, 'canDeletePhysiotherapy')

    const { searchParams } = new URL(request.url)
    const physioNumber = searchParams.get('physioNumber')

    if (!physioNumber) {
      return NextResponse.json({ error: 'رقم Physiotherapy مطلوب' }, { status: 400 })
    }

    await prisma.physiotherapy.delete({ where: { physioNumber: parseInt(physioNumber) } })
    return NextResponse.json({ message: 'تم الحذف بنجاح' })
  } catch (error: any) {
    console.error('Error deleting Physiotherapy:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية حذف جلسات العلاج الطبيعي' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل حذف جلسة العلاج الطبيعي' }, { status: 500 })
  }
}

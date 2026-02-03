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
// @ts-ignore
import bwipjs from 'bwip-js'

export const dynamic = 'force-dynamic'

// GET - جلب كل جلسات PT
export async function GET(request: Request) {
  try {
    // ✅ التحقق من صلاحية عرض PT
    const user = await requirePermission(request, 'canViewPT')

    // جلب coachUserId من query parameters
    const { searchParams } = new URL(request.url)
    const coachUserIdParam = searchParams.get('coachUserId')

    console.log('🔍 PT API GET - User:', user.userId, 'Role:', user.role, 'Query coachUserId:', coachUserIdParam)

    // فلترة البيانات حسب الدور
    let whereClause: any = {}

    if (user.role === 'COACH') {
      // الكوتش يرى عملائه فقط
      // جلب اسم الكوتش من جدول Staff
      const coachStaff = await prisma.staff.findFirst({
        where: {
          user: {
            id: user.userId
          }
        }
      })

      if (coachStaff) {
        // البحث بناءً على coachUserId أو coachName كـ fallback
        whereClause = {
          OR: [
            { coachUserId: user.userId },
            { coachName: coachStaff.name }
          ]
        }
        console.log('👤 Coach accessing own PTs - userId:', user.userId, 'name:', coachStaff.name)
      } else {
        whereClause = { coachUserId: user.userId }
        console.log('👤 Coach accessing own PTs - userId only:', user.userId)
      }
    } else if (coachUserIdParam) {
      // إذا تم تمرير coachUserId في الـ query، فلتر بناءً عليه
      whereClause = { coachUserId: coachUserIdParam }
      console.log('🔎 Filtering by coachUserId from query:', coachUserIdParam)
    }

    console.log('📋 Where clause:', JSON.stringify(whereClause))

    const ptSessions = await prisma.pT.findMany({
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

    console.log('✅ Found', ptSessions.length, 'PT records')
    return NextResponse.json(ptSessions)
  } catch (error: any) {
    console.error('Error fetching PT sessions:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية عرض جلسات PT' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({ error: 'فشل جلب جلسات PT' }, { status: 500 })
  }
}

// POST - إضافة جلسة PT جديدة
export async function POST(request: Request) {
  try {
    // ✅ التحقق من صلاحية إنشاء PT
    await requirePermission(request, 'canCreatePT')
    
    const body = await request.json()
    const {
      ptNumber,
      clientName,
      phone,
      sessionsPurchased,
      coachName,
      totalPrice,
      remainingAmount,
      startDate,
      expiryDate,
      paymentMethod,
      staffName
    } = body

    // حساب سعر الحصة الواحدة من السعر الإجمالي
    const pricePerSession = sessionsPurchased > 0 ? totalPrice / sessionsPurchased : 0

    console.log('📝 إضافة جلسة PT جديدة:', { ptNumber, clientName, sessionsPurchased, totalPrice, pricePerSession })

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

    if (!coachName || coachName.trim() === '') {
      return NextResponse.json(
        { error: 'اسم الكوتش مطلوب' },
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

    // التحقق من أن رقم PT غير مستخدم (فقط إذا تم إدخاله يدوياً وليس سالب)
    // الأرقام السالبة تُستخدم للـ Day Use ولا تُعتبر أرقام PT حقيقية
    if (ptNumber && parseInt(ptNumber) > 0) {
      const existingPT = await prisma.pT.findUnique({
        where: { ptNumber: parseInt(ptNumber) }
      })

      if (existingPT) {
        console.error('❌ رقم PT مستخدم:', ptNumber)
        return NextResponse.json(
          { error: `رقم PT ${ptNumber} مستخدم بالفعل` },
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

    // البحث عن الكوتش بالاسم لربط coachUserId
    let coachUserId = null
    if (coachName) {
      const coachStaff = await prisma.staff.findFirst({
        where: { name: coachName },
        include: { user: true }
      })

      if (coachStaff && coachStaff.user) {
        coachUserId = coachStaff.user.id
        console.log(`✅ تم ربط الكوتش ${coachName} بـ userId: ${coachUserId}`)
      } else {
        console.warn(`⚠️ لم يتم العثور على حساب مستخدم للكوتش: ${coachName}`)
      }
    }

    // توليد Barcode من 16 رقم عشوائي
    let barcodeText = ''
    let isUnique = false

    // التأكد من أن الـ barcode فريد
    while (!isUnique) {
      barcodeText = Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join('')
      const existing = await prisma.pT.findUnique({
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

    // إنشاء جلسة PT
    const ptData: any = {
      clientName,
      phone,
      sessionsPurchased,
      sessionsRemaining: sessionsPurchased,
      coachName,
      coachUserId,  // ✅ ربط الكوتش بـ userId
      pricePerSession,
      remainingAmount: remainingAmount || 0,  // ✅ الباقي من الفلوس
      startDate: startDate ? new Date(startDate) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      qrCode: barcodeText,
      qrCodeImage: qrCodeImage
    }

    // إضافة ptNumber
    if (ptNumber) {
      const ptNum = parseInt(ptNumber)

      // إذا كان الرقم سالب (Day Use)، ابحث عن أول رقم سالب متاح
      if (ptNum < 0) {
        let availableNumber = -1
        let found = false

        // البحث عن أول رقم سالب متاح
        while (!found) {
          const existing = await prisma.pT.findUnique({
            where: { ptNumber: availableNumber }
          })

          if (!existing) {
            found = true
            ptData.ptNumber = availableNumber
            console.log(`✅ تم العثور على رقم Day Use متاح: ${availableNumber}`)
          } else {
            availableNumber-- // جرب الرقم التالي (-2, -3, ...)
          }
        }
      } else {
        // رقم موجب عادي
        ptData.ptNumber = ptNum
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
      const pt = await prisma.$transaction(async (tx) => {
        // ✅ إنشاء جلسة PT داخل الـ Transaction لضمان Atomicity
        const pt = await tx.pT.create({
          data: ptData,
        })

        console.log('✅ تم إنشاء جلسة PT:', pt.ptNumber)

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
        const receiptType = pt.ptNumber < 0 ? RECEIPT_TYPES.PT_DAY_USE : RECEIPT_TYPES.NEW_PT

        const receipt = await tx.receipt.create({
          data: {
            receiptNumber: receiptNumber,
            type: receiptType,
            amount: Number(paidAmount),
            paymentMethod: finalPaymentMethod,
            staffName: staffName || '',
            itemDetails: JSON.stringify({
              ptNumber: pt.ptNumber,
              clientName,
              phone: phone,
              sessionsPurchased: Number(sessionsPurchased),
              pricePerSession: Number(pricePerSession),
              totalAmount: Number(totalAmount),
              paidAmount: Number(paidAmount),
              remainingAmount: Number(remainingAmount || 0),
              coachName,
              startDate: startDate || null,
              expiryDate: expiryDate || null,
              subscriptionDays: subscriptionDays
            }),
            ptNumber: pt.ptNumber,
          },
        })

        console.log('✅ تم إنشاء الإيصال:', receipt.receiptNumber)

        // خصم النقاط إذا تم استخدامها في الدفع
        const pointsResult = await processPaymentWithPoints(
          null,  // لا يوجد memberId لـ PT
          phone,
          null,  // PT model doesn't have memberNumber field
          finalPaymentMethod,
          `دفع برايفت - ${clientName}`,
          tx
        )

        if (!pointsResult.success) {
          throw new Error(pointsResult.message || 'فشل خصم النقاط')
        }

        // ✅ إنشاء سجل عمولة للكوتش (إذا كان لديه حساب)
        if (coachUserId && paidAmount > 0) {
          try {
            const { createPTCommission } = await import('../../../lib/commissionHelpers')
            await createPTCommission(
              tx, // استخدام tx بدلاً من prisma داخل transaction
              coachUserId,
              Number(paidAmount),
              `عمولة برايفت جديد - ${clientName} (#${pt.ptNumber})`,
              pt.ptNumber
            )
          } catch (commissionError) {
            console.error('⚠️ فشل إنشاء سجل العمولة (غير حرج):', commissionError)
            // لا نفشل العملية إذا فشلت العمولة
          }
        }

        // ✅ إضافة نقاط مكافأة للعضو بناءً على المبلغ المدفوع
        // حساب المبلغ الفعلي المدفوع (بدون النقاط المستخدمة)
        const actualAmountPaid = getActualAmountPaid(finalPaymentMethod, paidAmount)

        console.log('🎁 PT Points reward check:', {
          actualAmountPaid,
          paidAmount,
          phone,
          finalPaymentMethod: typeof finalPaymentMethod === 'string' ? finalPaymentMethod : 'array'
        })

        if (actualAmountPaid > 0 && phone) {
          try {
            // البحث عن العضو بالهاتف (PT doesn't have memberNumber)
            console.log(`🔍 PT: البحث عن عضو بالهاتف: ${phone}`)
            const member = await tx.member.findFirst({
              where: { phone: phone },
              select: { id: true, name: true }
            })

            if (member) {
              console.log(`👤 PT: تم العثور على العضو: ${member.name} (${member.id})`)
              const rewardResult = await addPointsForPayment(
                member.id,
                Number(actualAmountPaid),
                `مكافأة اشتراك PT - ${clientName}`,
                tx  // ✅ تمرير tx parameter
              )

              if (rewardResult.success && rewardResult.pointsEarned && rewardResult.pointsEarned > 0) {
                console.log(`✅ PT: تمت إضافة ${rewardResult.pointsEarned} نقطة مكافأة للعضو ${member.name}`)
              } else {
                console.log(`⚠️ PT: لم تُضف نقاط:`, rewardResult)
              }
            } else {
              console.log(`⚠️ PT: لم يُعثر على عضو بهاتف ${phone}`)
            }
          } catch (rewardError) {
            console.error('⚠️ PT: فشل إضافة نقاط المكافأة (غير حرج):', rewardError)
            // لا نفشل العملية إذا فشلت المكافأة
          }
        } else {
          console.log(`⚠️ PT: لم يتم إضافة نقاط: actualAmountPaid=${actualAmountPaid}, phone=${phone}`)
        }

        // ✅ إرجاع الـ pt من الـ Transaction
        return pt
      }, {
        timeout: 15000, // ⏱️ 15 seconds timeout (increased for SQLite performance)
      })

      return NextResponse.json(pt, { status: 201 })

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
    console.error('❌ خطأ في إضافة جلسة PT:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية إضافة جلسات PT' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({ error: 'فشل إضافة جلسة PT' }, { status: 500 })
  }
}

// PUT - تحديث جلسة PT
export async function PUT(request: Request) {
  try {
    // ✅ التحقق من صلاحية تعديل PT
    await requirePermission(request, 'canEditPT')
    
    const body = await request.json()
    const { ptNumber, action, ...data } = body

    if (action === 'use_session') {
      const pt = await prisma.pT.findUnique({ where: { ptNumber: parseInt(ptNumber) } })
      
      if (!pt) {
        return NextResponse.json({ error: 'جلسة PT غير موجودة' }, { status: 404 })
      }

      if (pt.sessionsRemaining <= 0) {
        return NextResponse.json({ error: 'لا توجد جلسات متبقية' }, { status: 400 })
      }

      const updatedPT = await prisma.pT.update({
        where: { ptNumber: parseInt(ptNumber) },
        data: { sessionsRemaining: pt.sessionsRemaining - 1 },
      })

      return NextResponse.json(updatedPT)
    } else {
      // تحديث بيانات PT
      const updateData: any = {}

      // الحقول النصية
      if (data.clientName !== undefined) updateData.clientName = data.clientName
      if (data.phone !== undefined) updateData.phone = data.phone
      if (data.coachName !== undefined) updateData.coachName = data.coachName

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

      const pt = await prisma.pT.update({
        where: { ptNumber: parseInt(ptNumber) },
        data: updateData,
      })

      return NextResponse.json(pt)
    }
  } catch (error: any) {
    console.error('Error updating PT:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تعديل جلسات PT' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({ error: 'فشل تحديث جلسة PT' }, { status: 500 })
  }
}

// DELETE - حذف جلسة PT
export async function DELETE(request: Request) {
  try {
    // ✅ التحقق من صلاحية حذف PT
    await requirePermission(request, 'canDeletePT')
    
    const { searchParams } = new URL(request.url)
    const ptNumber = searchParams.get('ptNumber')

    if (!ptNumber) {
      return NextResponse.json({ error: 'رقم PT مطلوب' }, { status: 400 })
    }

    await prisma.pT.delete({ where: { ptNumber: parseInt(ptNumber) } })
    return NextResponse.json({ message: 'تم الحذف بنجاح' })
  } catch (error: any) {
    console.error('Error deleting PT:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية حذف جلسات PT' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({ error: 'فشل حذف جلسة PT' }, { status: 500 })
  }
}
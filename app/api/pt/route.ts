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
import { createAuditLog, getIpAddress, getUserAgent } from '../../../lib/auditLog'
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
      } else {
        whereClause = { coachUserId: user.userId }
      }
    } else if (coachUserIdParam) {
      // إذا تم تمرير coachUserId في الـ query، فلتر بناءً عليه
      whereClause = { coachUserId: coachUserIdParam }
    }


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
    const user = await requirePermission(request, 'canCreatePT')
    
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


        // ✅ الحصول على رقم الإيصال التالي (يضمن عدم التكرار)
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


        if (actualAmountPaid > 0 && phone) {
          try {
            // البحث عن العضو بالهاتف (PT doesn't have memberNumber)
            const member = await tx.member.findFirst({
              where: { phone: phone },
              select: { id: true, name: true }
            })

            if (member) {
              const rewardResult = await addPointsForPayment(
                member.id,
                Number(actualAmountPaid),
                `مكافأة اشتراك PT - ${clientName}`,
                tx  // ✅ تمرير tx parameter
              )

              if (rewardResult.success && rewardResult.pointsEarned && rewardResult.pointsEarned > 0) {
              } else {
              }
            } else {
            }
          } catch (rewardError) {
            console.error('⚠️ PT: فشل إضافة نقاط المكافأة (غير حرج):', rewardError)
            // لا نفشل العملية إذا فشلت المكافأة
          }
        } else {
        }

        // ✅ إرجاع الـ pt من الـ Transaction
        return pt
      }, {
        timeout: 15000, // ⏱️ 15 seconds timeout (increased for SQLite performance)
      })

      createAuditLog({
        userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
        action: 'CREATE', resource: 'PT', resourceId: String(pt.ptNumber),
        details: { ptNumber: pt.ptNumber, clientName, coachName, sessionsPurchased },
        ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
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
    const user = await requirePermission(request, 'canEditPT')
    
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

      createAuditLog({
        userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
        action: 'UPDATE', resource: 'PT', resourceId: String(updatedPT.ptNumber),
        details: { ptNumber: updatedPT.ptNumber, action: 'use_session', sessionsRemaining: updatedPT.sessionsRemaining },
        ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
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

      createAuditLog({
        userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
        action: 'UPDATE', resource: 'PT', resourceId: String(pt.ptNumber),
        details: { ptNumber: pt.ptNumber, changes: Object.keys(updateData) },
        ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
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
    const user = await requirePermission(request, 'canDeletePT')

    const { searchParams } = new URL(request.url)
    const ptNumber = searchParams.get('ptNumber')

    if (!ptNumber) {
      return NextResponse.json({ error: 'رقم PT مطلوب' }, { status: 400 })
    }

    const ptToDelete = await prisma.pT.findUnique({ where: { ptNumber: parseInt(ptNumber) }, select: { ptNumber: true, clientName: true, coachName: true } })
    await prisma.pT.delete({ where: { ptNumber: parseInt(ptNumber) } })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'DELETE', resource: 'PT', resourceId: String(ptToDelete?.ptNumber ?? ptNumber),
      details: { ptNumber: parseInt(ptNumber), clientName: ptToDelete?.clientName, coachName: ptToDelete?.coachName },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

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
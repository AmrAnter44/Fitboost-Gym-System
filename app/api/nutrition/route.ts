import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'
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

// GET - جلب كل جلسات Nutrition
export async function GET(request: Request) {
  try {
    // ✅ التحقق من صلاحية عرض Nutrition
    const user = await requirePermission(request, 'canViewNutrition')

    // جلب coachUserId من query parameters
    const { searchParams } = new URL(request.url)
    const coachUserIdParam = searchParams.get('coachUserId')


    // فلترة البيانات حسب الدور
    let whereClause: any = {}

    if (user.role === 'COACH') {
      // أخصائي التغذية يرى عملائه فقط
      // جلب اسم أخصائي التغذية من جدول Staff
      const nutritionistStaff = await prisma.staff.findFirst({
        where: {
          user: {
            id: user.userId
          }
        }
      })

      if (nutritionistStaff) {
        // البحث بناءً على coachUserId أو nutritionistName كـ fallback
        whereClause = {
          OR: [
            { coachUserId: user.userId },
            { nutritionistName: nutritionistStaff.name }
          ]
        }
      } else {
        whereClause = { coachUserId: user.userId }
      }
    } else if (coachUserIdParam) {
      // إذا تم تمرير coachUserId في الـ query، فلتر بناءً عليه
      whereClause = { coachUserId: coachUserIdParam }
    }


    const nutritionSessions = await prisma.nutrition.findMany({
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

    return NextResponse.json(nutritionSessions)
  } catch (error: any) {
    console.error('Error fetching Nutrition sessions:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية عرض جلسات التغذية' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل جلب جلسات التغذية' }, { status: 500 })
  }
}

// POST - إضافة جلسة Nutrition جديدة
export async function POST(request: Request) {
  try {
    // ✅ التحقق من صلاحية إنشاء Nutrition
    const user = await requirePermission(request, 'canCreateNutrition')

    const body = await request.json()
    const {
      nutritionNumber,
      clientName,
      phone,
      memberNumber,
      sessionsPurchased,
      nutritionistName,
      totalPrice,
      remainingAmount,
      startDate,
      expiryDate,
      paymentMethod,
      staffName,
      referralCoachId
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

    if (!nutritionistName || nutritionistName.trim() === '') {
      return NextResponse.json(
        { error: 'اسم أخصائي التغذية مطلوب' },
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

    // التحقق من أن رقم Nutrition غير مستخدم (فقط إذا تم إدخاله يدوياً وليس سالب)
    // الأرقام السالبة تُستخدم للـ Day Use ولا تُعتبر أرقام Nutrition حقيقية
    if (nutritionNumber && parseInt(nutritionNumber) > 0) {
      const existingNutrition = await prisma.nutrition.findUnique({
        where: { nutritionNumber: parseInt(nutritionNumber) }
      })

      if (existingNutrition) {
        console.error('❌ رقم Nutrition مستخدم:', nutritionNumber)
        return NextResponse.json(
          { error: `رقم Nutrition ${nutritionNumber} مستخدم بالفعل` },
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

    // البحث عن أخصائي التغذية بالاسم لربط coachUserId
    let coachUserId = null
    if (nutritionistName) {
      const nutritionistStaff = await prisma.staff.findFirst({
        where: { name: nutritionistName },
        include: { user: true }
      })

      if (nutritionistStaff && nutritionistStaff.user) {
        coachUserId = nutritionistStaff.user.id
      } else {
        console.warn(`⚠️ لم يتم العثور على حساب مستخدم لأخصائي التغذية: ${nutritionistName}`)
      }
    }

    // توليد Barcode من 16 رقم عشوائي
    let barcodeText = ''
    let isUnique = false

    // التأكد من أن الـ barcode فريد
    while (!isUnique) {
      barcodeText = Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join('')
      const existing = await prisma.nutrition.findUnique({
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

    // إنشاء جلسة Nutrition
    const nutritionData: any = {
      clientName,
      phone,
      sessionsPurchased,
      sessionsRemaining: sessionsPurchased,
      nutritionistName,
      coachUserId,  // ✅ ربط أخصائي التغذية بـ userId
      pricePerSession,
      remainingAmount: remainingAmount || 0,  // ✅ الباقي من الفلوس
      startDate: startDate ? new Date(startDate) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      qrCode: barcodeText,
      qrCodeImage: qrCodeImage
    }

    // إضافة nutritionNumber
    if (nutritionNumber) {
      const nutritionNum = parseInt(nutritionNumber)

      // إذا كان الرقم سالب (Day Use)، ابحث عن أول رقم سالب متاح
      if (nutritionNum < 0) {
        let availableNumber = -1
        let found = false

        // البحث عن أول رقم سالب متاح
        while (!found) {
          const existing = await prisma.nutrition.findUnique({
            where: { nutritionNumber: availableNumber }
          })

          if (!existing) {
            found = true
            nutritionData.nutritionNumber = availableNumber
          } else {
            availableNumber-- // جرب الرقم التالي (-2, -3, ...)
          }
        }
      } else {
        // رقم موجب عادي
        nutritionData.nutritionNumber = nutritionNum
      }
    }

    // الحصول على إعدادات Referral
    const systemSettings = await prisma.systemSettings.findUnique({
      where: { id: 'singleton' }
    })

    const nutritionReferralEnabled = systemSettings?.nutritionReferralEnabled ?? false
    const nutritionReferralPercentage = systemSettings?.nutritionReferralPercentage ?? 0

    // إنشاء إيصال باستخدام Transaction
    try {
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
      const nutrition = await prisma.$transaction(async (tx) => {
        // ✅ إنشاء جلسة Nutrition داخل الـ Transaction لضمان Atomicity
        const nutrition = await tx.nutrition.create({
          data: nutritionData,
        })


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
        const receiptType = nutrition.nutritionNumber < 0 ? RECEIPT_TYPES.NUTRITION_DAY_USE : RECEIPT_TYPES.NEW_NUTRITION

        const receipt = await tx.receipt.create({
          data: {
            receiptNumber: receiptNumber,
            type: receiptType,
            amount: Number(paidAmount),
            paymentMethod: finalPaymentMethod,
            staffName: staffName || '',
            itemDetails: JSON.stringify({
              nutritionNumber: nutrition.nutritionNumber,
              clientName,
              phone: phone,
              sessionsPurchased: Number(sessionsPurchased),
              pricePerSession: Number(pricePerSession),
              totalAmount: Number(totalAmount),
              paidAmount: Number(paidAmount),
              remainingAmount: Number(remainingAmount || 0),
              nutritionistName,
              startDate: startDate || null,
              expiryDate: expiryDate || null,
              subscriptionDays: subscriptionDays
            }),
            nutritionNumber: nutrition.nutritionNumber,
          },
        })


        // خصم النقاط إذا تم استخدامها في الدفع
        const pointsResult = await processPaymentWithPoints(
          null,  // لا يوجد memberId لـ Nutrition
          phone,
          memberNumber,  // ✅ تمرير رقم العضوية للبحث عن العضو
          finalPaymentMethod,
          `دفع تغذية - ${clientName}`,
          tx
        )

        if (!pointsResult.success) {
          throw new Error(pointsResult.message || 'فشل خصم النقاط')
        }

        // ✅ إضافة نقاط مكافأة للعضو بناءً على المبلغ المدفوع
        // حساب المبلغ الفعلي المدفوع (بدون النقاط المستخدمة)
        const actualAmountPaid = getActualAmountPaid(finalPaymentMethod, paidAmount)


        if (actualAmountPaid > 0 && (memberNumber || phone)) {
          try {
            // البحث عن العضو برقم العضوية أولاً، ثم بالهاتف
            let member = null
            if (memberNumber) {
              member = await tx.member.findUnique({
                where: { memberNumber: parseInt(memberNumber) },
                select: { id: true, name: true }
              })
            }

            // إذا لم يُعثر على العضو برقم العضوية، نبحث بالهاتف
            if (!member && phone) {
              member = await tx.member.findFirst({
                where: { phone: phone },
                select: { id: true, name: true }
              })
            }

            if (member) {
              const rewardResult = await addPointsForPayment(
                member.id,
                Number(actualAmountPaid),
                `مكافأة اشتراك تغذية - ${clientName}`,
                tx
              )

              if (rewardResult.success && rewardResult.pointsEarned && rewardResult.pointsEarned > 0) {
              } else {
              }
            } else {
            }
          } catch (rewardError) {
            console.error('⚠️ فشل إضافة نقاط المكافأة (غير حرج):', rewardError)
            // لا نفشل العملية إذا فشلت المكافأة
          }
        } else {
        }

        // ✅ إنشاء سجل عمولة لأخصائي التغذية (إذا كان لديه حساب)
        if (coachUserId && paidAmount > 0) {
          try {
            const { createPTCommission } = await import('../../../lib/commissionHelpers')
            await createPTCommission(
              tx, // استخدام tx بدلاً من prisma داخل transaction
              coachUserId,
              Number(paidAmount),
              `عمولة تغذية جديد - ${clientName} (#${nutrition.nutritionNumber})`,
              nutrition.nutritionNumber
            )
          } catch (commissionError) {
            console.error('⚠️ فشل إنشاء سجل العمولة (غير حرج):', commissionError)
            // لا نفشل العملية إذا فشلت العمولة
          }
        }

        // ✅ إنشاء عمولة Referral للكوتش الذي سوّق الخدمة
        if (nutritionReferralEnabled && referralCoachId && totalAmount > 0) {
          try {
            const commissionAmount = (totalAmount * nutritionReferralPercentage) / 100

            if (commissionAmount > 0) {
              await tx.commission.create({
                data: {
                  staffId: referralCoachId,
                  amount: commissionAmount,
                  type: 'nutrition_referral',
                  description: `عمولة Referral تغذية - ${clientName} - ${nutritionReferralPercentage}% من ${totalAmount.toFixed(2)} ج.م (#${nutrition.nutritionNumber})`
                }
              })
            }
          } catch (referralError) {
            console.error('⚠️ فشل إنشاء عمولة Referral (غير حرج):', referralError)
            // لا نفشل العملية إذا فشلت العمولة
          }
        }

        // ✅ إرجاع الـ nutrition من الـ Transaction
        return nutrition
      }, {
        timeout: 15000, // ⏱️ 15 seconds timeout (increased for SQLite performance)
      })

      createAuditLog({
        userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
        action: 'CREATE', resource: 'System', resourceId: String(nutrition.nutritionNumber),
        details: { type: 'Nutrition', nutritionNumber: nutrition.nutritionNumber, clientName, sessionsPurchased, totalPrice: sessionsPurchased * pricePerSession, paidAmount: (sessionsPurchased * pricePerSession) - (remainingAmount || 0) },
        ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
      })

      return NextResponse.json(nutrition, { status: 201 })

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
    console.error('❌ خطأ في إضافة جلسة Nutrition:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية إضافة جلسات التغذية' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل إضافة جلسة التغذية' }, { status: 500 })
  }
}

// PUT - تحديث جلسة Nutrition
export async function PUT(request: Request) {
  try {
    // ✅ التحقق من صلاحية تعديل Nutrition
    await requirePermission(request, 'canEditNutrition')

    const body = await request.json()
    const { nutritionNumber, action, ...data } = body

    if (action === 'use_session') {
      const nutrition = await prisma.nutrition.findUnique({ where: { nutritionNumber: parseInt(nutritionNumber) } })

      if (!nutrition) {
        return NextResponse.json({ error: 'جلسة Nutrition غير موجودة' }, { status: 404 })
      }

      if (nutrition.sessionsRemaining <= 0) {
        return NextResponse.json({ error: 'لا توجد جلسات متبقية' }, { status: 400 })
      }

      const updatedNutrition = await prisma.nutrition.update({
        where: { nutritionNumber: parseInt(nutritionNumber) },
        data: { sessionsRemaining: nutrition.sessionsRemaining - 1 },
      })

      return NextResponse.json(updatedNutrition)
    } else {
      // تحديث بيانات Nutrition
      const updateData: any = {}

      // الحقول النصية
      if (data.clientName !== undefined) updateData.clientName = data.clientName
      if (data.phone !== undefined) updateData.phone = data.phone
      if (data.nutritionistName !== undefined) updateData.nutritionistName = data.nutritionistName

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

      const nutrition = await prisma.nutrition.update({
        where: { nutritionNumber: parseInt(nutritionNumber) },
        data: updateData,
      })

      return NextResponse.json(nutrition)
    }
  } catch (error: any) {
    console.error('Error updating Nutrition:', error)

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

    return NextResponse.json({ error: 'فشل تحديث جلسة التغذية' }, { status: 500 })
  }
}

// DELETE - حذف جلسة Nutrition
export async function DELETE(request: Request) {
  try {
    // ✅ التحقق من صلاحية حذف Nutrition
    await requirePermission(request, 'canDeleteNutrition')

    const { searchParams } = new URL(request.url)
    const nutritionNumber = searchParams.get('nutritionNumber')

    if (!nutritionNumber) {
      return NextResponse.json({ error: 'رقم Nutrition مطلوب' }, { status: 400 })
    }

    await prisma.nutrition.delete({ where: { nutritionNumber: parseInt(nutritionNumber) } })
    return NextResponse.json({ message: 'تم الحذف بنجاح' })
  } catch (error: any) {
    console.error('Error deleting Nutrition:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية حذف جلسات التغذية' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل حذف جلسة التغذية' }, { status: 500 })
  }
}

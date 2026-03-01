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
// @ts-ignore
import bwipjs from 'bwip-js'

export const dynamic = 'force-dynamic'

// GET - جلب كل جلسات GroupClass
export async function GET(request: Request) {
  try {
    // ✅ التحقق من صلاحية عرض GroupClass
    const user = await requirePermission(request, 'canViewGroupClass')

    // جلب instructorUserId من query parameters
    const { searchParams } = new URL(request.url)
    const instructorUserIdParam = searchParams.get('instructorUserId')


    // فلترة البيانات حسب الدور
    let whereClause: any = {}

    if (user.role === 'COACH') {
      // المدرب يرى عملائه فقط
      // جلب اسم المدرب من جدول Staff
      const instructorStaff = await prisma.staff.findFirst({
        where: {
          user: {
            id: user.userId
          }
        }
      })

      if (instructorStaff) {
        // البحث بناءً على instructorUserId أو instructorName كـ fallback
        whereClause = {
          OR: [
            { instructorUserId: user.userId },
            { instructorName: instructorStaff.name }
          ]
        }
      } else {
        whereClause = { instructorUserId: user.userId }
      }
    } else if (instructorUserIdParam) {
      // إذا تم تمرير instructorUserId في الـ query، فلتر بناءً عليه
      whereClause = { instructorUserId: instructorUserIdParam }
    }


    const groupClassSessions = await prisma.groupClass.findMany({
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

    return NextResponse.json(groupClassSessions)
  } catch (error: any) {
    console.error('Error fetching GroupClass sessions:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية عرض جلسات جروب كلاسيس' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل جلب جلسات جروب كلاسيس' }, { status: 500 })
  }
}

// POST - إضافة جلسة GroupClass جديدة
export async function POST(request: Request) {
  try {
    // ✅ التحقق من صلاحية إنشاء GroupClass
    await requirePermission(request, 'canCreateGroupClass')

    const body = await request.json()
    const {
      classNumber,
      clientName,
      phone,
      memberNumber,
      sessionsPurchased,
      instructorName,
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

    // التحقق من أن رقم GroupClass غير مستخدم (فقط إذا تم إدخاله يدوياً وليس سالب)
    // الأرقام السالبة تُستخدم للـ Day Use ولا تُعتبر أرقام GroupClass حقيقية
    if (classNumber && parseInt(classNumber) > 0) {
      const existingGroupClass = await prisma.groupClass.findUnique({
        where: { classNumber: parseInt(classNumber) }
      })

      if (existingGroupClass) {
        console.error('❌ رقم GroupClass مستخدم:', classNumber)
        return NextResponse.json(
          { error: `رقم GroupClass ${classNumber} مستخدم بالفعل` },
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

    // البحث عن المدرب بالاسم لربط instructorUserId
    let instructorUserId = null
    if (instructorName) {
      const instructorStaff = await prisma.staff.findFirst({
        where: { name: instructorName },
        include: { user: true }
      })

      if (instructorStaff && instructorStaff.user) {
        instructorUserId = instructorStaff.user.id
      } else {
        console.warn(`⚠️ لم يتم العثور على حساب مستخدم للمدرب: ${instructorName}`)
      }
    }

    // توليد Barcode من 16 رقم عشوائي
    let barcodeText = ''
    let isUnique = false

    // التأكد من أن الـ barcode فريد
    while (!isUnique) {
      barcodeText = Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join('')
      const existing = await prisma.groupClass.findUnique({
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

    // إنشاء جلسة GroupClass
    const groupClassData: any = {
      clientName,
      phone,
      sessionsPurchased,
      sessionsRemaining: sessionsPurchased,
      instructorName,
      instructorUserId,  // ✅ ربط المدرب بـ userId
      pricePerSession,
      remainingAmount: remainingAmount || 0,  // ✅ الباقي من الفلوس
      startDate: startDate ? new Date(startDate) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      qrCode: barcodeText,
      qrCodeImage: qrCodeImage
    }

    // إضافة classNumber
    if (classNumber) {
      const classNum = parseInt(classNumber)

      // إذا كان الرقم سالب (Day Use)، ابحث عن أول رقم سالب متاح
      if (classNum < 0) {
        let availableNumber = -1
        let found = false

        // البحث عن أول رقم سالب متاح
        while (!found) {
          const existing = await prisma.groupClass.findUnique({
            where: { classNumber: availableNumber }
          })

          if (!existing) {
            found = true
            groupClassData.classNumber = availableNumber
          } else {
            availableNumber-- // جرب الرقم التالي (-2, -3, ...)
          }
        }
      } else {
        // رقم موجب عادي
        groupClassData.classNumber = classNum
      }
    }

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
      const groupClass = await prisma.$transaction(async (tx) => {
        // ✅ إنشاء جلسة GroupClass داخل الـ Transaction لضمان Atomicity
        const groupClass = await tx.groupClass.create({
          data: groupClassData,
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
        const receiptType = groupClass.classNumber < 0 ? RECEIPT_TYPES.GROUP_CLASS_DAY_USE : RECEIPT_TYPES.NEW_GROUP_CLASS

        const receipt = await tx.receipt.create({
          data: {
            receiptNumber: receiptNumber,
            type: receiptType,
            amount: Number(paidAmount),
            paymentMethod: finalPaymentMethod,
            staffName: staffName || '',
            itemDetails: JSON.stringify({
              classNumber: groupClass.classNumber,
              clientName,
              phone: phone,
              sessionsPurchased: Number(sessionsPurchased),
              pricePerSession: Number(pricePerSession),
              totalAmount: Number(totalAmount),
              paidAmount: Number(paidAmount),
              remainingAmount: Number(remainingAmount || 0),
              instructorName,
              startDate: startDate || null,
              expiryDate: expiryDate || null,
              subscriptionDays: subscriptionDays
            }),
            classNumber: groupClass.classNumber,
          },
        })


        // خصم النقاط إذا تم استخدامها في الدفع
        const pointsResult = await processPaymentWithPoints(
          null,  // لا يوجد memberId لـ GroupClass
          phone,
          memberNumber,  // ✅ تمرير رقم العضوية للبحث عن العضو
          finalPaymentMethod,
          `دفع جروب كلاسيس - ${clientName}`,
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
                `مكافأة اشتراك جروب كلاسيس - ${clientName}`,
                tx
              )

              if (rewardResult.success && rewardResult.pointsEarned && rewardResult.pointsEarned > 0) {
              } else {
              }
            } else {
            }
          } catch (rewardError) {
            console.error('⚠️ GroupClass: فشل إضافة نقاط المكافأة (غير حرج):', rewardError)
            // لا نفشل العملية إذا فشلت المكافأة
          }
        } else {
        }

        // ✅ إنشاء سجل عمولة للمدرب (إذا كان لديه حساب)
        if (instructorUserId && paidAmount > 0) {
          try {
            const { createPTCommission } = await import('../../../lib/commissionHelpers')
            await createPTCommission(
              tx, // استخدام tx بدلاً من prisma داخل transaction
              instructorUserId,
              Number(paidAmount),
              `عمولة جروب كلاسيس جديد - ${clientName} (#${groupClass.classNumber})`,
              groupClass.classNumber
            )
          } catch (commissionError) {
            console.error('⚠️ فشل إنشاء سجل العمولة (غير حرج):', commissionError)
            // لا نفشل العملية إذا فشلت العمولة
          }
        }

        // ✅ إرجاع الـ groupClass من الـ Transaction
        return groupClass
      }, {
        timeout: 15000, // ⏱️ 15 seconds timeout (increased for SQLite performance)
      })

      return NextResponse.json(groupClass, { status: 201 })

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
    console.error('❌ خطأ في إضافة جلسة GroupClass:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية إضافة جلسات جروب كلاسيس' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل إضافة جلسة جروب كلاسيس' }, { status: 500 })
  }
}

// PUT - تحديث جلسة GroupClass
export async function PUT(request: Request) {
  try {
    // ✅ التحقق من صلاحية تعديل GroupClass
    await requirePermission(request, 'canEditGroupClass')

    const body = await request.json()
    const { classNumber, action, ...data } = body

    if (action === 'use_session') {
      const groupClass = await prisma.groupClass.findUnique({ where: { classNumber: parseInt(classNumber) } })

      if (!groupClass) {
        return NextResponse.json({ error: 'جلسة GroupClass غير موجودة' }, { status: 404 })
      }

      if (groupClass.sessionsRemaining <= 0) {
        return NextResponse.json({ error: 'لا توجد جلسات متبقية' }, { status: 400 })
      }

      const updatedGroupClass = await prisma.groupClass.update({
        where: { classNumber: parseInt(classNumber) },
        data: { sessionsRemaining: groupClass.sessionsRemaining - 1 },
      })

      return NextResponse.json(updatedGroupClass)
    } else {
      // تحديث بيانات GroupClass
      const updateData: any = {}

      // الحقول النصية
      if (data.clientName !== undefined) updateData.clientName = data.clientName
      if (data.phone !== undefined) updateData.phone = data.phone
      if (data.instructorName !== undefined) updateData.instructorName = data.instructorName

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

      const groupClass = await prisma.groupClass.update({
        where: { classNumber: parseInt(classNumber) },
        data: updateData,
      })

      return NextResponse.json(groupClass)
    }
  } catch (error: any) {
    console.error('Error updating GroupClass:', error)

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

    return NextResponse.json({ error: 'فشل تحديث جلسة جروب كلاسيس' }, { status: 500 })
  }
}

// DELETE - حذف جلسة GroupClass
export async function DELETE(request: Request) {
  try {
    // ✅ التحقق من صلاحية حذف GroupClass
    await requirePermission(request, 'canDeleteGroupClass')

    const { searchParams } = new URL(request.url)
    const classNumber = searchParams.get('classNumber')

    if (!classNumber) {
      return NextResponse.json({ error: 'رقم GroupClass مطلوب' }, { status: 400 })
    }

    await prisma.groupClass.delete({ where: { classNumber: parseInt(classNumber) } })
    return NextResponse.json({ message: 'تم الحذف بنجاح' })
  } catch (error: any) {
    console.error('Error deleting GroupClass:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية حذف جلسات جروب كلاسيس' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل حذف جلسة جروب كلاسيس' }, { status: 500 })
  }
}

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

export const dynamic = 'force-dynamic'

// GET - جلب جميع اشتراكات More
export async function GET(request: Request) {
  try {
    // ✅ التحقق من صلاحية عرض More
    const user = await requirePermission(request, 'canViewMore')

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

    const moreSubscriptions = await prisma.more.findMany({
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

    return NextResponse.json(moreSubscriptions)
  } catch (error: any) {
    console.error('Error fetching More subscriptions:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية عرض خدمة مزيد' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل جلب اشتراكات مزيد' }, { status: 500 })
  }
}

// POST - إضافة اشتراك More جديد
export async function POST(request: Request) {
  try {
    // ✅ التحقق من صلاحية إنشاء اشتراك More
    const user = await requirePermission(request, 'canViewMore')

    const body = await request.json()
    const {
      clientName,
      phone,
      memberId,
      sessionsPurchased: sessionsPurchasedRaw,
      coachName,
      totalPrice: totalPriceRaw,
      remainingAmount: remainingAmountRaw,
      startDate,
      expiryDate,
      notes,
      paymentMethod,
      staffName,
      moreCommissionAmount  // 💰 عمولة المدرب من الباقة (اختياري)
    } = body

    // تحويل القيم إلى Numbers
    const sessionsPurchased = parseInt(sessionsPurchasedRaw) || 0
    const totalPrice = parseFloat(totalPriceRaw) || 0
    const remainingAmount = parseFloat(remainingAmountRaw) || 0

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
        { error: 'اسم المدرب مطلوب' },
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

    // 💰 جلب إعدادات العمولة من الـ System Settings
    const systemSettings = await prisma.systemSettings.findUnique({
      where: { id: 'singleton' }
    })

    // البحث عن المدرب بالاسم لربط coachUserId
    let coachUserId = null
    if (coachName) {
      const coachStaff = await prisma.staff.findFirst({
        where: { name: coachName },
        include: { user: true }
      })

      if (coachStaff && coachStaff.user) {
        coachUserId = coachStaff.user.id
      } else {
      }
    }

    // إنشاء بيانات More
    const moreData: any = {
      clientName,
      phone,
      memberId: memberId || null,
      sessionsPurchased,
      sessionsRemaining: sessionsPurchased,
      coachName,
      coachUserId,  // ✅ ربط المدرب بـ userId
      pricePerSession,
      totalAmount: totalPrice,
      remainingAmount: remainingAmount,
      startDate: startDate ? new Date(startDate) : new Date(),
      expiryDate: expiryDate ? new Date(expiryDate) : new Date(),
      notes: notes || null
    }

    // إنشاء إيصال باستخدام Transaction
    try {
      const totalAmount = sessionsPurchased * pricePerSession
      const paidAmount = totalAmount - remainingAmount

      let subscriptionDays = null
      if (startDate && expiryDate) {
        const start = new Date(startDate)
        const end = new Date(expiryDate)
        subscriptionDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      }

      // استخدام Transaction
      const more = await prisma.$transaction(async (tx) => {
        // ✅ إنشاء اشتراك More داخل الـ Transaction
        const more = await tx.more.create({
          data: moreData,
        })

        // ✅ الحصول على رقم الإيصال التالي
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
        const receipt = await tx.receipt.create({
          data: {
            receiptNumber: receiptNumber,
            type: RECEIPT_TYPES.MORE_SUBSCRIPTION,
            amount: Number(paidAmount),
            paymentMethod: finalPaymentMethod,
            staffName: staffName || '',
            itemDetails: JSON.stringify({
              moreNumber: more.moreNumber,
              clientName,
              phone: phone,
              memberId: memberId || null,
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
            moreNumber: more.moreNumber,
          },
        })

        // خصم النقاط إذا تم استخدامها في الدفع
        const pointsResult = await processPaymentWithPoints(
          null,  // لا يوجد memberId
          phone,
          null,
          finalPaymentMethod,
          `اشتراك مزيد - ${clientName}`,
          tx
        )

        if (!pointsResult.success) {
          throw new Error(pointsResult.message || 'فشل خصم النقاط')
        }

        // 💰 إنشاء سجل عمولة للمدرب (إذا كان لديه حساب)
        const moreCommissionEnabled = systemSettings?.moreCommissionEnabled ?? true
        const defaultMoreCommissionAmount = systemSettings?.moreCommissionAmount ?? 50

        if (coachUserId && paidAmount > 0 && moreCommissionEnabled) {
          try {
            // 🎯 Smart fallback للعمولة: عمولة الباقة → عمولة الإعدادات → 50 جنيه
            const finalCommissionAmount =
              moreCommissionAmount && moreCommissionAmount > 0
                ? moreCommissionAmount  // من الباقة
                : defaultMoreCommissionAmount  // من الإعدادات أو 50 fallback

            await tx.commission.create({
              data: {
                staffId: coachUserId,
                amount: finalCommissionAmount,
                type: 'more_signup',
                description: `عمولة اشتراك مزيد - ${clientName} (#${more.moreNumber})`,
                notes: JSON.stringify({
                  moreNumber: more.moreNumber,
                  clientName,
                  commissionAmount: finalCommissionAmount,
                  source: moreCommissionAmount && moreCommissionAmount > 0 ? 'package' : 'settings'
                })
              }
            })
          } catch (commissionError) {
            console.error('⚠️ فشل إنشاء سجل العمولة (غير حرج):', commissionError)
          }
        }

        // ✅ إضافة نقاط مكافأة للعضو بناءً على المبلغ المدفوع (إذا كان عضواً مسجلاً)
        const actualAmountPaid = getActualAmountPaid(finalPaymentMethod, paidAmount)

        if (actualAmountPaid > 0) {
          try {
            // التحقق من وجود العضو أولاً
            const member = memberId
              ? await tx.member.findUnique({ where: { id: memberId } })
              : await tx.member.findFirst({ where: { phone } })

            if (member) {
              await addPointsForPayment(
                member.id,
                actualAmountPaid,
                `دفع اشتراك مزيد - ${clientName}`,
                tx
              )
            } else {
            }
          } catch (pointsError) {
            console.error('⚠️ فشل إضافة نقاط المكافأة (غير حرج):', pointsError)
          }
        }

        return more
      }, {
        maxWait: 60000,  // 60 ثانية
        timeout: 60000,  // 60 ثانية
      })

      // ✅ Audit log خارج Transaction (غير حرج)
      createAuditLog({
        userId: user.userId,
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        action: 'CREATE',
        resource: 'More',
        resourceId: more.moreNumber.toString(),
        details: {
          clientName,
          phone,
          sessionsPurchased,
          coachName,
          totalAmount,
          paidAmount
        },
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request),
        status: 'success'
      }).catch(err => console.error('⚠️ فشل Audit Log:', err))

      return NextResponse.json({
        message: 'تم إضافة اشتراك مزيد بنجاح',
        moreNumber: more.moreNumber,
        more
      })
    } catch (transactionError: any) {
      console.error('❌ فشل Transaction:', transactionError)
      return NextResponse.json(
        { error: transactionError.message || 'فشل إنشاء اشتراك مزيد' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Error creating More subscription:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية إضافة اشتراك مزيد' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل إضافة اشتراك مزيد' }, { status: 500 })
  }
}

// PUT - تحديث اشتراك More أو استخدام جلسة
export async function PUT(request: Request) {
  try {
    const user = await requirePermission(request, 'canViewMore')
    const body = await request.json()
    const { moreNumber, action, ...updateData } = body

    if (!moreNumber) {
      return NextResponse.json(
        { error: 'رقم الاشتراك مطلوب' },
        { status: 400 }
      )
    }

    // جلب بيانات الاشتراك
    const existingMore = await prisma.more.findUnique({
      where: { moreNumber: parseInt(moreNumber) }
    })

    if (!existingMore) {
      return NextResponse.json(
        { error: 'الاشتراك غير موجود' },
        { status: 404 }
      )
    }

    // التحقق من الصلاحية للكوتش
    if (user.role === 'COACH' && existingMore.coachUserId !== user.userId) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تعديل هذا الاشتراك' },
        { status: 403 }
      )
    }

    // تحديث البيانات — whitelist للحقول المسموح بتعديلها
    const allowedFields: any = {}
    if (updateData.clientName !== undefined) allowedFields.clientName = String(updateData.clientName)
    if (updateData.phone !== undefined) allowedFields.phone = String(updateData.phone)
    if (updateData.coachName !== undefined) allowedFields.coachName = String(updateData.coachName)
    if (updateData.sessionsPurchased !== undefined) allowedFields.sessionsPurchased = parseInt(updateData.sessionsPurchased)
    if (updateData.sessionsRemaining !== undefined) allowedFields.sessionsRemaining = parseInt(updateData.sessionsRemaining)
    if (updateData.pricePerSession !== undefined) allowedFields.pricePerSession = parseFloat(updateData.pricePerSession)
    if (updateData.totalAmount !== undefined) allowedFields.totalAmount = parseFloat(updateData.totalAmount)
    if (updateData.remainingAmount !== undefined) allowedFields.remainingAmount = parseFloat(updateData.remainingAmount)
    if (updateData.notes !== undefined) allowedFields.notes = updateData.notes ? String(updateData.notes) : null
    if (updateData.startDate) allowedFields.startDate = new Date(updateData.startDate)
    if (updateData.expiryDate) allowedFields.expiryDate = new Date(updateData.expiryDate)
    if (updateData.isActive !== undefined) allowedFields.isActive = Boolean(updateData.isActive)

    const updatedMore = await prisma.more.update({
      where: { moreNumber: parseInt(moreNumber) },
      data: allowedFields
    })

    // Audit log
    await createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      action: 'UPDATE',
      resource: 'More',
      resourceId: moreNumber.toString(),
      details: updateData,
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
      status: 'success'
    })

    return NextResponse.json({
      message: 'تم تحديث الاشتراك بنجاح',
      more: updatedMore
    })
  } catch (error: any) {
    console.error('Error updating More subscription:', error)
    return NextResponse.json(
      { error: 'فشل تحديث الاشتراك' },
      { status: 500 }
    )
  }
}

// DELETE - حذف اشتراك More
export async function DELETE(request: Request) {
  try {
    const user = await requirePermission(request, 'canDeleteMore')
    const { searchParams } = new URL(request.url)
    const moreNumber = searchParams.get('moreNumber')

    if (!moreNumber) {
      return NextResponse.json(
        { error: 'رقم الاشتراك مطلوب' },
        { status: 400 }
      )
    }

    // حذف الاشتراك (cascade delete للجلسات)
    await prisma.more.delete({
      where: { moreNumber: parseInt(moreNumber) }
    })

    // Audit log
    await createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      action: 'DELETE',
      resource: 'More',
      resourceId: moreNumber,
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
      status: 'success'
    })

    return NextResponse.json({
      message: 'تم حذف الاشتراك بنجاح'
    })
  } catch (error: any) {
    console.error('Error deleting More subscription:', error)
    return NextResponse.json(
      { error: 'فشل حذف الاشتراك' },
      { status: 500 }
    )
  }
}

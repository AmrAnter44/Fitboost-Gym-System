// app/api/members/renew/route.ts - مع إضافة staffName والصلاحيات
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'
import {
  type PaymentMethod,
  validatePaymentDistribution,
  serializePaymentMethods
} from '../../../../lib/paymentHelpers'
import { processPaymentWithPoints } from '../../../../lib/paymentProcessor'
import { addPointsForPayment } from '../../../../lib/points'
import { RECEIPT_TYPES } from '../../../../lib/receiptTypes'
import { getNextReceiptNumberDirect } from '../../../../lib/receiptHelpers'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'
import { logError } from '../../../../lib/errorLogger'

export const dynamic = 'force-dynamic'

// POST - تجديد اشتراك عضو
export async function POST(request: Request) {
  try {
    // ✅ تجديد عضو متاح لأي موظف مسجّل دخول (مش الكوتش)
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (user.role === 'COACH') {
      return NextResponse.json({ error: 'الكوتش غير مسموح له بتجديد الاشتراكات' }, { status: 403 })
    }
    
    const body = await request.json()
    const {
      memberId,
      subscriptionPrice,
      remainingAmount,
      remainingDueDate,
      freePTSessions,
      freeNutritionSessions,
      freePhysioSessions,
      freeGroupClassSessions,
      inBodyScans,
      invitations,
      remainingFreezeDays,
      startDate,
      expiryDate,
      notes,
      paymentMethod,
      staffName,
      offerId         // 📦 الباقة المطبَّقة عند التجديد (لو فيه)
    } = body


    // جلب بيانات العضو + اسم السيلز عشان يظهر في الإيصال
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: { salesStaff: { select: { name: true } } }
    })

    if (!member) {
      return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })
    }

    // التحقق من الحظر
    {
      const phone = member.phone?.trim() || null
      const nationalId = (member as any).nationalId?.trim() || null
      if (phone || nationalId) {
        const bannedResults = await prisma.$queryRawUnsafe<Array<{id: string}>>(
          `SELECT id FROM BannedMember WHERE (phone IS NOT NULL AND phone = ?) OR (nationalId IS NOT NULL AND nationalId = ?) LIMIT 1`,
          phone, nationalId
        )
        if (bannedResults[0]) {
          return NextResponse.json({ error: 'هذا العضو محظور ولا يمكن تجديد اشتراكه' }, { status: 403 })
        }
      }
    }

    // 🔄 سياسة التجديد: بنصفّر البينفيتس القديمة ونحط بس اللي جاي مع الباقة الجديدة
    //   (مش بنجمعهم) — لأن الفورم بيبعت اللي مع الباقة، ولو جمعنا هيتضاعف.
    //   بنحتفظ بالقيم القديمة (previous*) عشان تظهر في الإيصال للشفافية.
    const currentFreePT = member.freePTSessions || 0
    const additionalFreePT = freePTSessions || 0
    const totalFreePT = additionalFreePT

    const currentInBody = member.inBodyScans || 0
    const additionalInBody = inBodyScans || 0
    const totalInBody = additionalInBody

    const currentInvitations = member.invitations || 0
    const additionalInvitations = invitations || 0
    const totalInvitations = additionalInvitations

    const currentFreezeDays = member.remainingFreezeDays || 0
    const additionalFreezeDays = remainingFreezeDays || 0
    const totalFreezeDays = additionalFreezeDays

    const currentNutritionSessions = member.freeNutritionSessions || 0
    const additionalNutritionSessions = freeNutritionSessions || 0
    const totalNutritionSessions = additionalNutritionSessions

    const currentPhysioSessions = member.freePhysioSessions || 0
    const additionalPhysioSessions = freePhysioSessions || 0
    const totalPhysioSessions = additionalPhysioSessions

    const currentGroupClassSessions = member.freeGroupClassSessions || 0
    const additionalGroupClassSessions = freeGroupClassSessions || 0
    const totalGroupClassSessions = additionalGroupClassSessions


    // ✅ حساب isActive: العضو نشط طالما اشتراكه ما انتهاش (حتى لو ما بدأش بعد)
    const renewToday = new Date()
    renewToday.setHours(0, 0, 0, 0)
    const renewExpiry = expiryDate ? new Date(expiryDate) : null
    if (renewExpiry) renewExpiry.setHours(0, 0, 0, 0)
    const renewIsActive = !renewExpiry || renewExpiry >= renewToday

    // تحديث بيانات العضو
    const updatedMember = await prisma.member.update({
      where: { id: memberId },
      data: {
        subscriptionPrice,
        remainingAmount: remainingAmount || 0,
        remainingDueDate: remainingDueDate ? new Date(remainingDueDate) : null,
        freePTSessions: totalFreePT,
        freeNutritionSessions: totalNutritionSessions,
        freePhysioSessions: totalPhysioSessions,
        freeGroupClassSessions: totalGroupClassSessions,
        inBodyScans: totalInBody,
        invitations: totalInvitations,
        remainingFreezeDays: totalFreezeDays,
        startDate: startDate ? new Date(startDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        isActive: renewIsActive,
        notes: notes || member.notes,
        // 📦 تحديث الباقة لو اتبعت من التجديد (لو مش موجودة سيبها زي ما هي)
        ...(offerId ? { offerId } : {}),
      },
    })


    // إنشاء إيصال التجديد
    const paidAmount = subscriptionPrice - (remainingAmount || 0)

    // حساب مدة الاشتراك
    let subscriptionDays = null
    if (startDate && expiryDate) {
      const start = new Date(startDate)
      const end = new Date(expiryDate)
      subscriptionDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    }

    // ✅ معالجة وسائل الدفع المتعددة
    let finalPaymentMethod: string
    if (Array.isArray(paymentMethod)) {
      const validation = validatePaymentDistribution(paymentMethod, paidAmount)
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

    // ✅ BUG 5: null-safe trim عشان لو staffName جاي null
    const safeStaffName = (staffName || '').trim()

    let receipt: any
    try {
      const receiptNumber = await getNextReceiptNumberDirect(prisma)

      // ✅ BUG 3: Receipt + points في transaction واحد
      const txResult = await prisma.$transaction(async (tx) => {
        const r = await tx.receipt.create({
          data: {
            receiptNumber: receiptNumber,
            type: RECEIPT_TYPES.MEMBERSHIP_RENEWAL,
            amount: paidAmount,
            paymentMethod: finalPaymentMethod,
            staffName: safeStaffName,
            itemDetails: JSON.stringify({
              memberNumber: member.memberNumber,
              memberName: member.name,
              phone: member.phone,
              subscriptionPrice,
              paidAmount,
              remainingAmount: remainingAmount || 0,
              freePTSessions: additionalFreePT,
              previousFreePTSessions: currentFreePT,
              totalFreePTSessions: totalFreePT,
              freeNutritionSessions: additionalNutritionSessions,
              previousNutritionSessions: currentNutritionSessions,
              totalNutritionSessions: totalNutritionSessions,
              freePhysioSessions: additionalPhysioSessions,
              previousPhysioSessions: currentPhysioSessions,
              totalPhysioSessions: totalPhysioSessions,
              freeGroupClassSessions: additionalGroupClassSessions,
              previousGroupClassSessions: currentGroupClassSessions,
              totalGroupClassSessions: totalGroupClassSessions,
              inBodyScans: additionalInBody,
              previousInBodyScans: currentInBody,
              totalInBodyScans: totalInBody,
              invitations: additionalInvitations,
              previousInvitations: currentInvitations,
              totalInvitations: totalInvitations,
              remainingFreezeDays: additionalFreezeDays,
              previousFreezeDays: currentFreezeDays,
              totalFreezeDays: totalFreezeDays,
              previousExpiryDate: member.expiryDate,
              newStartDate: startDate,
              newExpiryDate: expiryDate,
              subscriptionDays: subscriptionDays,
              isRenewal: true,
              staffName: safeStaffName,
              salesPersonName: member.salesStaff?.name || null,
            }),
            memberId: member.id,
          },
        })

        const pr = await processPaymentWithPoints(
          member.id,
          member.phone,
          member.memberNumber,
          finalPaymentMethod,
          `دفع تجديد عضوية - ${member.name}`,
          tx  // ✅ نمرّر tx بدل الـ global prisma
        )
        if (!pr.success) {
          const e: any = new Error(pr.message || 'فشل خصم النقاط')
          e.code = 'POINTS_FAILED'
          e.userMessage = pr.message
          throw e
        }

        return { receipt: r }
      })
      receipt = txResult.receipt
    } catch (txErr: any) {
      if (txErr?.code === 'POINTS_FAILED') {
        return NextResponse.json(
          { error: txErr.userMessage || 'فشل خصم النقاط' },
          { status: 400 }
        )
      }
      // ✅ BUG 6: لو الـ receipt creation فشل فعلاً (مش بعد ما اتسجّل)
      // الـ transaction بيـ rollback، فمفيش orphan في الـ DB.
      console.error('❌ خطأ في إنشاء إيصال التجديد:', txErr)
      logError({ error: txErr, endpoint: '/api/members/renew', method: 'POST', statusCode: 200, additionalContext: { type: 'receipt_creation_failed', memberId } })
      return NextResponse.json({
        member: updatedMember,
        receipt: null,
        warning: 'تم التجديد لكن فشل إنشاء الإيصال'
      }, { status: 200 })
    }

    // إضافة نقاط مكافأة على الدفع — خارج الـ transaction لأن فشلها ما يهمناش
    try {
      await addPointsForPayment(
        member.id,
        paidAmount,
        `مكافأة تجديد اشتراك - ${member.name}`
      )
    } catch (pointsError) {
      console.error('Error adding reward points:', pointsError)
    }

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'Member', resourceId: member.id,
      details: { operation: 'Renew', memberNumber: member.memberNumber, memberName: member.name, subscriptionPrice, paidAmount, remainingAmount, receiptNumber: receipt.receiptNumber },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json({
      member: updatedMember,
      receipt: {
        // ✅ BUG 4: لازم نرجّع الـ id عشان الفرونت يقدر يجيب الإيصال من /api/receipts/:id
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        amount: receipt.amount,
        paymentMethod: receipt.paymentMethod,
        staffName: receipt.staffName,
        itemDetails: JSON.parse(receipt.itemDetails),
        createdAt: receipt.createdAt
      }
    }, { status: 200 })

  } catch (error: any) {
    console.error('❌ خطأ في تجديد الاشتراك:', error)
    logError({ error, endpoint: '/api/members/renew', method: 'POST', statusCode: 500 })
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تجديد الاشتراكات' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({ 
      error: 'فشل تجديد الاشتراك' 
    }, { status: 500 })
  }
}
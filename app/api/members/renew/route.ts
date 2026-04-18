// app/api/members/renew/route.ts - مع إضافة staffName والصلاحيات
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
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
import { logBackendError } from '../../../../lib/errorTracking/errorTrackingService'

export const dynamic = 'force-dynamic'

// POST - تجديد اشتراك عضو
export async function POST(request: Request) {
  try {
    // ✅ التحقق من صلاحية إضافة/إنشاء الأعضاء (تشمل التجديد)
    const user = await requirePermission(request, 'canCreateMembers')
    
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
      staffName
    } = body


    // جلب بيانات العضو
    const member = await prisma.member.findUnique({
      where: { id: memberId }
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

    // حساب حصص PT الجديدة (الحالية + الإضافية)
    const currentFreePT = member.freePTSessions || 0
    const additionalFreePT = freePTSessions || 0
    const totalFreePT = currentFreePT + additionalFreePT

    // حساب InBody الجديد (الحالي + الإضافي)
    const currentInBody = member.inBodyScans || 0
    const additionalInBody = inBodyScans || 0
    const totalInBody = currentInBody + additionalInBody

    // حساب Invitations الجديد (الحالي + الإضافي)
    const currentInvitations = member.invitations || 0
    const additionalInvitations = invitations || 0
    const totalInvitations = currentInvitations + additionalInvitations

    // حساب Freeze Days الجديد (الحالي + الإضافي)
    const currentFreezeDays = member.remainingFreezeDays || 0
    const additionalFreezeDays = remainingFreezeDays || 0
    const totalFreezeDays = currentFreezeDays + additionalFreezeDays

    // حساب Nutrition Sessions الجديد (الحالي + الإضافي)
    const currentNutritionSessions = member.freeNutritionSessions || 0
    const additionalNutritionSessions = freeNutritionSessions || 0
    const totalNutritionSessions = currentNutritionSessions + additionalNutritionSessions

    // حساب Physio Sessions الجديد (الحالي + الإضافي)
    const currentPhysioSessions = member.freePhysioSessions || 0
    const additionalPhysioSessions = freePhysioSessions || 0
    const totalPhysioSessions = currentPhysioSessions + additionalPhysioSessions

    // حساب Group Class Sessions الجديد (الحالي + الإضافي)
    const currentGroupClassSessions = member.freeGroupClassSessions || 0
    const additionalGroupClassSessions = freeGroupClassSessions || 0
    const totalGroupClassSessions = currentGroupClassSessions + additionalGroupClassSessions


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
      },
    })


    // إنشاء إيصال التجديد
    try {
      const receiptNumber = await getNextReceiptNumberDirect(prisma)

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

      const receipt = await prisma.receipt.create({
        data: {
          receiptNumber: receiptNumber,
          type: RECEIPT_TYPES.MEMBERSHIP_RENEWAL,
          amount: paidAmount,
          paymentMethod: finalPaymentMethod,
          staffName: staffName.trim(),
          itemDetails: JSON.stringify({
            memberNumber: member.memberNumber,
            memberName: member.name,
            phone: member.phone,
            subscriptionPrice,
            paidAmount,
            remainingAmount: remainingAmount || 0,
            // حصص PT في الإيصال
            freePTSessions: additionalFreePT,
            previousFreePTSessions: currentFreePT,
            totalFreePTSessions: totalFreePT,
            // حصص التغذية في الإيصال
            freeNutritionSessions: additionalNutritionSessions,
            previousNutritionSessions: currentNutritionSessions,
            totalNutritionSessions: totalNutritionSessions,
            // حصص العلاج الطبيعي في الإيصال
            freePhysioSessions: additionalPhysioSessions,
            previousPhysioSessions: currentPhysioSessions,
            totalPhysioSessions: totalPhysioSessions,
            // حصص الكلاس الجماعي في الإيصال
            freeGroupClassSessions: additionalGroupClassSessions,
            previousGroupClassSessions: currentGroupClassSessions,
            totalGroupClassSessions: totalGroupClassSessions,
            // InBody في الإيصال
            inBodyScans: additionalInBody,
            previousInBodyScans: currentInBody,
            totalInBodyScans: totalInBody,
            // Invitations في الإيصال
            invitations: additionalInvitations,
            previousInvitations: currentInvitations,
            totalInvitations: totalInvitations,
            // Freeze Days في الإيصال
            remainingFreezeDays: additionalFreezeDays,
            previousFreezeDays: currentFreezeDays,
            totalFreezeDays: totalFreezeDays,
            // التواريخ
            previousExpiryDate: member.expiryDate,
            newStartDate: startDate,
            newExpiryDate: expiryDate,
            subscriptionDays: subscriptionDays,
            isRenewal: true,
            staffName: staffName.trim(),
          }),
          memberId: member.id,
        },
      })


      // خصم النقاط إذا تم استخدامها في الدفع
      const pointsResult = await processPaymentWithPoints(
        member.id,
        member.phone,
        member.memberNumber,  // ✅ تمرير رقم العضوية
        finalPaymentMethod,
        `دفع تجديد عضوية - ${member.name}`,
        prisma
      )

      if (!pointsResult.success) {
        return NextResponse.json(
          { error: pointsResult.message || 'فشل خصم النقاط' },
          { status: 400 }
        )
      }

      // إضافة نقاط مكافأة على الدفع
      try {
        const pointsResult = await addPointsForPayment(
          member.id,
          paidAmount,
          `مكافأة تجديد اشتراك - ${member.name}`
        )

        if (pointsResult.pointsEarned && pointsResult.pointsEarned > 0) {
        }
      } catch (pointsError) {
        console.error('Error adding reward points:', pointsError)
        // لا نوقف العملية إذا فشلت إضافة النقاط
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
          receiptNumber: receipt.receiptNumber,
          amount: receipt.amount,
          paymentMethod: receipt.paymentMethod,
          staffName: receipt.staffName,
          itemDetails: JSON.parse(receipt.itemDetails),
          createdAt: receipt.createdAt
        }
      }, { status: 200 })

    } catch (receiptError: any) {
      console.error('❌ خطأ في إنشاء إيصال التجديد:', receiptError)
      logBackendError({ error: receiptError, endpoint: '/api/members/renew', method: 'POST', statusCode: 200, additionalContext: { type: 'receipt_creation_failed', memberId } }).catch(() => {})
      return NextResponse.json({
        member: updatedMember,
        receipt: null,
        warning: 'تم التجديد لكن فشل إنشاء الإيصال'
      }, { status: 200 })
    }

  } catch (error: any) {
    console.error('❌ خطأ في تجديد الاشتراك:', error)
    logBackendError({ error, endpoint: '/api/members/renew', method: 'POST', statusCode: 500 }).catch(() => {})
    
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
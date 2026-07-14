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
import { getNextReceiptNumber } from '../../../../lib/receiptHelpers'
import { round2 } from '../../../../lib/money'
import { RenewInputSchema, firstIssue } from '../../../../lib/schemas/financialSchemas'
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

    // ✅ تحقّق من صحة المدخلات المالية (سعر موجب، رقم عضو موجود)
    const renewErr = firstIssue(RenewInputSchema.safeParse(body))
    if (renewErr) {
      return NextResponse.json({ error: renewErr }, { status: 400 })
    }

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
      source,          // مصدر العضو — يتحدّث عند التجديد لو متبعّت
      paymentMethod,
      staffName,
      offerId,         // 📦 الباقة المطبَّقة عند التجديد (لو فيه)
      resetBenefits = false  //  وضع المزايا: false = تجميع (default) | true = ريست
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

    //  سياسة التجديد:
    //   - default (resetBenefits=false) → تجميع: الباقي من القديم + اللي جاي مع الباقة الجديدة
    //     (عادل للعميل اللي دفع ولسه ما استخدمش)
    //   - opt-in (resetBenefits=true) → ريست: المزايا القديمة بتتمسح ويبتدي بالجديد فقط
    //   بنحتفظ بالقيم القديمة (previous*) عشان تظهر في الإيصال للشفافية.
    const accumulate = (current: number, additional: number) =>
      resetBenefits ? additional : current + additional

    const currentFreePT = member.freePTSessions || 0
    const additionalFreePT = freePTSessions || 0
    const totalFreePT = accumulate(currentFreePT, additionalFreePT)

    const currentInBody = member.inBodyScans || 0
    const additionalInBody = inBodyScans || 0
    const totalInBody = accumulate(currentInBody, additionalInBody)

    const currentInvitations = member.invitations || 0
    const additionalInvitations = invitations || 0
    const totalInvitations = accumulate(currentInvitations, additionalInvitations)

    const currentFreezeDays = member.remainingFreezeDays || 0
    const additionalFreezeDays = remainingFreezeDays || 0
    const totalFreezeDays = accumulate(currentFreezeDays, additionalFreezeDays)

    const currentNutritionSessions = member.freeNutritionSessions || 0
    const additionalNutritionSessions = freeNutritionSessions || 0
    const totalNutritionSessions = accumulate(currentNutritionSessions, additionalNutritionSessions)

    const currentPhysioSessions = member.freePhysioSessions || 0
    const additionalPhysioSessions = freePhysioSessions || 0
    const totalPhysioSessions = accumulate(currentPhysioSessions, additionalPhysioSessions)

    const currentGroupClassSessions = member.freeGroupClassSessions || 0
    const additionalGroupClassSessions = freeGroupClassSessions || 0
    const totalGroupClassSessions = accumulate(currentGroupClassSessions, additionalGroupClassSessions)

    //  عدد حصص الدخول من الباقة الجديدة (باقة محدودة الدخلات)
    let renewOfferMaxCheckIns = 0
    let renewEntriesOnly = false
    if (offerId) {
      try {
        const renewOffer = await prisma.offer.findUnique({ where: { id: offerId }, select: { maxCheckIns: true, duration: true } as any })
        renewOfferMaxCheckIns = Number((renewOffer as any)?.maxCheckIns) || 0
        const renewDur = Number((renewOffer as any)?.duration) || 0
        renewEntriesOnly = renewOfferMaxCheckIns > 0 && renewDur <= 0
      } catch { renewOfferMaxCheckIns = 0 }
    }
    //  الباقة محدودة الدخلات → جمّع/ريست حسب السياسة. غير محدودة → دخول غير محدود (null)
    const currentCheckIns = typeof (member as any).remainingCheckIns === 'number' ? (member as any).remainingCheckIns : 0
    const totalCheckIns: number | null = renewOfferMaxCheckIns > 0
      ? accumulate(currentCheckIns, renewOfferMaxCheckIns)
      : null


    // ✅ حساب isActive: العضو نشط طالما اشتراكه ما انتهاش (حتى لو ما بدأش بعد)
    //  باقة الدخلات-بس: مفيش انتهاء بالوقت → expiryDate = null و isActive = true
    const renewToday = new Date()
    renewToday.setHours(0, 0, 0, 0)
    const renewExpiry = renewEntriesOnly ? null : (expiryDate ? new Date(expiryDate) : null)
    if (renewExpiry) renewExpiry.setHours(0, 0, 0, 0)
    const renewIsActive = renewEntriesOnly ? true : (!renewExpiry || renewExpiry >= renewToday)

    // ملاحظة: تحديث بيانات العضو اتنقل جوّه الـ $transaction تحت عشان لو
    // إنشاء الإيصال فشل يترجع التجديد بالكامل (مفيش عضو متجدّد بدون إيصال).

    // إنشاء إيصال التجديد
    const paidAmount = round2(subscriptionPrice - (remainingAmount || 0))

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
    let updatedMember: any
    try {
      // ✅ العضو + رقم الإيصال + الإيصال + النقاط كلهم في transaction واحد.
      //    لو أي خطوة فشلت، التجديد بالكامل بيترجع (atomic).
      const txResult = await prisma.$transaction(async (tx) => {
        const um = await tx.member.update({
          where: { id: memberId },
          data: {
            subscriptionPrice,
            remainingAmount: round2(remainingAmount || 0),
            remainingDueDate: remainingDueDate ? new Date(remainingDueDate) : null,
            freePTSessions: totalFreePT,
            freeNutritionSessions: totalNutritionSessions,
            freePhysioSessions: totalPhysioSessions,
            freeGroupClassSessions: totalGroupClassSessions,
            inBodyScans: totalInBody,
            invitations: totalInvitations,
            remainingFreezeDays: totalFreezeDays,
            startDate: startDate ? new Date(startDate) : null,
            expiryDate: renewExpiry,
            isActive: renewIsActive,
            notes: notes || member.notes,
            remainingCheckIns: totalCheckIns,
            ...(source !== undefined ? { source: source || null } : {}),
            ...(offerId ? { offerId } : {}),
          } as any,
        })

        // رقم الإيصال جوّه الـ transaction عشان نتجنّب تكرار الأرقام (race)
        const receiptNumber = await getNextReceiptNumber(tx)

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
              benefitsMode: resetBenefits ? 'reset' : 'accumulate', //  وضع المزايا
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

        return { receipt: r, member: um }
      })
      receipt = txResult.receipt
      updatedMember = txResult.member
    } catch (txErr: any) {
      if (txErr?.code === 'POINTS_FAILED') {
        return NextResponse.json(
          { error: txErr.userMessage || 'فشل خصم النقاط' },
          { status: 400 }
        )
      }
      // الـ transaction بيـ rollback تحديث العضو والإيصال معاً — مفيش عضو
      // متجدّد بدون إيصال. بنرجّع خطأ واضح عشان الموظف يعيد المحاولة.
      console.error('❌ خطأ في تجديد الاشتراك (rolled back):', txErr)
      logError({ error: txErr, endpoint: '/api/members/renew', method: 'POST', statusCode: 500, additionalContext: { type: 'renew_transaction_failed', memberId } })
      return NextResponse.json({
        error: 'فشل تسجيل التجديد ولم يتم أي تغيير. من فضلك حاول مرة أخرى.'
      }, { status: 500 })
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
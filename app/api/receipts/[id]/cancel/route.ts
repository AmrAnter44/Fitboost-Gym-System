import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { requirePermission } from '../../../../../lib/auth'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../../lib/auditLog'
import { getLocaleFromRequest, getServerTranslation } from '../../../../../lib/serverTranslation'

export const dynamic = 'force-dynamic'


export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    /**
     * إلغاء إيصال
     * @permission canEditReceipts - صلاحية تعديل وإلغاء الإيصالات
     */
    const user = await requirePermission(request, 'canEditReceipts')

    // Get translation function based on request locale
    const locale = getLocaleFromRequest(request)
    const t = getServerTranslation(locale)

    const { reason, refundMethod, refundAmount } = await request.json()
    const receiptId = params.id

    // ✅ التحقق من طريقة استرجاع الفلوس (كاش أو إنستاباي)
    const validRefundMethods = ['cash', 'instapay']
    const safeRefundMethod = validRefundMethods.includes(refundMethod) ? refundMethod : null

    // جلب الإيصال
    const receipt = await prisma.receipt.findUnique({
      where: { id: receiptId }
    })

    if (!receipt) {
      return NextResponse.json({ error: t('receipts.cancel.notFound') }, { status: 404 })
    }

    if (receipt.isCancelled) {
      return NextResponse.json({ error: t('receipts.cancel.alreadyCancelled') }, { status: 400 })
    }

    // ✅ مبلغ المرتجع اللي هيتسجّل كمصروف — لو اتبعت رقم موجب نستخدمه، وإلا كامل مبلغ الإيصال
    const parsedRefund = Number(refundAmount)
    const safeRefundAmount = Number.isFinite(parsedRefund) && parsedRefund > 0 ? parsedRefund : receipt.amount

    //  إلغاء الإيصال + تسجيل مصروف بالفلوس المسترجعة (لو اتحددت طريقة استرجاع)
    //  المصروف بيظهر في صفحة المصاريف وبيتخصم تلقائياً في التقفيل اليومي (على يوم الإلغاء)
    const cancelledReceipt = await prisma.$transaction(async (tx) => {
      const updated = await tx.receipt.update({
        where: { id: receiptId },
        data: {
          isCancelled: true,
          cancelledAt: new Date(),
          cancelledBy: user.name || user.email,
          cancelReason: reason || t('receipts.cancel.noReason'),
          refundMethod: safeRefundMethod
        }
      })

      if (safeRefundMethod) {
        await tx.expense.create({
          data: {
            type: 'gym_expense',
            amount: safeRefundAmount,          // المبلغ اللي المستخدم كتبه (أو كامل الإيصال)
            description: `مرتجع إيصال #${receipt.receiptNumber}${reason ? ` - ${reason}` : ''}`,
            paymentMethod: safeRefundMethod,   // كاش أو إنستاباي
            category: 'مرتجعات',
          }
        })
      }

      //  عكس اشتراك الميمبر لو ده إيصال عضوية (جديد أو تجديد) — عشان الميمبر ما يفضلش نشط
      const isRenewal = receipt.type === 'membershipRenewal'
      const isNewMembership = receipt.type === 'Member' || receipt.type === 'member'
      if (receipt.memberId && (isRenewal || isNewMembership)) {
        let details: any = {}
        try { details = JSON.parse(receipt.itemDetails) } catch { /* ignore */ }
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        if (isRenewal) {
          //  رجّع تاريخ الانتهاء للقيمة اللي كانت قبل التجديد
          const prevExpiry = details.previousExpiryDate ? new Date(details.previousExpiryDate) : null
          const prevActive = prevExpiry ? prevExpiry.getTime() >= today.getTime() : false
          await tx.member.update({
            where: { id: receipt.memberId },
            data: { expiryDate: prevExpiry, isActive: prevActive }
          })
        } else {
          //  عضوية جديدة اتلغت → خلي الاشتراك منتهي (تاريخ انتهاء في الماضي)
          const expiredDate = new Date(today)
          expiredDate.setDate(expiredDate.getDate() - 1)
          await tx.member.update({
            where: { id: receipt.memberId },
            data: { isActive: false, expiryDate: expiredDate }
          })
        }
      }

      return updated
    })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'Receipt', resourceId: receiptId,
      details: { receiptNumber: receipt.receiptNumber, action: 'cancel', reason, amount: receipt.amount, refundMethod: safeRefundMethod },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json({
      success: true,
      message: t('receipts.cancel.success'),
      data: { cancelledReceipt }
    })

  } catch (error: any) {
    console.error('Error cancelling receipt:', error)

    // Get translation for error messages
    const locale = getLocaleFromRequest(request)
    const t = getServerTranslation(locale)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: t('receipts.cancel.unauthorized') },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: t('receipts.cancel.forbidden') },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: t('receipts.cancel.failed') },
      { status: 500 }
    )
  }
}

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

    const { reason, refundMethod } = await request.json()
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
            amount: receipt.amount,
            description: `مرتجع إيصال #${receipt.receiptNumber}${reason ? ` - ${reason}` : ''}`,
            paymentMethod: safeRefundMethod,   // كاش أو إنستاباي
            category: 'مرتجعات',
          }
        })
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

import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { requirePermission } from '../../../../../lib/auth'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../../lib/auditLog'

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

    const { reason } = await request.json()
    const receiptId = params.id

    // جلب الإيصال
    const receipt = await prisma.receipt.findUnique({
      where: { id: receiptId }
    })

    if (!receipt) {
      return NextResponse.json({ error: 'الإيصال غير موجود' }, { status: 404 })
    }

    if (receipt.isCancelled) {
      return NextResponse.json({ error: 'الإيصال ملغي بالفعل' }, { status: 400 })
    }

    // إلغاء الإيصال وإنشاء مصروف في transaction واحدة
    const result = await prisma.$transaction(async (tx) => {
      // تحديث الإيصال كملغي
      const cancelledReceipt = await tx.receipt.update({
        where: { id: receiptId },
        data: {
          isCancelled: true,
          cancelledAt: new Date(),
          cancelledBy: user.name || user.email,
          cancelReason: reason || 'لا يوجد سبب'
        }
      })

      // إنشاء مصروف بنفس المبلغ
      const expense = await tx.expense.create({
        data: {
          type: 'إلغاء إيصال',
          amount: receipt.amount,
          description: `إلغاء إيصال رقم ${receipt.receiptNumber}`,
          notes: reason || 'لا يوجد سبب'
        }
      })

      return { cancelledReceipt, expense }
    })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'Receipt', resourceId: receiptId,
      details: { receiptNumber: receipt.receiptNumber, action: 'cancel', reason, amount: receipt.amount },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json({
      success: true,
      message: 'تم إلغاء الإيصال بنجاح',
      data: result
    })

  } catch (error: any) {
    console.error('Error cancelling receipt:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية إلغاء الإيصالات' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'فشل إلغاء الإيصال' },
      { status: 500 }
    )
  }
}

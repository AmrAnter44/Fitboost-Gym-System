import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

// تحديث إيصال موجود

export const dynamic = 'force-dynamic'

export async function PUT(request: Request) {
  try {
    // ✅ التحقق من صلاحية تعديل الإيصالات
    await requirePermission(request, 'canEditReceipts')
    
    const {
      receiptId,
      receiptNumber,
      amount,
      paymentMethod,
      itemDetails,
      staffName,
      createdAt
    } = await request.json()

    if (!receiptId) {
      return NextResponse.json({ error: 'معرف الإيصال مطلوب' }, { status: 400 })
    }

    // التحقق من وجود الإيصال
    const existingReceipt = await prisma.receipt.findUnique({
      where: { id: receiptId }
    })

    if (!existingReceipt) {
      return NextResponse.json({ error: 'الإيصال غير موجود' }, { status: 404 })
    }

    // التحقق من أن رقم الإيصال الجديد غير مستخدم (إذا تم تغييره)
    if (receiptNumber && receiptNumber !== existingReceipt.receiptNumber) {
      const duplicateReceipt = await prisma.receipt.findUnique({
        where: { receiptNumber: parseInt(receiptNumber) }
      })

      if (duplicateReceipt) {
        return NextResponse.json({ 
          error: `رقم الإيصال ${receiptNumber} مستخدم بالفعل` 
        }, { status: 400 })
      }
    }

    // تحديث الإيصال
    const updatedReceipt = await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        ...(receiptNumber && { receiptNumber: parseInt(receiptNumber) }),
        ...(amount && { amount: parseFloat(amount) }),
        ...(paymentMethod && { paymentMethod }),
        ...(itemDetails && { itemDetails: JSON.stringify(itemDetails) }),
        ...(staffName !== undefined && { staffName }),
        ...(createdAt && { createdAt: new Date(createdAt) })
      }
    })

    return NextResponse.json({ 
      success: true,
      receipt: updatedReceipt,
      message: 'تم تحديث الإيصال بنجاح'
    })
  } catch (error: any) {
    console.error('Error updating receipt:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تعديل الإيصالات' },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { error: 'فشل تحديث الإيصال' },
      { status: 500 }
    )
  }
}

// حذف إيصال
export async function DELETE(request: Request) {
  try {
    // ✅ التحقق من صلاحية حذف الإيصالات
    await requirePermission(request, 'canDeleteReceipts')
    
    const { searchParams } = new URL(request.url)
    const receiptId = searchParams.get('id')

    if (!receiptId) {
      return NextResponse.json({ error: 'معرف الإيصال مطلوب' }, { status: 400 })
    }

    // التحقق من وجود الإيصال
    const existingReceipt = await prisma.receipt.findUnique({
      where: { id: receiptId }
    })

    if (!existingReceipt) {
      return NextResponse.json({ error: 'الإيصال غير موجود' }, { status: 404 })
    }

    // حذف الإيصال
    await prisma.receipt.delete({
      where: { id: receiptId }
    })

    return NextResponse.json({ 
      success: true,
      message: 'تم حذف الإيصال بنجاح'
    })
  } catch (error: any) {
    console.error('Error deleting receipt:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية حذف الإيصالات' },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { error: 'فشل حذف الإيصال' },
      { status: 500 }
    )
  }
}
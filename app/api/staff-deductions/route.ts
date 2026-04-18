import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../lib/auditLog'

export const dynamic = 'force-dynamic'

// GET - جلب الخصومات
export async function GET(request: Request) {
  try {
    const user = await requirePermission(request, 'canViewDeductions')

    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')
    const isApplied = searchParams.get('isApplied')

    const where: any = {}
    if (staffId) where.staffId = staffId
    if (isApplied !== null) where.isApplied = isApplied === 'true'

    const deductions = await prisma.staffDeduction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { staff: true }
    })

    return NextResponse.json(deductions)
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية عرض الخصومات' }, { status: 403 })
    }
    return NextResponse.json({ error: 'فشل جلب الخصومات' }, { status: 500 })
  }
}

// POST - إضافة خصم جديد
export async function POST(request: Request) {
  try {
    const user = await requirePermission(request, 'canCreateDeduction')

    const body = await request.json()
    const { staffId, amount, reason, notes } = body

    if (!staffId || !amount || !reason) {
      return NextResponse.json({ error: 'البيانات المطلوبة ناقصة' }, { status: 400 })
    }

    const deduction = await prisma.staffDeduction.create({
      data: {
        staffId,
        amount: parseFloat(amount),
        reason,
        notes: notes || null,
        isApplied: false,
      },
      include: { staff: true }
    })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'CREATE', resource: 'StaffDeduction', resourceId: deduction.id,
      details: { staffId, amount, reason },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json(deduction, { status: 201 })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية إضافة خصومات' }, { status: 403 })
    }
    return NextResponse.json({ error: 'فشل إضافة الخصم' }, { status: 500 })
  }
}

// PUT - تعديل خصم أو تحديث حالته
export async function PUT(request: Request) {
  try {
    const user = await requirePermission(request, 'canEditDeduction')

    const body = await request.json()
    const { id, reason, notes, isApplied, appliedAt } = body

    if (!id) {
      return NextResponse.json({ error: 'رقم الخصم مطلوب' }, { status: 400 })
    }

    const updateData: any = {}
    if (reason !== undefined) updateData.reason = reason
    if (notes !== undefined) updateData.notes = notes
    if (isApplied !== undefined) updateData.isApplied = isApplied
    if (appliedAt !== undefined) updateData.appliedAt = new Date(appliedAt)

    const deduction = await prisma.staffDeduction.update({
      where: { id },
      data: updateData,
      include: { staff: true }
    })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'StaffDeduction', resourceId: id,
      details: { changes: Object.keys(updateData) },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json(deduction)
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية تعديل الخصومات' }, { status: 403 })
    }
    return NextResponse.json({ error: 'فشل تعديل الخصم' }, { status: 500 })
  }
}

// DELETE - حذف خصم (معلق فقط)
export async function DELETE(request: Request) {
  try {
    const user = await requirePermission(request, 'canDeleteDeduction')

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'رقم الخصم مطلوب' }, { status: 400 })
    }

    const existing = await prisma.staffDeduction.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'الخصم غير موجود' }, { status: 404 })
    }
    if (existing.isApplied) {
      return NextResponse.json({ error: 'لا يمكن حذف خصم مطبق بالفعل' }, { status: 400 })
    }

    await prisma.staffDeduction.delete({ where: { id } })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'DELETE', resource: 'StaffDeduction', resourceId: id,
      details: { reason: existing.reason, amount: existing.amount },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json({ message: 'تم حذف الخصم بنجاح' })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية حذف الخصومات' }, { status: 403 })
    }
    return NextResponse.json({ error: 'فشل حذف الخصم' }, { status: 500 })
  }
}

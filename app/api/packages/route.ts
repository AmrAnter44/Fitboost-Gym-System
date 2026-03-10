import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../lib/auditLog'

export const dynamic = 'force-dynamic'

// GET - جلب جميع الباقات أو باقات خدمة معينة
export async function GET(request: Request) {
  try {
    await requirePermission(request, 'canAccessSettings')

    const { searchParams } = new URL(request.url)
    const serviceType = searchParams.get('serviceType')

    const where = serviceType
      ? { serviceType, isActive: true }
      : { isActive: true }

    const packages = await prisma.servicePackage.findMany({
      where,
      orderBy: [
        { serviceType: 'asc' },
        { sessions: 'asc' }
      ]
    })

    return NextResponse.json(packages)
  } catch (error: any) {
    console.error('Error fetching packages:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية الوصول للإعدادات' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل جلب الباقات' }, { status: 500 })
  }
}

// POST - إضافة باقة جديدة
export async function POST(request: Request) {
  try {
    const user = await requirePermission(request, 'canAccessSettings')

    const body = await request.json()
    const { name, serviceType, sessions, price, durationDays, moreCommission } = body

    // التحقق من البيانات
    if (!name || !serviceType || !sessions || !price) {
      return NextResponse.json(
        { error: 'جميع الحقول مطلوبة' },
        { status: 400 }
      )
    }

    if (!['PT', 'Nutrition', 'Physiotherapy', 'GroupClass', 'More'].includes(serviceType)) {
      return NextResponse.json(
        { error: 'نوع الخدمة غير صحيح' },
        { status: 400 }
      )
    }

    const package_ = await prisma.servicePackage.create({
      data: {
        name,
        serviceType,
        sessions: parseInt(sessions),
        price: parseFloat(price),
        durationDays: durationDays ? parseInt(durationDays) : 30,  // 📅 مدة الاشتراك (افتراضي: 30 يوم)
        moreCommission: moreCommission ? parseFloat(moreCommission) : 0  // 💰 عمولة المدرب لخدمة مزيد
      }
    })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'CREATE', resource: 'System', resourceId: package_.id,
      details: { type: 'Package', packageName: package_.name, serviceType: package_.serviceType, sessions: package_.sessions, price: package_.price },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json(package_)
  } catch (error: any) {
    console.error('Error creating package:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية إضافة باقات' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل إضافة الباقة' }, { status: 500 })
  }
}

// PUT - تحديث باقة
export async function PUT(request: Request) {
  try {
    const user = await requirePermission(request, 'canAccessSettings')

    const body = await request.json()
    const { id, name, sessions, price, durationDays, moreCommission, isActive } = body

    if (!id) {
      return NextResponse.json(
        { error: 'معرف الباقة مطلوب' },
        { status: 400 }
      )
    }

    const package_ = await prisma.servicePackage.update({
      where: { id },
      data: {
        name,
        sessions: sessions ? parseInt(sessions) : undefined,
        price: price ? parseFloat(price) : undefined,
        durationDays: durationDays ? parseInt(durationDays) : undefined,  // 📅 مدة الاشتراك
        moreCommission: moreCommission !== undefined ? parseFloat(moreCommission) : undefined,  // 💰 عمولة المدرب لخدمة مزيد
        isActive: isActive !== undefined ? isActive : undefined
      }
    })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'System', resourceId: id,
      details: { type: 'Package', changes: { name, sessions, price, isActive } },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json(package_)
  } catch (error: any) {
    console.error('Error updating package:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تحديث الباقات' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل تحديث الباقة' }, { status: 500 })
  }
}

// DELETE - حذف باقة (soft delete)
export async function DELETE(request: Request) {
  try {
    const user = await requirePermission(request, 'canAccessSettings')

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'معرف الباقة مطلوب' },
        { status: 400 }
      )
    }

    // Soft delete
    const deletedPackage = await prisma.servicePackage.update({
      where: { id },
      data: { isActive: false }
    })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'DELETE', resource: 'System', resourceId: id,
      details: { type: 'Package', packageName: deletedPackage.name, serviceType: deletedPackage.serviceType },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json({ message: 'تم حذف الباقة بنجاح' })
  } catch (error: any) {
    console.error('Error deleting package:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية حذف الباقات' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل حذف الباقة' }, { status: 500 })
  }
}

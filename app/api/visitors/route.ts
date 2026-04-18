import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../lib/auditLog'

// GET - جلب جميع الزوار مع فلترة وبحث

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    /**
     * جلب جميع الزوار
     * @permission canViewVisitors - صلاحية عرض قائمة الزوار
     */
    const user = await requirePermission(request, 'canViewVisitors')

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status') // 'pending', 'contacted', 'subscribed', 'rejected'
    const source = searchParams.get('source') // 'walk-in', 'invitation', 'facebook', etc.
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    const where: any = {}

    // البحث بالاسم أو رقم الهاتف
    if (search) {
      where.OR = [
        { name: { contains: search } }, // SQLite doesn't support mode: 'insensitive'
        { phone: { contains: search } },
      ]
    }

    // فلترة حسب الحالة
    if (status && status !== 'all') {
      where.status = status
    }

    // فلترة حسب المصدر
    if (source && source !== 'all') {
      where.source = source
    }

    // فلترة حسب التاريخ
    if (fromDate || toDate) {
      where.createdAt = {}
      if (fromDate) {
        const parsedFromDate = new Date(fromDate)
        if (!isNaN(parsedFromDate.getTime())) {
          where.createdAt.gte = parsedFromDate
        }
      }
      if (toDate) {
        const parsedToDate = new Date(toDate)
        if (!isNaN(parsedToDate.getTime())) {
          where.createdAt.lte = parsedToDate
        }
      }
      // Remove empty createdAt filter if no valid dates were parsed
      if (Object.keys(where.createdAt).length === 0) {
        delete where.createdAt
      }
    }

    const limitParam = parseInt(searchParams.get('limit') || '5000', 10)
    const limit = Math.min(Number.isNaN(limitParam) ? 5000 : limitParam, 10000)

    const visitors = await prisma.visitor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        followUps: {
          orderBy: { createdAt: 'desc' },
          take: 1, // آخر متابعة فقط
        },
      },
    })

    // إحصائيات
    const stats = await prisma.visitor.groupBy({
      by: ['status'],
      _count: true,
    })

    return NextResponse.json({
      visitors,
      stats,
      total: visitors.length,
    })
  } catch (error) {
    console.error('GET Error:', error)
    return NextResponse.json({ error: 'فشل جلب الزوار' }, { status: 500 })
  }
}

// POST - إضافة زائر جديد
export async function POST(request: Request) {
  try {
    /**
     * إضافة زائر جديد
     * @permission canViewVisitors - صلاحية إدارة الزوار
     */
    const user = await requirePermission(request, 'canViewVisitors')

    const body = await request.json()
    const { name, phone, notes, source, interestedIn, salesStaffId } = body

    // التحقق من البيانات المطلوبة
    if (!name || !phone) {
      return NextResponse.json(
        { error: 'الاسم ورقم الهاتف مطلوبان' },
        { status: 400 }
      )
    }

    // التحقق من صحة رقم الهاتف المصري
    const phoneRegex = /^(010|011|012|015)[0-9]{8}$/
    if (!phoneRegex.test(phone)) {
      return NextResponse.json(
        { error: 'رقم الهاتف غير صحيح. يجب أن يبدأ بـ 010, 011, 012, أو 015' },
        { status: 400 }
      )
    }

    // التحقق من أن رقم الهاتف ليس مسجلاً كعضو
    const existingMember = await prisma.member.findFirst({
      where: {
        OR: [
          { phone: phone.trim() },
          { backupPhone: phone.trim() },
        ],
      },
      select: { id: true, name: true, memberNumber: true, isActive: true },
    })

    if (existingMember) {
      return NextResponse.json(
        {
          error: `رقم الهاتف مسجل كعضو: ${existingMember.name} (#${existingMember.memberNumber})`,
          existingMember: {
            id: existingMember.id,
            name: existingMember.name,
            memberNumber: existingMember.memberNumber,
            isActive: existingMember.isActive,
          },
        },
        { status: 409 }
      )
    }

    // التحقق من عدم تكرار رقم الهاتف كزائر
    const existingVisitor = await prisma.visitor.findUnique({
      where: { phone },
    })

    if (existingVisitor) {
      return NextResponse.json(
        {
          error: 'رقم الهاتف مسجل مسبقاً كزائر',
          existingVisitor: {
            id: existingVisitor.id,
            name: existingVisitor.name,
            status: existingVisitor.status,
          }
        },
        { status: 409 }
      )
    }

    // إنشاء الزائر
    const visitor = await prisma.visitor.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        notes: notes?.trim(),
        source: source || 'walk-in', // walk-in, facebook, instagram, friend, other
        interestedIn: interestedIn?.trim(),
        status: 'pending', // pending, contacted, subscribed, rejected
      },
    })

    // إنشاء أول متابعة تلقائياً
    await prisma.followUp.create({
      data: {
        visitorId: visitor.id,
        notes: 'زيارة أولية - في انتظار التواصل',
        nextFollowUpDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // بعد 24 ساعة
        ...(salesStaffId ? { assignedTo: salesStaffId } : {})
      },
    })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'CREATE', resource: 'Visitor', resourceId: visitor.id,
      details: { name: visitor.name, phone: visitor.phone, source: visitor.source },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json(visitor, { status: 201 })
  } catch (error) {
    console.error('POST Error:', error)
    return NextResponse.json({ error: 'فشل إضافة الزائر' }, { status: 500 })
  }
}

// PUT - تحديث بيانات زائر
export async function PUT(request: Request) {
  try {
    /**
     * تحديث بيانات زائر
     * @permission canViewVisitors - صلاحية إدارة الزوار
     */
    const user = await requirePermission(request, 'canViewVisitors')

    const body = await request.json()
    const { id, name, phone, notes, status, interestedIn, source } = body

    if (!id) {
      return NextResponse.json({ error: 'معرف الزائر مطلوب' }, { status: 400 })
    }

    // التحقق من وجود الزائر
    const existingVisitor = await prisma.visitor.findUnique({
      where: { id },
    })

    if (!existingVisitor) {
      return NextResponse.json({ error: 'الزائر غير موجود' }, { status: 404 })
    }

    // إذا تم تغيير رقم الهاتف، تحقق من عدم التكرار
    if (phone && phone !== existingVisitor.phone) {
      const phoneRegex = /^(010|011|012|015)[0-9]{8}$/
      if (!phoneRegex.test(phone)) {
        return NextResponse.json(
          { error: 'رقم الهاتف غير صحيح' },
          { status: 400 }
        )
      }

      const duplicatePhone = await prisma.visitor.findUnique({
        where: { phone },
      })

      if (duplicatePhone) {
        return NextResponse.json(
          { error: 'رقم الهاتف مسجل لزائر آخر' },
          { status: 409 }
        )
      }
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (phone !== undefined) updateData.phone = phone.trim()
    if (notes !== undefined) updateData.notes = notes?.trim()
    if (status !== undefined) updateData.status = status
    if (interestedIn !== undefined) updateData.interestedIn = interestedIn?.trim()
    if (source !== undefined) updateData.source = source

    const visitor = await prisma.visitor.update({
      where: { id },
      data: updateData,
    })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'Visitor', resourceId: visitor.id,
      details: { name: visitor.name, changes: Object.keys(updateData) },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json(visitor)
  } catch (error) {
    console.error('PUT Error:', error)
    return NextResponse.json({ error: 'فشل التحديث' }, { status: 500 })
  }
}

// DELETE - حذف زائر
export async function DELETE(request: Request) {
  try {
    /**
     * حذف زائر
     * @permission canViewVisitors - صلاحية إدارة الزوار
     */
    const user = await requirePermission(request, 'canViewVisitors')

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'معرف الزائر مطلوب' }, { status: 400 })
    }

    // التحقق من وجود الزائر
    const existingVisitor = await prisma.visitor.findUnique({
      where: { id },
    })

    if (!existingVisitor) {
      return NextResponse.json({ error: 'الزائر غير موجود' }, { status: 404 })
    }

    // حذف الأنشطة أولاً (deleteMany مش بيعمل cascade)
    // حذف الأنشطة والمتابعات والزائر في transaction واحد
    await prisma.$transaction(async (tx) => {
      const followUpIds = (await tx.followUp.findMany({
        where: { visitorId: id },
        select: { id: true }
      })).map(f => f.id)

      if (followUpIds.length > 0) {
        await tx.followUpActivity.deleteMany({
          where: { followUpId: { in: followUpIds } }
        })
      }

      await tx.followUp.deleteMany({ where: { visitorId: id } })
      await tx.visitor.delete({ where: { id } })
    })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'DELETE', resource: 'Visitor', resourceId: id,
      details: { name: existingVisitor.name, phone: existingVisitor.phone },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json({
      message: 'تم الحذف بنجاح',
      deletedVisitor: {
        id: existingVisitor.id,
        name: existingVisitor.name,
      }
    })
  } catch (error) {
    console.error('DELETE Error:', error)
    return NextResponse.json({ error: 'فشل الحذف' }, { status: 500 })
  }
}
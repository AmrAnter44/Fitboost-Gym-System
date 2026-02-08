import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { verifyAuth, requirePermission } from '../../../lib/auth'

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
        { name: { contains: search, mode: 'insensitive' } },
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
      if (fromDate) where.createdAt.gte = new Date(fromDate)
      if (toDate) where.createdAt.lte = new Date(toDate)
    }

    const visitors = await prisma.visitor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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
    // ✅ التحقق من تسجيل الدخول
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, phone, notes, source, interestedIn } = body

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

    // التحقق من عدم تكرار رقم الهاتف
    const existingVisitor = await prisma.visitor.findUnique({
      where: { phone },
    })

    if (existingVisitor) {
      return NextResponse.json(
        { 
          error: 'رقم الهاتف مسجل مسبقاً',
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
      },
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
    // ✅ التحقق من تسجيل الدخول
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

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

    return NextResponse.json(visitor)
  } catch (error) {
    console.error('PUT Error:', error)
    return NextResponse.json({ error: 'فشل التحديث' }, { status: 500 })
  }
}

// DELETE - حذف زائر
export async function DELETE(request: Request) {
  try {
    // ✅ التحقق من تسجيل الدخول
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

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

    // حذف المتابعات أولاً (cascade)
    await prisma.followUp.deleteMany({
      where: { visitorId: id },
    })

    // حذف الزائر
    await prisma.visitor.delete({ where: { id } })

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
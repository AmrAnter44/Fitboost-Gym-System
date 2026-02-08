import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'

// GET - جلب كل المصروفات

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    /**
     * جلب كل المصروفات
     * @permission canViewExpenses - صلاحية عرض المصروفات والنفقات
     */
    let user
    try {
      user = await requirePermission(request, 'canViewExpenses')
    } catch (permError: any) {
      // إذا لم يكن لديه صلاحية canViewExpenses، نتحقق إذا كان كوتش يريد رؤية قروضه فقط
      const { verifyAuth } = await import('../../../lib/auth')
      user = await verifyAuth(request)

      if (!user) {
        throw new Error('Unauthorized')
      }

      // الكوتشات يمكنهم رؤية قروضهم (staff loans) الخاصة فقط
      if (user.role === 'COACH') {
        // جلب معلومات المستخدم مع staffId
        const userWithStaff = await prisma.user.findUnique({
          where: { id: user.userId },
          select: { staffId: true }
        })

        if (!userWithStaff?.staffId) {
          return NextResponse.json([])
        }

        // جلب القروض الخاصة بهذا الكوتش فقط
        const expenses = await prisma.expense.findMany({
          where: {
            staffId: userWithStaff.staffId,
            type: 'staff_loan'  // القروض فقط
          },
          orderBy: { createdAt: 'desc' },
          include: {
            staff: true
          }
        })

        return NextResponse.json(expenses)
      }

      // إذا لم يكن كوتش، نرمي الخطأ الأصلي
      throw permError
    }

    // ✅ إذا كان لديه صلاحية canViewExpenses، نطبق المنطق العادي
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const staffId = searchParams.get('staffId')

    let where: any = {}
    if (type) where.type = type
    if (staffId) where.staffId = staffId

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        staff: true
      }
    })

    return NextResponse.json(expenses)
  } catch (error: any) {
    console.error('Error fetching expenses:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية عرض المصروفات' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل جلب المصروفات' }, { status: 500 })
  }
}

// POST - إضافة مصروف جديد
export async function POST(request: Request) {
  try {
    /**
     * إضافة مصروف جديد
     * @permission canCreateExpense - صلاحية إنشاء مصروفات جديدة
     */
    await requirePermission(request, 'canCreateExpense')

    const body = await request.json()
    const { type, amount, description, notes, staffId, customCreatedAt } = body

    if (!type || !amount || !description) {
      return NextResponse.json(
        { error: 'البيانات المطلوبة ناقصة' },
        { status: 400 }
      )
    }

    // ✅ تحضير البيانات مع دعم التاريخ المخصص
    const expenseData: any = {
      type,
      amount,
      description,
      notes,
      staffId: staffId || null,
    }

    // ✅ إضافة التاريخ المخصص إذا كان موجوداً
    if (customCreatedAt) {
      expenseData.createdAt = new Date(customCreatedAt)
      console.log('⏰ استخدام تاريخ مخصص للمصروف:', new Date(customCreatedAt))
    }

    const expense = await prisma.expense.create({
      data: expenseData,
      include: {
        staff: true
      }
    })

    return NextResponse.json(expense, { status: 201 })
  } catch (error: any) {
    console.error('Error creating expense:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية إضافة مصروفات' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({ error: 'فشل إضافة المصروف' }, { status: 500 })
  }
}

// PUT - تحديث مصروف
export async function PUT(request: Request) {
  try {
    // ✅ التحقق من صلاحية تعديل المصروف
    await requirePermission(request, 'canEditExpense')

    const body = await request.json()
    const { id, description, createdAt, isPaid } = body

    // تحضير البيانات للتحديث
    const updateData: any = {}

    // السماح بتعديل الوصف والتاريخ وحالة الدفع فقط
    if (description !== undefined) updateData.description = description
    if (createdAt !== undefined) updateData.createdAt = new Date(createdAt)
    if (isPaid !== undefined) updateData.isPaid = isPaid

    const expense = await prisma.expense.update({
      where: { id },
      data: updateData,
      include: {
        staff: true
      }
    })

    return NextResponse.json(expense)
  } catch (error: any) {
    console.error('Error updating expense:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تعديل المصروفات' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل تحديث المصروف' }, { status: 500 })
  }
}

// DELETE - حذف مصروف
export async function DELETE(request: Request) {
  try {
    /**
     * حذف مصروف
     * @permission canDeleteExpense - صلاحية حذف المصروفات
     */
    await requirePermission(request, 'canDeleteExpense')
    
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'رقم المصروف مطلوب' }, { status: 400 })
    }

    await prisma.expense.delete({ where: { id } })
    return NextResponse.json({ message: 'تم الحذف بنجاح' })
  } catch (error: any) {
    console.error('Error deleting expense:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية حذف المصروفات' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({ error: 'فشل حذف المصروف' }, { status: 500 })
  }
}
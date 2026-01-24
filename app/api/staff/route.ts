import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'

// GET - جلب كل الموظفين

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // ✅ محاولة التحقق من صلاحية عرض الموظفين
    let user
    try {
      user = await requirePermission(request, 'canViewStaff')
    } catch (permError: any) {
      // إذا لم يكن لديه صلاحية canViewStaff، نتحقق إذا كان كوتش يريد رؤية بياناته فقط
      const { verifyAuth } = await import('../../../lib/auth')
      user = await verifyAuth(request)

      if (!user) {
        throw new Error('Unauthorized')
      }

      // الكوتشات يمكنهم رؤية بياناتهم الخاصة فقط
      if (user.role === 'COACH') {
        // جلب معلومات المستخدم مع staffId
        const userWithStaff = await prisma.user.findUnique({
          where: { id: user.userId },
          select: { staffId: true }
        })

        if (!userWithStaff?.staffId) {
          return NextResponse.json(
            { error: 'حساب الكوتش غير مرتبط ببيانات موظف' },
            { status: 403 }
          )
        }

        // جلب بيانات الموظف الخاصة بهذا الكوتش فقط
        const staffRecord = await prisma.staff.findUnique({
          where: { id: userWithStaff.staffId },
          include: {
            expenses: {
              where: { type: 'staff_loan', isPaid: false }
            },
            attendance: {
              where: {
                checkIn: {
                  gte: new Date(new Date().setHours(0, 0, 0, 0))
                }
              },
              orderBy: { checkIn: 'desc' }
            }
          }
        })

        if (!staffRecord) {
          return NextResponse.json(
            { error: 'بيانات الموظف غير موجودة' },
            { status: 404 }
          )
        }

        // إرجاع بيانات الكوتش فقط في array
        return NextResponse.json([staffRecord])
      }

      // إذا لم يكن كوتش، نرمي الخطأ الأصلي
      throw permError
    }

    // ✅ إذا كان لديه صلاحية canViewStaff، نجلب كل الموظفين
    const staff = await prisma.staff.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        expenses: {
          where: { type: 'staff_loan', isPaid: false }
        },
        // ✅ جلب حضور اليوم
        attendance: {
          where: {
            checkIn: {
              gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          },
          orderBy: { checkIn: 'desc' }
        }
      }
    })
    return NextResponse.json(staff)
  } catch (error: any) {
    console.error('Error fetching staff:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية عرض الموظفين' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل جلب الموظفين' }, { status: 500 })
  }
}

// POST - إضافة موظف جديد
export async function POST(request: Request) {
  try {
    // ✅ التحقق من صلاحية إضافة موظف
    await requirePermission(request, 'canCreateStaff')
    
    const body = await request.json()
    const { staffCode, name, phone, position, salary, notes } = body

    // ✅ التحقق من وجود staffCode
    if (!staffCode) {
      return NextResponse.json({ error: 'رقم الموظف مطلوب' }, { status: 400 })
    }

    // ✅ التحقق من عدم تكرار الرقم
    const existingStaff = await prisma.staff.findUnique({
      where: { staffCode: staffCode }
    })

    if (existingStaff) {
      return NextResponse.json({
        error: `رقم ${staffCode} مستخدم بالفعل للموظف: ${existingStaff.name}`
      }, { status: 400 })
    }

    const staff = await prisma.staff.create({
      data: {
        staffCode: staffCode,
        name,
        phone,
        position,
        salary,
        notes,
      },
    })

    return NextResponse.json(staff, { status: 201 })
  } catch (error: any) {
    console.error('Error creating staff:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية إضافة موظفين' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({ error: 'فشل إضافة الموظف' }, { status: 500 })
  }
}

// PUT - تحديث موظف
export async function PUT(request: Request) {
  try {
    // ✅ التحقق من صلاحية تعديل موظف
    await requirePermission(request, 'canEditStaff')

    const body = await request.json()
    const { id, staffCode, name, phone, position, salary, notes, isActive, customPosition } = body

    // ✅ تحضير البيانات للتحديث (فقط الحقول المسموحة)
    const updateData: any = {}

    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone
    if (position !== undefined) updateData.position = position
    if (salary !== undefined) updateData.salary = salary
    if (notes !== undefined) updateData.notes = notes
    if (isActive !== undefined) updateData.isActive = isActive

    // ✅ إذا كان في تحديث للـ staffCode، تحقق من عدم التكرار
    if (staffCode !== undefined) {
      const existingStaff = await prisma.staff.findUnique({
        where: { staffCode: staffCode }
      })

      if (existingStaff && existingStaff.id !== id) {
        return NextResponse.json({
          error: `رقم ${staffCode} مستخدم بالفعل`
        }, { status: 400 })
      }

      updateData.staffCode = staffCode
    }

    const staff = await prisma.staff.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(staff)
  } catch (error: any) {
    console.error('Error updating staff:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تعديل الموظفين' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل تحديث الموظف' }, { status: 500 })
  }
}

// DELETE - حذف موظف
export async function DELETE(request: Request) {
  try {
    // ✅ التحقق من صلاحية حذف موظف
    await requirePermission(request, 'canDeleteStaff')
    
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'رقم الموظف مطلوب' }, { status: 400 })
    }

    await prisma.staff.delete({ where: { id } })
    return NextResponse.json({ message: 'تم الحذف بنجاح' })
  } catch (error: any) {
    console.error('Error deleting staff:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية حذف الموظفين' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({ error: 'فشل حذف الموظف' }, { status: 500 })
  }
}
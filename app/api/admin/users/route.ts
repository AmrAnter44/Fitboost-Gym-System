// app/api/admin/users/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requireAdmin } from '../../../../lib/auth'
import bcrypt from 'bcryptjs'

// GET - جلب جميع المستخدمين

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // التحقق من أن المستخدم Admin
    await requireAdmin(request)
    
    const users = await prisma.user.findMany({
      include: {
        permissions: true,
        staff: true  // ✅ جلب بيانات الموظف (للكوتشات)
      },
      orderBy: { createdAt: 'desc' }
    })
    
    // إخفاء كلمة المرور من النتيجة
    const usersWithoutPassword = users.map(user => {
      const { password, ...userWithoutPassword } = user
      return userWithoutPassword
    })
    
    return NextResponse.json(usersWithoutPassword)
    
  } catch (error: any) {
    console.error('Error fetching users:', error)
    
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية الوصول' },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { error: 'فشل جلب المستخدمين' },
      { status: 500 }
    )
  }
}

// POST - إضافة مستخدم جديد
export async function POST(request: Request) {
  try {
    // التحقق من أن المستخدم Admin
    await requireAdmin(request)
    
    const body = await request.json()
    const { name, email, password, role, staffId } = body

    // التحقق من البيانات
    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: 'جميع الحقول مطلوبة' },
        { status: 400 }
      )
    }

    // ✅ التحقق من اختيار موظف للكوتش
    if (role === 'COACH' && !staffId) {
      return NextResponse.json(
        { error: 'يجب اختيار موظف لحساب الكوتش' },
        { status: 400 }
      )
    }

    // ✅ التحقق من أن الموظف موجود وليس لديه حساب
    if (role === 'COACH' && staffId) {
      const staff = await prisma.staff.findUnique({
        where: { id: staffId },
        include: { user: true }
      })

      if (!staff) {
        return NextResponse.json(
          { error: 'الموظف غير موجود' },
          { status: 404 }
        )
      }

      if (staff.user) {
        return NextResponse.json(
          { error: 'هذا الموظف لديه حساب مستخدم بالفعل' },
          { status: 400 }
        )
      }
    }
    
    // التحقق من طول كلمة المرور
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' },
        { status: 400 }
      )
    }
    
    // التحقق من عدم تكرار البريد
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني مستخدم بالفعل' },
        { status: 400 }
      )
    }
    
    // تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(password, 10)
    
    // إنشاء المستخدم
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        isActive: true,
        staffId: role === 'COACH' ? staffId : undefined  // ✅ ربط بالموظف للكوتش
      }
    })
    
    // إنشاء صلاحيات افتراضية
    await prisma.permission.create({
      data: {
        userId: user.id,
        // صلاحيات افتراضية حسب الـ role
        canViewMembers: role === 'MANAGER' || role === 'STAFF',
        canCreateMembers: role === 'MANAGER',
        canEditMembers: role === 'MANAGER',
        canDeleteMembers: false,
        canViewPT: role === 'MANAGER' || role === 'STAFF' || role === 'COACH',
        canCreatePT: role === 'MANAGER',
        canEditPT: role === 'MANAGER',
        canDeletePT: false,
        canRegisterPTAttendance: role === 'COACH',  // ✅ الكوتش يسجل الحضور فقط
        canViewStaff: role === 'MANAGER',
        canCreateStaff: false,
        canEditStaff: false,
        canDeleteStaff: false,
        canViewReceipts: role === 'MANAGER' || role === 'STAFF',
        canEditReceipts: role === 'MANAGER',
        canDeleteReceipts: false,
        canViewReports: role === 'MANAGER',
        canViewFinancials: role === 'MANAGER',
        canAccessSettings: false
      }
    })
    
    // إرجاع المستخدم بدون كلمة المرور
    const { password: _, ...userWithoutPassword } = user
    
    return NextResponse.json(userWithoutPassword, { status: 201 })
    
  } catch (error: any) {
    console.error('Error creating user:', error)
    
    if (error.message === 'Unauthorized' || error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية الوصول' },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { error: 'فشل إضافة المستخدم' },
      { status: 500 }
    )
  }
}
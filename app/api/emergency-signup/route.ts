// app/api/emergency-signup/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import bcrypt from 'bcryptjs'

// 🔒 المفتاح السري من environment variables
const SECRET_KEY = process.env.EMERGENCY_SIGNUP_SECRET || 'build-time-placeholder'

function getSecretKey(): string {
  const secret = process.env.EMERGENCY_SIGNUP_SECRET
  if (!secret && process.env.NODE_ENV !== 'production') {
    console.warn('⚠️ EMERGENCY_SIGNUP_SECRET not set, using development fallback')
    return 'development-emergency-secret'
  }
  if (!secret) {
    throw new Error('EMERGENCY_SIGNUP_SECRET must be set in environment variables')
  }
  return secret
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, name, password, secretKey } = body

    // التحقق من المفتاح السري
    if (secretKey !== getSecretKey()) {
      return NextResponse.json(
        { error: 'المفتاح السري غير صحيح' },
        { status: 403 }
      )
    }

    // التحقق من وجود البيانات
    if (!email || !name || !password) {
      return NextResponse.json(
        { error: 'جميع الحقول مطلوبة' },
        { status: 400 }
      )
    }

    // التحقق من طول كلمة المرور
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' },
        { status: 400 }
      )
    }

    // التحقق من عدم وجود البريد الإلكتروني
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني موجود مسبقاً' },
        { status: 400 }
      )
    }

    // تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(password, 10)

    // إنشاء المستخدم
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true
      }
    })

    // إنشاء الصلاحيات الكاملة
    await prisma.permission.create({
      data: {
        userId: user.id,
        // صلاحيات الأعضاء
        canViewMembers: true,
        canCreateMembers: true,
        canEditMembers: true,
        canDeleteMembers: true,
        // صلاحيات PT
        canViewPT: true,
        canCreatePT: true,
        canEditPT: true,
        canDeletePT: true,
        // صلاحيات الموظفين
        canViewStaff: true,
        canCreateStaff: true,
        canEditStaff: true,
        canDeleteStaff: true,
        // صلاحيات الإيصالات
        canViewReceipts: true,
        canEditReceipts: true,
        canDeleteReceipts: true,
        // صلاحيات التقارير والإعدادات
        canViewReports: true,
        canViewFinancials: true,
        canAccessSettings: true
      }
    })

    // تسجيل في ActivityLog
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'EMERGENCY_ADMIN_CREATED',
        resource: 'User',
        resourceId: user.id,
        details: JSON.stringify({ email, name, method: 'emergency-signup' })
      }
    })

    return NextResponse.json({
      message: 'تم إنشاء حساب الأدمن بنجاح',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    })

  } catch (error: any) {
    console.error('Emergency signup error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إنشاء الحساب' },
      { status: 500 }
    )
  }
}
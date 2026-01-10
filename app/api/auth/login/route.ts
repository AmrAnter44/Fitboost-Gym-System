// app/api/auth/login/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { logError } from '../../../../lib/errorLogger'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    // البحث عن المستخدم بالإيميل أو الاسم
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email },
          { name: email }  // إذا أدخل اسم بدلاً من email
        ]
      },
      include: {
        permissions: true,
        staff: true  // ✅ جلب بيانات الموظف
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'الاسم أو البريد الإلكتروني أو كلمة المرور غير صحيحة' },
        { status: 401 }
      )
    }
    
    // التحقق من كلمة المرور
    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'الاسم أو البريد الإلكتروني أو كلمة المرور غير صحيحة' },
        { status: 401 }
      )
    }
    
    // التحقق من أن الحساب نشط
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'حسابك موقوف. تواصل مع المدير' },
        { status: 403 }
      )
    }

    // ✅ استخدام الاسم من جدول Staff إذا كان المستخدم موظف
    const displayName = user.staff?.name || user.name

    console.log('✅ تسجيل دخول:', {
      email: user.email,
      role: user.role,
      userTableName: user.name,
      staffTableName: user.staff?.name,
      displayName: displayName
    })

    // إنشاء JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        name: displayName,  // ✅ استخدام الاسم من Staff
        email: user.email,
        role: user.role,
        staffId: user.staffId,
        permissions: user.permissions
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    // إرجاع التوكن
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: displayName,  // ✅ استخدام الاسم من Staff
        email: user.email,
        role: user.role,
        staffId: user.staffId
      }
    })
    
    // حفظ التوكن في الكوكيز (متوافق مع port forwarding)
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: false, // ✅ false عشان HTTP يشتغل (مش HTTPS فقط)
      sameSite: 'lax', // ✅ lax يسمح بالإرسال في نفس الـ site
      path: '/', // ✅ متاح في كل الـ paths
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })
    
    return response
    
  } catch (error) {
    console.error('Login error:', error)

    // Log error to file
    logError({
      error,
      endpoint: '/api/auth/login',
      method: 'POST',
      statusCode: 500
    })

    return NextResponse.json(
      { error: 'حدث خطأ في تسجيل الدخول' },
      { status: 500 }
    )
  }
}
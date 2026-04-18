// app/api/auth/login/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { logError } from '../../../../lib/errorLogger'
import { checkRateLimit, getClientIdentifier } from '../../../../lib/rateLimit'
import { logLogin, logLoginFailure, logRateLimitHit, getIpAddress, getUserAgent } from '../../../../lib/auditLog'
import { DEFAULT_PERMISSIONS } from '../../../../types/permissions'

export const dynamic = 'force-dynamic'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required')
}
if (JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters')
}

export async function POST(request: Request) {
  try {
    // 🔒 Rate Limiting: 5 محاولات كل 15 دقيقة
    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(clientId, {
      id: 'login',
      limit: 5,
      windowMs: 15 * 60 * 1000 // 15 minutes
    })

    if (!rateLimit.success) {
      // 📝 Audit: Rate limit hit
      await logRateLimitHit({
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request),
        endpoint: '/api/auth/login'
      })

      return NextResponse.json(
        {
          error: rateLimit.error || 'محاولات تسجيل دخول كثيرة. حاول مرة أخرى لاحقاً',
          resetAt: rateLimit.resetAt
        },
        { status: 429 }
      )
    }

    const { email, password } = await request.json()

    // 🔐 Fallback Account - حساب احتياطي ثابت (خارج قاعدة البيانات)
    const OWNER_EMAIL = process.env.OWNER_EMAIL?.trim()
    const OWNER_PASSWORD = process.env.OWNER_PASSWORD?.trim()

    if (OWNER_EMAIL && OWNER_PASSWORD && email === OWNER_EMAIL && password === OWNER_PASSWORD) {
      const fallbackUser = {
        id: 'fallback-fitboost-account',
        name: 'FitBoost Admin',
        email: 'fitboost@system.local',
        role: 'OWNER' as const,
        staffId: null,
        permissions: DEFAULT_PERMISSIONS.OWNER
      }

      const token = jwt.sign(
        {
          userId: fallbackUser.id,
          name: fallbackUser.name,
          email: fallbackUser.email,
          role: fallbackUser.role,
          staffId: null,
          permissions: DEFAULT_PERMISSIONS.OWNER
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      )

      const response = NextResponse.json({
        success: true,
        user: fallbackUser
      })

      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://') ?? false,
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      })

      // 📝 Audit: Fallback account login
      try {
        await logLogin({
          userId: fallbackUser.id,
          userEmail: fallbackUser.email,
          userName: fallbackUser.name,
          userRole: fallbackUser.role,
          ipAddress: getIpAddress(request),
          userAgent: getUserAgent(request)
        })
      } catch (auditError) {
        // تجاهل أخطاء الـ audit log إذا كانت قاعدة البيانات معطلة
      }

      return response
    }

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
      // 📝 Audit: Login failed - user not found
      await logLoginFailure({
        email,
        reason: 'User not found',
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request)
      })

      return NextResponse.json(
        { error: 'الاسم أو البريد الإلكتروني أو كلمة المرور غير صحيحة' },
        { status: 401 }
      )
    }

    // التحقق من كلمة المرور
    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      // 📝 Audit: Login failed - invalid password
      await logLoginFailure({
        email: user.email,
        reason: 'Invalid password',
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request)
      })

      return NextResponse.json(
        { error: 'الاسم أو البريد الإلكتروني أو كلمة المرور غير صحيحة' },
        { status: 401 }
      )
    }

    // التحقق من أن الحساب نشط
    if (!user.isActive) {
      // 📝 Audit: Login failed - account inactive
      await logLoginFailure({
        email: user.email,
        reason: 'Account inactive',
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request)
      })

      return NextResponse.json(
        { error: 'حسابك موقوف. تواصل مع المدير' },
        { status: 403 }
      )
    }

    // ✅ استخدام الاسم من جدول Staff إذا كان المستخدم موظف
    const displayName = user.staff?.name || user.name

    // ✅ استخدام DEFAULT_PERMISSIONS إذا لم تكن موجودة في قاعدة البيانات
    let permissions = (user.permissions || DEFAULT_PERMISSIONS[user.role as keyof typeof DEFAULT_PERMISSIONS]) as any

    // ✅ لو سيلز → أضف صلاحيات المتابعات للـ JWT تلقائياً
    if (user.isSales) {
      permissions = {
        ...permissions,
        canViewFollowUps: true,
        canCreateFollowUp: true,
        canEditFollowUp: true,
        canDeleteFollowUp: true,
        canViewMembers: true,
        canViewVisitors: true,
        canCreateVisitor: true,
        canEditVisitor: true,
        canViewDayUse: true,
        canViewStaff: true,
      }
    }

    // إنشاء JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        name: displayName,
        email: user.email,
        role: user.role,
        staffId: user.staffId,
        isSales: user.isSales ?? false,  // ✅ تضمين isSales في الـ JWT
        permissions
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
    
    // حفظ التوكن في الكوكيز
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://') ?? false, // ✅ Only secure on HTTPS sites
      sameSite: 'strict', // ✅ حماية أقوى من CSRF attacks
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })

    // 📝 Audit: Successful login
    await logLogin({
      userId: user.id,
      userEmail: user.email,
      userName: displayName,
      userRole: user.role,
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request)
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
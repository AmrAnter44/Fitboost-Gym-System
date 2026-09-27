// app/api/auth/login/route.ts
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '../../../../lib/prisma'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { logError } from '../../../../lib/errorLogger'
import { checkRateLimit, getClientIdentifier } from '../../../../lib/rateLimit'
import { logLogin, logLoginFailure, logRateLimitHit, getIpAddress, getUserAgent } from '../../../../lib/auditLog'
import { DEFAULT_PERMISSIONS } from '../../../../types/permissions'
import { validateLicense } from '../../../../lib/license'
import { adminLogin, getDeviceToken, GatewayError } from '../../../../lib/gateway'

export const dynamic = 'force-dynamic'

// JWT secret is read lazily inside the handler so `next build` can compile this
// route in CI environments that don't set the env var.
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters')
  }
  return secret
}

/**
 * Cookies should be marked Secure only when actually served over HTTPS.
 * On a gym LAN where employees connect via plain HTTP to the host PC's
 * Fitboost server, Secure cookies would be silently dropped by the browser,
 * forcing repeated login redirects and "access denied" loops.
 *
 * Detects the request's protocol from:
 *   1. x-forwarded-proto header (proxies / reverse-proxies)
 *   2. request.url scheme (direct connection)
 *   3. Falls back to NODE_ENV (true in production HTTPS-by-default scenarios)
 */
function cookieSecure(request?: Request): boolean {
  if (request) {
    const xfProto = request.headers.get('x-forwarded-proto')
    if (xfProto) return xfProto.toLowerCase() === 'https'
    try {
      return new URL(request.url).protocol === 'https:'
    } catch { /* fall through */ }
  }
  return process.env.NODE_ENV === 'production'
}

/** Timing-safe string equality (constant-time) */
function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
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

    const { email, password, code } = await request.json()

    // 🔒 Rate Limit إضافي مربوط بالحساب نفسه (مش الـ IP بس).
    //    الـ IP-based limit ممكن يتخطى بتزوير X-Forwarded-For؛ الحد ده بيمنع
    //    brute-force على إيميل واحد حتى لو المهاجم بيدوّر الـ IP.
    if (typeof email === 'string' && email.trim()) {
      const acct = checkRateLimit(email.trim().toLowerCase(), {
        id: 'login-account',
        limit: 10,
        windowMs: 15 * 60 * 1000 // 15 minutes
      })
      if (!acct.success) {
        await logRateLimitHit({
          ipAddress: getIpAddress(request),
          userAgent: getUserAgent(request),
          endpoint: '/api/auth/login'
        })
        return NextResponse.json(
          {
            error: acct.error || 'محاولات كثيرة على هذا الحساب. حاول مرة أخرى لاحقاً',
            resetAt: acct.resetAt
          },
          { status: 429 }
        )
      }
    }

    // 🔐 Fallback Account - حساب احتياطي ثابت (خارج قاعدة البيانات)
    // - يدعم OWNER_PASSWORD_HASH (bcrypt) كالاختيار الموصى به
    // - OWNER_PASSWORD (plain) يُقبل فقط للـ backward compat؛ يُقارَن بشكل timing-safe
    const OWNER_EMAIL = process.env.OWNER_EMAIL?.trim()
    // ⚠️ bcrypt hashes بتحتوي على '$' والـ Next (dotenv-expand) بيعمل variable
    //    expansion فبيفسد الهاش وقت التحميل. الحل: نخزّنه base64 (بدون '$')
    //    في OWNER_PASSWORD_HASH_B64 ونفكّه هنا. مع fallback للصيغة القديمة.
    const OWNER_PASSWORD_HASH_B64 = process.env.OWNER_PASSWORD_HASH_B64?.trim()
    const OWNER_PASSWORD_HASH = OWNER_PASSWORD_HASH_B64
      ? Buffer.from(OWNER_PASSWORD_HASH_B64, 'base64').toString('utf8')
      : process.env.OWNER_PASSWORD_HASH?.trim()
    const OWNER_PASSWORD = process.env.OWNER_PASSWORD?.trim()

    let ownerMatch = false
    // 🔒 الحساب الاحتياطي من الـ env للتطوير بس. في النسخ اللي بتتشحن للجيمات، حساب
    //    FitBoost Admin بيتحقق منه Control (باسورد + كود تحقق) — مفيش هاش على الجهاز.
    if (process.env.NODE_ENV !== 'production' && OWNER_EMAIL && email === OWNER_EMAIL && typeof password === 'string') {
      if (OWNER_PASSWORD_HASH) {
        try {
          ownerMatch = await bcrypt.compare(password, OWNER_PASSWORD_HASH)
        } catch {
          ownerMatch = false
        }
      } else if (OWNER_PASSWORD) {
        ownerMatch = timingSafeEqualStrings(password, OWNER_PASSWORD)
      }
    }

    if (ownerMatch) {
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
        getJwtSecret(),
        { expiresIn: '7d' }
      )

      const response = NextResponse.json({
        success: true,
        user: fallbackUser
      })

      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: cookieSecure(request),
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

    // 🔐 FitBoost Admin: إيميل مش موجود في الجيم → نسأل Control (نفس حساب Control + كود التحقق)
    if (!user && typeof email === 'string' && email.includes('@') && typeof password === 'string' && password && (await getDeviceToken())) {
      try {
        const r = await adminLogin(email.trim(), password, typeof code === 'string' && code.trim() ? code.trim() : undefined)
        if (r.step === 'code') {
          // الإيميل والباسورد صح — مستني كود التحقق بخطوتين
          return NextResponse.json({ needsCode: true })
        }
        if (r.ok) {
          const adminUser = {
            id: 'fallback-fitboost-account',
            name: r.name ? `FitBoost · ${r.name}` : 'FitBoost Admin',
            email: r.email || email.trim().toLowerCase(),
            role: 'OWNER' as const,
            staffId: null,
            permissions: DEFAULT_PERMISSIONS.OWNER
          }
          const token = jwt.sign(
            {
              userId: adminUser.id,
              name: adminUser.name,
              email: adminUser.email,
              role: adminUser.role,
              staffId: null,
              permissions: DEFAULT_PERMISSIONS.OWNER
            },
            getJwtSecret(),
            { expiresIn: '12h' } // جلسة قصيرة لحساب بيدخل على كل الجيمات
          )
          const response = NextResponse.json({ success: true, user: adminUser })
          response.cookies.set('auth-token', token, {
            httpOnly: true,
            secure: cookieSecure(request),
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 60 * 12
          })
          try {
            await logLogin({
              userId: adminUser.id,
              userEmail: adminUser.email,
              userName: adminUser.name,
              userRole: adminUser.role,
              ipAddress: getIpAddress(request),
              userAgent: getUserAgent(request)
            })
          } catch { /* audit اختياري */ }
          return response
        }
      } catch (e) {
        if (e instanceof GatewayError) {
          if (e.status === 0) {
            return NextResponse.json({ error: 'حساب FitBoost محتاج إنترنت — مفيش اتصال دلوقتي' }, { status: 503 })
          }
          if (e.code === 'BAD_CODE') {
            return NextResponse.json({ error: 'كود التحقق غلط أو خلص وقته', needsCode: true }, { status: 401 })
          }
          if (e.code === 'RATE_LIMITED' || e.code === 'NO_2FA') {
            return NextResponse.json({ error: e.message }, { status: e.status })
          }
          // BAD_CREDENTIALS وغيره → نفس رسالة الخطأ العادية تحت
        }
      }
    }

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

    // 🔒 فحص الرخصة — OWNER فقط يدخل عند انتهاء الرخصة، غيره يُرفض
    if (user.role !== 'OWNER') {
      try {
        const licenseResult = await validateLicense()
        if (!licenseResult.valid) {
          await logLoginFailure({
            email: user.email,
            reason: 'License expired',
            ipAddress: getIpAddress(request),
            userAgent: getUserAgent(request)
          })
          return NextResponse.json(
            {
              error: 'الرخصة منتهية — لا يمكن تسجيل الدخول. تواصل مع مالك النظام (OWNER).',
              licenseExpired: true,
              message: licenseResult.message
            },
            { status: 403 }
          )
        }
      } catch {
        // لو فشل فحص الرخصة بسبب خطأ غير متوقع، اسمح بالدخول (fail-open للـ availability)
      }
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
      getJwtSecret(),
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
        staffId: user.staffId,
        isSales: user.isSales ?? false,  //  عشان صفحة اللوجين توجّه السيلز للداشبورد
      }
    })
    
    // حفظ التوكن في الكوكيز
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: cookieSecure(request), // ✅ secure في production دائماً
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
    // Don't leak stack traces to console/client
    const errMsg = error instanceof Error ? error.message : 'unknown'
    console.error('Login error:', errMsg)

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
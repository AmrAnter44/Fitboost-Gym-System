// app/api/emergency-signup/route.ts
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '../../../lib/prisma'
import bcrypt from 'bcryptjs'
import { validatePasswordStrength } from '../../../lib/inputValidation'
import { checkRateLimit, getClientIdentifier } from '../../../lib/rateLimit'

export const dynamic = 'force-dynamic'

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

export async function POST(request: NextRequest) {
  try {
    // 🔒 ممنوع في production نهائياً
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_EMERGENCY_SIGNUP !== 'true') {
      return NextResponse.json(
        { error: 'Emergency signup is disabled' },
        { status: 404 }
      )
    }

    // 🔒 Rate limit: 3 attempts / 15 min per IP
    const clientId = getClientIdentifier(request)
    const rl = checkRateLimit(clientId, { id: 'emergency-signup', limit: 3, windowMs: 15 * 60 * 1000 })
    if (!rl.success) {
      return NextResponse.json({ error: rl.error || 'Too many requests' }, { status: 429 })
    }

    // 🔒 SECRET لازم يكون معرّف في env — مفيش default
    const expectedSecret = process.env.EMERGENCY_SIGNUP_SECRET
    if (!expectedSecret || expectedSecret.length < 32) {
      return NextResponse.json(
        { error: 'Emergency signup is not configured' },
        { status: 503 }
      )
    }

    // 🔒 مرة واحدة فقط — لو فيه admin موجود بالفعل، رفض
    const existingAdminCount = await prisma.user.count({
      where: { role: { in: ['ADMIN', 'OWNER'] } }
    })
    if (existingAdminCount > 0) {
      return NextResponse.json(
        { error: 'Admin already exists — emergency signup is locked' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email, name, password, secretKey } = body

    // 🔒 Timing-safe secret comparison
    if (typeof secretKey !== 'string' || !timingSafeEqualStrings(secretKey, expectedSecret)) {
      return NextResponse.json(
        { error: 'المفتاح السري غير صحيح' },
        { status: 403 }
      )
    }

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: 'جميع الحقول مطلوبة' },
        { status: 400 }
      )
    }

    // 🔒 Strong password policy
    const strength = validatePasswordStrength(password)
    if (!strength.isValid) {
      return NextResponse.json(
        { error: strength.errors.join(' • ') },
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    })
    if (existingUser) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني موجود مسبقاً' },
        { status: 400 }
      )
    }

    // 🔒 bcrypt cost 12
    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true
      }
    })

    await prisma.permission.create({
      data: {
        userId: user.id,
        canViewMembers: true,
        canCreateMembers: true,
        canEditMembers: true,
        canDeleteMembers: true,
        canViewPT: true,
        canCreatePT: true,
        canEditPT: true,
        canDeletePT: true,
        canViewStaff: true,
        canCreateStaff: true,
        canEditStaff: true,
        canDeleteStaff: true,
        canViewReceipts: true,
        canEditReceipts: true,
        canDeleteReceipts: true,
        canViewReports: true,
        canViewFinancials: true,
        canAccessSettings: true
      }
    })

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'EMERGENCY_ADMIN_CREATED',
        resource: 'User',
        resourceId: user.id,
        details: JSON.stringify({ email, name, method: 'emergency-signup', ip: clientId })
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
    console.error('Emergency signup error:', error?.message || 'unknown')
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إنشاء الحساب' },
      { status: 500 }
    )
  }
}

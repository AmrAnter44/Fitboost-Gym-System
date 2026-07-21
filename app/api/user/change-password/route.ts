import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { validatePasswordStrength } from '@/lib/inputValidation'
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/auditLog'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

const FALLBACK_OWNER_ID = 'fallback-fitboost-account'

// POST - أي موظف يغيّر كلمة السر بتاعته (يكتب القديمة ثم الجديدة)
export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }

    //  حساب الأونر الاحتياطي (env) مالوش صف في الداتابيز — كلمة سره بتتغيّر من إعدادات النظام
    if (user.userId === FALLBACK_OWNER_ID) {
      return NextResponse.json(
        { error: 'حساب المالك الافتراضي: غيّر كلمة السر من إعدادات النظام مش من هنا' },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { oldPassword, newPassword } = body

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: 'اكتب كلمة السر القديمة والجديدة' }, { status: 400 })
    }

    //  منع إعادة تعيين نفس الكلمة
    if (oldPassword === newPassword) {
      return NextResponse.json({ error: 'كلمة السر الجديدة لازم تكون مختلفة عن القديمة' }, { status: 400 })
    }

    //  قوة كلمة السر الجديدة
    const strength = validatePasswordStrength(newPassword)
    if (!strength.isValid) {
      return NextResponse.json({ error: strength.errors.join(' • ') }, { status: 400 })
    }

    //  جلب المستخدم والتأكد من كلمة السر القديمة
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { id: true, email: true, name: true, role: true, password: true },
    })
    if (!dbUser) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
    }

    const oldMatches = await bcrypt.compare(oldPassword, dbUser.password)
    if (!oldMatches) {
      // نسجّل محاولة فاشلة في الـ audit
      createAuditLog({
        userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
        action: 'UPDATE', resource: 'User', resourceId: user.userId,
        details: { operation: 'ChangeOwnPassword', result: 'wrong_old_password' },
        ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'failure',
      })
      return NextResponse.json({ error: 'كلمة السر القديمة غير صحيحة' }, { status: 400 })
    }

    //  تشفير الجديدة بنفس التكلفة المستخدمة في إنشاء المستخدمين (12)
    const hashed = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id: user.userId },
      data: { password: hashed },
    })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'User', resourceId: user.userId,
      details: { operation: 'ChangeOwnPassword', result: 'success' },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success',
    })

    return NextResponse.json({ success: true, message: 'تم تغيير كلمة السر بنجاح' })
  } catch (error: any) {
    console.error('Error changing own password:', error)
    return NextResponse.json({ error: 'فشل تغيير كلمة السر' }, { status: 500 })
  }
}

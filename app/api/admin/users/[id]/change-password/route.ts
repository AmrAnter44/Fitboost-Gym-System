// app/api/admin/users/[id]/change-password/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyAuth, verifyOwnerPassword } from '../../../../../../lib/auth'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

// POST - تغيير كلمة مرور مستخدم (OWNER فقط)
export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  const params = await (context.params as any);
  try {
    // التحقق من تسجيل الدخول
    const currentUser = await verifyAuth(request)

    if (!currentUser) {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    // التحقق من أن المستخدم OWNER فقط
    if (currentUser.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'هذه الميزة متاحة للـ Owner فقط' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { newPassword, ownerPassword } = body

    // التحقق من الحقول المطلوبة
    if (!newPassword || !ownerPassword) {
      return NextResponse.json(
        { error: 'كلمة المرور الجديدة وكلمة مرور الـ Owner مطلوبة' },
        { status: 400 }
      )
    }

    // 🔒 Strong password policy
    const { validatePasswordStrength } = await import('../../../../../../lib/inputValidation')
    const strength = validatePasswordStrength(newPassword)
    if (!strength.isValid) {
      return NextResponse.json(
        { error: strength.errors.join(' • ') },
        { status: 400 }
      )
    }

    // ✅ التحقق من كلمة مرور الـ Owner — بيدعم الأونر الاحتياطي (env) والأونر في الـ DB
    const isValidOwnerPassword = await verifyOwnerPassword(ownerPassword, {
      userId: currentUser.userId,
      email: currentUser.email
    })

    if (!isValidOwnerPassword) {
      return NextResponse.json(
        { error: 'كلمة مرور الـ Owner غير صحيحة' },
        { status: 401 }
      )
    }

    // التحقق من وجود المستخدم المراد تغيير كلمة مروره
    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, email: true, role: true }
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    // تشفير كلمة المرور الجديدة
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // تحديث كلمة المرور
    await prisma.user.update({
      where: { id: params.id },
      data: { password: hashedPassword }
    })

    return NextResponse.json({
      success: true,
      message: `تم تغيير كلمة مرور ${targetUser.name} بنجاح`,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email
      }
    })

  } catch (error: any) {
    console.error('❌ خطأ في تغيير كلمة المرور:', error)

    return NextResponse.json(
      { error: 'فشل تغيير كلمة المرور' },
      { status: 500 }
    )
  }
}

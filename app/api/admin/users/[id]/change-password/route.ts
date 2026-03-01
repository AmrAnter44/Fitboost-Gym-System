// app/api/admin/users/[id]/change-password/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { verifyAuth } from '../../../../../../lib/auth'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

// POST - تغيير كلمة مرور مستخدم (OWNER فقط)
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    // التحقق من طول كلمة المرور الجديدة
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' },
        { status: 400 }
      )
    }

    // جلب بيانات الـ Owner الحالي للتحقق من كلمة المرور
    const ownerUser = await prisma.user.findUnique({
      where: { id: currentUser.userId },
      select: { id: true, password: true, role: true }
    })

    if (!ownerUser) {
      return NextResponse.json(
        { error: 'حساب الـ Owner غير موجود' },
        { status: 404 }
      )
    }

    // التحقق من كلمة مرور الـ Owner
    const isValidOwnerPassword = await bcrypt.compare(ownerPassword, ownerUser.password)

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

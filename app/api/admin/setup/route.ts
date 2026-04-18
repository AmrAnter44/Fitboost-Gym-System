// app/api/admin/setup/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

const MIN_PASSWORD_LENGTH = 12
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isStrongPassword(password: string): { valid: boolean; error?: string } {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} حرف على الأقل` }
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'كلمة المرور يجب أن تحتوي على حرف صغير' }
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'كلمة المرور يجب أن تحتوي على حرف كبير' }
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'كلمة المرور يجب أن تحتوي على رقم' }
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    return { valid: false, error: 'كلمة المرور يجب أن تحتوي على رمز خاص' }
  }
  return { valid: true }
}

export async function POST(request: Request) {
  try {
    const existingUsers = await prisma.user.count()

    if (existingUsers > 0) {
      return NextResponse.json(
        { error: 'يوجد مستخدمين بالفعل في النظام' },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { name, email, password } = body as { name?: string; email?: string; password?: string }

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'الاسم والبريد الإلكتروني وكلمة المرور مطلوبة' },
        { status: 400 }
      )
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني غير صحيح' },
        { status: 400 }
      )
    }

    const passwordCheck = isStrongPassword(password)
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: passwordCheck.error },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const admin = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true
      }
    })

    await prisma.permission.create({
      data: {
        userId: admin.id,
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

    return NextResponse.json({
      success: true,
      message: 'تم إنشاء حساب الأدمن بنجاح',
      credentials: {
        email: admin.email
      }
    })

  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json(
      { error: 'فشل إنشاء حساب الأدمن' },
      { status: 500 }
    )
  }
}

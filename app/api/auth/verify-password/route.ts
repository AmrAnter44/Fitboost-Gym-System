import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)

    if (!user) {
      return NextResponse.json(
        { error: 'غير مصرح - يجب تسجيل الدخول' },
        { status: 401 }
      )
    }

    // فقط OWNER يمكنه التحقق
    if (user.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'غير مصرح - فقط OWNER' },
        { status: 403 }
      )
    }

    const { password } = await request.json()

    if (!password) {
      return NextResponse.json(
        { error: 'كلمة المرور مطلوبة' },
        { status: 400 }
      )
    }

    // جلب بيانات المستخدم
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId }
    })

    if (!dbUser) {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    // التحقق من كلمة المرور
    const isValid = await bcrypt.compare(password, dbUser.password)

    if (!isValid) {
      return NextResponse.json(
        { error: 'كلمة المرور غير صحيحة' },
        { status: 401 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Verify password error:', error)
    return NextResponse.json(
      { error: 'خطأ في الخادم' },
      { status: 500 }
    )
  }
}

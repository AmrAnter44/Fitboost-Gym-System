import { NextResponse } from 'next/server'
import { verifyAuth, verifyOwnerPassword } from '../../../../lib/auth'

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

    // ✅ التحقق من كلمة المرور — بيدعم الأونر الاحتياطي (env) والأونر في الـ DB
    const isValid = await verifyOwnerPassword(password, {
      userId: user.userId,
      email: user.email
    })

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

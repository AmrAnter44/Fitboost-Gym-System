// app/api/auth/me/route.ts
import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'
import { DEFAULT_PERMISSIONS } from '../../../../types/permissions'

export const dynamic = 'force-dynamic'


export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)

    if (!user) {
      // Clear invalid cookies by setting expired cookie
      const response = NextResponse.json(
        { error: 'غير مصرح', clearCookies: true },
        { status: 401 }
      )

      response.cookies.set('auth-token', '', {
        httpOnly: true,
        secure: process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://') ?? false, // ✅ Only secure on HTTPS sites
        sameSite: 'lax',
        maxAge: 0, // Expire immediately
        path: '/'
      })

      return response
    }

    // ✅ إذا كان المستخدم موظف، جلب الاسم من جدول Staff
    let displayName = user.name
    if (user.staffId) {
      try {
        const staff = await prisma.staff.findUnique({
          where: { id: user.staffId }
        })
        if (staff?.name) {
          displayName = staff.name
        }
      } catch (error) {
        console.error('⚠️ خطأ في جلب اسم الموظف من Staff:', error)
      }
    }

    // ✅ استخدام DEFAULT_PERMISSIONS إذا لم تكن موجودة في JWT
    const permissions = user.permissions || DEFAULT_PERMISSIONS[user.role]

    // إرجاع بيانات المستخدم مع الاسم المحدث والصلاحيات
    return NextResponse.json({
      user: {
        ...user,
        name: displayName,  // ✅ استخدام الاسم من Staff
        permissions  // ✅ إضافة الصلاحيات
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'غير مصرح' },
      { status: 401 }
    )
  }
}
// app/api/auth/me/route.ts
import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'
import { DEFAULT_PERMISSIONS } from '../../../../types/permissions'
import { getCachedLicenseStatus } from '../../../../lib/license'

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
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0,
        path: '/'
      })

      return response
    }

    // ✅ جلب isSales + اسم وكود الموظف من DB
    let displayName = user.name
    let staffCode: string | null = null

    // جلب isSales مباشرة من جدول User
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { isSales: true }
    })
    const isSales = dbUser?.isSales ?? false

    if (user.staffId) {
      try {
        const staff = await prisma.staff.findUnique({
          where: { id: user.staffId },
          select: { name: true, staffCode: true }
        })
        if (staff?.name) {
          displayName = staff.name
        }
        if (staff?.staffCode) {
          staffCode = staff.staffCode
        }
      } catch (error) {
        console.error('⚠️ خطأ في جلب اسم الموظف من Staff:', error)
      }
    }

    // ✅ استخدام DEFAULT_PERMISSIONS إذا لم تكن موجودة في JWT
    const permissions = user.permissions || DEFAULT_PERMISSIONS[user.role]

    // 🔒 فحص الرخصة (cached — بدون Supabase call)
    let licenseValid = true
    let licenseMessage = ''
    try {
      const l = await getCachedLicenseStatus()
      licenseValid = l.valid
      licenseMessage = l.message
    } catch { /* ignore */ }

    return NextResponse.json({
      user: {
        ...user,
        name: displayName,
        staffCode,
        isSales,
        permissions
      },
      license: {
        valid: licenseValid,
        message: licenseMessage
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'غير مصرح' },
      { status: 401 }
    )
  }
}
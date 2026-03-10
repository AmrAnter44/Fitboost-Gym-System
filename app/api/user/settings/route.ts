import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET - جلب إعدادات المستخدم
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)

    if (!user) {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    const userSettings = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        darkMode: true,
        locale: true
      }
    })

    if (!userSettings) {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    return NextResponse.json(userSettings)
  } catch (error: any) {
    console.error('Error fetching user settings:', error)

    return NextResponse.json(
      { error: 'فشل جلب الإعدادات' },
      { status: 500 }
    )
  }
}

// PUT - تحديث إعدادات المستخدم
export async function PUT(request: Request) {
  try {
    const user = await verifyAuth(request)

    if (!user) {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { darkMode, locale } = body

    const updateData: any = {}
    if (darkMode !== undefined) updateData.darkMode = darkMode
    if (locale !== undefined) updateData.locale = locale

    const updatedUser = await prisma.user.update({
      where: { id: user.userId },
      data: updateData,
      select: {
        darkMode: true,
        locale: true
      }
    })

    return NextResponse.json(updatedUser)
  } catch (error: any) {
    console.error('Error updating user settings:', error)

    // Handle Prisma "Record not found" error
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'فشل تحديث الإعدادات' },
      { status: 500 }
    )
  }
}

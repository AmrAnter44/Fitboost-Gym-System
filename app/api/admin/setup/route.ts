// app/api/admin/setup/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'


export async function POST(request: Request) {
  try {
    const existingUsers = await prisma.user.count()
    
    if (existingUsers > 0) {
      return NextResponse.json(
        { error: 'يوجد مستخدمين بالفعل في النظام' },
        { status: 400 }
      )
    }

    const adminData = {
      name: 'Admin',
      email: 'admin@gym.com',
      password: 'admin123456',
      role: 'ADMIN'
    }

    const hashedPassword = await bcrypt.hash(adminData.password, 10)

    const admin = await prisma.user.create({
      data: {
        name: adminData.name,
        email: adminData.email,
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
        email: adminData.email
        // Password not included for security - shown on setup page
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
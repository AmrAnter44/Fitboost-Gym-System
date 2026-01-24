// app/api/admin/users/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { requireAdmin } from '../../../../../lib/auth'

// PUT - تحديث مستخدم

export const dynamic = 'force-dynamic'

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request)
    
    const body = await request.json()
    const { name, email, role, isActive } = body
    
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (role !== undefined) updateData.role = role
    if (isActive !== undefined) updateData.isActive = isActive
    
    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      include: {
        permissions: true
      }
    })
    
    const { password, ...userWithoutPassword } = user
    
    return NextResponse.json(userWithoutPassword)
    
  } catch (error: any) {
    console.error('Error updating user:', error)
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية' },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { error: 'فشل تحديث المستخدم' },
      { status: 500 }
    )
  }
}

// DELETE - حذف مستخدم
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request)
    
    // حذف الصلاحيات أولاً (cascade)
    await prisma.permission.deleteMany({
      where: { userId: params.id }
    })
    
    // حذف المستخدم
    await prisma.user.delete({
      where: { id: params.id }
    })
    
    return NextResponse.json({ success: true })
    
  } catch (error: any) {
    console.error('Error deleting user:', error)
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية' },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { error: 'فشل حذف المستخدم' },
      { status: 500 }
    )
  }
}
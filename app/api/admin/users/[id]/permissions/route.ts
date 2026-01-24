// app/api/admin/users/[id]/permissions/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { requireAdmin } from '../../../../../../lib/auth'

// PUT - تحديث صلاحيات مستخدم

export const dynamic = 'force-dynamic'

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request)
    
    const body = await request.json()
    
    // التحقق من وجود المستخدم
    const user = await prisma.user.findUnique({
      where: { id: params.id }
    })
    
    if (!user) {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }
    
    // لا يمكن تعديل صلاحيات Admin
    if (user.role === 'ADMIN') {
      return NextResponse.json(
        { error: 'لا يمكن تعديل صلاحيات المدير' },
        { status: 400 }
      )
    }
    
    // تحديث أو إنشاء الصلاحيات
    const permission = await prisma.permission.upsert({
      where: { userId: params.id },
      update: body,
      create: {
        userId: params.id,
        ...body
      }
    })
    
    return NextResponse.json(permission)
    
  } catch (error: any) {
    console.error('Error updating permissions:', error)
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية' },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { error: 'فشل تحديث الصلاحيات' },
      { status: 500 }
    )
  }
}

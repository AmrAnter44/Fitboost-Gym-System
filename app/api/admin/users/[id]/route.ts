// app/api/admin/users/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { requireAdmin } from '../../../../../lib/auth'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'STAFF', 'COACH'] as const
type AllowedRole = typeof ALLOWED_ROLES[number]

function authError(error: any) {
  if (error?.message === 'Unauthorized') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (typeof error?.message === 'string' && error.message.includes('Forbidden')) {
    return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
  }
  return null
}

// PUT - تحديث مستخدم
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const actor = await requireAdmin(request)

    const body = await request.json()
    const { name, email, role, isActive, isSales, staffId } = body

    // 🔒 منع self-edit على الـ role/isActive لمنع قفل المستخدم لنفسه خارج النظام
    const isSelf = actor.userId === params.id
    if (isSelf && (role !== undefined || isActive === false)) {
      return NextResponse.json(
        { error: 'لا يمكنك تغيير دورك أو تعطيل حسابك' },
        { status: 403 }
      )
    }

    // 🔒 تحقق من صحة قيمة الـ role لو مُرسَلة
    let validatedRole: AllowedRole | undefined
    if (role !== undefined) {
      if (!ALLOWED_ROLES.includes(role)) {
        return NextResponse.json(
          { error: 'دور غير صالح' },
          { status: 400 }
        )
      }
      validatedRole = role as AllowedRole

      // 🔒 OWNER/ADMIN لا يُنشأ/يُعدَّل إلا بواسطة OWNER
      if ((validatedRole === 'OWNER' || validatedRole === 'ADMIN') && actor.role !== 'OWNER') {
        return NextResponse.json(
          { error: 'تعيين دور OWNER أو ADMIN محصور على المالك (OWNER) فقط' },
          { status: 403 }
        )
      }
    }

    // 🔒 حماية المستخدم المُستهدَف: لا يُعدَّل OWNER إلا بواسطة OWNER
    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, role: true }
    })
    if (!targetUser) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
    }
    if (targetUser.role === 'OWNER' && actor.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'تعديل حساب OWNER محصور على OWNER فقط' },
        { status: 403 }
      )
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (validatedRole !== undefined) updateData.role = validatedRole
    if (isActive !== undefined) updateData.isActive = isActive
    if (isSales !== undefined) updateData.isSales = isSales
    if (staffId !== undefined) updateData.staffId = staffId || null

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      include: { permissions: true }
    })

    const { password, ...userWithoutPassword } = user

    // 📝 Audit log للعمليات الحساسة
    try {
      await prisma.activityLog.create({
        data: {
          userId: actor.userId,
          action: 'USER_UPDATED',
          resource: 'User',
          resourceId: params.id,
          details: JSON.stringify({
            changes: Object.keys(updateData),
            roleChanged: validatedRole !== undefined,
            targetUserRole: targetUser.role
          })
        }
      })
    } catch { /* non-fatal */ }

    return NextResponse.json(userWithoutPassword)

  } catch (error: any) {
    const authRes = authError(error)
    if (authRes) return authRes
    console.error('Error updating user:', error?.message || 'unknown')
    return NextResponse.json({ error: 'فشل تحديث المستخدم' }, { status: 500 })
  }
}

// DELETE - حذف مستخدم
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const actor = await requireAdmin(request)

    // 🔒 منع حذف النفس
    if (actor.userId === params.id) {
      return NextResponse.json(
        { error: 'لا يمكنك حذف حسابك' },
        { status: 403 }
      )
    }

    // 🔒 حماية OWNER — لا يُحذف إلا بواسطة OWNER
    const target = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, role: true }
    })
    if (!target) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
    }
    if (target.role === 'OWNER' && actor.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'حذف OWNER محصور على OWNER فقط' },
        { status: 403 }
      )
    }

    await prisma.permission.deleteMany({ where: { userId: params.id } })
    await prisma.user.delete({ where: { id: params.id } })

    try {
      await prisma.activityLog.create({
        data: {
          userId: actor.userId,
          action: 'USER_DELETED',
          resource: 'User',
          resourceId: params.id,
          details: JSON.stringify({ targetRole: target.role })
        }
      })
    } catch { /* non-fatal */ }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    const authRes = authError(error)
    if (authRes) return authRes
    console.error('Error deleting user:', error?.message || 'unknown')
    return NextResponse.json({ error: 'فشل حذف المستخدم' }, { status: 500 })
  }
}

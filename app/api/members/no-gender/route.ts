// app/api/members/no-gender/route.ts
// 🚻 الأعضاء اللي لسه جنسهم مش متحدد (للجيم المكس) — عدد + قائمة للتصنيف السريع
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requireAnyPermission } from '../../../../lib/auth'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

export const dynamic = 'force-dynamic'

//  🚻 تحديد الجنس — مفتوح لأي حد بيشوف الأعضاء، من غير صلاحية تعديل عضو أو الاسم/الموبايل.
//  بيكتب الجنس بس، ولعضو جنسه لسه مش متحدد (مايقدرش يغيّر جنس متسجّل).
export async function PATCH(request: Request) {
  try {
    const user = await requireAnyPermission(request, ['canViewMembers', 'canEditMembers'])
    const body = await request.json().catch(() => null)
    const id = typeof body?.id === 'string' ? body.id : ''
    const gender = body?.gender
    if (!id || !['male', 'female', 'unknown'].includes(gender)) {
      return NextResponse.json({ error: 'بيانات غير صحيحة' }, { status: 400 })
    }
    const { count } = await prisma.member.updateMany({
      where: { id, OR: [{ gender: null }, { gender: '' }] },
      data: { gender },
    })
    if (count === 0) {
      const exists = await prisma.member.findUnique({ where: { id }, select: { id: true } })
      if (!exists) return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })
      //  اتحدد من حد تاني قبلك — نشيله من القايمة من غير ما نغيّره
      return NextResponse.json({ success: true, alreadySet: true })
    }
    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'Member', resourceId: id,
      details: { operation: 'SetGender', gender },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success',
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    }
    console.error('set gender error:', error)
    return NextResponse.json({ error: 'فشل الحفظ' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    await requireAnyPermission(request, ['canViewMembers', 'canEditMembers'])

    const where = { OR: [{ gender: null }, { gender: '' }] }

    const [count, members] = await Promise.all([
      prisma.member.count({ where }),
      prisma.member.findMany({
        where,
        select: {
          id: true, name: true, memberNumber: true, phone: true,
          profileImage: true, isActive: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 500, // batch — الباقي بيظهر بعد ما القائمة دي تخلص (refetch)
      }),
    ])

    return NextResponse.json({ count, members })
  } catch (error: any) {
    console.error('no-gender members error:', error)
    if (error.message === 'Unauthorized' || error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    }
    return NextResponse.json({ error: 'فشل التحميل' }, { status: 500 })
  }
}

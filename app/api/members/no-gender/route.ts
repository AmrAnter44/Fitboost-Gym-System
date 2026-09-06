// app/api/members/no-gender/route.ts
// 🚻 الأعضاء اللي لسه جنسهم مش متحدد (للجيم المكس) — عدد + قائمة للتصنيف السريع
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requireAnyPermission } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

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

import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requireAdmin } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

// POST { staffId, rotations: [{ dayOfWeek, startTime, endTime, isVariable }] }
// Replaces all active rotations for the staff with the provided list (atomic).
export async function POST(request: Request) {
  try {
    await requireAdmin(request)
    const body = await request.json()
    const { staffId, rotations } = body as { staffId?: string; rotations?: Array<{ dayOfWeek: string; startTime: string; endTime: string; isVariable?: boolean }> }

    if (!staffId) return NextResponse.json({ error: 'staffId مطلوب' }, { status: 400 })
    if (!Array.isArray(rotations)) return NextResponse.json({ error: 'rotations array مطلوب' }, { status: 400 })

    const VALID_DAYS = new Set(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
    for (const r of rotations) {
      if (!r.dayOfWeek || !VALID_DAYS.has(r.dayOfWeek)) {
        return NextResponse.json({ error: `dayOfWeek غير صحيح: ${r.dayOfWeek}` }, { status: 400 })
      }
      if (!r.startTime || !r.endTime) {
        return NextResponse.json({ error: 'startTime و endTime مطلوبين' }, { status: 400 })
      }
    }

    const result = await prisma.$transaction([
      prisma.rotation.deleteMany({ where: { staffId } }),
      ...rotations.map(r =>
        prisma.rotation.create({
          data: {
            staffId,
            dayOfWeek: r.dayOfWeek,
            startTime: r.startTime,
            endTime: r.endTime,
            isVariable: r.isVariable ?? false,
            isActive: true,
          },
        })
      ),
    ])

    const created = result.slice(1)
    return NextResponse.json({ replaced: created.length, rotations: created }, { status: 200 })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden') || e.message?.includes('Admin')) return NextResponse.json({ error: 'صلاحية المسؤول مطلوبة' }, { status: 403 })
    return NextResponse.json({ error: e.message || 'فشل' }, { status: 500 })
  }
}

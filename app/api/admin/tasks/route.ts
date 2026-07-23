import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requireAdmin } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

const PRIORITIES = ['low', 'normal', 'high']

const parseDue = (s: any): Date | null => {
  if (!s || typeof s !== 'string') return null
  //  datetime-local: YYYY-MM-DDTHH:mm  → التاريخ والوقت المحددين
  const dtm = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s)
  if (dtm) {
    const d = new Date(parseInt(dtm[1]), parseInt(dtm[2]) - 1, parseInt(dtm[3]), parseInt(dtm[4]), parseInt(dtm[5]), 0, 0)
    return isNaN(d.getTime()) ? null : d
  }
  //  تاريخ فقط: YYYY-MM-DD → آخر اليوم بالتوقيت المحلي
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return null
  const d = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), 23, 59, 59, 999)
  return isNaN(d.getTime()) ? null : d
}

//  POST — الأدمن يعمل تاسك ويسنده لموظف/موظفين
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request)
    const b = await request.json()
    const title = (b.title || '').trim()
    const assigneeIds: string[] = Array.isArray(b.assigneeIds) ? ([...new Set(b.assigneeIds.filter((x: any) => typeof x === 'string' && x))] as string[]) : []

    if (!title) return NextResponse.json({ error: 'عنوان المهمة مطلوب' }, { status: 400 })
    if (assigneeIds.length === 0) return NextResponse.json({ error: 'اختار موظف واحد على الأقل' }, { status: 400 })

    //  نتأكد إن المستخدمين موجودين ونشطين
    const users = await prisma.user.findMany({ where: { id: { in: assigneeIds }, isActive: true }, select: { id: true } })
    if (users.length === 0) return NextResponse.json({ error: 'الموظفين المختارين غير موجودين' }, { status: 400 })

    const priority = PRIORITIES.includes(b.priority) ? b.priority : 'normal'

    const task = await prisma.task.create({
      data: {
        title,
        description: (b.description || '').trim() || null,
        dueDate: parseDue(b.dueDate),
        priority,
        createdBy: admin.userId,
        createdByName: admin.name || 'Admin',
        assignments: { create: users.map((u) => ({ userId: u.id })) },
      },
    })

    return NextResponse.json({ task, assignedCount: users.length }, { status: 201 })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (String(error?.message || '').includes('Forbidden')) return NextResponse.json({ error: 'مسموح للأدمن فقط' }, { status: 403 })
    console.error('Create task error:', error)
    return NextResponse.json({ error: 'فشل إنشاء المهمة' }, { status: 500 })
  }
}

//  GET — قائمة المهام مع حالة كل موظف + قائمة الموظفين للاختيار
export async function GET(request: Request) {
  try {
    await requireAdmin(request)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'active' | 'done' | null

    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: { assignments: true },
    })

    //  أسماء كل المسنَد لهم
    const userIds = [...new Set(tasks.flatMap((t) => t.assignments.map((a) => a.userId)))]
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    const nameMap = new Map(users.map((u) => [u.id, u.name]))

    let result = tasks.map((t) => {
      const assignments = t.assignments.map((a) => ({
        userId: a.userId,
        name: nameMap.get(a.userId) || '—',
        status: a.status,
        completedAt: a.completedAt,
      }))
      const doneCount = assignments.filter((a) => a.status === 'done').length
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        dueDate: t.dueDate,
        priority: t.priority,
        createdByName: t.createdByName,
        createdAt: t.createdAt,
        assignments,
        total: assignments.length,
        doneCount,
        allDone: assignments.length > 0 && doneCount === assignments.length,
      }
    })
    //  ملخص على كل المهام (قبل الفلتر) — للكروت
    const nowMs = new Date().getTime()
    const summary = {
      total: result.length,
      active: result.filter((t) => !t.allDone).length,
      done: result.filter((t) => t.allDone).length,
      overdue: result.filter((t) => !t.allDone && t.dueDate && new Date(t.dueDate).getTime() < nowMs).length,
    }

    if (status === 'active') result = result.filter((t) => !t.allDone)
    else if (status === 'done') result = result.filter((t) => t.allDone)

    //  الموظفين المتاحين للإسناد (كل النشطين ما عدا الأونر)
    const employees = await prisma.user.findMany({
      where: { isActive: true, role: { not: 'OWNER' } },
      select: { id: true, name: true, role: true, staff: { select: { position: true } } },
      orderBy: { name: 'asc' },
    })
    const emps = employees.map((e) => ({ id: e.id, name: e.name, role: e.role, position: e.staff?.position || null }))

    return NextResponse.json({ tasks: result, employees: emps, summary })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (String(error?.message || '').includes('Forbidden')) return NextResponse.json({ error: 'مسموح للأدمن فقط' }, { status: 403 })
    console.error('List tasks error:', error)
    return NextResponse.json({ error: 'فشل تحميل المهام' }, { status: 500 })
  }
}

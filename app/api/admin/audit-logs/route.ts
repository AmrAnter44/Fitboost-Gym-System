// app/api/admin/audit-logs/route.ts
import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../../lib/auth'
import { getAuditLogs } from '../../../../lib/auditLog'
import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'

type LogRow = Awaited<ReturnType<typeof getAuditLogs>>['logs'][number]

// اسم مفهوم للمورد بدل الـ id — من قاعدة البيانات مباشرة (يشمل السجلات القديمة)
async function buildResourceLabels(logs: LogRow[]): Promise<Map<string, string>> {
  const idsByResource: Record<string, Set<string>> = {}
  for (const log of logs) {
    if (!log.resourceId) continue
    ;(idsByResource[log.resource] ??= new Set()).add(log.resourceId)
  }

  const labels = new Map<string, string>()
  const collect = <T,>(resource: string, rows: T[], toLabel: (row: T & { id: string }) => string) => {
    rows.forEach(row => labels.set(`${resource}:${(row as any).id}`, toLabel(row as any)))
  }

  const tasks: Promise<unknown>[] = []
  if (idsByResource.Member?.size) {
    tasks.push(
      prisma.member
        .findMany({ where: { id: { in: [...idsByResource.Member] } }, select: { id: true, name: true, memberNumber: true } })
        .then(rows => collect('Member', rows, m => (m.memberNumber ? `${m.name} (#${m.memberNumber})` : m.name)))
        .catch(() => {})
    )
  }
  if (idsByResource.Receipt?.size) {
    tasks.push(
      prisma.receipt
        .findMany({
          where: { id: { in: [...idsByResource.Receipt] } },
          select: { id: true, receiptNumber: true, member: { select: { name: true } } },
        })
        .then(rows => collect('Receipt', rows, r => `#${r.receiptNumber}${r.member?.name ? ` — ${r.member.name}` : ''}`))
        .catch(() => {})
    )
  }
  if (idsByResource.Staff?.size) {
    tasks.push(
      prisma.staff
        .findMany({ where: { id: { in: [...idsByResource.Staff] } }, select: { id: true, name: true, staffCode: true } })
        .then(rows => collect('Staff', rows, s => (s.staffCode ? `${s.name} (#${s.staffCode})` : s.name)))
        .catch(() => {})
    )
  }
  if (idsByResource.User?.size || idsByResource.Permission?.size) {
    const ids = [...(idsByResource.User ?? []), ...(idsByResource.Permission ?? [])]
    tasks.push(
      prisma.user
        .findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })
        .then(rows => {
          rows.forEach(u => {
            const label = u.name || u.email
            if (idsByResource.User?.has(u.id)) labels.set(`User:${u.id}`, label)
            if (idsByResource.Permission?.has(u.id)) labels.set(`Permission:${u.id}`, label)
          })
        })
        .catch(() => {})
    )
  }
  if (idsByResource.Visitor?.size) {
    tasks.push(
      prisma.visitor
        .findMany({ where: { id: { in: [...idsByResource.Visitor] } }, select: { id: true, name: true } })
        .then(rows => collect('Visitor', rows, v => v.name))
        .catch(() => {})
    )
  }
  if (idsByResource.Expense?.size) {
    tasks.push(
      prisma.expense
        .findMany({ where: { id: { in: [...idsByResource.Expense] } }, select: { id: true, description: true } })
        .then(rows => collect('Expense', rows, e => e.description.slice(0, 60)))
        .catch(() => {})
    )
  }

  await Promise.all(tasks)
  return labels
}

// fallback من الـ details المخزنة (يغطي السجلات المحذوفة وموارد الخدمات)
function labelFromDetails(log: LogRow): string | null {
  if (!log.details) return null
  try {
    const details = JSON.parse(log.details)
    const name = details.memberName || details.name || details.resourceName || details.targetUser || details.attemptedEmail || null
    const number = details.memberNumber ? ` (#${details.memberNumber})` : ''
    if (name) return `${name}${number}`
    if (details.receiptNumber) return `#${details.receiptNumber}`
    return null
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  try {
    // ✅ التحقق من صلاحية Admin
    await requireAdmin(request)

    const { searchParams } = new URL(request.url)

    // استخراج البارامترات
    const limit = searchParams.get('limit')
    const offset = searchParams.get('offset')
    const userId = searchParams.get('userId')
    const userSearch = searchParams.get('user')  // User search by name or email
    const action = searchParams.get('action')
    const resource = searchParams.get('resource')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // جلب الـ logs
    const result = await getAuditLogs({
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0,
      userId: userId || undefined,
      userSearch: userSearch || undefined,
      action: action as any,
      resource: resource as any,
      status: status as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    })

    const labels = await buildResourceLabels(result.logs)
    const logs = result.logs.map(log => ({
      ...log,
      resourceLabel:
        (log.resourceId && labels.get(`${log.resource}:${log.resourceId}`)) ||
        labelFromDetails(log) ||
        null,
    }))

    return NextResponse.json({ logs, total: result.total })
  } catch (error: any) {
    console.error('Error fetching audit logs:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Admin access required')) {
      return NextResponse.json(
        { error: 'يجب أن تكون Admin للوصول لهذه الصفحة' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'فشل جلب سجلات التدقيق' },
      { status: 500 }
    )
  }
}

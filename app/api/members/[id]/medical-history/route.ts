// 🩺 الهيستوري الطبي للعضو — قراءة (عرض الأعضاء) وتعديل (تعديل الأعضاء)
//  العمود جديد فبنقرا/نكتب بـ raw SQL (آمن حتى لو الـ Prisma client لسه outdated)
import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { requirePermission } from '../../../../../lib/auth'
import { parseMedicalHistory, sanitizeMedicalHistory } from '../../../../../lib/medicalHistory'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../../lib/auditLog'

export const dynamic = 'force-dynamic'

function deny(e: any) {
  const unauth = e?.message === 'Unauthorized'
  return NextResponse.json({ error: unauth ? 'يجب تسجيل الدخول' : 'ليس لديك صلاحية' }, { status: unauth ? 401 : 403 })
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try { await requirePermission(request, 'canViewMembers') } catch (e) { return deny(e) }
  try {
    const rows: any = await prisma.$queryRawUnsafe(`SELECT medicalHistory FROM Member WHERE id = ? LIMIT 1`, params.id)
    if (!Array.isArray(rows) || !rows.length) return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })
    return NextResponse.json({ entries: parseMedicalHistory(rows[0].medicalHistory) })
  } catch {
    return NextResponse.json({ entries: [] })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  let user
  try { user = await requirePermission(request, 'canEditMembers') } catch (e) { return deny(e) }
  const body = await request.json().catch(() => null)
  const entries = sanitizeMedicalHistory(body?.entries)
  const n = await prisma.$executeRawUnsafe(
    `UPDATE Member SET medicalHistory = ? WHERE id = ?`,
    entries.length ? JSON.stringify(entries) : null,
    params.id
  )
  if (!n) return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })
  createAuditLog({
    userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
    action: 'UPDATE', resource: 'Member', resourceId: params.id,
    details: { type: 'MedicalHistory', entries },
    ipAddress: getIpAddress(request), userAgent: getUserAgent(request),
  })
  return NextResponse.json({ ok: true, entries })
}

import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requireAdmin } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

const DEPTS = ['coaches', 'reception', 'sales']

//  تجميع الـ User.ids المستهدفين حسب الأقسام
async function resolveRecipients(departments: string[]): Promise<{ id: string }[]> {
  const ids = new Set<string>()
  if (departments.includes('coaches')) {
    const coaches = await prisma.user.findMany({ where: { role: 'COACH', isActive: true }, select: { id: true } })
    coaches.forEach((u) => ids.add(u.id))
  }
  if (departments.includes('reception')) {
    const recep = await prisma.user.findMany({
      where: { isActive: true, staff: { position: { contains: 'ريسبشن' } } },
      select: { id: true },
    })
    recep.forEach((u) => ids.add(u.id))
  }
  if (departments.includes('sales')) {
    //  حسابات السيلز: role=STAFF بفلاج isSales أو الوظيفة فيها sales
    const sales = await prisma.user.findMany({
      where: { isActive: true, OR: [{ isSales: true }, { staff: { position: { contains: 'sales' } } }] },
      select: { id: true },
    })
    sales.forEach((u) => ids.add(u.id))
  }
  return [...ids].map((id) => ({ id }))
}

//  POST — الأدمن يبعت رسالة لقسم/أقسام
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request)
    const body = await request.json()
    const subject = (body.subject || '').trim()
    const messageBody = (body.body || '').trim()
    const departments: string[] = Array.isArray(body.departments) ? body.departments.filter((d: string) => DEPTS.includes(d)) : []
    const userIds: string[] = Array.isArray(body.userIds) ? ([...new Set(body.userIds.filter((x: any) => typeof x === 'string' && x))] as string[]) : []

    if (!subject) return NextResponse.json({ error: 'العنوان مطلوب' }, { status: 400 })
    if (!messageBody) return NextResponse.json({ error: 'محتوى الرسالة مطلوب' }, { status: 400 })
    if (departments.length === 0 && userIds.length === 0) return NextResponse.json({ error: 'اختار قسم أو أشخاص' }, { status: 400 })

    const ids = new Set<string>()
    //  الأقسام
    if (departments.length > 0) {
      const deptUsers = await resolveRecipients(departments)
      deptUsers.forEach((u) => ids.add(u.id))
    }
    //  أشخاص محددين
    let specificNames: string[] = []
    if (userIds.length > 0) {
      const users = await prisma.user.findMany({ where: { id: { in: userIds }, isActive: true }, select: { id: true, name: true } })
      users.forEach((u) => ids.add(u.id))
      specificNames = users.map((u) => u.name)
    }

    const recipientIds = [...ids]
    if (recipientIds.length === 0) {
      return NextResponse.json({ error: 'مفيش مستقبلين للرسالة' }, { status: 400 })
    }

    //  وصف المستهدَف: أقسام أو أسماء الأشخاص
    const targetDepts = departments.length > 0
      ? departments.join(',')
      : (specificNames.slice(0, 4).join('، ') + (specificNames.length > 4 ? ` +${specificNames.length - 4}` : ''))

    const message = await prisma.internalMessage.create({
      data: {
        senderId: admin.userId,
        senderName: admin.name || 'Admin',
        subject,
        body: messageBody,
        targetDepts,
        recipients: {
          create: recipientIds.map((id) => ({ userId: id })),
        },
      },
    })

    return NextResponse.json({ message, recipientCount: recipientIds.length }, { status: 201 })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (String(error?.message || '').includes('Forbidden')) return NextResponse.json({ error: 'مسموح للأدمن فقط' }, { status: 403 })
    console.error('Send internal mail error:', error)
    return NextResponse.json({ error: 'فشل إرسال الرسالة' }, { status: 500 })
  }
}

//  GET — قائمة الرسائل المرسلة + إحصائيات القراءة
export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const messages = await prisma.internalMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        recipients: { select: { isRead: true } },
        replies: { orderBy: { createdAt: 'asc' } },
      },
    })
    const result = messages.map((m) => ({
      id: m.id,
      subject: m.subject,
      body: m.body,
      senderName: m.senderName,
      targetDepts: m.targetDepts,
      createdAt: m.createdAt,
      total: m.recipients.length,
      readCount: m.recipients.filter((r) => r.isRead).length,
      replies: m.replies.map((rp) => ({ id: rp.id, userName: rp.userName, body: rp.body, createdAt: rp.createdAt })),
    }))

    //  قائمة الموظفين للاختيار الفردي (كل النشطين ما عدا الأونر)
    const employees = await prisma.user.findMany({
      where: { isActive: true, role: { not: 'OWNER' } },
      select: { id: true, name: true, role: true, staff: { select: { position: true } } },
      orderBy: { name: 'asc' },
    })
    const emps = employees.map((e) => ({ id: e.id, name: e.name, role: e.role, position: e.staff?.position || null }))

    return NextResponse.json({ messages: result, employees: emps })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (String(error?.message || '').includes('Forbidden')) return NextResponse.json({ error: 'مسموح للأدمن فقط' }, { status: 403 })
    console.error('List internal mail error:', error)
    return NextResponse.json({ error: 'فشل تحميل الرسائل' }, { status: 500 })
  }
}

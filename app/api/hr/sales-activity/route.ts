import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

//  خصائص السيلز — الأدمن يختار فترة + موظف سيلز ويشوف تواصله مع مين والعميل رد ولا مردّش
//  GET params: staffId (اختياري), from=YYYY-MM-DD, to=YYYY-MM-DD
//  بيرجّع دايماً قائمة موظفي السيلز (للدروب داون) + النشاط لو staffId متبعّت
export async function GET(request: Request) {
  try {
    await requirePermission(request, 'canManageSales')

    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')

    //  parsing بتوقيت محلي عشان نتجنّب أي timezone drift
    const parseDateLocal = (s: string | null): Date | null => {
      if (!s) return null
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
      if (!m) return null
      const dt = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
      return isNaN(dt.getTime()) ? null : dt
    }
    const now = new Date()
    const fromDate = parseDateLocal(fromParam)
    const toDate = parseDateLocal(toParam)
    const start = fromDate
      ? new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate(), 0, 0, 0, 0)
      : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const end = toDate
      ? new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate(), 23, 59, 59, 999)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    //  قائمة موظفي السيلز للدروب داون
    const reps = await prisma.staff.findMany({
      where: { isActive: true, position: { contains: 'sales' } },
      select: { id: true, name: true, staffCode: true },
      orderBy: { name: 'asc' },
    })

    //  لو مفيش موظف مختار — نرجّع القائمة بس
    if (!staffId) {
      return NextResponse.json({ reps, activity: [], summary: null })
    }

    //  متابعات الموظف في الفترة
    const followUps = await prisma.followUp.findMany({
      where: { assignedTo: staffId, createdAt: { gte: start, lte: end } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        result: true,
        contacted: true,
        notes: true,
        createdAt: true,
        visitor: { select: { name: true, phone: true } },
      },
    })

    //  تصنيف كل تواصل: رد / لم يرد / لسه (من غير نتيجة)
    const activity = followUps.map((f) => {
      const noAnswer = f.result === 'no-answer'
      const responded = !!f.result && f.result !== 'no-answer'
      const status: 'responded' | 'no-answer' | 'pending' = noAnswer ? 'no-answer' : responded ? 'responded' : 'pending'
      return {
        id: f.id,
        clientName: f.visitor?.name || null,
        clientPhone: f.visitor?.phone || null,
        result: f.result || null,
        notes: f.notes || null,
        createdAt: f.createdAt,
        status,
      }
    })

    const summary = {
      total: activity.length,
      responded: activity.filter((a) => a.status === 'responded').length,
      noAnswer: activity.filter((a) => a.status === 'no-answer').length,
      pending: activity.filter((a) => a.status === 'pending').length,
    }

    return NextResponse.json({ reps, activity, summary, from: fromParam, to: toParam, staffId })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    }
    if (String(error?.message || '').includes('Forbidden')) {
      return NextResponse.json({ error: 'مسموح لإدارة السيلز بس' }, { status: 403 })
    }
    console.error('Error loading sales activity:', error)
    return NextResponse.json({ error: 'فشل تحميل خصائص السيلز' }, { status: 500 })
  }
}

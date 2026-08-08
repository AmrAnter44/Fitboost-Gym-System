import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requireAnyPermission } from '../../../lib/auth'

export const dynamic = 'force-dynamic'


export async function GET(request: Request) {
  try {
    // ✅ التحقق من صلاحية عرض الإيصالات (أو صلاحية التقفيل اللي محتاجة الإيصالات)
    let user
    try {
      user = await requireAnyPermission(request, ['canViewReceipts', 'canAccessClosing'])
    } catch (permError: any) {
      // إذا لم يكن لديه صلاحية canViewReceipts، نتحقق إذا كان كوتش يريد رؤية إيصالات PT الخاصة به فقط
      const { verifyAuth } = await import('../../../lib/auth')
      user = await verifyAuth(request)

      if (!user) {
        throw new Error('Unauthorized')
      }

      // الكوتشات يمكنهم رؤية إيصالات PT الخاصة بهم فقط
      if (user.role === 'COACH') {
        // جلب اسم الكوتش من جدول Staff (للبحث بالاسم كـ fallback)
        const coachStaff = user.staffId
          ? await prisma.staff.findUnique({ where: { id: user.staffId }, select: { name: true } })
          : null

        // جلب كل PT records الخاصة بهذا الكوتش (بالـ userId أو بالاسم)
        const whereClause: any = coachStaff
          ? { OR: [{ coachUserId: user.userId }, { coachName: coachStaff.name }] }
          : { coachUserId: user.userId }

        const coachPTs = await prisma.pT.findMany({
          where: whereClause,
          select: { ptNumber: true }
        })

        if (coachPTs.length === 0) {
          return NextResponse.json([])
        }

        const ptNumbers = coachPTs.map(pt => pt.ptNumber)

        // جلب الإيصالات الخاصة بـ PT sessions هذا الكوتش فقط
        const receipts = await prisma.receipt.findMany({
          where: {
            ptNumber: { in: ptNumbers }
          },
          orderBy: { receiptNumber: 'desc' }
        })

        return NextResponse.json(receipts)
      }

      // إذا لم يكن كوتش، نرمي الخطأ الأصلي
      throw permError
    }

    // ✅ إذا كان لديه صلاحية canViewReceipts، نطبق المنطق العادي
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')
    const memberNumber = searchParams.get('memberNumber')
    const ptNumber = searchParams.get('ptNumber')
    const dayUseId = searchParams.get('dayUseId')
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const limit = searchParams.get('limit')
    const pageParam = searchParams.get('page')
    const pageSizeParam = searchParams.get('pageSize')

    if (memberId || memberNumber) {
      // إيصالات عضو معيّن: بالـ FK المباشر + الداتا القديمة اللي رقم العضوية فيها جوه itemDetails
      // + إيصالات الـ PT (بالهاتف) و DayUse (بالـ memberId/الهاتف) المربوطة بالعضو
      const or: Array<Record<string, unknown>> = []

      // 🔎 نجيب بيانات العضو (الهاتف + رقم العضوية) عشان نربط إيصالات PT و DayUse
      let resolvedId: string | null = memberId
      let resolvedPhone: string | null = null
      let resolvedNumber: string | null = memberNumber
      if (memberId) {
        const m = await prisma.member.findUnique({ where: { id: memberId }, select: { phone: true, memberNumber: true } })
        resolvedPhone = m?.phone ?? null
        if (m?.memberNumber) resolvedNumber = m.memberNumber
      } else if (memberNumber) {
        const m = await prisma.member.findUnique({ where: { memberNumber }, select: { id: true, phone: true } })
        resolvedId = m?.id ?? null
        resolvedPhone = m?.phone ?? null
      }

      if (resolvedId) or.push({ memberId: resolvedId })
      if (resolvedNumber) {
        or.push({ itemDetails: { contains: `"memberNumber":"${resolvedNumber}"` } })
        or.push({ itemDetails: { contains: `"memberNumber":${resolvedNumber}` } })
      }

      // 🎟️ إيصالات يوم الاستخدام / InBody المربوطة بالعضو (بالـ id أو الهاتف)
      const dayUseOr: Array<Record<string, unknown>> = []
      if (resolvedId) dayUseOr.push({ memberId: resolvedId })
      if (resolvedPhone) dayUseOr.push({ phone: resolvedPhone })
      if (dayUseOr.length > 0) {
        const dayUses = await prisma.dayUseInBody.findMany({ where: { OR: dayUseOr }, select: { id: true } })
        if (dayUses.length > 0) or.push({ dayUseId: { in: dayUses.map(d => d.id) } })
      }

      // 🏋️ إيصالات الـ PT المربوطة بالعضو (بالهاتف)
      if (resolvedPhone) {
        const pts = await prisma.pT.findMany({ where: { phone: resolvedPhone }, select: { ptNumber: true } })
        if (pts.length > 0) or.push({ ptNumber: { in: pts.map(p => p.ptNumber) } })
      }

      if (or.length === 0) return NextResponse.json([])
      const receipts = await prisma.receipt.findMany({
        where: { OR: or },
        orderBy: { receiptNumber: 'desc' }
      })
      return NextResponse.json(receipts)
    }
    if (ptNumber) {
      const receipts = await prisma.receipt.findMany({
        where: { ptNumber: parseInt(ptNumber) },
        orderBy: { receiptNumber: 'desc' }
      })
      return NextResponse.json(receipts)
    }
    if (dayUseId) {
      const receipts = await prisma.receipt.findMany({
        where: { dayUseId },
        orderBy: { receiptNumber: 'desc' }
      })
      return NextResponse.json(receipts)
    }

    // 🗓️ فلتر بالتاريخ — للتقفيل والعمولات: بدل تحميل كل الإيصالات وفلترتها عند الكلاينت
    if (startDateParam || endDateParam) {
      const createdAt: Record<string, Date> = {}
      if (startDateParam) createdAt.gte = new Date(startDateParam)
      if (endDateParam) {
        // تاريخ من غير وقت → لغاية آخر اليوم
        const endRaw = endDateParam.length === 10 ? `${endDateParam}T23:59:59.999` : endDateParam
        createdAt.lte = new Date(endRaw)
      }
      const receipts = await prisma.receipt.findMany({
        where: { createdAt },
        orderBy: { receiptNumber: 'desc' }
      })
      return NextResponse.json(receipts)
    }

    // 🚀 Paginated mode — لو الـ client بعت ?page=N، نرجّع صفحة واحدة بس
    //    + البحث والفلاتر بتتنفذ في SQL هنا بدل ما الصفحة تسحب كل الإيصالات وتفلتر محليًا
    const isPaginated = pageParam !== null
    if (isPaginated) {
      const page = Math.max(1, parseInt(pageParam || '1', 10) || 1)
      const pageSize = Math.min(1000, Math.max(1, parseInt(pageSizeParam || '300', 10) || 300))

      const search = (searchParams.get('search') || '').trim()
      const typesParam = searchParams.get('types') // قائمة مفصولة بفواصل (فلتر النوع)
      const payment = (searchParams.get('payment') || '').trim()

      const where: Record<string, unknown> = {}
      if (typesParam) {
        const types = typesParam.split(',').filter(Boolean)
        if (types.length > 0) where.type = { in: types }
      }
      // contains بدل التطابق التام — إيصالات الدفع المتعدد بتخزن طرق الدفع كسلسلة مركبة
      if (payment) where.paymentMethod = { contains: payment }
      if (search) {
        const or: Array<Record<string, unknown>> = [
          // بيغطي الاسم/التليفون/رقم العضوية/رقم الـ PT — كلهم جوه الـ JSON
          { itemDetails: { contains: search } },
          { staffName: { contains: search } },
        ]
        const asNumber = parseInt(search, 10)
        if (!isNaN(asNumber) && String(asNumber) === search) {
          or.push({ receiptNumber: asNumber })
        }
        where.OR = or
      }

      // أرقام كروت "النهاردة" بنفس فلاتر العرض (زي حسبة الصفحة القديمة بالظبط)
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const endOfToday = new Date(startOfToday)
      endOfToday.setDate(endOfToday.getDate() + 1)

      const [receipts, total, todayAgg] = await Promise.all([
        prisma.receipt.findMany({
          where,
          orderBy: { receiptNumber: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.receipt.count({ where }),
        prisma.receipt.aggregate({
          _sum: { amount: true },
          _count: true,
          where: { ...where, isCancelled: false, createdAt: { gte: startOfToday, lt: endOfToday } },
        }),
      ])
      const hasMore = page * pageSize < total
      return NextResponse.json({
        receipts,
        total,
        page,
        pageSize,
        hasMore,
        todayCount: todayAgg._count,
        todayRevenue: todayAgg._sum.amount ?? 0,
      })
    }

    // backward-compat: بدون pagination → array (للـ callers القديمة)
    const receipts = await prisma.receipt.findMany({
      orderBy: { receiptNumber: 'desc' },
      take: limit ? parseInt(limit) : undefined
    })

    return NextResponse.json(receipts)
  } catch (error: any) {
    console.error('Error fetching receipts:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية عرض الإيصالات' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل جلب الإيصالات' }, { status: 500 })
  }
}
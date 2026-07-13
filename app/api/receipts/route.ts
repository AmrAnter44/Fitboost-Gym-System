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
      // (الكلاينت بيعمل الفلترة الدقيقة النهائية — إحنا بنضيّق النطاق بدل تحميل كل الإيصالات)
      const or: Array<Record<string, unknown>> = []
      if (memberId) or.push({ memberId })
      if (memberNumber) {
        or.push({ itemDetails: { contains: `"memberNumber":"${memberNumber}"` } })
        or.push({ itemDetails: { contains: `"memberNumber":${memberNumber}` } })
        if (!memberId) {
          const memberRow = await prisma.member.findUnique({
            where: { memberNumber },
            select: { id: true }
          })
          if (memberRow) or.push({ memberId: memberRow.id })
        }
      }
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

    // 🚀 Paginated mode — لو الـ client بعت ?page=N، نرجّع dataset مقسّم
    // أول صفحة بتظهر فوراً في الـ UI، والباقي بيكمل في الـ background
    const isPaginated = pageParam !== null
    if (isPaginated) {
      const page = Math.max(1, parseInt(pageParam || '1', 10) || 1)
      const pageSize = Math.min(1000, Math.max(1, parseInt(pageSizeParam || '300', 10) || 300))
      const [receipts, total] = await Promise.all([
        prisma.receipt.findMany({
          orderBy: { receiptNumber: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.receipt.count()
      ])
      const hasMore = page * pageSize < total
      return NextResponse.json({ receipts, total, page, pageSize, hasMore })
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
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

//  تارجت المكالمات اليومي للسيلز + تقدّم كل موظف النهاردة
//  GET: السيلز يشوف تقدمه · الأدمن/الأونر يشوف تقدم كل الفريق
//  PUT: الأدمن/الأونر يعدّل التارجت
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const isAdmin = user.role === 'OWNER' || user.role === 'ADMIN'
    //  نقرأ isSales + staffId من الداتابيز (مش من الـ JWT) عشان ما يبقاش قديم بعد تغيير الإعداد
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { isSales: true, staffId: true },
    })
    const isSales = !!dbUser?.isSales
    const myStaffId = dbUser?.staffId ?? user.staffId ?? null

    //  الكارت ده للسيلز والأدمن بس
    if (!isSales && !isAdmin) {
      return NextResponse.json({ enabled: false })
    }

    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
    const endOfToday = new Date(startOfToday); endOfToday.setDate(endOfToday.getDate() + 1)

    //  التارجت من إعدادات النظام
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 'singleton' },
      select: { salesDailyCallTarget: true } as any,
    }) as any
    const target = Number(settings?.salesDailyCallTarget) || 0

    //  عدد المكالمات الفعلية لكل موظف النهاردة — المتواصَلة بس (contacted=true)
    //  عشان صفوف الإسناد الأولية (غير المتواصَلة) ما تتحسبش كمكالمة
    const grouped = await prisma.followUp.groupBy({
      by: ['assignedTo'],
      where: { createdAt: { gte: startOfToday, lt: endOfToday }, contacted: true },
      _count: { _all: true },
    })
    const countByStaff = new Map<string, number>()
    for (const g of grouped) {
      if (g.assignedTo) countByStaff.set(g.assignedTo, g._count._all)
    }

    //  تقدّم الموظف الحالي
    const myCallsToday = myStaffId ? (countByStaff.get(myStaffId) || 0) : 0

    //  للأدمن: تقسيمة كل موظفي السيلز
    let perRep: Array<{ staffId: string; name: string; calls: number }> = []
    if (isAdmin) {
      const salesUsers = await prisma.user.findMany({
        where: { isSales: true, staffId: { not: null } },
        select: { staffId: true, name: true },
      })
      perRep = salesUsers
        .filter(u => u.staffId)
        .map(u => ({ staffId: u.staffId as string, name: u.name, calls: countByStaff.get(u.staffId as string) || 0 }))
        .sort((a, b) => b.calls - a.calls)
    }

    return NextResponse.json({
      enabled: true,
      target,
      myCallsToday,
      isAdmin,
      isSales,
      perRep,
    })
  } catch (error) {
    console.error('Error loading sales-calls target:', error)
    return NextResponse.json({ error: 'فشل تحميل تارجت المكالمات' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'مسموح للأدمن بس' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const target = Math.max(0, Math.round(Number(body.target) || 0))

    await prisma.systemSettings.upsert({
      where: { id: 'singleton' },
      update: { salesDailyCallTarget: target } as any,
      create: { id: 'singleton', salesDailyCallTarget: target } as any,
    })

    return NextResponse.json({ success: true, target })
  } catch (error) {
    console.error('Error updating sales-calls target:', error)
    return NextResponse.json({ error: 'فشل حفظ التارجت' }, { status: 500 })
  }
}

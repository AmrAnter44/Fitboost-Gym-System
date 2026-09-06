import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

//  ريمايندرز السيلز — بترجّع أعداد:
//   - followUpsToday: متابعات محتاجة تواصل النهاردة (متأخرة + النهاردة، مش متواصل)
//   - expiringToday:  أعضاء اشتراكهم بيخلص النهاردة
//   - expiringTomorrow: أعضاء اشتراكهم هيخلص بكره
//   - expired: أعضاء اشتراكهم خلص (آخر 7 أيام) محتاجين متابعة تجديد

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)

    const startOfTomorrow = new Date(startOfToday)
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)
    const endOfTomorrow = new Date(endOfToday)
    endOfTomorrow.setDate(endOfTomorrow.getDate() + 1)

    //  بنستثني المجمّدين والمحظورين (اشتراكهم موقوف/ملغي).
    //  الاشتراكات عامة (كل الجيم) — أي سيلز يقدر يكلّم أي عضو للتجديد؛ الضغط بيوديه لصفحة الأعضاء مفلترة.
    const memberBase = { isFrozen: false, isBanned: false }

    //  📞 متابعات النهاردة للمستخدم الحالي — بنطابق صفحة المتابعات بالظبط:
    //  نستثني الليدز اللي اتحوّلوا لأعضاء نشطين، أو المشتركين/المرفوضين/المحذوفين (الصفحة بتخفيهم).
    const computeFollowUpsToday = async (): Promise<number> => {
      if (!user.staffId) return 0
      const [fus, activeMembers] = await Promise.all([
        prisma.followUp.findMany({
          where: { assignedTo: user.staffId, contacted: false, nextFollowUpDate: { lte: endOfToday } },
          select: { visitor: { select: { phone: true, status: true, isDeleted: true } } },
        }),
        prisma.member.findMany({ where: { isActive: true }, select: { phone: true } }),
      ])
      const norm = (p?: string | null) => (p || '').replace(/\D/g, '')
      const memberPhones = new Set(activeMembers.map(m => norm(m.phone)))
      return fus.filter(f => {
        const v = f.visitor
        if (!v || v.isDeleted) return false
        if (v.status === 'subscribed' || v.status === 'rejected') return false
        if (memberPhones.has(norm(v.phone))) return false  //  اتحوّل لعضو نشط
        return true
      }).length
    }

    const [followUpsToday, expiringToday, expiringTomorrow, expired] = await Promise.all([
      computeFollowUpsToday(),
      prisma.member.count({
        where: { ...memberBase, expiryDate: { gte: startOfToday, lte: endOfToday } },
      }),
      prisma.member.count({
        where: { ...memberBase, expiryDate: { gte: startOfTomorrow, lte: endOfTomorrow } },
      }),
      //  المنتهيين كلهم (expiryDate قبل النهاردة) — يطابق فلتر «منتهي» في صفحة الأعضاء
      prisma.member.count({
        where: { ...memberBase, expiryDate: { lt: startOfToday } },
      }),
    ])

    return NextResponse.json({ followUpsToday, expiringToday, expiringTomorrow, expired })
  } catch (error) {
    console.error('sales reminders error:', error)
    return NextResponse.json({ followUpsToday: 0, expiringToday: 0, expiringTomorrow: 0, expired: 0 })
  }
}

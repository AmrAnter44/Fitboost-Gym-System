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

    const [followUpsToday, expiringToday, expiringTomorrow, expired] = await Promise.all([
      //  المتابعات: بتاعة السيلز الحالي بس (assignedTo = staffId) عشان تطابق صفحة المتابعات
      prisma.followUp.count({
        where: {
          contacted: false,
          nextFollowUpDate: { lte: endOfToday },
          ...(user.staffId ? { assignedTo: user.staffId } : {}),
        },
      }),
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

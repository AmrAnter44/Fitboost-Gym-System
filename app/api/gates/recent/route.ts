// 🚪 الأحداث الجديدة — بيغذّي البوب-أب في صفحة التشيك
//
//  استطلاع مش SSE: الحدث بيوصل على ريكوست منفصل، فالـ SSE كان هيحتاج ناقل
//  أحداث في الذاكرة بيتكسر لو اتشغّل أكتر من worker. الريسبشن واقف قدام
//  الباب فتأخير تلات ثواني مالوش أثر عملي.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { denyReasonText, type DenyReason } from '@/lib/gates/eligibility'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ success: false, events: [] }, { status: 401 })

    const url = new URL(request.url)
    const sinceRaw = url.searchParams.get('since')
    const deniedOnly = url.searchParams.get('deniedOnly') !== '0'

    //  أول نداء من غير since: مانرجّعش تاريخ قديم يطلّع بوب-أب لأحداث
    //  من امبارح. بنرجّع آخر دقيقتين بس.
    const since = sinceRaw ? new Date(Number(sinceRaw)) : new Date(Date.now() - 120_000)

    const events = await prisma.gateEvent.findMany({
      where: {
        createdAt: { gt: isNaN(since.getTime()) ? new Date(Date.now() - 120_000) : since },
        ...(deniedOnly ? { allowed: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, memberId: true, employeeNo: true, eventTime: true,
        allowed: true, reason: true, createdAt: true,
      },
    })

    //  أسماء الأعضاء في استعلام واحد بدل N+1
    const ids = [...new Set(events.map(e => e.memberId).filter(Boolean))] as string[]
    const members = ids.length
      ? await prisma.member.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, memberNumber: true, phone: true, expiryDate: true, profileImage: true },
        })
      : []
    const byId = new Map(members.map(m => [m.id, m]))

    return NextResponse.json({
      success: true,
      //  الساعة دي هي اللي الواجهة هتبعتها كـ since في النداء الجاي —
      //  بنستخدم ساعة السيرفر عشان فرق ساعة الجهاز مايضيّعش أحداث
      now: Date.now(),
      events: events.map(e => {
        const m = e.memberId ? byId.get(e.memberId) : undefined
        return {
          id: e.id,
          at: e.eventTime,
          allowed: e.allowed,
          reason: e.reason,
          reasonText: e.reason && e.reason !== 'ok'
            ? (denyReasonText(e.reason as DenyReason) ?? e.reason)
            : null,
          employeeNo: e.employeeNo,
          member: m
            ? { id: m.id, name: m.name, memberNumber: m.memberNumber, phone: m.phone,
                expiryDate: m.expiryDate, profileImage: m.profileImage }
            : null,
        }
      }),
    })
  } catch (e) {
    console.error('[gates/recent]', e)
    return NextResponse.json({ success: false, events: [] }, { status: 500 })
  }
}

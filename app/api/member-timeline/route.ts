// app/api/member-timeline/route.ts
// 📜 سجل رحلة الشخص (Timeline) — بيجمّع الأحداث بالتليفون من الجداول الموجودة
// read-only, on-demand — مفيش تخزين إضافي ولا كتابة
import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requireAnyPermission } from '../../../lib/auth'

export const dynamic = 'force-dynamic'

// آخر 9 أرقام معنوية للتليفون — عشان نطابق رغم اختلاف الصيغة (كود دولة / صفر بادئ)
function phoneSig(phone: string | null | undefined): string {
  if (!phone) return ''
  return phone.replace(/\D/g, '').slice(-9)
}

interface TimelineEvent {
  type: string
  date: string          // ISO
  title: string
  detail?: string
  icon: string
  memberId?: string     // للربط لبروفايل تاني (نقل العضوية)
}

export async function GET(request: Request) {
  try {
    await requireAnyPermission(request, ['canViewMembers', 'canViewFollowUps', 'canViewVisitors'])

    const { searchParams } = new URL(request.url)
    let phone = searchParams.get('phone') || ''
    const memberId = searchParams.get('memberId') || ''

    // لو جالنا memberId، نجيب التليفون منه
    let anchorMember: { id: string; name: string; phone: string } | null = null
    if (memberId) {
      anchorMember = await prisma.member.findUnique({
        where: { id: memberId },
        select: { id: true, name: true, phone: true },
      })
      if (anchorMember && !phone) phone = anchorMember.phone
    }

    const sig = phoneSig(phone)
    if (sig.length < 6) {
      return NextResponse.json({ events: [], phone })
    }

    // نطابق بآخر الأرقام المعنوية (contains) — مقبول لأنه on-demand
    const phoneWhere = { phone: { contains: sig } }

    // نجيب كل الجداول بالتوازي — كلها قراءة خفيفة على أعمدة متـ index
    const [visitors, members, dayUses, freezes, transferredOut] = await Promise.all([
      prisma.visitor.findMany({
        where: phoneWhere,
        select: {
          id: true, createdAt: true, source: true, status: true,
          // 🧑‍💼 السيلز اللي تابع الزائر — من المتابعات بتاعته
          followUps: {
            select: { salesName: true, assignedStaff: { select: { name: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      prisma.member.findMany({
        where: phoneWhere,
        select: {
          id: true, name: true, phone: true, createdAt: true, startDate: true, expiryDate: true,
          isActive: true, isFrozen: true,
          transferredFromMemberId: true, transferredFromAt: true, transferredFromPhone: true,
        },
      }),
      prisma.dayUseInBody.findMany({
        where: phoneWhere,
        select: { id: true, createdAt: true, serviceType: true, price: true, salesStaffId: true },
      }),
      // التجميدات لكل الأعضاء اللي بنفس التليفون
      prisma.freezeRequest.findMany({
        where: { member: phoneWhere, status: 'approved' },
        select: { id: true, startDate: true, days: true, isBack: true, createdAt: true },
      }),
      // لو حد اتنقلت منه العضوية للعضو ده (الطرف اللي نقل)
      memberId
        ? prisma.member.findMany({
            where: { transferredFromMemberId: memberId },
            select: { id: true, name: true, transferredFromAt: true },
          })
        : Promise.resolve([] as { id: string; name: string; transferredFromAt: Date | null }[]),
    ])

    const memberIds = members.map(m => m.id)

    // 🧑‍💼 نجيب أسماء موظفي السيلز لسجلات يوم الاستخدام (batch واحدة)
    const salesIds = Array.from(new Set(dayUses.map(d => d.salesStaffId).filter(Boolean))) as string[]
    const salesStaff = salesIds.length
      ? await prisma.staff.findMany({ where: { id: { in: salesIds } }, select: { id: true, name: true } })
      : []
    const salesNameById = new Map(salesStaff.map(s => [s.id, s.name]))

    // الإيصالات (تجديدات/مدفوعات) للأعضاء دول
    const receipts = memberIds.length
      ? await prisma.receipt.findMany({
          where: { memberId: { in: memberIds }, isCancelled: false },
          select: { id: true, type: true, amount: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
      : []

    const events: TimelineEvent[] = []
    const now = new Date()

    // 🟣 اتضاف كزائر
    for (const v of visitors) {
      const statusAr: Record<string, string> = {
        subscribed: 'اشترك', converted: 'تم تحويله', pending: 'لسه',
        contacted: 'تم التواصل', rejected: 'مرفوض',
      }
      // أول سيلز اتسجّل في متابعات الزائر (اسم مباشر أو الموظف المسند)
      const visitorSales = v.followUps
        .map(f => f.salesName || f.assignedStaff?.name)
        .find(Boolean)
      events.push({
        type: 'visitor', date: v.createdAt.toISOString(), icon: '👋',
        title: 'اتضاف كزائر',
        detail: [
          v.source,
          statusAr[v.status] || v.status,
          visitorSales ? `سيلز: ${visitorSales}` : null,
        ].filter(Boolean).join(' • '),
      })
    }

    // 🟢 اتحوّل لعضو + بداية/نهاية الاشتراك
    for (const m of members) {
      events.push({
        type: 'member', date: m.createdAt.toISOString(), icon: '🟢',
        title: 'اتحوّل لعضو / اشترك', memberId: m.id,
      })
      if (m.startDate) {
        events.push({
          type: 'start', date: new Date(m.startDate).toISOString(), icon: '▶️',
          title: 'بداية الاشتراك', memberId: m.id,
        })
      }
      if (m.expiryDate) {
        const exp = new Date(m.expiryDate)
        const passed = exp < now
        events.push({
          type: 'expiry', date: exp.toISOString(), icon: passed ? '🔴' : '⏳',
          title: passed ? 'انتهى الاشتراك' : 'ينتهي الاشتراك',
          memberId: m.id,
        })
      }
      // 📥 استلم عضوية منقولة من عضو آخر (نقل لعضو موجود)
      if (m.transferredFromMemberId && m.transferredFromAt) {
        events.push({
          type: 'transfer_in', date: new Date(m.transferredFromAt).toISOString(), icon: '📥',
          title: 'استلم عضوية منقولة', memberId: m.transferredFromMemberId,
          detail: m.transferredFromPhone ? `الرقم اتحوّل من ${m.transferredFromPhone} → ${m.phone}` : 'من عضو آخر',
        })
      } else if (m.transferredFromPhone && m.transferredFromAt) {
        // 🔄 تغيّرت ملكية العضوية على نفس السجل (نقل لشخص جديد) — الرقم اتغيّر
        events.push({
          type: 'transfer_identity', date: new Date(m.transferredFromAt).toISOString(), icon: '🔄',
          title: 'تغيّرت ملكية العضوية',
          detail: `الرقم اتحوّل من ${m.transferredFromPhone} → ${m.phone}`,
        })
      }
    }

    // 📤 نقل عضويته لعضو تاني
    for (const t of transferredOut) {
      if (t.transferredFromAt) {
        events.push({
          type: 'transfer_out', date: new Date(t.transferredFromAt).toISOString(), icon: '📤',
          title: 'نقل عضويته', memberId: t.id, detail: t.name,
        })
      }
    }

    // 🎫 يوم استخدام (جست)
    for (const d of dayUses) {
      const dSales = d.salesStaffId ? salesNameById.get(d.salesStaffId) : null
      events.push({
        type: 'dayuse', date: d.createdAt.toISOString(), icon: '🎫',
        title: 'يوم استخدام',
        detail: [`${d.serviceType} • ${d.price} ج`, dSales ? `سيلز: ${dSales}` : null].filter(Boolean).join(' • '),
      })
    }

    // ❄️ تجميد
    for (const f of freezes) {
      events.push({
        type: 'freeze', date: new Date(f.startDate).toISOString(), icon: '❄️',
        title: f.isBack ? 'تجميد بأثر رجعي' : 'تجميد', detail: `${f.days} يوم`,
      })
    }

    // 💵 إيصالات (تجديد/دفع)
    const typeAr: Record<string, string> = {
      subscription: 'اشتراك', renewal: 'تجديد', pt: 'PT', dayuse: 'يوم استخدام',
      nutrition: 'تغذية', physiotherapy: 'علاج طبيعي', groupclass: 'حصة جماعية', more: 'مزيد',
    }
    for (const r of receipts) {
      events.push({
        type: 'receipt', date: r.createdAt.toISOString(), icon: '💵',
        title: `إيصال ${typeAr[r.type?.toLowerCase()] || r.type || ''}`.trim(),
        detail: `${r.amount} ج`,
      })
    }

    // ترتيب تنازلي بالتاريخ (الأحدث فوق)
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json({
      phone,
      anchor: anchorMember,
      count: events.length,
      events,
    })
  } catch (error: any) {
    console.error('Error building member timeline:', error)
    if (error.message === 'Unauthorized' || error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    }
    return NextResponse.json({ error: 'فشل تحميل سجل الرحلة' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

/**
 * يولّد كل الصيغ المحتملة لرقم الموبايل عشان نلاقي الـ visitor بأي صيغة اتسجّل بيها.
 *  - 01xxxxxxxxx       (المصري المعتاد)
 *  - 201xxxxxxxxx      (دولي بدون +)
 *  - +201xxxxxxxxx     (دولي مع +)
 *  - أي رقم بمسافات أو شرطات
 */
function phoneVariants(input: string): string[] {
  const trimmed = input.trim()
  // نشيل كل شيء غير الأرقام
  const digits = trimmed.replace(/\D/g, '')

  const variants = new Set<string>([trimmed, digits])

  if (digits.startsWith('20') && digits.length >= 12) {
    // 201xxxxxxxxx → 01xxxxxxxxx
    const local = '0' + digits.slice(2)
    variants.add(local)
    variants.add('+' + digits)
  } else if (digits.startsWith('0') && digits.length === 11) {
    // 01xxxxxxxxx → 201xxxxxxxxx + +201xxxxxxxxx
    const intl = '20' + digits.slice(1)
    variants.add(intl)
    variants.add('+' + intl)
  } else if (digits.length === 10 && (digits.startsWith('10') || digits.startsWith('11') || digits.startsWith('12') || digits.startsWith('15'))) {
    // 1xxxxxxxxx → 01xxxxxxxxx + 201xxxxxxxxx
    variants.add('0' + digits)
    variants.add('20' + digits)
    variants.add('+20' + digits)
  }

  return Array.from(variants).filter(v => v.length >= 6)
}

//  👤 لو الرقم ده بتاع عضو مشترك بالفعل — المطابقة بآخر 10 أرقام (الأساسي أو الاحتياطي)
async function findMemberByPhone(rawPhone: string) {
  const tail = rawPhone.replace(/\D/g, '').slice(-10)
  if (tail.length !== 10) return null
  const candidates = await prisma.member.findMany({
    where: { OR: [{ phone: { endsWith: tail.slice(-4) } }, { backupPhone: { endsWith: tail.slice(-4) } }] },
    select: { id: true, memberNumber: true, name: true, phone: true, backupPhone: true, isActive: true, expiryDate: true, createdAt: true },
  })
  const same = (p: string | null) => !!p && p.replace(/\D/g, '').slice(-10) === tail
  const matches = candidates.filter(m => same(m.phone) || same(m.backupPhone))
  if (matches.length === 0) return null
  //  الأفضلية: نفس التليفون الأساسي ← النشط ← الأحدث
  matches.sort((a, b) =>
    Number(same(b.phone)) - Number(same(a.phone)) ||
    Number(b.isActive) - Number(a.isActive) ||
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const m = matches[0]
  return { id: m.id, memberNumber: m.memberNumber, name: m.name, isActive: m.isActive, expiryDate: m.expiryDate }
}

// Resolve a phone number to its most recent follow-up so the member-creation form
// can surface the assigned sales staff. Used by reception when typing a phone
// in MemberForm.
export async function GET(request: Request) {
  try {
    await requirePermission(request, 'canCreateMembers')

    const { searchParams } = new URL(request.url)
    const rawPhone = searchParams.get('phone')?.trim() || ''

    if (rawPhone.length < 6) {
      return NextResponse.json({ found: false }, { status: 200 })
    }

    const member = await findMemberByPhone(rawPhone).catch(() => null)
    const phones = phoneVariants(rawPhone)

    // ابحث عن أي متابعة (archived أو غير archived) للزائر بأي صيغة من صيغ الموبايل
    // مع تفضيل المتابعة اللي ليها assignedTo، وإلا اللي ليها salesName
    const followUps = await prisma.followUp.findMany({
      where: {
        visitor: { phone: { in: phones } }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        assignedStaff: { select: { id: true, name: true } },
        visitor: { select: { name: true, phone: true } }
      },
      take: 20  // 20 آخر متابعات للرقم ده
    })

    if (followUps.length === 0) {
      return NextResponse.json({ found: false, member }, { status: 200 })
    }

    // الأولوية ١: أحدث متابعة عندها assignedStaff (FK محفوظ)
    const withAssigned = followUps.find(f => f.assignedStaff)
    if (withAssigned && withAssigned.assignedStaff) {
      return NextResponse.json({
        found: true,
        member,
        salesStaffId: withAssigned.assignedStaff.id,
        salesStaffName: withAssigned.assignedStaff.name,
        visitorName: withAssigned.visitor?.name || null,
        followUpId: withAssigned.id,
        source: 'assignedStaff'
      })
    }

    // الأولوية ٢: أحدث متابعة عندها salesName (legacy) — نحاول نربطه بـ Staff record
    const withSalesName = followUps.find(f => f.salesName && f.salesName.trim().length > 0)
    if (withSalesName && withSalesName.salesName) {
      const staff = await prisma.staff.findFirst({
        where: {
          name: { contains: withSalesName.salesName.trim() },
          isActive: true,
          position: { contains: 'sales' }
        },
        select: { id: true, name: true }
      })

      if (staff) {
        return NextResponse.json({
          found: true,
          member,
          salesStaffId: staff.id,
          salesStaffName: staff.name,
          visitorName: withSalesName.visitor?.name || null,
          followUpId: withSalesName.id,
          source: 'salesName-matched'
        })
      }

      // لقينا salesName بس مش لاقيين Staff بنفس الاسم — نرجّع الاسم كنص فقط
      // عشان الـ UI يقدر يعرض رسالة "كان مع: <name>" بدون auto-assign
      return NextResponse.json({
        found: true,
        member,
        salesStaffId: null,
        salesStaffName: withSalesName.salesName.trim(),
        visitorName: withSalesName.visitor?.name || null,
        followUpId: withSalesName.id,
        source: 'salesName-unmatched'
      })
    }

    // الأولوية ٣: في متابعات بس مفيش سيلز محدد — نرجّع اسم الزائر فقط
    const anyFollowUp = followUps[0]
    return NextResponse.json({
      found: true,
      member,
      salesStaffId: null,
      salesStaffName: null,
      visitorName: anyFollowUp.visitor?.name || null,
      followUpId: anyFollowUp.id,
      source: 'no-sales-assigned'
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    }
    if (error?.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'صلاحية غير كافية' }, { status: 403 })
    }
    console.error('followups/by-phone error:', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}

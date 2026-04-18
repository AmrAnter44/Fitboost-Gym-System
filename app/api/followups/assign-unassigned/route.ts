import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/followups/assign-unassigned
 * توزيع الأعضاء والمتابعات الغير مُسنَّدين على موظفي السيلز
 *
 * body:
 *   { mode: 'single', staffId: string, types: ('members'|'followups')[] }
 *   أو
 *   { mode: 'distribute', types: ('members'|'followups')[] }  ← توزيع تلقائي round-robin
 */
export async function POST(request: Request) {
  try {
    await requirePermission(request, 'canEditMembers')

    const { mode, staffId, types } = await request.json()

    if (!mode || !types || types.length === 0) {
      return NextResponse.json({ error: 'mode و types مطلوبين' }, { status: 400 })
    }

    if (mode === 'single' && !staffId) {
      return NextResponse.json({ error: 'staffId مطلوب في الـ single mode' }, { status: 400 })
    }

    // جلب موظفي السيلز النشطين (للتوزيع التلقائي)
    const salesStaff = mode === 'distribute'
      ? await prisma.staff.findMany({
          where: { isActive: true, position: { contains: 'sales' } },
          select: { id: true },
          orderBy: { name: 'asc' }
        })
      : []

    if (mode === 'distribute' && salesStaff.length === 0) {
      return NextResponse.json({ error: 'لا يوجد موظفو سيلز نشطين' }, { status: 400 })
    }

    let assignedMembers = 0
    let assignedFollowUps = 0
    let assignedDayUse = 0
    let assignedInvitations = 0

    // ── توزيع الأعضاء ──
    if (types.includes('members')) {
      const unassigned = await prisma.member.findMany({
        where: { salesStaffId: null },
        select: { id: true },
        orderBy: { createdAt: 'asc' }
      })

      if (mode === 'single') {
        const result = await prisma.member.updateMany({
          where: { salesStaffId: null },
          data: { salesStaffId: staffId }
        })
        assignedMembers = result.count
      } else {
        // round-robin — group by staff then updateMany per group
        const groups = new Map<string, string[]>()
        unassigned.forEach((m, i) => {
          const sid = salesStaff[i % salesStaff.length].id
          if (!groups.has(sid)) groups.set(sid, [])
          groups.get(sid)!.push(m.id)
        })
        await prisma.$transaction(
          Array.from(groups.entries()).map(([sid, ids]) =>
            prisma.member.updateMany({ where: { id: { in: ids } }, data: { salesStaffId: sid } })
          )
        )
        assignedMembers = unassigned.length
      }
    }

    // ── توزيع المتابعات (كل المصادر) ──
    if (types.includes('followups')) {
      // 1. توزيع FollowUps غير المُسنَّدة الموجودة
      const unassigned = await prisma.followUp.findMany({
        where: { assignedTo: null, archived: false },
        select: { id: true },
        orderBy: { createdAt: 'asc' }
      })

      let rrIndex = 0
      if (mode === 'single') {
        const result = await prisma.followUp.updateMany({
          where: { assignedTo: null, archived: false },
          data: { assignedTo: staffId }
        })
        assignedFollowUps += result.count
      } else {
        // group by staff then updateMany per group
        const groups = new Map<string, string[]>()
        unassigned.forEach((f, i) => {
          const sid = salesStaff[i % salesStaff.length].id
          if (!groups.has(sid)) groups.set(sid, [])
          groups.get(sid)!.push(f.id)
        })
        await prisma.$transaction(
          Array.from(groups.entries()).map(([sid, ids]) =>
            prisma.followUp.updateMany({ where: { id: { in: ids } }, data: { assignedTo: sid } })
          )
        )
        assignedFollowUps += unassigned.length
        rrIndex = unassigned.length
      }

      // 2. إنشاء FollowUps للـ Visitor records بدون أي FollowUp نشط
      const visitorsWithoutFollowUp = await prisma.visitor.findMany({
        where: { followUps: { none: {} } },
        select: { id: true },
        orderBy: { createdAt: 'asc' }
      })

      for (let i = 0; i < visitorsWithoutFollowUp.length; i++) {
        const assignToId = mode === 'single' ? staffId : salesStaff[(rrIndex + i) % salesStaff.length].id
        await prisma.followUp.create({
          data: {
            visitorId: visitorsWithoutFollowUp[i].id,
            notes: 'زائر بدون متابعة - تم توزيعه تلقائياً',
            assignedTo: assignToId
          }
        })
        assignedFollowUps++
      }
    }

    // ── توزيع الزوار/داي يوز ──
    if (types.includes('dayuse')) {
      let rrIndex = 0

      // 1. توزيع FollowUps غير المُسنَّدة لزوار source='invitation'
      const unassignedFollowUps = await prisma.followUp.findMany({
        where: { assignedTo: null, archived: false, visitor: { source: 'invitation' } },
        select: { id: true },
        orderBy: { createdAt: 'asc' }
      })
      if (unassignedFollowUps.length > 0) {
        if (mode === 'single') {
          await prisma.followUp.updateMany({
            where: { id: { in: unassignedFollowUps.map(f => f.id) } },
            data: { assignedTo: staffId }
          })
        } else {
          const groups = new Map<string, string[]>()
          unassignedFollowUps.forEach((f, i) => {
            const sid = salesStaff[i % salesStaff.length].id
            if (!groups.has(sid)) groups.set(sid, [])
            groups.get(sid)!.push(f.id)
          })
          await prisma.$transaction(
            Array.from(groups.entries()).map(([sid, ids]) =>
              prisma.followUp.updateMany({ where: { id: { in: ids } }, data: { assignedTo: sid } })
            )
          )
        }
        assignedDayUse += unassignedFollowUps.length
        rrIndex = unassignedFollowUps.length
      }

      // 2. إنشاء FollowUps لـ DayUseInBody records بدون FollowUp نشط
      const allDayUsePhones = (await prisma.dayUseInBody.findMany({
        select: { phone: true, name: true },
        orderBy: { createdAt: 'asc' }
      }))
      const uniquePhoneMap = new Map<string, string>() // phone → name (first seen)
      for (const d of allDayUsePhones) {
        if (!uniquePhoneMap.has(d.phone)) uniquePhoneMap.set(d.phone, d.name)
      }

      // الأرقام التي لديها Visitor + FollowUp نشط بالفعل
      const phonesWithFollowUp = new Set(
        (await prisma.visitor.findMany({
          where: {
            phone: { in: [...uniquePhoneMap.keys()] },
            followUps: { some: { archived: false } }
          },
          select: { phone: true }
        })).map(v => v.phone)
      )

      let localIdx = 0
      for (const [phone, name] of uniquePhoneMap) {
        if (phonesWithFollowUp.has(phone)) continue // عنده FollowUp بالفعل

        // إيجاد أو إنشاء Visitor
        let visitor = await prisma.visitor.findUnique({ where: { phone } })
        if (!visitor) {
          visitor = await prisma.visitor.create({
            data: { name, phone, source: 'invitation', status: 'pending',
                    notes: 'داي يوز - تم إنشاؤه تلقائياً من التوزيع' }
          })
        }

        // إنشاء FollowUp وتعيينه
        const assignToId = mode === 'single' ? staffId : salesStaff[(rrIndex + localIdx) % salesStaff.length].id
        await prisma.followUp.create({
          data: {
            visitorId: visitor.id,
            notes: 'داي يوز - في انتظار المتابعة من فريق المبيعات',
            assignedTo: assignToId
          }
        })
        assignedDayUse++
        localIdx++
      }
    }

    // ── توزيع الانفيتيشن (source = 'member-invitation') ──
    if (types.includes('invitations')) {
      let rrIndex = 0

      // 1. توزيع FollowUps غير المُسنَّدة لزوار source='member-invitation'
      const unassignedFollowUpsInv = await prisma.followUp.findMany({
        where: { assignedTo: null, archived: false, visitor: { source: 'member-invitation' } },
        select: { id: true },
        orderBy: { createdAt: 'asc' }
      })
      if (unassignedFollowUpsInv.length > 0) {
        if (mode === 'single') {
          await prisma.followUp.updateMany({
            where: { id: { in: unassignedFollowUpsInv.map(f => f.id) } },
            data: { assignedTo: staffId }
          })
        } else {
          const groups = new Map<string, string[]>()
          unassignedFollowUpsInv.forEach((f, i) => {
            const sid = salesStaff[i % salesStaff.length].id
            if (!groups.has(sid)) groups.set(sid, [])
            groups.get(sid)!.push(f.id)
          })
          await prisma.$transaction(
            Array.from(groups.entries()).map(([sid, ids]) =>
              prisma.followUp.updateMany({ where: { id: { in: ids } }, data: { assignedTo: sid } })
            )
          )
        }
        assignedInvitations += unassignedFollowUpsInv.length
        rrIndex = unassignedFollowUpsInv.length
      }

      // 2. إنشاء FollowUps لـ Invitation records بدون FollowUp نشط
      const allInvitations = await prisma.invitation.findMany({
        select: { guestPhone: true, guestName: true },
        orderBy: { createdAt: 'asc' }
      })
      const uniqueInvPhoneMap = new Map<string, string>()
      for (const inv of allInvitations) {
        if (!uniqueInvPhoneMap.has(inv.guestPhone)) uniqueInvPhoneMap.set(inv.guestPhone, inv.guestName)
      }

      // الأرقام التي لديها Visitor + FollowUp نشط
      const invPhonesWithFollowUp = new Set(
        (await prisma.visitor.findMany({
          where: {
            phone: { in: [...uniqueInvPhoneMap.keys()] },
            followUps: { some: { archived: false } }
          },
          select: { phone: true }
        })).map(v => v.phone)
      )

      let localIdx = 0
      for (const [phone, name] of uniqueInvPhoneMap) {
        if (invPhonesWithFollowUp.has(phone)) continue

        let visitor = await prisma.visitor.findUnique({ where: { phone } })
        if (!visitor) {
          visitor = await prisma.visitor.create({
            data: { name, phone, source: 'member-invitation', status: 'pending',
                    notes: 'دعوة من عضو - تم إنشاؤه تلقائياً من التوزيع' }
          })
        }

        const assignToId = mode === 'single' ? staffId : salesStaff[(rrIndex + localIdx) % salesStaff.length].id
        await prisma.followUp.create({
          data: {
            visitorId: visitor.id,
            notes: 'دعوة من عضو - في انتظار المتابعة من فريق المبيعات',
            assignedTo: assignToId
          }
        })
        assignedInvitations++
        localIdx++
      }
    }

    return NextResponse.json({ assignedMembers, assignedFollowUps, assignedDayUse, assignedInvitations })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    }
    console.error('assign-unassigned error:', error)
    return NextResponse.json({ error: 'فشل التوزيع' }, { status: 500 })
  }
}

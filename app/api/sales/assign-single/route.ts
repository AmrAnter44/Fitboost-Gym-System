import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requireAdmin } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/sales/assign-single
 * Admin-only — assign/transfer a single entity (member/visitor/dayuse/invitation) to a sales staff.
 *
 * body:
 *   {
 *     entityType: 'member' | 'visitor' | 'dayuse' | 'invitation',
 *     entityId: string,            // member.id | visitor.id | dayUseInBody.id | invitation.id
 *     salesStaffId: string | null  // null = unassign
 *   }
 */
export async function POST(request: Request) {
  try {
    await requireAdmin(request)

    const { entityType, entityId, salesStaffId } = await request.json()

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entityType و entityId مطلوبين' }, { status: 400 })
    }

    const newOwner: string | null = salesStaffId || null

    if (newOwner) {
      const staff = await prisma.staff.findUnique({
        where: { id: newOwner },
        select: { id: true, isActive: true, position: true }
      })
      if (!staff || !staff.isActive) {
        return NextResponse.json({ error: 'موظف السيلز غير موجود أو غير نشط' }, { status: 400 })
      }
    }

    if (entityType === 'member') {
      const member = await prisma.member.findUnique({ where: { id: entityId }, select: { id: true } })
      if (!member) return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })

      await prisma.member.update({
        where: { id: entityId },
        data: { salesStaffId: newOwner }
      })

      return NextResponse.json({ success: true, entityType, entityId, salesStaffId: newOwner })
    }

    if (entityType === 'dayuse') {
      const entry = await prisma.dayUseInBody.findUnique({ where: { id: entityId }, select: { id: true, phone: true } })
      if (!entry) return NextResponse.json({ error: 'سجل الداي يوز غير موجود' }, { status: 404 })

      await prisma.dayUseInBody.update({
        where: { id: entityId },
        data: { salesStaffId: newOwner }
      })

      // نحدّث متابعات الـ Visitor المرتبط بنفس الرقم لو فيه
      if (entry.phone) {
        const visitor = await prisma.visitor.findUnique({ where: { phone: entry.phone }, select: { id: true } })
        if (visitor) {
          await prisma.followUp.updateMany({
            where: { visitorId: visitor.id, archived: false },
            data: { assignedTo: newOwner }
          })
        }
      }

      return NextResponse.json({ success: true, entityType, entityId, salesStaffId: newOwner })
    }

    if (entityType === 'visitor') {
      const visitor = await prisma.visitor.findUnique({ where: { id: entityId }, select: { id: true } })
      if (!visitor) return NextResponse.json({ error: 'الزائر غير موجود' }, { status: 404 })

      const activeFollowUps = await prisma.followUp.findMany({
        where: { visitorId: entityId, archived: false },
        select: { id: true }
      })

      if (activeFollowUps.length > 0) {
        await prisma.followUp.updateMany({
          where: { id: { in: activeFollowUps.map(f => f.id) } },
          data: { assignedTo: newOwner }
        })
      } else {
        // مفيش متابعة نشطة — ننشئ واحدة جديدة عشان التعيين يبان
        await prisma.followUp.create({
          data: {
            visitorId: entityId,
            notes: 'تعيين سيلز يدوي من الأدمن',
            assignedTo: newOwner
          }
        })
      }

      return NextResponse.json({ success: true, entityType, entityId, salesStaffId: newOwner })
    }

    if (entityType === 'invitation') {
      const invitation = await prisma.invitation.findUnique({
        where: { id: entityId },
        select: { id: true, guestName: true, guestPhone: true }
      })
      if (!invitation) return NextResponse.json({ error: 'الدعوة غير موجودة' }, { status: 404 })

      // نلاقي أو ننشئ Visitor للرقم ده بـ source = 'member-invitation'
      let visitor = await prisma.visitor.findUnique({
        where: { phone: invitation.guestPhone },
        select: { id: true }
      })

      if (!visitor) {
        const created = await prisma.visitor.create({
          data: {
            name: invitation.guestName,
            phone: invitation.guestPhone,
            source: 'member-invitation',
            status: 'pending',
            notes: 'دعوة من عضو - تم إنشاؤها يدوياً للتعيين'
          }
        })
        visitor = { id: created.id }
      }

      const activeFollowUps = await prisma.followUp.findMany({
        where: { visitorId: visitor.id, archived: false },
        select: { id: true }
      })

      if (activeFollowUps.length > 0) {
        await prisma.followUp.updateMany({
          where: { id: { in: activeFollowUps.map(f => f.id) } },
          data: { assignedTo: newOwner }
        })
      } else {
        await prisma.followUp.create({
          data: {
            visitorId: visitor.id,
            notes: 'دعوة من عضو - في انتظار المتابعة من فريق المبيعات',
            assignedTo: newOwner
          }
        })
      }

      return NextResponse.json({ success: true, entityType, entityId, salesStaffId: newOwner })
    }

    return NextResponse.json({ error: 'entityType غير صالح' }, { status: 400 })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    }
    if (error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'هذه العملية متاحة للأدمن فقط' }, { status: 403 })
    }
    console.error('assign-single error:', error)
    return NextResponse.json({ error: 'فشل التعيين' }, { status: 500 })
  }
}

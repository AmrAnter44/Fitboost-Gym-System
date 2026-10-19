import { NextResponse } from 'next/server'
import { guard } from '../../../lib/routeGuard'
import { prisma } from '../../../lib/prisma'
import { addPoints } from '../../../lib/points'
import { verifyAuth } from '../../../lib/auth'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../lib/auditLog'

// 🪪 الشخص الواحد (بالرقم القومي) ليه 3 دعوات بس — على كل الأعضاء
const MAX_INVITATIONS_PER_GUEST = 3

// الرقم القومي المصري: 14 رقم — بنحوّل الأرقام العربي/الهندي لإنجليزي ونشيل المسافات
function normalizeNationalId(raw: unknown): string {
  return String(raw ?? '')
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, '')
}

// GET: جلب جميع الدعوات أو دعوات عضو معين

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const __g = await guard(request, ['canViewMembers'])
  if (__g instanceof NextResponse) return __g

  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    // 🔒 لو اليوزر سيلز → بيشوف دعوات أعضاءه بس (اللي salesStaffId بتاعهم = staffId بتاعه)
    const where: any = {}
    if (memberId) where.memberId = memberId
    //  سجل دعوات عضو معيّن (بروفايل العضو) بيتعرض كامل لأي حساب — قبل كده السيلز كان بيشوف
    //  السجل فاضي لو العضو تابع لسيلز تاني، فالدعوة كانت بتبان إنها "متسجلتش".
    //  التقييد فاضل بس على القايمة العامة (من غير memberId): السيلز بيشوف دعوات أعضاءه.
    if (!memberId && user.isSales && user.staffId) {
      where.member = { salesStaffId: user.staffId }
    }

    const invitations = await prisma.invitation.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        member: {
          select: {
            memberNumber: true,
            name: true,
            phone: true,
            salesStaffId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(invitations)
  } catch (error) {
    console.error('Error fetching invitations:', error)
    return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 })
  }
}

// POST: إضافة دعوة جديدة
export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { memberId, guestName, guestPhone, notes, salesStaffId } = body
    const guestNationalId = normalizeNationalId(body.guestNationalId)

    // التحقق من البيانات المطلوبة
    if (!memberId || !guestName || !guestPhone) {
      return NextResponse.json(
        { error: 'Member ID, guest name, and guest phone are required' },
        { status: 400 }
      )
    }
    // الرقم القومي اختياري — بس لو اتكتب لازم يبقى 14 رقم (وساعتها بيتطبق حد الـ 3 دعوات)
    if (guestNationalId && guestNationalId.length !== 14) {
      return NextResponse.json({ error: 'الرقم القومي للضيف لازم يكون 14 رقم' }, { status: 400 })
    }

    // التحقق من وجود العضو وأن لديه دعوات متبقية
    const member = await prisma.member.findUnique({
      where: { id: memberId },
    })

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    if (member.invitations <= 0) {
      return NextResponse.json({ error: 'No invitations remaining' }, { status: 400 })
    }

    // 🔒 قفل تخصيص السيلز للدعوة: السيلز المسؤول عن الدعوة لازم يكون
    // نفس السيلز المرتبط بالعضو، إلا لو OWNER/ADMIN قرر يغيره يدوياً.
    const submittedSalesStaffId: string | null = salesStaffId || null
    const isPrivileged = user.role === 'OWNER' || user.role === 'ADMIN'
    let effectiveSalesStaffId: string | null = submittedSalesStaffId
    let invitationSalesForced: { from: string | null; to: string } | null = null
    let invitationSalesAdminOverride: { from: string | null; to: string | null; role: string } | null = null

    if (member.salesStaffId) {
      if (!isPrivileged) {
        if (submittedSalesStaffId !== member.salesStaffId) {
          invitationSalesForced = { from: submittedSalesStaffId, to: member.salesStaffId }
        }
        effectiveSalesStaffId = member.salesStaffId
      } else if (submittedSalesStaffId && submittedSalesStaffId !== member.salesStaffId) {
        invitationSalesAdminOverride = {
          from: member.salesStaffId,
          to: submittedSalesStaffId,
          role: user.role
        }
      } else if (!submittedSalesStaffId) {
        // حتى لو الأدمن ما حدّدش، نستخدم سيلز العضو كافتراضي
        effectiveSalesStaffId = member.salesStaffId
      }
    }

    // التحقق من أن رقم الهاتف ليس مسجلاً كعضو
    const existingMember = await prisma.member.findFirst({
      where: {
        OR: [
          { phone: guestPhone.trim() },
          { backupPhone: guestPhone.trim() },
        ],
      },
      select: { id: true, name: true, memberNumber: true },
    })

    if (existingMember) {
      return NextResponse.json(
        {
          error: `رقم الهاتف مسجل كعضو: ${existingMember.name} (#${existingMember.memberNumber})`,
          existingMember,
        },
        { status: 409 }
      )
    }

    // إنشاء سجل الدعوة وتحديث عدد الدعوات في معاملة واحدة
    // ✅ التحقق من العدد داخل الـ transaction لتجنب race condition
    const [invitation, updatedMember] = await prisma.$transaction(async (tx) => {
      const freshMember = await tx.member.findUnique({
        where: { id: memberId },
        select: { invitations: true }
      })
      if (!freshMember || freshMember.invitations <= 0) {
        throw new Error('NO_INVITATIONS')
      }

      // 🪪 حد الدعوات للشخص الواحد (بالرقم القومي، من أي عضو) — لو الرقم اتكتب
      if (guestNationalId) {
        const usedByGuest = await tx.invitation.count({ where: { guestNationalId } })
        if (usedByGuest >= MAX_INVITATIONS_PER_GUEST) {
          throw new Error('GUEST_LIMIT')
        }
      }

      const inv = await tx.invitation.create({
        data: {
          guestName,
          guestPhone,
          guestNationalId: guestNationalId || null,
          notes,
          memberId,
        },
        include: {
          member: {
            select: {
              memberNumber: true,
              name: true,
            },
          },
        },
      })
      const updated = await tx.member.update({
        where: { id: memberId },
        data: {
          invitations: {
            decrement: 1,
          },
        },
      })
      return [inv, updated] as const
    })

    // ✅ إضافة الضيف في الزوار + followup في transaction واحد
    // الكود القديم كان بيعمل findUnique ثم create (race condition) وبيـ swallow الأخطاء
    // فلو الـ followup فشل، الدعوة بتتسجل من غير متابعة → "متابعات مش بتتسجل"

    // قرار الـ assignedTo قبل الـ transaction (الـ staff query بياخد وقت)
    let assignedToForInvitation: string | null = effectiveSalesStaffId
    if (!assignedToForInvitation) {
      try {
        const salesStaffList = await prisma.staff.findMany({
          where: { isActive: true, position: { contains: 'sales' } },
          select: {
            id: true,
            _count: { select: { followUpAssignments: { where: { archived: false } } } }
          }
        })
        if (salesStaffList.length > 0) {
          const sorted = [...salesStaffList].sort((a, b) => a._count.followUpAssignments - b._count.followUpAssignments)
          assignedToForInvitation = sorted[0].id
        }
      } catch {}
    }

    try {
      await prisma.$transaction(async (tx) => {
        // upsert بدل findUnique→create عشان نتجنب race condition
        const visitor = await tx.visitor.upsert({
          where: { phone: guestPhone },
          update: {},
          create: {
            name: guestName.trim(),
            phone: guestPhone.trim(),
            source: "member-invitation",
            interestedIn: "دعوة من عضو",
            notes: `دعوة من العضو: ${member.name} (#${member.memberNumber})${notes ? ' - ' + notes : ''}`,
            status: "pending",
          },
        })

        // إنشاء متابعة فقط إذا لم تكن هناك متابعة نشطة
        const activeFollowUp = await tx.followUp.findFirst({
          where: { visitorId: visitor.id, archived: false },
        })

        if (!activeFollowUp) {
          await tx.followUp.create({
            data: {
              visitorId: visitor.id,
              notes: `دعوة من العضو ${member.name} - في انتظار المتابعة من فريق المبيعات`,
              nextFollowUpDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
              assignedTo: assignedToForInvitation,
            },
          })
        }
      })
    } catch (visitorError) {
      // الـ Invitation اتسجلت بالفعل في الـ transaction اللي فوق.
      // لو الـ visitor/followup فشلوا، نـ log بوضوح والأدمن يقدر يستخدم
      // زرار "توزيع غير المُسنَّدين" يصلح الموقف.
      console.error("⚠️ فشل إنشاء visitor+followup من الدعوة:", visitorError)
    }

    // إضافة نقاط عند استخدام دعوة (إذا كان نظام النقاط مفعل)
    try {
      const settings = await prisma.systemSettings.findUnique({
        where: { id: 'singleton' }
      })

      if (settings && settings.pointsEnabled && settings.pointsPerInvitation > 0) {
        await addPoints(
          memberId,
          settings.pointsPerInvitation,
          'invitation',
          `استخدام دعوة لـ ${guestName}`
        )
      }
    } catch (pointsError) {
      console.error('Error adding invitation points:', pointsError)
      // لا نوقف العملية إذا فشلت إضافة النقاط
    }

    // 📝 Audit log — فقط لو حصل override (force أو admin) للسيلز
    if (invitationSalesForced || invitationSalesAdminOverride) {
      createAuditLog({
        userId: user.userId,
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        action: 'CREATE',
        resource: 'Invitation',
        resourceId: invitation.id,
        details: {
          memberId,
          memberName: member.name,
          guestName,
          ...(invitationSalesForced ? { invitationSalesForced } : {}),
          ...(invitationSalesAdminOverride ? { invitationSalesAdminOverride } : {})
        },
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request),
        status: 'success'
      })
    }

    return NextResponse.json({ invitation, updatedMember })
  } catch (error: any) {
    if (error?.message === 'NO_INVITATIONS') {
      return NextResponse.json({ error: 'No invitations remaining' }, { status: 400 })
    }
    if (error?.message === 'GUEST_LIMIT') {
      return NextResponse.json(
        { error: `الشخص ده (بنفس الرقم القومي) استخدم ${MAX_INVITATIONS_PER_GUEST} دعوات قبل كده — مينفعش دعوة تانية`, code: 'GUEST_LIMIT' },
        { status: 400 }
      )
    }
    console.error('Error creating invitation:', error)
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
  }
}

// PUT: تعديل دعوة
export async function PUT(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, guestName, guestPhone, notes } = body

    if (!id) {
      return NextResponse.json({ error: 'Invitation ID is required' }, { status: 400 })
    }

    const updateData: any = {}
    if (guestName !== undefined) updateData.guestName = guestName.trim()
    if (guestPhone !== undefined) updateData.guestPhone = guestPhone.trim()
    if (notes !== undefined) updateData.notes = notes

    const invitation = await prisma.invitation.update({
      where: { id },
      data: updateData,
      include: {
        member: {
          select: {
            memberNumber: true,
            name: true,
            phone: true,
          },
        },
      },
    })

    return NextResponse.json(invitation)
  } catch (error) {
    console.error('Error updating invitation:', error)
    return NextResponse.json({ error: 'Failed to update invitation' }, { status: 500 })
  }
}

// DELETE: حذف دعوة
export async function DELETE(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Invitation ID is required' }, { status: 400 })
    }

    // ✅ جلب الدعوة أولاً عشان نرجع العدد للعضو
    const invitation = await prisma.invitation.findUnique({
      where: { id },
      select: { memberId: true }
    })

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    // حذف الدعوة وإرجاع عدد الدعوات في transaction
    await prisma.$transaction([
      prisma.invitation.delete({ where: { id } }),
      prisma.member.update({
        where: { id: invitation.memberId },
        data: { invitations: { increment: 1 } }
      })
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting invitation:', error)
    return NextResponse.json({ error: 'Failed to delete invitation' }, { status: 500 })
  }
}
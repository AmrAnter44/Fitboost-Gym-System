import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { addPoints } from '../../../lib/points'
import { verifyAuth } from '../../../lib/auth'

// GET: جلب جميع الدعوات أو دعوات عضو معين

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
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
    if (user.isSales && user.staffId) {
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

    // التحقق من البيانات المطلوبة
    if (!memberId || !guestName || !guestPhone) {
      return NextResponse.json(
        { error: 'Member ID, guest name, and guest phone are required' },
        { status: 400 }
      )
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

      const inv = await tx.invitation.create({
        data: {
          guestName,
          guestPhone,
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

    // ✅ إضافة الضيف في الزوار تلقائياً (إذا لم يكن موجوداً)
    try {
      const existingVisitor = await prisma.visitor.findUnique({
        where: { phone: guestPhone },
      })

      // تحديد الزائر (موجود أو جديد)
      let targetVisitor = existingVisitor
      if (!existingVisitor) {
        targetVisitor = await prisma.visitor.create({
          data: {
            name: guestName.trim(),
            phone: guestPhone.trim(),
            source: "member-invitation",
            interestedIn: "دعوة من عضو",
            notes: `دعوة من العضو: ${member.name} (#${member.memberNumber})${notes ? ' - ' + notes : ''}`,
            status: "pending",
          },
        })
      }

      if (targetVisitor) {
        // إنشاء متابعة فقط إذا لم تكن هناك متابعة نشطة
        const activeFollowUp = await prisma.followUp.findFirst({
          where: { visitorId: targetVisitor.id, archived: false },
        })

        if (!activeFollowUp) {
          let assignedTo: string | null = salesStaffId || null
          if (!assignedTo) {
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
                assignedTo = sorted[0].id
              }
            } catch {}
          }

          await prisma.followUp.create({
            data: {
              visitorId: targetVisitor.id,
              notes: `دعوة من العضو ${member.name} - في انتظار المتابعة من فريق المبيعات`,
              nextFollowUpDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
              assignedTo,
            },
          })
        }
      }
    } catch (visitorError) {
      // في حالة فشل إنشاء الزائر، نستمر (لأن Invitation تم إنشاؤه بنجاح)
      console.error("⚠️ تحذير: فشل إنشاء الزائر من الدعوة:", visitorError)
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

    return NextResponse.json({ invitation, updatedMember })
  } catch (error: any) {
    if (error?.message === 'NO_INVITATIONS') {
      return NextResponse.json({ error: 'No invitations remaining' }, { status: 400 })
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
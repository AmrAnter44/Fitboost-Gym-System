import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { addPoints } from '../../../lib/points'

// GET: جلب جميع الدعوات أو دعوات عضو معين

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    const invitations = await prisma.invitation.findMany({
      where: memberId ? { memberId } : undefined,
      include: {
        member: {
          select: {
            memberNumber: true,
            name: true,
            phone: true,
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
    const body = await request.json()
    const { memberId, guestName, guestPhone, notes } = body

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

    // إنشاء سجل الدعوة وتحديث عدد الدعوات في معاملة واحدة
    const [invitation, updatedMember] = await prisma.$transaction([
      prisma.invitation.create({
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
      }),
      prisma.member.update({
        where: { id: memberId },
        data: {
          invitations: {
            decrement: 1,
          },
        },
      }),
    ])

    // ✅ إضافة الضيف في الزوار تلقائياً (إذا لم يكن موجوداً)
    try {
      const existingVisitor = await prisma.visitor.findUnique({
        where: { phone: guestPhone },
      })

      if (!existingVisitor) {
        // إنشاء زائر جديد من دعوة العضو
        await prisma.visitor.create({
          data: {
            name: guestName.trim(),
            phone: guestPhone.trim(),
            source: "member-invitation", // مصدر الزائر: دعوة من عضو
            interestedIn: "دعوة من عضو",
            notes: `دعوة من العضو: ${member.name} (#${member.memberNumber})${notes ? ' - ' + notes : ''}`,
            status: "pending",
          },
        })

        // إنشاء أول متابعة تلقائياً
        const newVisitor = await prisma.visitor.findUnique({
          where: { phone: guestPhone },
        })

        if (newVisitor) {
          await prisma.followUp.create({
            data: {
              visitorId: newVisitor.id,
              notes: `دعوة من العضو ${member.name} - في انتظار المتابعة من فريق المبيعات`,
              nextFollowUpDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // بعد 24 ساعة
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
  } catch (error) {
    console.error('Error creating invitation:', error)
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
  }
}

// DELETE: حذف دعوة
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Invitation ID is required' }, { status: 400 })
    }

    await prisma.invitation.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting invitation:', error)
    return NextResponse.json({ error: 'Failed to delete invitation' }, { status: 500 })
  }
}
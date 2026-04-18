import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

// GET - جلب متابعات زائر معين أو جميع المتابعات

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    /**
     * جلب المتابعات
     * @permission canViewFollowUps - صلاحية عرض متابعات الزوار
     */
    await requirePermission(request, 'canViewFollowUps')

    const { searchParams } = new URL(request.url)
    const visitorId = searchParams.get('visitorId')
    const limit = Math.min(parseInt(searchParams.get('limit') || '5000'), 10000)

    // إذا تم تحديد visitorId، جلب متابعات زائر معين فقط
    // إذا لم يتم تحديد visitorId، جلب جميع المتابعات (بحد أقصى)
    const followUps = await prisma.followUp.findMany({
      where: visitorId ? { visitorId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: visitorId ? undefined : limit,
      include: {
        visitor: {
          select: {
            id: true,
            name: true,
            phone: true,
            source: true,
            status: true,
            interestedIn: true,
          },
        },
        assignedStaff: {
          select: {
            id: true,
            name: true,
            position: true,
          },
        },
      },
    })

    return NextResponse.json(followUps)
  } catch (error) {
    console.error('GET FollowUp Error:', error)
    return NextResponse.json({ error: 'فشل جلب المتابعات' }, { status: 500 })
  }
}

// POST - إضافة متابعة جديدة
export async function POST(request: Request) {
  try {
    /**
     * إضافة متابعة جديدة
     * @permission canCreateFollowUp - صلاحية إنشاء متابعات جديدة
     */
    const user = await requirePermission(request, 'canCreateFollowUp')

    const body = await request.json()
    const { visitorId, notes, contacted, nextFollowUpDate, result, salesName, visitorData, assignedTo, priority, stage } = body

    if (!visitorId) {
      return NextResponse.json(
        { error: 'معرف الزائر مطلوب' },
        { status: 400 }
      )
    }

    let actualVisitorId = visitorId

    // ✅ معالجة خاصة للأعضاء المنتهيين وDay Use والدعوات
    if (visitorId.startsWith('expired-') || visitorId.startsWith('expiring-') || visitorId.startsWith('dayuse-') || visitorId.startsWith('invitation-')) {
      // التحقق من وجود بيانات الزائر
      if (!visitorData || !visitorData.phone || !visitorData.name) {
        return NextResponse.json(
          { error: 'بيانات الزائر (name, phone) مطلوبة' },
          { status: 400 }
        )
      }

      // البحث عن visitor موجود بنفس رقم الهاتف
      const existingVisitor = await prisma.visitor.findFirst({
        where: { phone: visitorData.phone }
      })

      if (existingVisitor) {
        // استخدام الـ visitor الموجود
        actualVisitorId = existingVisitor.id
      } else {
        // إنشاء visitor جديد
        const newVisitor = await prisma.visitor.create({
          data: {
            name: visitorData.name,
            phone: visitorData.phone,
            source: visitorData.source || 'other',
            status: 'pending'
          }
        })
        actualVisitorId = newVisitor.id
      }
    } else {
      // التحقق العادي من وجود الزائر للزوار الحقيقيين
      const visitor = await prisma.visitor.findUnique({
        where: { id: visitorId },
      })

      if (!visitor) {
        return NextResponse.json({ error: 'الزائر غير موجود' }, { status: 404 })
      }
    }

    // ✅ إنشاء متابعة جديدة (المتابعات القديمة تفضل موجودة في الداتابيز)
    const followUp = await prisma.followUp.create({
      data: {
        visitorId: actualVisitorId,
        notes: notes?.trim() || '',
        contacted: contacted || false,
        nextFollowUpDate: nextFollowUpDate
          ? new Date(nextFollowUpDate.length <= 10 ? nextFollowUpDate + 'T12:00:00' : nextFollowUpDate)
          : null,
        result: result?.trim(),
        salesName: salesName?.trim(),
        assignedTo: assignedTo || null,
        priority: priority || 'medium',
        stage: stage || 'new',
        lastContactedAt: contacted ? new Date() : null,
        contactCount: contacted ? 1 : 0,
      },
    })

    // ✅ تسجيل النشاط (Activity Log)
    try {
      // تسجيل التوزيع إذا تم تحديد موظف
      if (assignedTo) {
        const assignedStaff = await prisma.staff.findUnique({
          where: { id: assignedTo },
          select: { name: true }
        })

        await prisma.followUpActivity.create({
          data: {
            followUpId: followUp.id,
            activityType: 'assignment',
            notes: `تم إسناد المتابعة إلى ${assignedStaff?.name || 'موظف'}`,
            createdBy: user.staffId || user.userId,
          }
        })
      }
    } catch (activityError) {
      console.error('Error creating activity:', activityError)
      // لا نوقف العملية إذا فشل تسجيل النشاط
    }

    // تحديث حالة الزائر إذا لزم الأمر
    if (result === 'subscribed') {
      await prisma.visitor.update({
        where: { id: actualVisitorId },
        data: { status: 'subscribed' },
      })
    } else if (result === 'not-interested') {
      await prisma.visitor.update({
        where: { id: actualVisitorId },
        data: { status: 'rejected' },
      })
    } else if (contacted) {
      await prisma.visitor.update({
        where: { id: actualVisitorId },
        data: { status: 'contacted' },
      })
    }

    return NextResponse.json(followUp, { status: 201 })
  } catch (error) {
    console.error('POST FollowUp Error:', error)
    return NextResponse.json({ error: 'فشل إضافة المتابعة' }, { status: 500 })
  }
}

// PUT - تحديث متابعة
export async function PUT(request: Request) {
  try {
    /**
     * تعديل متابعة
     * @permission canCreateFollowUp - صلاحية تعديل المتابعات
     */
    const user = await requirePermission(request, 'canCreateFollowUp')

    const body = await request.json()
    const { id, notes, contacted, nextFollowUpDate, result, assignedTo, priority, stage, contactCount, lastContactedAt } = body

    if (!id) {
      return NextResponse.json(
        { error: 'معرف المتابعة مطلوب' },
        { status: 400 }
      )
    }

    // جلب المتابعة الحالية للمقارنة
    const currentFollowUp = await prisma.followUp.findUnique({
      where: { id },
      select: { assignedTo: true, contacted: true }
    })

    const updateData: any = {}
    if (notes !== undefined) updateData.notes = notes.trim()
    if (contacted !== undefined) updateData.contacted = contacted
    if (nextFollowUpDate !== undefined) {
      updateData.nextFollowUpDate = nextFollowUpDate
        ? new Date(nextFollowUpDate.length <= 10 ? nextFollowUpDate + 'T12:00:00' : nextFollowUpDate)
        : null
    }
    if (result !== undefined) updateData.result = result?.trim()
    if (priority !== undefined) updateData.priority = priority
    if (stage !== undefined) updateData.stage = stage

    // تحديث assignedTo مع تسجيل إعادة التوزيع
    if (assignedTo !== undefined) {
      updateData.assignedTo = assignedTo

      // تسجيل إعادة التوزيع إذا تغير الموظف
      if (assignedTo && assignedTo !== currentFollowUp?.assignedTo) {
        try {
          const newStaff = await prisma.staff.findUnique({
            where: { id: assignedTo },
            select: { name: true }
          })

          await prisma.followUpActivity.create({
            data: {
              followUpId: id,
              activityType: 'assignment',
              notes: `تم إعادة الإسناد إلى ${newStaff?.name || 'موظف'}`,
              createdBy: user.staffId || user.userId
            }
          })
        } catch (activityError) {
          console.error('Error creating reassignment activity:', activityError)
        }
      }
    }

    // تحديث contactCount عند التواصل
    if (contacted === true && !currentFollowUp?.contacted) {
      updateData.contactCount = { increment: 1 }
      updateData.lastContactedAt = new Date()
    }

    // السماح بتحديث يدوي لـ contactCount و lastContactedAt
    if (contactCount !== undefined) updateData.contactCount = contactCount
    if (lastContactedAt !== undefined) updateData.lastContactedAt = lastContactedAt ? new Date(lastContactedAt) : null

    const followUp = await prisma.followUp.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(followUp)
  } catch (error) {
    console.error('PUT FollowUp Error:', error)
    return NextResponse.json({ error: 'فشل التحديث' }, { status: 500 })
  }
}

// DELETE - حذف متابعة
export async function DELETE(request: Request) {
  try {
    /**
     * حذف متابعة
     * @permission canCreateFollowUp - صلاحية حذف المتابعات
     */
    await requirePermission(request, 'canCreateFollowUp')

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'معرف المتابعة مطلوب' },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.followUpActivity.deleteMany({ where: { followUpId: id } })
      await tx.followUp.delete({ where: { id } })
    })

    return NextResponse.json({ message: 'تم الحذف بنجاح' })
  } catch (error) {
    console.error('DELETE FollowUp Error:', error)
    return NextResponse.json({ error: 'فشل الحذف' }, { status: 500 })
  }
}
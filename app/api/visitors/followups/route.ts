import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

// GET - جلب متابعات زائر معين أو جميع المتابعات
export async function GET(request: Request) {
  try {
    // ✅ التحقق من تسجيل الدخول
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const visitorId = searchParams.get('visitorId')

    // إذا تم تحديد visitorId، جلب متابعات زائر معين فقط
    // إذا لم يتم تحديد visitorId، جلب جميع المتابعات
    const followUps = await prisma.followUp.findMany({
      where: visitorId ? { visitorId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        visitor: {
          select: {
            id: true,
            name: true,
            phone: true,
            source: true,
            status: true,
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
    // ✅ التحقق من تسجيل الدخول
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { visitorId, notes, contacted, nextFollowUpDate, result, salesName, visitorData } = body

    if (!visitorId || !notes) {
      return NextResponse.json(
        { error: 'معرف الزائر والملاحظات مطلوبان' },
        { status: 400 }
      )
    }

    let actualVisitorId = visitorId

    // ✅ معالجة خاصة للأعضاء المنتهيين وDay Use والدعوات
    if (visitorId.startsWith('expired-') || visitorId.startsWith('dayuse-') || visitorId.startsWith('invitation-')) {
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

    // إنشاء المتابعة
    const followUp = await prisma.followUp.create({
      data: {
        visitorId: actualVisitorId,
        notes: notes.trim(),
        contacted: contacted || false,
        nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null,
        result: result?.trim(), // 'interested', 'not-interested', 'postponed', 'subscribed'
        salesName: salesName?.trim(), // اسم البائع الذي قام بالمتابعة
      },
    })

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
    // ✅ التحقق من تسجيل الدخول
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { id, notes, contacted, nextFollowUpDate, result } = body

    if (!id) {
      return NextResponse.json(
        { error: 'معرف المتابعة مطلوب' },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (notes !== undefined) updateData.notes = notes.trim()
    if (contacted !== undefined) updateData.contacted = contacted
    if (nextFollowUpDate !== undefined) {
      updateData.nextFollowUpDate = nextFollowUpDate ? new Date(nextFollowUpDate) : null
    }
    if (result !== undefined) updateData.result = result?.trim()

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
    // ✅ التحقق من تسجيل الدخول
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'معرف المتابعة مطلوب' },
        { status: 400 }
      )
    }

    await prisma.followUp.delete({ where: { id } })

    return NextResponse.json({ message: 'تم الحذف بنجاح' })
  } catch (error) {
    console.error('DELETE FollowUp Error:', error)
    return NextResponse.json({ error: 'فشل الحذف' }, { status: 500 })
  }
}
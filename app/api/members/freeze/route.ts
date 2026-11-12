// app/api/members/freeze/route.ts - Freeze Subscription Endpoint
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requireAnyPermission } from '../../../../lib/auth'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

// POST - تجميد اشتراك عضو (استخدام الفريز)

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // التحقق من صلاحية تعديل الأعضاء
    // ✅ صلاحية التجميد: أي حد عنده تعديل أو إضافة أعضاء
    const user = await requireAnyPermission(request, ['canEditMembers', 'canCreateMembers'])

    const body = await request.json()
    //  isBack = باك فريز (تجميد بأثر رجعي لفترة غياب الميمبر من غير ما عمل فريز)
    //  backStartDate = تاريخ آخر حضور (بداية الغياب) — اختياري، للتسجيل بس
    const { memberId, freezeDays, isBack, backStartDate } = body
    const isBackFreeze = isBack === true


    // 1. التحقق من البيانات المطلوبة
    if (!memberId || !freezeDays) {
      return NextResponse.json(
        { error: 'بيانات غير كاملة' },
        { status: 400 }
      )
    }

    // 2. التحقق من أن عدد الأيام موجب
    const daysToFreeze = parseInt(freezeDays.toString())
    if (daysToFreeze <= 0) {
      return NextResponse.json(
        { error: 'يجب أن يكون عدد أيام الفريز أكبر من صفر' },
        { status: 400 }
      )
    }

    // 3. جلب بيانات العضو
    const member = await prisma.member.findUnique({
      where: { id: memberId }
    })

    if (!member) {
      return NextResponse.json(
        { error: 'العضو غير موجود' },
        { status: 404 }
      )
    }

    // 4. التحقق من وجود رصيد فريز كافٍ
    if (member.remainingFreezeDays < daysToFreeze) {
      return NextResponse.json({
        error: `رصيد الفريز غير كافٍ. المتاح: ${member.remainingFreezeDays} يوم، المطلوب: ${daysToFreeze} يوم`
      }, { status: 400 })
    }

    // 5. التحقق من وجود اشتراك نشط
    if (!member.expiryDate) {
      return NextResponse.json({
        error: 'لا يوجد اشتراك نشط للعضو'
      }, { status: 400 })
    }

    // 5.1 منع التجميد المزدوج — لو العضو متجمّد بالفعل، التجميد تاني هيخصم
    //     الأيام مرتين بينما الـ unfreeze بيعكس آخر طلب بس.
    if (member.isFrozen) {
      return NextResponse.json({
        error: 'العضو مجمّد بالفعل. يجب إلغاء التجميد الحالي أولاً.'
      }, { status: 400 })
    }

    // 6. حساب تاريخ الانتهاء الجديد
    const currentExpiryDate = new Date(member.expiryDate)
    const newExpiryDate = new Date(currentExpiryDate)
    newExpiryDate.setDate(newExpiryDate.getDate() + daysToFreeze)

    // 7. حساب الرصيد المتبقي بعد الفريز
    const newRemainingFreezeDays = member.remainingFreezeDays - daysToFreeze


    // 8. تحديث بيانات العضو وتسجيل طلب التجميد
    //  الباك فريز: الفترة كانت في الماضي (الغياب) — من آخر حضور لغاية النهاردة.
    //  التجميد العادي: يبدأ من دلوقتي.
    let freezeStartDate: Date
    let freezeEndDate: Date
    if (isBackFreeze) {
      freezeEndDate = new Date() // النهاردة
      freezeStartDate = backStartDate ? new Date(backStartDate) : new Date(freezeEndDate)
      if (!backStartDate) freezeStartDate.setDate(freezeStartDate.getDate() - daysToFreeze)
    } else {
      freezeStartDate = new Date()
      freezeEndDate = new Date(freezeStartDate)
      freezeEndDate.setDate(freezeEndDate.getDate() + daysToFreeze)
    }

    // تحديث العضو + إنشاء طلب التجميد في transaction واحد عشان ميحصلش
    // إن الأيام تتخصم من غير ما يتسجّل طلب (اللي بيكسر الـ unfreeze).
    const updatedMember = await prisma.$transaction(async (tx) => {
      //  الباك فريز مبيخليش العضو مجمّد (هو راجع/حاضر) — بس بيمد الاشتراك بأيام الغياب.
      //  التجميد العادي بيخلي العضو مجمّد لحد ما يتعمل unfreeze.
      const memberData: any = {
        expiryDate: newExpiryDate,
        remainingFreezeDays: newRemainingFreezeDays,
      }
      if (isBackFreeze) {
        //  نعيد حساب النشاط حسب تاريخ الانتهاء الجديد (العضو راجع مش مجمّد)
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const exp = new Date(newExpiryDate); exp.setHours(0, 0, 0, 0)
        memberData.isActive = exp >= today
      } else {
        memberData.isFrozen = true
        memberData.isActive = true
      }

      const um = await tx.member.update({
        where: { id: memberId },
        data: memberData,
      })
      await tx.freezeRequest.create({
        data: {
          memberId,
          startDate: freezeStartDate,
          endDate: freezeEndDate,
          days: daysToFreeze,
          status: 'approved',
          reason: isBackFreeze ? 'باك فريز — غياب بدون تجميد' : 'تجميد مباشر',
          isBack: isBackFreeze,
        } as any,
      })
      return um
    })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'Member', resourceId: member.id,
      details: { operation: isBackFreeze ? 'BackFreeze' : 'Freeze', memberNumber: member.memberNumber, memberName: member.name, freezeDays: daysToFreeze, oldExpiryDate: currentExpiryDate.toISOString().split('T')[0], newExpiryDate: newExpiryDate.toISOString().split('T')[0] },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    // 9. إرجاع النتيجة
    return NextResponse.json({
      success: true,
      message: isBackFreeze
        ? `تم عمل باك فريز ومد الاشتراك ${daysToFreeze} يوم (فترة الغياب) بنجاح`
        : `تم تجميد الاشتراك لمدة ${daysToFreeze} يوم بنجاح`,
      member: {
        id: updatedMember.id,
        name: updatedMember.name,
        oldExpiryDate: currentExpiryDate.toISOString().split('T')[0],
        newExpiryDate: newExpiryDate.toISOString().split('T')[0],
        daysAdded: daysToFreeze,
        remainingFreezeDays: newRemainingFreezeDays
      }
    })

  } catch (error: any) {
    console.error('❌ خطأ في تجميد الاشتراك:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تجميد الاشتراكات' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      error: 'حدث خطأ أثناء تجميد الاشتراك'
    }, { status: 500 })
  }
}

// PUT - إلغاء تجميد اشتراك عضو (unfreeze)
export async function PUT(request: Request) {
  try {
    // التحقق من صلاحية تعديل الأعضاء
    // ✅ صلاحية التجميد: أي حد عنده تعديل أو إضافة أعضاء
    const user = await requireAnyPermission(request, ['canEditMembers', 'canCreateMembers'])

    const body = await request.json()
    const { memberId } = body


    // 1. التحقق من البيانات المطلوبة
    if (!memberId) {
      return NextResponse.json(
        { error: 'بيانات غير كاملة' },
        { status: 400 }
      )
    }

    // 2. جلب بيانات العضو
    const member = await prisma.member.findUnique({
      where: { id: memberId }
    })

    if (!member) {
      return NextResponse.json(
        { error: 'العضو غير موجود' },
        { status: 404 }
      )
    }

    // 3. التحقق من أن العضو متجمد
    if (!member.isFrozen) {
      return NextResponse.json({
        error: 'العضو غير مجمد'
      }, { status: 400 })
    }

    // 4. حساب الأيام الفعلية المستخدمة وإرجاع الزيادة
    //  نتجاهل الباك فريز — هو تجميد ماضي مالوش أيام مستقبلية ترجّع
    const latestFreeze = await prisma.freezeRequest.findFirst({
      where: { memberId, status: 'approved', isBack: false } as any,
      orderBy: { startDate: 'desc' }
    })

    let unusedDays = 0
    let newExpiryDate = member.expiryDate

    if (latestFreeze) {
      const actualDays = Math.min(
        latestFreeze.days,
        Math.max(0, Math.ceil((Date.now() - new Date(latestFreeze.startDate).getTime()) / (1000 * 60 * 60 * 24)))
      )
      unusedDays = latestFreeze.days - actualDays

      if (unusedDays > 0 && member.expiryDate) {
        const expiry = new Date(member.expiryDate)
        expiry.setDate(expiry.getDate() - unusedDays)
        newExpiryDate = expiry
      }

      // تحديث تاريخ انتهاء الفريز الفعلي
      await prisma.freezeRequest.update({
        where: { id: latestFreeze.id },
        data: { endDate: new Date() }
      })
    }

    // التحقق من صلاحية الاشتراك
    const isStillActive = newExpiryDate ? new Date(newExpiryDate) > new Date() : false

    const updatedMember = await prisma.member.update({
      where: { id: memberId },
      data: {
        isFrozen: false,
        isActive: isStillActive,
        expiryDate: newExpiryDate,
        remainingFreezeDays: member.remainingFreezeDays + unusedDays
      }
    })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'Member', resourceId: member.id,
      details: { operation: 'Unfreeze', memberNumber: member.memberNumber, memberName: member.name, unusedDaysReturned: unusedDays },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    // 5. إرجاع النتيجة
    return NextResponse.json({
      success: true,
      message: unusedDays > 0
        ? `تم إلغاء تجميد الاشتراك بنجاح (تم إرجاع ${unusedDays} يوم لرصيد الفريز)`
        : 'تم إلغاء تجميد الاشتراك بنجاح',
      member: {
        id: updatedMember.id,
        name: updatedMember.name,
        isFrozen: updatedMember.isFrozen,
        unusedDaysReturned: unusedDays
      }
    })

  } catch (error: any) {
    console.error('❌ خطأ في إلغاء تجميد الاشتراك:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية إلغاء تجميد الاشتراكات' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      error: 'حدث خطأ أثناء إلغاء تجميد الاشتراك'
    }, { status: 500 })
  }
}

// DELETE - ↩️ إلغاء عملية فريز بالكامل (ريست): كأنها ما اتعملتش
//  - الأيام اللي اتخصمت ترجع لرصيد الفريز
//  - تاريخ الانتهاء يرجع زي ما كان قبل الفريز
//  - لو العضو لسه مجمّد يتفك
//  - طلب الفريز يتعلّم «ملغي» (بيفضل في السجل)
//  آخر فريز بس — عشان الحسبة تفضل صح (أي فريز بعده أو تجديد بيبني على التاريخ ده).
//  لو الفريز اتفك بدري قبل كده، الأيام اللي ما اتستخدمتش رجعت ساعتها — فبنرجّع الباقي بس.
export async function DELETE(request: Request) {
  try {
    const user = await requireAnyPermission(request, ['canEditMembers', 'canCreateMembers'])
    const { memberId, freezeRequestId } = await request.json()
    if (!memberId || !freezeRequestId) {
      return NextResponse.json({ error: 'بيانات غير كاملة' }, { status: 400 })
    }

    const member = await prisma.member.findUnique({ where: { id: memberId } })
    if (!member) return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })

    const fr: any = await prisma.freezeRequest.findFirst({ where: { id: freezeRequestId, memberId } })
    if (!fr || fr.status !== 'approved') {
      return NextResponse.json({ error: 'الفريز ده مش موجود أو اتلغى قبل كده' }, { status: 400 })
    }
    //  آخر عملية فريز للعضو (أياً كانت حالتها) — لو آخر واحدة اتلغت، اللي قبلها مايتلغيش
    const latest = await prisma.freezeRequest.findFirst({
      where: { memberId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    if (latest?.id !== fr.id) {
      return NextResponse.json({ error: 'تقدر تلغي آخر عملية فريز بس' }, { status: 400 })
    }

    //  الأيام اللي فعلاً اتخصمت: الفريز العادي اللي اتفك بدري رجّع الباقي وقتها
    const DAY = 1000 * 60 * 60 * 24
    const start = new Date(fr.startDate).getTime()
    const end = new Date(fr.endDate).getTime()
    let effectiveDays = Number(fr.days) || 0
    if (!fr.isBack && end < start + effectiveDays * DAY) {
      effectiveDays = Math.min(effectiveDays, Math.max(0, Math.ceil((end - start) / DAY)))
    }

    let newExpiry = member.expiryDate
    if (member.expiryDate && effectiveDays > 0) {
      const d = new Date(member.expiryDate)
      d.setDate(d.getDate() - effectiveDays)
      newExpiry = d
    }
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const expMid = newExpiry ? new Date(newExpiry) : null
    if (expMid) expMid.setHours(0, 0, 0, 0)

    const updated = await prisma.$transaction(async (tx) => {
      await tx.freezeRequest.update({ where: { id: fr.id }, data: { status: 'cancelled' } })
      return tx.member.update({
        where: { id: memberId },
        data: {
          expiryDate: newExpiry,
          remainingFreezeDays: (member.remainingFreezeDays || 0) + effectiveDays,
          isFrozen: false,
          isActive: !expMid || expMid >= today,
        },
      })
    })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'Member', resourceId: memberId,
      details: {
        operation: 'CancelFreeze', memberNumber: member.memberNumber, memberName: member.name,
        freezeDays: fr.days, returnedDays: effectiveDays, isBack: !!fr.isBack,
        oldExpiryDate: member.expiryDate ? new Date(member.expiryDate).toISOString().split('T')[0] : null,
        newExpiryDate: newExpiry ? new Date(newExpiry).toISOString().split('T')[0] : null,
      },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json({
      success: true,
      message: `تم إلغاء الفريز — رجع ${effectiveDays} يوم لرصيد الفريز`,
      member: {
        expiryDate: updated.expiryDate,
        remainingFreezeDays: updated.remainingFreezeDays,
        isFrozen: updated.isFrozen,
        returnedDays: effectiveDays,
      },
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية إلغاء الفريز' }, { status: 403 })
    }
    console.error('❌ خطأ في إلغاء الفريز:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إلغاء الفريز' }, { status: 500 })
  }
}

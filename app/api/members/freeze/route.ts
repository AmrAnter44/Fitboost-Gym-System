// app/api/members/freeze/route.ts - Freeze Subscription Endpoint
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

// POST - تجميد اشتراك عضو (استخدام الفريز)

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // التحقق من صلاحية تعديل الأعضاء
    const user = await requirePermission(request, 'canEditMembers')

    const body = await request.json()
    const { memberId, freezeDays } = body


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

    // 6. حساب تاريخ الانتهاء الجديد
    const currentExpiryDate = new Date(member.expiryDate)
    const newExpiryDate = new Date(currentExpiryDate)
    newExpiryDate.setDate(newExpiryDate.getDate() + daysToFreeze)

    // 7. حساب الرصيد المتبقي بعد الفريز
    const newRemainingFreezeDays = member.remainingFreezeDays - daysToFreeze


    // 8. تحديث بيانات العضو وتسجيل طلب التجميد
    const freezeStartDate = new Date()
    const freezeEndDate = new Date(freezeStartDate)
    freezeEndDate.setDate(freezeEndDate.getDate() + daysToFreeze)

    const [updatedMember] = await Promise.all([
      prisma.member.update({
        where: { id: memberId },
        data: {
          expiryDate: newExpiryDate,
          remainingFreezeDays: newRemainingFreezeDays,
          isFrozen: true,
          isActive: true
        }
      }),
      prisma.freezeRequest.create({
        data: {
          memberId,
          startDate: freezeStartDate,
          endDate: freezeEndDate,
          days: daysToFreeze,
          status: 'approved',
          reason: 'تجميد مباشر'
        }
      })
    ])

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'Member', resourceId: member.id,
      details: { operation: 'Freeze', memberNumber: member.memberNumber, memberName: member.name, freezeDays: daysToFreeze, oldExpiryDate: currentExpiryDate.toISOString().split('T')[0], newExpiryDate: newExpiryDate.toISOString().split('T')[0] },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    // 9. إرجاع النتيجة
    return NextResponse.json({
      success: true,
      message: `تم تجميد الاشتراك لمدة ${daysToFreeze} يوم بنجاح`,
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
    const user = await requirePermission(request, 'canEditMembers')

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
    const latestFreeze = await prisma.freezeRequest.findFirst({
      where: { memberId, status: 'approved' },
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

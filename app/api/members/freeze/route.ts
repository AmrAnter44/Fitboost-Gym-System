// app/api/members/freeze/route.ts - Freeze Subscription Endpoint
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

// POST - تجميد اشتراك عضو (استخدام الفريز)

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // التحقق من صلاحية تعديل الأعضاء
    await requirePermission(request, 'canEditMembers')

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
    await requirePermission(request, 'canEditMembers')

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

    // 4. تحديث بيانات العضو (إلغاء التجميد)
    // التحقق من صلاحية الاشتراك
    const isStillActive = member.expiryDate ? new Date(member.expiryDate) > new Date() : false

    const updatedMember = await prisma.member.update({
      where: { id: memberId },
      data: {
        isFrozen: false,
        isActive: isStillActive
      }
    })


    // 5. إرجاع النتيجة
    return NextResponse.json({
      success: true,
      message: 'تم إلغاء تجميد الاشتراك بنجاح',
      member: {
        id: updatedMember.id,
        name: updatedMember.name,
        isFrozen: updatedMember.isFrozen
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

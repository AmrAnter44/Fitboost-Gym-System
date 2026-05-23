import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission, verifyAuth } from '../../../../lib/auth'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

// تحديث إيصال موجود

export const dynamic = 'force-dynamic'

interface SubscriptionPatch {
  name?: string
  phone?: string
  startDate?: string | null
  expiryDate?: string | null
  coachName?: string
}

/**
 * يعمل merge بين الـ itemDetails القديم وبيانات الاشتراك الجديدة.
 * - الاسم بيتحط في الـ key اللي موجودة فعلاً في الـ snapshot
 *   (memberName / clientName / name) — مش بنضيف key جديدة.
 * - phone/startDate/expiryDate دايماً نفس الاسم.
 *
 * يرجّع الـ itemDetails الجديد + قائمة الحقول اللي اتغيّرت فعلاً.
 */
function mergeSubscriptionIntoDetails(
  existing: Record<string, any>,
  sub: SubscriptionPatch
): { merged: Record<string, any>; changed: string[]; oldValues: Record<string, any>; newValues: Record<string, any> } {
  const merged: Record<string, any> = { ...existing }
  const changed: string[] = []
  const oldValues: Record<string, any> = {}
  const newValues: Record<string, any> = {}

  if (typeof sub.name === 'string') {
    const newName = sub.name.trim()
    // نستخدم الـ key اللي موجودة فعلاً عشان نحافظ على شكل الـ snapshot
    const nameKey = 'memberName' in existing
      ? 'memberName'
      : 'clientName' in existing
        ? 'clientName'
        : 'name' in existing
          ? 'name'
          : 'memberName' // default للـ membership
    if (merged[nameKey] !== newName) {
      oldValues[nameKey] = merged[nameKey] ?? null
      merged[nameKey] = newName
      newValues[nameKey] = newName
      changed.push(nameKey)
    }
  }

  if (typeof sub.phone === 'string') {
    const newPhone = sub.phone.trim()
    if (merged.phone !== newPhone) {
      oldValues.phone = merged.phone ?? null
      merged.phone = newPhone
      newValues.phone = newPhone
      changed.push('phone')
    }
  }

  if (sub.startDate !== undefined) {
    const newStart = sub.startDate ? new Date(sub.startDate).toISOString() : null
    const currentStart = merged.startDate ? new Date(merged.startDate).toISOString() : null
    if (currentStart !== newStart) {
      oldValues.startDate = currentStart
      merged.startDate = newStart
      newValues.startDate = newStart
      changed.push('startDate')
    }
  }

  if (sub.expiryDate !== undefined) {
    const newExpiry = sub.expiryDate ? new Date(sub.expiryDate).toISOString() : null
    const currentExpiry = merged.expiryDate ? new Date(merged.expiryDate).toISOString() : null
    // membership receipts بتسمّيها newExpiryDate كمان — نـ sync الاتنين لو موجودين
    if (currentExpiry !== newExpiry) {
      oldValues.expiryDate = currentExpiry
      merged.expiryDate = newExpiry
      newValues.expiryDate = newExpiry
      if ('newExpiryDate' in merged) merged.newExpiryDate = newExpiry
      changed.push('expiryDate')
    }
  }

  if (typeof sub.coachName === 'string') {
    const newCoach = sub.coachName.trim()
    if (merged.coachName !== newCoach) {
      oldValues.coachName = merged.coachName ?? null
      merged.coachName = newCoach
      newValues.coachName = newCoach
      changed.push('coachName')
    }
  }

  return { merged, changed, oldValues, newValues }
}

export async function PUT(request: Request) {
  try {
    // ✅ التحقق من صلاحية تعديل الإيصالات
    const user = await requirePermission(request, 'canEditReceipts')

    const {
      receiptId,
      receiptNumber,
      amount,
      paymentMethod,
      itemDetails,
      staffName,
      createdAt,
      subscription,        // 🆕 { name?, phone?, startDate?, expiryDate? }
      cascade,             // 🆕 default true — يعدّل Member/PT المرتبط
    } = await request.json() as {
      receiptId: string
      receiptNumber?: number | string
      amount?: number | string
      paymentMethod?: string
      itemDetails?: Record<string, any>
      staffName?: string
      createdAt?: string
      subscription?: SubscriptionPatch
      cascade?: boolean
    }

    if (!receiptId) {
      return NextResponse.json({ error: 'معرف الإيصال مطلوب' }, { status: 400 })
    }

    // التحقق من وجود الإيصال
    const existingReceipt = await prisma.receipt.findUnique({
      where: { id: receiptId }
    })

    if (!existingReceipt) {
      return NextResponse.json({ error: 'الإيصال غير موجود' }, { status: 404 })
    }

    // التحقق من أن رقم الإيصال الجديد غير مستخدم (إذا تم تغييره)
    if (receiptNumber && Number(receiptNumber) !== existingReceipt.receiptNumber) {
      const duplicateReceipt = await prisma.receipt.findUnique({
        where: { receiptNumber: parseInt(String(receiptNumber)) }
      })

      if (duplicateReceipt) {
        return NextResponse.json({
          error: `رقم الإيصال ${receiptNumber} مستخدم بالفعل`
        }, { status: 400 })
      }
    }

    // ✅ لو في subscription patch وفي cascade، لازم صلاحية canEditMembers كمان
    const wantCascade = subscription && cascade !== false
    if (wantCascade && user.role !== 'OWNER' && user.role !== 'ADMIN') {
      const hasMembersEdit = !!user.permissions?.canEditMembers
      if (!hasMembersEdit) {
        return NextResponse.json(
          { error: 'تعديل بيانات الاشتراك على العضو محتاج صلاحية canEditMembers — إلغِ الـ cascade أو استخدم حساب عنده الصلاحية' },
          { status: 403 }
        )
      }
    }

    // 🧠 بناء itemDetails النهائي
    let finalItemDetails: Record<string, any> | null = null
    let subChanged: string[] = []
    let subOldValues: Record<string, any> = {}
    let subNewValues: Record<string, any> = {}

    if (subscription) {
      // نـ merge على الـ itemDetails القديم (أو الجديد لو متبعّت)
      const base = itemDetails ?? (existingReceipt.itemDetails ? JSON.parse(existingReceipt.itemDetails) : {})
      const result = mergeSubscriptionIntoDetails(base, subscription)
      finalItemDetails = result.merged
      subChanged = result.changed
      subOldValues = result.oldValues
      subNewValues = result.newValues
    } else if (itemDetails) {
      finalItemDetails = itemDetails
    }

    // تحديث الإيصال
    const updatedReceipt = await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        ...(receiptNumber && { receiptNumber: parseInt(String(receiptNumber)) }),
        ...(amount !== undefined && amount !== null && amount !== '' && { amount: parseFloat(String(amount)) }),
        ...(paymentMethod && { paymentMethod }),
        ...(finalItemDetails && { itemDetails: JSON.stringify(finalItemDetails) }),
        ...(staffName !== undefined && { staffName }),
        ...(createdAt && { createdAt: new Date(createdAt) })
      }
    })

    // 🔗 Cascade — لو subscription متبعّت و cascade مش false
    let cascadedTo: 'Member' | 'PT' | null = null
    if (subscription && cascade !== false) {
      try {
        if (existingReceipt.memberId) {
          // Member cascade
          const memberData: any = {}
          if (typeof subscription.name === 'string') memberData.name = subscription.name.trim()
          if (typeof subscription.phone === 'string') memberData.phone = subscription.phone.trim()
          if (subscription.startDate !== undefined) {
            memberData.startDate = subscription.startDate ? new Date(subscription.startDate) : null
          }
          if (subscription.expiryDate !== undefined) {
            memberData.expiryDate = subscription.expiryDate ? new Date(subscription.expiryDate) : null
            // إعادة حساب isActive (نفس قاعدة /api/members/renew)
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const newExpiry = subscription.expiryDate ? new Date(subscription.expiryDate) : null
            if (newExpiry) newExpiry.setHours(0, 0, 0, 0)
            memberData.isActive = !newExpiry || newExpiry >= today
          }

          if (Object.keys(memberData).length > 0) {
            await prisma.member.update({
              where: { id: existingReceipt.memberId },
              data: memberData
            })
            cascadedTo = 'Member'
          }
        } else if (existingReceipt.ptNumber) {
          // PT cascade
          const ptData: any = {}
          if (typeof subscription.name === 'string') ptData.clientName = subscription.name.trim()
          if (typeof subscription.phone === 'string') ptData.phone = subscription.phone.trim()
          if (subscription.startDate !== undefined) {
            ptData.startDate = subscription.startDate ? new Date(subscription.startDate) : null
          }
          if (subscription.expiryDate !== undefined) {
            ptData.expiryDate = subscription.expiryDate ? new Date(subscription.expiryDate) : null
          }
          if (typeof subscription.coachName === 'string') {
            const coachName = subscription.coachName.trim()
            ptData.coachName = coachName
            // ابحث عن coachUserId الجديد بناءً على الاسم
            if (coachName) {
              const coachStaff = await prisma.staff.findFirst({
                where: { name: coachName, isActive: true },
                include: { user: { select: { id: true } } }
              })
              ptData.coachUserId = coachStaff?.user?.id || null
            } else {
              ptData.coachUserId = null
            }
          }
          if (Object.keys(ptData).length > 0) {
            await prisma.pT.update({
              where: { ptNumber: existingReceipt.ptNumber },
              data: ptData
            })
            cascadedTo = 'PT'
          }
        }
        // أنواع تانية (nutrition/physio/groupClass): الـ snapshot بس بيتحدّث
      } catch (cascadeErr: any) {
        console.error('Receipt update cascade failed:', cascadeErr)
        // لو cascade فشل، نـ undo الـ receipt update عشان نفضل consistent
        return NextResponse.json(
          { error: 'فشل تحديث بيانات العضو/PT المرتبط: ' + (cascadeErr?.message || 'خطأ غير معروف') },
          { status: 500 }
        )
      }
    }

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'Receipt', resourceId: updatedReceipt.id,
      details: {
        receiptNumber: updatedReceipt.receiptNumber,
        amount: updatedReceipt.amount,
        ...(subChanged.length > 0 && {
          updatedSubscriptionFields: subChanged,
          oldValues: subOldValues,
          newValues: subNewValues,
        }),
        ...(cascadedTo && { cascadedTo }),
      },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json({
      success: true,
      receipt: updatedReceipt,
      cascadedTo,
      updatedSubscriptionFields: subChanged,
      message: 'تم تحديث الإيصال بنجاح'
    })
  } catch (error: any) {
    console.error('Error updating receipt:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تعديل الإيصالات' },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { error: 'فشل تحديث الإيصال' },
      { status: 500 }
    )
  }
}

// حذف إيصال
export async function DELETE(request: Request) {
  try {
    // ✅ التحقق من صلاحية حذف الإيصالات
    const user = await requirePermission(request, 'canDeleteReceipts')
    
    const { searchParams } = new URL(request.url)
    const receiptId = searchParams.get('id')

    if (!receiptId) {
      return NextResponse.json({ error: 'معرف الإيصال مطلوب' }, { status: 400 })
    }

    // التحقق من وجود الإيصال
    const existingReceipt = await prisma.receipt.findUnique({
      where: { id: receiptId }
    })

    if (!existingReceipt) {
      return NextResponse.json({ error: 'الإيصال غير موجود' }, { status: 404 })
    }

    // حذف الإيصال
    await prisma.receipt.delete({
      where: { id: receiptId }
    })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'DELETE', resource: 'Receipt', resourceId: receiptId,
      details: { receiptNumber: existingReceipt.receiptNumber, amount: existingReceipt.amount, type: existingReceipt.type },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json({
      success: true,
      message: 'تم حذف الإيصال بنجاح'
    })
  } catch (error: any) {
    console.error('Error deleting receipt:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية حذف الإيصالات' },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { error: 'فشل حذف الإيصال' },
      { status: 500 }
    )
  }
}
// app/api/members/transfer/route.ts
// نقل عضوية: تحويل الأيام المتبقية من عضو لعضو تاني (موجود أو جديد)
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import {
  type PaymentMethod,
  validatePaymentDistribution,
  serializePaymentMethods
} from '../../../../lib/paymentHelpers'
import { processPaymentWithPoints } from '../../../../lib/paymentProcessor'
import { RECEIPT_TYPES } from '../../../../lib/receiptTypes'
import { getNextReceiptNumberDirect } from '../../../../lib/receiptHelpers'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'
import { logError } from '../../../../lib/errorLogger'

export const dynamic = 'force-dynamic'

interface NewMemberPayload {
  name: string
  phone: string
  memberNumber?: string | null
  profileImage?: string | null
  idCardFront?: string | null
  idCardBack?: string | null
  notes?: string | null
}

function calcRemainingDays(expiryDate: Date | null | undefined): number {
  if (!expiryDate) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)
  const diffMs = expiry.getTime() - today.getTime()
  if (diffMs <= 0) return 0
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

export async function POST(request: Request) {
  try {
    // ✅ نفس صلاحية إضافة عضو (canCreateMembers) — لمطابقة الـ button gate في الفرونت
    //   - OWNER/ADMIN يعدّوا تلقائياً
    //   - أي حد عنده canCreateMembers يقدر يعمل نقل
    //   - الباقي بيترفض (الكوتش العادي غالباً مش عنده الصلاحية فبيترفض هنا أوتوماتيك)
    const user = await requirePermission(request, 'canCreateMembers')

    const body = await request.json()
    const {
      fromMemberId,
      mode,                 // 'existing' | 'new'
      toMemberId,           // مطلوب لو mode='existing'
      newMember,            // مطلوب لو mode='new'
      transferFee,
      paymentMethod,
      staffName,
    }: {
      fromMemberId: string
      mode: 'existing' | 'new'
      toMemberId?: string
      newMember?: NewMemberPayload
      transferFee: number
      paymentMethod: string | PaymentMethod[]
      staffName?: string
    } = body

    if (!fromMemberId) {
      return NextResponse.json({ error: 'العضو المصدر مطلوب' }, { status: 400 })
    }
    if (mode !== 'existing' && mode !== 'new') {
      return NextResponse.json({ error: 'نوع النقل غير صالح' }, { status: 400 })
    }
    if (typeof transferFee !== 'number' || transferFee < 0) {
      return NextResponse.json({ error: 'سعر النقل غير صالح' }, { status: 400 })
    }

    // العضو المصدر
    const fromMember = await prisma.member.findUnique({
      where: { id: fromMemberId },
      include: { salesStaff: { select: { name: true } } }
    })
    if (!fromMember) {
      return NextResponse.json({ error: 'العضو المصدر غير موجود' }, { status: 404 })
    }
    if (fromMember.isBanned) {
      return NextResponse.json({ error: 'العضو محظور — لا يمكن نقل العضوية' }, { status: 403 })
    }

    const remainingDays = calcRemainingDays(fromMember.expiryDate as any)
    if (remainingDays <= 0) {
      return NextResponse.json({ error: 'لا توجد أيام متبقية في الاشتراك لنقلها' }, { status: 400 })
    }

    // معالجة الـ recipient
    let toMember: any = null
    const identityChanged = mode === 'new'

    if (mode === 'existing') {
      if (!toMemberId) {
        return NextResponse.json({ error: 'العضو المستلم مطلوب' }, { status: 400 })
      }
      if (toMemberId === fromMemberId) {
        return NextResponse.json({ error: 'لا يمكن نقل العضوية لنفس العضو' }, { status: 400 })
      }
      toMember = await prisma.member.findUnique({ where: { id: toMemberId } })
      if (!toMember) {
        return NextResponse.json({ error: 'العضو المستلم غير موجود' }, { status: 404 })
      }
      if (toMember.isBanned) {
        return NextResponse.json({ error: 'العضو المستلم محظور' }, { status: 403 })
      }
    } else {
      // mode === 'new'
      // mode='new' = تغيير ملكية على نفس الـ record (نفس الـ id والـ memberNumber)
      // العميل الجديد بياخد الاسم/التليفون/الصورة بس
      if (!newMember?.name?.trim() || !newMember?.phone?.trim()) {
        return NextResponse.json({ error: 'اسم ورقم العضو الجديد مطلوبين' }, { status: 400 })
      }
      const phoneRegex = /^(010|011|012|015)[0-9]{8}$/
      if (!phoneRegex.test(newMember.phone.trim())) {
        return NextResponse.json({ error: 'رقم الهاتف غير صحيح' }, { status: 400 })
      }
      // التحقق من التليفون — يستثني نفس الـ source member
      const dup = await prisma.member.findFirst({
        where: { phone: newMember.phone.trim(), id: { not: fromMemberId } },
        select: { id: true, name: true, memberNumber: true }
      })
      if (dup) {
        return NextResponse.json(
          { error: `رقم الهاتف مستخدم بالفعل للعضو ${dup.name} (#${dup.memberNumber || 'Other'})` },
          { status: 400 }
        )
      }
    }

    // تجهيز الدفع
    let finalPaymentMethod: string
    if (Array.isArray(paymentMethod)) {
      const validation = validatePaymentDistribution(paymentMethod, transferFee)
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.message || 'توزيع المبالغ غير صحيح' },
          { status: 400 }
        )
      }
      finalPaymentMethod = serializePaymentMethods(paymentMethod)
    } else {
      finalPaymentMethod = paymentMethod || 'cash'
    }

    const safeStaffName = (staffName || user.name || '').trim()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // التواريخ الجديدة للـ recipient
    // ملاحظة: في mode='new' (تغيير ملكية) الـ subscription بيفضل زي ما هو على نفس الـ record،
    // فمحتاجين الـ dates دي بس للـ existing mode.
    let toNewStartDate: Date | null = null
    let toNewExpiryDate: Date | null = null

    if (mode === 'existing') {
      // لو عنده اشتراك نشط (expiry في المستقبل) نمدّ منه؛ غير كده نبدأ من النهاردة
      const currentExpiry = toMember.expiryDate ? new Date(toMember.expiryDate) : null
      if (currentExpiry) currentExpiry.setHours(0, 0, 0, 0)
      const baseDate = currentExpiry && currentExpiry > today ? currentExpiry : today
      toNewStartDate = toMember.startDate ? new Date(toMember.startDate) : today
      toNewExpiryDate = new Date(baseDate)
      toNewExpiryDate.setDate(toNewExpiryDate.getDate() + remainingDays)
    }

    let receipt: any
    let resultRecipient: any

    try {
      const receiptNumber = await getNextReceiptNumberDirect(prisma)

      const txResult = await prisma.$transaction(async (tx) => {
        if (mode === 'existing') {
          // 1) تصفير المصدر — expiryDate = today، isActive = false، نوتة بالتحويل
          const transferNote = `\n[نقل عضوية → ${toMember!.name} (#${toMember!.memberNumber || 'Other'}) في ${today.toISOString().slice(0, 10)} — ${remainingDays} يوم]`

          await tx.member.update({
            where: { id: fromMember.id },
            data: {
              expiryDate: today,
              isActive: false,
              notes: (fromMember.notes || '') + transferNote,
            }
          })

          // 2) المستلم — مدّ الـ expiryDate
          resultRecipient = await tx.member.update({
            where: { id: toMember!.id },
            data: {
              expiryDate: toNewExpiryDate!,
              isActive: true,
              //  📤 نربط المستلم بالعضو المصدر عشان يظهر كلينك في البروفايل
              transferredFromMemberId: fromMember.id,
              transferredFromAt: today,
              transferredFromPhone: fromMember.phone, // 📤 الرقم القديم للـ timeline
              notes: (toMember!.notes || '') +
                `\n[تم استلام نقل عضوية من ${fromMember.name} (#${fromMember.memberNumber || 'Other'}) — ${remainingDays} يوم]`
            } as any
          })
        } else {
          // mode='new' — تغيير ملكية على نفس الـ record
          // الـ id والـ memberNumber والـ expiryDate وكل الـ sessions/idCard/nationalId... كلها بتفضل زي ما هي
          // اللي بيتغير: name + phone + profileImage فقط + نوتة بالتغيير
          const identityNote = `\n[تغيير ملكية العضوية: ${fromMember.name} (${fromMember.phone}) → ${newMember!.name.trim()} (${newMember!.phone.trim()}) في ${today.toISOString().slice(0, 10)}]`

          resultRecipient = await tx.member.update({
            where: { id: fromMember.id },
            data: {
              name: newMember!.name.trim(),
              phone: newMember!.phone.trim(),
              profileImage: newMember!.profileImage || null,
              notes: (fromMember.notes || '') + identityNote,
              transferredFromPhone: fromMember.phone, // 📤 الرقم القديم قبل تغيير الملكية
              transferredFromAt: today,
            } as any
          })
          // مش بنعمل Member جديد، فالـ counter ميتغيرش
        }

        // 3) إيصال نقل العضوية — مرتبط بالعضو المصدر عشان يظهر في سجل إيصالاته
        const itemDetails = mode === 'existing'
          ? {
              kind: 'membershipTransfer' as const,
              fromMember: {
                id: fromMember.id,
                name: fromMember.name,
                memberNumber: fromMember.memberNumber,
                phone: fromMember.phone,
              },
              toMember: {
                id: toMember!.id,
                name: toMember!.name,
                memberNumber: toMember!.memberNumber,
                phone: toMember!.phone,
                isNew: false,
              },
              transferredDays: remainingDays,
              fromPreviousExpiryDate: fromMember.expiryDate,
              toNewExpiryDate,
              transferFee,
              staffName: safeStaffName,
              salesPersonName: fromMember.salesStaff?.name || null,
              // مفاتيح متوافقة مع الـ printable عشان يلاقي اسم/رقم/تليفون العميل في الأعلى
              memberName: toMember!.name,
              memberNumber: toMember!.memberNumber,
              phone: toMember!.phone,
            }
          : {
              kind: 'membershipTransferIdentity' as const,
              previousOwner: {
                name: fromMember.name,
                phone: fromMember.phone,
                profileImage: fromMember.profileImage || null,
              },
              newOwner: {
                name: newMember!.name.trim(),
                phone: newMember!.phone.trim(),
                profileImage: newMember!.profileImage || null,
              },
              memberId: fromMember.id,
              remainingDays,
              expiryDate: fromMember.expiryDate,
              transferFee,
              staffName: safeStaffName,
              salesPersonName: fromMember.salesStaff?.name || null,
              // مفاتيح متوافقة مع الـ printable
              memberName: newMember!.name.trim(),
              memberNumber: fromMember.memberNumber,
              phone: newMember!.phone.trim(),
            }

        const r = await tx.receipt.create({
          data: {
            receiptNumber,
            type: RECEIPT_TYPES.MEMBERSHIP_TRANSFER,
            amount: transferFee,
            paymentMethod: finalPaymentMethod,
            staffName: safeStaffName,
            itemDetails: JSON.stringify(itemDetails),
            memberId: fromMember.id,
          },
        })

        // 4) خصم النقاط لو في
        const pr = await processPaymentWithPoints(
          fromMember.id,
          fromMember.phone,
          fromMember.memberNumber,
          finalPaymentMethod,
          `دفع رسوم نقل عضوية - ${fromMember.name}`,
          tx
        )
        if (!pr.success) {
          const e: any = new Error(pr.message || 'فشل خصم النقاط')
          e.code = 'POINTS_FAILED'
          e.userMessage = pr.message
          throw e
        }

        return { receipt: r, recipient: resultRecipient }
      })

      receipt = txResult.receipt
      resultRecipient = txResult.recipient
    } catch (txErr: any) {
      if (txErr?.code === 'POINTS_FAILED') {
        return NextResponse.json({ error: txErr.userMessage || 'فشل خصم النقاط' }, { status: 400 })
      }
      console.error('❌ خطأ في نقل العضوية:', txErr)
      logError({
        error: txErr,
        endpoint: '/api/members/transfer',
        method: 'POST',
        statusCode: 500,
        additionalContext: { fromMemberId, mode }
      })
      return NextResponse.json({ error: 'فشل نقل العضوية' }, { status: 500 })
    }

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'Member', resourceId: fromMember.id,
      details: identityChanged
        ? {
            operation: 'TransferIdentity',
            memberId: fromMember.id,
            memberNumber: fromMember.memberNumber,
            previousOwner: { name: fromMember.name, phone: fromMember.phone },
            newOwner: { name: resultRecipient.name, phone: resultRecipient.phone },
            remainingDays,
            transferFee,
            receiptNumber: receipt.receiptNumber,
          }
        : {
            operation: 'Transfer',
            fromMember: { id: fromMember.id, memberNumber: fromMember.memberNumber, name: fromMember.name },
            toMember: { id: resultRecipient.id, memberNumber: resultRecipient.memberNumber, name: resultRecipient.name, isNew: false },
            transferredDays: remainingDays,
            transferFee,
            receiptNumber: receipt.receiptNumber,
          },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json({
      success: true,
      transferredDays: remainingDays,
      fromMemberId: fromMember.id,
      recipient: {
        id: resultRecipient.id,
        name: resultRecipient.name,
        memberNumber: resultRecipient.memberNumber,
        phone: resultRecipient.phone,
        expiryDate: resultRecipient.expiryDate,
        isNew: false,
        identityUpdated: identityChanged,
      },
      receipt: {
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        amount: receipt.amount,
        paymentMethod: receipt.paymentMethod,
        staffName: receipt.staffName,
        itemDetails: JSON.parse(receipt.itemDetails),
        createdAt: receipt.createdAt,
      },
    }, { status: 200 })

  } catch (error: any) {
    console.error('❌ خطأ غير متوقع في نقل العضوية:', error)
    logError({ error, endpoint: '/api/members/transfer', method: 'POST', statusCode: 500 })
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (typeof error?.message === 'string' && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية نقل العضويات' }, { status: 403 })
    }
    return NextResponse.json({ error: 'فشل نقل العضوية' }, { status: 500 })
  }
}

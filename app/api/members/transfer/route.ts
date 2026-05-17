// app/api/members/transfer/route.ts
// نقل عضوية: تحويل الأيام المتبقية من عضو لعضو تاني (موجود أو جديد)
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'
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
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (user.role === 'COACH') {
      return NextResponse.json({ error: 'الكوتش غير مسموح له بنقل العضويات' }, { status: 403 })
    }

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
    let createdNewMember = false

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
      if (!newMember?.name?.trim() || !newMember?.phone?.trim()) {
        return NextResponse.json({ error: 'اسم ورقم العضو الجديد مطلوبين' }, { status: 400 })
      }
      const phoneRegex = /^(010|011|012|015)[0-9]{8}$/
      if (!phoneRegex.test(newMember.phone.trim())) {
        return NextResponse.json({ error: 'رقم الهاتف غير صحيح' }, { status: 400 })
      }
      if (!newMember.memberNumber || !String(newMember.memberNumber).trim()) {
        return NextResponse.json({ error: 'رقم العضوية مطلوب' }, { status: 400 })
      }
      const dup = await prisma.member.findFirst({
        where: { phone: newMember.phone.trim() },
        select: { id: true, name: true, memberNumber: true }
      })
      if (dup) {
        return NextResponse.json(
          { error: `رقم الهاتف مستخدم بالفعل للعضو ${dup.name} (#${dup.memberNumber || 'Other'})` },
          { status: 400 }
        )
      }
      const numberDup = await prisma.member.findUnique({
        where: { memberNumber: String(newMember.memberNumber).trim() }
      })
      if (numberDup) {
        return NextResponse.json(
          { error: `رقم العضوية ${newMember.memberNumber} مستخدم بالفعل` },
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
    let toNewStartDate: Date
    let toNewExpiryDate: Date

    if (mode === 'existing') {
      // لو عنده اشتراك نشط (expiry في المستقبل) نمدّ منه؛ غير كده نبدأ من النهاردة
      const currentExpiry = toMember.expiryDate ? new Date(toMember.expiryDate) : null
      if (currentExpiry) currentExpiry.setHours(0, 0, 0, 0)
      const baseDate = currentExpiry && currentExpiry > today ? currentExpiry : today
      toNewStartDate = toMember.startDate ? new Date(toMember.startDate) : today
      toNewExpiryDate = new Date(baseDate)
      toNewExpiryDate.setDate(toNewExpiryDate.getDate() + remainingDays)
    } else {
      toNewStartDate = today
      toNewExpiryDate = new Date(today)
      toNewExpiryDate.setDate(toNewExpiryDate.getDate() + remainingDays)
    }

    let receipt: any
    let resultRecipient: any

    try {
      const receiptNumber = await getNextReceiptNumberDirect(prisma)

      const txResult = await prisma.$transaction(async (tx) => {
        // 1) تصفير المصدر — expiryDate = today، isActive = false، نوتة بالتحويل
        const transferNote = mode === 'existing'
          ? `\n[نقل عضوية → ${toMember!.name} (#${toMember!.memberNumber || 'Other'}) في ${today.toISOString().slice(0, 10)} — ${remainingDays} يوم]`
          : `\n[نقل عضوية → ${newMember!.name} (${newMember!.phone}) في ${today.toISOString().slice(0, 10)} — ${remainingDays} يوم]`

        await tx.member.update({
          where: { id: fromMember.id },
          data: {
            expiryDate: today,
            isActive: false,
            notes: (fromMember.notes || '') + transferNote,
          }
        })

        // 2) المستلم
        if (mode === 'existing') {
          resultRecipient = await tx.member.update({
            where: { id: toMember!.id },
            data: {
              expiryDate: toNewExpiryDate,
              isActive: true,
              notes: (toMember!.notes || '') +
                `\n[تم استلام نقل عضوية من ${fromMember.name} (#${fromMember.memberNumber || 'Other'}) — ${remainingDays} يوم]`
            }
          })
        } else {
          // إنشاء عضو جديد بالأيام المنقولة
          resultRecipient = await tx.member.create({
            data: {
              memberNumber: String(newMember!.memberNumber).trim(),
              name: newMember!.name.trim(),
              phone: newMember!.phone.trim(),
              profileImage: newMember!.profileImage || null,
              idCardFront: newMember!.idCardFront || null,
              idCardBack: newMember!.idCardBack || null,
              subscriptionPrice: Math.max(0, Math.round(transferFee)),
              remainingAmount: 0,
              startDate: toNewStartDate,
              expiryDate: toNewExpiryDate,
              isActive: true,
              notes: (newMember!.notes || '') +
                `\n[تم استلام نقل عضوية من ${fromMember.name} (#${fromMember.memberNumber || 'Other'}) — ${remainingDays} يوم]`,
              salesStaffId: fromMember.salesStaffId || null,
            }
          })
          createdNewMember = true

          // تحديث الـ counter بناءً على الرقم اللي اتعمل
          const num = parseInt(String(newMember!.memberNumber).trim(), 10)
          if (!isNaN(num)) {
            const counter = await tx.memberCounter.findUnique({ where: { id: 1 } })
            if (!counter) {
              await tx.memberCounter.create({ data: { id: 1, current: num + 1 } })
            } else if (num >= counter.current) {
              await tx.memberCounter.update({ where: { id: 1 }, data: { current: num + 1 } })
            }
          }
        }

        // 3) إيصال نقل العضوية — مرتبط بالعضو المصدر عشان يظهر في سجل إيصالاته
        const r = await tx.receipt.create({
          data: {
            receiptNumber,
            type: RECEIPT_TYPES.MEMBERSHIP_TRANSFER,
            amount: transferFee,
            paymentMethod: finalPaymentMethod,
            staffName: safeStaffName,
            itemDetails: JSON.stringify({
              kind: 'membershipTransfer',
              fromMember: {
                id: fromMember.id,
                name: fromMember.name,
                memberNumber: fromMember.memberNumber,
                phone: fromMember.phone,
              },
              toMember: mode === 'existing'
                ? {
                    id: toMember!.id,
                    name: toMember!.name,
                    memberNumber: toMember!.memberNumber,
                    phone: toMember!.phone,
                    isNew: false,
                  }
                : {
                    id: resultRecipient.id,
                    name: resultRecipient.name,
                    memberNumber: resultRecipient.memberNumber,
                    phone: resultRecipient.phone,
                    isNew: true,
                  },
              transferredDays: remainingDays,
              fromPreviousExpiryDate: fromMember.expiryDate,
              toNewExpiryDate,
              transferFee,
              staffName: safeStaffName,
              salesPersonName: fromMember.salesStaff?.name || null,
            }),
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
      details: {
        operation: 'Transfer',
        fromMember: { id: fromMember.id, memberNumber: fromMember.memberNumber, name: fromMember.name },
        toMember: { id: resultRecipient.id, memberNumber: resultRecipient.memberNumber, name: resultRecipient.name, isNew: createdNewMember },
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
        isNew: createdNewMember,
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
    return NextResponse.json({ error: 'فشل نقل العضوية' }, { status: 500 })
  }
}

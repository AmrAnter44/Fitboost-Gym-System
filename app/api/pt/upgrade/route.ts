// app/api/pt/upgrade/route.ts
// ترقية باقة PT — gated بـ SystemSettings.ptUpgradeEnabled
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
import { getNextReceiptNumber } from '../../../../lib/receiptHelpers'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

export const dynamic = 'force-dynamic'

async function ensurePTUpgradeEnabled() {
  const settings = await prisma.systemSettings.findUnique({
    where: { id: 'singleton' },
    select: { ptUpgradeEnabled: true } as any
  })
  return !!(settings as any)?.ptUpgradeEnabled
}

export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (user.role === 'COACH') {
      return NextResponse.json({ error: 'الكوتش غير مسموح له بترقية الباقات' }, { status: 403 })
    }

    const enabled = await ensurePTUpgradeEnabled()
    if (!enabled) {
      return NextResponse.json({ error: 'فيتشر ترقية PT غير مفعّل في الإعدادات' }, { status: 403 })
    }

    const body = await request.json()
    const {
      ptNumber,
      newPackageId,
      paymentMethod,
      staffName,
      customPrice,   // optional — تخصيص فرق السعر
    }: {
      ptNumber: number | string
      newPackageId: string
      paymentMethod: string | PaymentMethod[]
      staffName?: string
      customPrice?: number
    } = body

    const ptNum = parseInt(String(ptNumber), 10)
    if (!ptNum || isNaN(ptNum)) {
      return NextResponse.json({ error: 'رقم PT مطلوب' }, { status: 400 })
    }
    if (!newPackageId) {
      return NextResponse.json({ error: 'الباقة الجديدة مطلوبة' }, { status: 400 })
    }

    const pt = await prisma.pT.findUnique({ where: { ptNumber: ptNum } })
    if (!pt) {
      return NextResponse.json({ error: 'اشتراك PT غير موجود' }, { status: 404 })
    }

    const newPackage = await prisma.servicePackage.findUnique({
      where: { id: newPackageId }
    })
    if (!newPackage || newPackage.serviceType !== 'PT' || !newPackage.isActive) {
      return NextResponse.json({ error: 'الباقة الجديدة غير صالحة' }, { status: 400 })
    }

    // 💰 حساب فرق السعر
    const currentPricePerSession = pt.pricePerSession || 0
    const remainingSessions = pt.sessionsRemaining || 0
    const currentRemainingValue = currentPricePerSession * remainingSessions
    const computedUpgradeFee = Math.max(0, Math.round(newPackage.price - currentRemainingValue))
    const finalUpgradeFee = typeof customPrice === 'number' && !isNaN(customPrice) && customPrice >= 0
      ? Math.round(customPrice)
      : computedUpgradeFee

    // 📅 التواريخ — البداية من النهاردة، النهاية = بداية + duration
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const newExpiry = new Date(today)
    newExpiry.setDate(newExpiry.getDate() + (newPackage.durationDays || 30))

    const newPricePerSession = newPackage.sessions > 0
      ? Math.round((newPackage.price / newPackage.sessions) * 100) / 100
      : 0

    // الدفع
    let finalPaymentMethod: string
    if (Array.isArray(paymentMethod)) {
      const validation = validatePaymentDistribution(paymentMethod, finalUpgradeFee)
      if (!validation.valid) {
        return NextResponse.json({ error: validation.message || 'توزيع المبالغ غير صحيح' }, { status: 400 })
      }
      finalPaymentMethod = serializePaymentMethods(paymentMethod)
    } else {
      finalPaymentMethod = paymentMethod || 'cash'
    }

    const safeStaffName = (staffName || user.name || '').trim()

    let receipt: any
    let updatedPT: any

    try {
      const result = await prisma.$transaction(async (tx) => {
        // تحديث الـ PT
        const upd = await tx.pT.update({
          where: { ptNumber: ptNum },
          data: {
            sessionsPurchased: newPackage.sessions,
            sessionsRemaining: newPackage.sessions,
            pricePerSession: newPricePerSession,
            startDate: today,
            expiryDate: newExpiry,
            isFrozen: false,
            freezeUntil: null,
            remainingAmount: 0,
          } as any
        })

        const rNumber = await getNextReceiptNumber(tx)

        const r = await tx.receipt.create({
          data: {
            receiptNumber: rNumber,
            type: RECEIPT_TYPES.PT_RENEWAL, // نفس نوع تجديد PT (الترقية = تجديد بسعر مختلف)
            amount: finalUpgradeFee,
            paymentMethod: finalPaymentMethod,
            staffName: safeStaffName,
            itemDetails: JSON.stringify({
              kind: 'ptUpgrade',
              ptNumber: ptNum,
              clientName: pt.clientName,
              phone: pt.phone,
              coachName: pt.coachName,
              previous: {
                sessionsPurchased: pt.sessionsPurchased,
                sessionsRemaining: pt.sessionsRemaining,
                pricePerSession: currentPricePerSession,
                remainingValue: currentRemainingValue,
                startDate: pt.startDate,
                expiryDate: pt.expiryDate,
              },
              newPackage: {
                id: newPackage.id,
                name: newPackage.name,
                sessions: newPackage.sessions,
                price: newPackage.price,
                durationDays: newPackage.durationDays,
              },
              newPricePerSession,
              newStartDate: today,
              newExpiryDate: newExpiry,
              computedUpgradeFee,
              upgradeFee: finalUpgradeFee,
              customPriceUsed: typeof customPrice === 'number' && customPrice !== computedUpgradeFee,
              staffName: safeStaffName,
            }),
            ptNumber: ptNum,
          },
        })

        const pointsResult = await processPaymentWithPoints(
          null,
          pt.phone,
          null,
          finalPaymentMethod,
          `دفع ترقية باقة PT - ${pt.clientName}`,
          tx
        )
        if (!pointsResult.success) {
          const e: any = new Error(pointsResult.message || 'فشل خصم النقاط')
          e.code = 'POINTS_FAILED'
          throw e
        }

        return { pt: upd, receipt: r }
      })

      updatedPT = result.pt
      receipt = result.receipt
    } catch (txErr: any) {
      if (txErr?.code === 'POINTS_FAILED') {
        return NextResponse.json({ error: txErr.message || 'فشل خصم النقاط' }, { status: 400 })
      }
      console.error('PT upgrade tx error:', txErr)
      return NextResponse.json({ error: 'فشل ترقية الباقة' }, { status: 500 })
    }

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'PT', resourceId: String(ptNum),
      details: {
        operation: 'Upgrade',
        ptNumber: ptNum,
        clientName: pt.clientName,
        newPackageId: newPackage.id,
        newPackageName: newPackage.name,
        upgradeFee: finalUpgradeFee,
        receiptNumber: receipt.receiptNumber,
      },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json({
      success: true,
      pt: updatedPT,
      upgradeFee: finalUpgradeFee,
      computedUpgradeFee,
      remainingValueFromPrevious: currentRemainingValue,
      receipt: {
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        amount: receipt.amount,
        paymentMethod: receipt.paymentMethod,
        staffName: receipt.staffName,
        itemDetails: JSON.parse(receipt.itemDetails),
        createdAt: receipt.createdAt,
      },
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (error?.message?.includes('Forbidden')) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    console.error('PT upgrade error:', error)
    return NextResponse.json({ error: 'فشل ترقية الباقة' }, { status: 500 })
  }
}

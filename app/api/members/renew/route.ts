// app/api/members/renew/route.ts - مع إضافة staffName والصلاحيات
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import { requireValidLicense } from '../../../../lib/license'
import {

export const dynamic = 'force-dynamic'

  type PaymentMethod,
  validatePaymentDistribution,
  serializePaymentMethods
} from '../../../../lib/paymentHelpers'

// 🔧 دالة للبحث عن رقم إيصال متاح
async function getNextAvailableReceiptNumber(startingNumber: number): Promise<number> {
  let currentNumber = startingNumber
  let attempts = 0
  const MAX_ATTEMPTS = 100
  
  while (attempts < MAX_ATTEMPTS) {
    const existingReceipt = await prisma.receipt.findUnique({
      where: { receiptNumber: currentNumber }
    })
    
    if (!existingReceipt) {
      console.log(`✅ رقم إيصال متاح: ${currentNumber}`)
      return currentNumber
    }
    
    console.log(`⚠️ رقم ${currentNumber} موجود، تجربة ${currentNumber + 1}...`)
    currentNumber++
    attempts++
  }
  
  throw new Error(`فشل إيجاد رقم إيصال متاح بعد ${MAX_ATTEMPTS} محاولة`)
}

// POST - تجديد اشتراك عضو
export async function POST(request: Request) {
  try {
    // ✅ التحقق من صلاحية تعديل الأعضاء
    await requirePermission(request, 'canEditMembers')
    
    const body = await request.json()
    const {
      memberId,
      subscriptionPrice,
      remainingAmount,
      freePTSessions,
      inBodyScans,
      invitations,
      remainingFreezeDays,
      startDate,
      expiryDate,
      notes,
      paymentMethod,
      staffName
    } = body

    console.log('🔄 تجديد اشتراك عضو:', { 
      memberId, 
      subscriptionPrice, 
      freePTSessions, 
      inBodyScans, 
      invitations, 
      startDate, 
      expiryDate, 
      paymentMethod,
      staffName
    })

    // جلب بيانات العضو
    const member = await prisma.member.findUnique({
      where: { id: memberId }
    })

    if (!member) {
      return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })
    }

    // حساب حصص PT الجديدة (الحالية + الإضافية)
    const currentFreePT = member.freePTSessions || 0
    const additionalFreePT = freePTSessions || 0
    const totalFreePT = currentFreePT + additionalFreePT

    // حساب InBody الجديد (الحالي + الإضافي)
    const currentInBody = member.inBodyScans || 0
    const additionalInBody = inBodyScans || 0
    const totalInBody = currentInBody + additionalInBody

    // حساب Invitations الجديد (الحالي + الإضافي)
    const currentInvitations = member.invitations || 0
    const additionalInvitations = invitations || 0
    const totalInvitations = currentInvitations + additionalInvitations

    // حساب Freeze Days الجديد (الحالي + الإضافي)
    const currentFreezeDays = member.remainingFreezeDays || 0
    const additionalFreezeDays = remainingFreezeDays || 0
    const totalFreezeDays = currentFreezeDays + additionalFreezeDays

    console.log('💪 حصص PT: الحالية =', currentFreePT, '+ الإضافية =', additionalFreePT, '= الإجمالي =', totalFreePT)
    console.log('⚖️ InBody: الحالي =', currentInBody, '+ الإضافي =', additionalInBody, '= الإجمالي =', totalInBody)
    console.log('🎟️ Invitations: الحالية =', currentInvitations, '+ الإضافية =', additionalInvitations, '= الإجمالي =', totalInvitations)
    console.log('❄️ Freeze Days: الحالية =', currentFreezeDays, '+ الإضافية =', additionalFreezeDays, '= الإجمالي =', totalFreezeDays)

    // تحديث بيانات العضو
    const updatedMember = await prisma.member.update({
      where: { id: memberId },
      data: {
        subscriptionPrice,
        remainingAmount: remainingAmount || 0,
        freePTSessions: totalFreePT,
        inBodyScans: totalInBody,
        invitations: totalInvitations,
        remainingFreezeDays: totalFreezeDays,
        startDate: startDate ? new Date(startDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        isActive: true,
        notes: notes || member.notes,
      },
    })

    console.log('✅ تم تحديث بيانات العضو - PT:', updatedMember.freePTSessions, 'InBody:', updatedMember.inBodyScans, 'Invitations:', updatedMember.invitations)

    // إنشاء إيصال التجديد
    try {
      let counter = await prisma.receiptCounter.findUnique({ where: { id: 1 } })
      
      if (!counter) {
        counter = await prisma.receiptCounter.create({
          data: { id: 1, current: 1000 }
        })
      }

      console.log('🧾 رقم الإيصال من العداد:', counter.current)

      // ✅ البحث عن رقم إيصال متاح
      const availableReceiptNumber = await getNextAvailableReceiptNumber(counter.current)
      
      console.log('✅ سيتم استخدام رقم الإيصال:', availableReceiptNumber)

      const paidAmount = subscriptionPrice - (remainingAmount || 0)

      // حساب مدة الاشتراك
      let subscriptionDays = null
      if (startDate && expiryDate) {
        const start = new Date(startDate)
        const end = new Date(expiryDate)
        subscriptionDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      }

      // 🔒 License validation check
      await requireValidLicense()

      // ✅ معالجة وسائل الدفع المتعددة
      let finalPaymentMethod: string
      if (Array.isArray(paymentMethod)) {
        const validation = validatePaymentDistribution(paymentMethod, paidAmount)
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

      const receipt = await prisma.receipt.create({
        data: {
          receiptNumber: availableReceiptNumber,
          type: 'تجديد عضويه',
          amount: paidAmount,
          paymentMethod: finalPaymentMethod,
          staffName: staffName.trim(),
          itemDetails: JSON.stringify({
            memberNumber: member.memberNumber,
            memberName: member.name,
            phone: member.phone,
            subscriptionPrice,
            paidAmount,
            remainingAmount: remainingAmount || 0,
            // حصص PT في الإيصال
            freePTSessions: additionalFreePT,
            previousFreePTSessions: currentFreePT,
            totalFreePTSessions: totalFreePT,
            // InBody في الإيصال
            inBodyScans: additionalInBody,
            previousInBodyScans: currentInBody,
            totalInBodyScans: totalInBody,
            // Invitations في الإيصال
            invitations: additionalInvitations,
            previousInvitations: currentInvitations,
            totalInvitations: totalInvitations,
            // Freeze Days في الإيصال
            remainingFreezeDays: additionalFreezeDays,
            previousFreezeDays: currentFreezeDays,
            totalFreezeDays: totalFreezeDays,
            // التواريخ
            previousExpiryDate: member.expiryDate,
            newStartDate: startDate,
            newExpiryDate: expiryDate,
            subscriptionDays: subscriptionDays,
            isRenewal: true,
            staffName: staffName.trim(),
          }),
          memberId: member.id,
        },
      })

      console.log('✅ تم إنشاء إيصال التجديد:', receipt.receiptNumber)

      // ✅ تحديث العداد للرقم بعد الرقم المستخدم
      const newCounterValue = availableReceiptNumber + 1
      await prisma.receiptCounter.update({
        where: { id: 1 },
        data: { current: newCounterValue }
      })

      console.log('🔄 تم تحديث عداد الإيصالات إلى:', newCounterValue)

      return NextResponse.json({
        member: updatedMember,
        receipt: {
          receiptNumber: receipt.receiptNumber,
          amount: receipt.amount,
          paymentMethod: receipt.paymentMethod,
          staffName: receipt.staffName,
          itemDetails: JSON.parse(receipt.itemDetails),
          createdAt: receipt.createdAt
        }
      }, { status: 200 })

    } catch (receiptError) {
      console.error('❌ خطأ في إنشاء إيصال التجديد:', receiptError)
      return NextResponse.json({
        member: updatedMember,
        receipt: null,
        warning: 'تم التجديد لكن فشل إنشاء الإيصال'
      }, { status: 200 })
    }

  } catch (error: any) {
    console.error('❌ خطأ في تجديد الاشتراك:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تجديد الاشتراكات' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({ 
      error: 'فشل تجديد الاشتراك' 
    }, { status: 500 })
  }
}
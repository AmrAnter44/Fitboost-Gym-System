// app/api/members/route.ts - مع فحص الصلاحيات
import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'
import {
  type PaymentMethod,
  validatePaymentDistribution,
  serializePaymentMethods
} from '../../../lib/paymentHelpers'
import { logError } from '../../../lib/errorLogger'
import { processPaymentWithPoints } from '../../../lib/paymentProcessor'
import { addPointsForPayment, addPoints } from '../../../lib/points'
import { getNextReceiptNumberDirect } from '../../../lib/receiptHelpers'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../lib/auditLog'

export const dynamic = 'force-dynamic'

// 🔧 دالة للبحث عن رقم إيصال متاح (integers فقط)
async function getNextAvailableReceiptNumber(startingNumber: number): Promise<number> {
  let currentNumber = parseInt(startingNumber.toString())
  let attempts = 0
  const MAX_ATTEMPTS = 100
  
  while (attempts < MAX_ATTEMPTS) {
    const existingReceipt = await prisma.receipt.findUnique({
      where: { receiptNumber: currentNumber }
    })
    
    if (!existingReceipt) {
      return currentNumber
    }
    
    currentNumber++
    attempts++
  }
  
  throw new Error(`فشل إيجاد رقم إيصال متاح بعد ${MAX_ATTEMPTS} محاولة`)
}

// GET - جلب كل الأعضاء أو البحث عن عضو معين
export async function GET(request: Request) {
  try {
    // ✅ التحقق من صلاحية عرض الأعضاء
    await requirePermission(request, 'canViewMembers')

    const { searchParams } = new URL(request.url)
    const memberNumber = searchParams.get('memberNumber')
    const phone = searchParams.get('phone')

    // ✅ البحث برقم العضوية (الأولوية الأولى)
    if (memberNumber) {
      const member = await prisma.member.findUnique({
        where: { memberNumber: parseInt(memberNumber) },
        include: { receipts: true }
      })

      if (member) {
        return NextResponse.json([member], { status: 200 })
      } else {
        return NextResponse.json([], { status: 200 })
      }
    }

    // ⚠️ البحث بالهاتف (غير موصى به - قد يكون هناك عضوين بنفس الرقم)
    if (phone) {
      const members = await prisma.member.findMany({
        where: { phone },
        include: { receipts: true },
        orderBy: { memberNumber: 'desc' }
      })
      return NextResponse.json(members, { status: 200 })
    }

    // ✅ إلغاء تجميد الأعضاء الذين انتهت مدة تجميدهم تلقائياً
    const now = new Date()
    // لو اشتراكهم لسه ساري → isActive: true
    await prisma.member.updateMany({
      where: {
        isFrozen: true,
        expiryDate: { gt: now },
        freezeRequests: {
          some: { status: 'approved', endDate: { lte: now } }
        }
      },
      data: { isFrozen: false, isActive: true }
    })
    // لو اشتراكهم انتهى برضو → isActive: false
    await prisma.member.updateMany({
      where: {
        isFrozen: true,
        expiryDate: { lte: now },
        freezeRequests: {
          some: { status: 'approved', endDate: { lte: now } }
        }
      },
      data: { isFrozen: false, isActive: false }
    })

    // جلب كل الأعضاء
    const members = await prisma.member.findMany({
      orderBy: { memberNumber: 'desc' },
      include: {
        receipts: true,
        freezeRequests: {
          where: { status: 'approved' },
          orderBy: { endDate: 'desc' },
          take: 1,
          select: { endDate: true }
        }
      }
    })


    if (!Array.isArray(members)) {
      console.error('❌ Prisma لم يرجع array:', typeof members)
      return NextResponse.json([], { status: 200 })
    }

    return NextResponse.json(members, { status: 200 })
  } catch (error: any) {
    console.error('❌ Error fetching members:', error)

    // Log error to file
    const statusCode = error.message === 'Unauthorized' ? 401
      : error.message.includes('Forbidden') ? 403
      : 500

    logError({
      error,
      endpoint: '/api/members',
      method: 'GET',
      statusCode
    })

    // التعامل مع أخطاء الصلاحيات
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية عرض الأعضاء' },
        { status: 403 }
      )
    }

    return NextResponse.json([], {
      status: 200,
      headers: {
        'X-Error': 'Failed to fetch members'
      }
    })
  }
}

// POST - إضافة عضو جديد
export async function POST(request: Request) {
  try {
    // ✅ التحقق من صلاحية إضافة عضو
    const user = await requirePermission(request, 'canCreateMembers')

    // 🔧 جلب إعدادات النظام (للتحقق من تفعيل عمولة الكوتش)
    const systemSettings = await prisma.systemSettings.findUnique({
      where: { id: 'singleton' }
    })

    const body = await request.json()
    const {
      memberNumber,
      name,
      phone,
      backupPhone,
      nationalId,
      birthDate,
      source,
      profileImage,
      idCardFront,
      idCardBack,
      inBodyScans,
      invitations,
      freePTSessions,
      freeNutritionSessions,
      freePhysioSessions,
      freeGroupClassSessions,
      freePoolSessions,
      freePadelSessions,
      freeAssessmentSessions,
      remainingFreezeDays,
      subscriptionPrice,
      remainingAmount,
      notes,
      startDate,
      expiryDate,
      paymentMethod,
      staffName,
      isOther,
      customCreatedAt,
      skipReceipt,  // ✅ خيار عدم إنشاء إيصال
      coachId,  // 👨‍🏫 معرف الكوتش (اختياري)
      ptCommissionAmount,  // 💰 عمولة الكوتش من الباقة (اختياري)
      referralMemberNumber  // 👥 رقم العضو المُحيل (اختياري)
    } = body


    // ✅ التحقق من الحقول المطلوبة
    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'اسم العضو مطلوب' },
        { status: 400 }
      )
    }

    if (!phone || phone.trim() === '') {
      return NextResponse.json(
        { error: 'رقم الهاتف مطلوب' },
        { status: 400 }
      )
    }

    // ✅ التحقق من عدم تكرار رقم الهاتف (للأعضاء الجُدد فقط)
    const existingMember = await prisma.member.findFirst({
      where: { phone: phone.trim() },
      select: { id: true, name: true, memberNumber: true }
    })

    if (existingMember) {
      return NextResponse.json(
        { error: `رقم الهاتف ${phone} مستخدم بالفعل للعضو ${existingMember.name} (#${existingMember.memberNumber || 'Other'})` },
        { status: 400 }
      )
    }

    if (!subscriptionPrice || subscriptionPrice <= 0) {
      return NextResponse.json(
        { error: 'سعر الاشتراك مطلوب ويجب أن يكون أكبر من صفر' },
        { status: 400 }
      )
    }

    // تحويل كل الأرقام لـ integers
    let cleanMemberNumber = null
    
    if (isOther === true) {
      cleanMemberNumber = null
    } else {
      if (!memberNumber) {
        return NextResponse.json(
          { error: 'رقم العضوية مطلوب' },
          { status: 400 }
        )
      }
      cleanMemberNumber = parseInt(memberNumber.toString())
    }
    
    const cleanInBodyScans = parseInt((inBodyScans || 0).toString())
    const cleanInvitations = parseInt((invitations || 0).toString())
    const cleanFreePTSessions = parseInt((freePTSessions || 0).toString())
    const cleanFreeNutritionSessions = parseInt((freeNutritionSessions || 0).toString())
    const cleanFreePhysioSessions = parseInt((freePhysioSessions || 0).toString())
    const cleanFreeGroupClassSessions = parseInt((freeGroupClassSessions || 0).toString())
    const cleanFreePoolSessions = parseInt((freePoolSessions || 0).toString())
    const cleanFreePadelSessions = parseInt((freePadelSessions || 0).toString())
    const cleanFreeAssessmentSessions = parseInt((freeAssessmentSessions || 0).toString())
    const cleanRemainingFreezeDays = parseInt((remainingFreezeDays || 0).toString())
    const cleanSubscriptionPrice = parseInt(subscriptionPrice.toString())
    const cleanRemainingAmount = parseInt((remainingAmount || 0).toString())

    // التحقق من أن رقم العضوية غير مستخدم (إذا لم يكن Other)
    if (cleanMemberNumber !== null) {
      const existingMember = await prisma.member.findUnique({
        where: { memberNumber: cleanMemberNumber }
      })
      
      if (existingMember) {
        console.error('❌ رقم العضوية مستخدم:', cleanMemberNumber)
        return NextResponse.json(
          { error: `رقم العضوية ${cleanMemberNumber} مستخدم بالفعل` }, 
          { status: 400 }
        )
      }
    }

    // التحقق من التواريخ
    if (startDate && expiryDate) {
      const start = new Date(startDate)
      const end = new Date(expiryDate)

      if (end <= start) {
        return NextResponse.json(
          { error: 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية' },
          { status: 400 }
        )
      }
    }

    // 👥 التحقق من رقم العضو المُحيل إذا تم إدخاله
    let referrerId = null
    if (referralMemberNumber && referralMemberNumber.trim() !== '') {
      const referrer = await prisma.member.findUnique({
        where: { memberNumber: parseInt(referralMemberNumber.trim()) }
      })

      if (!referrer) {
        return NextResponse.json(
          { error: 'رقم العضو المُحيل غير موجود' },
          { status: 400 }
        )
      }

      referrerId = referrer.id
      console.log(`✅ تم العثور على العضو المُحيل: ${referrer.name} (${referrer.memberNumber})`)
    }

    // إنشاء العضو
    const memberData: any = {
      memberNumber: cleanMemberNumber,
      name,
      phone,
      backupPhone: backupPhone || null,
      nationalId: nationalId || null,
      birthDate: birthDate ? new Date(birthDate) : null,
      source: source || null,
      profileImage,
      idCardFront: idCardFront || null,
      idCardBack: idCardBack || null,
      inBodyScans: cleanInBodyScans,
      invitations: cleanInvitations,
      freePTSessions: cleanFreePTSessions,
      freeNutritionSessions: cleanFreeNutritionSessions,
      freePhysioSessions: cleanFreePhysioSessions,
      freeGroupClassSessions: cleanFreeGroupClassSessions,
      freePoolSessions: cleanFreePoolSessions,
      freePadelSessions: cleanFreePadelSessions,
      freeAssessmentSessions: cleanFreeAssessmentSessions,
      remainingFreezeDays: cleanRemainingFreezeDays,
      subscriptionPrice: cleanSubscriptionPrice,
      remainingAmount: cleanRemainingAmount,
      notes,
      startDate: startDate ? new Date(startDate) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      coachId: coachId || null,  // 👨‍🏫 ربط العضو بالكوتش (اختياري)
    }

    // إذا كان هناك تاريخ مخصص من الأدمن، استخدمه
    if (customCreatedAt) {
      memberData.createdAt = new Date(customCreatedAt)
    }

    const member = await prisma.member.create({
      data: memberData,
    })


    // 📝 Audit log
    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'CREATE', resource: 'Member', resourceId: member.id,
      details: { memberNumber: member.memberNumber, name: member.name, phone: member.phone },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    // تحديث MemberCounter بعد الحفظ الناجح
    if (cleanMemberNumber !== null) {
      try {
        let counter = await prisma.memberCounter.findUnique({ where: { id: 1 } })
        
        if (!counter) {
          await prisma.memberCounter.create({
            data: { id: 1, current: cleanMemberNumber + 1 }
          })
        } else {
          if (cleanMemberNumber >= counter.current) {
            await prisma.memberCounter.update({
              where: { id: 1 },
              data: { current: cleanMemberNumber + 1 }
            })
          } else {
          }
        }
      } catch (counterError) {
        console.error('⚠️ خطأ في تحديث MemberCounter (غير حرج):', counterError)

        // Log error to file (non-critical)
        logError({
          error: counterError,
          endpoint: '/api/members',
          method: 'POST',
          statusCode: 200, // Non-critical, doesn't fail the request
          additionalContext: { errorType: 'MemberCounter update failed (non-critical)' }
        })
      }
    }

    // 👨‍🏫 إنشاء عمولة للكوتش إذا تم اختياره وكانت العمولة مفعلة
    const ptCommissionEnabled = systemSettings?.ptCommissionEnabled ?? true
    const defaultPtCommissionAmount = systemSettings?.ptCommissionAmount ?? 50

    // استخدام عمولة الباقة إذا كانت موجودة، وإلا استخدام المبلغ الافتراضي من الإعدادات
    const finalCommissionAmount = ptCommissionAmount && ptCommissionAmount > 0
      ? ptCommissionAmount
      : defaultPtCommissionAmount

    if (coachId && ptCommissionEnabled) {
      try {
        const commissionData: any = {
          staffId: coachId,
          memberId: member.id,
          amount: finalCommissionAmount,
          type: 'member_signup',
          description: `عمولة تسجيل عضو جديد: ${name} (#${cleanMemberNumber || 'Other'})`,
        }

        // استخدام نفس التاريخ المخصص إذا كان موجوداً
        if (customCreatedAt) {
          commissionData.createdAt = new Date(customCreatedAt)
        }

        const commission = await prisma.commission.create({
          data: commissionData,
        })

      } catch (commissionError) {
        console.error('⚠️ خطأ في إنشاء العمولة (غير حرج):', commissionError)

        // Log error to file (non-critical)
        logError({
          error: commissionError,
          endpoint: '/api/members',
          method: 'POST',
          statusCode: 200, // Non-critical, doesn't fail the request
          additionalContext: { errorType: 'Commission creation failed (non-critical)', coachId }
        })

        // لا نفشل العملية بأكملها إذا فشل إنشاء العمولة
      }
    }

    // إنشاء إيصال (إلا إذا طلب المستخدم عدم إنشائه)
    let receiptData = null

    if (!skipReceipt) {
      // ✅ إنشاء الإيصال فقط إذا لم يتم تفعيل خيار عدم الإنشاء
      try {
      // ✅ الحصول على رقم الإيصال التالي (يضمن عدم التكرار)
      const receiptNumber = await getNextReceiptNumberDirect(prisma)

      const paidAmount = cleanSubscriptionPrice - cleanRemainingAmount

      // ✅ معالجة وسائل الدفع المتعددة
      let finalPaymentMethod: string
      if (Array.isArray(paymentMethod)) {
        // التحقق من صحة توزيع المبالغ
        const validation = validatePaymentDistribution(paymentMethod, paidAmount)
        if (!validation.valid) {
          return NextResponse.json(
            { error: validation.message || 'توزيع المبالغ غير صحيح' },
            { status: 400 }
          )
        }
        // تحويل لـ JSON للتخزين
        finalPaymentMethod = serializePaymentMethods(paymentMethod)
      } else {
        // طريقة دفع واحدة (backward compatible)
        finalPaymentMethod = paymentMethod || 'cash'
      }

      let subscriptionDays = null
      if (startDate && expiryDate) {
        const start = new Date(startDate)
        const end = new Date(expiryDate)
        subscriptionDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      }

      let receiptData: any = {
        receiptNumber: receiptNumber,
        type: 'Member',
        amount: paidAmount,
        paymentMethod: finalPaymentMethod,
        staffName: staffName.trim(),
        itemDetails: JSON.stringify({
          memberNumber: cleanMemberNumber,
          memberName: name,
          phone: phone,
          subscriptionPrice: cleanSubscriptionPrice,
          paidAmount: paidAmount,
          remainingAmount: cleanRemainingAmount,
          freePTSessions: cleanFreePTSessions,
          inBodyScans: cleanInBodyScans,
          invitations: cleanInvitations,
          remainingFreezeDays: cleanRemainingFreezeDays,
          startDate: startDate,
          expiryDate: expiryDate,
          subscriptionDays: subscriptionDays,
          staffName: staffName.trim(),
          isOther: isOther === true,
        }),
        memberId: member.id,
      }

      // إذا كان هناك تاريخ مخصص من الأدمن، استخدمه للإيصال أيضاً
      if (customCreatedAt) {
        receiptData.createdAt = new Date(customCreatedAt)
      }

      const receipt = await prisma.receipt.create({
        data: receiptData,
      })


      // خصم النقاط إذا تم استخدامها في الدفع
      const pointsResult = await processPaymentWithPoints(
        member.id,
        phone,
        member.memberNumber,  // ✅ تمرير رقم العضوية
        finalPaymentMethod,
        `دفع اشتراك عضوية - ${name}`,
        prisma
      )

      if (!pointsResult.success) {
        return NextResponse.json(
          { error: pointsResult.message || 'فشل خصم النقاط' },
          { status: 400 }
        )
      }

      // إضافة نقاط مكافأة على الدفع
      try {
        await addPointsForPayment(
          member.id,
          paidAmount,
          `مكافأة اشتراك جديد - ${name}`
        )
      } catch (pointsError) {
        console.error('Error adding reward points:', pointsError)
        // لا نوقف العملية إذا فشلت إضافة النقاط
      }

      receiptData = {
        receiptNumber: receipt.receiptNumber,
        amount: receipt.amount,
        paymentMethod: receipt.paymentMethod,
        staffName: receipt.staffName,
        createdAt: receipt.createdAt,
        itemDetails: JSON.parse(receipt.itemDetails)
      }

    } catch (receiptError) {
      console.error('❌ خطأ في إنشاء الإيصال:', receiptError)

      // Log error to file
      logError({
        error: receiptError,
        endpoint: '/api/members',
        method: 'POST',
        statusCode: 500,
        additionalContext: {
          errorType: 'Receipt creation failed',
          isDuplicateReceipt: receiptError instanceof Error && receiptError.message.includes('Unique constraint')
        }
      })

      if (receiptError instanceof Error && receiptError.message.includes('Unique constraint')) {
        console.error('❌ رقم الإيصال مكرر! المحاولة مرة أخرى...')
      }
    }
    } else {
    }

    // 👥 منح نقاط الإحالة للعضو المُحيل
    if (referrerId) {
      try {
        // جلب إعدادات النظام
        const settings = await prisma.systemSettings.findFirst()

        if (settings && settings.pointsPerReferral > 0) {
          const referrer = await prisma.member.findUnique({
            where: { id: referrerId },
            select: { name: true, memberNumber: true }
          })

          await addPoints(
            referrerId,
            settings.pointsPerReferral,
            'invitation',
            `مكافأة إحالة عضو جديد: ${member.name} - ${settings.pointsPerReferral} نقطة`
          )

          console.log(`✅ تم منح ${settings.pointsPerReferral} نقطة إحالة للعضو ${referrer?.name} (${referrer?.memberNumber})`)
        }
      } catch (pointsError) {
        console.error('Error adding referral points:', pointsError)
        // لا نوقف عملية التسجيل إذا فشلت إضافة النقاط
      }
    }

    return NextResponse.json({
      success: true,
      member: member,
      receipt: receiptData
    }, { status: 201 })

  } catch (error: any) {
    console.error('❌ خطأ في إضافة العضو:', error)

    // Log error to file
    const statusCode = error.message === 'Unauthorized' ? 401
      : error.message.includes('Forbidden') ? 403
      : 500

    logError({
      error,
      endpoint: '/api/members',
      method: 'POST',
      statusCode
    })

    // التعامل مع أخطاء الصلاحيات
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية إضافة أعضاء' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل إضافة العضو' }, { status: 500 })
  }
}

// PUT - تحديث عضو
export async function PUT(request: Request) {
  try {
    // ✅ التحقق من صلاحية تعديل عضو
    const user = await requirePermission(request, 'canEditMembers')
    
    const body = await request.json()
    const { id, profileImage, idCardFront, idCardBack, ...data } = body

    const updateData: any = {}
    
    // تحويل كل الأرقام لـ integers
    if (data.memberNumber !== undefined) {
      updateData.memberNumber = data.memberNumber ? parseInt(data.memberNumber.toString()) : null
    }
    if (data.inBodyScans !== undefined) {
      updateData.inBodyScans = parseInt(data.inBodyScans.toString())
    }
    if (data.invitations !== undefined) {
      updateData.invitations = parseInt(data.invitations.toString())
    }
    if (data.freePTSessions !== undefined) {
      updateData.freePTSessions = parseInt(data.freePTSessions.toString())
    }
    if (data.freePoolSessions !== undefined) {
      updateData.freePoolSessions = parseInt(data.freePoolSessions.toString())
    }
    if (data.freePadelSessions !== undefined) {
      updateData.freePadelSessions = parseInt(data.freePadelSessions.toString())
    }
    if (data.freeAssessmentSessions !== undefined) {
      updateData.freeAssessmentSessions = parseInt(data.freeAssessmentSessions.toString())
    }
    if (data.remainingFreezeDays !== undefined) {
      updateData.remainingFreezeDays = parseInt(data.remainingFreezeDays.toString())
    }
    if (data.subscriptionPrice !== undefined) {
      updateData.subscriptionPrice = parseInt(data.subscriptionPrice.toString())
    }
    if (data.remainingAmount !== undefined) {
      updateData.remainingAmount = parseInt(data.remainingAmount.toString())
    }
    
    if (profileImage !== undefined) {
      updateData.profileImage = profileImage
    }

    if (idCardFront !== undefined) {
      updateData.idCardFront = idCardFront || null
    }

    if (idCardBack !== undefined) {
      updateData.idCardBack = idCardBack || null
    }

    if (data.name) updateData.name = data.name
    if (data.phone) updateData.phone = data.phone
    if (data.backupPhone !== undefined) updateData.backupPhone = data.backupPhone || null
    if (data.nationalId !== undefined) updateData.nationalId = data.nationalId || null
    if (data.birthDate !== undefined) {
      updateData.birthDate = data.birthDate ? new Date(data.birthDate) : null
    }
    if (data.source !== undefined) updateData.source = data.source || null
    if (data.notes !== undefined) updateData.notes = data.notes

    if (data.startDate) {
      updateData.startDate = new Date(data.startDate)
    }
    if (data.expiryDate) {
      updateData.expiryDate = new Date(data.expiryDate)
    }

    const member = await prisma.member.update({
      where: { id },
      data: updateData,
    })

    // 📝 Audit log
    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'Member', resourceId: member.id,
      details: { memberNumber: member.memberNumber, name: member.name, changes: Object.keys(updateData) },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json(member)
  } catch (error: any) {
    console.error('Error updating member:', error)

    // Log error to file
    const statusCode = error.message === 'Unauthorized' ? 401
      : error.message.includes('Forbidden') ? 403
      : 500

    logError({
      error,
      endpoint: '/api/members',
      method: 'PUT',
      statusCode
    })

    // التعامل مع أخطاء الصلاحيات
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تعديل الأعضاء' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل تحديث العضو' }, { status: 500 })
  }
}

// DELETE - حذف عضو
export async function DELETE(request: Request) {
  try {
    // ✅ التحقق من صلاحية حذف عضو
    const user = await requirePermission(request, 'canDeleteMembers')

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'رقم العضو مطلوب' }, { status: 400 })
    }

    const memberToDelete = await prisma.member.findUnique({ where: { id }, select: { name: true, memberNumber: true } })
    await prisma.member.delete({ where: { id } })

    // 📝 Audit log
    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'DELETE', resource: 'Member', resourceId: id,
      details: { memberNumber: memberToDelete?.memberNumber, name: memberToDelete?.name },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json({ message: 'تم الحذف بنجاح' })
  } catch (error: any) {
    console.error('Error deleting member:', error)

    // Log error to file
    const statusCode = error.message === 'Unauthorized' ? 401
      : error.message.includes('Forbidden') ? 403
      : 500

    logError({
      error,
      endpoint: '/api/members',
      method: 'DELETE',
      statusCode
    })

    // التعامل مع أخطاء الصلاحيات
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية حذف الأعضاء' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل حذف العضو' }, { status: 500 })
  }
}
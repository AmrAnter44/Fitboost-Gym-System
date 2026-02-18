// app/api/members/route.ts - مع فحص الصلاحيات
import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'
import { requireValidLicense } from '../../../lib/license'
import {
  type PaymentMethod,
  validatePaymentDistribution,
  serializePaymentMethods
} from '../../../lib/paymentHelpers'
import { logError } from '../../../lib/errorLogger'
import { processPaymentWithPoints } from '../../../lib/paymentProcessor'
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
      console.log(`✅ رقم إيصال متاح: ${currentNumber}`)
      return currentNumber
    }
    
    console.log(`⚠️ رقم ${currentNumber} موجود، تجربة ${currentNumber + 1}...`)
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
      console.log('🔍 البحث عن عضو برقم العضوية:', memberNumber)
      const member = await prisma.member.findUnique({
        where: { memberNumber: parseInt(memberNumber) },
        include: { receipts: true }
      })

      if (member) {
        console.log('✅ تم العثور على العضو:', member.name)
        return NextResponse.json([member], { status: 200 })
      } else {
        console.log('❌ لم يتم العثور على عضو برقم:', memberNumber)
        return NextResponse.json([], { status: 200 })
      }
    }

    // ⚠️ البحث بالهاتف (غير موصى به - قد يكون هناك عضوين بنفس الرقم)
    if (phone) {
      console.log('🔍 البحث عن أعضاء بالهاتف:', phone)
      const members = await prisma.member.findMany({
        where: { phone },
        include: { receipts: true },
        orderBy: { memberNumber: 'desc' }
      })
      console.log('✅ تم العثور على', members.length, 'عضو بنفس الهاتف')
      return NextResponse.json(members, { status: 200 })
    }

    // جلب كل الأعضاء
    console.log('🔍 بدء جلب كل الأعضاء...')
    const members = await prisma.member.findMany({
      orderBy: { memberNumber: 'desc' },
      include: { receipts: true }
    })

    console.log('✅ تم جلب', members.length, 'عضو')

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
      coachId  // 👨‍🏫 معرف الكوتش (اختياري)
    } = body

    console.log('📝 إضافة عضو جديد:', {
      memberNumber,
      name,
      profileImage,
      isOther,
      staffName: staffName || '(غير محدد)',
      coachId: coachId || 'لا يوجد'  // 👨‍🏫 معرف الكوتش
    })

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
      console.log('✅ عضو Other (بدون رقم عضوية)')
    } else {
      if (!memberNumber) {
        return NextResponse.json(
          { error: 'رقم العضوية مطلوب' },
          { status: 400 }
        )
      }
      cleanMemberNumber = parseInt(memberNumber.toString())
      console.log('✅ عضو عادي برقم:', cleanMemberNumber)
    }
    
    const cleanInBodyScans = parseInt((inBodyScans || 0).toString())
    const cleanInvitations = parseInt((invitations || 0).toString())
    const cleanFreePTSessions = parseInt((freePTSessions || 0).toString())
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
      console.log('⏰ استخدام تاريخ مخصص للعضو:', new Date(customCreatedAt))
    }

    const member = await prisma.member.create({
      data: memberData,
    })

    console.log('✅ تم إنشاء العضو:', member.id, 'رقم العضوية:', member.memberNumber)

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
          console.log('📊 تم إنشاء MemberCounter بقيمة:', cleanMemberNumber + 1)
        } else {
          if (cleanMemberNumber >= counter.current) {
            await prisma.memberCounter.update({
              where: { id: 1 },
              data: { current: cleanMemberNumber + 1 }
            })
            console.log('🔄 تم تحديث MemberCounter إلى:', cleanMemberNumber + 1)
          } else {
            console.log('ℹ️ المحتوى الحالي للـ Counter أعلى، لا داعي للتحديث')
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

    // 👨‍🏫 إنشاء عمولة للكوتش إذا تم اختياره
    if (coachId) {
      try {
        const commissionData: any = {
          staffId: coachId,
          memberId: member.id,
          amount: 50,
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

        console.log('✅ تم إنشاء عمولة:', commission.id, 'مبلغ:', commission.amount, 'جنيه للكوتش')
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
        console.log('⏰ استخدام تاريخ مخصص للإيصال:', new Date(customCreatedAt))
      }

      // 🔒 License validation check
      await requireValidLicense()

      const receipt = await prisma.receipt.create({
        data: receiptData,
      })

      console.log('✅ تم إنشاء الإيصال:', receipt.receiptNumber)

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
      console.log('🚫 تم تخطي إنشاء الإيصال (skipReceipt = true)')
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
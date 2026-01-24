import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

// ✅ GET: بس يقرأ الرقم المتاح (بدون تحديث!)

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // ✅ التحقق من صلاحية عرض الأعضاء (لأن هذا جزء من إضافة عضو)
    await requirePermission(request, 'canViewMembers')
    
    console.log('🔍 قراءة رقم العضوية التالي...')
    
    // ✅ نقرأ من MemberCounter
    let counter = await prisma.memberCounter.findUnique({ 
      where: { id: 1 } 
    })
    
    // لو مفيش counter، نعمل واحد
    if (!counter) {
      console.log('📊 إنشاء MemberCounter لأول مرة')
      counter = await prisma.memberCounter.create({
        data: { id: 1, current: 1001 }
      })
    }

    console.log('📊 الرقم الحالي من Counter:', counter.current)

    // ✅ نتحقق إن الرقم متاح (بدون تحديث)
    let nextNumber = counter.current
    let attempts = 0
    const MAX_ATTEMPTS = 100

    while (attempts < MAX_ATTEMPTS) {
      const existingMember = await prisma.member.findUnique({
        where: { memberNumber: nextNumber }
      })

      if (!existingMember) {
        // ✅ الرقم متاح
        console.log(`✅ رقم متاح: ${nextNumber}`)
        break
      }

      // الرقم مستخدم، نجرب التالي
      console.log(`⚠️ رقم ${nextNumber} موجود، تجربة ${nextNumber + 1}...`)
      nextNumber++
      attempts++
    }

    if (attempts >= MAX_ATTEMPTS) {
      throw new Error('فشل إيجاد رقم عضوية متاح')
    }

    // ⚠️ هنا الفرق: مش بنحدث الـ Counter!
    // الـ Counter هيتحدث لما العضو يتحفظ فعلاً

    return NextResponse.json({ 
      nextNumber: nextNumber,
      message: 'تم جلب رقم العضوية التالي بنجاح',
      fromCounter: true
    }, { status: 200 })
    
  } catch (error: any) {
    console.error('❌ Error fetching next member number:', error)
    
    // التعامل مع أخطاء الصلاحيات
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية الوصول لأرقام العضوية' },
        { status: 403 }
      )
    }
    
    // Fallback: نجيب آخر رقم من الأعضاء
    try {
      const members = await prisma.member.findMany({
        where: { memberNumber: { not: null } },
        orderBy: { memberNumber: 'desc' },
        select: { memberNumber: true },
        take: 1
      })

      if (members[0] && members[0].memberNumber) {
        const nextNum = parseInt(members[0].memberNumber.toString()) + 1
        return NextResponse.json({ 
          nextNumber: nextNum,
          message: 'تم جلب الرقم من آخر عضو',
          fromCounter: false
        }, { status: 200 })
      }
    } catch (fallbackError) {
      console.error('❌ Fallback failed:', fallbackError)
    }

    // آخر حل: رقم افتراضي
    return NextResponse.json({ 
      nextNumber: 1001,
      message: 'تم استخدام رقم افتراضي',
      fromCounter: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 200 })
  }
}

// ✅ تحديث رقم البداية من الإعدادات
export async function POST(request: Request) {
  try {
    // ✅ التحقق من صلاحية الوصول للإعدادات
    await requirePermission(request, 'canAccessSettings')
    
    const { startNumber } = await request.json()
    
    if (!startNumber || startNumber < 1) {
      return NextResponse.json({ 
        error: 'رقم البداية غير صحيح' 
      }, { status: 400 })
    }

    const parsedNumber = parseInt(startNumber)

    // التحقق من عدم وجود رقم عضوية بهذا الرقم
    const existingMember = await prisma.member.findUnique({
      where: { memberNumber: parsedNumber }
    })

    if (existingMember) {
      return NextResponse.json({ 
        error: `رقم العضوية ${parsedNumber} مستخدم بالفعل. اختر رقماً أكبر.` 
      }, { status: 400 })
    }

    // تحديث أو إنشاء MemberCounter
    await prisma.memberCounter.upsert({
      where: { id: 1 },
      update: { current: parsedNumber },
      create: { id: 1, current: parsedNumber }
    })

    console.log('✅ تم تحديث MemberCounter إلى:', parsedNumber)

    return NextResponse.json({ 
      success: true,
      newNumber: parsedNumber,
      message: `تم تحديث رقم العضوية ليبدأ من ${parsedNumber}`
    })
  } catch (error: any) {
    console.error('❌ Error updating member counter:', error)
    
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تعديل إعدادات العضوية' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({ 
      error: 'فشل تحديث رقم العضوية',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
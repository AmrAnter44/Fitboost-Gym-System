// app/api/coach/monthly-revenue/route.ts
//  بيرجّع التارجت الشهري للكوتش + اللي عمله فعلاً
// الحساب: مجموع receipt.amount للإيصالات اللي coachName فيها = اسم الكوتش
// (نفس طريقة حاسبة التحصيل بالظبط)
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

//  كل أنواع الإيصالات اللي بتروح للكوتشات (PT/Nutrition/Physio + Legacy)
const COACH_RECEIPT_TYPES = [
  // PT
  'newPT', 'ptRenewal', 'ptDayUse',
  'برايفت جديد', 'تجديد برايفت', 'دفع باقي برايفت', 'new pt', 'اشتراك برايفت', 'PT Day Use',
  // Nutrition
  'newNutrition', 'nutritionRenewal', 'nutritionDayUse',
  'تغذية جديدة', 'تجديد تغذية', 'دفع باقي تغذية', 'اشتراك تغذية',
  'new nutrition', 'Nutrition Day Use',
  // Physiotherapy
  'newPhysiotherapy', 'physiotherapyRenewal', 'physiotherapyDayUse',
  'علاج طبيعي جديد', 'تجديد علاج طبيعي', 'دفع باقي علاج طبيعي', 'اشتراك علاج طبيعي',
  'new physiotherapy', 'Physiotherapy Day Use',
  // Group Class
  'newGroupClass', 'groupClassRenewal',
  'جروب كلاس جديد', 'تجديد جروب كلاس',
]

export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    //  Coach بيشوف نفسه بس، Admin/Manager بيشوف الكل
    const isCoach = user.role === 'COACH'
    if (isCoach && !user.staffId) {
      return NextResponse.json({ error: 'حساب الكوتش غير مربوط بموظف' }, { status: 400 })
    }

    //  جلب الكوتشات (الموظفين اللي عندهم "مدرب" في الـ position)
    const coaches = await prisma.staff.findMany({
      where: {
        isActive: true,
        ...(isCoach ? { id: user.staffId! } : {}),
      },
      select: {
        id: true,
        name: true,
        staffCode: true,
        position: true,
        coachTarget: true,
      },
    })

    //  لو Admin/Manager، نـ filter الترينرز فقط
    const trainers = isCoach
      ? coaches
      : coaches.filter(c => (c.position?.split(',') || []).map(p => p.trim()).includes('مدرب'))

    if (trainers.length === 0) {
      return NextResponse.json(isCoach ? null : [])
    }

    //  جلب كل إيصالات الكوتشات في الشهر الحالي مرة واحدة
    const receipts = await prisma.receipt.findMany({
      where: {
        type: { in: COACH_RECEIPT_TYPES },
        createdAt: { gte: monthStart, lte: monthEnd },
      },
      select: {
        amount: true,
        type: true,
        itemDetails: true,
      },
    })

    //  لكل كوتش، نجمع amount من الإيصالات اللي coachName فيها = اسم الكوتش
    const result = trainers.map(c => {
      const target = c.coachTarget || 0
      let collected = 0
      let receiptsCount = 0
      const breakdown: Record<string, number> = {}

      for (const r of receipts) {
        if (!r.itemDetails) continue
        try {
          const details = JSON.parse(r.itemDetails)
          //  الكوتش متعيّن بـ coachName في الـ itemDetails (نفس طريقة حاسبة التحصيل)
          // ندعم coachName + nutritionistName + therapistName
          const name = details.coachName || details.nutritionistName || details.therapistName
          if (name !== c.name) continue
          collected += r.amount || 0
          receiptsCount++
          breakdown[r.type] = (breakdown[r.type] || 0) + (r.amount || 0)
        } catch {
          // skip invalid itemDetails
        }
      }

      //  مفيش cap على 100% — لو تجاوز التارجت بنعرض الـ X% الفعلي (مثلاً 160% أو 200%)
      const progressPercent = target > 0 ? Math.round((collected / target) * 100) : 0

      return {
        staffId: c.id,
        name: c.name,
        staffCode: c.staffCode,
        coachTarget: target,
        collectedThisMonth: Math.round(collected),
        commissionsCount: receiptsCount,
        progressPercent,
        breakdown,
      }
    })

    //  لو Coach، رجّع entry واحد. لو Admin، رجّع array
    return NextResponse.json(isCoach ? (result[0] || null) : result)
  } catch (error: any) {
    console.error('Error fetching coach monthly revenue:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    }
    return NextResponse.json({ error: 'فشل جلب البيانات' }, { status: 500 })
  }
}

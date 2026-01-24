// app/api/members/[id]/fitness-test/route.ts - API لاختبارات اللياقة
import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyAuth } from '../../../../../lib/auth'

// POST - إنشاء اختبار لياقة جديد

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // التحقق من المصادقة
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // فقط المدربين يمكنهم إنشاء اختبارات اللياقة
    if (user.role !== 'COACH' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only coaches can create fitness tests' },
        { status: 403 }
      )
    }

    const memberId = params.id
    const body = await request.json()

    // التحقق من وجود العضو
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        name: true,
        phone: true,
        memberNumber: true,
        freePTSessions: true,
      },
    })

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // التحقق من عدم وجود اختبار سابق
    const existingTest = await prisma.fitnessTest.findUnique({
      where: { memberId: memberId },
    })

    if (existingTest) {
      return NextResponse.json(
        { error: 'Fitness test already exists for this member' },
        { status: 400 }
      )
    }

    // الحصول على بيانات المدرب من Staff
    const userRecord = await prisma.user.findUnique({
      where: { id: user.userId },
      include: { staff: true },
    })

    if (!userRecord?.staffId || !userRecord.staff) {
      return NextResponse.json(
        { error: 'Coach not linked to staff record' },
        { status: 400 }
      )
    }

    // إنشاء اختبار اللياقة
    const fitnessTest = await prisma.fitnessTest.create({
      data: {
        memberId: memberId,
        coachId: userRecord.staffId,
        coachUserId: user.userId,
        createdBy: userRecord.name,
        testDate: new Date(body.testDate),

        // الأسئلة الطبية
        medFirstTimeGym: body.medicalQuestions.firstTimeGym,
        medInDietPlan: body.medicalQuestions.inDietPlan,
        medHernia: body.medicalQuestions.hernia,
        medFamilyHeartHistory: body.medicalQuestions.familyHeartHistory,
        medHeartProblem: body.medicalQuestions.heartProblem,
        medBackPain: body.medicalQuestions.backPain,
        medSurgery: body.medicalQuestions.surgery,
        medBreathingProblems: body.medicalQuestions.breathingProblems,
        medBloodPressure: body.medicalQuestions.bloodPressure,
        medKneeProblem: body.medicalQuestions.kneeProblem,
        medDiabetes: body.medicalQuestions.diabetes,
        medSmoker: body.medicalQuestions.smoker,
        medHighCholesterol: body.medicalQuestions.highCholesterol,

        // بيانات JSON
        flexibilityData: JSON.stringify(body.flexibility),
        exerciseData: JSON.stringify(body.exercises),
      },
    })

    return NextResponse.json(
      {
        success: true,
        fitnessTest: {
          id: fitnessTest.id,
          createdAt: fitnessTest.createdAt,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating fitness test:', error)
    return NextResponse.json(
      { error: 'Failed to create fitness test' },
      { status: 500 }
    )
  }
}

// GET - استرجاع اختبار اللياقة
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const memberId = params.id

    const fitnessTest = await prisma.fitnessTest.findUnique({
      where: { memberId: memberId },
      include: {
        member: {
          select: {
            name: true,
            phone: true,
            memberNumber: true,
            freePTSessions: true,
          },
        },
        coach: {
          select: {
            name: true,
          },
        },
      },
    })

    if (!fitnessTest) {
      return NextResponse.json(
        { error: 'Fitness test not found' },
        { status: 404 }
      )
    }

    // فحص الصلاحيات: فقط المدرب الذي أنشأه أو ADMIN/MANAGER يمكنهم المشاهدة
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      if (fitnessTest.coachUserId !== user.userId) {
        return NextResponse.json(
          { error: 'You do not have permission to view this test' },
          { status: 403 }
        )
      }
    }

    // تنسيق الاستجابة
    const response = {
      id: fitnessTest.id,
      memberId: fitnessTest.memberId,
      memberName: fitnessTest.member.name,
      memberPhone: fitnessTest.member.phone,
      memberNumber: fitnessTest.member.memberNumber,
      freePTSessions: fitnessTest.member.freePTSessions,
      coachName: fitnessTest.coach.name,
      testDate: fitnessTest.testDate,
      createdAt: fitnessTest.createdAt,
      createdBy: fitnessTest.createdBy,
      medicalQuestions: {
        firstTimeGym: fitnessTest.medFirstTimeGym,
        inDietPlan: fitnessTest.medInDietPlan,
        hernia: fitnessTest.medHernia,
        familyHeartHistory: fitnessTest.medFamilyHeartHistory,
        heartProblem: fitnessTest.medHeartProblem,
        backPain: fitnessTest.medBackPain,
        surgery: fitnessTest.medSurgery,
        breathingProblems: fitnessTest.medBreathingProblems,
        bloodPressure: fitnessTest.medBloodPressure,
        kneeProblem: fitnessTest.medKneeProblem,
        diabetes: fitnessTest.medDiabetes,
        smoker: fitnessTest.medSmoker,
        highCholesterol: fitnessTest.medHighCholesterol,
      },
      flexibility: JSON.parse(fitnessTest.flexibilityData),
      exercises: JSON.parse(fitnessTest.exerciseData),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching fitness test:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fitness test' },
      { status: 500 }
    )
  }
}

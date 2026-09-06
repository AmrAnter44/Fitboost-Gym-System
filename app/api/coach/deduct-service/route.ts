import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

// آخر 10 أرقام من الهاتف — لمطابقة الـ PT المرتبط بالعضو
function phoneTailOf(phone?: string | null): string | null {
  const t = phone?.replace(/\D/g, '').slice(-10)
  return t && t.length >= 7 ? t : null
}

// خدمات يقدر الكوتش يخصمها لكلاينتاته: InBody + التقييم (Assessment)
const SERVICE_CONFIG: Record<string, { field: 'inBodyScans' | 'freeAssessmentSessions'; label: string; historyType: string }> = {
  inBody: { field: 'inBodyScans', label: 'InBody', historyType: 'inbody' },
  assessment: { field: 'freeAssessmentSessions', label: 'التقييم', historyType: 'assessment' },
}

// POST - الكوتش يخصم InBody أو Assessment لعضو من كلاينتاته
export async function POST(request: Request) {
  try {
    // 1. Auth — لازم COACH
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (user.role !== 'COACH') {
      return NextResponse.json({ error: 'هذه العملية للمدربين فقط' }, { status: 403 })
    }
    if (!user.staffId) {
      return NextResponse.json({ error: 'لا يوجد staffId للمدرب' }, { status: 400 })
    }

    // 2. Body
    const { memberId, serviceType, notes } = await request.json()
    if (!memberId || !serviceType) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
    }
    const cfg = SERVICE_CONFIG[serviceType]
    if (!cfg) {
      return NextResponse.json({ error: 'نوع خدمة غير صحيح' }, { status: 400 })
    }

    // 3. العضو + التأكد إنه من كلاينتات الكوتش
    const member = await prisma.member.findUnique({ where: { id: memberId } })
    if (!member) {
      return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })
    }
    if (!member.isActive) {
      return NextResponse.json({ error: 'العضو غير نشط' }, { status: 400 })
    }

    const staff = await prisma.staff.findUnique({ where: { id: user.staffId } })
    if (!staff || !staff.isActive) {
      return NextResponse.json({ error: 'المدرب غير موجود أو غير نشط' }, { status: 404 })
    }

    //  ملكية الكوتش للعضو: يا إما مُسند ليه بالعضوية (coachId) يا إما كلاينت PT/برايفت عنده
    let owns = member.coachId === user.staffId
    if (!owns) {
      const tail = phoneTailOf(member.phone)
      if (tail) {
        const pt = await prisma.pT.findFirst({
          where: {
            phone: { contains: tail },
            OR: [{ coachUserId: user.userId }, { coachName: staff.name }],
          },
          select: { ptNumber: true },
        })
        owns = !!pt
      }
    }
    if (!owns) {
      return NextResponse.json({ error: 'هذا العضو غير معين لك' }, { status: 403 })
    }

    // 4. خصم ذرّي محمي (ميوصلش لسالب / ميحصلش lost-update) + سجل في تاريخ التقييمات
    const result = await prisma.$transaction(async (tx) => {
      const dec = await tx.member.updateMany({
        where: ({ id: memberId, [cfg.field]: { gt: 0 } } as any),
        data: ({ [cfg.field]: { decrement: 1 } } as any),
      })
      if (dec.count === 0) {
        throw new Error('NO_BALANCE')
      }

      await tx.assessmentHistory.create({
        data: {
          memberId,
          type: cfg.historyType,
          notes: (notes && String(notes).trim()) || `${cfg.label} - تسجيل بواسطة الكوتش ${staff.name}`,
        },
      })

      const fresh = await tx.member.findUnique({
        where: { id: memberId },
        select: { inBodyScans: true, freeAssessmentSessions: true },
      })
      return fresh
    })

    return NextResponse.json({
      success: true,
      message: `تم خصم ${cfg.label} بنجاح`,
      inBodyScans: result?.inBodyScans ?? 0,
      freeAssessmentSessions: result?.freeAssessmentSessions ?? 0,
    })
  } catch (error: any) {
    if (error?.message === 'NO_BALANCE') {
      return NextResponse.json({ error: 'لا يوجد رصيد متاح' }, { status: 400 })
    }
    console.error('Error deducting coach service:', error)
    return NextResponse.json({ error: 'فشل الخصم' }, { status: 500 })
  }
}

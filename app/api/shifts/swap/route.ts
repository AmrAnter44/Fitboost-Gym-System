import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requireAdmin } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

// POST { date, absentStaffId, replacementStaffId, startTime, endTime,
//        deductionAmount?, deductionReason?, bonusAmount?, bonusReason? }
//
// Atomic swap: marks absent staff off for the day, assigns replacement to the shift,
// and (optionally) creates a manual deduction for the absent staff + a bonus for the
// replacement. All in one transaction so partial failures don't leave the schedule
// inconsistent.
export async function POST(request: Request) {
  try {
    await requireAdmin(request)
    const body = await request.json()
    const {
      date,
      absentStaffId,
      replacementStaffId,
      startTime,
      endTime,
      deductionAmount,
      deductionReason,
      bonusAmount,
      bonusReason,
    } = body as {
      date?: string
      absentStaffId?: string
      replacementStaffId?: string
      startTime?: string
      endTime?: string
      deductionAmount?: number | string
      deductionReason?: string
      bonusAmount?: number | string
      bonusReason?: string
    }

    if (!date || !absentStaffId || !replacementStaffId || !startTime || !endTime) {
      return NextResponse.json({ error: 'البيانات المطلوبة ناقصة (date, absentStaffId, replacementStaffId, startTime, endTime)' }, { status: 400 })
    }
    if (absentStaffId === replacementStaffId) {
      return NextResponse.json({ error: 'الموظف البديل لازم يكون مختلف عن الغايب' }, { status: 400 })
    }

    const dt = new Date(date)
    if (isNaN(dt.getTime())) {
      return NextResponse.json({ error: 'تاريخ غير صحيح' }, { status: 400 })
    }
    const month = dt.getMonth() + 1
    const year = dt.getFullYear()
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`

    const dedAmt = deductionAmount ? Number(deductionAmount) : 0
    const bonusAmt = bonusAmount ? Number(bonusAmount) : 0
    const dedReasonFinal = deductionReason?.trim() || `غياب يوم ${dateStr} — تبديل شيفت`
    const bonusReasonFinal = bonusReason?.trim() || `تغطية شيفت يوم ${dateStr}`

    const result = await prisma.$transaction(async (tx) => {
      // 1. Off-leave for absent staff (single day, unpaid)
      const leave = await tx.leave.create({
        data: {
          staffId: absentStaffId,
          startDate: dt,
          endDate: dt,
          type: 'off',
          isPaid: false,
          reason: `تبديل شيفت — البديل: ${replacementStaffId}`,
          status: 'approved',
        },
      })

      // 2. ShiftAssignment for replacement
      const shift = await tx.shiftAssignment.create({
        data: {
          staffId: replacementStaffId,
          date: dt,
          startTime,
          endTime,
          notes: `تغطية شيفت — بدل عن ${absentStaffId}`,
        },
      })

      // 3. Optional: deduction for absent staff
      let deduction = null
      if (dedAmt > 0) {
        deduction = await tx.staffDeduction.create({
          data: {
            staffId: absentStaffId,
            amount: dedAmt,
            reason: dedReasonFinal,
            notes: `تبديل شيفت يوم ${dateStr}`,
          },
        })
      }

      // 4. Optional: bonus for replacement
      let bonus = null
      if (bonusAmt > 0) {
        bonus = await tx.bonus.create({
          data: {
            staffId: replacementStaffId,
            amount: bonusAmt,
            reason: bonusReasonFinal,
            month,
            year,
            notes: `تغطية شيفت يوم ${dateStr}`,
          },
        })
      }

      return { leave, shift, deduction, bonus }
    })

    return NextResponse.json({ success: true, ...result }, { status: 200 })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden') || e.message?.includes('Admin')) return NextResponse.json({ error: 'صلاحية المسؤول مطلوبة' }, { status: 403 })
    return NextResponse.json({ error: e.message || 'فشل التبديل' }, { status: 500 })
  }
}

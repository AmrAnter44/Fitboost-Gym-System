import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import { calculateNetSalary } from '../../../../lib/payroll/calculateNetSalary'

export const dynamic = 'force-dynamic'

// GET ?year=&month= → CSV file download
export async function GET(request: Request) {
  try {
    await requirePermission(request, 'canManagePayroll')
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || '0', 10)
    const month = parseInt(searchParams.get('month') || '0', 10)
    if (!year || !month) {
      return new Response('year و month مطلوبين', { status: 400 })
    }

    const staff = await prisma.staff.findMany({ where: { isActive: true }, select: { id: true, name: true, staffCode: true, position: true, phone: true } })
    const rows = await Promise.all(staff.map(async s => {
      const b = await calculateNetSalary(s.id, year, month)
      return {
        staffCode: s.staffCode,
        name: s.name,
        position: s.position ?? '',
        phone: s.phone ?? '',
        base: b.earnings.base,
        bonuses: b.earnings.bonuses.total,
        commission: b.earnings.commission.total,
        absences: b.deductions.absences.days,
        absenceAmount: b.deductions.absences.amount,
        lateMinutes: b.deductions.lateArrivals.totalMinutes,
        manualDeductions: b.deductions.manual.total,
        loans: b.deductions.loans.total,
        net: b.net,
      }
    }))

    const headers = ['Staff Code', 'Name', 'Position', 'Phone', 'Base', 'Bonuses', 'Commission', 'Absence Days', 'Absence Deduction', 'Late Minutes', 'Manual Deductions', 'Loans', 'Net']
    const escape = (v: any) => `"${String(v).replace(/"/g, '""')}"`
    const csv = [
      headers.map(escape).join(','),
      ...rows.map(r => [
        r.staffCode, r.name, r.position, r.phone,
        r.base.toFixed(2), r.bonuses.toFixed(2), r.commission.toFixed(2),
        r.absences, r.absenceAmount.toFixed(2), r.lateMinutes,
        r.manualDeductions.toFixed(2), r.loans.toFixed(2), r.net.toFixed(2),
      ].map(escape).join(',')),
    ].join('\n')

    // BOM for Excel UTF-8 detection
    const out = '﻿' + csv
    return new Response(out, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="payroll-${year}-${String(month).padStart(2, '0')}.csv"`,
      },
    })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return new Response('يجب تسجيل الدخول', { status: 401 })
    if (e.message?.includes('Forbidden')) return new Response('صلاحية إدارة الرواتب مطلوبة', { status: 403 })
    return new Response(e.message || 'فشل', { status: 500 })
  }
}

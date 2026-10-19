'use client'

// 📊 «تقرير Excel شامل» — ملف واحد فيه:
//   1) الإيصالات/الاشتراكات في الفترة (كود العضوية، النوع، المصدر، السيلز، الإجمالي/المدفوع/الباقي، المدة، كاش/فيزا...)
//   2) ملخص: إجمالي كل وسيلة دفع + عدد المشتركين بنات/أولاد + حسب المصدر
//   3) منتهي الاشتراك (كامل)   4) عليهم باقي + السيلز   5) الزوار
import { useState } from 'react'
import { useToast } from '../contexts/ToastContext'
import { useLanguage } from '../contexts/LanguageContext'
import { getReceiptTypeTranslationKey } from '../lib/translateReceiptType'

const SOURCE_LABELS: Record<string, string> = {
  'walk-in': 'واك إن', 'call-in': 'اتصال', suggestion: 'ترشيح', facebook: 'فيسبوك', instagram: 'انستجرام',
  tiktok: 'تيك توك', chatgpt: 'ChatGPT', google_maps: 'خرايط جوجل', website: 'الموقع', friend_referral: 'ترشيح صديق',
  'member-invitation': 'دعوة عضو', invitation: 'دعوة', 'expired-member': 'عضو منتهي', 'expiring-member': 'قرب ينتهي',
}
const sourceLabel = (s: string | null) => (s ? SOURCE_LABELS[s] || s : 'غير محدد')
const genderLabel = (g: string | null) => (g === 'male' ? 'ولد' : g === 'female' ? 'بنت' : 'غير محدد')
const VISITOR_STATUS: Record<string, string> = {
  pending: 'في الانتظار', contacted: 'تم التواصل', subscribed: 'اشترك', not_qualified: 'غير مؤهل', rejected: 'رفض',
}
//  أسماء أنواع الإيصالات بالعربي (الأنواع اللي مش هنا بتتترجم من ملف اللغة أو بتطلع زي ما هي)
const TYPE_LABELS: Record<string, string> = {
  Member: 'اشتراك جديد', member: 'اشتراك جديد', membershipRenewal: 'تجديد عضوية', membershipTransfer: 'نقل عضوية', Payment: 'دفع باقي',
  newPT: 'برايفت جديد', ptRenewal: 'تجديد برايفت', ptDayUse: 'برايفت يوم', pt: 'برايفت',
  dayUse: 'يوم استخدام', DayUse: 'يوم استخدام', inBody: 'InBody', InBody: 'InBody',
  newNutrition: 'تغذية جديد', nutritionRenewal: 'تجديد تغذية', nutritionDayUse: 'تغذية يوم',
  newPhysiotherapy: 'علاج طبيعي جديد', physiotherapyRenewal: 'تجديد علاج طبيعي', physiotherapyDayUse: 'علاج طبيعي يوم',
  moreSubscription: 'مزيد جديد', moreRenewal: 'تجديد مزيد',
  newGroupClass: 'جروب كلاس جديد', groupClassRenewal: 'تجديد جروب كلاس', groupClassDayUse: 'جروب كلاس يوم',
}
const MEMBERSHIP_TYPES = new Set(['Member', 'member', 'membershipRenewal', 'تجديد عضويه', 'تجديد عضوية'])
const isRenewalType = (t: string) => t === 'membershipRenewal' || t.startsWith('تجديد')

const toDate = (v: any): Date | null => {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

export default function FullReportExportButton({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const toast = useToast()
  const { t } = useLanguage()
  const [busy, setBusy] = useState(false)

  const run = async () => {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/reports/full-export?startDate=${dateFrom}&endDate=${dateTo}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'failed')
      const { default: ExcelJS } = await import('exceljs')
      const wb = new ExcelJS.Workbook()
      wb.creator = 'Fitboost'

      const typeLabel = (type: string) => {
        if (TYPE_LABELS[type]) return TYPE_LABELS[type]
        const key = getReceiptTypeTranslationKey(type)
        const tr = key ? t(key as any) : type
        return tr && tr !== key ? tr : type
      }

      // ورقة بهيدر ملوّن + فلتر + تجميد الصف الأول
      const sheet = (title: string, columns: { header: string; key: string; width?: number; fmt?: 'money' | 'date' }[]) => {
        const ws = wb.addWorksheet(title, { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] })
        ws.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width || 16 }))
        const hdr = ws.getRow(1)
        hdr.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial', size: 11 }
        hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } }
        hdr.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        hdr.height = 26
        columns.forEach((c, i) => {
          const col = ws.getColumn(i + 1)
          if (c.fmt === 'money') col.numFmt = '#,##0.##'
          if (c.fmt === 'date') col.numFmt = 'yyyy-mm-dd'
        })
        ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
        return ws
      }

      // ── 1) الإيصالات والاشتراكات ──
      const rs = sheet('الإيصالات والاشتراكات', [
        { header: 'رقم الإيصال', key: 'receiptNumber', width: 11 },
        { header: 'التاريخ', key: 'createdAt', width: 12, fmt: 'date' },
        { header: 'النوع', key: 'type', width: 18 },
        { header: 'كود العضوية', key: 'memberNumber', width: 12 },
        { header: 'العميل', key: 'clientName', width: 24 },
        { header: 'التليفون', key: 'phone', width: 14 },
        { header: 'ولد / بنت', key: 'gender', width: 10 },
        { header: 'المصدر', key: 'source', width: 13 },
        { header: 'السيلز', key: 'salesName', width: 16 },
        { header: 'الباقة', key: 'packageName', width: 18 },
        { header: 'المدة (شهور)', key: 'months', width: 11 },
        { header: 'من', key: 'startDate', width: 12, fmt: 'date' },
        { header: 'إلى', key: 'expiryDate', width: 12, fmt: 'date' },
        { header: 'إجمالي مبلغ الاشتراك', key: 'subscriptionPrice', width: 14, fmt: 'money' },
        { header: 'المدفوع في الإيصال', key: 'amount', width: 14, fmt: 'money' },
        { header: 'الباقي', key: 'remainingAmount', width: 11, fmt: 'money' },
        { header: 'كاش', key: 'cash', width: 11, fmt: 'money' },
        { header: 'فيزا', key: 'visa', width: 11, fmt: 'money' },
        { header: 'إنستاباي', key: 'instapay', width: 11, fmt: 'money' },
        { header: 'محفظة', key: 'wallet', width: 11, fmt: 'money' },
        { header: 'نقاط', key: 'points', width: 9, fmt: 'money' },
        { header: 'الموظف', key: 'staffName', width: 16 },
        { header: 'الحالة', key: 'status', width: 10 },
      ])
      const totals = { cash: 0, visa: 0, instapay: 0, wallet: 0, points: 0, all: 0, refunds: 0 }
      for (const r of data.receipts as any[]) {
        const row = rs.addRow({
          ...r,
          createdAt: toDate(r.createdAt),
          startDate: toDate(r.startDate),
          expiryDate: toDate(r.expiryDate),
          type: typeLabel(r.type),
          gender: genderLabel(r.gender),
          source: sourceLabel(r.source),
          ...r.pay,
          status: r.status === 'refunded' ? 'مرتجع' : r.status === 'cancelled' ? 'ملغي' : '',
        })
        if (r.status !== 'ok') row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE7E7' } }
        if (r.countsAsRevenue) {
          for (const k of ['cash', 'visa', 'instapay', 'wallet', 'points'] as const) totals[k] += r.pay[k] || 0
          totals.all += r.amount || 0
        }
        if (r.status === 'refunded') totals.refunds += r.amount || 0
      }
      const tot = rs.addRow({ type: 'الإجمالي', amount: totals.all, cash: totals.cash, visa: totals.visa, instapay: totals.instapay, wallet: totals.wallet, points: totals.points })
      tot.font = { bold: true }
      tot.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }

      // ── 2) الملخص ──
      const sm = wb.addWorksheet('الملخص', { views: [{ rightToLeft: true }] })
      sm.columns = [{ width: 30 }, { width: 18 }, { width: 14 }]
      const title = (text: string) => {
        const r = sm.addRow([text]); r.font = { bold: true, size: 13, color: { argb: 'FF1F4E78' } }
      }
      const line = (label: string, value: any, extra?: any) => sm.addRow([label, value, extra ?? ''])
      sm.addRow([`الفترة: ${dateFrom} → ${dateTo}`]).font = { bold: true }
      sm.addRow([])
      title('الفلوس حسب طريقة الدفع')
      line('كاش', totals.cash); line('فيزا', totals.visa); line('إنستاباي', totals.instapay); line('محفظة', totals.wallet)
      if (totals.points) line('نقاط', totals.points)
      const ta = line('الإجمالي', totals.all); ta.font = { bold: true }
      if (totals.refunds) { line('المرتجعات', -totals.refunds); const n = line('الصافي', totals.all - totals.refunds); n.font = { bold: true } }
      sm.getColumn(2).numFmt = '#,##0.##'

      //  المشتركين (اشتراكات العضوية جديد + تجديد، غير الملغية) — العضو يتحسب مرة واحدة
      const subs = (data.receipts as any[]).filter(r => MEMBERSHIP_TYPES.has(r.type) && r.status === 'ok')
      const seen = new Set<string>()
      const uniq = subs.filter(r => { const k = r.memberId || r.phone || String(r.receiptNumber); if (seen.has(k)) return false; seen.add(k); return true })
      sm.addRow([])
      title('المشتركين في الفترة (عضوية)')
      line('اشتراك جديد', subs.filter(r => !isRenewalType(r.type)).length)
      line('تجديد', subs.filter(r => isRenewalType(r.type)).length)
      sm.addRow([])
      title('ولد / بنت (عدد المشتركين)')
      for (const g of ['male', 'female', null]) line(genderLabel(g), uniq.filter(r => (r.gender || null) === g || (g === null && r.gender !== 'male' && r.gender !== 'female')).length)
      sm.addRow([])
      title('المصدر (عدد المشتركين)')
      const bySource = new Map<string, number>()
      for (const r of uniq) bySource.set(sourceLabel(r.source), (bySource.get(sourceLabel(r.source)) || 0) + 1)
      ;[...bySource.entries()].sort((a, b) => b[1] - a[1]).forEach(([s, c]) => line(s, c))

      // ── 3) منتهي الاشتراك / 4) عليهم باقي ──
      const memberCols = (withDue: boolean) => [
        { header: 'كود العضوية', key: 'memberNumber', width: 12 },
        { header: 'الاسم', key: 'name', width: 26 },
        { header: 'التليفون', key: 'phone', width: 14 },
        { header: 'تليفون احتياطي', key: 'backupPhone', width: 14 },
        { header: 'ولد / بنت', key: 'gender', width: 10 },
        { header: 'المصدر', key: 'source', width: 13 },
        { header: 'السيلز', key: 'salesName', width: 16 },
        { header: 'الكوتش', key: 'coachName', width: 16 },
        { header: 'تاريخ البداية', key: 'startDate', width: 12, fmt: 'date' as const },
        { header: 'تاريخ الانتهاء', key: 'expiryDate', width: 12, fmt: 'date' as const },
        ...(withDue ? [] : [{ header: 'منتهي من (يوم)', key: 'daysSinceExpiry', width: 12 }]),
        { header: 'إجمالي مبلغ الاشتراك', key: 'subscriptionPrice', width: 14, fmt: 'money' as const },
        { header: 'الباقي', key: 'remainingAmount', width: 12, fmt: 'money' as const },
        ...(withDue ? [{ header: 'موعد الباقي', key: 'remainingDueDate', width: 12, fmt: 'date' as const }] : []),
        { header: 'ملاحظات', key: 'notes', width: 30 },
      ]
      const fillMembers = (ws: any, rows: any[]) => rows.forEach(m => ws.addRow({
        ...m, gender: genderLabel(m.gender), source: sourceLabel(m.source),
        startDate: toDate(m.startDate), expiryDate: toDate(m.expiryDate), remainingDueDate: toDate(m.remainingDueDate),
      }))
      fillMembers(sheet('منتهي الاشتراك', memberCols(false)), data.expired)
      const ds = sheet('عليهم باقي', memberCols(true))
      fillMembers(ds, data.debtors)
      const dt = ds.addRow({ name: 'الإجمالي', remainingAmount: (data.debtors as any[]).reduce((s, m) => s + (m.remainingAmount || 0), 0) })
      dt.font = { bold: true }

      // ── 5) الزوار ──
      const vs = sheet('الزوار', [
        { header: 'الاسم', key: 'name', width: 24 },
        { header: 'التليفون', key: 'phone', width: 14 },
        { header: 'ولد / بنت', key: 'gender', width: 10 },
        { header: 'المصدر', key: 'source', width: 13 },
        { header: 'مهتم بـ', key: 'interestedIn', width: 16 },
        { header: 'الحالة', key: 'status', width: 13 },
        { header: 'السيلز', key: 'salesName', width: 16 },
        { header: 'تاريخ الإضافة', key: 'createdAt', width: 12, fmt: 'date' },
        { header: 'آخر متابعة', key: 'lastFollowUpAt', width: 12, fmt: 'date' },
        { header: 'المتابعة الجاية', key: 'nextFollowUpDate', width: 12, fmt: 'date' },
        { header: 'آخر تعليق', key: 'lastFollowUpNotes', width: 34 },
        { header: 'ملاحظات', key: 'notes', width: 26 },
      ])
      for (const v of data.visitors as any[]) {
        vs.addRow({
          ...v, gender: genderLabel(v.gender), source: sourceLabel(v.source), status: VISITOR_STATUS[v.status] || v.status,
          createdAt: toDate(v.createdAt), lastFollowUpAt: toDate(v.lastFollowUpAt), nextFollowUpDate: toDate(v.nextFollowUpDate),
        })
      }

      const buf = await wb.xlsx.writeBuffer()
      const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `Fitboost_Report_${dateFrom}_${dateTo}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('تم تصدير التقرير الشامل')
    } catch (e) {
      console.error(e)
      toast.error('فشل تصدير التقرير')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="ms-auto inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg font-bold text-sm transition-colors duration-200"
    >
      <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
      {busy ? 'جاري التجهيز...' : 'تقرير Excel شامل'}
    </button>
  )
}

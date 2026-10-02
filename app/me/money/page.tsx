'use client'

export const dynamic = 'force-dynamic'

// 💰 «فلوسي» — مرتب الموظف لحد النهارده (الأساسي، مكافآت، عمولات، خصومات، الصافي)
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '../../../contexts/LanguageContext'
import { LoadingScreen } from '../../../components/Spinner'

interface Money {
  year: number
  month: number
  base: number
  monthlySalary: number
  daysAttended: number
  workingDays: number
  bonuses: { total: number; items: { id: string; amount: number; reason: string }[] }
  commission: { total: number; count: number }
  deductions: {
    absences: { days: number; amount: number }
    unpaidLeave: { days: number; amount: number }
    manual: { total: number; items: { id: string; amount: number; reason: string }[] }
    loans: { total: number }
    lateMinutes: number
  }
  totalEarnings: number
  totalDeductions: number
  net: number
  payslip: { net: number; paidAt: string | null } | null
}

const card = 'bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5'
const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

export default function MyMoneyPage() {
  const { t, locale, direction } = useLanguage()
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 })
  const [data, setData] = useState<Money | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    setData(null)
    setErr('')
    fetch(`/api/me/money?year=${ym.y}&month=${ym.m}`, { cache: 'no-store' })
      .then(async r => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(r.status === 404 ? t('me.noStaff') : j.error || t('me.error'))
        setData(j)
      })
      .catch(e => setErr(e.message))
  }, [ym]) // eslint-disable-line react-hooks/exhaustive-deps

  const shift = (d: number) => setYm(({ y, m }) => {
    const x = new Date(y, m - 1 + d, 1)
    return { y: x.getFullYear(), m: x.getMonth() + 1 }
  })
  const isCurrent = ym.y === now.getFullYear() && ym.m === now.getMonth() + 1
  const monthLabel = new Date(ym.y, ym.m - 1, 1).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' })
  const cur = t('me.egp')

  const Row = ({ label, value, minus, sub }: { label: string; value: number; minus?: boolean; sub?: string }) => (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm text-gray-700 dark:text-gray-200">{label}</p>
        {sub && <p className="text-xs text-gray-500 dark:text-gray-400">{sub}</p>}
      </div>
      <p className={`text-sm font-bold shrink-0 ${minus ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-gray-100'}`} dir="ltr">
        {minus && value > 0 ? '−' : ''}{fmt(value)} {cur}
      </p>
    </div>
  )

  return (
    <div className="max-w-xl mx-auto px-4 py-4 sm:py-6 space-y-4" dir={direction}>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100">💰 {t('me.myMoney')}</h1>
        <Link href="/me" className="shrink-0 px-3 min-h-[40px] inline-flex items-center rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold text-sm">
          📅 {t('me.myDay')}
        </Link>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button onClick={() => shift(-1)} aria-label={t('me.prevMonth')} className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-gray-700 text-lg font-bold rtl:rotate-180">‹</button>
        <p className="font-bold text-gray-800 dark:text-gray-100">{monthLabel}</p>
        <button onClick={() => shift(1)} disabled={isCurrent} aria-label={t('me.nextMonth')} className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-gray-700 text-lg font-bold disabled:opacity-30 rtl:rotate-180">›</button>
      </div>

      {err ? (
        <div className={`${card} text-sm text-amber-700 dark:text-amber-300`}>{err}</div>
      ) : !data ? (
        <LoadingScreen />
      ) : (
        <>
          <div className={`${card} text-center`}>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400">{isCurrent ? t('me.salarySoFar') : t('me.net')}</p>
            <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400 mt-1" dir="ltr">{fmt(data.payslip?.net ?? data.net)} <span className="text-base">{cur}</span></p>
            {data.payslip?.paidAt && <p className="text-xs font-bold text-emerald-600 mt-1">{t('me.paid')}</p>}
            {isCurrent && <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('me.estimateNote')}</p>}
          </div>

          <div className={`${card} divide-y divide-gray-100 dark:divide-gray-700`}>
            <Row label={t('me.baseSalary')} value={data.base} sub={t('me.attendedOf', { a: String(data.daysAttended), w: String(data.workingDays) })} />
            {data.bonuses.total > 0 && <Row label={t('me.bonuses')} value={data.bonuses.total} sub={data.bonuses.items.map(b => b.reason).join('، ')} />}
            {data.commission.total > 0 && <Row label={t('me.commission')} value={data.commission.total} />}
          </div>

          {data.totalDeductions > 0 && (
            <div className={`${card} divide-y divide-gray-100 dark:divide-gray-700`}>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-100 pb-2">{t('me.deductions')}</p>
              {data.deductions.absences.amount > 0 && <Row minus label={t('me.absences', { n: String(data.deductions.absences.days) })} value={data.deductions.absences.amount} />}
              {data.deductions.unpaidLeave.amount > 0 && <Row minus label={t('me.unpaidLeave', { n: String(data.deductions.unpaidLeave.days) })} value={data.deductions.unpaidLeave.amount} />}
              {data.deductions.manual.items.map(d => <Row key={d.id} minus label={t('me.manualDeductions')} sub={d.reason} value={d.amount} />)}
              {data.deductions.loans.total > 0 && <Row minus label={t('me.loans')} value={data.deductions.loans.total} />}
            </div>
          )}

          {data.deductions.lateMinutes > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 px-1">{t('me.lateInfo', { n: String(data.deductions.lateMinutes) })}</p>
          )}

          <Link href="/my-payslips" className={`${card} flex items-center justify-between min-h-[56px] font-bold text-gray-800 dark:text-gray-100`}>
            {t('me.payslipsLeaves')}
          </Link>
        </>
      )}
    </div>
  )
}

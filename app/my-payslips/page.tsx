'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast } from '../../contexts/ToastContext'
import { LoadingScreen } from '../../components/Spinner'
import { usePermissions } from '../../hooks/usePermissions'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

const MONTH_NAMES_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const MONTH_NAMES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

interface PayslipRow {
  id: string
  month: number
  year: number
  baseSalary: number
  totalBonuses: number
  totalCommission: number
  manualDeductions: number
  loansDeducted: number
  absenceDeduction: number
  netSalary: number
  paidAt: string | null
  createdAt: string
}

interface LeaveRow {
  id: string
  startDate: string
  endDate: string
  type: string
  isPaid: boolean
  reason: string | null
  status: string
  createdAt: string
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

export default function MyPayslipsPage() {
  const { locale, direction } = useLanguage()
  const toast = useToast()
  const { user, loading: permsLoading } = usePermissions()
  const [tab, setTab] = useState<'payslips' | 'leaves'>('payslips')
  const [payslips, setPayslips] = useState<PayslipRow[]>([])
  const [leaves, setLeaves] = useState<LeaveRow[]>([])
  const [loading, setLoading] = useState(true)

  // Leave request form state
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [leaveStart, setLeaveStart] = useState('')
  const [leaveEnd, setLeaveEnd] = useState('')
  const [leaveType, setLeaveType] = useState<'annual' | 'paid' | 'sick' | 'unpaid' | 'other'>('annual')
  const [leaveReason, setLeaveReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!user?.staffId) { setLoading(false); return }
    Promise.all([
      fetch('/api/payslips').then(r => r.ok ? r.json() : []),
      fetch(`/api/leaves?staffId=${user.staffId}`).then(r => r.ok ? r.json() : []),
    ]).then(([p, lv]) => {
      setPayslips(p)
      setLeaves(lv)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user?.staffId])

  async function submitLeave() {
    if (!leaveStart || !leaveEnd) { toast.error(locale === 'ar' ? 'كل التواريخ مطلوبة' : 'Both dates required'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: user!.staffId,
          startDate: leaveStart,
          endDate: leaveEnd,
          type: leaveType,
          isPaid: leaveType !== 'unpaid',
          reason: leaveReason || null,
        }),
      })
      if (res.ok) {
        const created = await res.json()
        setLeaves(prev => [created, ...prev])
        toast.success(locale === 'ar' ? 'تم إرسال طلب الإجازة' : 'Leave request submitted')
        setShowLeaveForm(false)
        setLeaveStart(''); setLeaveEnd(''); setLeaveReason(''); setLeaveType('annual')
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Failed')
      }
    } finally { setSubmitting(false) }
  }

  if (permsLoading || loading) return <LoadingScreen fullScreen />

  if (!user?.staffId) {
    return (
      <div className="container mx-auto p-6 text-center" dir={direction}>
        <p className="text-gray-600 dark:text-gray-400">
          {locale === 'ar' ? 'لا يوجد حساب موظف مرتبط بحسابك' : 'No staff record linked to your account'}
        </p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-3 sm:p-6" dir={direction}>
      <div className="mb-5 sm:mb-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <svg {...stroke} className="w-6 h-6 sm:w-7 sm:h-7 text-primary-600 dark:text-primary-400" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
          <span>{locale === 'ar' ? 'بياناتي' : 'My Records'}</span>
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1">
          {locale === 'ar' ? 'مرتباتي وطلبات إجازاتي' : 'My payslips and leave requests'}
        </p>
      </div>

      <div className="flex gap-2 mb-5 border-b border-gray-200 dark:border-gray-700">
        <button onClick={() => setTab('payslips')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${tab === 'payslips' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
          {locale === 'ar' ? 'مرتباتي' : 'My Payslips'}
        </button>
        <button onClick={() => setTab('leaves')} className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${tab === 'leaves' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
          {locale === 'ar' ? 'إجازاتي' : 'My Leaves'}
        </button>
      </div>

      {tab === 'payslips' ? (
        payslips.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-12 flex flex-col items-center justify-center text-center">
            <svg {...stroke} className="w-12 h-12 text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z" />
            </svg>
            <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">
              {locale === 'ar' ? 'مفيش مرتبات لسه' : 'No payslips yet'}
            </h3>
          </div>
        ) : (
          <div className="space-y-3">
            {payslips.map(p => {
              const monthName = (locale === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN)[p.month - 1]
              const earningsTotal = p.baseSalary + p.totalBonuses + p.totalCommission
              const deductionsTotal = p.absenceDeduction + p.manualDeductions + p.loansDeducted
              return (
                <Link
                  key={p.id}
                  href={`/payroll/payslip/${p.id}`}
                  className="block bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">{monthName} {p.year}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {locale === 'ar' ? 'إنشاء' : 'Generated'}: {new Date(p.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
                      </p>
                    </div>
                    {p.paidAt ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                        ✓ {locale === 'ar' ? 'مدفوع' : 'Paid'}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 whitespace-nowrap">
                        {locale === 'ar' ? 'في الانتظار' : 'Pending'}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'الإيرادات' : 'Earnings'}</p>
                      <p className="font-bold text-emerald-700 dark:text-emerald-400">{fmt(earningsTotal)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'الخصومات' : 'Deductions'}</p>
                      <p className="font-bold text-red-700 dark:text-red-400">−{fmt(deductionsTotal)}</p>
                    </div>
                    <div className="text-end">
                      <p className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'الصافي' : 'Net'}</p>
                      <p className="text-lg font-bold text-primary-700 dark:text-primary-400">{fmt(p.netSalary)} <span className="text-xs">ج.م</span></p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowLeaveForm(true)} className="bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2 rounded-lg text-sm">
              {locale === 'ar' ? '+ طلب إجازة' : '+ Request Leave'}
            </button>
          </div>

          {leaves.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-12 flex flex-col items-center justify-center text-center">
              <p className="text-gray-600 dark:text-gray-400 font-bold">{locale === 'ar' ? 'مفيش طلبات إجازة' : 'No leave requests'}</p>
            </div>
          ) : (
            leaves.map(lv => (
              <div key={lv.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-gray-900 dark:text-gray-100">
                      {new Date(lv.startDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
                      {' → '}
                      {new Date(lv.endDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {locale === 'ar'
                        ? (lv.type === 'annual' ? 'سنوية' : lv.type === 'paid' ? 'إجازة مدفوعة' : lv.type === 'sick' ? 'مرضية' : lv.type === 'unpaid' ? 'بدون مرتب' : 'أخرى')
                        : lv.type}
                      {lv.isPaid ? ` · ${locale === 'ar' ? 'مدفوعة' : 'Paid'}` : ` · ${locale === 'ar' ? 'بدون مرتب' : 'Unpaid'}`}
                    </p>
                    {lv.reason && <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{lv.reason}</p>}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                    lv.status === 'approved' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                    : lv.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                    : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                  }`}>
                    {locale === 'ar'
                      ? (lv.status === 'approved' ? '✓ موافق عليها' : lv.status === 'rejected' ? '✗ مرفوضة' : 'في الانتظار')
                      : lv.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showLeaveForm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in" onClick={(e) => { if (e.target === e.currentTarget) setShowLeaveForm(false) }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-md w-full max-h-[92vh] overflow-y-auto animate-modal-in" dir={direction}>
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{locale === 'ar' ? 'طلب إجازة' : 'Request Leave'}</h2>
              <button onClick={() => setShowLeaveForm(false)} aria-label="Close" className="w-9 h-9 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center">
                <svg {...stroke} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{locale === 'ar' ? 'من' : 'From'}</label>
                  <input type="date" value={leaveStart} onChange={e => setLeaveStart(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{locale === 'ar' ? 'إلى' : 'To'}</label>
                  <input type="date" value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} min={leaveStart} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{locale === 'ar' ? 'النوع' : 'Type'}</label>
                <select value={leaveType} onChange={e => setLeaveType(e.target.value as any)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                  <option value="annual">{locale === 'ar' ? 'سنوية (مدفوعة)' : 'Annual (Paid)'}</option>
                  <option value="paid">{locale === 'ar' ? 'إجازة مدفوعة' : 'Paid Leave'}</option>
                  <option value="sick">{locale === 'ar' ? 'مرضية' : 'Sick'}</option>
                  <option value="unpaid">{locale === 'ar' ? 'بدون مرتب' : 'Unpaid'}</option>
                  <option value="other">{locale === 'ar' ? 'أخرى' : 'Other'}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{locale === 'ar' ? 'السبب' : 'Reason'}</label>
                <textarea value={leaveReason} onChange={e => setLeaveReason(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {locale === 'ar' ? 'الطلب سيُرسل للمراجعة قبل الموافقة' : 'Request will be submitted for review'}
              </p>
              <button onClick={submitLeave} disabled={submitting} className="w-full min-h-[44px] bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold rounded-lg disabled:opacity-60">
                {submitting ? '...' : (locale === 'ar' ? 'إرسال الطلب' : 'Submit Request')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

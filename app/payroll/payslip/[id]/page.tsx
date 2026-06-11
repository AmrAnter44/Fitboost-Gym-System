'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useLanguage } from '../../../../contexts/LanguageContext'
import { useServiceSettings } from '../../../../contexts/ServiceSettingsContext'
import { useToast } from '../../../../contexts/ToastContext'
import { usePermissions } from '../../../../hooks/usePermissions'
import { LoadingScreen } from '../../../../components/Spinner'
import type { PayrollBreakdown } from '../../../../lib/payroll/types'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

const MONTH_NAMES_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const MONTH_NAMES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function fmt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

interface PayslipRecord {
  id: string
  staffId: string
  month: number
  year: number
  baseSalary: number
  totalBonuses: number
  totalCommission: number
  absenceDays: number
  absenceDeduction: number
  lateMinutes: number
  manualDeductions: number
  loansDeducted: number
  netSalary: number
  paidAt: string | null
  paymentMethod: string | null
  paymentNote: string | null
  voidedAt: string | null
  voidedBy: string | null
  voidReason: string | null
  createdAt: string
  staff: { id: string; name: string; staffCode: string; position: string | null; phone: string | null }
  breakdown: PayrollBreakdown | null
}

export default function PayslipPage() {
  const params = useParams()
  const { locale, direction } = useLanguage()
  const { settings } = useServiceSettings()
  const toast = useToast()
  const { user } = usePermissions()
  const id = params?.id as string
  const [payslip, setPayslip] = useState<PayslipRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [sendingWa, setSendingWa] = useState(false)

  const isAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN'

  async function sendOnWhatsApp() {
    if (!payslip?.staff.phone) {
      toast.error(locale === 'ar' ? 'الموظف ليس له رقم هاتف' : 'Staff has no phone number')
      return
    }
    setSendingWa(true)
    try {
      const monthName = (locale === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN)[payslip.month - 1]
      const message = locale === 'ar'
        ? `مرحباً ${payslip.staff.name},\nراتب شهر ${monthName} ${payslip.year}:\n• الأساسي: ${fmt(payslip.baseSalary)}\n• مكافآت: ${fmt(payslip.totalBonuses)}\n• عمولة: ${fmt(payslip.totalCommission)}\n• خصومات: -${fmt(payslip.absenceDeduction + payslip.manualDeductions + payslip.loansDeducted)}\n━━━━━━━━━━\n• الصافي: ${fmt(payslip.netSalary)} ج.م\n\n${settings.gymName || 'Fitboost'}`
        : `Hello ${payslip.staff.name},\n${monthName} ${payslip.year} Payslip:\n• Base: ${fmt(payslip.baseSalary)}\n• Bonus: ${fmt(payslip.totalBonuses)}\n• Commission: ${fmt(payslip.totalCommission)}\n• Deductions: -${fmt(payslip.absenceDeduction + payslip.manualDeductions + payslip.loansDeducted)}\n━━━━━━━━━━\n• Net: ${fmt(payslip.netSalary)} EGP\n\n${settings.gymName || 'Fitboost'}`

      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: payslip.staff.phone, message }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(locale === 'ar' ? 'تم الإرسال بنجاح' : 'Sent successfully')
      } else {
        toast.error(data.error || (locale === 'ar' ? 'فشل الإرسال' : 'Failed to send'))
      }
    } catch {
      toast.error(locale === 'ar' ? 'فشل الإرسال' : 'Failed to send')
    } finally {
      setSendingWa(false)
    }
  }

  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ paymentMethod: 'cash', paymentNote: '' })
  const [showVoidModal, setShowVoidModal] = useState(false)
  const [voidReason, setVoidReason] = useState('')

  async function markPaidWithMethod() {
    if (!payslip) return
    const res = await fetch(`/api/payslips/${payslip.id}/mark-paid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod: paymentForm.paymentMethod, paymentNote: paymentForm.paymentNote || null }),
    })
    if (res.ok) {
      toast.success(locale === 'ar' ? 'تم تحديث الحالة' : 'Status updated')
      const updated = await fetch(`/api/payslips/${payslip.id}`).then(r => r.json())
      setPayslip(updated)
      setShowPaymentMethodModal(false)
    }
  }

  async function markUnpaid() {
    if (!payslip) return
    const res = await fetch(`/api/payslips/${payslip.id}/mark-paid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unpaid: true }),
    })
    if (res.ok) {
      const updated = await fetch(`/api/payslips/${payslip.id}`).then(r => r.json())
      setPayslip(updated)
      toast.success(locale === 'ar' ? 'تم التحديث' : 'Updated')
    }
  }

  async function voidThisPayslip() {
    if (!payslip) return
    const res = await fetch(`/api/payslips/${payslip.id}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: voidReason || null }),
    })
    if (res.ok) {
      toast.success(locale === 'ar' ? 'تم إلغاء الـ payslip وعكس الخصومات' : 'Payslip voided and deductions reversed')
      const updated = await fetch(`/api/payslips/${payslip.id}`).then(r => r.json())
      setPayslip(updated)
      setShowVoidModal(false)
    } else {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error || (locale === 'ar' ? 'فشل الإلغاء' : 'Failed to void'))
    }
  }

  async function downloadAsPdf() {
    // Dynamically import to keep bundle small. Use html2canvas + jsPDF.
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      const node = document.getElementById('payslip-print-area')
      if (!node) return
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff' })
      const img = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const ratio = canvas.height / canvas.width
      const imgH = pageW * ratio
      pdf.addImage(img, 'PNG', 0, 0, pageW, imgH)
      pdf.save(`payslip-${payslip?.staff.staffCode}-${payslip?.year}-${String(payslip?.month).padStart(2, '0')}.pdf`)
    } catch (err: any) {
      console.error(err)
      toast.error(locale === 'ar' ? 'فشل تحميل PDF — جرّب الطباعة بدلاً منها' : 'PDF download failed — try Print instead')
    }
  }

  useEffect(() => {
    if (!id) return
    fetch(`/api/payslips/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then((d) => { setPayslip(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return <LoadingScreen fullScreen />
  if (!payslip) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <p className="text-red-600 dark:text-red-400">{locale === 'ar' ? 'الإيصال غير موجود' : 'Payslip not found'}</p>
    </div>
  )

  const monthName = (locale === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN)[payslip.month - 1]
  const gymName = settings.gymName || 'Fitboost'

  const earningsTotal = payslip.baseSalary + payslip.totalBonuses + payslip.totalCommission
  const deductionsTotal = payslip.absenceDeduction + payslip.manualDeductions + payslip.loansDeducted

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-6 print:py-0 print:bg-white" dir={direction}>
      <div className="max-w-[800px] mx-auto bg-white shadow-xl print:shadow-none">
        {/* Print actions — hidden on print */}
        <div className="px-6 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between no-print">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-200 transition-colors"
          >
            <svg {...stroke} className={`w-4 h-4 ${direction === 'rtl' ? 'rotate-180' : ''}`}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"/></svg>
            <span>{locale === 'ar' ? 'رجوع' : 'Back'}</span>
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && !payslip.voidedAt && (
              <>
                {!payslip.paidAt && (
                  <button
                    onClick={() => setShowPaymentMethodModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm transition-colors"
                  >
                    <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>
                    <span>{locale === 'ar' ? 'حدد كمدفوع' : 'Mark Paid'}</span>
                  </button>
                )}
                {payslip.paidAt && (
                  <button
                    onClick={markUnpaid}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-lg text-sm transition-colors"
                  >
                    <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    <span>{locale === 'ar' ? 'إلغاء التحديد' : 'Unmark Paid'}</span>
                  </button>
                )}
                <button
                  onClick={() => setShowVoidModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm transition-colors"
                >
                  <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>
                  <span>{locale === 'ar' ? 'إلغاء' : 'Void'}</span>
                </button>
                {payslip.staff.phone && (
                  <button
                    onClick={sendOnWhatsApp}
                    disabled={sendingWa}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg text-sm transition-colors disabled:opacity-60"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487 4.092 1.767 4.092 1.178 4.83 1.104.738-.075 2.379-.972 2.715-1.91.336-.937.336-1.741.235-1.91-.099-.17-.371-.272-.768-.471"/></svg>
                    <span>{sendingWa ? '...' : 'WhatsApp'}</span>
                  </button>
                )}
              </>
            )}
            <button
              onClick={downloadAsPdf}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-lg text-sm transition-colors"
            >
              <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>
              <span>PDF</span>
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold rounded-lg text-sm transition-colors"
            >
              <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z"/></svg>
              <span>{locale === 'ar' ? 'طباعة' : 'Print'}</span>
            </button>
          </div>
        </div>

        {/* Voided / Paid banners */}
        {payslip.voidedAt && (
          <div className="px-6 py-3 bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 text-sm font-bold border-b border-red-300 dark:border-red-800 no-print">
            ⚠ {locale === 'ar' ? 'هذا الـ payslip ملغي في ' : 'This payslip was voided on '}
            {new Date(payslip.voidedAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
            {payslip.voidReason && <span className="block text-xs font-normal mt-0.5">{payslip.voidReason}</span>}
          </div>
        )}
        {payslip.paidAt && payslip.paymentMethod && (
          <div className="px-6 py-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 text-sm font-bold border-b border-emerald-200 dark:border-emerald-800 no-print">
            ✓ {locale === 'ar' ? `مدفوع via ${payslip.paymentMethod}` : `Paid via ${payslip.paymentMethod}`}
            {payslip.paymentNote && <span className="block text-xs font-normal mt-0.5">{payslip.paymentNote}</span>}
          </div>
        )}

        {/* Document — print-friendly */}
        <div id="payslip-print-area" className="p-8 print:p-6 text-gray-900" style={{ minHeight: '297mm' }}>
          {/* Header */}
          <div className="border-b-2 border-primary-500 pb-4 mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">{gymName}</h1>
                <p className="text-xs text-gray-600">{locale === 'ar' ? 'إيصال راتب' : 'Payslip'}</p>
              </div>
              <div className="text-end text-xs text-gray-600">
                <p>#{payslip.id.slice(-8).toUpperCase()}</p>
                <p>{locale === 'ar' ? 'تاريخ الإنشاء' : 'Generated'}: {new Date(payslip.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}</p>
              </div>
            </div>
          </div>

          {/* Staff info */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold">{locale === 'ar' ? 'الموظف' : 'Employee'}</p>
              <p className="font-bold text-lg">{payslip.staff.name}</p>
              <p className="text-xs font-mono">#{payslip.staff.staffCode}</p>
              {payslip.staff.position && <p className="text-xs text-gray-600 mt-0.5">{payslip.staff.position}</p>}
            </div>
            <div className="text-end">
              <p className="text-xs text-gray-500 uppercase font-bold">{locale === 'ar' ? 'الشهر' : 'Pay Period'}</p>
              <p className="font-bold text-lg">{monthName} {payslip.year}</p>
              {payslip.paidAt && (
                <p className="text-xs text-emerald-600 font-bold mt-0.5">✓ {locale === 'ar' ? 'مدفوع في' : 'Paid on'} {new Date(payslip.paidAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}</p>
              )}
            </div>
          </div>

          {/* Earnings table */}
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="bg-emerald-50 border-y border-emerald-200">
                <th className="px-3 py-2 text-start font-bold text-emerald-800">{locale === 'ar' ? 'الإيرادات' : 'Earnings'}</th>
                <th className="px-3 py-2 text-end font-bold text-emerald-800">{locale === 'ar' ? 'المبلغ (ج.م)' : 'Amount (EGP)'}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-2">{locale === 'ar' ? 'الراتب الأساسي' : 'Base salary'}</td>
                <td className="px-3 py-2 text-end font-mono">{fmt(payslip.baseSalary)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-2">{locale === 'ar' ? 'مكافآت' : 'Bonuses'}</td>
                <td className="px-3 py-2 text-end font-mono">{fmt(payslip.totalBonuses)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-2">{locale === 'ar' ? 'عمولة' : 'Commission'}</td>
                <td className="px-3 py-2 text-end font-mono">{fmt(payslip.totalCommission)}</td>
              </tr>
              <tr className="bg-emerald-50 font-bold">
                <td className="px-3 py-2">{locale === 'ar' ? 'إجمالي الإيرادات' : 'Total earnings'}</td>
                <td className="px-3 py-2 text-end font-mono text-emerald-700">{fmt(earningsTotal)}</td>
              </tr>
            </tbody>
          </table>

          {/* Deductions table */}
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="bg-red-50 border-y border-red-200">
                <th className="px-3 py-2 text-start font-bold text-red-800">{locale === 'ar' ? 'الخصومات' : 'Deductions'}</th>
                <th className="px-3 py-2 text-end font-bold text-red-800">{locale === 'ar' ? 'المبلغ (ج.م)' : 'Amount (EGP)'}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-2">{locale === 'ar' ? `غياب (${payslip.absenceDays} أيام)` : `Absences (${payslip.absenceDays} days)`}</td>
                <td className="px-3 py-2 text-end font-mono">{fmt(payslip.absenceDeduction)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-2">{locale === 'ar' ? 'خصومات يدوية' : 'Manual deductions'}</td>
                <td className="px-3 py-2 text-end font-mono">{fmt(payslip.manualDeductions)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-2">{locale === 'ar' ? 'سلف' : 'Loans'}</td>
                <td className="px-3 py-2 text-end font-mono">{fmt(payslip.loansDeducted)}</td>
              </tr>
              <tr className="bg-red-50 font-bold">
                <td className="px-3 py-2">{locale === 'ar' ? 'إجمالي الخصومات' : 'Total deductions'}</td>
                <td className="px-3 py-2 text-end font-mono text-red-700">−{fmt(deductionsTotal)}</td>
              </tr>
            </tbody>
          </table>

          {/* Late note */}
          {payslip.lateMinutes > 0 && (
            <p className="text-xs text-gray-500 italic mb-4">
              {locale === 'ar' ? `* تم تسجيل ${payslip.lateMinutes} دقيقة تأخير هذا الشهر (لم تُخصم تلقائياً)` : `* ${payslip.lateMinutes} late minutes recorded this month (not auto-deducted)`}
            </p>
          )}

          {/* Net */}
          <div className="bg-primary-500 text-primary-contrast rounded-lg p-4 flex justify-between items-center">
            <span className="text-lg font-bold uppercase">{locale === 'ar' ? 'الصافي المستحق' : 'Net Payable'}</span>
            <span className="text-3xl font-bold">{fmt(payslip.netSalary)} <span className="text-base">ج.م</span></span>
          </div>

          {/* Signature lines */}
          <div className="grid grid-cols-2 gap-8 mt-12 text-xs">
            <div>
              <div className="border-t border-gray-400 pt-2">{locale === 'ar' ? 'توقيع المدير' : 'Manager Signature'}</div>
            </div>
            <div>
              <div className="border-t border-gray-400 pt-2">{locale === 'ar' ? 'توقيع الموظف' : 'Employee Signature'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Method modal */}
      {showPaymentMethodModal && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in no-print"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPaymentMethodModal(false) }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-md w-full animate-modal-in" dir={direction}>
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {locale === 'ar' ? 'تأكيد الدفع' : 'Confirm Payment'}
              </h2>
              <button onClick={() => setShowPaymentMethodModal(false)} aria-label="Close" className="w-9 h-9 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center">
                <svg {...stroke} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-3">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{locale === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={e => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="cash">{locale === 'ar' ? 'كاش' : 'Cash'}</option>
                  <option value="bank_transfer">{locale === 'ar' ? 'تحويل بنكي' : 'Bank Transfer'}</option>
                  <option value="instapay">InstaPay</option>
                  <option value="other">{locale === 'ar' ? 'أخرى' : 'Other'}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{locale === 'ar' ? 'مرجع (اختياري)' : 'Reference (optional)'}</label>
                <input
                  type="text"
                  value={paymentForm.paymentNote}
                  onChange={e => setPaymentForm({ ...paymentForm, paymentNote: e.target.value })}
                  placeholder={locale === 'ar' ? 'مثال: رقم التحويل' : 'e.g. transfer ID'}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={markPaidWithMethod} className="flex-1 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg">
                  {locale === 'ar' ? 'تأكيد' : 'Confirm'}
                </button>
                <button onClick={() => setShowPaymentMethodModal(false)} className="flex-1 min-h-[44px] bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-lg">
                  {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Void modal */}
      {showVoidModal && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in no-print"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setShowVoidModal(false) }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-red-300 dark:ring-red-900/50 max-w-md w-full animate-modal-in" dir={direction}>
            <div className="px-4 sm:px-6 py-4 border-b border-red-200 dark:border-red-900/50 flex items-center justify-between">
              <h2 className="text-lg font-bold text-red-700 dark:text-red-300">
                {locale === 'ar' ? 'إلغاء الـ Payslip' : 'Void Payslip'}
              </h2>
              <button onClick={() => setShowVoidModal(false)} aria-label="Close" className="w-9 h-9 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center">
                <svg {...stroke} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-3">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {locale === 'ar' ? 'سيتم عكس كل الخصومات والسلف اللي اتطبقت من الـ payslip ده. الـ payslip نفسه هيفضل في الـ history بس "ملغي".' : 'All deductions and loans applied by this payslip will be reversed. The payslip itself stays in history marked as "voided".'}
              </p>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{locale === 'ar' ? 'السبب (اختياري)' : 'Reason (optional)'}</label>
                <input
                  type="text"
                  value={voidReason}
                  onChange={e => setVoidReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={voidThisPayslip} className="flex-1 min-h-[44px] bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg">
                  {locale === 'ar' ? 'تأكيد الإلغاء' : 'Confirm Void'}
                </button>
                <button onClick={() => setShowVoidModal(false)} className="flex-1 min-h-[44px] bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-lg">
                  {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body, html { background: white !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  )
}

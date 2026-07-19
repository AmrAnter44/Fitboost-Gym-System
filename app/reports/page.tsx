'use client'

import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import ExcelJS from 'exceljs'
import { useLanguage } from '../../contexts/LanguageContext'
import { usePermissions } from '../../hooks/usePermissions'
import { fetchReceipts } from '../../lib/api/receipts'
import { fetchFollowUpsData } from '../../lib/api/followups'
import { fetchPTSessions } from '../../lib/api/pt'
import { fetchStaff } from '../../lib/api/staff'
import { useToast } from '../../contexts/ToastContext'
import { LoadingScreen } from '../../components/Spinner'
import { isPTReceipt } from '../../lib/translateReceiptType'
import { countsAsRevenue } from '../../lib/revenueFilters'

export const dynamic = 'force-dynamic'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

const IconChartBar = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
  </svg>
)
const IconMoney = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V12Zm-12 0h.008v.008H6V12Z" />
  </svg>
)
const IconNote = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
  </svg>
)
const IconDumbbell = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9v6m12-6v6M3 10.5v3m18-3v3M9 6v12m6-12v12" />
  </svg>
)
const IconUsers = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
  </svg>
)
const IconReceipt = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 3h6m2 6.75H7A2.25 2.25 0 0 1 4.75 19.5V4.5A2.25 2.25 0 0 1 7 2.25h10A2.25 2.25 0 0 1 19.25 4.5v15A2.25 2.25 0 0 1 17 21.75Z" />
  </svg>
)
const IconClock = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
)
const IconDownload = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
)
const IconInbox = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z" />
  </svg>
)

type TabType = 'revenue' | 'followups' | 'pt' | 'staff'

const TAB_ICONS: Record<TabType, (p: { className?: string }) => JSX.Element> = {
  revenue: IconMoney,
  followups: IconNote,
  pt: IconDumbbell,
  staff: IconUsers,
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200'
const labelCls = 'block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5'

export default function ReportsPage() {
  const { t, locale, direction } = useLanguage()
  const { hasPermission, user, loading: permLoading } = usePermissions()

  const [activeTab, setActiveTab] = useState<TabType>('revenue')
  //  نبني الـ ISO date من المكوّنات المحلية (year/month/day) عشان نتجنّب
  // الـ timezone shift اللي بيخلي toISOString() يرجّع يوم 31 من الشهر اللي فات
  // (مثلاً في مصر UTC+3، يوم 1 الساعة 1 صباحاً = يوم 31 الساعة 22 UTC)
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}-01`
  })
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  })
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  if (permLoading) return <LoadingScreen fullScreen />
  if (!hasPermission('canViewReports' as any) && !hasPermission('canViewFinancials' as any)) {
    return <div className="flex items-center justify-center min-h-screen"><p className="text-lg text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'ليس لديك صلاحية' : 'Permission denied'}</p></div>
  }

  const isAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN'
  const dateLocale = direction === 'rtl' ? 'ar-EG' : 'en-US'
  const formatDate = (d: string | Date | null) => d ? new Date(d).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' }) : '-'
  const formatCurrency = (n: number) => `${n.toLocaleString()} ${locale === 'ar' ? 'ج.م' : 'EGP'}`

  const tabs: { id: TabType; label: string }[] = [
    { id: 'revenue', label: t('reports.tabs.revenue' as any) },
    { id: 'followups', label: t('reports.tabs.followups' as any) },
    { id: 'pt', label: t('reports.tabs.pt' as any) },
    { id: 'staff', label: t('reports.tabs.staff' as any) },
  ]

  return (
    <div className="container mx-auto p-3 md:p-6 min-h-screen" dir={direction}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <span className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center">
            <IconChartBar className="w-5 h-5" />
          </span>
          {t('reports.title' as any)}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('reports.subtitle' as any)}</p>
      </div>

      {/* Date Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 mb-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className={labelCls}>{t('reports.dateFrom' as any)}</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{t('reports.dateTo' as any)}</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {tabs.map(tab => {
          const Icon = TAB_ICONS[tab.id]
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
              aria-current={active ? 'page' : undefined}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-colors duration-200 ring-1 ${
                active
                  ? 'bg-primary-500 text-primary-contrast ring-primary-500'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'revenue' && <RevenueTab dateFrom={dateFrom} dateTo={dateTo} paymentFilter={paymentFilter} setPaymentFilter={setPaymentFilter} typeFilter={typeFilter} setTypeFilter={setTypeFilter} formatDate={formatDate} formatCurrency={formatCurrency} direction={direction} locale={locale} t={t} />}
      {activeTab === 'followups' && <FollowupsTab dateFrom={dateFrom} dateTo={dateTo} formatDate={formatDate} direction={direction} locale={locale} t={t} />}
      {activeTab === 'pt' && <PTTab dateFrom={dateFrom} dateTo={dateTo} formatDate={formatDate} formatCurrency={formatCurrency} direction={direction} locale={locale} t={t} />}
      {activeTab === 'staff' && <StaffTab dateFrom={dateFrom} dateTo={dateTo} formatDate={formatDate} formatCurrency={formatCurrency} direction={direction} locale={locale} t={t} isAdmin={isAdmin} />}
    </div>
  )
}

const exportBtnCls = 'inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2'

const tableHeadCls = 'bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300 uppercase text-xs'
const tableThCls = 'px-4 py-3 text-start font-bold'
const tableTdCls = 'px-4 py-3 text-gray-700 dark:text-gray-300'
const tableTrCls = 'hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors'

// =========== REVENUE TAB ===========
function RevenueTab({ dateFrom, dateTo, paymentFilter, setPaymentFilter, typeFilter, setTypeFilter, formatDate, formatCurrency, direction, locale, t }: any) {
  const toast = useToast()
  const { data: receipts = [], isLoading } = useQuery({ queryKey: ['receipts'], queryFn: fetchReceipts })

  const filtered = useMemo(() => {
    const from = new Date(dateFrom); from.setHours(0, 0, 0, 0)
    const to = new Date(dateTo); to.setHours(23, 59, 59, 999)
    return receipts.filter((r: any) => {
      const d = new Date(r.createdAt)
      if (d < from || d > to) return false
      //  بنعرض كل الإيصالات بما فيها الملغية — الملغي بيتعلّم عليه X أحمر
      if (paymentFilter !== 'all' && (r.paymentMethod || '').toLowerCase() !== paymentFilter) return false
      if (typeFilter !== 'all' && r.type !== typeFilter) return false
      return true
    })
  }, [receipts, dateFrom, dateTo, paymentFilter, typeFilter])

  //  المرتجع = ملغي اتحدّدله طريقة استرجاع · الملغي = ملغي من غير استرجاع
  const isRefunded = (r: any) => !!r.isCancelled && !!r.refundMethod
  const isVoided = (r: any) => !!r.isCancelled && !r.refundMethod
  const total = useMemo(() => filtered.filter((r: any) => countsAsRevenue(r)).reduce((s: number, r: any) => s + (r.amount || 0), 0), [filtered]) // إجمالي (زي التقفيل)
  const refundsTotal = useMemo(() => filtered.filter((r: any) => isRefunded(r)).reduce((s: number, r: any) => s + (r.amount || 0), 0), [filtered])
  const netTotal = total - refundsTotal // الصافي بعد المرتجعات

  const receiptTypes = useMemo(() => [...new Set(receipts.map((r: any) => r.type).filter(Boolean))], [receipts])
  const paymentMethods = useMemo(() => [...new Set(receipts.map((r: any) => (r.paymentMethod || '').toLowerCase()).filter(Boolean))], [receipts])

  const getClientName = (r: any) => {
    try {
      const details = typeof r.itemDetails === 'string' ? JSON.parse(r.itemDetails) : r.itemDetails
      return details?.memberName || details?.clientName || details?.name || '-'
    } catch { return '-' }
  }

  const exportExcel = async () => {
    try {
      const wb = new ExcelJS.Workbook()
      wb.creator = 'Fitboost'
      const ws = wb.addWorksheet(t('reports.tabs.revenue' as any), { views: [{ rightToLeft: direction === 'rtl' }] })

      const statusLabel = locale === 'ar' ? 'الحالة' : 'Status'
      const hdr = ws.addRow([t('reports.receiptNumber' as any), t('reports.date' as any), t('reports.type' as any), t('reports.amount' as any), t('reports.paymentMethod' as any), t('reports.client' as any), t('reports.staff' as any), statusLabel])
      hdr.font = { bold: true, size: 12, name: 'Arial' }
      hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
      hdr.font = { bold: true, size: 12, name: 'Arial', color: { argb: 'FFFFFFFF' } }
      hdr.alignment = { horizontal: 'center', vertical: 'middle' }
      hdr.height = 28

      filtered.forEach((r: any, i: number) => {
        const refunded = isRefunded(r)
        const voided = isVoided(r)
        const cancelled = refunded || voided
        const status = refunded ? (locale === 'ar' ? 'مرتجع ✗' : 'Refunded ✗') : voided ? (locale === 'ar' ? 'ملغي ✗' : 'Cancelled ✗') : ''
        const row = ws.addRow([r.receiptNumber || '-', formatDate(r.createdAt), r.type || '-', r.amount || 0, r.paymentMethod || '-', getClientName(r), r.staffName || '-', status])
        if (cancelled) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE7E7' } }
        else if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
        row.alignment = { horizontal: 'center', vertical: 'middle' }
      })

      const totRow = ws.addRow(['', '', locale === 'ar' ? 'الإجمالي' : 'Total', total, '', `${filtered.length} ${t('reports.count' as any)}`, '', ''])
      totRow.font = { bold: true, size: 13, name: 'Arial' }
      totRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD700' } }
      if (refundsTotal > 0) {
        ws.addRow(['', '', locale === 'ar' ? 'المرتجعات' : 'Refunds', -refundsTotal, '', '', '', '']).font = { bold: true, name: 'Arial', color: { argb: 'FFC00000' } }
        const netRow = ws.addRow(['', '', locale === 'ar' ? 'الصافي' : 'Net', netTotal, '', '', '', ''])
        netRow.font = { bold: true, size: 13, name: 'Arial' }
        netRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } }
      }

      ws.columns = [{ width: 14 }, { width: 16 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 22 }, { width: 18 }, { width: 14 }]

      const buf = await wb.xlsx.writeBuffer()
      downloadBuffer(buf, `Revenue_${dateFrom}_${dateTo}.xlsx`)
      toast.success(t('reports.exportSuccess' as any))
    } catch { toast.error(t('reports.exportError' as any)) }
  }

  if (isLoading) return <Loading />

  return (
    <div>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 mb-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className={labelCls}>{t('reports.paymentMethod' as any)}</label>
          <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className={inputCls}>
            <option value="all">{t('reports.all' as any)}</option>
            {paymentMethods.map((m: string) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>{t('reports.receiptType' as any)}</label>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className={inputCls}>
            <option value="all">{t('reports.all' as any)}</option>
            {receiptTypes.map((tp: string) => <option key={tp} value={tp}>{tp}</option>)}
          </select>
        </div>
        <button onClick={exportExcel} type="button" className={exportBtnCls}>
          <IconDownload className="w-4 h-4" />
          <span>{t('reports.exportExcel' as any)}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <SummaryCard Icon={IconReceipt} label={t('reports.count' as any)} value={filtered.length} />
        <SummaryCard Icon={IconMoney} label={locale === 'ar' ? 'الإجمالي' : 'Total'} value={formatCurrency(total)} />
        <SummaryCard Icon={IconMoney} label={locale === 'ar' ? 'المرتجعات' : 'Refunds'} value={formatCurrency(refundsTotal)} />
        <SummaryCard Icon={IconMoney} label={locale === 'ar' ? 'الصافي' : 'Net'} value={formatCurrency(netTotal)} />
      </div>

      {filtered.length === 0 ? <NoData t={t} /> : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={tableHeadCls}>
              <tr>
                {[t('reports.receiptNumber' as any), t('reports.date' as any), t('reports.type' as any), t('reports.amount' as any), t('reports.paymentMethod' as any), t('reports.client' as any), t('reports.staff' as any)].map((h, i) =>
                  <th key={i} className={tableThCls}>{h}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {filtered.map((r: any, i: number) => {
                const refunded = isRefunded(r)
                const voided = isVoided(r)
                const cancelled = refunded || voided
                return (
                <tr key={r.id || i} className={`${tableTrCls} ${cancelled ? 'bg-red-50/60 dark:bg-red-900/10' : ''}`}>
                  <td className={`${tableTdCls} font-mono ${cancelled ? 'text-red-500 dark:text-red-400' : ''}`}>{r.receiptNumber || '-'}</td>
                  <td className={tableTdCls}>{formatDate(r.createdAt)}</td>
                  <td className={tableTdCls}>
                    <div className="inline-flex items-center gap-2">
                      <span className={cancelled ? 'line-through text-red-500 dark:text-red-400' : ''}>{r.type || '-'}</span>
                      {cancelled && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                          {refunded ? (locale === 'ar' ? 'مرتجع' : 'Refunded') : (locale === 'ar' ? 'ملغي' : 'Cancelled')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`${tableTdCls} font-bold ${cancelled ? 'text-red-500 dark:text-red-400 line-through' : 'text-green-600 dark:text-green-400'}`}>{formatCurrency(r.amount || 0)}</td>
                  <td className={tableTdCls}>{r.paymentMethod || '-'}</td>
                  <td className={tableTdCls}>{getClientName(r)}</td>
                  <td className={tableTdCls}>{r.staffName || '-'}</td>
                </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-primary-50 dark:bg-primary-900/20 font-bold border-t-2 border-primary-200 dark:border-primary-900/50">
                <td className="px-4 py-3 text-gray-900 dark:text-gray-100" colSpan={3}>{locale === 'ar' ? 'الإجمالي' : 'Total'}</td>
                <td className="px-4 py-3 text-green-600 dark:text-green-400">{formatCurrency(total)}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300" colSpan={3}>{filtered.length} {t('reports.count' as any)}</td>
              </tr>
              {refundsTotal > 0 && (
                <>
                  <tr className="font-bold text-red-600 dark:text-red-400">
                    <td className="px-4 py-2" colSpan={3}>{locale === 'ar' ? 'المرتجعات' : 'Refunds'}</td>
                    <td className="px-4 py-2">- {formatCurrency(refundsTotal)}</td>
                    <td className="px-4 py-2" colSpan={3}></td>
                  </tr>
                  <tr className="bg-emerald-50 dark:bg-emerald-900/20 font-black border-t border-emerald-200 dark:border-emerald-900/50">
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100" colSpan={3}>{locale === 'ar' ? 'الصافي' : 'Net'}</td>
                    <td className="px-4 py-3 text-emerald-700 dark:text-emerald-300">{formatCurrency(netTotal)}</td>
                    <td className="px-4 py-3" colSpan={3}></td>
                  </tr>
                </>
              )}
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// =========== FOLLOWUPS TAB ===========
function FollowupsTab({ dateFrom, dateTo, formatDate, direction, locale, t }: any) {
  const toast = useToast()
  const { data: followups = [], isLoading } = useQuery({ queryKey: ['followups-report'], queryFn: fetchFollowUpsData })

  //  formatter بيعرض التاريخ + الساعة (مهم في تقارير المتابعات لمعرفة وقت التواصل)
  const dateLocale = direction === 'rtl' ? 'ar-EG' : 'en-US'
  const formatDateTime = (d: string | Date | null) => {
    if (!d) return '-'
    const dt = new Date(d)
    const datePart = dt.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })
    const timePart = dt.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit', hour12: true })
    return `${datePart} · ${timePart}`
  }

  const filtered = useMemo(() => {
    const from = new Date(dateFrom); from.setHours(0, 0, 0, 0)
    const to = new Date(dateTo); to.setHours(23, 59, 59, 999)
    return followups.filter((f: any) => {
      const d = new Date(f.createdAt)
      return d >= from && d <= to
    })
  }, [followups, dateFrom, dateTo])

  const exportExcel = async () => {
    try {
      const wb = new ExcelJS.Workbook(); wb.creator = 'Fitboost'
      const ws = wb.addWorksheet(t('reports.tabs.followups' as any), { views: [{ rightToLeft: direction === 'rtl' }] })

      const hdr = ws.addRow([t('reports.visitorName' as any), t('reports.phone' as any), t('reports.source' as any), t('reports.assignedStaff' as any), t('reports.stage' as any), t('reports.priority' as any), t('reports.result' as any), t('reports.contactCount' as any), t('reports.lastContacted' as any), t('reports.date' as any)])
      hdr.font = { bold: true, size: 12, name: 'Arial', color: { argb: 'FFFFFFFF' } }
      hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7B2CBF' } }
      hdr.alignment = { horizontal: 'center', vertical: 'middle' }; hdr.height = 28

      filtered.forEach((f: any, i: number) => {
        const row = ws.addRow([f.visitor?.name || '-', f.visitor?.phone || '-', f.visitor?.source || '-', f.assignedStaff?.name || '-', f.stage || '-', f.priority || '-', f.result || '-', f.contactCount || 0, formatDateTime(f.lastContactedAt), formatDateTime(f.createdAt)])
        if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
        row.alignment = { horizontal: 'center', vertical: 'middle' }
      })

      ws.columns = [{ width: 20 }, { width: 16 }, { width: 14 }, { width: 18 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 10 }, { width: 16 }, { width: 16 }]

      const buf = await wb.xlsx.writeBuffer()
      downloadBuffer(buf, `Followups_${dateFrom}_${dateTo}.xlsx`)
      toast.success(t('reports.exportSuccess' as any))
    } catch { toast.error(t('reports.exportError' as any)) }
  }

  if (isLoading) return <Loading />

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={exportExcel} type="button" className={exportBtnCls}>
          <IconDownload className="w-4 h-4" />
          <span>{t('reports.exportExcel' as any)}</span>
        </button>
      </div>

      <SummaryCard Icon={IconNote} label={t('reports.count' as any)} value={filtered.length} />

      {filtered.length === 0 ? <NoData t={t} /> : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead className={tableHeadCls}>
              <tr>
                {[t('reports.visitorName' as any), t('reports.phone' as any), t('reports.source' as any), t('reports.assignedStaff' as any), t('reports.stage' as any), t('reports.priority' as any), t('reports.result' as any), t('reports.contactCount' as any), t('reports.lastContacted' as any)].map((h, i) =>
                  <th key={i} className={tableThCls}>{h}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {filtered.map((f: any, i: number) => (
                <tr key={f.id || i} className={tableTrCls}>
                  <td className={`${tableTdCls} font-bold text-gray-900 dark:text-gray-100`}>{f.visitor?.name || '-'}</td>
                  <td className={`${tableTdCls} font-mono`}>{f.visitor?.phone || '-'}</td>
                  <td className={tableTdCls}>{f.visitor?.source || '-'}</td>
                  <td className={tableTdCls}>{f.assignedStaff?.name || '-'}</td>
                  <td className={tableTdCls}><StageBadge stage={f.stage} /></td>
                  <td className={tableTdCls}><PriorityBadge priority={f.priority} /></td>
                  <td className={tableTdCls}>{f.result || '-'}</td>
                  <td className={`${tableTdCls} text-center font-bold`}>{f.contactCount || 0}</td>
                  <td className={`${tableTdCls} whitespace-nowrap`}>{formatDateTime(f.lastContactedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// =========== PT TAB ===========
function PTTab({ dateFrom, dateTo, formatDate, formatCurrency, direction, locale, t }: any) {
  const toast = useToast()
  const { data: ptList = [], isLoading } = useQuery({ queryKey: ['pt-report'], queryFn: fetchPTSessions })
  //  جلب الإيصالات كمان عشان نحسب الـ revenue الفعلي (مطابق للتقفيل الشهري)
  const { data: receipts = [], isLoading: receiptsLoading } = useQuery({ queryKey: ['pt-report-receipts'], queryFn: fetchReceipts })

  //  فلتر الكوتش — عشان نعرف كل كوتش عمل إيه
  const [coachFilter, setCoachFilter] = useState('')

  //  قائمة الكباتن من بيانات الـ PT نفسها (مرتبة أبجدياً)
  const coachOptions = useMemo(() => (
    Array.from(new Set((ptList || []).map((p: any) => (p.coachName || '').trim()).filter(Boolean))).sort((a: any, b: any) => a.localeCompare(b, 'ar'))
  ), [ptList])

  const filtered = useMemo(() => {
    const from = new Date(dateFrom); from.setHours(0, 0, 0, 0)
    const to = new Date(dateTo); to.setHours(23, 59, 59, 999)
    return ptList.filter((p: any) => {
      const d = new Date(p.createdAt || p.startDate)
      if (!(d >= from && d <= to)) return false
      if (coachFilter && (p.coachName || '').trim() !== coachFilter) return false
      return true
    })
  }, [ptList, dateFrom, dateTo, coachFilter])

  //  إيصالات PT في النطاق (نفس قاعدة التقفيل الشهري) — منها نحسب الإجمالي والمرتجعات والصافي
  const ptReceiptsInRange = useMemo(() => {
    const from = new Date(dateFrom); from.setHours(0, 0, 0, 0)
    const to = new Date(dateTo); to.setHours(23, 59, 59, 999)
    return (receipts || [])
      .filter((r: any) => countsAsRevenue(r)) //  نفس قاعدة التقفيل الشهري بالظبط
      .filter((r: any) => isPTReceipt(r.type))
      .filter((r: any) => {
        const d = new Date(r.createdAt)
        return d >= from && d <= to
      })
      .filter((r: any) => {
        //  لو في فلتر كوتش، نحسب بس إيصالات الكوتش ده (اسمه مخزّن في itemDetails)
        if (!coachFilter) return true
        try {
          const details = typeof r.itemDetails === 'string' ? JSON.parse(r.itemDetails) : (r.itemDetails || {})
          return (details.coachName || '').trim() === coachFilter
        } catch { return false }
      })
  }, [receipts, dateFrom, dateTo, coachFilter])

  const isRefunded = (r: any) => !!r.isCancelled && !!r.refundMethod
  const totalRevenue = useMemo(() => ptReceiptsInRange.reduce((s: number, r: any) => s + (r.amount || 0), 0), [ptReceiptsInRange]) // إجمالي
  const ptRefunds = useMemo(() => ptReceiptsInRange.filter((r: any) => isRefunded(r)).reduce((s: number, r: any) => s + (r.amount || 0), 0), [ptReceiptsInRange])
  const ptNet = totalRevenue - ptRefunds // الصافي بعد المرتجعات

  //  حالة إلغاء كل PT (حسب رقم الـ PT) — عشان نعلّم الصف بـ X أحمر لو إيصاله اتلغى/اترجع
  const ptCancelStatus = useMemo(() => {
    const m = new Map<number, { refunded: boolean; voided: boolean }>()
    for (const r of (receipts || [])) {
      if (!r.isCancelled || !isPTReceipt(r.type) || r.ptNumber == null) continue
      const cur = m.get(r.ptNumber) || { refunded: false, voided: false }
      if (r.refundMethod) cur.refunded = true; else cur.voided = true
      m.set(r.ptNumber, cur)
    }
    return m
  }, [receipts])

  const totalRemaining = useMemo(() => filtered.reduce((s: number, p: any) => s + (p.remainingAmount || 0), 0), [filtered])

  const exportExcel = async () => {
    try {
      const wb = new ExcelJS.Workbook(); wb.creator = 'Fitboost'
      const ws = wb.addWorksheet(t('reports.tabs.pt' as any), { views: [{ rightToLeft: direction === 'rtl' }] })

      const hdr = ws.addRow([t('reports.ptNumber' as any), t('reports.clientName' as any), t('reports.phone' as any), t('reports.coach' as any), t('reports.sessionsPurchased' as any), t('reports.sessionsRemaining' as any), t('reports.pricePerSession' as any), t('reports.totalRevenue' as any), t('reports.remainingAmount' as any), t('reports.startDate' as any), t('reports.expiryDate' as any)])
      hdr.font = { bold: true, size: 12, name: 'Arial', color: { argb: 'FFFFFFFF' } }
      hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E86AB' } }
      hdr.alignment = { horizontal: 'center', vertical: 'middle' }; hdr.height = 28

      filtered.forEach((p: any, i: number) => {
        const row = ws.addRow([p.ptNumber || '-', p.clientName || '-', p.phone || '-', p.coachName || '-', p.sessionsPurchased || 0, p.sessionsRemaining || 0, p.pricePerSession || 0, (p.sessionsPurchased || 0) * (p.pricePerSession || 0), p.remainingAmount || 0, formatDate(p.startDate), formatDate(p.expiryDate)])
        if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
        row.alignment = { horizontal: 'center', vertical: 'middle' }
      })

      //  totalRevenue من إيصالات PT الفعلية في النطاق (مطابق للتقفيل الشهري)
      const totRow = ws.addRow(['', '', '', t('reports.total' as any), '', '', '', totalRevenue, totalRemaining, '', ''])
      totRow.font = { bold: true, size: 13, name: 'Arial' }
      totRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD700' } }

      ws.columns = [{ width: 12 }, { width: 20 }, { width: 16 }, { width: 18 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }]

      const buf = await wb.xlsx.writeBuffer()
      downloadBuffer(buf, `PT_Report_${dateFrom}_${dateTo}.xlsx`)
      toast.success(t('reports.exportSuccess' as any))
    } catch { toast.error(t('reports.exportError' as any)) }
  }

  if (isLoading || receiptsLoading) return <Loading />

  return (
    <div>
      <div className="flex flex-wrap justify-between items-end gap-3 mb-4">
        {/*  فلتر الكوتش */}
        <div className="min-w-[200px]">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
            {locale === 'ar' ? 'الكوتش' : 'Coach'}
          </label>
          <select
            value={coachFilter}
            onChange={(e) => setCoachFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
          >
            <option value="">{locale === 'ar' ? 'كل الكباتن' : 'All coaches'}</option>
            {coachFilter && !coachOptions.includes(coachFilter) && (
              <option value={coachFilter}>{coachFilter}</option>
            )}
            {coachOptions.map((c: any) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <button onClick={exportExcel} type="button" className={exportBtnCls}>
          <IconDownload className="w-4 h-4" />
          <span>{t('reports.exportExcel' as any)}</span>
        </button>
      </div>

      {/*  ملاحظة توضيحية: الـ Total Revenue من الإيصالات الفعلية (مطابق للتقفيل) */}
      <div className="mb-3 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-700 text-xs text-blue-800 dark:text-blue-200">
        💡 {locale === 'ar'
          ? 'إجمالي الإيرادات بيتحسب من الإيصالات الفعلية في النطاق المحدد (مطابق للتقفيل الشهري)'
          : 'Total Revenue is calculated from actual receipts in the date range (matches monthly closing)'}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        <SummaryCard Icon={IconDumbbell} label={t('reports.count' as any)} value={filtered.length} />
        <SummaryCard Icon={IconMoney} label={locale === 'ar' ? 'الإجمالي' : 'Total'} value={formatCurrency(totalRevenue)} />
        <SummaryCard Icon={IconMoney} label={locale === 'ar' ? 'المرتجعات' : 'Refunds'} value={formatCurrency(ptRefunds)} />
        <SummaryCard Icon={IconMoney} label={locale === 'ar' ? 'الصافي' : 'Net'} value={formatCurrency(ptNet)} />
        <SummaryCard Icon={IconClock} label={t('reports.remainingAmount' as any)} value={formatCurrency(totalRemaining)} />
      </div>

      {filtered.length === 0 ? <NoData t={t} /> : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={tableHeadCls}>
              <tr>
                {[t('reports.ptNumber' as any), t('reports.clientName' as any), t('reports.phone' as any), t('reports.coach' as any), t('reports.sessionsPurchased' as any), t('reports.sessionsRemaining' as any), t('reports.pricePerSession' as any), t('reports.totalRevenue' as any), t('reports.remainingAmount' as any)].map((h, i) =>
                  <th key={i} className={tableThCls}>{h}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {filtered.map((p: any, i: number) => {
                const st = p.ptNumber != null ? ptCancelStatus.get(p.ptNumber) : undefined
                const refunded = !!st?.refunded
                const voided = !!st?.voided && !refunded
                const cancelled = refunded || voided
                return (
                <tr key={p.id || i} className={`${tableTrCls} ${cancelled ? 'bg-red-50/60 dark:bg-red-900/10' : ''}`}>
                  <td className={`${tableTdCls} font-mono ${cancelled ? 'text-red-500 dark:text-red-400' : ''}`}>
                    <div className="inline-flex items-center gap-1.5">
                      <span className={cancelled ? 'line-through' : ''}>{p.ptNumber || '-'}</span>
                      {cancelled && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                          {refunded ? (locale === 'ar' ? 'مرتجع' : 'Refunded') : (locale === 'ar' ? 'ملغي' : 'Cancelled')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`${tableTdCls} font-bold ${cancelled ? 'text-red-500 dark:text-red-400 line-through' : 'text-gray-900 dark:text-gray-100'}`}>{p.clientName || '-'}</td>
                  <td className={`${tableTdCls} font-mono`}>{p.phone || '-'}</td>
                  <td className={tableTdCls}>{p.coachName || '-'}</td>
                  <td className={`${tableTdCls} text-center`}>{p.sessionsPurchased || 0}</td>
                  <td className={`${tableTdCls} text-center`}>{p.sessionsRemaining || 0}</td>
                  <td className={tableTdCls}>{formatCurrency(p.pricePerSession || 0)}</td>
                  <td className={`${tableTdCls} font-bold ${cancelled ? 'text-red-500 dark:text-red-400 line-through' : 'text-green-600 dark:text-green-400'}`}>{formatCurrency((p.sessionsPurchased || 0) * (p.pricePerSession || 0))}</td>
                  <td className={`${tableTdCls} text-orange-600 dark:text-orange-400`}>{formatCurrency(p.remainingAmount || 0)}</td>
                </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-primary-50 dark:bg-primary-900/20 font-bold border-t-2 border-primary-200 dark:border-primary-900/50">
                <td className="px-4 py-3 text-gray-900 dark:text-gray-100" colSpan={7}>{t('reports.total' as any)}</td>
                <td className="px-4 py-3 text-green-600 dark:text-green-400">{formatCurrency(totalRevenue)}</td>
                <td className="px-4 py-3 text-orange-600 dark:text-orange-400">{formatCurrency(totalRemaining)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// =========== STAFF TAB ===========
function StaffTab({ dateFrom, dateTo, formatDate, formatCurrency, direction, locale, t, isAdmin }: any) {
  const toast = useToast()
  const { data: staffList = [], isLoading: staffLoading } = useQuery({ queryKey: ['staff-report'], queryFn: fetchStaff })
  const { data: attendance = [], isLoading: attLoading } = useQuery({
    queryKey: ['attendance-report', dateFrom, dateTo],
    queryFn: () => fetch(`/api/attendance?dateFrom=${dateFrom}&dateTo=${dateTo}`).then(r => r.json()),
  })
  const { data: commissions = [], isLoading: commLoading } = useQuery({
    queryKey: ['commissions-report'],
    queryFn: () => fetch('/api/commissions').then(r => r.json()),
  })

  const isLoading = staffLoading || attLoading || commLoading

  const staffReport = useMemo(() => {
    if (!Array.isArray(staffList)) return []
    const from = new Date(dateFrom); from.setHours(0, 0, 0, 0)
    const to = new Date(dateTo); to.setHours(23, 59, 59, 999)

    const attArr = Array.isArray(attendance) ? attendance : []
    const commArr = Array.isArray(commissions) ? commissions : []

    return staffList.filter((s: any) => s.isActive).map((s: any) => {
      const staffAtt = attArr.filter((a: any) => a.staffId === s.id)
      const staffComm = commArr.filter((c: any) => c.staffId === s.id && new Date(c.createdAt) >= from && new Date(c.createdAt) <= to)
      const totalHours = staffAtt.reduce((sum: number, a: any) => sum + (a.duration || 0), 0)
      const totalCommissions = staffComm.reduce((sum: number, c: any) => sum + (c.amount || 0), 0)
      const totalDeductions = (s.deductions || []).filter((d: any) => d.isApplied && new Date(d.appliedAt || d.createdAt) >= from && new Date(d.appliedAt || d.createdAt) <= to).reduce((sum: number, d: any) => sum + (d.amount || 0), 0)

      return {
        ...s,
        attendanceDays: staffAtt.length,
        totalHours: Math.round(totalHours / 60 * 10) / 10,
        totalCommissions,
        totalDeductions,
        netAmount: (s.salary || 0) + totalCommissions - totalDeductions,
      }
    })
  }, [staffList, attendance, commissions, dateFrom, dateTo])

  const exportExcel = async () => {
    try {
      const wb = new ExcelJS.Workbook(); wb.creator = 'Fitboost'
      const ws = wb.addWorksheet(t('reports.tabs.staff' as any), { views: [{ rightToLeft: direction === 'rtl' }] })

      const cols = [t('reports.staffCode' as any), t('reports.name' as any), t('reports.position' as any)]
      if (isAdmin) cols.push(t('reports.salary' as any))
      cols.push(t('reports.attendanceDays' as any), t('reports.totalHours' as any), t('reports.commissions' as any), t('reports.deductions' as any))
      if (isAdmin) cols.push(t('reports.netAmount' as any))

      const hdr = ws.addRow(cols)
      hdr.font = { bold: true, size: 12, name: 'Arial', color: { argb: 'FFFFFFFF' } }
      hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3748' } }
      hdr.alignment = { horizontal: 'center', vertical: 'middle' }; hdr.height = 28

      staffReport.forEach((s: any, i: number) => {
        const vals: any[] = [s.staffCode || '-', s.name || '-', s.position || '-']
        if (isAdmin) vals.push(s.salary || 0)
        vals.push(s.attendanceDays, s.totalHours, s.totalCommissions, s.totalDeductions)
        if (isAdmin) vals.push(s.netAmount)

        const row = ws.addRow(vals)
        if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
        row.alignment = { horizontal: 'center', vertical: 'middle' }
      })

      ws.columns = [{ width: 14 }, { width: 20 }, { width: 16 }, ...(isAdmin ? [{ width: 14 }] : []), { width: 12 }, { width: 12 }, { width: 14 }, { width: 14 }, ...(isAdmin ? [{ width: 14 }] : [])]

      const buf = await wb.xlsx.writeBuffer()
      downloadBuffer(buf, `Staff_Report_${dateFrom}_${dateTo}.xlsx`)
      toast.success(t('reports.exportSuccess' as any))
    } catch { toast.error(t('reports.exportError' as any)) }
  }

  if (isLoading) return <Loading />

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={exportExcel} type="button" className={exportBtnCls}>
          <IconDownload className="w-4 h-4" />
          <span>{t('reports.exportExcel' as any)}</span>
        </button>
      </div>

      <SummaryCard Icon={IconUsers} label={t('reports.count' as any)} value={staffReport.length} />

      {staffReport.length === 0 ? <NoData t={t} /> : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead className={tableHeadCls}>
              <tr>
                {[t('reports.staffCode' as any), t('reports.name' as any), t('reports.position' as any),
                  ...(isAdmin ? [t('reports.salary' as any)] : []),
                  t('reports.attendanceDays' as any), t('reports.totalHours' as any), t('reports.commissions' as any), t('reports.deductions' as any),
                  ...(isAdmin ? [t('reports.netAmount' as any)] : [])
                ].map((h, i) => <th key={i} className={tableThCls}>{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {staffReport.map((s: any, i: number) => (
                <tr key={s.id || i} className={tableTrCls}>
                  <td className={`${tableTdCls} font-mono`}>{s.staffCode || '-'}</td>
                  <td className={`${tableTdCls} font-bold text-gray-900 dark:text-gray-100`}>{s.name || '-'}</td>
                  <td className={tableTdCls}>{s.position || '-'}</td>
                  {isAdmin && <td className={tableTdCls}>{formatCurrency(s.salary || 0)}</td>}
                  <td className={`${tableTdCls} text-center`}>{s.attendanceDays}</td>
                  <td className={`${tableTdCls} text-center`}>{s.totalHours}h</td>
                  <td className={`${tableTdCls} text-green-600 dark:text-green-400 font-bold`}>{formatCurrency(s.totalCommissions)}</td>
                  <td className={`${tableTdCls} text-red-600 dark:text-red-400`}>{formatCurrency(s.totalDeductions)}</td>
                  {isAdmin && <td className={`${tableTdCls} font-bold text-gray-900 dark:text-gray-100`}>{formatCurrency(s.netAmount)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// =========== HELPERS ===========
function downloadBuffer(buffer: ExcelJS.Buffer, fileName: string) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = fileName; a.click()
  window.URL.revokeObjectURL(url)
}

function Loading() {
  return <LoadingScreen />
}

function NoData({ t }: { t: any }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <IconInbox className="w-12 h-12 text-gray-400" />
      <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">{t('reports.noData' as any)}</h3>
    </div>
  )
}

function SummaryCard({ Icon, label, value }: { Icon: (p: { className?: string }) => JSX.Element; label: string; value: string | number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 flex items-center gap-3">
      <span className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </span>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      </div>
    </div>
  )
}

function StageBadge({ stage }: { stage: string }) {
  const colors: Record<string, string> = {
    new: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    contacted: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
    interested: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
    not_interested: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    converted: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  }
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${colors[stage] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>{stage || '-'}</span>
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    high: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
    medium: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
    low: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  }
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${colors[priority] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>{priority || '-'}</span>
}

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

export const dynamic = 'force-dynamic'

type TabType = 'revenue' | 'followups' | 'pt' | 'staff'

export default function ReportsPage() {
  const { t, locale, direction } = useLanguage()
  const { hasPermission, user, loading: permLoading } = usePermissions()

  const [activeTab, setActiveTab] = useState<TabType>('revenue')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  // Permission check
  if (permLoading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>
  if (!hasPermission('canViewReports' as any) && !hasPermission('canViewFinancials' as any)) {
    return <div className="flex items-center justify-center min-h-screen"><p className="text-xl text-gray-500">{locale === 'ar' ? 'ليس لديك صلاحية' : 'Permission denied'}</p></div>
  }

  const isAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN'
  const dateLocale = direction === 'rtl' ? 'ar-EG' : 'en-US'
  const formatDate = (d: string | Date | null) => d ? new Date(d).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' }) : '-'
  const formatCurrency = (n: number) => `${n.toLocaleString()} ${locale === 'ar' ? 'ج.م' : 'EGP'}`

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'revenue', label: t('reports.tabs.revenue' as any), icon: '💰' },
    { id: 'followups', label: t('reports.tabs.followups' as any), icon: '📝' },
    { id: 'pt', label: t('reports.tabs.pt' as any), icon: '💪' },
    { id: 'staff', label: t('reports.tabs.staff' as any), icon: '👷' },
  ]

  return (
    <div className="container mx-auto p-3 md:p-6 min-h-screen" dir={direction}>
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <span>📊</span> {t('reports.title' as any)}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t('reports.subtitle' as any)}</p>
      </div>

      {/* Date Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 mb-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">{t('reports.dateFrom' as any)}</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white" />
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">{t('reports.dateTo' as any)}</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}>
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'revenue' && <RevenueTab dateFrom={dateFrom} dateTo={dateTo} paymentFilter={paymentFilter} setPaymentFilter={setPaymentFilter} typeFilter={typeFilter} setTypeFilter={setTypeFilter} formatDate={formatDate} formatCurrency={formatCurrency} direction={direction} locale={locale} t={t} />}
      {activeTab === 'followups' && <FollowupsTab dateFrom={dateFrom} dateTo={dateTo} formatDate={formatDate} direction={direction} locale={locale} t={t} />}
      {activeTab === 'pt' && <PTTab dateFrom={dateFrom} dateTo={dateTo} formatDate={formatDate} formatCurrency={formatCurrency} direction={direction} locale={locale} t={t} />}
      {activeTab === 'staff' && <StaffTab dateFrom={dateFrom} dateTo={dateTo} formatDate={formatDate} formatCurrency={formatCurrency} direction={direction} locale={locale} t={t} isAdmin={isAdmin} />}
    </div>
  )
}

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
      if (r.isCancelled) return false
      if (paymentFilter !== 'all' && (r.paymentMethod || '').toLowerCase() !== paymentFilter) return false
      if (typeFilter !== 'all' && r.type !== typeFilter) return false
      return true
    })
  }, [receipts, dateFrom, dateTo, paymentFilter, typeFilter])

  const total = useMemo(() => filtered.reduce((s: number, r: any) => s + (r.amount || 0), 0), [filtered])

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

      const hdr = ws.addRow([t('reports.receiptNumber' as any), t('reports.date' as any), t('reports.type' as any), t('reports.amount' as any), t('reports.paymentMethod' as any), t('reports.client' as any), t('reports.staff' as any)])
      hdr.font = { bold: true, size: 12, name: 'Arial' }
      hdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }
      hdr.font = { bold: true, size: 12, name: 'Arial', color: { argb: 'FFFFFFFF' } }
      hdr.alignment = { horizontal: 'center', vertical: 'middle' }
      hdr.height = 28

      filtered.forEach((r: any, i: number) => {
        const row = ws.addRow([r.receiptNumber || '-', formatDate(r.createdAt), r.type || '-', r.amount || 0, r.paymentMethod || '-', getClientName(r), r.staffName || '-'])
        if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
        row.alignment = { horizontal: 'center', vertical: 'middle' }
      })

      const totRow = ws.addRow(['', '', t('reports.total' as any), total, '', `${filtered.length} ${t('reports.count' as any)}`, ''])
      totRow.font = { bold: true, size: 13, name: 'Arial' }
      totRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD700' } }

      ws.columns = [{ width: 14 }, { width: 16 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 22 }, { width: 18 }]

      const buf = await wb.xlsx.writeBuffer()
      downloadBuffer(buf, `Revenue_${dateFrom}_${dateTo}.xlsx`)
      toast.success(t('reports.exportSuccess' as any))
    } catch { toast.error(t('reports.exportError' as any)) }
  }

  if (isLoading) return <Loading />

  return (
    <div>
      {/* Extra filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 mb-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">{t('reports.paymentMethod' as any)}</label>
          <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white">
            <option value="all">{t('reports.all' as any)}</option>
            {paymentMethods.map((m: string) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-300 mb-1">{t('reports.receiptType' as any)}</label>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white">
            <option value="all">{t('reports.all' as any)}</option>
            {receiptTypes.map((tp: string) => <option key={tp} value={tp}>{tp}</option>)}
          </select>
        </div>
        <button onClick={exportExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-bold flex items-center gap-2">
          📥 {t('reports.exportExcel' as any)}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <SummaryCard icon="🧾" label={t('reports.count' as any)} value={filtered.length} />
        <SummaryCard icon="💰" label={t('reports.total' as any)} value={formatCurrency(total)} />
      </div>

      {/* Table */}
      {filtered.length === 0 ? <NoData t={t} /> : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blue-50 dark:bg-blue-900/30">
                {[t('reports.receiptNumber' as any), t('reports.date' as any), t('reports.type' as any), t('reports.amount' as any), t('reports.paymentMethod' as any), t('reports.client' as any), t('reports.staff' as any)].map((h, i) =>
                  <th key={i} className="px-3 py-3 text-start font-bold text-gray-700 dark:text-gray-200">{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any, i: number) => (
                <tr key={r.id || i} className={`border-t dark:border-gray-700 ${i % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800/50' : ''}`}>
                  <td className="px-3 py-2 font-mono">{r.receiptNumber || '-'}</td>
                  <td className="px-3 py-2">{formatDate(r.createdAt)}</td>
                  <td className="px-3 py-2">{r.type || '-'}</td>
                  <td className="px-3 py-2 font-bold text-green-600">{formatCurrency(r.amount || 0)}</td>
                  <td className="px-3 py-2">{r.paymentMethod || '-'}</td>
                  <td className="px-3 py-2">{getClientName(r)}</td>
                  <td className="px-3 py-2">{r.staffName || '-'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-yellow-50 dark:bg-yellow-900/20 font-bold border-t-2">
                <td className="px-3 py-3" colSpan={3}>{t('reports.total' as any)}</td>
                <td className="px-3 py-3 text-green-600">{formatCurrency(total)}</td>
                <td className="px-3 py-3" colSpan={3}>{filtered.length} {t('reports.count' as any)}</td>
              </tr>
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
        const row = ws.addRow([f.visitor?.name || '-', f.visitor?.phone || '-', f.visitor?.source || '-', f.assignedStaff?.name || '-', f.stage || '-', f.priority || '-', f.result || '-', f.contactCount || 0, formatDate(f.lastContactedAt), formatDate(f.createdAt)])
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
        <button onClick={exportExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-bold flex items-center gap-2">
          📥 {t('reports.exportExcel' as any)}
        </button>
      </div>

      <SummaryCard icon="📝" label={t('reports.count' as any)} value={filtered.length} />

      {filtered.length === 0 ? <NoData t={t} /> : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-purple-50 dark:bg-purple-900/30">
                {[t('reports.visitorName' as any), t('reports.phone' as any), t('reports.source' as any), t('reports.assignedStaff' as any), t('reports.stage' as any), t('reports.priority' as any), t('reports.result' as any), t('reports.contactCount' as any), t('reports.lastContacted' as any)].map((h, i) =>
                  <th key={i} className="px-3 py-3 text-start font-bold text-gray-700 dark:text-gray-200">{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f: any, i: number) => (
                <tr key={f.id || i} className={`border-t dark:border-gray-700 ${i % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800/50' : ''}`}>
                  <td className="px-3 py-2 font-bold">{f.visitor?.name || '-'}</td>
                  <td className="px-3 py-2 font-mono">{f.visitor?.phone || '-'}</td>
                  <td className="px-3 py-2">{f.visitor?.source || '-'}</td>
                  <td className="px-3 py-2">{f.assignedStaff?.name || '-'}</td>
                  <td className="px-3 py-2"><StageBadge stage={f.stage} /></td>
                  <td className="px-3 py-2"><PriorityBadge priority={f.priority} /></td>
                  <td className="px-3 py-2">{f.result || '-'}</td>
                  <td className="px-3 py-2 text-center font-bold">{f.contactCount || 0}</td>
                  <td className="px-3 py-2">{formatDate(f.lastContactedAt)}</td>
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

  const filtered = useMemo(() => {
    const from = new Date(dateFrom); from.setHours(0, 0, 0, 0)
    const to = new Date(dateTo); to.setHours(23, 59, 59, 999)
    return ptList.filter((p: any) => {
      const d = new Date(p.createdAt || p.startDate)
      return d >= from && d <= to
    })
  }, [ptList, dateFrom, dateTo])

  const totalRevenue = useMemo(() => filtered.reduce((s: number, p: any) => s + ((p.sessionsPurchased || 0) * (p.pricePerSession || 0)), 0), [filtered])
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

      const totRow = ws.addRow(['', '', '', t('reports.total' as any), '', '', '', totalRevenue, totalRemaining, '', ''])
      totRow.font = { bold: true, size: 13, name: 'Arial' }
      totRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD700' } }

      ws.columns = [{ width: 12 }, { width: 20 }, { width: 16 }, { width: 18 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }]

      const buf = await wb.xlsx.writeBuffer()
      downloadBuffer(buf, `PT_Report_${dateFrom}_${dateTo}.xlsx`)
      toast.success(t('reports.exportSuccess' as any))
    } catch { toast.error(t('reports.exportError' as any)) }
  }

  if (isLoading) return <Loading />

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={exportExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-bold flex items-center gap-2">
          📥 {t('reports.exportExcel' as any)}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <SummaryCard icon="💪" label={t('reports.count' as any)} value={filtered.length} />
        <SummaryCard icon="💰" label={t('reports.totalRevenue' as any)} value={formatCurrency(totalRevenue)} />
        <SummaryCard icon="⏳" label={t('reports.remainingAmount' as any)} value={formatCurrency(totalRemaining)} />
      </div>

      {filtered.length === 0 ? <NoData t={t} /> : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-teal-50 dark:bg-teal-900/30">
                {[t('reports.ptNumber' as any), t('reports.clientName' as any), t('reports.phone' as any), t('reports.coach' as any), t('reports.sessionsPurchased' as any), t('reports.sessionsRemaining' as any), t('reports.pricePerSession' as any), t('reports.totalRevenue' as any), t('reports.remainingAmount' as any)].map((h, i) =>
                  <th key={i} className="px-3 py-3 text-start font-bold text-gray-700 dark:text-gray-200">{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p: any, i: number) => (
                <tr key={p.id || i} className={`border-t dark:border-gray-700 ${i % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800/50' : ''}`}>
                  <td className="px-3 py-2 font-mono">{p.ptNumber || '-'}</td>
                  <td className="px-3 py-2 font-bold">{p.clientName || '-'}</td>
                  <td className="px-3 py-2 font-mono">{p.phone || '-'}</td>
                  <td className="px-3 py-2">{p.coachName || '-'}</td>
                  <td className="px-3 py-2 text-center">{p.sessionsPurchased || 0}</td>
                  <td className="px-3 py-2 text-center">{p.sessionsRemaining || 0}</td>
                  <td className="px-3 py-2">{formatCurrency(p.pricePerSession || 0)}</td>
                  <td className="px-3 py-2 font-bold text-green-600">{formatCurrency((p.sessionsPurchased || 0) * (p.pricePerSession || 0))}</td>
                  <td className="px-3 py-2 text-orange-600">{formatCurrency(p.remainingAmount || 0)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-yellow-50 dark:bg-yellow-900/20 font-bold border-t-2">
                <td className="px-3 py-3" colSpan={7}>{t('reports.total' as any)}</td>
                <td className="px-3 py-3 text-green-600">{formatCurrency(totalRevenue)}</td>
                <td className="px-3 py-3 text-orange-600">{formatCurrency(totalRemaining)}</td>
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
        <button onClick={exportExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-bold flex items-center gap-2">
          📥 {t('reports.exportExcel' as any)}
        </button>
      </div>

      <SummaryCard icon="👷" label={t('reports.count' as any)} value={staffReport.length} />

      {staffReport.length === 0 ? <NoData t={t} /> : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                {[t('reports.staffCode' as any), t('reports.name' as any), t('reports.position' as any),
                  ...(isAdmin ? [t('reports.salary' as any)] : []),
                  t('reports.attendanceDays' as any), t('reports.totalHours' as any), t('reports.commissions' as any), t('reports.deductions' as any),
                  ...(isAdmin ? [t('reports.netAmount' as any)] : [])
                ].map((h, i) => <th key={i} className="px-3 py-3 text-start font-bold text-gray-700 dark:text-gray-200">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {staffReport.map((s: any, i: number) => (
                <tr key={s.id || i} className={`border-t dark:border-gray-700 ${i % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800/50' : ''}`}>
                  <td className="px-3 py-2 font-mono">{s.staffCode || '-'}</td>
                  <td className="px-3 py-2 font-bold">{s.name || '-'}</td>
                  <td className="px-3 py-2">{s.position || '-'}</td>
                  {isAdmin && <td className="px-3 py-2">{formatCurrency(s.salary || 0)}</td>}
                  <td className="px-3 py-2 text-center">{s.attendanceDays}</td>
                  <td className="px-3 py-2 text-center">{s.totalHours}h</td>
                  <td className="px-3 py-2 text-green-600 font-bold">{formatCurrency(s.totalCommissions)}</td>
                  <td className="px-3 py-2 text-red-600">{formatCurrency(s.totalDeductions)}</td>
                  {isAdmin && <td className="px-3 py-2 font-bold">{formatCurrency(s.netAmount)}</td>}
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
  return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
}

function NoData({ t }: { t: any }) {
  return <div className="text-center py-16 text-gray-400"><p className="text-5xl mb-3">📭</p><p className="text-lg">{t('reports.noData' as any)}</p></div>
}

function SummaryCard({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 flex items-center gap-3">
      <span className="text-3xl">{icon}</span>
      <div><p className="text-sm text-gray-500 dark:text-gray-400">{label}</p><p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p></div>
    </div>
  )
}

function StageBadge({ stage }: { stage: string }) {
  const colors: Record<string, string> = { new: 'bg-blue-100 text-blue-800', contacted: 'bg-yellow-100 text-yellow-800', interested: 'bg-green-100 text-green-800', not_interested: 'bg-red-100 text-red-800', converted: 'bg-emerald-100 text-emerald-800' }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colors[stage] || 'bg-gray-100 text-gray-800'}`}>{stage || '-'}</span>
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = { high: 'bg-red-100 text-red-800', medium: 'bg-yellow-100 text-yellow-800', low: 'bg-green-100 text-green-800' }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colors[priority] || 'bg-gray-100 text-gray-800'}`}>{priority || '-'}</span>
}

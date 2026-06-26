'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useLanguage } from '../../../contexts/LanguageContext'
import { useToast } from '../../../contexts/ToastContext'
import { usePermissions } from '../../../hooks/usePermissions'
import PermissionDenied from '../../../components/PermissionDenied'
import { LoadingScreen } from '../../../components/Spinner'
import { createWhatsAppUrl } from '../../../lib/whatsappHelper'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface ContactLog {
  id: string
  ptNumber: number
  activityType: 'call' | 'whatsapp' | 'visit' | 'note'
  result: string | null
  notes: string | null
  nextContactAt: string | null
  createdBy: string | null
  createdAt: string
  staff: { id: string; name: string } | null
}

interface PTRow {
  ptNumber: number
  clientName: string
  phone: string
  coachName: string
  sessionsPurchased: number
  sessionsRemaining: number
  startDate: string | null
  expiryDate: string | null
  pricePerSession: number
  status: 'expired' | 'expiring'
  daysToExpiry: number | null
  contactLogs: ContactLog[]
  latestContact: ContactLog | null
  contactCount: number
}

const RESULTS_AR: Record<string, string> = {
  'no-answer': 'مرد',
  'busy': 'مشغول',
  'agreed-renew': 'وافق على التجديد',
  'rejected': 'رفض',
  'callback-later': 'يعاود التواصل',
  'renewed': 'جدّد',
}
const RESULTS_EN: Record<string, string> = {
  'no-answer': 'No answer',
  'busy': 'Busy',
  'agreed-renew': 'Agreed to renew',
  'rejected': 'Rejected',
  'callback-later': 'Callback later',
  'renewed': 'Renewed',
}

const ACTIVITY_AR: Record<string, string> = {
  'call': 'اتصال',
  'whatsapp': 'واتساب',
  'visit': 'زيارة',
  'note': 'ملاحظة',
}
const ACTIVITY_EN: Record<string, string> = {
  'call': 'Call',
  'whatsapp': 'WhatsApp',
  'visit': 'Visit',
  'note': 'Note',
}

const ACTIVITY_ICON: Record<string, JSX.Element> = {
  'call': <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />,
  'whatsapp': <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />,
  'visit': <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />,
  'note': <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Z" />,
}

function formatDate(d: string | null, locale: string): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')
}

function formatDateTime(d: string, locale: string): string {
  return new Date(d).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function PTFollowupsPage() {
  const { locale, direction } = useLanguage()
  const toast = useToast()
  const { hasPermission, loading: permissionsLoading } = usePermissions()

  const [rows, setRows] = useState<PTRow[]>([])
  const [counts, setCounts] = useState({ total: 0, expired: 0, expiring: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'expired' | 'expiring'>('all')
  const [search, setSearch] = useState('')
  const [expandedPt, setExpandedPt] = useState<number | null>(null)

  // Log-contact modal
  const [logModal, setLogModal] = useState<{ pt: PTRow; activityType: 'call' | 'whatsapp' | 'visit' | 'note' } | null>(null)
  const [logForm, setLogForm] = useState({ result: '', notes: '', nextContactAt: '' })
  const [submitting, setSubmitting] = useState(false)
  //  فلتر حالة المتابعة: all / contacted / with / without
  const [contactFilter, setContactFilter] = useState<'all' | 'contacted' | 'with' | 'without'>('all')

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/pt/followups?status=${statusFilter}`)
      if (res.ok) {
        const data = await res.json()
        setRows(data.data || [])
        setCounts(data.counts || { total: 0, expired: 0, expiring: 0 })
      }
    } catch (e) {
      toast.error(locale === 'ar' ? 'فشل تحميل البيانات' : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!permissionsLoading && hasPermission('canViewPT')) fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionsLoading, statusFilter])

  const filteredRows = useMemo(() => {
    const NO_CONTACT = ['no-answer', 'busy']
    let list = rows
    //  فلتر حالة المتابعة
    if (contactFilter !== 'all') {
      list = list.filter(r => {
        const count = r.contactCount || 0
        const latest = r.latestContact
        if (contactFilter === 'contacted') {
          return count > 0 && !!latest?.result && !NO_CONTACT.includes(latest.result)
        }
        if (contactFilter === 'with') return count > 0
        //  without
        return count === 0
      })
    }
    if (!search.trim()) return list
    const q = search.trim().toLowerCase()
    return list.filter(r =>
      r.clientName.toLowerCase().includes(q) ||
      r.phone.includes(q) ||
      String(r.ptNumber).includes(q) ||
      r.coachName.toLowerCase().includes(q)
    )
  }, [rows, search, contactFilter])

  //  counts للفلتر — بنحسبهم على كل rows (مش filtered) عشان الـ button counts تكون مطلقة
  const followupCounts = useMemo(() => {
    const NO_CONTACT = ['no-answer', 'busy']
    return {
      all: rows.length,
      contacted: rows.filter(r => (r.contactCount || 0) > 0 && !!r.latestContact?.result && !NO_CONTACT.includes(r.latestContact.result)).length,
      with: rows.filter(r => (r.contactCount || 0) > 0).length,
      without: rows.filter(r => (r.contactCount || 0) === 0).length,
    }
  }, [rows])

  const openLog = (pt: PTRow, activityType: 'call' | 'whatsapp' | 'visit' | 'note') => {
    setLogModal({ pt, activityType })
    setLogForm({ result: '', notes: '', nextContactAt: '' })
  }

  const submitLog = async () => {
    if (!logModal) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/pt/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ptNumber: logModal.pt.ptNumber,
          activityType: logModal.activityType,
          result: logForm.result || undefined,
          notes: logForm.notes || undefined,
          nextContactAt: logForm.nextContactAt || undefined,
        }),
      })
      if (res.ok) {
        toast.success(locale === 'ar' ? 'تم تسجيل التواصل' : 'Contact logged')
        setLogModal(null)
        fetchData()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Failed')
      }
    } finally { setSubmitting(false) }
  }

  const deleteLog = async (logId: string) => {
    if (!confirm(locale === 'ar' ? 'حذف هذا السجل؟' : 'Delete this entry?')) return
    const res = await fetch(`/api/pt/followups/${logId}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success(locale === 'ar' ? 'تم الحذف' : 'Deleted')
      fetchData()
    } else {
      toast.error(locale === 'ar' ? 'فشل الحذف' : 'Delete failed')
    }
  }

  const openWhatsApp = (pt: PTRow) => {
    const msg = locale === 'ar'
      ? `مرحباً ${pt.clientName.split(' ')[0]}، اشتراك الـ PT بتاعك ${pt.status === 'expired' ? 'انتهى' : 'قارب على الانتهاء'}. عاوز نحجزلك تجديد؟`
      : `Hi ${pt.clientName.split(' ')[0]}, your PT subscription ${pt.status === 'expired' ? 'has expired' : 'is expiring soon'}. Want to renew?`
    const url = createWhatsAppUrl(pt.phone, msg)
    window.open(url, '_blank')
  }

  if (permissionsLoading || loading) return <LoadingScreen fullScreen />
  if (!hasPermission('canViewPT')) {
    return <PermissionDenied message={locale === 'ar' ? 'متابعات الحصص المخصصة' : 'PT Followups'} />
  }

  return (
    <div className="container mx-auto p-3 sm:p-6" dir={direction}>
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/pt" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
              {locale === 'ar' ? '← الحصص المخصصة' : '← PT'}
            </Link>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <svg {...stroke} className="w-6 h-6 sm:w-7 sm:h-7 text-primary-600 dark:text-primary-400" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4"/>
            </svg>
            <span>{locale === 'ar' ? 'متابعات الحصص المخصصة' : 'PT Followups'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            {locale === 'ar' ? 'اشتراكات منتهية أو قاربت تنتهي — سجّل المكالمات وتابع التجديد' : 'Expired or expiring PT subscriptions — log calls and follow up on renewals'}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <button onClick={() => setStatusFilter('all')} className={`p-3 rounded-xl text-start ring-1 transition-colors ${statusFilter === 'all' ? 'bg-primary-50 dark:bg-primary-900/30 ring-primary-300 dark:ring-primary-700' : 'bg-white dark:bg-gray-800 ring-gray-200 dark:ring-gray-700 hover:ring-primary-200'}`}>
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'الإجمالي' : 'Total'}</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">{counts.total}</p>
        </button>
        <button onClick={() => setStatusFilter('expired')} className={`p-3 rounded-xl text-start ring-1 transition-colors ${statusFilter === 'expired' ? 'bg-red-50 dark:bg-red-900/30 ring-red-300 dark:ring-red-700' : 'bg-white dark:bg-gray-800 ring-gray-200 dark:ring-gray-700 hover:ring-red-200'}`}>
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'منتهية' : 'Expired'}</p>
          <p className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">{counts.expired}</p>
        </button>
        <button onClick={() => setStatusFilter('expiring')} className={`p-3 rounded-xl text-start ring-1 transition-colors ${statusFilter === 'expiring' ? 'bg-amber-50 dark:bg-amber-900/30 ring-amber-300 dark:ring-amber-700' : 'bg-white dark:bg-gray-800 ring-gray-200 dark:ring-gray-700 hover:ring-amber-200'}`}>
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'قريبة' : 'Expiring'}</p>
          <p className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">{counts.expiring}</p>
        </button>
      </div>

      {/*  فلتر حالة المتابعة — الكل / تم التواصل / اتعملت محاولة / مفيش */}
      <div className="mb-4">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
          {locale === 'ar' ? 'حالة المتابعة' : 'Followup status'}
        </label>
        <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-900/60 ring-1 ring-gray-200 dark:ring-gray-700">
          {([
            { key: 'all', label: locale === 'ar' ? '⚪ الكل' : '⚪ All', cls: 'text-gray-700 dark:text-gray-200 ring-gray-300 dark:ring-gray-600' },
            { key: 'contacted', label: locale === 'ar' ? '☎️ تم التواصل' : '☎️ Contacted', cls: 'text-blue-700 dark:text-blue-300 ring-blue-300 dark:ring-blue-700' },
            { key: 'with', label: locale === 'ar' ? '✅ اتعملت محاولة' : '✅ Attempted', cls: 'text-emerald-700 dark:text-emerald-300 ring-emerald-300 dark:ring-emerald-700' },
            { key: 'without', label: locale === 'ar' ? '🔴 مفيش متابعة' : '🔴 No followup', cls: 'text-red-700 dark:text-red-300 ring-red-300 dark:ring-red-700' },
          ] as const).map(opt => {
            const active = contactFilter === opt.key
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setContactFilter(opt.key)}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-bold transition-all duration-150 ${
                  active
                    ? `bg-white dark:bg-gray-800 shadow ring-1 ${opt.cls}`
                    : 'text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800/50'
                }`}
              >
                <span>{opt.label}</span>
                <span className={`inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full text-[11px] font-bold tabular-nums ${
                  active ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}>
                  {followupCounts[opt.key]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={locale === 'ar' ? 'بحث بالاسم أو الرقم أو الهاتف...' : 'Search by name, PT#, or phone...'}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* List */}
      {filteredRows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-12 text-center">
          <p className="text-gray-600 dark:text-gray-400 font-bold">{locale === 'ar' ? 'مفيش اشتراكات تحتاج متابعة' : 'No subscriptions need follow-up'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRows.map(pt => {
            const isExpanded = expandedPt === pt.ptNumber
            return (
              <div key={pt.ptNumber} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100">{pt.clientName}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          pt.status === 'expired'
                            ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                            : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                        }`}>
                          {pt.status === 'expired'
                            ? (locale === 'ar' ? `منتهي` : 'Expired')
                            : (locale === 'ar' ? `يخلص خلال ${pt.daysToExpiry} يوم` : `Expires in ${pt.daysToExpiry}d`)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">#{pt.ptNumber}</span>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400" dir="ltr">{pt.phone}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {locale === 'ar' ? 'الكوتش:' : 'Coach:'} <span className="font-bold text-gray-700 dark:text-gray-300">{pt.coachName}</span>
                        <span className="mx-2">·</span>
                        {locale === 'ar' ? 'الحصص:' : 'Sessions:'} <span className="font-bold text-gray-700 dark:text-gray-300">{pt.sessionsRemaining}/{pt.sessionsPurchased}</span>
                        {pt.expiryDate && (
                          <>
                            <span className="mx-2">·</span>
                            {locale === 'ar' ? 'الانتهاء:' : 'Expiry:'} <span className="font-bold text-gray-700 dark:text-gray-300">{formatDate(pt.expiryDate, locale)}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Latest contact summary */}
                  {pt.latestContact && (
                    <div className="mb-3 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900/40 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-700 dark:text-gray-200">
                          {locale === 'ar' ? 'آخر تواصل:' : 'Last contact:'}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">{formatDateTime(pt.latestContact.createdAt, locale)}</span>
                        <span className="text-gray-400">·</span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                          {locale === 'ar' ? ACTIVITY_AR[pt.latestContact.activityType] : ACTIVITY_EN[pt.latestContact.activityType]}
                        </span>
                        {pt.latestContact.result && (
                          <>
                            <span className="text-gray-400">·</span>
                            <span className="text-gray-700 dark:text-gray-300">
                              {locale === 'ar' ? RESULTS_AR[pt.latestContact.result] || pt.latestContact.result : RESULTS_EN[pt.latestContact.result] || pt.latestContact.result}
                            </span>
                          </>
                        )}
                        {pt.latestContact.staff?.name && (
                          <>
                            <span className="text-gray-400">·</span>
                            <span className="text-gray-600 dark:text-gray-400">{pt.latestContact.staff.name}</span>
                          </>
                        )}
                      </div>
                      {pt.latestContact.notes && (
                        <p className="text-gray-600 dark:text-gray-400 mt-1">{pt.latestContact.notes}</p>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => openLog(pt, 'call')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold">
                      <svg {...stroke} className="w-3.5 h-3.5">{ACTIVITY_ICON.call}</svg>
                      <span>{locale === 'ar' ? 'سجّل اتصال' : 'Log Call'}</span>
                    </button>
                    <button onClick={() => openLog(pt, 'whatsapp')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                      <svg {...stroke} className="w-3.5 h-3.5">{ACTIVITY_ICON.whatsapp}</svg>
                      <span>{locale === 'ar' ? 'سجّل واتساب' : 'Log WhatsApp'}</span>
                    </button>
                    <button onClick={() => openWhatsApp(pt)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-xs font-bold">
                      <svg {...stroke} className="w-3.5 h-3.5">{ACTIVITY_ICON.whatsapp}</svg>
                      <span>{locale === 'ar' ? 'افتح واتساب' : 'Open WhatsApp'}</span>
                    </button>
                    <button onClick={() => openLog(pt, 'note')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-bold">
                      <svg {...stroke} className="w-3.5 h-3.5">{ACTIVITY_ICON.note}</svg>
                      <span>{locale === 'ar' ? 'ملاحظة' : 'Note'}</span>
                    </button>
                    {pt.contactCount > 0 && (
                      <button onClick={() => setExpandedPt(isExpanded ? null : pt.ptNumber)} className="ms-auto text-xs text-primary-600 dark:text-primary-400 font-bold hover:underline">
                        {isExpanded
                          ? (locale === 'ar' ? '▲ إخفاء السجل' : '▲ Hide history')
                          : (locale === 'ar' ? `▼ السجل (${pt.contactCount})` : `▼ History (${pt.contactCount})`)}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded history */}
                {isExpanded && pt.contactLogs.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                    <div className="p-3 sm:p-4 space-y-2">
                      {pt.contactLogs.map(log => (
                        <div key={log.id} className="bg-white dark:bg-gray-800 rounded-lg p-3 ring-1 ring-gray-200 dark:ring-gray-700">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold">
                                <svg {...stroke} className="w-3 h-3">{ACTIVITY_ICON[log.activityType]}</svg>
                                {locale === 'ar' ? ACTIVITY_AR[log.activityType] : ACTIVITY_EN[log.activityType]}
                              </span>
                              {log.result && (
                                <span className="text-gray-700 dark:text-gray-300">
                                  · {locale === 'ar' ? RESULTS_AR[log.result] || log.result : RESULTS_EN[log.result] || log.result}
                                </span>
                              )}
                              <span className="text-gray-500 dark:text-gray-400">· {formatDateTime(log.createdAt, locale)}</span>
                              {log.staff?.name && <span className="text-gray-500 dark:text-gray-400">· {log.staff.name}</span>}
                            </div>
                            <button onClick={() => deleteLog(log.id)} className="text-xs text-red-600 dark:text-red-400 hover:underline">
                              {locale === 'ar' ? 'حذف' : 'Delete'}
                            </button>
                          </div>
                          {log.notes && <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">{log.notes}</p>}
                          {log.nextContactAt && (
                            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                              🔔 {locale === 'ar' ? 'تواصل تاني:' : 'Next contact:'} {formatDateTime(log.nextContactAt, locale)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Log contact modal */}
      {logModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in" onClick={(e) => { if (e.target === e.currentTarget) setLogModal(null) }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-md w-full max-h-[92vh] overflow-y-auto animate-modal-in" dir={direction}>
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <svg {...stroke} className="w-5 h-5 text-primary-600 dark:text-primary-400">{ACTIVITY_ICON[logModal.activityType]}</svg>
                  <span>{locale === 'ar' ? `تسجيل ${ACTIVITY_AR[logModal.activityType]}` : `Log ${ACTIVITY_EN[logModal.activityType]}`}</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{logModal.pt.clientName} · #{logModal.pt.ptNumber}</p>
              </div>
              <button onClick={() => setLogModal(null)} className="w-9 h-9 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center">
                <svg {...stroke} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              {logModal.activityType !== 'note' && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    {locale === 'ar' ? 'النتيجة' : 'Result'}
                  </label>
                  <select
                    value={logForm.result}
                    onChange={e => setLogForm({ ...logForm, result: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 min-h-[44px]"
                  >
                    <option value="">{locale === 'ar' ? '— اختياري —' : '— Optional —'}</option>
                    {Object.entries(locale === 'ar' ? RESULTS_AR : RESULTS_EN).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  {locale === 'ar' ? 'ملاحظات' : 'Notes'}
                </label>
                <textarea
                  value={logForm.notes}
                  onChange={e => setLogForm({ ...logForm, notes: e.target.value })}
                  rows={3}
                  placeholder={locale === 'ar' ? 'مثلاً: قال يجدد آخر الأسبوع' : 'e.g. Said he\'ll renew end of the week'}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  {locale === 'ar' ? 'موعد تواصل تاني (اختياري)' : 'Next contact (optional)'}
                </label>
                <input
                  type="datetime-local"
                  value={logForm.nextContactAt}
                  onChange={e => setLogForm({ ...logForm, nextContactAt: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setLogModal(null)} disabled={submitting} className="flex-1 min-h-[44px] bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-lg text-sm disabled:opacity-60">
                  {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button onClick={submitLog} disabled={submitting} className="flex-1 min-h-[44px] bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold rounded-lg text-sm disabled:opacity-60">
                  {submitting ? '...' : (locale === 'ar' ? 'حفظ' : 'Save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useToast } from '@/contexts/ToastContext'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface Schedule {
  id: string
  dayOfWeek: number
  startTime: string
  className: string
  coachName: string
  gender: string
  isActive: boolean
}
interface MemberHit { id: string; name: string; memberNumber?: string | null; phone?: string | null; isActive?: boolean }
interface Booking {
  id: string
  bookingDate: string
  createdAt: string
  member: { name: string; memberNumber: string | null; phone: string | null } | null
  class: { className: string; coachName: string; startTime: string; dayOfWeek: number } | null
}

const localDate = (d: Date) => {
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function ClassBookingsModal({ open, onClose, canRegister }: { open: boolean; onClose: () => void; canRegister: boolean }) {
  const { locale, direction } = useLanguage()
  const toast = useToast()
  const ar = locale === 'ar'
  const DAYS = ar
    ? ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const [tab, setTab] = useState<'list' | 'new' | 'attendance'>(canRegister ? 'new' : 'list')

  const [schedules, setSchedules] = useState<Schedule[]>([])

  // ---- list ----
  const [bookings, setBookings] = useState<Booking[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [from, setFrom] = useState(() => localDate(new Date()))
  const [to, setTo] = useState(() => localDate(new Date(Date.now() + 30 * 864e5)))

  // ---- attendance report (مربوط بالتشيك إن) ----
  const monthStart = () => { const d = new Date(); return localDate(new Date(d.getFullYear(), d.getMonth(), 1)) }
  const [attFrom, setAttFrom] = useState(monthStart)
  const [attTo, setAttTo] = useState(() => localDate(new Date()))
  const [attScheduleId, setAttScheduleId] = useState('')
  const [attRows, setAttRows] = useState<any[]>([])
  const [attSummary, setAttSummary] = useState<any>(null)
  const [attByClass, setAttByClass] = useState<any[]>([])
  const [attLoading, setAttLoading] = useState(false)

  // ---- new booking form ----
  const [memberQuery, setMemberQuery] = useState('')
  const [memberResults, setMemberResults] = useState<MemberHit[]>([])
  const [selectedMember, setSelectedMember] = useState<MemberHit | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [scheduleId, setScheduleId] = useState('')
  const [bookingDate, setBookingDate] = useState(() => localDate(new Date()))
  const [submitting, setSubmitting] = useState(false)
  const searchAbort = useRef<AbortController | null>(null)

  const loadSchedules = useCallback(async () => {
    try {
      const res = await fetch('/api/group-classes/schedule')
      if (!res.ok) return
      const data = await res.json()
      setSchedules((Array.isArray(data) ? data : []).filter((s: Schedule) => s.isActive))
    } catch { /* ignore */ }
  }, [])

  const loadBookings = useCallback(async () => {
    setListLoading(true)
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const res = await fetch(`/api/group-classes/bookings?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed'); return }
      setBookings(data.bookings || [])
    } catch {
      toast.error(ar ? 'فشل تحميل الحجوزات' : 'Failed to load')
    } finally {
      setListLoading(false)
    }
  }, [from, to, ar, toast])

  const loadAttendance = useCallback(async () => {
    setAttLoading(true)
    try {
      const params = new URLSearchParams()
      if (attFrom) params.set('from', attFrom)
      if (attTo) params.set('to', attTo)
      if (attScheduleId) params.set('scheduleId', attScheduleId)
      const res = await fetch(`/api/group-classes/attendance-report?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed'); return }
      setAttRows(data.rows || [])
      setAttSummary(data.summary || null)
      setAttByClass(data.byClass || [])
    } catch {
      toast.error(ar ? 'فشل تحميل تقرير الحضور' : 'Failed to load')
    } finally {
      setAttLoading(false)
    }
  }, [attFrom, attTo, attScheduleId, ar, toast])

  useEffect(() => { if (open) loadSchedules() }, [open, loadSchedules])
  useEffect(() => { if (open && tab === 'list') loadBookings() }, [open, tab, from, to]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && tab === 'attendance') loadAttendance() }, [open, tab, attFrom, attTo, attScheduleId]) // eslint-disable-line react-hooks/exhaustive-deps

  //  debounced member search
  useEffect(() => {
    if (!open || tab !== 'new') return
    const q = memberQuery.trim()
    if (q.length < 2) { setMemberResults([]); return }
    const t = setTimeout(async () => {
      try {
        searchAbort.current?.abort()
        searchAbort.current = new AbortController()
        const res = await fetch(`/api/members?search=${encodeURIComponent(q)}`, { signal: searchAbort.current.signal })
        if (!res.ok) return
        const data = await res.json()
        const list = Array.isArray(data) ? data : (data.members || [])
        setMemberResults(list.slice(0, 20))
        setShowResults(true)
      } catch { /* aborted */ }
    }, 350)
    return () => clearTimeout(t)
  }, [memberQuery, open, tab])

  //  لما يختار كلاس، رشّح أقرب تاريخ ليوم الكلاس
  const onPickSchedule = (id: string) => {
    setScheduleId(id)
    const sc = schedules.find((s) => s.id === id)
    if (sc) {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const diff = (sc.dayOfWeek - today.getDay() + 7) % 7
      const next = new Date(today); next.setDate(today.getDate() + diff)
      setBookingDate(localDate(next))
    }
  }

  const selectMember = (m: MemberHit) => {
    setSelectedMember(m)
    setMemberQuery(`${m.name}${m.memberNumber ? ` #${m.memberNumber}` : ''}`)
    setShowResults(false)
  }

  const resetForm = () => {
    setSelectedMember(null); setMemberQuery(''); setMemberResults([])
    setScheduleId(''); setBookingDate(localDate(new Date()))
  }

  const submit = async () => {
    if (!selectedMember) { toast.warning(ar ? 'اختار العضو' : 'Select a member'); return }
    if (!scheduleId) { toast.warning(ar ? 'اختار الكلاس' : 'Select a class'); return }
    if (!bookingDate) { toast.warning(ar ? 'اختار التاريخ' : 'Select a date'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/group-classes/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: selectedMember.id, classScheduleId: scheduleId, bookingDate }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || (ar ? 'فشل الحجز' : 'Failed')); return }
      toast.success(ar ? 'تم الحجز' : 'Booked')
      resetForm()
      setTab('list')
      loadBookings()
    } catch {
      toast.error(ar ? 'فشل الحجز' : 'Failed to book')
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async (b: Booking) => {
    if (!confirm(ar ? 'تلغي الحجز ده؟' : 'Cancel this booking?')) return
    try {
      const res = await fetch(`/api/group-classes/bookings/${b.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed'); return }
      toast.success(ar ? 'اتلغى الحجز' : 'Cancelled')
      loadBookings()
    } catch { toast.error('Failed') }
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })

  if (!open) return null

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors'
  const labelCls = 'block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5'

  return (
    <div className="fixed inset-0 z-[10000] flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-4xl w-full my-4 max-h-[calc(100vh-2rem)] overflow-y-auto" dir={direction} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{ar ? 'حجوزات الكلاسات' : 'Class Bookings'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Close">
            <svg {...stroke} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-5 pt-4">
          {canRegister && (
            <button onClick={() => setTab('new')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${tab === 'new' ? 'bg-primary-600 text-primary-contrast' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>
              {ar ? 'حجز جديد' : 'New booking'}
            </button>
          )}
          <button onClick={() => setTab('list')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${tab === 'list' ? 'bg-primary-600 text-primary-contrast' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>
            {ar ? 'الحجوزات' : 'Bookings'}
          </button>
          <button onClick={() => setTab('attendance')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${tab === 'attendance' ? 'bg-primary-600 text-primary-contrast' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}>
            {ar ? 'الحضور' : 'Attendance'}
          </button>
        </div>

        {/* NEW BOOKING */}
        {tab === 'new' && canRegister && (
          <div className="p-5 space-y-4">
            {schedules.length === 0 && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 p-3 text-sm">
                {ar ? 'مفيش مواعيد كلاسات في الجدول. ضيف مواعيد الأول من زر «جدول المواعيد».' : 'No class schedule yet. Add slots from the Schedule button first.'}
              </div>
            )}
            {/* Member picker */}
            <div className="relative">
              <label className={labelCls}>{ar ? 'العضو' : 'Member'} <span className="text-red-500">*</span></label>
              <input
                value={memberQuery}
                onChange={(e) => { setMemberQuery(e.target.value); setSelectedMember(null) }}
                onFocus={() => memberResults.length && setShowResults(true)}
                placeholder={ar ? 'ابحث بالاسم أو رقم العضوية أو التليفون...' : 'Search name / number / phone...'}
                className={inputCls}
              />
              {showResults && memberResults.length > 0 && !selectedMember && (
                <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl ring-1 ring-gray-200 dark:ring-gray-700 max-h-64 overflow-y-auto">
                  {memberResults.map((m) => (
                    <button key={m.id} onClick={() => selectMember(m)} className="w-full text-start px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/60 flex items-center justify-between gap-2">
                      <span className="font-bold text-gray-900 dark:text-gray-100">{m.name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{m.memberNumber ? `#${m.memberNumber}` : ''} {m.phone || ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Class + date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{ar ? 'الكلاس (من الجدول)' : 'Class (from schedule)'} <span className="text-red-500">*</span></label>
                <select value={scheduleId} onChange={(e) => onPickSchedule(e.target.value)} className={inputCls}>
                  <option value="">{ar ? 'اختر الكلاس' : 'Select class'}</option>
                  {schedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.className} · {DAYS[s.dayOfWeek]} {s.startTime} · {s.coachName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>{ar ? 'تاريخ الحصة' : 'Session date'} <span className="text-red-500">*</span></label>
                <input type="date" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-600">
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
              <button onClick={submit} disabled={submitting} className="px-5 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-primary-contrast font-bold text-sm">
                {ar ? 'احجز' : 'Book'}
              </button>
            </div>
          </div>
        )}

        {/* LIST */}
        {tab === 'list' && (
          <div className="p-5">
            <div className="flex flex-wrap gap-3 items-end mb-4">
              <div>
                <label className={labelCls}>{ar ? 'من' : 'From'}</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{ar ? 'إلى' : 'To'}</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
              </div>
            </div>

            {listLoading ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">{ar ? 'جارٍ التحميل...' : 'Loading...'}</div>
            ) : bookings.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">{ar ? 'مفيش حجوزات' : 'No bookings'}</div>
            ) : (
              <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200 dark:ring-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-600 dark:text-gray-300">
                    <tr>
                      <th className="px-3 py-2.5 text-start font-bold whitespace-nowrap">{ar ? 'التاريخ' : 'Date'}</th>
                      <th className="px-3 py-2.5 text-start font-bold whitespace-nowrap">{ar ? 'الكلاس' : 'Class'}</th>
                      <th className="px-3 py-2.5 text-start font-bold whitespace-nowrap">{ar ? 'العضو' : 'Member'}</th>
                      {canRegister && <th className="px-3 py-2.5 text-end font-bold whitespace-nowrap">{ar ? 'إجراءات' : 'Actions'}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                    {bookings.map((b) => (
                      <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                        <td className="px-3 py-2.5 whitespace-nowrap text-gray-700 dark:text-gray-200">
                          {fmtDate(b.bookingDate)}
                          {b.class && <div className="text-xs text-gray-400">{DAYS[b.class.dayOfWeek]} · {b.class.startTime}</div>}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="font-bold text-gray-900 dark:text-gray-100">{b.class?.className || '—'}</div>
                          {b.class?.coachName && <div className="text-xs text-gray-500 dark:text-gray-400">{b.class.coachName}</div>}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="font-bold text-gray-900 dark:text-gray-100">{b.member?.name || '—'}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{b.member?.memberNumber ? `#${b.member.memberNumber}` : ''} {b.member?.phone || ''}</div>
                        </td>
                        {canRegister && (
                          <td className="px-3 py-2.5 whitespace-nowrap text-end">
                            <button onClick={() => remove(b)} title={ar ? 'إلغاء الحجز' : 'Cancel'} className="p-1.5 rounded-lg text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30">
                              <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ATTENDANCE REPORT (مربوط بالتشيك إن) */}
        {tab === 'attendance' && (
          <div className="p-5">
            <div className="flex flex-wrap gap-3 items-end mb-4">
              <div>
                <label className={labelCls}>{ar ? 'من' : 'From'}</label>
                <input type="date" value={attFrom} onChange={(e) => setAttFrom(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{ar ? 'إلى' : 'To'}</label>
                <input type="date" value={attTo} onChange={(e) => setAttTo(e.target.value)} className={inputCls} />
              </div>
              <div className="min-w-[200px] flex-1">
                <label className={labelCls}>{ar ? 'الكلاس' : 'Class'}</label>
                <select value={attScheduleId} onChange={(e) => setAttScheduleId(e.target.value)} className={inputCls}>
                  <option value="">{ar ? 'كل الكلاسات' : 'All classes'}</option>
                  {schedules.map((s) => (
                    <option key={s.id} value={s.id}>{s.className} · {DAYS[s.dayOfWeek]} {s.startTime} · {s.coachName}</option>
                  ))}
                </select>
              </div>
            </div>

            {attSummary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                {[
                  { label: ar ? 'إجمالي الحجوزات' : 'Bookings', value: attSummary.totalBookings, tone: 'text-gray-900 dark:text-gray-100' },
                  { label: ar ? 'حضروا' : 'Attended', value: attSummary.attended, tone: 'text-emerald-600 dark:text-emerald-400' },
                  { label: ar ? 'غابوا' : 'Absent', value: attSummary.absent, tone: 'text-red-600 dark:text-red-400' },
                  { label: ar ? 'نسبة الحضور' : 'Rate', value: `${attSummary.attendanceRate}%`, tone: 'text-indigo-600 dark:text-indigo-400' },
                ].map((s, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-700/40 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 p-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{s.label}</div>
                    <div className={`mt-1 text-2xl font-bold ${s.tone}`}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {ar ? 'الحضور مربوط بالتشيك إن: العضو يُعتبر حاضر لو دخل الجيم في نفس يوم الحجز.' : 'Attendance is linked to check-in: a member counts as attended if they entered the gym on the booking day.'}
            </p>

            {attByClass.length > 0 && (
              <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-600 dark:text-gray-300">
                    <tr>
                      <th className="px-3 py-2.5 text-start font-bold whitespace-nowrap">{ar ? 'الكلاس' : 'Class'}</th>
                      <th className="px-3 py-2.5 text-center font-bold whitespace-nowrap">{ar ? 'محجوز' : 'Booked'}</th>
                      <th className="px-3 py-2.5 text-center font-bold whitespace-nowrap">{ar ? 'حضروا' : 'Attended'}</th>
                      <th className="px-3 py-2.5 text-center font-bold whitespace-nowrap">{ar ? 'النسبة' : 'Rate'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                    {attByClass.map((c, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                        <td className="px-3 py-2.5 whitespace-nowrap"><span className="font-bold text-gray-900 dark:text-gray-100">{c.className}</span> <span className="text-xs text-gray-500 dark:text-gray-400">· {c.coachName}</span></td>
                        <td className="px-3 py-2.5 text-center">{c.booked}</td>
                        <td className="px-3 py-2.5 text-center text-emerald-600 dark:text-emerald-400 font-bold">{c.attended}</td>
                        <td className="px-3 py-2.5 text-center">{c.booked ? Math.round((c.attended / c.booked) * 100) : 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {attLoading ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">{ar ? 'جارٍ التحميل...' : 'Loading...'}</div>
            ) : attRows.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">{ar ? 'مفيش حجوزات في الفترة دي' : 'No bookings in this period'}</div>
            ) : (
              <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200 dark:ring-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-600 dark:text-gray-300">
                    <tr>
                      <th className="px-3 py-2.5 text-start font-bold whitespace-nowrap">{ar ? 'التاريخ' : 'Date'}</th>
                      <th className="px-3 py-2.5 text-start font-bold whitespace-nowrap">{ar ? 'الكلاس' : 'Class'}</th>
                      <th className="px-3 py-2.5 text-start font-bold whitespace-nowrap">{ar ? 'العضو' : 'Member'}</th>
                      <th className="px-3 py-2.5 text-start font-bold whitespace-nowrap">{ar ? 'الحالة' : 'Status'}</th>
                      <th className="px-3 py-2.5 text-start font-bold whitespace-nowrap">{ar ? 'وقت الدخول' : 'Check-in'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                    {attRows.map((r, i) => (
                      <tr key={r.id || i} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                        <td className="px-3 py-2.5 whitespace-nowrap text-gray-700 dark:text-gray-200">
                          {fmtDate(r.bookingDate)}{r.startTime && <span className="text-xs text-gray-400"> · {r.startTime}</span>}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="font-bold text-gray-900 dark:text-gray-100">{r.className || '—'}</div>
                          {r.coachName && <div className="text-xs text-gray-500 dark:text-gray-400">{r.coachName}</div>}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="font-bold text-gray-900 dark:text-gray-100">{r.memberName || '—'}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{r.memberNumber ? `#${r.memberNumber}` : ''} {r.memberPhone || ''}</div>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {r.attended ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">{ar ? 'حضر' : 'Attended'}</span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300">{ar ? 'غاب' : 'Absent'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap font-mono text-gray-600 dark:text-gray-300">
                          {r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString(ar ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

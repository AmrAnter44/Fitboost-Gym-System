'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../../../contexts/LanguageContext'
import { useToast } from '../../../contexts/ToastContext'
import { usePermissions } from '../../../hooks/usePermissions'
import { LoadingScreen } from '../../../components/Spinner'
import PermissionDenied from '../../../components/PermissionDenied'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

const MONTH_NAMES_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const MONTH_NAMES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_NAMES_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Staff { id: string; name: string; staffCode: string; shiftStartTime: string | null; shiftEndTime: string | null; monthlyVacationDays?: number | null }
interface Shift { id: string; staffId: string; date: string; startTime: string; endTime: string; staff: Staff }
interface Leave { id: string; staffId: string; startDate: string; endDate: string; type: string; isPaid: boolean; staff: Staff; status?: string }
interface Holiday { id: string; date: string; name: string; isPaid: boolean; recurring: boolean }
interface Rotation { id: string; staffId: string; dayOfWeek: string; startTime: string; endTime: string; isVariable: boolean; staff: { id: string; name: string } }

type CellEntry =
  | { kind: 'shift'; item: Shift }
  | { kind: 'leave'; item: Leave }

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function StaffSchedulePage() {
  const { locale, direction } = useLanguage()
  const toast = useToast()
  const { user, loading: permsLoading } = usePermissions()

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1) // 1-12

  const [staff, setStaff] = useState<Staff[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [rotations, setRotations] = useState<Rotation[]>([])
  const [loading, setLoading] = useState(false)
  const [filterStaffId, setFilterStaffId] = useState<string>('all')

  const [editing, setEditing] = useState<{ date: string; existing: CellEntry[] } | null>(null)
  const [showBulkLeave, setShowBulkLeave] = useState(false)

  const isAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN'

  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/staff').then(r => r.ok ? r.json() : []).then((d: any) => {
      setStaff(d.filter((s: any) => s.isActive).map((s: any) => ({
        id: s.id, name: s.name, staffCode: s.staffCode,
        shiftStartTime: s.shiftStartTime, shiftEndTime: s.shiftEndTime,
        monthlyVacationDays: s.monthlyVacationDays,
      })))
    })
    fetch('/api/holidays').then(r => r.ok ? r.json() : []).then(setHolidays).catch(() => {})
    fetch('/api/rotations').then(r => r.ok ? r.json() : []).then(setRotations).catch(() => {})
  }, [isAdmin])

  // Apply URL params for deep-link filters (staffId, year, month)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const sid = params.get('staffId')
    const m = params.get('month')
    const y = params.get('year')
    if (sid) setFilterStaffId(sid)
    if (m) setMonth(parseInt(m, 10))
    if (y) setYear(parseInt(y, 10))
  }, [])

  const holidayMap = useMemo(() => {
    const set = new Map<string, Holiday>()
    for (const h of holidays) {
      const d = new Date(h.date)
      if (h.recurring) {
        const yearKey = `${year}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        set.set(yearKey, h)
      } else {
        set.set(dateKey(d), h)
      }
    }
    return set
  }, [holidays, year])

  // Per-staff leave usage (paid annual days used this month)
  const staffLeaveUsage = useMemo(() => {
    const usage = new Map<string, number>()
    for (const lv of leaves) {
      if (!lv.isPaid || lv.type === 'sick') continue
      const start = new Date(lv.startDate)
      const end = new Date(lv.endDate)
      let count = 0
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() + 1 === month && d.getFullYear() === year) count++
      }
      usage.set(lv.staffId, (usage.get(lv.staffId) ?? 0) + count)
    }
    return usage
  }, [leaves, month, year])

  useEffect(() => {
    if (!isAdmin) return
    fetchData()
  }, [year, month, isAdmin])

  async function fetchData() {
    setLoading(true)
    try {
      const [shiftsRes, leavesRes, rotationsRes] = await Promise.all([
        fetch(`/api/shifts?year=${year}&month=${month}`),
        fetch(`/api/leaves?from=${year}-${String(month).padStart(2, '0')}-01&to=${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`),
        fetch('/api/rotations'),
      ])
      const shiftsData = shiftsRes.ok ? await shiftsRes.json() : []
      const leavesData = leavesRes.ok ? await leavesRes.json() : []
      const rotationsData = rotationsRes.ok ? await rotationsRes.json() : []
      setShifts(shiftsData)
      setLeaves(leavesData)
      setRotations(rotationsData)
    } finally {
      setLoading(false)
    }
  }

  // Map: dateKey → CellEntry[]
  const cellMap = useMemo(() => {
    const map = new Map<string, CellEntry[]>()
    for (const s of shifts) {
      if (filterStaffId !== 'all' && s.staffId !== filterStaffId) continue
      const k = dateKey(new Date(s.date))
      const arr = map.get(k) || []
      arr.push({ kind: 'shift', item: s })
      map.set(k, arr)
    }
    for (const lv of leaves) {
      if (filterStaffId !== 'all' && lv.staffId !== filterStaffId) continue
      const start = new Date(lv.startDate)
      const end = new Date(lv.endDate)
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() + 1 !== month || d.getFullYear() !== year) continue
        const k = dateKey(d)
        const arr = map.get(k) || []
        arr.push({ kind: 'leave', item: lv })
        map.set(k, arr)
      }
    }
    return map
  }, [shifts, leaves, filterStaffId, month, year])

  // Calendar grid layout
  const grid = useMemo(() => {
    const first = new Date(year, month - 1, 1)
    const last = new Date(year, month, 0)
    const startWeekday = first.getDay() // 0=Sun
    const totalDays = last.getDate()
    const cells: ({ date: Date; key: string; inMonth: boolean })[] = []
    for (let i = 0; i < startWeekday; i++) {
      const d = new Date(year, month - 1, -((startWeekday - 1) - i))
      cells.push({ date: d, key: dateKey(d), inMonth: false })
    }
    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month - 1, day)
      cells.push({ date: d, key: dateKey(d), inMonth: true })
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date
      const d = new Date(last)
      d.setDate(d.getDate() + 1)
      cells.push({ date: d, key: dateKey(d), inMonth: false })
    }
    return cells
  }, [year, month])

  if (permsLoading) return <LoadingScreen fullScreen />
  if (!isAdmin) return <PermissionDenied />

  const dayNames = locale === 'ar' ? DAY_NAMES_AR : DAY_NAMES_EN

  return (
    <div className="container mx-auto p-3 sm:p-6" dir={direction}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <svg {...stroke} className="w-6 h-6 sm:w-7 sm:h-7 text-primary-600 dark:text-primary-400" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            <span>{locale === 'ar' ? 'جدول الورديات والإجازات' : 'Shifts & Leaves'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {locale === 'ar' ? 'إدارة الجدول الشهري للموظفين' : 'Manage monthly staff schedule'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowBulkLeave(true)} className="min-h-[44px] px-3 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-bold">
            {locale === 'ar' ? 'إجازة جماعية' : 'Bulk Leave'}
          </button>
          <select
            value={filterStaffId}
            onChange={e => setFilterStaffId(e.target.value)}
            className="min-h-[44px] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">{locale === 'ar' ? '— كل الموظفين —' : '— All Staff —'}</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select
            value={month}
            onChange={e => setMonth(parseInt(e.target.value))}
            className="min-h-[44px] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {(locale === 'ar' ? MONTH_NAMES_AR : MONTH_NAMES_EN).map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={e => setYear(parseInt(e.target.value))}
            className="min-h-[44px] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-3 text-xs">
        <LegendItem color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" label={locale === 'ar' ? 'شيفت' : 'Shift'} />
        <LegendItem color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" label={locale === 'ar' ? 'إجازة مدفوعة' : 'Paid Leave'} />
        <LegendItem color="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" label={locale === 'ar' ? 'إجازة بدون مرتب' : 'Unpaid Leave'} />
        <LegendItem color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" label={locale === 'ar' ? 'مرضية' : 'Sick'} />
        <LegendItem color="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" label={locale === 'ar' ? 'أجازة رسمية' : 'Public Holiday'} />
        <LegendItem color="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" label={locale === 'ar' ? 'وردية أسبوعية' : 'Recurring Rotation'} />
      </div>

      {/* Quota Warnings */}
      {filterStaffId !== 'all' && (() => {
        const s = staff.find(x => x.id === filterStaffId)
        if (!s) return null
        const used = staffLeaveUsage.get(filterStaffId) ?? 0
        const quota = s.monthlyVacationDays ?? 0
        if (quota === 0) return null
        const pct = (used / quota) * 100
        const severity = pct >= 100 ? 'critical' : pct >= 75 ? 'warning' : 'ok'
        if (severity === 'ok') return null
        return (
          <div className={`mb-4 p-3 rounded-lg text-sm font-bold ${severity === 'critical' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'}`}>
            {locale === 'ar'
              ? `${s.name}: استخدم ${used} من ${quota} يوم إجازة (${Math.round(pct)}%)${severity === 'critical' ? ' — تجاوز الحد!' : ''}`
              : `${s.name}: ${used}/${quota} leave days used (${Math.round(pct)}%)${severity === 'critical' ? ' — Over quota!' : ''}`}
          </div>
        )
      })()}

      {loading ? (
        <LoadingScreen message={locale === 'ar' ? 'جارٍ تحميل الجدول…' : 'Loading schedule…'} />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
          {/* Day names header */}
          <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
            {dayNames.map(d => (
              <div key={d} className="px-2 py-2 text-center text-xs font-bold text-gray-700 dark:text-gray-300">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {grid.map(cell => {
              const entries = cellMap.get(cell.key) || []
              const isToday = dateKey(today) === cell.key
              const holiday = holidayMap.get(cell.key)
              const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][cell.date.getDay()]
              // recurring rotations for this weekday, excluding staff who already have a one-off shift OR leave on this date
              const overrideStaffIds = new Set([
                ...entries.filter(e => e.kind === 'shift').map(e => (e as any).item.staffId),
                ...entries.filter(e => e.kind === 'leave').map(e => (e as any).item.staffId),
              ])
              const matchingRotations = rotations.filter(r =>
                r.dayOfWeek === dayName &&
                (filterStaffId === 'all' || r.staffId === filterStaffId) &&
                !overrideStaffIds.has(r.staffId)
              )
              return (
                <button
                  key={cell.key}
                  onClick={() => setEditing({ date: cell.key, existing: entries })}
                  className={`min-h-[90px] sm:min-h-[110px] p-1.5 sm:p-2 border-b border-e border-gray-100 dark:border-gray-700/60 text-start transition-colors ${
                    cell.inMonth
                      ? holiday ? 'bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30' : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                      : 'bg-gray-50 dark:bg-gray-900/40 text-gray-400 dark:text-gray-600'
                  } ${isToday ? 'ring-2 ring-inset ring-primary-500' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${isToday ? 'text-primary-700 dark:text-primary-400' : ''}`}>{cell.date.getDate()}</span>
                    {holiday && <span className="text-[9px] px-1 rounded bg-rose-200 dark:bg-rose-800 text-rose-800 dark:text-rose-100 truncate max-w-[60%]" title={holiday.name}>{holiday.name}</span>}
                  </div>
                  <div className="space-y-1">
                    {entries.slice(0, 3).map((e, i) => (
                      <div key={i} className={`text-[10px] px-1.5 py-0.5 rounded truncate ${getEntryStyle(e)}`}>
                        {entryLabel(e, locale)}
                      </div>
                    ))}
                    {entries.length > 3 && (
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">+{entries.length - 3}</div>
                    )}
                    {cell.inMonth && matchingRotations.slice(0, 3).map(r => (
                      <div
                        key={`r-${r.id}`}
                        className="text-[10px] px-1.5 py-0.5 rounded truncate bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-dashed border-blue-300/60 dark:border-blue-700/60"
                        title={`${r.staff.name} — ${r.isVariable ? (locale === 'ar' ? 'متغير' : 'Variable') : `${r.startTime} → ${r.endTime}`}`}
                      >
                        {r.staff.name.split(' ')[0]} {r.isVariable ? (locale === 'ar' ? 'متغير' : 'Var') : r.startTime}
                      </div>
                    ))}
                    {cell.inMonth && matchingRotations.length > 3 && (
                      <div className="text-[10px] text-blue-500 dark:text-blue-400">+{matchingRotations.length - 3}</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (() => {
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(editing.date).getDay()]
        const overrideStaffIds = new Set([
          ...editing.existing.filter(e => e.kind === 'shift').map(e => (e as any).item.staffId),
          ...editing.existing.filter(e => e.kind === 'leave').map(e => (e as any).item.staffId),
        ])
        const matchingRotations = rotations.filter(r => r.dayOfWeek === dayName && !overrideStaffIds.has(r.staffId))
        return (
          <DayEditModal
            date={editing.date}
            year={year}
            month={month}
            existing={editing.existing}
            rotations={matchingRotations}
            staff={staff}
            staffLeaveUsage={staffLeaveUsage}
            onClose={() => setEditing(null)}
            onRefresh={fetchData}
            locale={locale}
            direction={direction}
            toast={toast}
          />
        )
      })()}

      {showBulkLeave && (
        <BulkLeaveModal
          staff={staff}
          year={year}
          month={month}
          onClose={() => setShowBulkLeave(false)}
          onRefresh={fetchData}
          locale={locale}
          direction={direction}
          toast={toast}
        />
      )}
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded ${color}`}>
      <span className="font-bold">{label}</span>
    </span>
  )
}

function getEntryStyle(e: CellEntry): string {
  if (e.kind === 'shift') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  const lv = e.item
  if (lv.type === 'off') return 'bg-gray-200 text-gray-700 dark:bg-gray-700/60 dark:text-gray-200'
  if (lv.type === 'sick') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  if (lv.isPaid) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
}

function entryLabel(e: CellEntry, locale: string): string {
  if (e.kind === 'shift') return `${e.item.staff.name.split(' ')[0]} ${e.item.startTime}`
  if (e.item.type === 'off') return `${e.item.staff.name.split(' ')[0]} ${locale === 'ar' ? 'راحة' : 'Off'}`
  return `${e.item.staff.name.split(' ')[0]} ${locale === 'ar' ? 'إجازة' : 'Leave'}`
}

function DayEditModal({
  date, year, month, existing, rotations, staff, staffLeaveUsage, onClose, onRefresh, locale, direction, toast,
}: {
  date: string
  year: number
  month: number
  existing: CellEntry[]
  rotations: Rotation[]
  staff: Staff[]
  staffLeaveUsage: Map<string, number>
  onClose: () => void
  onRefresh: () => Promise<void>
  locale: string
  direction: 'rtl' | 'ltr'
  toast: any
}) {
  const [tab, setTab] = useState<'shift' | 'leave'>('shift')
  const [staffId, setStaffId] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [leaveType, setLeaveType] = useState<'annual' | 'paid' | 'sick' | 'unpaid' | 'other'>('annual')
  const [leaveEnd, setLeaveEnd] = useState(date)
  const [isPaid, setIsPaid] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)

  const handleStaffPick = (id: string) => {
    setStaffId(id)
    const s = staff.find(x => x.id === id)
    if (s) {
      if (s.shiftStartTime) setStartTime(s.shiftStartTime)
      if (s.shiftEndTime) setEndTime(s.shiftEndTime)
    }
  }

  async function addShift() {
    if (!staffId) { toast.error(locale === 'ar' ? 'اختر موظف' : 'Pick staff'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId, date, startTime, endTime }),
      })
      if (res.ok) {
        toast.success(locale === 'ar' ? 'تم إضافة الشيفت' : 'Shift added')
        await onRefresh()
        onClose()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Failed')
      }
    } finally { setSubmitting(false) }
  }

  async function addLeave() {
    if (!staffId) { toast.error(locale === 'ar' ? 'اختر موظف' : 'Pick staff'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId, startDate: date, endDate: leaveEnd, type: leaveType, isPaid: leaveType !== 'unpaid' && isPaid }),
      })
      if (res.ok) {
        toast.success(locale === 'ar' ? 'تم إضافة الإجازة' : 'Leave added')
        await onRefresh()
        onClose()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Failed')
      }
    } finally { setSubmitting(false) }
  }

  function deleteEntry(e: CellEntry) {
    setConfirmDialog({
      title: locale === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete',
      message: locale === 'ar' ? 'حذف هذا العنصر؟' : 'Delete this entry?',
      onConfirm: async () => {
        const url = e.kind === 'shift' ? `/api/shifts/${e.item.id}` : `/api/leaves/${e.item.id}`
        const res = await fetch(url, { method: 'DELETE' })
        if (res.ok) {
          toast.success(locale === 'ar' ? 'تم الحذف' : 'Deleted')
          await onRefresh()
        } else {
          toast.error(locale === 'ar' ? 'فشل الحذف' : 'Delete failed')
        }
      },
    })
  }

  function deleteRotationForMonth(rotation: Rotation) {
    setConfirmDialog({
      title: locale === 'ar' ? 'تأكيد الحذف لهذا الشهر' : 'Confirm Delete for This Month',
      message: locale === 'ar'
        ? `هيتم حذف الوردية لكل أيام ${rotation.dayOfWeek} في هذا الشهر فقط. الشهور الجاية مش هتتأثر.`
        : `This will remove the shift for every ${rotation.dayOfWeek} in this month only. Future months are unchanged.`,
      onConfirm: () => doDeleteRotationForMonth(rotation),
    })
  }

  async function doDeleteRotationForMonth(rotation: Rotation) {
    // Find all dates in (year, month) matching rotation.dayOfWeek
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const targetIdx = DAYS.indexOf(rotation.dayOfWeek)
    if (targetIdx < 0) return
    const daysInMonth = new Date(year, month, 0).getDate()
    const matchDates: string[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month - 1, d)
      if (dt.getDay() === targetIdx) {
        matchDates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
      }
    }

    setSubmitting(true)
    try {
      // Create a 1-day off-leave for every matching date
      const results = await Promise.all(matchDates.map(d =>
        fetch('/api/leaves', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staffId: rotation.staffId,
            startDate: d,
            endDate: d,
            type: 'off',
            isPaid: false,
            reason: locale === 'ar' ? 'يوم راحة (هذا الشهر فقط)' : 'Off (this month only)',
            status: 'approved',
          }),
        })
      ))
      const ok = results.filter(r => r.ok).length
      toast.success(locale === 'ar' ? `تم حذف ${ok} يوم من الشهر` : `Removed ${ok} day(s) from the month`)
      await onRefresh()
      onClose()
    } catch {
      toast.error(locale === 'ar' ? 'فشل الحذف' : 'Delete failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-lg w-full max-h-[92vh] overflow-y-auto animate-modal-in" dir={direction}>
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{date}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'إدارة اليوم' : 'Manage day'}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center">
            <svg {...stroke} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Existing entries */}
        {existing.length > 0 && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{locale === 'ar' ? 'الموجود حالياً' : 'Currently'}</h3>
            <div className="space-y-2">
              {existing.map((e, i) => {
                const sid = e.item.staffId
                const y = parseInt(date.slice(0, 4), 10)
                const m = parseInt(date.slice(5, 7), 10)
                return (
                  <div key={i} className={`flex items-center justify-between p-2 rounded ${getEntryStyle(e)}`}>
                    <span className="text-sm">{entryLabel(e, locale)}{e.kind === 'shift' ? ` → ${e.item.endTime}` : ''}</span>
                    <div className="flex gap-1">
                      <a href={`/staff-hr-assistant?staffId=${sid}&month=${m}&year=${y}`} className="text-xs px-2 py-1 bg-white/70 hover:bg-white rounded text-primary-700 font-bold" title={locale === 'ar' ? 'HR' : 'HR'}>HR</a>
                      <button onClick={() => deleteEntry(e)} className="text-xs px-2 py-1 bg-white/70 hover:bg-white rounded text-red-600 font-bold">
                        {locale === 'ar' ? 'حذف' : 'Delete'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Recurring rotations (delete for this month only) */}
        {rotations.length > 0 && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{locale === 'ar' ? 'ورديات أسبوعية' : 'Recurring Shifts'}</h3>
            <div className="space-y-2">
              {rotations.map(r => (
                <div key={r.id} className="flex items-center justify-between gap-2 p-2 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-dashed border-blue-300/60 dark:border-blue-700/60">
                  <span className="text-sm truncate">
                    {r.staff.name} · {r.isVariable ? (locale === 'ar' ? 'متغير' : 'Variable') : `${r.startTime} → ${r.endTime}`}
                  </span>
                  <button
                    onClick={() => deleteRotationForMonth(r)}
                    disabled={submitting}
                    className="text-xs px-2 py-1 bg-white/70 hover:bg-white rounded text-red-600 font-bold whitespace-nowrap disabled:opacity-60"
                  >
                    {locale === 'ar' ? 'حذف هذا الشهر' : 'Delete This Month'}
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {locale === 'ar' ? 'الحذف بيشيل الوردية من كل أيام هذا اليوم في الشهر الحالي فقط — الشهور الجاية بتفضل زي ما هي.' : 'Removes the shift for every matching weekday in the current month only — future months are unchanged.'}
            </p>
          </div>
        )}

        {/* Add tabs */}
        <div className="p-4">
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setTab('shift')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${tab === 'shift' ? 'bg-primary-500 text-primary-contrast' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
            >
              {locale === 'ar' ? '+ شيفت' : '+ Shift'}
            </button>
            <button
              onClick={() => setTab('leave')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${tab === 'leave' ? 'bg-primary-500 text-primary-contrast' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
            >
              {locale === 'ar' ? '+ إجازة' : '+ Leave'}
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{locale === 'ar' ? 'الموظف' : 'Staff'}</label>
              <select
                value={staffId}
                onChange={e => handleStaffPick(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">{locale === 'ar' ? '— اختر —' : '— Select —'}</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {tab === 'shift' ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{locale === 'ar' ? 'بداية' : 'Start'}</label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{locale === 'ar' ? 'نهاية' : 'End'}</label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
                <button
                  onClick={addShift}
                  disabled={submitting}
                  className="w-full min-h-[44px] bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold rounded-lg disabled:opacity-60"
                >
                  {locale === 'ar' ? 'إضافة الشيفت' : 'Add Shift'}
                </button>
              </>
            ) : (
              <>
                {staffId && (() => {
                  const s = staff.find(x => x.id === staffId)
                  if (!s) return null
                  const used = staffLeaveUsage.get(staffId) ?? 0
                  const quota = s.monthlyVacationDays ?? 0
                  if (quota === 0) return null
                  const pct = (used / quota) * 100
                  const colorClass = pct >= 100 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : pct >= 75 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  return (
                    <div className={`p-2 rounded-lg text-xs font-bold ${colorClass}`}>
                      {locale === 'ar' ? `استخدم ${used} من ${quota} يوم إجازة هذا الشهر` : `${used}/${quota} leave days used this month`}
                    </div>
                  )
                })()}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{locale === 'ar' ? 'نوع الإجازة' : 'Leave Type'}</label>
                  <select
                    value={leaveType}
                    onChange={e => setLeaveType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="annual">{locale === 'ar' ? 'سنوية (مدفوعة)' : 'Annual (Paid)'}</option>
                    <option value="paid">{locale === 'ar' ? 'إجازة مدفوعة' : 'Paid Leave'}</option>
                    <option value="sick">{locale === 'ar' ? 'مرضية' : 'Sick'}</option>
                    <option value="unpaid">{locale === 'ar' ? 'بدون مرتب' : 'Unpaid'}</option>
                    <option value="other">{locale === 'ar' ? 'أخرى' : 'Other'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{locale === 'ar' ? 'حتى تاريخ' : 'Until Date'}</label>
                  <input
                    type="date"
                    value={leaveEnd}
                    min={date}
                    onChange={e => setLeaveEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <button
                  onClick={addLeave}
                  disabled={submitting}
                  className="w-full min-h-[44px] bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold rounded-lg disabled:opacity-60"
                >
                  {locale === 'ar' ? 'إضافة الإجازة' : 'Add Leave'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {confirmDialog && (
        <div
          className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-backdrop-in"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDialog(null) }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-sm w-full animate-modal-in" dir={direction}>
            <div className="p-5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <svg {...stroke} className="w-5 h-5 text-red-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <span>{confirmDialog.title}</span>
              </h3>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDialog(null)}
                disabled={submitting}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-bold disabled:opacity-60"
              >
                {locale === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={async () => {
                  const cb = confirmDialog.onConfirm
                  setConfirmDialog(null)
                  await cb()
                }}
                disabled={submitting}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-bold disabled:opacity-60"
              >
                {locale === 'ar' ? 'حذف' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BulkLeaveModal({
  staff, year, month, onClose, onRefresh, locale, direction, toast,
}: {
  staff: Staff[]
  year: number
  month: number
  onClose: () => void
  onRefresh: () => Promise<void>
  locale: string
  direction: 'rtl' | 'ltr'
  toast: any
}) {
  const firstOfMonth = `${year}-${String(month).padStart(2, '0')}-01`
  const [startDate, setStartDate] = useState(firstOfMonth)
  const [endDate, setEndDate] = useState(firstOfMonth)
  const [type, setType] = useState<'annual' | 'paid' | 'sick' | 'unpaid' | 'other'>('annual')
  const [isPaid, setIsPaid] = useState(true)
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const toggleStaff = (id: string) => {
    setSelectedStaffIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function submit() {
    if (!startDate || !endDate) { toast.error(locale === 'ar' ? 'كل التواريخ مطلوبة' : 'All dates required'); return }
    if (selectedStaffIds.length === 0) { toast.error(locale === 'ar' ? 'اختر موظف واحد على الأقل' : 'Pick at least one staff'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/leaves/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffIds: selectedStaffIds, startDate, endDate, type, isPaid: type !== 'unpaid' && isPaid, reason: reason || null }),
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(locale === 'ar' ? `تم إنشاء ${data.created ?? '?'} إجازة` : `Created ${data.created ?? '?'} leaves`)
        await onRefresh()
        onClose()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Failed')
      }
    } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-lg w-full max-h-[92vh] overflow-y-auto animate-modal-in" dir={direction}>
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{locale === 'ar' ? 'إجازة جماعية' : 'Bulk Leave'}</h2>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center">
            <svg {...stroke} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{locale === 'ar' ? 'من' : 'From'}</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{locale === 'ar' ? 'إلى' : 'To'}</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{locale === 'ar' ? 'النوع' : 'Type'}</label>
            <select value={type} onChange={e => setType(e.target.value as any)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
              <option value="annual">{locale === 'ar' ? 'سنوية' : 'Annual'}</option>
              <option value="paid">{locale === 'ar' ? 'إجازة مدفوعة' : 'Paid Leave'}</option>
              <option value="sick">{locale === 'ar' ? 'مرضية' : 'Sick'}</option>
              <option value="unpaid">{locale === 'ar' ? 'بدون مرتب' : 'Unpaid'}</option>
              <option value="other">{locale === 'ar' ? 'أخرى' : 'Other'}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{locale === 'ar' ? 'سبب (اختياري)' : 'Reason (optional)'}</label>
            <input type="text" value={reason} onChange={e => setReason(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">{locale === 'ar' ? 'الموظفين' : 'Staff'}</label>
              <div className="flex gap-2">
                <button onClick={() => setSelectedStaffIds(staff.map(s => s.id))} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">{locale === 'ar' ? 'الكل' : 'All'}</button>
                <button onClick={() => setSelectedStaffIds([])} className="text-xs text-gray-500 hover:underline">{locale === 'ar' ? 'مسح' : 'Clear'}</button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1">
              {staff.map(s => (
                <label key={s.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/40 cursor-pointer">
                  <input type="checkbox" checked={selectedStaffIds.includes(s.id)} onChange={() => toggleStaff(s.id)} />
                  <span className="text-sm text-gray-900 dark:text-gray-100">{s.name}</span>
                </label>
              ))}
            </div>
          </div>
          <button onClick={submit} disabled={submitting} className="w-full min-h-[44px] bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold rounded-lg disabled:opacity-60">
            {submitting ? '...' : (locale === 'ar' ? 'إنشاء' : 'Create')}
          </button>
        </div>
      </div>
    </div>
  )
}

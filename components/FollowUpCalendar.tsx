'use client'

import { useState, useMemo } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { createWhatsAppUrl } from '../lib/whatsappHelper'

interface FollowUp {
  id: string
  notes: string
  contacted: boolean
  nextFollowUpDate?: string
  result?: string
  visitor: {
    id: string
    name: string
    phone: string
    source: string
    status: string
  }
  assignedStaff?: { id: string; name: string }
  priority?: string
}

interface Props {
  followUps: FollowUp[]
  onOpenFollowUp?: (followUp: FollowUp) => void
  onAddFollowUp?: (date: string) => void
}

const MONTH_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
const MONTH_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_AR   = ['أح','إث','ثل','أر','خم','جم','سب']
const DAY_EN   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function toLocalDateStr(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function FollowUpCalendar({ followUps, onOpenFollowUp, onAddFollowUp }: Props) {
  const { locale } = useLanguage()
  const ar = locale === 'ar'

  const todayStr = toLocalDateStr(new Date())

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr)

  // فلتر المتابعات اللي عندها تاريخ محدد
  const followUpsWithDate = useMemo(() =>
    followUps.filter(fu => fu.nextFollowUpDate),
    [followUps]
  )

  // تجميع حسب التاريخ
  const byDate = useMemo(() => {
    const map: Record<string, FollowUp[]> = {}
    followUpsWithDate.forEach(fu => {
      const d = fu.nextFollowUpDate!.split('T')[0]
      if (!map[d]) map[d] = []
      map[d].push(fu)
    })
    return map
  }, [followUpsWithDate])

  // إجمالي المتابعات اللي مش عندها تاريخ
  const undatedCount = followUps.length - followUpsWithDate.length

  // أيام الكاليندر (شبكة 7 أعمدة)
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay  = new Date(year, month + 1, 0)

    // ابدأ من الأحد
    const start = new Date(firstDay)
    start.setDate(start.getDate() - start.getDay())

    const days: Date[] = []
    const cur = new Date(start)

    while (cur <= lastDay || days.length % 7 !== 0) {
      days.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
      if (days.length >= 42) break
    }
    return days
  }, [currentMonth])

  const prevMonth = () => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))
  const nextMonth = () => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))
  const goToday  = () => {
    const now = new Date()
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelectedDate(todayStr)
  }

  const selectedFollowUps = selectedDate ? (byDate[selectedDate] || []) : []

  const sourceLabel = (source: string) => {
    const map: Record<string, string> = {
      'expired-member': ar ? 'منتهي' : 'Expired',
      'expiring-member': ar ? 'قرب ينتهي' : 'Expiring',
      'member-invitation': ar ? 'دعوة' : 'Invitation',
      'invitation': ar ? 'day use' : 'Day Use',
      'walk-in': ar ? 'walk-in' : 'Walk-in',
    }
    return map[source] || source
  }

  // إحصائيات الشهر
  const monthStats = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    let total = 0, overdue = 0, done = 0

    Object.entries(byDate).forEach(([dateStr, fus]) => {
      const d = new Date(dateStr)
      if (d.getFullYear() !== year || d.getMonth() !== month) return
      total += fus.length
      fus.forEach(fu => {
        if (dateStr < todayStr && !fu.contacted) overdue++
        if (fu.contacted) done++
      })
    })
    return { total, overdue, done }
  }, [byDate, currentMonth, todayStr])

  return (
    <div className="space-y-5">

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{monthStats.total}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400">{ar ? 'متابعات الشهر' : 'This Month'}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">{monthStats.overdue}</p>
          <p className="text-xs text-red-600 dark:text-red-400">{ar ? 'متأخرة' : 'Overdue'}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-700 dark:text-green-300">{monthStats.done}</p>
          <p className="text-xs text-green-600 dark:text-green-400">{ar ? 'تمت' : 'Done'}</p>
        </div>
      </div>

      {/* الكاليندر */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">

        {/* Header التنقل */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <button
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
          >
            {ar ? '›' : '‹'}
          </button>

          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-gray-800 dark:text-gray-100">
              {ar ? MONTH_AR[currentMonth.getMonth()] : MONTH_EN[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h2>
            <button
              onClick={goToday}
              className="text-xs px-2 py-1 rounded-md bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-200 transition-colors"
            >
              {ar ? 'اليوم' : 'Today'}
            </button>
          </div>

          <button
            onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
          >
            {ar ? '‹' : '›'}
          </button>
        </div>

        {/* أسماء الأيام */}
        <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700">
          {(ar ? DAY_AR : DAY_EN).map(day => (
            <div key={day} className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* الأيام */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const dateStr = toLocalDateStr(day)
            const fus = byDate[dateStr] || []
            const isToday = dateStr === todayStr
            const isCurrentMonth = day.getMonth() === currentMonth.getMonth()
            const isPast = dateStr < todayStr
            const isSelected = selectedDate === dateStr
            const hasOverdue = isPast && fus.some(fu => !fu.contacted)
            const hasFuture = !isPast && fus.length > 0
            const allDone = fus.length > 0 && fus.every(fu => fu.contacted)

            return (
              <button
                key={i}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`
                  relative min-h-[56px] sm:min-h-[64px] p-1.5 flex flex-col items-center border-b border-e border-gray-100 dark:border-gray-700 transition-colors
                  ${isCurrentMonth ? '' : 'opacity-30'}
                  ${isSelected ? 'bg-primary-50 dark:bg-primary-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                `}
              >
                {/* رقم اليوم */}
                <span className={`
                  text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                  ${isToday ? 'bg-primary-600 text-white' : isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300'}
                `}>
                  {day.getDate()}
                </span>

                {/* badge عدد المتابعات */}
                {fus.length > 0 && (
                  <span className={`
                    mt-1 text-xs font-bold px-1.5 py-0.5 rounded-full leading-none
                    ${allDone
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                      : hasOverdue
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                        : isToday
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    }
                  `}>
                    {fus.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* مبدأ الألوان */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400 inline-block"/> {ar ? 'متأخرة' : 'Overdue'}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block"/> {ar ? 'اليوم' : 'Today'}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-400 inline-block"/> {ar ? 'قادمة' : 'Upcoming'}</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-400 inline-block"/> {ar ? 'تمت' : 'Done'}</span>
        {undatedCount > 0 && (
          <span className="flex items-center gap-1 ms-auto text-gray-400">
            ⏳ {undatedCount} {ar ? 'بدون موعد' : 'unscheduled'}
          </span>
        )}
      </div>

      {/* قائمة اليوم المحدد */}
      {selectedDate && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-bold text-gray-800 dark:text-gray-100">
              📅 {new Date(selectedDate + 'T00:00:00').toLocaleDateString(ar ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {selectedFollowUps.length} {ar ? 'متابعة' : 'follow-ups'}
              </span>
              {onAddFollowUp && (
                <button
                  onClick={() => onAddFollowUp(selectedDate)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-xs font-semibold rounded-lg hover:bg-primary-700 transition-colors"
                >
                  ➕ {ar ? 'متابعة جديدة' : 'New Follow-up'}
                </button>
              )}
            </div>
          </div>

          {selectedFollowUps.length === 0 ? (
            <div className="text-center py-8 text-gray-400 dark:text-gray-500">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm">{ar ? 'لا توجد متابعات في هذا اليوم' : 'No follow-ups on this day'}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {selectedFollowUps.map(fu => {
                const isPast = selectedDate < todayStr
                return (
                  <div
                    key={fu.id}
                    onClick={() => onOpenFollowUp?.(fu)}
                    className={`px-4 py-3 flex items-start gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors`}
                  >
                    {/* حالة الاتصال */}
                    <div className={`mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      fu.contacted ? 'bg-green-500' : isPast ? 'bg-red-500' : 'bg-blue-500'
                    }`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                          {fu.visitor.name}
                        </p>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                          {sourceLabel(fu.visitor.source)}
                        </span>
                        {fu.contacted && (
                          <span className="text-xs text-green-600 dark:text-green-400">✓ {ar ? 'تم' : 'Done'}</span>
                        )}
                        {!fu.contacted && isPast && (
                          <span className="text-xs text-red-600 dark:text-red-400">⚠ {ar ? 'متأخرة' : 'Overdue'}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{fu.notes}</p>
                      {fu.assignedStaff && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">💼 {fu.assignedStaff.name}</p>
                      )}
                    </div>

                    <a
                      href={createWhatsAppUrl(fu.visitor.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="flex-shrink-0 text-green-600 hover:text-green-700 p-1"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </a>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

// 🧘 كلاساتي — للكوتش: كل كلاس جاي (لمدة أسبوع) + عدد اللي حجزوا وأسماءهم
import { useEffect, useState } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'

interface ClassItem {
  scheduleId: string
  date: string
  className: string
  startTime: string
  duration: number
  count: number
  members: { id: string; name: string; memberNumber: string | null }[]
}

export default function CoachClassBookings() {
  const { tr, locale } = useLanguage()
  const [classes, setClasses] = useState<ClassItem[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const load = () => fetch('/api/coach/class-bookings', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { classes: [] }))
      .then(d => { if (alive) setClasses(d.classes || []) })
      .catch(() => alive && setClasses([]))
    load()
    const t = setInterval(load, 60_000) //  الحجوزات بتتحدث كل دقيقة
    return () => { alive = false; clearInterval(t) }
  }, [])

  if (!classes || classes.length === 0) return null

  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
  const tomorrowStr = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
  const dayLabel = (s: string) => s === todayStr ? tr('النهارده', 'Today') : s === tomorrowStr ? tr('بكره', 'Tomorrow')
    : new Date(`${s}T00:00:00`).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
  const timeLabel = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    const d = new Date(); d.setHours(h || 0, m || 0)
    return d.toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="mb-6 bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">{tr('كلاساتي والحجوزات', 'My classes & bookings')}</h2>
        <span className="text-xs text-gray-500 dark:text-gray-400">{tr('الأسبوع ده', 'This week')}</span>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {classes.map(c => {
          const key = `${c.scheduleId}|${c.date}`
          const isOpen = open === key
          return (
            <li key={key}>
              <button type="button" onClick={() => setOpen(isOpen ? null : key)} disabled={!c.count} aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-start hover:bg-gray-50 dark:hover:bg-gray-700/40 disabled:hover:bg-transparent disabled:cursor-default">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 dark:text-white truncate">{c.className}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <span className={c.date === todayStr ? 'text-primary-600 dark:text-primary-400 font-bold' : ''}>{dayLabel(c.date)}</span> · {timeLabel(c.startTime)}
                  </p>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
                  c.count ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                  {c.count ? tr(`${c.count} حجز`, `${c.count} booked`) : tr('مفيش حجوزات', 'No bookings')}
                  {c.count > 0 && (
                    <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  )}
                </span>
              </button>
              {isOpen && (
                <ol className="px-4 pb-3 space-y-1.5">
                  {c.members.map((m, i) => (
                    <li key={m.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                      <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      <span className="font-semibold truncate">{m.name}</span>
                      {m.memberNumber && <span className="text-xs text-gray-400">#{m.memberNumber}</span>}
                    </li>
                  ))}
                </ol>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

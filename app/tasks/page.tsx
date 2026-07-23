'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useDarkMode } from '@/contexts/DarkModeContext'
import { useToast } from '@/contexts/ToastContext'
import { LoadingScreen } from '@/components/Spinner'

export const dynamic = 'force-dynamic'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface MyTask {
  taskId: string; status: string; completedAt: string | null
  title: string; description: string | null; dueDate: string | null; priority: string; createdByName: string; createdAt: string
}

//  ألوان الأولوية (زي TickTick — علم ملوّن + حلقة الـ checkbox)
const PRIO = {
  high: { ring: 'border-red-500', flag: 'text-red-500', dot: 'bg-red-500' },
  normal: { ring: 'border-blue-500', flag: 'text-blue-500', dot: 'bg-blue-500' },
  low: { ring: 'border-gray-400 dark:border-gray-500', flag: 'text-gray-400', dot: 'bg-gray-400' },
} as const

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() }
const DAY = 86400000

export default function MyTasksPage() {
  const { locale, direction } = useLanguage()
  useDarkMode()
  const toast = useToast()
  const ar = locale === 'ar'

  const [tasks, setTasks] = useState<MyTask[]>([])
  const [loading, setLoading] = useState(true)
  const [showDone, setShowDone] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tasks')
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed'); return }
      setTasks(data.tasks || [])
    } catch { toast.error(ar ? 'فشل التحميل' : 'Failed to load') } finally { setLoading(false) }
  }, [ar, toast])

  useEffect(() => { load() }, [load])

  const setStatus = async (t: MyTask, status: string) => {
    setTasks((prev) => prev.map((x) => (x.taskId === t.taskId ? { ...x, status } : x)))
    try {
      const res = await fetch(`/api/tasks/${t.taskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed'); load(); return }
      if (status === 'done') toast.success(ar ? 'خلصت المهمة 👏' : 'Task done 👏')
    } catch { toast.error('Failed'); load() }
  }

  //  تجميع المهام المفتوحة بالتاريخ (زي TickTick)
  const buckets = useMemo(() => {
    const today = startOfToday()
    const b: Record<string, MyTask[]> = { overdue: [], today: [], tomorrow: [], upcoming: [], nodate: [] }
    for (const t of tasks) {
      if (t.status === 'done') continue
      if (!t.dueDate) { b.nodate.push(t); continue }
      const d = new Date(t.dueDate)
      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      if (day < today) b.overdue.push(t)
      else if (day === today) b.today.push(t)
      else if (day === today + DAY) b.tomorrow.push(t)
      else b.upcoming.push(t)
    }
    //  ترتيب داخل كل مجموعة حسب الأولوية ثم الموعد
    const rank: Record<string, number> = { high: 0, normal: 1, low: 2 }
    Object.values(b).forEach((arr) => arr.sort((x, y) => (rank[x.priority] ?? 1) - (rank[y.priority] ?? 1)))
    return b
  }, [tasks])

  const doneTasks = useMemo(() => tasks.filter((t) => t.status === 'done'), [tasks])
  const openCount = tasks.length - doneTasks.length

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(ar ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
  const relDate = (iso: string) => {
    const d = new Date(iso)
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const today = startOfToday(); const time = ` · ${fmtTime(iso)}`
    if (d.getTime() < Date.now()) return (ar ? 'متأخرة' : 'Overdue') + time
    if (day === today) return (ar ? 'النهاردة' : 'Today') + time
    if (day === today + DAY) return (ar ? 'بكرة' : 'Tomorrow') + time
    return d.toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { day: '2-digit', month: '2-digit' }) + time
  }
  const dateTone = (iso: string) => {
    const d = new Date(iso)
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const today = startOfToday()
    if (d.getTime() < Date.now()) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/25'
    if (day === today) return 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/25'
    if (day === today + DAY) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/25'
    return 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/60'
  }

  const SECTIONS: { key: string; label: string; tone: string }[] = [
    { key: 'overdue', label: ar ? 'متأخرة' : 'Overdue', tone: 'text-red-600 dark:text-red-400' },
    { key: 'today', label: ar ? 'النهاردة' : 'Today', tone: 'text-primary-700 dark:text-primary-300' },
    { key: 'tomorrow', label: ar ? 'بكرة' : 'Tomorrow', tone: 'text-amber-600 dark:text-amber-400' },
    { key: 'upcoming', label: ar ? 'قادم' : 'Upcoming', tone: 'text-gray-600 dark:text-gray-300' },
    { key: 'nodate', label: ar ? 'بدون موعد' : 'No date', tone: 'text-gray-500 dark:text-gray-400' },
  ]

  const TaskRow = ({ t }: { t: MyTask }) => {
    const done = t.status === 'done'
    const p = PRIO[(t.priority as keyof typeof PRIO)] || PRIO.normal
    return (
      <div className="group flex items-start gap-3 px-3 sm:px-4 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
        {/* checkbox دائري بلون الأولوية */}
        <button
          onClick={() => setStatus(t, done ? 'pending' : 'done')}
          aria-label={done ? (ar ? 'رجّع' : 'Undo') : (ar ? 'خلصت' : 'Done')}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${done ? 'bg-emerald-500 border-emerald-500 text-white' : `${p.ring} text-transparent hover:bg-gray-100 dark:hover:bg-gray-700`}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
        </button>
        {/* المحتوى */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {!done && t.priority !== 'low' && (
              <svg {...stroke} className={`w-3.5 h-3.5 flex-shrink-0 ${p.flag}`} fill="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" /></svg>
            )}
            <span className={`text-sm truncate ${done ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100 font-medium'}`}>{t.title}</span>
          </div>
          {t.description && <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{t.description}</div>}
          <div className="flex items-center gap-2 mt-1.5">
            {t.dueDate && !done && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${dateTone(t.dueDate)}`}>
                <svg {...stroke} className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                {relDate(t.dueDate)}
              </span>
            )}
            <span className="text-[11px] text-gray-400 dark:text-gray-500">{ar ? 'من' : 'by'} {t.createdByName}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6" dir={direction}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
            <svg {...stroke} className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{ar ? 'مهامي' : 'My Tasks'}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {openCount > 0 ? (
                ar ? `${openCount} مهمة مفتوحة` : `${openCount} open`
              ) : (
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                  {ar ? 'مقروء' : 'Read'}
                </span>
              )}
            </p>
          </div>
        </div>

        {loading ? (
          <LoadingScreen />
        ) : tasks.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-14 text-center">
            <svg {...stroke} className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{ar ? 'مفيش مهام مسنَدة ليك' : 'No tasks assigned to you'}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* الأقسام المفتوحة */}
            {SECTIONS.map((s) => {
              const items = buckets[s.key]
              if (!items || items.length === 0) return null
              return (
                <div key={s.key}>
                  <div className="flex items-center gap-2 px-3 mb-1">
                    <h2 className={`text-sm font-bold ${s.tone}`}>{s.label}</h2>
                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500">{items.length}</span>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-1.5 divide-y divide-gray-100 dark:divide-gray-700/50">
                    {items.map((t) => <TaskRow key={t.taskId} t={t} />)}
                  </div>
                </div>
              )
            })}

            {openCount === 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-10 text-center text-gray-500 dark:text-gray-400 text-sm">
                {ar ? '🎉 مفيش مهام مفتوحة' : '🎉 No open tasks'}
              </div>
            )}

            {/* المكتملة (قابلة للطي) */}
            {doneTasks.length > 0 && (
              <div>
                <button onClick={() => setShowDone((v) => !v)} className="flex items-center gap-2 px-3 mb-1 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                  <svg {...stroke} className={`w-4 h-4 transition-transform ${showDone ? '' : '-rotate-90'}`}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                  {ar ? 'المكتملة' : 'Completed'}
                  <span className="text-xs">{doneTasks.length}</span>
                </button>
                {showDone && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-1.5 divide-y divide-gray-100 dark:divide-gray-700/50">
                    {doneTasks.map((t) => <TaskRow key={t.taskId} t={t} />)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

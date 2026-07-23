'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useDarkMode } from '@/contexts/DarkModeContext'
import { useToast } from '@/contexts/ToastContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ConfirmDialog'
import { LoadingScreen } from '@/components/Spinner'

export const dynamic = 'force-dynamic'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface Employee { id: string; name: string; role: string; position: string | null }
interface Assignment { userId: string; name: string; status: string; completedAt: string | null }
interface Task {
  id: string; title: string; description: string | null; dueDate: string | null; priority: string
  createdByName: string; createdAt: string; assignments: Assignment[]; total: number; doneCount: number; allDone: boolean
}

const PRIO_FLAG: Record<string, string> = { high: 'text-red-500', normal: 'text-amber-500', low: 'text-gray-400' }
const DAY = 86400000
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() }

//  أيقونة العلم (الأولوية)
const Flag = ({ className }: { className?: string }) => (
  <svg {...stroke} className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" /></svg>
)
const CalIcon = ({ className }: { className?: string }) => (
  <svg {...stroke} className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
)

const emptyForm = { title: '', description: '', dueDay: '', dueTime: '', priority: 'normal' }

export default function AdminTasksPage() {
  const { locale, direction } = useLanguage()
  useDarkMode()
  const toast = useToast()
  const { user, loading: permLoading } = usePermissions()
  const { confirm, isOpen, options, handleConfirm, handleCancel } = useConfirm()
  const ar = locale === 'ar'
  const isAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN'

  const [tasks, setTasks] = useState<Task[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [summary, setSummary] = useState({ total: 0, active: 0, done: 0, overdue: 0 })
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(['completed']))
  const [expandedId, setExpandedId] = useState<string | null>(null)

  //  modal إنشاء
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [selected, setSelected] = useState<string[]>([])
  const [empSearch, setEmpSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const toggleCollapse = (k: string) => setCollapsed((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })
  const toggleEmp = (id: string) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const roleLabel = (e: Employee) => e.position || (e.role === 'COACH' ? (ar ? 'كوتش' : 'Coach') : e.role)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/tasks')
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed'); return }
      setTasks(data.tasks || [])
      setEmployees(data.employees || [])
      if (data.summary) setSummary(data.summary)
    } catch { toast.error(ar ? 'فشل التحميل' : 'Failed to load') } finally { setLoading(false) }
  }, [ar, toast])

  useEffect(() => { if (isAdmin) load() }, [isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  const openForm = () => { setForm(emptyForm); setSelected([]); setEmpSearch(''); setShowForm(true) }

  const create = async () => {
    if (!form.title.trim()) { toast.warning(ar ? 'اكتب عنوان المهمة' : 'Enter a title'); return }
    if (selected.length === 0) { toast.warning(ar ? 'اختار موظف' : 'Select an employee'); return }
    setSaving(true)
    //  دمج التاريخ والوقت: لو فيه تاريخ من غير وقت → آخر اليوم
    const dueDate = form.dueDay ? `${form.dueDay}T${form.dueTime || '23:59'}` : ''
    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, description: form.description, priority: form.priority, dueDate, assigneeIds: selected }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || (ar ? 'فشل' : 'Failed')); return }
      toast.success(ar ? `اتسند لـ ${data.assignedCount} موظف` : `Assigned to ${data.assignedCount}`)
      setShowForm(false)
      load()
    } catch { toast.error(ar ? 'فشل الحفظ' : 'Failed') } finally { setSaving(false) }
  }

  const remove = async (t: Task) => {
    const ok = await confirm({
      title: ar ? 'حذف المهمة' : 'Delete task',
      message: ar ? `متأكد إنك عايز تمسح مهمة «${t.title}»؟ مش هينفع ترجع فيها.` : `Delete task "${t.title}"? This cannot be undone.`,
      confirmText: ar ? 'حذف' : 'Delete', cancelText: ar ? 'إلغاء' : 'Cancel', type: 'danger',
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/admin/tasks/${t.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed'); return }
      toast.success(ar ? 'اتمسحت' : 'Deleted'); load()
    } catch { toast.error('Failed') }
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(ar ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
  const dayOf = (iso: string) => { const d = new Date(iso); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() }
  const dueLabel = (t: Task) => {
    if (!t.dueDate) return ''
    const day = dayOf(t.dueDate); const today = startOfToday(); const time = ` · ${fmtTime(t.dueDate)}`
    if (!t.allDone && new Date(t.dueDate).getTime() < Date.now()) return (ar ? 'متأخرة' : 'Overdue') + time
    if (day === today) return (ar ? 'النهاردة' : 'Today') + time
    if (day === today + DAY) return (ar ? 'بكرة' : 'Tomorrow') + time
    return fmtDate(t.dueDate) + time
  }
  const dueTone = (t: Task) => {
    if (!t.dueDate) return ''
    const day = dayOf(t.dueDate); const today = startOfToday()
    if (!t.allDone && new Date(t.dueDate).getTime() < Date.now()) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/25'
    if (day === today) return 'text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/25'
    if (day === today + DAY) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/25'
    return 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700/60'
  }

  const grouped = useMemo(() => {
    const today = startOfToday()
    const g: Record<string, Task[]> = { week: [], month: [], later: [], nodate: [], completed: [] }
    for (const t of tasks) {
      if (t.allDone) { g.completed.push(t); continue }
      if (!t.dueDate) { g.nodate.push(t); continue }
      const day = dayOf(t.dueDate)
      if (day <= today + 6 * DAY) g.week.push(t)
      else if (day <= today + 30 * DAY) g.month.push(t)
      else g.later.push(t)
    }
    const rank: Record<string, number> = { high: 0, normal: 1, low: 2 }
    const byDue = (x: Task, y: Task) => {
      const xd = x.dueDate ? dayOf(x.dueDate) : Infinity
      const yd = y.dueDate ? dayOf(y.dueDate) : Infinity
      if (xd !== yd) return xd - yd
      return (rank[x.priority] ?? 1) - (rank[y.priority] ?? 1)
    }
    Object.values(g).forEach((arr) => arr.sort(byDue))
    return g
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks])

  const SECTIONS = [
    { key: 'week', label: ar ? 'هذا الأسبوع' : 'This week' },
    { key: 'month', label: ar ? 'هذا الشهر' : 'This month' },
    { key: 'later', label: ar ? 'لاحقًا' : 'Later' },
    { key: 'nodate', label: ar ? 'بدون موعد' : 'No date' },
    { key: 'completed', label: ar ? 'المكتملة' : 'Completed' },
  ]

  if (permLoading) return <LoadingScreen fullScreen />
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6" dir={direction}>
        <div className="bg-white dark:bg-gray-800 rounded-2xl ring-1 ring-gray-200 dark:ring-gray-700 p-8 text-center max-w-md">
          <p className="text-gray-700 dark:text-gray-200 font-bold">{ar ? 'هذه الصفحة للأدمن فقط' : 'Admins only'}</p>
        </div>
      </div>
    )
  }

  const inputCls = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent focus:bg-white dark:focus:bg-gray-700 transition-colors'
  const labelCls = 'block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5'
  const filteredEmps = employees.filter((e) => !empSearch.trim() || e.name.toLowerCase().includes(empSearch.toLowerCase()) || (e.position || '').toLowerCase().includes(empSearch.toLowerCase()))

  //  إحصائية مصغّرة
  const StatPill = ({ label, value, tone }: { label: string; value: number; tone: string }) => (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 text-sm">
      <span className={`font-bold ${tone}`}>{value}</span>
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6" dir={direction}>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
              <svg {...stroke} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100">{ar ? 'المهام' : 'Tasks'}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">{ar ? 'اسند وتابع مهام الفريق' : 'Assign & track team tasks'}</p>
            </div>
          </div>
          <button onClick={openForm} className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-primary-contrast font-bold px-4 py-2.5 rounded-xl text-sm transition-colors shadow-sm">
            <svg {...stroke} className="w-4 h-4" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            {ar ? 'مهمة جديدة' : 'New task'}
          </button>
        </div>

        {/* Stat pills */}
        {summary.total > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <StatPill label={ar ? 'الكل' : 'Total'} value={summary.total} tone="text-gray-900 dark:text-gray-100" />
            <StatPill label={ar ? 'شغّالة' : 'Active'} value={summary.active} tone="text-blue-600 dark:text-blue-400" />
            {summary.overdue > 0 && <StatPill label={ar ? 'متأخرة' : 'Overdue'} value={summary.overdue} tone="text-red-600 dark:text-red-400" />}
            <StatPill label={ar ? 'خلصت' : 'Done'} value={summary.done} tone="text-emerald-600 dark:text-emerald-400" />
          </div>
        )}

        {/* List */}
        {loading ? (
          <LoadingScreen />
        ) : tasks.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl ring-1 ring-gray-200 dark:ring-gray-700 p-14 text-center">
            <svg {...stroke} className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">{ar ? 'مفيش مهام لسه' : 'No tasks yet'}</p>
            <button onClick={openForm} className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-primary-contrast font-bold px-4 py-2 rounded-lg text-sm">
              {ar ? 'أنشئ أول مهمة' : 'Create first task'}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {SECTIONS.map((sec) => {
              const items = grouped[sec.key]
              if (!items || items.length === 0) return null
              const isCollapsed = collapsed.has(sec.key)
              return (
                <div key={sec.key}>
                  <button onClick={() => toggleCollapse(sec.key)} className="flex items-center gap-2 px-1 mb-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                    <svg {...stroke} className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                    <span className="text-xs font-bold uppercase tracking-wide">{sec.label}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{items.length}</span>
                  </button>
                  {!isCollapsed && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl ring-1 ring-gray-200 dark:ring-gray-700 divide-y divide-gray-100 dark:divide-gray-700/50 overflow-hidden">
                      {items.map((t) => {
                        const open = expandedId === t.id
                        return (
                          <div key={t.id}>
                            <div onClick={() => setExpandedId(open ? null : t.id)} className="group flex items-center gap-3 px-3.5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors cursor-pointer">
                              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${t.allDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 dark:border-gray-600 text-transparent'}`}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {t.priority !== 'low' && !t.allDone && <Flag className={`w-3.5 h-3.5 flex-shrink-0 ${PRIO_FLAG[t.priority]}`} />}
                                  <span className={`text-sm truncate ${t.allDone ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100 font-medium'}`}>{t.title}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  {t.dueDate && (
                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${dueTone(t)}`}>
                                      <CalIcon className="w-2.5 h-2.5" />{dueLabel(t)}
                                    </span>
                                  )}
                                  <span className={`text-[11px] font-bold ${t.allDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>{t.doneCount}/{t.total}</span>
                                </div>
                              </div>
                              <div className="flex -space-x-2 rtl:space-x-reverse flex-shrink-0">
                                {t.assignments.slice(0, 3).map((a) => (
                                  <span key={a.userId} title={a.name} className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ring-2 ring-white dark:ring-gray-800 ${a.status === 'done' ? 'bg-emerald-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-200'}`}>{a.name.charAt(0).toUpperCase()}</span>
                                ))}
                                {t.assignments.length > 3 && <span className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 flex items-center justify-center text-[10px] font-bold ring-2 ring-white dark:ring-gray-800">+{t.assignments.length - 3}</span>}
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); remove(t) }} title={ar ? 'حذف' : 'Delete'} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                                <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                              </button>
                            </div>
                            {open && (
                              <div className="px-4 pb-3.5 ps-12 bg-gray-50/60 dark:bg-gray-900/20">
                                {t.description && <div className="text-sm text-gray-600 dark:text-gray-300 pt-2 mb-3 whitespace-pre-wrap">{t.description}</div>}
                                <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 pt-1">{ar ? 'المسنَد لهم' : 'Assigned to'}</div>
                                <div className="flex flex-wrap gap-2">
                                  {t.assignments.map((a) => (
                                    <span key={a.userId} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${a.status === 'done' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                                      {a.status === 'done'
                                        ? <svg {...stroke} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                                        : <svg {...stroke} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
                                      {a.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showForm && (
        <div className="fixed inset-0 z-[10000] flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-lg w-full my-4 max-h-[calc(100vh-2rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent" dir={direction} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700/60 sticky top-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur z-10">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{ar ? 'مهمة جديدة' : 'New task'}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700" aria-label="Close">
                <svg {...stroke} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className={labelCls}>{ar ? 'العنوان' : 'Title'} <span className="text-red-500">*</span></label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} placeholder={ar ? 'مثال: تنظيف منطقة الأوزان' : 'e.g. Clean the weights area'} autoFocus />
              </div>
              <div>
                <label className={labelCls}>{ar ? 'التفاصيل (اختياري)' : 'Details (optional)'}</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{ar ? 'الموعد النهائي' : 'Deadline'}</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input type="date" value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: e.target.value })} className={inputCls} />
                    <span className="block text-[11px] text-gray-400 dark:text-gray-500 mt-1">{ar ? 'التاريخ' : 'Date'}</span>
                  </div>
                  <div>
                    <input type="time" value={form.dueTime} onChange={(e) => setForm({ ...form, dueTime: e.target.value })} disabled={!form.dueDay} className={`${inputCls} disabled:opacity-50`} />
                    <span className="block text-[11px] text-gray-400 dark:text-gray-500 mt-1">{ar ? 'الوقت (اختياري)' : 'Time (optional)'}</span>
                  </div>
                </div>
              </div>
              <div>
                <label className={labelCls}>{ar ? 'الأولوية' : 'Priority'}</label>
                <div className="flex gap-2">
                  {[
                    { v: 'low', l: ar ? 'منخفضة' : 'Low', on: 'ring-2 ring-gray-300 dark:ring-gray-500 bg-gray-50 dark:bg-gray-700/60 text-gray-700 dark:text-gray-200' },
                    { v: 'normal', l: ar ? 'عادية' : 'Normal', on: 'ring-2 ring-amber-400 bg-amber-50 dark:bg-amber-900/25 text-amber-700 dark:text-amber-300' },
                    { v: 'high', l: ar ? 'عالية' : 'High', on: 'ring-2 ring-red-400 bg-red-50 dark:bg-red-900/25 text-red-700 dark:text-red-300' },
                  ].map((p) => (
                    <button key={p.v} type="button" onClick={() => setForm({ ...form, priority: p.v })} className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${form.priority === p.v ? p.on : 'ring-1 ring-gray-200 dark:ring-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40'}`}>
                      <Flag className={`w-4 h-4 ${form.priority === p.v ? (PRIO_FLAG[p.v]) : 'text-gray-400'}`} />{p.l}
                    </button>
                  ))}
                </div>
              </div>
              {/* employees */}
              <div>
                <label className={labelCls}>{ar ? 'اسنِد لـ' : 'Assign to'} <span className="text-red-500">*</span> {selected.length > 0 && <span className="text-primary-600 dark:text-primary-400">({selected.length})</span>}</label>
                <input value={empSearch} onChange={(e) => setEmpSearch(e.target.value)} placeholder={ar ? 'ابحث عن موظف...' : 'Search employee...'} className={`${inputCls} mb-2`} />
                <div className="max-h-60 overflow-y-auto rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 divide-y divide-gray-100 dark:divide-gray-700/50 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
                  {filteredEmps.length === 0 ? (
                    <div className="p-4 text-sm text-center text-gray-400">{ar ? 'مفيش موظفين' : 'No employees'}</div>
                  ) : filteredEmps.map((e) => {
                    const on = selected.includes(e.id)
                    return (
                      <button key={e.id} type="button" onClick={() => toggleEmp(e.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 text-start transition-colors ${on ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'}`}>
                        <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-primary-contrast flex items-center justify-center font-bold text-xs flex-shrink-0">{e.name.charAt(0).toUpperCase()}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">{e.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{roleLabel(e)}</div>
                        </div>
                        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${on ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-300 dark:border-gray-600 text-transparent'}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-gray-700/60 sticky bottom-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur">
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-600">{ar ? 'إلغاء' : 'Cancel'}</button>
              <button onClick={create} disabled={saving} className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-primary-contrast font-bold text-sm">{ar ? 'إسناد المهمة' : 'Assign'}</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={isOpen} title={options.title} message={options.message} confirmText={options.confirmText} cancelText={options.cancelText} onConfirm={handleConfirm} onCancel={handleCancel} type={options.type} />
    </div>
  )
}

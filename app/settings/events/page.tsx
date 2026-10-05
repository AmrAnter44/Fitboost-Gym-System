'use client'

export const dynamic = 'force-dynamic'

// 📣 إيفنتات الجيم — بتظهر للأعضاء في الأبلكيشن تحت الكارنيه + إشعار لكل أعضاء الفرع
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/contexts/LanguageContext'
import { useToast } from '@/contexts/ToastContext'
import { usePermissions } from '@/hooks/usePermissions'
import PermissionDenied from '@/components/PermissionDenied'
import { LoadingScreen } from '@/components/Spinner'

interface GymEvent {
  id: string
  title: string
  description: string | null
  startsAt: string
  endsAt: string | null
  isActive: boolean
  notifiedAt: string | null
  notifiedCount: number | null
}

// datetime-local ↔ ISO بالتوقيت المحلي
const toLocalInput = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

const empty = { title: '', description: '', startsAt: '', endsAt: '', notify: true }

export default function EventsSettingsPage() {
  const { tr, locale, direction } = useLanguage()
  const toast = useToast()
  const { hasPermission, loading: permLoading } = usePermissions()
  const [events, setEvents] = useState<GymEvent[] | null>(null)
  const [devices, setDevices] = useState(0)
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () =>
    fetch('/api/events', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => { setEvents(d.events || []); setDevices(d.devices || 0) })
      .catch(() => setEvents([]))
  useEffect(() => { load() }, [])

  if (permLoading) return <LoadingScreen />
  if (!hasPermission('canAccessSettings')) return <PermissionDenied />

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

  const notify = async (id: string, askFirst = true) => {
    if (askFirst && !confirm(tr(`هيتبعت إشعار لـ ${devices} عضو عندهم الأبلكيشن. تكمل؟`, `A notification will be sent to ${devices} members with the app. Continue?`))) return
    const r = await fetch(`/api/events/${id}/notify`, { method: 'POST' })
    const j = await r.json().catch(() => ({}))
    if (r.ok) toast.success(tr(`اتبعت لـ ${j.sent} عضو`, `Sent to ${j.sent} members`))
    else toast.error(j.error || tr('فشل الإرسال', 'Send failed'))
    load()
  }

  const save = async () => {
    if (!form.title.trim() || !form.startsAt) return toast.error(tr('اكتب اسم الإيفنت وميعاده', 'Enter the event name and time'))
    setBusy(true)
    try {
      const body = JSON.stringify({
        title: form.title, description: form.description,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      })
      const r = await fetch(editing ? `/api/events/${editing}` : '/api/events', {
        method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body,
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) return toast.error(j.error || tr('فشل الحفظ', 'Save failed'))
      toast.success(editing ? tr('اتعدّل', 'Updated') : tr('الإيفنت اتضاف وظاهر في الأبلكيشن', 'Event added and visible in the app'))
      if (!editing && form.notify && j.event?.id && devices > 0) await notify(j.event.id, false)
      setForm(empty); setEditing(null); load()
    } finally { setBusy(false) }
  }

  const toggle = async (e: GymEvent) => {
    await fetch(`/api/events/${e.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: e.title, description: e.description, startsAt: e.startsAt, endsAt: e.endsAt, isActive: !e.isActive }),
    })
    load()
  }

  const remove = async (e: GymEvent) => {
    if (!confirm(tr(`تمسح «${e.title}»؟`, `Delete "${e.title}"?`))) return
    await fetch(`/api/events/${e.id}`, { method: 'DELETE' })
    load()
  }

  const now = Date.now()
  const input = 'w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500'
  const label = 'block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5'

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5" dir={direction}>
      <div className="flex items-center gap-3">
        <Link href="/settings" className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-lg rtl:rotate-180" aria-label={tr('رجوع', 'Back')}>‹</Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">📣 {tr('الإيفنتات', 'Events')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{tr('بتظهر للأعضاء في الأبلكيشن تحت الكارنيه، وتقدر تبعتلهم إشعار', 'Shown to members in the app under their pass — optionally notify them')}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-5 space-y-4">
        <h2 className="font-bold text-gray-900 dark:text-gray-100">{editing ? tr('تعديل إيفنت', 'Edit event') : tr('إيفنت جديد', 'New event')}</h2>
        <div>
          <label className={label}>{tr('اسم الإيفنت', 'Event name')} *</label>
          <input className={input} maxLength={120} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={tr('مثال: تحدي البلانك — جوايز للفايزين', 'e.g. Plank challenge — prizes for winners')} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>{tr('الميعاد', 'Starts')} *</label>
            <input type="datetime-local" className={input} value={form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })} />
          </div>
          <div>
            <label className={label}>{tr('بينتهي (اختياري)', 'Ends (optional)')}</label>
            <input type="datetime-local" className={input} value={form.endsAt} onChange={e => setForm({ ...form, endsAt: e.target.value })} />
          </div>
        </div>
        <div>
          <label className={label}>{tr('تفاصيل (اختياري)', 'Details (optional)')}</label>
          <textarea className={input} rows={3} maxLength={1000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
        {!editing && (
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" className="w-4 h-4" checked={form.notify} onChange={e => setForm({ ...form, notify: e.target.checked })} />
            {tr(`ابعت إشعار لكل أعضاء الفرع اللي عندهم الأبلكيشن (${devices})`, `Notify all branch members with the app (${devices})`)}
          </label>
        )}
        <div className="flex gap-2">
          <button onClick={save} disabled={busy} className="flex-1 min-h-[44px] rounded-lg bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold disabled:opacity-60">
            {busy ? tr('جارٍ الحفظ...', 'Saving...') : editing ? tr('حفظ التعديل', 'Save changes') : tr('نشر الإيفنت', 'Publish event')}
          </button>
          {editing && (
            <button onClick={() => { setEditing(null); setForm(empty) }} className="px-4 min-h-[44px] rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold">{tr('إلغاء', 'Cancel')}</button>
          )}
        </div>
      </div>

      {events === null ? <LoadingScreen /> : events.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">{tr('مفيش إيفنتات لسه', 'No events yet')}</p>
      ) : (
        <div className="space-y-3">
          {events.map(e => {
            const past = new Date(e.endsAt || e.startsAt).getTime() < now - (e.endsAt ? 0 : 3 * 3600_000)
            return (
              <div key={e.id} className={`bg-white dark:bg-gray-800 rounded-2xl ring-1 ring-gray-200 dark:ring-gray-700 p-4 ${past || !e.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 dark:text-gray-100 break-words">{e.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{fmt(e.startsAt)}{e.endsAt ? ` → ${fmt(e.endsAt)}` : ''}</p>
                    {e.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 whitespace-pre-line break-words">{e.description}</p>}
                    <p className="text-xs mt-1.5 font-semibold">
                      {past ? <span className="text-gray-500">{tr('خلص', 'Ended')}</span>
                        : !e.isActive ? <span className="text-amber-600">{tr('مخفي من الأبلكيشن', 'Hidden from the app')}</span>
                        : <span className="text-emerald-600">{tr('ظاهر في الأبلكيشن', 'Visible in the app')}</span>}
                      {e.notifiedAt && <span className="text-gray-500"> · 🔔 {tr(`اتبعت لـ ${e.notifiedCount ?? 0}`, `sent to ${e.notifiedCount ?? 0}`)}</span>}
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {!past && e.isActive && (
                      <button onClick={() => notify(e.id)} className="px-3 py-2 rounded-lg text-sm font-bold bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">🔔 {e.notifiedAt ? tr('إعادة إرسال', 'Resend') : tr('ابعت إشعار', 'Notify')}</button>
                    )}
                    <button onClick={() => { setEditing(e.id); setForm({ title: e.title, description: e.description || '', startsAt: toLocalInput(e.startsAt), endsAt: toLocalInput(e.endsAt), notify: false }); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="px-3 py-2 rounded-lg text-sm font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">{tr('تعديل', 'Edit')}</button>
                    <button onClick={() => toggle(e)} className="px-3 py-2 rounded-lg text-sm font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">{e.isActive ? tr('إخفاء', 'Hide') : tr('إظهار', 'Show')}</button>
                    <button onClick={() => remove(e)} className="px-3 py-2 rounded-lg text-sm font-bold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">{tr('حذف', 'Delete')}</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

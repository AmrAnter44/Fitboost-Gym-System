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

//  🎯 مين يوصله الإشعار — من غير اختيار = كل الأعضاء
const SEGMENT_GROUPS = [
  { label: ['الأعضاء', 'Members'], items: [
    { key: 'members-active', ar: 'الناشطين', en: 'Active', dot: 'bg-emerald-500' },
    { key: 'members-expiring', ar: 'قربوا يخلصوا (7 أيام)', en: 'Expiring (7 days)', dot: 'bg-amber-500' },
    { key: 'members-expired', ar: 'المنتهيين', en: 'Expired', dot: 'bg-red-500' },
  ] },
  { label: ['الحصص المخصصة', 'Personal training'], items: [
    { key: 'pt-active', ar: 'الناشطين', en: 'Active', dot: 'bg-emerald-500' },
    { key: 'pt-expired', ar: 'المنتهيين', en: 'Expired', dot: 'bg-red-500' },
  ] },
]

export default function EventsSettingsPage() {
  const { tr, locale, direction } = useLanguage()
  const toast = useToast()
  const { hasPermission, loading: permLoading } = usePermissions()
  const [events, setEvents] = useState<GymEvent[] | null>(null)
  const [devices, setDevices] = useState(0)
  const [audience, setAudience] = useState(0)
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [segments, setSegments] = useState<string[]>([])

  const load = () =>
    fetch('/api/events' + (segments.length ? `?segments=${segments.join(',')}` : ''), { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => { setEvents(d.events || []); setDevices(d.devices || 0); setAudience(d.audience || 0) })
      .catch(() => setEvents([]))
  useEffect(() => { load() }, [segments.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  if (permLoading) return <LoadingScreen />
  if (!hasPermission('canAccessSettings')) return <PermissionDenied />

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

  const notify = async (id: string, askFirst = true) => {
    if (askFirst && !confirm(tr(`هيتبعت إشعار لـ ${devices} عضو عندهم الأبلكيشن${segments.length ? ' (حسب الفلتر)' : ''}. تكمل؟`, `A notification will be sent to ${devices} members with the app${segments.length ? ' (filtered)' : ''}. Continue?`))) return
    const r = await fetch(`/api/events/${id}/notify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ segments }) })
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
        {/*  🔔 إشعار للأعضاء — سويتش + مين يوصله + العدد */}
        {!editing && (
          <div className="rounded-2xl ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900/40">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center shrink-0">
                  <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" /></svg>
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{tr('ابعت إشعار للأعضاء', 'Notify members')}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{tr('بيوصل على أبلكيشن الأعضاء أول ما تنشر', 'Sent to the members app when you publish')}</p>
                </div>
              </div>
              <button type="button" role="switch" aria-checked={form.notify} onClick={() => setForm({ ...form, notify: !form.notify })}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${form.notify ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${form.notify ? 'start-[1.375rem]' : 'start-0.5'}`} />
              </button>
            </div>

            <div className={`p-4 space-y-4 ${form.notify ? '' : 'opacity-50'}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{tr('مين يوصله؟', 'Who gets it?')}</p>
                <button type="button" aria-pressed={segments.length === 0} onClick={() => setSegments([])}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${segments.length === 0
                    ? 'bg-primary-500 text-primary-contrast'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                  {tr('كل الأعضاء', 'Everyone')}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SEGMENT_GROUPS.map(g => (
                  <div key={g.label[0]} className="rounded-xl bg-gray-50 dark:bg-gray-900/40 p-3">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">{tr(g.label[0], g.label[1])}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {g.items.map(it => {
                        const on = segments.includes(it.key)
                        return (
                          <button key={it.key} type="button" aria-pressed={on}
                            onClick={() => setSegments(prev => on ? prev.filter(x => x !== it.key) : [...prev, it.key])}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ring-1 transition-colors ${on
                              ? 'bg-white dark:bg-gray-800 ring-primary-500 text-gray-900 dark:text-white'
                              : 'bg-white/60 dark:bg-gray-800/60 ring-gray-200 dark:ring-gray-700 text-gray-600 dark:text-gray-300 hover:ring-gray-300 dark:hover:ring-gray-600'}`}>
                            <span className={`w-2 h-2 rounded-full ${it.dot}`} aria-hidden="true" />
                            {tr(it.ar, it.en)}
                            {on && <span className="text-primary-600 dark:text-primary-400" aria-hidden="true">✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 px-3 py-2.5">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{tr('أعضاء في الفلتر', 'Members matched')}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{audience.toLocaleString('en-US')}</p>
                </div>
                <div className={`rounded-xl ring-1 px-3 py-2.5 ${devices ? 'ring-emerald-200 dark:ring-emerald-800 bg-emerald-50 dark:bg-emerald-900/20' : 'ring-amber-200 dark:ring-amber-800 bg-amber-50 dark:bg-amber-900/20'}`}>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{tr('هيوصلهم الإشعار', 'Will receive it')}</p>
                  <p className={`text-xl font-bold ${devices ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>{devices.toLocaleString('en-US')}</p>
                </div>
              </div>
              {devices === 0 && audience > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400">{tr('محدش من دول نازل عنده أبلكيشن الأعضاء — الإشعار بيوصل للي عندهم الأبلكيشن بس.', 'None of these have the members app — only app users get notified.')}</p>
              )}
              <p className="text-[11px] text-gray-400 dark:text-gray-500">{tr('نفس الفلتر بيتطبق على زرار «ابعت إشعار» في الإيفنتات تحت.', 'The same filter applies to the «Notify» buttons below.')}</p>
            </div>
          </div>
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

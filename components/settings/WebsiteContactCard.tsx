'use client'

/**
 * 📞 بيانات التواصل على موقع الجيم — رقم الواتساب، التليفون، اللوكيشن،
 * مواعيد العمل، وصفحات فيسبوك / إنستجرام / تيك توك.
 * صف واحد لكل فرع، بيتحفظ عن طريق Control. متاحة للأدمن والأونر بس.
 */

import { useCallback, useEffect, useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast } from '../../contexts/ToastContext'
import {
  CONTACT_DAYS, CONTACT_DAY_LABELS, type ContactDay, type ContactHours, type WebsiteContact,
} from '../../lib/websiteContact'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200'

type DayRow = { day: ContactDay; closed: boolean; open: string; close: string }
type FormState = {
  whatsapp: string; phone: string; address: string; maps_url: string
  facebook: string; instagram: string; tiktok: string; hours_note: string
  hours: DayRow[]
}

const emptyHours = (): DayRow[] => CONTACT_DAYS.map((day) => ({ day, closed: false, open: '', close: '' }))

/** 201012345678 → 01012345678 (أسهل في الكتابة والقراءة للمصريين) */
const displayPhone = (v: string | null) => (v && /^201\d{9}$/.test(v) ? v.slice(1) : v || '')

function toForm(c: WebsiteContact | null): FormState {
  const hours = emptyHours().map((row) => {
    const h = c?.hours?.find((x: ContactHours) => x.day === row.day)
    return h ? { day: row.day, closed: !!h.closed, open: h.open || '', close: h.close || '' } : row
  })
  return {
    whatsapp: displayPhone(c?.whatsapp ?? null), phone: displayPhone(c?.phone ?? null),
    address: c?.address || '', maps_url: c?.maps_url || '',
    facebook: c?.facebook || '', instagram: c?.instagram || '', tiktok: c?.tiktok || '',
    hours_note: c?.hours_note || '', hours,
  }
}

export default function WebsiteContactCard() {
  const { locale, direction } = useLanguage()
  const toast = useToast()
  const ar = locale === 'ar'
  const tr = (a: string, e: string) => (ar ? a : e)

  const [form, setForm] = useState<FormState>(() => toForm(null))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/website-contact', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || tr('تعذر تحميل بيانات التواصل', 'Could not load contact info'))
      setForm(toForm(data.contact ?? null))
      setUpdatedAt(data.updatedAt ?? null)
      setDirty(false)
    } catch (e: any) {
      setLoadError(e?.message || tr('تعذر تحميل بيانات التواصل', 'Could not load contact info'))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale])

  useEffect(() => { load() }, [load])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setDirty(true)
  }
  const setDay = (day: ContactDay, patch: Partial<DayRow>) =>
    set('hours', form.hours.map((h) => (h.day === day ? { ...h, ...patch } : h)))

  /** نسخ مواعيد السبت لكل الأيام اللي مش مقفولة */
  const copyFirstDay = () => {
    const first = form.hours[0]
    set('hours', form.hours.map((h, i) => (i === 0 || h.closed ? h : { ...h, open: first.open, close: first.close })))
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/website-contact', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: form }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || tr('فشل الحفظ', 'Save failed'))
      setForm(toForm(data.contact ?? null))
      setUpdatedAt(data.updatedAt ?? null)
      setDirty(false)
      toast.success(tr('اتحفظت بيانات التواصل — هتظهر على الموقع خلال دقايق', 'Contact info saved — it will show on the website within minutes'))
    } catch (e: any) {
      toast.error(e?.message || tr('فشل الحفظ', 'Save failed'), 8000)
    } finally {
      setSaving(false)
    }
  }

  const card = 'bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5'

  return (
    <div className={card} dir={direction}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
            <svg {...stroke} className="w-6 h-6" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{tr('بيانات التواصل على الموقع', 'Website Contact Info')}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
              {tr('الواتساب واللوكيشن ومواعيد العمل وصفحات السوشيال اللي بتظهر في الموقع', 'WhatsApp, location, opening hours and social pages shown on the website')}
              {updatedAt && <span className="text-gray-400"> · {tr('آخر تعديل', 'Last updated')} {new Date(updatedAt).toLocaleString(ar ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>}
            </p>
          </div>
        </div>
        <button onClick={save} disabled={saving || loading || !!loadError || !dirty}
          className="inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white transition-colors disabled:opacity-50 flex-shrink-0">
          {saving ? tr('جاري الحفظ…', 'Saving…') : tr('حفظ', 'Save')}
        </button>
      </div>

      {loadError ? (
        <div className="flex items-center justify-between gap-3 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-900/50 rounded-lg p-3">
          <p className="text-sm font-bold text-amber-800 dark:text-amber-300">{loadError}</p>
          <button onClick={load} className="text-sm font-semibold text-amber-800 dark:text-amber-300 underline">{tr('إعادة المحاولة', 'Retry')}</button>
        </div>
      ) : loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{tr('جاري التحميل…', 'Loading…')}</p>
      ) : (
        <div className="space-y-6">
          {/* التواصل والمكان */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={tr('رقم الواتساب', 'WhatsApp number')} hint={tr('مثال: 01012345678 — ده اللي بتفتحه زراير الحجز في الموقع', 'e.g. 01012345678 — used by the booking buttons')}>
              <input dir="ltr" inputMode="tel" className={inputCls} value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="01012345678" />
            </Field>
            <Field label={tr('رقم التليفون (اختياري)', 'Phone number (optional)')}>
              <input dir="ltr" inputMode="tel" className={inputCls} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="01012345678" />
            </Field>
            <Field label={tr('رابط اللوكيشن (جوجل ماب)', 'Location link (Google Maps)')} hint={tr('من جوجل ماب: مشاركة ← نسخ الرابط', 'From Google Maps: Share → Copy link')}>
              <input dir="ltr" className={inputCls} value={form.maps_url} onChange={(e) => set('maps_url', e.target.value)} placeholder="https://maps.app.goo.gl/…" />
            </Field>
            <Field label={tr('العنوان (اختياري)', 'Address (optional)')}>
              <input className={inputCls} value={form.address} onChange={(e) => set('address', e.target.value)} />
            </Field>
          </div>

          {/* السوشيال */}
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3">{tr('صفحات السوشيال', 'Social pages')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Facebook">
                <input dir="ltr" className={inputCls} value={form.facebook} onChange={(e) => set('facebook', e.target.value)} placeholder="https://facebook.com/…" />
              </Field>
              <Field label="Instagram">
                <input dir="ltr" className={inputCls} value={form.instagram} onChange={(e) => set('instagram', e.target.value)} placeholder="https://instagram.com/…" />
              </Field>
              <Field label="TikTok">
                <input dir="ltr" className={inputCls} value={form.tiktok} onChange={(e) => set('tiktok', e.target.value)} placeholder="https://tiktok.com/@…" />
              </Field>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{tr('اللي تسيبه فاضي مش هيظهر على الموقع.', 'Anything left empty will not show on the website.')}</p>
          </div>

          {/* مواعيد العمل */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{tr('مواعيد العمل', 'Opening hours')}</h3>
              <button type="button" onClick={copyFirstDay}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg ring-1 ring-gray-300 dark:ring-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                {tr('نفس مواعيد السبت لكل الأيام', 'Copy Saturday to all days')}
              </button>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700">
              {form.hours.map((h) => (
                <div key={h.day} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <span className="w-24 text-sm font-bold text-gray-800 dark:text-gray-200">{ar ? CONTACT_DAY_LABELS[h.day].ar : CONTACT_DAY_LABELS[h.day].en}</span>
                  <label className="inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={h.closed} onChange={(e) => setDay(h.day, { closed: e.target.checked })} />
                    {tr('مقفول', 'Closed')}
                  </label>
                  {!h.closed && (
                    <div className="flex items-center gap-2" dir="ltr">
                      <input type="time" className={`${inputCls} !w-32`} value={h.open} onChange={(e) => setDay(h.day, { open: e.target.value })} aria-label={tr('من', 'From')} />
                      <span className="text-gray-500">→</span>
                      <input type="time" className={`${inputCls} !w-32`} value={h.close} onChange={(e) => setDay(h.day, { close: e.target.value })} aria-label={tr('إلى', 'To')} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Field label={tr('ملاحظة على المواعيد (اختياري)', 'Hours note (optional)')}>
                <input className={inputCls} value={form.hours_note} onChange={(e) => set('hours_note', e.target.value)} placeholder={tr('مثال: السيدات من 10 الصبح لـ 2 الضهر', 'e.g. Ladies 10am–2pm')} />
              </Field>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{tr('اليوم اللي مواعيده فاضية مش هيظهر. لو الجيم بيقفل بعد نص الليل اكتب مثلاً 06:00 → 02:00.', 'Days left empty are hidden. If you close after midnight, e.g. 06:00 → 02:00.')}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

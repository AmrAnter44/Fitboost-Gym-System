'use client'

/**
 * 🌐 بيانات الويبسايت — تعديل بيانات صفحة الفرع على موقع FitBoost من جوه السيستم.
 * من غير إيميل وباسورد: السيرفر بيستخدم رخصة النظام (الجيم + الفرع) عشان يعرف
 * بيعدّل على أنهي فرع. متاحة للأدمن والأونر بس.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast } from '../../contexts/ToastContext'
import ConfirmDialog from '../ConfirmDialog'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

type DataType = 'coach' | 'offer' | 'pt_package' | 'class' | 'membership'

interface BranchDataItem {
  id: string
  data_type: DataType
  name: string
  description?: string | null
  price?: number | null
  original_price?: number | null
  image_url?: string | null
  role?: string | null
  coach_name?: string | null
  day_of_week?: string | null
  time?: string | null
  class_type?: string | null
  sessions_count?: number | null
  metadata?: { features?: string[] } | null
}

interface WebsiteData {
  gymName: string
  branchName: string
  websiteUrl: string | null
  storageBaseUrl: string | null
  items: BranchDataItem[]
}

type FormState = {
  name: string
  description: string
  price: string
  original_price: string
  image_url: string
  role: string
  coach_name: string
  day_of_week: string
  time: string
  class_type: string
  sessions_count: string
  features: string[]
}

const emptyForm: FormState = {
  name: '', description: '', price: '', original_price: '', image_url: '', role: '',
  coach_name: '', day_of_week: '', time: '', class_type: '', sessions_count: '', features: [],
}

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const DAYS_AR: Record<string, string> = {
  Saturday: 'السبت', Sunday: 'الأحد', Monday: 'الاثنين', Tuesday: 'الثلاثاء',
  Wednesday: 'الأربعاء', Thursday: 'الخميس', Friday: 'الجمعة',
}
const CLASS_TYPES = [
  { value: 'Mixed', ar: 'مختلط', en: 'Mixed (Men & Women)' },
  { value: 'Ladies Only', ar: 'سيدات فقط', en: 'Ladies Only' },
  { value: 'Men Only', ar: 'رجال فقط', en: 'Men Only' },
]

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200'

export default function WebsiteDataSection() {
  const { locale, direction } = useLanguage()
  const toast = useToast()
  const ar = locale === 'ar'
  const tr = (a: string, e: string) => (ar ? a : e)

  const TABS: { id: DataType; label: string; singular: string }[] = useMemo(() => [
    { id: 'coach', label: tr('الكوتشات', 'Coaches'), singular: tr('كوتش', 'Coach') },
    { id: 'offer', label: tr('العروض', 'Offers'), singular: tr('عرض', 'Offer') },
    { id: 'pt_package', label: tr('باقات PT', 'PT Packages'), singular: tr('باقة PT', 'PT Package') },
    { id: 'class', label: tr('الكلاسات', 'Classes'), singular: tr('كلاس', 'Class') },
    { id: 'membership', label: tr('الاشتراكات', 'Memberships'), singular: tr('اشتراك', 'Membership') },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [locale])

  const [data, setData] = useState<WebsiteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<{ message: string; code?: string } | null>(null)
  const [activeTab, setActiveTab] = useState<DataType>('coach')

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<BranchDataItem | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formError, setFormError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<BranchDataItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/website-data', { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLoadError({ message: json.error || tr('تعذر تحميل بيانات الموقع', 'Failed to load website data'), code: json.code })
        return
      }
      setData(json)
    } catch {
      setLoadError({ message: tr('مفيش اتصال بالإنترنت — تعديل الموقع محتاج نت', 'No internet connection — editing the website needs internet') })
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale])

  useEffect(() => { load() }, [load])

  const items = useMemo(
    () => (data?.items || []).filter((i) => i.data_type === activeTab),
    [data, activeTab]
  )
  const countFor = (type: DataType) => (data?.items || []).filter((i) => i.data_type === type).length
  const imageSrc = (path?: string | null) => {
    if (!path) return null
    if (path.startsWith('http')) return path
    return data?.storageBaseUrl ? `${data.storageBaseUrl}/${path}` : null
  }

  const openEditor = (item: BranchDataItem | null) => {
    setEditing(item)
    setFormError('')
    setForm(item ? {
      name: item.name || '',
      description: item.description || '',
      price: item.price != null ? String(item.price) : '',
      original_price: item.original_price != null ? String(item.original_price) : '',
      image_url: item.image_url || '',
      role: item.role || '',
      coach_name: item.coach_name || '',
      day_of_week: item.day_of_week || '',
      time: item.time || '',
      class_type: item.class_type || '',
      sessions_count: item.sessions_count != null ? String(item.sessions_count) : '',
      features: Array.isArray(item.metadata?.features) ? item.metadata!.features! : [],
    } : emptyForm)
    setEditorOpen(true)
  }

  const set = (key: keyof FormState, value: any) => setForm((f) => ({ ...f, [key]: value }))

  const handleImage = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    setFormError('')
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch('/api/website-data/upload', { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || tr('فشل رفع الصورة', 'Upload failed'))
      set('image_url', json.path)
    } catch (e: any) {
      setFormError(e.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      const body = { ...form, data_type: editing?.data_type || activeTab }
      const res = await fetch(editing ? `/api/website-data/${editing.id}` : '/api/website-data', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || tr('فشل الحفظ', 'Save failed'))
      toast.success(tr('اتحفظ على الموقع ✓', 'Saved to website ✓'))
      setEditorOpen(false)
      await load()
    } catch (e: any) {
      setFormError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/website-data/${pendingDelete.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || tr('فشل الحذف', 'Delete failed'))
      toast.success(tr('اتمسح من الموقع', 'Removed from website'))
      setPendingDelete(null)
      await load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setDeleting(false)
    }
  }

  const tab = TABS.find((t) => t.id === activeTab)!
  const editorType = editing?.data_type || activeTab
  const editorLabel = TABS.find((t) => t.id === editorType)!.singular
  const money = (n?: number | null) => (n != null ? `${Number(n).toLocaleString(ar ? 'ar-EG' : 'en-US')} ${tr('ج.م', 'EGP')}` : '')

  // ───────────── Header ─────────────
  const header = (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
            <svg {...stroke} className="w-6 h-6" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{tr('بيانات الويبسايت', 'Website Data')}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {data
                ? tr(`بتعدّل صفحة ${data.gymName} — ${data.branchName} على الموقع باستخدام رخصة النظام`, `Editing ${data.gymName} — ${data.branchName} on the website using the system license`)
                : tr('عدّل الكوتشات والعروض والأسعار على موقع الجيم من غير إيميل وباسورد', 'Edit coaches, offers and prices on the gym website without email & password')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {data?.websiteUrl && (
            <a href={data.websiteUrl} target="_blank" rel="noopener noreferrer"
              className="px-3 py-2 rounded-lg text-sm font-medium ring-1 ring-gray-300 dark:ring-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              {tr('فتح الصفحة', 'Open page')} ↗
            </a>
          )}
          <button onClick={load} disabled={loading}
            className="px-3 py-2 rounded-lg text-sm font-medium ring-1 ring-gray-300 dark:ring-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50">
            {loading ? tr('جاري التحميل…', 'Loading…') : tr('تحديث', 'Refresh')}
          </button>
        </div>
      </div>
      {data && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          {tr('التعديلات بتظهر على الموقع خلال حوالي 10 دقايق.', 'Changes appear on the website within about 10 minutes.')}
        </p>
      )}
    </div>
  )

  if (loadError) {
    return (
      <div className="space-y-6" dir={direction}>
        {header}
        <div className="bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-900/50 rounded-xl p-5">
          <p className="font-bold text-amber-800 dark:text-amber-300">{loadError.message}</p>
          {(loadError.code === 'NO_LICENSE' || loadError.code === 'LICENSE_INVALID') && (
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
              {tr('تعديل الموقع مربوط برخصة النظام — لازم الرخصة تكون متفعّلة ومختار فيها الجيم والفرع.', 'Website editing is tied to the system license — it must be active with a gym and branch selected.')}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6" dir={direction}>
      {header}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
              activeTab === t.id
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-1 ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}>
            {t.label}
            <span className={`text-xs px-1.5 rounded-full ${activeTab === t.id ? 'bg-white/20' : 'bg-gray-100 dark:bg-gray-700'}`}>{countFor(t.id)}</span>
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{tab.label}</h3>
          <button onClick={() => openEditor(null)} disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white transition-colors disabled:opacity-50">
            + {tr('إضافة', 'Add')} {tab.singular}
          </button>
        </div>

        {loading && !data ? (
          <p className="text-sm text-gray-500 py-8 text-center">{tr('جاري تحميل بيانات الموقع…', 'Loading website data…')}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">{tr('مفيش بيانات لسه — دوس إضافة.', 'Nothing here yet — click Add.')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map((item) => {
              const img = imageSrc(item.image_url)
              return (
                <div key={item.id} className="flex gap-3 p-3 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 bg-gray-50 dark:bg-gray-900/40">
                  {item.data_type === 'coach' && (
                    img
                      ? <img src={img} alt={item.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-gray-200" />
                      : <div className="w-14 h-14 rounded-lg bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 dark:text-gray-100 truncate">{item.name}</p>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 space-y-0.5">
                      {item.data_type === 'coach' && item.role && <p>{item.role}</p>}
                      {item.data_type === 'class' && (
                        <p>
                          {ar ? DAYS_AR[item.day_of_week || ''] || item.day_of_week : item.day_of_week}
                          {item.time ? ` • ${item.time}` : ''}
                          {item.class_type ? ` • ${CLASS_TYPES.find((c) => c.value === item.class_type)?.[ar ? 'ar' : 'en'] || item.class_type}` : ''}
                          {item.coach_name ? ` • ${item.coach_name}` : ''}
                        </p>
                      )}
                      {item.data_type === 'pt_package' && item.sessions_count != null && <p>{item.sessions_count} {tr('جلسة', 'sessions')}</p>}
                      {item.description && <p className="truncate">{item.description}</p>}
                      {item.price != null && (
                        <p className="font-semibold text-gray-800 dark:text-gray-200">
                          {money(item.price)}
                          {item.original_price != null && <span className="line-through text-gray-400 font-normal ms-2">{money(item.original_price)}</span>}
                        </p>
                      )}
                      {!!item.metadata?.features?.length && <p className="truncate">✓ {item.metadata.features.join(' • ')}</p>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button onClick={() => openEditor(item)}
                      className="px-3 py-1 rounded-md text-xs font-semibold bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-100">
                      {tr('تعديل', 'Edit')}
                    </button>
                    <button onClick={() => setPendingDelete(item)}
                      className="px-3 py-1 rounded-md text-xs font-semibold bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-100">
                      {tr('حذف', 'Delete')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Editor modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !saving && setEditorOpen(false)}>
          <form onSubmit={handleSave} onClick={(e) => e.stopPropagation()} dir={direction}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {editing ? tr('تعديل', 'Edit') : tr('إضافة', 'Add')} {editorLabel}
            </h3>

            <Field label={editorType === 'coach' ? tr('اسم الكوتش', 'Coach name') : editorType === 'offer' ? tr('عنوان العرض', 'Offer title') : tr('الاسم', 'Name')} required>
              <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} required />
            </Field>

            {editorType === 'coach' && (
              <>
                <Field label={tr('اللقب (مثلاً Personal Trainer)', 'Title (e.g. Personal Trainer)')}>
                  <input className={inputCls} value={form.role} onChange={(e) => set('role', e.target.value)} />
                </Field>
                <Field label={tr('الصورة', 'Photo')}>
                  <div className="flex items-center gap-3">
                    {imageSrc(form.image_url)
                      ? <img src={imageSrc(form.image_url)!} alt="" className="w-16 h-16 rounded-lg object-cover bg-gray-200" />
                      : <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-700" />}
                    <label className={`px-3 py-2 rounded-lg text-sm font-medium ring-1 ring-gray-300 dark:ring-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                      {uploading ? tr('جاري الرفع…', 'Uploading…') : tr('اختيار صورة', 'Choose photo')}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleImage(e.target.files?.[0])} />
                    </label>
                    {form.image_url && (
                      <button type="button" onClick={() => set('image_url', '')} className="text-xs text-red-600">{tr('إزالة', 'Remove')}</button>
                    )}
                  </div>
                </Field>
              </>
            )}

            {editorType === 'class' && (
              <>
                <Field label={tr('اسم الكوتش', 'Coach name')}>
                  <input className={inputCls} value={form.coach_name} onChange={(e) => set('coach_name', e.target.value)} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={tr('اليوم', 'Day')} required>
                    <select className={inputCls} value={form.day_of_week} onChange={(e) => set('day_of_week', e.target.value)} required>
                      <option value="">{tr('اختار', 'Select')}</option>
                      {DAYS.map((d) => <option key={d} value={d}>{ar ? DAYS_AR[d] : d}</option>)}
                    </select>
                  </Field>
                  <Field label={tr('الساعة', 'Start time')}>
                    <input type="time" className={inputCls} value={form.time} onChange={(e) => set('time', e.target.value)} dir="ltr" />
                  </Field>
                </div>
                <Field label={tr('نوع الكلاس', 'Class type')} required>
                  <select className={inputCls} value={form.class_type} onChange={(e) => set('class_type', e.target.value)} required>
                    <option value="">{tr('اختار', 'Select')}</option>
                    {CLASS_TYPES.map((c) => <option key={c.value} value={c.value}>{ar ? c.ar : c.en}</option>)}
                  </select>
                </Field>
              </>
            )}

            {editorType === 'membership' && (
              <Field label={tr('الوصف (اختياري)', 'Description (optional)')}>
                <input className={inputCls} value={form.description} onChange={(e) => set('description', e.target.value)} />
              </Field>
            )}

            {editorType === 'pt_package' && (
              <Field label={tr('عدد الجلسات', 'Number of sessions')} required>
                <input type="number" min={1} className={inputCls} value={form.sessions_count} onChange={(e) => set('sessions_count', e.target.value)} required dir="ltr" />
              </Field>
            )}

            {(editorType === 'offer' || editorType === 'pt_package' || editorType === 'membership') && (
              <div className="grid grid-cols-2 gap-3">
                <Field label={tr('السعر (ج.م)', 'Price (EGP)')} required={editorType !== 'offer'}>
                  <input type="number" min={0} step="any" className={inputCls} value={form.price} onChange={(e) => set('price', e.target.value)} required={editorType !== 'offer'} dir="ltr" />
                </Field>
                {editorType !== 'offer' && (
                  <Field label={tr('السعر قبل الخصم (اختياري)', 'Price before discount')}>
                    <input type="number" min={0} step="any" className={inputCls} value={form.original_price} onChange={(e) => set('original_price', e.target.value)} dir="ltr" />
                  </Field>
                )}
              </div>
            )}

            {(editorType === 'pt_package' || editorType === 'membership') && (
              <Field label={tr('المميزات', 'Features')}>
                <div className="space-y-2">
                  {form.features.map((f, i) => (
                    <div key={i} className="flex gap-2">
                      <input className={inputCls} value={f}
                        onChange={(e) => set('features', form.features.map((x, j) => (j === i ? e.target.value : x)))} />
                      <button type="button" onClick={() => set('features', form.features.filter((_, j) => j !== i))}
                        className="px-3 rounded-lg text-red-600 ring-1 ring-red-200 dark:ring-red-900/50">×</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => set('features', [...form.features, ''])}
                    className="text-sm font-semibold text-primary-600 dark:text-primary-400">+ {tr('إضافة ميزة', 'Add feature')}</button>
                </div>
              </Field>
            )}

            {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}

            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={saving || uploading}
                className="flex-1 px-4 py-2.5 rounded-lg font-semibold bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50">
                {saving ? tr('جاري الحفظ…', 'Saving…') : tr('حفظ على الموقع', 'Save to website')}
              </button>
              <button type="button" onClick={() => setEditorOpen(false)} disabled={saving}
                className="px-4 py-2.5 rounded-lg font-semibold ring-1 ring-gray-300 dark:ring-gray-600 text-gray-700 dark:text-gray-200">
                {tr('إلغاء', 'Cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!pendingDelete}
        title={tr('حذف من الموقع', 'Delete from website')}
        message={tr(`متأكد إنك عايز تمسح "${pendingDelete?.name}" من الموقع؟`, `Delete "${pendingDelete?.name}" from the website?`)}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setPendingDelete(null)}
      />
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  )
}

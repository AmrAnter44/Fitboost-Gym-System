'use client'

import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

type Destination = 'visitors' | 'dayuse' | 'invitations'

interface ValidationResult {
  ok: boolean
  total: number
  valid: number
  invalid: number
  preview: { name: string; phone: string }[]
  message: string
}

export default function ImportSheetSection() {
  const { locale, direction } = useLanguage()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [validating, setValidating] = useState(false)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [error, setError] = useState('')
  const [destination, setDestination] = useState<Destination | ''>('')
  const [services, setServices] = useState<{ id: string; name: string; price: number }[]>([])
  const [dayuseService, setDayuseService] = useState('')
  const [dayusePrice, setDayusePrice] = useState('0')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null)

  useEffect(() => {
    fetch('/api/dayuse-services').then(r => r.ok ? r.json() : []).then((d) => {
      if (Array.isArray(d)) setServices(d)
    }).catch(() => {})
  }, [])

  const reset = () => {
    setValidation(null); setError(''); setResult(null); setDestination('')
  }

  const onFilePick = (f: File | null) => {
    setFile(f); reset()
    if (f) validateFile(f)
  }

  const validateFile = async (f: File) => {
    setValidating(true); setError(''); setValidation(null); setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('mode', 'validate')
      const res = await fetch('/api/settings/import-sheet', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'فشل التحقق'); return }
      setValidation(data)
    } catch {
      setError(locale === 'ar' ? 'حدث خطأ في الاتصال' : 'Connection error')
    } finally {
      setValidating(false)
    }
  }

  const doImport = async () => {
    if (!file || !destination) return
    setImporting(true); setError(''); setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('mode', 'import')
      fd.append('destination', destination)
      if (destination === 'dayuse') {
        fd.append('serviceType', dayuseService || 'يوم استخدام')
        fd.append('price', dayusePrice || '0')
      }
      const res = await fetch('/api/settings/import-sheet', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'فشل الاستيراد'); return }
      setResult({ inserted: data.inserted || 0, skipped: data.skipped || 0 })
    } catch {
      setError(locale === 'ar' ? 'حدث خطأ في الاتصال' : 'Connection error')
    } finally {
      setImporting(false)
    }
  }

  const destinations: { id: Destination; label: string; desc: string; color: string }[] = [
    { id: 'visitors', label: locale === 'ar' ? 'الزوار' : 'Visitors', desc: locale === 'ar' ? 'يمنع تكرار الأرقام' : 'Dedups phones', color: 'blue' },
    { id: 'dayuse', label: locale === 'ar' ? 'استخدامات أخرى' : 'Day-use', desc: locale === 'ar' ? 'تختار النوع والسعر' : 'Pick type & price', color: 'teal' },
    { id: 'invitations', label: locale === 'ar' ? 'الدعوات' : 'Invitations', desc: locale === 'ar' ? 'تتنسب لعضو «فيت بوست»' : 'Attributed to Fitboost', color: 'purple' },
  ]

  return (
    <div className="space-y-6" dir={direction}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
            <svg {...stroke} className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{locale === 'ar' ? 'استيراد شيت' : 'Import Sheet'}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{locale === 'ar' ? 'ارفع شيت: العمود الأول أسماء، والتاني أرقام موبايل' : 'Upload a sheet: column 1 = names, column 2 = phones'}</p>
          </div>
        </div>

        {/* شرح الأعمدة */}
        <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-900/50 text-sm text-blue-800 dark:text-blue-200">
          <p className="font-bold mb-1">{locale === 'ar' ? 'شكل الشيت المطلوب:' : 'Required format:'}</p>
          <p>{locale === 'ar' ? 'الخانة الأولى = الاسم · الخانة الثانية = رقم الموبايل · الصيغة: Excel (.xlsx) أو CSV' : 'Col 1 = Name · Col 2 = Phone · Excel (.xlsx) or CSV'}</p>
        </div>

        {/* رفع الملف */}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => onFilePick(e.target.files?.[0] || null)}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors"
          >
            <svg {...stroke} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" /></svg>
            {locale === 'ar' ? 'اختر ملف' : 'Choose file'}
          </button>
          {file && <span className="text-sm text-gray-700 dark:text-gray-300 font-mono truncate max-w-[240px]">{file.name}</span>}
          {validating && <span className="text-sm text-gray-500">{locale === 'ar' ? 'جاري التحقق...' : 'Validating...'}</span>}
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-800 text-red-700 dark:text-red-300 text-sm font-bold">{error}</div>
        )}

        {/* نتيجة التحقق */}
        {validation && (
          <div className={`mt-4 p-4 rounded-lg ring-1 ${validation.ok ? 'bg-emerald-50 dark:bg-emerald-900/20 ring-emerald-200 dark:ring-emerald-800' : 'bg-amber-50 dark:bg-amber-900/20 ring-amber-200 dark:ring-amber-800'}`}>
            <p className={`font-bold ${validation.ok ? 'text-emerald-800 dark:text-emerald-200' : 'text-amber-800 dark:text-amber-200'}`}>
              {validation.ok ? '✅ ' : '⚠️ '}{validation.message}
            </p>
            {validation.preview.length > 0 && (
              <div className="mt-3 text-xs">
                <p className="text-gray-500 dark:text-gray-400 mb-1">{locale === 'ar' ? 'معاينة أول صفوف:' : 'Preview:'}</p>
                <div className="rounded-lg overflow-hidden ring-1 ring-gray-200 dark:ring-gray-700">
                  {validation.preview.map((p, i) => (
                    <div key={i} className="flex justify-between px-3 py-1.5 bg-white dark:bg-gray-800 even:bg-gray-50 dark:even:bg-gray-900/40">
                      <span className="font-bold text-gray-800 dark:text-gray-100">{p.name}</span>
                      <span className="font-mono text-gray-600 dark:text-gray-300">{p.phone}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* اختيار الوجهة + الاستيراد */}
        {validation?.ok && (
          <div className="mt-5">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{locale === 'ar' ? 'ترفع فين؟' : 'Import to:'}</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {destinations.map(d => (
                <button
                  key={d.id}
                  onClick={() => { setDestination(d.id); setResult(null) }}
                  className={`p-3 rounded-xl ring-1 text-start transition-colors ${
                    destination === d.id
                      ? 'ring-primary-500 bg-primary-50 dark:bg-primary-900/30 shadow-sm'
                      : 'ring-gray-200 dark:ring-gray-700 bg-white dark:bg-gray-800 hover:ring-primary-300'
                  }`}
                >
                  <p className="font-bold text-gray-900 dark:text-gray-100">{d.label}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{d.desc}</p>
                </button>
              ))}
            </div>

            {/* خيارات الداي يوز */}
            {destination === 'dayuse' && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">{locale === 'ar' ? 'نوع الخدمة' : 'Service type'}</label>
                  <select
                    value={dayuseService}
                    onChange={(e) => {
                      setDayuseService(e.target.value)
                      const svc = services.find(s => s.name === e.target.value)
                      if (svc) setDayusePrice(String(svc.price ?? 0))
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  >
                    <option value="">{locale === 'ar' ? 'يوم استخدام' : 'Day-use'}</option>
                    {services.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">{locale === 'ar' ? 'السعر (لكل صف)' : 'Price (per row)'}</label>
                  <input type="number" min="0" value={dayusePrice} onChange={(e) => setDayusePrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm" />
                </div>
              </div>
            )}

            {destination === 'invitations' && (
              <p className="mt-2 text-xs text-purple-600 dark:text-purple-400">
                {locale === 'ar' ? 'كل الدعوات هتتنسب لعضو وهمي اسمه «فيت بوست» (بدون خصم رصيد).' : 'All invitations attributed to a dummy member "Fitboost" (no balance deduction).'}
              </p>
            )}

            <button
              onClick={doImport}
              disabled={importing || !destination}
              className="mt-4 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {importing
                ? (locale === 'ar' ? 'جاري الاستيراد...' : 'Importing...')
                : `${locale === 'ar' ? 'استيراد' : 'Import'} ${validation.valid} ${locale === 'ar' ? 'صف' : 'rows'}`}
            </button>
          </div>
        )}

        {/* نتيجة الاستيراد */}
        {result && (
          <div className="mt-4 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-200 dark:ring-emerald-800 text-emerald-800 dark:text-emerald-200 font-bold">
            ✅ {locale === 'ar' ? `تم استيراد ${result.inserted} صف` : `Imported ${result.inserted} rows`}
            {result.skipped > 0 && <span className="text-amber-700 dark:text-amber-300"> · {locale === 'ar' ? `تخطّى ${result.skipped} مكرر` : `${result.skipped} skipped`}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

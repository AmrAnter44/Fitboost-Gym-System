'use client'

// 🩺 الهيستوري الطبي في بروفايل العضو — عرض + تعديل (لصاحب صلاحية تعديل الأعضاء)
//  ملحوظة: مش بيظهر في شاشة السكان/الحضور — البروفايل بس
import { useEffect, useState } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useToast } from '@/contexts/ToastContext'
import MedicalHistoryEditor from './MedicalHistoryEditor'
import type { MedicalEntry } from '@/lib/medicalHistory'

export default function MemberMedicalCard({ memberId, canEdit }: { memberId: string; canEdit: boolean }) {
  const { tr } = useLanguage()
  const toast = useToast()
  const [entries, setEntries] = useState<MedicalEntry[] | null>(null)
  const [draft, setDraft] = useState<MedicalEntry[] | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`/api/members/${memberId}/medical-history`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { entries: [] }))
      .then(d => { if (alive) setEntries(d.entries || []) })
      .catch(() => alive && setEntries([]))
    return () => { alive = false }
  }, [memberId])

  if (entries === null) return null
  if (!entries.length && !canEdit) return null

  const save = async () => {
    if (!draft) return
    setSaving(true)
    try {
      const r = await fetch(`/api/members/${memberId}/medical-history`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries: draft }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) return toast.error(d.error || tr('فشل الحفظ', 'Save failed'))
      setEntries(d.entries || []); setDraft(null)
      toast.success(tr('اتحفظ الهيستوري الطبي', 'Medical history saved'))
    } finally { setSaving(false) }
  }

  const chronicCount = entries.filter(e => e.chronic).length

  return (
    <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
      {/* الهيدر: العنوان + تعديل */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-base font-bold text-gray-800 dark:text-white">
          {tr('الهيستوري الطبي', 'Medical history')}
          {entries.length > 0 && !draft && (
            <span className="ms-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
              {tr(`${entries.length} حالة`, `${entries.length} conditions`)}
              {chronicCount > 0 && tr(` · ${chronicCount} مزمن`, ` · ${chronicCount} chronic`)}
            </span>
          )}
        </h3>
        {canEdit && !draft && (
          <button onClick={() => setDraft(entries.length ? entries : [{ condition: '', chronic: true }])}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            {entries.length ? tr('تعديل', 'Edit') : tr('إضافة', 'Add')}
          </button>
        )}
      </div>

      {draft ? (
        <div className="p-4 space-y-4">
          <MedicalHistoryEditor value={draft} onChange={setDraft} />
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="px-5 py-2 rounded-lg text-sm font-bold bg-primary-500 hover:bg-primary-600 text-primary-contrast disabled:opacity-60">
              {saving ? tr('جارٍ الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
            </button>
            <button onClick={() => setDraft(null)} className="px-5 py-2 rounded-lg text-sm font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
              {tr('إلغاء', 'Cancel')}
            </button>
          </div>
        </div>
      ) : entries.length ? (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {entries.map((e, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white break-words min-w-0">{e.condition}</span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold shrink-0 ${
                e.chronic ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${e.chronic ? 'bg-red-500' : 'border border-gray-400 dark:border-gray-500'}`} aria-hidden="true" />
                {e.chronic ? tr('مزمن', 'Chronic') : tr('غير مزمن', 'Not chronic')}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">{tr('مفيش حالات طبية مسجلة', 'No medical conditions recorded')}</p>
      )}
    </div>
  )
}

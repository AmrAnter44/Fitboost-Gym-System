'use client'

// 🩺 محرر الهيستوري الطبي — حالة + مزمن/غير مزمن (بيتستخدم في فورم إضافة عضو وفي البروفايل)
import { useLanguage } from '@/contexts/LanguageContext'
import { MEDICAL_MAX_ENTRIES, MEDICAL_MAX_LEN, type MedicalEntry } from '@/lib/medicalHistory'

export default function MedicalHistoryEditor({ value, onChange }: { value: MedicalEntry[]; onChange: (v: MedicalEntry[]) => void }) {
  const { tr } = useLanguage()
  const set = (i: number, patch: Partial<MedicalEntry>) => onChange(value.map((e, j) => (j === i ? { ...e, ...patch } : e)))

  return (
    <div className="space-y-2">
      {value.map((e, i) => (
        <div key={i} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <input
            value={e.condition}
            maxLength={MEDICAL_MAX_LEN}
            onChange={ev => set(i, { condition: ev.target.value })}
            placeholder={tr('مثال: سكر، ضغط، إصابة ركبة...', 'e.g. Diabetes, blood pressure, knee injury...')}
            className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div role="radiogroup" className="inline-flex rounded-lg ring-1 ring-gray-300 dark:ring-gray-600 overflow-hidden shrink-0">
            {[true, false].map(ch => (
              <button
                key={String(ch)}
                type="button"
                role="radio"
                aria-checked={e.chronic === ch}
                onClick={() => set(i, { chronic: ch })}
                className={`px-3 py-2 text-xs font-bold transition-colors ${
                  e.chronic === ch
                    ? ch ? 'bg-red-600 text-white' : 'bg-sky-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                {ch ? tr('مزمن', 'Chronic') : tr('غير مزمن', 'Not chronic')}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            aria-label={tr('حذف', 'Remove')}
            className="w-9 h-9 shrink-0 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center justify-center"
          >
            <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>
      ))}
      {value.length < MEDICAL_MAX_ENTRIES && (
        <button
          type="button"
          onClick={() => onChange([...value, { condition: '', chronic: true }])}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50"
        >
          <span aria-hidden="true">+</span>
          {value.length ? tr('إضافة حالة تانية', 'Add another') : tr('إضافة حالة', 'Add condition')}
        </button>
      )}
    </div>
  )
}

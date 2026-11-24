'use client'

// 🚻 فلتر الرجالة/السيدات بالعدد — للجيم المكس (صفحة الأعضاء والتقارير). «الكل» هو الديفولت
export type GenderFilter = 'all' | 'male' | 'female' | 'unknown'

export interface GenderCounts {
  all: number
  male: number
  female: number
  unknown: number
}

export default function GenderCountPills({ value, onChange, counts, ar, className = '' }: {
  value: GenderFilter
  onChange: (v: GenderFilter) => void
  counts: GenderCounts
  ar: boolean
  className?: string
}) {
  const items: { id: GenderFilter; label: string; dot: string; on: string }[] = [
    { id: 'all', label: ar ? 'الكل' : 'All', dot: 'bg-primary-500', on: 'bg-primary-500 text-primary-contrast ring-primary-500' },
    { id: 'male', label: ar ? 'رجالة' : 'Men', dot: 'bg-blue-500', on: 'bg-blue-600 text-white ring-blue-600' },
    { id: 'female', label: ar ? 'سيدات' : 'Women', dot: 'bg-pink-500', on: 'bg-pink-600 text-white ring-pink-600' },
    ...(counts.unknown > 0 || value === 'unknown'
      ? [{ id: 'unknown' as const, label: ar ? 'غير محدد' : 'Not set', dot: 'bg-gray-400', on: 'bg-gray-600 text-white ring-gray-600' }]
      : []),
  ]

  return (
    <div role="group" aria-label={ar ? 'فلتر الرجالة والسيدات' : 'Gender filter'} data-gender-pills className={`flex flex-wrap items-center gap-2 ${className}`}>
      {items.map(it => {
        const active = value === it.id
        return (
          <button
            key={it.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(it.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold ring-1 transition-colors duration-200 ${
              active
                ? it.on
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {!active && <span className={`w-2 h-2 rounded-full ${it.dot}`} aria-hidden="true" />}
            <span>{it.label}</span>
            <span className="tabular-nums opacity-80">{counts[it.id].toLocaleString('en-US')}</span>
          </button>
        )
      })}
    </div>
  )
}

'use client'

import { useState, useRef, useEffect } from 'react'

//  كل المصادر المتاحة في النظام (نفس القيم المخزّنة في source — زي قائمة المصدر في نافذة الإضافة)
const PLATFORMS: { value: string; ar: string; en: string; dot: string }[] = [
  { value: 'facebook',        ar: 'فيسبوك',          en: 'Facebook',        dot: '#1877F2' },
  { value: 'instagram',       ar: 'انستجرام',        en: 'Instagram',       dot: '#E4405F' },
  { value: 'tiktok',          ar: 'تيك توك',         en: 'TikTok',          dot: '#111111' },
  { value: 'chatgpt',         ar: 'ChatGPT',         en: 'ChatGPT',         dot: '#10A37F' },
  { value: 'google_maps',     ar: 'جوجل ماب / Google Maps', en: 'Google Maps', dot: '#34A853' },
  { value: 'walk-in',         ar: 'زيارة مباشرة',    en: 'Walk In',         dot: '#16A34A' },
  { value: 'call-in',         ar: 'اتصال',           en: 'Call In',         dot: '#0EA5E9' },
  { value: 'friend_referral', ar: 'إحالة من صديق',   en: 'Friend Referral', dot: '#F59E0B' },
  { value: 'suggestion',      ar: 'اقتراح',          en: 'Suggestion',      dot: '#A855F7' },
]

interface Props {
  selected: string[]
  onChange: (next: string[]) => void
  locale?: string
  //  fullWidth: يخلّي الزرار بنفس شكل وحجم الـ select (للصفوف اللي فيها فلاتر متناسقة)
  fullWidth?: boolean
}

/**
 * زرار فلتر بوب-أب للسوشيال ميديا — يفتح ويقفل (اخفاء/اظهار) بالضغط عليه أو بالضغط برّه.
 * اختيار متعدد: تقدر تفلتر بأكتر من منصّة مع بعض.
 */
export default function SocialMediaFilter({ selected, onChange, locale = 'ar', fullWidth = false }: Props) {
  const ar = locale === 'ar'
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  //  اقفل البوب-أب لما تضغط برّه أو تدوس Escape
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])
  }
  const clear = () => onChange([])

  const count = selected.length

  return (
    <div className={`relative ${fullWidth ? 'w-full' : ''}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={
          fullWidth
            ? //  نفس مقاس وشكل الـ select بتاع الباقة/السيلز/الكوتش (ارتفاع ثابت 42px + نفس الخط)
              `w-full flex items-center gap-2 h-[42px] px-3 rounded-lg border text-base transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                count > 0
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              }`
            : `inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-bold transition-colors duration-200 ${
                count > 0
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`
        }
        aria-haspopup="true"
        aria-expanded={open}
      >
        <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
        </svg>
        <span className={fullWidth ? 'flex-1 text-start truncate' : ''}>
          {count > 0
            ? (ar ? `${count} مصدر` : `${count} selected`)
            : (ar ? 'كل المصادر' : 'All sources')}
        </span>
        {!fullWidth && count > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary-500 text-primary-contrast text-[10px] font-bold">
            {count}
          </span>
        )}
        <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className={`absolute z-50 mt-2 rounded-xl bg-white dark:bg-gray-800 shadow-lg ring-1 ring-gray-200 dark:ring-gray-700 p-2 animate-modal-in end-0 ${fullWidth ? 'w-full min-w-[13rem]' : 'w-56'}`}>
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{ar ? 'فلتر بالمصدر' : 'Filter by source'}</span>
            {count > 0 && (
              <button type="button" onClick={clear} className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline">
                {ar ? 'مسح' : 'Clear'}
              </button>
            )}
          </div>
          <div className="space-y-0.5 max-h-64 overflow-y-auto overscroll-contain">
            {PLATFORMS.map(p => {
              const on = selected.includes(p.value)
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => toggle(p.value)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    on ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/60'
                  }`}
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${on ? 'bg-primary-500 border-primary-500' : 'border-gray-300 dark:border-gray-500'}`}>
                    {on && (
                      <svg fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" className="w-3 h-3 text-primary-contrast">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                  </span>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.dot }} />
                  <span className="flex-1 text-start">{ar ? p.ar : p.en}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

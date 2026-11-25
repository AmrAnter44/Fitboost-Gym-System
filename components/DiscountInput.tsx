'use client'

//  🏷️ خانة خصم بالجنيه أو بالنسبة المئوية — بترجع قيمة الخصم بالجنيه عن طريق discountAmount()
export type DiscountMode = 'amount' | 'percent'

export function discountAmount(base: number, mode: DiscountMode, raw: string, max?: number): number {
  const v = parseFloat(raw) || 0
  if (v <= 0 || !(base > 0)) return 0
  const amt = mode === 'percent' ? Math.round(base * Math.min(v, 100) / 100) : Math.round(v)
  const cap = max != null ? Math.max(0, Math.min(max, base)) : base
  return Math.min(amt, cap)
}

interface Props {
  id?: string
  base: number
  mode: DiscountMode
  onModeChange: (m: DiscountMode) => void
  value: string
  onChange: (v: string) => void
  max?: number
  disabled?: boolean
  direction: 'rtl' | 'ltr'
  netLabel?: string
}

export default function DiscountInput({ id, base, mode, onModeChange, value, onChange, max, disabled, direction, netLabel }: Props) {
  const ar = direction === 'rtl'
  const cap = max != null ? Math.max(0, Math.min(max, base)) : base
  const amount = discountAmount(base, mode, value, max)
  const unit = mode === 'percent' ? '٪' : (ar ? 'جنيه' : 'EGP')
  return (
    <div data-discount-field>
      <label htmlFor={id} className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
        {ar ? `الخصم (${unit})` : `Discount (${unit})`}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="number"
          min="0"
          max={mode === 'percent' ? 100 : (cap || undefined)}
          step={mode === 'percent' ? '0.01' : '1'}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const raw = e.target.value
            const v = parseFloat(raw) || 0
            if (v < 0) { onChange(''); return }
            // لو كتب أكتر من المسموح نرجّع الخانة للحد الأقصى
            if (base > 0) {
              const amt = mode === 'percent' ? Math.round(base * Math.min(v, 100) / 100) : Math.round(v)
              if (amt > cap || (mode === 'percent' && v > 100)) {
                onChange(mode === 'percent' ? String(Math.floor(cap / base * 10000) / 100) : String(cap))
                return
              }
            }
            onChange(raw)
          }}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition-colors duration-200"
          placeholder="0"
        />
        <div className="flex shrink-0 rounded-lg ring-1 ring-gray-300 dark:ring-gray-600 overflow-hidden text-sm font-bold" role="group">
          {(['amount', 'percent'] as const).map(m => (
            <button
              key={m}
              type="button"
              data-discount-mode={m}
              disabled={disabled}
              onClick={() => { if (m !== mode) { onModeChange(m); onChange('') } }}
              className={`px-3 py-2 transition-colors duration-200 disabled:cursor-not-allowed ${mode === m ? 'bg-primary-500 text-primary-contrast' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
            >
              {m === 'percent' ? '٪' : (ar ? 'جنيه' : 'EGP')}
            </button>
          ))}
        </div>
      </div>
      {amount > 0 && (
        <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-bold">
          {mode === 'percent' && <>{ar ? 'الخصم' : 'Discount'}: {amount} {ar ? 'جنيه' : 'EGP'} · </>}
          {netLabel || (ar ? 'السعر بعد الخصم:' : 'Price after discount:')} {Math.max(0, base - amount)} {ar ? 'جنيه' : 'EGP'}
        </p>
      )}
    </div>
  )
}

'use client'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface TrendIndicatorProps {
  value: number
  previousValue?: number
  format?: 'number' | 'currency' | 'percentage'
  showLabel?: boolean
}

export default function TrendIndicator({
  value,
  previousValue,
  format = 'number',
  showLabel = true
}: TrendIndicatorProps) {
  if (previousValue === undefined || previousValue === 0) return null

  const difference = value - previousValue
  const percentageChange = ((difference / previousValue) * 100).toFixed(1)
  const isPositive = difference > 0
  const isNeutral = difference === 0

  if (isNeutral) return null

  return (
    <div
      role="status"
      aria-label={`${isPositive ? '+' : ''}${percentageChange}% ${isPositive ? 'increase' : 'decrease'}`}
      className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${
        isPositive
          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
          : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
      }`}
    >
      <svg {...stroke} className="w-3.5 h-3.5">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={isPositive ? 'M3 17l6-6 4 4 8-8M14 7h7v7' : 'M3 7l6 6 4-4 8 8M14 17h7v-7'}
        />
      </svg>
      <span>
        {isPositive ? '+' : ''}{percentageChange}%
      </span>
      {showLabel && (
        <span className="opacity-75">
          {isPositive ? 'زيادة' : 'نقص'}
        </span>
      )}
    </div>
  )
}

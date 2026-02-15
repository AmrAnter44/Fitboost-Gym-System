'use client'

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
    <div className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
      isPositive
        ? 'bg-green-100 text-green-700'
        : 'bg-red-100 text-red-700'
    }`}>
      <span className="text-sm">
        {isPositive ? '↗️' : '↘️'}
      </span>
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

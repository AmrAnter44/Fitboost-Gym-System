// components/spa/StatusBadge.tsx
import { useLanguage } from '../../contexts/LanguageContext'
import { SpaBookingStatus } from '../../types/spa'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface StatusBadgeProps {
  status: SpaBookingStatus
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useLanguage()

  const colors: Record<SpaBookingStatus, string> = {
    pending: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    confirmed: 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300',
    completed: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
    cancelled: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  }

  const renderIcon = () => {
    switch (status) {
      case 'pending':
        return (
          <svg className="w-3.5 h-3.5" {...stroke}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l2.5 2.5M12 22a10 10 0 110-20 10 10 0 010 20z" />
          </svg>
        )
      case 'confirmed':
        return (
          <svg className="w-3.5 h-3.5" {...stroke}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'completed':
        return (
          <svg className="w-3.5 h-3.5" {...stroke}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'cancelled':
        return (
          <svg className="w-3.5 h-3.5" {...stroke}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
    }
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${colors[status]}`}>
      {renderIcon()}
      <span>{t(`spa.status.${status}`)}</span>
    </span>
  )
}

// components/spa/StatusBadge.tsx
import { useLanguage } from '../../contexts/LanguageContext'
import { SpaBookingStatus } from '../../types/spa'

interface StatusBadgeProps {
  status: SpaBookingStatus
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useLanguage()

  const colors: Record<SpaBookingStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
    confirmed: 'bg-blue-100 text-blue-800 border border-blue-300',
    completed: 'bg-green-100 text-green-800 border border-green-300',
    cancelled: 'bg-red-100 text-red-800 border border-red-300'
  }

  const icons: Record<SpaBookingStatus, string> = {
    pending: '⏳',
    confirmed: '✅',
    completed: '🎉',
    cancelled: '❌'
  }

  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${colors[status]}`}>
      <span>{icons[status]}</span>
      <span>{t(`spa.status.${status}`)}</span>
    </span>
  )
}

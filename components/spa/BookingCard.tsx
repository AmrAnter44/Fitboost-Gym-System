// components/spa/BookingCard.tsx
import { useLanguage } from '../../contexts/LanguageContext'
import { SpaBooking } from '../../types/spa'
import { formatTime12Hour } from '../../lib/timeFormatter'
import StatusBadge from './StatusBadge'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface BookingCardProps {
  booking: SpaBooking
  onEdit?: (booking: SpaBooking) => void
  onCancel?: (booking: SpaBooking) => void
  onConfirm?: (booking: SpaBooking) => void
  onView?: (booking: SpaBooking) => void
  canEdit?: boolean
  canCancel?: boolean
  canConfirm?: boolean
}

const renderServiceIcon = (type: SpaBooking['serviceType']) => {
  switch (type) {
    case 'massage':
      return (
        <svg className="w-6 h-6" {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 11a4 4 0 100-8 4 4 0 000 8zm-7 10a7 7 0 0114 0H5z" />
        </svg>
      )
    case 'sauna':
      return (
        <svg className="w-6 h-6" {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 3c0 2 2 2 2 4s-2 2-2 4 2 2 2 4M14 3c0 2 2 2 2 4s-2 2-2 4 2 2 2 4M4 21h16" />
        </svg>
      )
    case 'jacuzzi':
      return (
        <svg className="w-6 h-6" {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16v4a4 4 0 01-4 4H8a4 4 0 01-4-4v-4zm4 0V7a3 3 0 016 0M2 17c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2" />
        </svg>
      )
  }
}

export default function BookingCard({
  booking,
  onEdit,
  onCancel,
  onConfirm,
  onView,
  canEdit = false,
  canCancel = false,
  canConfirm = false,
}: BookingCardProps) {
  const { t, direction, locale } = useLanguage()

  const formatDate = (date: Date) => {
    const dateObj = new Date(date)
    const dayName = dateObj.toLocaleDateString(
      direction === 'rtl' ? 'ar-EG' : 'en-US',
      { weekday: 'long' }
    )
    const dateStr = dateObj.toLocaleDateString(
      direction === 'rtl' ? 'ar-EG' : 'en-US',
      { year: 'numeric', month: 'short', day: 'numeric' }
    )
    return `${dayName} - ${dateStr}`
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden hover:shadow-md transition-shadow duration-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-primary-contrast p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-white/30 flex items-center justify-center flex-shrink-0">
              {renderServiceIcon(booking.serviceType)}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base truncate">{booking.memberName}</h3>
              <p className="text-xs opacity-90 truncate">{booking.memberPhone || t('common.noPhone')}</p>
            </div>
          </div>
          <StatusBadge status={booking.status} />
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400 text-sm">{t('spa.service')}:</span>
          <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">
            {t(`spa.services.${booking.serviceType}`)}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400 text-sm">{t('spa.date')}:</span>
          <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">
            {formatDate(booking.bookingDate)}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400 text-sm">{t('spa.time')}:</span>
          <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">
            {formatTime12Hour(booking.bookingTime, locale as 'ar' | 'en')}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400 text-sm">{t('spa.duration')}:</span>
          <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">
            {booking.duration} {t('spa.minutes')}
          </span>
        </div>

        {booking.notes && (
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 font-bold mb-1">{t('spa.notes')}:</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{booking.notes}</p>
          </div>
        )}

        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('spa.createdBy')}: {booking.createdBy}
          </p>
        </div>

        {/* Actions */}
        {(canEdit || canCancel || canConfirm || onView) && (
          <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
            {canConfirm && onConfirm && booking.status === 'pending' && (
              <button
                onClick={() => onConfirm(booking)}
                className="flex-1 px-4 py-2 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/60 transition-colors duration-200 text-sm font-bold"
              >
                {direction === 'rtl' ? 'تأكيد' : 'Confirm'}
              </button>
            )}
            {onView && (
              <button
                onClick={() => onView(booking)}
                className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast rounded-lg transition-colors duration-200 text-sm font-bold"
              >
                {t('common.view')}
              </button>
            )}
            {canEdit && onEdit && booking.status !== 'cancelled' && booking.status !== 'completed' && (
              <button
                onClick={() => onEdit(booking)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 text-sm font-bold"
              >
                {t('common.edit')}
              </button>
            )}
            {canCancel && onCancel && booking.status !== 'cancelled' && booking.status !== 'completed' && (
              <button
                onClick={() => onCancel(booking)}
                className="flex-1 px-4 py-2 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors duration-200 text-sm font-bold"
              >
                {t('spa.cancelBooking')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

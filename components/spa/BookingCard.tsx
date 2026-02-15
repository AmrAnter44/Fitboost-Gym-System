// components/spa/BookingCard.tsx
import { useLanguage } from '../../contexts/LanguageContext'
import { SpaBooking } from '../../types/spa'
import { formatTime12Hour } from '../../lib/timeFormatter'
import StatusBadge from './StatusBadge'

interface BookingCardProps {
  booking: SpaBooking
  onEdit?: (booking: SpaBooking) => void
  onCancel?: (booking: SpaBooking) => void
  onView?: (booking: SpaBooking) => void
  canEdit?: boolean
  canCancel?: boolean
}

export default function BookingCard({
  booking,
  onEdit,
  onCancel,
  onView,
  canEdit = false,
  canCancel = false
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

  const serviceIcons = {
    massage: '💆',
    sauna: '🧖',
    jacuzzi: '🛁'
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-600 hover:shadow-lg transition-shadow">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{serviceIcons[booking.serviceType]}</span>
            <div>
              <h3 className="font-bold text-lg">{booking.memberName}</h3>
              <p className="text-sm opacity-90">{booking.memberPhone || t('common.noPhone')}</p>
            </div>
          </div>
          <StatusBadge status={booking.status} />
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-300 text-sm">{t('spa.service')}:</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {t(`spa.services.${booking.serviceType}`)}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-300 text-sm">{t('spa.date')}:</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {formatDate(booking.bookingDate)}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-300 text-sm">{t('spa.time')}:</span>
          <span className="font-semibold text-gray-900 dark:text-white">{formatTime12Hour(booking.bookingTime, locale as 'ar' | 'en')}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-300 text-sm">{t('spa.duration')}:</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {booking.duration} {t('spa.minutes')}
          </span>
        </div>

        {booking.notes && (
          <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium mb-1">{t('spa.notes')}:</p>
            <p className="text-sm text-gray-700 dark:text-gray-200">{booking.notes}</p>
          </div>
        )}

        <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('spa.createdBy')}: {booking.createdBy}
          </p>
        </div>

        {/* Actions */}
        {(canEdit || canCancel || onView) && (
          <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-600">
            {onView && (
              <button
                onClick={() => onView(booking)}
                className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
              >
                {t('common.view')}
              </button>
            )}
            {canEdit && onEdit && booking.status !== 'cancelled' && booking.status !== 'completed' && (
              <button
                onClick={() => onEdit(booking)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                {t('common.edit')}
              </button>
            )}
            {canCancel && onCancel && booking.status !== 'cancelled' && booking.status !== 'completed' && (
              <button
                onClick={() => onCancel(booking)}
                className="flex-1 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
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

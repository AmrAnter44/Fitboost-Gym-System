// components/spa/TimeSlotSelector.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { useLanguage } from '../../contexts/LanguageContext'
import { fetchAvailability } from '../../lib/api/spaBookings'
import { SpaServiceType } from '../../types/spa'
import { formatTime12Hour } from '../../lib/timeFormatter'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface TimeSlotSelectorProps {
  date: string
  serviceType: SpaServiceType
  onSelect: (time: string) => void
  selectedTime?: string
}

export default function TimeSlotSelector({
  date,
  serviceType,
  onSelect,
  selectedTime,
}: TimeSlotSelectorProps) {
  const { t, locale } = useLanguage()

  const { data: slots = [], isLoading, error } = useQuery({
    queryKey: ['spa-availability', date, serviceType],
    queryFn: () => fetchAvailability(date, serviceType),
    enabled: !!date && !!serviceType,
    staleTime: 1 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div
        className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="flex items-center justify-center gap-3">
          <svg className="animate-spin w-6 h-6 text-primary-500" {...stroke}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0013.13 4.95M19.5 12a7.5 7.5 0 00-13.13-4.95" />
          </svg>
          <span className="text-gray-600 dark:text-gray-400">{t('common.loading')}</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
        <div className="flex items-center justify-center gap-2 text-red-600 dark:text-red-400">
          <svg className="w-5 h-5" {...stroke}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.01M5.07 19h13.86A2 2 0 0020.66 16L13.73 4a2 2 0 00-3.46 0L3.34 16A2 2 0 005.07 19z" />
          </svg>
          <span>{t('spa.errorLoadingSlots')}</span>
        </div>
      </div>
    )
  }

  if (slots.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <svg className="w-12 h-12 text-gray-400" {...stroke}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">{t('spa.noSlotsAvailable')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
      <h3 className="text-base font-bold mb-4 text-gray-900 dark:text-gray-100">
        {t('spa.availableSlots')}
      </h3>

      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {slots.map((slot) => {
          const isSelected = selectedTime === slot.time
          const isAvailable = slot.available

          return (
            <button
              key={slot.time}
              onClick={() => isAvailable && onSelect(slot.time)}
              disabled={!isAvailable}
              aria-pressed={isSelected}
              className={`p-3 rounded-lg text-center transition-colors duration-200 ${
                isSelected
                  ? 'bg-primary-500 text-primary-contrast ring-2 ring-primary-600 shadow-sm font-bold'
                  : isAvailable
                  ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 text-green-800 dark:text-green-300 ring-1 ring-green-200 dark:ring-green-900/50'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed ring-1 ring-gray-200 dark:ring-gray-700'
              }`}
            >
              <div className="font-bold text-base">{formatTime12Hour(slot.time, locale as 'ar' | 'en')}</div>
              <div className="text-xs mt-1">
                {isAvailable ? (
                  <>
                    <span className="block">{t('spa.available')}</span>
                    <span className="block text-[10px] opacity-75">
                      {slot.remaining}/{slot.capacity}
                    </span>
                  </>
                ) : (
                  <span className="block">{t('spa.full')}</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-900/50 rounded"></div>
          <span>{t('spa.available')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-primary-500 rounded"></div>
          <span>{t('spa.selected')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-100 dark:bg-gray-700 ring-1 ring-gray-200 dark:ring-gray-700 rounded"></div>
          <span>{t('spa.full')}</span>
        </div>
      </div>
    </div>
  )
}

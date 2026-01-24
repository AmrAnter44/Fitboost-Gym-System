// components/spa/TimeSlotSelector.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { useLanguage } from '../../contexts/LanguageContext'
import { fetchAvailability } from '../../lib/api/spaBookings'
import { SpaServiceType } from '../../types/spa'
import { formatTime12Hour } from '../../lib/timeFormatter'

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
  selectedTime
}: TimeSlotSelectorProps) {
  const { t, locale } = useLanguage()

  const { data: slots = [], isLoading, error } = useQuery({
    queryKey: ['spa-availability', date, serviceType],
    queryFn: () => fetchAvailability(date, serviceType),
    enabled: !!date && !!serviceType,
    staleTime: 1 * 60 * 1000, // 1 minute
  })

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="mr-3 text-gray-600">{t('common.loading')}</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-center text-red-600">
          {t('spa.errorLoadingSlots')}
        </div>
      </div>
    )
  }

  if (slots.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-center text-gray-600">
          {t('spa.noSlotsAvailable')}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">
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
              className={`p-4 rounded-lg text-center transition-all ${
                isSelected
                  ? 'bg-blue-500 text-white shadow-lg scale-105'
                  : isAvailable
                  ? 'bg-green-50 hover:bg-green-100 text-green-800 border-2 border-green-300 hover:shadow-md'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-300'
              }`}
            >
              <div className="font-bold text-lg">{formatTime12Hour(slot.time, locale as 'ar' | 'en')}</div>
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

      <div className="mt-4 flex items-center gap-4 text-sm text-gray-600 border-t pt-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 border-2 border-green-300 rounded"></div>
          <span>{t('spa.available')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded"></div>
          <span>{t('spa.selected')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded"></div>
          <span>{t('spa.full')}</span>
        </div>
      </div>
    </div>
  )
}

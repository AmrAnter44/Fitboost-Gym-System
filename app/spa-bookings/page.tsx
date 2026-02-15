'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useLanguage } from '../../contexts/LanguageContext'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../contexts/ToastContext'
import PermissionDenied from '../../components/PermissionDenied'
import { fetchSpaBookings, cancelSpaBooking, updateSpaBooking } from '../../lib/api/spaBookings'
import { formatDateYMD } from '../../lib/dateFormatter'
import { formatTime12Hour } from '../../lib/timeFormatter'
import { SpaBooking, SpaServiceType, SpaBookingStatus } from '../../types/spa'
import BookingFormModal from '../../components/spa/BookingFormModal'
import BookingCard from '../../components/spa/BookingCard'
import StatusBadge from '../../components/spa/StatusBadge'

export default function SpaBookingsPage() {
  const { t, direction, locale } = useLanguage()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const toast = useToast()

  // States
  const [showForm, setShowForm] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedService, setSelectedService] = useState<SpaServiceType | ''>('')
  const [showTimeSlots, setShowTimeSlots] = useState(false)
  const [filters, setFilters] = useState<{
    status?: SpaBookingStatus | ''
    serviceType?: SpaServiceType | ''
    search?: string
    startDate?: string
    endDate?: string
  }>({
    status: '',
    serviceType: '',
    search: ''
  })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SpaBooking | null>(null)

  // Fetch bookings with filters
  const { data: bookings = [], isLoading, refetch } = useQuery({
    queryKey: ['spa-bookings', filters],
    queryFn: () => fetchSpaBookings(filters),
    enabled: !permissionsLoading && hasPermission('canViewSpaBookings'),
    staleTime: 2 * 60 * 1000,
  })

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: cancelSpaBooking,
    onSuccess: () => {
      toast.success(t('spa.messages.cancelSuccess'))
      refetch()
      setShowDeleteConfirm(false)
      setDeleteTarget(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || t('spa.messages.cancelError'))
    }
  })

  // Generate next 10 days
  const next10Days = Array.from({ length: 10 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() + i)
    return {
      date: formatDateYMD(date),
      dayName: date.toLocaleDateString(
        direction === 'rtl' ? 'ar-EG' : 'en-US',
        { weekday: 'short' }
      ),
      dayNumber: date.getDate(),
      monthName: date.toLocaleDateString(
        direction === 'rtl' ? 'ar-EG' : 'en-US',
        { month: 'short' }
      ),
      isToday: i === 0,
      fullDate: date
    }
  })

  const serviceIcons = {
    massage: '💆',
    sauna: '🧖',
    jacuzzi: '🛁'
  }

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

  const handleCancelBooking = (booking: SpaBooking) => {
    setDeleteTarget(booking)
    setShowDeleteConfirm(true)
  }

  const confirmCancel = () => {
    if (deleteTarget) {
      cancelMutation.mutate(deleteTarget.id)
    }
  }

  // Permission check
  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (!hasPermission('canViewSpaBookings')) {
    return <PermissionDenied />
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl" dir={direction}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('spa.title')}</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">{t('spa.subtitle')}</p>
        </div>
        {hasPermission('canCreateSpaBooking') && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:from-primary-600 hover:to-primary-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            {t('spa.newBooking')}
          </button>
        )}
      </div>

      {/* Calendar - Next 10 Days */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">{t('spa.selectDate')}</h2>
        <div className="grid grid-cols-5 sm:grid-cols-7 lg:grid-cols-10 gap-2">
          {next10Days.map((day) => (
            <button
              key={day.date}
              onClick={() => {
                const newDate = selectedDate === day.date ? '' : day.date
                setSelectedDate(newDate)
                if (newDate) {
                  setFilters({
                    ...filters,
                    startDate: newDate,
                    endDate: newDate
                  })
                } else {
                  const { startDate, endDate, ...restFilters } = filters as any
                  setFilters(restFilters)
                }
              }}
              className={`p-3 rounded-lg text-center transition-all ${
                selectedDate === day.date
                  ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg scale-105'
                  : day.isToday
                  ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-500 dark:border-green-600 text-green-800 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-900/50'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600'
              }`}
            >
              <div className="text-xs font-medium opacity-80">{day.dayName}</div>
              <div className="text-xl font-bold my-1">{day.dayNumber}</div>
              <div className="text-xs opacity-70">{day.monthName}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Service Type Selector - يظهر بعد اختيار اليوم */}
      {selectedDate && (
        <div className="mb-6 animate-fadeIn">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">{t('spa.selectService')}</h2>
          <div className="flex gap-3 flex-wrap">
            {(['sauna', 'massage', 'jacuzzi'] as SpaServiceType[]).map((service) => (
              <button
                key={service}
                onClick={() => {
                  const newService = selectedService === service ? '' : service
                  setSelectedService(newService)
                  setShowTimeSlots(!!newService)
                }}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                  selectedService === service
                    ? 'bg-primary-500 text-white shadow-md scale-105'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/50'
                }`}
              >
                <span className="text-2xl">{serviceIcons[service]}</span>
                <span>{t(`spa.services.${service}`)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Time Slots - يظهر بعد اختيار اليوم والخدمة */}
      {selectedDate && selectedService && showTimeSlots && hasPermission('canCreateSpaBooking') && (
        <div className="mb-6 animate-fadeIn">
          <div className="bg-gradient-to-r from-green-50 to-primary-50 dark:from-green-900/20 dark:to-primary-900/20 p-4 rounded-lg border-2 border-primary-200 dark:border-primary-600 mb-4">
            <p className="text-center text-gray-700 dark:text-gray-200 font-medium">
              ✨ {t('spa.selectTimeSlot')}
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white px-6 py-4 rounded-lg font-bold hover:from-primary-600 hover:to-primary-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 text-lg"
          >
            <span className="text-2xl">📅</span>
            {t('spa.bookNow')}
          </button>
        </div>
      )}

      {/* Bookings List */}
      <div className="mt-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{t('spa.allBookings')}</h2>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {t('spa.totalBookings')}: <span className="font-bold text-gray-900 dark:text-white">{bookings.length}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as SpaBookingStatus | '' })}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="">{t('spa.allStatuses')}</option>
              <option value="pending">{t('spa.status.pending')}</option>
              <option value="confirmed">{t('spa.status.confirmed')}</option>
              <option value="completed">{t('spa.status.completed')}</option>
              <option value="cancelled">{t('spa.status.cancelled')}</option>
            </select>

            <select
              value={filters.serviceType}
              onChange={(e) => setFilters({ ...filters, serviceType: e.target.value as SpaServiceType | '' })}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="">{t('spa.allServices')}</option>
              <option value="massage">{t('spa.services.massage')}</option>
              <option value="sauna">{t('spa.services.sauna')}</option>
              <option value="jacuzzi">{t('spa.services.jacuzzi')}</option>
            </select>

            <input
              type="text"
              placeholder={t('spa.searchPlaceholder')}
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && bookings.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
            <div className="text-6xl mb-4">💆</div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">{t('spa.noBookings')}</h3>
            <p className="text-gray-600 dark:text-gray-300">{t('spa.noBookingsDescription')}</p>
          </div>
        )}

        {/* Desktop Table */}
        {!isLoading && bookings.length > 0 && (
          <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-primary-500 to-primary-600 text-white">
                  <tr>
                    <th className="px-4 py-3 text-right font-semibold">{t('spa.memberName')}</th>
                    <th className="px-4 py-3 text-right font-semibold">{t('spa.service')}</th>
                    <th className="px-4 py-3 text-right font-semibold">{t('spa.date')}</th>
                    <th className="px-4 py-3 text-right font-semibold">{t('spa.time')}</th>
                    <th className="px-4 py-3 text-right font-semibold">{t('spa.duration')}</th>
                    <th className="px-4 py-3 text-right font-semibold">{t('spa.status')}</th>
                    <th className="px-4 py-3 text-center font-semibold">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking: SpaBooking) => (
                    <tr key={booking.id} className="border-b border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">{booking.memberName}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">{booking.memberPhone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{serviceIcons[booking.serviceType]}</span>
                          <span>{t(`spa.services.${booking.serviceType}`)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{formatDate(booking.bookingDate)}</td>
                      <td className="px-4 py-3 font-semibold">{formatTime12Hour(booking.bookingTime, locale as 'ar' | 'en')}</td>
                      <td className="px-4 py-3">{booking.duration} {t('spa.minutes')}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={booking.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          {hasPermission('canCancelSpaBooking') &&
                            booking.status !== 'cancelled' &&
                            booking.status !== 'completed' && (
                              <button
                                onClick={() => handleCancelBooking(booking)}
                                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 px-3 py-1 rounded transition-colors"
                              >
                                {t('spa.cancel')}
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Mobile Cards */}
        {!isLoading && bookings.length > 0 && (
          <div className="lg:hidden space-y-3">
            {bookings.map((booking: SpaBooking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                canCancel={hasPermission('canCancelSpaBooking')}
                onCancel={handleCancelBooking}
              />
            ))}
          </div>
        )}
      </div>

      {/* Booking Form Modal */}
      {showForm && (
        <BookingFormModal
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            refetch()
            setShowForm(false)
            toast.success(t('spa.messages.bookingCreated'))
          }}
          preFilledData={{
            date: selectedDate || undefined,
            serviceType: selectedService || undefined
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deleteTarget && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowDeleteConfirm(false)}
          dir={direction}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t('spa.cancelBooking')}</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {t('spa.confirmCancel', { memberName: deleteTarget.memberName })}
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmCancel}
                disabled={cancelMutation.isPending}
                className="flex-1 bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {cancelMutation.isPending ? t('common.processing') : t('common.confirm')}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={cancelMutation.isPending}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 py-2 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

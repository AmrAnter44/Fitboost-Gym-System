// components/spa/BookingFormModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLanguage } from '../../contexts/LanguageContext'
import { usePermissions } from '../../hooks/usePermissions'
import { createSpaBooking } from '../../lib/api/spaBookings'
import { fetchMembers } from '../../lib/api/members'
import { formatDateYMD } from '../../lib/dateFormatter'
import TimeSlotSelector from './TimeSlotSelector'
import { SpaServiceType } from '../../types/spa'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface BookingFormModalProps {
  onClose: () => void
  onSuccess: () => void
  preFilledData?: {
    date?: string
    serviceType?: SpaServiceType
    time?: string
  }
}

interface Member {
  id: string
  name: string
  phone: string
  memberNumber?: string
  isActive: boolean
}

const renderServiceIcon = (type: SpaServiceType) => {
  switch (type) {
    case 'massage':
      return (
        <svg className="w-7 h-7" {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 11a4 4 0 100-8 4 4 0 000 8zm-7 10a7 7 0 0114 0H5z" />
        </svg>
      )
    case 'sauna':
      return (
        <svg className="w-7 h-7" {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 3c0 2 2 2 2 4s-2 2-2 4 2 2 2 4M14 3c0 2 2 2 2 4s-2 2-2 4 2 2 2 4M4 21h16" />
        </svg>
      )
    case 'jacuzzi':
      return (
        <svg className="w-7 h-7" {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16v4a4 4 0 01-4 4H8a4 4 0 01-4-4v-4zm4 0V7a3 3 0 016 0M2 17c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2" />
        </svg>
      )
  }
}

export default function BookingFormModal({
  onClose,
  onSuccess,
  preFilledData,
}: BookingFormModalProps) {
  const { t, direction } = useLanguage()
  const { user } = usePermissions()

  const [formData, setFormData] = useState({
    memberId: '',
    serviceType: preFilledData?.serviceType || 'massage' as SpaServiceType,
    bookingDate: preFilledData?.date || formatDateYMD(new Date()),
    bookingTime: preFilledData?.time || '',
    duration: 60,
    notes: '',
  })

  const [submitting, setSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [showMemberDropdown, setShowMemberDropdown] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ['members'],
    queryFn: fetchMembers,
    staleTime: 5 * 60 * 1000,
  })

  const filteredMembers = (members as Member[])
    .filter(m => {
      if (!searchQuery) return false
      const query = searchQuery.toLowerCase()
      return (
        m.isActive &&
        (m.name.toLowerCase().includes(query) ||
          m.phone?.toLowerCase().includes(query) ||
          m.memberNumber?.toString().includes(query))
      )
    })
    .slice(0, 10)

  const handleMemberSelect = (member: Member) => {
    setSelectedMember(member)
    setFormData({ ...formData, memberId: member.id })
    setSearchQuery(member.name)
    setShowMemberDropdown(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.memberId) {
      setError(t('spa.errors.memberRequired'))
      return
    }

    if (!formData.bookingTime) {
      setError(t('spa.errors.timeRequired'))
      return
    }

    setSubmitting(true)

    try {
      await createSpaBooking(formData)
      onSuccess()
    } catch (error: any) {
      if (error.message === 'UNAUTHORIZED') {
        setError(t('spa.errors.unauthorized'))
      } else if (error.message === 'FORBIDDEN') {
        setError(t('spa.errors.forbidden'))
      } else {
        setError(error.message || t('spa.errors.createFailed'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const minDate = formatDateYMD(new Date())

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      dir={direction}
      role="dialog"
      aria-modal="true"
      aria-labelledby="spa-booking-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-modal-in">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-primary-500 to-primary-600 text-primary-contrast p-5 rounded-t-2xl z-10">
          <div className="flex justify-between items-center">
            <h2 id="spa-booking-title" className="text-xl font-bold">{t('spa.newBooking')}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close') || 'Close'}
              className="text-gray-900 hover:bg-black/10 rounded-full w-8 h-8 flex items-center justify-center transition-colors duration-200"
            >
              <svg className="w-5 h-5" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/50 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg flex items-start gap-2">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.01M5.07 19h13.86A2 2 0 0020.66 16L13.73 4a2 2 0 00-3.46 0L3.34 16A2 2 0 005.07 19z" />
              </svg>
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Member Search */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              {t('spa.selectMember')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder={t('spa.searchMemberPlaceholder')}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setShowMemberDropdown(true)
                  if (!e.target.value) {
                    setSelectedMember(null)
                    setFormData({ ...formData, memberId: '' })
                  }
                }}
                onFocus={() => setShowMemberDropdown(true)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                disabled={loadingMembers}
                autoFocus
              />

              {showMemberDropdown && filteredMembers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {filteredMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => handleMemberSelect(member)}
                      className="w-full px-4 py-3 text-start hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors duration-200 border-b border-gray-100 dark:border-gray-700 last:border-0"
                    >
                      <div className="font-bold text-gray-900 dark:text-gray-100 text-sm">{member.name}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {member.phone || t('common.noPhone')}
                        {member.memberNumber && ` • #${member.memberNumber}`}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedMember && (
                <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-900/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" {...stroke}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <div>
                      <div className="font-bold text-green-900 dark:text-green-300 text-sm">{selectedMember.name}</div>
                      <div className="text-xs text-green-700 dark:text-green-400">{selectedMember.phone}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Service Type */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              {t('spa.serviceType')} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['massage', 'sauna', 'jacuzzi'] as SpaServiceType[]).map((service) => (
                <button
                  key={service}
                  type="button"
                  onClick={() => setFormData({ ...formData, serviceType: service })}
                  className={`p-4 rounded-lg ring-1 transition-colors duration-200 ${
                    formData.serviceType === service
                      ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'ring-gray-200 dark:ring-gray-700 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                  aria-pressed={formData.serviceType === service}
                >
                  <div className="flex justify-center mb-2">{renderServiceIcon(service)}</div>
                  <div className="font-bold text-sm">
                    {t(`spa.services.${service}`)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              {t('spa.bookingDate')} <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.bookingDate}
              onChange={(e) => {
                setFormData({ ...formData, bookingDate: e.target.value, bookingTime: '' })
              }}
              min={minDate}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
              required
            />
          </div>

          {/* Time Slots */}
          {formData.bookingDate && (
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                {t('spa.selectTime')} <span className="text-red-500">*</span>
              </label>
              <TimeSlotSelector
                date={formData.bookingDate}
                serviceType={formData.serviceType}
                onSelect={(time) => setFormData({ ...formData, bookingTime: time })}
                selectedTime={formData.bookingTime}
              />
            </div>
          )}

          {/* Duration */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              {t('spa.duration')} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[30, 60, 90].map((duration) => (
                <button
                  key={duration}
                  type="button"
                  onClick={() => setFormData({ ...formData, duration })}
                  className={`px-4 py-2.5 rounded-lg ring-1 font-bold text-sm transition-colors duration-200 ${
                    formData.duration === duration
                      ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'ring-gray-200 dark:ring-gray-700 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                  aria-pressed={formData.duration === duration}
                >
                  {duration} {t('spa.minutes')}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              {t('spa.notes')} <span className="text-xs text-gray-500 dark:text-gray-400">({t('common.optional')})</span>
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
              placeholder={t('spa.notesPlaceholder')}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              disabled={submitting || !formData.memberId || !formData.bookingTime}
              className="flex-1 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? t('common.saving') : t('spa.confirmBooking')}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-bold transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

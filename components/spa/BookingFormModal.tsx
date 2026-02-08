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
  memberNumber?: number
  isActive: boolean
}

export default function BookingFormModal({
  onClose,
  onSuccess,
  preFilledData
}: BookingFormModalProps) {
  const { t, direction } = useLanguage()
  const { user } = usePermissions()

  const [formData, setFormData] = useState({
    memberId: '',
    serviceType: preFilledData?.serviceType || 'massage' as SpaServiceType,
    bookingDate: preFilledData?.date || formatDateYMD(new Date()),
    bookingTime: preFilledData?.time || '',
    duration: 60,
    notes: ''
  })

  const [submitting, setSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [showMemberDropdown, setShowMemberDropdown] = useState(false)
  const [error, setError] = useState('')

  // Fetch members for search
  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ['members'],
    queryFn: fetchMembers,
    staleTime: 5 * 60 * 1000,
  })

  // Filter members based on search query
  const filteredMembers = (members as Member[]).filter(m => {
    if (!searchQuery) return false
    const query = searchQuery.toLowerCase()
    return (
      m.isActive &&
      (m.name.toLowerCase().includes(query) ||
      m.phone?.toLowerCase().includes(query) ||
      m.memberNumber?.toString().includes(query))
    )
  }).slice(0, 10) // Limit to 10 results

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

  const serviceIcons = {
    massage: '💆',
    sauna: '🧖',
    jacuzzi: '🛁'
  }

  // Get minimum date (today)
  const minDate = formatDateYMD(new Date())

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      dir={direction}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-primary-500 to-primary-600 text-white p-6 rounded-t-lg">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">{t('spa.newBooking')}</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Member Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={loadingMembers}
              />

              {showMemberDropdown && filteredMembers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => handleMemberSelect(member)}
                      className="w-full px-4 py-3 text-right hover:bg-gray-100 transition-colors border-b border-gray-100 last:border-0"
                    >
                      <div className="font-medium text-gray-900">{member.name}</div>
                      <div className="text-sm text-gray-600">
                        {member.phone || t('common.noPhone')}
                        {member.memberNumber && ` • #${member.memberNumber}`}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedMember && (
                <div className="mt-2 p-3 bg-green-50 border border-green-300 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600">✓</span>
                    <div>
                      <div className="font-medium text-green-900">{selectedMember.name}</div>
                      <div className="text-sm text-green-700">{selectedMember.phone}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Service Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('spa.serviceType')} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(['massage', 'sauna', 'jacuzzi'] as SpaServiceType[]).map((service) => (
                <button
                  key={service}
                  type="button"
                  onClick={() => setFormData({ ...formData, serviceType: service })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.serviceType === service
                      ? 'border-primary-500 bg-primary-50 shadow-md'
                      : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-3xl mb-2">{serviceIcons[service]}</div>
                  <div className="font-medium text-gray-900">
                    {t(`spa.services.${service}`)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('spa.bookingDate')} <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.bookingDate}
              onChange={(e) => {
                setFormData({ ...formData, bookingDate: e.target.value, bookingTime: '' })
              }}
              min={minDate}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>

          {/* Time Slots */}
          {formData.bookingDate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('spa.duration')} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[30, 60, 90].map((duration) => (
                <button
                  key={duration}
                  type="button"
                  onClick={() => setFormData({ ...formData, duration })}
                  className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                    formData.duration === duration
                      ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-md'
                      : 'border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  {duration} {t('spa.minutes')}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('spa.notes')} <span className="text-sm text-gray-500">({t('common.optional')})</span>
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder={t('spa.notesPlaceholder')}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={submitting || !formData.memberId || !formData.bookingTime}
              className="flex-1 bg-gradient-to-r from-primary-500 to-primary-600 text-white py-3 px-6 rounded-lg font-medium hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
            >
              {submitting ? t('common.saving') : t('spa.confirmBooking')}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

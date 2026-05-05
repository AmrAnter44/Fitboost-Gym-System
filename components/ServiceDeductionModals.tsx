'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'
import { usePermissions } from '../hooks/usePermissions'
import StaffSelector from './StaffSelector'

interface InvitationModalProps {
  isOpen: boolean
  memberName: string
  memberId: string
  /** السيلز المرتبط بالعضو — بيتفضل تلقائياً في الدروب داون لو موجود */
  memberSalesStaffId?: string | null
  onClose: () => void
  onSuccess: () => void
}

export function InvitationModal({ isOpen, memberName, memberId, memberSalesStaffId, onClose, onSuccess }: InvitationModalProps) {
  const { direction, t } = useLanguage()
  const toast = useToast()
  const { user } = usePermissions()
  const canOverrideInvitationSales = user?.role === 'OWNER' || user?.role === 'ADMIN'
  const isLocked = !!memberSalesStaffId && !canOverrideInvitationSales
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [salesStaffId, setSalesStaffId] = useState<string>('')
  const [salesStaffList, setSalesStaffList] = useState<{ id: string; name: string; leadsCount: number }[]>([])

  useEffect(() => {
    if (!isOpen) return
    // 🔒 لو الـ member عنده سيلز، نضمن إن الـ submit بيبعت الـ id ده فوراً
    // حتى قبل ما الـ salesStaffList تنزل من الـ API
    if (memberSalesStaffId) {
      setSalesStaffId(memberSalesStaffId)
    }
    fetch('/api/followups/sales')
      .then(r => r.ok ? r.json() : null)
      .then((data: any) => {
        if (!data?.staff) return
        const salesOnly = data.staff.filter((s: any) =>
          s.position?.split(',').map((p: string) => p.trim()).includes('sales')
        ).map((s: any) => ({ id: s.staffId, name: s.name, leadsCount: s.leadsCount ?? 0 }))
        setSalesStaffList(salesOnly)
        // 🔒 الافتراضي = السيلز المرتبط بالعضو نفسه (لو موجود ضمن قائمة السيلز)
        // لو مش موجود، نـfallback للأقل ليدز.
        if (salesOnly.length > 0) {
          const memberSalesInList = memberSalesStaffId
            ? salesOnly.find((s: any) => s.id === memberSalesStaffId)
            : null
          if (memberSalesInList) {
            setSalesStaffId(memberSalesStaffId!)
          } else {
            const least = [...salesOnly].sort((a: any, b: any) => a.leadsCount - b.leadsCount)[0]
            setSalesStaffId(least.id)
          }
        }
      })
      .catch(() => {})
  }, [isOpen, memberSalesStaffId])

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!guestName.trim() || !guestPhone.trim()) {
      toast.warning(t('invitationModal.pleaseEnterGuestNameAndPhone'))
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          guestName: guestName.trim(),
          guestPhone: guestPhone.trim(),
          notes: notes.trim(),
          salesStaffId: salesStaffId || undefined
        })
      })

      if (response.ok) {
        toast.success(t('invitationModal.invitationRegisteredSuccessfully'))
        setTimeout(() => {
          onSuccess()
          handleClose()
        }, 1500)
      } else {
        const error = await response.json()
        toast.error(error.error || t('invitationModal.invitationRegistrationFailed'))
      }
    } catch (error) {
      toast.error(t('invitationModal.registrationError'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setGuestName('')
    setGuestPhone('')
    setNotes('')
    setSalesStaffId('')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10000] p-4"
      onClick={(e) => e.target === e.currentTarget && !submitting && handleClose()}
      dir={direction}
    >
      {/* compact, square-ish modal — header/footer ثابتين، الجسم بيـscroll لو محتاج */}
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <span>🎟️</span>
              <span>{t('invitationModal.useInvitation')}</span>
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 truncate">{t('invitationModal.forMember')}: {memberName}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-3xl leading-none disabled:opacity-50 shrink-0 mr-2"
          >
            ×
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-100 mb-1">
              {t('invitationModal.guestName')} <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              placeholder={t('invitationModal.guestNamePlaceholder')}
              autoFocus
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-100 mb-1">
              {t('invitationModal.guestPhone')} <span className="text-red-600">*</span>
            </label>
            <input
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              placeholder={t('invitationModal.guestPhonePlaceholder')}
              dir="ltr"
              disabled={submitting}
            />
          </div>

          {salesStaffList.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-100 mb-1">
                💼 موظف السيلز المسؤول
              </label>
              {isLocked && (
                <div className="mb-1.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-200">
                  🔒 محجوز: <strong>{salesStaffList.find(s => s.id === memberSalesStaffId)?.name || '—'}</strong>
                </div>
              )}
              <select
                value={isLocked ? (memberSalesStaffId || '') : salesStaffId}
                onChange={(e) => setSalesStaffId(e.target.value)}
                disabled={submitting || isLocked}
                className={`w-full px-3 py-2 border-2 rounded-lg text-sm focus:outline-none ${
                  isLocked
                    ? 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-200'
                }`}
              >
                <option value="">— بدون تعيين (تلقائي) —</option>
                {salesStaffList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.leadsCount} ليد)
                    {s.id === salesStaffList.slice().sort((a, b) => a.leadsCount - b.leadsCount)[0]?.id ? ' ✨ مقترح' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-100 mb-1">
              {t('invitationModal.notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 resize-none"
              rows={2}
              placeholder={t('invitationModal.notesPlaceholder')}
              disabled={submitting}
            />
          </div>
        </div>

        {/* Footer — sticky buttons */}
        <div className="flex gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !guestName.trim() || !guestPhone.trim()}
            className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-sm transition"
          >
            {submitting ? `⏳ ${t('invitationModal.registering')}` : `✅ ${t('invitationModal.registerInvitation')}`}
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="px-4 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold text-sm disabled:opacity-50"
          >
            {t('invitationModal.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

interface SimpleServiceModalProps {
  isOpen: boolean
  serviceType: 'freePT' | 'inBody' | 'nutrition' | 'physio' | 'groupClass'
  memberName: string
  memberId: string
  onClose: () => void
  onSuccess: () => void
}

export function SimpleServiceModal({ isOpen, serviceType, memberName, memberId, onClose, onSuccess }: SimpleServiceModalProps) {
  const { direction, t } = useLanguage()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')

  if (!isOpen) return null

  const serviceNames = {
    freePT: t('serviceModal.freePTSession'),
    inBody: 'InBody',
    nutrition: t('serviceModal.freeNutritionSession'),
    physio: t('serviceModal.freePhysioSession'),
    groupClass: t('serviceModal.freeGroupClassSession')
  }

  const serviceIcons = {
    freePT: '💪',
    inBody: '⚖️',
    nutrition: '🥗',
    physio: '🏥',
    groupClass: '👥'
  }

  const serviceColors = {
    freePT: { bg: 'green', hover: 'green' },
    inBody: { bg: 'blue', hover: 'blue' },
    nutrition: { bg: 'orange', hover: 'orange' },
    physio: { bg: 'teal', hover: 'teal' },
    groupClass: { bg: 'indigo', hover: 'indigo' }
  }

  const handleConfirm = async () => {
    // إذا كان PT، يجب اختيار الكوتش
    if (serviceType === 'freePT' && !selectedStaffId) {
      toast.warning(t('serviceModal.pleaseSelectStaff'))
      return
    }

    setSubmitting(true)

    try {
      // إذا كان PT، استخدم API المخصص للجلسات المجانية
      const apiUrl = serviceType === 'freePT'
        ? '/api/members/free-sessions/register'
        : '/api/members/deduct-service'

      const requestBody = serviceType === 'freePT'
        ? {
            memberId,
            serviceType: 'PT',
            staffId: selectedStaffId,
            notes
          }
        : {
            memberId,
            serviceType
          }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (response.ok) {
        toast.success(t('serviceModal.deductedSuccessfully', { service: serviceNames[serviceType] }))
        setTimeout(() => {
          onSuccess()
          handleClose()
        }, 1500)
      } else {
        const error = await response.json()
        toast.error(error.error || t('serviceModal.deductionFailed'))
      }
    } catch (error) {
      toast.error(t('serviceModal.deductionError'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setSelectedStaffId(null)
    setNotes('')
    onClose()
  }

  const color = serviceColors[serviceType]

  // إذا كان PT، نعرض modal مختلف مع اختيار الكوتش
  if (serviceType === 'freePT') {
    return (
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10000] p-4"
        onClick={(e) => e.target === e.currentTarget && !submitting && handleClose()}
        dir={direction}
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fadeIn" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="p-6 border-b dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{serviceIcons[serviceType]}</span>
                <div>
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                    {t('serviceModal.registerFreeSession')} {serviceNames[serviceType]}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('serviceModal.forMember')}: {memberName}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={submitting}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-3xl leading-none disabled:opacity-50"
              >
                ×
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Staff Selection */}
            <div>
              <label className="block font-bold mb-3 text-gray-800 dark:text-gray-100">
                👤 {t('serviceModal.selectStaff')} <span className="text-red-600">*</span>
              </label>
              <StaffSelector
                serviceType="PT"
                value={selectedStaffId}
                onChange={setSelectedStaffId}
                required
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block font-bold mb-2 text-gray-800 dark:text-gray-100">
                📝 {t('serviceModal.notes')}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                rows={3}
                placeholder={t('serviceModal.notesPlaceholder')}
                disabled={submitting}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t dark:border-gray-700 flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={submitting || !selectedStaffId}
              className="flex-1 bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold transition"
            >
              {submitting ? `⏳ ${t('serviceModal.registering')}` : `✅ ${t('serviceModal.registerSession')}`}
            </button>
            <button
              onClick={handleClose}
              disabled={submitting}
              className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {t('serviceModal.cancel')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // للخدمات الأخرى، نعرض المودال البسيط
  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10000] p-4"
      onClick={(e) => e.target === e.currentTarget && !submitting && handleClose()}
      dir={direction}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">{serviceIcons[serviceType]}</div>
          <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
            {t('serviceModal.confirmDeduction')} {serviceNames[serviceType]}
          </h3>
          <p className="text-gray-600 dark:text-gray-300">{t('serviceModal.forMember')}: {memberName}</p>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-300 dark:border-yellow-700 rounded-lg p-4 mb-4">
          <p className="text-yellow-800 dark:text-yellow-200 text-center">
            ⚠️ {t('serviceModal.confirmDeductQuestion', { service: serviceNames[serviceType] })}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className={`flex-1 bg-${color.bg}-600 text-white py-3 rounded-lg hover:bg-${color.hover}-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold transition`}
          >
            {submitting ? `⏳ ${t('serviceModal.deducting')}` : `✅ ${t('serviceModal.confirmDeductBtn')}`}
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold disabled:opacity-50"
          >
            {t('serviceModal.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

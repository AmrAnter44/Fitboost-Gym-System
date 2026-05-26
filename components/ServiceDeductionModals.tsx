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

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

const ticketIcon = (
  <svg className="w-6 h-6" {...stroke}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
  </svg>
)

const closeIcon = (
  <svg className="w-5 h-5" {...stroke}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const checkIcon = (
  <svg className="w-4 h-4" {...stroke}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const spinnerIcon = (
  <svg className="w-4 h-4 animate-spin" {...stroke}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-4.992 4.992l3.181-3.183a8.25 8.25 0 00-13.803 3.7M4.031 9.865v-4.992m0 0H8.99M3 12a9 9 0 0015.357 6.364l-1.06-1.06" />
  </svg>
)

const briefcaseIcon = (
  <svg className="w-4 h-4" {...stroke}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
  </svg>
)

const lockIcon = (
  <svg className="w-3.5 h-3.5" {...stroke}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
)

const noteIcon = (
  <svg className="w-4 h-4" {...stroke}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
)

const personIcon = (
  <svg className="w-4 h-4" {...stroke}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
)

const warningIcon = (
  <svg className="w-5 h-5" {...stroke}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" />
  </svg>
)

const serviceIconFor: Record<string, JSX.Element> = {
  freePT: (
    <svg className="w-7 h-7" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
  inBody: (
    <svg className="w-7 h-7" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
    </svg>
  ),
  nutrition: (
    <svg className="w-7 h-7" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3" />
    </svg>
  ),
  physio: (
    <svg className="w-7 h-7" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085" />
    </svg>
  ),
  groupClass: (
    <svg className="w-7 h-7" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
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

  useEffect(() => {
    if (!isOpen) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', onKey)
    }
  }, [isOpen, submitting])

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
      className="fixed inset-0 z-[10000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-backdrop-in"
      onClick={(e) => e.target === e.currentTarget && !submitting && handleClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="invitation-modal-title"
      dir={direction}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="min-w-0 flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center flex-shrink-0">
              {ticketIcon}
            </div>
            <div className="min-w-0">
              <h3 id="invitation-modal-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {t('invitationModal.useInvitation')}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 truncate">{t('invitationModal.forMember')}: {memberName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            aria-label="إغلاق"
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 disabled:opacity-50 shrink-0"
          >
            {closeIcon}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              {t('invitationModal.guestName')} <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
              placeholder={t('invitationModal.guestNamePlaceholder')}
              autoFocus
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              {t('invitationModal.guestPhone')} <span className="text-red-600">*</span>
            </label>
            <input
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
              placeholder={t('invitationModal.guestPhonePlaceholder')}
              dir="ltr"
              disabled={submitting}
            />
          </div>

          {salesStaffList.length > 0 && (
            <div>
              <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                {briefcaseIcon}
                <span>موظف السيلز المسؤول</span>
              </label>
              {isLocked && (
                <div className="mb-1.5 bg-amber-50 dark:bg-amber-900/30 ring-1 ring-amber-200 dark:ring-amber-800 rounded-lg px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                  {lockIcon}
                  <span>محجوز: <strong>{salesStaffList.find(s => s.id === memberSalesStaffId)?.name || '—'}</strong></span>
                </div>
              )}
              <select
                value={isLocked ? (memberSalesStaffId || '') : salesStaffId}
                onChange={(e) => setSalesStaffId(e.target.value)}
                disabled={submitting || isLocked}
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none transition-colors duration-200 ${
                  isLocked
                    ? 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900/40 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                }`}
              >
                <option value="">— بدون تعيين (تلقائي) —</option>
                {salesStaffList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.leadsCount} ليد)
                    {s.id === salesStaffList.slice().sort((a, b) => a.leadsCount - b.leadsCount)[0]?.id ? ' (مقترح)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              {t('invitationModal.notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 resize-none"
              rows={2}
              placeholder={t('invitationModal.notesPlaceholder')}
              disabled={submitting}
            />
          </div>
        </div>

        <div className="flex gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700 shrink-0 flex-row-reverse">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !guestName.trim() || !guestPhone.trim()}
            className="flex-1 bg-primary-600 hover:bg-primary-700 text-primary-contrast py-2.5 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed font-bold text-sm transition-colors duration-200 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
          >
            {submitting ? (
              <>{spinnerIcon}<span>{t('invitationModal.registering')}</span></>
            ) : (
              <>{checkIcon}<span>{t('invitationModal.registerInvitation')}</span></>
            )}
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="px-5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-bold text-sm transition-colors duration-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
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

  useEffect(() => {
    if (!isOpen) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', onKey)
    }
  }, [isOpen, submitting])

  if (!isOpen) return null

  const serviceNames = {
    freePT: t('serviceModal.freePTSession'),
    inBody: 'InBody',
    nutrition: t('serviceModal.freeNutritionSession'),
    physio: t('serviceModal.freePhysioSession'),
    groupClass: t('serviceModal.freeGroupClassSession')
  }

  const handleConfirm = async () => {
    if (serviceType === 'freePT' && !selectedStaffId) {
      toast.warning(t('serviceModal.pleaseSelectStaff'))
      return
    }

    setSubmitting(true)

    try {
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

  if (serviceType === 'freePT') {
    return (
      <div
        className="fixed inset-0 z-[10000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-backdrop-in"
        onClick={(e) => e.target === e.currentTarget && !submitting && handleClose()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-modal-pt-title"
        dir={direction}
      >
        <div
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center flex-shrink-0">
                  {serviceIconFor[serviceType]}
                </div>
                <div>
                  <h2 id="service-modal-pt-title" className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {t('serviceModal.registerFreeSession')} {serviceNames[serviceType]}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('serviceModal.forMember')}: {memberName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                aria-label="إغلاق"
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 disabled:opacity-50"
              >
                {closeIcon}
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                {personIcon}
                <span>{t('serviceModal.selectStaff')} <span className="text-red-600">*</span></span>
              </label>
              <StaffSelector
                serviceType="PT"
                value={selectedStaffId}
                onChange={setSelectedStaffId}
                required
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                {noteIcon}
                <span>{t('serviceModal.notes')}</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                rows={3}
                placeholder={t('serviceModal.notesPlaceholder')}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3 flex-row-reverse">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting || !selectedStaffId}
              autoFocus
              className="flex-1 bg-primary-600 hover:bg-primary-700 text-primary-contrast py-2.5 px-5 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed font-bold transition-colors duration-200 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
            >
              {submitting ? (
                <>{spinnerIcon}<span>{t('serviceModal.registering')}</span></>
              ) : (
                <>{checkIcon}<span>{t('serviceModal.registerSession')}</span></>
              )}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-bold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
            >
              {t('serviceModal.cancel')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const serviceTints: Record<string, string> = {
    inBody: 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300',
    nutrition: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    physio: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
    groupClass: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  }

  return (
    <div
      className="fixed inset-0 z-[10000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-backdrop-in"
      onClick={(e) => e.target === e.currentTarget && !submitting && handleClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-modal-simple-title"
      dir={direction}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <div className={`${serviceTints[serviceType] || 'bg-gray-100 dark:bg-gray-700'} w-16 h-16 mx-auto mb-4 rounded-xl flex items-center justify-center`}>
            {serviceIconFor[serviceType]}
          </div>
          <h3 id="service-modal-simple-title" className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {t('serviceModal.confirmDeduction')} {serviceNames[serviceType]}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">{t('serviceModal.forMember')}: {memberName}</p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-800 rounded-lg p-4 mb-4 flex items-center gap-2 justify-center">
          <div className="text-amber-600 dark:text-amber-400">{warningIcon}</div>
          <p className="text-amber-800 dark:text-amber-200 text-center text-sm font-bold">
            {t('serviceModal.confirmDeductQuestion', { service: serviceNames[serviceType] })}
          </p>
        </div>

        <div className="flex gap-3 flex-row-reverse">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            autoFocus
            className="flex-1 bg-primary-600 hover:bg-primary-700 text-primary-contrast py-2.5 px-5 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed font-bold transition-colors duration-200 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
          >
            {submitting ? (
              <>{spinnerIcon}<span>{t('serviceModal.deducting')}</span></>
            ) : (
              <>{checkIcon}<span>{t('serviceModal.confirmDeductBtn')}</span></>
            )}
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-bold transition-colors duration-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
          >
            {t('serviceModal.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

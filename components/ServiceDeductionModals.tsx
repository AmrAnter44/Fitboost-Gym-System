'use client'

import { useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'

interface InvitationModalProps {
  isOpen: boolean
  memberName: string
  memberId: string
  onClose: () => void
  onSuccess: () => void
}

export function InvitationModal({ isOpen, memberName, memberId, onClose, onSuccess }: InvitationModalProps) {
  const { direction } = useLanguage()
  const toast = useToast()
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!guestName.trim() || !guestPhone.trim()) {
      toast.warning('يرجى إدخال اسم ورقم هاتف الضيف')
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
          notes: notes.trim()
        })
      })

      if (response.ok) {
        toast.success('تم تسجيل الدعوة بنجاح!')
        setTimeout(() => {
          onSuccess()
          handleClose()
        }, 1500)
      } else {
        const error = await response.json()
        toast.error(error.error || 'فشل تسجيل الدعوة')
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء التسجيل')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setGuestName('')
    setGuestPhone('')
    setNotes('')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10000] p-4"
      onClick={(e) => e.target === e.currentTarget && !submitting && handleClose()}
      dir={direction}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <span>🎟️</span>
              <span>استخدام دعوة</span>
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">للعضو: {memberName}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-3xl leading-none disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-100 mb-2">
              اسم الضيف <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              placeholder="أدخل اسم الضيف..."
              autoFocus
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-100 mb-2">
              رقم هاتف الضيف <span className="text-red-600">*</span>
            </label>
            <input
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              placeholder="01xxxxxxxxx"
              dir="ltr"
              disabled={submitting}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-100 mb-2">
              ملاحظات (اختياري)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 resize-none"
              rows={3}
              placeholder="ملاحظات إضافية..."
              disabled={submitting}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !guestName.trim() || !guestPhone.trim()}
              className="flex-1 bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold transition"
            >
              {submitting ? '⏳ جاري التسجيل...' : '✅ تسجيل الدعوة'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold disabled:opacity-50"
            >
              إلغاء
            </button>
          </div>
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
  const { direction } = useLanguage()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  const serviceNames = {
    freePT: 'جلسة PT مجانية',
    inBody: 'InBody',
    nutrition: 'جلسة تغذية مجانية',
    physio: 'جلسة علاج طبيعي مجانية',
    groupClass: 'جلسة كلاس مجانية'
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
    setSubmitting(true)

    try {
      const response = await fetch('/api/members/deduct-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          serviceType
        })
      })

      if (response.ok) {
        toast.success(`تم خصم ${serviceNames[serviceType]} بنجاح!`)
        setTimeout(() => {
          onSuccess()
          handleClose()
        }, 1500)
      } else {
        const error = await response.json()
        toast.error(error.error || 'فشل الخصم')
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء الخصم')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    onClose()
  }

  const color = serviceColors[serviceType]

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
            تأكيد خصم {serviceNames[serviceType]}
          </h3>
          <p className="text-gray-600 dark:text-gray-300">للعضو: {memberName}</p>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-300 dark:border-yellow-700 rounded-lg p-4 mb-4">
          <p className="text-yellow-800 dark:text-yellow-200 text-center">
            ⚠️ هل أنت متأكد من خصم {serviceNames[serviceType]} واحدة؟
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className={`flex-1 bg-${color.bg}-600 text-white py-3 rounded-lg hover:bg-${color.hover}-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold transition`}
          >
            {submitting ? '⏳ جاري الخصم...' : '✅ تأكيد الخصم'}
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold disabled:opacity-50"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  )
}

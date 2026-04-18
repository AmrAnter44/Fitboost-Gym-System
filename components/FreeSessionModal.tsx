'use client'

import { useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'
import StaffSelector from './StaffSelector'

interface FreeSessionModalProps {
  isOpen: boolean
  serviceType: 'PT' | 'Nutrition' | 'Physiotherapy' | 'GroupClass'
  memberName: string
  memberId: string
  remainingSessions: number
  onClose: () => void
  onSuccess: () => void
}

export default function FreeSessionModal({
  isOpen,
  serviceType,
  memberName,
  memberId,
  remainingSessions,
  onClose,
  onSuccess
}: FreeSessionModalProps) {
  const { t } = useLanguage()
  const toast = useToast()
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const serviceIcons = {
    PT: '💪',
    Nutrition: '🥗',
    Physiotherapy: '🏥',
    GroupClass: '👥'
  }

  const serviceNames = {
    PT: 'PT',
    Nutrition: 'تغذية',
    Physiotherapy: 'علاج طبيعي',
    GroupClass: 'جروب كلاسيس'
  }

  const handleSubmit = async () => {
    if (!selectedStaffId) {
      toast.warning('يرجى اختيار الموظف')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/members/free-sessions/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          serviceType,
          staffId: selectedStaffId,
          notes
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message)
        onSuccess()
        onClose()
      } else {
        toast.error(data.error || 'فشل تسجيل الجلسة')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('حدث خطأ أثناء التسجيل')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{serviceIcons[serviceType]}</span>
              <div>
                <h2 className="text-xl font-bold dark:text-white">
                  تسجيل جلسة {serviceNames[serviceType]} مجانية
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  العضو: {memberName}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl"
            >
              ×
            </button>
          </div>
          <div className="mt-3 bg-primary-100 dark:bg-primary-900/30 p-2 rounded-lg">
            <p className="text-sm font-bold text-primary-800 dark:text-primary-300">
              الجلسات المتبقية: {remainingSessions}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Staff Selection */}
          <div>
            <label className="block font-bold mb-3 dark:text-white">
              👤 اختر الموظف الذي سيقدم الخدمة *
            </label>
            <StaffSelector
              serviceType={serviceType}
              value={selectedStaffId}
              onChange={setSelectedStaffId}
              required
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block font-bold mb-2 dark:text-white">
              📝 ملاحظات (اختياري)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              rows={3}
              placeholder="ملاحظات عن الجلسة..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t dark:border-gray-700 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading || !selectedStaffId}
            className="flex-1 bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold transition"
          >
            {loading ? '⏳ جاري التسجيل...' : '✅ تسجيل الجلسة'}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { formatDateYMD } from '../lib/dateFormatter'

interface AdminDateOverrideProps {
  isAdmin: boolean
  onDateChange: (date: Date | null) => void
}

export default function AdminDateOverride({ isAdmin, onDateChange }: AdminDateOverrideProps) {
  const [isEnabled, setIsEnabled] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [customDate, setCustomDate] = useState(formatDateYMD(new Date()))
  const [customTime, setCustomTime] = useState('12:00')

  useEffect(() => {
    if (isEnabled && customDate) {
      // دمج التاريخ والوقت
      const [hours, minutes] = customTime.split(':')
      const dateTime = new Date(customDate)
      dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0)
      onDateChange(dateTime)
    } else {
      onDateChange(null)
    }
  }, [isEnabled, customDate, customTime, onDateChange])

  if (!isAdmin) return null

  return (
    <>
      {/* Button in Navbar */}
      <button
        onClick={() => setShowModal(true)}
        className={`relative px-3 py-2 rounded-lg font-semibold transition-all text-sm ${
          isEnabled
            ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
            : 'bg-primary-600 text-white hover:bg-primary-700'
        }`}
        title="تغيير تاريخ التسجيل"
      >
        <span className="flex items-center gap-2">
          🕐
          {isEnabled && <span className="text-xs">مفعّل</span>}
        </span>
        {isEnabled && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
        )}
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                ⏰ تغيير تاريخ التسجيل
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-3xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Enable/Disable Toggle */}
            <div className={`p-4 rounded-lg mb-6 ${
              isEnabled ? 'bg-red-50 border-2 border-red-300' : 'bg-gray-50 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-lg text-gray-900 dark:text-white">
                    {isEnabled ? '🔴 الوضع مفعّل حالياً' : '⚪ الوضع غير مفعّل'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {isEnabled
                      ? '⚠️ جميع العمليات ستُسجل بالتاريخ المخصص أدناه'
                      : 'العمليات ستُسجل بالتاريخ والوقت الحالي'}
                  </p>
                </div>
                <button
                  onClick={() => setIsEnabled(!isEnabled)}
                  className={`px-6 py-3 rounded-lg font-bold transition-all ${
                    isEnabled
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {isEnabled ? 'إيقاف' : 'تفعيل'}
                </button>
              </div>
            </div>

            {/* Date and Time Controls */}
            {isEnabled && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-200">
                      📅 التاريخ
                    </label>
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono focus:border-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-200">
                      🕐 الوقت
                    </label>
                    <input
                      type="time"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono focus:border-primary-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    setCustomDate(formatDateYMD(new Date()))
                    const now = new Date()
                    setCustomTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
                  }}
                  className="w-full px-4 py-3 bg-primary-100 hover:bg-primary-200 text-primary-800 rounded-lg font-semibold transition"
                >
                  🔄 تعيين التاريخ والوقت الحالي
                </button>

                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded dark:bg-yellow-900/20 dark:border-yellow-700">
                  <p className="text-sm text-yellow-800">
                    <strong>💡 ملاحظة:</strong> التاريخ المخصص: {customDate} الساعة {customTime}
                  </p>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 rounded-lg font-semibold transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { formatDateYMD } from '../lib/dateFormatter'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

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
      <button
        onClick={() => setShowModal(true)}
        aria-label="تغيير تاريخ التسجيل"
        aria-haspopup="dialog"
        aria-expanded={showModal}
        className={`relative inline-flex items-center gap-2 px-3 py-2 rounded-lg font-semibold text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${
          isEnabled
            ? 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500'
            : 'bg-primary-600 text-primary-contrast hover:bg-primary-700 focus-visible:ring-primary-500'
        }`}
        title="تغيير تاريخ التسجيل"
      >
        <svg {...stroke} className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
          <circle cx="12" cy="12" r="9" />
        </svg>
        {isEnabled && <span className="text-xs">مفعّل</span>}
        {isEnabled && (
          <span className="absolute -top-1 -end-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
        )}
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-date-override-title"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-2xl w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 id="admin-date-override-title" className="text-2xl font-bold text-gray-900 dark:text-gray-100 inline-flex items-center gap-2">
                <svg {...stroke} className="w-6 h-6 text-primary-600 dark:text-primary-400">
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
                </svg>
                تغيير تاريخ التسجيل
              </h2>
              <button
                onClick={() => setShowModal(false)}
                aria-label="إغلاق"
                className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                <svg {...stroke} className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            </div>

            <div className={`p-4 rounded-lg mb-6 ring-1 ${
              isEnabled
                ? 'bg-red-50 dark:bg-red-900/20 ring-red-200 dark:ring-red-800'
                : 'bg-gray-50 dark:bg-gray-700/40 ring-gray-200 dark:ring-gray-700'
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-lg text-gray-900 dark:text-gray-100 inline-flex items-center gap-2">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${isEnabled ? 'bg-red-500' : 'bg-gray-400 dark:bg-gray-500'}`}></span>
                    {isEnabled ? 'الوضع مفعّل حالياً' : 'الوضع غير مفعّل'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 inline-flex items-start gap-1.5">
                    {isEnabled ? (
                      <svg {...stroke} className="w-4 h-4 mt-0.5 text-amber-500 flex-shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.14A2 2 0 003.84 21h16.32a2 2 0 001.73-3l-8.18-14.14a2 2 0 00-3.42 0z" />
                      </svg>
                    ) : null}
                    <span>{isEnabled ? 'جميع العمليات ستُسجل بالتاريخ المخصص أدناه' : 'العمليات ستُسجل بالتاريخ والوقت الحالي'}</span>
                  </p>
                </div>
                <button
                  onClick={() => setIsEnabled(!isEnabled)}
                  className={`px-6 py-2.5 rounded-lg font-bold text-white transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${
                    isEnabled
                      ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500'
                      : 'bg-green-600 hover:bg-green-700 focus-visible:ring-green-500'
                  }`}
                >
                  {isEnabled ? 'إيقاف' : 'تفعيل'}
                </button>
              </div>
            </div>

            {isEnabled && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      <svg {...stroke} className="w-4 h-4">
                        <rect x="3" y="5" width="18" height="16" rx="2" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 3v4M8 3v4M3 10h18" />
                      </svg>
                      التاريخ
                    </label>
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                      <svg {...stroke} className="w-4 h-4">
                        <circle cx="12" cy="12" r="9" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
                      </svg>
                      الوقت
                    </label>
                    <input
                      type="time"
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    setCustomDate(formatDateYMD(new Date()))
                    const now = new Date()
                    setCustomTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-100 hover:bg-primary-200 dark:bg-primary-900/30 dark:hover:bg-primary-900/50 text-primary-800 dark:text-primary-200 rounded-lg font-semibold transition-colors duration-200"
                >
                  <svg {...stroke} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M20 9a8 8 0 00-14.93-2M4 15a8 8 0 0014.93 2" />
                  </svg>
                  تعيين التاريخ والوقت الحالي
                </button>

                <div className="bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-800 border-s-4 border-amber-400 dark:border-amber-600 p-4 rounded">
                  <p className="text-sm text-amber-800 dark:text-amber-200 inline-flex items-start gap-1.5">
                    <svg {...stroke} className="w-4 h-4 mt-0.5 flex-shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span><strong>ملاحظة:</strong> التاريخ المخصص: {customDate} الساعة {customTime}</span>
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-semibold transition-colors duration-200"
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

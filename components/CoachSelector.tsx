'use client'

import { useState, useEffect } from 'react'

interface Coach {
  id: string
  name: string
  staffCode: string
  position: string | null
  isActive: boolean
  memberCount: number
  isCheckedIn: boolean
  lastCheckIn: string | null
}

interface CoachSelectorProps {
  value: string | null
  onChange: (coachId: string | null) => void
  required?: boolean
}

export default function CoachSelector({ value, onChange, required = false }: CoachSelectorProps) {
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchCoaches()
  }, [])

  const fetchCoaches = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/coaches/with-stats')

      if (!response.ok) {
        throw new Error('Failed to fetch coaches')
      }

      const data = await response.json()
      setCoaches(data)
      console.log('👨‍🏫 تم تحميل المدربين:', data.length, 'مدرب')
    } catch (err) {
      console.error('Error fetching coaches:', err)
      setError('فشل تحميل قائمة المدربين')
    } finally {
      setLoading(false)
    }
  }

  const selectedCoach = coaches.find(c => c.id === value)

  return (
    <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-3">
      <h3 className="font-bold text-base mb-3 flex items-center gap-2">
        <span>👨‍🏫</span>
        <span>اختيار المدرب {required && <span className="text-red-500">*</span>}</span>
      </h3>

      {loading ? (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500">⏳ جاري التحميل...</p>
        </div>
      ) : error ? (
        <div className="bg-red-100 border-2 border-red-300 rounded-lg p-3 text-center">
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={fetchCoaches}
            className="mt-2 text-xs text-red-600 underline hover:text-red-800"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : coaches.length === 0 ? (
        <div className="text-center py-4 bg-white rounded-xl border-2 border-dashed border-gray-300">
          <p className="text-gray-500 text-sm">لا يوجد مدربين متاحين</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-3">
            {coaches.map(coach => (
              <button
                key={coach.id}
                type="button"
                onClick={() => {
                  console.log('✅ تم اختيار المدرب:', coach.name, 'معرف:', coach.id)
                  onChange(coach.id)
                }}
                className={`
                  relative p-3 rounded-lg border-2 transition-all
                  ${value === coach.id
                    ? 'bg-indigo-200 border-indigo-500 shadow-md scale-105'
                    : 'bg-white border-gray-300 hover:border-indigo-400 hover:bg-indigo-50'
                  }
                  ${coach.isCheckedIn ? 'ring-2 ring-green-400' : ''}
                  ${!coach.isActive ? 'opacity-60' : ''}
                `}
              >
                {/* نقطة خضراء للمتواجدين */}
                {coach.isCheckedIn && (
                  <div className="absolute top-1 right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                )}

                <div className="text-center">
                  <div className="text-2xl mb-1">👨‍🏫</div>
                  <div className="font-bold text-sm text-gray-800 mb-1">
                    {coach.name}
                  </div>
                  <div className="text-xs text-gray-600 mb-2">
                    #{coach.staffCode}
                  </div>

                  {/* عدد الأعضاء */}
                  <div className="bg-blue-100 text-blue-800 text-xs font-bold py-1 px-2 rounded-full">
                    {coach.memberCount} عضو
                  </div>

                  {/* علامة غير نشط */}
                  {!coach.isActive && (
                    <div className="mt-1 text-xs text-red-600 font-medium">
                      غير نشط
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* زر إلغاء الاختيار */}
          {value && !required && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition"
            >
              ✕ إلغاء الاختيار
            </button>
          )}

          {/* معلومات المدرب المختار */}
          {selectedCoach && (
            <div className="mt-3 bg-white border-2 border-indigo-300 rounded-lg p-2">
              <p className="text-xs text-gray-600">
                المدرب المختار:
                <span className="font-bold text-indigo-600 mr-1">
                  {selectedCoach.name}
                </span>
                {selectedCoach.isCheckedIn && (
                  <span className="text-green-600 mr-1">● متواجد الآن</span>
                )}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                لديه {selectedCoach.memberCount} عضو مسجل
              </p>
            </div>
          )}

          {/* ملاحظة توضيحية */}
          <div className="mt-3 bg-blue-50 border-l-4 border-blue-500 p-2 rounded">
            <p className="text-xs text-blue-800">
              <strong>💡 ملاحظة:</strong> المدربين المتواجدين حالياً في الجيم محددين باللون الأخضر
            </p>
          </div>
        </>
      )}
    </div>
  )
}

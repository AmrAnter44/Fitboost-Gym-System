'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

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
  const { t } = useLanguage()
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
      setError(t('members.form.failedToLoadCoaches'))
    } finally {
      setLoading(false)
    }
  }

  const selectedCoach = coaches.find(c => c.id === value)

  return (
    <div className="bg-primary-50 dark:bg-primary-900/50 border-2 border-primary-200 dark:border-primary-700 rounded-lg p-3">
      <h3 className="font-bold text-base mb-3 flex items-center gap-2 text-gray-900 dark:text-gray-100">
        <span>👨‍🏫</span>
        <span>{required ? t('members.form.selectCoach') : t('members.form.selectCoachOptional')} {required && <span className="text-red-500 dark:text-red-400">*</span>}</span>
      </h3>

      {loading ? (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">⏳ {t('members.form.loadingCoaches')}</p>
        </div>
      ) : error ? (
        <div className="bg-red-100 dark:bg-red-900/50 border-2 border-red-300 dark:border-red-700 rounded-lg p-3 text-center">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button
            type="button"
            onClick={fetchCoaches}
            className="mt-2 text-xs text-red-600 dark:text-red-400 underline hover:text-red-800 dark:hover:text-red-200"
          >
            {t('members.form.retry')}
          </button>
        </div>
      ) : coaches.length === 0 ? (
        <div className="text-center py-4 bg-white dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
          <p className="text-gray-500 dark:text-gray-400 text-sm">{t('members.form.noCoachesAvailable')}</p>
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
                    ? 'bg-primary-200 dark:bg-primary-800 border-primary-500 dark:border-primary-400 shadow-md scale-105'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/50'
                  }
                  ${coach.isCheckedIn ? 'ring-2 ring-green-400 dark:ring-green-500' : ''}
                  ${!coach.isActive ? 'opacity-60' : ''}
                `}
              >
                {/* نقطة خضراء للمتواجدين */}
                {coach.isCheckedIn && (
                  <div className="absolute top-1 right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                )}

                <div className="text-center">
                  <div className="text-2xl mb-1">👨‍🏫</div>
                  <div className="font-bold text-sm text-gray-800 dark:text-gray-100 mb-1">
                    {coach.name}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                    #{coach.staffCode}
                  </div>

                  {/* عدد الأعضاء */}
                  <div className="bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-200 text-xs font-bold py-1 px-2 rounded-full">
                    {coach.memberCount} {t('members.form.memberCount')}
                  </div>

                  {/* علامة غير نشط */}
                  {!coach.isActive && (
                    <div className="mt-1 text-xs text-red-600 dark:text-red-400 font-medium">
                      {t('members.form.inactive')}
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
              className="w-full py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition"
            >
              ✕ {t('members.form.cancelSelection')}
            </button>
          )}

          {/* معلومات المدرب المختار */}
          {selectedCoach && (
            <div className="mt-3 bg-white dark:bg-gray-800 border-2 border-primary-300 dark:border-primary-700 rounded-lg p-2">
              <p className="text-xs text-gray-600 dark:text-gray-300">
                {t('members.form.selectedCoach')}
                <span className="font-bold text-primary-600 dark:text-primary-400 mr-1">
                  {selectedCoach.name}
                </span>
                {selectedCoach.isCheckedIn && (
                  <span className="text-green-600 dark:text-green-400 mr-1">● {t('members.form.presentNow')}</span>
                )}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('members.form.hasMembers', { count: selectedCoach.memberCount.toString() })}
              </p>
            </div>
          )}

          {/* ملاحظة توضيحية */}
          <div className="mt-3 bg-primary-50 dark:bg-primary-900/50 border-l-4 border-primary-500 dark:border-primary-600 p-2 rounded">
            <p className="text-xs text-primary-800 dark:text-primary-200">
              <strong>💡 {t('common.notes')}:</strong> {t('members.form.coachNote')}
            </p>
          </div>
        </>
      )}
    </div>
  )
}

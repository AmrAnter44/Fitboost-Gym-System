'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

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

function CoachIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg {...stroke} className={className}>
      <circle cx="12" cy="8" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21a8 8 0 0116 0" />
    </svg>
  )
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
    } catch (err) {
      console.error('Error fetching coaches:', err)
      setError(t('members.form.failedToLoadCoaches'))
    } finally {
      setLoading(false)
    }
  }

  const selectedCoach = coaches.find(c => c.id === value)

  return (
    <div className="bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-200 dark:ring-primary-800 rounded-lg p-3">
      <h3 className="font-bold text-base mb-3 flex items-center gap-2 text-gray-900 dark:text-gray-100">
        <CoachIcon className="w-5 h-5 text-primary-700 dark:text-primary-300" />
        <span>{required ? t('members.form.selectCoach') : t('members.form.selectCoachOptional')} {required && <span className="text-red-500 dark:text-red-400">*</span>}</span>
      </h3>

      {loading ? (
        <div className="text-center py-4" aria-busy="true" aria-live="polite">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('members.form.loadingCoaches')}</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/30 ring-1 ring-red-200 dark:ring-red-800 rounded-lg p-3 text-center">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button
            type="button"
            onClick={fetchCoaches}
            className="mt-2 text-xs text-red-700 dark:text-red-300 underline hover:text-red-900 dark:hover:text-red-200 transition-colors duration-200"
          >
            {t('members.form.retry')}
          </button>
        </div>
      ) : coaches.length === 0 ? (
        <div className="text-center py-6 bg-white dark:bg-gray-800 rounded-xl ring-1 ring-dashed ring-gray-300 dark:ring-gray-600">
          <p className="text-gray-600 dark:text-gray-400 text-sm">{t('members.form.noCoachesAvailable')}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-3">
            {coaches.map(coach => (
              <button
                key={coach.id}
                type="button"
                onClick={() => {
                  onChange(coach.id)
                }}
                aria-pressed={value === coach.id}
                className={`
                  relative p-3 rounded-lg ring-1 transition-colors duration-200
                  ${value === coach.id
                    ? 'bg-primary-200 dark:bg-primary-800/60 ring-primary-500 dark:ring-primary-400 shadow-sm'
                    : 'bg-white dark:bg-gray-800 ring-gray-200 dark:ring-gray-700 hover:bg-primary-50 dark:hover:bg-primary-900/40'
                  }
                  ${coach.isCheckedIn ? 'ring-2 ring-green-400 dark:ring-green-500' : ''}
                  ${!coach.isActive ? 'opacity-60' : ''}
                `}
              >
                {coach.isCheckedIn && (
                  <div className="absolute top-1 end-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                )}

                <div className="text-center">
                  <div className="flex justify-center mb-1 text-primary-700 dark:text-primary-300">
                    <CoachIcon className="w-7 h-7" />
                  </div>
                  <div className="font-bold text-sm text-gray-900 dark:text-gray-100 mb-1">
                    {coach.name}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    #{coach.staffCode}
                  </div>

                  <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                    {coach.memberCount} {t('members.form.memberCount')}
                  </div>

                  {!coach.isActive && (
                    <div className="mt-1 text-xs text-red-600 dark:text-red-400 font-medium">
                      {t('members.form.inactive')}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {value && !required && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors duration-200"
            >
              <svg {...stroke} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
              </svg>
              {t('members.form.cancelSelection')}
            </button>
          )}

          {selectedCoach && (
            <div className="mt-3 bg-white dark:bg-gray-800 ring-1 ring-primary-200 dark:ring-primary-800 rounded-lg p-2">
              <p className="text-xs text-gray-700 dark:text-gray-300">
                {t('members.form.selectedCoach')}
                <span className="font-bold text-primary-700 dark:text-primary-400 ms-1">
                  {selectedCoach.name}
                </span>
                {selectedCoach.isCheckedIn && (
                  <span className="text-green-600 dark:text-green-400 ms-1">● {t('members.form.presentNow')}</span>
                )}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {t('members.form.hasMembers', { count: selectedCoach.memberCount.toString() })}
              </p>
            </div>
          )}

          <div className="mt-3 bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-200 dark:ring-primary-800 border-s-4 border-primary-500 dark:border-primary-600 p-2 rounded">
            <p className="text-xs text-primary-800 dark:text-primary-200 inline-flex items-start gap-1.5">
              <svg {...stroke} className="w-4 h-4 mt-0.5 flex-shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span><strong>{t('common.notes')}:</strong> {t('members.form.coachNote')}</span>
            </p>
          </div>
        </>
      )}
    </div>
  )
}

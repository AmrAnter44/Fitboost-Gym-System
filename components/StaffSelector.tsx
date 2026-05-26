'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface Staff {
  id: string
  name: string
  staffCode: string
  position: string
  isActive: boolean
  isCheckedIn: boolean
}

interface StaffSelectorProps {
  serviceType: 'PT' | 'Nutrition' | 'Physiotherapy' | 'GroupClass'
  value: string | null
  onChange: (staffId: string | null) => void
  required?: boolean
}

function UserIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg {...stroke} className={className}>
      <circle cx="12" cy="8" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21a8 8 0 0116 0" />
    </svg>
  )
}

function AlertIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg {...stroke} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.14A2 2 0 003.84 21h16.32a2 2 0 001.73-3l-8.18-14.14a2 2 0 00-3.42 0z" />
    </svg>
  )
}

export default function StaffSelector({ serviceType, value, onChange, required = false }: StaffSelectorProps) {
  const { t } = useLanguage()
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStaff()
  }, [serviceType])

  const fetchStaff = async () => {
    try {
      const response = await fetch('/api/coaches/with-stats')
      const data = await response.json()

      const filtered = data.filter((s: Staff) => {
        const pos = s.position?.toLowerCase() || ''
        switch (serviceType) {
          case 'PT':
            return pos.includes('مدرب') || pos.includes('coach') || pos.includes('كوتش')
          case 'Nutrition':
            return pos.includes('تغذية') || pos.includes('nutrition')
          case 'Physiotherapy':
            return pos.includes('علاج') || pos.includes('physio')
          case 'GroupClass':
            return pos.includes('مدرب') || pos.includes('instructor') || pos.includes('class')
          default:
            return false
        }
      })

      setStaff(filtered.filter((s: Staff) => s.isActive))
    } catch (error) {
      console.error('Error fetching staff:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" aria-busy="true" aria-live="polite"></div>
  }

  if (staff.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-gray-600 dark:text-gray-400">
        <AlertIcon className="w-8 h-8 text-amber-500 mb-2" />
        <p className="text-sm">لا يوجد موظفين متاحين لهذه الخدمة</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {staff.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.id)}
          aria-pressed={value === s.id}
          className={`p-3 rounded-lg ring-1 transition-colors duration-200 text-start ${
            value === s.id
              ? 'ring-primary-500 bg-primary-50 dark:bg-primary-900/30'
              : 'ring-gray-200 dark:ring-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <UserIcon className="w-5 h-5 text-primary-700 dark:text-primary-300" />
            {s.isCheckedIn && (
              <span aria-label="present" className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            )}
          </div>
          <p className="font-bold text-sm text-gray-900 dark:text-gray-100">{s.name}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">#{s.staffCode}</p>
        </button>
      ))}
    </div>
  )
}

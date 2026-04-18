'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

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

      // Filter by service type
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
    return <div className="animate-pulse h-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
  }

  if (staff.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>⚠️ لا يوجد موظفين متاحين لهذه الخدمة</p>
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
          className={`p-3 rounded-lg border-2 transition ${
            value === s.id
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
              : 'border-gray-300 hover:border-primary-300 dark:border-gray-600 dark:hover:border-primary-500'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">👤</span>
            {s.isCheckedIn && (
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            )}
          </div>
          <p className="font-bold text-sm dark:text-white">{s.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">#{s.staffCode}</p>
        </button>
      ))}
    </div>
  )
}

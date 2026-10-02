'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import GroupClassRenewalForm from '../../../components/GroupClassRenewalForm'
import { LoadingScreen } from '../../../components/Spinner'
import { useLanguage } from '../../../contexts/LanguageContext'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface GroupClassSession {
  groupClassNumber: number
  clientName: string
  phone: string
  sessionsPurchased: number
  sessionsRemaining: number
  instructorName: string
  pricePerSession: number
  startDate?: string
  expiryDate?: string
  remainingAmount?: number
}

function GroupClassRenewContent() {
  const { tr, direction } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()
  const groupClassNumber = searchParams.get('groupClassNumber')

  const [session, setSession] = useState<GroupClassSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (groupClassNumber) {
      fetchSession()
    }
  }, [groupClassNumber])

  const fetchSession = async () => {
    try {
      const response = await fetch('/api/group-classes')
      const data: GroupClassSession[] = await response.json()
      const foundSession = data.find(s => s.groupClassNumber === parseInt(groupClassNumber!))

      if (foundSession) {
        setSession(foundSession)
      } else {
        setError(tr('جلسة جروب كلاسيس غير موجودة', 'Group class session not found'))
      }
    } catch (error) {
      console.error('Error:', error)
      setError(tr('حدث خطأ في تحميل البيانات', 'Failed to load data'))
    } finally {
      setLoading(false)
    }
  }

  const handleSuccess = () => {
    router.push('/group-classes')
  }

  const handleClose = () => {
    router.push('/group-classes')
  }

  if (!groupClassNumber) {
    return (
      <div className="container mx-auto p-4 sm:p-6" dir={direction}>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-red-200 dark:ring-red-900/50 p-4 sm:p-8 flex flex-col items-center justify-center text-center">
          <svg {...stroke} className="w-12 h-12 text-red-500" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
          <h2 className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">{tr('رقم GroupClass غير محدد', 'GroupClass number not specified')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-4">{tr('يرجى تحديد رقم GroupClass للتجديد', 'Please specify a GroupClass number to renew')}</p>
          <button
            onClick={() => router.push('/group-classes')}
            className="bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            {tr('العودة لصفحة جروب كلاسيس', 'Back to Group Classes')}
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return <LoadingScreen />
  }

  if (error || !session) {
    return (
      <div className="container mx-auto p-4 sm:p-6" dir={direction}>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-red-200 dark:ring-red-900/50 p-4 sm:p-8 flex flex-col items-center justify-center text-center">
          <svg {...stroke} className="w-12 h-12 text-red-500" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
          <h2 className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">{error || tr('جلسة جروب كلاسيس غير موجودة', 'Group class session not found')}</h2>
          <button
            onClick={() => router.push('/group-classes')}
            className="mt-4 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            {tr('العودة لصفحة جروب كلاسيس', 'Back to Group Classes')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <GroupClassRenewalForm
      session={session}
      onSuccess={handleSuccess}
      onClose={handleClose}
    />
  )
}

export default function GroupClassRenewPage() {
  const { tr } = useLanguage()
  return (
    <Suspense fallback={<div className="container mx-auto p-6 text-center text-sm text-gray-600 dark:text-gray-400">{tr('جاري التحميل...', 'Loading...')}</div>}>
      <GroupClassRenewContent />
    </Suspense>
  )
}

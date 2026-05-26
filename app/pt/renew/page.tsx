'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PTRenewalForm from '../../../components/PTRenewalForm'
import { LoadingScreen } from '../../../components/Spinner'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface PTSession {
  ptNumber: number
  clientName: string
  phone: string
  sessionsPurchased: number
  sessionsRemaining: number
  coachName: string
  pricePerSession: number
  startDate?: string
  expiryDate?: string
  remainingAmount?: number
}

function PTRenewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const ptNumber = searchParams.get('ptNumber')

  const [session, setSession] = useState<PTSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (ptNumber) {
      fetchSession()
    }
  }, [ptNumber])

  const fetchSession = async () => {
    try {
      const response = await fetch('/api/pt')
      const data: PTSession[] = await response.json()
      const foundSession = data.find(s => s.ptNumber === parseInt(ptNumber!))

      if (foundSession) {
        setSession(foundSession)
      } else {
        setError('جلسة PT غير موجودة')
      }
    } catch (error) {
      console.error('Error:', error)
      setError('حدث خطأ في تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }

  const handleSuccess = () => {
    router.push('/pt')
  }

  const handleClose = () => {
    router.push('/pt')
  }

  if (!ptNumber) {
    return (
      <div className="container mx-auto p-6" dir="rtl">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-red-200 dark:ring-red-900/50 p-8 flex flex-col items-center justify-center text-center">
          <svg {...stroke} className="w-12 h-12 text-red-500" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
          <h2 className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">رقم PT غير محدد</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-4">يرجى تحديد رقم PT للتجديد</p>
          <button
            onClick={() => router.push('/pt')}
            className="bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            العودة لصفحة PT
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
      <div className="container mx-auto p-6" dir="rtl">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-red-200 dark:ring-red-900/50 p-8 flex flex-col items-center justify-center text-center">
          <svg {...stroke} className="w-12 h-12 text-red-500" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
          <h2 className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">{error || 'جلسة PT غير موجودة'}</h2>
          <button
            onClick={() => router.push('/pt')}
            className="mt-4 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            العودة لصفحة PT
          </button>
        </div>
      </div>
    )
  }

  return (
    <PTRenewalForm
      session={session}
      onSuccess={handleSuccess}
      onClose={handleClose}
    />
  )
}

export default function PTRenewPage() {
  return (
    <Suspense fallback={<div className="container mx-auto p-6 text-center text-sm text-gray-600 dark:text-gray-400">جاري التحميل...</div>}>
      <PTRenewContent />
    </Suspense>
  )
}

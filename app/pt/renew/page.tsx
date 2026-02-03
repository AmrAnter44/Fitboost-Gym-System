'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PTRenewalForm from '../../../components/PTRenewalForm'

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
      <div className="container mx-auto p-6 text-center" dir="rtl">
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-8">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold mb-2">رقم PT غير محدد</h2>
          <p className="text-gray-600 mb-4">يرجى تحديد رقم PT للتجديد</p>
          <button
            onClick={() => router.push('/pt')}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
          >
            العودة لصفحة PT
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 text-center" dir="rtl">
        <div className="text-6xl mb-4">⏳</div>
        <p className="text-xl text-gray-600">جاري التحميل...</p>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="container mx-auto p-6 text-center" dir="rtl">
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-8">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold mb-2">{error || 'جلسة PT غير موجودة'}</h2>
          <button
            onClick={() => router.push('/pt')}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
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
    <Suspense fallback={<div className="container mx-auto p-6 text-center">جاري التحميل...</div>}>
      <PTRenewContent />
    </Suspense>
  )
}
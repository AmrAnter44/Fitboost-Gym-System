'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PhysiotherapyRenewalForm from '../../../components/PhysiotherapyRenewalForm'

interface PhysiotherapySession {
  physioNumber: number
  clientName: string
  phone: string
  sessionsPurchased: number
  sessionsRemaining: number
  therapistName: string
  pricePerSession: number
  startDate?: string
  expiryDate?: string
}

function PhysiotherapyRenewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const physioNumber = searchParams.get('physioNumber')

  const [session, setSession] = useState<PhysiotherapySession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (physioNumber) {
      fetchSession()
    }
  }, [physioNumber])

  const fetchSession = async () => {
    try {
      const response = await fetch('/api/physiotherapy')
      const data: PhysiotherapySession[] = await response.json()
      const foundSession = data.find(s => s.physioNumber === parseInt(physioNumber!))

      if (foundSession) {
        setSession(foundSession)
      } else {
        setError('جلسة العلاج الطبيعي غير موجودة')
      }
    } catch (error) {
      console.error('Error:', error)
      setError('حدث خطأ في تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }

  const handleSuccess = () => {
    router.push('/physiotherapy')
  }

  const handleClose = () => {
    router.push('/physiotherapy')
  }

  if (!physioNumber) {
    return (
      <div className="container mx-auto p-6 text-center" dir="rtl">
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-8">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold mb-2">رقم Physiotherapy غير محدد</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">يرجى تحديد رقم Physiotherapy للتجديد</p>
          <button
            onClick={() => router.push('/physiotherapy')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            العودة لصفحة العلاج الطبيعي
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 text-center" dir="rtl">
        <div className="text-6xl mb-4">⏳</div>
        <p className="text-xl text-gray-600 dark:text-gray-300">جاري التحميل...</p>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="container mx-auto p-6 text-center" dir="rtl">
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-8">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold mb-2">{error || 'جلسة العلاج الطبيعي غير موجودة'}</h2>
          <button
            onClick={() => router.push('/physiotherapy')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            العودة لصفحة العلاج الطبيعي
          </button>
        </div>
      </div>
    )
  }

  return (
    <PhysiotherapyRenewalForm
      session={session}
      onSuccess={handleSuccess}
      onClose={handleClose}
    />
  )
}

export default function PhysiotherapyRenewPage() {
  return (
    <Suspense fallback={<div className="container mx-auto p-6 text-center">جاري التحميل...</div>}>
      <PhysiotherapyRenewContent />
    </Suspense>
  )
}

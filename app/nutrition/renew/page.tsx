'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import NutritionRenewalForm from '../../../components/NutritionRenewalForm'

interface NutritionSession {
  nutritionNumber: number
  clientName: string
  phone: string
  sessionsPurchased: number
  sessionsRemaining: number
  nutritionistName: string
  pricePerSession: number
  startDate?: string
  expiryDate?: string
}

function NutritionRenewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nutritionNumber = searchParams.get('nutritionNumber')

  const [session, setSession] = useState<NutritionSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (nutritionNumber) {
      fetchSession()
    }
  }, [nutritionNumber])

  const fetchSession = async () => {
    try {
      const response = await fetch('/api/nutrition')
      const data: NutritionSession[] = await response.json()
      const foundSession = data.find(s => s.nutritionNumber === parseInt(nutritionNumber!))

      if (foundSession) {
        setSession(foundSession)
      } else {
        setError('جلسة التغذية غير موجودة')
      }
    } catch (error) {
      console.error('Error:', error)
      setError('حدث خطأ في تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }

  const handleSuccess = () => {
    router.push('/nutrition')
  }

  const handleClose = () => {
    router.push('/nutrition')
  }

  if (!nutritionNumber) {
    return (
      <div className="container mx-auto p-6 text-center" dir="rtl">
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-8">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold mb-2">رقم Nutrition غير محدد</h2>
          <p className="text-gray-600 mb-4">يرجى تحديد رقم Nutrition للتجديد</p>
          <button
            onClick={() => router.push('/nutrition')}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
          >
            العودة لصفحة التغذية
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
          <h2 className="text-2xl font-bold mb-2">{error || 'جلسة التغذية غير موجودة'}</h2>
          <button
            onClick={() => router.push('/nutrition')}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
          >
            العودة لصفحة التغذية
          </button>
        </div>
      </div>
    )
  }

  return (
    <NutritionRenewalForm
      session={session}
      onSuccess={handleSuccess}
      onClose={handleClose}
    />
  )
}

export default function NutritionRenewPage() {
  return (
    <Suspense fallback={<div className="container mx-auto p-6 text-center">جاري التحميل...</div>}>
      <NutritionRenewContent />
    </Suspense>
  )
}

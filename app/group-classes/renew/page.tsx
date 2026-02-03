'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import GroupClassRenewalForm from '../../../components/GroupClassRenewalForm'

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
}

function GroupClassRenewContent() {
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
      const response = await fetch('/api/groupClass')
      const data: GroupClassSession[] = await response.json()
      const foundSession = data.find(s => s.groupClassNumber === parseInt(groupClassNumber!))

      if (foundSession) {
        setSession(foundSession)
      } else {
        setError('جلسة جروب كلاسيس غير موجودة')
      }
    } catch (error) {
      console.error('Error:', error)
      setError('حدث خطأ في تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }

  const handleSuccess = () => {
    router.push('/groupClass')
  }

  const handleClose = () => {
    router.push('/groupClass')
  }

  if (!groupClassNumber) {
    return (
      <div className="container mx-auto p-6 text-center" dir="rtl">
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-8">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold mb-2">رقم GroupClass غير محدد</h2>
          <p className="text-gray-600 mb-4">يرجى تحديد رقم GroupClass للتجديد</p>
          <button
            onClick={() => router.push('/groupClass')}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
          >
            العودة لصفحة جروب كلاسيس
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
          <h2 className="text-2xl font-bold mb-2">{error || 'جلسة جروب كلاسيس غير موجودة'}</h2>
          <button
            onClick={() => router.push('/groupClass')}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
          >
            العودة لصفحة جروب كلاسيس
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
  return (
    <Suspense fallback={<div className="container mx-auto p-6 text-center">جاري التحميل...</div>}>
      <GroupClassRenewContent />
    </Suspense>
  )
}

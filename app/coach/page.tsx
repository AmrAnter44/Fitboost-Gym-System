'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface PTData {
  ptNumber: number
  clientName: string
  phone: string
  sessionsPurchased: number
  sessionsRemaining: number
  coachName: string
  pricePerSession: number
  startDate: string | null
  expiryDate: string | null
  remainingAmount: number | null
  sessions: PTSessionData[]
}

interface PTSessionData {
  id: string
  sessionDate: string
  attended: boolean
  attendedAt: string | null
  notes: string | null
}

export default function CoachDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [myPTs, setMyPTs] = useState<PTData[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [user, setUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'active' | 'expired'>('active')

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me')

      if (!response.ok) {
        console.error('Authentication failed, redirecting to login')
        router.push('/login')
        return
      }

      const data = await response.json()
      console.log('User data:', data.user)
      setUser(data.user)

      // Check if user is COACH
      if (data.user.role !== 'COACH') {
        console.warn('User is not COACH, redirecting to home')
        // سيتم redirect مباشرة دون عرض رسالة لأن الصفحة محمية
        router.push('/')
        return
      }

      // Fetch coach's PT subscriptions
      if (data.user.id) {
        fetchMyPTs(data.user.id)
      }
    } catch (error) {
      console.error('Error checking authentication:', error)
      router.push('/login')
    }
  }

  const fetchMyPTs = async (userId: string) => {
    try {
      setLoading(true)

      console.log('🔍 Fetching PTs for coach userId:', userId)

      // Fetch PTs for this coach - API will automatically filter by user.userId from token
      const response = await fetch('/api/pt')
      if (response.ok) {
        const data = await response.json()
        console.log('✅ PTs fetched:', data.length, 'records')
        console.log('PTs data:', data)
        setMyPTs(data)
      } else {
        console.error('❌ Failed to fetch PTs:', response.status)
      }
    } catch (error) {
      console.error('Error fetching PTs:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter PTs based on active/expired status
  const activePTs = myPTs.filter(pt => {
    if (!pt.expiryDate) return true
    return new Date(pt.expiryDate) >= new Date()
  })

  const expiredPTs = myPTs.filter(pt => {
    if (!pt.expiryDate) return false
    return new Date(pt.expiryDate) < new Date()
  })

  const currentPTs = activeTab === 'active' ? activePTs : expiredPTs

  const filteredPTs = currentPTs.filter((pt) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      pt.clientName.toLowerCase().includes(searchLower) ||
      pt.phone?.toLowerCase().includes(searchLower) ||
      pt.ptNumber?.toString().includes(searchLower)
    )
  })

  // Calculate total stats
  const totalActiveSessions = activePTs.reduce((sum, pt) => sum + pt.sessionsRemaining, 0)
  const totalCompletedSessions = activePTs.reduce((sum, pt) => sum + (pt.sessionsPurchased - pt.sessionsRemaining), 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-2xl">جاري التحميل...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-900 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">👋 مرحباً {user?.name}</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">لوحة تحكم المدرب - حصص PT</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-300 text-sm">اشتراكات نشطة</p>
                <p className="text-3xl font-bold text-green-600">{activePTs.length}</p>
              </div>
              <div className="text-5xl">✅</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-300 text-sm">حصص متبقية</p>
                <p className="text-3xl font-bold text-orange-600">{totalActiveSessions}</p>
              </div>
              <div className="text-5xl">⏳</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-300 text-sm">حصص مكتملة</p>
                <p className="text-3xl font-bold text-primary-600">{totalCompletedSessions}</p>
              </div>
              <div className="text-5xl">💪</div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="🔍 ابحث عن عضو (الاسم، الهاتف، رقم PT)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-6 py-4 border-2 border-gray-300 dark:border-gray-600 rounded-xl text-lg focus:border-primary-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 mb-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('active')}
              className={`flex-1 py-3 rounded-lg font-bold text-lg ${
                activeTab === 'active'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700 dark:text-gray-200 hover:bg-gray-300'
              }`}
            >
              ✅ نشط ({activePTs.length})
            </button>
            <button
              onClick={() => setActiveTab('expired')}
              className={`flex-1 py-3 rounded-lg font-bold text-lg ${
                activeTab === 'expired'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-200 text-gray-700 dark:text-gray-200 hover:bg-gray-300'
              }`}
            >
              ⏰ منتهي ({expiredPTs.length})
            </button>
          </div>
        </div>

        {/* PTs List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6">
          <h2 className="text-2xl font-bold mb-6">
            {activeTab === 'active' ? '✅ اشتراكات نشطة' : '⏰ اشتراكات منتهية'} ({filteredPTs.length})
          </h2>

          {filteredPTs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl text-gray-500 dark:text-gray-400 dark:text-gray-500">
                {activeTab === 'active' ? 'لا توجد اشتراكات نشطة' : 'لا توجد اشتراكات منتهية'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPTs.map((pt) => {
                const usedSessions = pt.sessionsPurchased - pt.sessionsRemaining
                const progressPercentage = (usedSessions / pt.sessionsPurchased) * 100
                const isExpired = pt.expiryDate && new Date(pt.expiryDate) < new Date()

                return (
                  <div
                    key={pt.ptNumber}
                    className={`border-2 rounded-xl p-4 hover:shadow-lg transition-all ${
                      isExpired ? 'border-red-300 bg-red-50' : 'border-primary-300 bg-primary-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{pt.clientName}</h3>
                        <p className="text-gray-600 dark:text-gray-300 text-sm">رقم PT: #{pt.ptNumber}</p>
                        {pt.phone && (
                          <p className="text-gray-600 dark:text-gray-300 text-sm">📱 {pt.phone}</p>
                        )}
                      </div>
                      {isExpired ? (
                        <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap">
                          ⏰ منتهي
                        </span>
                      ) : (
                        <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap">
                          ✅ نشط
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300 mb-1">
                        <span>الحصص المستخدمة: {usedSessions} / {pt.sessionsPurchased}</span>
                        <span>{Math.round(progressPercentage)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            progressPercentage >= 80 ? 'bg-red-500' :
                            progressPercentage >= 50 ? 'bg-orange-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${progressPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div className="bg-white dark:bg-gray-800 rounded p-2">
                        <p className="text-gray-600 dark:text-gray-300">متبقي</p>
                        <p className="font-bold text-orange-600">{pt.sessionsRemaining} حصة</p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded p-2">
                        <p className="text-gray-600 dark:text-gray-300">السعر/حصة</p>
                        <p className="font-bold text-green-600">{pt.pricePerSession} ج.م</p>
                      </div>
                      {pt.startDate && (
                        <div className="bg-white dark:bg-gray-800 rounded p-2">
                          <p className="text-gray-600 dark:text-gray-300">البداية</p>
                          <p className="font-bold">{new Date(pt.startDate).toLocaleDateString('ar-EG')}</p>
                        </div>
                      )}
                      {pt.expiryDate && (
                        <div className="bg-white dark:bg-gray-800 rounded p-2">
                          <p className="text-gray-600 dark:text-gray-300">الانتهاء</p>
                          <p className={`font-bold ${isExpired ? 'text-red-600' : ''}`}>
                            {new Date(pt.expiryDate).toLocaleDateString('ar-EG')}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Remaining Amount */}
                    {pt.remainingAmount !== null && pt.remainingAmount > 0 && (
                      <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-2 mb-3">
                        <p className="text-xs text-yellow-800 font-bold">
                          💰 المبلغ المتبقي: {pt.remainingAmount} ج.م
                        </p>
                      </div>
                    )}

                    {/* Sessions History */}
                    {pt.sessions && pt.sessions.length > 0 && (
                      <div className="border-t pt-3 mt-3">
                        <p className="text-xs text-gray-600 dark:text-gray-300 font-bold mb-2">
                          📅 آخر الحصص ({pt.sessions.length})
                        </p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {pt.sessions.slice(0, 3).map((session) => (
                            <div key={session.id} className="bg-white dark:bg-gray-800 rounded p-2 text-xs flex justify-between items-center">
                              <span>{new Date(session.sessionDate).toLocaleDateString('ar-EG')}</span>
                              {session.attended ? (
                                <span className="text-green-600 font-bold">✅ حضر</span>
                              ) : (
                                <span className="text-orange-600 font-bold">⏳ مسجل</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

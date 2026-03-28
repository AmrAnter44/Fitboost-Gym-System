'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import nextDynamic from 'next/dynamic'
import { useDebounce } from '../../hooks/useDebounce'
import { useLanguage } from '../../contexts/LanguageContext'

const SignaturePad = nextDynamic(() => import('../../components/SignaturePad'), { ssr: false })

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

interface CheckedInClient {
  phone: string
  name: string
  checkInTime: string
}

export default function CoachDashboard() {
  const router = useRouter()
  const { t, locale } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [myPTs, setMyPTs] = useState<PTData[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [user, setUser] = useState<any>(null)
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [activeTab, setActiveTab] = useState<'active' | 'expired'>('active')
  const [checkedInPhones, setCheckedInPhones] = useState<Set<string>>(new Set())
  const [checkedInClients, setCheckedInClients] = useState<CheckedInClient[]>([])
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [selectedPTForSession, setSelectedPTForSession] = useState<PTData | null>(null)
  const [registeringSession, setRegisteringSession] = useState(false)
  const [sessionMessage, setSessionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const dateLocale = locale === 'ar' ? 'ar-EG' : 'en-US'

  useEffect(() => {
    checkAuth()
  }, [])

  // تحديث بيانات التشيك ان كل 30 ثانية
  useEffect(() => {
    if (!user || user.role !== 'COACH') return
    fetchClientCheckIns()
    const interval = setInterval(fetchClientCheckIns, 30000)
    return () => clearInterval(interval)
  }, [user])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me')

      if (!response.ok) {
        router.push('/login')
        return
      }

      const data = await response.json()
      setUser(data.user)

      if (data.user.role !== 'COACH') {
        router.push('/')
        return
      }

      if (data.user.userId || data.user.id) {
        fetchMyPTs(data.user.userId || data.user.id)
      } else {
        setLoading(false)
      }
    } catch (error) {
      console.error('Error checking authentication:', error)
      router.push('/login')
    }
  }

  const fetchMyPTs = async (userId: string) => {
    try {
      setLoading(true)
      const response = await fetch('/api/pt')
      if (response.ok) {
        const data = await response.json()
        setMyPTs(data)
      }
    } catch (error) {
      console.error('Error fetching PTs:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchClientCheckIns = async () => {
    try {
      const response = await fetch('/api/coach/client-checkins')
      if (response.ok) {
        const data = await response.json()
        const clients: CheckedInClient[] = data.checkedInClients || []
        setCheckedInClients(clients)
        setCheckedInPhones(new Set(clients.map(c => c.phone)))
      }
    } catch (error) {
      console.error('Error fetching client check-ins:', error)
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
    const searchLower = debouncedSearchTerm.toLowerCase()
    return (
      pt.clientName.toLowerCase().includes(searchLower) ||
      pt.phone?.toLowerCase().includes(searchLower) ||
      pt.ptNumber?.toString().includes(searchLower)
    )
  })

  // Calculate total stats
  const totalActiveSessions = activePTs.reduce((sum, pt) => sum + pt.sessionsRemaining, 0)
  const totalCompletedSessions = activePTs.reduce((sum, pt) => sum + (pt.sessionsPurchased - pt.sessionsRemaining), 0)

  // Count today's sessions
  const todayStr = new Date().toDateString()
  const todaySessions = myPTs.reduce((count, pt) => {
    return count + (pt.sessions?.filter(s =>
      new Date(s.sessionDate).toDateString() === todayStr
    ).length || 0)
  }, 0)

  // عدد العملاء الموجودين في الجيم
  const clientsInGym = activePTs.filter(pt => pt.phone && checkedInPhones.has(pt.phone)).length

  const openSignatureModal = useCallback((pt: PTData) => {
    setSelectedPTForSession(pt)
    setShowSignatureModal(true)
    setSessionMessage(null)
  }, [])

  const handleSignatureConfirm = useCallback(async (signatureDataUrl: string) => {
    if (!selectedPTForSession) return
    setRegisteringSession(true)
    try {
      const res = await fetch('/api/pt/sessions/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ptNumber: selectedPTForSession.ptNumber,
          signature: signatureDataUrl
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        // تحديث البيانات محلياً
        setMyPTs(prev => prev.map(pt =>
          pt.ptNumber === selectedPTForSession.ptNumber
            ? { ...pt, sessionsRemaining: pt.sessionsRemaining - 1 }
            : pt
        ))
        setShowSignatureModal(false)
        setSelectedPTForSession(null)
        setSessionMessage({ type: 'success', text: `تم تسجيل حصة ${selectedPTForSession.clientName} بنجاح ✅` })
        setTimeout(() => setSessionMessage(null), 4000)
      } else {
        setSessionMessage({ type: 'error', text: data.error || 'فشل تسجيل الحصة' })
        setShowSignatureModal(false)
      }
    } catch {
      setSessionMessage({ type: 'error', text: 'حدث خطأ في الاتصال' })
      setShowSignatureModal(false)
    } finally {
      setRegisteringSession(false)
    }
  }, [selectedPTForSession])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-white text-2xl">{t('coachDashboard.loading')}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
              👋 {t('coachDashboard.welcome', { name: user?.name || '' })}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">{t('coachDashboard.subtitle')}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              {t('coachDashboard.quickActions')}
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Link
              href="/pt"
              className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-800/30 hover:from-primary-500 hover:to-primary-600 text-gray-800 dark:text-gray-100 hover:text-white p-4 rounded-xl shadow-md hover:shadow-xl transition-all transform hover:scale-105 active:scale-95 flex flex-col items-center gap-2 border-2 border-primary-200 dark:border-primary-700"
            >
              <span className="text-3xl">💪</span>
              <span className="font-bold text-sm text-center">{t('coachDashboard.viewPT')}</span>
            </Link>

            <Link
              href="/pt/commission"
              className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 hover:from-green-500 hover:to-green-600 text-gray-800 dark:text-gray-100 hover:text-white p-4 rounded-xl shadow-md hover:shadow-xl transition-all transform hover:scale-105 active:scale-95 flex flex-col items-center gap-2 border-2 border-green-200 dark:border-green-700"
            >
              <span className="text-3xl">💰</span>
              <span className="font-bold text-sm text-center">{t('coachDashboard.viewCommission')}</span>
            </Link>

            <Link
              href="/pt/sessions/history"
              className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 hover:from-blue-500 hover:to-blue-600 text-gray-800 dark:text-gray-100 hover:text-white p-4 rounded-xl shadow-md hover:shadow-xl transition-all transform hover:scale-105 active:scale-95 flex flex-col items-center gap-2 border-2 border-blue-200 dark:border-blue-700"
            >
              <span className="text-3xl">📋</span>
              <span className="font-bold text-sm text-center">{t('coachDashboard.sessionHistory')}</span>
            </Link>

          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm">{t('coachDashboard.activeSubscriptions')}</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-600">{activePTs.length}</p>
              </div>
              <div className="text-3xl sm:text-5xl">✅</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm">{t('coachDashboard.remainingSessions')}</p>
                <p className="text-2xl sm:text-3xl font-bold text-orange-600">{totalActiveSessions}</p>
              </div>
              <div className="text-3xl sm:text-5xl">⏳</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm">{t('coachDashboard.completedSessions')}</p>
                <p className="text-2xl sm:text-3xl font-bold text-primary-600">{totalCompletedSessions}</p>
              </div>
              <div className="text-3xl sm:text-5xl">💪</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm">{t('coachDashboard.todaySessions')}</p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-600">{todaySessions}</p>
              </div>
              <div className="text-3xl sm:text-5xl">📅</div>
            </div>
          </div>
        </div>

        {/* Clients In Gym Alert */}
        {clientsInGym > 0 && (
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 dark:from-green-600 dark:to-emerald-700 text-white rounded-2xl shadow-2xl p-4 sm:p-6 mb-6 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl sm:text-4xl">🏋️</span>
                <div>
                  <p className="font-bold text-lg sm:text-xl">{t('coachDashboard.clientsInGym', { count: clientsInGym.toString() })}</p>
                  <p className="text-green-100 text-xs sm:text-sm">{t('coachDashboard.checkedInLastHour')}</p>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {checkedInClients.slice(0, 3).map((client, idx) => (
                  <span key={idx} className="bg-white/20 px-2 py-0.5 rounded text-xs font-medium">
                    {client.name}
                  </span>
                ))}
                {checkedInClients.length > 3 && (
                  <span className="text-green-100 text-xs">+{checkedInClients.length - 3}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder={`🔍 ${t('coachDashboard.searchPlaceholder')}`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-6 py-4 border-2 border-gray-300 dark:border-gray-600 rounded-xl text-lg focus:border-primary-500 focus:outline-none dark:bg-gray-700 dark:text-white"
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
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              ✅ {t('coachDashboard.activeTab', { count: activePTs.length.toString() })}
            </button>
            <button
              onClick={() => setActiveTab('expired')}
              className={`flex-1 py-3 rounded-lg font-bold text-lg ${
                activeTab === 'expired'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              ⏰ {t('coachDashboard.expiredTab', { count: expiredPTs.length.toString() })}
            </button>
          </div>
        </div>

        {/* PTs List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6">
          <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100">
            {activeTab === 'active'
              ? `✅ ${t('coachDashboard.activeSubscriptionsTitle')}`
              : `⏰ ${t('coachDashboard.expiredSubscriptionsTitle')}`
            } ({filteredPTs.length})
          </h2>

          {filteredPTs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl text-gray-500 dark:text-gray-400">
                {activeTab === 'active'
                  ? t('coachDashboard.noActiveSubscriptions')
                  : t('coachDashboard.noExpiredSubscriptions')
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPTs.map((pt) => {
                const usedSessions = pt.sessionsPurchased - pt.sessionsRemaining
                const progressPercentage = (usedSessions / pt.sessionsPurchased) * 100
                const isExpired = pt.expiryDate && new Date(pt.expiryDate) < new Date()
                const isCheckedIn = pt.phone && checkedInPhones.has(pt.phone)
                const checkInInfo = isCheckedIn ? checkedInClients.find(c => c.phone === pt.phone) : null

                return (
                  <div
                    key={pt.ptNumber}
                    className={`border-2 rounded-xl p-4 hover:shadow-lg transition-all relative ${
                      isCheckedIn
                        ? 'border-green-400 bg-green-50 dark:border-green-500 dark:bg-green-900/30 ring-2 ring-green-300 dark:ring-green-600'
                        : isExpired
                          ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
                          : 'border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/20'
                    }`}
                  >
                    {/* Check-in Badge */}
                    {isCheckedIn && (
                      <div className="bg-green-500 dark:bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg mb-3 flex items-center gap-2 animate-pulse">
                        <span>🏋️</span>
                        <span>{t('coachDashboard.clientInGymNow')}</span>
                        {checkInInfo && (
                          <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">
                            {new Date(checkInInfo.checkInTime).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{pt.clientName}</h3>
                        <p className="text-gray-600 dark:text-gray-300 text-sm">{t('coachDashboard.ptNumber')}: #{pt.ptNumber}</p>
                        {pt.phone && (
                          <p className="text-gray-600 dark:text-gray-300 text-sm">📱 {pt.phone}</p>
                        )}
                      </div>
                      {isExpired ? (
                        <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap">
                          ⏰ {t('coachDashboard.expired')}
                        </span>
                      ) : (
                        <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap">
                          ✅ {t('coachDashboard.active')}
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300 mb-1">
                        <span>{t('coachDashboard.usedSessions')}: {usedSessions} / {pt.sessionsPurchased}</span>
                        <span>{Math.round(progressPercentage)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
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
                        <p className="text-gray-600 dark:text-gray-300">{t('coachDashboard.remaining')}</p>
                        <p className="font-bold text-orange-600">{pt.sessionsRemaining} {t('coachDashboard.session')}</p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded p-2">
                        <p className="text-gray-600 dark:text-gray-300">{t('coachDashboard.pricePerSession')}</p>
                        <p className="font-bold text-green-600">{pt.pricePerSession} {t('coachDashboard.egp')}</p>
                      </div>
                      {pt.startDate && (
                        <div className="bg-white dark:bg-gray-800 rounded p-2">
                          <p className="text-gray-600 dark:text-gray-300">{t('coachDashboard.startDate')}</p>
                          <p className="font-bold">{new Date(pt.startDate).toLocaleDateString(dateLocale)}</p>
                        </div>
                      )}
                      {pt.expiryDate && (
                        <div className="bg-white dark:bg-gray-800 rounded p-2">
                          <p className="text-gray-600 dark:text-gray-300">{t('coachDashboard.endDate')}</p>
                          <p className={`font-bold ${isExpired ? 'text-red-600' : ''}`}>
                            {new Date(pt.expiryDate).toLocaleDateString(dateLocale)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Remaining Amount */}
                    {pt.remainingAmount !== null && pt.remainingAmount > 0 && (
                      <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-2 mb-3 dark:border-yellow-600 dark:bg-yellow-900/20 dark:text-white">
                        <p className="text-xs text-yellow-800 dark:text-yellow-200 font-bold">
                          💰 {t('coachDashboard.remainingAmount')}: {pt.remainingAmount} {t('coachDashboard.egp')}
                        </p>
                      </div>
                    )}

                    {/* زر تسجيل حصة بالإمضاء */}
                    <button
                      onClick={() => openSignatureModal(pt)}
                      disabled={pt.sessionsRemaining <= 0}
                      className={`w-full py-3 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 mb-3 ${
                        pt.sessionsRemaining <= 0
                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-primary-600 to-primary-700 text-white hover:from-primary-700 hover:to-primary-800 shadow-lg hover:shadow-xl active:scale-95'
                      }`}
                    >
                      ✍️ {t('coachDashboard.registerSession') || 'تسجيل حصة'}
                    </button>

                    {/* Sessions History */}
                    {pt.sessions && pt.sessions.length > 0 && (
                      <div className="border-t dark:border-gray-600 pt-3 mt-3">
                        <p className="text-xs text-gray-600 dark:text-gray-300 font-bold mb-2">
                          📅 {t('coachDashboard.recentSessions')} ({pt.sessions.length})
                        </p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {pt.sessions.slice(0, 3).map((session) => (
                            <div key={session.id} className="bg-white dark:bg-gray-700 rounded p-2 text-xs flex justify-between items-center">
                              <span className="text-gray-800 dark:text-gray-200">{new Date(session.sessionDate).toLocaleDateString(dateLocale)}</span>
                              {session.attended ? (
                                <span className="text-green-600 dark:text-green-400 font-bold">✅ {t('coachDashboard.attended')}</span>
                              ) : (
                                <span className="text-orange-600 dark:text-orange-400 font-bold">⏳ {t('coachDashboard.registered')}</span>
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

      {/* SignaturePad Modal */}
      {showSignatureModal && selectedPTForSession && (
        <SignaturePad
          title={`تسجيل حصة - ${selectedPTForSession.clientName}`}
          subtitle={`الحصص المتبقية: ${selectedPTForSession.sessionsRemaining} من ${selectedPTForSession.sessionsPurchased}`}
          onConfirm={handleSignatureConfirm}
          onCancel={() => {
            setShowSignatureModal(false)
            setSelectedPTForSession(null)
          }}
        />
      )}

      {/* Session Message Toast */}
      {sessionMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className={`px-6 py-3 rounded-xl shadow-2xl font-bold text-white ${
            sessionMessage.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}>
            {sessionMessage.text}
          </div>
        </div>
      )}
    </div>
  )
}

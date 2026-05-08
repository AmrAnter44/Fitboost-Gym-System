'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import nextDynamic from 'next/dynamic'
import { useDebounce } from '../../../hooks/useDebounce'
import { useLanguage } from '../../../contexts/LanguageContext'

const SignaturePad = nextDynamic(() => import('../../../components/SignaturePad'), { ssr: false })

interface MoreSubscription {
  moreNumber: number
  clientName: string
  phone: string
  sessionsPurchased: number
  sessionsRemaining: number
  coachName: string
  pricePerSession: number
  totalAmount: number
  startDate: string | null
  expiryDate: string | null
  remainingAmount: number
  isActive: boolean
}

export default function CoachMorePage() {
  const router = useRouter()
  const { t, locale } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [myMore, setMyMore] = useState<MoreSubscription[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [activeTab, setActiveTab] = useState<'active' | 'expired'>('active')
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [selectedMore, setSelectedMore] = useState<MoreSubscription | null>(null)
  const [registering, setRegistering] = useState(false)
  const [sessionMessage, setSessionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const dateLocale = locale === 'ar' ? 'ar-EG' : 'en-US'

  useEffect(() => {
    checkAuth()
  }, [])

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
      fetchMyMore()
    } catch {
      router.push('/login')
    }
  }

  const fetchMyMore = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/coach/my-more')
      if (response.ok) {
        const data = await response.json()
        setMyMore(data)
      }
    } catch (error) {
      console.error('Error fetching More subscriptions:', error)
    } finally {
      setLoading(false)
    }
  }

  const activeMore = myMore.filter(m => {
    if (!m.expiryDate) return true
    return new Date(m.expiryDate) >= new Date()
  })

  const expiredMore = myMore.filter(m => {
    if (!m.expiryDate) return false
    return new Date(m.expiryDate) < new Date()
  })

  const currentMore = activeTab === 'active' ? activeMore : expiredMore

  const filteredMore = currentMore.filter((m) => {
    const searchLower = debouncedSearchTerm.toLowerCase()
    return (
      m.clientName.toLowerCase().includes(searchLower) ||
      m.phone?.toLowerCase().includes(searchLower) ||
      m.moreNumber?.toString().includes(searchLower)
    )
  })

  const totalActiveSessions = activeMore.reduce((sum, m) => sum + m.sessionsRemaining, 0)

  const openSignatureModal = useCallback((m: MoreSubscription) => {
    setSelectedMore(m)
    setShowSignatureModal(true)
    setSessionMessage(null)
  }, [])

  const handleSignatureConfirm = useCallback(async (signatureDataUrl: string) => {
    if (!selectedMore) return
    setRegistering(true)
    try {
      const res = await fetch('/api/coach/register-more-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moreNumber: selectedMore.moreNumber,
          signature: signatureDataUrl,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setMyMore(prev => prev.map(m =>
          m.moreNumber === selectedMore.moreNumber
            ? { ...m, sessionsRemaining: m.sessionsRemaining - 1 }
            : m
        ))
        setShowSignatureModal(false)
        setSelectedMore(null)
        setSessionMessage({ type: 'success', text: `تم تسجيل حصة ${selectedMore.clientName} بنجاح ✅` })
        setTimeout(() => setSessionMessage(null), 4000)
      } else {
        setSessionMessage({ type: 'error', text: data.error || 'فشل تسجيل الحصة' })
        setShowSignatureModal(false)
      }
    } catch {
      setSessionMessage({ type: 'error', text: 'حدث خطأ في الاتصال' })
      setShowSignatureModal(false)
    } finally {
      setRegistering(false)
    }
  }, [selectedMore])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-700 dark:text-white text-2xl">{t('coachDashboard.loading') || 'جاري التحميل...'}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
            ➕ {locale === 'ar' ? 'اشتراكات More' : 'My More Subscriptions'}
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            {locale === 'ar'
              ? 'كل اشتراكات More اللي معيّن عليها'
              : 'All More subscriptions assigned to you'}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              {locale === 'ar' ? 'إجمالي الاشتراكات' : 'Total Subscriptions'}
            </p>
            <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{myMore.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              {locale === 'ar' ? 'النشطة' : 'Active'}
            </p>
            <p className="text-3xl font-bold text-green-600">{activeMore.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <p className="text-gray-600 dark:text-gray-300 text-sm">
              {locale === 'ar' ? 'إجمالي الجلسات المتبقية' : 'Total Remaining Sessions'}
            </p>
            <p className="text-3xl font-bold text-orange-600">{totalActiveSessions}</p>
          </div>
        </div>

        {/* Search + Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 mb-6 flex flex-col md:flex-row gap-3">
          <input
            type="text"
            placeholder={locale === 'ar' ? '🔍 بحث (اسم / تليفون / رقم)' : '🔍 Search (name / phone / number)'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:border-primary-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-6 py-3 rounded-lg font-bold transition ${
                activeTab === 'active'
                  ? 'bg-green-600 text-white shadow'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
              }`}
            >
              {locale === 'ar' ? 'النشطة' : 'Active'} ({activeMore.length})
            </button>
            <button
              onClick={() => setActiveTab('expired')}
              className={`px-6 py-3 rounded-lg font-bold transition ${
                activeTab === 'expired'
                  ? 'bg-red-600 text-white shadow'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
              }`}
            >
              {locale === 'ar' ? 'المنتهية' : 'Expired'} ({expiredMore.length})
            </button>
          </div>
        </div>

        {/* List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6">
          {filteredMore.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-lg">
                {searchTerm
                  ? (locale === 'ar' ? 'مفيش نتائج للبحث' : 'No search results')
                  : (locale === 'ar' ? 'مفيش اشتراكات' : 'No subscriptions')
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMore.map((m) => {
                const used = m.sessionsPurchased - m.sessionsRemaining
                const progress = m.sessionsPurchased > 0 ? (used / m.sessionsPurchased) * 100 : 0
                const isExpired = m.expiryDate ? new Date(m.expiryDate) < new Date() : false

                return (
                  <div
                    key={m.moreNumber}
                    className={`border-2 rounded-xl p-4 hover:shadow-lg transition-all ${
                      (isExpired || m.sessionsRemaining <= 0)
                        ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
                        : 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{m.clientName}</h3>
                        <p className="text-gray-600 dark:text-gray-300 text-sm">
                          {locale === 'ar' ? 'رقم الاشتراك' : 'More #'}: #{m.moreNumber}
                        </p>
                        {m.phone && <p className="text-gray-600 dark:text-gray-300 text-sm">📱 {m.phone}</p>}
                      </div>
                      {(isExpired || m.sessionsRemaining <= 0) ? (
                        <span className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                          {locale === 'ar' ? 'منتهي' : 'Expired'}
                        </span>
                      ) : (
                        <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                          {locale === 'ar' ? 'نشط' : 'Active'}
                        </span>
                      )}
                    </div>

                    {/* Progress */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300 mb-1">
                        <span>
                          {locale === 'ar' ? 'الجلسات المستخدمة' : 'Used'}: {used} / {m.sessionsPurchased}
                        </span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            progress >= 80 ? 'bg-red-500' : progress >= 50 ? 'bg-orange-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Info */}
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div className="bg-white dark:bg-gray-800 rounded p-2">
                        <p className="text-gray-600 dark:text-gray-300">{locale === 'ar' ? 'المتبقي' : 'Remaining'}</p>
                        <p className="font-bold text-orange-600">
                          {m.sessionsRemaining} {locale === 'ar' ? 'حصة' : 'sessions'}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded p-2">
                        <p className="text-gray-600 dark:text-gray-300">{locale === 'ar' ? 'سعر الحصة' : 'Per Session'}</p>
                        <p className="font-bold text-green-600">{Math.round(m.pricePerSession)} {locale === 'ar' ? 'ج' : 'EGP'}</p>
                      </div>
                      {m.startDate && (
                        <div className="bg-white dark:bg-gray-800 rounded p-2">
                          <p className="text-gray-600 dark:text-gray-300">{locale === 'ar' ? 'تاريخ البدء' : 'Start'}</p>
                          <p className="font-bold">{new Date(m.startDate).toLocaleDateString(dateLocale)}</p>
                        </div>
                      )}
                      {m.expiryDate && (
                        <div className="bg-white dark:bg-gray-800 rounded p-2">
                          <p className="text-gray-600 dark:text-gray-300">{locale === 'ar' ? 'تاريخ الانتهاء' : 'Expiry'}</p>
                          <p className={`font-bold ${isExpired ? 'text-red-600' : ''}`}>
                            {new Date(m.expiryDate).toLocaleDateString(dateLocale)}
                          </p>
                        </div>
                      )}
                    </div>

                    {m.remainingAmount > 0 && (
                      <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg p-2 mb-3 dark:border-yellow-600 dark:bg-yellow-900/20">
                        <p className="text-xs text-yellow-800 dark:text-yellow-200 font-bold">
                          💰 {locale === 'ar' ? 'باقي عليه' : 'Outstanding'}: {Math.round(m.remainingAmount)} {locale === 'ar' ? 'ج' : 'EGP'}
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => openSignatureModal(m)}
                        disabled={m.sessionsRemaining <= 0 || isExpired || registering}
                        className={`flex-1 py-3 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
                          m.sessionsRemaining <= 0 || isExpired || registering
                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl active:scale-95'
                        }`}
                      >
                        ✍️ {locale === 'ar' ? 'تسجيل حصة' : 'Register Session'}
                      </button>
                      {m.phone && (
                        <a
                          href={`https://wa.me/${m.phone.replace(/^0/, '20')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-12 py-3 rounded-xl font-bold text-base transition-all flex items-center justify-center bg-green-500 hover:bg-green-600 text-white shadow-lg active:scale-95"
                          aria-label="WhatsApp"
                        >
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* SignaturePad Modal */}
      {showSignatureModal && selectedMore && (
        <SignaturePad
          title={`تسجيل حصة - ${selectedMore.clientName}`}
          subtitle={`الحصص المتبقية: ${selectedMore.sessionsRemaining} من ${selectedMore.sessionsPurchased}`}
          onConfirm={handleSignatureConfirm}
          onCancel={() => {
            setShowSignatureModal(false)
            setSelectedMore(null)
          }}
        />
      )}

      {/* Toast */}
      {sessionMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
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

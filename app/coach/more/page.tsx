'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import nextDynamic from 'next/dynamic'
import { useDebounce } from '../../../hooks/useDebounce'
import { useLanguage } from '../../../contexts/LanguageContext'
import { LoadingScreen } from '../../../components/Spinner'

const SignaturePad = nextDynamic(() => import('../../../components/SignaturePad'), { ssr: false })

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

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
  const { t, locale, direction } = useLanguage()
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

  //  استبعاد المعطّل (اللي اتجدّد) عشان مايتكررش الكارت
  const activeMore = myMore.filter(m => {
    if (m.isActive === false) return false
    if (!m.expiryDate) return true
    return new Date(m.expiryDate) >= new Date()
  })

  const expiredMore = myMore.filter(m => {
    if (m.isActive === false) return false
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
        setSessionMessage({ type: 'success', text: `تم تسجيل حصة ${selectedMore.clientName} بنجاح` })
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
    return <LoadingScreen fullScreen message={t('coachDashboard.loading')} />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4" dir={direction}>
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
              <svg {...stroke} className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
                {locale === 'ar' ? 'اشتراكات More' : 'My More Subscriptions'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {locale === 'ar'
                  ? 'كل اشتراكات More اللي معيّن عليها'
                  : 'All More subscriptions assigned to you'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center">
              <svg {...stroke} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {locale === 'ar' ? 'إجمالي الاشتراكات' : 'Total Subscriptions'}
              </div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{myMore.length}</div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center justify-center">
              <svg {...stroke} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {locale === 'ar' ? 'النشطة' : 'Active'}
              </div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{activeMore.length}</div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 flex items-center justify-center">
              <svg {...stroke} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {locale === 'ar' ? 'إجمالي الجلسات المتبقية' : 'Total Remaining Sessions'}
              </div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{totalActiveSessions}</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 mb-6 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-gray-400">
              <svg {...stroke} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder={locale === 'ar' ? 'بحث (اسم / تليفون / رقم)' : 'Search (name / phone / number)'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full ps-9 pe-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-5 py-2.5 rounded-lg font-bold transition-colors duration-200 ${
                activeTab === 'active'
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {locale === 'ar' ? 'النشطة' : 'Active'} ({activeMore.length})
            </button>
            <button
              onClick={() => setActiveTab('expired')}
              className={`px-5 py-2.5 rounded-lg font-bold transition-colors duration-200 ${
                activeTab === 'expired'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {locale === 'ar' ? 'المنتهية' : 'Expired'} ({expiredMore.length})
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6">
          {filteredMore.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg {...stroke} className="w-12 h-12 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z" />
              </svg>
              <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">
                {searchTerm
                  ? (locale === 'ar' ? 'مفيش نتائج للبحث' : 'No search results')
                  : (locale === 'ar' ? 'مفيش اشتراكات' : 'No subscriptions')
                }
              </h3>
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
                    className={`rounded-xl p-4 ring-1 shadow-sm transition-colors duration-200 ${
                      (isExpired || m.sessionsRemaining <= 0)
                        ? 'ring-red-200 dark:ring-red-900/50 bg-red-50/60 dark:bg-red-900/10'
                        : 'ring-green-200 dark:ring-green-900/50 bg-green-50/60 dark:bg-green-900/10'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 truncate">{m.clientName}</h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                          {locale === 'ar' ? 'رقم الاشتراك' : 'More #'}: #{m.moreNumber}
                        </p>
                        {m.phone && (
                          <p className="text-gray-600 dark:text-gray-400 text-sm flex items-center gap-1.5 mt-0.5">
                            <svg {...stroke} className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                            </svg>
                            <span dir="ltr">{m.phone}</span>
                          </p>
                        )}
                      </div>
                      {(isExpired || m.sessionsRemaining <= 0) ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 whitespace-nowrap">
                          {locale === 'ar' ? 'منتهي' : 'Expired'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 whitespace-nowrap">
                          {locale === 'ar' ? 'نشط' : 'Active'}
                        </span>
                      )}
                    </div>

                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                        <span>
                          {locale === 'ar' ? 'المستخدمة' : 'Used'}: {used} / {m.sessionsPurchased}
                        </span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-[width] duration-200 ${
                            progress >= 80 ? 'bg-red-500' : progress >= 50 ? 'bg-orange-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-2 ring-1 ring-gray-200 dark:ring-gray-700">
                        <p className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'المتبقي' : 'Remaining'}</p>
                        <p className="font-bold text-orange-600 dark:text-orange-400">
                          {m.sessionsRemaining} {locale === 'ar' ? 'حصة' : 'sessions'}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-2 ring-1 ring-gray-200 dark:ring-gray-700">
                        <p className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'سعر الحصة' : 'Per Session'}</p>
                        <p className="font-bold text-green-600 dark:text-green-400">{Math.round(m.pricePerSession)} {locale === 'ar' ? 'ج' : 'EGP'}</p>
                      </div>
                      <div className="col-span-2 bg-white dark:bg-gray-800 rounded-lg p-2 ring-1 ring-primary-200 dark:ring-primary-900/40">
                        <p className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'إجمالي الاشتراك' : 'Total Subscription'}</p>
                        <p className="font-bold text-primary-700 dark:text-primary-400 text-base">
                          {Math.round(m.totalAmount || m.pricePerSession * m.sessionsPurchased)} {locale === 'ar' ? 'ج.م' : 'EGP'}
                        </p>
                      </div>
                      {m.startDate && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 ring-1 ring-gray-200 dark:ring-gray-700">
                          <p className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'تاريخ البدء' : 'Start'}</p>
                          <p className="font-bold text-gray-800 dark:text-gray-200">{new Date(m.startDate).toLocaleDateString(dateLocale)}</p>
                        </div>
                      )}
                      {m.expiryDate && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 ring-1 ring-gray-200 dark:ring-gray-700">
                          <p className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'تاريخ الانتهاء' : 'Expiry'}</p>
                          <p className={`font-bold ${isExpired ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'}`}>
                            {new Date(m.expiryDate).toLocaleDateString(dateLocale)}
                          </p>
                        </div>
                      )}
                    </div>

                    {m.remainingAmount > 0 && (
                      <div className="bg-amber-50 ring-1 ring-amber-200 dark:ring-amber-900/50 rounded-lg p-2 mb-3 dark:bg-amber-900/20">
                        <p className="text-xs text-amber-800 dark:text-amber-200 font-bold flex items-center gap-1.5">
                          <svg {...stroke} className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V12Zm-12 0h.008v.008H6V12Z" />
                          </svg>
                          <span>{locale === 'ar' ? 'باقي عليه' : 'Outstanding'}: {Math.round(m.remainingAmount)} {locale === 'ar' ? 'ج' : 'EGP'}</span>
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => openSignatureModal(m)}
                        disabled={m.sessionsRemaining <= 0 || isExpired || registering}
                        className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-colors duration-200 inline-flex items-center justify-center gap-2 ${
                          m.sessionsRemaining <= 0 || isExpired || registering
                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                            : 'bg-primary-500 hover:bg-primary-600 text-primary-contrast'
                        }`}
                      >
                        <svg {...stroke} className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                        </svg>
                        <span>{locale === 'ar' ? 'تسجيل حصة' : 'Register Session'}</span>
                      </button>
                      {m.phone && (
                        <a
                          href={`https://wa.me/${m.phone.replace(/^0/, '20')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-11 h-11 rounded-lg flex items-center justify-center bg-green-500 hover:bg-green-600 text-white transition-colors duration-200"
                          aria-label="WhatsApp"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
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

      {sessionMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className={`px-6 py-3 rounded-xl shadow-lg font-bold text-white ${
            sessionMessage.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}>
            {sessionMessage.text}
          </div>
        </div>
      )}
    </div>
  )
}

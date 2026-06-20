'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import nextDynamic from 'next/dynamic'
import { useDebounce } from '../../hooks/useDebounce'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast } from '../../contexts/ToastContext'
import { LoadingScreen } from '../../components/Spinner'

const SignaturePad = nextDynamic(() => import('../../components/SignaturePad'), { ssr: false })

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

const IconWhatsApp = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
)

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

interface CoachNotification {
  type: 'PT' | 'Nutrition' | 'Physiotherapy' | 'GroupClass' | 'More'
  memberName: string
  subscriptionId: number
}

interface RenewalNotification extends CoachNotification {
  amount: number
  daysAgo: number
}

interface ExpiringNotification extends CoachNotification {
  daysLeft: number
  sessionsRemaining: number
}

interface HalfTimeNotification extends CoachNotification {
  sessionsUsed: number
  sessionsTotal: number
  remainingAmount: number
}

interface NewAssignmentNotification {
  type: 'PT' | 'Nutrition' | 'Physiotherapy' | 'GroupClass' | 'More' | 'Member'
  memberName: string
  subscriptionId?: number
  memberId?: string
  daysAgo: number
}

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

export default function CoachDashboard() {
  const router = useRouter()
  const { t, locale } = useLanguage()
  const { addToast } = useToast()
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
  const [selectedMoreForSession, setSelectedMoreForSession] = useState<MoreSubscription | null>(null)
  const [registeringSession, setRegisteringSession] = useState(false)
  const [sessionMessage, setSessionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [coachBarcodeImage, setCoachBarcodeImage] = useState<string | null>(null)
  const [myMore, setMyMore] = useState<MoreSubscription[]>([])
  const [coachNotifications, setCoachNotifications] = useState<{
    renewals: RenewalNotification[]
    expiringSoon: ExpiringNotification[]
    halfTimeWithBalance: HalfTimeNotification[]
    newAssignments: NewAssignmentNotification[]
  } | null>(null)
  //  Target الشهري للكوتش + التقدّم
  const [targetInfo, setTargetInfo] = useState<{
    coachTarget: number
    collectedThisMonth: number
    progressPercent: number
    commissionsCount: number
  } | null>(null)
  //  Flag بيحدد إذا الميزة مفعّلة من حاسبة التحصيل
  const [useSeparateCoachTarget, setUseSeparateCoachTarget] = useState<boolean | null>(null)

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

      // جلب صورة الباركود
      if (data.user.staffCode) {
        const numericCode = data.user.staffCode.replace(/[sS]/g, '')
        const barcodeText = (100000000 + parseInt(numericCode, 10)).toString()
        fetch('/api/barcode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: barcodeText })
        }).then(r => r.json()).then(d => {
          if (d.barcode) setCoachBarcodeImage(d.barcode)
        }).catch(() => {})
      }

      if (data.user.userId || data.user.id) {
        fetchMyPTs(data.user.userId || data.user.id)
        fetchMyMore()
        fetchCoachNotifications(data.user.userId || data.user.id)
        fetchCoachTarget()
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

  const fetchMyMore = async () => {
    try {
      const response = await fetch('/api/coach/my-more')
      if (response.ok) {
        const data = await response.json()
        setMyMore(data)
      }
    } catch (error) {
      console.error('Error fetching More subscriptions:', error)
    }
  }

  //  جلب التارجت الشهري للكوتش + الإيراد المحسوب من الـ commissions
  const fetchCoachTarget = async () => {
    try {
      //  اقرأ إعداد الـ useSeparateCoachTarget الأول
      const settingsRes = await fetch('/api/settings/commission')
      let enabled = false
      let method: 'revenue' | 'sessions' = 'revenue'
      if (settingsRes.ok) {
        const settings = await settingsRes.json()
        enabled = !!settings.useSeparateCoachTarget
        method = settings.defaultCommissionMethod || 'revenue'
      }
      const shouldShow = enabled && method === 'revenue'
      setUseSeparateCoachTarget(shouldShow)
      if (!shouldShow) return // الميزة مقفولة → بلاش fetch
      const response = await fetch('/api/coach/monthly-revenue')
      if (!response.ok) return
      const data = await response.json()
      if (data) setTargetInfo(data)
    } catch (error) {
      console.error('Error fetching coach target:', error)
    }
  }

  const fetchCoachNotifications = async (userId: string) => {
    try {
      const response = await fetch('/api/coach/notifications')
      if (!response.ok) return
      const data = await response.json()
      setCoachNotifications(data)

      // سجّل الإشعارات في الـ NotificationsCenter (الجرس) بدون toast مزعج
      // dedupe key باليوم الحالي + userId — مرة واحدة باليوم بس
      const todayKey = `coach-notifications-seen-${userId}-${new Date().toISOString().split('T')[0]}`
      if (typeof window !== 'undefined' && !localStorage.getItem(todayKey)) {
        const subTypeName = (t: string) => locale === 'ar'
          ? ({ PT: 'PT', Nutrition: 'تغذية', Physiotherapy: 'علاج طبيعي', GroupClass: 'جروب كلاس', More: 'More' } as any)[t] || t
          : t

        ;(data.renewals || []).forEach((r: RenewalNotification) =>
          addToast(`${r.memberName} جدّد اشتراك ${subTypeName(r.type)}`, 'success', 0)
        )
        ;(data.expiringSoon || []).forEach((e: ExpiringNotification) =>
          addToast(`${e.memberName} — اشتراك ${subTypeName(e.type)} ينتهي خلال ${e.daysLeft} يوم`, 'warning', 0)
        )
        ;(data.halfTimeWithBalance || []).forEach((h: HalfTimeNotification) =>
          addToast(`${h.memberName} — استخدم نص جلسات ${subTypeName(h.type)} وعليه ${Math.round(h.remainingAmount)} ج`, 'warning', 0)
        )
        ;(data.newAssignments || []).forEach((n: NewAssignmentNotification) => {
          const label = n.type === 'Member' ? 'عضو جديد' : `اشتراك ${subTypeName(n.type as any)} جديد`
          addToast(`${n.memberName} — ${label} اتأسند ليك`, 'info', 0)
        })

        localStorage.setItem(todayKey, '1')
      }
    } catch (error) {
      console.error('Error fetching coach notifications:', error)
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

  // Filter More subscriptions based on the same active/expired tab
  const activeMore = myMore.filter(m => {
    const expired = m.expiryDate ? new Date(m.expiryDate) < new Date() : false
    return !expired && m.sessionsRemaining > 0
  })
  const expiredMore = myMore.filter(m => {
    const expired = m.expiryDate ? new Date(m.expiryDate) < new Date() : false
    return expired || m.sessionsRemaining <= 0
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
    setSelectedMoreForSession(null)
    setShowSignatureModal(true)
    setSessionMessage(null)
  }, [])

  const openMoreSignatureModal = useCallback((m: MoreSubscription) => {
    setSelectedMoreForSession(m)
    setSelectedPTForSession(null)
    setShowSignatureModal(true)
    setSessionMessage(null)
  }, [])

  const handleSignatureConfirm = useCallback(async (signatureDataUrl: string) => {
    if (selectedPTForSession) {
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
          setMyPTs(prev => prev.map(pt =>
            pt.ptNumber === selectedPTForSession.ptNumber
              ? { ...pt, sessionsRemaining: pt.sessionsRemaining - 1 }
              : pt
          ))
          setShowSignatureModal(false)
          setSelectedPTForSession(null)
          setSessionMessage({ type: 'success', text: `تم تسجيل حصة ${selectedPTForSession.clientName} بنجاح ` })
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
      return
    }

    if (selectedMoreForSession) {
      setRegisteringSession(true)
      try {
        const res = await fetch('/api/coach/register-more-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            moreNumber: selectedMoreForSession.moreNumber,
            signature: signatureDataUrl
          })
        })
        const data = await res.json()
        if (res.ok && data.success) {
          setMyMore(prev => prev.map(m =>
            m.moreNumber === selectedMoreForSession.moreNumber
              ? { ...m, sessionsRemaining: m.sessionsRemaining - 1 }
              : m
          ))
          setShowSignatureModal(false)
          setSelectedMoreForSession(null)
          setSessionMessage({ type: 'success', text: `تم تسجيل حصة ${selectedMoreForSession.clientName} بنجاح ` })
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
    }
  }, [selectedPTForSession, selectedMoreForSession])

  if (loading) {
    return <LoadingScreen fullScreen message={t('coachDashboard.loading')} />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
              {t('coachDashboard.welcome', { name: user?.name || '' })}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{t('coachDashboard.subtitle')}</p>
          </div>
          {coachBarcodeImage && (
            <div className="flex justify-center mt-4">
              <img src={coachBarcodeImage} alt="Barcode" className="h-28 w-auto" />
            </div>
          )}
        </div>

        {/* Coach Notifications Banner */}
        {coachNotifications && (
          coachNotifications.renewals.length > 0 ||
          coachNotifications.expiringSoon.length > 0 ||
          coachNotifications.halfTimeWithBalance.length > 0 ||
          coachNotifications.newAssignments.length > 0
        ) && (
          <>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
              <svg {...stroke} className="w-5 h-5 text-primary-600 dark:text-primary-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
              </svg>
              {locale === 'ar' ? 'إشعارات' : 'Notifications'}
            </h2>
            <Link href="/coach/notifications" className="text-sm text-primary-700 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-semibold">
              {locale === 'ar' ? 'عرض الكل' : 'View all'}
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {coachNotifications.renewals.length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-900/50 rounded-xl p-4 shadow-sm">
                <h3 className="font-bold text-green-800 dark:text-green-200 mb-3 flex items-center gap-2">
                  <svg {...stroke} className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  <span>{locale === 'ar' ? 'تجديدات أخيرة' : 'Recent Renewals'} ({coachNotifications.renewals.length})</span>
                </h3>
                <ul className="text-sm space-y-2 text-gray-800 dark:text-gray-200">
                  {coachNotifications.renewals.slice(0, 5).map((r, i) => (
                    <li key={i} className="bg-white dark:bg-gray-800 rounded-lg p-2">
                      <span className="font-medium">{r.memberName}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 mx-2">·</span>
                      <span className="text-xs text-gray-600 dark:text-gray-300">{r.type}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 mx-2">·</span>
                      <span className="text-xs text-gray-600 dark:text-gray-300">
                        {r.daysAgo === 0 ? (locale === 'ar' ? 'النهاردة' : 'today') : `${r.daysAgo} ${locale === 'ar' ? 'يوم' : 'days'}`}
                      </span>
                    </li>
                  ))}
                  {coachNotifications.renewals.length > 5 && (
                    <li className="text-xs text-gray-500 dark:text-gray-400 italic">
                      +{coachNotifications.renewals.length - 5} {locale === 'ar' ? 'تاني' : 'more'}
                    </li>
                  )}
                </ul>
              </div>
            )}

            {coachNotifications.expiringSoon.length > 0 && (
              <div className="bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-200 dark:ring-orange-900/50 rounded-xl p-4 shadow-sm">
                <h3 className="font-bold text-orange-800 dark:text-orange-200 mb-3 flex items-center gap-2">
                  <svg {...stroke} className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <span>{locale === 'ar' ? 'قارب على الانتهاء' : 'Expiring Soon'} ({coachNotifications.expiringSoon.length})</span>
                </h3>
                <ul className="text-sm space-y-2 text-gray-800 dark:text-gray-200">
                  {coachNotifications.expiringSoon.slice(0, 5).map((e, i) => (
                    <li key={i} className="bg-white dark:bg-gray-800 rounded-lg p-2">
                      <span className="font-medium">{e.memberName}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 mx-2">·</span>
                      <span className="text-xs text-gray-600 dark:text-gray-300">{e.type}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 mx-2">·</span>
                      <span className={`text-xs font-bold ${e.daysLeft <= 2 ? 'text-red-600' : 'text-orange-600'}`}>
                        {e.daysLeft === 0
                          ? (locale === 'ar' ? 'النهاردة' : 'today')
                          : `${e.daysLeft} ${locale === 'ar' ? 'يوم' : 'days'}`}
                      </span>
                    </li>
                  ))}
                  {coachNotifications.expiringSoon.length > 5 && (
                    <li className="text-xs text-gray-500 dark:text-gray-400 italic">
                      +{coachNotifications.expiringSoon.length - 5} {locale === 'ar' ? 'تاني' : 'more'}
                    </li>
                  )}
                </ul>
              </div>
            )}

            {coachNotifications.halfTimeWithBalance.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/50 rounded-xl p-4 shadow-sm">
                <h3 className="font-bold text-red-800 dark:text-red-200 mb-3 flex items-center gap-2">
                  <svg {...stroke} className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                  <span>{locale === 'ar' ? 'نص الوقت + بواقي' : 'Half-time + Balance'} ({coachNotifications.halfTimeWithBalance.length})</span>
                </h3>
                <ul className="text-sm space-y-2 text-gray-800 dark:text-gray-200">
                  {coachNotifications.halfTimeWithBalance.slice(0, 5).map((h, i) => (
                    <li key={i} className="bg-white dark:bg-gray-800 rounded-lg p-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{h.memberName}</span>
                        <span className="text-xs font-bold text-red-600">{Math.round(h.remainingAmount)} {locale === 'ar' ? 'ج' : 'EGP'}</span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                        {h.type} · {h.sessionsUsed}/{h.sessionsTotal} {locale === 'ar' ? 'حصة' : 'sessions'}
                      </div>
                    </li>
                  ))}
                  {coachNotifications.halfTimeWithBalance.length > 5 && (
                    <li className="text-xs text-gray-500 dark:text-gray-400 italic">
                      +{coachNotifications.halfTimeWithBalance.length - 5} {locale === 'ar' ? 'تاني' : 'more'}
                    </li>
                  )}
                </ul>
              </div>
            )}

            {coachNotifications.newAssignments.length > 0 && (
              <div className="bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-200 dark:ring-purple-900/50 rounded-xl p-4 shadow-sm">
                <h3 className="font-bold text-purple-800 dark:text-purple-200 mb-3 flex items-center gap-2">
                  <svg {...stroke} className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
                  </svg>
                  <span>{locale === 'ar' ? 'اتأسند ليك' : 'Newly Assigned'} ({coachNotifications.newAssignments.length})</span>
                </h3>
                <ul className="text-sm space-y-2 text-gray-800 dark:text-gray-200">
                  {coachNotifications.newAssignments.slice(0, 5).map((n, i) => {
                    const label = n.type === 'Member'
                      ? (locale === 'ar' ? 'عضو' : 'Member')
                      : n.type
                    return (
                      <li key={i} className="bg-white dark:bg-gray-800 rounded-lg p-2">
                        <span className="font-medium">{n.memberName}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 mx-2">·</span>
                        <span className="text-xs text-gray-600 dark:text-gray-300">{label}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 mx-2">·</span>
                        <span className="text-xs text-gray-600 dark:text-gray-300">
                          {n.daysAgo === 0 ? (locale === 'ar' ? 'النهاردة' : 'today') : `${n.daysAgo} ${locale === 'ar' ? 'يوم' : 'days'}`}
                        </span>
                      </li>
                    )
                  })}
                  {coachNotifications.newAssignments.length > 5 && (
                    <li className="text-xs text-gray-500 dark:text-gray-400 italic">
                      +{coachNotifications.newAssignments.length - 5} {locale === 'ar' ? 'تاني' : 'more'}
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
          </>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
              {t('coachDashboard.quickActions')}
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link
              href="/pt"
              className="bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/20 dark:hover:bg-primary-900/30 text-gray-800 dark:text-gray-100 p-4 rounded-xl ring-1 ring-primary-200 dark:ring-primary-900/50 transition-colors duration-200 flex flex-col items-center gap-2"
            >
              <span className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center">
                <svg {...stroke} className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5 9 8.25l3 3 3.75-3.75M3.75 13.5V21h16.5V8.25" />
                </svg>
              </span>
              <span className="font-bold text-sm text-center">{t('coachDashboard.viewPT')}</span>
            </Link>

            <Link
              href="/coach/my-members"
              className="bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 text-gray-800 dark:text-gray-100 p-4 rounded-xl ring-1 ring-purple-200 dark:ring-purple-900/50 transition-colors duration-200 flex flex-col items-center gap-2"
            >
              <span className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                <svg {...stroke} className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
              </span>
              <span className="font-bold text-sm text-center">{locale === 'ar' ? 'أعضائي' : 'My Members'}</span>
            </Link>

            <Link
              href="/pt/commission"
              className="bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 text-gray-800 dark:text-gray-100 p-4 rounded-xl ring-1 ring-green-200 dark:ring-green-900/50 transition-colors duration-200 flex flex-col items-center gap-2"
            >
              <span className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 flex items-center justify-center">
                <svg {...stroke} className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              </span>
              <span className="font-bold text-sm text-center">{t('coachDashboard.viewCommission')}</span>
            </Link>

            <Link
              href="/pt/sessions/history"
              className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-gray-800 dark:text-gray-100 p-4 rounded-xl ring-1 ring-blue-200 dark:ring-blue-900/50 transition-colors duration-200 flex flex-col items-center gap-2"
            >
              <span className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                <svg {...stroke} className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h7.5M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
              </span>
              <span className="font-bold text-sm text-center">{t('coachDashboard.sessionHistory')}</span>
            </Link>

          </div>
        </div>

        {/*  Monthly Target Card — يظهر بس لو الميزة مفعّلة في حاسبة التحصيل */}
        {useSeparateCoachTarget && targetInfo && (
          <div className="mb-6">
            {targetInfo.coachTarget > 0 ? (
              <div className="relative bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-700 text-white rounded-2xl shadow-xl p-5 sm:p-6 overflow-hidden">
                <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-300/20 rounded-full blur-2xl pointer-events-none" />
                <div className="relative">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider opacity-90 flex items-center gap-1.5">
                        🎯 {locale === 'ar' ? 'التارجت الشهري' : 'Monthly Target'}
                      </div>
                      <div className="text-3xl sm:text-4xl font-extrabold mt-1">
                        {targetInfo.collectedThisMonth.toLocaleString()}
                        <span className="text-base sm:text-lg font-bold opacity-80 ms-1">/ {targetInfo.coachTarget.toLocaleString()} ج</span>
                      </div>
                      <div className="text-xs opacity-85 mt-1">
                        {locale === 'ar' ? `${targetInfo.commissionsCount} عملية هذا الشهر` : `${targetInfo.commissionsCount} commissions this month`}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-4xl sm:text-5xl font-extrabold leading-none">{targetInfo.progressPercent}%</div>
                      <div className="text-[10px] sm:text-xs opacity-90 mt-1">
                        {targetInfo.progressPercent >= 300
                          ? (locale === 'ar' ? `🔥 ${Math.floor(targetInfo.progressPercent/100)}× أضعاف!` : `🔥 ${Math.floor(targetInfo.progressPercent/100)}× the target!`)
                          : targetInfo.progressPercent >= 200
                          ? (locale === 'ar' ? '🚀 ضعف التارجت!' : '🚀 Double the target!')
                          : targetInfo.progressPercent > 100
                          ? (locale === 'ar' ? `🏆 تخطّى التارجت بـ ${targetInfo.progressPercent - 100}%` : `🏆 Exceeded by ${targetInfo.progressPercent - 100}%`)
                          : targetInfo.progressPercent >= 100
                          ? (locale === 'ar' ? '🏆 وصلت التارجت!' : '🏆 Target reached!')
                          : (locale === 'ar' ? `باقي ${(targetInfo.coachTarget - targetInfo.collectedThisMonth).toLocaleString()} ج` : `${(targetInfo.coachTarget - targetInfo.collectedThisMonth).toLocaleString()} EGP left`)}
                      </div>
                    </div>
                  </div>
                  {/*  الـ progress bar محدود بـ 100% بصرياً (overflow:hidden)
                       حتى لو الـ percent > 100 (مثلاً 200%)، الـ bar هيمتلي بالكامل بس */}
                  <div className="bg-white/15 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${targetInfo.progressPercent >= 100 ? 'bg-emerald-300' : 'bg-white'}`}
                      style={{ width: `${Math.min(100, targetInfo.progressPercent)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-100 dark:bg-gray-800/60 ring-1 ring-gray-200 dark:ring-gray-700 rounded-2xl p-4 sm:p-5 flex items-center gap-3">
                <span className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xl">🎯</span>
                <div className="flex-1">
                  <div className="font-bold text-gray-800 dark:text-gray-200">{locale === 'ar' ? 'لم يتم تحديد تارجت شهري' : 'No monthly target set'}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'تواصل مع الأدمن لتحديد التارجت' : 'Contact admin to set the target'}</div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('coachDashboard.activeSubscriptions')}</div>
                <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{activePTs.length}</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center justify-center">
                <svg {...stroke} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('coachDashboard.remainingSessions')}</div>
                <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{totalActiveSessions}</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 flex items-center justify-center">
                <svg {...stroke} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('coachDashboard.completedSessions')}</div>
                <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{totalCompletedSessions}</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center">
                <svg {...stroke} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5 9 8.25l3 3 3.75-3.75M3.75 13.5V21h16.5V8.25" /></svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('coachDashboard.todaySessions')}</div>
                <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{todaySessions}</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center">
                <svg {...stroke} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
              </div>
            </div>
          </div>
        </div>

        {clientsInGym > 0 && (
          <div className="bg-green-600 dark:bg-green-700 text-white rounded-xl shadow-sm p-4 sm:p-5 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center">
                  <svg {...stroke} className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12h.008v.008H6V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm11.25 0h.008v.008h-.008V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-9.375-3a1.5 1.5 0 0 1 1.5-1.5h4.5a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-4.5a1.5 1.5 0 0 1-1.5-1.5V9ZM3 9.75v4.5m18-4.5v4.5" /></svg>
                </span>
                <div>
                  <p className="font-bold text-base sm:text-lg">{t('coachDashboard.clientsInGym', { count: clientsInGym.toString() })}</p>
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

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 mb-6">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-gray-400">
              <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
            </span>
            <input
              type="text"
              placeholder={t('coachDashboard.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full ps-10 pe-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 mb-6">
          <div className="flex gap-3">
            <button
              onClick={() => setActiveTab('active')}
              className={`flex-1 px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 ${
                activeTab === 'active'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t('coachDashboard.activeTab', { count: (activePTs.length + activeMore.length).toString() })}
            </button>
            <button
              onClick={() => setActiveTab('expired')}
              className={`flex-1 px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 ${
                activeTab === 'expired'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t('coachDashboard.expiredTab', { count: (expiredPTs.length + expiredMore.length).toString() })}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6">
          <h2 className="text-lg font-bold mb-5 text-gray-900 dark:text-gray-100 flex items-center gap-2">
            {activeTab === 'active' ? (
              <svg {...stroke} className="w-5 h-5 text-green-600 dark:text-green-400"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
            ) : (
              <svg {...stroke} className="w-5 h-5 text-red-600 dark:text-red-400"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
            )}
            {activeTab === 'active'
              ? t('coachDashboard.activeSubscriptionsTitle')
              : t('coachDashboard.expiredSubscriptionsTitle')
            } ({filteredPTs.length + filteredMore.length})
          </h2>

          {filteredPTs.length === 0 && filteredMore.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg {...stroke} className="w-12 h-12 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z" />
              </svg>
              <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">
                {activeTab === 'active'
                  ? t('coachDashboard.noActiveSubscriptions')
                  : t('coachDashboard.noExpiredSubscriptions')
                }
              </h3>
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
                    className={`ring-1 rounded-xl p-4 shadow-sm transition-colors duration-200 relative ${
                      isCheckedIn
                        ? 'ring-green-300 dark:ring-green-700/60 bg-green-50/60 dark:bg-green-900/15'
                        : (isExpired || pt.sessionsRemaining <= 0)
                          ? 'ring-red-200 dark:ring-red-900/50 bg-red-50/60 dark:bg-red-900/10'
                          : 'ring-primary-200 dark:ring-primary-900/50 bg-primary-50/40 dark:bg-primary-900/10'
                    }`}
                  >
                    {isCheckedIn && (
                      <div className="bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg mb-3 inline-flex items-center gap-2">
                        <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12h.008v.008H6V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm11.25 0h.008v.008h-.008V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-9.375-3a1.5 1.5 0 0 1 1.5-1.5h4.5a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-4.5a1.5 1.5 0 0 1-1.5-1.5V9ZM3 9.75v4.5m18-4.5v4.5" /></svg>
                        <span>{t('coachDashboard.clientInGymNow')}</span>
                        {checkInInfo && (
                          <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">
                            {new Date(checkInInfo.checkInTime).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-start justify-between mb-3">
                      <div className={`flex-1 min-w-0 ${locale === 'ar' ? 'ps-24' : 'ps-12'}`}>
                        <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 truncate">{pt.clientName}</h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">{t('coachDashboard.ptNumber')}: #{pt.ptNumber}</p>
                        {pt.phone && (
                          <p className="text-gray-600 dark:text-gray-400 text-sm flex items-center gap-1.5 mt-0.5">
                            <svg {...stroke} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>
                            <span dir="ltr">{pt.phone}</span>
                          </p>
                        )}
                      </div>
                      {(isExpired || pt.sessionsRemaining <= 0) ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          {t('coachDashboard.expired')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          {t('coachDashboard.active')}
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
                          className={`h-2 rounded-full transition-colors duration-200 ${
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
                      <div className="bg-white dark:bg-gray-800 rounded p-2 col-span-2 ring-1 ring-primary-200 dark:ring-primary-900/40">
                        <p className="text-gray-600 dark:text-gray-300">{t('coachDashboard.totalPrice')}</p>
                        <p className="font-bold text-primary-700 dark:text-primary-400 text-base">{Math.round(pt.pricePerSession * pt.sessionsPurchased)} {t('coachDashboard.egp')}</p>
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

                    {pt.remainingAmount !== null && pt.remainingAmount > 0 && (
                      <div className="bg-amber-50 ring-1 ring-amber-200 dark:ring-amber-900/50 rounded-lg p-2 mb-3 dark:bg-amber-900/20">
                        <p className="text-xs text-amber-800 dark:text-amber-200 font-bold flex items-center gap-1.5">
                          <svg {...stroke} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                          <span>{t('coachDashboard.remainingAmount')}: {pt.remainingAmount} {t('coachDashboard.egp')}</span>
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => openSignatureModal(pt)}
                        disabled={pt.sessionsRemaining <= 0}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg font-bold text-sm transition-colors duration-200 ${
                          pt.sessionsRemaining <= 0
                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                            : 'bg-primary-500 hover:bg-primary-600 text-primary-contrast'
                        }`}
                      >
                        <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>
                        {t('coachDashboard.registerSession') || 'تسجيل حصة'}
                      </button>
                      {pt.phone && (
                        <a
                          href={`https://wa.me/${pt.phone.replace(/^0/, '20')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-11 px-3 py-2.5 rounded-lg flex items-center justify-center bg-green-500 hover:bg-green-600 text-white transition-colors duration-200"
                          aria-label="WhatsApp"
                        >
                          <IconWhatsApp />
                        </a>
                      )}
                    </div>

                    {/* Sessions History */}
                    {pt.sessions && pt.sessions.length > 0 && (
                      <div className="border-t dark:border-gray-600 pt-3 mt-3">
                        <p className="text-xs text-gray-600 dark:text-gray-300 font-bold mb-2">
                           {t('coachDashboard.recentSessions')} ({pt.sessions.length})
                        </p>
                        {/*  بنعرض كل الحصص بترتيب الأحدث الأول، مع scroll لو كتيرة
                            (قبل كده كان بيعرض 3 فقط فالحضور الجديد بعد كده ما كانش يظهر) */}
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {[...pt.sessions]
                            .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime())
                            .map((session) => {
                              const dt = new Date(session.sessionDate)
                              const dateStr = dt.toLocaleDateString(dateLocale)
                              //  الوقت مع الساعة والدقيقة
                              const timeStr = dt.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit', hour12: true })
                              return (
                                <div key={session.id} className="bg-white dark:bg-gray-700 rounded p-2 text-xs flex justify-between items-center">
                                  <div className="text-gray-800 dark:text-gray-200 flex flex-col">
                                    <span>{dateStr}</span>
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">🕐 {timeStr}</span>
                                  </div>
                                  {session.attended ? (
                                    <span className="text-green-600 dark:text-green-400 font-bold"> {t('coachDashboard.attended')}</span>
                                  ) : (
                                    <span className="text-orange-600 dark:text-orange-400 font-bold"> {t('coachDashboard.registered')}</span>
                                  )}
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    )}

                    {/* Service-type badge */}
                    <span className="absolute top-2 start-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-600 text-primary-contrast shadow-sm">
                      {locale === 'ar' ? 'حصص مخصصة' : 'PT'}
                    </span>
                  </div>
                )
              })}

              {/* More subscriptions inline next to PT */}
              {filteredMore.map((m) => {
                const used = m.sessionsPurchased - m.sessionsRemaining
                const progress = m.sessionsPurchased > 0 ? (used / m.sessionsPurchased) * 100 : 0
                const isExpired = m.expiryDate ? new Date(m.expiryDate) < new Date() : false

                return (
                  <div
                    key={`more-${m.moreNumber}`}
                    className={`relative ring-1 rounded-xl p-4 shadow-sm transition-colors duration-200 ${
                      (isExpired || m.sessionsRemaining <= 0)
                        ? 'ring-red-200 dark:ring-red-900/50 bg-red-50/60 dark:bg-red-900/10'
                        : 'ring-fuchsia-200 dark:ring-fuchsia-900/50 bg-fuchsia-50/60 dark:bg-fuchsia-900/10'
                    }`}
                  >
                    {/* Service-type badge */}
                    <span className="absolute top-2 start-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-fuchsia-600 text-white shadow-sm">
                      {locale === 'ar' ? 'مزيد' : 'More'}
                    </span>

                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0 ps-12">
                        <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 truncate">{m.clientName}</h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                          {locale === 'ar' ? 'رقم الاشتراك' : 'More #'}: #{m.moreNumber}
                        </p>
                        {m.phone && (
                          <p className="text-gray-600 dark:text-gray-400 text-sm flex items-center gap-1.5 mt-0.5">
                            <svg {...stroke} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>
                            <span dir="ltr">{m.phone}</span>
                          </p>
                        )}
                      </div>
                      {(isExpired || m.sessionsRemaining <= 0) ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          {t('coachDashboard.expired')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          {t('coachDashboard.active')}
                        </span>
                      )}
                    </div>

                    {/* Progress */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300 mb-1">
                        <span>{t('coachDashboard.usedSessions')}: {used} / {m.sessionsPurchased}</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-colors duration-200 ${
                            progress >= 80 ? 'bg-red-500' : progress >= 50 ? 'bg-orange-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Info grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div className="bg-white dark:bg-gray-800 rounded p-2">
                        <p className="text-gray-600 dark:text-gray-300">{t('coachDashboard.remaining')}</p>
                        <p className="font-bold text-orange-600">{m.sessionsRemaining} {t('coachDashboard.session')}</p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded p-2">
                        <p className="text-gray-600 dark:text-gray-300">{t('coachDashboard.pricePerSession')}</p>
                        <p className="font-bold text-green-600">{Math.round(m.pricePerSession)} {t('coachDashboard.egp')}</p>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded p-2 col-span-2 ring-1 ring-primary-200 dark:ring-primary-900/40">
                        <p className="text-gray-600 dark:text-gray-300">{t('coachDashboard.totalPrice')}</p>
                        <p className="font-bold text-primary-700 dark:text-primary-400 text-base">{Math.round(m.totalAmount || m.pricePerSession * m.sessionsPurchased)} {t('coachDashboard.egp')}</p>
                      </div>
                      {m.startDate && (
                        <div className="bg-white dark:bg-gray-800 rounded p-2">
                          <p className="text-gray-600 dark:text-gray-300">{t('coachDashboard.startDate')}</p>
                          <p className="font-bold">{new Date(m.startDate).toLocaleDateString(dateLocale)}</p>
                        </div>
                      )}
                      {m.expiryDate && (
                        <div className="bg-white dark:bg-gray-800 rounded p-2">
                          <p className="text-gray-600 dark:text-gray-300">{t('coachDashboard.endDate')}</p>
                          <p className={`font-bold ${isExpired ? 'text-red-600' : ''}`}>
                            {new Date(m.expiryDate).toLocaleDateString(dateLocale)}
                          </p>
                        </div>
                      )}
                    </div>

                    {m.remainingAmount > 0 && (
                      <div className="bg-amber-50 ring-1 ring-amber-200 dark:ring-amber-900/50 rounded-lg p-2 mb-3 dark:bg-amber-900/20">
                        <p className="text-xs text-amber-800 dark:text-amber-200 font-bold flex items-center gap-1.5">
                          <svg {...stroke} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4" /></svg>
                          <span>{t('coachDashboard.remainingAmount')}: {Math.round(m.remainingAmount)} {t('coachDashboard.egp')}</span>
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => openMoreSignatureModal(m)}
                        disabled={m.sessionsRemaining <= 0 || isExpired}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg font-bold text-sm transition-colors duration-200 ${
                          m.sessionsRemaining <= 0 || isExpired
                            ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                            : 'bg-fuchsia-500 hover:bg-fuchsia-600 text-white'
                        }`}
                      >
                        <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>
                        {t('coachDashboard.registerSession') || 'تسجيل حصة'}
                      </button>
                      {m.phone && (
                        <a
                          href={`https://wa.me/${m.phone.replace(/^0/, '20')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-11 px-3 py-2.5 rounded-lg flex items-center justify-center bg-green-500 hover:bg-green-600 text-white transition-colors duration-200"
                          aria-label="WhatsApp"
                        >
                          <IconWhatsApp />
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
      {showSignatureModal && (selectedPTForSession || selectedMoreForSession) && (
        <SignaturePad
          title={`تسجيل حصة - ${(selectedPTForSession || selectedMoreForSession)!.clientName}`}
          subtitle={`الحصص المتبقية: ${(selectedPTForSession || selectedMoreForSession)!.sessionsRemaining} من ${(selectedPTForSession || selectedMoreForSession)!.sessionsPurchased}`}
          onConfirm={handleSignatureConfirm}
          onCancel={() => {
            setShowSignatureModal(false)
            setSelectedPTForSession(null)
            setSelectedMoreForSession(null)
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

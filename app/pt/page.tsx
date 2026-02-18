'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePermissions } from '../../hooks/usePermissions'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast } from '../../contexts/ToastContext'
import PermissionDenied from '../../components/PermissionDenied'
import { formatDateYMD } from '../../lib/dateFormatter'
import { useConfirm } from '../../hooks/useConfirm'
import ConfirmDialog from '../../components/ConfirmDialog'
import PaymentMethodSelector from '../../components/Paymentmethodselector'
import type { PaymentMethod } from '../../lib/paymentHelpers'
import { fetchPTSessions, fetchCoaches } from '../../lib/api/pt'
import { useServiceSettings } from '../../contexts/ServiceSettingsContext'
import { useDebounce } from '../../hooks/useDebounce'
import LoadingSkeleton from '../../components/LoadingSkeleton'

interface Staff {
  id: string
  name: string
  phone?: string
  position?: string
  isActive: boolean
}

interface PTSession {
  ptNumber: number
  clientName: string
  phone: string
  sessionsPurchased: number
  sessionsRemaining: number
  coachName: string
  pricePerSession: number
  remainingAmount?: number
  startDate: string | null
  expiryDate: string | null
  createdAt: string
  qrCode?: string
  qrCodeImage?: string
}

export default function PTPage() {
  const router = useRouter()
  const { hasPermission, loading: permissionsLoading, user } = usePermissions()
  const { t, direction } = useLanguage()
  const toast = useToast()
  const { confirm, isOpen, options, handleConfirm, handleCancel } = useConfirm()
  const { settings } = useServiceSettings()
  const queryClient = useQueryClient()

  // ✅ استخدام useQuery لجلب جلسات PT
  const {
    data: sessions = [],
    isLoading: loading,
    error: sessionsError,
    refetch: refetchSessions
  } = useQuery({
    queryKey: ['pt-sessions'],
    queryFn: fetchPTSessions,
    enabled: !permissionsLoading && hasPermission('canViewPT'),
    retry: 1,
    staleTime: 2 * 60 * 1000,
  })

  // ✅ استخدام useQuery لجلب المدربين
  const {
    data: coaches = [],
    isLoading: coachesLoading
  } = useQuery({
    queryKey: ['coaches'],
    queryFn: fetchCoaches,
    enabled: !permissionsLoading,
    retry: 1,
    staleTime: 5 * 60 * 1000, // المدربين مش بيتغيروا كتير
  })

  const [showForm, setShowForm] = useState(false)
  const [editingSession, setEditingSession] = useState<PTSession | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [showQRModal, setShowQRModal] = useState(false)
  const [selectedSession, setSelectedSession] = useState<PTSession | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentSession, setPaymentSession] = useState<PTSession | null>(null)
  const [paymentFormData, setPaymentFormData] = useState<{
    paymentAmount: number
    paymentMethod: string | PaymentMethod[]
  }>({
    paymentAmount: 0,
    paymentMethod: 'cash'
  })

  // فلاتر إضافية
  const [filterCoach, setFilterCoach] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expiring' | 'expired'>('all')
  const [filterSessions, setFilterSessions] = useState<'all' | 'low' | 'zero'>('all')
  const [filterType, setFilterType] = useState<'all' | 'regular' | 'dayuse'>('all')

  const [isDayUse, setIsDayUse] = useState(false)
  const [packages, setPackages] = useState<any[]>([])
  const [loadingPackages, setLoadingPackages] = useState(false)
  const [memberPoints, setMemberPoints] = useState(0)

  const [formData, setFormData] = useState<{
    ptNumber: string
    clientName: string
    phone: string
    sessionsPurchased: number
    sessionsRemaining: number
    coachName: string
    totalPrice: number
    remainingAmount: number
    startDate: string
    expiryDate: string
    paymentMethod: string | PaymentMethod[]
    staffName: string
  }>({
    ptNumber: '',
    clientName: '',
    phone: '',
    sessionsPurchased: 8,
    sessionsRemaining: 8,
    coachName: '',
    totalPrice: 0,
    remainingAmount: 0,
    startDate: formatDateYMD(new Date()),
    expiryDate: '',
    paymentMethod: 'cash',
    staffName: user?.name || '',
  })

  // ✅ معالجة أخطاء جلسات PT
  useEffect(() => {
    if (sessionsError) {
      const errorMessage = (sessionsError as Error).message

      if (errorMessage === 'UNAUTHORIZED') {
        router.push('/login')
      } else if (errorMessage === 'FORBIDDEN') {
        // لا نفعل شيء - PermissionDenied سيظهر
      } else {
        toast.error(errorMessage || 'حدث خطأ أثناء جلب الجلسات')
      }
    }
  }, [sessionsError, router, toast])

  useEffect(() => {
    if (user && !formData.staffName) {
      setFormData(prev => ({ ...prev, staffName: user.name }))
    }
  }, [user])

  useEffect(() => {
    const fetchMemberPoints = async () => {
      if (!formData.phone) {
        setMemberPoints(0)
        return
      }

      try {
        const response = await fetch(`/api/members?phone=${encodeURIComponent(formData.phone)}`)
        if (response.ok) {
          const members = await response.json()
          if (members.length > 0) {
            setMemberPoints(members[0].points || 0)
          } else {
            setMemberPoints(0)
          }
        }
      } catch (error) {
        console.error('Error fetching member points:', error)
        setMemberPoints(0)
      }
    }

    fetchMemberPoints()
  }, [formData.phone])

  // جلب الباقات عند فتح النموذج
  useEffect(() => {
    if (showForm && !editingSession) {
      fetchPackages()
    }
  }, [showForm, editingSession])

  const fetchPackages = async () => {
    setLoadingPackages(true)
    try {
      const response = await fetch('/api/packages?serviceType=PT')
      if (response.ok) {
        const data = await response.json()
        setPackages(data)
      }
    } catch (error) {
      console.error('Error fetching packages:', error)
    } finally {
      setLoadingPackages(false)
    }
  }

  // دوال مساعدة للفلاتر
  const isExpired = (session: PTSession) => {
    if (!session.expiryDate) return false
    return new Date(session.expiryDate) < new Date()
  }

  const isExpiringSoon = (session: PTSession) => {
    if (!session.expiryDate || isExpired(session)) return false
    const expiry = new Date(session.expiryDate)
    const today = new Date()
    const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diff > 0 && diff <= 7
  }

  const applyPackage = (pkg: any) => {
    setFormData(prev => ({
      ...prev,
      sessionsPurchased: pkg.sessions,
      sessionsRemaining: pkg.sessions,
      totalPrice: pkg.price
    }))
    toast.success(`تم تطبيق باقة: ${pkg.name}`)
  }

  // دالة جلب بيانات العضو بناءً على رقم العضوية وملء الحقول تلقائياً
  const fetchMemberByNumber = async (memberNumber: string) => {
    if (!memberNumber.trim()) return

    try {
      const response = await fetch('/api/members')
      if (!response.ok) return

      const members = await response.json()
      const member = members.find((m: any) => m.memberNumber?.toString() === memberNumber.trim())

      if (member) {
        setFormData(prev => ({
          ...prev,
          clientName: member.name,
          phone: member.phone
        }))
        toast.success(`تم تحميل بيانات العضو: ${member.name}`)
      } else {
        toast.warning(`لم يتم العثور على عضو برقم ${memberNumber}`)
      }
    } catch (error) {
      console.error('Error fetching member:', error)
    }
  }

  // دالة لمعالجة ضغط Enter على حقل ID
  const handleIdKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      fetchMemberByNumber(formData.ptNumber)
    }
  }

  const resetForm = () => {
    setFormData({
      ptNumber: '',
      clientName: '',
      phone: '',
      sessionsPurchased: 8,
      sessionsRemaining: 8,
      coachName: '',
      totalPrice: 0,
      remainingAmount: 0,
      startDate: formatDateYMD(new Date()),
      expiryDate: '',
      paymentMethod: 'cash',
      staffName: user?.name || '',
    })
    setEditingSession(null)
    setShowForm(false)
    setIsDayUse(false)
  }


  const calculateExpiryFromMonths = (months: number) => {
    if (!formData.startDate) return
    
    const start = new Date(formData.startDate)
    const expiry = new Date(start)
    expiry.setMonth(expiry.getMonth() + months)
    
    setFormData(prev => ({ 
      ...prev, 
      expiryDate: formatDateYMD(expiry)
    }))
  }

  const handleEdit = (session: PTSession) => {
    const totalPrice = session.sessionsPurchased * session.pricePerSession
    setFormData({
      ptNumber: session.ptNumber.toString(),
      clientName: session.clientName,
      phone: session.phone,
      sessionsPurchased: session.sessionsPurchased,
      sessionsRemaining: session.sessionsRemaining,
      coachName: session.coachName,
      totalPrice: totalPrice,
      remainingAmount: session.remainingAmount || 0,
      startDate: session.startDate ? formatDateYMD(session.startDate) : '',
      expiryDate: session.expiryDate ? formatDateYMD(session.expiryDate) : '',
      paymentMethod: 'cash',
      staffName: user?.name || '',
    })
    setEditingSession(session)
    setShowForm(true)
    // تحديد إذا كان Day Use
    setIsDayUse(session.ptNumber < 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    

    try {
      const url = '/api/pt'
      const method = editingSession ? 'PUT' : 'POST'
      const body = editingSession
        ? { ptNumber: editingSession.ptNumber, ...formData, staffName: user?.name || '' }
        : { ...formData, staffName: user?.name || '' }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(editingSession ? t('pt.messages.sessionUpdated') : t('pt.messages.sessionAdded'))
        refetchSessions()
        resetForm()
      } else {
        toast.error(`${t('pt.messages.operationFailed')} - ${result.error || ''}`)
      }
    } catch (error) {
      console.error(error)
      toast.error(t('pt.messages.error'))
    } finally {
      
    }
  }

  const handleDelete = async (ptNumber: number) => {
    const confirmed = await confirm({
      title: t('pt.deleteConfirm.title'),
      message: t('pt.deleteConfirm.message', { ptNumber: ptNumber.toString() }),
      confirmText: t('pt.deleteConfirm.confirm'),
      cancelText: t('pt.deleteConfirm.cancel'),
      type: 'danger'
    })

    if (!confirmed) return

    // ✅ Optimistic Update
    const previousData = queryClient.getQueryData<any[]>(['pt-sessions'])
    queryClient.setQueryData<any[]>(['pt-sessions'], (old) =>
      old ? old.filter(s => s.ptNumber !== ptNumber) : old
    )

    try {
      const response = await fetch(`/api/pt?ptNumber=${ptNumber}`, { method: 'DELETE' })

      if (!response.ok) {
        const errorData = await response.json()
        queryClient.setQueryData(['pt-sessions'], previousData)
        throw new Error(errorData.error || t('pt.messages.deleteFailed'))
      }

      toast.success(t('pt.messages.sessionDeleted'))
      queryClient.invalidateQueries({ queryKey: ['pt-sessions'] })
    } catch (error: any) {
      queryClient.setQueryData(['pt-sessions'], previousData)
      console.error('Error:', error)
      toast.error(`${t('pt.messages.deleteFailed')} - ${error.message || ''}`)
    }
  }

  const handleRenew = (session: PTSession) => {
    router.push(`/pt/renew?ptNumber=${session.ptNumber}`)
  }

  const handleRegisterSession = (session: PTSession) => {
    router.push(`/pt/sessions/register?ptNumber=${session.ptNumber}`)
  }

  const handleOpenPaymentModal = async (session: PTSession) => {
    setPaymentSession(session)
    setPaymentFormData({
      paymentAmount: session.remainingAmount || 0,
      paymentMethod: 'cash'
    })

    // جلب نقاط العضو
    try {
      const response = await fetch(`/api/members?phone=${encodeURIComponent(session.phone)}`)
      if (response.ok) {
        const members = await response.json()
        if (members.length > 0) {
          setMemberPoints(members[0].points || 0)
        } else {
          setMemberPoints(0)
        }
      }
    } catch (error) {
      console.error('Error fetching member points:', error)
      setMemberPoints(0)
    }

    setShowPaymentModal(true)
  }

  const handlePayRemaining = async () => {
    if (!paymentSession) return

    try {
      
      const response = await fetch('/api/pt/pay-remaining', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ptNumber: paymentSession.ptNumber,
          paymentAmount: paymentFormData.paymentAmount,
          paymentMethod: paymentFormData.paymentMethod,
          staffName: user?.name || ''
        })
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(t('pt.messages.paymentSuccess'))
        refetchSessions()
        setShowPaymentModal(false)
        setPaymentSession(null)
      } else {
        toast.error(`${t('pt.messages.paymentFailed')} - ${result.error || ''}`)
      }
    } catch (error) {
      console.error('Error paying remaining:', error)
      toast.error(t('pt.messages.paymentFailed'))
    } finally {
      
    }
  }

  const filteredSessions = sessions.filter((session) => {
    // البحث النصي
    const matchesSearch =
      session.clientName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      session.coachName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      session.ptNumber.toString().includes(debouncedSearchTerm) ||
      session.phone.includes(debouncedSearchTerm)

    // فلتر المدرب
    const matchesCoach = filterCoach === '' || session.coachName === filterCoach

    // فلتر الحالة
    let matchesStatus = true
    if (filterStatus !== 'all') {
      const isExpired = session.expiryDate && new Date(session.expiryDate) < new Date()
      const isExpiringSoon =
        session.expiryDate &&
        new Date(session.expiryDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) &&
        !isExpired

      if (filterStatus === 'expired') matchesStatus = isExpired
      else if (filterStatus === 'expiring') matchesStatus = isExpiringSoon
      else if (filterStatus === 'active') matchesStatus = !isExpired && !isExpiringSoon
    }

    // فلتر الجلسات
    let matchesSessions = true
    if (filterSessions === 'zero') matchesSessions = session.sessionsRemaining === 0
    else if (filterSessions === 'low') matchesSessions = session.sessionsRemaining > 0 && session.sessionsRemaining <= 3

    // فلتر النوع (PT عادي / Day Use)
    let matchesType = true
    if (filterType === 'regular') matchesType = session.ptNumber >= 0
    else if (filterType === 'dayuse') matchesType = session.ptNumber < 0

    return matchesSearch && matchesCoach && matchesStatus && matchesSessions && matchesType
  })

  // ✅ التحقق من الصلاحيات
  if (permissionsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl">{t('pt.loading')}</div>
      </div>
    )
  }

  if (!hasPermission('canViewPT')) {
    return <PermissionDenied message={t('pt.noPermission')} />
  }

  // ✅ حالة التحميل مع Skeleton
  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4"></div>
          <LoadingSkeleton type="stats" />
        </div>
        <LoadingSkeleton type="table" count={8} />
      </div>
    )
  }

  const isCoach = user?.role === 'COACH'

  return (
    <div className="container mx-auto p-4 sm:p-6" dir={direction}>
      <div className="mb-6">
        <div className="mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 dark:text-white">💪 {t('pt.title')}</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
            {isCoach ? t('pt.viewSessions') : t('pt.manageSessions')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button
            onClick={() => router.push('/pt/commission')}
            className="flex-1 min-w-[140px] sm:flex-none bg-gradient-to-r from-primary-600 to-primary-700 text-white px-3 sm:px-6 py-2 rounded-lg hover:from-primary-700 hover:to-primary-800 transition shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <span>💰</span>
            <span>{t('pt.commissionCalculator')}</span>
          </button>
          <button
            onClick={() => router.push('/pt/sessions/history')}
            className="flex-1 min-w-[140px] sm:flex-none bg-gradient-to-r from-primary-600 to-primary-700 text-white px-3 sm:px-6 py-2 rounded-lg hover:from-primary-700 hover:to-primary-800 transition shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <span>📊</span>
            <span>{t('pt.attendanceLog')}</span>
          </button>
          {!isCoach && (
            <button
              onClick={() => {
                resetForm()
                setShowForm(!showForm)
              }}
              className="w-full sm:w-auto bg-primary-600 text-white px-3 sm:px-6 py-2 rounded-lg hover:bg-primary-700 transition flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              {showForm ? t('pt.hideForm') : `➕ ${t('pt.addNewSession')}`}
            </button>
          )}
        </div>
      </div>

      {!isCoach && showForm && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg mb-6 border-2 border-primary-100 dark:border-primary-700" dir={direction}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              {editingSession ? t('pt.editSession') : t('pt.addSession')}
            </h2>
            {editingSession && isDayUse && (
              <span className="bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-200 px-3 py-1 rounded-full text-sm font-bold">
                🏃 Day Use
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!isDayUse && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('pt.ptId')} <span className="text-xs text-gray-500 dark:text-gray-400">(اختياري)</span>
                  </label>
                  <input
                    type="number"
                    disabled={!!editingSession}
                    value={formData.ptNumber}
                    onChange={(e) => setFormData({ ...formData, ptNumber: e.target.value })}
                    onKeyPress={handleIdKeyPress}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg disabled:bg-gray-100 dark:disabled:bg-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="اختياري - يمكن تركه فارغ"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">💡 اضغط Enter لتحميل بيانات العضو تلقائياً</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('pt.clientName')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder={t('pt.clientNamePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('pt.phoneNumber')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder={t('pt.phonePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('pt.coachName')} <span className="text-red-600">*</span>
                </label>
                {coachesLoading ? (
                  <div className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                    {t('pt.loadingCoaches')}
                  </div>
                ) : coaches.length === 0 ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      required
                      value={formData.coachName}
                      onChange={(e) => setFormData({ ...formData, coachName: e.target.value })}
                      className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      placeholder={t('pt.coachNamePlaceholder')}
                    />
                    <p className="text-xs text-amber-600">
                      ⚠️ {t('pt.noActiveCoaches')}
                    </p>
                  </div>
                ) : (
                  <select
                    required
                    value={formData.coachName}
                    onChange={(e) => setFormData({ ...formData, coachName: e.target.value })}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">{t('pt.selectCoach')}</option>
                    {coaches.map((coach) => (
                      <option key={coach.id} value={coach.name}>
                        {coach.name} {coach.phone && `(${coach.phone})`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Day Use Checkbox - مخفي في وضع التعديل */}
              {!editingSession && (
                <div className="bg-primary-50 dark:bg-primary-900/50 border-2 border-primary-200 dark:border-primary-700 rounded-lg p-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDayUse}
                      onChange={(e) => {
                      setIsDayUse(e.target.checked)
                      // إذا تم تفعيل Day Use، اضبط عدد الجلسات على 1 والمبلغ المتبقي على 0 ورقم PT سالب
                      if (e.target.checked) {
                        setFormData(prev => ({
                          ...prev,
                          ptNumber: '-1',
                          sessionsPurchased: 1,
                          remainingAmount: 0
                        }))
                      } else {
                        // إذا تم إلغاء Day Use، امسح رقم PT
                        setFormData(prev => ({
                          ...prev,
                          ptNumber: ''
                        }))
                      }
                    }}
                    className="w-5 h-5"
                  />
                  <div>
                    <span className="text-sm font-bold text-primary-800 dark:text-primary-200">
                      🏃 Day Use (استخدام يومي)
                    </span>
                    <p className="text-xs text-primary-600 dark:text-primary-300 mt-1">
                      تسجيل مبسط - اسم ورقم وسعر الجلسة فقط
                    </p>
                  </div>
                </label>
              </div>
              )}

              {/* اختيار باقة جاهزة */}
              {!isDayUse && !editingSession && packages.length > 0 && (
                <div className="col-span-full">
                  <label className="block text-sm font-medium mb-2">
                    ⚡ {t('packages.selectPackage')}
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {packages.map((pkg) => (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => applyPackage(pkg)}
                        className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-900/30 hover:from-primary-100 hover:to-primary-200 dark:hover:from-primary-800/40 dark:hover:to-primary-800/40 border-2 border-primary-300 dark:border-primary-700 rounded-lg p-3 transition-all hover:scale-105 hover:shadow-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      >
                        <div className="text-center">
                          <div className="text-2xl mb-1">💪</div>
                          <div className="font-bold text-gray-800 dark:text-gray-100 text-sm">{pkg.name}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                            {pkg.sessions} {t('packages.sessions')}
                          </div>
                          <div className="text-lg font-bold text-primary-600 dark:text-primary-400 mt-1">
                            {pkg.price} {t('pt.egp')}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    💡 {t('packages.customPackage')}: يمكنك تعديل القيم بعد اختيار الباقة
                  </p>
                </div>
              )}

              {!isDayUse && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('pt.sessionsCount')} <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.sessionsPurchased}
                    onChange={(e) => setFormData({ ...formData, sessionsPurchased: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    placeholder={t('pt.sessionsPlaceholder')}
                  />
                </div>
              )}

              {!isDayUse && editingSession && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    الجلسات المتبقية <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.sessionsRemaining}
                    onChange={(e) => setFormData({ ...formData, sessionsRemaining: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg bg-primary-50 dark:bg-primary-900/50 border-primary-300 dark:border-primary-600 dark:text-white"
                    placeholder="عدد الجلسات المتبقية"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    💡 يمكنك تعديل عدد الجلسات المتبقية للعميل
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  {isDayUse ? 'سعر الجلسة 💰' : t('pt.totalPrice')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.totalPrice}
                  onChange={(e) => setFormData({ ...formData, totalPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg bg-yellow-50 dark:bg-yellow-900/50 border-yellow-300 dark:border-yellow-600 dark:text-white"
                  placeholder={isDayUse ? 'أدخل سعر الجلسة' : t('pt.totalPricePlaceholder')}
                />
              </div>

              {!isDayUse && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('pt.remainingAmount')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.remainingAmount}
                    onChange={(e) => setFormData({ ...formData, remainingAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg bg-orange-50 dark:bg-orange-900/50 border-orange-300 dark:border-orange-600 dark:text-white"
                    placeholder={t('pt.remainingAmountPlaceholder')}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('pt.remainingAmountNote')}
                  </p>
                </div>
              )}

              {!isDayUse && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('pt.startDate')} <span className="text-xs text-gray-500 dark:text-gray-400">{t('pt.startDateFormat')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg font-mono dark:bg-gray-700 dark:text-white"
                    placeholder={t('pt.startDatePlaceholder')}
                    pattern="\d{4}-\d{2}-\d{2}"
                  />
                </div>
              )}

              {!isDayUse && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('pt.expiryDate')} <span className="text-xs text-gray-500 dark:text-gray-400">{t('pt.startDateFormat')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg font-mono dark:bg-gray-700 dark:text-white"
                    placeholder={t('pt.expiryDatePlaceholder')}
                    pattern="\d{4}-\d{2}-\d{2}"
                  />
                </div>
              )}
            </div>

            {!isDayUse && (
              <div>
                <p className="text-sm font-medium mb-2">{t('pt.quickAdd')}</p>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 6, 9, 12].map(months => (
                    <button
                      key={months}
                      type="button"
                      onClick={() => calculateExpiryFromMonths(months)}
                      className="px-3 py-2 bg-primary-100 hover:bg-primary-200 text-primary-800 rounded-lg text-sm transition font-medium"
                    >
                      + {months} {months === 1 ? t('pt.month') : t('pt.months')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <PaymentMethodSelector
                value={formData.paymentMethod}
                onChange={(method) => setFormData({ ...formData, paymentMethod: method })}
                allowMultiple={true}
                totalAmount={formData.totalPrice - formData.remainingAmount}
                required={false}
                memberPoints={memberPoints}
                pointsValueInEGP={settings.pointsValueInEGP}
                pointsEnabled={settings.pointsEnabled}
              />
            </div>

            {formData.sessionsPurchased > 0 && formData.totalPrice > 0 && (
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">{t('pt.finalTotal')}</span>
                  <span className="text-2xl font-bold text-green-600">
                    {formData.totalPrice.toFixed(2)} {t('pt.egp')}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2 text-sm border-t pt-2">
                  <span className="font-semibold text-primary-700">{t('pt.paidAmount')}</span>
                  <span className="font-bold text-primary-600">
                    {(formData.totalPrice - formData.remainingAmount).toFixed(2)} {t('pt.egp')}
                  </span>
                </div>
                {formData.remainingAmount > 0 && (
                  <div className="flex justify-between items-center mt-1 text-sm">
                    <span className="font-semibold text-orange-700">{t('pt.remaining')}</span>
                    <span className="font-bold text-orange-600">
                      {formData.remainingAmount.toFixed(2)} {t('pt.egp')}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 disabled:bg-gray-400"
              >
                {loading ? t('pt.saving') : editingSession ? t('pt.updateButton') : t('pt.addSessionButton')}
              </button>
              {editingSession && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  {t('pt.cancelButton')}
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* 🔍 البحث والفلاتر السريعة */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border-2 border-primary-200 dark:border-primary-700" dir={direction}>
        <div className="mb-6">
          <input
            type="text"
            placeholder={`🔍 ${t('pt.searchPlaceholder')}`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border-2 border-primary-200 dark:border-primary-600 rounded-lg text-lg focus:border-primary-400 focus:outline-none transition dark:bg-gray-700 dark:text-white"
          />
        </div>

        {/* 🎯 فلاتر الحالة السريعة */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <span>🎯</span>
              <span>فلاتر سريعة</span>
            </h3>
            {(filterStatus !== 'all' || filterSessions !== 'all') && (
              <button
                onClick={() => {
                  setFilterStatus('all')
                  setFilterSessions('all')
                }}
                className="bg-primary-100 text-primary-600 px-3 py-1.5 rounded-lg hover:bg-primary-200 text-sm font-medium"
              >
                ✖️ إعادة تعيين
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-3 rounded-xl font-bold transition-all transform hover:scale-105 ${
                filterStatus === 'all'
                  ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-xl border-2 border-primary-400'
                  : 'bg-white dark:bg-gray-800 border-2 border-primary-200 dark:border-primary-700 text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/50 hover:border-primary-300 shadow-md'
              }`}
            >
              <div className="text-xl mb-1">📊</div>
              <div className="text-xs">{t('pt.allStatus')}</div>
              <div className="text-lg font-bold dark:text-white">{sessions.length}</div>
            </button>

            <button
              onClick={() => setFilterStatus('active')}
              className={`px-4 py-3 rounded-xl font-bold transition-all transform hover:scale-105 ${
                filterStatus === 'active'
                  ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-xl border-2 border-green-400'
                  : 'bg-white dark:bg-gray-800 border-2 border-green-200 dark:border-green-700 text-gray-700 dark:text-gray-200 hover:bg-green-50 dark:hover:bg-green-900/50 hover:border-green-300 shadow-md'
              }`}
            >
              <div className="text-xl mb-1">🟢</div>
              <div className="text-xs">{t('pt.statusActive')}</div>
              <div className="text-lg font-bold dark:text-white">{sessions.filter(s => !isExpired(s) && !isExpiringSoon(s)).length}</div>
            </button>

            <button
              onClick={() => setFilterStatus('expiring')}
              className={`px-4 py-3 rounded-xl font-bold transition-all transform hover:scale-105 ${
                filterStatus === 'expiring'
                  ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-xl border-2 border-orange-400'
                  : 'bg-white dark:bg-gray-800 border-2 border-orange-200 dark:border-orange-700 text-gray-700 dark:text-gray-200 hover:bg-orange-50 dark:hover:bg-orange-900/50 hover:border-orange-300 shadow-md'
              }`}
            >
              <div className="text-xl mb-1">🟡</div>
              <div className="text-xs">{t('pt.statusExpiring')}</div>
              <div className="text-lg font-bold dark:text-white">{sessions.filter(s => isExpiringSoon(s)).length}</div>
            </button>

            <button
              onClick={() => setFilterStatus('expired')}
              className={`px-4 py-3 rounded-xl font-bold transition-all transform hover:scale-105 ${
                filterStatus === 'expired'
                  ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-xl border-2 border-red-400'
                  : 'bg-white dark:bg-gray-800 border-2 border-red-200 dark:border-red-700 text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-red-900/50 hover:border-red-300 shadow-md'
              }`}
            >
              <div className="text-xl mb-1">🔴</div>
              <div className="text-xs">{t('pt.statusExpired')}</div>
              <div className="text-lg font-bold dark:text-white">{sessions.filter(s => isExpired(s)).length}</div>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button
              onClick={() => setFilterSessions('all')}
              className={`px-4 py-2.5 rounded-lg font-bold transition-all transform hover:scale-105 ${
                filterSessions === 'all'
                  ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg border-2 border-primary-400'
                  : 'bg-white dark:bg-gray-800 border-2 border-primary-200 dark:border-primary-700 text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/50 hover:border-primary-300 shadow'
              }`}
            >
              <div className="text-sm">{t('pt.allSessions')}</div>
            </button>

            <button
              onClick={() => setFilterSessions('low')}
              className={`px-4 py-2.5 rounded-lg font-bold transition-all transform hover:scale-105 ${
                filterSessions === 'low'
                  ? 'bg-gradient-to-br from-yellow-500 to-yellow-600 text-white shadow-lg border-2 border-yellow-400'
                  : 'bg-white dark:bg-gray-800 border-2 border-yellow-200 dark:border-yellow-700 text-gray-700 dark:text-gray-200 hover:bg-yellow-50 dark:hover:bg-yellow-900/50 hover:border-yellow-300 shadow'
              }`}
            >
              <div className="text-sm">{t('pt.sessionsLow')}</div>
              <div className="text-xs opacity-70">({filteredSessions.filter(s => s.sessionsRemaining > 0 && s.sessionsRemaining <= 3).length})</div>
            </button>

            <button
              onClick={() => setFilterSessions('zero')}
              className={`px-4 py-2.5 rounded-lg font-bold transition-all transform hover:scale-105 ${
                filterSessions === 'zero'
                  ? 'bg-gradient-to-br from-gray-600 to-gray-700 text-white shadow-lg border-2 border-gray-500'
                  : 'bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 shadow'
              }`}
            >
              <div className="text-sm">{t('pt.sessionsZero')}</div>
              <div className="text-xs opacity-70">({filteredSessions.filter(s => s.sessionsRemaining === 0).length})</div>
            </button>
          </div>
        </div>

        {/* 👨‍🏫 فلتر المدربين والنوع */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-2">👨‍🏫 {t('pt.filterByCoach')}</label>
            <select
              value={filterCoach}
              onChange={(e) => setFilterCoach(e.target.value)}
              className="w-full px-3 py-2.5 border-2 border-primary-200 dark:border-primary-600 rounded-lg focus:border-primary-400 focus:outline-none transition dark:bg-gray-700 dark:text-white"
            >
              <option value="">{t('pt.allCoaches')}</option>
              {(Array.from(new Set(sessions.map(s => s.coachName).filter((name): name is string => !!name))) as string[]).sort().map(coach => (
                <option key={coach} value={coach}>{coach}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">📝 نوع الجلسة</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-3 py-2.5 border-2 border-primary-200 dark:border-primary-600 rounded-lg focus:border-primary-400 focus:outline-none transition dark:bg-gray-700 dark:text-white"
            >
              <option value="all">الكل</option>
              <option value="regular">PT عادي</option>
              <option value="dayuse">🏃 Day Use</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">{t('pt.loading')}</div>
      ) : (
        <>
          {/* Desktop Table - Hidden on mobile/tablet */}
          <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" dir={direction}>
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('pt.ptNumber')}</th>
                    <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('pt.client')}</th>
                    <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('pt.coach')}</th>
                    <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('pt.sessions')}</th>
                    <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('pt.total')}</th>
                    <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('pt.remaining')}</th>
                    <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('pt.dates')}</th>
                    {!isCoach && <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('pt.actions')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map((session) => {
                    const isExpiringSoon =
                      session.expiryDate &&
                      new Date(session.expiryDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                    const isExpired = session.expiryDate && new Date(session.expiryDate) < new Date()

                    return (
                      <tr
                        key={session.ptNumber}
                        className={`border-t border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                          isExpired ? 'bg-red-50 dark:bg-red-900/50' : isExpiringSoon ? 'bg-yellow-50 dark:bg-yellow-900/50' : 'bg-white dark:bg-gray-800'
                        }`}
                      >
                        <td className="px-4 py-3">
                          {session.ptNumber < 0 ? (
                            <span className="font-bold text-primary-600">🏃 Day Use</span>
                          ) : (
                            <span className="font-bold text-primary-600">#{session.ptNumber}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-semibold">{session.clientName}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">{session.phone}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">{session.coachName}</td>
                        <td className="px-4 py-3">
                          <div className="text-center">
                            <p
                              className={`font-bold ${
                                session.sessionsRemaining === 0
                                  ? 'text-red-600'
                                  : session.sessionsRemaining <= 3
                                  ? 'text-orange-600'
                                  : 'text-green-600'
                              }`}
                            >
                              {session.sessionsRemaining}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{t('pt.of')} {session.sessionsPurchased}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-green-600">
                          {(session.sessionsPurchased * session.pricePerSession).toFixed(0)} {t('pt.egp')}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`font-bold ${
                              (session.remainingAmount || 0) > 0
                                ? 'text-orange-600'
                                : 'text-green-600'
                            }`}
                          >
                            {(session.remainingAmount || 0).toFixed(0)} {t('pt.egp')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs font-mono">
                            {session.startDate && (
                              <p>{t('pt.from')} {formatDateYMD(session.startDate)}</p>
                            )}
                            {session.expiryDate && (
                              <p className={isExpired ? 'text-red-600 font-bold' : ''}>
                                {t('pt.to')} {formatDateYMD(session.expiryDate)}
                              </p>
                            )}
                            {isExpired && <p className="text-red-600 font-bold">{t('pt.expired')}</p>}
                            {!isExpired && isExpiringSoon && (
                              <p className="text-orange-600 font-bold">{t('pt.expiringSoon')}</p>
                            )}
                          </div>
                        </td>
                        {!isCoach && (
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {/* إخفاء زر الحضور للـ Day Use */}
                              {session.ptNumber >= 0 && (
                                <button
                                  onClick={() => handleRegisterSession(session)}
                                  disabled={session.sessionsRemaining === 0}
                                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                  {t('pt.attendance')}
                                </button>
                              )}
                              {session.ptNumber >= 0 && (
                                <button
                                  onClick={() => handleRenew(session)}
                                  className="bg-primary-600 text-white px-3 py-1 rounded text-sm hover:bg-primary-700"
                                >
                                  {t('pt.renew')}
                                </button>
                              )}
                              {(session.remainingAmount || 0) > 0 && (
                                <button
                                  onClick={() => handleOpenPaymentModal(session)}
                                  className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700"
                                >
                                  {t('pt.payRemaining')}
                                </button>
                              )}
                              <button
                                onClick={() => handleEdit(session)}
                                className="bg-primary-600 text-white px-3 py-1 rounded text-sm hover:bg-primary-700 flex items-center gap-1"
                              >
                                ✏️ {t('pt.edit')}
                              </button>
                              <button
                                onClick={() => handleDelete(session.ptNumber)}
                                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 flex items-center gap-1"
                              >
                                {t('pt.delete')}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile/Tablet Cards - Hidden on desktop */}
          <div className="lg:hidden space-y-3" dir={direction}>
            {filteredSessions.map((session) => {
              const isExpiringSoon =
                session.expiryDate &&
                new Date(session.expiryDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              const isExpired = session.expiryDate && new Date(session.expiryDate) < new Date()

              return (
                <div
                  key={session.ptNumber}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border-2 hover:shadow-lg dark:hover:shadow-2xl transition ${
                    isExpired ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20' : isExpiringSoon ? 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-600'
                  }`}
                >
                  {/* Header */}
                  <div className={`p-2.5 ${isExpired ? 'bg-red-600 dark:bg-red-700' : isExpiringSoon ? 'bg-orange-600 dark:bg-orange-700' : 'bg-gradient-to-r from-primary-600 to-primary-700 dark:from-primary-700 dark:to-primary-800'}`}>
                    <div className="flex items-center justify-between">
                      <div className="text-xl font-bold text-white">
                        {session.ptNumber < 0 ? '🏃 Day Use' : `#${session.ptNumber}`}
                      </div>
                      <div className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        session.sessionsRemaining === 0 ? 'bg-red-500 dark:bg-red-600' : session.sessionsRemaining <= 3 ? 'bg-orange-500 dark:bg-orange-600' : 'bg-green-500 dark:bg-green-600'
                      } text-white`}>
                        {session.sessionsRemaining} / {session.sessionsPurchased} {t('pt.session')}
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-3 space-y-2.5">
                    {/* Client Info */}
                    <div className="pb-2.5 border-b-2 border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">👤</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">{t('pt.client')}</span>
                      </div>
                      <div className="text-base font-bold text-gray-800 dark:text-gray-100">{session.clientName}</div>
                      <div className="text-sm font-mono text-gray-600 dark:text-gray-300 mt-1">{session.phone}</div>
                    </div>

                    {/* Coach */}
                    <div className="pb-2.5 border-b-2 border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">🏋️</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">{t('pt.coach')}</span>
                      </div>
                      <div className="text-base font-bold text-gray-800 dark:text-gray-100">{session.coachName}</div>
                    </div>

                    {/* Price Info */}
                    <div className="bg-green-50 dark:bg-green-900/30 border-2 border-green-200 dark:border-green-700 rounded-lg p-2.5">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-sm">💵</span>
                        <span className="text-xs text-green-700 dark:text-green-300 font-semibold">{t('pt.total')}</span>
                      </div>
                      <div className="text-base font-bold text-green-600 dark:text-green-400">
                        {(session.sessionsPurchased * session.pricePerSession).toFixed(0)} {t('pt.egp')}
                      </div>
                    </div>

                    {/* Remaining Amount */}
                    {(session.remainingAmount || 0) > 0 && (
                      <div className="bg-orange-50 dark:bg-orange-900/30 border-2 border-orange-300 dark:border-orange-700 rounded-lg p-2.5">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-sm">⚠️</span>
                          <span className="text-xs text-orange-700 dark:text-orange-300 font-semibold">{t('pt.remainingAmountLabel')}</span>
                        </div>
                        <div className="text-base font-bold text-orange-600 dark:text-orange-400">
                          {(session.remainingAmount || 0).toFixed(0)} {t('pt.egp')}
                        </div>
                      </div>
                    )}

                    {/* Dates */}
                    {(session.startDate || session.expiryDate) && (
                      <div className={`border-2 rounded-lg p-2.5 ${
                        isExpired ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700' : isExpiringSoon ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm">📅</span>
                          <span className={`text-xs font-semibold ${
                            isExpired ? 'text-red-700 dark:text-red-400' : isExpiringSoon ? 'text-orange-700 dark:text-orange-400' : 'text-gray-700 dark:text-gray-200'
                          }`}>{t('pt.period')}</span>
                        </div>
                        <div className="space-y-1 text-xs font-mono">
                          {session.startDate && (
                            <div className="text-gray-700 dark:text-gray-200">{t('pt.from')} {formatDateYMD(session.startDate)}</div>
                          )}
                          {session.expiryDate && (
                            <div className={isExpired ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-700 dark:text-gray-200'}>
                              {t('pt.to')} {formatDateYMD(session.expiryDate)}
                            </div>
                          )}
                          {isExpired && (
                            <div className="text-red-600 dark:text-red-400 font-bold">{t('pt.expired')}</div>
                          )}
                          {!isExpired && isExpiringSoon && (
                            <div className="text-orange-600 dark:text-orange-400 font-bold">{t('pt.expiringSoon')}</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {!isCoach && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {/* إخفاء أزرار الحضور والتجديد للـ Day Use */}
                        {session.ptNumber >= 0 && (
                          <>
                            <button
                              onClick={() => handleRegisterSession(session)}
                              disabled={session.sessionsRemaining === 0}
                              className="bg-green-600 text-white py-2 rounded-lg text-sm hover:bg-green-700 dark:hover:bg-green-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed font-bold flex items-center justify-center gap-1"
                            >
                              {t('pt.attendance')}
                            </button>
                            <button
                              onClick={() => handleRenew(session)}
                              className="bg-primary-600 text-white py-2 rounded-lg text-sm hover:bg-primary-700 dark:hover:bg-primary-800 font-bold flex items-center justify-center gap-1"
                            >
                              {t('pt.renew')}
                            </button>
                          </>
                        )}
                        {(session.remainingAmount || 0) > 0 && (
                          <button
                            onClick={() => handleOpenPaymentModal(session)}
                            className="col-span-2 bg-orange-600 text-white py-2 rounded-lg text-sm hover:bg-orange-700 dark:hover:bg-orange-800 font-bold flex items-center justify-center gap-1"
                          >
                            <span>💰</span>
                            <span>{t('pt.payRemaining').replace('💰 ', '')} ({(session.remainingAmount || 0).toFixed(0)} {t('pt.egp')})</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(session)}
                          className="bg-primary-600 text-white py-2 rounded-lg text-sm hover:bg-primary-700 dark:hover:bg-primary-800 font-bold flex items-center justify-center gap-1"
                        >
                          <span>✏️</span>
                          <span>{t('pt.edit')}</span>
                        </button>
                        <button
                          onClick={() => handleDelete(session.ptNumber)}
                          className="bg-red-600 text-white py-2 rounded-lg text-sm hover:bg-red-700 dark:hover:bg-red-800 font-bold flex items-center justify-center gap-1"
                        >
                          <span>🗑️</span>
                          <span>{t('pt.deleteSubscription')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {filteredSessions.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md dark:bg-gray-800 p-12 text-center text-gray-500 dark:text-gray-400">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-xl">{searchTerm ? t('pt.noSearchResults') : t('pt.noSessions')}</p>
            </div>
          )}
        </>
      )}

      {/* Barcode Modal */}
      {showQRModal && selectedSession && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl dark:bg-gray-800 max-w-lg w-full p-6" dir={direction}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">{t('pt.barcodeModal.title')} - {selectedSession.clientName}</h2>
              <button
                onClick={() => {
                  setShowQRModal(false)
                  setSelectedSession(null)
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300 text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* معلومات الاشتراك */}
              <div className="bg-gradient-to-r from-primary-50 to-primary-50 border-2 border-primary-200 rounded-lg p-4 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-300">{t('pt.ptNumber')}:</span>
                    <span className="font-bold mr-2">#{selectedSession.ptNumber}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-300">{t('pt.coach')}:</span>
                    <span className="font-bold mr-2">{selectedSession.coachName}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-300">{t('pt.barcodeModal.sessionsRemaining')}</span>
                    <span className="font-bold mr-2 text-green-600">
                      {selectedSession.sessionsRemaining} / {selectedSession.sessionsPurchased}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-300">{t('pt.barcodeModal.phone')}</span>
                    <span className="font-bold mr-2">{selectedSession.phone}</span>
                  </div>
                </div>
              </div>

              {/* Barcode Image */}
              {selectedSession.qrCodeImage ? (
                <div className="flex flex-col items-center bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-lg p-6">
                  <img
                    src={selectedSession.qrCodeImage}
                    alt="Barcode"
                    className="w-full max-w-md h-auto"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
                    {t('pt.barcodeModal.scanNote')}
                  </p>
                </div>
              ) : (
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-6 text-center">
                  <p className="text-gray-500 dark:text-gray-400">{t('pt.barcodeModal.noBarcode')}</p>
                </div>
              )}

              {/* Barcode Text */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('pt.barcodeModal.ptCode')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={selectedSession.qrCode}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedSession.qrCode || '')
                      toast.success(t('pt.barcodeModal.codeCopied'))
                    }}
                    className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 text-sm font-medium"
                  >
                    {t('pt.barcodeModal.copyCode')}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                {/* زر تحميل Barcode */}
                <button
                  onClick={() => {
                    if (!selectedSession.qrCodeImage) return

                    // تحويل base64 إلى blob
                    const link = document.createElement('a')
                    link.href = selectedSession.qrCodeImage
                    link.download = `PT_${selectedSession.ptNumber}_${selectedSession.clientName}_QR.png`
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)

                    toast.success(t('pt.barcodeModal.barcodeDownloaded'))
                  }}
                  className="bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 font-bold flex items-center justify-center gap-2"
                >
                  {t('pt.barcodeModal.downloadQR')}
                </button>

                {/* زر مشاركة Barcode (للموبايل) */}
                <button
                  onClick={async () => {
                    if (!selectedSession.qrCodeImage) return

                    try {
                      // تحويل base64 إلى blob
                      const response = await fetch(selectedSession.qrCodeImage)
                      const blob = await response.blob()
                      const file = new File([blob], `PT_QR_${selectedSession.clientName}.png`, { type: 'image/png' })

                      // استخدام Share API
                      if (navigator.share && navigator.canShare({ files: [file] })) {
                        await navigator.share({
                          title: `Barcode - ${selectedSession.clientName}`,
                          text: t('pt.whatsappShareText', {
                            clientName: selectedSession.clientName,
                            sessionsRemaining: selectedSession.sessionsRemaining.toString(),
                            sessionsPurchased: selectedSession.sessionsPurchased.toString(),
                            coachName: selectedSession.coachName
                          }),
                          files: [file]
                        })
                        toast.success(t('pt.barcodeModal.barcodeDownloaded'))
                      } else {
                        // Fallback: تحميل الصورة
                        const link = document.createElement('a')
                        link.href = selectedSession.qrCodeImage
                        link.download = `PT_${selectedSession.ptNumber}_QR.png`
                        link.click()
                        toast.info(t('pt.barcodeModal.shareNotSupported'))
                      }
                    } catch (error) {
                      console.error('Share error:', error)
                      toast.error(t('pt.barcodeModal.shareFailed'))
                    }
                  }}
                  className="bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-bold flex items-center justify-center gap-2"
                >
                  {t('pt.barcodeModal.shareQR')}
                </button>

                {/* زر إرسال رابط واتساب */}
                <button
                  onClick={() => {
                    const checkInUrl = `${window.location.origin}/pt/check-in`
                    const text = t('pt.whatsappWithLink', {
                      clientName: selectedSession.clientName,
                      checkInUrl,
                      sessionsRemaining: selectedSession.sessionsRemaining.toString(),
                      sessionsPurchased: selectedSession.sessionsPurchased.toString(),
                      coachName: selectedSession.coachName
                    })
                    const phone = selectedSession.phone.startsWith('0') ? '2' + selectedSession.phone : selectedSession.phone
                    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
                    window.open(whatsappUrl, '_blank')
                  }}
                  className="col-span-2 bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 font-bold flex items-center justify-center gap-2"
                >
                  {t('pt.barcodeModal.sendWhatsAppLink')}
                </button>
              </div>

              <div className="bg-primary-50 border-r-4 border-primary-500 p-3 rounded">
                <p className="text-xs text-primary-800">
                  {t('pt.barcodeModal.note')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && paymentSession && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl dark:bg-gray-800 max-w-3xl w-full p-6" dir={direction}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">{t('pt.paymentModal.title')}</h2>
              <button
                onClick={() => {
                  setShowPaymentModal(false)
                  setPaymentSession(null)
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-300 text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* العمود الأيسر - معلومات الاشتراك */}
              <div className="space-y-3">
                {/* معلومات الاشتراك */}
                <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-lg p-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">{t('pt.ptNumber')}:</span>
                      <span className="font-bold">#{paymentSession.ptNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">{t('pt.client')}:</span>
                      <span className="font-bold">{paymentSession.clientName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">{t('pt.coach')}:</span>
                      <span className="font-bold">{paymentSession.coachName}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1.5">
                      <span className="text-orange-700 font-semibold">{t('pt.paymentModal.remainingAmount')}</span>
                      <span className="font-bold text-orange-600 text-lg">
                        {(paymentSession.remainingAmount || 0).toFixed(0)} {t('pt.egp')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* المبلغ المتبقي بعد الدفع */}
                {paymentFormData.paymentAmount > 0 && (
                  <div className="bg-primary-50 border-2 border-primary-200 rounded-lg p-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-primary-700 font-semibold">
                        {t('pt.paymentModal.remainingAfterPayment')}
                      </span>
                      <span className="text-lg font-bold text-primary-600">
                        {((paymentSession.remainingAmount || 0) - paymentFormData.paymentAmount).toFixed(0)} {t('pt.egp')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* العمود الأيمن - الدفع */}
              <div className="space-y-3">
                {/* مبلغ الدفع */}
                <div>
                  <label className="block text-sm font-bold mb-1.5">
                    {t('pt.paymentModal.paymentAmountRequired')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={paymentSession.remainingAmount || 0}
                    step="0.01"
                    value={paymentFormData.paymentAmount}
                    onChange={(e) =>
                      setPaymentFormData({
                        ...paymentFormData,
                        paymentAmount: parseFloat(e.target.value) || 0
                      })
                    }
                    className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-bold dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentFormData({
                          ...paymentFormData,
                          paymentAmount: paymentSession.remainingAmount || 0
                        })
                      }
                      className="flex-1 px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded text-sm font-medium"
                    >
                      {t('pt.paymentModal.payAll')} ({(paymentSession.remainingAmount || 0).toFixed(0)})
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPaymentFormData({
                          ...paymentFormData,
                          paymentAmount: (paymentSession.remainingAmount || 0) / 2
                        })
                      }
                      className="flex-1 px-3 py-1.5 bg-primary-100 hover:bg-primary-200 text-primary-800 rounded text-sm font-medium"
                    >
                      {t('pt.paymentModal.payHalf')} ({((paymentSession.remainingAmount || 0) / 2).toFixed(0)})
                    </button>
                  </div>
                </div>

                {/* طريقة الدفع */}
                <div>
                  <PaymentMethodSelector
                    value={paymentFormData.paymentMethod}
                    onChange={(method) => setPaymentFormData({ ...paymentFormData, paymentMethod: method })}
                    allowMultiple={true}
                    totalAmount={paymentFormData.paymentAmount}
                    required={true}
                    memberPoints={memberPoints}
                    pointsValueInEGP={settings.pointsValueInEGP}
                    pointsEnabled={settings.pointsEnabled}
                  />
                </div>
              </div>
            </div>

            {/* أزرار الإجراءات */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={() => {
                  setShowPaymentModal(false)
                  setPaymentSession(null)
                }}
                className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg hover:bg-gray-300 font-bold"
              >
                {t('pt.deleteConfirm.cancel')}
              </button>
              <button
                onClick={handlePayRemaining}
                disabled={loading || paymentFormData.paymentAmount <= 0 || paymentFormData.paymentAmount > (paymentSession.remainingAmount || 0)}
                className="bg-orange-600 text-white py-2.5 rounded-lg hover:bg-orange-700 font-bold disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? t('pt.paymentModal.paying') : t('pt.paymentModal.confirmPayment')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={isOpen}
        title={options.title}
        message={options.message}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        type={options.type}
      />
    </div>
  )
}
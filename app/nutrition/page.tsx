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
import { fetchStaff } from '../../lib/api/pt'
import { useServiceSettings } from '../../contexts/ServiceSettingsContext'
import { useDebounce } from '../../hooks/useDebounce'
import CoachSelector from '../../components/CoachSelector'
import NutritionRenewalForm from '../../components/NutritionRenewalForm'
import { LoadingScreen } from '../../components/Spinner'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface Staff {
  id: string
  name: string
  phone?: string
  position?: string
  isActive: boolean
}

interface NutritionSession {
  nutritionNumber: number
  clientName: string
  phone: string
  sessionsPurchased: number
  sessionsRemaining: number
  nutritionistName: string
  pricePerSession: number
  remainingAmount?: number
  startDate: string | null
  expiryDate: string | null
  createdAt: string
  qrCode?: string
  qrCodeImage?: string
}

export default function NutritionPage() {
  const router = useRouter()
  const { hasPermission, loading: permissionsLoading, user } = usePermissions()
  const { t, direction } = useLanguage()
  const toast = useToast()
  const { confirm, isOpen, options, handleConfirm, handleCancel } = useConfirm()
  const { settings } = useServiceSettings()
  const queryClient = useQueryClient()

  // استخدام useQuery لجلب جلسات Nutrition
  const {
    data: sessions = [],
    isLoading: loading,
    error: sessionsError,
    refetch: refetchSessions
  } = useQuery({
    queryKey: ['nutrition-sessions'],
    queryFn: async () => {
      const response = await fetch('/api/nutrition')
      if (!response.ok) {
        if (response.status === 401) throw new Error('UNAUTHORIZED')
        if (response.status === 403) throw new Error('FORBIDDEN')
        throw new Error('Failed to fetch nutrition sessions')
      }
      return response.json()
    },
    enabled: !permissionsLoading && hasPermission('canViewNutrition'),
    retry: 1,
    staleTime: 2 * 60 * 1000,
  })

  // استخدام useQuery لجلب جميع الموظفين النشطين
  const {
    data: coaches = [],
    isLoading: coachesLoading
  } = useQuery({
    queryKey: ['staff'],
    queryFn: fetchStaff,
    enabled: !permissionsLoading,
    retry: 1,
    staleTime: 5 * 60 * 1000, // الموظفين مش بيتغيروا كتير
  })

  const [showForm, setShowForm] = useState(false)
  const [editingSession, setEditingSession] = useState<NutritionSession | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [selectedSession, setSelectedSession] = useState<NutritionSession | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentSession, setPaymentSession] = useState<NutritionSession | null>(null)
  const [renewalSession, setRenewalSession] = useState<NutritionSession | null>(null)
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
  const [memberNumber, setMemberNumber] = useState<string | null>(null)

  const [formData, setFormData] = useState<{
    nutritionNumber: string
    clientName: string
    phone: string
    memberNumber?: string | null
    sessionsPurchased: number
    sessionsRemaining: number
    nutritionistName: string
    totalPrice: number
    remainingAmount: number
    startDate: string
    expiryDate: string
    paymentMethod: string | PaymentMethod[]
    staffName: string
  }>({
    nutritionNumber: '',
    clientName: '',
    phone: '',
    sessionsPurchased: 8,
    sessionsRemaining: 8,
    nutritionistName: '',
    totalPrice: 0,
    remainingAmount: 0,
    startDate: formatDateYMD(new Date()),
    expiryDate: '',
    paymentMethod: 'cash',
    staffName: user?.name || '',
  })

  const [referralCoachId, setReferralCoachId] = useState<string | null>(null)

  // معالجة أخطاء جلسات Nutrition
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
      // الأولوية لرقم العضوية، ثم الهاتف كـ fallback
      if (!formData.memberNumber && !formData.phone) {
        setMemberPoints(0)
        setMemberNumber(null)
        return
      }

      try {
        let response
        // البحث برقم العضوية أولاً (الأدق)
        if (formData.memberNumber) {
          response = await fetch(`/api/members?memberNumber=${formData.memberNumber}`)
        }
        // البحث بالهاتف كـ fallback (قد يكون غير دقيق)
        else if (formData.phone) {
          response = await fetch(`/api/members?phone=${encodeURIComponent(formData.phone)}`)
        }

        if (response && response.ok) {
          const members = await response.json()
          if (members.length > 0) {
            setMemberPoints(members[0].points || 0)
            setMemberNumber(members[0].memberNumber || null)
            setFormData(prev => ({ ...prev, memberNumber: members[0].memberNumber || null }))
          } else {
            setMemberPoints(0)
            setMemberNumber(null)
            setFormData(prev => ({ ...prev, memberNumber: null }))
          }
        }
      } catch (error) {
        console.error('Error fetching member points:', error)
        setMemberPoints(0)
        setMemberNumber(null)
      }
    }

    fetchMemberPoints()
  }, [formData.memberNumber, formData.phone]) // الاعتماد على memberNumber أولاً

  // جلب الباقات عند فتح النموذج
  useEffect(() => {
    if (showForm && !editingSession) {
      fetchPackages()
    }
  }, [showForm, editingSession])

  const fetchPackages = async () => {
    setLoadingPackages(true)
    try {
      const response = await fetch('/api/packages?serviceType=Nutrition')
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

  const applyPackage = (pkg: any) => {
    // حساب تاريخ الانتهاء تلقائيًا من durationDays
    let calculatedExpiry = ''
    if (formData.startDate && pkg.durationDays) {
      const start = new Date(formData.startDate)
      const expiry = new Date(start)
      expiry.setDate(expiry.getDate() + pkg.durationDays)
      calculatedExpiry = formatDateYMD(expiry)
    }

    const pricePerSession = pkg.price / pkg.sessions
    setFormData(prev => ({
      ...prev,
      sessionsPurchased: pkg.sessions,
      sessionsRemaining: pkg.sessions,
      totalPrice: pkg.price,
      expiryDate: calculatedExpiry || prev.expiryDate // حساب تاريخ الانتهاء تلقائيًا
    }))
    toast.success(`تم تطبيق باقة: ${pkg.name} (${pkg.durationDays} يوم)`)
  }

  // دالة جلب بيانات العضو بناءً على رقم العضوية وملء الحقول تلقائياً
  const fetchMemberByNumber = async (memberNumber: string) => {
    if (!memberNumber.trim()) return

    // التحقق من صلاحية عرض الأعضاء
    if (!hasPermission('canViewMembers')) {
      toast.warning('لا تملك صلاحية عرض بيانات الأعضاء')
      return
    }

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
      fetchMemberByNumber(formData.nutritionNumber)
    }
  }

  const resetForm = () => {
    setFormData({
      nutritionNumber: '',
      clientName: '',
      phone: '',
      sessionsPurchased: 8,
      sessionsRemaining: 8,
      nutritionistName: '',
      totalPrice: 0,
      remainingAmount: 0,
      startDate: formatDateYMD(new Date()),
      expiryDate: '',
      paymentMethod: 'cash',
      staffName: user?.name || '',
    })
    setReferralCoachId(null)
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

  const handleEdit = (session: NutritionSession) => {
    const totalPrice = session.sessionsPurchased * session.pricePerSession
    setFormData({
      nutritionNumber: session.nutritionNumber.toString(),
      clientName: session.clientName,
      phone: session.phone,
      sessionsPurchased: session.sessionsPurchased,
      sessionsRemaining: session.sessionsRemaining,
      nutritionistName: session.nutritionistName,
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
    setIsDayUse(session.nutritionNumber < 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()


    try {
      const url = '/api/nutrition'
      const method = editingSession ? 'PUT' : 'POST'
      const body = editingSession
        ? { nutritionNumber: editingSession.nutritionNumber, ...formData, staffName: user?.name || '' }
        : { ...formData, staffName: user?.name || '', referralCoachId: referralCoachId || null }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(editingSession ? t('nutrition.messages.sessionUpdated') : t('nutrition.messages.sessionAdded'))
        refetchSessions()
        resetForm()
      } else {
        toast.error(`${t('nutrition.messages.operationFailed')} - ${result.error || ''}`)
      }
    } catch (error) {
      console.error(error)
      toast.error(t('nutrition.messages.error'))
    } finally {

    }
  }

  const handleDelete = async (nutritionNumber: number) => {
    const confirmed = await confirm({
      title: t('nutrition.deleteConfirm.title'),
      message: t('nutrition.deleteConfirm.message', { nutritionNumber: nutritionNumber.toString() }),
      confirmText: t('nutrition.deleteConfirm.confirm'),
      cancelText: t('nutrition.deleteConfirm.cancel'),
      type: 'danger'
    })

    if (!confirmed) return

    // Optimistic Update - احذف فوراً من الـ UI
    const previousData = queryClient.getQueryData<any[]>(['nutrition-sessions'])
    queryClient.setQueryData<any[]>(['nutrition-sessions'], (old) =>
      old ? old.filter(s => s.nutritionNumber !== nutritionNumber) : old
    )

    try {
      const response = await fetch(`/api/nutrition?nutritionNumber=${nutritionNumber}`, { method: 'DELETE' })

      if (!response.ok) {
        const errorData = await response.json()
        queryClient.setQueryData(['nutrition-sessions'], previousData) // rollback
        throw new Error(errorData.error || t('nutrition.messages.deleteFailed'))
      }

      toast.success(t('nutrition.messages.sessionDeleted'))
      queryClient.invalidateQueries({ queryKey: ['nutrition-sessions'] })
    } catch (error: any) {
      queryClient.setQueryData(['nutrition-sessions'], previousData) // rollback
      console.error('Error:', error)
      toast.error(`${t('nutrition.messages.deleteFailed')} - ${error.message || ''}`)
    }
  }

  const handleRenew = (session: NutritionSession) => {
    setRenewalSession(session)
  }

  const handleRegisterSession = (session: NutritionSession) => {
    router.push(`/nutrition/sessions/register?nutritionNumber=${session.nutritionNumber}`)
  }

  const handleOpenPaymentModal = async (session: NutritionSession) => {
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

      const response = await fetch('/api/nutrition/pay-remaining', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nutritionNumber: paymentSession.nutritionNumber,
          paymentAmount: paymentFormData.paymentAmount,
          paymentMethod: paymentFormData.paymentMethod,
          staffName: user?.name || ''
        })
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(t('nutrition.messages.paymentSuccess'))
        refetchSessions()
        setShowPaymentModal(false)
        setPaymentSession(null)
      } else {
        toast.error(`${t('nutrition.messages.paymentFailed')} - ${result.error || ''}`)
      }
    } catch (error) {
      console.error('Error paying remaining:', error)
      toast.error(t('nutrition.messages.paymentFailed'))
    } finally {

    }
  }

  const filteredSessions = sessions.filter((session) => {
    // البحث النصي
    const matchesSearch =
      session.clientName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      session.nutritionistName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      session.nutritionNumber.toString().includes(debouncedSearchTerm) ||
      session.phone.includes(debouncedSearchTerm)

    // فلتر أخصائي التغذية
    const matchesCoach = filterCoach === '' || session.nutritionistName === filterCoach

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

    // فلتر النوع (Nutrition عادي / Day Use)
    let matchesType = true
    if (filterType === 'regular') matchesType = session.nutritionNumber >= 0
    else if (filterType === 'dayuse') matchesType = session.nutritionNumber < 0

    return matchesSearch && matchesCoach && matchesStatus && matchesSessions && matchesType
  })

  // التحقق من الصلاحيات
  if (permissionsLoading) {
    return (
      <LoadingScreen fullScreen message={t('nutrition.loading')} />
    )
  }

  if (!hasPermission('canViewNutrition')) {
    return <PermissionDenied message={t('nutrition.noPermission')} />
  }

  const isCoach = user?.role === 'COACH'

  return (
    <div className="container mx-auto p-4 sm:p-6" dir={direction}>
      <div className="mb-6">
        <div className="mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2"> {t('nutrition.title')}</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
            {isCoach ? t('nutrition.viewSessions') : t('nutrition.manageSessions')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button
            onClick={() => router.push('/nutrition/commission')}
            className="flex-1 min-w-[140px] sm:flex-none bg-gradient-to-r from-green-600 to-green-700 text-white px-3 sm:px-6 py-2 rounded-lg hover:from-green-700 hover:to-green-800 transition shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <span></span>
            <span>{t('nutrition.commissionCalculator')}</span>
          </button>
          <button
            onClick={() => router.push('/nutrition/sessions/history')}
            className="flex-1 min-w-[140px] sm:flex-none bg-gradient-to-r from-green-600 to-green-700 text-white px-3 sm:px-6 py-2 rounded-lg hover:from-green-700 hover:to-green-800 transition shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <span></span>
            <span>{t('nutrition.attendanceLog')}</span>
          </button>
          {!isCoach && (
            <button
              onClick={() => {
                resetForm()
                setShowForm(!showForm)
              }}
              className="w-full sm:w-auto bg-green-600 text-white px-3 sm:px-6 py-2 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              {showForm ? t('nutrition.hideForm') : ` ${t('nutrition.addNewSession')}`}
            </button>
          )}
        </div>
      </div>

      {!isCoach && showForm && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) { resetForm() } }}>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6" dir={direction}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {editingSession ? t('nutrition.editSession') : t('nutrition.addSession')}
            </h2>
            {editingSession && isDayUse && (
              <span className="bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 px-3 py-1 rounded-full text-sm font-bold">
                 Day Use
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!isDayUse && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                    {t('nutrition.nutritionId')} <span className="text-xs text-gray-500 dark:text-gray-400">(اختياري)</span>
                  </label>
                  <input
                    type="number"
                    disabled={!!editingSession}
                    value={formData.nutritionNumber}
                    onChange={(e) => setFormData({ ...formData, nutritionNumber: e.target.value })}
                    onKeyPress={handleIdKeyPress}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg disabled:bg-gray-100 dark:disabled:bg-gray-700 dark:bg-gray-700 dark:text-white"
                    placeholder="اختياري - يمكن تركه فارغ"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1"> اضغط Enter لتحميل بيانات العضو تلقائياً</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                  {t('nutrition.clientName')} <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder={t('nutrition.clientNamePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                  {t('nutrition.phoneNumber')} <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder={t('nutrition.phonePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                  {t('nutrition.nutritionistName')} <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                {coachesLoading ? (
                  <div className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                    {t('nutrition.loadingNutritionists')}
                  </div>
                ) : (() => {
                  // فلترة أخصائيي التغذية النشطين

                  let nutritionists = coaches.filter(coach =>
                    coach.isActive &&
                    (coach.position?.toLowerCase().includes('تغذية') ||
                     coach.position?.toLowerCase().includes('nutrition'))
                  )


                  // إذا لم يجد أخصائيين محددين، اعرض كل الموظفين النشطين
                  if (nutritionists.length === 0) {
                    nutritionists = coaches.filter(coach => coach.isActive)
                  }

                  return nutritionists.length === 0 ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        required
                        value={formData.nutritionistName}
                        onChange={(e) => setFormData({ ...formData, nutritionistName: e.target.value })}
                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                        placeholder={t('nutrition.nutritionistNamePlaceholder')}
                      />
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                         {t('nutrition.noActiveNutritionists')}
                      </p>
                    </div>
                  ) : (
                    <select
                      required
                      value={formData.nutritionistName}
                      onChange={(e) => setFormData({ ...formData, nutritionistName: e.target.value })}
                      className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">{t('nutrition.selectNutritionist')}</option>
                      {nutritionists.map((coach) => (
                        <option key={coach.id} value={coach.name}>
                          {coach.name} {coach.phone && `(${coach.phone})`}
                        </option>
                      ))}
                    </select>
                  )
                })()}
              </div>

              {/* Day Use Checkbox - مخفي في وضع التعديل */}
              {!editingSession && (
                <div className="bg-green-50 dark:bg-green-900/50 ring-1 ring-green-200 dark:ring-green-700 rounded-lg p-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDayUse}
                      onChange={(e) => {
                      setIsDayUse(e.target.checked)
                      // إذا تم تفعيل Day Use، اضبط عدد الجلسات على 1 والمبلغ المتبقي على 0 ورقم Nutrition سالب
                      if (e.target.checked) {
                        setFormData(prev => ({
                          ...prev,
                          nutritionNumber: '-1',
                          sessionsPurchased: 1,
                          remainingAmount: 0
                        }))
                      } else {
                        // إذا تم إلغاء Day Use، امسح رقم Nutrition
                        setFormData(prev => ({
                          ...prev,
                          nutritionNumber: ''
                        }))
                      }
                    }}
                    className="w-5 h-5"
                  />
                  <div>
                    <span className="text-sm font-bold text-green-800 dark:text-green-200">
                       Day Use (استخدام يومي)
                    </span>
                    <p className="text-xs text-green-600 dark:text-green-300 mt-1">
                      تسجيل مبسط - اسم ورقم وسعر الجلسة فقط
                    </p>
                  </div>
                </label>
              </div>
              )}

              {/* اختيار باقة جاهزة */}
              {!isDayUse && !editingSession && packages.length > 0 && (
                <div className="col-span-full">
                  <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
                     {t('packages.selectPackage')}
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {packages.map((pkg) => (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => applyPackage(pkg)}
                        className="bg-gradient-to-br from-lime-50 to-green-100 dark:from-lime-900/50 dark:to-green-900/50 hover:from-lime-100 hover:to-green-200 dark:hover:from-lime-800/50 dark:hover:to-green-800/50 ring-1 ring-lime-400 dark:ring-lime-700 rounded-lg p-3 transition-colors duration-200 hover:shadow-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      >
                        <div className="text-center">
                          
                          <div className="font-bold text-gray-800 dark:text-gray-100 text-sm">{pkg.name}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                            {pkg.sessions} {t('packages.sessions')}
                          </div>
                          {pkg.durationDays && (
                            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                               {pkg.durationDays} يوم
                            </div>
                          )}
                          <div className="text-lg font-bold text-green-600 dark:text-green-400 mt-1">
                            {pkg.price} {t('nutrition.egp')}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                     {t('packages.customPackage')}: يمكنك تعديل القيم بعد اختيار الباقة
                  </p>
                </div>
              )}

              {!isDayUse && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                    {t('nutrition.sessionsCount')} <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.sessionsPurchased}
                    onChange={(e) => setFormData({ ...formData, sessionsPurchased: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    placeholder={t('nutrition.sessionsPlaceholder')}
                  />
                </div>
              )}

              {!isDayUse && editingSession && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                    الجلسات المتبقية <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.sessionsRemaining}
                    onChange={(e) => setFormData({ ...formData, sessionsRemaining: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-green-300 dark:border-green-700 rounded-lg bg-green-50 dark:bg-green-900/50 dark:text-white"
                    placeholder="عدد الجلسات المتبقية"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                     يمكنك تعديل عدد الجلسات المتبقية للعميل
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                  {isDayUse ? 'سعر الجلسة ' : t('nutrition.totalPrice')} <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.totalPrice}
                  onChange={(e) => setFormData({ ...formData, totalPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-yellow-300 dark:border-yellow-700 rounded-lg bg-yellow-50 dark:bg-yellow-900/50 dark:text-white"
                  placeholder={isDayUse ? 'أدخل سعر الجلسة' : t('nutrition.totalPricePlaceholder')}
                />
              </div>

              {!isDayUse && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                    {t('nutrition.remainingAmount')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.remainingAmount}
                    onChange={(e) => setFormData({ ...formData, remainingAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-orange-300 dark:border-orange-700 rounded-lg bg-orange-50 dark:bg-orange-900/50 dark:text-white"
                    placeholder={t('nutrition.remainingAmountPlaceholder')}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('nutrition.remainingAmountNote')}
                  </p>
                </div>
              )}

              {!isDayUse && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                    {t('nutrition.startDate')} <span className="text-xs text-gray-500 dark:text-gray-400">{t('nutrition.startDateFormat')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg font-mono dark:bg-gray-700 dark:text-white"
                    placeholder={t('nutrition.startDatePlaceholder')}
                    pattern="\d{4}-\d{2}-\d{2}"
                  />
                </div>
              )}

              {!isDayUse && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                    {t('nutrition.expiryDate')} <span className="text-xs text-gray-500 dark:text-gray-400">{t('nutrition.startDateFormat')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg font-mono dark:bg-gray-700 dark:text-white"
                    placeholder={t('nutrition.expiryDatePlaceholder')}
                    pattern="\d{4}-\d{2}-\d{2}"
                  />
                </div>
              )}
            </div>

            {!isDayUse && (
              <div>
                <p className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">{t('nutrition.quickAdd')}</p>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 6, 9, 12].map(months => (
                    <button
                      key={months}
                      type="button"
                      onClick={() => calculateExpiryFromMonths(months)}
                      className="px-3 py-2 bg-green-100 dark:bg-green-900/50 hover:bg-green-200 dark:hover:bg-green-800/50 text-green-800 dark:text-green-200 rounded-lg text-sm transition font-medium"
                    >
                      + {months} {months === 1 ? t('nutrition.month') : t('nutrition.months')}
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
              <div className="bg-green-50 dark:bg-green-900/30 ring-1 ring-green-200 dark:ring-green-700 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('nutrition.finalTotal')}</span>
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formData.totalPrice.toFixed(2)} {t('nutrition.egp')}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2 text-sm border-t dark:border-green-700 pt-2">
                  <span className="font-semibold text-green-700 dark:text-green-300">{t('nutrition.paidAmount')}</span>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    {(formData.totalPrice - formData.remainingAmount).toFixed(2)} {t('nutrition.egp')}
                  </span>
                </div>
                {formData.remainingAmount > 0 && (
                  <div className="flex justify-between items-center mt-1 text-sm">
                    <span className="font-semibold text-orange-700 dark:text-orange-300">{t('nutrition.remaining')}</span>
                    <span className="font-bold text-orange-600 dark:text-orange-400">
                      {formData.remainingAmount.toFixed(2)} {t('nutrition.egp')}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Referral Section */}
            {settings.nutritionReferralEnabled && !editingSession && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 ring-1 ring-purple-200 dark:ring-purple-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  
                  Referral - من سوّق هذا الاشتراك؟
                </h3>

                <CoachSelector
                  value={referralCoachId}
                  onChange={setReferralCoachId}
                  required={false}
                />

                {referralCoachId && formData.totalPrice > 0 && (
                  <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                       عمولة Referral: {settings.nutritionReferralPercentage}% من سعر الاشتراك
                    </p>
                    <p className="text-sm font-semibold text-purple-600 dark:text-purple-400 mt-1">
                      = {((formData.totalPrice * settings.nutritionReferralPercentage) / 100).toFixed(2)} ج.م
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 dark:hover:bg-green-800 disabled:bg-gray-400 dark:disabled:bg-gray-600"
              >
                {loading ? t('nutrition.saving') : editingSession ? t('nutrition.updateButton') : t('nutrition.addSessionButton')}
              </button>
              {editingSession && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  {t('nutrition.cancelButton')}
                </button>
              )}
            </div>
          </form>
        </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6" dir={direction}>
        <div className="mb-4">
          <input
            type="text"
            placeholder={` ${t('nutrition.searchPlaceholder')}`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 ring-1 dark:border-gray-600 rounded-lg text-lg dark:bg-gray-700 dark:text-white"
          />
        </div>

        {/* الفلاتر */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* فلتر أخصائي التغذية */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-900 dark:text-gray-100">{t('nutrition.filterByNutritionist')}</label>
            <select
              value={filterCoach}
              onChange={(e) => setFilterCoach(e.target.value)}
              className="w-full px-3 py-2 ring-1 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="">{t('nutrition.allNutritionists')}</option>
              {(Array.from(new Set(sessions.map(s => s.nutritionistName).filter((name): name is string => !!name))) as string[]).sort().map(coach => (
                <option key={coach} value={coach}>{coach}</option>
              ))}
            </select>
          </div>

          {/* فلتر الحالة */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-900 dark:text-gray-100">{t('nutrition.filterByStatus')}</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-3 py-2 ring-1 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="all">{t('nutrition.allStatus')}</option>
              <option value="active">{t('nutrition.statusActive')}</option>
              <option value="expiring">{t('nutrition.statusExpiring')}</option>
              <option value="expired">{t('nutrition.statusExpired')}</option>
            </select>
          </div>

          {/* فلتر الجلسات */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-900 dark:text-gray-100">{t('nutrition.filterBySessions')}</label>
            <select
              value={filterSessions}
              onChange={(e) => setFilterSessions(e.target.value as any)}
              className="w-full px-3 py-2 ring-1 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="all">{t('nutrition.allSessions')}</option>
              <option value="low">{t('nutrition.sessionsLow')}</option>
              <option value="zero">{t('nutrition.sessionsZero')}</option>
            </select>
          </div>

          {/* فلتر النوع (Nutrition عادي / Day Use) */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-900 dark:text-gray-100">{t('nutrition.sessionType')}</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-3 py-2 ring-1 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="all">{t('nutrition.typeAll')}</option>
              <option value="regular">{t('nutrition.typeRegular')}</option>
              <option value="dayuse">{t('nutrition.typeDayUse')}</option>
            </select>
          </div>
        </div>

        {/* زر إعادة تعيين الفلاتر */}
        {(filterCoach || filterStatus !== 'all' || filterSessions !== 'all' || filterType !== 'all') && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => {
                setFilterCoach('')
                setFilterStatus('all')
                setFilterSessions('all')
                setFilterType('all')
              }}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition text-sm font-medium"
            >
               {t('nutrition.resetFilters')}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <LoadingScreen message={t('nutrition.loading')} />
      ) : (
        <>
          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" dir={direction}>
            {filteredSessions.map((session) => {
              const isExpiringSoon =
                session.expiryDate &&
                new Date(session.expiryDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              const isExpired = session.expiryDate && new Date(session.expiryDate) < new Date()
              const progressPercentage = session.sessionsPurchased > 0
                ? ((session.sessionsPurchased - session.sessionsRemaining) / session.sessionsPurchased) * 100
                : 0

              return (
                <div
                  key={session.nutritionNumber}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden ring-1 hover:shadow-lg dark:hover:shadow-2xl transition ${
                    isExpired ? 'border-red-300 dark:border-red-700' : isExpiringSoon ? 'border-orange-300 dark:border-orange-700' : 'border-gray-200 dark:border-gray-600'
                  }`}
                >
                  {/* Header */}
                  <div className={`p-3 ${isExpired ? 'bg-red-600 dark:bg-red-700' : isExpiringSoon ? 'bg-orange-600 dark:bg-orange-700' : 'bg-gradient-to-r from-green-600 to-green-700 dark:from-green-700 dark:to-green-800'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-white/20 flex items-center justify-center flex-shrink-0">
                          
                        </div>
                        <div>
                          <div className="font-bold text-white text-base">{session.clientName}</div>
                          <div className="text-white/80 text-xs">
                            {session.nutritionNumber < 0 ? ' Day Use' : `#${session.nutritionNumber}`} • {session.phone}
                          </div>
                        </div>
                      </div>
                      <div className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        session.sessionsRemaining === 0 ? 'bg-red-500 dark:bg-red-600' : session.sessionsRemaining <= 3 ? 'bg-orange-500 dark:bg-orange-600' : 'bg-green-500 dark:bg-green-600'
                      } text-white`}>
                        {session.sessionsRemaining} / {session.sessionsPurchased}
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-3 space-y-2.5">
                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300 mb-1">
                        <span>{t('nutrition.nutritionist')}: {session.nutritionistName}</span>
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
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-2 text-center">
                        <div className="text-[10px] text-green-700 dark:text-green-300 font-semibold">{t('nutrition.total')}</div>
                        <div className="text-sm font-bold text-green-600 dark:text-green-400">
                          {(session.sessionsPurchased * session.pricePerSession).toFixed(0)} {t('nutrition.egp')}
                        </div>
                      </div>
                      <div className={`border rounded-lg p-2 text-center ${
                        (session.remainingAmount || 0) > 0
                          ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700'
                          : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                      }`}>
                        <div className={`text-[10px] font-semibold ${(session.remainingAmount || 0) > 0 ? 'text-orange-700 dark:text-orange-300' : 'text-gray-500 dark:text-gray-400'}`}>{t('nutrition.remaining')}</div>
                        <div className={`text-sm font-bold ${(session.remainingAmount || 0) > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                          {(session.remainingAmount || 0).toFixed(0)} {t('nutrition.egp')}
                        </div>
                      </div>
                    </div>

                    {/* Dates */}
                    {(session.startDate || session.expiryDate) && (
                      <div className={`border rounded-lg p-2 text-xs font-mono ${
                        isExpired ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700' : isExpiringSoon ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700' : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                      }`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span></span>
                          {session.startDate && <span>{formatDateYMD(session.startDate)}</span>}
                          {session.startDate && session.expiryDate && <span>→</span>}
                          {session.expiryDate && (
                            <span className={isExpired ? 'text-red-600 dark:text-red-400 font-bold' : ''}>
                              {formatDateYMD(session.expiryDate)}
                            </span>
                          )}
                          {isExpired && <span className="text-red-600 dark:text-red-400 font-bold">({t('nutrition.expired')})</span>}
                          {!isExpired && isExpiringSoon && <span className="text-orange-600 dark:text-orange-400 font-bold">({t('nutrition.expiringSoon')})</span>}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {!isCoach && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {session.nutritionNumber >= 0 && (
                          <>
                            <button
                              onClick={() => handleRegisterSession(session)}
                              disabled={session.sessionsRemaining === 0}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed font-bold flex items-center justify-center gap-1.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                            >
                              <svg {...stroke} className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                              <span>{t('nutrition.attendance')}</span>
                            </button>
                            <button
                              onClick={() => handleRenew(session)}
                              className="bg-primary-500 hover:bg-primary-600 text-primary-contrast py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                            >
                              <svg {...stroke} className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-4.992 4.992l3.181-3.183a8.25 8.25 0 00-13.803 3.7M4.031 9.865v-4.992m0 0H8.99M3 12a9 9 0 0015.357 6.364l-1.06-1.06"/></svg>
                              <span>{t('nutrition.renew')}</span>
                            </button>
                          </>
                        )}
                        {(session.remainingAmount || 0) > 0 && (
                          <button
                            onClick={() => handleOpenPaymentModal(session)}
                            className="col-span-2 bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                          >
                            <svg {...stroke} className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4"/></svg>
                            <span>{t('nutrition.payRemaining')} ({(session.remainingAmount || 0).toFixed(0)} {t('nutrition.egp')})</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(session)}
                          className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                        >
                          <svg {...stroke} className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/></svg>
                          <span>{t('nutrition.edit')}</span>
                        </button>
                        <button
                          onClick={() => handleDelete(session.nutritionNumber)}
                          aria-label={t('nutrition.deleteSubscription')}
                          className="bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                        >
                          <svg {...stroke} className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
                          <span>{t('nutrition.deleteSubscription')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {filteredSessions.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">
              
              <p className="text-xl">{searchTerm ? t('nutrition.noSearchResults') : t('nutrition.noSessions')}</p>
            </div>
          )}
        </>
      )}

      {/* Payment Modal */}
      {showPaymentModal && paymentSession && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6" dir={direction}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">{t('nutrition.paymentModal.title')}</h2>
              <button
                onClick={() => {
                  setShowPaymentModal(false)
                  setPaymentSession(null)
                }}
                className="text-gray-400 dark:text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:text-gray-300 text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* معلومات الاشتراك */}
              <div className="bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-200 dark:ring-orange-800/60 rounded-lg p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('nutrition.nutritionNumber')}:</span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">#{paymentSession.nutritionNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('nutrition.client')}:</span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">{paymentSession.clientName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">{t('nutrition.nutritionist')}:</span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">{paymentSession.nutritionistName}</span>
                  </div>
                  <div className="flex justify-between border-t border-orange-200 dark:border-orange-800/60 pt-2">
                    <span className="text-orange-700 dark:text-orange-300 font-semibold">{t('nutrition.paymentModal.remainingAmount')}</span>
                    <span className="font-bold text-orange-700 dark:text-orange-300 text-lg">
                      {(paymentSession.remainingAmount || 0).toFixed(0)} {t('nutrition.egp')}
                    </span>
                  </div>
                </div>
              </div>

              {/* مبلغ الدفع */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">
                  {t('nutrition.paymentModal.paymentAmountRequired')}
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
                  className="w-full px-4 py-3 rounded-lg ring-1 ring-gray-300 dark:ring-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
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
                    className="flex-1 px-3 py-1 bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-900/50 text-orange-800 dark:text-orange-200 rounded text-sm font-medium transition-colors duration-200"
                  >
                    {t('nutrition.paymentModal.payAll')} ({(paymentSession.remainingAmount || 0).toFixed(0)})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPaymentFormData({
                        ...paymentFormData,
                        paymentAmount: (paymentSession.remainingAmount || 0) / 2
                      })
                    }
                    className="flex-1 px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 rounded text-sm font-medium transition-colors duration-200"
                  >
                    {t('nutrition.paymentModal.payHalf')} ({((paymentSession.remainingAmount || 0) / 2).toFixed(0)})
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

              {/* المبلغ المتبقي بعد الدفع */}
              {paymentFormData.paymentAmount > 0 && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-200 dark:ring-emerald-800/60 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-emerald-700 dark:text-emerald-300 font-semibold">
                      {t('nutrition.paymentModal.remainingAfterPayment')}
                    </span>
                    <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                      {((paymentSession.remainingAmount || 0) - paymentFormData.paymentAmount).toFixed(0)} {t('nutrition.egp')}
                    </span>
                  </div>
                </div>
              )}

              {/* أزرار الإجراءات */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowPaymentModal(false)
                    setPaymentSession(null)
                  }}
                  className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-3 rounded-lg font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
                >
                  {t('nutrition.deleteConfirm.cancel')}
                </button>
                <button
                  onClick={handlePayRemaining}
                  disabled={loading || paymentFormData.paymentAmount <= 0 || paymentFormData.paymentAmount > (paymentSession.remainingAmount || 0)}
                  className="bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg font-bold disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
                >
                  {loading ? t('nutrition.paymentModal.paying') : t('nutrition.paymentModal.confirmPayment')}
                </button>
              </div>

              {/* ملاحظة */}
              <div className="bg-orange-50 dark:bg-orange-900/20 border-s-4 border-orange-500 dark:border-orange-700 p-3 rounded">
                <p className="text-xs text-orange-800 dark:text-orange-200">
                  {t('nutrition.paymentModal.note')}
                </p>
              </div>
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

      {/* Renewal Modal */}
      {renewalSession && (
        <NutritionRenewalForm
          session={renewalSession}
          onSuccess={() => {
            refetchSessions()
            setRenewalSession(null)
          }}
          onClose={() => setRenewalSession(null)}
        />
      )}
    </div>
  )
}

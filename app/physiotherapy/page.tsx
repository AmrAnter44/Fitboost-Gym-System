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

interface Staff {
  id: string
  name: string
  phone?: string
  position?: string
  isActive: boolean
}

interface PhysiotherapySession {
  physioNumber: number
  clientName: string
  phone: string
  sessionsPurchased: number
  sessionsRemaining: number
  therapistName: string
  pricePerSession: number
  remainingAmount?: number
  startDate: string | null
  expiryDate: string | null
  createdAt: string
  qrCode?: string
  qrCodeImage?: string
}

export default function PhysiotherapyPage() {
  const router = useRouter()
  const { hasPermission, loading: permissionsLoading, user } = usePermissions()
  const { t, direction } = useLanguage()
  const toast = useToast()
  const { confirm, isOpen, options, handleConfirm, handleCancel } = useConfirm()
  const { settings } = useServiceSettings()
  const queryClient = useQueryClient()

  // ✅ استخدام useQuery لجلب جلسات Physiotherapy
  const {
    data: sessions = [],
    isLoading: loading,
    error: sessionsError,
    refetch: refetchSessions
  } = useQuery({
    queryKey: ['physiotherapy-sessions'],
    queryFn: async () => {
      const response = await fetch('/api/physiotherapy')
      if (!response.ok) {
        if (response.status === 401) throw new Error('UNAUTHORIZED')
        if (response.status === 403) throw new Error('FORBIDDEN')
        throw new Error('Failed to fetch physiotherapy sessions')
      }
      return response.json()
    },
    enabled: !permissionsLoading && hasPermission('canViewPhysiotherapy'),
    retry: 1,
    staleTime: 2 * 60 * 1000,
  })

  // ✅ استخدام useQuery لجلب جميع الموظفين النشطين
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
  const [editingSession, setEditingSession] = useState<PhysiotherapySession | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [showQRModal, setShowQRModal] = useState(false)
  const [selectedSession, setSelectedSession] = useState<PhysiotherapySession | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentSession, setPaymentSession] = useState<PhysiotherapySession | null>(null)
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
  const [memberNumber, setMemberNumber] = useState<number | null>(null)

  const [formData, setFormData] = useState<{
    physioNumber: string
    clientName: string
    phone: string
    memberNumber?: number | null
    sessionsPurchased: number
    sessionsRemaining: number
    therapistName: string
    totalPrice: number
    remainingAmount: number
    startDate: string
    expiryDate: string
    paymentMethod: string | PaymentMethod[]
    staffName: string
  }>({
    physioNumber: '',
    clientName: '',
    phone: '',
    sessionsPurchased: 8,
    sessionsRemaining: 8,
    therapistName: '',
    totalPrice: 0,
    remainingAmount: 0,
    startDate: formatDateYMD(new Date()),
    expiryDate: '',
    paymentMethod: 'cash',
    staffName: user?.name || '',
  })

  const [referralCoachId, setReferralCoachId] = useState<string | null>(null)

  // ✅ معالجة أخطاء جلسات Physiotherapy
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
      // ✅ الأولوية لرقم العضوية، ثم الهاتف كـ fallback
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
  }, [formData.memberNumber, formData.phone]) // ✅ الاعتماد على memberNumber أولاً

  // جلب الباقات عند فتح النموذج
  useEffect(() => {
    if (showForm && !editingSession) {
      fetchPackages()
    }
  }, [showForm, editingSession])

  const fetchPackages = async () => {
    setLoadingPackages(true)
    try {
      const response = await fetch('/api/packages?serviceType=Physiotherapy')
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
      fetchMemberByNumber(formData.physioNumber)
    }
  }

  const resetForm = () => {
    setFormData({
      physioNumber: '',
      clientName: '',
      phone: '',
      sessionsPurchased: 8,
      sessionsRemaining: 8,
      therapistName: '',
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

  const handleEdit = (session: PhysiotherapySession) => {
    const totalPrice = session.sessionsPurchased * session.pricePerSession
    setFormData({
      physioNumber: session.physioNumber.toString(),
      clientName: session.clientName,
      phone: session.phone,
      sessionsPurchased: session.sessionsPurchased,
      sessionsRemaining: session.sessionsRemaining,
      therapistName: session.therapistName,
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
    setIsDayUse(session.physioNumber < 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()


    try {
      const url = '/api/physiotherapy'
      const method = editingSession ? 'PUT' : 'POST'
      const body = editingSession
        ? { physioNumber: editingSession.physioNumber, ...formData, staffName: user?.name || '' }
        : { ...formData, staffName: user?.name || '', referralCoachId: referralCoachId || null }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(editingSession ? t('physiotherapy.messages.sessionUpdated') : t('physiotherapy.messages.sessionAdded'))
        refetchSessions()
        resetForm()
      } else {
        toast.error(`${t('physiotherapy.messages.operationFailed')} - ${result.error || ''}`)
      }
    } catch (error) {
      console.error(error)
      toast.error(t('physiotherapy.messages.error'))
    } finally {

    }
  }

  const handleDelete = async (physioNumber: number) => {
    const confirmed = await confirm({
      title: t('physiotherapy.deleteConfirm.title'),
      message: t('physiotherapy.deleteConfirm.message', { physioNumber: physioNumber.toString() }),
      confirmText: t('physiotherapy.deleteConfirm.confirm'),
      cancelText: t('physiotherapy.deleteConfirm.cancel'),
      type: 'danger'
    })

    if (!confirmed) return

    // ✅ Optimistic Update
    const previousData = queryClient.getQueryData<any[]>(['physiotherapy-sessions'])
    queryClient.setQueryData<any[]>(['physiotherapy-sessions'], (old) =>
      old ? old.filter(s => s.physioNumber !== physioNumber) : old
    )

    try {
      const response = await fetch(`/api/physiotherapy?physioNumber=${physioNumber}`, { method: 'DELETE' })

      if (!response.ok) {
        const errorData = await response.json()
        queryClient.setQueryData(['physiotherapy-sessions'], previousData)
        throw new Error(errorData.error || t('physiotherapy.messages.deleteFailed'))
      }

      toast.success(t('physiotherapy.messages.sessionDeleted'))
      queryClient.invalidateQueries({ queryKey: ['physiotherapy-sessions'] })
    } catch (error: any) {
      queryClient.setQueryData(['physiotherapy-sessions'], previousData)
      console.error('Error:', error)
      toast.error(`${t('physiotherapy.messages.deleteFailed')} - ${error.message || ''}`)
    }
  }

  const handleRenew = (session: PhysiotherapySession) => {
    router.push(`/physiotherapy/renew?physioNumber=${session.physioNumber}`)
  }

  const handleRegisterSession = (session: PhysiotherapySession) => {
    router.push(`/physiotherapy/sessions/register?physioNumber=${session.physioNumber}`)
  }

  const handleOpenPaymentModal = async (session: PhysiotherapySession) => {
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

      const response = await fetch('/api/physiotherapy/pay-remaining', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          physioNumber: paymentSession.physioNumber,
          paymentAmount: paymentFormData.paymentAmount,
          paymentMethod: paymentFormData.paymentMethod,
          staffName: user?.name || ''
        })
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(t('physiotherapy.messages.paymentSuccess'))
        refetchSessions()
        setShowPaymentModal(false)
        setPaymentSession(null)
      } else {
        toast.error(`${t('physiotherapy.messages.paymentFailed')} - ${result.error || ''}`)
      }
    } catch (error) {
      console.error('Error paying remaining:', error)
      toast.error(t('physiotherapy.messages.paymentFailed'))
    } finally {

    }
  }

  const filteredSessions = sessions.filter((session) => {
    // البحث النصي
    const matchesSearch =
      session.clientName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      session.therapistName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      session.physioNumber.toString().includes(debouncedSearchTerm) ||
      session.phone.includes(debouncedSearchTerm)

    // فلتر أخصائي العلاج الطبيعي
    const matchesCoach = filterCoach === '' || session.therapistName === filterCoach

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

    // فلتر النوع (Physiotherapy عادي / Day Use)
    let matchesType = true
    if (filterType === 'regular') matchesType = session.physioNumber >= 0
    else if (filterType === 'dayuse') matchesType = session.physioNumber < 0

    return matchesSearch && matchesCoach && matchesStatus && matchesSessions && matchesType
  })

  // ✅ التحقق من الصلاحيات
  if (permissionsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl">{t('physiotherapy.loading')}</div>
      </div>
    )
  }

  if (!hasPermission('canViewPhysiotherapy')) {
    return <PermissionDenied message={t('physiotherapy.noPermission')} />
  }

  const isCoach = user?.role === 'COACH'

  return (
    <div className="container mx-auto p-4 sm:p-6" dir={direction}>
      <div className="mb-6">
        <div className="mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">🏥 {t('physiotherapy.title')}</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
            {isCoach ? t('physiotherapy.viewSessions') : t('physiotherapy.manageSessions')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button
            onClick={() => router.push('/physiotherapy/commission')}
            className="flex-1 min-w-[140px] sm:flex-none bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 sm:px-6 py-2 rounded-lg hover:from-blue-700 hover:to-blue-800 transition shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <span>💰</span>
            <span>{t('physiotherapy.commissionCalculator')}</span>
          </button>
          <button
            onClick={() => router.push('/physiotherapy/sessions/history')}
            className="flex-1 min-w-[140px] sm:flex-none bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 sm:px-6 py-2 rounded-lg hover:from-blue-700 hover:to-blue-800 transition shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <span>📊</span>
            <span>{t('physiotherapy.attendanceLog')}</span>
          </button>
          {!isCoach && (
            <button
              onClick={() => {
                resetForm()
                setShowForm(!showForm)
              }}
              className="w-full sm:w-auto bg-blue-600 text-white px-3 sm:px-6 py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              {showForm ? t('physiotherapy.hideForm') : `➕ ${t('physiotherapy.addNewSession')}`}
            </button>
          )}
        </div>
      </div>

      {!isCoach && showForm && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg mb-6 border-2 border-blue-100 dark:border-blue-700" dir={direction}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {editingSession ? t('physiotherapy.editSession') : t('physiotherapy.addSession')}
            </h2>
            {editingSession && isDayUse && (
              <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-full text-sm font-bold">
                🏃 Day Use
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!isDayUse && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                    {t('physiotherapy.physiotherapyId')} <span className="text-xs text-gray-500 dark:text-gray-400">(اختياري)</span>
                  </label>
                  <input
                    type="number"
                    disabled={!!editingSession}
                    value={formData.physioNumber}
                    onChange={(e) => setFormData({ ...formData, physioNumber: e.target.value })}
                    onKeyPress={handleIdKeyPress}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg disabled:bg-gray-100 dark:disabled:bg-gray-700 dark:bg-gray-700 dark:text-white"
                    placeholder="اختياري - يمكن تركه فارغ"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">💡 اضغط Enter لتحميل بيانات العضو تلقائياً</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                  {t('physiotherapy.clientName')} <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder={t('physiotherapy.clientNamePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                  {t('physiotherapy.phoneNumber')} <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder={t('physiotherapy.phonePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                  {t('physiotherapy.therapistName')} <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                {coachesLoading ? (
                  <div className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                    {t('physiotherapy.loadingPhysiotherapyists')}
                  </div>
                ) : (() => {
                  // فلترة أخصائيي العلاج الطبيعي النشطين
                  console.log('📊 All coaches:', coaches.map(c => ({ name: c.name, position: c.position, isActive: c.isActive })))

                  let therapists = coaches.filter(coach =>
                    coach.isActive &&
                    (coach.position?.toLowerCase().includes('علاج') ||
                     coach.position?.toLowerCase().includes('physiotherapy') ||
                     coach.position?.toLowerCase().includes('طبيعي'))
                  )

                  console.log('🏥 Filtered therapists:', therapists.map(c => ({ name: c.name, position: c.position })))

                  // إذا لم يجد أخصائيين محددين، اعرض كل الموظفين النشطين
                  if (therapists.length === 0) {
                    therapists = coaches.filter(coach => coach.isActive)
                    console.log('⚠️ No therapists found, showing all active staff:', therapists.length)
                  }

                  return therapists.length === 0 ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        required
                        value={formData.therapistName}
                        onChange={(e) => setFormData({ ...formData, therapistName: e.target.value })}
                        className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                        placeholder={t('physiotherapy.therapistNamePlaceholder')}
                      />
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        ⚠️ {t('physiotherapy.noActivePhysiotherapyists')}
                      </p>
                    </div>
                  ) : (
                    <select
                      required
                      value={formData.therapistName}
                      onChange={(e) => setFormData({ ...formData, therapistName: e.target.value })}
                      className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">{t('physiotherapy.selectPhysiotherapyist')}</option>
                      {therapists.map((coach) => (
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
                <div className="bg-blue-50 dark:bg-blue-900/50 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDayUse}
                      onChange={(e) => {
                      setIsDayUse(e.target.checked)
                      // إذا تم تفعيل Day Use، اضبط عدد الجلسات على 1 والمبلغ المتبقي على 0 ورقم Physiotherapy سالب
                      if (e.target.checked) {
                        setFormData(prev => ({
                          ...prev,
                          physioNumber: '-1',
                          sessionsPurchased: 1,
                          remainingAmount: 0
                        }))
                      } else {
                        // إذا تم إلغاء Day Use، امسح رقم Physiotherapy
                        setFormData(prev => ({
                          ...prev,
                          physioNumber: ''
                        }))
                      }
                    }}
                    className="w-5 h-5"
                  />
                  <div>
                    <span className="text-sm font-bold text-blue-800 dark:text-blue-200">
                      🏃 Day Use (استخدام يومي)
                    </span>
                    <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
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
                    ⚡ {t('packages.selectPackage')}
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {packages.map((pkg) => (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => applyPackage(pkg)}
                        className="bg-gradient-to-br from-blue-50 to-cyan-100 dark:from-blue-900/50 dark:to-cyan-900/50 hover:from-blue-100 hover:to-cyan-200 dark:hover:from-blue-800/50 dark:hover:to-cyan-800/50 border-2 border-blue-400 dark:border-blue-700 rounded-lg p-3 transition-all hover:scale-105 hover:shadow-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      >
                        <div className="text-center">
                          <div className="text-2xl mb-1">🏥</div>
                          <div className="font-bold text-gray-800 dark:text-gray-100 text-sm">{pkg.name}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                            {pkg.sessions} {t('packages.sessions')}
                          </div>
                          <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1">
                            {pkg.price} {t('physiotherapy.egp')}
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
                  <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                    {t('physiotherapy.sessionsCount')} <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.sessionsPurchased}
                    onChange={(e) => setFormData({ ...formData, sessionsPurchased: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    placeholder={t('physiotherapy.sessionsPlaceholder')}
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
                    className="w-full px-3 py-2 border border-blue-300 dark:border-blue-700 rounded-lg bg-blue-50 dark:bg-blue-900/50 dark:text-white"
                    placeholder="عدد الجلسات المتبقية"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    💡 يمكنك تعديل عدد الجلسات المتبقية للعميل
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                  {isDayUse ? 'سعر الجلسة 💰' : t('physiotherapy.totalPrice')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.totalPrice}
                  onChange={(e) => setFormData({ ...formData, totalPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg bg-yellow-50 dark:bg-yellow-900/50 border-yellow-300 dark:border-yellow-700 dark:text-white"
                  placeholder={isDayUse ? 'أدخل سعر الجلسة' : t('physiotherapy.totalPricePlaceholder')}
                />
              </div>

              {!isDayUse && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                    {t('physiotherapy.remainingAmount')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.remainingAmount}
                    onChange={(e) => setFormData({ ...formData, remainingAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg bg-orange-50 dark:bg-orange-900/50 border-orange-300 dark:border-orange-700 dark:text-white"
                    placeholder={t('physiotherapy.remainingAmountPlaceholder')}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('physiotherapy.remainingAmountNote')}
                  </p>
                </div>
              )}

              {!isDayUse && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                    {t('physiotherapy.startDate')} <span className="text-xs text-gray-500 dark:text-gray-400">{t('physiotherapy.startDateFormat')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg font-mono dark:bg-gray-700 dark:text-white"
                    placeholder={t('physiotherapy.startDatePlaceholder')}
                    pattern="\d{4}-\d{2}-\d{2}"
                  />
                </div>
              )}

              {!isDayUse && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                    {t('physiotherapy.expiryDate')} <span className="text-xs text-gray-500 dark:text-gray-400">{t('physiotherapy.startDateFormat')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg font-mono dark:bg-gray-700 dark:text-white"
                    placeholder={t('physiotherapy.expiryDatePlaceholder')}
                    pattern="\d{4}-\d{2}-\d{2}"
                  />
                </div>
              )}
            </div>

            {!isDayUse && (
              <div>
                <p className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">{t('physiotherapy.quickAdd')}</p>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 6, 9, 12].map(months => (
                    <button
                      key={months}
                      type="button"
                      onClick={() => calculateExpiryFromMonths(months)}
                      className="px-3 py-2 bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200 dark:hover:bg-blue-800/50 text-blue-800 dark:text-blue-200 rounded-lg text-sm transition font-medium"
                    >
                      + {months} {months === 1 ? t('physiotherapy.month') : t('physiotherapy.months')}
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
              <div className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('physiotherapy.finalTotal')}</span>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formData.totalPrice.toFixed(2)} {t('physiotherapy.egp')}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2 text-sm border-t dark:border-blue-700 pt-2">
                  <span className="font-semibold text-blue-700 dark:text-blue-300">{t('physiotherapy.paidAmount')}</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {(formData.totalPrice - formData.remainingAmount).toFixed(2)} {t('physiotherapy.egp')}
                  </span>
                </div>
                {formData.remainingAmount > 0 && (
                  <div className="flex justify-between items-center mt-1 text-sm">
                    <span className="font-semibold text-orange-700 dark:text-orange-300">{t('physiotherapy.remaining')}</span>
                    <span className="font-bold text-orange-600 dark:text-orange-400">
                      {formData.remainingAmount.toFixed(2)} {t('physiotherapy.egp')}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Referral Section */}
            {settings.physioReferralEnabled && !editingSession && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 border-2 border-purple-200 dark:border-purple-700">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span className="text-2xl">🎁</span>
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
                      💰 عمولة Referral: {settings.physioReferralPercentage}% من سعر الاشتراك
                    </p>
                    <p className="text-sm font-semibold text-purple-600 dark:text-purple-400 mt-1">
                      = {((formData.totalPrice * settings.physioReferralPercentage) / 100).toFixed(2)} ج.م
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600"
              >
                {loading ? t('physiotherapy.saving') : editingSession ? t('physiotherapy.updateButton') : t('physiotherapy.addSessionButton')}
              </button>
              {editingSession && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  {t('physiotherapy.cancelButton')}
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6" dir={direction}>
        <div className="mb-4">
          <input
            type="text"
            placeholder={`🔍 ${t('physiotherapy.searchPlaceholder')}`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border-2 dark:border-gray-600 rounded-lg text-lg dark:bg-gray-700 dark:text-white"
          />
        </div>

        {/* الفلاتر */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* فلتر أخصائي العلاج الطبيعي */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-900 dark:text-gray-100">{t('physiotherapy.filterByPhysiotherapyist')}</label>
            <select
              value={filterCoach}
              onChange={(e) => setFilterCoach(e.target.value)}
              className="w-full px-3 py-2 border-2 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="">{t('physiotherapy.allPhysiotherapyists')}</option>
              {(Array.from(new Set(sessions.map(s => s.therapistName).filter((name): name is string => !!name))) as string[]).sort().map(coach => (
                <option key={coach} value={coach}>{coach}</option>
              ))}
            </select>
          </div>

          {/* فلتر الحالة */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-900 dark:text-gray-100">{t('physiotherapy.filterByStatus')}</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-3 py-2 border-2 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="all">{t('physiotherapy.allStatus')}</option>
              <option value="active">{t('physiotherapy.statusActive')}</option>
              <option value="expiring">{t('physiotherapy.statusExpiring')}</option>
              <option value="expired">{t('physiotherapy.statusExpired')}</option>
            </select>
          </div>

          {/* فلتر الجلسات */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-900 dark:text-gray-100">{t('physiotherapy.filterBySessions')}</label>
            <select
              value={filterSessions}
              onChange={(e) => setFilterSessions(e.target.value as any)}
              className="w-full px-3 py-2 border-2 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="all">{t('physiotherapy.allSessions')}</option>
              <option value="low">{t('physiotherapy.sessionsLow')}</option>
              <option value="zero">{t('physiotherapy.sessionsZero')}</option>
            </select>
          </div>

          {/* فلتر النوع (Physiotherapy عادي / Day Use) */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-900 dark:text-gray-100">نوع الجلسة</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-3 py-2 border-2 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="all">الكل</option>
              <option value="regular">Physiotherapy عادي</option>
              <option value="dayuse">🏃 Day Use</option>
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
              🔄 {t('physiotherapy.resetFilters')}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">{t('physiotherapy.loading')}</div>
      ) : (
        <>
          {/* Desktop Table - Hidden on mobile/tablet */}
          <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" dir={direction}>
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className={`px-4 py-3 text-gray-900 dark:text-gray-100 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('physiotherapy.physioNumber')}</th>
                    <th className={`px-4 py-3 text-gray-900 dark:text-gray-100 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('physiotherapy.client')}</th>
                    <th className={`px-4 py-3 text-gray-900 dark:text-gray-100 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('physiotherapy.therapist')}</th>
                    <th className={`px-4 py-3 text-gray-900 dark:text-gray-100 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('physiotherapy.sessions')}</th>
                    <th className={`px-4 py-3 text-gray-900 dark:text-gray-100 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('physiotherapy.total')}</th>
                    <th className={`px-4 py-3 text-gray-900 dark:text-gray-100 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('physiotherapy.remaining')}</th>
                    <th className={`px-4 py-3 text-gray-900 dark:text-gray-100 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('physiotherapy.dates')}</th>
                    {!isCoach && <th className={`px-4 py-3 text-gray-900 dark:text-gray-100 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('physiotherapy.actions')}</th>}
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
                        key={session.physioNumber}
                        className={`border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                          isExpired ? 'bg-red-50 dark:bg-red-900/20' : isExpiringSoon ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          {session.physioNumber < 0 ? (
                            <span className="font-bold text-blue-600 dark:text-blue-400">🏃 Day Use</span>
                          ) : (
                            <span className="font-bold text-blue-600 dark:text-blue-400">#{session.physioNumber}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-gray-100">{session.clientName}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">{session.phone}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{session.therapistName}</td>
                        <td className="px-4 py-3">
                          <div className="text-center">
                            <p
                              className={`font-bold ${
                                session.sessionsRemaining === 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : session.sessionsRemaining <= 3
                                  ? 'text-orange-600 dark:text-orange-400'
                                  : 'text-blue-600 dark:text-blue-400'
                              }`}
                            >
                              {session.sessionsRemaining}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{t('physiotherapy.of')} {session.sessionsPurchased}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-blue-600 dark:text-blue-400">
                          {(session.sessionsPurchased * session.pricePerSession).toFixed(0)} {t('physiotherapy.egp')}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`font-bold ${
                              (session.remainingAmount || 0) > 0
                                ? 'text-orange-600 dark:text-orange-400'
                                : 'text-blue-600 dark:text-blue-400'
                            }`}
                          >
                            {(session.remainingAmount || 0).toFixed(0)} {t('physiotherapy.egp')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs font-mono text-gray-900 dark:text-gray-100">
                            {session.startDate && (
                              <p>{t('physiotherapy.from')} {formatDateYMD(session.startDate)}</p>
                            )}
                            {session.expiryDate && (
                              <p className={isExpired ? 'text-red-600 dark:text-red-400 font-bold' : ''}>
                                {t('physiotherapy.to')} {formatDateYMD(session.expiryDate)}
                              </p>
                            )}
                            {isExpired && <p className="text-red-600 dark:text-red-400 font-bold">{t('physiotherapy.expired')}</p>}
                            {!isExpired && isExpiringSoon && (
                              <p className="text-orange-600 dark:text-orange-400 font-bold">{t('physiotherapy.expiringSoon')}</p>
                            )}
                          </div>
                        </td>
                        {!isCoach && (
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {/* إخفاء زر الحضور للـ Day Use */}
                              {session.physioNumber >= 0 && (
                                <button
                                  onClick={() => handleRegisterSession(session)}
                                  disabled={session.sessionsRemaining === 0}
                                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                  {t('physiotherapy.attendance')}
                                </button>
                              )}
                              {session.physioNumber >= 0 && (
                                <button
                                  onClick={() => handleRenew(session)}
                                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                                >
                                  {t('physiotherapy.renew')}
                                </button>
                              )}
                              {(session.remainingAmount || 0) > 0 && (
                                <button
                                  onClick={() => handleOpenPaymentModal(session)}
                                  className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700"
                                >
                                  {t('physiotherapy.payRemaining')}
                                </button>
                              )}
                              <button
                                onClick={() => handleEdit(session)}
                                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 flex items-center gap-1"
                              >
                                ✏️ {t('physiotherapy.edit')}
                              </button>
                              <button
                                onClick={() => handleDelete(session.physioNumber)}
                                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 flex items-center gap-1"
                              >
                                {t('physiotherapy.delete')}
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
                  key={session.physioNumber}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border-2 hover:shadow-lg dark:hover:shadow-2xl transition ${
                    isExpired ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20' :
                    isExpiringSoon ? 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20' :
                    'border-gray-200 dark:border-gray-600'
                  }`}
                >
                  {/* Header */}
                  <div className={`p-2.5 ${
                    isExpired ? 'bg-red-600 dark:bg-red-700' :
                    isExpiringSoon ? 'bg-orange-600 dark:bg-orange-700' :
                    'bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="text-xl font-bold text-white">
                        {session.physioNumber < 0 ? '🏃 Day Use' : `#${session.physioNumber}`}
                      </div>
                      <div className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        session.sessionsRemaining === 0 ? 'bg-red-500' : session.sessionsRemaining <= 3 ? 'bg-orange-500' : 'bg-blue-500'
                      } text-white`}>
                        {session.sessionsRemaining} / {session.sessionsPurchased} {t('physiotherapy.session')}
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-3 space-y-2.5">
                    {/* Client Info */}
                    <div className="pb-2.5 border-b-2 border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">👤</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">{t('physiotherapy.client')}</span>
                      </div>
                      <div className="text-base font-bold text-gray-800 dark:text-gray-100">{session.clientName}</div>
                      <div className="text-sm font-mono text-gray-600 dark:text-gray-300 mt-1">{session.phone}</div>
                    </div>

                    {/* Physiotherapyist */}
                    <div className="pb-2.5 border-b-2 border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">💊</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">{t('physiotherapy.therapist')}</span>
                      </div>
                      <div className="text-base font-bold text-gray-800 dark:text-gray-100">{session.therapistName}</div>
                    </div>

                    {/* Price Info */}
                    <div className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-2.5">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-sm">💵</span>
                        <span className="text-xs text-blue-700 dark:text-blue-300 font-semibold">{t('physiotherapy.total')}</span>
                      </div>
                      <div className="text-base font-bold text-blue-600 dark:text-blue-400">
                        {(session.sessionsPurchased * session.pricePerSession).toFixed(0)} {t('physiotherapy.egp')}
                      </div>
                    </div>

                    {/* Remaining Amount */}
                    {(session.remainingAmount || 0) > 0 && (
                      <div className="bg-orange-50 dark:bg-orange-900/30 border-2 border-orange-300 dark:border-orange-700 rounded-lg p-2.5">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-sm">⚠️</span>
                          <span className="text-xs text-orange-700 dark:text-orange-300 font-semibold">{t('physiotherapy.remainingAmountLabel')}</span>
                        </div>
                        <div className="text-base font-bold text-orange-600 dark:text-orange-400">
                          {(session.remainingAmount || 0).toFixed(0)} {t('physiotherapy.egp')}
                        </div>
                      </div>
                    )}

                    {/* Dates */}
                    {(session.startDate || session.expiryDate) && (
                      <div className={`border-2 rounded-lg p-2.5 ${
                        isExpired ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700' :
                        isExpiringSoon ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700' :
                        'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm">📅</span>
                          <span className={`text-xs font-semibold ${
                            isExpired ? 'text-red-700 dark:text-red-300' :
                            isExpiringSoon ? 'text-orange-700 dark:text-orange-300' :
                            'text-gray-700 dark:text-gray-200'
                          }`}>{t('physiotherapy.period')}</span>
                        </div>
                        <div className="space-y-1 text-xs font-mono">
                          {session.startDate && (
                            <div className="text-gray-700 dark:text-gray-200">{t('physiotherapy.from')} {formatDateYMD(session.startDate)}</div>
                          )}
                          {session.expiryDate && (
                            <div className={isExpired ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-700 dark:text-gray-200'}>
                              {t('physiotherapy.to')} {formatDateYMD(session.expiryDate)}
                            </div>
                          )}
                          {isExpired && (
                            <div className="text-red-600 dark:text-red-400 font-bold">{t('physiotherapy.expired')}</div>
                          )}
                          {!isExpired && isExpiringSoon && (
                            <div className="text-orange-600 dark:text-orange-400 font-bold">{t('physiotherapy.expiringSoon')}</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {!isCoach && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {/* إخفاء أزرار الحضور والتجديد للـ Day Use */}
                        {session.physioNumber >= 0 && (
                          <>
                            <button
                              onClick={() => handleRegisterSession(session)}
                              disabled={session.sessionsRemaining === 0}
                              className="bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold flex items-center justify-center gap-1"
                            >
                              {t('physiotherapy.attendance')}
                            </button>
                            <button
                              onClick={() => handleRenew(session)}
                              className="bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 font-bold flex items-center justify-center gap-1"
                            >
                              {t('physiotherapy.renew')}
                            </button>
                          </>
                        )}
                        {(session.remainingAmount || 0) > 0 && (
                          <button
                            onClick={() => handleOpenPaymentModal(session)}
                            className="col-span-2 bg-orange-600 text-white py-2 rounded-lg text-sm hover:bg-orange-700 font-bold flex items-center justify-center gap-1"
                          >
                            <span>💰</span>
                            <span>{t('physiotherapy.payRemaining').replace('💰 ', '')} ({(session.remainingAmount || 0).toFixed(0)} {t('physiotherapy.egp')})</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(session)}
                          className="bg-blue-600 text-white py-2 rounded-lg text-sm hover:bg-blue-700 font-bold flex items-center justify-center gap-1"
                        >
                          <span>✏️</span>
                          <span>{t('physiotherapy.edit')}</span>
                        </button>
                        <button
                          onClick={() => handleDelete(session.physioNumber)}
                          className="bg-red-600 text-white py-2 rounded-lg text-sm hover:bg-red-700 font-bold flex items-center justify-center gap-1"
                        >
                          <span>🗑️</span>
                          <span>{t('physiotherapy.deleteSubscription')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {filteredSessions.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center text-gray-500 dark:text-gray-400">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-xl">{searchTerm ? t('physiotherapy.noSearchResults') : t('physiotherapy.noSessions')}</p>
            </div>
          )}
        </>
      )}

      {/* Barcode Modal */}
      {showQRModal && selectedSession && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-6" dir={direction}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">{t('physiotherapy.barcodeModal.title')} - {selectedSession.clientName}</h2>
              <button
                onClick={() => {
                  setShowQRModal(false)
                  setSelectedSession(null)
                }}
                className="text-gray-400 dark:text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:text-gray-300 text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* معلومات الاشتراك */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-50 border-2 border-blue-200 rounded-lg p-4 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-300">{t('physiotherapy.physioNumber')}:</span>
                    <span className="font-bold mr-2">#{selectedSession.physioNumber}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-300">{t('physiotherapy.therapist')}:</span>
                    <span className="font-bold mr-2">{selectedSession.therapistName}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-300">{t('physiotherapy.barcodeModal.sessionsRemaining')}</span>
                    <span className="font-bold mr-2 text-blue-600">
                      {selectedSession.sessionsRemaining} / {selectedSession.sessionsPurchased}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-300">{t('physiotherapy.barcodeModal.phone')}</span>
                    <span className="font-bold mr-2">{selectedSession.phone}</span>
                  </div>
                </div>
              </div>

              {/* Barcode Image */}
              {selectedSession.qrCodeImage ? (
                <div className="flex flex-col items-center bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 dark:border-gray-600 rounded-lg p-6">
                  <img
                    src={selectedSession.qrCodeImage}
                    alt="Barcode"
                    className="w-full max-w-md h-auto"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-3 text-center">
                    {t('physiotherapy.barcodeModal.scanNote')}
                  </p>
                </div>
              ) : (
                <div className="bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 dark:bg-gray-700 rounded-lg p-6 text-center">
                  <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">{t('physiotherapy.barcodeModal.noBarcode')}</p>
                </div>
              )}

              {/* Barcode Text */}
              <div className="bg-gray-50 dark:bg-gray-700 dark:bg-gray-700 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('physiotherapy.barcodeModal.physiotherapyCode')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={selectedSession.qrCode}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 dark:border-gray-600 dark:border-gray-600 rounded-lg font-mono text-sm"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedSession.qrCode || '')
                      toast.success(t('physiotherapy.barcodeModal.codeCopied'))
                    }}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 text-sm font-medium"
                  >
                    {t('physiotherapy.barcodeModal.copyCode')}
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
                    link.download = `Physiotherapy_${selectedSession.physioNumber}_${selectedSession.clientName}_QR.png`
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)

                    toast.success(t('physiotherapy.barcodeModal.barcodeDownloaded'))
                  }}
                  className="bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-bold flex items-center justify-center gap-2"
                >
                  {t('physiotherapy.barcodeModal.downloadQR')}
                </button>

                {/* زر مشاركة Barcode (للموبايل) */}
                <button
                  onClick={async () => {
                    if (!selectedSession.qrCodeImage) return

                    try {
                      // تحويل base64 إلى blob
                      const response = await fetch(selectedSession.qrCodeImage)
                      const blob = await response.blob()
                      const file = new File([blob], `Physiotherapy_QR_${selectedSession.clientName}.png`, { type: 'image/png' })

                      // استخدام Share API
                      if (navigator.share && navigator.canShare({ files: [file] })) {
                        await navigator.share({
                          title: `Barcode - ${selectedSession.clientName}`,
                          text: t('physiotherapy.whatsappShareText', {
                            clientName: selectedSession.clientName,
                            sessionsRemaining: selectedSession.sessionsRemaining.toString(),
                            sessionsPurchased: selectedSession.sessionsPurchased.toString(),
                            therapistName: selectedSession.therapistName
                          }),
                          files: [file]
                        })
                        toast.success(t('physiotherapy.barcodeModal.barcodeDownloaded'))
                      } else {
                        // Fallback: تحميل الصورة
                        const link = document.createElement('a')
                        link.href = selectedSession.qrCodeImage
                        link.download = `Physiotherapy_${selectedSession.physioNumber}_QR.png`
                        link.click()
                        toast.info(t('physiotherapy.barcodeModal.shareNotSupported'))
                      }
                    } catch (error) {
                      console.error('Share error:', error)
                      toast.error(t('physiotherapy.barcodeModal.shareFailed'))
                    }
                  }}
                  className="bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-bold flex items-center justify-center gap-2"
                >
                  {t('physiotherapy.barcodeModal.shareQR')}
                </button>

                {/* زر إرسال رابط واتساب */}
                <button
                  onClick={() => {
                    const checkInUrl = `${window.location.origin}/physiotherapy/check-in`
                    const text = t('physiotherapy.whatsappWithLink', {
                      clientName: selectedSession.clientName,
                      checkInUrl,
                      sessionsRemaining: selectedSession.sessionsRemaining.toString(),
                      sessionsPurchased: selectedSession.sessionsPurchased.toString(),
                      therapistName: selectedSession.therapistName
                    })
                    const phone = selectedSession.phone.startsWith('0') ? '2' + selectedSession.phone : selectedSession.phone
                    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
                    window.open(whatsappUrl, '_blank')
                  }}
                  className="col-span-2 bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600 font-bold flex items-center justify-center gap-2"
                >
                  {t('physiotherapy.barcodeModal.sendWhatsAppLink')}
                </button>
              </div>

              <div className="bg-blue-50 border-r-4 border-blue-500 p-3 rounded dark:bg-blue-900/20 dark:border-blue-700">
                <p className="text-xs text-blue-800">
                  {t('physiotherapy.barcodeModal.note')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && paymentSession && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6" dir={direction}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">{t('physiotherapy.paymentModal.title')}</h2>
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
              <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-lg p-4 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">{t('physiotherapy.physioNumber')}:</span>
                    <span className="font-bold">#{paymentSession.physioNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">{t('physiotherapy.client')}:</span>
                    <span className="font-bold">{paymentSession.clientName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">{t('physiotherapy.therapist')}:</span>
                    <span className="font-bold">{paymentSession.therapistName}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-orange-700 font-semibold">{t('physiotherapy.paymentModal.remainingAmount')}</span>
                    <span className="font-bold text-orange-600 text-lg">
                      {(paymentSession.remainingAmount || 0).toFixed(0)} {t('physiotherapy.egp')}
                    </span>
                  </div>
                </div>
              </div>

              {/* مبلغ الدفع */}
              <div>
                <label className="block text-sm font-bold mb-2">
                  {t('physiotherapy.paymentModal.paymentAmountRequired')}
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
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:border-gray-600 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-bold dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
                    className="flex-1 px-3 py-1 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded text-sm font-medium"
                  >
                    {t('physiotherapy.paymentModal.payAll')} ({(paymentSession.remainingAmount || 0).toFixed(0)})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPaymentFormData({
                        ...paymentFormData,
                        paymentAmount: (paymentSession.remainingAmount || 0) / 2
                      })
                    }
                    className="flex-1 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-sm font-medium"
                  >
                    {t('physiotherapy.paymentModal.payHalf')} ({((paymentSession.remainingAmount || 0) / 2).toFixed(0)})
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
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-700 font-semibold">
                      {t('physiotherapy.paymentModal.remainingAfterPayment')}
                    </span>
                    <span className="text-lg font-bold text-blue-600">
                      {((paymentSession.remainingAmount || 0) - paymentFormData.paymentAmount).toFixed(0)} {t('physiotherapy.egp')}
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
                  className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold"
                >
                  {t('physiotherapy.deleteConfirm.cancel')}
                </button>
                <button
                  onClick={handlePayRemaining}
                  disabled={loading || paymentFormData.paymentAmount <= 0 || paymentFormData.paymentAmount > (paymentSession.remainingAmount || 0)}
                  className="bg-orange-600 text-white py-3 rounded-lg hover:bg-orange-700 font-bold disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? t('physiotherapy.paymentModal.paying') : t('physiotherapy.paymentModal.confirmPayment')}
                </button>
              </div>

              {/* ملاحظة */}
              <div className="bg-orange-50 border-r-4 border-orange-500 p-3 rounded dark:bg-orange-900/20 dark:border-orange-700">
                <p className="text-xs text-orange-800">
                  {t('physiotherapy.paymentModal.note')}
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
    </div>
  )
}

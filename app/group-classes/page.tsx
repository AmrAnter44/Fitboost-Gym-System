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
import { fetchCoaches } from '../../lib/api/pt'
import { useServiceSettings } from '../../contexts/ServiceSettingsContext'
import { useDebounce } from '../../hooks/useDebounce'

interface Staff {
  id: string
  name: string
  phone?: string
  position?: string
  isActive: boolean
}

interface GroupClassSession {
  groupClassNumber: number
  clientName: string
  phone: string
  sessionsPurchased: number
  sessionsRemaining: number
  instructorName: string
  pricePerSession: number
  remainingAmount?: number
  startDate: string | null
  expiryDate: string | null
  createdAt: string
  qrCode?: string
  qrCodeImage?: string
}

export default function GroupClassPage() {
  const router = useRouter()
  const { hasPermission, loading: permissionsLoading, user } = usePermissions()
  const { t, direction } = useLanguage()
  const toast = useToast()
  const { confirm, isOpen, options, handleConfirm, handleCancel } = useConfirm()
  const { settings } = useServiceSettings()
  const queryClient = useQueryClient()

  // ✅ استخدام useQuery لجلب جلسات GroupClass
  const {
    data: sessions = [],
    isLoading: loading,
    error: sessionsError,
    refetch: refetchSessions
  } = useQuery({
    queryKey: ['groupClass-sessions'],
    queryFn: async () => {
      const response = await fetch('/api/group-classes')
      if (!response.ok) {
        if (response.status === 401) throw new Error('UNAUTHORIZED')
        if (response.status === 403) throw new Error('FORBIDDEN')
        throw new Error('Failed to fetch group class sessions')
      }
      return response.json()
    },
    enabled: !permissionsLoading && hasPermission('canViewGroupClass'),
    retry: 1,
    staleTime: 2 * 60 * 1000,
  })

  // ✅ استخدام useQuery لجلب مدربو جروب كلاسيس
  const {
    data: coaches = [],
    isLoading: coachesLoading
  } = useQuery({
    queryKey: ['coaches'],
    queryFn: fetchCoaches,
    enabled: !permissionsLoading,
    retry: 1,
    staleTime: 5 * 60 * 1000, // مدربو جروب كلاسيس مش بيتغيروا كتير
  })

  const [showForm, setShowForm] = useState(false)
  const [editingSession, setEditingSession] = useState<GroupClassSession | null>(null)

  // ── Schedule Modal ──────────────────────────────────────────────────────────
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [schedules, setSchedules] = useState<any[]>([])
  const [loadingSchedules, setLoadingSchedules] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({
    dayOfWeek: 0,
    startTime: '09:00',
    className: '',
    coachName: '',
    duration: 60,
  })
  const [editingSchedule, setEditingSchedule] = useState<any | null>(null)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [showQRModal, setShowQRModal] = useState(false)
  const [selectedSession, setSelectedSession] = useState<GroupClassSession | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentSession, setPaymentSession] = useState<GroupClassSession | null>(null)
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
    groupClassNumber: string
    clientName: string
    phone: string
    memberNumber?: number | null
    sessionsPurchased: number
    sessionsRemaining: number
    instructorName: string
    totalPrice: number
    remainingAmount: number
    startDate: string
    expiryDate: string
    paymentMethod: string | PaymentMethod[]
    staffName: string
  }>({
    groupClassNumber: '',
    clientName: '',
    phone: '',
    sessionsPurchased: 8,
    sessionsRemaining: 8,
    instructorName: '',
    totalPrice: 0,
    remainingAmount: 0,
    startDate: formatDateYMD(new Date()),
    expiryDate: '',
    paymentMethod: 'cash',
    staffName: user?.name || '',
  })

  // ✅ معالجة أخطاء جلسات GroupClass
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
      const response = await fetch('/api/packages?serviceType=GroupClass')
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
      fetchMemberByNumber(formData.groupClassNumber)
    }
  }

  const resetForm = () => {
    setFormData({
      groupClassNumber: '',
      clientName: '',
      phone: '',
      sessionsPurchased: 8,
      sessionsRemaining: 8,
      instructorName: '',
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

  const handleEdit = (session: GroupClassSession) => {
    const totalPrice = session.sessionsPurchased * session.pricePerSession
    setFormData({
      groupClassNumber: session.groupClassNumber.toString(),
      clientName: session.clientName,
      phone: session.phone,
      sessionsPurchased: session.sessionsPurchased,
      sessionsRemaining: session.sessionsRemaining,
      instructorName: session.instructorName,
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
    setIsDayUse(session.groupClassNumber < 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()


    try {
      const url = '/api/group-classes'
      const method = editingSession ? 'PUT' : 'POST'
      const body = editingSession
        ? { groupClassNumber: editingSession.groupClassNumber, ...formData, staffName: user?.name || '' }
        : { ...formData, staffName: user?.name || '' }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(editingSession ? t('groupClass.messages.sessionUpdated') : t('groupClass.messages.sessionAdded'))
        refetchSessions()
        resetForm()
      } else {
        toast.error(`${t('groupClass.messages.operationFailed')} - ${result.error || ''}`)
      }
    } catch (error) {
      console.error(error)
      toast.error(t('groupClass.messages.error'))
    } finally {

    }
  }

  const handleDelete = async (groupClassNumber: number) => {
    const confirmed = await confirm({
      title: t('groupClass.deleteConfirm.title'),
      message: t('groupClass.deleteConfirm.message', { groupClassNumber: groupClassNumber.toString() }),
      confirmText: t('groupClass.deleteConfirm.confirm'),
      cancelText: t('groupClass.deleteConfirm.cancel'),
      type: 'danger'
    })

    if (!confirmed) return

    // ✅ Optimistic Update
    const previousData = queryClient.getQueryData<any[]>(['groupClass-sessions'])
    queryClient.setQueryData<any[]>(['groupClass-sessions'], (old) =>
      old ? old.filter(s => s.groupClassNumber !== groupClassNumber) : old
    )

    try {
      const response = await fetch(`/api/group-classes?groupClassNumber=${groupClassNumber}`, { method: 'DELETE' })

      if (!response.ok) {
        const errorData = await response.json()
        queryClient.setQueryData(['groupClass-sessions'], previousData)
        throw new Error(errorData.error || t('groupClass.messages.deleteFailed'))
      }

      toast.success(t('groupClass.messages.sessionDeleted'))
      queryClient.invalidateQueries({ queryKey: ['groupClass-sessions'] })
    } catch (error: any) {
      queryClient.setQueryData(['groupClass-sessions'], previousData)
      console.error('Error:', error)
      toast.error(`${t('groupClass.messages.deleteFailed')} - ${error.message || ''}`)
    }
  }

  const handleRenew = (session: GroupClassSession) => {
    router.push(`/groupClass/renew?groupClassNumber=${session.groupClassNumber}`)
  }

  const handleRegisterSession = (session: GroupClassSession) => {
    router.push(`/groupClass/sessions/register?groupClassNumber=${session.groupClassNumber}`)
  }

  const handleOpenPaymentModal = async (session: GroupClassSession) => {
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

      const response = await fetch('/api/group-classes/pay-remaining', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupClassNumber: paymentSession.groupClassNumber,
          paymentAmount: paymentFormData.paymentAmount,
          paymentMethod: paymentFormData.paymentMethod,
          staffName: user?.name || ''
        })
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(t('groupClass.messages.paymentSuccess'))
        refetchSessions()
        setShowPaymentModal(false)
        setPaymentSession(null)
      } else {
        toast.error(`${t('groupClass.messages.paymentFailed')} - ${result.error || ''}`)
      }
    } catch (error) {
      console.error('Error paying remaining:', error)
      toast.error(t('groupClass.messages.paymentFailed'))
    } finally {

    }
  }

  const filteredSessions = sessions.filter((session) => {
    // البحث النصي
    const matchesSearch =
      session.clientName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      session.instructorName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      session.groupClassNumber.toString().includes(debouncedSearchTerm) ||
      session.phone.includes(debouncedSearchTerm)

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

    // فلتر النوع (GroupClass عادي / Day Use)
    let matchesType = true
    if (filterType === 'regular') matchesType = session.groupClassNumber >= 0
    else if (filterType === 'dayuse') matchesType = session.groupClassNumber < 0

    return matchesSearch && matchesStatus && matchesSessions && matchesType
  })

  // ── Schedule helpers ────────────────────────────────────────────────────────
  const DAY_NAMES_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

  const fetchSchedules = async () => {
    setLoadingSchedules(true)
    try {
      const res = await fetch('/api/group-classes/schedule')
      if (res.ok) setSchedules(await res.json())
    } catch {
      toast.error('فشل تحميل المواعيد')
    } finally {
      setLoadingSchedules(false)
    }
  }

  const openScheduleModal = () => {
    setShowScheduleModal(true)
    fetchSchedules()
  }

  const resetScheduleForm = () => {
    setScheduleForm({ dayOfWeek: 0, startTime: '09:00', className: '', coachName: '', duration: 60 })
    setEditingSchedule(null)
  }

  const handleSaveSchedule = async () => {
    if (!scheduleForm.className.trim() || !scheduleForm.coachName.trim() || !scheduleForm.startTime) {
      toast.error('يرجى تعبئة اسم الكلاس والكوتش والوقت')
      return
    }
    setSavingSchedule(true)
    try {
      const url = editingSchedule
        ? `/api/group-classes/schedule/${editingSchedule.id}`
        : '/api/group-classes/schedule'
      const method = editingSchedule ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleForm),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'فشل الحفظ')
        return
      }
      toast.success(editingSchedule ? 'تم تعديل الموعد' : 'تم إضافة الموعد')
      resetScheduleForm()
      fetchSchedules()
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setSavingSchedule(false)
    }
  }

  const handleDeleteSchedule = async (id: string) => {
    const confirmed = await confirm({
      title: 'حذف الموعد',
      message: 'هل أنت متأكد من حذف هذا الموعد؟',
      confirmText: 'حذف',
      type: 'danger',
    })
    if (!confirmed) return
    try {
      const res = await fetch(`/api/group-classes/schedule/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('تم حذف الموعد')
        setSchedules(prev => prev.filter(s => s.id !== id))
      } else {
        toast.error('فشل الحذف')
      }
    } catch {
      toast.error('حدث خطأ')
    }
  }

  // ✅ التحقق من الصلاحيات
  if (permissionsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl">{t('groupClass.loading')}</div>
      </div>
    )
  }

  if (!hasPermission('canViewGroupClass')) {
    return <PermissionDenied message={t('groupClass.noPermission')} />
  }

  const isCoach = user?.role === 'COACH'

  return (
    <div className="container mx-auto p-4 sm:p-6" dir={direction}>
      <div className="mb-6">
        <div className="mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">👥 {t('groupClass.title')}</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
            {isCoach ? t('groupClass.viewSessions') : t('groupClass.manageSessions')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button
            onClick={() => router.push('/groupClass/sessions/history')}
            className="flex-1 min-w-[140px] sm:flex-none bg-gradient-to-r from-primary-600 to-primary-700 text-white px-3 sm:px-6 py-2 rounded-lg hover:from-primary-700 hover:to-primary-800 transition shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <span>📊</span>
            <span>{t('groupClass.attendanceLog')}</span>
          </button>
          {!isCoach && (
            <>
              <button
                onClick={openScheduleModal}
                className="w-full sm:w-auto bg-purple-600 text-white px-3 sm:px-6 py-2 rounded-lg hover:bg-purple-700 transition flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <span>📅</span>
                <span>مواعيد الكلاسيس</span>
              </button>
              <button
                onClick={() => {
                  resetForm()
                  setShowForm(!showForm)
                }}
                className="w-full sm:w-auto bg-primary-600 text-white px-3 sm:px-6 py-2 rounded-lg hover:bg-primary-700 transition flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                {showForm ? t('groupClass.hideForm') : `➕ ${t('groupClass.addNewSession')}`}
              </button>
            </>
          )}
        </div>
      </div>

      {!isCoach && showForm && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg mb-6 border-2 border-primary-100 dark:border-primary-700" dir={direction}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {editingSession ? t('groupClass.editSession') : t('groupClass.addSession')}
            </h2>
            {editingSession && isDayUse && (
              <span className="bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-300 px-3 py-1 rounded-full text-sm font-bold">
                🏃 Day Use
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!isDayUse && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                    {t('groupClass.groupClassId')} <span className="text-xs text-gray-500 dark:text-gray-400">(اختياري)</span>
                  </label>
                  <input
                    type="number"
                    disabled={!!editingSession}
                    value={formData.groupClassNumber}
                    onChange={(e) => setFormData({ ...formData, groupClassNumber: e.target.value })}
                    onKeyPress={handleIdKeyPress}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg disabled:bg-gray-100 dark:disabled:bg-gray-700 dark:bg-gray-700 dark:text-white"
                    placeholder="اختياري - يمكن تركه فارغ"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">💡 اضغط Enter لتحميل بيانات العضو تلقائياً</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                  {t('groupClass.clientName')} <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder={t('groupClass.clientNamePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                  {t('groupClass.phoneNumber')} <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder={t('groupClass.phonePlaceholder')}
                />
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
                      // إذا تم تفعيل Day Use، اضبط عدد الجلسات على 1 والمبلغ المتبقي على 0 ورقم GroupClass سالب
                      if (e.target.checked) {
                        setFormData(prev => ({
                          ...prev,
                          groupClassNumber: '-1',
                          sessionsPurchased: 1,
                          remainingAmount: 0
                        }))
                      } else {
                        // إذا تم إلغاء Day Use، امسح رقم GroupClass
                        setFormData(prev => ({
                          ...prev,
                          groupClassNumber: ''
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
                  <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
                    ⚡ {t('packages.selectPackage')}
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {packages.map((pkg) => (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => applyPackage(pkg)}
                        className="bg-gradient-to-br from-fuchsia-50 to-pink-100 dark:from-fuchsia-900/50 dark:to-pink-900/50 hover:from-fuchsia-100 hover:to-pink-200 dark:hover:from-fuchsia-800/50 dark:hover:to-pink-800/50 border-2 border-fuchsia-400 dark:border-fuchsia-700 rounded-lg p-3 transition-all hover:scale-105 hover:shadow-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      >
                        <div className="text-center">
                          <div className="text-2xl mb-1">👥</div>
                          <div className="font-bold text-gray-800 dark:text-gray-100 text-sm">{pkg.name}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                            {pkg.sessions} {t('packages.sessions')}
                          </div>
                          <div className="text-lg font-bold text-fuchsia-600 dark:text-fuchsia-400 mt-1">
                            {pkg.price} {t('groupClass.egp')}
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
                    {t('groupClass.sessionsCount')} <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.sessionsPurchased}
                    onChange={(e) => setFormData({ ...formData, sessionsPurchased: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                    placeholder={t('groupClass.sessionsPlaceholder')}
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
                    className="w-full px-3 py-2 border border-primary-300 dark:border-primary-700 rounded-lg bg-primary-50 dark:bg-primary-900/50 dark:text-white"
                    placeholder="عدد الجلسات المتبقية"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    💡 يمكنك تعديل عدد الجلسات المتبقية للعميل
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                  {isDayUse ? 'سعر الجلسة 💰' : t('groupClass.totalPrice')} <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.totalPrice}
                  onChange={(e) => setFormData({ ...formData, totalPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-yellow-300 dark:border-yellow-700 rounded-lg bg-yellow-50 dark:bg-yellow-900/50 dark:text-white"
                  placeholder={isDayUse ? 'أدخل سعر الجلسة' : t('groupClass.totalPricePlaceholder')}
                />
              </div>

              {!isDayUse && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                    {t('groupClass.remainingAmount')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.remainingAmount}
                    onChange={(e) => setFormData({ ...formData, remainingAmount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-orange-300 dark:border-orange-700 rounded-lg bg-orange-50 dark:bg-orange-900/50 dark:text-white"
                    placeholder={t('groupClass.remainingAmountPlaceholder')}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('groupClass.remainingAmountNote')}
                  </p>
                </div>
              )}

              {!isDayUse && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                    {t('groupClass.startDate')} <span className="text-xs text-gray-500 dark:text-gray-400">{t('groupClass.startDateFormat')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg font-mono dark:bg-gray-700 dark:text-white"
                    placeholder={t('groupClass.startDatePlaceholder')}
                    pattern="\d{4}-\d{2}-\d{2}"
                  />
                </div>
              )}

              {!isDayUse && (
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">
                    {t('groupClass.expiryDate')} <span className="text-xs text-gray-500 dark:text-gray-400">{t('groupClass.startDateFormat')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg font-mono dark:bg-gray-700 dark:text-white"
                    placeholder={t('groupClass.expiryDatePlaceholder')}
                    pattern="\d{4}-\d{2}-\d{2}"
                  />
                </div>
              )}
            </div>

            {!isDayUse && (
              <div>
                <p className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">{t('groupClass.quickAdd')}</p>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 6, 9, 12].map(months => (
                    <button
                      key={months}
                      type="button"
                      onClick={() => calculateExpiryFromMonths(months)}
                      className="px-3 py-2 bg-primary-100 dark:bg-primary-900/50 hover:bg-primary-200 dark:hover:bg-primary-800/50 text-primary-800 dark:text-primary-200 rounded-lg text-sm transition font-medium"
                    >
                      + {months} {months === 1 ? t('groupClass.month') : t('groupClass.months')}
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
              <div className="bg-primary-50 dark:bg-primary-900/30 border-2 border-primary-200 dark:border-primary-700 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('groupClass.finalTotal')}</span>
                  <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {formData.totalPrice.toFixed(2)} {t('groupClass.egp')}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2 text-sm border-t dark:border-primary-700 pt-2">
                  <span className="font-semibold text-primary-700 dark:text-primary-300">{t('groupClass.paidAmount')}</span>
                  <span className="font-bold text-primary-600 dark:text-primary-400">
                    {(formData.totalPrice - formData.remainingAmount).toFixed(2)} {t('groupClass.egp')}
                  </span>
                </div>
                {formData.remainingAmount > 0 && (
                  <div className="flex justify-between items-center mt-1 text-sm">
                    <span className="font-semibold text-orange-700 dark:text-orange-300">{t('groupClass.remaining')}</span>
                    <span className="font-bold text-orange-600 dark:text-orange-400">
                      {formData.remainingAmount.toFixed(2)} {t('groupClass.egp')}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 dark:hover:bg-primary-800 disabled:bg-gray-400 dark:disabled:bg-gray-600"
              >
                {loading ? t('groupClass.saving') : editingSession ? t('groupClass.updateButton') : t('groupClass.addSessionButton')}
              </button>
              {editingSession && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  {t('groupClass.cancelButton')}
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
            placeholder={`🔍 ${t('groupClass.searchPlaceholder')}`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border-2 dark:border-gray-600 rounded-lg text-lg dark:bg-gray-700 dark:text-white"
          />
        </div>

        {/* الفلاتر */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* فلتر الحالة */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-900 dark:text-gray-100">{t('groupClass.filterByStatus')}</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-3 py-2 border-2 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="all">{t('groupClass.allStatus')}</option>
              <option value="active">{t('groupClass.statusActive')}</option>
              <option value="expiring">{t('groupClass.statusExpiring')}</option>
              <option value="expired">{t('groupClass.statusExpired')}</option>
            </select>
          </div>

          {/* فلتر الجلسات */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-900 dark:text-gray-100">{t('groupClass.filterBySessions')}</label>
            <select
              value={filterSessions}
              onChange={(e) => setFilterSessions(e.target.value as any)}
              className="w-full px-3 py-2 border-2 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="all">{t('groupClass.allSessions')}</option>
              <option value="low">{t('groupClass.sessionsLow')}</option>
              <option value="zero">{t('groupClass.sessionsZero')}</option>
            </select>
          </div>

          {/* فلتر النوع (GroupClass عادي / Day Use) */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-gray-900 dark:text-gray-100">نوع الجلسة</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-3 py-2 border-2 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            >
              <option value="all">الكل</option>
              <option value="regular">GroupClass عادي</option>
              <option value="dayuse">🏃 Day Use</option>
            </select>
          </div>
        </div>

        {/* زر إعادة تعيين الفلاتر */}
        {(filterStatus !== 'all' || filterSessions !== 'all' || filterType !== 'all') && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => {
                setFilterStatus('all')
                setFilterSessions('all')
                setFilterType('all')
              }}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition text-sm font-medium"
            >
              🔄 {t('groupClass.resetFilters')}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">{t('groupClass.loading')}</div>
      ) : (
        <>
          {/* Desktop Table - Hidden on mobile/tablet */}
          <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" dir={direction}>
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className={`px-4 py-3 text-gray-900 dark:text-gray-100 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('groupClass.classNumber')}</th>
                    <th className={`px-4 py-3 text-gray-900 dark:text-gray-100 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('groupClass.client')}</th>
                    <th className={`px-4 py-3 text-gray-900 dark:text-gray-100 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('groupClass.sessions')}</th>
                    <th className={`px-4 py-3 text-gray-900 dark:text-gray-100 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('groupClass.total')}</th>
                    <th className={`px-4 py-3 text-gray-900 dark:text-gray-100 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('groupClass.remaining')}</th>
                    <th className={`px-4 py-3 text-gray-900 dark:text-gray-100 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('groupClass.dates')}</th>
                    {!isCoach && <th className={`px-4 py-3 text-gray-900 dark:text-gray-100 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('groupClass.actions')}</th>}
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
                        key={session.groupClassNumber}
                        className={`border-t hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-700 ${
                          isExpired ? 'bg-red-50' : isExpiringSoon ? 'bg-yellow-50' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          {session.groupClassNumber < 0 ? (
                            <span className="font-bold text-primary-600">🏃 Day Use</span>
                          ) : (
                            <span className="font-bold text-primary-600">#{session.groupClassNumber}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-semibold">{session.clientName}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">{session.phone}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-center">
                            <p
                              className={`font-bold ${
                                session.sessionsRemaining === 0
                                  ? 'text-red-600'
                                  : session.sessionsRemaining <= 3
                                  ? 'text-orange-600'
                                  : 'text-primary-600'
                              }`}
                            >
                              {session.sessionsRemaining}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{t('groupClass.of')} {session.sessionsPurchased}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-primary-600">
                          {(session.sessionsPurchased * session.pricePerSession).toFixed(0)} {t('groupClass.egp')}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`font-bold ${
                              (session.remainingAmount || 0) > 0
                                ? 'text-orange-600'
                                : 'text-primary-600'
                            }`}
                          >
                            {(session.remainingAmount || 0).toFixed(0)} {t('groupClass.egp')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs font-mono">
                            {session.startDate && (
                              <p>{t('groupClass.from')} {formatDateYMD(session.startDate)}</p>
                            )}
                            {session.expiryDate && (
                              <p className={isExpired ? 'text-red-600 font-bold' : ''}>
                                {t('groupClass.to')} {formatDateYMD(session.expiryDate)}
                              </p>
                            )}
                            {isExpired && <p className="text-red-600 font-bold">{t('groupClass.expired')}</p>}
                            {!isExpired && isExpiringSoon && (
                              <p className="text-orange-600 font-bold">{t('groupClass.expiringSoon')}</p>
                            )}
                          </div>
                        </td>
                        {!isCoach && (
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {/* إخفاء زر الحضور للـ Day Use */}
                              {session.groupClassNumber >= 0 && (
                                <button
                                  onClick={() => handleRegisterSession(session)}
                                  disabled={session.sessionsRemaining === 0}
                                  className="bg-primary-600 text-white px-3 py-1 rounded text-sm hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                  {t('groupClass.attendance')}
                                </button>
                              )}
                              {session.groupClassNumber >= 0 && (
                                <button
                                  onClick={() => handleRenew(session)}
                                  className="bg-primary-600 text-white px-3 py-1 rounded text-sm hover:bg-primary-700"
                                >
                                  {t('groupClass.renew')}
                                </button>
                              )}
                              {(session.remainingAmount || 0) > 0 && (
                                <button
                                  onClick={() => handleOpenPaymentModal(session)}
                                  className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700"
                                >
                                  {t('groupClass.payRemaining')}
                                </button>
                              )}
                              <button
                                onClick={() => handleEdit(session)}
                                className="bg-primary-600 text-white px-3 py-1 rounded text-sm hover:bg-primary-700 flex items-center gap-1"
                              >
                                ✏️ {t('groupClass.edit')}
                              </button>
                              <button
                                onClick={() => handleDelete(session.groupClassNumber)}
                                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 flex items-center gap-1"
                              >
                                {t('groupClass.delete')}
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
                  key={session.groupClassNumber}
                  className={`bg-white rounded-xl shadow-md overflow-hidden border-2 hover:shadow-lg transition ${
                    isExpired ? 'border-red-300 bg-red-50' : isExpiringSoon ? 'border-orange-300 bg-orange-50' : 'border-gray-200 dark:border-gray-600'
                  }`}
                >
                  {/* Header */}
                  <div className={`p-2.5 ${isExpired ? 'bg-red-600' : isExpiringSoon ? 'bg-orange-600' : 'bg-gradient-to-r from-primary-600 to-primary-700'}`}>
                    <div className="flex items-center justify-between">
                      <div className="text-xl font-bold text-white">
                        {session.groupClassNumber < 0 ? '🏃 Day Use' : `#${session.groupClassNumber}`}
                      </div>
                      <div className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        session.sessionsRemaining === 0 ? 'bg-red-500' : session.sessionsRemaining <= 3 ? 'bg-orange-500' : 'bg-primary-500'
                      } text-white`}>
                        {session.sessionsRemaining} / {session.sessionsPurchased} {t('groupClass.session')}
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-3 space-y-2.5">
                    {/* Client Info */}
                    <div className="pb-2.5 border-b-2 border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">👤</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 font-semibold">{t('groupClass.client')}</span>
                      </div>
                      <div className="text-base font-bold text-gray-800 dark:text-gray-100">{session.clientName}</div>
                      <div className="text-sm font-mono text-gray-600 dark:text-gray-300 mt-1">{session.phone}</div>
                    </div>

                    {/* Instructor */}
                    <div className="pb-2.5 border-b-2 border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">🥗</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 font-semibold">{t('groupClass.instructor')}</span>
                      </div>
                      <div className="text-base font-bold text-gray-800 dark:text-gray-100">{session.instructorName}</div>
                    </div>

                    {/* Price Info */}
                    <div className="bg-primary-50 border-2 border-primary-200 rounded-lg p-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-sm">💵</span>
                        <span className="text-xs text-primary-700 font-semibold">{t('groupClass.total')}</span>
                      </div>
                      <div className="text-base font-bold text-primary-600">
                        {(session.sessionsPurchased * session.pricePerSession).toFixed(0)} {t('groupClass.egp')}
                      </div>
                    </div>

                    {/* Remaining Amount */}
                    {(session.remainingAmount || 0) > 0 && (
                      <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-2.5 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-sm">⚠️</span>
                          <span className="text-xs text-orange-700 font-semibold">{t('groupClass.remainingAmountLabel')}</span>
                        </div>
                        <div className="text-base font-bold text-orange-600">
                          {(session.remainingAmount || 0).toFixed(0)} {t('groupClass.egp')}
                        </div>
                      </div>
                    )}

                    {/* Dates */}
                    {(session.startDate || session.expiryDate) && (
                      <div className={`border-2 rounded-lg p-2.5 ${
                        isExpired ? 'bg-red-50 border-red-300' : isExpiringSoon ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm">📅</span>
                          <span className={`text-xs font-semibold ${
                            isExpired ? 'text-red-700' : isExpiringSoon ? 'text-orange-700' : 'text-gray-700 dark:text-gray-200'
                          }`}>{t('groupClass.period')}</span>
                        </div>
                        <div className="space-y-1 text-xs font-mono">
                          {session.startDate && (
                            <div className="text-gray-700 dark:text-gray-200">{t('groupClass.from')} {formatDateYMD(session.startDate)}</div>
                          )}
                          {session.expiryDate && (
                            <div className={isExpired ? 'text-red-600 font-bold' : 'text-gray-700 dark:text-gray-200'}>
                              {t('groupClass.to')} {formatDateYMD(session.expiryDate)}
                            </div>
                          )}
                          {isExpired && (
                            <div className="text-red-600 font-bold">{t('groupClass.expired')}</div>
                          )}
                          {!isExpired && isExpiringSoon && (
                            <div className="text-orange-600 font-bold">{t('groupClass.expiringSoon')}</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {!isCoach && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {/* إخفاء أزرار الحضور والتجديد للـ Day Use */}
                        {session.groupClassNumber >= 0 && (
                          <>
                            <button
                              onClick={() => handleRegisterSession(session)}
                              disabled={session.sessionsRemaining === 0}
                              className="bg-primary-600 text-white py-2 rounded-lg text-sm hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold flex items-center justify-center gap-1"
                            >
                              {t('groupClass.attendance')}
                            </button>
                            <button
                              onClick={() => handleRenew(session)}
                              className="bg-primary-600 text-white py-2 rounded-lg text-sm hover:bg-primary-700 font-bold flex items-center justify-center gap-1"
                            >
                              {t('groupClass.renew')}
                            </button>
                          </>
                        )}
                        {(session.remainingAmount || 0) > 0 && (
                          <button
                            onClick={() => handleOpenPaymentModal(session)}
                            className="col-span-2 bg-orange-600 text-white py-2 rounded-lg text-sm hover:bg-orange-700 font-bold flex items-center justify-center gap-1"
                          >
                            <span>💰</span>
                            <span>{t('groupClass.payRemaining').replace('💰 ', '')} ({(session.remainingAmount || 0).toFixed(0)} {t('groupClass.egp')})</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(session)}
                          className="bg-primary-600 text-white py-2 rounded-lg text-sm hover:bg-primary-700 font-bold flex items-center justify-center gap-1"
                        >
                          <span>✏️</span>
                          <span>{t('groupClass.edit')}</span>
                        </button>
                        <button
                          onClick={() => handleDelete(session.groupClassNumber)}
                          className="bg-red-600 text-white py-2 rounded-lg text-sm hover:bg-red-700 font-bold flex items-center justify-center gap-1"
                        >
                          <span>🗑️</span>
                          <span>{t('groupClass.deleteSubscription')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {filteredSessions.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center text-gray-500 dark:text-gray-400 dark:text-gray-500">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-xl">{searchTerm ? t('groupClass.noSearchResults') : t('groupClass.noSessions')}</p>
            </div>
          )}
        </>
      )}

      {/* Barcode Modal */}
      {showQRModal && selectedSession && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-6" dir={direction}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">{t('groupClass.barcodeModal.title')} - {selectedSession.clientName}</h2>
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
                    <span className="text-gray-600 dark:text-gray-300">{t('groupClass.classNumber')}:</span>
                    <span className="font-bold mr-2">#{selectedSession.groupClassNumber}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-300">{t('groupClass.instructor')}:</span>
                    <span className="font-bold mr-2">{selectedSession.instructorName}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-300">{t('groupClass.barcodeModal.sessionsRemaining')}</span>
                    <span className="font-bold mr-2 text-primary-600">
                      {selectedSession.sessionsRemaining} / {selectedSession.sessionsPurchased}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-300">{t('groupClass.barcodeModal.phone')}</span>
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
                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-3 text-center">
                    {t('groupClass.barcodeModal.scanNote')}
                  </p>
                </div>
              ) : (
                <div className="bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 rounded-lg p-6 text-center">
                  <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500">{t('groupClass.barcodeModal.noBarcode')}</p>
                </div>
              )}

              {/* Barcode Text */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {t('groupClass.barcodeModal.groupClassCode')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={selectedSession.qrCode}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 dark:border-gray-600 rounded-lg font-mono text-sm"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedSession.qrCode || '')
                      toast.success(t('groupClass.barcodeModal.codeCopied'))
                    }}
                    className="bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 text-sm font-medium"
                  >
                    {t('groupClass.barcodeModal.copyCode')}
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
                    link.download = `GroupClass_${selectedSession.groupClassNumber}_${selectedSession.clientName}_QR.png`
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)

                    toast.success(t('groupClass.barcodeModal.barcodeDownloaded'))
                  }}
                  className="bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 font-bold flex items-center justify-center gap-2"
                >
                  {t('groupClass.barcodeModal.downloadQR')}
                </button>

                {/* زر مشاركة Barcode (للموبايل) */}
                <button
                  onClick={async () => {
                    if (!selectedSession.qrCodeImage) return

                    try {
                      // تحويل base64 إلى blob
                      const response = await fetch(selectedSession.qrCodeImage)
                      const blob = await response.blob()
                      const file = new File([blob], `GroupClass_QR_${selectedSession.clientName}.png`, { type: 'image/png' })

                      // استخدام Share API
                      if (navigator.share && navigator.canShare({ files: [file] })) {
                        await navigator.share({
                          title: `Barcode - ${selectedSession.clientName}`,
                          text: t('groupClass.whatsappShareText', {
                            clientName: selectedSession.clientName,
                            sessionsRemaining: selectedSession.sessionsRemaining.toString(),
                            sessionsPurchased: selectedSession.sessionsPurchased.toString(),
                            instructorName: selectedSession.instructorName
                          }),
                          files: [file]
                        })
                        toast.success(t('groupClass.barcodeModal.barcodeDownloaded'))
                      } else {
                        // Fallback: تحميل الصورة
                        const link = document.createElement('a')
                        link.href = selectedSession.qrCodeImage
                        link.download = `GroupClass_${selectedSession.groupClassNumber}_QR.png`
                        link.click()
                        toast.info(t('groupClass.barcodeModal.shareNotSupported'))
                      }
                    } catch (error) {
                      console.error('Share error:', error)
                      toast.error(t('groupClass.barcodeModal.shareFailed'))
                    }
                  }}
                  className="bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 font-bold flex items-center justify-center gap-2"
                >
                  {t('groupClass.barcodeModal.shareQR')}
                </button>

                {/* زر إرسال رابط واتساب */}
                <button
                  onClick={() => {
                    const checkInUrl = `${window.location.origin}/groupClass/check-in`
                    const text = t('groupClass.whatsappWithLink', {
                      clientName: selectedSession.clientName,
                      checkInUrl,
                      sessionsRemaining: selectedSession.sessionsRemaining.toString(),
                      sessionsPurchased: selectedSession.sessionsPurchased.toString(),
                      instructorName: selectedSession.instructorName
                    })
                    const phone = selectedSession.phone.startsWith('0') ? '2' + selectedSession.phone : selectedSession.phone
                    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
                    window.open(whatsappUrl, '_blank')
                  }}
                  className="col-span-2 bg-primary-500 text-white py-3 rounded-lg hover:bg-primary-600 font-bold flex items-center justify-center gap-2"
                >
                  {t('groupClass.barcodeModal.sendWhatsAppLink')}
                </button>
              </div>

              <div className="bg-primary-50 border-r-4 border-primary-500 p-3 rounded">
                <p className="text-xs text-primary-800">
                  {t('groupClass.barcodeModal.note')}
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
              <h2 className="text-2xl font-bold">{t('groupClass.paymentModal.title')}</h2>
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

            <div className="space-y-4">
              {/* معلومات الاشتراك */}
              <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-lg p-4 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">{t('groupClass.classNumber')}:</span>
                    <span className="font-bold">#{paymentSession.groupClassNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">{t('groupClass.client')}:</span>
                    <span className="font-bold">{paymentSession.clientName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-300">{t('groupClass.instructor')}:</span>
                    <span className="font-bold">{paymentSession.instructorName}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-orange-700 font-semibold">{t('groupClass.paymentModal.remainingAmount')}</span>
                    <span className="font-bold text-orange-600 text-lg">
                      {(paymentSession.remainingAmount || 0).toFixed(0)} {t('groupClass.egp')}
                    </span>
                  </div>
                </div>
              </div>

              {/* مبلغ الدفع */}
              <div>
                <label className="block text-sm font-bold mb-2">
                  {t('groupClass.paymentModal.paymentAmountRequired')}
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
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-bold dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
                    {t('groupClass.paymentModal.payAll')} ({(paymentSession.remainingAmount || 0).toFixed(0)})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPaymentFormData({
                        ...paymentFormData,
                        paymentAmount: (paymentSession.remainingAmount || 0) / 2
                      })
                    }
                    className="flex-1 px-3 py-1 bg-primary-100 hover:bg-primary-200 text-primary-800 rounded text-sm font-medium"
                  >
                    {t('groupClass.paymentModal.payHalf')} ({((paymentSession.remainingAmount || 0) / 2).toFixed(0)})
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
                <div className="bg-primary-50 border-2 border-primary-200 rounded-lg p-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-primary-700 font-semibold">
                      {t('groupClass.paymentModal.remainingAfterPayment')}
                    </span>
                    <span className="text-lg font-bold text-primary-600">
                      {((paymentSession.remainingAmount || 0) - paymentFormData.paymentAmount).toFixed(0)} {t('groupClass.egp')}
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
                  {t('groupClass.deleteConfirm.cancel')}
                </button>
                <button
                  onClick={handlePayRemaining}
                  disabled={loading || paymentFormData.paymentAmount <= 0 || paymentFormData.paymentAmount > (paymentSession.remainingAmount || 0)}
                  className="bg-orange-600 text-white py-3 rounded-lg hover:bg-orange-700 font-bold disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? t('groupClass.paymentModal.paying') : t('groupClass.paymentModal.confirmPayment')}
                </button>
              </div>

              {/* ملاحظة */}
              <div className="bg-orange-50 border-r-4 border-orange-500 p-3 rounded dark:bg-orange-900/20 dark:border-orange-700">
                <p className="text-xs text-orange-800">
                  {t('groupClass.paymentModal.note')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Schedule Modal ─────────────────────────────────────────────────── */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" dir={direction}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
              <h2 className="text-2xl font-bold dark:text-white">📅 مواعيد الجروب كلاسيس</h2>
              <button
                onClick={() => { setShowScheduleModal(false); resetScheduleForm() }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none"
              >✕</button>
            </div>

            <div className="p-6">
              {/* Add / Edit Form */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-6">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">
                  {editingSchedule ? '✏️ تعديل موعد' : '➕ إضافة موعد جديد'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 block">اليوم</label>
                    <select
                      value={scheduleForm.dayOfWeek}
                      onChange={e => setScheduleForm(p => ({ ...p, dayOfWeek: Number(e.target.value) }))}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      {DAY_NAMES_AR.map((day, i) => (
                        <option key={i} value={i}>{day}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 block">الوقت</label>
                    <input
                      type="time"
                      value={scheduleForm.startTime}
                      onChange={e => setScheduleForm(p => ({ ...p, startTime: e.target.value }))}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 block">اسم الكلاس</label>
                    <input
                      type="text"
                      placeholder="مثال: زومبا، يوجا، كروسفيت"
                      value={scheduleForm.className}
                      onChange={e => setScheduleForm(p => ({ ...p, className: e.target.value }))}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 block">اسم الكوتش</label>
                    <input
                      type="text"
                      placeholder="اسم المدرب"
                      value={scheduleForm.coachName}
                      onChange={e => setScheduleForm(p => ({ ...p, coachName: e.target.value }))}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 block">المدة (دقيقة)</label>
                    <input
                      type="number"
                      min={15}
                      max={180}
                      value={scheduleForm.duration}
                      onChange={e => setScheduleForm(p => ({ ...p, duration: Number(e.target.value) }))}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleSaveSchedule}
                    disabled={savingSchedule}
                    className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition font-medium"
                  >
                    {savingSchedule ? 'جاري الحفظ...' : editingSchedule ? 'حفظ التعديلات' : 'إضافة الموعد'}
                  </button>
                  {editingSchedule && (
                    <button
                      onClick={resetScheduleForm}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-gray-700 dark:text-gray-300"
                    >إلغاء</button>
                  )}
                </div>
              </div>

              {/* Schedule List */}
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">المواعيد الحالية</h3>
                {loadingSchedules ? (
                  <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
                ) : schedules.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                    <div className="text-4xl mb-2">📋</div>
                    <p>لا توجد مواعيد محددة بعد</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {DAY_NAMES_AR.map((dayName, dayIdx) => {
                      const daySchedules = schedules.filter(s => s.dayOfWeek === dayIdx)
                      if (daySchedules.length === 0) return null
                      return (
                        <div key={dayIdx}>
                          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1 mt-3">{dayName}</p>
                          {daySchedules.map(s => (
                            <div key={s.id} className="flex items-center justify-between bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-4 py-2 mb-1">
                              <div className="flex items-center gap-3">
                                <span className="text-purple-600 dark:text-purple-400 font-mono font-bold text-sm">{s.startTime}</span>
                                <div>
                                  <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{s.className}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">👤 {s.coachName} · ⏱ {s.duration} د</p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setEditingSchedule(s)
                                    setScheduleForm({
                                      dayOfWeek: s.dayOfWeek,
                                      startTime: s.startTime,
                                      className: s.className,
                                      coachName: s.coachName,
                                      duration: s.duration,
                                    })
                                  }}
                                  className="text-blue-500 hover:text-blue-700 text-sm px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                                >✏️</button>
                                <button
                                  onClick={() => handleDeleteSchedule(s.id)}
                                  className="text-red-500 hover:text-red-700 text-sm px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition"
                                >🗑️</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
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

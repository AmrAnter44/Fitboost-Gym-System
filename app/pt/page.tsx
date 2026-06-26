'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
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
import PTRenewalForm from '../../components/PTRenewalForm'
import PTFreezeForm from '../../components/PTFreezeForm'
import PTUpgradeForm from '../../components/PTUpgradeForm'
import { LoadingScreen } from '../../components/Spinner'
import { createWhatsAppUrl } from '@/lib/whatsappHelper'
import type { MessageTemplate } from '../followups/MessageTemplateManager'

const SignaturePad = dynamic(() => import('../../components/SignaturePad'), { ssr: false })
//  مودال اختيار قالب الواتساب — reuse من صفحة المتابعات
const MessageTemplateManager = dynamic(() => import('../followups/MessageTemplateManager'), { ssr: false })

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

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
  ptCommissionAmount?: number
  remainingAmount?: number
  startDate: string | null
  expiryDate: string | null
  createdAt: string
  profileImage?: string | null
  isFrozen?: boolean
  freezeUntil?: string | null
}

export default function PTPage() {
  const router = useRouter()
  const { hasPermission, loading: permissionsLoading, user } = usePermissions()
  const { t, direction, locale } = useLanguage()
  const toast = useToast()
  const { confirm, isOpen, options, handleConfirm, handleCancel } = useConfirm()
  const { settings } = useServiceSettings()
  const queryClient = useQueryClient()
  const isCoach = user?.role === 'COACH'

  // استخدام useQuery لجلب جلسات PT
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

  // استخدام useQuery لجلب المدربين
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

  // حالة الإمضاء للكوتش
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [signatureSession, setSignatureSession] = useState<PTSession | null>(null)
  const [renewalSession, setRenewalSession] = useState<PTSession | null>(null)
  const [freezeSession, setFreezeSession] = useState<PTSession | null>(null)
  const [upgradeSession, setUpgradeSession] = useState<PTSession | null>(null)
  //  مودال متابعة الواتساب للاشتراكات المنتهية
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [selectedSessionForTemplate, setSelectedSessionForTemplate] = useState<PTSession | null>(null)

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
    ptCommissionAmount: number | null // عمولة الكوتش من الباقة
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
    ptCommissionAmount: null, // عمولة الكوتش من الباقة
  })

  // معالجة أخطاء جلسات PT
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
    // حساب تاريخ الانتهاء تلقائيًا من durationDays
    let calculatedExpiry = ''
    if (formData.startDate && pkg.durationDays) {
      const start = new Date(formData.startDate)
      const expiry = new Date(start)
      expiry.setDate(expiry.getDate() + pkg.durationDays)
      calculatedExpiry = formatDateYMD(expiry)
    }

    setFormData(prev => ({
      ...prev,
      sessionsPurchased: pkg.sessions,
      sessionsRemaining: pkg.sessions,
      totalPrice: pkg.price,
      expiryDate: calculatedExpiry || prev.expiryDate, // حساب تاريخ الانتهاء تلقائيًا
      ptCommissionAmount: pkg.ptCommission || null // حفظ عمولة الباقة
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
      ptCommissionAmount: null, // عمولة الكوتش من الباقة
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
      ptCommissionAmount: session.ptCommissionAmount || 0,
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

    // Optimistic Update
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
    setRenewalSession(session)
  }

  //  فتح مودال التيمبليتس للعميل المنتهي اشتراكه
  const openWhatsAppTemplate = (session: PTSession) => {
    setSelectedSessionForTemplate(session)
    setShowTemplateModal(true)
  }

  //  إرسال رسالة من القالب — يجرّب الـ WhatsApp API الأول، ولو مش متصل يفتح wa.me
  const sendPTWhatsAppTemplate = useCallback(async (template: MessageTemplate) => {
    if (!selectedSessionForTemplate) return
    const target = selectedSessionForTemplate
    const message = template.message
      .replace(/\{name\}/g, target.clientName || '')
      .replace(/\{salesName\}/g, user?.name || '')
      .replace(/\{phone\}/g, target.phone || '')
      .replace(/\{date\}/g, new Date().toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US'))
      .replace(/\{time\}/g, new Date().toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' }))

    try {
      const statusResponse = await fetch('/api/whatsapp/status')
      const status = statusResponse.ok ? await statusResponse.json() : null

      if (status?.isReady) {
        const sendResponse = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: target.phone, message })
        })
        const sendResult = await sendResponse.json()
        if (sendResult?.success) {
          toast.success(locale === 'ar' ? 'تم إرسال الرسالة بنجاح على الواتساب' : 'Message sent via WhatsApp')
          setShowTemplateModal(false)
          setSelectedSessionForTemplate(null)
        } else {
          //  Fallback لو الإرسال فشل: افتح wa.me
          const url = createWhatsAppUrl(target.phone, message)
          window.open(url, '_blank')
          toast.info(locale === 'ar' ? 'فتح واتساب بالرسالة جاهزة' : 'WhatsApp opened with message')
          setShowTemplateModal(false)
          setSelectedSessionForTemplate(null)
        }
      } else {
        // WhatsApp مش متصل → افتح wa.me link
        const url = createWhatsAppUrl(target.phone, message)
        window.open(url, '_blank')
        setShowTemplateModal(false)
        setSelectedSessionForTemplate(null)
      }
    } catch (error) {
      console.error('Error sending WhatsApp template:', error)
      // عند أي خطأ، fallback لـ wa.me
      const url = createWhatsAppUrl(target.phone, message)
      window.open(url, '_blank')
      setShowTemplateModal(false)
      setSelectedSessionForTemplate(null)
    }
  }, [selectedSessionForTemplate, user?.name, locale, toast])

  const handleRegisterSession = async (session: PTSession) => {
    // الكوتش يسجل بإمضاء
    if (isCoach) {
      setSignatureSession(session)
      setShowSignatureModal(true)
      return
    }

    // الموظف يسجل بتأكيد عادي
    const confirmed = await confirm({
      title: t('pt.registerAttendance.title'),
      message: t('pt.registerAttendance.message', { clientName: session.clientName, remaining: session.sessionsRemaining.toString(), total: session.sessionsPurchased.toString() }),
      confirmText: t('pt.registerAttendance.confirm'),
      cancelText: t('pt.registerAttendance.cancel'),
      type: 'info'
    })
    if (!confirmed) return

    try {
      const res = await fetch('/api/pt/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ptNumber: session.ptNumber,
          sessionDate: new Date().toISOString()
        })
      })
      const data = await res.json()
      if (res.ok) {
        queryClient.setQueryData<any[]>(['pt-sessions'], (old) =>
          old ? old.map(s =>
            s.ptNumber === session.ptNumber
              ? { ...s, sessionsRemaining: s.sessionsRemaining - 1 }
              : s
          ) : old
        )
        toast.success(t('pt.registerAttendance.success', { clientName: session.clientName }))
      } else {
        toast.error(data.error || t('pt.registerAttendance.failed'))
      }
    } catch {
      toast.error(t('pt.registerAttendance.connectionError'))
    }
  }

  const handleSignatureConfirm = useCallback(async (signatureDataUrl: string) => {
    if (!signatureSession) return
    try {
      const res = await fetch('/api/pt/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ptNumber: signatureSession.ptNumber,
          sessionDate: new Date().toISOString(),
          signature: signatureDataUrl
        })
      })
      const data = await res.json()
      if (res.ok) {
        queryClient.setQueryData<any[]>(['pt-sessions'], (old) =>
          old ? old.map(s =>
            s.ptNumber === signatureSession.ptNumber
              ? { ...s, sessionsRemaining: s.sessionsRemaining - 1 }
              : s
          ) : old
        )
        toast.success(t('pt.registerAttendance.success', { clientName: signatureSession.clientName }))
      } else {
        toast.error(data.error || t('pt.registerAttendance.failed'))
      }
    } catch {
      toast.error(t('pt.registerAttendance.connectionError'))
    } finally {
      setShowSignatureModal(false)
      setSignatureSession(null)
    }
  }, [signatureSession, queryClient, toast])

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

  // التحقق من الصلاحيات
  if (permissionsLoading) {
    return (
      <LoadingScreen fullScreen message={t('pt.loading')} />
    )
  }

  if (!hasPermission('canViewPT')) {
    return <PermissionDenied message={t('pt.noPermission')} />
  }

  // حالة التحميل مع Skeleton
  if (loading) {
    return (
      <div className="container mx-auto p-6" aria-busy="true" aria-live="polite">
        <div className="mb-6">
          <div className="h-8 w-48 skeleton-shimmer rounded mb-4"></div>
          <LoadingSkeleton type="stats" />
        </div>
        <LoadingSkeleton type="table" count={8} />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 sm:p-6" dir={direction}>
      <div className="mb-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex w-10 h-10 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
            <svg {...stroke} className="w-6 h-6" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M6.115 5.19l.319 1.913A6 6 0 008.11 10.36L9.75 12l-.387.775c-.217.435-.132.956.21 1.298l1.348 1.348c.21.21.329.497.329.795v1.089c0 .426.24.815.622 1.006l.153.076c.433.217.956.132 1.298-.21l.723-.723a8.7 8.7 0 002.288-4.042 1.087 1.087 0 00-.358-1.099l-1.33-1.108c-.251-.21-.582-.299-.905-.245l-1.17.195a1.125 1.125 0 01-.98-.314l-.295-.295a1.125 1.125 0 010-1.591l.13-.132a1.125 1.125 0 011.3-.21l.603.302a.809.809 0 001.086-1.086L14.25 7.5l1.256-.837a4.5 4.5 0 001.528-1.732l.146-.292M6.115 5.19A9 9 0 1017.18 4.64M6.115 5.19A8.965 8.965 0 0112 3c1.929 0 3.716.607 5.18 1.64"/></svg>
          </span>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{t('pt.title')}</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              {isCoach ? t('pt.viewSessions') : t('pt.manageSessions')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {/*  زرار حاسبة الـ commission — OWNER/ADMIN/MANAGER (الفتنس مانجر) أو COACH أو اللي عنده الصلاحية */}
          {(user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'MANAGER' || isCoach || hasPermission('canAccessPTCommission')) && (
            <button
              onClick={() => router.push('/pt/commission')}
              className="flex-1 min-w-[140px] sm:flex-none bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 inline-flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <svg {...stroke} className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4"/></svg>
              <span>{t('pt.commissionCalculator')}</span>
            </button>
          )}
          <button
            onClick={() => router.push('/pt/sessions/history')}
            className="flex-1 min-w-[140px] sm:flex-none bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2.5 rounded-lg transition-colors duration-200 inline-flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <svg {...stroke} className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>
            <span>{t('pt.attendanceLog')}</span>
          </button>
          {!isCoach && (
            <button
              onClick={() => router.push('/pt/followups')}
              className="flex-1 min-w-[140px] sm:flex-none bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-900/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 px-4 py-2.5 rounded-lg transition-colors duration-200 inline-flex items-center justify-center gap-2 text-sm sm:text-base font-bold"
            >
              <svg {...stroke} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4"/></svg>
              <span>{locale === 'ar' ? 'متابعات الحصص' : 'PT Followups'}</span>
            </button>
          )}
          {!isCoach && (
            <button
              onClick={() => {
                resetForm()
                setShowForm(!showForm)
              }}
              className="w-full sm:w-auto bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 inline-flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              {showForm ? (
                <span>{t('pt.hideForm')}</span>
              ) : (
                <>
                  <svg {...stroke} className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
                  <span>{t('pt.addNewSession')}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {!isCoach && showForm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in" role="dialog" aria-modal="true" aria-labelledby="pt-form-title" onClick={(e) => { if (e.target === e.currentTarget) { resetForm() } }}>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6 animate-modal-in" dir={direction}>
          <div className="flex items-center justify-between mb-4">
            <h2 id="pt-form-title" className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {editingSession ? t('pt.editSession') : t('pt.addSession')}
            </h2>
            {editingSession && isDayUse && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                <svg {...stroke} className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
                Day Use
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!isDayUse && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
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
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">اضغط Enter لتحميل بيانات العضو تلقائياً</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
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
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
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
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
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
                    <p className="text-xs text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                      <svg {...stroke} className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
                      {t('pt.noActiveCoaches')}
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
                <div className="bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-200 dark:ring-primary-700 rounded-lg p-3">
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
                    <span className="text-sm font-bold text-primary-800 dark:text-primary-200 inline-flex items-center gap-1">
                      <svg {...stroke} className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>
                      Day Use (استخدام يومي)
                    </span>
                    <p className="text-xs text-primary-700 dark:text-primary-300 mt-1">
                      تسجيل مبسط - اسم ورقم وسعر الجلسة فقط
                    </p>
                  </div>
                </label>
              </div>
              )}

              {/* اختيار باقة جاهزة */}
              {!isDayUse && !editingSession && packages.length > 0 && (
                <div className="col-span-full">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 inline-flex items-center gap-1">
                    <svg {...stroke} className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>
                    {t('packages.selectPackage')}
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {packages.map((pkg) => (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => applyPackage(pkg)}
                        className="bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/40 ring-1 ring-primary-200 dark:ring-primary-700 rounded-lg p-3 transition-colors duration-200"
                      >
                        <div className="text-center">
                          <div className="mb-1 flex justify-center text-primary-700 dark:text-primary-400">
                            <svg {...stroke} className="w-6 h-6" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M6.115 5.19l.319 1.913A6 6 0 008.11 10.36L9.75 12l-.387.775c-.217.435-.132.956.21 1.298l1.348 1.348c.21.21.329.497.329.795v1.089c0 .426.24.815.622 1.006l.153.076c.433.217.956.132 1.298-.21l.723-.723a8.7 8.7 0 002.288-4.042 1.087 1.087 0 00-.358-1.099l-1.33-1.108c-.251-.21-.582-.299-.905-.245l-1.17.195a1.125 1.125 0 01-.98-.314l-.295-.295a1.125 1.125 0 010-1.591l.13-.132a1.125 1.125 0 011.3-.21l.603.302a.809.809 0 001.086-1.086L14.25 7.5l1.256-.837a4.5 4.5 0 001.528-1.732l.146-.292"/></svg>
                          </div>
                          <div className="font-bold text-gray-900 dark:text-gray-100 text-sm">{pkg.name}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {pkg.sessions} {t('packages.sessions')}
                          </div>
                          {pkg.durationDays && (
                            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 inline-flex items-center gap-1">
                              <svg {...stroke} className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>
                              {pkg.durationDays} يوم
                            </div>
                          )}
                          <div className="text-lg font-bold text-primary-700 dark:text-primary-400 mt-1">
                            {pkg.price} {t('pt.egp')}
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
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
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
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    الجلسات المتبقية <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.sessionsRemaining}
                    onChange={(e) => setFormData({ ...formData, sessionsRemaining: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg bg-primary-50 dark:bg-primary-900/50 border-primary-300 dark:border-primary-600 dark:text-primary-contrast"
                    placeholder="عدد الجلسات المتبقية"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    يمكنك تعديل عدد الجلسات المتبقية للعميل
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {isDayUse ? 'سعر الجلسة' : t('pt.totalPrice')} <span className="text-red-600">*</span>
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
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
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
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
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
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
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
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('pt.quickAdd')}</p>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 6, 9, 12].map(months => (
                    <button
                      key={months}
                      type="button"
                      onClick={() => calculateExpiryFromMonths(months)}
                      className="px-3 py-2 bg-primary-100 hover:bg-primary-200 dark:bg-primary-900/30 dark:hover:bg-primary-900/50 text-primary-800 dark:text-primary-200 rounded-lg text-sm font-bold transition-colors duration-200"
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
              <div className="bg-green-50 ring-1 ring-green-200 rounded-lg p-4 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
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
                className="flex-1 bg-primary-600 text-primary-contrast py-2 rounded-lg hover:bg-primary-700 disabled:bg-gray-400"
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
        </div>
      )}

      {/* Search and filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6 mb-6" dir={direction}>
        <div className="mb-6 relative">
          <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-gray-400 dark:text-gray-500">
            <svg {...stroke} className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/></svg>
          </span>
          <input
            type="text"
            placeholder={t('pt.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full ps-10 pe-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
          />
        </div>

        {/* Quick filters */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 inline-flex items-center gap-2">
              <svg {...stroke} className="w-5 h-5 text-primary-700 dark:text-primary-400" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>
              <span>{t('pt.quickFilters')}</span>
            </h3>
            {(filterStatus !== 'all' || filterSessions !== 'all') && (
              <button
                onClick={() => {
                  setFilterStatus('all')
                  setFilterSessions('all')
                }}
                className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors duration-200 inline-flex items-center gap-1"
              >
                <svg {...stroke} className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                إعادة تعيين
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-3 rounded-xl font-bold transition-colors duration-200 ${
                filterStatus === 'all'
                  ? 'bg-primary-500 text-primary-contrast shadow-sm ring-1 ring-primary-400'
                  : 'bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40 shadow-sm'
              }`}
            >
              <div className="mb-1 flex justify-center">
                <svg {...stroke} className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>
              </div>
              <div className="text-xs">{t('pt.allStatus')}</div>
              <div className="text-lg font-bold">{sessions.length}</div>
            </button>

            <button
              onClick={() => setFilterStatus('active')}
              className={`px-4 py-3 rounded-xl font-bold transition-colors duration-200 ${
                filterStatus === 'active'
                  ? 'bg-green-600 text-white shadow-sm ring-1 ring-green-500'
                  : 'bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 text-gray-700 dark:text-gray-200 hover:bg-green-50 dark:hover:bg-green-900/30 shadow-sm'
              }`}
            >
              <div className="mb-1 flex justify-center">
                <svg {...stroke} className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
              <div className="text-xs">{t('pt.statusActive')}</div>
              <div className="text-lg font-bold">{sessions.filter(s => !isExpired(s) && !isExpiringSoon(s)).length}</div>
            </button>

            <button
              onClick={() => setFilterStatus('expiring')}
              className={`px-4 py-3 rounded-xl font-bold transition-colors duration-200 ${
                filterStatus === 'expiring'
                  ? 'bg-orange-500 text-white shadow-sm ring-1 ring-orange-400'
                  : 'bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 text-gray-700 dark:text-gray-200 hover:bg-orange-50 dark:hover:bg-orange-900/30 shadow-sm'
              }`}
            >
              <div className="mb-1 flex justify-center">
                <svg {...stroke} className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3h.007m-.391-15.36a1.125 1.125 0 011.768 0l8.04 11.7c.46.668-.018 1.555-.884 1.555H4.077c-.866 0-1.343-.887-.884-1.555l8.04-11.7z"/></svg>
              </div>
              <div className="text-xs">{t('pt.statusExpiring')}</div>
              <div className="text-lg font-bold">{sessions.filter(s => isExpiringSoon(s)).length}</div>
            </button>

            <button
              onClick={() => setFilterStatus('expired')}
              className={`px-4 py-3 rounded-xl font-bold transition-colors duration-200 ${
                filterStatus === 'expired'
                  ? 'bg-red-600 text-white shadow-sm ring-1 ring-red-500'
                  : 'bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-red-900/30 shadow-sm'
              }`}
            >
              <div className="mb-1 flex justify-center">
                <svg {...stroke} className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
              <div className="text-xs">{t('pt.statusExpired')}</div>
              <div className="text-lg font-bold">{sessions.filter(s => isExpired(s)).length}</div>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button
              onClick={() => setFilterSessions('all')}
              className={`px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 ${
                filterSessions === 'all'
                  ? 'bg-primary-500 text-primary-contrast shadow-sm ring-1 ring-primary-400'
                  : 'bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40 shadow-sm'
              }`}
            >
              <div className="text-sm">{t('pt.allSessions')}</div>
            </button>

            <button
              onClick={() => setFilterSessions('low')}
              className={`px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 ${
                filterSessions === 'low'
                  ? 'bg-amber-500 text-white shadow-sm ring-1 ring-amber-400'
                  : 'bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 text-gray-700 dark:text-gray-200 hover:bg-amber-50 dark:hover:bg-amber-900/30 shadow-sm'
              }`}
            >
              <div className="text-sm">{t('pt.sessionsLow')}</div>
              <div className="text-xs opacity-70">({filteredSessions.filter(s => s.sessionsRemaining > 0 && s.sessionsRemaining <= 3).length})</div>
            </button>

            <button
              onClick={() => setFilterSessions('zero')}
              className={`px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 ${
                filterSessions === 'zero'
                  ? 'bg-gray-700 text-white shadow-sm ring-1 ring-gray-600'
                  : 'bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40 shadow-sm'
              }`}
            >
              <div className="text-sm">{t('pt.sessionsZero')}</div>
              <div className="text-xs opacity-70">({filteredSessions.filter(s => s.sessionsRemaining === 0).length})</div>
            </button>
          </div>
        </div>

        {/* Coach and type filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 inline-flex items-center gap-1.5">
              <svg {...stroke} className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
              {t('pt.filterByCoach')}
            </label>
            <select
              value={filterCoach}
              onChange={(e) => setFilterCoach(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            >
              <option value="">{t('pt.allCoaches')}</option>
              {(Array.from(new Set(sessions.map(s => s.coachName).filter((name): name is string => !!name))) as string[]).sort().map(coach => (
                <option key={coach} value={coach}>{coach}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 inline-flex items-center gap-1.5">
              <svg {...stroke} className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/></svg>
              {t('pt.sessionType')}
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            >
              <option value="all">{t('pt.typeAll')}</option>
              <option value="regular">{t('pt.typeRegular')}</option>
              <option value="dayuse">{t('pt.typeDayUse')}</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingScreen message={t('pt.loading')} />
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
                  key={session.ptNumber}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden ring-1 hover:shadow-lg dark:hover:shadow-2xl transition ${
                    isExpired ? 'border-red-300 dark:border-red-700' : isExpiringSoon ? 'border-orange-300 dark:border-orange-700' : 'border-gray-200 dark:border-gray-600'
                  }`}
                >
                  {/* Header */}
                  <div className={`p-3 ${isExpired ? 'bg-red-600 dark:bg-red-700' : isExpiringSoon ? 'bg-orange-600 dark:bg-orange-700' : 'bg-gradient-to-r from-primary-600 to-primary-700 dark:from-primary-700 dark:to-primary-800'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Profile Image */}
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-white/20 flex items-center justify-center flex-shrink-0">
                          {session.profileImage ? (
                            <img src={session.profileImage} alt={session.clientName} className="w-full h-full object-cover" />
                          ) : (
                            <svg {...stroke} className="w-5 h-5 text-white/80" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-white text-base">{session.clientName}</div>
                          <div className="text-white/80 text-xs">
                            {session.ptNumber < 0 ? 'Day Use' : `#${session.ptNumber}`} • {session.phone}
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
                        <span>{t('pt.coach')}: {session.coachName}</span>
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
                        <div className="text-[10px] text-green-700 dark:text-green-300 font-semibold">{t('pt.total')}</div>
                        <div className="text-sm font-bold text-green-600 dark:text-green-400">
                          {(session.sessionsPurchased * session.pricePerSession).toFixed(0)} {t('pt.egp')}
                        </div>
                      </div>
                      <div className={`border rounded-lg p-2 text-center ${
                        (session.remainingAmount || 0) > 0
                          ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700'
                          : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                      }`}>
                        <div className={`text-[10px] font-semibold ${(session.remainingAmount || 0) > 0 ? 'text-orange-700 dark:text-orange-300' : 'text-gray-500 dark:text-gray-400'}`}>{t('pt.remaining')}</div>
                        <div className={`text-sm font-bold ${(session.remainingAmount || 0) > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                          {(session.remainingAmount || 0).toFixed(0)} {t('pt.egp')}
                        </div>
                      </div>
                    </div>

                    {/* Dates */}
                    {(session.startDate || session.expiryDate) && (
                      <div className={`border rounded-lg p-2 text-xs font-mono ${
                        isExpired ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700' : isExpiringSoon ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700' : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                      }`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <svg {...stroke} className="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>
                          {session.startDate && <span>{formatDateYMD(session.startDate)}</span>}
                          {session.startDate && session.expiryDate && <span>→</span>}
                          {session.expiryDate && (
                            <span className={isExpired ? 'text-red-600 dark:text-red-400 font-bold' : ''}>
                              {formatDateYMD(session.expiryDate)}
                            </span>
                          )}
                          {isExpired && <span className="text-red-600 dark:text-red-400 font-bold">({t('pt.expired')})</span>}
                          {!isExpired && isExpiringSoon && <span className="text-orange-600 dark:text-orange-400 font-bold">({t('pt.expiringSoon')})</span>}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {session.ptNumber >= 0 && !isExpired && (
                        <button
                          onClick={() => handleRegisterSession(session)}
                          disabled={session.sessionsRemaining === 0}
                          className={`${isCoach ? 'col-span-2' : ''} bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed font-bold flex items-center justify-center gap-1.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900`}
                        >
                          <svg {...stroke} className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                          <span>{t('pt.attendance')}</span>
                        </button>
                      )}
                      {/*  زرار متابعة الواتساب للاشتراكات المنتهية — يحل محل زرار الحضور */}
                      {session.ptNumber >= 0 && isExpired && (
                        <button
                          onClick={() => openWhatsAppTemplate(session)}
                          className={`${isCoach ? 'col-span-2' : ''} bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900`}
                          title={locale === 'ar' ? 'إرسال رسالة متابعة عبر واتساب' : 'Send WhatsApp follow-up'}
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 21.785h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.999-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.886 9.884zm8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.555 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          <span>{locale === 'ar' ? 'متابعة واتساب' : 'WhatsApp'}</span>
                        </button>
                      )}
                      {!isCoach && (
                        <>
                          {session.ptNumber >= 0 && (
                            <button
                              onClick={() => handleRenew(session)}
                              className="bg-primary-500 hover:bg-primary-600 text-primary-contrast py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                            >
                              <svg {...stroke} className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-4.992 4.992l3.181-3.183a8.25 8.25 0 00-13.803 3.7M4.031 9.865v-4.992m0 0H8.99M3 12a9 9 0 0015.357 6.364l-1.06-1.06"/></svg>
                              <span>{t('pt.renew')}</span>
                            </button>
                          )}
                          {/* Freeze - gated by ptFreezeEnabled */}
                          {settings.ptFreezeEnabled && session.ptNumber >= 0 && (
                            <button
                              onClick={() => setFreezeSession(session)}
                              className={`py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1 transition-colors duration-200 ${
                                session.isFrozen
                                  ? 'bg-cyan-600 text-white hover:bg-cyan-700'
                                  : 'bg-blue-600 text-white hover:bg-blue-700'
                              }`}
                            >
                              <svg {...stroke} className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18M5.636 5.636l12.728 12.728M18.364 5.636L5.636 18.364"/></svg>
                              <span>{session.isFrozen ? (locale === 'ar' ? 'مجمّد' : 'Frozen') : (locale === 'ar' ? 'فريز' : 'Freeze')}</span>
                            </button>
                          )}
                          {/* Upgrade - gated by ptUpgradeEnabled */}
                          {settings.ptUpgradeEnabled && session.ptNumber >= 0 && (
                            <button
                              onClick={() => setUpgradeSession(session)}
                              className="bg-orange-600 text-white py-2 rounded-lg text-sm hover:bg-orange-700 dark:hover:bg-orange-800 font-bold flex items-center justify-center gap-1 transition-colors duration-200"
                            >
                              <svg {...stroke} className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18"/></svg>
                              <span>{locale === 'ar' ? 'ترقية' : 'Upgrade'}</span>
                            </button>
                          )}
                          {(session.remainingAmount || 0) > 0 && (
                            <button
                              onClick={() => handleOpenPaymentModal(session)}
                              className="col-span-2 bg-orange-600 text-white py-2 rounded-lg text-sm hover:bg-orange-700 dark:hover:bg-orange-800 font-bold flex items-center justify-center gap-1 transition-colors duration-200"
                            >
                              <svg {...stroke} className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4"/></svg>
                              <span>{t('pt.payRemaining')} ({(session.remainingAmount || 0).toFixed(0)} {t('pt.egp')})</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(session)}
                            className="bg-primary-500 hover:bg-primary-600 text-primary-contrast py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1 transition-colors duration-200"
                          >
                            <svg {...stroke} className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"/></svg>
                            <span>{t('pt.edit')}</span>
                          </button>
                          <button
                            onClick={() => handleDelete(session.ptNumber)}
                            aria-label={t('pt.deleteSubscription')}
                            className="bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                          >
                            <svg {...stroke} className="w-4 h-4" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
                            <span>{t('pt.deleteSubscription')}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {filteredSessions.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-12 flex flex-col items-center justify-center text-center">
              <svg {...stroke} className="w-12 h-12 text-gray-400" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <h3 className="mt-3 text-gray-700 dark:text-gray-300 font-bold">{searchTerm ? t('pt.noSearchResults') : t('pt.noSessions')}</h3>
            </div>
          )}
        </>
      )}

      {/* Payment Modal */}
      {showPaymentModal && paymentSession && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in" role="dialog" aria-modal="true" aria-labelledby="pt-payment-title" onClick={(e) => { if (e.target === e.currentTarget) { setShowPaymentModal(false); setPaymentSession(null) } }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-3xl w-full p-6 animate-modal-in" dir={direction}>
            <div className="flex items-center justify-between mb-4">
              <h2 id="pt-payment-title" className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('pt.paymentModal.title')}</h2>
              <button
                onClick={() => {
                  setShowPaymentModal(false)
                  setPaymentSession(null)
                }}
                aria-label="Close"
                className="p-1 rounded text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-200"
              >
                <svg {...stroke} className="w-6 h-6" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* العمود الأيسر - معلومات الاشتراك */}
              <div className="space-y-3">
                {/* معلومات الاشتراك */}
                <div className="bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-200 dark:ring-orange-800/60 rounded-lg p-3">
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{t('pt.ptNumber')}:</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">#{paymentSession.ptNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{t('pt.client')}:</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{paymentSession.clientName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">{t('pt.coach')}:</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{paymentSession.coachName}</span>
                    </div>
                    <div className="flex justify-between border-t border-orange-200 dark:border-orange-800/60 pt-1.5">
                      <span className="text-orange-700 dark:text-orange-300 font-semibold">{t('pt.paymentModal.remainingAmount')}</span>
                      <span className="font-bold text-orange-700 dark:text-orange-300 text-lg">
                        {(paymentSession.remainingAmount || 0).toFixed(0)} {t('pt.egp')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* المبلغ المتبقي بعد الدفع */}
                {paymentFormData.paymentAmount > 0 && (
                  <div className="bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-800/60 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-primary-800 dark:text-primary-300 font-semibold">
                        {t('pt.paymentModal.remainingAfterPayment')}
                      </span>
                      <span className="text-lg font-bold text-primary-800 dark:text-primary-300">
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
                  <label className="block text-sm font-bold mb-1.5 text-gray-700 dark:text-gray-300">
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
                    className="w-full px-4 py-2.5 rounded-lg ring-1 ring-gray-300 dark:ring-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
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
                      className="flex-1 px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-900/50 text-orange-800 dark:text-orange-200 rounded text-sm font-medium transition-colors duration-200"
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
                      className="flex-1 px-3 py-1.5 bg-primary-100 dark:bg-primary-900/30 hover:bg-primary-200 dark:hover:bg-primary-900/50 text-primary-800 dark:text-primary-200 rounded text-sm font-medium transition-colors duration-200"
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
                className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
              >
                {t('pt.deleteConfirm.cancel')}
              </button>
              <button
                onClick={handlePayRemaining}
                disabled={loading || paymentFormData.paymentAmount <= 0 || paymentFormData.paymentAmount > (paymentSession.remainingAmount || 0)}
                className="bg-orange-600 hover:bg-orange-700 text-white py-2.5 rounded-lg font-bold disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
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

      {/* SignaturePad Modal - للكوتش فقط */}
      {showSignatureModal && signatureSession && (
        <SignaturePad
          title={`تسجيل حصة - ${signatureSession.clientName}`}
          subtitle={`الحصص المتبقية: ${signatureSession.sessionsRemaining} من ${signatureSession.sessionsPurchased}`}
          onConfirm={handleSignatureConfirm}
          onCancel={() => {
            setShowSignatureModal(false)
            setSignatureSession(null)
          }}
        />
      )}

      {/* Renewal Modal */}
      {renewalSession && (
        <PTRenewalForm
          session={renewalSession}
          onSuccess={() => {
            refetchSessions()
            setRenewalSession(null)
          }}
          onClose={() => setRenewalSession(null)}
        />
      )}

      {/* Freeze Modal */}
      {freezeSession && (
        <PTFreezeForm
          session={freezeSession as any}
          onClose={() => setFreezeSession(null)}
          onSuccess={() => {
            refetchSessions()
            setFreezeSession(null)
            toast.success(locale === 'ar' ? 'تم تحديث حالة التجميد' : 'Freeze status updated')
          }}
        />
      )}

      {/* Upgrade Modal */}
      {upgradeSession && (
        <PTUpgradeForm
          session={upgradeSession as any}
          onClose={() => setUpgradeSession(null)}
          onSuccess={(res) => {
            refetchSessions()
            setUpgradeSession(null)
            toast.success(
              locale === 'ar'
                ? `تم الترقية — فرق السعر: ${res.upgradeFee} ج`
                : `Upgraded — fee: ${res.upgradeFee} EGP`
            )
            queryClient.invalidateQueries({ queryKey: ['receipts'] })
          }}
        />
      )}

      {/*  مودال اختيار قالب الواتساب للاشتراكات المنتهية */}
      {showTemplateModal && selectedSessionForTemplate && (
        <MessageTemplateManager
          onClose={() => { setShowTemplateModal(false); setSelectedSessionForTemplate(null) }}
          onSelect={sendPTWhatsAppTemplate}
          visitorName={selectedSessionForTemplate.clientName}
          visitorPhone={selectedSessionForTemplate.phone}
          salesName={user?.name}
        />
      )}

    </div>
  )
}
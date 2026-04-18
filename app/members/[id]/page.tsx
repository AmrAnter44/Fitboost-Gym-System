// app/members/[id]/page.tsx - إصلاح الأرقام العشرية
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { ReceiptToPrint } from '../../../components/ReceiptToPrint'
import PaymentMethodSelector from '../../../components/Paymentmethodselector'
import RenewalForm from '../../../components/RenewalForm'
import UpgradeForm from '../../../components/UpgradeForm'
import ImageUpload from '../../../components/ImageUpload'
import { formatDateYMD, calculateRemainingDays } from '../../../lib/dateFormatter'
import { usePermissions } from '../../../hooks/usePermissions'
import PermissionDenied from '../../../components/PermissionDenied'
import type { PaymentMethod } from '../../../lib/paymentHelpers'
import { useLanguage } from '../../../contexts/LanguageContext'
import { useToast } from '../../../contexts/ToastContext'
import { useServiceSettings } from '../../../contexts/ServiceSettingsContext'
import FreeSessionModal from '../../../components/FreeSessionModal'
import CoachSelector from '../../../components/CoachSelector'
import SalesStaffSelector from '../../../components/SalesStaffSelector'

interface Member {
  id: string
  memberNumber: number | null
  name: string
  phone: string
  backupPhone?: string
  email?: string
  nationalId?: string
  birthDate?: string
  source?: string
  inBodyScans: number
  invitations: number
  freePTSessions: number
  freeNutritionSessions: number
  freePhysioSessions: number
  freeGroupClassSessions: number
  freePoolSessions: number
  freePadelSessions: number
  freeAssessmentSessions: number
  freeMoreSessions: number
  remainingFreezeDays: number
  subscriptionPrice: number
  remainingAmount: number
  points?: number
  notes?: string
  isActive: boolean
  isFrozen: boolean
  isBanned: boolean
  freezeRequests?: { endDate: string }[]
  profileImage?: string
  idCardFront?: string
  idCardBack?: string
  startDate?: string
  expiryDate?: string
  createdAt: string
  coachId?: string
  coach?: {
    id: string
    name: string
    staffCode: string
  }
  salesStaffId?: string
  salesStaff?: {
    id: string
    name: string
    staffCode: string
  }
}

interface Receipt {
  receiptNumber: number
  amount: number
  paymentMethod: string
  createdAt: string
  itemDetails: {
    memberNumber?: number
    memberName?: string
    subscriptionPrice?: number
    paidAmount?: number
    remainingAmount?: number
    freePTSessions?: number
    inBodyScans?: number
    invitations?: number
    startDate?: string
    expiryDate?: string
    subscriptionDays?: number
    [key: string]: any
  }
}

// دالة حساب اسم الباقة بناءً على عدد أيام الاشتراك
const getPackageName = (startDate: string | undefined, expiryDate: string | undefined, locale: string = 'ar'): string => {
  if (!startDate || !expiryDate) return '-'

  const start = new Date(startDate)
  const expiry = new Date(expiryDate)
  const diffTime = expiry.getTime() - start.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return '-'

  // حساب عدد الشهور
  const months = Math.round(diffDays / 30)

  if (locale === 'ar') {
    if (diffDays >= 330 && diffDays <= 395) {
      return 'سنة'
    } else if (diffDays >= 165 && diffDays <= 195) {
      return '6 شهور'
    } else if (diffDays >= 85 && diffDays <= 95) {
      return '3 شهور'
    } else if (diffDays >= 55 && diffDays <= 65) {
      return 'شهرين'
    } else if (diffDays >= 25 && diffDays <= 35) {
      return 'شهر'
    } else if (diffDays >= 10 && diffDays <= 17) {
      return 'أسبوعين'
    } else if (diffDays >= 5 && diffDays <= 9) {
      return 'أسبوع'
    } else if (diffDays === 1) {
      return 'يوم'
    } else if (months > 0) {
      return `${months} ${months === 1 ? 'شهر' : months === 2 ? 'شهرين' : 'شهور'}`
    } else {
      return `${diffDays} ${diffDays === 1 ? 'يوم' : diffDays === 2 ? 'يومين' : 'أيام'}`
    }
  } else {
    // English
    if (diffDays >= 330 && diffDays <= 395) {
      return 'Year'
    } else if (diffDays >= 165 && diffDays <= 195) {
      return '6 Months'
    } else if (diffDays >= 85 && diffDays <= 95) {
      return '3 Months'
    } else if (diffDays >= 55 && diffDays <= 65) {
      return '2 Months'
    } else if (diffDays >= 25 && diffDays <= 35) {
      return 'Month'
    } else if (diffDays >= 10 && diffDays <= 17) {
      return '2 Weeks'
    } else if (diffDays >= 5 && diffDays <= 9) {
      return 'Week'
    } else if (diffDays === 1) {
      return 'Day'
    } else if (months > 0) {
      return `${months} ${months === 1 ? 'Month' : 'Months'}`
    } else {
      return `${diffDays} ${diffDays === 1 ? 'Day' : 'Days'}`
    }
  }
}

export default function MemberDetailPage() {
  const params = useParams()
  const router = useRouter()
  const memberId = params.id as string
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const { t, direction, locale } = useLanguage()
  const toast = useToast()
  const { settings } = useServiceSettings()
  const queryClient = useQueryClient()

  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState<any>(null)
  const [showRenewalForm, setShowRenewalForm] = useState(false)
  const [followUpHistory, setFollowUpHistory] = useState<any[]>([])
  const [followUpHistoryLoading, setFollowUpHistoryLoading] = useState(false)
  const [showFollowUpHistory, setShowFollowUpHistory] = useState(false)
  const [showUpgradeForm, setShowUpgradeForm] = useState(false)
  const [lastReceiptNumber, setLastReceiptNumber] = useState<number | null>(null)
  const [ptSubscription, setPtSubscription] = useState<any>(null)
  const [showIdCardModal, setShowIdCardModal] = useState(false)
  const [nutritionSubscriptions, setNutritionSubscriptions] = useState<any[]>([])
  const [physioSubscriptions, setPhysioSubscriptions] = useState<any[]>([])
  const [groupClassSubscriptions, setGroupClassSubscriptions] = useState<any[]>([])

  // إجمالي الجلسات المدفوعة
  const [paidSessionCounts, setPaidSessionCounts] = useState({
    pt: 0,
    nutrition: 0,
    physio: 0,
    groupClass: 0
  })

  // سجل الإيصالات
  const [showReceiptsModal, setShowReceiptsModal] = useState(false)
  const [memberReceipts, setMemberReceipts] = useState<any[]>([])
  const [receiptsLoading, setReceiptsLoading] = useState(false)
  const [lastReceipt, setLastReceipt] = useState<any>(null)

  // النقاط
  const [showPointsHistory, setShowPointsHistory] = useState(false)
  const [pointsHistory, setPointsHistory] = useState<any[]>([])
  const [pointsLoading, setPointsLoading] = useState(false)
  const [showAddPointsModal, setShowAddPointsModal] = useState(false)
  const [addPointsData, setAddPointsData] = useState({
    points: '',
    reason: ''
  })

  // التقييمات

  const [confirmModal, setConfirmModal] = useState<{
    show: boolean
    title: string
    message: string
    onConfirm: () => void
  } | null>(null)

  const [paymentData, setPaymentData] = useState<{
    amount: number
    paymentMethod: string | PaymentMethod[]
    notes: string
  }>({
    amount: 0,
    paymentMethod: 'cash',
    notes: ''
  })

  const [freezeData, setFreezeData] = useState({
    days: 0,
    reason: ''
  })

  const [invitationData, setInvitationData] = useState({
    guestName: '',
    guestPhone: '',
    notes: '',
    salesStaffId: ''
  })
  const [invitationSalesStaff, setInvitationSalesStaff] = useState<{ id: string; name: string; leadsCount: number }[]>([])

  const [editBasicInfoData, setEditBasicInfoData] = useState({
    name: '',
    phone: '',
    profileImage: null as string | null,
    idCardFront: null as string | null,
    idCardBack: null as string | null,
    subscriptionPrice: 0,
    inBodyScans: 0,
    invitations: 0,
    freePTSessions: 0,
    freeNutritionSessions: 0,
    freePhysioSessions: 0,
    freeGroupClassSessions: 0,
    freePoolSessions: 0,
    freePadelSessions: 0,
    freeAssessmentSessions: 0,
    freeMoreSessions: 0,
    remainingFreezeDays: 0,
    remainingAmount: 0,
    remainingDueDate: '',
    coachId: null as string | null,
    salesStaffId: null as string | null,
    notes: '',
    startDate: '',
    expiryDate: ''
  })

  const [addRemainingAmountData, setAddRemainingAmountData] = useState({
    amount: 0,
    notes: ''
  })

  const [activeModal, setActiveModal] = useState<string | null>(null)

  // Free Session Modals
  const [freeSessionModal, setFreeSessionModal] = useState<{
    isOpen: boolean
    serviceType: 'PT' | 'Nutrition' | 'Physiotherapy' | 'GroupClass' | null
  }>({
    isOpen: false,
    serviceType: null
  })

  // Barcode WhatsApp Popup
  const [barcodePopup, setBarcodePopup] = useState<{
    show: boolean
    step: 'generating' | 'ready' | 'sending' | 'success' | 'error'
    image: string
    error: string
  }>({ show: false, step: 'generating', image: '', error: '' })

  // Fitness Test
  const [fitnessTestExists, setFitnessTestExists] = useState(false)
  const [fitnessTestData, setFitnessTestData] = useState<any>(null)
  const [coaches, setCoaches] = useState<any[]>([])
  const [selectedCoachId, setSelectedCoachId] = useState<string>('')

  const [fitnessTestForm, setFitnessTestForm] = useState({
    testDate: formatDateYMD(new Date()),
    medicalQuestions: {
      firstTimeGym: false,
      inDietPlan: false,
      hernia: false,
      familyHeartHistory: false,
      heartProblem: false,
      backPain: false,
      surgery: false,
      breathingProblems: false,
      bloodPressure: false,
      kneeProblem: false,
      diabetes: false,
      smoker: false,
      highCholesterol: false,
    } as any,
    flexibility: {
      shoulder: 'FAIR',
      hip: 'FAIR',
      elbow: 'FAIR',
      wrist: 'FAIR',
      spine: 'FAIR',
      scapula: 'FAIR',
      knee: 'FAIR',
      ankle: 'FAIR',
    } as any,
    exercises: {
      pushup: { sets: 0, reps: 0 },
      situp: { sets: 0, reps: 0 },
      pullup: { sets: 0, reps: 0 },
      squat: { sets: 0, reps: 0 },
      plank: { sets: 0, reps: 0 },
      legpress: { sets: 0, reps: 0 },
      chestpress: { sets: 0, reps: 0 },
    } as any,
  })

  // سجل الحضور
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([])
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [attendanceStartDate, setAttendanceStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30) // آخر 30 يوم
    return date.toISOString().split('T')[0]
  })
  const [attendanceEndDate, setAttendanceEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  const fetchMember = async () => {
    try {
      const response = await fetch(`/api/members/${memberId}`)

      if (!response.ok) {
        toast.error(t('memberDetails.memberNotFound'))
        return
      }

      const foundMember = await response.json()

      if (foundMember) {
        // ✅ تحويل كل الأرقام لـ integers
        const memberWithDefaults = {
          ...foundMember,
          memberNumber: foundMember.memberNumber !== null && foundMember.memberNumber !== undefined ? parseInt(foundMember.memberNumber.toString()) : null,
          freePTSessions: parseInt(foundMember.freePTSessions?.toString() || '0'),
          inBodyScans: parseInt(foundMember.inBodyScans?.toString() || '0'),
          invitations: parseInt(foundMember.invitations?.toString() || '0'),
          subscriptionPrice: parseInt(foundMember.subscriptionPrice?.toString() || '0'),
          remainingAmount: parseInt(foundMember.remainingAmount?.toString() || '0'),
          freePoolSessions: parseInt(foundMember.freePoolSessions?.toString() || '0'),
          freePadelSessions: parseInt(foundMember.freePadelSessions?.toString() || '0'),
          freeAssessmentSessions: parseInt(foundMember.freeAssessmentSessions?.toString() || '0')
        }

        setMember(memberWithDefaults)

        // جلب آخر إيصال للعضو
        fetchLastReceipt(memberId)
      } else {
        toast.error(t('memberDetails.memberNotFound'))
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error(t('memberDetails.errorLoadingData'))
    } finally {
      setLoading(false)
    }
  }

  const fetchAttendanceHistory = async () => {
    setAttendanceLoading(true)
    try {
      const response = await fetch(
        `/api/member-checkin/history?memberId=${memberId}&startDate=${attendanceStartDate}&endDate=${attendanceEndDate}`
      )
      const data = await response.json()

      if (data.success) {
        setAttendanceHistory(data.checkIns || [])
      } else {
        console.error('Error fetching attendance history')
        setAttendanceHistory([])
      }
    } catch (error) {
      console.error('Error fetching attendance history:', error)
      setAttendanceHistory([])
    } finally {
      setAttendanceLoading(false)
    }
  }

  const fetchLastReceipt = async (memberId: string) => {
    try {
      const response = await fetch(`/api/receipts?memberId=${memberId}`)
      if (response.ok) {
        const receipts = await response.json()
        if (receipts && receipts.length > 0) {
          // أول إيصال في القائمة هو الأحدث (orderBy createdAt desc)
          setLastReceiptNumber(receipts[0].receiptNumber)
          setLastReceipt(receipts[0])
        }
      }
    } catch (error) {
      console.error('Error fetching last receipt:', error)
    }
  }

  const fetchMemberReceipts = async () => {
    setReceiptsLoading(true)
    try {
      const response = await fetch('/api/receipts')
      const allReceipts = await response.json()

      if (!member) {
        setMemberReceipts([])
        setReceiptsLoading(false)
        return
      }

      const filtered = allReceipts.filter((receipt: any) => {
        if (receipt.type === 'Member' || receipt.type === 'تجديد عضويه') {
          try {
            const itemDetails = JSON.parse(receipt.itemDetails)
            // البحث برقم العضوية (memberNumber) بدلاً من memberId
            return itemDetails.memberNumber === member.memberNumber
          } catch (error) {
            return false
          }
        }
        return false
      })

      setMemberReceipts(filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    } catch (error) {
      console.error('Error fetching member receipts:', error)
      setMemberReceipts([])
    } finally {
      setReceiptsLoading(false)
    }
  }

  const handleShowReceipts = () => {
    fetchMemberReceipts()
    setShowReceiptsModal(true)
  }

  const fetchFollowUpHistory = async () => {
    setFollowUpHistoryLoading(true)
    try {
      const response = await fetch(`/api/members/${memberId}/followup-history`)
      if (response.ok) {
        const data = await response.json()
        setFollowUpHistory(data)
      }
    } catch (error) {
      console.error('Error fetching follow-up history:', error)
      setFollowUpHistory([])
    } finally {
      setFollowUpHistoryLoading(false)
    }
  }

  const fetchPointsHistory = async () => {
    setPointsLoading(true)
    try {
      const response = await fetch(`/api/members/${memberId}/points-history`)
      if (response.ok) {
        const data = await response.json()
        setPointsHistory(data)
      }
    } catch (error) {
      console.error('Error fetching points history:', error)
      setPointsHistory([])
    } finally {
      setPointsLoading(false)
    }
  }

  const handleShowPointsHistory = () => {
    fetchPointsHistory()
    setShowPointsHistory(true)
  }

  const handleAddPoints = async () => {
    if (!member || !addPointsData.points || !addPointsData.reason.trim()) {
      toast.warning(t('memberDetails.enterPointsAndReason'))
      return
    }

    const pointsValue = parseInt(addPointsData.points)
    if (isNaN(pointsValue) || pointsValue === 0) {
      toast.warning(t('memberDetails.enterValidPointsNumber'))
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/members/${member.id}/add-points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: pointsValue,
          reason: addPointsData.reason.trim()
        })
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(t('memberDetails.pointsUpdatedSuccessfully', {
          action: pointsValue > 0 ? t('memberDetails.added') : t('memberDetails.deducted'),
          count: Math.abs(pointsValue).toString()
        }))
        setAddPointsData({ points: '', reason: '' })
        setShowAddPointsModal(false)
        fetchMember()
        if (showPointsHistory) {
          fetchPointsHistory()
        }
      } else {
        toast.error(result.error || t('memberDetails.pointsUpdateFailed'))
      }
    } catch (error) {
      console.error('Error adding points:', error)
      toast.error(t('memberDetails.pointsUpdateError'))
    } finally {
      setLoading(false)
    }
  }


  const fetchFitnessTest = async () => {
    try {
      const response = await fetch(`/api/members/${memberId}/fitness-test`)
      if (response.ok) {
        const data = await response.json()
        setFitnessTestExists(true)
        setFitnessTestData(data)
      } else {
        setFitnessTestExists(false)
        setFitnessTestData(null)
      }
    } catch (error) {
      console.error('Error fetching fitness test:', error)
      setFitnessTestExists(false)
      setFitnessTestData(null)
    }
  }

  const fetchCoaches = async () => {
    try {
      const response = await fetch('/api/coaches')
      if (response.ok) {
        const coaches = await response.json()
        setCoaches(coaches)
      } else {
        console.error('Failed to fetch coaches:', response.status)
        setCoaches([])
      }
    } catch (error) {
      console.error('Error fetching coaches:', error)
      setCoaches([])
    }
  }

  const fetchPTSubscription = async () => {
    if (!member) return

    try {
      const response = await fetch('/api/pt')
      if (response.ok) {
        const allPTs = await response.json()
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // البحث عن PT نشط للعضو (بدأ ولم ينتهي)
        const activePT = allPTs.find((pt: any) => {
          const hasStarted = !pt.startDate || new Date(pt.startDate) <= today
          const notExpired = !pt.expiryDate || new Date(pt.expiryDate) >= today
          return pt.phone === member.phone &&
            pt.sessionsRemaining > 0 &&
            hasStarted &&
            notExpired
        })
        setPtSubscription(activePT || null)
      }
    } catch (error) {
      console.error('Error fetching PT subscription:', error)
      setPtSubscription(null)
    }
  }

  const fetchServiceSubscriptions = async () => {
    if (!member) return

    try {
      // ✅ جلب عدد الجلسات المدفوعة مباشرة من الـ API الجديد (server-side filtering)
      const res = await fetch(`/api/members/paid-sessions?memberId=${member.id}`)
      if (res.ok) {
        const counts = await res.json()
        setPaidSessionCounts({
          pt: counts.pt || 0,
          nutrition: counts.nutrition || 0,
          physio: counts.physio || 0,
          groupClass: counts.groupClass || 0
        })
      }
    } catch (error) {
      console.error('Error fetching paid session counts:', error)
    }
  }

  useEffect(() => {
    fetchMember()
    fetchAttendanceHistory()
    // fetchFitnessTest() // Disabled - fitness test feature removed
  }, [memberId])

  useEffect(() => {
    if (member) {
      fetchPTSubscription()
      fetchServiceSubscriptions()
    }
  }, [member])

  useEffect(() => {
    if (activeModal !== 'invitation') return
    fetch('/api/followups/sales')
      .then(r => r.ok ? r.json() : null)
      .then((data: any) => {
        if (!data?.staff) return
        const list = data.staff
          .filter((s: any) => s.position?.split(',').map((p: string) => p.trim()).includes('sales'))
          .map((s: any) => ({ id: s.staffId, name: s.name, leadsCount: s.leadsCount ?? 0 }))
        setInvitationSalesStaff(list)
        if (list.length > 0) {
          const least = [...list].sort((a: any, b: any) => a.leadsCount - b.leadsCount)[0]
          setInvitationData(prev => ({ ...prev, salesStaffId: least.id }))
        }
      })
      .catch(() => {})
  }, [activeModal])

  const handlePayment = async () => {
    if (!member || paymentData.amount <= 0) {
      toast.warning(t('memberDetails.paymentModal.enterValidAmount'))
      return
    }

    if (paymentData.amount > member.remainingAmount) {
      toast.warning(t('memberDetails.paymentModal.amountExceedsRemaining'))
      return
    }

    setLoading(true)

    try {
      // ✅ تحويل لـ integer
      const cleanAmount = parseInt(paymentData.amount.toString())
      const newRemaining = member.remainingAmount - cleanAmount

      const response = await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: member.id,
          remainingAmount: newRemaining
        })
      })

      if (response.ok) {
        const receiptResponse = await fetch('/api/receipts/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: member.id,
            amount: cleanAmount,
            paymentMethod: paymentData.paymentMethod,
            notes: paymentData.notes
          })
        })

        if (receiptResponse.ok) {
          const receipt = await receiptResponse.json()
          setReceiptData({
            receiptNumber: receipt.receiptNumber,
            type: 'Payment',
            amount: receipt.amount,
            details: JSON.parse(receipt.itemDetails),
            date: new Date(receipt.createdAt),
            paymentMethod: paymentData.paymentMethod
          })
          setShowReceipt(true)
          setLastReceiptNumber(receipt.receiptNumber)
          queryClient.invalidateQueries({ queryKey: ['receipts'] })
        }

        toast.success(t('memberDetails.paymentModal.paymentSuccess'))

        setPaymentData({ amount: 0, paymentMethod: 'cash', notes: '' })
        setActiveModal(null)
        fetchMember()
      } else {
        toast.error(t('memberDetails.paymentModal.paymentFailed'))
      }
    } catch (error) {
      console.error(error)
      toast.error(t('memberDetails.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleUseInBody = async () => {
    if (!member || (member.inBodyScans ?? 0) <= 0) {
      toast.warning(t('memberDetails.noInBodyRemaining'))
      return
    }

    setConfirmModal({
      show: true,
      title: `⚖️ ${t('memberDetails.useInBody')}`,
      message: t('memberDetails.confirmUseInBody'),
      onConfirm: async () => {
        setConfirmModal(null)
        setLoading(true)
        try {
          const response = await fetch('/api/members', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: member.id,
              inBodyScans: (member.inBodyScans ?? 0) - 1
            })
          })

          if (response.ok) {
            toast.success(t('memberDetails.inBodyUsed'))
            fetchMember()
          }
        } catch (error) {
          toast.error(t('memberDetails.error'))
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const handleUsePool = async () => {
    if (!member || (member.freePoolSessions ?? 0) <= 0) {
      toast.warning(t('memberDetails.noPoolSessionsRemaining'))
      return
    }

    setConfirmModal({
      show: true,
      title: `🏊 ${t('memberDetails.usePoolSession')}`,
      message: t('memberDetails.confirmUsePoolSession'),
      onConfirm: async () => {
        setConfirmModal(null)
        setLoading(true)
        try {
          const response = await fetch('/api/members', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: member.id,
              freePoolSessions: (member.freePoolSessions ?? 0) - 1
            })
          })

          if (response.ok) {
            toast.success(t('memberDetails.poolSessionUsed'))
            fetchMember()
          }
        } catch (error) {
          toast.error(t('memberDetails.error'))
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const handleUsePadel = async () => {
    if (!member || (member.freePadelSessions ?? 0) <= 0) {
      toast.warning(t('memberDetails.noPadelSessionsRemaining'))
      return
    }

    setConfirmModal({
      show: true,
      title: `🎾 ${t('memberDetails.usePadelSession')}`,
      message: t('memberDetails.confirmUsePadelSession'),
      onConfirm: async () => {
        setConfirmModal(null)
        setLoading(true)
        try {
          const response = await fetch('/api/members', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: member.id,
              freePadelSessions: (member.freePadelSessions ?? 0) - 1
            })
          })

          if (response.ok) {
            toast.success(t('memberDetails.padelSessionUsed'))
            fetchMember()
          }
        } catch (error) {
          toast.error(t('memberDetails.error'))
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const handleUseAssessment = async () => {
    if (!member || (member.freeAssessmentSessions ?? 0) <= 0) {
      toast.warning(t('memberDetails.noAssessmentSessionsRemaining'))
      return
    }

    setConfirmModal({
      show: true,
      title: `📊 ${t('memberDetails.useAssessmentSession')}`,
      message: t('memberDetails.confirmUseAssessmentSession'),
      onConfirm: async () => {
        setConfirmModal(null)
        setLoading(true)
        try {
          const response = await fetch('/api/members', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: member.id,
              freeAssessmentSessions: (member.freeAssessmentSessions ?? 0) - 1
            })
          })

          if (response.ok) {
            toast.success(t('memberDetails.assessmentSessionUsed'))
            fetchMember()
          }
        } catch (error) {
          toast.error(t('memberDetails.error'))
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const handleUseInvitation = async () => {
    if (!member || (member.invitations ?? 0) <= 0) {
      toast.warning(t('memberDetails.noInvitationsRemaining'))
      return
    }

    setActiveModal('invitation')
  }

  const handleSubmitInvitation = async () => {
    if (!member) return

    if (!invitationData.guestName.trim() || !invitationData.guestPhone.trim()) {
      toast.warning(t('memberDetails.invitationModal.enterGuestInfo'))
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: member.id,
          guestName: invitationData.guestName.trim(),
          guestPhone: invitationData.guestPhone.trim(),
          notes: invitationData.notes.trim() || undefined,
          salesStaffId: invitationData.salesStaffId || undefined
        })
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(t('memberDetails.invitationModal.invitationSuccess'))

        setInvitationData({ guestName: '', guestPhone: '', notes: '', salesStaffId: '' })
        setActiveModal(null)

        fetchMember()
      } else {
        toast.error(result.error || t('memberDetails.invitationModal.invitationFailed'))
      }
    } catch (error) {
      console.error(error)
      toast.error(t('memberDetails.connectionError'))
    } finally {
      setLoading(false)
    }
  }

  const handleUseFreePT = async () => {
    if (!member || (member.freePTSessions ?? 0) <= 0) {
      toast.warning(t('memberDetails.noFreePTRemaining'))
      return
    }

    setFreeSessionModal({
      isOpen: true,
      serviceType: 'PT'
    })
  }

  const handleUseFreeNutrition = async () => {
    if (!member || (member.freeNutritionSessions ?? 0) <= 0) {
      toast.warning('لا توجد جلسات تغذية متبقية')
      return
    }

    setFreeSessionModal({
      isOpen: true,
      serviceType: 'Nutrition'
    })
  }

  const handleUseFreePhysio = async () => {
    if (!member || (member.freePhysioSessions ?? 0) <= 0) {
      toast.warning('لا توجد جلسات علاج طبيعي متبقية')
      return
    }

    setFreeSessionModal({
      isOpen: true,
      serviceType: 'Physiotherapy'
    })
  }

  const handleUseFreeGroupClass = async () => {
    if (!member || (member.freeGroupClassSessions ?? 0) <= 0) {
      toast.warning('لا توجد جلسات جروب كلاسيس متبقية')
      return
    }

    setFreeSessionModal({
      isOpen: true,
      serviceType: 'GroupClass'
    })
  }

  // ===== Handler Functions للجلسات المدفوعة =====

  const handleUsePaidPT = async () => {
    if (!member || paidSessionCounts.pt <= 0) {
      toast.warning(t('memberDetails.noPaidPTRemaining'))
      return
    }

    setConfirmModal({
      show: true,
      title: t('memberDetails.usePaidPT'),
      message: t('memberDetails.confirmUsePaidPT'),
      onConfirm: async () => {
        setConfirmModal(null)
        setLoading(true)
        try {
          const response = await fetch('/api/members/deduct-paid-service', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              memberId: member.id,
              serviceType: 'paidPT'
            })
          })

          const result = await response.json()

          if (response.ok) {
            toast.success(t('memberDetails.paidPTUsed', { remaining: result.remainingSessions }))
            fetchPTSubscription()
            fetchServiceSubscriptions()
            // تحديث cache الـ PT في جميع الصفحات
            queryClient.invalidateQueries({ queryKey: ['pt-sessions'] })
          } else {
            toast.error(result.error || t('memberDetails.paidSessionDeductionFailed'))
          }
        } catch (error) {
          toast.error(t('memberDetails.connectionError'))
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const handleUsePaidNutrition = async () => {
    if (!member || paidSessionCounts.nutrition <= 0) {
      toast.warning(t('memberDetails.noPaidNutritionRemaining'))
      return
    }

    setConfirmModal({
      show: true,
      title: t('memberDetails.usePaidNutrition'),
      message: t('memberDetails.confirmUsePaidNutrition'),
      onConfirm: async () => {
        setConfirmModal(null)
        setLoading(true)
        try {
          const response = await fetch('/api/members/deduct-paid-service', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              memberId: member.id,
              serviceType: 'paidNutrition'
            })
          })

          const result = await response.json()

          if (response.ok) {
            toast.success(t('memberDetails.paidNutritionUsed', { remaining: result.remainingSessions }))
            fetchServiceSubscriptions()
            // تحديث cache الـ Nutrition في جميع الصفحات
            queryClient.invalidateQueries({ queryKey: ['nutrition-sessions'] })
          } else {
            toast.error(result.error || t('memberDetails.paidSessionDeductionFailed'))
          }
        } catch (error) {
          toast.error(t('memberDetails.connectionError'))
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const handleUsePaidPhysio = async () => {
    if (!member || paidSessionCounts.physio <= 0) {
      toast.warning(t('memberDetails.noPaidPhysioRemaining'))
      return
    }

    setConfirmModal({
      show: true,
      title: t('memberDetails.usePaidPhysio'),
      message: t('memberDetails.confirmUsePaidPhysio'),
      onConfirm: async () => {
        setConfirmModal(null)
        setLoading(true)
        try {
          const response = await fetch('/api/members/deduct-paid-service', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              memberId: member.id,
              serviceType: 'paidPhysio'
            })
          })

          const result = await response.json()

          if (response.ok) {
            toast.success(t('memberDetails.paidPhysioUsed', { remaining: result.remainingSessions }))
            fetchServiceSubscriptions()
            // تحديث cache الـ Physiotherapy في جميع الصفحات
            queryClient.invalidateQueries({ queryKey: ['physiotherapy-sessions'] })
          } else {
            toast.error(result.error || t('memberDetails.paidSessionDeductionFailed'))
          }
        } catch (error) {
          toast.error(t('memberDetails.connectionError'))
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const handleUsePaidGroupClass = async () => {
    if (!member || paidSessionCounts.groupClass <= 0) {
      toast.warning(t('memberDetails.noPaidGroupClassRemaining'))
      return
    }

    setConfirmModal({
      show: true,
      title: t('memberDetails.usePaidGroupClass'),
      message: t('memberDetails.confirmUsePaidGroupClass'),
      onConfirm: async () => {
        setConfirmModal(null)
        setLoading(true)
        try {
          const response = await fetch('/api/members/deduct-paid-service', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              memberId: member.id,
              serviceType: 'paidGroupClass'
            })
          })

          const result = await response.json()

          if (response.ok) {
            toast.success(t('memberDetails.paidGroupClassUsed', { remaining: result.remainingSessions }))
            fetchServiceSubscriptions()
            // تحديث cache الـ Group Classes في جميع الصفحات
            queryClient.invalidateQueries({ queryKey: ['groupClass-sessions'] })
          } else {
            toast.error(result.error || t('memberDetails.paidSessionDeductionFailed'))
          }
        } catch (error) {
          toast.error(t('memberDetails.connectionError'))
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const handleEditBasicInfo = async () => {
    if (!member || !editBasicInfoData.name.trim() || !editBasicInfoData.phone.trim()) {
      toast.warning(t('memberDetails.editModal.enterNameAndPhone'))
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: member.id,
          name: editBasicInfoData.name.trim(),
          phone: editBasicInfoData.phone.trim(),
          profileImage: editBasicInfoData.profileImage,
          idCardFront: editBasicInfoData.idCardFront,
          idCardBack: editBasicInfoData.idCardBack,
          subscriptionPrice: parseInt(editBasicInfoData.subscriptionPrice.toString()),
          inBodyScans: parseInt(editBasicInfoData.inBodyScans.toString()),
          invitations: parseInt(editBasicInfoData.invitations.toString()),
          freePTSessions: parseInt(editBasicInfoData.freePTSessions.toString()),
          freeNutritionSessions: parseInt(editBasicInfoData.freeNutritionSessions.toString()),
          freePhysioSessions: parseInt(editBasicInfoData.freePhysioSessions.toString()),
          freeGroupClassSessions: parseInt(editBasicInfoData.freeGroupClassSessions.toString()),
          freePoolSessions: parseInt(editBasicInfoData.freePoolSessions.toString()),
          freePadelSessions: parseInt(editBasicInfoData.freePadelSessions.toString()),
          freeAssessmentSessions: parseInt(editBasicInfoData.freeAssessmentSessions.toString()),
          freeMoreSessions: parseInt(editBasicInfoData.freeMoreSessions.toString()),
          remainingFreezeDays: parseInt(editBasicInfoData.remainingFreezeDays.toString()),
          remainingAmount: parseInt(editBasicInfoData.remainingAmount.toString()),
          remainingDueDate: editBasicInfoData.remainingDueDate || null,
          coachId: editBasicInfoData.coachId,
          salesStaffId: editBasicInfoData.salesStaffId || null,
          notes: editBasicInfoData.notes.trim() || null,
          startDate: editBasicInfoData.startDate || null,
          expiryDate: editBasicInfoData.expiryDate || null
        })
      })

      if (response.ok) {
        toast.success(t('memberDetails.editModal.updateSuccess'))

        setEditBasicInfoData({
          name: '',
          phone: '',
          profileImage: null,
          idCardFront: null,
          idCardBack: null,
          subscriptionPrice: 0,
          inBodyScans: 0,
          invitations: 0,
          freePTSessions: 0,
          freeNutritionSessions: 0,
          freePhysioSessions: 0,
          freeGroupClassSessions: 0,
          freePoolSessions: 0,
          freePadelSessions: 0,
          freeAssessmentSessions: 0,
          freeMoreSessions: 0,
          remainingFreezeDays: 0,
          remainingAmount: 0,
          remainingDueDate: '',
          coachId: null,
          notes: '',
          startDate: '',
          expiryDate: '',
          salesStaffId: null
        })
        setActiveModal(null)
        fetchMember()
      } else {
        const result = await response.json()
        toast.error(result.error || t('memberDetails.editModal.updateFailed'))
      }
    } catch (error) {
      console.error(error)
      toast.error(t('memberDetails.connectionError'))
    } finally {
      setLoading(false)
    }
  }

  const handleAddRemainingAmount = async () => {
    if (!member || addRemainingAmountData.amount <= 0) {
      toast.warning(t('memberDetails.addRemainingAmountModal.enterValidAmount'))
      return
    }

    setLoading(true)

    try {
      const cleanAmount = parseInt(addRemainingAmountData.amount.toString())
      const newRemaining = member.remainingAmount + cleanAmount

      const response = await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: member.id,
          remainingAmount: newRemaining
        })
      })

      if (response.ok) {
        toast.success(t('memberDetails.addRemainingAmountModal.amountAdded', { amount: cleanAmount.toString() }))

        setAddRemainingAmountData({ amount: 0, notes: '' })
        setActiveModal(null)
        fetchMember()
      } else {
        const result = await response.json()
        toast.error(result.error || t('memberDetails.addRemainingAmountModal.updateFailed'))
      }
    } catch (error) {
      console.error(error)
      toast.error(t('memberDetails.connectionError'))
    } finally {
      setLoading(false)
    }
  }

  const handleFreeze = async () => {
    if (!member || !member.expiryDate || freezeData.days <= 0) {
      toast.warning(t('memberDetails.freezeModal.enterValidDays'))
      return
    }

    // التحقق من رصيد الفريز الكافي
    if (freezeData.days > member.remainingFreezeDays) {
      toast.error(`رصيد الفريز غير كافٍ. المتاح: ${member.remainingFreezeDays} يوم`)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/members/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: member.id,
          freezeDays: freezeData.days
        })
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(`تم تجميد الاشتراك لمدة ${freezeData.days} يوم بنجاح`)

        setFreezeData({ days: 0, reason: '' })
        setActiveModal(null)
        fetchMember()
      } else {
        toast.error(result.error || 'فشل التجميد')
      }
    } catch (error) {
      toast.error(t('memberDetails.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleUnfreeze = async () => {
    if (!member) return

    const confirmed = window.confirm(
      locale === 'ar'
        ? 'متأكد تفك الفريز؟ الأيام اللي ماتستخدمتش هترجع لرصيد الفريز تلقائياً.'
        : 'Confirm unfreeze? Unused days will be returned to freeze balance.'
    )
    if (!confirmed) return

    setLoading(true)
    try {
      const response = await fetch('/api/members/freeze', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id })
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(result.message || (locale === 'ar' ? 'تم فك الفريز بنجاح' : 'Unfreeze successful'))
        fetchMember()
      } else {
        toast.error(result.error || (locale === 'ar' ? 'فشل فك الفريز' : 'Unfreeze failed'))
      }
    } catch {
      toast.error(locale === 'ar' ? 'حدث خطأ في الاتصال' : 'Connection error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!member) return

    setConfirmModal({
      show: true,
      title: `⚠️ ${t('memberDetails.deleteModal.title')}`,
      message: t('memberDetails.deleteModal.confirmMessage', { name: member.name, number: member.memberNumber?.toString() || 'Other' }),
      onConfirm: async () => {
        setConfirmModal(null)
        setLoading(true)
        try {
          const response = await fetch(`/api/members?id=${member.id}`, {
            method: 'DELETE'
          })

          if (response.ok) {
            toast.success(t('memberDetails.deleteModal.deleteSuccess'))
            queryClient.invalidateQueries({ queryKey: ['members'] })
            setTimeout(() => {
              router.push('/members')
            }, 1500)
          } else {
            toast.error(t('memberDetails.deleteModal.deleteFailed'))
          }
        } catch (error) {
          console.error(error)
          toast.error(t('memberDetails.deleteModal.deleteError'))
        } finally {
          setLoading(false)
        }
      }
    })
  }

  const [banReason, setBanReason] = useState('')

  const handleBan = () => {
    if (!member) return
    setBanReason('')
    setActiveModal('ban')
  }

  const handleConfirmBan = async () => {
    if (!member) return
    if (!banReason.trim()) return
    setActiveModal(null)
    setLoading(true)
    try {
      const res = await fetch('/api/banned-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: member.name,
          phone: member.phone || null,
          nationalId: (member as any).nationalId || null,
          reason: banReason.trim(),
          notes: member.memberNumber !== null ? `#${member.memberNumber}` : 'Other'
        })
      })
      if (res.ok) {
        toast.success(locale === 'ar' ? 'تم إضافة العضو لقائمة المحظورين' : 'Member added to banned list')
      } else {
        const err = await res.json()
        toast.error(err.error || (locale === 'ar' ? 'فشل الحظر' : 'Ban failed'))
      }
    } catch {
      toast.error(locale === 'ar' ? 'خطأ في الاتصال' : 'Connection error')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenFitnessTest = async () => {

    if (fitnessTestExists) {
      setActiveModal('view-fitness-test')
    } else {
      // Auto-select coach if current user is coach
      try {
        const userStr = localStorage.getItem('user')

        if (userStr) {
          const user = JSON.parse(userStr)

          if (user.role === 'COACH' && user.staffId) {
            router.push(`/fitness-tests/new?memberId=${memberId}&coachId=${user.staffId}`)
            return
          }
        }
      } catch (error) {
        console.error('Error parsing user from localStorage:', error)
      }

      // Default: show coach selection modal
      await fetchCoaches()
      setActiveModal('fitness-test-coach-select')
    }
  }

  const handleSubmitFitnessTest = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/members/${memberId}/fitness-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId: selectedCoachId,
          testDate: fitnessTestForm.testDate,
          medicalQuestions: fitnessTestForm.medicalQuestions,
          flexibility: fitnessTestForm.flexibility,
          exercises: fitnessTestForm.exercises,
        }),
      })

      if (response.ok) {
        toast.success(t('memberDetails.fitnessTest.saveSuccess'))
        setActiveModal(null)
        fetchFitnessTest()
      } else {
        const result = await response.json()
        toast.error(result.error || t('memberDetails.fitnessTest.saveFailed'))
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error(t('memberDetails.fitnessTest.saveError'))
    } finally {
      setLoading(false)
    }
  }

  if (loading && !member) {
    return (
      <div className="container mx-auto p-6 text-center" dir={direction}>
        <div className="text-6xl mb-4">⏳</div>
        <p className="text-xl">{t('memberDetails.loading')}</p>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="container mx-auto p-6 text-center" dir={direction}>
        <div className="text-6xl mb-4">❌</div>
        <p className="text-xl mb-4">{t('memberDetails.memberNotFound')}</p>
        <button
          onClick={() => router.push('/members')}
          className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
        >
          {t('memberDetails.back')}
        </button>
      </div>
    )
  }

  // التحقق من حالة العضو (هل بدأ الاشتراك ولم ينتهي؟)
  // ✅ تطبيع التواريخ لـ local midnight لتجنب مشاكل timezone
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDate = member.startDate ? (() => { const d = new Date(member.startDate); d.setHours(0, 0, 0, 0); return d })() : null
  const expiryDate = member.expiryDate ? (() => { const d = new Date(member.expiryDate); d.setHours(0, 0, 0, 0); return d })() : null
  const hasStarted = !startDate || startDate <= today
  const notExpired = !expiryDate || expiryDate >= today
  const isMemberActiveNow = member.isActive && hasStarted && notExpired
  const isNotStartedYet = member.isActive && startDate && startDate > today
  const daysUntilStart = isNotStartedYet ? Math.ceil((startDate!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0
  const daysRemaining = calculateRemainingDays(member.expiryDate)

  return (
    <div className="container mx-auto p-6" dir={direction}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">👤 {t('memberDetails.title')}</h1>
          <p className="text-gray-600 dark:text-gray-300">{t('memberDetails.subtitle')}</p>
        </div>
        <button
          onClick={() => router.push('/members')}
          className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-6 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          ← {t('memberDetails.back')}
        </button>
      </div>


      {/* بانر الحظر */}
      {member?.isBanned && (
        <div className="bg-red-600 dark:bg-red-800 text-white rounded-xl shadow-lg p-5 mb-6 border-2 border-red-400 dark:border-red-600">
          <div className="flex items-center gap-4">
            <span className="text-4xl">🚫</span>
            <div className="flex-1">
              <h2 className="text-xl font-bold">{locale === 'ar' ? 'هذا العضو محظور' : 'This Member is Banned'}</h2>
            </div>
            <div className="text-sm bg-red-700 dark:bg-red-900 px-3 py-1.5 rounded-lg font-bold border border-red-500">
              {locale === 'ar' ? 'لا يمكن الاشتراك' : 'Cannot Subscribe'}
            </div>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-700 dark:to-primary-800 text-white rounded-2xl shadow-2xl p-8 mb-6">
        {/* صورة العضو */}
        <div className="flex justify-center mb-6">
          <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-white dark:border-gray-300 shadow-2xl bg-white dark:bg-gray-800">
            {member.profileImage ? (
              <img
                src={member.profileImage}
                alt={member.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-400 bg-gray-100 dark:bg-gray-700">
                <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </div>
        </div>

        <div className={(member.coach || (member as any).salesStaff) ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" : "grid grid-cols-1 md:grid-cols-3 gap-6"}>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm opacity-90">{t('memberDetails.membershipNumber')}</p>
              <button
                onClick={async () => {
                  // Step 1: فتح popup وتوليد الصورة
                  setBarcodePopup({ show: true, step: 'generating', image: '', error: '' })
                  try {
                    const res = await fetch('/api/barcode', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ text: (member.memberNumber ?? 'Other').toString() }),
                    })
                    const data = await res.json()

                    if (!data.barcode) {
                      setBarcodePopup(p => ({ ...p, step: 'error', error: 'فشل إنشاء صورة الباركود' }))
                      return
                    }

                    // التحقق من صحة الصورة
                    const isValid = await new Promise<boolean>((resolve) => {
                      const img = new Image()
                      img.onload = () => resolve(img.width > 0 && img.height > 0)
                      img.onerror = () => resolve(false)
                      img.src = data.barcode
                    })

                    if (!isValid) {
                      setBarcodePopup(p => ({ ...p, step: 'error', error: 'الصورة غير صالحة' }))
                      return
                    }

                    // الصورة جاهزة - عرضها للتأكيد
                    setBarcodePopup({ show: true, step: 'ready', image: data.barcode, error: '' })
                  } catch (error) {
                    console.error('Error:', error)
                    setBarcodePopup(p => ({ ...p, step: 'error', error: 'حدث خطأ أثناء إنشاء الباركود' }))
                  }
                }}
                className="bg-green-500 hover:bg-green-600 text-white rounded-full p-1.5 transition-all hover:scale-110"
                title="Send Barcode via WhatsApp"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </button>
              {hasPermission('canEditMembers') && (
                <button
                  onClick={() => {
                    setEditBasicInfoData({
                      name: member.name,
                      phone: member.phone,
                      profileImage: member.profileImage || null,
                      subscriptionPrice: member.subscriptionPrice,
                      inBodyScans: member.inBodyScans ?? 0,
                      invitations: member.invitations ?? 0,
                      freePTSessions: member.freePTSessions ?? 0,
                      freeNutritionSessions: member.freeNutritionSessions ?? 0,
                      freePhysioSessions: member.freePhysioSessions ?? 0,
                      freeGroupClassSessions: member.freeGroupClassSessions ?? 0,
                      freePoolSessions: member.freePoolSessions ?? 0,
                      freePadelSessions: member.freePadelSessions ?? 0,
                      freeAssessmentSessions: member.freeAssessmentSessions ?? 0,
                      freeMoreSessions: member.freeMoreSessions ?? 0,
                      remainingFreezeDays: member.remainingFreezeDays ?? 0,
                      remainingAmount: member.remainingAmount ?? 0,
                      remainingDueDate: (member as any).remainingDueDate ? formatDateYMD((member as any).remainingDueDate) : '',
                      coachId: member.coachId || null,
                      salesStaffId: (member as any).salesStaffId || null,
                      notes: member.notes || '',
                      startDate: member.startDate ? formatDateYMD(member.startDate) : '',
                      expiryDate: member.expiryDate ? formatDateYMD(member.expiryDate) : '',
                      idCardFront: member.idCardFront || null,
                      idCardBack: member.idCardBack || null
                    })
                    setActiveModal('edit-basic-info')
                  }}
                  disabled={loading}
                  className="bg-primary-500 hover:bg-primary-600 text-white rounded-full p-1.5 transition-all hover:scale-110 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  title={t('memberDetails.editModal.title')}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                  </svg>
                </button>
              )}
              {(member.idCardFront || member.idCardBack) && (
                <button
                  onClick={() => setShowIdCardModal(true)}
                  className="bg-secondary-500 hover:bg-secondary-600 text-white rounded-full p-1.5 transition-all hover:scale-110"
                  title={t('memberDetails.viewIdCardImages')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                  </svg>
                </button>
              )}
            </div>
            <p className="text-5xl font-bold">{member.memberNumber !== null ? `#${member.memberNumber}` : <span className="bg-white/20 px-3 py-1 rounded-full text-2xl">Other</span>}</p>
          </div>
          <div>
            <p className="text-sm opacity-90 mb-2">{t('memberDetails.memberName')}</p>
            <p className="text-3xl font-bold">{member.name}</p>
          </div>
          <div>
            <p className="text-sm opacity-90 mb-2">{t('memberDetails.phoneNumber')}</p>
            <p className="text-2xl font-mono">{member.phone}</p>
          </div>
          {member.backupPhone && (
            <div>
              <p className="text-sm opacity-90 mb-2">{t('memberDetails.backupPhone')}</p>
              <p className="text-2xl font-mono">{member.backupPhone}</p>
            </div>
          )}
          {member.email && (
            <div>
              <p className="text-sm opacity-90 mb-2">📧 البريد الإلكتروني</p>
              <p className="text-2xl font-mono">{member.email}</p>
            </div>
          )}
          {member.nationalId && (
            <div>
              <p className="text-sm opacity-90 mb-2">{t('memberDetails.nationalId')}</p>
              <p className="text-2xl font-mono">{member.nationalId}</p>
            </div>
          )}
          {member.birthDate && (
            <div>
              <p className="text-sm opacity-90 mb-2">{t('memberDetails.birthDate')}</p>
              <p className="text-2xl font-mono">
                {new Date(member.birthDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          )}
          {member.source && (
            <div>
              <p className="text-sm opacity-90 mb-2">{t('memberDetails.memberSource')}</p>
              <p className="text-2xl">
                {(() => {
                  const sourcesAr: { [key: string]: string } = {
                    'facebook': 'فيسبوك',
                    'instagram': 'انستجرام',
                    'tiktok': 'تيك توك',
                    'google_maps': 'خرائط جوجل',
                    'friend_referral': 'إحالة من صديق'
                  }
                  const sourcesEn: { [key: string]: string } = {
                    'facebook': 'Facebook',
                    'instagram': 'Instagram',
                    'tiktok': 'TikTok',
                    'google_maps': 'Google Maps',
                    'friend_referral': 'Friend Referral'
                  }
                  const sources = locale === 'ar' ? sourcesAr : sourcesEn
                  return sources[member.source!] || member.source
                })()}
              </p>
            </div>
          )}
          {member.coach && (
            <div>
              <p className="text-sm opacity-90 mb-2">👨‍🏫 المدرب</p>
              <p className="text-3xl font-bold">{member.coach.name}</p>
              <p className="text-sm opacity-75">#{member.coach.staffCode}</p>
            </div>
          )}
          {(member as any).salesStaff && (
            <div>
              <p className="text-sm opacity-90 mb-2">💼 {locale === 'ar' ? 'موظف السيلز' : 'Sales Staff'}</p>
              <p className="text-3xl font-bold">{(member as any).salesStaff.name}</p>
              <p className="text-sm opacity-75">#{(member as any).salesStaff.staffCode}</p>
            </div>
          )}
        </div>

        <div className="mt-6 pt-6 border-t border-white dark:border-gray-400 border-opacity-20">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white dark:bg-gray-800 bg-opacity-20 rounded-lg p-4">
              <p className="text-sm opacity-90">{t('memberDetails.status')}</p>
              <p className="text-lg font-bold">
                {member.isBanned
                  ? `🚫 ${locale === 'ar' ? 'محظور' : 'Banned'}`
                  : member.isFrozen
                    ? `❄️ ${locale === 'ar' ? 'مجمد' : 'Frozen'}`
                    : isNotStartedYet
                      ? `🕐 ${locale === 'ar' ? `يبدأ بعد ${daysUntilStart} يوم` : `Starts in ${daysUntilStart}d`}`
                      : isMemberActiveNow
                        ? `✅ ${t('memberDetails.active')}`
                        : `❌ ${t('memberDetails.expired')}`
                }
              </p>
            </div>
            {member.isFrozen && (
              <div className="bg-cyan-500/30 dark:bg-cyan-900/40 border border-cyan-300/50 dark:border-cyan-700 rounded-lg p-4">
                <p className="text-sm opacity-90">❄️ {locale === 'ar' ? 'التجميد ينتهي' : 'Freeze ends'}</p>
                <p className="text-lg font-bold text-white font-mono">
                  {member.freezeRequests?.[0]?.endDate
                    ? new Date(member.freezeRequests[0].endDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                    : locale === 'ar' ? 'يدوي' : 'Manual'
                  }
                </p>
              </div>
            )}
            <div className="bg-white dark:bg-gray-800 bg-opacity-20 rounded-lg p-4">
              <p className="text-sm opacity-90">{t('common.startDate')}</p>
              <p className="text-lg font-mono">
                {formatDateYMD(member.startDate)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 bg-opacity-20 rounded-lg p-4">
              <p className="text-sm opacity-90">{t('memberDetails.expiryDate')}</p>
              <p className="text-lg font-mono">
                {formatDateYMD(member.expiryDate)}
              </p>
              {daysRemaining !== null && daysRemaining > 0 && (
                <p className="text-xs opacity-75 mt-1">{t('memberDetails.daysRemaining', { days: daysRemaining.toString() })}</p>
              )}
            </div>
            <div className="bg-white dark:bg-gray-800 bg-opacity-20 rounded-lg p-4">
              <p className="text-sm opacity-90">{t('memberDetails.subscriptionPrice')}</p>
              <p className="text-2xl font-bold">{member.subscriptionPrice} {t('memberDetails.egp')}</p>
            </div>
            {settings.remainingEnabled && member.remainingAmount > 0 && (
              <div className="bg-orange-400/30 border-2 border-orange-300 rounded-lg p-4">
                <p className="text-sm opacity-90">💰 {locale === 'ar' ? 'باقي على العضو' : 'Remaining Balance'}</p>
                <p className="text-2xl font-bold text-orange-100">{member.remainingAmount} {t('memberDetails.egp')}</p>
              </div>
            )}
            <div className="bg-white dark:bg-gray-800 bg-opacity-20 rounded-lg p-4">
              <p className="text-sm opacity-90">{locale === 'ar' ? 'الباقة' : 'Package'}</p>
              <p className="text-2xl font-bold">{getPackageName(member.startDate, member.expiryDate, locale)}</p>
            </div>
            <div
              className="bg-white dark:bg-gray-800 bg-opacity-20 rounded-lg p-4 cursor-pointer hover:bg-opacity-30 transition-all transform hover:scale-105"
              onClick={lastReceipt ? handleShowReceipts : undefined}
              title={lastReceipt ? (locale === 'ar' ? 'اضغط لعرض سجل الإيصالات' : 'Click to view receipts history') : ''}
            >
              <p className="text-sm opacity-90 flex items-center gap-1">
                🧾 {t('memberDetails.lastReceipt')}
                {lastReceipt && (
                  <span className="text-xs opacity-75">({locale === 'ar' ? 'اضغط للعرض' : 'Click'})</span>
                )}
              </p>
              {lastReceipt ? (
                <div>
                  <p className="text-2xl font-bold text-green-300">#{lastReceiptNumber}</p>
                  <p className="text-xs opacity-75 mt-1">
                    {lastReceipt.amount} {t('memberDetails.egp')} • {new Date(lastReceipt.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              ) : (
                <p className="text-2xl font-bold text-green-300">---</p>
              )}
            </div>
          </div>
        </div>

        {/* عرض الملاحظات */}
        {member.notes && (
          <div className="mt-6 pt-6 border-t border-white dark:border-gray-400 border-opacity-20">
            <div className="bg-white dark:bg-gray-800 bg-opacity-20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">📝</span>
                <p className="text-sm opacity-90 font-semibold">{t('memberDetails.notes')}</p>
              </div>
              <p className="text-base leading-relaxed whitespace-pre-wrap">{member.notes}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-6">
        {settings.pointsEnabled && (
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 ${direction === 'rtl' ? 'border-r-4' : 'border-l-4'} border-primary-500`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-600 dark:text-gray-300 text-sm">{t('memberDetails.points')}</p>
                <p className="text-4xl font-bold text-primary-600 dark:text-primary-400">{member.points ?? 0}</p>
              </div>
              <div className="text-5xl">🏆</div>
            </div>
            <div className="space-y-2">
              <button
                onClick={handleShowPointsHistory}
                className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 transition-colors"
              >
                {t('memberDetails.viewPointsHistory')}
              </button>
              <button
                onClick={() => setShowAddPointsModal(true)}
                className="w-full bg-yellow-500 text-white py-2 rounded-lg hover:bg-yellow-600 flex items-center justify-center gap-2 transition-colors"
              >
                <span>➕</span>
                <span>{t('memberDetails.addRemovePoints')}</span>
              </button>
            </div>
          </div>
        )}

        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 ${direction === 'rtl' ? 'border-r-4' : 'border-l-4'} border-primary-500`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-gray-600 dark:text-gray-300 text-sm">{t('memberDetails.invitations')}</p>
              <p className="text-4xl font-bold text-primary-600">{member.invitations ?? 0}</p>
            </div>
            <div className="text-5xl">🎟️</div>
          </div>
          <button
            onClick={handleUseInvitation}
            disabled={(member.invitations ?? 0) <= 0 || loading}
            className="w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {t('memberDetails.useInvitation')}
          </button>
        </div>

        {settings.inBodyEnabled && (
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 ${direction === 'rtl' ? 'border-r-4' : 'border-l-4'} border-green-500`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-600 dark:text-gray-300 text-sm">{t('memberDetails.inBody')}</p>
                <p className="text-4xl font-bold text-green-600">{member.inBodyScans ?? 0}</p>
              </div>
              <div className="text-5xl">⚖️</div>
            </div>
            <button
              onClick={handleUseInBody}
              disabled={(member.inBodyScans ?? 0) <= 0 || loading}
              className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {t('memberDetails.useSession')}
            </button>
          </div>
        )}

        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 ${direction === 'rtl' ? 'border-r-4' : 'border-l-4'} border-orange-500`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-gray-600 dark:text-gray-300 text-sm">{t('memberDetails.freePTSessions')}</p>
              <p className="text-4xl font-bold text-orange-600">{member.freePTSessions ?? 0}</p>
            </div>
            <div className="text-5xl">💪</div>
          </div>

          {/* عرض الجلسات المدفوعة */}
          {paidSessionCounts.pt > 0 && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-700 rounded-lg p-3 mb-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">{t('memberDetails.paidPTSessions')}</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{paidSessionCounts.pt}</p>
            </div>
          )}

          {/* أزرار الخصم */}
          <div className="space-y-2">
            <button
              onClick={handleUseFreePT}
              disabled={(member.freePTSessions ?? 0) <= 0 || loading}
              className="w-full bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {t('memberDetails.useSession')}
            </button>

            {paidSessionCounts.pt > 0 && (
              <button
                onClick={handleUsePaidPT}
                disabled={loading}
                className="w-full bg-orange-500 text-white py-2 rounded-lg hover:bg-orange-600"
              >
                {t('memberDetails.usePaidSession')}
              </button>
            )}
          </div>
        </div>

        {settings.nutritionEnabled && (
          <div className="bg-gradient-to-br from-lime-500 to-green-600 text-white rounded-xl shadow-2xl p-6 border-4 border-lime-300">
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
              <div className="bg-white dark:bg-gray-800/20 p-3 rounded-full w-fit">
                <span className="text-4xl">🥗</span>
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold">{t('memberDetails.nutritionSessions')}</h3>
                <p className="text-sm opacity-90">{t('memberDetails.nutritionSubtitle')}</p>
              </div>
            </div>

            <div className={`grid grid-cols-1 ${paidSessionCounts.nutrition > 0 ? 'sm:grid-cols-2' : ''} gap-3 md:gap-4 mt-4`}>
              <div className="bg-white/10 dark:bg-gray-800/20 rounded-lg p-3 md:p-4 backdrop-blur-sm hover:bg-white/20 dark:hover:bg-gray-700/40 transition">
                <p className="text-xs opacity-80 mb-1">{t('memberDetails.freeSessions')}</p>
                <p className="text-xl md:text-2xl font-bold text-yellow-300">{member.freeNutritionSessions ?? 0}</p>
              </div>

              {paidSessionCounts.nutrition > 0 && (
                <div className="bg-white/10 dark:bg-gray-800/20 rounded-lg p-3 md:p-4 backdrop-blur-sm hover:bg-white/20 dark:hover:bg-gray-700/40 transition">
                  <p className="text-xs opacity-80 mb-1">{t('memberDetails.paidNutritionSessions')}</p>
                  <p className="text-xl md:text-2xl font-bold text-yellow-300">{paidSessionCounts.nutrition}</p>
                </div>
              )}
            </div>

            <div className="space-y-2 mt-4">
              <button
                onClick={handleUseFreeNutrition}
                disabled={(member.freeNutritionSessions ?? 0) <= 0 || loading}
                className="w-full bg-white dark:bg-gray-700 text-green-600 dark:text-green-400 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
              >
                {t('memberDetails.useNutrition')}
              </button>

              {paidSessionCounts.nutrition > 0 && (
                <button
                  onClick={handleUsePaidNutrition}
                  disabled={loading}
                  className="w-full bg-white/20 dark:bg-gray-700/50 text-white py-3 rounded-lg hover:bg-white/30 dark:hover:bg-gray-600/50 font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95"
                >
                  {t('memberDetails.usePaidSession')}
                </button>
              )}
            </div>
          </div>
        )}

        {settings.physiotherapyEnabled && (
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl shadow-2xl p-6 border-4 border-blue-300">
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
              <div className="bg-white dark:bg-gray-800/20 p-3 rounded-full w-fit">
                <span className="text-4xl">🏥</span>
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold">{t('memberDetails.physioSessions')}</h3>
                <p className="text-sm opacity-90">{t('memberDetails.physioSubtitle')}</p>
              </div>
            </div>

            <div className={`grid grid-cols-1 ${paidSessionCounts.physio > 0 ? 'sm:grid-cols-2' : ''} gap-3 md:gap-4 mt-4`}>
              <div className="bg-white/10 dark:bg-gray-800/20 rounded-lg p-3 md:p-4 backdrop-blur-sm hover:bg-white/20 dark:hover:bg-gray-700/40 transition">
                <p className="text-xs opacity-80 mb-1">{t('memberDetails.freeSessions')}</p>
                <p className="text-xl md:text-2xl font-bold text-yellow-300">{member.freePhysioSessions ?? 0}</p>
              </div>

              {paidSessionCounts.physio > 0 && (
                <div className="bg-white/10 dark:bg-gray-800/20 rounded-lg p-3 md:p-4 backdrop-blur-sm hover:bg-white/20 dark:hover:bg-gray-700/40 transition">
                  <p className="text-xs opacity-80 mb-1">{t('memberDetails.paidPhysioSessions')}</p>
                  <p className="text-xl md:text-2xl font-bold text-yellow-300">{paidSessionCounts.physio}</p>
                </div>
              )}
            </div>

            <div className="space-y-2 mt-4">
              <button
                onClick={handleUseFreePhysio}
                disabled={(member.freePhysioSessions ?? 0) <= 0 || loading}
                className="w-full bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
              >
                {t('memberDetails.usePhysio')}
              </button>

              {paidSessionCounts.physio > 0 && (
                <button
                  onClick={handleUsePaidPhysio}
                  disabled={loading}
                  className="w-full bg-white/20 dark:bg-gray-700/50 text-white py-3 rounded-lg hover:bg-white/30 dark:hover:bg-gray-600/50 font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95"
                >
                  {t('memberDetails.usePaidSession')}
                </button>
              )}
            </div>
          </div>
        )}

        {settings.groupClassEnabled && (
          <div className="bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white rounded-xl shadow-2xl p-6 border-4 border-fuchsia-300">
            <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
              <div className="bg-white dark:bg-gray-800/20 p-3 rounded-full w-fit">
                <span className="text-4xl">👥</span>
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold">{t('memberDetails.groupClassSessions')}</h3>
                <p className="text-sm opacity-90">{t('memberDetails.groupClassSubtitle')}</p>
              </div>
            </div>

            <div className={`grid grid-cols-1 ${paidSessionCounts.groupClass > 0 ? 'sm:grid-cols-2' : ''} gap-3 md:gap-4 mt-4`}>
              <div className="bg-white/10 dark:bg-gray-800/20 rounded-lg p-3 md:p-4 backdrop-blur-sm hover:bg-white/20 dark:hover:bg-gray-700/40 transition">
                <p className="text-xs opacity-80 mb-1">{t('memberDetails.freeSessions')}</p>
                <p className="text-xl md:text-2xl font-bold text-yellow-300">{member.freeGroupClassSessions ?? 0}</p>
              </div>

              {paidSessionCounts.groupClass > 0 && (
                <div className="bg-white/10 dark:bg-gray-800/20 rounded-lg p-3 md:p-4 backdrop-blur-sm hover:bg-white/20 dark:hover:bg-gray-700/40 transition">
                  <p className="text-xs opacity-80 mb-1">{t('memberDetails.paidGroupClassSessions')}</p>
                  <p className="text-xl md:text-2xl font-bold text-yellow-300">{paidSessionCounts.groupClass}</p>
                </div>
              )}
            </div>

            <div className="space-y-2 mt-4">
              <button
                onClick={handleUseFreeGroupClass}
                disabled={(member.freeGroupClassSessions ?? 0) <= 0 || loading}
                className="w-full bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
              >
                {t('memberDetails.useGroupClass')}
              </button>

              {paidSessionCounts.groupClass > 0 && (
                <button
                  onClick={handleUsePaidGroupClass}
                  disabled={loading}
                  className="w-full bg-white/20 dark:bg-gray-700/50 text-white py-3 rounded-lg hover:bg-white/30 dark:hover:bg-gray-600/50 font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95"
                >
                  {t('memberDetails.usePaidSession')}
                </button>
              )}
            </div>
          </div>
        )}

        {settings.poolEnabled && (
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 ${direction === 'rtl' ? 'border-r-4' : 'border-l-4'} border-teal-500`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-600 dark:text-gray-300 text-sm">{t('memberDetails.poolSessions')}</p>
                <p className="text-4xl font-bold text-teal-600 dark:text-teal-400">{member.freePoolSessions ?? 0}</p>
              </div>
              <div className="text-5xl">🏊</div>
            </div>
            <button
              onClick={handleUsePool}
              disabled={(member.freePoolSessions ?? 0) <= 0 || loading}
              className="w-full bg-teal-600 text-white py-2 rounded-lg hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {t('memberDetails.useSession')}
            </button>
          </div>
        )}

        {settings.padelEnabled && (
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 ${direction === 'rtl' ? 'border-r-4' : 'border-l-4'} border-amber-500`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-600 dark:text-gray-300 text-sm">{t('memberDetails.padelSessions')}</p>
                <p className="text-4xl font-bold text-amber-600 dark:text-amber-400">{member.freePadelSessions ?? 0}</p>
              </div>
              <div className="text-5xl">🎾</div>
            </div>
            <button
              onClick={handleUsePadel}
              disabled={(member.freePadelSessions ?? 0) <= 0 || loading}
              className="w-full bg-amber-600 text-white py-2 rounded-lg hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {t('memberDetails.useSession')}
            </button>
          </div>
        )}

        {settings.assessmentEnabled && (
          <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 ${direction === 'rtl' ? 'border-r-4' : 'border-l-4'} border-indigo-500`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-600 dark:text-gray-300 text-sm">{t('memberDetails.assessmentSessions')}</p>
                <p className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">{member.freeAssessmentSessions ?? 0}</p>
              </div>
              <div className="text-5xl">📊</div>
            </div>
            <button
              onClick={handleUseAssessment}
              disabled={(member.freeAssessmentSessions ?? 0) <= 0 || loading}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {t('memberDetails.useSession')}
            </button>
          </div>
        )}

        <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 ${direction === 'rtl' ? 'border-r-4' : 'border-l-4'} ${member.isFrozen ? 'border-orange-500' : 'border-cyan-500'}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-gray-600 dark:text-gray-300 text-sm">{t('memberDetails.freezeDays')}</p>
              <p className="text-4xl font-bold text-cyan-600">{member.remainingFreezeDays ?? 0}</p>
            </div>
            <div className="text-5xl">{member.isFrozen ? '🧊' : '❄️'}</div>
          </div>
          {member.isFrozen ? (
            <button
              onClick={handleUnfreeze}
              disabled={loading}
              className="w-full bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold"
            >
              {loading
                ? (locale === 'ar' ? 'جاري...' : 'Processing...')
                : (locale === 'ar' ? '🔓 فك الفريز وتنشيط الاشتراك' : '🔓 Unfreeze & Activate')}
            </button>
          ) : (
            <button
              onClick={() => setActiveModal('freeze')}
              disabled={!member.expiryDate || loading || (member.remainingFreezeDays ?? 0) <= 0}
              className="w-full bg-cyan-600 text-white py-2 rounded-lg hover:bg-cyan-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {t('memberDetails.freezeSubscription')}
            </button>
          )}
        </div>
      </div>

      {/* PT Subscription Card */}
      {ptSubscription && (
        <div className="bg-gradient-to-br from-teal-500 to-cyan-600 text-white rounded-xl shadow-2xl p-6 mb-6 border-4 border-teal-300">
          <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
            <div className="bg-white dark:bg-gray-800/20 p-3 rounded-full w-fit">
              <span className="text-4xl">🏋️</span>
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold">اشتراك التدريب الشخصي (PT)</h3>
              <p className="text-sm opacity-90">معلومات مبسطة عن اشتراك PT</p>
            </div>
            <div className="bg-green-500 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 w-fit">
              <span>✅</span>
              <span>نشط</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-4">
            <div className="bg-white/10 dark:bg-gray-800/20 rounded-lg p-3 md:p-4 backdrop-blur-sm hover:bg-white/20 dark:hover:bg-gray-700/40 transition">
              <p className="text-xs opacity-80 mb-1">رقم PT</p>
              <p className="text-xl md:text-2xl font-bold">#{ptSubscription.ptNumber}</p>
            </div>

            <div className="bg-white/10 dark:bg-gray-800/20 rounded-lg p-3 md:p-4 backdrop-blur-sm hover:bg-white/20 dark:hover:bg-gray-700/40 transition">
              <p className="text-xs opacity-80 mb-1">الكوتش</p>
              <p className="text-base md:text-lg font-bold truncate">{ptSubscription.coachName}</p>
            </div>

            <div className="bg-white/10 dark:bg-gray-800/20 rounded-lg p-3 md:p-4 backdrop-blur-sm hover:bg-white/20 dark:hover:bg-gray-700/40 transition">
              <p className="text-xs opacity-80 mb-1">الجلسات المتبقية</p>
              <p className="text-xl md:text-2xl font-bold text-yellow-300">
                {ptSubscription.sessionsRemaining} / {ptSubscription.sessionsPurchased}
              </p>
            </div>

            <div className="bg-white/10 dark:bg-gray-800/20 rounded-lg p-3 md:p-4 backdrop-blur-sm hover:bg-white/20 dark:hover:bg-gray-700/40 transition">
              <p className="text-xs opacity-80 mb-1">المبلغ المتبقي</p>
              <p className="text-xl md:text-2xl font-bold text-yellow-300">
                {ptSubscription.remainingAmount} ج.م
              </p>
            </div>
          </div>

          {ptSubscription.expiryDate && (
            <div className="mt-4 bg-white/10 dark:bg-gray-800/20 rounded-lg p-3 backdrop-blur-sm hover:bg-white/20 dark:hover:bg-gray-700/40 transition">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm opacity-90">📅 تاريخ الانتهاء</span>
                <span className="font-bold">{new Date(ptSubscription.expiryDate).toLocaleDateString('ar-EG')}</span>
              </div>
            </div>
          )}

          <button
            onClick={() => router.push('/pt')}
            className="w-full mt-4 bg-white dark:bg-gray-700 text-teal-600 dark:text-teal-400 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95"
          >
            <span>📊</span>
            <span>عرض تفاصيل PT الكاملة</span>
          </button>
        </div>
      )}


      {/* Payment & Edit Section */}
      <div className={`grid grid-cols-1 ${settings.remainingEnabled && member.remainingAmount > 0 ? 'md:grid-cols-2' : ''} gap-6 mb-6`}>
        {/* Payment Card - Only show if there's remaining amount and remainingEnabled */}
        {settings.remainingEnabled && member.remainingAmount > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-green-100 p-3 rounded-full">
                <span className="text-3xl">💰</span>
              </div>
              <div>
                <h3 className="text-xl font-bold">{t('memberDetails.paymentModal.title')}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">{t('memberDetails.paymentModal.remainingLabel', { amount: member.remainingAmount.toString() })}</p>
              </div>
            </div>
            <button
              onClick={() => setActiveModal('payment')}
              disabled={loading}
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold"
            >
              {t('memberDetails.paymentModal.payButton')}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Upgrade Package - متاح دايماً لو عنده startDate */}
        {hasPermission('canCreateMembers') && member?.startDate && (
          <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/30 dark:to-red-900/30 border-2 border-orange-300 dark:border-orange-700 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-200 dark:bg-orange-800 p-3 rounded-full">
                <span className="text-3xl">🚀</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-orange-800 dark:text-orange-200">{t('upgrade.upgradePackage')}</h3>
                <p className="text-sm text-orange-700 dark:text-orange-300">{t('upgrade.upgradeDescription')}</p>
              </div>
            </div>

            {/* تحذير لو الاشتراك منتهي */}
            {member?.expiryDate && new Date(member.expiryDate) < new Date() && (
              <div className="mb-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-600 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300 font-medium">
                ⚠️ {locale === 'ar' ? 'الاشتراك منتهي — سيُحسب السعر كاملاً' : 'Subscription expired — full price applies'}
              </div>
            )}

            {member?.isBanned ? (
              <div className="w-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 py-3 rounded-lg font-bold text-lg text-center border-2 border-red-300 dark:border-red-700">
                🚫 {locale === 'ar' ? 'محظور - لا يمكن الترقية' : 'Banned - Cannot Upgrade'}
              </div>
            ) : (
              <button
                onClick={() => setShowUpgradeForm(true)}
                disabled={loading}
                className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white py-3 rounded-lg hover:from-orange-700 hover:to-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-lg shadow-md hover:shadow-lg transition-all"
              >
                🚀 {t('upgrade.upgradePackage')}
              </button>
            )}
          </div>
        )}

        {/* Renewal Form - Show only for users with canCreateMembers permission */}
        {hasPermission('canCreateMembers') && (
          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/40 border-2 border-green-300 dark:border-green-700 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-green-200 dark:bg-green-800 p-3 rounded-full">
                <span className="text-3xl">🔄</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-green-800 dark:text-green-200">{t('renewall.title')}</h3>
                <p className="text-sm text-green-700 dark:text-green-300">{t('renewall.subtitle')}</p>
              </div>
            </div>
            {member?.isBanned ? (
              <div className="w-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 py-3 rounded-lg font-bold text-lg text-center border-2 border-red-300 dark:border-red-700">
                🚫 {locale === 'ar' ? 'محظور - لا يمكن التجديد' : 'Banned - Cannot Renew'}
              </div>
            ) : (
              <button
                onClick={() => setShowRenewalForm(true)}
                disabled={loading}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-lg shadow-md hover:shadow-lg"
              >
                🔄 {t('renewall.renewButton')}
              </button>
            )}
          </div>
        )}

        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-900/40 border-2 border-red-300 dark:border-red-700 rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-red-200 dark:bg-red-800 p-3 rounded-full">
              <span className="text-3xl">🗑️</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-red-800 dark:text-red-200">{t('memberDetails.deleteModal.title')}</h3>
              <p className="text-sm text-red-700 dark:text-red-300">{t('memberDetails.deleteModal.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-lg shadow-md hover:shadow-lg"
          >
            🗑️ {t('memberDetails.deleteModal.deleteButton')}
          </button>
        </div>

        {/* بطاقة الحظر */}
        {hasPermission('canManageBannedMembers') && (
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-950 dark:to-gray-900 border-2 border-gray-700 dark:border-gray-600 rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-gray-700 p-3 rounded-full">
                <span className="text-3xl">🚫</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{locale === 'ar' ? 'حظر العضو' : 'Ban Member'}</h3>
                <p className="text-sm text-gray-400">{locale === 'ar' ? 'إضافة رقم هاتفه/رقمه القومي لقائمة المحظورين' : 'Add phone/national ID to banned list'}</p>
              </div>
            </div>
            <button
              onClick={handleBan}
              disabled={loading}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg shadow-md hover:shadow-lg border border-gray-600 transition-colors"
            >
              🚫 {locale === 'ar' ? 'إضافة للمحظورين' : 'Add to Banned List'}
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal && confirmModal.show && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6" dir={direction}>
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold mb-3">{confirmModal.title}</h3>
              <p className="text-gray-600 dark:text-gray-300 text-lg">{confirmModal.message}</p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm()
                }}
                className="flex-1 bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 font-bold"
              >
                ✅ {t('memberDetails.confirmModal.yes')}
              </button>
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold"
              >
                ✖️ {t('memberDetails.confirmModal.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: دفع المبلغ */}
      {activeModal === 'payment' && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null)
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">💰 {t('memberDetails.paymentModal.title')}</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-gray-400 dark:text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:text-gray-300 text-3xl leading-none"
                type="button"
              >
                ×
              </button>
            </div>

            <div className={`bg-yellow-50 ${direction === 'rtl' ? 'border-r-4' : 'border-l-4'} border-yellow-500 p-4 rounded-lg mb-6 dark:bg-yellow-900/20 dark:border-yellow-700`}>
              <p className="font-bold text-yellow-800">
                {t('memberDetails.paymentModal.remainingLabel', { amount: member.remainingAmount.toString() })}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                  {t('memberDetails.paymentModal.amountPaid')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={paymentData.amount || ''}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: parseInt(e.target.value) || 0 })}
                  max={member.remainingAmount}
                  className="w-full px-4 py-3 border-2 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white text-xl focus:outline-none focus:border-primary-500"
                  placeholder="0"
                  autoFocus
                />
              </div>

              <div className="bg-gradient-to-br from-green-50 to-primary-50 dark:from-green-900/30 dark:to-primary-900/30 border-2 border-green-200 dark:border-green-700 rounded-xl p-5 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <PaymentMethodSelector
                  value={paymentData.paymentMethod}
                  onChange={(method) => setPaymentData({ ...paymentData, paymentMethod: method })}
                  required
                  memberPoints={member.points || 0}
                  pointsValueInEGP={settings.pointsValueInEGP}
                  pointsEnabled={settings.pointsEnabled}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 dark:text-gray-300">{t('memberDetails.paymentModal.notes')}</label>
                <textarea
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  className="w-full px-4 py-3 border-2 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:border-primary-500"
                  rows={3}
                  placeholder={t('memberDetails.paymentModal.notesPlaceholder')}
                />
              </div>

              <div className="bg-green-50 dark:bg-green-900/30 border-2 border-green-300 dark:border-green-700 rounded-lg p-4">
                <div className="flex justify-between text-lg">
                  <span>{t('memberDetails.paymentModal.remainingAfterPayment')}:</span>
                  <span className="font-bold text-green-600">
                    {member.remainingAmount - paymentData.amount} {t('memberDetails.egp')}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handlePayment}
                  disabled={loading || paymentData.amount <= 0}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-bold"
                >
                  {loading ? t('memberDetails.paymentModal.processing') : `✅ ${t('memberDetails.paymentModal.confirmPayment')}`}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  {t('memberDetails.confirmModal.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: تعديل البيانات الأساسية */}
      {activeModal === 'edit-basic-info' && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 overflow-y-auto"
          style={{ zIndex: 9999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null)
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full p-4 my-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir={direction}>
            <div className="flex justify-between items-center mb-3 pb-2 border-b">
              <h3 className="text-base font-bold">✏️ {t('memberDetails.editModal.title')} {member.memberNumber !== null ? `#${member.memberNumber}` : 'Other'}</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-gray-400 dark:text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:text-gray-300 text-2xl leading-none"
                type="button"
              >
                ×
              </button>
            </div>

            {/* تعديل الصورة */}
            <div className="mb-4">
              <ImageUpload
                currentImage={editBasicInfoData.profileImage}
                onImageChange={(imageUrl) => setEditBasicInfoData({ ...editBasicInfoData, profileImage: imageUrl })}
                disabled={loading}
              />
            </div>

            {/* تعديل صور البطاقة */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1 text-center">🪪 وجه البطاقة</label>
                <ImageUpload
                  currentImage={editBasicInfoData.idCardFront}
                  onImageChange={(imageUrl) => setEditBasicInfoData({ ...editBasicInfoData, idCardFront: imageUrl })}
                  disabled={loading}
                  variant="idCard"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-center">🪪 خلف البطاقة</label>
                <ImageUpload
                  currentImage={editBasicInfoData.idCardBack}
                  onImageChange={(imageUrl) => setEditBasicInfoData({ ...editBasicInfoData, idCardBack: imageUrl })}
                  disabled={loading}
                  variant="idCard"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">
                  📋 {t('memberDetails.editModal.fields.name')} *
                </label>
                <input
                  type="text"
                  value={editBasicInfoData.name}
                  onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, name: e.target.value })}
                  className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder={t('memberDetails.editModal.fields.namePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  📞 {t('memberDetails.editModal.fields.phone')} *
                </label>
                <input
                  type="tel"
                  value={editBasicInfoData.phone}
                  onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, phone: e.target.value })}
                  className="w-full px-2 py-1.5 border rounded text-sm font-mono dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder={t('memberDetails.editModal.fields.phonePlaceholder')}
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  💰 {t('memberDetails.editModal.fields.subscriptionPrice')}
                </label>
                <input
                  type="number"
                  value={editBasicInfoData.subscriptionPrice || ''}
                  onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, subscriptionPrice: parseInt(e.target.value) || 0 })}
                  className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="0"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  📅 {t('memberDetails.editModal.fields.startDate')}
                </label>
                <input
                  type="date"
                  value={editBasicInfoData.startDate}
                  onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, startDate: e.target.value })}
                  className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  🏁 {t('memberDetails.editModal.fields.expiryDate')}
                </label>
                <input
                  type="date"
                  value={editBasicInfoData.expiryDate}
                  onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, expiryDate: e.target.value })}
                  className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Benefits Section */}
              <div className="col-span-2 md:col-span-3 border-t pt-3 mt-1">
                <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">البينفيتس والجلسات المجانية</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      ⚖️ {t('memberDetails.editModal.fields.inBodyScans')}
                    </label>
                    <input
                      type="number"
                      value={editBasicInfoData.inBodyScans || ''}
                      onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, inBodyScans: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">
                      🎟️ {t('memberDetails.editModal.fields.invitations')}
                    </label>
                    <input
                      type="number"
                      value={editBasicInfoData.invitations || ''}
                      onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, invitations: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">
                      💪 {t('memberDetails.editModal.fields.freePTSessions')}
                    </label>
                    <input
                      type="number"
                      value={editBasicInfoData.freePTSessions || ''}
                      onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, freePTSessions: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  {settings.nutritionEnabled && (
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        🥗 جلسات تغذية مجانية
                      </label>
                      <input
                        type="number"
                        value={editBasicInfoData.freeNutritionSessions || ''}
                        onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, freeNutritionSessions: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium mb-1">
                      🏥 جلسات علاج طبيعي مجانية
                    </label>
                    <input
                      type="number"
                      value={editBasicInfoData.freePhysioSessions || ''}
                      onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, freePhysioSessions: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  {settings.groupClassEnabled && (
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        🏋️ جلسات كلاسات جماعية مجانية
                      </label>
                      <input
                        type="number"
                        value={editBasicInfoData.freeGroupClassSessions || ''}
                        onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, freeGroupClassSessions: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                  )}

                  {settings.poolEnabled && (
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        🏊 جلسات حمام سباحة مجانية
                      </label>
                      <input
                        type="number"
                        value={editBasicInfoData.freePoolSessions || ''}
                        onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, freePoolSessions: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                  )}

                  {settings.padelEnabled && (
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        🎾 جلسات بادل مجانية
                      </label>
                      <input
                        type="number"
                        value={editBasicInfoData.freePadelSessions || ''}
                        onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, freePadelSessions: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                  )}

                  {settings.assessmentEnabled && (
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        📋 جلسات تقييم مجانية
                      </label>
                      <input
                        type="number"
                        value={editBasicInfoData.freeAssessmentSessions || ''}
                        onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, freeAssessmentSessions: parseInt(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium mb-1">
                      ➕ جلسات إضافية مجانية
                    </label>
                    <input
                      type="number"
                      value={editBasicInfoData.freeMoreSessions || ''}
                      onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, freeMoreSessions: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">
                      ❄️ أيام الفريز
                    </label>
                    <input
                      type="number"
                      value={editBasicInfoData.remainingFreezeDays || ''}
                      onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, remainingFreezeDays: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1 text-orange-600 dark:text-orange-400">
                      💰 الباقي على العضو
                    </label>
                    <input
                      type="number"
                      value={editBasicInfoData.remainingAmount === 0 ? '' : editBasicInfoData.remainingAmount}
                      onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, remainingAmount: parseInt(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 border-2 border-orange-300 dark:border-orange-600 rounded text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:border-orange-500"
                      placeholder="0 (لا يوجد باقي)"
                      min="0"
                    />
                  </div>

                  {editBasicInfoData.remainingAmount > 0 && (
                    <div>
                      <label className="block text-xs font-medium mb-1 text-orange-600 dark:text-orange-400">
                        📅 موعد سداد الباقي
                      </label>
                      <input
                        type="date"
                        value={editBasicInfoData.remainingDueDate}
                        onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, remainingDueDate: e.target.value })}
                        className="w-full px-2 py-1.5 border-2 border-orange-300 dark:border-orange-600 rounded text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Coach Selector */}
              {settings.ptCommissionEnabled && (
                <div className="col-span-2 md:col-span-3 border-t pt-3 mt-1">
                  <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">👨‍🏫 الكوتش المسؤول</h4>
                  <CoachSelector
                    value={editBasicInfoData.coachId}
                    onChange={(coachId) => setEditBasicInfoData({ ...editBasicInfoData, coachId })}
                    required={false}
                  />
                </div>
              )}

              {/* Sales Staff Selector */}
              <div className="col-span-2 md:col-span-3 border-t pt-3 mt-1">
                <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">💼 {locale === 'ar' ? 'موظف السيلز' : 'Sales Staff'}</h4>
                <SalesStaffSelector
                  value={editBasicInfoData.salesStaffId}
                  onChange={(salesStaffId) => setEditBasicInfoData({ ...editBasicInfoData, salesStaffId })}
                />
              </div>

              <div className="col-span-2 md:col-span-3">
                <label className="block text-xs font-medium mb-1">
                  📝 {t('memberDetails.editModal.fields.additionalNotes')}
                </label>
                <textarea
                  value={editBasicInfoData.notes}
                  onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, notes: e.target.value })}
                  className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder={t('memberDetails.editModal.fields.notesPlaceholder')}
                  rows={2}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4 pt-3 border-t">
              <button
                type="button"
                onClick={handleEditBasicInfo}
                disabled={loading || !editBasicInfoData.name.trim() || !editBasicInfoData.phone.trim()}
                className="flex-1 bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 font-bold text-sm"
              >
                {loading ? t('memberDetails.editModal.buttons.saving') : `✅ ${t('memberDetails.editModal.buttons.save')}`}
              </button>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold text-sm"
              >
                {t('memberDetails.editModal.buttons.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: إدخال تفاصيل الضيف (الدعوة) */}
      {activeModal === 'invitation' && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setActiveModal(null)
              setInvitationData({ guestName: '', guestPhone: '', notes: '', salesStaffId: '' })
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()} dir={direction}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <span>🎟️</span>
                <span>{t('memberDetails.invitationModal.title')}</span>
              </h3>
              <button
                onClick={() => {
                  setActiveModal(null)
                  setInvitationData({ guestName: '', guestPhone: '', notes: '', salesStaffId: '' })
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-3xl leading-none"
                type="button"
              >
                ×
              </button>
            </div>

            <div className={`bg-primary-50 dark:bg-primary-900/30 ${direction === 'rtl' ? 'border-r-4' : 'border-l-4'} border-primary-500 dark:border-primary-400 p-4 rounded-lg mb-6`}>
              <p className="font-bold text-primary-800 dark:text-primary-200">
                {t('memberDetails.invitationModal.memberLabel', { name: member.name, number: member.memberNumber?.toString() || 'Other' })}
              </p>
              <p className="text-sm text-primary-700 dark:text-primary-300 mt-1">
                {t('memberDetails.invitationModal.invitationsRemaining', { count: (member.invitations ?? 0).toString() })}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('memberDetails.invitationModal.guestName')} <span className="text-red-600 dark:text-red-400">{t('memberDetails.invitationModal.required')}</span>
                </label>
                <input
                  type="text"
                  value={invitationData.guestName}
                  onChange={(e) => setInvitationData({ ...invitationData, guestName: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:border-primary-500 dark:focus:border-primary-400"
                  placeholder={t('memberDetails.invitationModal.guestNamePlaceholder')}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('memberDetails.invitationModal.guestPhone')} <span className="text-red-600 dark:text-red-400">{t('memberDetails.invitationModal.required')}</span>
                </label>
                <input
                  type="tel"
                  value={invitationData.guestPhone}
                  onChange={(e) => setInvitationData({ ...invitationData, guestPhone: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 font-mono"
                  placeholder={t('memberDetails.invitationModal.guestPhonePlaceholder')}
                  dir="ltr"
                />
              </div>

              {invitationSalesStaff.length > 0 && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-100 mb-2">
                    💼 موظف السيلز المسؤول
                  </label>
                  <select
                    value={invitationData.salesStaffId}
                    onChange={(e) => setInvitationData({ ...invitationData, salesStaffId: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:border-primary-500 dark:focus:border-primary-400"
                  >
                    <option value="">— بدون تعيين (تلقائي) —</option>
                    {invitationSalesStaff.map(s => {
                      const isLeast = s.id === [...invitationSalesStaff].sort((a, b) => a.leadsCount - b.leadsCount)[0]?.id
                      return (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.leadsCount} ليد){isLeast ? ' ✨ مقترح' : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('memberDetails.invitationModal.notes')}</label>
                <textarea
                  value={invitationData.notes}
                  onChange={(e) => setInvitationData({ ...invitationData, notes: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:border-primary-500 dark:focus:border-primary-400"
                  rows={3}
                  placeholder={t('memberDetails.invitationModal.notesPlaceholder')}
                />
              </div>

              <div className="bg-green-50 dark:bg-green-900/30 border-2 border-green-300 dark:border-green-700 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                  <span className="text-xl">✅</span>
                  <div>
                    <p className="font-semibold">{t('memberDetails.invitationModal.actionsSummary')}</p>
                    <p className="text-sm">{t('memberDetails.invitationModal.action1')}</p>
                    <p className="text-sm">{t('memberDetails.invitationModal.action2')}</p>
                    <p className="text-sm">{t('memberDetails.invitationModal.action3')}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleSubmitInvitation}
                  disabled={loading || !invitationData.guestName.trim() || !invitationData.guestPhone.trim()}
                  className="flex-1 bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 font-bold"
                >
                  {loading ? t('memberDetails.invitationModal.saving') : `✅ ${t('memberDetails.invitationModal.registerInvitation')}`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null)
                    setInvitationData({ guestName: '', guestPhone: '', notes: '', salesStaffId: '' })
                  }}
                  className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  {t('memberDetails.invitationModal.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Freeze Modal */}
      {activeModal === 'freeze' && member && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6" dir={direction}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold dark:text-gray-100">❄️ {t('memberDetails.freezeModal.title')}</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-gray-400 dark:text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:text-gray-300 text-3xl"
              >
                ×
              </button>
            </div>

            <div className={`bg-cyan-50 dark:bg-cyan-900/20 ${direction === 'rtl' ? 'border-r-4' : 'border-l-4'} border-cyan-500 dark:border-cyan-700 p-4 rounded-lg mb-4`}>
              <p className="text-sm text-cyan-800 dark:text-cyan-300 mb-2">
                ❄️ {t('memberDetails.freezeModal.availableFreezeDays')}: <strong className="text-xl">{member.remainingFreezeDays} {t('common.day')}</strong>
              </p>
              <p className="text-xs text-cyan-600 dark:text-cyan-400">{t('memberDetails.freezeModal.canUseInBatches')}</p>
            </div>

            <div className={`bg-primary-50 dark:bg-primary-900/20 ${direction === 'rtl' ? 'border-r-4' : 'border-l-4'} border-primary-500 dark:border-primary-700 p-4 rounded-lg mb-6`}>
              <p className="text-sm text-primary-800 dark:text-primary-300 mb-2">
                {t('memberDetails.freezeModal.currentExpiryDate')}: <strong>{formatDateYMD(member.expiryDate)}</strong>
              </p>
              {daysRemaining !== null && (
                <p className="text-sm text-primary-800 dark:text-primary-300">
                  {t('memberDetails.freezeModal.remainingDays')}: <strong>{daysRemaining > 0 ? daysRemaining : 0} {t('common.day')}</strong>
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 dark:text-gray-300">
                  {t('memberDetails.freezeModal.freezeDays')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  value={freezeData.days}
                  onChange={(e) => setFreezeData({ ...freezeData, days: parseInt(e.target.value) || 0 })}
                  min="1"
                  max={member.remainingFreezeDays}
                  className="w-full px-4 py-3 border-2 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white text-xl"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1">
                  {t('memberDetails.freezeModal.canFreezeUpTo')} {member.remainingFreezeDays} {t('common.day')}
                </p>
              </div>

              {freezeData.days > 0 && member.expiryDate && (
                <div className="bg-green-50 dark:bg-green-900/30 border-2 border-green-300 dark:border-green-700 rounded-lg p-4">
                  <p className="text-sm text-green-800 dark:text-green-300 mb-2">
                    📅 {t('memberDetails.freezeModal.newExpiryDate')}:
                  </p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    {formatDateYMD(new Date(new Date(member.expiryDate).getTime() + freezeData.days * 24 * 60 * 60 * 1000))}
                  </p>
                  <div className="mt-3 pt-3 border-t border-green-300 dark:border-green-700">
                    <p className="text-xs text-green-700 dark:text-green-400">
                      ✅ {t('memberDetails.freezeModal.willFreeze')} {freezeData.days} {t('common.day')}
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-400">
                      ❄️ {t('memberDetails.freezeModal.remainingBalance')}: {member.remainingFreezeDays - freezeData.days} {t('common.day')}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleFreeze}
                  disabled={loading || freezeData.days <= 0 || freezeData.days > member.remainingFreezeDays}
                  className="flex-1 bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 font-bold"
                >
                  {loading ? t('common.processing') : `✅ ${t('memberDetails.freezeModal.confirmFreeze')}`}
                </button>
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ban Modal */}
      {activeModal === 'ban' && member && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" dir={direction}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-gray-800 p-3 rounded-full">
                <span className="text-3xl">🚫</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  {locale === 'ar' ? 'حظر العضو' : 'Ban Member'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{member.name} - {member.memberNumber !== null ? `#${member.memberNumber}` : 'Other'}</p>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                {locale === 'ar' ? 'سبب الحظر' : 'Ban Reason'} <span className="text-red-500">*</span>
              </label>
              <textarea
                value={banReason}
                onChange={e => setBanReason(e.target.value)}
                autoFocus
                rows={3}
                className="w-full px-4 py-3 border-2 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:border-red-500 resize-none text-sm"
                placeholder={locale === 'ar' ? 'أدخل سبب الحظر...' : 'Enter ban reason...'}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleConfirmBan}
                disabled={!banReason.trim() || loading}
                className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors"
              >
                🚫 {locale === 'ar' ? 'تأكيد الحظر' : 'Confirm Ban'}
              </button>
              <button
                onClick={() => setActiveModal(null)}
                className="px-6 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 rounded-xl font-medium transition-colors"
              >
                {locale === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fitness Test Modals */}
      {activeModal === 'fitness-test-coach-select' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold mb-4 text-center">اختيار المدرب</h3>
            <select
              value={selectedCoachId}
              onChange={(e) => setSelectedCoachId(e.target.value)}
              className="w-full px-4 py-3 border-2 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white mb-4 text-lg"
            >
              <option value="">-- اختر المدرب --</option>
              {coaches.map(coach => (
                <option key={coach.id} value={coach.id}>{coach.name}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  if (selectedCoachId) {
                    setLoading(true)
                    try {
                      const response = await fetch('/api/fitness-test-requests', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          memberId: memberId,
                          coachId: selectedCoachId,
                        }),
                      })

                      if (response.ok) {
                        toast.success('تم إرسال الطلب للمدرب بنجاح!')
                        setActiveModal(null)
                        setSelectedCoachId('')
                      } else {
                        const result = await response.json()
                        toast.error(result.error || 'فشل إرسال الطلب')
                      }
                    } catch (error) {
                      console.error('Error:', error)
                      toast.error('حدث خطأ في إرسال الطلب')
                    } finally {
                      setLoading(false)
                    }
                  }
                }}
                disabled={!selectedCoachId || loading}
                className="flex-1 bg-teal-600 text-white py-3 rounded-lg disabled:bg-gray-400"
              >
                {loading ? 'جاري الإرسال...' : 'إرسال الطلب'}
              </button>
              <button
                onClick={() => setActiveModal(null)}
                className="px-6 bg-gray-200 dark:bg-gray-700 py-3 rounded-lg"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'fitness-test-form' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="sticky top-0 bg-white dark:bg-gray-800 pb-4 border-b mb-6 z-10">
              <h3 className="text-2xl font-bold text-center">📋 نموذج تقييم اللياقة</h3>
            </div>

            <div className="bg-primary-50 p-4 rounded-lg mb-6">
              <h4 className="font-bold mb-3 text-lg">معلومات العضو</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">رقم العضوية</p>
                  <p className="font-bold text-lg">{member?.memberNumber !== null ? `#${member?.memberNumber}` : 'Other'}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">الاسم</p>
                  <p className="font-bold text-lg">{member?.name}</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">الهاتف</p>
                  <p className="font-bold text-lg">{member?.phone}</p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block font-bold mb-2 text-lg">تاريخ الاختبار</label>
              <input
                type="date"
                value={fitnessTestForm.testDate}
                onChange={(e) => setFitnessTestForm({...fitnessTestForm, testDate: e.target.value})}
                className="w-full px-4 py-3 border-2 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white text-lg"
              />
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg mb-6 dark:bg-yellow-900/20">
              <h4 className="font-bold mb-4 text-lg">الأسئلة الطبية</h4>
              <div className="space-y-3">
                {[
                  { key: 'firstTimeGym', label: 'هل هذه أول مرة في النادي؟' },
                  { key: 'inDietPlan', label: 'هل أنت على نظام غذائي؟' },
                  { key: 'hernia', label: 'هل تعاني من فتق أو أي حالة قد تتفاقم بسبب رفع الأثقال؟' },
                  { key: 'familyHeartHistory', label: 'هل يوجد تاريخ عائلي لأمراض القلب؟' },
                  { key: 'heartProblem', label: 'هل لديك أي مشاكل في القلب؟' },
                  { key: 'backPain', label: 'هل تعاني من آلام في الظهر؟' },
                  { key: 'surgery', label: 'هل أجريت أي عملية جراحية؟' },
                  { key: 'breathingProblems', label: 'هل لديك تاريخ من مشاكل التنفس أو الرئة؟' },
                  { key: 'bloodPressure', label: 'هل تعاني من ضغط الدم؟' },
                  { key: 'kneeProblem', label: 'هل لديك مشاكل في الركبة؟' },
                  { key: 'diabetes', label: 'هل تعاني من السكري؟' },
                  { key: 'smoker', label: 'هل أنت مدخن؟' },
                  { key: 'highCholesterol', label: 'هل لديك مستوى عالي من الكوليسترول؟' },
                ].map((q) => (
                  <label key={q.key} className="flex items-center gap-3 cursor-pointer hover:bg-yellow-100 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={fitnessTestForm.medicalQuestions[q.key as any]}
                      onChange={(e) => setFitnessTestForm({
                        ...fitnessTestForm,
                        medicalQuestions: {
                          ...fitnessTestForm.medicalQuestions,
                          [q.key]: e.target.checked
                        }
                      })}
                      className="w-5 h-5"
                    />
                    <span className="text-base">{q.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg mb-6 dark:bg-orange-900/20">
              <div className="flex items-center justify-between">
                <span className="font-bold text-lg">حصص PT المجانية للعضو</span>
                <span className="text-4xl font-bold text-orange-600">
                  {member?.freePTSessions || 0}
                </span>
              </div>
            </div>

            <div className="bg-primary-50 p-4 rounded-lg mb-6">
              <h4 className="font-bold mb-4 text-lg">اختبار المرونة</h4>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'shoulder', label: 'الكتف (Shoulder)' },
                  { key: 'hip', label: 'الورك (Hip)' },
                  { key: 'elbow', label: 'الكوع (Elbow)' },
                  { key: 'wrist', label: 'المعصم (Wrist)' },
                  { key: 'spine', label: 'العمود الفقري (Spine)' },
                  { key: 'scapula', label: 'لوح الكتف (Scapula)' },
                  { key: 'knee', label: 'الركبة (Knee)' },
                  { key: 'ankle', label: 'الكاحل (Ankle)' },
                ].map((part) => (
                  <div key={part.key}>
                    <label className="block font-medium mb-2">{part.label}</label>
                    <select
                      value={fitnessTestForm.flexibility[part.key as any]}
                      onChange={(e) => setFitnessTestForm({
                        ...fitnessTestForm,
                        flexibility: {...fitnessTestForm.flexibility, [part.key]: e.target.value}
                      })}
                      className="w-full px-3 py-2 border-2 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="FAIR">Fair</option>
                      <option value="GOOD">Good</option>
                      <option value="EXCELLENT">Excellent</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg mb-6 dark:bg-green-900/20">
              <h4 className="font-bold mb-4 text-lg">اختبار التمارين</h4>
              <div className="space-y-4">
                {[
                  { key: 'pushup', label: 'الضغط (Push up)' },
                  { key: 'situp', label: 'البطن (Sit-up)' },
                  { key: 'pullup', label: 'العقلة (Pull up)' },
                  { key: 'squat', label: 'القرفصاء (Squat)' },
                  { key: 'plank', label: 'البلانك (Plank)' },
                  { key: 'legpress', label: 'ضغط الأرجل (Leg press)' },
                  { key: 'chestpress', label: 'ضغط الصدر (Chest press)' },
                ].map((ex) => (
                  <div key={ex.key} className="flex items-center gap-4">
                    <div className="w-48 font-medium">{ex.label}</div>
                    <input
                      type="number"
                      placeholder="Sets"
                      value={fitnessTestForm.exercises[ex.key as any].sets}
                      onChange={(e) => setFitnessTestForm({
                        ...fitnessTestForm,
                        exercises: {
                          ...fitnessTestForm.exercises,
                          [ex.key]: {...fitnessTestForm.exercises[ex.key as any], sets: parseInt(e.target.value) || 0}
                        }
                      })}
                      className="w-24 px-3 py-2 border-2 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      min="0"
                    />
                    <span>×</span>
                    <input
                      type="number"
                      placeholder="Reps"
                      value={fitnessTestForm.exercises[ex.key as any].reps}
                      onChange={(e) => setFitnessTestForm({
                        ...fitnessTestForm,
                        exercises: {
                          ...fitnessTestForm.exercises,
                          [ex.key]: {...fitnessTestForm.exercises[ex.key as any], reps: parseInt(e.target.value) || 0}
                        }
                      })}
                      className="w-24 px-3 py-2 border-2 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      min="0"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="sticky bottom-0 bg-white dark:bg-gray-800 pt-4 border-t flex gap-3">
              <button
                onClick={handleSubmitFitnessTest}
                disabled={loading}
                className="flex-1 bg-teal-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-teal-700 disabled:bg-gray-400"
              >
                {loading ? 'جاري الحفظ...' : 'حفظ الاختبار'}
              </button>
              <button
                onClick={() => setActiveModal(null)}
                className="px-8 bg-gray-200 dark:bg-gray-700 py-4 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'view-fitness-test' && fitnessTestData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="sticky top-0 bg-white dark:bg-gray-800 pb-4 border-b mb-6">
              <h3 className="text-2xl font-bold text-center">📋 عرض اختبار اللياقة</h3>
              <p className="text-center text-gray-600 dark:text-gray-300 mt-2">تم إنشاؤه بواسطة: {fitnessTestData.coachName}</p>
            </div>

            <div className="space-y-6">
              <div className="bg-primary-50 p-4 rounded-lg">
                <h4 className="font-bold mb-3">معلومات العضو</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-300">رقم العضوية</p>
                    <p className="font-bold">{fitnessTestData.memberNumber ? `#${fitnessTestData.memberNumber}` : 'Other'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-300">الاسم</p>
                    <p className="font-bold">{fitnessTestData.memberName}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-300">تاريخ الاختبار</p>
                    <p className="font-bold">{new Date(fitnessTestData.testDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}</p>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 p-4 rounded-lg dark:bg-orange-900/20">
                <div className="flex items-center justify-between">
                  <span className="font-bold">حصص PT المجانية</span>
                  <span className="text-3xl font-bold text-orange-600">{fitnessTestData.freePTSessions}</span>
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg dark:bg-yellow-900/20">
                <h4 className="font-bold mb-3">الحالة الطبية</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(fitnessTestData.medicalQuestions).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span>{value ? '✅' : '❌'}</span>
                      <span className="text-gray-700 dark:text-gray-200">{key}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-primary-50 p-4 rounded-lg">
                <h4 className="font-bold mb-3">تقييم المرونة</h4>
                <div className="grid grid-cols-4 gap-3 text-sm">
                  {Object.entries(fitnessTestData.flexibility).map(([key, value]) => (
                    <div key={key} className="bg-white dark:bg-gray-800 p-2 rounded">
                      <p className="text-gray-600 dark:text-gray-300 text-xs">{key}</p>
                      <p className="font-bold">{String(value)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg dark:bg-green-900/20">
                <h4 className="font-bold mb-3">نتائج التمارين</h4>
                <div className="space-y-2 text-sm">
                  {Object.entries(fitnessTestData.exercises).map(([key, value]: [string, any]) => (
                    <div key={key} className="flex justify-between bg-white dark:bg-gray-800 p-2 rounded">
                      <span className="font-medium">{key}</span>
                      <span className="font-bold text-green-600">{value.sets} × {value.reps}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white dark:bg-gray-800 pt-4 border-t mt-6">
              <button
                onClick={() => setActiveModal(null)}
                className="w-full bg-gray-600 text-white py-3 rounded-lg font-bold hover:bg-gray-700"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* سجل الحضور */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border-2 border-primary-100" dir={direction}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-primary-500 to-primary-600 p-3 rounded-lg">
              <span className="text-3xl">📊</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{t('memberDetails.attendanceLog.title')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('memberDetails.attendanceLog.subtitle')}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gradient-to-br from-gray-50 to-primary-50 dark:from-gray-800 dark:to-primary-900/30 p-5 rounded-xl mb-6 border border-primary-200 dark:border-primary-700">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">🔍 {t('memberDetails.attendanceLog.filterByPeriod')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{t('memberDetails.attendanceLog.dateFrom')}</label>
              <input
                type="date"
                value={attendanceStartDate}
                onChange={(e) => setAttendanceStartDate(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 transition dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{t('memberDetails.attendanceLog.dateTo')}</label>
              <input
                type="date"
                value={attendanceEndDate}
                onChange={(e) => setAttendanceEndDate(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 transition dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchAttendanceHistory}
                disabled={attendanceLoading}
                className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-2 rounded-lg hover:from-primary-700 hover:to-primary-800 disabled:bg-gray-400 font-semibold shadow-md transition-all transform hover:scale-105"
              >
                {attendanceLoading ? `⏳ ${t('memberDetails.attendanceLog.loading')}` : `✓ ${t('memberDetails.attendanceLog.applyFilter')}`}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {attendanceLoading ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">⏳</div>
            <p className="text-gray-600 dark:text-gray-300">{t('memberDetails.attendanceLog.loadingData')}</p>
          </div>
        ) : attendanceHistory.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-xl text-gray-600 dark:text-gray-300">{t('memberDetails.attendanceLog.noRecordsForPeriod')}</p>
          </div>
        ) : (
          <>
            {/* إحصائيات سريعة */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-900/40 p-4 rounded-lg border-2 border-primary-200 dark:border-primary-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-primary-600 dark:text-primary-300 text-sm font-semibold mb-1">{t('memberDetails.attendanceLog.totalVisits')}</p>
                    <p className="text-3xl font-bold text-primary-700 dark:text-primary-400">{attendanceHistory.length}</p>
                  </div>
                  <div className="text-4xl opacity-50">📊</div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/40 p-4 rounded-lg border-2 border-green-200 dark:border-green-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-600 dark:text-green-300 text-sm font-semibold mb-1">{t('memberDetails.attendanceLog.lastVisit')}</p>
                    <p className="text-lg font-bold text-green-700 dark:text-green-400">
                      {new Date(attendanceHistory[0].checkInTime).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <div className="text-4xl opacity-50">📅</div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-primary-500 to-primary-600">
                <tr>
                  <th className={`px-6 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} text-white font-bold`}>#</th>
                  <th className={`px-6 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} text-white font-bold`}>{t('memberDetails.attendanceLog.date')}</th>
                  <th className={`px-6 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} text-white font-bold`}>{t('memberDetails.attendanceLog.checkInTime')}</th>
                </tr>
              </thead>
              <tbody>
                {attendanceHistory.map((checkIn, index) => {
                  const checkInTime = new Date(checkIn.checkInTime)

                  return (
                    <tr key={checkIn.id} className="border-t hover:bg-primary-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-700 dark:text-gray-200">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-700 dark:text-gray-200">
                          {checkInTime.toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-primary-100 text-primary-700 px-3 py-1 rounded-lg font-bold text-sm">
                          {checkInTime.toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* سجل المتابعات */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📋</span>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {locale === 'ar' ? 'سجل المتابعات' : 'Follow-up History'}
            </h3>
          </div>
          <button
            onClick={() => {
              if (!showFollowUpHistory) {
                fetchFollowUpHistory()
              }
              setShowFollowUpHistory(v => !v)
            }}
            className="text-sm px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            {showFollowUpHistory ? (locale === 'ar' ? 'إخفاء' : 'Hide') : (locale === 'ar' ? 'عرض' : 'Show')}
          </button>
        </div>

        {showFollowUpHistory && (
          followUpHistoryLoading ? (
            <div className="text-center py-8 text-gray-500">
              <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-2" />
              {locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}
            </div>
          ) : followUpHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p className="text-3xl mb-2">📭</p>
              <p>{locale === 'ar' ? 'لا يوجد سجل متابعات لهذا العضو' : 'No follow-up history for this member'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {followUpHistory.map((fu: any) => {
                const RESULT_COLORS: Record<string, string> = {
                  interested: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
                  'not-interested': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                  postponed: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
                  subscribed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                }
                const resultColor = fu.result ? (RESULT_COLORS[fu.result] || 'bg-gray-100 text-gray-600') : 'bg-gray-100 text-gray-500'
                return (
                  <div key={fu.id} className={`rounded-lg p-4 border ${fu.archived ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30' : 'border-primary-200 dark:border-primary-700 bg-primary-50/30 dark:bg-primary-900/10'}`}>
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(fu.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
                          </span>
                          {fu.salesName && (
                            <span className="text-xs text-gray-600 dark:text-gray-400">· {fu.salesName}</span>
                          )}
                          {fu.assignedStaff && (
                            <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full">
                              👤 {fu.assignedStaff.name}
                            </span>
                          )}
                          {fu.archived && (
                            <span className="text-xs bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400 px-2 py-0.5 rounded-full">
                              {fu.archivedReason === 'converted' ? (locale === 'ar' ? '✅ اشترك' : '✅ Converted') : (locale === 'ar' ? 'مؤرشف' : 'Archived')}
                            </span>
                          )}
                        </div>
                        {fu.notes && <p className="text-sm text-gray-700 dark:text-gray-300">{fu.notes}</p>}
                      </div>
                      {fu.result && (
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${resultColor}`}>
                          {fu.result === 'interested' ? (locale === 'ar' ? 'مهتم' : 'Interested')
                            : fu.result === 'not-interested' ? (locale === 'ar' ? 'غير مهتم' : 'Not Interested')
                            : fu.result === 'postponed' ? (locale === 'ar' ? 'مؤجل' : 'Postponed')
                            : fu.result === 'subscribed' ? (locale === 'ar' ? 'اشترك' : 'Subscribed')
                            : fu.result}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>

      {/* نموذج التجديد */}
      {showRenewalForm && (
        <RenewalForm
          member={member}
          onSuccess={(receipt?: Receipt) => {
            if (receipt) {
              setReceiptData({
                receiptNumber: receipt.receiptNumber,
                type: t('renewall.membershipRenewal'),
                amount: receipt.amount,
                details: receipt.itemDetails,
                date: new Date(receipt.createdAt),
                paymentMethod: receipt.paymentMethod || 'cash'
              })
              setShowReceipt(true)
              setLastReceiptNumber(receipt.receiptNumber)
              queryClient.invalidateQueries({ queryKey: ['receipts'] })
            }

            fetchMember()
            setShowRenewalForm(false)
            toast.success(t('renewall.renewalSuccessMessage'))
          }}
          onClose={() => setShowRenewalForm(false)}
        />
      )}

      {/* نموذج الترقية */}
      {showUpgradeForm && member && (
        <UpgradeForm
          member={member}
          onSuccess={() => {
            setShowUpgradeForm(false)
            fetchMember()
            toast.success(t('upgrade.upgradeSuccess'))
          }}
          onClose={() => setShowUpgradeForm(false)}
        />
      )}

      {/* الإيصال */}
      {showReceipt && receiptData && (
        <ReceiptToPrint
          receiptNumber={receiptData.receiptNumber}
          type={receiptData.type}
          amount={receiptData.amount}
          details={receiptData.details}
          date={receiptData.date}
          paymentMethod={receiptData.paymentMethod}
          onClose={() => setShowReceipt(false)}
        />
      )}

      {/* Member Receipts Modal */}
      {showReceiptsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" dir={direction}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-600 to-yellow-600 text-white p-6 rounded-t-lg">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span>🧾</span>
                <span>{locale === 'ar' ? 'سجل الإيصالات' : 'Receipts History'}</span>
              </h2>
              <p className="text-orange-100 mt-1">{member?.name} - {member?.memberNumber != null ? `#${member.memberNumber}` : (locale === 'ar' ? 'بدون عضوية' : 'Non-Member')}</p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {receiptsLoading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin text-6xl mb-4">⏳</div>
                  <p className="text-xl text-gray-600 dark:text-gray-300">{locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
                </div>
              ) : memberReceipts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400 text-xl">
                    {locale === 'ar' ? 'لا توجد إيصالات' : 'No receipts found'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {memberReceipts.map((receipt) => {
                    const itemDetails = JSON.parse(receipt.itemDetails)
                    return (
                      <div
                        key={receipt.id}
                        className="bg-gradient-to-r from-gray-50 to-white dark:from-gray-700 dark:to-gray-750 border-2 border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-3 py-1 rounded-full text-sm font-bold">
                                #{receipt.receiptNumber}
                              </span>
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                receipt.isCancelled
                                  ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                                  : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                              }`}>
                                {receipt.isCancelled
                                  ? (locale === 'ar' ? '❌ ملغي' : '❌ Cancelled')
                                  : (locale === 'ar' ? '✓ نشط' : '✓ Active')
                                }
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'المبلغ:' : 'Amount:'}</span>
                                <span className="font-bold text-green-600 dark:text-green-400 mr-2">{receipt.amount} {t('memberDetails.egp')}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'الطريقة:' : 'Method:'}</span>
                                <span className="font-semibold dark:text-gray-200 mr-2">
                                  {receipt.paymentMethod === 'cash' ? (locale === 'ar' ? 'كاش 💵' : 'Cash 💵')
                                    : receipt.paymentMethod === 'visa' ? (locale === 'ar' ? 'فيزا 💳' : 'Visa 💳')
                                    : receipt.paymentMethod === 'instapay' ? (locale === 'ar' ? 'إنستاباي 📱' : 'Instapay 📱')
                                    : (locale === 'ar' ? 'محفظة 💰' : 'Wallet 💰')
                                  }
                                </span>
                              </div>
                              {itemDetails.packageType && (
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'الباقة:' : 'Package:'}</span>
                                  <span className="font-semibold dark:text-gray-200 mr-2">{itemDetails.packageType}</span>
                                </div>
                              )}
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'التاريخ:' : 'Date:'}</span>
                                <span className="font-mono text-xs dark:text-gray-200 mr-2">
                                  {new Date(receipt.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            </div>
                            {itemDetails.startDate && itemDetails.expiryDate && (
                              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                <div className="text-xs text-gray-600 dark:text-gray-300">
                                  <span className="font-semibold">{locale === 'ar' ? 'الفترة:' : 'Period:'}</span>
                                  <span className="font-mono mr-2">
                                    {new Date(itemDetails.startDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                  </span>
                                  <span className="mx-1">→</span>
                                  <span className="font-mono">
                                    {new Date(itemDetails.expiryDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {locale === 'ar' ? 'إجمالي الإيصالات:' : 'Total Receipts:'} <span className="font-bold">{memberReceipts.length}</span>
              </div>
              <button
                onClick={() => {
                  setShowReceiptsModal(false)
                  setMemberReceipts([])
                }}
                className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Points History Modal */}
      {showPointsHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" dir={direction}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white p-6 rounded-t-lg">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span>🏆</span>
                <span>{t('memberDetails.pointsHistory')}</span>
              </h2>
              <p className="text-yellow-100 mt-1">{member?.name} - {member?.memberNumber != null ? `#${member.memberNumber}` : (locale === 'ar' ? 'بدون عضوية' : 'Non-Member')}</p>
              <p className="text-yellow-100 text-sm mt-1">
                {t('memberDetails.totalPoints')}: <span className="font-bold text-white">{member?.points ?? 0}</span>
              </p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {pointsLoading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin text-6xl mb-4">⏳</div>
                  <p className="text-xl text-gray-600 dark:text-gray-300">{t('common.loading')}</p>
                </div>
              ) : pointsHistory.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🏆</div>
                  <p className="text-gray-500 dark:text-gray-400 text-xl">{t('memberDetails.noPointsHistory')}</p>
                  <p className="text-gray-400 dark:text-gray-500 dark:text-gray-400 text-sm mt-2">{t('memberDetails.pointsWillAppear')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pointsHistory.map((entry: any) => (
                    <div
                      key={entry.id}
                      className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-yellow-200 dark:border-yellow-700 rounded-lg p-4 hover:shadow-md transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">
                              {entry.action === 'check-in' ? '✅' : entry.action === 'manual' ? '✏️' : '🎁'}
                            </span>
                            <span className="font-bold text-gray-800 dark:text-gray-100">
                              {entry.action === 'check-in'
                                ? t('memberDetails.checkInPoints')
                                : entry.action === 'manual'
                                ? t('memberDetails.manualEdit')
                                : t('memberDetails.invitationPoints')}
                            </span>
                          </div>
                          {entry.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{entry.description}</p>
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(entry.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <div className={direction === 'rtl' ? 'text-right' : 'text-left'}>
                          <div className={`${entry.points >= 0 ? 'bg-green-500 dark:bg-green-600' : 'bg-red-500 dark:bg-red-600'} text-white px-4 py-2 rounded-lg shadow-md`}>
                            <p className="text-2xl font-bold">{entry.points >= 0 ? '+' : ''}{entry.points}</p>
                            <p className="text-xs opacity-90">{t('memberDetails.points')}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
              <button
                onClick={() => {
                  setShowPointsHistory(false)
                  setPointsHistory([])
                }}
                className="w-full bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-bold"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Points Modal */}
      {showAddPointsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" dir={direction}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white p-6 rounded-t-lg">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span>✏️</span>
                <span>{t('memberDetails.addRemovePoints')}</span>
              </h2>
              <p className="text-yellow-100 mt-1">{member?.name} - {member?.memberNumber != null ? `#${member.memberNumber}` : (locale === 'ar' ? 'بدون عضوية' : 'Non-Member')}</p>
              <p className="text-yellow-100 text-sm mt-1">
                {t('memberDetails.currentBalance')}: <span className="font-bold text-white">{member?.points ?? 0}</span> {t('memberDetails.point')}
              </p>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-gray-700 dark:text-gray-200 font-bold mb-2">
                  {t('memberDetails.pointsAmount')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={addPointsData.points}
                  onChange={(e) => setAddPointsData({ ...addPointsData, points: e.target.value })}
                  placeholder={t('memberDetails.enterPointsPlaceholder')}
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-yellow-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('memberDetails.pointsExample')}
                </p>
              </div>

              <div>
                <label className="block text-gray-700 dark:text-gray-200 font-bold mb-2">
                  {t('memberDetails.reason')} <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={addPointsData.reason}
                  onChange={(e) => setAddPointsData({ ...addPointsData, reason: e.target.value })}
                  placeholder={t('memberDetails.enterReasonPlaceholder')}
                  rows={3}
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-yellow-500 focus:outline-none dark:bg-gray-700 dark:text-white resize-none"
                />
              </div>

              {addPointsData.points && !isNaN(parseInt(addPointsData.points)) && parseInt(addPointsData.points) !== 0 && (
                <div className={`p-3 rounded-lg ${parseInt(addPointsData.points) > 0 ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
                  <p className={`text-sm font-semibold ${parseInt(addPointsData.points) > 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                    {parseInt(addPointsData.points) > 0 ? '✅ ' : '❌ '}
                    {t('memberDetails.balanceAfterUpdate')}: {(member?.points ?? 0) + parseInt(addPointsData.points)} {t('memberDetails.point')}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 flex gap-3">
              <button
                onClick={() => {
                  setShowAddPointsModal(false)
                  setAddPointsData({ points: '', reason: '' })
                }}
                className="flex-1 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-bold transition-colors"
              >
                {t('memberDetails.cancel')}
              </button>
              <button
                onClick={handleAddPoints}
                disabled={loading || !addPointsData.points || !addPointsData.reason.trim()}
                className="flex-1 bg-yellow-500 text-white px-6 py-3 rounded-lg hover:bg-yellow-600 font-bold disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? t('memberDetails.saving') : t('memberDetails.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal عرض صور البطاقة الشخصية */}
      {showIdCardModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-primary-500 to-primary-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <span className="text-3xl">🪪</span>
                  <span>{t('memberDetails.idCardModal.title')}</span>
                </h2>
                <button
                  onClick={() => setShowIdCardModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {!member?.idCardFront && !member?.idCardBack ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📭</div>
                  <p className="text-xl text-gray-600 dark:text-gray-300">{t('memberDetails.idCardModal.noImages')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* الوجه الأمامي */}
                  <div className="bg-gradient-to-br from-primary-50 to-primary-100 border-2 border-primary-300 rounded-xl p-4 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-3xl">🆔</span>
                      <h3 className="text-xl font-bold text-primary-900">{t('memberDetails.idCardModal.frontSide')}</h3>
                    </div>

                    {member?.idCardFront ? (
                      <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden border-2 border-primary-200 shadow-lg">
                        <img
                          src={member.idCardFront}
                          alt="Front Side"
                          className="w-full h-auto object-contain cursor-pointer hover:opacity-90 transition"
                          onClick={() => window.open(member.idCardFront, '_blank')}
                        />
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-12 border-2 border-dashed border-primary-300 text-center">
                        <svg className="w-20 h-20 mx-auto mb-3 text-gray-400 dark:text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                        </svg>
                        <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">{t('memberDetails.idCardModal.noFrontImage')}</p>
                      </div>
                    )}
                  </div>

                  {/* الوجه الخلفي */}
                  <div className="bg-gradient-to-br from-primary-50 to-primary-100 border-2 border-primary-300 rounded-xl p-4 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-3xl">🔄</span>
                      <h3 className="text-xl font-bold text-primary-900">{t('memberDetails.idCardModal.backSide')}</h3>
                    </div>

                    {member?.idCardBack ? (
                      <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden border-2 border-primary-200 shadow-lg">
                        <img
                          src={member.idCardBack}
                          alt="Back Side"
                          className="w-full h-auto object-contain cursor-pointer hover:opacity-90 transition"
                          onClick={() => window.open(member.idCardBack, '_blank')}
                        />
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-12 border-2 border-dashed border-primary-300 text-center">
                        <svg className="w-20 h-20 mx-auto mb-3 text-gray-400 dark:text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                        </svg>
                        <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400">{t('memberDetails.idCardModal.noBackImage')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Note */}
              <div className={`mt-6 bg-blue-50 ${direction === 'rtl' ? 'border-r-4' : 'border-l-4'} border-blue-500 p-4 rounded dark:bg-blue-900/20 dark:border-blue-700`}>
                <p className="text-sm text-blue-900">
                  💡 {t('memberDetails.idCardModal.clickToOpen')}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700 dark:bg-gray-700 border-t flex justify-end rounded-b-2xl">
              <button
                onClick={() => setShowIdCardModal(false)}
                className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition"
              >
                {t('memberDetails.idCardModal.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Free Session Modal */}
      {member && freeSessionModal.isOpen && freeSessionModal.serviceType && (
        <FreeSessionModal
          isOpen={freeSessionModal.isOpen}
          serviceType={freeSessionModal.serviceType}
          memberName={member.name}
          memberId={member.id}
          remainingSessions={
            freeSessionModal.serviceType === 'PT' ? member.freePTSessions :
            freeSessionModal.serviceType === 'Nutrition' ? member.freeNutritionSessions :
            freeSessionModal.serviceType === 'Physiotherapy' ? member.freePhysioSessions :
            member.freeGroupClassSessions
          }
          onClose={() => setFreeSessionModal({ isOpen: false, serviceType: null })}
          onSuccess={() => {
            fetchMember()
          }}
        />
      )}

      {/* Barcode WhatsApp Popup */}
      {barcodePopup.show && member && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4"
          style={{ zIndex: 10001 }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6" dir="rtl">

            {/* === حالة التوليد === */}
            {barcodePopup.step === 'generating' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-bold mb-1">جاري إنشاء صورة الباركود...</h3>
                <p className="text-sm text-gray-500">يرجى الانتظار</p>
              </div>
            )}

            {/* === الصورة جاهزة - تأكيد الإرسال === */}
            {barcodePopup.step === 'ready' && barcodePopup.image && (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold shrink-0">✓</div>
                  <h3 className="text-lg font-bold text-green-700 dark:text-green-400">الصورة جاهزة للإرسال</h3>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 border-2 border-green-300 dark:border-green-600 rounded-xl p-4 mb-4 flex justify-center">
                  <img
                    src={barcodePopup.image}
                    alt="Barcode Preview"
                    className="max-w-full h-auto"
                    style={{ maxHeight: '180px' }}
                  />
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-300 text-center mb-4">
                  سيتم إرسال الباركود إلى <span className="font-bold">{member.phone}</span>
                </p>

                <div className="space-y-2">
                  <button
                    onClick={async () => {
                      setBarcodePopup(p => ({ ...p, step: 'sending' }))
                      try {
                        const baseMessage = `Membership Barcode #${member.memberNumber ?? 'Other'} for member ${member.name}`
                        const websiteSection = settings?.showWebsiteOnReceipts && settings?.websiteUrl
                          ? `\n\n🌐 *الموقع الإلكتروني:*\n${settings.websiteUrl}`
                          : ''
                        const caption = baseMessage + websiteSection

                        const sendResult = await fetch('/api/whatsapp/send-image', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            phone: member.phone,
                            imageBase64: barcodePopup.image,
                            caption
                          })
                        })
                        const sendData = await sendResult.json()

                        if (sendData.success) {
                          setBarcodePopup(p => ({ ...p, step: 'success' }))
                          setTimeout(() => {
                            setBarcodePopup({ show: false, step: 'generating', image: '', error: '' })
                          }, 2000)
                        } else {
                          const errorMessage = sendData.error || 'فشل إرسال الصورة'
                          const msg = errorMessage.includes('not ready') || errorMessage.includes('not initialized')
                            ? 'الواتساب غير متصل. افتح الإعدادات → الواتساب لمسح QR code'
                            : errorMessage
                          setBarcodePopup(p => ({ ...p, step: 'error', error: msg }))
                        }
                      } catch (err) {
                        setBarcodePopup(p => ({ ...p, step: 'error', error: 'حدث خطأ أثناء الإرسال' }))
                      }
                    }}
                    className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-bold flex items-center justify-center gap-2 text-lg"
                  >
                    <span>📲</span>
                    <span>إرسال عبر واتساب</span>
                  </button>
                  <button
                    onClick={() => setBarcodePopup({ show: false, step: 'generating', image: '', error: '' })}
                    className="w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold"
                  >
                    إلغاء
                  </button>
                </div>
              </>
            )}

            {/* === جاري الإرسال === */}
            {barcodePopup.step === 'sending' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-bold mb-1">جاري الإرسال عبر واتساب...</h3>
                <p className="text-sm text-gray-500">يرجى الانتظار</p>
                {barcodePopup.image && (
                  <div className="mt-4 opacity-50">
                    <img src={barcodePopup.image} alt="Sending..." className="max-h-24 mx-auto rounded" />
                  </div>
                )}
              </div>
            )}

            {/* === تم الإرسال بنجاح === */}
            {barcodePopup.step === 'success' && (
              <div className="text-center py-6">
                <div className="text-5xl mb-3">✅</div>
                <h3 className="text-xl font-bold text-green-700 dark:text-green-400 mb-2">تم الإرسال بنجاح!</h3>
                <p className="text-sm text-gray-500 mb-1">تم إنشاء الصورة وإرسالها عبر واتساب</p>
                {barcodePopup.image && (
                  <div className="mt-3 mb-4">
                    <img src={barcodePopup.image} alt="Sent" className="max-h-24 mx-auto rounded border-2 border-green-300" />
                  </div>
                )}
                <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 mb-4">
                  <span className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">✓</span>
                  <span className="text-sm font-medium">الصورة جاهزة</span>
                  <span className="mx-1">—</span>
                  <span className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">✓</span>
                  <span className="text-sm font-medium">تم الإرسال</span>
                </div>
                <button
                  onClick={() => setBarcodePopup({ show: false, step: 'generating', image: '', error: '' })}
                  className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-bold"
                >
                  تم
                </button>
              </div>
            )}

            {/* === خطأ === */}
            {barcodePopup.step === 'error' && (
              <div className="text-center py-6">
                <div className="text-5xl mb-3">❌</div>
                <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-3">فشل العملية</h3>
                {barcodePopup.error && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                    <p className="text-sm text-red-700 dark:text-red-300">{barcodePopup.error}</p>
                  </div>
                )}
                <button
                  onClick={() => setBarcodePopup({ show: false, step: 'generating', image: '', error: '' })}
                  className="w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold"
                >
                  إغلاق
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
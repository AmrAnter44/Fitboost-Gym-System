'use client'

import { useState, useEffect, useRef } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { useLanguage } from '@/contexts/LanguageContext'
import { useToast } from '@/contexts/ToastContext'
import { useServiceSettings } from '@/contexts/ServiceSettingsContext'
import { formatDateYMD, calculateDaysBetween } from '@/lib/dateFormatter'
import PaymentMethodSelector from '@/components/Paymentmethodselector'
import type { PaymentMethod as PaymentMethodType } from '@/lib/paymentHelpers'
import { LoadingScreen } from '@/components/Spinner'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

const IconPlus = (
  <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14"/></svg>
)
const IconCheck = (
  <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
)
const IconRefresh = (
  <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M5 19a9 9 0 0014.65-3.36M19 5a9 9 0 00-14.65 3.36"/></svg>
)
const IconWallet = (
  <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-1M16 12h5v4h-5a2 2 0 010-4z"/></svg>
)
const IconEdit = (
  <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.4-9.6a2.121 2.121 0 113 3L12 19l-4 1 1-4 9.6-9.6z"/></svg>
)
const IconTrash = (
  <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>
)
const IconUser = (
  <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M16 14a4 4 0 10-8 0M12 11a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0"/></svg>
)
const IconCalendar = (
  <svg className="w-4 h-4" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
)
const IconSearch = (
  <svg className="w-4 h-4" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"/></svg>
)
const IconClose = (
  <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6"/></svg>
)
const IconFilter = (
  <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M6 12h12M10 20h4"/></svg>
)
const IconChart = (
  <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 14l3-3 4 4 5-5"/></svg>
)
const IconCoach = (
  <svg className="w-4 h-4" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.42a12.083 12.083 0 01.84 4.42c0 4.418-3.582 8-8 8s-8-3.582-8-8c0-1.591.466-3.076 1.27-4.32L12 14z"/></svg>
)
const IconLightbulb = (
  <svg className="w-4 h-4" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.74V17h8v-2.26A7 7 0 0012 2z"/></svg>
)
const IconBolt = (
  <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>
)
const IconSave = (
  <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5h11l3 3v11a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2zm3 0v4h6V5M7 21v-7h10v7"/></svg>
)
const IconSpinner = (
  <svg className="w-5 h-5 animate-spin" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
)

interface More {
  moreNumber: number
  clientName: string
  phone: string
  email?: string
  sessionsPurchased: number
  sessionsRemaining: number
  coachName: string
  coachUserId?: string
  pricePerSession: number
  totalAmount: number
  startDate: string
  expiryDate: string
  remainingAmount: number
  notes?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type PaymentMethod = string | PaymentMethodType[]

export default function MorePage() {
  const { hasPermission, user, loading: authLoading } = usePermissions()
  const { t, direction, locale } = useLanguage()
  const toast = useToast()
  const { settings } = useServiceSettings()

  const [moreSubscriptions, setMoreSubscriptions] = useState<More[]>([])
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<More[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expiring' | 'expired'>('all')
  const [filterCoach, setFilterCoach] = useState('')
  const [filterSessions, setFilterSessions] = useState<'all' | 'low' | 'zero'>('all')

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const [showAddForm, setShowAddForm] = useState(false)
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [showRenewForm, setShowRenewForm] = useState(false)
  const [selectedMore, setSelectedMore] = useState<More | null>(null)

  const [editingMore, setEditingMore] = useState<More | null>(null)
  const [editFormData, setEditFormData] = useState({
    clientName: '',
    phone: '',
    coachName: '',
    sessionsPurchased: 0,
    sessionsRemaining: 0,
    pricePerSession: 0,
    totalAmount: 0,
    remainingAmount: 0,
    startDate: '',
    expiryDate: '',
    notes: ''
  })
  const [editSubmitting, setEditSubmitting] = useState(false)

  const [paymentMore, setPaymentMore] = useState<More | null>(null)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    clientName: '',
    phone: '',
    memberId: '',
    memberNumberDisplay: '',
    sessionsPurchased: '',
    coachName: '',
    coachUserId: '',
    totalPrice: '',
    startDate: formatDateYMD(new Date()),
    expiryDate: '',
    notes: '',
    paymentMethod: 'cash' as string | PaymentMethodType[],
    staffName: ''
  })

  const [sessionFormData, setSessionFormData] = useState({
    moreNumber: '',
    notes: ''
  })

  const [renewFormData, setRenewFormData] = useState({
    oldMoreNumber: '',
    sessionsPurchased: '',
    totalPrice: '',
    startDate: formatDateYMD(new Date()),
    expiryDate: '',
    notes: '',
    paymentMethod: 'cash' as string | PaymentMethod[],
    staffName: ''
  })

  const [staffList, setStaffList] = useState<any[]>([])
  const [packages, setPackages] = useState<any[]>([])

  useEffect(() => {
    if (authLoading) {
      return
    }

    if (!settings.moreEnabled) {
      toast.error(t('more.serviceDisabled'))
      setLoading(false)
      return
    }

    if (!hasPermission('canViewMore')) {
      toast.error(t('common.noPermission'))
      setLoading(false)
      return
    }

    fetchMoreSubscriptions()
    fetchStaff()
    fetchPackages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.moreEnabled, authLoading, user])

  useEffect(() => {
    filterSubscriptions()
  }, [searchTerm, statusFilter, moreSubscriptions, filterCoach, filterSessions])

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!editingMore && !paymentMore && !showAddForm && !showSessionForm && !showRenewForm) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingMore) setEditingMore(null)
        if (paymentMore) setPaymentMore(null)
        if (showAddForm) setShowAddForm(false)
        if (showSessionForm) setShowSessionForm(false)
        if (showRenewForm) setShowRenewForm(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editingMore, paymentMore, showAddForm, showSessionForm, showRenewForm])

  const fetchMoreSubscriptions = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/more')
      if (response.ok) {
        const data = await response.json()
        setMoreSubscriptions(data)
      } else {
        toast.error(t('more.fetchError'))
      }
    } catch (error) {
      console.error('Error fetching More subscriptions:', error)
      toast.error(t('more.fetchError'))
    } finally {
      setLoading(false)
    }
  }

  const fetchStaff = async () => {
    try {
      const response = await fetch('/api/staff')
      if (response.ok) {
        const data = await response.json()
        setStaffList(data.filter((s: any) => s.isActive))
      }
    } catch (error) {
      console.error('Error fetching staff:', error)
    }
  }

  const fetchPackages = async () => {
    try {
      const response = await fetch('/api/packages?serviceType=More')
      if (response.ok) {
        const data = await response.json()
        setPackages(data)
      }
    } catch (error) {
      console.error('Error fetching packages:', error)
    }
  }

  const filterSubscriptions = () => {
    let filtered = [...moreSubscriptions]

    if (searchTerm) {
      filtered = filtered.filter(sub =>
        sub.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.phone.includes(searchTerm) ||
        sub.moreNumber.toString().includes(searchTerm) ||
        sub.coachName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    const now = new Date()
    const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    if (statusFilter === 'active') {
      filtered = filtered.filter(sub => new Date(sub.expiryDate) > sevenDays)
    } else if (statusFilter === 'expiring') {
      filtered = filtered.filter(sub => {
        const exp = new Date(sub.expiryDate)
        return exp > now && exp <= sevenDays
      })
    } else if (statusFilter === 'expired') {
      filtered = filtered.filter(sub => new Date(sub.expiryDate) <= now)
    }

    if (filterCoach) {
      filtered = filtered.filter(sub => sub.coachName === filterCoach)
    }

    if (filterSessions === 'low') {
      filtered = filtered.filter(sub => sub.sessionsRemaining > 0 && sub.sessionsRemaining <= 3)
    } else if (filterSessions === 'zero') {
      filtered = filtered.filter(sub => sub.sessionsRemaining === 0)
    }

    setFilteredSubscriptions(filtered)
  }

  const handleAddSubscription = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.clientName || !formData.phone || !formData.sessionsPurchased || !formData.coachName) {
      toast.error(t('more.fillRequired'))
      return
    }

    const totalPrice = parseFloat(formData.totalPrice) || 0
    const sessionsPurchased = parseInt(formData.sessionsPurchased) || 1
    const pricePerSession = totalPrice / sessionsPurchased

    try {
      const response = await fetch('/api/more', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          sessionsPurchased: sessionsPurchased,
          pricePerSession: pricePerSession,
          remainingAmount: 0
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(t('more.addSuccess'))
        setShowAddForm(false)
        resetForm()
        fetchMoreSubscriptions()
      } else {
        toast.error(data.error || t('more.addError'))
      }
    } catch (error) {
      console.error('Error adding subscription:', error)
      toast.error(t('more.addError'))
    }
  }

  const handleQuickAttendance = async (moreNumber: number) => {
    try {
      const response = await fetch('/api/more/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moreNumber, notes: '' })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(t('more.sessionRegistered'))
        fetchMoreSubscriptions()
      } else {
        toast.error(data.error || t('more.sessionError'))
      }
    } catch {
      toast.error(t('more.sessionError'))
    }
  }

  const handleRegisterSession = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!sessionFormData.moreNumber) {
      toast.error(t('more.enterNumber'))
      return
    }

    try {
      const response = await fetch('/api/more/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moreNumber: parseInt(sessionFormData.moreNumber),
          notes: sessionFormData.notes
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(t('more.sessionRegistered'))
        setShowSessionForm(false)
        setSessionFormData({ moreNumber: '', notes: '' })
        fetchMoreSubscriptions()
      } else {
        toast.error(data.error || t('more.sessionError'))
      }
    } catch (error) {
      console.error('Error registering session:', error)
      toast.error(t('more.sessionError'))
    }
  }

  const handleRenewSubscription = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!renewFormData.oldMoreNumber || !renewFormData.sessionsPurchased) {
      toast.error(t('more.fillRequired'))
      return
    }

    try {
      const response = await fetch('/api/more/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...renewFormData,
          oldMoreNumber: parseInt(renewFormData.oldMoreNumber),
          sessionsPurchased: parseInt(renewFormData.sessionsPurchased),
          totalPrice: parseFloat(renewFormData.totalPrice) || 0,
          remainingAmount: 0
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(t('more.renewSuccess'))
        setShowRenewForm(false)
        setRenewFormData({
          oldMoreNumber: '',
          sessionsPurchased: '',
          totalPrice: '',
          startDate: formatDateYMD(new Date()),
          expiryDate: '',
          notes: '',
          paymentMethod: 'cash',
          staffName: ''
        })
        fetchMoreSubscriptions()
      } else {
        toast.error(data.error || t('more.renewError'))
      }
    } catch (error) {
      console.error('Error renewing subscription:', error)
      toast.error(t('more.renewError'))
    }
  }

  const handleDeleteSubscription = async (moreNumber: number) => {
    if (!confirm(t('more.confirmDelete'))) return

    try {
      const response = await fetch(`/api/more?moreNumber=${moreNumber}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success(t('more.deleteSuccess'))
        fetchMoreSubscriptions()
      } else {
        const data = await response.json()
        toast.error(data.error || t('more.deleteError'))
      }
    } catch (error) {
      console.error('Error deleting subscription:', error)
      toast.error(t('more.deleteError'))
    }
  }

  const handleOpenEdit = (sub: More) => {
    setEditingMore(sub)
    setEditFormData({
      clientName: sub.clientName,
      phone: sub.phone,
      coachName: sub.coachName,
      sessionsPurchased: sub.sessionsPurchased,
      sessionsRemaining: sub.sessionsRemaining,
      pricePerSession: sub.pricePerSession,
      totalAmount: sub.totalAmount,
      remainingAmount: sub.remainingAmount || 0,
      startDate: formatDateYMD(sub.startDate),
      expiryDate: formatDateYMD(sub.expiryDate),
      notes: sub.notes || ''
    })
  }

  const handleSaveEdit = async () => {
    if (!editingMore) return
    setEditSubmitting(true)
    try {
      const response = await fetch('/api/more', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moreNumber: editingMore.moreNumber,
          ...editFormData
        })
      })
      const data = await response.json()
      if (response.ok) {
        toast.success(locale === 'ar' ? 'تم تحديث الاشتراك بنجاح' : 'Subscription updated successfully')
        setEditingMore(null)
        fetchMoreSubscriptions()
      } else {
        toast.error(data.error || (locale === 'ar' ? 'فشل التحديث' : 'Update failed'))
      }
    } catch (error) {
      console.error('Error updating subscription:', error)
      toast.error(locale === 'ar' ? 'حدث خطأ أثناء التحديث' : 'An error occurred')
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleOpenPayment = (sub: More) => {
    setPaymentMore(sub)
    setPaymentAmount(sub.remainingAmount || 0)
  }

  const handleConfirmPayment = async () => {
    if (!paymentMore) return
    if (paymentAmount <= 0) {
      toast.error(locale === 'ar' ? 'المبلغ لازم يكون أكبر من صفر' : 'Amount must be greater than zero')
      return
    }
    if (paymentAmount > (paymentMore.remainingAmount || 0)) {
      toast.error(locale === 'ar' ? 'المبلغ أكبر من المتبقي' : 'Amount exceeds remaining')
      return
    }

    setPaymentSubmitting(true)
    try {
      const newRemaining = Math.max(0, (paymentMore.remainingAmount || 0) - paymentAmount)
      const response = await fetch('/api/more', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moreNumber: paymentMore.moreNumber,
          remainingAmount: newRemaining
        })
      })
      const data = await response.json()
      if (response.ok) {
        toast.success(locale === 'ar' ? `تم تسجيل دفع ${paymentAmount} جنيه` : `Recorded payment of ${paymentAmount} EGP`)
        setPaymentMore(null)
        setPaymentAmount(0)
        fetchMoreSubscriptions()
      } else {
        toast.error(data.error || (locale === 'ar' ? 'فشل تسجيل الدفع' : 'Payment failed'))
      }
    } catch (error) {
      console.error('Error recording payment:', error)
      toast.error(locale === 'ar' ? 'حدث خطأ' : 'An error occurred')
    } finally {
      setPaymentSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      clientName: '',
      phone: '',
      memberId: '',
      memberNumberDisplay: '',
      sessionsPurchased: '',
      coachName: '',
      coachUserId: '',
      totalPrice: '',
      startDate: formatDateYMD(new Date()),
      expiryDate: '',
      notes: '',
      paymentMethod: 'cash',
      staffName: ''
    })
  }

  const handleMemberIdChange = (memberNumber: string) => {
    setFormData(prev => ({
      ...prev,
      memberNumberDisplay: memberNumber,
      memberId: ''
    }))

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (!memberNumber || memberNumber.trim() === '') {
      return
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/members?memberNumber=${memberNumber}`)
        if (response.ok) {
          const members = await response.json()
          if (members && members.length > 0) {
            const member = members[0]
            setFormData(prev => ({
              ...prev,
              memberId: member.id,
              memberNumberDisplay: member.memberNumber.toString(),
              clientName: member.name,
              phone: member.phone
            }))
            toast.success(locale === 'ar' ? `تم العثور على العضو: ${member.name}` : `Member found: ${member.name}`)
          }
        }
      } catch (error) {
        // ignore
      }
    }, 1500)
  }

  const handleStaffChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value
    const staff = staffList.find(s => (s.user?.id === selectedValue) || (s.id === selectedValue))

    if (staff) {
      setFormData({
        ...formData,
        coachUserId: selectedValue,
        coachName: staff.name
      })
    } else {
      setFormData({
        ...formData,
        coachUserId: '',
        coachName: ''
      })
    }
  }

  const handlePackageSelect = (pkg: any) => {
    let calculatedExpiry = ''
    if (formData.startDate && pkg.durationDays) {
      const start = new Date(formData.startDate)
      const expiry = new Date(start)
      expiry.setDate(expiry.getDate() + pkg.durationDays)
      calculatedExpiry = formatDateYMD(expiry)
    }

    setFormData({
      ...formData,
      sessionsPurchased: pkg.sessions.toString(),
      totalPrice: pkg.price.toString(),
      expiryDate: calculatedExpiry || formData.expiryDate
    })
    toast.success(locale === 'ar' ? `تم تطبيق باقة: ${pkg.name} (${pkg.durationDays} يوم)` : `Package applied: ${pkg.name} (${pkg.durationDays} days)`)
  }

  const handleRenewPackageSelect = (pkg: any) => {
    let calculatedExpiry = ''
    if (renewFormData.startDate && pkg.durationDays) {
      const start = new Date(renewFormData.startDate)
      const expiry = new Date(start)
      expiry.setDate(expiry.getDate() + pkg.durationDays)
      calculatedExpiry = formatDateYMD(expiry)
    }

    setRenewFormData({
      ...renewFormData,
      sessionsPurchased: pkg.sessions.toString(),
      totalPrice: pkg.price.toString(),
      expiryDate: calculatedExpiry || renewFormData.expiryDate
    })
    toast.success(locale === 'ar' ? `تم تطبيق باقة: ${pkg.name} (${pkg.durationDays} يوم)` : `Package applied: ${pkg.name} (${pkg.durationDays} days)`)
  }

  const calculateExpiryFromMonths = (months: number) => {
    if (!formData.startDate) {
      toast.error(locale === 'ar' ? 'يرجى تحديد تاريخ البداية أولاً' : 'Please set the start date first')
      return
    }

    const start = new Date(formData.startDate)
    const expiry = new Date(start)
    expiry.setMonth(expiry.getMonth() + months)

    setFormData(prev => ({
      ...prev,
      expiryDate: formatDateYMD(expiry)
    }))
  }

  const isExpired = (expiryDate: string) => {
    return new Date(expiryDate) <= new Date()
  }

  const getStatusBadge = (sub: More) => {
    if (!sub.isActive) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{t('more.inactive')}</span>
    }
    if (isExpired(sub.expiryDate)) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">{t('more.expired')}</span>
    }
    if (sub.sessionsRemaining === 0) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300">{t('more.noSessions')}</span>
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">{t('more.active')}</span>
  }

  if (!settings.moreEnabled) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 dark:text-red-400">{t('more.serviceDisabled')}</p>
      </div>
    )
  }

  if (!hasPermission('canViewMore')) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 dark:text-red-400">{t('common.noPermission')}</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6" dir={direction}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          {IconPlus}
          <span>{t('more.title')}</span>
        </h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowSessionForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            {IconCheck}
            <span>{t('more.registerSession')}</span>
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            {IconPlus}
            <span>{t('more.addSubscription')}</span>
          </button>
        </div>
      </div>

      {/* Search & Filters card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 mb-6" dir={direction}>
        <div className="mb-5">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 start-0 ps-3 flex items-center text-gray-400">
              {IconSearch}
            </span>
            <input
              type="text"
              placeholder={locale === 'ar' ? 'بحث (اسم العميل، الكوتش، رقم الاشتراك، هاتف)...' : 'Search (client, coach, number, phone)...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full ps-10 pe-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            />
          </div>
        </div>

        {/* Quick status filters */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              {IconFilter}
              <span>{locale === 'ar' ? 'فلاتر سريعة' : 'Quick Filters'}</span>
            </h3>
            {(statusFilter !== 'all' || filterSessions !== 'all') && (
              <button
                onClick={() => {
                  setStatusFilter('all')
                  setFilterSessions('all')
                }}
                className="inline-flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors duration-200"
              >
                {IconClose}
                <span>{locale === 'ar' ? 'إعادة تعيين' : 'Reset'}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <button
              onClick={() => setStatusFilter('all')}
              aria-current={statusFilter === 'all' ? 'page' : undefined}
              className={`px-4 py-3 rounded-lg font-bold transition-colors duration-200 text-start ${
                statusFilter === 'all'
                  ? 'bg-primary-500 text-primary-contrast shadow-sm ring-1 ring-primary-400'
                  : 'bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40'
              }`}
            >
              <div className="text-xs uppercase tracking-wider opacity-80">{locale === 'ar' ? 'كل الحالات' : 'All Statuses'}</div>
              <div className="text-2xl font-bold mt-1">{moreSubscriptions.length}</div>
            </button>

            <button
              onClick={() => setStatusFilter('active')}
              aria-current={statusFilter === 'active' ? 'page' : undefined}
              className={`px-4 py-3 rounded-lg font-bold transition-colors duration-200 text-start ${
                statusFilter === 'active'
                  ? 'bg-green-600 text-white shadow-sm ring-1 ring-green-500'
                  : 'bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40'
              }`}
            >
              <div className="text-xs uppercase tracking-wider opacity-80">{locale === 'ar' ? 'نشط' : 'Active'}</div>
              <div className="text-2xl font-bold mt-1">
                {moreSubscriptions.filter(s => new Date(s.expiryDate) > new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length}
              </div>
            </button>

            <button
              onClick={() => setStatusFilter('expiring')}
              aria-current={statusFilter === 'expiring' ? 'page' : undefined}
              className={`px-4 py-3 rounded-lg font-bold transition-colors duration-200 text-start ${
                statusFilter === 'expiring'
                  ? 'bg-orange-600 text-white shadow-sm ring-1 ring-orange-500'
                  : 'bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40'
              }`}
            >
              <div className="text-xs uppercase tracking-wider opacity-80">{locale === 'ar' ? 'قريب الانتهاء' : 'Expiring Soon'}</div>
              <div className="text-2xl font-bold mt-1">
                {moreSubscriptions.filter(s => {
                  const exp = new Date(s.expiryDate)
                  const now = new Date()
                  return exp > now && exp <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                }).length}
              </div>
            </button>

            <button
              onClick={() => setStatusFilter('expired')}
              aria-current={statusFilter === 'expired' ? 'page' : undefined}
              className={`px-4 py-3 rounded-lg font-bold transition-colors duration-200 text-start ${
                statusFilter === 'expired'
                  ? 'bg-red-600 text-white shadow-sm ring-1 ring-red-500'
                  : 'bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40'
              }`}
            >
              <div className="text-xs uppercase tracking-wider opacity-80">{locale === 'ar' ? 'منتهي' : 'Expired'}</div>
              <div className="text-2xl font-bold mt-1">
                {moreSubscriptions.filter(s => new Date(s.expiryDate) <= new Date()).length}
              </div>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => setFilterSessions('all')}
              aria-current={filterSessions === 'all' ? 'page' : undefined}
              className={`px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 ${
                filterSessions === 'all'
                  ? 'bg-primary-500 text-primary-contrast shadow-sm ring-1 ring-primary-400'
                  : 'bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40'
              }`}
            >
              <div className="text-sm">{locale === 'ar' ? 'كل الجلسات' : 'All Sessions'}</div>
            </button>

            <button
              onClick={() => setFilterSessions('low')}
              aria-current={filterSessions === 'low' ? 'page' : undefined}
              className={`px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 ${
                filterSessions === 'low'
                  ? 'bg-amber-500 text-gray-900 shadow-sm ring-1 ring-amber-400'
                  : 'bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40'
              }`}
            >
              <div className="text-sm">{locale === 'ar' ? 'جلسات منخفضة (≤3)' : 'Low Sessions (≤3)'}</div>
              <div className="text-xs opacity-70 mt-0.5">
                ({moreSubscriptions.filter(s => s.sessionsRemaining > 0 && s.sessionsRemaining <= 3).length})
              </div>
            </button>

            <button
              onClick={() => setFilterSessions('zero')}
              aria-current={filterSessions === 'zero' ? 'page' : undefined}
              className={`px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 ${
                filterSessions === 'zero'
                  ? 'bg-gray-700 text-white shadow-sm ring-1 ring-gray-600'
                  : 'bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40'
              }`}
            >
              <div className="text-sm">{locale === 'ar' ? 'جلسات منتهية' : 'Zero Sessions'}</div>
              <div className="text-xs opacity-70 mt-0.5">
                ({moreSubscriptions.filter(s => s.sessionsRemaining === 0).length})
              </div>
            </button>
          </div>
        </div>

        {/* Coach filter */}
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-2">
            {IconCoach}
            <span>{locale === 'ar' ? 'تصفية حسب الكوتش' : 'Filter by Coach'}</span>
          </label>
          <select
            value={filterCoach}
            onChange={(e) => setFilterCoach(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
          >
            <option value="">{locale === 'ar' ? 'كل الكوتشات' : 'All Coaches'}</option>
            {(Array.from(new Set(moreSubscriptions.map(s => s.coachName).filter((name): name is string => !!name))) as string[]).sort().map(coach => (
              <option key={coach} value={coach}>{coach}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Cards grid */}
      {loading ? (
        <LoadingScreen message={t('common.loading')} />
      ) : filteredSubscriptions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
          <svg className="w-12 h-12 text-gray-400" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0l-2 7H6l-2-7m16 0H4"/></svg>
          <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">{t('more.noSubscriptions')}</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredSubscriptions.map((sub) => {
            const expired = isExpired(sub.expiryDate)
            const isExpiringSoon =
              sub.expiryDate &&
              !expired &&
              new Date(sub.expiryDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            const noSessions = sub.sessionsRemaining === 0
            const inactive = !sub.isActive
            const sessionsUsed = sub.sessionsPurchased - sub.sessionsRemaining
            const progressPercent = sub.sessionsPurchased > 0 ? (sessionsUsed / sub.sessionsPurchased) * 100 : 0

            return (
              <div
                key={sub.moreNumber}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden ring-1 transition-colors duration-200 ${
                  expired
                    ? 'ring-red-200 dark:ring-red-900/50'
                    : isExpiringSoon
                      ? 'ring-orange-200 dark:ring-orange-900/50'
                      : 'ring-gray-200 dark:ring-gray-700'
                }`}
                dir={direction}
              >
                {/* Header */}
                <div
                  className={`p-3 ${
                    expired
                      ? 'bg-red-600 dark:bg-red-700'
                      : isExpiringSoon
                        ? 'bg-orange-600 dark:bg-orange-700'
                        : 'bg-gradient-to-r from-primary-500 to-primary-600 dark:from-primary-700 dark:to-primary-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full overflow-hidden bg-white/20 flex items-center justify-center flex-shrink-0 ${expired || isExpiringSoon ? 'text-white' : 'text-gray-900'}`}>
                        {IconUser}
                      </div>
                      <div>
                        <div className={`font-bold text-base ${expired || isExpiringSoon ? 'text-white' : 'text-gray-900'}`}>{sub.clientName}</div>
                        <div className={`text-xs ${expired || isExpiringSoon ? 'text-white/80' : 'text-gray-900/70'}`}>
                          #{sub.moreNumber} • {sub.phone}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white ${
                        sub.sessionsRemaining === 0
                          ? 'bg-red-500 dark:bg-red-600'
                          : sub.sessionsRemaining <= 3
                            ? 'bg-orange-500 dark:bg-orange-600'
                            : 'bg-green-500 dark:bg-green-600'
                      }`}
                    >
                      {sub.sessionsRemaining} / {sub.sessionsPurchased}
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-3 space-y-2.5">
                  {/* Progress Bar with coach */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                      <span>{locale === 'ar' ? 'الكوتش' : 'Coach'}: {sub.coachName}</span>
                      <span>{Math.round(progressPercent)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-[width] duration-300 ${
                          progressPercent >= 80
                            ? 'bg-red-500'
                            : progressPercent >= 50
                              ? 'bg-orange-500'
                              : 'bg-green-500'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Total + Remaining */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-green-50 dark:bg-green-900/30 ring-1 ring-green-200 dark:ring-green-900/50 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-green-700 dark:text-green-300 font-semibold uppercase tracking-wider">
                        {locale === 'ar' ? 'الإجمالي' : 'Total'}
                      </div>
                      <div className="text-sm font-bold text-green-700 dark:text-green-400">
                        {(sub.totalAmount || sub.sessionsPurchased * sub.pricePerSession).toFixed(0)} {t('members.egp')}
                      </div>
                    </div>
                    <div
                      className={`rounded-lg p-2 text-center ring-1 ${
                        (sub.remainingAmount || 0) > 0
                          ? 'bg-orange-50 dark:bg-orange-900/30 ring-orange-200 dark:ring-orange-900/50'
                          : 'bg-gray-50 dark:bg-gray-700/50 ring-gray-200 dark:ring-gray-700'
                      }`}
                    >
                      <div
                        className={`text-[10px] font-semibold uppercase tracking-wider ${
                          (sub.remainingAmount || 0) > 0
                            ? 'text-orange-700 dark:text-orange-300'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {locale === 'ar' ? 'الباقي' : 'Remaining'}
                      </div>
                      <div
                        className={`text-sm font-bold ${
                          (sub.remainingAmount || 0) > 0
                            ? 'text-orange-700 dark:text-orange-400'
                            : 'text-green-700 dark:text-green-400'
                        }`}
                      >
                        {(sub.remainingAmount || 0).toFixed(0)} {t('members.egp')}
                      </div>
                    </div>
                  </div>

                  {/* Dates */}
                  {(sub.startDate || sub.expiryDate) && (
                    <div
                      className={`rounded-lg p-2 text-xs font-mono ring-1 ${
                        expired
                          ? 'bg-red-50 dark:bg-red-900/20 ring-red-200 dark:ring-red-900/50'
                          : isExpiringSoon
                            ? 'bg-orange-50 dark:bg-orange-900/20 ring-orange-200 dark:ring-orange-900/50'
                            : 'bg-gray-50 dark:bg-gray-700/50 ring-gray-200 dark:ring-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-wrap text-gray-700 dark:text-gray-300">
                        {IconCalendar}
                        {sub.startDate && <span>{formatDateYMD(sub.startDate)}</span>}
                        {sub.startDate && sub.expiryDate && <span>{direction === 'rtl' ? '←' : '→'}</span>}
                        {sub.expiryDate && (
                          <span className={expired ? 'text-red-600 dark:text-red-400 font-bold' : ''}>
                            {formatDateYMD(sub.expiryDate)}
                          </span>
                        )}
                        {expired && (
                          <span className="text-red-600 dark:text-red-400 font-bold">
                            ({locale === 'ar' ? 'منتهي' : 'Expired'})
                          </span>
                        )}
                        {!expired && isExpiringSoon && (
                          <span className="text-orange-600 dark:text-orange-400 font-bold">
                            ({locale === 'ar' ? 'ينتهي قريباً' : 'Expiring Soon'})
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => handleQuickAttendance(sub.moreNumber)}
                      disabled={noSessions || expired || inactive}
                      className="inline-flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed font-bold"
                    >
                      {IconCheck}
                      <span>{locale === 'ar' ? 'حضور' : 'Attend'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setRenewFormData({
                          ...renewFormData,
                          oldMoreNumber: sub.moreNumber.toString()
                        })
                        setShowRenewForm(true)
                      }}
                      className="inline-flex items-center justify-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-primary-contrast py-2 rounded-lg text-sm transition-colors duration-200 font-bold"
                    >
                      {IconRefresh}
                      <span>{locale === 'ar' ? 'تجديد' : 'Renew'}</span>
                    </button>
                    {(sub.remainingAmount || 0) > 0 && (
                      <button
                        onClick={() => handleOpenPayment(sub)}
                        className="col-span-2 inline-flex items-center justify-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg text-sm transition-colors duration-200 font-bold"
                      >
                        {IconWallet}
                        <span>
                          {locale === 'ar' ? 'دفع الباقي' : 'Pay Remaining'} ({(sub.remainingAmount || 0).toFixed(0)} {t('members.egp')})
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenEdit(sub)}
                      className="inline-flex items-center justify-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-primary-contrast py-2 rounded-lg text-sm transition-colors duration-200 font-bold"
                    >
                      {IconEdit}
                      <span>{locale === 'ar' ? 'تعديل' : 'Edit'}</span>
                    </button>
                    {hasPermission('canDeleteMore') && (
                      <button
                        onClick={() => handleDeleteSubscription(sub.moreNumber)}
                        className="inline-flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm transition-colors duration-200 font-bold"
                      >
                        {IconTrash}
                        <span>{locale === 'ar' ? 'حذف الاشتراك' : 'Delete'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingMore && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in"
          dir={direction}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-more-title"
          onClick={(e) => { if (e.target === e.currentTarget && !editSubmitting) setEditingMore(null) }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h3 id="edit-more-title" className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                {IconEdit}
                <span>{locale === 'ar' ? `تعديل الاشتراك #${editingMore.moreNumber}` : `Edit Subscription #${editingMore.moreNumber}`}</span>
              </h3>
              <button
                onClick={() => setEditingMore(null)}
                disabled={editSubmitting}
                aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 disabled:opacity-50"
              >
                {IconClose}
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{locale === 'ar' ? 'اسم العميل' : 'Client Name'}</label>
                <input
                  type="text"
                  value={editFormData.clientName}
                  onChange={(e) => setEditFormData({ ...editFormData, clientName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{locale === 'ar' ? 'الهاتف' : 'Phone'}</label>
                <input
                  type="text"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value.replace(/s/g, '') })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{locale === 'ar' ? 'الكوتش' : 'Coach'}</label>
                <input
                  type="text"
                  value={editFormData.coachName}
                  onChange={(e) => setEditFormData({ ...editFormData, coachName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{locale === 'ar' ? 'جلسات متبقية' : 'Sessions Remaining'}</label>
                <input
                  type="number"
                  value={editFormData.sessionsRemaining}
                  onChange={(e) => setEditFormData({ ...editFormData, sessionsRemaining: parseInt(e.target.value) || 0 })}
                  min="0"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{locale === 'ar' ? 'إجمالي الجلسات' : 'Total Sessions'}</label>
                <input
                  type="number"
                  value={editFormData.sessionsPurchased}
                  onChange={(e) => setEditFormData({ ...editFormData, sessionsPurchased: parseInt(e.target.value) || 0 })}
                  min="0"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{locale === 'ar' ? 'سعر الجلسة' : 'Price / Session'}</label>
                <input
                  type="number"
                  value={editFormData.pricePerSession}
                  onChange={(e) => setEditFormData({ ...editFormData, pricePerSession: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{locale === 'ar' ? 'الإجمالي' : 'Total Amount'}</label>
                <input
                  type="number"
                  value={editFormData.totalAmount}
                  onChange={(e) => setEditFormData({ ...editFormData, totalAmount: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                  {IconWallet}
                  <span>{locale === 'ar' ? 'المتبقي' : 'Remaining Amount'}</span>
                </label>
                <input
                  type="number"
                  value={editFormData.remainingAmount}
                  onChange={(e) => setEditFormData({ ...editFormData, remainingAmount: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 rounded-lg border border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{locale === 'ar' ? 'تاريخ البداية' : 'Start Date'}</label>
                <input
                  type="date"
                  value={editFormData.startDate}
                  onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{locale === 'ar' ? 'تاريخ الانتهاء' : 'Expiry Date'}</label>
                <input
                  type="date"
                  value={editFormData.expiryDate}
                  onChange={(e) => setEditFormData({ ...editFormData, expiryDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{locale === 'ar' ? 'ملاحظات' : 'Notes'}</label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                />
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex gap-3 sticky bottom-0 bg-white dark:bg-gray-800">
              <button
                onClick={handleSaveEdit}
                disabled={editSubmitting}
                autoFocus
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold rounded-lg transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              >
                {editSubmitting ? IconSpinner : IconSave}
                <span>{editSubmitting ? (locale === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (locale === 'ar' ? 'حفظ التعديلات' : 'Save Changes')}</span>
              </button>
              <button
                onClick={() => setEditingMore(null)}
                disabled={editSubmitting}
                className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 font-bold rounded-lg transition-colors duration-200 disabled:opacity-60"
              >
                {locale === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentMore && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in"
          dir={direction}
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-title"
          onClick={(e) => { if (e.target === e.currentTarget && !paymentSubmitting) setPaymentMore(null) }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 id="payment-title" className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                {IconWallet}
                <span>{locale === 'ar' ? 'دفع المتبقي' : 'Pay Remaining'}</span>
              </h3>
              <button
                onClick={() => setPaymentMore(null)}
                disabled={paymentSubmitting}
                aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 disabled:opacity-50"
              >
                {IconClose}
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 ring-1 ring-gray-200 dark:ring-gray-700">
                <p><strong className="text-gray-900 dark:text-gray-100">{locale === 'ar' ? 'العميل:' : 'Client:'}</strong> {paymentMore.clientName}</p>
                <p><strong className="text-gray-900 dark:text-gray-100">{locale === 'ar' ? 'رقم الاشتراك:' : 'Subscription #:'}</strong> {paymentMore.moreNumber}</p>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-200 dark:ring-orange-900/50 rounded-lg p-3">
                <p className="text-sm text-orange-700 dark:text-orange-300 font-semibold mb-1">
                  {locale === 'ar' ? 'المبلغ المتبقي الحالي:' : 'Current Remaining:'}
                </p>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                  {(paymentMore.remainingAmount || 0).toFixed(0)} {t('members.egp')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {locale === 'ar' ? 'المبلغ المدفوع' : 'Payment Amount'}
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  min="0"
                  max={paymentMore.remainingAmount || 0}
                  step="0.01"
                  className="w-full px-3 py-2.5 rounded-lg border border-green-300 dark:border-green-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors duration-200"
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(paymentMore.remainingAmount || 0)}
                    className="text-xs px-3 py-1.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/60 transition-colors duration-200 font-bold"
                  >
                    {locale === 'ar' ? 'دفع كل المتبقي' : 'Pay All'}
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3 text-sm ring-1 ring-gray-200 dark:ring-gray-700">
                <div className="flex justify-between text-gray-700 dark:text-gray-300">
                  <span>{locale === 'ar' ? 'المتبقي بعد الدفع:' : 'Remaining After:'}</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100">
                    {Math.max(0, (paymentMore.remainingAmount || 0) - paymentAmount).toFixed(0)} {t('members.egp')}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={handleConfirmPayment}
                disabled={paymentSubmitting || paymentAmount <= 0 || paymentAmount > (paymentMore.remainingAmount || 0)}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              >
                {paymentSubmitting ? IconSpinner : IconSave}
                <span>{paymentSubmitting ? (locale === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (locale === 'ar' ? 'تأكيد الدفع' : 'Confirm')}</span>
              </button>
              <button
                onClick={() => setPaymentMore(null)}
                disabled={paymentSubmitting}
                className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 font-bold rounded-lg transition-colors duration-200 disabled:opacity-60"
              >
                {locale === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Subscription Modal */}
      {showAddForm && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddForm(false) }}
          dir={direction}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-more-title"
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-800 z-10 flex justify-between items-center p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 id="add-more-title" className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                {IconPlus}
                <span>{t('more.addSubscription')}</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                {IconClose}
              </button>
            </div>
            <form onSubmit={handleAddSubscription} className="p-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('more.clientName')} <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                    placeholder={t('more.clientName')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('more.phone')} <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/s/g, '') })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                    placeholder="01xxxxxxxxx"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {locale === 'ar' ? 'رقم العضوية (Member Number)' : 'Member Number'}
                  </label>
                  <input
                    type="text"
                    value={formData.memberNumberDisplay}
                    onChange={(e) => handleMemberIdChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                    placeholder="1234"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5">
                    {IconLightbulb}
                    <span>{locale === 'ar' ? 'سيتم ملء الاسم والهاتف تلقائياً' : 'Name and phone will autofill'}</span>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('more.coachName')} <span className="text-red-600">*</span>
                  </label>
                  <select
                    required
                    value={formData.coachUserId}
                    onChange={handleStaffChange}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  >
                    <option value="">{t('more.selectCoach')}</option>
                    {staffList.map((staff) => (
                      <option key={staff.id} value={staff.user?.id || staff.id}>
                        {staff.name} {staff.position && `(${staff.position})`}
                      </option>
                    ))}
                  </select>
                </div>

                {packages.length > 0 && (
                  <div className="col-span-full">
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                      {IconBolt}
                      <span>{t('more.selectPackage')}</span>
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {packages.map((pkg) => (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => handlePackageSelect(pkg)}
                          className="bg-white dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/30 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg p-3 transition-colors duration-200 text-gray-900 dark:text-gray-100"
                        >
                          <div className="text-center">
                            <div className="w-10 h-10 mx-auto rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center mb-1.5">
                              {IconPlus}
                            </div>
                            <div className="font-bold text-gray-900 dark:text-gray-100 text-sm">{pkg.name}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {pkg.sessions} {t('more.sessions')}
                            </div>
                            {pkg.durationDays && (
                              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 inline-flex items-center gap-1">
                                {IconCalendar}
                                <span>{pkg.durationDays} {locale === 'ar' ? 'يوم' : 'days'}</span>
                              </div>
                            )}
                            <div className="text-lg font-bold text-primary-700 dark:text-primary-400 mt-1">
                              {pkg.price} EGP
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1.5">
                      {IconLightbulb}
                      <span>{locale === 'ar' ? 'يمكنك تعديل القيم بعد اختيار الباقة' : 'You can edit values after selecting'}</span>
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('more.sessionsPurchased')} <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.sessionsPurchased}
                    onChange={(e) => setFormData({ ...formData, sessionsPurchased: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                    placeholder="8"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {locale === 'ar' ? 'السعر الإجمالي' : 'Total Price'} <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.totalPrice}
                    onChange={(e) => setFormData({ ...formData, totalPrice: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                    placeholder="1600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('more.startDate')} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(yyyy-mm-dd)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                    placeholder="2025-01-01"
                    pattern="\d{4}-\d{2}-\d{2}"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('more.expiryDate')} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(yyyy-mm-dd)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                    placeholder="2025-02-01"
                    pattern="\d{4}-\d{2}-\d{2}"
                  />
                </div>
              </div>

              <div>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                  {IconBolt}
                  <span>{locale === 'ar' ? 'إضافة سريعة:' : 'Quick add:'}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 6, 9, 12].map(months => (
                    <button
                      key={months}
                      type="button"
                      onClick={() => calculateExpiryFromMonths(months)}
                      className="inline-flex items-center px-3 py-1.5 bg-primary-100 dark:bg-primary-900/30 hover:bg-primary-200 dark:hover:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded-lg text-sm font-bold transition-colors duration-200"
                    >
                      + {months} {locale === 'ar' ? (months === 1 ? 'شهر' : 'أشهر') : (months === 1 ? 'month' : 'months')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <PaymentMethodSelector
                  value={formData.paymentMethod}
                  onChange={(method) => setFormData({ ...formData, paymentMethod: method })}
                  allowMultiple={true}
                  totalAmount={parseFloat(formData.totalPrice || '0')}
                  required={false}
                  pointsEnabled={settings.pointsEnabled}
                  pointsValueInEGP={settings.pointsValueInEGP}
                />
              </div>

              {formData.sessionsPurchased && formData.totalPrice && (
                <div className="bg-green-50 dark:bg-green-900/30 ring-1 ring-green-200 dark:ring-green-900/50 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      {IconWallet}
                      <span>{locale === 'ar' ? 'المبلغ الكلي:' : 'Total Amount:'}</span>
                    </span>
                    <span className="text-2xl font-bold text-green-700 dark:text-green-400">
                      {parseFloat(formData.totalPrice).toFixed(2)} EGP
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('more.notes')}</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  rows={3}
                  placeholder={locale === 'ar' ? 'ملاحظات إضافية...' : 'Additional notes...'}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold py-2.5 rounded-lg transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                >
                  {loading ? IconSpinner : IconSave}
                  <span>{loading ? (locale === 'ar' ? 'جاري الحفظ...' : 'Saving...') : t('common.save')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 py-2.5 rounded-lg transition-colors duration-200 font-bold"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Session Registration Modal */}
      {showSessionForm && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in"
          onClick={() => setShowSessionForm(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-title"
          dir={direction}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 id="session-title" className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                {IconCheck}
                <span>{t('more.registerSession')}</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowSessionForm(false)}
                aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                {IconClose}
              </button>
            </div>
            <form onSubmit={handleRegisterSession} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('more.subscriptionNumber')} *</label>
                <input
                  type="number"
                  value={sessionFormData.moreNumber}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, moreNumber: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowSessionForm(false)}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 font-bold rounded-lg transition-colors duration-200"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                >
                  {IconCheck}
                  <span>{t('more.registerSession')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {showRenewForm && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in"
          onClick={() => setShowRenewForm(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="renew-title"
          dir={direction}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h2 id="renew-title" className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                {IconRefresh}
                <span>{t('more.renewSubscription')}</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowRenewForm(false)}
                aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                {IconClose}
              </button>
            </div>
            <form onSubmit={handleRenewSubscription} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('more.oldSubscriptionNumber')} *</label>
                  <input
                    type="number"
                    value={renewFormData.oldMoreNumber}
                    onChange={(e) => setRenewFormData({ ...renewFormData, oldMoreNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                    required
                    autoFocus
                  />
                </div>

                {packages.length > 0 && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                      {IconBolt}
                      <span>{t('more.selectPackage')}</span>
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {packages.map((pkg) => (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => handleRenewPackageSelect(pkg)}
                          className="bg-white dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/30 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg p-3 transition-colors duration-200 text-gray-900 dark:text-gray-100"
                        >
                          <div className="text-center">
                            <div className="w-10 h-10 mx-auto rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center mb-1.5">
                              {IconRefresh}
                            </div>
                            <div className="font-bold text-gray-900 dark:text-gray-100 text-sm">{pkg.name}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {pkg.sessions} {t('more.sessions')}
                            </div>
                            {pkg.durationDays && (
                              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 inline-flex items-center gap-1">
                                {IconCalendar}
                                <span>{pkg.durationDays} {locale === 'ar' ? 'يوم' : 'days'}</span>
                              </div>
                            )}
                            <div className="text-lg font-bold text-primary-700 dark:text-primary-400 mt-1">
                              {pkg.price} EGP
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1.5">
                      {IconLightbulb}
                      <span>{locale === 'ar' ? 'يمكنك تعديل القيم بعد اختيار الباقة' : 'You can edit values after selecting'}</span>
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('more.sessionsPurchased')} *</label>
                  <input
                    type="number"
                    value={renewFormData.sessionsPurchased}
                    onChange={(e) => setRenewFormData({ ...renewFormData, sessionsPurchased: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                    required
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('more.totalPrice')}</label>
                  <input
                    type="number"
                    value={renewFormData.totalPrice}
                    onChange={(e) => setRenewFormData({ ...renewFormData, totalPrice: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('more.startDate')}</label>
                  <input
                    type="date"
                    value={renewFormData.startDate}
                    onChange={(e) => setRenewFormData({ ...renewFormData, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('more.expiryDate')}</label>
                  <input
                    type="date"
                    value={renewFormData.expiryDate}
                    onChange={(e) => setRenewFormData({ ...renewFormData, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('more.paymentMethod')}</label>
                  <select
                    value={typeof renewFormData.paymentMethod === 'string' ? renewFormData.paymentMethod : 'mixed'}
                    onChange={(e) => setRenewFormData({ ...renewFormData, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  >
                    <option value="cash">{t('common.cash')}</option>
                    <option value="card">{t('common.card')}</option>
                    <option value="instapay">{t('common.instapay')}</option>
                    <option value="wallet">{t('common.wallet')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('more.notes')}</label>
                <textarea
                  value={renewFormData.notes}
                  onChange={(e) => setRenewFormData({ ...renewFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowRenewForm(false)}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 font-bold rounded-lg transition-colors duration-200"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                >
                  {IconRefresh}
                  <span>{t('more.renewSubscription')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

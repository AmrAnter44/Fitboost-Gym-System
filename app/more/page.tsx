'use client'

import { useState, useEffect, useRef } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { useLanguage } from '@/contexts/LanguageContext'
import { useToast } from '@/contexts/ToastContext'
import { useServiceSettings } from '@/contexts/ServiceSettingsContext'
import { formatDateYMD, calculateDaysBetween } from '@/lib/dateFormatter'
import PaymentMethodSelector from '@/components/Paymentmethodselector'
import type { PaymentMethod as PaymentMethodType } from '@/lib/paymentHelpers'

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

  // Debounce timeout للبحث عن العضو
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Form states
  const [showAddForm, setShowAddForm] = useState(false)
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [showRenewForm, setShowRenewForm] = useState(false)
  const [selectedMore, setSelectedMore] = useState<More | null>(null)

  // Edit modal state
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

  // Payment modal state (دفع المبلغ المتبقي)
  const [paymentMore, setPaymentMore] = useState<More | null>(null)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)

  // Form data for new subscription
  const [formData, setFormData] = useState({
    clientName: '',
    phone: '',
    memberId: '', // ID الداخلي (للإرسال للـ API)
    memberNumberDisplay: '', // رقم العضوية (للعرض فقط)
    sessionsPurchased: '',
    coachName: '',
    coachUserId: '',
    totalPrice: '', // السعر الإجمالي بدلاً من سعر الجلسة
    startDate: formatDateYMD(new Date()),
    expiryDate: '',
    notes: '',
    paymentMethod: 'cash' as string | PaymentMethodType[],
    staffName: ''
  })

  // Session form data
  const [sessionFormData, setSessionFormData] = useState({
    moreNumber: '',
    notes: ''
  })

  // Renew form data
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

  // Staff list for selection
  const [staffList, setStaffList] = useState<any[]>([])
  const [packages, setPackages] = useState<any[]>([])

  useEffect(() => {
    // انتظر حتى يتم تحميل بيانات المستخدم
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

  // تنظيف timeout عند unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

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

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(sub =>
        sub.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.phone.includes(searchTerm) ||
        sub.moreNumber.toString().includes(searchTerm) ||
        sub.coachName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Status quick filter
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

    // Coach filter
    if (filterCoach) {
      filtered = filtered.filter(sub => sub.coachName === filterCoach)
    }

    // Sessions filter
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

    // حساب سعر الجلسة من السعر الإجمالي
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
          remainingAmount: 0  // دفع كامل - بدون باقي
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
          remainingAmount: 0  // دفع كامل - بدون باقي
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

  // 📝 فتح نموذج التعديل
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

  // 💾 حفظ التعديل
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
        toast.success('✅ تم تحديث الاشتراك بنجاح')
        setEditingMore(null)
        fetchMoreSubscriptions()
      } else {
        toast.error(data.error || 'فشل التحديث')
      }
    } catch (error) {
      console.error('Error updating subscription:', error)
      toast.error('حدث خطأ أثناء التحديث')
    } finally {
      setEditSubmitting(false)
    }
  }

  // 💰 فتح نموذج دفع المبلغ المتبقي
  const handleOpenPayment = (sub: More) => {
    setPaymentMore(sub)
    setPaymentAmount(sub.remainingAmount || 0)
  }

  // 💾 تأكيد الدفع (تخفيض المتبقي)
  const handleConfirmPayment = async () => {
    if (!paymentMore) return
    if (paymentAmount <= 0) {
      toast.error('المبلغ لازم يكون أكبر من صفر')
      return
    }
    if (paymentAmount > (paymentMore.remainingAmount || 0)) {
      toast.error('المبلغ أكبر من المتبقي')
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
        toast.success(`✅ تم تسجيل دفع ${paymentAmount} جنيه`)
        setPaymentMore(null)
        setPaymentAmount(0)
        fetchMoreSubscriptions()
      } else {
        toast.error(data.error || 'فشل تسجيل الدفع')
      }
    } catch (error) {
      console.error('Error recording payment:', error)
      toast.error('حدث خطأ')
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
    // تحديث رقم العضوية المعروض فوراً
    setFormData(prev => ({
      ...prev,
      memberNumberDisplay: memberNumber,
      // مسح الـ ID الداخلي إذا تم تعديل رقم العضوية
      memberId: ''
    }))

    // إلغاء البحث السابق إذا كان موجوداً
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // إذا كان رقم العضوية فارغاً، لا تفعل شيء
    if (!memberNumber || memberNumber.trim() === '') {
      return
    }

    // ⏱️ تأخير البحث لمدة 1.5 ثانية (1500ms)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        // البحث عن العضو برقم العضوية
        const response = await fetch(`/api/members?memberNumber=${memberNumber}`)
        if (response.ok) {
          const members = await response.json()
          // إذا وُجد عضو واحد على الأقل
          if (members && members.length > 0) {
            const member = members[0]
            // ملء البيانات تلقائياً
            setFormData(prev => ({
              ...prev,
              memberId: member.id, // ✅ ID الداخلي للإرسال للـ API
              memberNumberDisplay: member.memberNumber.toString(), // ✅ رقم العضوية للعرض
              clientName: member.name,
              phone: member.phone
            }))
            toast.success(`تم العثور على العضو: ${member.name}`)
          }
        }
      } catch (error) {
        // إذا لم يتم العثور على العضو، لا تفعل شيء
      }
    }, 1500) // ⏱️ 1.5 ثانية تأخير
  }

  const handleStaffChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value

    // البحث عن Staff إما بـ user.id أو staff.id
    const staff = staffList.find(s => (s.user?.id === selectedValue) || (s.id === selectedValue))

    if (staff) {
      setFormData({
        ...formData,
        coachUserId: selectedValue, // استخدم القيمة المحددة مباشرة
        coachName: staff.name
      })
    } else {
      // إذا لم يتم العثور على staff (empty option)
      setFormData({
        ...formData,
        coachUserId: '',
        coachName: ''
      })
    }
  }

  const handlePackageSelect = (pkg: any) => {
    // حساب تاريخ الانتهاء تلقائيًا من durationDays
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
    toast.success(`تم تطبيق باقة: ${pkg.name} (${pkg.durationDays} يوم)`)
  }

  const handleRenewPackageSelect = (pkg: any) => {
    // حساب تاريخ الانتهاء تلقائيًا من durationDays
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
    toast.success(`تم تطبيق باقة: ${pkg.name} (${pkg.durationDays} يوم)`)
  }

  const calculateExpiryFromMonths = (months: number) => {
    if (!formData.startDate) {
      toast.error('يرجى تحديد تاريخ البداية أولاً')
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
      return <span className="px-2 py-1 text-xs rounded bg-gray-200 dark:bg-gray-700">{t('more.inactive')}</span>
    }
    if (isExpired(sub.expiryDate)) {
      return <span className="px-2 py-1 text-xs rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">{t('more.expired')}</span>
    }
    if (sub.sessionsRemaining === 0) {
      return <span className="px-2 py-1 text-xs rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">{t('more.noSessions')}</span>
    }
    return <span className="px-2 py-1 text-xs rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">{t('more.active')}</span>
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
    <div className="p-6" dir={direction}>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">➕ {t('more.title')}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSessionForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            ✓ {t('more.registerSession')}
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            + {t('more.addSubscription')}
          </button>
        </div>
      </div>

      {/* 🔍 البحث والفلاتر السريعة */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border-2 border-primary-200 dark:border-primary-700" dir={direction}>
        <div className="mb-6">
          <input
            type="text"
            placeholder={`🔍 ${locale === 'ar' ? 'بحث (اسم العميل، الكوتش، رقم الاشتراك، هاتف)...' : 'Search (client, coach, number, phone)...'}`}
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
              <span>{locale === 'ar' ? 'فلاتر سريعة' : 'Quick Filters'}</span>
            </h3>
            {(statusFilter !== 'all' || filterSessions !== 'all') && (
              <button
                onClick={() => {
                  setStatusFilter('all')
                  setFilterSessions('all')
                }}
                className="bg-primary-100 text-primary-600 px-3 py-1.5 rounded-lg hover:bg-primary-200 text-sm font-medium"
              >
                ✖️ {locale === 'ar' ? 'إعادة تعيين' : 'Reset'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-3 rounded-xl font-bold transition-all transform hover:scale-105 ${
                statusFilter === 'all'
                  ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-xl border-2 border-primary-400'
                  : 'bg-white dark:bg-gray-800 border-2 border-primary-200 dark:border-primary-700 text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/50 hover:border-primary-300 shadow-md'
              }`}
            >
              <div className="text-xl mb-1">📊</div>
              <div className="text-xs">{locale === 'ar' ? 'كل الحالات' : 'All Statuses'}</div>
              <div className="text-lg font-bold dark:text-white">{moreSubscriptions.length}</div>
            </button>

            <button
              onClick={() => setStatusFilter('active')}
              className={`px-4 py-3 rounded-xl font-bold transition-all transform hover:scale-105 ${
                statusFilter === 'active'
                  ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-xl border-2 border-green-400'
                  : 'bg-white dark:bg-gray-800 border-2 border-green-200 dark:border-green-700 text-gray-700 dark:text-gray-200 hover:bg-green-50 dark:hover:bg-green-900/50 hover:border-green-300 shadow-md'
              }`}
            >
              <div className="text-xl mb-1">🟢</div>
              <div className="text-xs">{locale === 'ar' ? 'نشط' : 'Active'}</div>
              <div className="text-lg font-bold dark:text-white">
                {moreSubscriptions.filter(s => new Date(s.expiryDate) > new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length}
              </div>
            </button>

            <button
              onClick={() => setStatusFilter('expiring')}
              className={`px-4 py-3 rounded-xl font-bold transition-all transform hover:scale-105 ${
                statusFilter === 'expiring'
                  ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-xl border-2 border-orange-400'
                  : 'bg-white dark:bg-gray-800 border-2 border-orange-200 dark:border-orange-700 text-gray-700 dark:text-gray-200 hover:bg-orange-50 dark:hover:bg-orange-900/50 hover:border-orange-300 shadow-md'
              }`}
            >
              <div className="text-xl mb-1">🟡</div>
              <div className="text-xs">{locale === 'ar' ? 'قريب الانتهاء' : 'Expiring Soon'}</div>
              <div className="text-lg font-bold dark:text-white">
                {moreSubscriptions.filter(s => {
                  const exp = new Date(s.expiryDate)
                  const now = new Date()
                  return exp > now && exp <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                }).length}
              </div>
            </button>

            <button
              onClick={() => setStatusFilter('expired')}
              className={`px-4 py-3 rounded-xl font-bold transition-all transform hover:scale-105 ${
                statusFilter === 'expired'
                  ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-xl border-2 border-red-400'
                  : 'bg-white dark:bg-gray-800 border-2 border-red-200 dark:border-red-700 text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-red-900/50 hover:border-red-300 shadow-md'
              }`}
            >
              <div className="text-xl mb-1">🔴</div>
              <div className="text-xs">{locale === 'ar' ? 'منتهي' : 'Expired'}</div>
              <div className="text-lg font-bold dark:text-white">
                {moreSubscriptions.filter(s => new Date(s.expiryDate) <= new Date()).length}
              </div>
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
              <div className="text-sm">{locale === 'ar' ? 'كل الجلسات' : 'All Sessions'}</div>
            </button>

            <button
              onClick={() => setFilterSessions('low')}
              className={`px-4 py-2.5 rounded-lg font-bold transition-all transform hover:scale-105 ${
                filterSessions === 'low'
                  ? 'bg-gradient-to-br from-yellow-500 to-yellow-600 text-white shadow-lg border-2 border-yellow-400'
                  : 'bg-white dark:bg-gray-800 border-2 border-yellow-200 dark:border-yellow-700 text-gray-700 dark:text-gray-200 hover:bg-yellow-50 dark:hover:bg-yellow-900/50 hover:border-yellow-300 shadow'
              }`}
            >
              <div className="text-sm">{locale === 'ar' ? 'جلسات منخفضة (≤3)' : 'Low Sessions (≤3)'}</div>
              <div className="text-xs opacity-70">
                ({moreSubscriptions.filter(s => s.sessionsRemaining > 0 && s.sessionsRemaining <= 3).length})
              </div>
            </button>

            <button
              onClick={() => setFilterSessions('zero')}
              className={`px-4 py-2.5 rounded-lg font-bold transition-all transform hover:scale-105 ${
                filterSessions === 'zero'
                  ? 'bg-gradient-to-br from-gray-600 to-gray-700 text-white shadow-lg border-2 border-gray-500'
                  : 'bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 shadow'
              }`}
            >
              <div className="text-sm">{locale === 'ar' ? 'جلسات منتهية' : 'Zero Sessions'}</div>
              <div className="text-xs opacity-70">
                ({moreSubscriptions.filter(s => s.sessionsRemaining === 0).length})
              </div>
            </button>
          </div>
        </div>

        {/* 👨‍🏫 فلتر المدربين */}
        <div>
          <label className="block text-sm font-medium mb-2">👨‍🏫 {locale === 'ar' ? 'تصفية حسب الكوتش' : 'Filter by Coach'}</label>
          <select
            value={filterCoach}
            onChange={(e) => setFilterCoach(e.target.value)}
            className="w-full px-3 py-2.5 border-2 border-primary-200 dark:border-primary-600 rounded-lg focus:border-primary-400 focus:outline-none transition dark:bg-gray-700 dark:text-white"
          >
            <option value="">{locale === 'ar' ? 'كل الكوتشات' : 'All Coaches'}</option>
            {(Array.from(new Set(moreSubscriptions.map(s => s.coachName).filter((name): name is string => !!name))) as string[]).sort().map(coach => (
              <option key={coach} value={coach}>{coach}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-8">{t('common.loading')}</div>
      ) : filteredSubscriptions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">{t('more.noSubscriptions')}</div>
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
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border-2 hover:shadow-lg dark:hover:shadow-2xl transition ${
                  expired
                    ? 'border-red-300 dark:border-red-700'
                    : isExpiringSoon
                      ? 'border-orange-300 dark:border-orange-700'
                      : 'border-gray-200 dark:border-gray-600'
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
                        : 'bg-gradient-to-r from-primary-600 to-primary-700 dark:from-primary-700 dark:to-primary-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-white/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-lg text-white/80">👤</span>
                      </div>
                      <div>
                        <div className="font-bold text-white text-base">{sub.clientName}</div>
                        <div className="text-white/80 text-xs">
                          #{sub.moreNumber} • {sub.phone}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold text-white ${
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
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300 mb-1">
                      <span>{locale === 'ar' ? 'الكوتش' : 'Coach'}: {sub.coachName}</span>
                      <span>{Math.round(progressPercent)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
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
                    <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-green-700 dark:text-green-300 font-semibold">
                        {locale === 'ar' ? 'الإجمالي' : 'Total'}
                      </div>
                      <div className="text-sm font-bold text-green-600 dark:text-green-400">
                        {(sub.totalAmount || sub.sessionsPurchased * sub.pricePerSession).toFixed(0)} {t('members.egp')}
                      </div>
                    </div>
                    <div
                      className={`border rounded-lg p-2 text-center ${
                        (sub.remainingAmount || 0) > 0
                          ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700'
                          : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      <div
                        className={`text-[10px] font-semibold ${
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
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-green-600 dark:text-green-400'
                        }`}
                      >
                        {(sub.remainingAmount || 0).toFixed(0)} {t('members.egp')}
                      </div>
                    </div>
                  </div>

                  {/* Dates */}
                  {(sub.startDate || sub.expiryDate) && (
                    <div
                      className={`border rounded-lg p-2 text-xs font-mono ${
                        expired
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                          : isExpiringSoon
                            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700'
                            : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>📅</span>
                        {sub.startDate && <span>{formatDateYMD(sub.startDate)}</span>}
                        {sub.startDate && sub.expiryDate && <span>→</span>}
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
                      className="bg-green-600 text-white py-2 rounded-lg text-sm hover:bg-green-700 dark:hover:bg-green-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed font-bold flex items-center justify-center gap-1"
                    >
                      ✅ {locale === 'ar' ? 'حضور' : 'Attend'}
                    </button>
                    <button
                      onClick={() => {
                        setRenewFormData({
                          ...renewFormData,
                          oldMoreNumber: sub.moreNumber.toString()
                        })
                        setShowRenewForm(true)
                      }}
                      className="bg-primary-600 text-white py-2 rounded-lg text-sm hover:bg-primary-700 dark:hover:bg-primary-800 font-bold flex items-center justify-center gap-1"
                    >
                      🔄 {locale === 'ar' ? 'تجديد' : 'Renew'}
                    </button>
                    {(sub.remainingAmount || 0) > 0 && (
                      <button
                        onClick={() => handleOpenPayment(sub)}
                        className="col-span-2 bg-orange-600 text-white py-2 rounded-lg text-sm hover:bg-orange-700 dark:hover:bg-orange-800 font-bold flex items-center justify-center gap-1"
                      >
                        <span>💰</span>
                        <span>
                          {locale === 'ar' ? 'دفع الباقي' : 'Pay Remaining'} ({(sub.remainingAmount || 0).toFixed(0)} {t('members.egp')})
                        </span>
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenEdit(sub)}
                      className="bg-primary-600 text-white py-2 rounded-lg text-sm hover:bg-primary-700 dark:hover:bg-primary-800 font-bold flex items-center justify-center gap-1"
                    >
                      <span>✏️</span>
                      <span>{locale === 'ar' ? 'تعديل' : 'Edit'}</span>
                    </button>
                    {hasPermission('canDeleteMore') && (
                      <button
                        onClick={() => handleDeleteSubscription(sub.moreNumber)}
                        className="bg-red-600 text-white py-2 rounded-lg text-sm hover:bg-red-700 dark:hover:bg-red-800 font-bold flex items-center justify-center gap-1"
                      >
                        <span>🗑️</span>
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

      {/* ✏️ Edit Modal */}
      {editingMore && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10000] p-4" dir={direction}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                ✏️ {locale === 'ar' ? `تعديل الاشتراك #${editingMore.moreNumber}` : `Edit Subscription #${editingMore.moreNumber}`}
              </h3>
              <button
                onClick={() => setEditingMore(null)}
                disabled={editSubmitting}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-3xl leading-none disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">{locale === 'ar' ? 'اسم العميل' : 'Client Name'}</label>
                <input
                  type="text"
                  value={editFormData.clientName}
                  onChange={(e) => setEditFormData({ ...editFormData, clientName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{locale === 'ar' ? 'الهاتف' : 'Phone'}</label>
                <input
                  type="text"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{locale === 'ar' ? 'الكوتش' : 'Coach'}</label>
                <input
                  type="text"
                  value={editFormData.coachName}
                  onChange={(e) => setEditFormData({ ...editFormData, coachName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{locale === 'ar' ? 'جلسات متبقية' : 'Sessions Remaining'}</label>
                <input
                  type="number"
                  value={editFormData.sessionsRemaining}
                  onChange={(e) => setEditFormData({ ...editFormData, sessionsRemaining: parseInt(e.target.value) || 0 })}
                  min="0"
                  className="w-full px-3 py-2 border rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{locale === 'ar' ? 'إجمالي الجلسات' : 'Total Sessions'}</label>
                <input
                  type="number"
                  value={editFormData.sessionsPurchased}
                  onChange={(e) => setEditFormData({ ...editFormData, sessionsPurchased: parseInt(e.target.value) || 0 })}
                  min="0"
                  className="w-full px-3 py-2 border rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{locale === 'ar' ? 'سعر الجلسة' : 'Price / Session'}</label>
                <input
                  type="number"
                  value={editFormData.pricePerSession}
                  onChange={(e) => setEditFormData({ ...editFormData, pricePerSession: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{locale === 'ar' ? 'الإجمالي' : 'Total Amount'}</label>
                <input
                  type="number"
                  value={editFormData.totalAmount}
                  onChange={(e) => setEditFormData({ ...editFormData, totalAmount: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">💰 {locale === 'ar' ? 'المتبقي' : 'Remaining Amount'}</label>
                <input
                  type="number"
                  value={editFormData.remainingAmount}
                  onChange={(e) => setEditFormData({ ...editFormData, remainingAmount: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border-2 border-orange-300 dark:border-orange-600 rounded-lg dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{locale === 'ar' ? 'تاريخ البداية' : 'Start Date'}</label>
                <input
                  type="date"
                  value={editFormData.startDate}
                  onChange={(e) => setEditFormData({ ...editFormData, startDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{locale === 'ar' ? 'تاريخ الانتهاء' : 'Expiry Date'}</label>
                <input
                  type="date"
                  value={editFormData.expiryDate}
                  onChange={(e) => setEditFormData({ ...editFormData, expiryDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium mb-1">{locale === 'ar' ? 'ملاحظات' : 'Notes'}</label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div className="p-6 border-t dark:border-gray-700 flex gap-3 sticky bottom-0 bg-white dark:bg-gray-800">
              <button
                onClick={handleSaveEdit}
                disabled={editSubmitting}
                className="flex-1 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {editSubmitting ? '⏳ ...' : `💾 ${locale === 'ar' ? 'حفظ التعديلات' : 'Save Changes'}`}
              </button>
              <button
                onClick={() => setEditingMore(null)}
                disabled={editSubmitting}
                className="px-6 py-3 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-lg hover:bg-gray-400"
              >
                {locale === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 💰 Payment Modal */}
      {paymentMore && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10000] p-4" dir={direction}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                💰 {locale === 'ar' ? 'دفع المتبقي' : 'Pay Remaining'}
              </h3>
              <button
                onClick={() => setPaymentMore(null)}
                disabled={paymentSubmitting}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-3xl leading-none disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-sm">
                <p><strong>{locale === 'ar' ? 'العميل:' : 'Client:'}</strong> {paymentMore.clientName}</p>
                <p><strong>{locale === 'ar' ? 'رقم الاشتراك:' : 'Subscription #:'}</strong> {paymentMore.moreNumber}</p>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-300 dark:border-orange-700 rounded-lg p-3">
                <p className="text-sm text-orange-700 dark:text-orange-300 font-semibold mb-1">
                  {locale === 'ar' ? 'المبلغ المتبقي الحالي:' : 'Current Remaining:'}
                </p>
                <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                  {(paymentMore.remainingAmount || 0).toFixed(0)} {t('members.egp')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {locale === 'ar' ? 'المبلغ المدفوع' : 'Payment Amount'}
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  min="0"
                  max={paymentMore.remainingAmount || 0}
                  step="0.01"
                  className="w-full px-3 py-3 border-2 border-green-300 dark:border-green-600 rounded-lg text-lg font-bold dark:bg-gray-700 dark:text-white focus:border-green-500"
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(paymentMore.remainingAmount || 0)}
                    className="text-xs px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200"
                  >
                    {locale === 'ar' ? 'دفع كل المتبقي' : 'Pay All'}
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span>{locale === 'ar' ? 'المتبقي بعد الدفع:' : 'Remaining After:'}</span>
                  <span className="font-bold">
                    {Math.max(0, (paymentMore.remainingAmount || 0) - paymentAmount).toFixed(0)} {t('members.egp')}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t dark:border-gray-700 flex gap-3">
              <button
                onClick={handleConfirmPayment}
                disabled={paymentSubmitting || paymentAmount <= 0 || paymentAmount > (paymentMore.remainingAmount || 0)}
                className="flex-1 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {paymentSubmitting ? '⏳ ...' : `💾 ${locale === 'ar' ? 'تأكيد الدفع' : 'Confirm'}`}
              </button>
              <button
                onClick={() => setPaymentMore(null)}
                disabled={paymentSubmitting}
                className="px-6 py-3 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-lg hover:bg-gray-400"
              >
                {locale === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📝 نموذج إضافة اشتراك (Popup) */}
      {showAddForm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddForm(false) }}
          dir={direction}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border-2 border-pink-200 dark:border-pink-700"
            onClick={(e) => e.stopPropagation()}
          >
          <div className="sticky top-0 bg-white dark:bg-gray-800 z-10 flex justify-between items-center p-6 border-b dark:border-gray-700">
            <h2 className="text-2xl font-bold text-pink-600 dark:text-pink-400">
              {t('more.addSubscription')}
            </h2>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-3xl text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors leading-none"
            >
              ×
            </button>
          </div>
          <form onSubmit={handleAddSubscription} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('more.clientName')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder={t('more.clientName')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('more.phone')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="01xxxxxxxxx"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  رقم العضوية (Member Number)
                </label>
                <input
                  type="text"
                  value={formData.memberNumberDisplay}
                  onChange={(e) => handleMemberIdChange(e.target.value)}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="1234"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  💡 سيتم ملء الاسم والهاتف تلقائياً
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('more.coachName')} <span className="text-red-600">*</span>
                </label>
                <select
                  required
                  value={formData.coachUserId}
                  onChange={handleStaffChange}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white"
                >
                  <option value="">{t('more.selectCoach')}</option>
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.user?.id || staff.id}>
                      {staff.name} {staff.position && `(${staff.position})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* اختيار باقة جاهزة */}
              {packages.length > 0 && (
                <div className="col-span-full">
                  <label className="block text-sm font-medium mb-2">
                    ⚡ {t('more.selectPackage')}
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {packages.map((pkg) => (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => handlePackageSelect(pkg)}
                        className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/30 dark:to-pink-900/30 hover:from-pink-100 hover:to-pink-200 dark:hover:from-pink-800/40 dark:hover:to-pink-800/40 border-2 border-pink-300 dark:border-pink-700 rounded-lg p-3 transition-all hover:scale-105 hover:shadow-lg dark:text-white"
                      >
                        <div className="text-center">
                          <div className="text-2xl mb-1">➕</div>
                          <div className="font-bold text-gray-800 dark:text-gray-100 text-sm">{pkg.name}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                            {pkg.sessions} {t('more.sessions')}
                          </div>
                          {pkg.durationDays && (
                            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                              📅 {pkg.durationDays} يوم
                            </div>
                          )}
                          <div className="text-lg font-bold text-pink-600 dark:text-pink-400 mt-1">
                            {pkg.price} EGP
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    💡 يمكنك تعديل القيم بعد اختيار الباقة
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('more.sessionsPurchased')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.sessionsPurchased}
                  onChange={(e) => setFormData({ ...formData, sessionsPurchased: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="8"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  السعر الإجمالي <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.totalPrice}
                  onChange={(e) => setFormData({ ...formData, totalPrice: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-yellow-50 dark:bg-yellow-900/50 border-yellow-300 dark:border-yellow-600 dark:text-white"
                  placeholder="1600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('more.startDate')} <span className="text-xs text-gray-500 dark:text-gray-400">(yyyy-mm-dd)</span>
                </label>
                <input
                  type="text"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg font-mono dark:bg-gray-700 dark:text-white"
                  placeholder="2025-01-01"
                  pattern="\d{4}-\d{2}-\d{2}"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('more.expiryDate')} <span className="text-xs text-gray-500 dark:text-gray-400">(yyyy-mm-dd)</span>
                </label>
                <input
                  type="text"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg font-mono dark:bg-gray-700 dark:text-white"
                  placeholder="2025-02-01"
                  pattern="\d{4}-\d{2}-\d{2}"
                />
              </div>
            </div>

            {/* Quick Add للشهور */}
            <div>
              <p className="text-sm font-medium mb-2">⚡ إضافة سريعة:</p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 6, 9, 12].map(months => (
                  <button
                    key={months}
                    type="button"
                    onClick={() => calculateExpiryFromMonths(months)}
                    className="px-3 py-2 bg-pink-100 hover:bg-pink-200 text-pink-800 rounded-lg text-sm transition font-medium"
                  >
                    + {months} {months === 1 ? 'شهر' : 'أشهر'}
                  </button>
                ))}
              </div>
            </div>

            {/* طريقة الدفع */}
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

            {/* الإجمالي */}
            {formData.sessionsPurchased && formData.totalPrice && (
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">💰 المبلغ الكلي:</span>
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {parseFloat(formData.totalPrice).toFixed(2)} EGP
                  </span>
                </div>
              </div>
            )}

            {/* ملاحظات */}
            <div>
              <label className="block text-sm font-medium mb-1">{t('more.notes')}</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                rows={3}
                placeholder="ملاحظات إضافية..."
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-pink-600 text-white py-2 rounded-lg hover:bg-pink-700 disabled:bg-gray-400 transition-colors"
              >
                {loading ? 'جاري الحفظ...' : t('common.save')}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSessionForm(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">{t('more.registerSession')}</h2>
            <form onSubmit={handleRegisterSession} className="space-y-4">
              <div>
                <label className="block mb-1">{t('more.subscriptionNumber')} *</label>
                <input
                  type="number"
                  value={sessionFormData.moreNumber}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, moreNumber: e.target.value })}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                  required
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowSessionForm(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {t('more.registerSession')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {showRenewForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowRenewForm(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">{t('more.renewSubscription')}</h2>
            <form onSubmit={handleRenewSubscription} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block mb-1">{t('more.oldSubscriptionNumber')} *</label>
                  <input
                    type="number"
                    value={renewFormData.oldMoreNumber}
                    onChange={(e) => setRenewFormData({ ...renewFormData, oldMoreNumber: e.target.value })}
                    className="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                    required
                  />
                </div>

                {/* Package Selector */}
                {packages.length > 0 && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-2">
                      ⚡ {t('more.selectPackage')}
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {packages.map((pkg) => (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => handleRenewPackageSelect(pkg)}
                          className="bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/30 dark:to-pink-900/30 hover:from-pink-100 hover:to-pink-200 dark:hover:from-pink-800/40 dark:hover:to-pink-800/40 border-2 border-pink-300 dark:border-pink-700 rounded-lg p-3 transition-all hover:scale-105 hover:shadow-lg dark:text-white"
                        >
                          <div className="text-center">
                            <div className="text-2xl mb-1">🔄</div>
                            <div className="font-bold text-gray-800 dark:text-gray-100 text-sm">{pkg.name}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                              {pkg.sessions} {t('more.sessions')}
                            </div>
                            {pkg.durationDays && (
                              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                📅 {pkg.durationDays} يوم
                              </div>
                            )}
                            <div className="text-lg font-bold text-pink-600 dark:text-pink-400 mt-1">
                              {pkg.price} EGP
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      💡 يمكنك تعديل القيم بعد اختيار الباقة
                    </p>
                  </div>
                )}

                <div>
                  <label className="block mb-1">{t('more.sessionsPurchased')} *</label>
                  <input
                    type="number"
                    value={renewFormData.sessionsPurchased}
                    onChange={(e) => setRenewFormData({ ...renewFormData, sessionsPurchased: e.target.value })}
                    className="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                    required
                    min="1"
                  />
                </div>
                <div>
                  <label className="block mb-1">{t('more.totalPrice')}</label>
                  <input
                    type="number"
                    value={renewFormData.totalPrice}
                    onChange={(e) => setRenewFormData({ ...renewFormData, totalPrice: e.target.value })}
                    className="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block mb-1">{t('more.startDate')}</label>
                  <input
                    type="date"
                    value={renewFormData.startDate}
                    onChange={(e) => setRenewFormData({ ...renewFormData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>
                <div>
                  <label className="block mb-1">{t('more.expiryDate')}</label>
                  <input
                    type="date"
                    value={renewFormData.expiryDate}
                    onChange={(e) => setRenewFormData({ ...renewFormData, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>
                <div>
                  <label className="block mb-1">{t('more.paymentMethod')}</label>
                  <select
                    value={typeof renewFormData.paymentMethod === 'string' ? renewFormData.paymentMethod : 'mixed'}
                    onChange={(e) => setRenewFormData({ ...renewFormData, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                  >
                    <option value="cash">{t('common.cash')}</option>
                    <option value="card">{t('common.card')}</option>
                    <option value="instapay">{t('common.instapay')}</option>
                    <option value="wallet">{t('common.wallet')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block mb-1">{t('more.notes')}</label>
                <textarea
                  value={renewFormData.notes}
                  onChange={(e) => setRenewFormData({ ...renewFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowRenewForm(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  {t('more.renewSubscription')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

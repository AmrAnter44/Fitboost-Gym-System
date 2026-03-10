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
  const { t, direction } = useLanguage()
  const toast = useToast()
  const { settings } = useServiceSettings()

  const [moreSubscriptions, setMoreSubscriptions] = useState<More[]>([])
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<More[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Debounce timeout للبحث عن العضو
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Form states
  const [showAddForm, setShowAddForm] = useState(false)
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [showRenewForm, setShowRenewForm] = useState(false)
  const [selectedMore, setSelectedMore] = useState<More | null>(null)

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

    // Debug: اطبع معلومات المستخدم والصلاحيات
    console.log('🔍 More Page Debug:', {
      user: user?.role,
      hasCanViewMore: hasPermission('canViewMore'),
      moreEnabled: settings.moreEnabled
    })

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
  }, [searchTerm, statusFilter, moreSubscriptions])

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

    // Status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter(sub => sub.isActive && new Date(sub.expiryDate) > new Date())
    } else if (statusFilter === 'expired') {
      filtered = filtered.filter(sub => new Date(sub.expiryDate) <= new Date())
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(sub => !sub.isActive)
    } else if (statusFilter === 'noSessions') {
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
        console.log('Member not found or error:', error)
      }
    }, 1500) // ⏱️ 1.5 ثانية تأخير
  }

  const handleStaffChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value
    console.log('🔍 Staff Change:', { selectedValue, staffListLength: staffList.length })

    // البحث عن Staff إما بـ user.id أو staff.id
    const staff = staffList.find(s => (s.user?.id === selectedValue) || (s.id === selectedValue))
    console.log('🔍 Found Staff:', staff ? { name: staff.name, userId: staff.user?.id, staffId: staff.id } : 'NOT FOUND')

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

      {/* Filters */}
      <div className="mb-4 flex gap-4">
        <input
          type="text"
          placeholder={t('more.search')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border rounded dark:bg-gray-800 dark:border-gray-700"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded dark:bg-gray-800 dark:border-gray-700"
        >
          <option value="all">{t('more.allSubscriptions')}</option>
          <option value="active">{t('more.active')}</option>
          <option value="expired">{t('more.expired')}</option>
          <option value="inactive">{t('more.inactive')}</option>
          <option value="noSessions">{t('more.noSessions')}</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-8">{t('common.loading')}</div>
      ) : filteredSubscriptions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">{t('more.noSubscriptions')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className="border p-2">{t('more.subscriptionNumber')}</th>
                <th className="border p-2">{t('more.clientName')}</th>
                <th className="border p-2">{t('more.phone')}</th>
                <th className="border p-2">{t('more.coachName')}</th>
                <th className="border p-2">{t('more.sessions')}</th>
                <th className="border p-2">{t('more.expiryDate')}</th>
                <th className="border p-2">{t('more.status')}</th>
                <th className="border p-2">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubscriptions.map((sub) => (
                <tr key={sub.moreNumber} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="border p-2 text-center">{sub.moreNumber}</td>
                  <td className="border p-2">{sub.clientName}</td>
                  <td className="border p-2">{sub.phone}</td>
                  <td className="border p-2">{sub.coachName}</td>
                  <td className="border p-2 text-center">
                    {sub.sessionsRemaining} / {sub.sessionsPurchased}
                  </td>
                  <td className="border p-2 text-center">{formatDateYMD(sub.expiryDate)}</td>
                  <td className="border p-2 text-center">{getStatusBadge(sub)}</td>
                  <td className="border p-2 text-center">
                    <button
                      onClick={() => {
                        setSessionFormData({ moreNumber: sub.moreNumber.toString(), notes: '' })
                        setShowSessionForm(true)
                      }}
                      disabled={sub.sessionsRemaining === 0 || isExpired(sub.expiryDate) || !sub.isActive}
                      className="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => {
                        setRenewFormData({
                          ...renewFormData,
                          oldMoreNumber: sub.moreNumber.toString()
                        })
                        setShowRenewForm(true)
                      }}
                      className="px-2 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 mx-1"
                    >
                      🔄
                    </button>
                    {hasPermission('canDeleteMore') && (
                      <button
                        onClick={() => handleDeleteSubscription(sub.moreNumber)}
                        className="px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 📝 نموذج إضافة اشتراك */}
      {showAddForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 mb-6 border-2 border-pink-200 dark:border-pink-700" dir={direction}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-pink-600 dark:text-pink-400">
              {t('more.addSubscription')}
            </h2>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-2xl text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              ✕
            </button>
          </div>
          <form onSubmit={handleAddSubscription} className="space-y-6">
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

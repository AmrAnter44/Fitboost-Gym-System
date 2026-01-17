'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '../../hooks/usePermissions'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast } from '../../contexts/ToastContext'
import PermissionDenied from '../../components/PermissionDenied'
import { formatDateYMD } from '../../lib/dateFormatter'
import { useConfirm } from '../../hooks/useConfirm'
import ConfirmDialog from '../../components/ConfirmDialog'
import PaymentMethodSelector from '../../components/Paymentmethodselector'
import type { PaymentMethod } from '../../lib/paymentHelpers'

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

  const [sessions, setSessions] = useState<PTSession[]>([])
  const [coaches, setCoaches] = useState<Staff[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingSession, setEditingSession] = useState<PTSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [coachesLoading, setCoachesLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
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

  const [isDayUse, setIsDayUse] = useState(false)

  const [formData, setFormData] = useState<{
    ptNumber: string
    clientName: string
    phone: string
    sessionsPurchased: number
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
    coachName: '',
    totalPrice: 0,
    remainingAmount: 0,
    startDate: formatDateYMD(new Date()),
    expiryDate: '',
    paymentMethod: 'cash',
    staffName: user?.name || '',
  })

  useEffect(() => {
    fetchSessions()
    fetchCoaches()
  }, [])

  useEffect(() => {
    if (user && !formData.staffName) {
      setFormData(prev => ({ ...prev, staffName: user.name }))
    }
  }, [user])

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/pt')

      if (response.status === 401) {
        router.push('/login')
        return
      }

      if (response.status === 403) {
        return
      }

      const data = await response.json()
      setSessions(data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCoaches = async () => {
    try {
      const response = await fetch('/api/staff')
      const data: Staff[] = await response.json()
      const activeCoaches = data.filter(
        (staff) => staff.isActive && staff.position?.toLowerCase().includes('مدرب')
      )
      setCoaches(activeCoaches)
    } catch (error) {
      console.error('Error fetching coaches:', error)
    } finally {
      setCoachesLoading(false)
    }
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
      coachName: session.coachName,
      totalPrice: totalPrice,
      remainingAmount: 0, // Will be populated if PT model has it
      startDate: session.startDate ? formatDateYMD(session.startDate) : '',
      expiryDate: session.expiryDate ? formatDateYMD(session.expiryDate) : '',
      paymentMethod: 'cash',
      staffName: user?.name || '',
    })
    setEditingSession(session)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

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
        fetchSessions()
        resetForm()
      } else {
        toast.error(`${t('pt.messages.operationFailed')} - ${result.error || ''}`)
      }
    } catch (error) {
      console.error(error)
      toast.error(t('pt.messages.error'))
    } finally {
      setLoading(false)
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

    try {
      const response = await fetch(`/api/pt?ptNumber=${ptNumber}`, { method: 'DELETE' })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || t('pt.messages.deleteFailed'))
      }

      toast.success(t('pt.messages.sessionDeleted'))
      fetchSessions()
    } catch (error: any) {
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

  const handleOpenPaymentModal = (session: PTSession) => {
    setPaymentSession(session)
    setPaymentFormData({
      paymentAmount: session.remainingAmount || 0,
      paymentMethod: 'cash'
    })
    setShowPaymentModal(true)
  }

  const handlePayRemaining = async () => {
    if (!paymentSession) return

    try {
      setLoading(true)
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
        fetchSessions()
        setShowPaymentModal(false)
        setPaymentSession(null)
      } else {
        toast.error(`${t('pt.messages.paymentFailed')} - ${result.error || ''}`)
      }
    } catch (error) {
      console.error('Error paying remaining:', error)
      toast.error(t('pt.messages.paymentFailed'))
    } finally {
      setLoading(false)
    }
  }

  const filteredSessions = sessions.filter((session) => {
    // البحث النصي
    const matchesSearch =
      session.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.coachName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.ptNumber.toString().includes(searchTerm) ||
      session.phone.includes(searchTerm)

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

    return matchesSearch && matchesCoach && matchesStatus && matchesSessions
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

  const isCoach = user?.role === 'COACH'

  return (
    <div className="container mx-auto p-4 sm:p-6" dir={direction}>
      <div className="mb-6">
        <div className="mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">💪 {t('pt.title')}</h1>
          <p className="text-sm sm:text-base text-gray-600">
            {isCoach ? t('pt.viewSessions') : t('pt.manageSessions')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button
            onClick={() => router.push('/pt/commission')}
            className="flex-1 min-w-[140px] sm:flex-none bg-gradient-to-r from-purple-600 to-purple-700 text-white px-3 sm:px-6 py-2 rounded-lg hover:from-purple-700 hover:to-purple-800 transition shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <span>💰</span>
            <span>{t('pt.commissionCalculator')}</span>
          </button>
          <button
            onClick={() => router.push('/pt/sessions/history')}
            className="flex-1 min-w-[140px] sm:flex-none bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-3 sm:px-6 py-2 rounded-lg hover:from-indigo-700 hover:to-indigo-800 transition shadow-lg flex items-center justify-center gap-2 text-sm sm:text-base"
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
              className="w-full sm:w-auto bg-blue-600 text-white px-3 sm:px-6 py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              {showForm ? t('pt.hideForm') : `➕ ${t('pt.addNewSession')}`}
            </button>
          )}
        </div>
      </div>

      {!isCoach && showForm && (
        <div className="bg-white p-6 rounded-xl shadow-lg mb-6 border-2 border-blue-100" dir={direction}>
          <h2 className="text-xl font-semibold mb-4">
            {editingSession ? t('pt.editSession') : t('pt.addSession')}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('pt.ptId')} <span className="text-xs text-gray-500">(اختياري)</span>
                </label>
                <input
                  type="number"
                  disabled={!!editingSession}
                  value={formData.ptNumber}
                  onChange={(e) => setFormData({ ...formData, ptNumber: e.target.value })}
                  onKeyPress={handleIdKeyPress}
                  className="w-full px-3 py-2 border rounded-lg disabled:bg-gray-100"
                  placeholder="اختياري - يمكن تركه فارغ"
                />
                <p className="text-xs text-gray-500 mt-1">💡 اضغط Enter لتحميل بيانات العضو تلقائياً</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('pt.clientName')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
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
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder={t('pt.phonePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('pt.coachName')} <span className="text-red-600">*</span>
                </label>
                {coachesLoading ? (
                  <div className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500">
                    {t('pt.loadingCoaches')}
                  </div>
                ) : coaches.length === 0 ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      required
                      value={formData.coachName}
                      onChange={(e) => setFormData({ ...formData, coachName: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
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
                    className="w-full px-3 py-2 border rounded-lg bg-white"
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

              {/* Day Use Checkbox */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDayUse}
                    onChange={(e) => {
                      setIsDayUse(e.target.checked)
                      // إذا تم تفعيل Day Use، اضبط عدد الجلسات على 1 والمبلغ المتبقي على 0
                      if (e.target.checked) {
                        setFormData(prev => ({
                          ...prev,
                          sessionsPurchased: 1,
                          remainingAmount: 0
                        }))
                      }
                    }}
                    className="w-5 h-5"
                  />
                  <div>
                    <span className="text-sm font-bold text-blue-800">
                      🏃 Day Use (استخدام يومي)
                    </span>
                    <p className="text-xs text-blue-600 mt-1">
                      تسجيل مبسط - اسم ورقم وسعر الجلسة فقط
                    </p>
                  </div>
                </label>
              </div>

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
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder={t('pt.sessionsPlaceholder')}
                  />
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
                  className="w-full px-3 py-2 border rounded-lg bg-yellow-50 border-yellow-300"
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
                    className="w-full px-3 py-2 border rounded-lg bg-orange-50 border-orange-300"
                    placeholder={t('pt.remainingAmountPlaceholder')}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t('pt.remainingAmountNote')}
                  </p>
                </div>
              )}

              {!isDayUse && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('pt.startDate')} <span className="text-xs text-gray-500">{t('pt.startDateFormat')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg font-mono"
                    placeholder={t('pt.startDatePlaceholder')}
                    pattern="\d{4}-\d{2}-\d{2}"
                  />
                </div>
              )}

              {!isDayUse && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t('pt.expiryDate')} <span className="text-xs text-gray-500">{t('pt.startDateFormat')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg font-mono"
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
                      className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-sm transition font-medium"
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
              />
            </div>

            {formData.sessionsPurchased > 0 && formData.totalPrice > 0 && (
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">{t('pt.finalTotal')}</span>
                  <span className="text-2xl font-bold text-green-600">
                    {formData.totalPrice.toFixed(2)} {t('pt.egp')}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2 text-sm border-t pt-2">
                  <span className="font-semibold text-blue-700">{t('pt.paidAmount')}</span>
                  <span className="font-bold text-blue-600">
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
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? t('pt.saving') : editingSession ? t('pt.updateButton') : t('pt.addSessionButton')}
              </button>
              {editingSession && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                >
                  {t('pt.cancelButton')}
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-4 mb-6" dir={direction}>
        <div className="mb-4">
          <input
            type="text"
            placeholder={`🔍 ${t('pt.searchPlaceholder')}`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border-2 rounded-lg text-lg"
          />
        </div>

        {/* الفلاتر */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* فلتر المدرب */}
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('pt.filterByCoach')}</label>
            <select
              value={filterCoach}
              onChange={(e) => setFilterCoach(e.target.value)}
              className="w-full px-3 py-2 border-2 rounded-lg"
            >
              <option value="">{t('pt.allCoaches')}</option>
              {Array.from(new Set(sessions.map(s => s.coachName))).sort().map(coach => (
                <option key={coach} value={coach}>{coach}</option>
              ))}
            </select>
          </div>

          {/* فلتر الحالة */}
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('pt.filterByStatus')}</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-3 py-2 border-2 rounded-lg"
            >
              <option value="all">{t('pt.allStatus')}</option>
              <option value="active">{t('pt.statusActive')}</option>
              <option value="expiring">{t('pt.statusExpiring')}</option>
              <option value="expired">{t('pt.statusExpired')}</option>
            </select>
          </div>

          {/* فلتر الجلسات */}
          <div>
            <label className="block text-sm font-medium mb-1.5">{t('pt.filterBySessions')}</label>
            <select
              value={filterSessions}
              onChange={(e) => setFilterSessions(e.target.value as any)}
              className="w-full px-3 py-2 border-2 rounded-lg"
            >
              <option value="all">{t('pt.allSessions')}</option>
              <option value="low">{t('pt.sessionsLow')}</option>
              <option value="zero">{t('pt.sessionsZero')}</option>
            </select>
          </div>
        </div>

        {/* زر إعادة تعيين الفلاتر */}
        {(filterCoach || filterStatus !== 'all' || filterSessions !== 'all') && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => {
                setFilterCoach('')
                setFilterStatus('all')
                setFilterSessions('all')
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm font-medium"
            >
              🔄 {t('pt.resetFilters')}
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">{t('pt.loading')}</div>
      ) : (
        <>
          {/* Desktop Table - Hidden on mobile/tablet */}
          <div className="hidden lg:block bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" dir={direction}>
                <thead className="bg-gray-100">
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
                        className={`border-t hover:bg-gray-50 ${
                          isExpired ? 'bg-red-50' : isExpiringSoon ? 'bg-yellow-50' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span className="font-bold text-blue-600">#{session.ptNumber}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-semibold">{session.clientName}</p>
                            <p className="text-sm text-gray-600">{session.phone}</p>
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
                            <p className="text-xs text-gray-500">{t('pt.of')} {session.sessionsPurchased}</p>
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
                              <button
                                onClick={() => handleRegisterSession(session)}
                                disabled={session.sessionsRemaining === 0}
                                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                              >
                                {t('pt.attendance')}
                              </button>
                              <button
                                onClick={() => handleRenew(session)}
                                className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700"
                              >
                                {t('pt.renew')}
                              </button>
                              {(session.remainingAmount || 0) > 0 && (
                                <button
                                  onClick={() => handleOpenPaymentModal(session)}
                                  className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700"
                                >
                                  {t('pt.payRemaining')}
                                </button>
                              )}
                              {session.qrCode && (
                                <>
                                  <button
                                    onClick={() => {
                                      setSelectedSession(session)
                                      setShowQRModal(true)
                                    }}
                                    className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 flex items-center gap-1"
                                  >
                                    {t('pt.barcode')}
                                  </button>
                                  <button
                                    onClick={() => {
                                      const checkInUrl = `${window.location.origin}/pt/check-in`
                                      const text = t('pt.whatsappWithBarcode', {
                                        clientName: session.clientName,
                                        qrCode: session.qrCode,
                                        checkInUrl,
                                        sessionsRemaining: session.sessionsRemaining.toString(),
                                        sessionsPurchased: session.sessionsPurchased.toString(),
                                        coachName: session.coachName
                                      })
                                      const phone = session.phone.startsWith('0') ? '2' + session.phone : session.phone
                                      const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
                                      window.open(whatsappUrl, '_blank')
                                    }}
                                    className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 flex items-center gap-1"
                                  >
                                    {t('pt.whatsapp')}
                                  </button>
                                </>
                              )}
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
                  className={`bg-white rounded-xl shadow-md overflow-hidden border-2 hover:shadow-lg transition ${
                    isExpired ? 'border-red-300 bg-red-50' : isExpiringSoon ? 'border-orange-300 bg-orange-50' : 'border-gray-200'
                  }`}
                >
                  {/* Header */}
                  <div className={`p-2.5 ${isExpired ? 'bg-red-600' : isExpiringSoon ? 'bg-orange-600' : 'bg-gradient-to-r from-purple-600 to-purple-700'}`}>
                    <div className="flex items-center justify-between">
                      <div className="text-xl font-bold text-white">#{session.ptNumber}</div>
                      <div className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        session.sessionsRemaining === 0 ? 'bg-red-500' : session.sessionsRemaining <= 3 ? 'bg-orange-500' : 'bg-green-500'
                      } text-white`}>
                        {session.sessionsRemaining} / {session.sessionsPurchased} {t('pt.session')}
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-3 space-y-2.5">
                    {/* Client Info */}
                    <div className="pb-2.5 border-b-2 border-gray-100">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">👤</span>
                        <span className="text-xs text-gray-500 font-semibold">{t('pt.client')}</span>
                      </div>
                      <div className="text-base font-bold text-gray-800">{session.clientName}</div>
                      <div className="text-sm font-mono text-gray-600 mt-1">{session.phone}</div>
                    </div>

                    {/* Coach */}
                    <div className="pb-2.5 border-b-2 border-gray-100">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">🏋️</span>
                        <span className="text-xs text-gray-500 font-semibold">{t('pt.coach')}</span>
                      </div>
                      <div className="text-base font-bold text-gray-800">{session.coachName}</div>
                    </div>

                    {/* Price Info */}
                    <div className="bg-green-50 border-2 border-green-200 rounded-lg p-2.5">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-sm">💵</span>
                        <span className="text-xs text-green-700 font-semibold">{t('pt.total')}</span>
                      </div>
                      <div className="text-base font-bold text-green-600">
                        {(session.sessionsPurchased * session.pricePerSession).toFixed(0)} {t('pt.egp')}
                      </div>
                    </div>

                    {/* Remaining Amount */}
                    {(session.remainingAmount || 0) > 0 && (
                      <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-2.5">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-sm">⚠️</span>
                          <span className="text-xs text-orange-700 font-semibold">{t('pt.remainingAmountLabel')}</span>
                        </div>
                        <div className="text-base font-bold text-orange-600">
                          {(session.remainingAmount || 0).toFixed(0)} {t('pt.egp')}
                        </div>
                      </div>
                    )}

                    {/* Dates */}
                    {(session.startDate || session.expiryDate) && (
                      <div className={`border-2 rounded-lg p-2.5 ${
                        isExpired ? 'bg-red-50 border-red-300' : isExpiringSoon ? 'bg-orange-50 border-orange-300' : 'bg-gray-50 border-gray-200'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm">📅</span>
                          <span className={`text-xs font-semibold ${
                            isExpired ? 'text-red-700' : isExpiringSoon ? 'text-orange-700' : 'text-gray-700'
                          }`}>{t('pt.period')}</span>
                        </div>
                        <div className="space-y-1 text-xs font-mono">
                          {session.startDate && (
                            <div className="text-gray-700">{t('pt.from')} {formatDateYMD(session.startDate)}</div>
                          )}
                          {session.expiryDate && (
                            <div className={isExpired ? 'text-red-600 font-bold' : 'text-gray-700'}>
                              {t('pt.to')} {formatDateYMD(session.expiryDate)}
                            </div>
                          )}
                          {isExpired && (
                            <div className="text-red-600 font-bold">{t('pt.expired')}</div>
                          )}
                          {!isExpired && isExpiringSoon && (
                            <div className="text-orange-600 font-bold">{t('pt.expiringSoon')}</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {!isCoach && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          onClick={() => handleRegisterSession(session)}
                          disabled={session.sessionsRemaining === 0}
                          className="bg-green-600 text-white py-2 rounded-lg text-sm hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold flex items-center justify-center gap-1"
                        >
                          {t('pt.attendance')}
                        </button>
                        <button
                          onClick={() => handleRenew(session)}
                          className="bg-purple-600 text-white py-2 rounded-lg text-sm hover:bg-purple-700 font-bold flex items-center justify-center gap-1"
                        >
                          {t('pt.renew')}
                        </button>
                        {(session.remainingAmount || 0) > 0 && (
                          <button
                            onClick={() => handleOpenPaymentModal(session)}
                            className="col-span-2 bg-orange-600 text-white py-2 rounded-lg text-sm hover:bg-orange-700 font-bold flex items-center justify-center gap-1"
                          >
                            <span>💰</span>
                            <span>{t('pt.payRemaining').replace('💰 ', '')} ({(session.remainingAmount || 0).toFixed(0)} {t('pt.egp')})</span>
                          </button>
                        )}
                        {session.qrCode && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedSession(session)
                                setShowQRModal(true)
                              }}
                              className="bg-blue-500 text-white py-2 rounded-lg text-sm hover:bg-blue-600 font-bold flex items-center justify-center gap-1"
                            >
                              {t('pt.barcode')}
                            </button>
                            <button
                              onClick={() => {
                                const checkInUrl = `${window.location.origin}/pt/check-in`
                                const text = t('pt.whatsappWithBarcode', {
                                  clientName: session.clientName,
                                  qrCode: session.qrCode,
                                  checkInUrl,
                                  sessionsRemaining: session.sessionsRemaining.toString(),
                                  sessionsPurchased: session.sessionsPurchased.toString(),
                                  coachName: session.coachName
                                })
                                const phone = session.phone.startsWith('0') ? '2' + session.phone : session.phone
                                const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
                                window.open(whatsappUrl, '_blank')
                              }}
                              className="bg-green-500 text-white py-2 rounded-lg text-sm hover:bg-green-600 font-bold flex items-center justify-center gap-1"
                            >
                              {t('pt.whatsapp')}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDelete(session.ptNumber)}
                          className="bg-red-600 text-white py-2 rounded-lg text-sm hover:bg-red-700 font-bold flex items-center justify-center gap-1 col-span-2"
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
            <div className="bg-white rounded-lg shadow-md p-12 text-center text-gray-500">
              <div className="text-6xl mb-4">📋</div>
              <p className="text-xl">{searchTerm ? t('pt.noSearchResults') : t('pt.noSessions')}</p>
            </div>
          )}
        </>
      )}

      {/* Barcode Modal */}
      {showQRModal && selectedSession && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" dir={direction}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">{t('pt.barcodeModal.title')} - {selectedSession.clientName}</h2>
              <button
                onClick={() => {
                  setShowQRModal(false)
                  setSelectedSession(null)
                }}
                className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* معلومات الاشتراك */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">{t('pt.ptNumber')}:</span>
                    <span className="font-bold mr-2">#{selectedSession.ptNumber}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">{t('pt.coach')}:</span>
                    <span className="font-bold mr-2">{selectedSession.coachName}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">{t('pt.barcodeModal.sessionsRemaining')}</span>
                    <span className="font-bold mr-2 text-green-600">
                      {selectedSession.sessionsRemaining} / {selectedSession.sessionsPurchased}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">{t('pt.barcodeModal.phone')}</span>
                    <span className="font-bold mr-2">{selectedSession.phone}</span>
                  </div>
                </div>
              </div>

              {/* Barcode Image */}
              {selectedSession.qrCodeImage ? (
                <div className="flex flex-col items-center bg-white border-2 border-gray-200 rounded-lg p-6">
                  <img
                    src={selectedSession.qrCodeImage}
                    alt="Barcode"
                    className="w-full max-w-md h-auto"
                  />
                  <p className="text-xs text-gray-500 mt-3 text-center">
                    {t('pt.barcodeModal.scanNote')}
                  </p>
                </div>
              ) : (
                <div className="bg-gray-100 rounded-lg p-6 text-center">
                  <p className="text-gray-500">{t('pt.barcodeModal.noBarcode')}</p>
                </div>
              )}

              {/* Barcode Text */}
              <div className="bg-gray-50 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('pt.barcodeModal.ptCode')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={selectedSession.qrCode}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white border-2 border-gray-300 rounded-lg font-mono text-sm"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedSession.qrCode || '')
                      toast.success(t('pt.barcodeModal.codeCopied'))
                    }}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 text-sm font-medium"
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
                  className="bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-bold flex items-center justify-center gap-2"
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

              <div className="bg-blue-50 border-r-4 border-blue-500 p-3 rounded">
                <p className="text-xs text-blue-800">
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" dir={direction}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">{t('pt.paymentModal.title')}</h2>
              <button
                onClick={() => {
                  setShowPaymentModal(false)
                  setPaymentSession(null)
                }}
                className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* معلومات الاشتراك */}
              <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-lg p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('pt.ptNumber')}:</span>
                    <span className="font-bold">#{paymentSession.ptNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('pt.client')}:</span>
                    <span className="font-bold">{paymentSession.clientName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t('pt.coach')}:</span>
                    <span className="font-bold">{paymentSession.coachName}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-orange-700 font-semibold">{t('pt.paymentModal.remainingAmount')}</span>
                    <span className="font-bold text-orange-600 text-lg">
                      {(paymentSession.remainingAmount || 0).toFixed(0)} {t('pt.egp')}
                    </span>
                  </div>
                </div>
              </div>

              {/* مبلغ الدفع */}
              <div>
                <label className="block text-sm font-bold mb-2">
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
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-lg font-bold"
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
                    className="flex-1 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-sm font-medium"
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
                />
              </div>

              {/* المبلغ المتبقي بعد الدفع */}
              {paymentFormData.paymentAmount > 0 && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-blue-700 font-semibold">
                      {t('pt.paymentModal.remainingAfterPayment')}
                    </span>
                    <span className="text-lg font-bold text-blue-600">
                      {((paymentSession.remainingAmount || 0) - paymentFormData.paymentAmount).toFixed(0)} {t('pt.egp')}
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
                  className="bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 font-bold"
                >
                  {t('pt.deleteConfirm.cancel')}
                </button>
                <button
                  onClick={handlePayRemaining}
                  disabled={loading || paymentFormData.paymentAmount <= 0 || paymentFormData.paymentAmount > (paymentSession.remainingAmount || 0)}
                  className="bg-orange-600 text-white py-3 rounded-lg hover:bg-orange-700 font-bold disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? t('pt.paymentModal.paying') : t('pt.paymentModal.confirmPayment')}
                </button>
              </div>

              {/* ملاحظة */}
              <div className="bg-orange-50 border-r-4 border-orange-500 p-3 rounded">
                <p className="text-xs text-orange-800">
                  {t('pt.paymentModal.note')}
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
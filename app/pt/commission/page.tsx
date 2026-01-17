'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../../../contexts/LanguageContext'

interface Staff {
  id: string
  name: string
  phone?: string
  position?: string
  salary?: number
  notes?: string
  isActive: boolean
  createdAt: string
}

interface PTSession {
  ptNumber: number
  clientName: string
  phone: string
  sessionsPurchased: number
  sessionsRemaining: number
  coachName: string
  pricePerSession: number
  startDate: string | null
  expiryDate: string | null
  createdAt: string
}

interface CoachEarnings {
  coachName: string
  totalSessions: number
  completedSessions: number
  remainingSessions: number
  totalRevenue: number
  clients: number
}

interface CommissionResult {
  coachName: string
  monthlyIncome: number
  percentage: number
  commission: number
  gymShare: number
}

interface MemberSignupCommission {
  coachId: string
  coachName: string
  staffCode: string
  count: number
  totalAmount: number
  commissions: Array<{
    id: string
    amount: number
    description: string
    createdAt: string
  }>
}

interface PTCommission {
  id: string
  amount: number
  description: string
  notes: string
  createdAt: string
}

interface Receipt {
  receiptNumber: number
  type: string
  amount: number
  itemDetails: string
  createdAt: string
  ptNumber?: number
}

export default function CoachCommissionPage() {
  const { t } = useLanguage()
  const [coaches, setCoaches] = useState<Staff[]>([])
  const [ptSessions, setPtSessions] = useState<PTSession[]>([])
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [selectedCoach, setSelectedCoach] = useState<string>('')
  const [customIncome, setCustomIncome] = useState<string>('')
  const [useCustomIncome, setUseCustomIncome] = useState(false)
  const [result, setResult] = useState<CommissionResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [coachEarnings, setCoachEarnings] = useState<CoachEarnings | null>(null)
  const [memberSignupCommissions, setMemberSignupCommissions] = useState<MemberSignupCommission[]>([])
  const [ptCommissions, setPtCommissions] = useState<PTCommission[]>([])

  // تحديد الفترة الزمنية (أول يوم في الشهر الحالي إلى آخر يوم)
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  const [dateFrom, setDateFrom] = useState(firstDay.toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(lastDay.toISOString().split('T')[0])

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    fetchMemberSignupCommissions()
  }, [dateFrom, dateTo])

  // اختيار الكوتش تلقائياً إذا كان واحد فقط (حالة الكوتش المسجل دخوله)
  useEffect(() => {
    if (coaches.length === 1 && !selectedCoach) {
      setSelectedCoach(coaches[0].name)
    }
  }, [coaches])

  const fetchData = async () => {
    try {
      // جلب الكوتشات
      const staffResponse = await fetch('/api/staff')
      const staffData: Staff[] = await staffResponse.json()
      const activeCoaches = staffData.filter(
        (staff) => staff.isActive && staff.position?.toLowerCase().includes('مدرب')
      )
      setCoaches(activeCoaches)

      // جلب جلسات PT
      const ptResponse = await fetch('/api/pt')
      const ptData: PTSession[] = await ptResponse.json()
      setPtSessions(ptData)

      // جلب الإيصالات
      const receiptsResponse = await fetch('/api/receipts')
      const receiptsData: Receipt[] = await receiptsResponse.json()
      setReceipts(receiptsData)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMemberSignupCommissions = async () => {
    try {
      const response = await fetch(`/api/commissions/member-signups?startDate=${dateFrom}&endDate=${dateTo}`)
      if (response.ok) {
        const data = await response.json()
        setMemberSignupCommissions(data)
        console.log('💰 عمولات تسجيل الأعضاء:', data)
      }
    } catch (error) {
      console.error('Error fetching member signup commissions:', error)
    }
  }

  const fetchPTCommissions = async (coachName: string, startDate: string, endDate: string): Promise<PTCommission[]> => {
    try {
      // جلب جميع العمولات
      const response = await fetch('/api/commissions')
      if (!response.ok) return []

      const allCommissions = await response.json()

      // فلترة عمولات PT للكوتش في الفترة المحددة
      const start = new Date(startDate)
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)

      const filtered = allCommissions.filter((c: any) => {
        if (c.type !== 'pt_payment') return false
        if (c.staff?.name !== coachName) return false

        const commissionDate = new Date(c.createdAt)
        return commissionDate >= start && commissionDate <= end
      })

      return filtered
    } catch (error) {
      console.error('Error fetching PT commissions:', error)
      return []
    }
  }

  // دالة حساب النسبة حسب الدخل الشهري
  const calculatePercentage = (income: number): number => {
    if (income < 5000) return 25
    if (income < 11000) return 30
    if (income < 15000) return 35
    if (income < 20000) return 40
    return 45
  }

  // دالة حساب أرباح الكوتش من PT (من الإيصالات - الطريقة الصحيحة)
  const calculateCoachEarnings = (coachName: string, startDate: string, endDate: string): CoachEarnings => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    // حساب الإيرادات من إيصالات PT (برايفت جديد + تجديد برايفت + دفع باقي برايفت)
    const ptReceipts = receipts.filter((receipt) => {
      // فلترة إيصالات PT فقط
      if (receipt.type !== 'برايفت جديد' && receipt.type !== 'تجديد برايفت' && receipt.type !== 'دفع باقي برايفت') return false

      // التحقق من التاريخ
      const receiptDate = new Date(receipt.createdAt)
      if (receiptDate < start || receiptDate > end) return false

      // التحقق من اسم الكوتش في itemDetails
      try {
        const details = JSON.parse(receipt.itemDetails)
        return details.coachName === coachName
      } catch {
        return false
      }
    })

    console.log('💰 إيصالات PT للكوتش', coachName, ':', ptReceipts.length, 'إيصال')

    // حساب الإيرادات من الإيصالات (المبالغ الفعلية المدفوعة)
    const ptRevenue = ptReceipts.reduce((sum, receipt) => sum + receipt.amount, 0)

    // إضافة عمولات تسجيل الأعضاء
    const coachSignupCommissions = memberSignupCommissions.find(c => c.coachName === coachName)
    const signupRevenue = coachSignupCommissions?.totalAmount || 0

    console.log('💵 إيرادات الكوتش', coachName, ':', {
      ptRevenue,
      signupRevenue,
      total: ptRevenue + signupRevenue
    })

    // إجمالي الإيرادات = PT + تسجيل الأعضاء
    const totalRevenue = ptRevenue + signupRevenue

    // جمع بيانات الجلسات للإحصائيات (من أرقام PT في الإيصالات)
    const ptNumbersFromReceipts = new Set(
      ptReceipts.map((receipt) => {
        try {
          const details = JSON.parse(receipt.itemDetails)
          return details.ptNumber
        } catch {
          return null
        }
      }).filter(Boolean)
    )

    // الحصول على معلومات الجلسات الفعلية من جدول PT
    const relatedSessions = ptSessions.filter((session) =>
      ptNumbersFromReceipts.has(session.ptNumber) && session.coachName === coachName
    )

    const totalSessions = relatedSessions.reduce((sum, s) => sum + s.sessionsPurchased, 0)
    const remainingSessions = relatedSessions.reduce((sum, s) => sum + s.sessionsRemaining, 0)
    const completedSessions = totalSessions - remainingSessions
    const clients = new Set(relatedSessions.map((s) => s.clientName)).size

    return {
      coachName,
      totalSessions,
      completedSessions,
      remainingSessions,
      totalRevenue,
      clients,
    }
  }

  // دالة حساب التحصيل
  const handleCalculate = async () => {
    if (!selectedCoach) {
      alert(t('pt.commission.selectCoach'))
      return
    }

    const coach = coaches.find((c) => c.name === selectedCoach)
    if (!coach) return

    // حساب أرباح الكوتش من PT
    const earnings = calculateCoachEarnings(selectedCoach, dateFrom, dateTo)
    setCoachEarnings(earnings)

    // ✅ جلب عمولات PT المحفوظة
    const ptCommissionsData = await fetchPTCommissions(selectedCoach, dateFrom, dateTo)
    setPtCommissions(ptCommissionsData)

    // جمع عمولات PT
    const ptCommission = ptCommissionsData.reduce((sum, c) => sum + c.amount, 0)

    // جمع عمولات الأعضاء (الكوتش ياخدها كاملة)
    const coachSignupCommissions = memberSignupCommissions.find(c => c.coachName === selectedCoach)
    const signupRevenue = coachSignupCommissions?.totalAmount || 0

    // إجمالي العمولة = عمولة PT + عمولة تسجيل الأعضاء
    const totalCommission = ptCommission + signupRevenue

    // حساب إجمالي الإيرادات للعرض فقط
    const start = new Date(dateFrom)
    const end = new Date(dateTo)
    end.setHours(23, 59, 59, 999)

    const coachPTReceipts = receipts.filter((receipt) => {
      if (receipt.type !== 'برايفت جديد' && receipt.type !== 'تجديد برايفت' && receipt.type !== 'دفع باقي برايفت') return false
      const receiptDate = new Date(receipt.createdAt)
      if (receiptDate < start || receiptDate > end) return false
      try {
        const details = JSON.parse(receipt.itemDetails)
        return details.coachName === selectedCoach
      } catch {
        return false
      }
    })
    const ptRevenue = coachPTReceipts.reduce((sum, receipt) => sum + receipt.amount, 0)

    const totalIncome = ptRevenue + signupRevenue
    const gymShare = totalIncome - totalCommission

    // حساب النسبة المتوسطة بناءً على إجمالي إيرادات PT
    const averagePercentage = ptRevenue > 0 ? calculatePercentage(ptRevenue) : 0

    setResult({
      coachName: selectedCoach,
      monthlyIncome: totalIncome,
      percentage: averagePercentage,
      commission: totalCommission,
      gymShare: gymShare,
    })
  }

  // دالة مسح البيانات
  const handleReset = () => {
    setSelectedCoach('')
    setCustomIncome('')
    setUseCustomIncome(false)
    setResult(null)
    setCoachEarnings(null)
  }

  // دالة تحديد لون النسبة حسب المستوى
  const getPercentageBgColor = (percentage: number): string => {
    if (percentage <= 25) return 'from-orange-500 to-orange-600'
    if (percentage <= 30) return 'from-yellow-500 to-yellow-600'
    if (percentage <= 35) return 'from-blue-500 to-blue-600'
    if (percentage <= 40) return 'from-purple-500 to-purple-600'
    return 'from-green-500 to-green-600'
  }

  // إحصائيات عامة للكوتشات
  const allCoachesStats = coaches.map((coach) => {
    const earnings = calculateCoachEarnings(coach.name, dateFrom, dateTo)
    return {
      coachName: coach.name,
      earnings,
    }
  })

  return (
    <div className="container mx-auto p-6" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="text-5xl">💰</div>
          <div>
            <h1 className="text-4xl font-bold">{t('pt.commission.title')}</h1>
            <p className="text-gray-600 mt-1">
              {t('pt.commission.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Time Period Selection */}
      <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
        <label className="block text-sm font-bold mb-3 text-gray-700">
          📅 {t('pt.commission.selectPeriod')}
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">{t('pt.commission.fromDate')}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">{t('pt.commission.toDate')}</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span>📋</span>
            <span>{t('pt.commission.calculationData')}</span>
          </h2>

          {loading ? (
            <div className="text-center py-12 text-gray-500">{t('pt.commission.loading')}</div>
          ) : coaches.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">😕</div>
              <p className="text-gray-600">{t('pt.commission.noActiveCoaches')}</p>
              <p className="text-sm text-gray-500 mt-2">
                {t('pt.commission.addCoachesHint')}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Coach Selection */}
              <div>
                <label className="block text-sm font-bold mb-3 text-gray-700">
                  👤 {coaches.length === 1 ? t('pt.commission.theCoach') : t('pt.commission.selectCoach')} <span className="text-red-600">*</span>
                </label>
                {coaches.length === 1 ? (
                  <div className="w-full px-4 py-3 bg-blue-50 border-2 border-blue-200 rounded-lg text-lg font-bold text-blue-700">
                    {coaches[0].name} {coaches[0].phone && `(${coaches[0].phone})`}
                  </div>
                ) : (
                  <select
                    value={selectedCoach}
                    onChange={(e) => {
                      setSelectedCoach(e.target.value)
                      setResult(null)
                      setCoachEarnings(null)
                    }}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                  >
                    <option value="">{t('pt.commission.selectCoachOption')}</option>
                    {coaches.map((coach) => (
                      <option key={coach.id} value={coach.name}>
                        {coach.name} {coach.phone && `(${coach.phone})`}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Custom Income Option */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomIncome}
                    onChange={(e) => setUseCustomIncome(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded"
                  />
                  <span className="text-sm font-bold text-gray-700">
                    {t('pt.commission.useCustomIncome')}
                  </span>
                </label>
              </div>

              {/* Custom Income Input */}
              {useCustomIncome && (
                <div>
                  <label className="block text-sm font-bold mb-3 text-gray-700">
                    💵 {t('pt.commission.customMonthlyIncome')} <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={customIncome}
                    onChange={(e) => setCustomIncome(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                    placeholder={t('pt.commission.exampleIncome')}
                  />
                </div>
              )}

              {/* جدول النسب */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-5">
                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <span>📊</span>
                  <span>{t('pt.commission.percentageTable')}</span>
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
                    <span>{t('pt.commission.lessThan5000')}</span>
                    <span className="font-bold text-orange-600">25%</span>
                  </div>
                  <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
                    <span>{t('pt.commission.range5000to11000')}</span>
                    <span className="font-bold text-yellow-600">30%</span>
                  </div>
                  <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
                    <span>{t('pt.commission.range11000to15000')}</span>
                    <span className="font-bold text-blue-600">35%</span>
                  </div>
                  <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
                    <span>{t('pt.commission.range15000to20000')}</span>
                    <span className="font-bold text-purple-600">40%</span>
                  </div>
                  <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
                    <span>{t('pt.commission.over20000')}</span>
                    <span className="font-bold text-green-600">45%</span>
                  </div>
                </div>
              </div>

              {/* أزرار التحكم */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCalculate}
                  disabled={!selectedCoach || (useCustomIncome && !customIncome)}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed font-bold text-lg shadow-lg transform transition hover:scale-105 active:scale-95"
                >
                  ✅ {t('pt.commission.calculateButton')}
                </button>
                {result && (
                  <button
                    onClick={handleReset}
                    className="px-6 bg-gradient-to-r from-gray-200 to-gray-300 text-gray-700 py-4 rounded-lg hover:from-gray-300 hover:to-gray-400 font-bold shadow-lg transform transition hover:scale-105 active:scale-95"
                  >
                    🔄 {t('pt.commission.resetButton')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Calculation Result */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span>📈</span>
            <span>{t('pt.commission.result')}</span>
          </h2>

          {!result ? (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <div className="text-8xl mb-6">🧮</div>
              <p className="text-gray-500 text-lg text-center">
                {t('pt.commission.selectCoachToCalculate')}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* بطاقة الكوتش */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-3xl">👤</div>
                  <div>
                    <p className="text-sm text-gray-600">{t('pt.commission.coach')}</p>
                    <p className="text-2xl font-bold text-indigo-900">{result.coachName}</p>
                  </div>
                </div>
              </div>

              {/* تفصيل إيصالات PT */}
              {coachEarnings && !useCustomIncome && (() => {
                const start = new Date(dateFrom)
                const end = new Date(dateTo)
                end.setHours(23, 59, 59, 999)

                const coachPTReceipts = receipts.filter((receipt) => {
                  if (receipt.type !== 'برايفت جديد' && receipt.type !== 'تجديد برايفت' && receipt.type !== 'دفع باقي برايفت') return false
                  const receiptDate = new Date(receipt.createdAt)
                  if (receiptDate < start || receiptDate > end) return false
                  try {
                    const details = JSON.parse(receipt.itemDetails)
                    return details.coachName === result.coachName
                  } catch {
                    return false
                  }
                })

                return coachPTReceipts.length > 0 ? (
                  <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border-2 border-teal-200 rounded-xl p-5">
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                      <span>📊</span>
                      <span>إيصالات PT ({coachPTReceipts.length})</span>
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {coachPTReceipts.map((receipt, index) => {
                        let details: any = {}
                        try {
                          details = JSON.parse(receipt.itemDetails)
                        } catch {}
                        return (
                          <div key={receipt.receiptNumber} className="bg-white rounded-lg p-3 border border-teal-200">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <div className="bg-teal-100 text-teal-800 font-bold w-8 h-8 rounded-full flex items-center justify-center text-sm">
                                  {index + 1}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-800">
                                    إيصال #{receipt.receiptNumber} - {receipt.type}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {details.clientName || 'N/A'} - PT #{details.ptNumber || 'N/A'}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(receipt.createdAt).toLocaleDateString('ar-EG', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                    })}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-teal-600">{receipt.amount.toLocaleString('ar-EG')} جنيه</p>
                              </div>
                            </div>
                            {details.sessionsPurchased && (
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                <div className="bg-gray-50 rounded p-2 text-center">
                                  <p className="text-xs text-gray-600">الحصص</p>
                                  <p className="text-sm font-bold text-gray-800">{details.sessionsPurchased}</p>
                                </div>
                                <div className="bg-gray-50 rounded p-2 text-center">
                                  <p className="text-xs text-gray-600">السعر/حصة</p>
                                  <p className="text-sm font-bold text-gray-800">{details.pricePerSession}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-3 pt-3 border-t-2 border-teal-200">
                      <div className="flex justify-between items-center bg-teal-100 rounded-lg p-3">
                        <span className="font-bold text-gray-700">إجمالي إيرادات PT:</span>
                        <span className="text-xl font-bold text-teal-600">
                          {coachPTReceipts.reduce((sum, receipt) => sum + receipt.amount, 0).toLocaleString('ar-EG')} جنيه
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null
              })()}

              {/* تفصيل اشتراكات الأعضاء */}
              {coachEarnings && !useCustomIncome && (() => {
                const coachSignupData = memberSignupCommissions.find(c => c.coachName === result.coachName)
                return coachSignupData && coachSignupData.count > 0 ? (
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-5">
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                      <span>💵</span>
                      <span>اشتراكات الأعضاء ({coachSignupData.count})</span>
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {coachSignupData.commissions.map((commission, index) => (
                        <div key={commission.id} className="bg-white rounded-lg p-3 flex items-center justify-between border border-green-200">
                          <div className="flex items-center gap-3">
                            <div className="bg-green-100 text-green-800 font-bold w-8 h-8 rounded-full flex items-center justify-center text-sm">
                              {index + 1}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{commission.description || 'تسجيل عضو جديد'}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(commission.createdAt).toLocaleDateString('ar-EG', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-green-600">{commission.amount} جنيه</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t-2 border-green-200">
                      <div className="flex justify-between items-center bg-green-100 rounded-lg p-3">
                        <span className="font-bold text-gray-700">إجمالي عمولات الاشتراكات:</span>
                        <span className="text-xl font-bold text-green-600">{coachSignupData.totalAmount} جنيه</span>
                      </div>
                      <div className="mt-2 bg-green-200 rounded-lg p-2 text-center">
                        <p className="text-xs font-bold text-green-800">✅ الكوتش ياخد المبلغ كامل 100%</p>
                      </div>
                    </div>
                  </div>
                ) : null
              })()}

              {/* تفاصيل عمولات PT */}
              {ptCommissions.length > 0 && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <span>💎</span>
                    <span>تفاصيل عمولات PT ({ptCommissions.length} دفعة)</span>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-blue-100 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-right text-xs font-bold text-gray-700 border-b border-blue-200">التاريخ</th>
                          <th className="px-3 py-2 text-right text-xs font-bold text-gray-700 border-b border-blue-200">الوصف</th>
                          <th className="px-3 py-2 text-right text-xs font-bold text-gray-700 border-b border-blue-200">المبلغ المدفوع</th>
                          <th className="px-3 py-2 text-right text-xs font-bold text-gray-700 border-b border-blue-200">النسبة</th>
                          <th className="px-3 py-2 text-right text-xs font-bold text-gray-700 border-b border-blue-200">العمولة</th>
                        </tr>
                      </thead>
                      <tbody className="max-h-80 overflow-y-auto">
                        {ptCommissions.map((comm, index) => {
                          const notes = JSON.parse(comm.notes || '{}')
                          return (
                            <tr key={comm.id} className={`border-b border-blue-100 ${index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}`}>
                              <td className="px-3 py-2 text-sm text-gray-700">
                                {new Date(comm.createdAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-800">{comm.description}</td>
                              <td className="px-3 py-2 text-sm font-mono text-gray-700">
                                {notes.paymentAmount?.toLocaleString('ar-EG') || 0} ج.م
                              </td>
                              <td className="px-3 py-2 text-sm text-blue-600 font-bold">{notes.percentage || 0}%</td>
                              <td className="px-3 py-2 text-sm text-green-600 font-bold">
                                {comm.amount.toLocaleString('ar-EG')} ج.م
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 pt-3 border-t-2 border-blue-200">
                    <div className="flex justify-between items-center bg-blue-100 rounded-lg p-3">
                      <span className="font-bold text-gray-700">إجمالي عمولات PT:</span>
                      <span className="text-xl font-bold text-blue-600">
                        {ptCommissions.reduce((sum, c) => sum + c.amount, 0).toLocaleString('ar-EG')} جنيه
                      </span>
                    </div>
                    <div className="mt-2 bg-blue-200 rounded-lg p-2 text-center">
                      <p className="text-xs font-bold text-blue-800">
                        ⚡ كل دفعة محسوبة بنسبة مستقلة
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* الدخل الشهري */}
              <div className="bg-gradient-to-br from-cyan-50 to-blue-50 border-2 border-cyan-200 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-3xl">💵</div>
                  <div>
                    <p className="text-sm text-gray-600">
                      {useCustomIncome ? t('pt.commission.customIncome') : t('pt.commission.totalPTIncome')}
                    </p>
                    <p className="text-3xl font-bold text-cyan-900">
                      {result.monthlyIncome.toLocaleString('ar-EG', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      <span className="text-xl">{t('pt.commission.egp')}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* النسبة */}
              <div
                className={`bg-gradient-to-br ${getPercentageBgColor(
                  result.percentage
                )} text-white rounded-xl p-6 shadow-lg`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/90 text-sm mb-1">{t('pt.commission.percentage')}</p>
                    <p className="text-5xl font-black">{result.percentage}%</p>
                    <p className="text-white/70 text-xs mt-2">على إيرادات PT فقط</p>
                  </div>
                  <div className="text-6xl opacity-30">📊</div>
                </div>
              </div>

              {/* المبلغ المستحق للكوتش */}
              <div className="bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-xl p-6 shadow-xl border-4 border-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-4xl">💰</div>
                  <div>
                    <p className="text-white/90 text-sm">{t('pt.commission.coachDue')}</p>
                    <p className="text-4xl font-black">
                      {result.commission.toLocaleString('ar-EG', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      <span className="text-2xl">{t('pt.commission.egp')}</span>
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t-2 border-white/30">
                  {!useCustomIncome && (() => {
                    const coachSignupData = memberSignupCommissions.find(c => c.coachName === result.coachName)
                    const signupRevenue = coachSignupData?.totalAmount || 0
                    if (signupRevenue > 0) {
                      return (
                        <p className="text-white/90 text-xs text-center">
                          💡 العمولة = (PT × {result.percentage}%) + عمولات الاشتراكات ({signupRevenue} جنيه)
                        </p>
                      )
                    }
                    return (
                      <p className="text-white/80 text-sm text-center">
                        ✨ {t('pt.commission.percentageNote', { percentage: result.percentage.toString() })}
                      </p>
                    )
                  })()}
                </div>
              </div>

              {/* معادلة الحساب */}
              <div className="bg-gradient-to-br from-slate-50 to-gray-100 border-2 border-slate-300 rounded-xl p-5">
                <h3 className="font-bold text-center mb-3 text-gray-700">معادلة الحساب</h3>
                <div className="bg-white rounded-lg p-4 text-center">
                  {!useCustomIncome && (() => {
                    const start = new Date(dateFrom)
                    const end = new Date(dateTo)
                    end.setHours(23, 59, 59, 999)

                    const coachPTReceipts = receipts.filter((receipt) => {
                      if (receipt.type !== 'برايفت جديد' && receipt.type !== 'تجديد برايفت' && receipt.type !== 'دفع باقي برايفت') return false
                      const receiptDate = new Date(receipt.createdAt)
                      if (receiptDate < start || receiptDate > end) return false
                      try {
                        const details = JSON.parse(receipt.itemDetails)
                        return details.coachName === result.coachName
                      } catch {
                        return false
                      }
                    })
                    const ptRevenue = coachPTReceipts.reduce((sum, receipt) => sum + receipt.amount, 0)
                    const coachSignupData = memberSignupCommissions.find(c => c.coachName === result.coachName)
                    const signupRevenue = coachSignupData?.totalAmount || 0
                    const ptCommission = (ptRevenue * result.percentage) / 100

                    if (signupRevenue > 0) {
                      return (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-700">
                            <span className="font-bold text-teal-600">{ptRevenue.toLocaleString('ar-EG')}</span> (PT) ×
                            <span className="font-bold text-purple-600"> {result.percentage}%</span> =
                            <span className="font-bold text-green-600"> {ptCommission.toLocaleString('ar-EG')}</span>
                          </p>
                          <p className="text-lg font-bold text-gray-500">+</p>
                          <p className="text-sm text-gray-700">
                            <span className="font-bold text-green-600">{signupRevenue.toLocaleString('ar-EG')}</span> (عمولات اشتراكات)
                          </p>
                          <div className="border-t-2 border-gray-300 pt-2 mt-2">
                            <p className="text-lg font-bold">
                              المجموع = <span className="text-green-600">{result.commission.toLocaleString('ar-EG', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}</span> {t('pt.commission.egp')}
                            </p>
                          </div>
                        </div>
                      )
                    } else {
                      return (
                        <p className="text-lg">
                          {result.monthlyIncome.toLocaleString('ar-EG')} × {result.percentage}% ={' '}
                          <span className="font-bold text-green-600">
                            {result.commission.toLocaleString('ar-EG', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>{' '}
                          {t('pt.commission.egp')}
                        </p>
                      )
                    }
                  })()}
                </div>
              </div>

              {/* ملاحظة */}
              <div className="bg-amber-50 border-r-4 border-amber-500 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">⚠️</div>
                  <div>
                    <p className="font-bold text-amber-800 mb-1">{t('pt.commission.importantNote')}</p>
                    <p className="text-sm text-amber-700">
                      {t('pt.commission.displayOnlyNote')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* إحصائيات إضافية */}
      {result && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-md p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">{t('pt.commission.gymShare')}</p>
                <p className="text-2xl font-bold text-blue-600">
                  {result.gymShare.toLocaleString('ar-EG', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  {t('pt.commission.egp')}
                </p>
              </div>
              <div className="text-4xl">🏢</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">{t('pt.commission.gymPercentage')}</p>
                <p className="text-2xl font-bold text-purple-600">{100 - result.percentage}%</p>
              </div>
              <div className="text-4xl">📉</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">{t('pt.commission.incomeStatus')}</p>
                <p className="text-lg font-bold text-green-600">
                  {result.monthlyIncome >= 20000
                    ? `🔥 ${t('pt.commission.excellent')}`
                    : result.monthlyIncome >= 15000
                    ? `✅ ${t('pt.commission.veryGood')}`
                    : result.monthlyIncome >= 10000
                    ? `👍 ${t('pt.commission.good')}`
                    : `💪 ${t('pt.commission.needsImprovement')}`}
                </p>
              </div>
              <div className="text-4xl">⭐</div>
            </div>
          </div>
        </div>
      )}

      {/* جدول ملخص جميع الكوتشات */}
      {!loading && coaches.length > 0 && (
        <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span>📋</span>
            <span>
              {t('pt.commission.allCoachesSummary', {
                fromDate: new Date(dateFrom).toLocaleDateString('ar-EG'),
                toDate: new Date(dateTo).toLocaleDateString('ar-EG')
              })}
            </span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-100 to-gray-200">
                <tr>
                  <th className="px-4 py-3 text-right">{t('pt.commission.coach')}</th>
                  <th className="px-4 py-3 text-right">{t('pt.commission.clients')}</th>
                  <th className="px-4 py-3 text-right">{t('pt.commission.totalSessions')}</th>
                  <th className="px-4 py-3 text-right">{t('pt.commission.completedSessions')}</th>
                  <th className="px-4 py-3 text-right">{t('pt.commission.totalIncome')}</th>
                  <th className="px-4 py-3 text-right">{t('pt.commission.percentage')}</th>
                  <th className="px-4 py-3 text-right">{t('pt.commission.expectedCommission')}</th>
                </tr>
              </thead>
              <tbody>
                {allCoachesStats
                  .filter((stat) => stat.earnings.totalRevenue > 0)
                  .sort((a, b) => b.earnings.totalRevenue - a.earnings.totalRevenue)
                  .map((stat) => {
                    const percentage = calculatePercentage(stat.earnings.totalRevenue)
                    const commission = (stat.earnings.totalRevenue * percentage) / 100

                    return (
                      <tr key={stat.coachName} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold">{stat.coachName}</td>
                        <td className="px-4 py-3 text-center">{stat.earnings.clients}</td>
                        <td className="px-4 py-3 text-center">{stat.earnings.totalSessions}</td>
                        <td className="px-4 py-3 text-center text-green-600 font-bold">
                          {stat.earnings.completedSessions}
                        </td>
                        <td className="px-4 py-3 font-bold text-blue-600">
                          {stat.earnings.totalRevenue.toLocaleString('ar-EG', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}{' '}
                          {t('pt.commission.egp')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold text-lg">{percentage}%</span>
                        </td>
                        <td className="px-4 py-3 font-bold text-green-600">
                          {commission.toLocaleString('ar-EG', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}{' '}
                          {t('pt.commission.egp')}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
              <tfoot className="bg-gradient-to-r from-blue-50 to-purple-50 font-bold">
                <tr>
                  <td className="px-4 py-3">{t('pt.commission.total')}</td>
                  <td className="px-4 py-3 text-center">
                    {new Set(
                      allCoachesStats.flatMap((s) =>
                        ptSessions
                          .filter((pt) => pt.coachName === s.coachName)
                          .map((pt) => pt.clientName)
                      )
                    ).size}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {allCoachesStats.reduce((sum, s) => sum + s.earnings.totalSessions, 0)}
                  </td>
                  <td className="px-4 py-3 text-center text-green-600">
                    {allCoachesStats.reduce((sum, s) => sum + s.earnings.completedSessions, 0)}
                  </td>
                  <td className="px-4 py-3 text-blue-600">
                    {allCoachesStats
                      .reduce((sum, s) => sum + s.earnings.totalRevenue, 0)
                      .toLocaleString('ar-EG', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}{' '}
                    {t('pt.commission.egp')}
                  </td>
                  <td className="px-4 py-3 text-center">-</td>
                  <td className="px-4 py-3 text-green-600">
                    {allCoachesStats
                      .reduce((sum, s) => {
                        const percentage = calculatePercentage(s.earnings.totalRevenue)
                        return sum + (s.earnings.totalRevenue * percentage) / 100
                      }, 0)
                      .toLocaleString('ar-EG', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}{' '}
                    {t('pt.commission.egp')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {allCoachesStats.filter((stat) => stat.earnings.totalRevenue > 0).length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">📊</div>
              <p className="text-xl">{t('pt.commission.noPTDataForPeriod')}</p>
            </div>
          )}
        </div>
      )}

      {/* جدول عمولات تسجيل الأعضاء */}
      <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <span>💵</span>
          <span>
            عمولات تسجيل الأعضاء ({new Date(dateFrom).toLocaleDateString('ar-EG')} - {new Date(dateTo).toLocaleDateString('ar-EG')})
          </span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-green-100 to-emerald-200">
              <tr>
                <th className="px-4 py-3 text-right">الكوتش</th>
                <th className="px-4 py-3 text-center">رقم الموظف</th>
                <th className="px-4 py-3 text-center">عدد الاشتراكات</th>
                <th className="px-4 py-3 text-center">قيمة العمولة الواحدة</th>
                <th className="px-4 py-3 text-center">إجمالي العمولات</th>
              </tr>
            </thead>
            <tbody>
              {memberSignupCommissions.length > 0 ? (
                memberSignupCommissions.map((commission) => (
                  <tr key={commission.coachId} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold">{commission.coachName}</td>
                    <td className="px-4 py-3 text-center text-gray-600">#{commission.staffCode}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block bg-blue-100 text-blue-800 font-bold px-3 py-1 rounded-full">
                        {commission.count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-gray-700">
                      50 {t('pt.commission.egp')}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-green-600 text-lg">
                      {commission.totalAmount.toLocaleString('ar-EG')} {t('pt.commission.egp')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    <div className="text-6xl mb-4">📭</div>
                    <p className="text-xl">لا توجد عمولات تسجيل أعضاء في هذه الفترة</p>
                  </td>
                </tr>
              )}
            </tbody>
            {memberSignupCommissions.length > 0 && (
              <tfoot className="bg-gradient-to-r from-green-50 to-emerald-100 font-bold">
                <tr>
                  <td className="px-4 py-3" colSpan={2}>الإجمالي</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block bg-blue-500 text-white font-bold px-3 py-1 rounded-full">
                      {memberSignupCommissions.reduce((sum, c) => sum + c.count, 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">-</td>
                  <td className="px-4 py-3 text-center text-green-600 text-xl">
                    {memberSignupCommissions.reduce((sum, c) => sum + c.totalAmount, 0).toLocaleString('ar-EG')} {t('pt.commission.egp')}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
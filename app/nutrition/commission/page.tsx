'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../../../contexts/LanguageContext'
import { useToast } from '../../../contexts/ToastContext'

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

interface NutritionSession {
  nutritionNumber: number
  clientName: string
  phone: string
  sessionsPurchased: number
  sessionsRemaining: number
  nutritionistName: string
  pricePerSession: number
  startDate: string | null
  expiryDate: string | null
  createdAt: string
}

interface NutritionistEarnings {
  nutritionistName: string
  totalSessions: number
  completedSessions: number
  remainingSessions: number
  totalRevenue: number
  clients: number
}

interface CommissionResult {
  nutritionistName: string
  monthlyIncome: number
  percentage: number
  commission: number
  gymShare: number
}

interface MemberSignupCommission {
  nutritionistId: string
  nutritionistName: string
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

interface NutritionCommission {
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
  nutritionNumber?: number
}

interface NutritionSessionsData {
  nutritionNumber: number
  clientName: string
  nutritionistName: string
  nutritionistUserId: string | null
  sessionsPurchased: number
  sessionsRemaining: number
  pricePerSession: number
  usedSessions: number
  sessionValue: number
}

interface SessionBasedCommission {
  nutritionistName: string
  nutritionistUserId: string
  totalUsedSessions: number
  totalSessionsValue: number
  percentage: number
  commission: number
  gymShare: number
  nutritionCount: number
  details: NutritionSessionsData[]
}

export default function NutritionCommissionPage() {
  const { t, locale } = useLanguage()
  const toast = useToast()
  const localeString = locale === 'ar' ? 'ar-EG' : 'en-US'
  const [coaches, setCoaches] = useState<Staff[]>([])
  const [nutritionSessions, setNutritionSessions] = useState<NutritionSession[]>([])
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [selectedCoach, setSelectedCoach] = useState<string>('')
  const [customIncome, setCustomIncome] = useState<string>('')
  const [useCustomIncome, setUseCustomIncome] = useState(false)
  const [result, setResult] = useState<CommissionResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [coachEarnings, setNutritionistEarnings] = useState<NutritionistEarnings | null>(null)
  const [memberSignupCommissions, setMemberSignupCommissions] = useState<MemberSignupCommission[]>([])
  const [nutritionCommissions, setNutritionCommissions] = useState<NutritionCommission[]>([])

  // إعدادات الكومشن
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [commissionSettings, setCommissionSettings] = useState({
    tier1Limit: 5000,
    tier2Limit: 11000,
    tier3Limit: 15000,
    tier4Limit: 20000,
    tier1Rate: 25,
    tier2Rate: 30,
    tier3Rate: 35,
    tier4Rate: 40,
    tier5Rate: 45
  })
  const [savingSettings, setSavingSettings] = useState(false)

  // طريقة حساب الكومشن (إيرادات أو حصص)
  const [calculationMethod, setCalculationMethod] = useState<'revenue' | 'sessions' | null>(null)
  const [sessionCommissions, setSessionCommissions] = useState<SessionBasedCommission[]>([])
  const [loadingSessionData, setLoadingSessionData] = useState(false)
  const [customSessionPercentage, setCustomSessionPercentage] = useState<string>('25')
  const [calculatedSessionCommission, setCalculatedSessionCommission] = useState<number>(0)

  // حالة المستخدم لمعرفة إذا كان Admin
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [methodLoaded, setMethodLoaded] = useState(false)

  // أنواع إيصالات التغذية المدعومة (جميع الأنواع الحالية والقديمة)
  const NUTRITION_RECEIPT_TYPES = [
    // New constant types
    'newNutrition',
    'nutritionRenewal',
    'nutritionDayUse',
    // Legacy Arabic types
    'تغذية جديدة',
    'تجديد تغذية',
    'دفع باقي تغذية',
    'اشتراك تغذية',
    // Legacy English types
    'new nutrition',
    'Nutrition Day Use'
  ]

  console.log('🔵 NUTRITION_RECEIPT_TYPES configured:', NUTRITION_RECEIPT_TYPES)

  // تحديد الفترة الزمنية (أول يوم في الشهر الحالي إلى آخر يوم)
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  const [dateFrom, setDateFrom] = useState(firstDay.toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(lastDay.toISOString().split('T')[0])

  useEffect(() => {
    fetchData()
    fetchCommissionSettings()
    fetchCurrentUser()
    fetchDefaultCalculationMethod()
  }, [])

  useEffect(() => {
    fetchMemberSignupCommissions()
  }, [dateFrom, dateTo])

  // مراقبة تغيير طريقة الحساب
  useEffect(() => {
    console.log('🔄 calculationMethod changed to:', calculationMethod)
    console.log('📊 methodLoaded:', methodLoaded)
    console.log('👤 isAdmin:', isAdmin)
  }, [calculationMethod, methodLoaded, isAdmin])

  // اختيار الكوتش تلقائياً
  useEffect(() => {
    if (coaches.length > 0 && currentUser && !selectedCoach) {
      // إذا كان المستخدم COACH، اختر الكوتش المرتبط به
      if (currentUser.role === 'COACH' && currentUser.staffId) {
        const coachStaff = coaches.find((c: Staff) => c.id === currentUser.staffId)
        if (coachStaff) {
          console.log('✅ Auto-selecting coach for COACH user:', coachStaff.name)
          setSelectedCoach(coachStaff.name)
        }
      }
      // إذا كان هناك كوتش واحد فقط (حالة Admin مع كوتش واحد)
      else if (coaches.length === 1) {
        console.log('✅ Auto-selecting single coach:', coaches[0].name)
        setSelectedCoach(coaches[0].name)
      }
    }
  }, [coaches, currentUser])

  // حساب الكومشن بناءً على الحصص المستخدمة
  useEffect(() => {
    if (calculationMethod === 'sessions' && nutritionSessions.length > 0) {
      setLoadingSessionData(true)
      try {
        const results = calculateSessionBasedCommission(selectedCoach || undefined)
        setSessionCommissions(results)

        // تحديث النسبة الافتراضية بناءً على أول نتيجة
        if (results.length > 0 && selectedCoach) {
          const coachData = results.find(c => c.nutritionistName === selectedCoach)
          if (coachData) {
            setCustomSessionPercentage(coachData.percentage.toString())
          }
        }

        console.log('📊 نتائج الكومشن بناءً على الحصص:', results)
      } catch (error) {
        console.error('❌ خطأ في حساب الكومشن:', error)
      } finally {
        setLoadingSessionData(false)
      }
    }
  }, [calculationMethod, dateFrom, dateTo, selectedCoach, nutritionSessions])

  // حساب الكومشن النهائي بناءً على النسبة المخصصة
  useEffect(() => {
    if (calculationMethod === 'sessions' && selectedCoach && sessionCommissions.length > 0) {
      const coachData = sessionCommissions.find(c => c.nutritionistName === selectedCoach)
      if (coachData) {
        const percentage = parseFloat(customSessionPercentage) || 0
        const commission = (coachData.totalSessionsValue * percentage) / 100
        setCalculatedSessionCommission(commission)
      }
    }
  }, [customSessionPercentage, calculationMethod, selectedCoach, sessionCommissions])

  const fetchData = async () => {
    try {
      // جلب الكوتشات
      const staffResponse = await fetch('/api/staff')
      const staffData: Staff[] = await staffResponse.json()
      const activeCoaches = staffData.filter(
        (staff) => staff.isActive && staff.position?.toLowerCase().includes('مدرب')
      )
      setCoaches(activeCoaches)

      // جلب جلسات التغذية
      const nutritionResponse = await fetch('/api/nutrition')
      const nutritionData: NutritionSession[] = await nutritionResponse.json()
      setNutritionSessions(nutritionData)

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

  const fetchNutritionCommissions = async (nutritionistName: string, startDate: string, endDate: string): Promise<NutritionCommission[]> => {
    try {
      // جلب جميع العمولات
      const response = await fetch('/api/commissions')
      if (!response.ok) return []

      const allCommissions = await response.json()

      // فلترة عمولات التغذية للأخصائي في الفترة المحددة
      const start = new Date(startDate)
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)

      const filtered = allCommissions.filter((c: any) => {
        if (c.type !== 'pt_payment') return false
        if (c.staff?.name !== nutritionistName) return false

        const commissionDate = new Date(c.createdAt)
        return commissionDate >= start && commissionDate <= end
      })

      return filtered
    } catch (error) {
      console.error('Error fetching PT commissions:', error)
      return []
    }
  }

  // جلب إعدادات الكومشن
  const fetchCommissionSettings = async () => {
    try {
      const response = await fetch('/api/commission-settings')
      if (response.ok) {
        const data = await response.json()
        setCommissionSettings({
          tier1Limit: data.tier1Limit,
          tier2Limit: data.tier2Limit,
          tier3Limit: data.tier3Limit,
          tier4Limit: data.tier4Limit,
          tier1Rate: data.tier1Rate,
          tier2Rate: data.tier2Rate,
          tier3Rate: data.tier3Rate,
          tier4Rate: data.tier4Rate,
          tier5Rate: data.tier5Rate
        })
        console.log('⚙️ تم تحميل إعدادات الكومشن:', data)
      }
    } catch (error) {
      console.error('Error fetching commission settings:', error)
    }
  }

  // حفظ إعدادات الكومشن
  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      const response = await fetch('/api/commission-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commissionSettings)
      })

      if (response.ok) {
        toast.success(t('nutrition.commission.settingsSavedSuccess'))
        setShowSettingsModal(false)
        // إعادة الحساب إذا كان هناك كوتش محدد
        if (selectedCoach) {
          handleCalculate()
        }
      } else {
        const data = await response.json()
        toast.error(data.error || t('nutrition.commission.defaultMethodSavedError'))
      }
    } catch (error) {
      console.error('Error saving commission settings:', error)
      toast.error(t('nutrition.commission.settingsSaveError'))
    } finally {
      setSavingSettings(false)
    }
  }

  // جلب معلومات المستخدم الحالي
  const fetchCurrentUser = async () => {
    try {
      console.log('👤 Fetching current user...')
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        console.log('✅ User fetched:', data.user)
        console.log('👔 User role:', data.user.role)
        setCurrentUser(data.user)
        const isAdminUser = data.user.role === 'ADMIN'
        setIsAdmin(isAdminUser)
        console.log('🔐 isAdmin set to:', isAdminUser)
      }
    } catch (error) {
      console.error('Error fetching current user:', error)
    }
  }

  // جلب طريقة الحساب الافتراضية
  const fetchDefaultCalculationMethod = async () => {
    try {
      console.log('🔄 Fetching default calculation method...')
      const response = await fetch('/api/settings/commission')
      console.log('📡 API Response status:', response.status)
      if (response.ok) {
        const data = await response.json()
        console.log('✅ Default method received from API:', JSON.stringify(data))
        console.log('🔍 defaultCommissionMethod value:', data.defaultCommissionMethod)
        console.log('🔍 Type of defaultCommissionMethod:', typeof data.defaultCommissionMethod)

        if (data.defaultCommissionMethod) {
          console.log('📊 About to set calculation method to:', data.defaultCommissionMethod)
          setCalculationMethod(data.defaultCommissionMethod)
          console.log('✔️ setCalculationMethod called with:', data.defaultCommissionMethod)
        } else {
          console.log('⚠️ No defaultCommissionMethod in response, using default "revenue"')
          // إذا لم يكن هناك إعداد، استخدم القيمة الافتراضية
          setCalculationMethod('revenue')
        }
      } else {
        console.error('❌ Failed to fetch default method:', response.status)
        const errorText = await response.text()
        console.error('Error response:', errorText)
        // في حالة الفشل، استخدم القيمة الافتراضية
        setCalculationMethod('revenue')
      }
    } catch (error) {
      console.error('💥 Exception in fetchDefaultCalculationMethod:', error)
      // في حالة الخطأ، استخدم القيمة الافتراضية
      setCalculationMethod('revenue')
    } finally {
      console.log('🏁 Setting methodLoaded to true')
      setMethodLoaded(true)
    }
  }

  // حفظ طريقة الحساب الافتراضية (للأدمن فقط)
  const saveDefaultCalculationMethod = async (method: 'revenue' | 'sessions' | null) => {
    if (!isAdmin) {
      toast.error(t('nutrition.commission.adminOnlyPermission'))
      return
    }

    if (!method) {
      toast.error('يرجى اختيار طريقة حساب أولاً')
      return
    }

    try {
      console.log('💾 Saving default calculation method:', method)
      const response = await fetch('/api/settings/commission', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultCommissionMethod: method })
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ Method saved successfully:', result)
        toast.success(t('nutrition.commission.defaultMethodSavedSuccess'))
      } else {
        const data = await response.json()
        console.error('❌ Failed to save method:', data)
        toast.error(data.error || t('nutrition.commission.defaultMethodSavedError'))
      }
    } catch (error) {
      console.error('Error saving default calculation method:', error)
      toast.error(t('nutrition.commission.defaultMethodSavedError'))
    }
  }

  // دالة حساب النسبة حسب الدخل الشهري (باستخدام الإعدادات المحفوظة)
  const calculatePercentage = (income: number): number => {
    if (income < commissionSettings.tier1Limit) return commissionSettings.tier1Rate
    if (income < commissionSettings.tier2Limit) return commissionSettings.tier2Rate
    if (income < commissionSettings.tier3Limit) return commissionSettings.tier3Rate
    if (income < commissionSettings.tier4Limit) return commissionSettings.tier4Rate
    return commissionSettings.tier5Rate
  }

  // دالة حساب الكومشن بناءً على الحصص المستخدمة
  const calculateSessionBasedCommission = (nutritionistNameFilter?: string): SessionBasedCommission[] => {
    const start = new Date(dateFrom)
    const end = new Date(dateTo)
    end.setHours(23, 59, 59, 999)

    // 1. جلب جميع جلسات التغذية مع تطبيق الفلتر
    let filteredNutritions = nutritionSessions.filter((pt) => {
      // فلتر حسب الكوتش إذا تم تحديده
      if (nutritionistNameFilter && pt.nutritionistName !== nutritionistNameFilter) {
        return false
      }

      // فلتر حسب التاريخ (اختياري - يمكن إزالته للحساب الكلي)
      if (pt.startDate) {
        const ptStart = new Date(pt.startDate)
        if (ptStart > end) return false
      }

      if (pt.expiryDate) {
        const ptExpiry = new Date(pt.expiryDate)
        if (ptExpiry < start) return false
      }

      return true
    })

    console.log('📊 عدد جلسات التغذية بعد الفلترة:', filteredNutritions.length)

    // 2. تجميع حسب الكوتش
    const coachMap = new Map<string, NutritionSessionsData[]>()

    for (const pt of filteredNutritions) {
      const usedSessions = pt.sessionsPurchased - pt.sessionsRemaining
      const sessionValue = usedSessions * pt.pricePerSession

      const data: NutritionSessionsData = {
        nutritionNumber: pt.nutritionNumber,
        clientName: pt.clientName,
        nutritionistName: pt.nutritionistName,
        nutritionistUserId: null, // لا يوجد في NutritionSession الحالية
        sessionsPurchased: pt.sessionsPurchased,
        sessionsRemaining: pt.sessionsRemaining,
        pricePerSession: pt.pricePerSession,
        usedSessions,
        sessionValue
      }

      const key = pt.nutritionistName
      if (!coachMap.has(key)) {
        coachMap.set(key, [])
      }
      coachMap.get(key)!.push(data)
    }

    // 3. حساب الكومشن لكل كوتش
    const results: SessionBasedCommission[] = []

    for (const [nutritionistName, nutritionList] of coachMap.entries()) {
      const totalUsedSessions = nutritionList.reduce((sum, pt) => sum + pt.usedSessions, 0)
      const totalSessionsValue = nutritionList.reduce((sum, pt) => sum + pt.sessionValue, 0)

      const percentage = calculatePercentage(totalSessionsValue)
      const commission = (totalSessionsValue * percentage) / 100
      const gymShare = totalSessionsValue - commission

      results.push({
        nutritionistName,
        nutritionistUserId: '', // لا يوجد في البيانات الحالية
        totalUsedSessions,
        totalSessionsValue,
        percentage,
        commission,
        gymShare,
        nutritionCount: nutritionList.length,
        details: nutritionList
      })

      console.log(`✅ كوتش ${nutritionistName}:`, {
        nutritionCount: nutritionList.length,
        totalUsedSessions,
        totalSessionsValue,
        percentage,
        commission
      })
    }

    return results.sort((a, b) => b.commission - a.commission)
  }

  // دالة حساب أرباح الأخصائي من التغذية (من الإيصالات - الطريقة الصحيحة)
  const calculateNutritionistEarnings = (nutritionistName: string, startDate: string, endDate: string): NutritionistEarnings => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    // حساب الإيرادات من إيصالات التغذية (جميع الأنواع)
    console.log('🔵 Starting to filter receipts for nutritionist:', nutritionistName)
    console.log('🔵 Total receipts to check:', receipts.length)

    const nutritionReceipts = receipts.filter((receipt) => {
      // فلترة إيصالات التغذية فقط
      const isNutritionType = NUTRITION_RECEIPT_TYPES.includes(receipt.type)
      if (!isNutritionType) {
        if (receipt.type.includes('nutrition') || receipt.type.includes('تغذية')) {
          console.log('⚠️ Receipt type not in allowed list:', receipt.type)
        }
        return false
      }

      // التحقق من التاريخ
      const receiptDate = new Date(receipt.createdAt)
      if (receiptDate < start || receiptDate > end) return false

      // التحقق من اسم الكوتش في itemDetails
      try {
        const details = JSON.parse(receipt.itemDetails)
        // ✅ Trim spaces to avoid mismatch due to trailing/leading spaces
        const storedName = (details.nutritionistName || '').trim()
        const requestedName = (nutritionistName || '').trim()
        const matches = storedName === requestedName
        if (isNutritionType && receipt.type === 'nutritionRenewal') {
          console.log('🔵 Found nutritionRenewal receipt:', {
            receiptNumber: receipt.receiptNumber,
            type: receipt.type,
            nutritionistName: details.nutritionistName,
            storedNameTrimmed: storedName,
            requestedNutritionist: nutritionistName,
            requestedNameTrimmed: requestedName,
            matches: matches
          })
        }
        return matches
      } catch {
        return false
      }
    })

    console.log('💰 إيصالات التغذية للأخصائي', nutritionistName, ':', nutritionReceipts.length, 'إيصال')
    console.log('🔵 Receipt types found:', nutritionReceipts.map(r => r.type))

    // حساب الإيرادات من الإيصالات (المبالغ الفعلية المدفوعة)
    const nutritionRevenue = nutritionReceipts.reduce((sum, receipt) => sum + receipt.amount, 0)

    // إضافة عمولات تسجيل الأعضاء
    const coachSignupCommissions = memberSignupCommissions.find(c => c.nutritionistName === nutritionistName)
    const signupRevenue = coachSignupCommissions?.totalAmount || 0

    console.log('💵 إيرادات الكوتش', nutritionistName, ':', {
      nutritionRevenue,
      signupRevenue,
      total: nutritionRevenue + signupRevenue
    })

    // إجمالي الإيرادات = التغذية + تسجيل الأعضاء
    const totalRevenue = nutritionRevenue + signupRevenue

    // جمع بيانات الجلسات للإحصائيات (من أرقام التغذية في الإيصالات)
    const nutritionNumbersFromReceipts = new Set(
      nutritionReceipts.map((receipt) => {
        try {
          const details = JSON.parse(receipt.itemDetails)
          return details.nutritionNumber
        } catch {
          return null
        }
      }).filter(Boolean)
    )

    // الحصول على معلومات الجلسات الفعلية من جدول التغذية
    const relatedSessions = nutritionSessions.filter((session) =>
      nutritionNumbersFromReceipts.has(session.nutritionNumber) && session.nutritionistName === nutritionistName
    )

    const totalSessions = relatedSessions.reduce((sum, s) => sum + s.sessionsPurchased, 0)
    const remainingSessions = relatedSessions.reduce((sum, s) => sum + s.sessionsRemaining, 0)
    const completedSessions = totalSessions - remainingSessions
    const clients = new Set(relatedSessions.map((s) => s.clientName)).size

    return {
      nutritionistName,
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
      toast.warning(t('nutrition.commission.selectCoach'))
      return
    }

    const coach = coaches.find((c) => c.name === selectedCoach)
    if (!coach) return

    // حساب أرباح الأخصائي من التغذية
    const earnings = calculateNutritionistEarnings(selectedCoach, dateFrom, dateTo)
    setNutritionistEarnings(earnings)

    // ✅ جلب عمولات التغذية المحفوظة
    const nutritionCommissionsData = await fetchNutritionCommissions(selectedCoach, dateFrom, dateTo)
    setNutritionCommissions(nutritionCommissionsData)

    // جمع عمولات التغذية
    const nutritionCommission = nutritionCommissionsData.reduce((sum, c) => sum + c.amount, 0)

    // جمع عمولات الأعضاء (الكوتش ياخدها كاملة)
    const coachSignupCommissions = memberSignupCommissions.find(c => c.nutritionistName === selectedCoach)
    const signupRevenue = coachSignupCommissions?.totalAmount || 0

    // إجمالي العمولة = عمولة التغذية + عمولة تسجيل الأعضاء
    const totalCommission = nutritionCommission + signupRevenue

    // حساب إجمالي الإيرادات للعرض فقط
    const start = new Date(dateFrom)
    const end = new Date(dateTo)
    end.setHours(23, 59, 59, 999)

    const coachNutritionReceipts = receipts.filter((receipt) => {
      if (!NUTRITION_RECEIPT_TYPES.includes(receipt.type)) return false
      const receiptDate = new Date(receipt.createdAt)
      if (receiptDate < start || receiptDate > end) return false
      try {
        const details = JSON.parse(receipt.itemDetails)
        return (details.nutritionistName || '').trim() === (selectedCoach || '').trim()
      } catch {
        return false
      }
    })
    const nutritionRevenue = coachNutritionReceipts.reduce((sum, receipt) => sum + receipt.amount, 0)

    const totalIncome = nutritionRevenue + signupRevenue

    // حساب النسبة المتوسطة بناءً على إجمالي الدخل (التغذية + عمولات الاشتراكات)
    const averagePercentage = totalIncome > 0 ? calculatePercentage(totalIncome) : 0

    // إعادة حساب العمولة بناءً على النسبة الجديدة
    const recalculatedCommission = (totalIncome * averagePercentage) / 100
    const gymShare = totalIncome - recalculatedCommission

    console.log('💰 نتيجة الحساب:', {
      nutritionistName: selectedCoach,
      monthlyIncome: totalIncome,
      percentage: averagePercentage,
      commission: recalculatedCommission,
      gymShare: gymShare,
      oldCommission: totalCommission,
    })

    setResult({
      nutritionistName: selectedCoach,
      monthlyIncome: totalIncome,
      percentage: averagePercentage,
      commission: recalculatedCommission,
      gymShare: gymShare,
    })
  }

  // دالة مسح البيانات
  const handleReset = () => {
    setSelectedCoach('')
    setCustomIncome('')
    setUseCustomIncome(false)
    setResult(null)
    setNutritionistEarnings(null)
  }

  // دالة تحديد لون النسبة حسب المستوى
  const getPercentageBgColor = (percentage: number): string => {
    if (percentage <= 25) return 'from-orange-500 to-orange-600'
    if (percentage <= 30) return 'from-yellow-500 to-yellow-600'
    if (percentage <= 35) return 'from-primary-500 to-primary-600'
    if (percentage <= 40) return 'from-purple-500 to-purple-600'
    return 'from-green-500 to-green-600'
  }

  // إحصائيات عامة للكوتشات
  const allCoachesStats = coaches.map((coach) => {
    const earnings = calculateNutritionistEarnings(coach.name, dateFrom, dateTo)
    return {
      nutritionistName: coach.name,
      earnings,
    }
  })

  return (
    <div className="container mx-auto p-3 sm:p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="mb-4 md:mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="text-3xl sm:text-4xl md:text-5xl">💰</div>
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">{t('nutrition.commission.title')}</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-1">
                {t('nutrition.commission.subtitle')}
              </p>
            </div>
          </div>
          {/* Settings Button - Admin Only */}
          {isAdmin && (
            <button
              onClick={() => setShowSettingsModal(true)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 rounded-lg font-bold transition-all shadow-lg hover:shadow-xl flex items-center gap-2 text-sm sm:text-base w-full sm:w-auto justify-center"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="hidden sm:inline">{t('nutrition.commission.calculationSettings')}</span>
              <span className="sm:hidden">الإعدادات</span>
            </button>
          )}
        </div>
      </div>

      {/* Time Period Selection */}
      <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
        <label className="block text-sm font-bold mb-3 text-gray-700">
          📅 {t('nutrition.commission.selectPeriod')}
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">{t('nutrition.commission.fromDate')}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">{t('nutrition.commission.toDate')}</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition"
            />
          </div>
        </div>
      </div>

      {/* Calculation Method Selection - Admin Only */}
      {isAdmin ? (
        <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 mb-4 sm:mb-6">
          <label className="block text-sm font-bold mb-3 text-gray-700">
            {t('nutrition.commission.calculationMethodLabel')}
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setCalculationMethod('revenue')}
              className={`flex-1 px-4 sm:px-6 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg transition-all ${
                calculationMethod === 'revenue'
                  ? 'bg-primary-600 text-white shadow-lg sm:scale-105'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl sm:text-2xl">💰</span>
                <span className="text-sm sm:text-base">{t('nutrition.commission.byRevenue')}</span>
              </div>
              <p className="text-xs mt-1 opacity-80">
                {t('nutrition.commission.byRevenueDesc')}
              </p>
            </button>
            <button
              onClick={() => setCalculationMethod('sessions')}
              className={`flex-1 px-4 sm:px-6 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg transition-all ${
                calculationMethod === 'sessions'
                  ? 'bg-green-600 text-white shadow-lg sm:scale-105'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl sm:text-2xl">📊</span>
                <span className="text-sm sm:text-base">{t('nutrition.commission.bySessions')}</span>
              </div>
              <p className="text-xs mt-1 opacity-80">
                {t('nutrition.commission.bySessionsDesc')}
              </p>
            </button>
          </div>

          {/* Info Box */}
          <div className="mt-4 bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
            <p className="text-xs sm:text-sm text-blue-800">
              <strong>{t('nutrition.commission.methodDifferenceTitle')}</strong>
            </p>
            <ul className="list-disc list-inside text-xs text-blue-700 mt-2 space-y-1">
              <li><strong>{t('nutrition.commission.byRevenue')}:</strong> {t('nutrition.commission.byRevenueFullDesc')}</li>
              <li><strong>{t('nutrition.commission.bySessions')}:</strong> {t('nutrition.commission.bySessionsFullDesc')}</li>
            </ul>
          </div>

          {/* Admin Only: Save as Default */}
          <div className="mt-4 bg-gradient-to-r from-purple-50 to-primary-50 border-2 border-purple-300 rounded-lg p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl">⚙️</span>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-purple-900">{t('nutrition.commission.adminSettings')}</p>
                  <p className="text-xs text-purple-700 hidden sm:block">{t('nutrition.commission.saveCurrentMethodAsDefault')}</p>
                </div>
              </div>
              <button
                onClick={() => saveDefaultCalculationMethod(calculationMethod)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 sm:px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-2 w-full sm:w-auto justify-center"
              >
                <span>💾</span>
                <span>{t('nutrition.commission.saveAsDefault')}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Coach View - Show current method only (read-only) */
        <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 mb-4 sm:mb-6">
          <label className="block text-sm font-bold mb-3 text-gray-700">
            {t('nutrition.commission.calculationMethodLabel')}
          </label>
          {!methodLoaded || calculationMethod === null ? (
            <div className="px-4 sm:px-6 py-3 sm:py-4 rounded-lg bg-gray-100 text-gray-600 text-center">
              <div className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm sm:text-base">{t('common.loading')}</span>
              </div>
            </div>
          ) : (
            <>
              <div className={`px-4 sm:px-6 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg ${
                calculationMethod === 'revenue'
                  ? 'bg-primary-600 text-white shadow-lg'
                  : 'bg-green-600 text-white shadow-lg'
              }`}>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xl sm:text-2xl">{calculationMethod === 'revenue' ? '💰' : '📊'}</span>
                  <span className="text-sm sm:text-base">{calculationMethod === 'revenue' ? t('nutrition.commission.byRevenue') : t('nutrition.commission.bySessions')}</span>
                </div>
                <p className="text-xs mt-1 opacity-90 text-center">
                  {calculationMethod === 'revenue' ? t('nutrition.commission.byRevenueDesc') : t('nutrition.commission.bySessionsDesc')}
                </p>
              </div>

              {/* Info for Coach */}
              <div className="mt-4 bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
                <p className="text-xs text-blue-800">
                  ℹ️ <strong>{t('nutrition.commission.currentMethodInfo')}</strong>
                </p>
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Input Form */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
            <span>📋</span>
            <span>{t('nutrition.commission.calculationData')}</span>
          </h2>

          {loading ? (
            <div className="text-center py-8 sm:py-12 text-gray-500 text-sm sm:text-base">{t('nutrition.commission.loading')}</div>
          ) : coaches.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <div className="text-4xl sm:text-6xl mb-4">😕</div>
              <p className="text-sm sm:text-base text-gray-600">{t('nutrition.commission.noActiveCoaches')}</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-2">
                {t('nutrition.commission.addCoachesHint')}
              </p>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {/* Coach Selection - للأدمن فقط */}
              {isAdmin && (
                <div>
                  <label className="block text-xs sm:text-sm font-bold mb-2 sm:mb-3 text-gray-700">
                    👤 {coaches.length === 1 ? t('nutrition.commission.theCoach') : t('nutrition.commission.selectCoach')} <span className="text-red-600">*</span>
                  </label>
                  {coaches.length === 1 ? (
                    <div className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-primary-50 border-2 border-primary-200 rounded-lg text-base sm:text-lg font-bold text-primary-700">
                      {coaches[0].name} {coaches[0].phone && `(${coaches[0].phone})`}
                    </div>
                  ) : (
                    <select
                      value={selectedCoach}
                      onChange={(e) => {
                        setSelectedCoach(e.target.value)
                        setResult(null)
                        setNutritionistEarnings(null)
                      }}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-gray-300 rounded-lg text-base sm:text-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition"
                    >
                      <option value="">{t('nutrition.commission.selectCoachOption')}</option>
                      {coaches.map((coach) => (
                        <option key={coach.id} value={coach.name}>
                          {coach.name} {coach.phone && `(${coach.phone})`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* عرض اسم الكوتش للكوتش المسجل */}
              {!isAdmin && selectedCoach && (
                <div>
                  <label className="block text-xs sm:text-sm font-bold mb-2 sm:mb-3 text-gray-700">
                    👤 {t('nutrition.commission.theCoach')}
                  </label>
                  <div className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-primary-50 to-indigo-50 border-2 border-primary-300 rounded-lg text-base sm:text-lg font-bold text-primary-800 flex items-center gap-2">
                    <span>🏋️</span>
                    <span>{selectedCoach}</span>
                  </div>
                </div>
              )}

              {/* Custom Income Option - فقط في طريقة الإيرادات */}
              {calculationMethod === 'revenue' && (
                <div className="bg-primary-50 border-2 border-primary-200 rounded-xl p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCustomIncome}
                      onChange={(e) => setUseCustomIncome(e.target.checked)}
                      className="w-5 h-5 text-primary-600 rounded"
                    />
                    <span className="text-sm font-bold text-gray-700">
                      {t('nutrition.commission.useCustomIncome')}
                    </span>
                  </label>
                </div>
              )}

              {/* Custom Income Input - فقط في طريقة الإيرادات */}
              {calculationMethod === 'revenue' && useCustomIncome && (
                <div>
                  <label className="block text-sm font-bold mb-3 text-gray-700">
                    💵 {t('nutrition.commission.customMonthlyIncome')} <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={customIncome}
                    onChange={(e) => setCustomIncome(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition"
                    placeholder={t('nutrition.commission.exampleIncome')}
                  />
                </div>
              )}

              {/* جدول النسب - فقط في طريقة الإيرادات */}
              {calculationMethod === 'revenue' && (
                <div className="bg-gradient-to-br from-primary-50 to-purple-50 border-2 border-primary-200 rounded-xl p-5">
                  <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                    <span>📊</span>
                    <span>{t('nutrition.commission.percentageTable')}</span>
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
                      <span>{t('nutrition.commission.lessThanAmount', { amount: commissionSettings.tier1Limit.toLocaleString(localeString) })} {t('nutrition.commission.egp')}</span>
                      <span className="font-bold text-orange-600">{commissionSettings.tier1Rate}%</span>
                    </div>
                    <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
                      <span>{commissionSettings.tier1Limit.toLocaleString(localeString)} - {(commissionSettings.tier2Limit - 1).toLocaleString(localeString)} {t('nutrition.commission.egp')}</span>
                      <span className="font-bold text-yellow-600">{commissionSettings.tier2Rate}%</span>
                    </div>
                    <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
                      <span>{commissionSettings.tier2Limit.toLocaleString(localeString)} - {(commissionSettings.tier3Limit - 1).toLocaleString(localeString)} {t('nutrition.commission.egp')}</span>
                      <span className="font-bold text-primary-600">{commissionSettings.tier3Rate}%</span>
                    </div>
                    <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
                      <span>{commissionSettings.tier3Limit.toLocaleString(localeString)} - {(commissionSettings.tier4Limit - 1).toLocaleString(localeString)} {t('nutrition.commission.egp')}</span>
                      <span className="font-bold text-purple-600">{commissionSettings.tier4Rate}%</span>
                    </div>
                    <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
                      <span>{t('nutrition.commission.orMoreAmount', { amount: commissionSettings.tier4Limit.toLocaleString(localeString) })} {t('nutrition.commission.egp')}</span>
                      <span className="font-bold text-green-600">{commissionSettings.tier5Rate}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* أزرار التحكم */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={handleCalculate}
                  disabled={!selectedCoach || (useCustomIncome && !customIncome)}
                  className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 text-white py-3 sm:py-4 rounded-lg hover:from-primary-700 hover:to-primary-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed font-bold text-base sm:text-lg shadow-lg transform transition hover:scale-105 active:scale-95"
                >
                  ✅ {t('nutrition.commission.calculateButton')}
                </button>
                {result && (
                  <button
                    onClick={handleReset}
                    className="px-4 sm:px-6 bg-gradient-to-r from-gray-200 to-gray-300 text-gray-700 py-3 sm:py-4 rounded-lg hover:from-gray-300 hover:to-gray-400 font-bold text-base sm:text-lg shadow-lg transform transition hover:scale-105 active:scale-95"
                  >
                    🔄 {t('nutrition.commission.resetButton')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Calculation Result */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
            <span>📈</span>
            <span>{calculationMethod === 'sessions' ? t('nutrition.commission.sessionsResult') : t('nutrition.commission.result')}</span>
          </h2>

          {/* عرض نتائج طريقة الحصص */}
          {calculationMethod === 'sessions' ? (
            selectedCoach && sessionCommissions.length > 0 ? (() => {
              const coachData = sessionCommissions.find(c => c.nutritionistName === selectedCoach)

              if (!coachData) {
                return (
                  <div className="flex flex-col items-center justify-center h-full py-8 sm:py-12">
                    <div className="text-6xl sm:text-8xl mb-4 sm:mb-6">📭</div>
                    <p className="text-gray-500 text-base sm:text-lg text-center px-4">
                      {t('nutrition.commission.noSessionsForCoach')}
                    </p>
                  </div>
                )
              }

              return (
                <div className="space-y-3 sm:space-y-4">
                  {/* بطاقة الكوتش */}
                  <div className="bg-gradient-to-br from-green-50 to-teal-50 border-2 border-green-200 rounded-xl p-3 sm:p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="text-xl sm:text-2xl">👨‍🏫</div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">{t('nutrition.commission.coach')}</p>
                        <p className="text-base sm:text-xl md:text-2xl font-bold text-green-900">{coachData.nutritionistName}</p>
                      </div>
                    </div>
                  </div>

                  {/* عدد الحصص المستخدمة */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-3 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-3 mb-2">
                      <div className="text-xl sm:text-2xl md:text-3xl">📊</div>
                      <div className="flex-1">
                        <p className="text-xs sm:text-sm text-gray-600">{t('nutrition.commission.usedSessionsCount')}</p>
                        <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-blue-900">{coachData.totalUsedSessions}</p>
                        <p className="text-xs text-gray-500 mt-1">{t('nutrition.commission.fromPTSubscriptions', { count: coachData.nutritionCount.toString() })}</p>
                      </div>
                    </div>
                  </div>

                  {/* سعر الحصص */}
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-3 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-3 mb-2">
                      <div className="text-xl sm:text-2xl md:text-3xl">💵</div>
                      <div className="flex-1">
                        <p className="text-xs sm:text-sm text-gray-600">{t('nutrition.commission.totalSessionsValue')}</p>
                        <p className="text-lg sm:text-2xl md:text-3xl font-bold text-purple-900 break-words">
                          {coachData.totalSessionsValue.toLocaleString(localeString, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })} {t('nutrition.commission.egp')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* نسبة الكومشن قابلة للتعديل */}
                  <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 rounded-xl p-3 sm:p-4">
                    <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-2 sm:mb-3">
                      {t('nutrition.commission.editablePercentage')}
                    </label>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={customSessionPercentage}
                        onChange={(e) => setCustomSessionPercentage(e.target.value)}
                        className="flex-1 px-3 sm:px-4 py-2 sm:py-3 border-2 border-orange-300 rounded-lg text-xl sm:text-2xl md:text-3xl font-bold text-center focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                      />
                      <span className="text-2xl sm:text-3xl md:text-4xl font-black text-orange-600">%</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-2 text-center">
                      {t('nutrition.commission.enterPercentageHint')}
                    </p>
                  </div>

                  {/* المبلغ المستحق للكوتش */}
                  <div className="bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-xl p-4 sm:p-5 md:p-6 shadow-xl border-2 sm:border-4 border-white">
                    <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                      <div className="text-2xl sm:text-3xl md:text-4xl">💰</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white/90 text-xs sm:text-sm">{t('nutrition.commission.coachAmount')}</p>
                        <p className="text-xl sm:text-3xl md:text-4xl font-black break-words">
                          {calculatedSessionCommission.toLocaleString(localeString, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })} ج.م
                        </p>
                        <p className="text-white/70 text-xs mt-1 break-words">
                          = {coachData.totalSessionsValue.toLocaleString(localeString)} × {customSessionPercentage}%
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* نصيب الجيم - للأدمن فقط */}
                  {isAdmin && (
                    <div className="bg-gradient-to-br from-gray-100 to-gray-200 border-2 border-gray-300 rounded-xl p-3 sm:p-4 md:p-5">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="text-xl sm:text-2xl md:text-3xl">🏢</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm text-gray-600">{t('nutrition.commission.gymShare')}</p>
                          <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 break-words">
                            {(coachData.totalSessionsValue - calculatedSessionCommission).toLocaleString(localeString, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })} {t('nutrition.commission.egp')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })() : (
              <div className="flex flex-col items-center justify-center h-full py-8 sm:py-12">
                <div className="text-5xl sm:text-6xl md:text-8xl mb-4 sm:mb-6">🧮</div>
                <p className="text-gray-500 text-sm sm:text-base md:text-lg text-center px-4">
                  {loadingSessionData ? t('nutrition.commission.calculatingSessions') : selectedCoach ? t('nutrition.commission.noDataAvailable') : t('nutrition.commission.selectCoachToViewSessions')}
                </p>
              </div>
            )
          ) : !result ? (
          <div className="flex flex-col items-center justify-center h-full py-8 sm:py-12">
            <div className="text-5xl sm:text-6xl md:text-8xl mb-4 sm:mb-6">🧮</div>
            <p className="text-gray-500 text-sm sm:text-base md:text-lg text-center px-4">
              {t('nutrition.commission.selectCoachToCalculate')}
            </p>
          </div>
        ) : (
            <div className="space-y-4 sm:space-y-6">
              {/* بطاقة الكوتش */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl p-3 sm:p-4 md:p-5">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <div className="text-xl sm:text-2xl md:text-3xl">👤</div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600">{t('nutrition.commission.coach')}</p>
                    <p className="text-lg sm:text-xl md:text-2xl font-bold text-indigo-900">{result.nutritionistName}</p>
                  </div>
                </div>
              </div>

              {/* تفصيل إيصالات التغذية */}
              {coachEarnings && !useCustomIncome && (() => {
                const start = new Date(dateFrom)
                const end = new Date(dateTo)
                end.setHours(23, 59, 59, 999)

                const coachNutritionReceipts = receipts.filter((receipt) => {
                  // فلترة كل أنواع إيصالات التغذية للعرض
                  if (!NUTRITION_RECEIPT_TYPES.includes(receipt.type)) return false
                  const receiptDate = new Date(receipt.createdAt)
                  if (receiptDate < start || receiptDate > end) return false
                  try {
                    const details = JSON.parse(receipt.itemDetails)
                    return (details.nutritionistName || '').trim() === (result.nutritionistName || '').trim()
                  } catch {
                    return false
                  }
                })

                return coachNutritionReceipts.length > 0 ? (
                  <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border-2 border-teal-200 rounded-xl p-3 sm:p-4 md:p-5">
                    <h3 className="font-bold text-base sm:text-lg mb-3 flex items-center gap-2">
                      <span className="text-lg sm:text-xl">📊</span>
                      <span>{t('nutrition.commission.ptReceipts', { count: coachNutritionReceipts.length.toString() })}</span>
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {coachNutritionReceipts.map((receipt, index) => {
                        let details: any = {}
                        try {
                          details = JSON.parse(receipt.itemDetails)
                        } catch {}
                        return (
                          <div key={receipt.receiptNumber} className="bg-white rounded-lg p-2 sm:p-3 border border-teal-200">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                <div className="bg-teal-100 text-teal-800 font-bold w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm flex-shrink-0">
                                  {index + 1}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs sm:text-sm font-semibold text-gray-800 break-words">
                                    {t('nutrition.commission.receiptLabel', { number: receipt.receiptNumber.toString() })} - {receipt.type}
                                  </p>
                                  <p className="text-xs text-gray-500 break-words">
                                    {details.clientName || 'N/A'} - {
                                      details.nutritionNumber < 0 ? '🏃 Day Use' : `تغذية #${details.nutritionNumber || 'N/A'}`
                                    }
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(receipt.createdAt).toLocaleDateString(localeString, {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                    })}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0 w-full sm:w-auto">
                                <p className="text-base sm:text-lg font-bold text-teal-600 break-words">{receipt.amount.toLocaleString(localeString)} {t('nutrition.commission.currency')}</p>
                              </div>
                            </div>
                            {details.sessionsPurchased && (
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                <div className="bg-gray-50 rounded p-2 text-center">
                                  <p className="text-xs text-gray-600">{t('nutrition.commission.sessions')}</p>
                                  <p className="text-sm font-bold text-gray-800">{details.sessionsPurchased}</p>
                                </div>
                                <div className="bg-gray-50 rounded p-2 text-center">
                                  <p className="text-xs text-gray-600">{t('nutrition.commission.pricePerSession')}</p>
                                  <p className="text-sm font-bold text-gray-800">{details.pricePerSession}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-3 pt-3 border-t-2 border-teal-200">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-teal-100 rounded-lg p-3">
                        <span className="font-bold text-sm sm:text-base text-gray-700">{t('nutrition.commission.totalPTRevenue')}</span>
                        <span className="text-lg sm:text-xl font-bold text-teal-600 break-words">
                          {coachNutritionReceipts.reduce((sum, receipt) => sum + receipt.amount, 0).toLocaleString(localeString)} {t('nutrition.commission.currency')}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null
              })()}

              {/* تفصيل اشتراكات الأعضاء */}
              {coachEarnings && !useCustomIncome && (() => {
                const coachSignupData = memberSignupCommissions.find(c => c.nutritionistName === result.nutritionistName)
                return coachSignupData && coachSignupData.count > 0 ? (
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-3 sm:p-4 md:p-5">
                    <h3 className="font-bold text-base sm:text-lg mb-3 flex items-center gap-2">
                      <span className="text-lg sm:text-xl">💵</span>
                      <span>{t('nutrition.commission.memberSubscriptions', { count: coachSignupData.count.toString() })}</span>
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {coachSignupData.commissions.map((commission, index) => (
                        <div key={commission.id} className="bg-white rounded-lg p-2 sm:p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border border-green-200">
                          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                            <div className="bg-green-100 text-green-800 font-bold w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm flex-shrink-0">
                              {index + 1}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-semibold text-gray-800 break-words">{commission.description || t('nutrition.commission.newMemberRegistration')}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(commission.createdAt).toLocaleDateString(localeString, {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 w-full sm:w-auto">
                            <p className="text-base sm:text-lg font-bold text-green-600 break-words">{commission.amount} {t('nutrition.commission.currency')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t-2 border-green-200">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-green-100 rounded-lg p-3">
                        <span className="font-bold text-sm sm:text-base text-gray-700">{t('nutrition.commission.totalSubscriptionCommissions')}</span>
                        <span className="text-lg sm:text-xl font-bold text-green-600 break-words">{coachSignupData.totalAmount} {t('nutrition.commission.currency')}</span>
                      </div>
                      <div className="mt-2 bg-green-200 rounded-lg p-2 text-center">
                        <p className="text-xs sm:text-sm font-bold text-green-800">{t('nutrition.commission.coachGetsFullAmount')}</p>
                      </div>
                    </div>
                  </div>
                ) : null
              })()}

              {/* تفاصيل عمولات التغذية */}
              {nutritionCommissions.length > 0 && (
                <div className="bg-gradient-to-br from-primary-50 to-indigo-50 border-2 border-primary-200 rounded-xl p-3 sm:p-4 md:p-5">
                  <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 flex items-center gap-2">
                    <span className="text-lg sm:text-xl">💎</span>
                    <span>{t('nutrition.commission.nutritionCommissionDetails', { count: nutritionCommissions.length.toString() })}</span>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-primary-100 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-right text-xs font-bold text-gray-700 border-b border-primary-200">{t('nutrition.commission.date')}</th>
                          <th className="px-3 py-2 text-right text-xs font-bold text-gray-700 border-b border-primary-200">{t('nutrition.commission.description')}</th>
                          <th className="px-3 py-2 text-right text-xs font-bold text-gray-700 border-b border-primary-200">{t('nutrition.commission.amountPaid')}</th>
                          <th className="px-3 py-2 text-right text-xs font-bold text-gray-700 border-b border-primary-200">{t('nutrition.commission.commissionRate')}</th>
                          <th className="px-3 py-2 text-right text-xs font-bold text-gray-700 border-b border-primary-200">{t('nutrition.commission.commissionAmount')}</th>
                        </tr>
                      </thead>
                      <tbody className="max-h-80 overflow-y-auto">
                        {nutritionCommissions.map((comm, index) => {
                          const notes = JSON.parse(comm.notes || '{}')
                          return (
                            <tr key={comm.id} className={`border-b border-primary-100 ${index % 2 === 0 ? 'bg-white' : 'bg-primary-50'}`}>
                              <td className="px-3 py-2 text-sm text-gray-700">
                                {new Date(comm.createdAt).toLocaleDateString(localeString, { day: 'numeric', month: 'short' })}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-800">{comm.description}</td>
                              <td className="px-3 py-2 text-sm font-mono text-gray-700">
                                {notes.paymentAmount?.toLocaleString(localeString) || 0} {t('nutrition.commission.currency')}
                              </td>
                              <td className="px-3 py-2 text-sm text-primary-600 font-bold">{notes.percentage || 0}%</td>
                              <td className="px-3 py-2 text-sm text-green-600 font-bold">
                                {comm.amount.toLocaleString(localeString)} {t('nutrition.commission.currency')}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 pt-3 border-t-2 border-primary-200">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-primary-100 rounded-lg p-3">
                      <span className="font-bold text-sm sm:text-base text-gray-700">{t('nutrition.commission.totalNutritionCommissions')}</span>
                      <span className="text-lg sm:text-xl font-bold text-primary-600 break-words">
                        {nutritionCommissions.reduce((sum, c) => sum + c.amount, 0).toLocaleString(localeString)} {t('nutrition.commission.egp')}
                      </span>
                    </div>
                    <div className="mt-2 bg-primary-200 rounded-lg p-2 text-center">
                      <p className="text-xs sm:text-sm font-bold text-primary-800">
                        {t('nutrition.commission.eachPaymentCalculatedIndependently')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* الدخل الشهري */}
              <div className="bg-gradient-to-br from-cyan-50 to-primary-50 border-2 border-cyan-200 rounded-xl p-3 sm:p-4 md:p-5">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <div className="text-xl sm:text-2xl md:text-3xl">💵</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-gray-600">
                      {useCustomIncome ? t('nutrition.commission.customIncome') : t('nutrition.commission.totalNutritionIncome')}
                    </p>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-cyan-900 break-words">
                      {result.monthlyIncome.toLocaleString(localeString, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      <span className="text-base sm:text-lg md:text-xl">{t('nutrition.commission.egp')}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* النسبة */}
              <div
                className={`bg-gradient-to-br ${getPercentageBgColor(
                  result.percentage
                )} text-white rounded-xl p-4 sm:p-5 md:p-6 shadow-lg`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-white/90 text-xs sm:text-sm mb-1">{t('nutrition.commission.percentage')}</p>
                    <p className="text-3xl sm:text-4xl md:text-5xl font-black break-words">{result.percentage}%</p>
                    <p className="text-white/70 text-xs mt-2">{t('nutrition.commission.onPTRevenueOnly')}</p>
                  </div>
                  <div className="text-4xl sm:text-5xl md:text-6xl opacity-30">📊</div>
                </div>
              </div>

              {/* المبلغ المستحق للكوتش */}
              <div className="bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-xl p-4 sm:p-5 md:p-6 shadow-xl border-2 sm:border-4 border-white">
                <div className="flex items-center gap-2 sm:gap-3 mb-3">
                  <div className="text-2xl sm:text-3xl md:text-4xl">💰</div>
                  <div className="w-full min-w-0">
                    <p className="text-white/90 text-xs sm:text-sm">{t('nutrition.commission.coachDue')}</p>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <p className="text-2xl sm:text-3xl font-bold font-mono break-words">
                        {result.commission.toLocaleString(localeString, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <span className="text-base sm:text-lg md:text-xl font-semibold">{t('nutrition.commission.egp')}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t-2 border-white/30">
                  <p className="text-white/90 text-xs sm:text-sm text-center font-semibold">
                    {t('nutrition.commission.percentageOfMonthlyIncome', { percentage: result.percentage.toString() })}
                  </p>
                  <p className="text-white/70 text-xs text-center mt-1">
                    {t('nutrition.commission.ptPlusSignupCommissions', { amount: result.monthlyIncome.toLocaleString(localeString) })}
                  </p>
                </div>
              </div>

              {/* معادلة الحساب */}
              <div className="bg-gradient-to-br from-slate-50 to-gray-100 border-2 border-slate-300 rounded-xl p-3 sm:p-4 md:p-5">
                <h3 className="font-bold text-center mb-3 text-sm sm:text-base md:text-lg text-gray-700">{t('nutrition.commission.calculationFormula')}</h3>
                <div className="bg-white rounded-lg p-3 sm:p-4 text-center">
                  {!useCustomIncome && (() => {
                    const start = new Date(dateFrom)
                    const end = new Date(dateTo)
                    end.setHours(23, 59, 59, 999)

                    const coachNutritionReceipts = receipts.filter((receipt) => {
                      if (!NUTRITION_RECEIPT_TYPES.includes(receipt.type)) return false
                      const receiptDate = new Date(receipt.createdAt)
                      if (receiptDate < start || receiptDate > end) return false
                      try {
                        const details = JSON.parse(receipt.itemDetails)
                        return details.nutritionistName === result.nutritionistName
                      } catch {
                        return false
                      }
                    })
                    const nutritionRevenue = coachNutritionReceipts.reduce((sum, receipt) => sum + receipt.amount, 0)
                    const coachSignupData = memberSignupCommissions.find(c => c.nutritionistName === result.nutritionistName)
                    const signupRevenue = coachSignupData?.totalAmount || 0
                    const nutritionCommission = (nutritionRevenue * result.percentage) / 100

                    if (signupRevenue > 0) {
                      return (
                        <div className="space-y-2">
                          <p className="text-xs sm:text-sm text-gray-700 break-words">
                            <span className="font-bold text-teal-600">{nutritionRevenue.toLocaleString(localeString)}</span> (تغذية) ×
                            <span className="font-bold text-purple-600"> {result.percentage}%</span> =
                            <span className="font-bold text-green-600"> {nutritionCommission.toLocaleString(localeString)}</span>
                          </p>
                          <p className="text-base sm:text-lg font-bold text-gray-500">+</p>
                          <p className="text-xs sm:text-sm text-gray-700 break-words">
                            <span className="font-bold text-green-600">{signupRevenue.toLocaleString(localeString)}</span> ({t('nutrition.commission.signupCommissions')})
                          </p>
                          <div className="border-t-2 border-gray-300 pt-2 mt-2">
                            <p className="text-base sm:text-lg font-bold break-words">
                              {t('nutrition.commission.total')} = <span className="text-green-600">{result.commission.toLocaleString(localeString, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}</span> {t('nutrition.commission.egp')}
                            </p>
                          </div>
                        </div>
                      )
                    } else {
                      return (
                        <p className="text-sm sm:text-base md:text-lg break-words">
                          {result.monthlyIncome.toLocaleString(localeString)} × {result.percentage}% ={' '}
                          <span className="font-bold text-green-600">
                            {result.commission.toLocaleString(localeString, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>{' '}
                          {t('nutrition.commission.egp')}
                        </p>
                      )
                    }
                  })()}
                </div>
              </div>

              {/* ملاحظة */}
              <div className="bg-amber-50 border-r-4 border-amber-500 rounded-lg p-3 sm:p-4">
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="text-lg sm:text-xl md:text-2xl">⚠️</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-amber-800 mb-1 text-sm sm:text-base">{t('nutrition.commission.importantNote')}</p>
                    <p className="text-xs sm:text-sm text-amber-700">
                      {t('nutrition.commission.displayOnlyNote')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* نتائج الطريقة الثانية: حسب الحصص المستخدمة */}
      {calculationMethod === 'sessions' && (
        <div className="mt-6">
          <div className="bg-gradient-to-br from-green-50 to-teal-50 border-2 border-green-300 rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <span>📊</span>
              <span>{t('nutrition.commission.commissionBySessions')}</span>
            </h2>

            {loadingSessionData ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
                <p className="text-gray-600">{t('nutrition.commission.calculatingCommission')}</p>
              </div>
            ) : sessionCommissions.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📭</div>
                <p className="text-gray-600 font-bold">{t('nutrition.commission.noDataToDisplay')}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {selectedCoach ? t('nutrition.commission.noSessionsForSelectedCoach', { coach: selectedCoach }) : t('nutrition.commission.selectCoachToViewSessions')}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessionCommissions.map((coach, index) => (
                  <div key={index} className="bg-white rounded-xl p-5 shadow-md border-2 border-green-200">
                    {/* معلومات الكوتش */}
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-1">{coach.nutritionistName}</h3>
                        <p className="text-sm text-gray-600">
                          {t('nutrition.commission.ptSubscriptionsAndSessions', {
                            nutritionCount: coach.nutritionCount.toString(),
                            sessions: coach.totalUsedSessions.toString()
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-green-600">
                          {coach.commission.toLocaleString(localeString, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })} {t('nutrition.commission.egp')}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{t('nutrition.commission.commissionWithPercentage', { percentage: coach.percentage.toString() })}</p>
                      </div>
                    </div>

                    {/* إحصائيات */}
                    <div className={`grid ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'} gap-3 mb-4 pb-4 border-b`}>
                      <div className="bg-blue-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-600 mb-1">{t('nutrition.commission.sessionsValue')}</p>
                        <p className="text-lg font-bold text-blue-700">
                          {coach.totalSessionsValue.toLocaleString(localeString)} {t('nutrition.commission.egp')}
                        </p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-600 mb-1">{t('nutrition.commission.coachCommission')}</p>
                        <p className="text-lg font-bold text-green-700">
                          {coach.commission.toLocaleString(localeString)} {t('nutrition.commission.egp')}
                        </p>
                      </div>
                      {/* نصيب الجيم - للأدمن فقط */}
                      {isAdmin && (
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-600 mb-1">{t('nutrition.commission.gymShare')}</p>
                          <p className="text-lg font-bold text-gray-700">
                            {coach.gymShare.toLocaleString(localeString)} {t('nutrition.commission.egp')}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* تفاصيل كل جلسة تغذية */}
                    <details className="group">
                      <summary className="cursor-pointer text-sm font-bold text-green-700 hover:text-green-800 transition-colors flex items-center gap-2">
                        <span className="group-open:rotate-90 transition-transform">▶</span>
                        <span>{t('nutrition.commission.showSubscriptionDetails', { count: coach.nutritionCount.toString() })}</span>
                      </summary>
                      <div className="mt-3 space-y-2 pl-6">
                        {coach.details.map((pt) => (
                          <div key={pt.nutritionNumber} className="bg-gray-50 rounded-lg p-3 text-sm border border-gray-200">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-bold text-gray-800">
                                  تغذية #{pt.nutritionNumber} - {pt.clientName}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">
                                  {t('nutrition.commission.sessionUsageDetails', {
                                    used: pt.usedSessions.toString(),
                                    total: pt.sessionsPurchased.toString(),
                                    remaining: pt.sessionsRemaining.toString()
                                  })}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-green-600">
                                  {pt.sessionValue.toLocaleString(localeString)} {t('nutrition.commission.egp')}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {pt.usedSessions} × {pt.pricePerSession} {t('nutrition.commission.egp')}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* إحصائيات إضافية */}
      {result && calculationMethod === 'revenue' && (
        <div className={`mt-6 grid grid-cols-1 ${isAdmin ? 'md:grid-cols-3' : ''} gap-4`}>
          {/* نصيب الجيم - للأدمن فقط */}
          {isAdmin && (
            <div className="bg-white rounded-lg shadow-md p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm mb-1">{t('nutrition.commission.gymShare')}</p>
                  <p className="text-2xl font-bold text-primary-600">
                    {result.gymShare.toLocaleString(localeString, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    {t('nutrition.commission.egp')}
                  </p>
                </div>
                <div className="text-4xl">🏢</div>
              </div>
            </div>
          )}

          {/* نسبة الجيم - للأدمن فقط */}
          {isAdmin && (
            <div className="bg-white rounded-lg shadow-md p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm mb-1">{t('nutrition.commission.gymPercentage')}</p>
                  <p className="text-2xl font-bold text-purple-600">{100 - result.percentage}%</p>
                </div>
                <div className="text-4xl">📉</div>
              </div>
            </div>
          )}

          {/* حالة الدخل - للجميع */}
          <div className="bg-white rounded-lg shadow-md p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">{t('nutrition.commission.incomeStatus')}</p>
                <p className="text-lg font-bold text-green-600">
                  {result.monthlyIncome >= 20000
                    ? `🔥 ${t('nutrition.commission.excellent')}`
                    : result.monthlyIncome >= 15000
                    ? `✅ ${t('nutrition.commission.veryGood')}`
                    : result.monthlyIncome >= 10000
                    ? `👍 ${t('nutrition.commission.good')}`
                    : `💪 ${t('nutrition.commission.needsImprovement')}`}
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
              {t('nutrition.commission.allCoachesSummary', {
                fromDate: new Date(dateFrom).toLocaleDateString(localeString),
                toDate: new Date(dateTo).toLocaleDateString(localeString)
              })}
            </span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-100 to-gray-200">
                <tr>
                  <th className="px-4 py-3 text-right">{t('nutrition.commission.coach')}</th>
                  <th className="px-4 py-3 text-right">{t('nutrition.commission.clients')}</th>
                  <th className="px-4 py-3 text-right">{t('nutrition.commission.totalSessions')}</th>
                  <th className="px-4 py-3 text-right">{t('nutrition.commission.completedSessions')}</th>
                  <th className="px-4 py-3 text-right">{t('nutrition.commission.totalIncome')}</th>
                  <th className="px-4 py-3 text-right">{t('nutrition.commission.percentage')}</th>
                  <th className="px-4 py-3 text-right">{t('nutrition.commission.expectedCommission')}</th>
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
                      <tr key={stat.nutritionistName} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold">{stat.nutritionistName}</td>
                        <td className="px-4 py-3 text-center">{stat.earnings.clients}</td>
                        <td className="px-4 py-3 text-center">{stat.earnings.totalSessions}</td>
                        <td className="px-4 py-3 text-center text-green-600 font-bold">
                          {stat.earnings.completedSessions}
                        </td>
                        <td className="px-4 py-3 font-bold text-primary-600">
                          {stat.earnings.totalRevenue.toLocaleString(localeString, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}{' '}
                          {t('nutrition.commission.egp')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold text-lg">{percentage}%</span>
                        </td>
                        <td className="px-4 py-3 font-bold text-green-600">
                          {commission.toLocaleString(localeString, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}{' '}
                          {t('nutrition.commission.egp')}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
              <tfoot className="bg-gradient-to-r from-primary-50 to-purple-50 font-bold">
                <tr>
                  <td className="px-4 py-3">{t('nutrition.commission.total')}</td>
                  <td className="px-4 py-3 text-center">
                    {new Set(
                      allCoachesStats.flatMap((s) =>
                        nutritionSessions
                          .filter((pt) => pt.nutritionistName === s.nutritionistName)
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
                  <td className="px-4 py-3 text-primary-600">
                    {allCoachesStats
                      .reduce((sum, s) => sum + s.earnings.totalRevenue, 0)
                      .toLocaleString(localeString, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}{' '}
                    {t('nutrition.commission.egp')}
                  </td>
                  <td className="px-4 py-3 text-center">-</td>
                  <td className="px-4 py-3 text-green-600">
                    {allCoachesStats
                      .reduce((sum, s) => {
                        const percentage = calculatePercentage(s.earnings.totalRevenue)
                        return sum + (s.earnings.totalRevenue * percentage) / 100
                      }, 0)
                      .toLocaleString(localeString, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}{' '}
                    {t('nutrition.commission.egp')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {allCoachesStats.filter((stat) => stat.earnings.totalRevenue > 0).length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">📊</div>
              <p className="text-xl">{t('nutrition.commission.noPTDataForPeriod')}</p>
            </div>
          )}
        </div>
      )}

      {/* جدول عمولات تسجيل الأعضاء */}
      <div className="mt-6 bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <span>💵</span>
          <span>
            {t('nutrition.commission.memberSignupCommissionsTitle', {
              fromDate: new Date(dateFrom).toLocaleDateString(localeString),
              toDate: new Date(dateTo).toLocaleDateString(localeString)
            })}
          </span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-green-100 to-emerald-200">
              <tr>
                <th className="px-4 py-3 text-right">{t('nutrition.commission.coach')}</th>
                <th className="px-4 py-3 text-center">{t('nutrition.commission.staffNumber')}</th>
                <th className="px-4 py-3 text-center">{t('nutrition.commission.subscriptionCount')}</th>
                <th className="px-4 py-3 text-center">{t('nutrition.commission.commissionPerSubscription')}</th>
                <th className="px-4 py-3 text-center">{t('nutrition.commission.totalCommissions')}</th>
              </tr>
            </thead>
            <tbody>
              {memberSignupCommissions.length > 0 ? (
                memberSignupCommissions.map((commission) => (
                  <tr key={commission.nutritionistId} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold">{commission.nutritionistName}</td>
                    <td className="px-4 py-3 text-center text-gray-600">#{commission.staffCode}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block bg-primary-100 text-primary-800 font-bold px-3 py-1 rounded-full">
                        {commission.count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-gray-700">
                      50 {t('nutrition.commission.egp')}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-green-600 text-lg">
                      {commission.totalAmount.toLocaleString(localeString)} {t('nutrition.commission.egp')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    <div className="text-6xl mb-4">📭</div>
                    <p className="text-xl">{t('nutrition.commission.noCommissionsInPeriod')}</p>
                  </td>
                </tr>
              )}
            </tbody>
            {memberSignupCommissions.length > 0 && (
              <tfoot className="bg-gradient-to-r from-green-50 to-emerald-100 font-bold">
                <tr>
                  <td className="px-4 py-3" colSpan={2}>{t('nutrition.commission.total')}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block bg-primary-500 text-white font-bold px-3 py-1 rounded-full">
                      {memberSignupCommissions.reduce((sum, c) => sum + c.count, 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">-</td>
                  <td className="px-4 py-3 text-center text-green-600 text-xl">
                    {memberSignupCommissions.reduce((sum, c) => sum + c.totalAmount, 0).toLocaleString(localeString)} {t('nutrition.commission.egp')}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-gray-700 to-gray-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {t('nutrition.commission.settingsModalTitle')}
                </h2>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded">
                <p className="text-blue-800 text-sm">
                  <strong>{t('nutrition.commission.settingsNote')}</strong> {t('nutrition.commission.settingsNoteText')}
                </p>
              </div>

              {/* حدود الدخل الشهري */}
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span>💰</span>
                  {t('nutrition.commission.monthlyIncomeLimits')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
                    <label className="block text-sm font-medium mb-2 text-gray-700">
                      {t('nutrition.commission.tier1Label')}
                    </label>
                    <input
                      type="number"
                      value={commissionSettings.tier1Limit}
                      onChange={(e) => setCommissionSettings({ ...commissionSettings, tier1Limit: parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg font-mono focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                      placeholder="5000"
                    />
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
                    <label className="block text-sm font-medium mb-2 text-gray-700">
                      {t('nutrition.commission.tier2Label')}
                    </label>
                    <input
                      type="number"
                      value={commissionSettings.tier2Limit}
                      onChange={(e) => setCommissionSettings({ ...commissionSettings, tier2Limit: parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg font-mono focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                      placeholder="11000"
                    />
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
                    <label className="block text-sm font-medium mb-2 text-gray-700">
                      {t('nutrition.commission.tier3Label')}
                    </label>
                    <input
                      type="number"
                      value={commissionSettings.tier3Limit}
                      onChange={(e) => setCommissionSettings({ ...commissionSettings, tier3Limit: parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg font-mono focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                      placeholder="15000"
                    />
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
                    <label className="block text-sm font-medium mb-2 text-gray-700">
                      {t('nutrition.commission.tier4Label')}
                    </label>
                    <input
                      type="number"
                      value={commissionSettings.tier4Limit}
                      onChange={(e) => setCommissionSettings({ ...commissionSettings, tier4Limit: parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg font-mono focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                      placeholder="20000"
                    />
                  </div>
                </div>
              </div>

              {/* النسب المئوية */}
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span>📊</span>
                  {t('nutrition.commission.commissionPercentages')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
                    <label className="block text-sm font-medium mb-2 text-green-700">
                      {t('nutrition.commission.tier1Percentage')}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={commissionSettings.tier1Rate}
                        onChange={(e) => setCommissionSettings({ ...commissionSettings, tier1Rate: parseFloat(e.target.value) })}
                        className="w-full px-4 py-3 border-2 border-green-300 rounded-lg text-lg font-mono focus:border-green-500 focus:ring-2 focus:ring-green-200"
                        placeholder="25"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600 font-bold">%</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{t('nutrition.commission.lessThanAmount', { amount: commissionSettings.tier1Limit.toLocaleString(localeString) })} {t('nutrition.commission.currency')}</p>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                    <label className="block text-sm font-medium mb-2 text-blue-700">
                      {t('nutrition.commission.tier2Percentage')}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={commissionSettings.tier2Rate}
                        onChange={(e) => setCommissionSettings({ ...commissionSettings, tier2Rate: parseFloat(e.target.value) })}
                        className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg text-lg font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        placeholder="30"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 font-bold">%</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{commissionSettings.tier1Limit.toLocaleString(localeString)} - {(commissionSettings.tier2Limit - 1).toLocaleString(localeString)}</p>
                  </div>

                  <div className="bg-yellow-50 p-4 rounded-lg border-2 border-yellow-200">
                    <label className="block text-sm font-medium mb-2 text-yellow-700">
                      {t('nutrition.commission.tier3Percentage')}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={commissionSettings.tier3Rate}
                        onChange={(e) => setCommissionSettings({ ...commissionSettings, tier3Rate: parseFloat(e.target.value) })}
                        className="w-full px-4 py-3 border-2 border-yellow-300 rounded-lg text-lg font-mono focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200"
                        placeholder="35"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-yellow-600 font-bold">%</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{commissionSettings.tier2Limit.toLocaleString(localeString)} - {(commissionSettings.tier3Limit - 1).toLocaleString(localeString)}</p>
                  </div>

                  <div className="bg-orange-50 p-4 rounded-lg border-2 border-orange-200">
                    <label className="block text-sm font-medium mb-2 text-orange-700">
                      {t('nutrition.commission.tier4Percentage')}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={commissionSettings.tier4Rate}
                        onChange={(e) => setCommissionSettings({ ...commissionSettings, tier4Rate: parseFloat(e.target.value) })}
                        className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg text-lg font-mono focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                        placeholder="40"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-600 font-bold">%</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{commissionSettings.tier3Limit.toLocaleString(localeString)} - {(commissionSettings.tier4Limit - 1).toLocaleString(localeString)}</p>
                  </div>

                  <div className="bg-red-50 p-4 rounded-lg border-2 border-red-200">
                    <label className="block text-sm font-medium mb-2 text-red-700">
                      {t('nutrition.commission.tier5Percentage')}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={commissionSettings.tier5Rate}
                        onChange={(e) => setCommissionSettings({ ...commissionSettings, tier5Rate: parseFloat(e.target.value) })}
                        className="w-full px-4 py-3 border-2 border-red-300 rounded-lg text-lg font-mono focus:border-red-500 focus:ring-2 focus:ring-red-200"
                        placeholder="45"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-red-600 font-bold">%</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{t('nutrition.commission.orMoreAmount', { amount: commissionSettings.tier4Limit.toLocaleString(localeString) })} {t('nutrition.commission.currency')}</p>
                  </div>
                </div>
              </div>

              {/* أزرار الحفظ */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-4 rounded-lg font-bold text-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingSettings ? t('nutrition.commission.savingSettings') : t('nutrition.commission.saveSettings')}
                </button>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="px-8 bg-gray-200 hover:bg-gray-300 text-gray-700 py-4 rounded-lg font-bold text-lg transition-all"
                >
                  {t('nutrition.commission.cancelSettings')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
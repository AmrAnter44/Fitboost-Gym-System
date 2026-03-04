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
  paidSessionsValue: number      // ✅ قيمة الجلسات المدفوعة فقط
  freeSessionsValue: number       // ✅ قيمة الجلسات المجانية
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
  const [nutritionAttendanceRecords, setNutritionAttendanceRecords] = useState<any[]>([])  // ✅ سجلات الحضور
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

  // حالة مودال التحصيل
  const [showPayrollModal, setShowPayrollModal] = useState(false)
  const [payrollCommission, setPayrollCommission] = useState(0)
  const [payrollSalary, setPayrollSalary] = useState<string>('0')
  const [payrollCoachName, setPayrollCoachName] = useState('')
  const [payrollStaffId, setPayrollStaffId] = useState<string | null>(null)
  const [payrollLoading, setPayrollLoading] = useState(false)
  const [payrollDeductions, setPayrollDeductions] = useState<Array<{ id: string; amount: number; reason: string }>>([])
  const [loadingDeductions, setLoadingDeductions] = useState(false)
  const [lastPayrollDates, setLastPayrollDates] = useState<Record<string, string>>({})

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

  // إعدادات الجلسات المجانية
  const [freeSessionsSettings, setFreeSessionsSettings] = useState({
    trackFreeSessionsCost: false,
    freeNutritionSessionPrice: 0
  })
  const [freeSessions, setFreeSessions] = useState<any[]>([])
  const [loadingFreeSessionsSettings, setLoadingFreeSessionsSettings] = useState(false)


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
    fetchLastPayrollDates()
    fetchFreeSessionsSettings()
    fetchFreeSessions()
  }, [])

  const fetchLastPayrollDates = async () => {
    try {
      const res = await fetch('/api/expenses?type=staff_salary')
      if (res.ok) {
        const expenses = await res.json()
        const dates: Record<string, string> = {}
        for (const exp of expenses) {
          if (exp.staffId && !dates[exp.staffId]) {
            dates[exp.staffId] = exp.createdAt
          }
        }
        setLastPayrollDates(dates)
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    fetchMemberSignupCommissions()
  }, [dateFrom, dateTo])

  // مراقبة تغيير طريقة الحساب
  useEffect(() => {
  }, [calculationMethod, methodLoaded, isAdmin])

  // اختيار الكوتش تلقائياً
  useEffect(() => {
    if (coaches.length > 0 && currentUser && !selectedCoach) {
      // إذا كان المستخدم COACH، اختر الكوتش المرتبط به
      if (currentUser.role === 'COACH' && currentUser.staffId) {
        const coachStaff = coaches.find((c: Staff) => c.id === currentUser.staffId)
        if (coachStaff) {
          setSelectedCoach(coachStaff.name)
        }
      }
      // إذا كان هناك كوتش واحد فقط (حالة Admin مع كوتش واحد)
      else if (coaches.length === 1) {
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
        // ✅ النسبة على الجلسات المدفوعة فقط + الجلسات المجانية كاملة
        const paidCommission = (coachData.paidSessionsValue * percentage) / 100
        const commission = paidCommission + coachData.freeSessionsValue
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

      // جلب جلسات التغذية (الاشتراكات)
      const nutritionResponse = await fetch('/api/nutrition')
      const nutritionData: NutritionSession[] = await nutritionResponse.json()
      setNutritionSessions(nutritionData)

      // ✅ جلب سجلات الحضور الفعلية
      const attendanceResponse = await fetch('/api/nutrition/sessions')
      if (attendanceResponse.ok) {
        const attendanceData = await attendanceResponse.json()
        const paidAttendedSessions = attendanceData.filter((session: any) =>
          !session.isFreeSession && session.attended
        )
        setNutritionAttendanceRecords(paidAttendedSessions)
      }

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

  const fetchFreeSessionsSettings = async () => {
    try {
      setLoadingFreeSessionsSettings(true)
      const response = await fetch('/api/settings/services')
      if (response.ok) {
        const data = await response.json()
        setFreeSessionsSettings({
          trackFreeSessionsCost: data.trackFreeSessionsCost || false,
          freeNutritionSessionPrice: data.freeNutritionSessionPrice || 0
        })
      }
    } catch (error) {
      console.error('Error fetching free sessions settings:', error)
    } finally {
      setLoadingFreeSessionsSettings(false)
    }
  }

  const fetchFreeSessions = async () => {
    try {
      const response = await fetch('/api/nutrition/sessions')
      if (response.ok) {
        const data = await response.json()
        // فلترة الجلسات المجانية فقط (واللي لم يتم تحصيلها)
        const freeNutritionSessions = data.filter((session: any) =>
          session.isFreeSession === true && !session.collectedInExpenseId
        )
        setFreeSessions(freeNutritionSessions)
      }
    } catch (error) {
      console.error('Error fetching free sessions:', error)
    }
  }

  const fetchMemberSignupCommissions = async () => {
    try {
      const response = await fetch(`/api/commissions/member-signups?startDate=${dateFrom}&endDate=${dateTo}`)
      if (response.ok) {
        const data = await response.json()
        setMemberSignupCommissions(data)
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
      }
    } catch (error) {
      console.error('Error fetching commission settings:', error)
    }
  }

  // حفظ إعدادات الكومشن
  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      // حفظ إعدادات الكوميشن
      const commissionResponse = await fetch('/api/commission-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commissionSettings)
      })

      // حفظ إعدادات الجلسات المجانية
      const freeSessionsResponse = await fetch('/api/settings/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackFreeSessionsCost: freeSessionsSettings.trackFreeSessionsCost,
          freeNutritionSessionPrice: freeSessionsSettings.freeNutritionSessionPrice
        })
      })

      if (commissionResponse.ok && freeSessionsResponse.ok) {
        toast.success(t('nutrition.commission.settingsSavedSuccess'))
        setShowSettingsModal(false)
        // إعادة الحساب إذا كان هناك كوتش محدد
        if (selectedCoach) {
          handleCalculate()
        }
      } else {
        const data = await commissionResponse.json()
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
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setCurrentUser(data.user)
        const isAdminUser = data.user.role === 'ADMIN' || data.user.role === 'OWNER'
        setIsAdmin(isAdminUser)
      }
    } catch (error) {
      console.error('Error fetching current user:', error)
    }
  }

  // جلب طريقة الحساب الافتراضية
  const fetchDefaultCalculationMethod = async () => {
    try {
      const response = await fetch('/api/settings/commission')
      if (response.ok) {
        const data = await response.json()

        if (data.defaultCommissionMethod) {
          setCalculationMethod(data.defaultCommissionMethod)
        } else {
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
      const response = await fetch('/api/settings/commission', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultCommissionMethod: method })
      })

      if (response.ok) {
        const result = await response.json()
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


    // 2. تجميع حسب الكوتش بناءً على سجلات الحضور الفعلية
    const coachMap = new Map<string, NutritionSessionsData[]>()

    for (const pt of filteredNutritions) {
      // ✅ حساب الجلسات المستخدمة من سجلات الحضور في الفترة المحددة فقط
      const attendedSessionsInPeriod = nutritionAttendanceRecords.filter(record =>
        record.nutritionNumber === pt.nutritionNumber &&
        record.attendedAt &&
        new Date(record.attendedAt) >= start &&
        new Date(record.attendedAt) <= end
      )

      const usedSessions = attendedSessionsInPeriod.length
      const sessionValue = usedSessions * pt.pricePerSession

      // فقط إضافة إذا كان لديه جلسات في الفترة
      if (usedSessions > 0) {
        const data: NutritionSessionsData = {
          nutritionNumber: pt.nutritionNumber,
          clientName: pt.clientName,
          nutritionistName: pt.nutritionistName,
          nutritionistUserId: null,
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
    }

    // 3. حساب الكومشن لكل كوتش
    const results: SessionBasedCommission[] = []

    for (const [nutritionistName, nutritionList] of coachMap.entries()) {
      const totalUsedSessions = nutritionList.reduce((sum, pt) => sum + pt.usedSessions, 0)
      const paidSessionsValue = nutritionList.reduce((sum, pt) => sum + pt.sessionValue, 0)

      // ✅ حساب قيمة الجلسات المجانية (تُضاف كاملة للعمولة بدون نسبة)
      let freeSessionsValue = 0
      if (freeSessionsSettings.trackFreeSessionsCost && freeSessionsSettings.freeNutritionSessionPrice > 0) {
        const coachFreeSessions = freeSessions.filter((session: any) => {
          // تصفية حسب اسم الأخصائي
          const sessionNutritionistName = session.nutritionistName || session.attendedBy || ''
          if (sessionNutritionistName !== nutritionistName) return false

          // تصفية حسب التاريخ
          const sessionDate = new Date(session.sessionDate || session.attendedAt)
          return sessionDate >= start && sessionDate <= end
        })

        const freeSessionsCount = coachFreeSessions.length
        freeSessionsValue = freeSessionsCount * freeSessionsSettings.freeNutritionSessionPrice
      }

      // حساب النسبة على الجلسات المدفوعة فقط
      const percentage = calculatePercentage(paidSessionsValue)

      // العمولة = (جلسات مدفوعة × نسبة%) + جلسات مجانية (100%)
      const paidCommission = (paidSessionsValue * percentage) / 100
      const commission = paidCommission + freeSessionsValue

      // نصيب الجيم من الجلسات المدفوعة فقط
      const gymShare = paidSessionsValue - paidCommission

      // الإجمالي للعرض فقط
      const totalSessionsValue = paidSessionsValue + freeSessionsValue

      results.push({
        nutritionistName,
        nutritionistUserId: '', // لا يوجد في البيانات الحالية
        totalUsedSessions,
        totalSessionsValue,
        paidSessionsValue,      // ✅ قيمة الجلسات المدفوعة فقط
        freeSessionsValue,      // ✅ قيمة الجلسات المجانية
        percentage,
        commission,
        gymShare,
        nutritionCount: nutritionList.length,
        details: nutritionList
      })

    }

    return results.sort((a, b) => b.commission - a.commission)
  }

  // دالة حساب تفاصيل الجلسات المجانية للأخصائي
  const getFreeSessionsDetails = (nutritionistName: string) => {
    if (!freeSessionsSettings.trackFreeSessionsCost || freeSessionsSettings.freeNutritionSessionPrice <= 0) {
      return { count: 0, value: 0, sessions: [] }
    }

    const start = new Date(dateFrom)
    const end = new Date(dateTo)
    end.setHours(23, 59, 59, 999)

    const nutritionistFreeSessions = freeSessions.filter((session: any) => {
      // تصفية حسب اسم الأخصائي
      const sessionNutritionistName = session.nutritionistName || session.attendedBy || ''
      if (sessionNutritionistName !== nutritionistName) return false

      // تصفية حسب التاريخ
      const sessionDate = new Date(session.sessionDate || session.attendedAt)
      return sessionDate >= start && sessionDate <= end
    })

    const count = nutritionistFreeSessions.length
    const value = count * freeSessionsSettings.freeNutritionSessionPrice

    return { count, value, sessions: nutritionistFreeSessions }
  }

  // دالة حساب أرباح الأخصائي من التغذية (من الإيصالات - الطريقة الصحيحة)
  const calculateNutritionistEarnings = (nutritionistName: string, startDate: string, endDate: string): NutritionistEarnings => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    // حساب الإيرادات من إيصالات التغذية (جميع الأنواع)

    const nutritionReceipts = receipts.filter((receipt) => {
      // فلترة إيصالات التغذية فقط
      const isNutritionType = NUTRITION_RECEIPT_TYPES.includes(receipt.type)
      if (!isNutritionType) {
        if (receipt.type.includes('nutrition') || receipt.type.includes('تغذية')) {
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
        }
        return matches
      } catch {
        return false
      }
    })


    // حساب الإيرادات من الإيصالات (المبالغ الفعلية المدفوعة)
    const nutritionRevenue = nutritionReceipts.reduce((sum, receipt) => sum + receipt.amount, 0)

    // إضافة عمولات تسجيل الأعضاء
    const coachSignupCommissions = memberSignupCommissions.find(c => c.nutritionistName === nutritionistName)
    const signupRevenue = coachSignupCommissions?.totalAmount || 0


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

  // فتح مودال التحصيل
  const openPayrollModal = async (coachName: string, commission: number) => {
    const staff = coaches.find(c => c.name === coachName)
    setPayrollCoachName(coachName)
    setPayrollCommission(commission)
    setPayrollSalary(staff?.salary?.toString() || '0')
    setPayrollStaffId(staff?.id || null)
    setPayrollDeductions([])
    setShowPayrollModal(true)

    if (staff?.id) {
      setLoadingDeductions(true)
      try {
        const res = await fetch(`/api/staff-deductions?staffId=${staff.id}&isApplied=false`)
        if (res.ok) {
          const data = await res.json()
          setPayrollDeductions(Array.isArray(data) ? data : [])
        }
      } catch { /* ignore */ } finally {
        setLoadingDeductions(false)
      }
    }
  }

  // تأكيد التحصيل وإنشاء مصروف
  const handleConfirmPayroll = async () => {
    const salary = parseFloat(payrollSalary) || 0
    const deductionTotal = payrollDeductions.reduce((sum, d) => sum + d.amount, 0)
    const total = payrollCommission + salary - deductionTotal
    setPayrollLoading(true)
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'staff_salary',
          amount: total,
          description: `تحصيل: ${payrollCoachName}`,
          notes: `كوميشن: ${payrollCommission.toFixed(2)} + مرتب: ${salary.toFixed(2)}${deductionTotal > 0 ? ` - خصومات: ${deductionTotal.toFixed(2)}` : ''}`,
          staffId: payrollStaffId
        })
      })
      if (res.ok) {
        const expenseData = await res.json()
        const expenseId = expenseData.id

        for (const d of payrollDeductions) {
          await fetch('/api/staff-deductions', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: d.id, isApplied: true, appliedAt: new Date().toISOString() })
          })
        }

        // تحديد الجلسات المجانية كمحصلة
        if (expenseId && freeSessionsSettings.trackFreeSessionsCost) {
          try {
            await fetch('/api/sessions/mark-collected', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                serviceType: 'Nutrition',
                coachName: payrollCoachName,
                startDate: dateFrom,
                endDate: dateTo,
                expenseId
              })
            })
          } catch (error) {
            console.error('Error marking free sessions as collected:', error)
          }
        }

        toast.success(t('nutrition.commission.payrollSuccess', { name: payrollCoachName }))
        setShowPayrollModal(false)
        fetchLastPayrollDates()
      } else {
        toast.error(t('nutrition.commission.payrollFail'))
      }
    } catch {
      toast.error(t('nutrition.commission.payrollConnectionError'))
    } finally {
      setPayrollLoading(false)
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
    if (percentage <= 40) return 'from-primary-500 to-primary-600'
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
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1">
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-6">
        <label className="block text-sm font-bold mb-3 text-gray-700 dark:text-gray-200">
          📅 {t('nutrition.commission.selectPeriod')}
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">{t('nutrition.commission.fromDate')}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">{t('nutrition.commission.toDate')}</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Calculation Method - Coach View (read-only) */}
      {!isAdmin && (
        /* Coach View - Show current method only (read-only) */
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 mb-4 sm:mb-6">
          <label className="block text-sm font-bold mb-3 text-gray-700 dark:text-gray-200">
            {t('nutrition.commission.calculationMethodLabel')}
          </label>
          {!methodLoaded || calculationMethod === null ? (
            <div className="px-4 sm:px-6 py-3 sm:py-4 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-center">
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
              <div className="mt-4 bg-blue-50 dark:bg-blue-900/50 border-l-4 border-blue-500 dark:border-blue-600 p-3 rounded">
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
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
            <span>📋</span>
            <span>{t('nutrition.commission.calculationData')}</span>
          </h2>

          {loading ? (
            <div className="text-center py-8 sm:py-12 text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm sm:text-base">{t('nutrition.commission.loading')}</div>
          ) : coaches.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <div className="text-4xl sm:text-6xl mb-4">😕</div>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">{t('nutrition.commission.noActiveCoaches')}</p>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-2">
                {t('nutrition.commission.addCoachesHint')}
              </p>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {/* Coach Selection - للأدمن فقط */}
              {isAdmin && (
                <div>
                  <label className="block text-xs sm:text-sm font-bold mb-2 sm:mb-3 text-gray-700 dark:text-gray-200">
                    👤 {coaches.length === 1 ? t('nutrition.commission.theCoach') : t('nutrition.commission.selectCoach')} <span className="text-red-600">*</span>
                  </label>
                  {coaches.length === 1 ? (
                    <div className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-primary-50 dark:bg-primary-900/50 border-2 border-primary-200 dark:border-primary-700 rounded-lg text-base sm:text-lg font-bold text-primary-700 dark:text-primary-300">
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
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-base sm:text-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition dark:bg-gray-700 dark:text-white"
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
                  <label className="block text-xs sm:text-sm font-bold mb-2 sm:mb-3 text-gray-700 dark:text-gray-200">
                    👤 {t('nutrition.commission.theCoach')}
                  </label>
                  <div className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-primary-50 to-primary-50 dark:from-primary-900/50 dark:to-primary-900/50 border-2 border-primary-300 dark:border-primary-700 rounded-lg text-base sm:text-lg font-bold text-primary-800 flex items-center gap-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    <span>🏋️</span>
                    <span>{selectedCoach}</span>
                  </div>
                </div>
              )}

              {/* Custom Income Option - فقط في طريقة الإيرادات */}
              {calculationMethod === 'revenue' && (
                <div className="bg-primary-50 dark:bg-primary-900/50 border-2 border-primary-200 dark:border-primary-700 rounded-xl p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCustomIncome}
                      onChange={(e) => setUseCustomIncome(e.target.checked)}
                      className="w-5 h-5 text-primary-600 rounded"
                    />
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                      {t('nutrition.commission.useCustomIncome')}
                    </span>
                  </label>
                </div>
              )}

              {/* Custom Income Input - فقط في طريقة الإيرادات */}
              {calculationMethod === 'revenue' && useCustomIncome && (
                <div>
                  <label className="block text-sm font-bold mb-3 text-gray-700 dark:text-gray-200">
                    💵 {t('nutrition.commission.customMonthlyIncome')} <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={customIncome}
                    onChange={(e) => setCustomIncome(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition dark:bg-gray-700 dark:text-white"
                    placeholder={t('nutrition.commission.exampleIncome')}
                  />
                </div>
              )}

              {/* جدول النسب - فقط في طريقة الإيرادات */}
              {calculationMethod === 'revenue' && (
                <div className="bg-gradient-to-br from-primary-50 to-primary-50 dark:from-primary-900/50 dark:to-primary-900/50 border-2 border-primary-200 dark:border-primary-700 rounded-xl p-5 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                  <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                    <span>📊</span>
                    <span>{t('nutrition.commission.percentageTable')}</span>
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center py-2 px-3 bg-white dark:bg-gray-800 rounded-lg">
                      <span>{t('nutrition.commission.lessThanAmount', { amount: commissionSettings.tier1Limit.toLocaleString(localeString) })} {t('nutrition.commission.egp')}</span>
                      <span className="font-bold text-orange-600">{commissionSettings.tier1Rate}%</span>
                    </div>
                    <div className="flex justify-between items-center py-2 px-3 bg-white dark:bg-gray-800 rounded-lg">
                      <span>{commissionSettings.tier1Limit.toLocaleString(localeString)} - {(commissionSettings.tier2Limit - 1).toLocaleString(localeString)} {t('nutrition.commission.egp')}</span>
                      <span className="font-bold text-yellow-600">{commissionSettings.tier2Rate}%</span>
                    </div>
                    <div className="flex justify-between items-center py-2 px-3 bg-white dark:bg-gray-800 rounded-lg">
                      <span>{commissionSettings.tier2Limit.toLocaleString(localeString)} - {(commissionSettings.tier3Limit - 1).toLocaleString(localeString)} {t('nutrition.commission.egp')}</span>
                      <span className="font-bold text-primary-600">{commissionSettings.tier3Rate}%</span>
                    </div>
                    <div className="flex justify-between items-center py-2 px-3 bg-white dark:bg-gray-800 rounded-lg">
                      <span>{commissionSettings.tier3Limit.toLocaleString(localeString)} - {(commissionSettings.tier4Limit - 1).toLocaleString(localeString)} {t('nutrition.commission.egp')}</span>
                      <span className="font-bold text-primary-600">{commissionSettings.tier4Rate}%</span>
                    </div>
                    <div className="flex justify-between items-center py-2 px-3 bg-white dark:bg-gray-800 rounded-lg">
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
                    className="px-4 sm:px-6 bg-gradient-to-r from-gray-200 to-gray-300 text-gray-700 dark:text-gray-200 py-3 sm:py-4 rounded-lg hover:from-gray-300 hover:to-gray-400 font-bold text-base sm:text-lg shadow-lg transform transition hover:scale-105 active:scale-95"
                  >
                    🔄 {t('nutrition.commission.resetButton')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Calculation Result */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
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
                    <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-base sm:text-lg text-center px-4">
                      {t('nutrition.commission.noSessionsForCoach')}
                    </p>
                  </div>
                )
              }

              return (
                <div className="space-y-3 sm:space-y-4">
                  {/* بطاقة الكوتش */}
                  <div className="bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-900/50 dark:to-teal-900/50 border-2 border-green-200 dark:border-green-700 rounded-xl p-3 sm:p-4 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="text-xl sm:text-2xl">👨‍🏫</div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">{t('nutrition.commission.coach')}</p>
                        <p className="text-base sm:text-xl md:text-2xl font-bold text-green-900 dark:text-green-300">{coachData.nutritionistName}</p>
                      </div>
                    </div>
                  </div>

                  {/* عدد الحصص المستخدمة */}
                  <div className="bg-gradient-to-br from-blue-50 to-primary-50 dark:from-blue-900/50 dark:to-primary-900/50 border-2 border-blue-200 dark:border-blue-700 rounded-xl p-3 sm:p-4 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    <div className="flex items-center gap-2 sm:gap-3 mb-2">
                      <div className="text-xl sm:text-2xl md:text-3xl">📊</div>
                      <div className="flex-1">
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">{t('nutrition.commission.usedSessionsCount')}</p>
                        <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-blue-900 dark:text-blue-300">{coachData.totalUsedSessions}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('nutrition.commission.fromPTSubscriptions', { count: coachData.nutritionCount.toString() })}</p>
                      </div>
                    </div>
                  </div>

                  {/* سعر الحصص */}
                  <div className="bg-gradient-to-br from-primary-50 to-pink-50 dark:from-primary-900/50 dark:to-pink-900/50 border-2 border-primary-200 dark:border-primary-700 rounded-xl p-3 sm:p-4 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    <div className="flex items-center gap-2 sm:gap-3 mb-2">
                      <div className="text-xl sm:text-2xl md:text-3xl">💵</div>
                      <div className="flex-1">
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">{t('nutrition.commission.totalSessionsValue')}</p>
                        <p className="text-lg sm:text-2xl md:text-3xl font-bold text-primary-900 dark:text-primary-300 break-words">
                          {coachData.totalSessionsValue.toLocaleString(localeString, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })} {t('nutrition.commission.egp')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* تفاصيل الجلسات المجانية */}
                  {(() => {
                    const freeSessionsDetails = getFreeSessionsDetails(coachData.nutritionistName)
                    if (freeSessionsDetails.count > 0) {
                      return (
                        <div className="bg-gradient-to-br from-lime-50 to-green-50 dark:from-lime-900/30 dark:to-green-900/30 border-2 border-lime-300 dark:border-lime-600 rounded-xl p-3 sm:p-4">
                          <div className="flex items-start gap-2 sm:gap-3">
                            <div className="text-xl sm:text-2xl md:text-3xl">🎁</div>
                            <div className="flex-1">
                              <p className="text-xs sm:text-sm font-bold text-lime-700 dark:text-lime-300 mb-2">
                                تفاصيل الجلسات المجانية
                              </p>
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-gray-600 dark:text-gray-300">عدد الجلسات:</span>
                                  <span className="font-bold text-lime-600 dark:text-lime-400">{freeSessionsDetails.count}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-gray-600 dark:text-gray-300">سعر الجلسة:</span>
                                  <span className="font-bold text-lime-600 dark:text-lime-400">
                                    {freeSessionsSettings.freeNutritionSessionPrice.toLocaleString(localeString)} ج.م
                                  </span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-lime-200 dark:border-lime-700">
                                  <span className="text-xs font-bold text-gray-700 dark:text-gray-200">القيمة الإجمالية:</span>
                                  <span className="text-lg font-black text-lime-700 dark:text-lime-300">
                                    {freeSessionsDetails.value.toLocaleString(localeString)} ج.م
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}

                  {/* نسبة الكومشن قابلة للتعديل */}
                  <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/50 dark:to-amber-900/50 border-2 border-orange-200 dark:border-orange-700 rounded-xl p-3 sm:p-4 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    <label className="block text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-200 mb-2 sm:mb-3">
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
                        className="flex-1 px-3 sm:px-4 py-2 sm:py-3 border-2 border-orange-300 dark:border-orange-600 rounded-lg text-xl sm:text-2xl md:text-3xl font-bold text-center focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:bg-gray-700 dark:text-white"
                      />
                      <span className="text-2xl sm:text-3xl md:text-4xl font-black text-orange-600">%</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 text-center">
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
                          = {coachData.paidSessionsValue.toLocaleString(localeString)} × {customSessionPercentage}%
                          {coachData.freeSessionsValue > 0 && ` + ${coachData.freeSessionsValue.toLocaleString(localeString)} (مجاني)`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* نصيب الجيم - للأدمن فقط */}
                  {isAdmin && (
                    <div className="bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-xl p-3 sm:p-4 md:p-5 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="text-xl sm:text-2xl md:text-3xl">🏢</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">{t('nutrition.commission.gymShare')}</p>
                          <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100 break-words">
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
                <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm sm:text-base md:text-lg text-center px-4">
                  {loadingSessionData ? t('nutrition.commission.calculatingSessions') : selectedCoach ? t('nutrition.commission.noDataAvailable') : t('nutrition.commission.selectCoachToViewSessions')}
                </p>
              </div>
            )
          ) : !result ? (
          <div className="flex flex-col items-center justify-center h-full py-8 sm:py-12">
            <div className="text-5xl sm:text-6xl md:text-8xl mb-4 sm:mb-6">🧮</div>
            <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm sm:text-base md:text-lg text-center px-4">
              {t('nutrition.commission.selectCoachToCalculate')}
            </p>
          </div>
        ) : (
            <div className="space-y-4 sm:space-y-6">
              {/* بطاقة الكوتش */}
              <div className="bg-gradient-to-br from-primary-50 to-primary-50 dark:from-primary-900/50 dark:to-primary-900/50 border-2 border-primary-200 dark:border-primary-700 rounded-xl p-3 sm:p-4 md:p-5 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <div className="text-xl sm:text-2xl md:text-3xl">👤</div>
                  <div>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">{t('nutrition.commission.coach')}</p>
                    <p className="text-lg sm:text-xl md:text-2xl font-bold text-primary-900 dark:text-primary-300">{result.nutritionistName}</p>
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
                  <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/50 dark:to-cyan-900/50 border-2 border-teal-200 dark:border-teal-700 rounded-xl p-3 sm:p-4 md:p-5 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
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
                          <div key={receipt.receiptNumber} className="bg-white dark:bg-gray-800 rounded-lg p-2 sm:p-3 border border-teal-200 dark:border-teal-700">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                <div className="bg-teal-100 dark:bg-teal-900/50 text-teal-800 dark:text-teal-300 font-bold w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm flex-shrink-0">
                                  {index + 1}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 break-words">
                                    {t('nutrition.commission.receiptLabel', { number: receipt.receiptNumber.toString() })} - {receipt.type}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 break-words">
                                    {details.clientName || 'N/A'} - {
                                      details.nutritionNumber < 0 ? '🏃 Day Use' : `تغذية #${details.nutritionNumber || 'N/A'}`
                                    }
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
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
                                <div className="bg-gray-50 dark:bg-gray-700 rounded p-2 text-center">
                                  <p className="text-xs text-gray-600 dark:text-gray-300">{t('nutrition.commission.sessions')}</p>
                                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{details.sessionsPurchased}</p>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-700 rounded p-2 text-center">
                                  <p className="text-xs text-gray-600 dark:text-gray-300">{t('nutrition.commission.pricePerSession')}</p>
                                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{details.pricePerSession}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-3 pt-3 border-t-2 border-teal-200 dark:border-teal-700">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-teal-100 dark:bg-teal-900/50 rounded-lg p-3">
                        <span className="font-bold text-sm sm:text-base text-gray-700 dark:text-gray-200">{t('nutrition.commission.totalPTRevenue')}</span>
                        <span className="text-lg sm:text-xl font-bold text-teal-600 dark:text-teal-400 break-words">
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
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/50 dark:to-emerald-900/50 border-2 border-green-200 dark:border-green-700 rounded-xl p-3 sm:p-4 md:p-5 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                    <h3 className="font-bold text-base sm:text-lg mb-3 flex items-center gap-2">
                      <span className="text-lg sm:text-xl">💵</span>
                      <span>{t('nutrition.commission.memberSubscriptions', { count: coachSignupData.count.toString() })}</span>
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {coachSignupData.commissions.map((commission, index) => (
                        <div key={commission.id} className="bg-white dark:bg-gray-800 rounded-lg p-2 sm:p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border border-green-200 dark:border-green-700">
                          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                            <div className="bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 font-bold w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm flex-shrink-0">
                              {index + 1}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 break-words">{commission.description || t('nutrition.commission.newMemberRegistration')}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
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
                    <div className="mt-3 pt-3 border-t-2 border-green-200 dark:border-green-700">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-green-100 dark:bg-green-900/50 rounded-lg p-3">
                        <span className="font-bold text-sm sm:text-base text-gray-700 dark:text-gray-200">{t('nutrition.commission.totalSubscriptionCommissions')}</span>
                        <span className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400 break-words">{coachSignupData.totalAmount} {t('nutrition.commission.currency')}</span>
                      </div>
                      <div className="mt-2 bg-green-200 dark:bg-green-900/50 rounded-lg p-2 text-center">
                        <p className="text-xs sm:text-sm font-bold text-green-800 dark:text-green-300">{t('nutrition.commission.coachGetsFullAmount')}</p>
                      </div>
                    </div>
                  </div>
                ) : null
              })()}

              {/* تفاصيل عمولات التغذية */}
              {nutritionCommissions.length > 0 && (
                <div className="bg-gradient-to-br from-primary-50 to-primary-50 dark:from-primary-900/50 dark:to-primary-900/50 border-2 border-primary-200 dark:border-primary-700 rounded-xl p-3 sm:p-4 md:p-5 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                  <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 flex items-center gap-2">
                    <span className="text-lg sm:text-xl">💎</span>
                    <span>{t('nutrition.commission.nutritionCommissionDetails', { count: nutritionCommissions.length.toString() })}</span>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-primary-100 dark:bg-primary-900/50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-right text-xs font-bold text-gray-700 dark:text-gray-200 border-b border-primary-200 dark:border-primary-700">{t('nutrition.commission.date')}</th>
                          <th className="px-3 py-2 text-right text-xs font-bold text-gray-700 dark:text-gray-200 border-b border-primary-200 dark:border-primary-700">{t('nutrition.commission.description')}</th>
                          <th className="px-3 py-2 text-right text-xs font-bold text-gray-700 dark:text-gray-200 border-b border-primary-200 dark:border-primary-700">{t('nutrition.commission.amountPaid')}</th>
                          <th className="px-3 py-2 text-right text-xs font-bold text-gray-700 dark:text-gray-200 border-b border-primary-200 dark:border-primary-700">{t('nutrition.commission.commissionRate')}</th>
                          <th className="px-3 py-2 text-right text-xs font-bold text-gray-700 dark:text-gray-200 border-b border-primary-200 dark:border-primary-700">{t('nutrition.commission.commissionAmount')}</th>
                        </tr>
                      </thead>
                      <tbody className="max-h-80 overflow-y-auto">
                        {nutritionCommissions.map((comm, index) => {
                          const notes = JSON.parse(comm.notes || '{}')
                          return (
                            <tr key={comm.id} className={`border-b border-primary-100 dark:border-primary-800 ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-primary-50 dark:bg-primary-900/30'}`}>
                              <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-200">
                                {new Date(comm.createdAt).toLocaleDateString(localeString, { day: 'numeric', month: 'short' })}
                              </td>
                              <td className="px-3 py-2 text-sm text-gray-800 dark:text-gray-100">{comm.description}</td>
                              <td className="px-3 py-2 text-sm font-mono text-gray-700 dark:text-gray-200">
                                {notes.paymentAmount?.toLocaleString(localeString) || 0} {t('nutrition.commission.currency')}
                              </td>
                              <td className="px-3 py-2 text-sm text-primary-600 dark:text-primary-400 font-bold">{notes.percentage || 0}%</td>
                              <td className="px-3 py-2 text-sm text-green-600 dark:text-green-400 font-bold">
                                {comm.amount.toLocaleString(localeString)} {t('nutrition.commission.currency')}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 pt-3 border-t-2 border-primary-200 dark:border-primary-700">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-primary-100 dark:bg-primary-900/50 rounded-lg p-3">
                      <span className="font-bold text-sm sm:text-base text-gray-700 dark:text-gray-200">{t('nutrition.commission.totalNutritionCommissions')}</span>
                      <span className="text-lg sm:text-xl font-bold text-primary-600 dark:text-primary-400 break-words">
                        {nutritionCommissions.reduce((sum, c) => sum + c.amount, 0).toLocaleString(localeString)} {t('nutrition.commission.egp')}
                      </span>
                    </div>
                    <div className="mt-2 bg-primary-200 dark:bg-primary-900/50 rounded-lg p-2 text-center">
                      <p className="text-xs sm:text-sm font-bold text-primary-800 dark:text-primary-300">
                        {t('nutrition.commission.eachPaymentCalculatedIndependently')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* الدخل الشهري */}
              <div className="bg-gradient-to-br from-cyan-50 to-primary-50 dark:from-cyan-900/50 dark:to-primary-900/50 border-2 border-cyan-200 dark:border-cyan-700 rounded-xl p-3 sm:p-4 md:p-5 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <div className="text-xl sm:text-2xl md:text-3xl">💵</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                      {useCustomIncome ? t('nutrition.commission.customIncome') : t('nutrition.commission.totalNutritionIncome')}
                    </p>
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-cyan-900 dark:text-cyan-300 break-words">
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
              <div className="bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-900/50 dark:to-gray-800/50 border-2 border-slate-300 dark:border-slate-700 rounded-xl p-3 sm:p-4 md:p-5 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                <h3 className="font-bold text-center mb-3 text-sm sm:text-base md:text-lg text-gray-700 dark:text-gray-200">{t('nutrition.commission.calculationFormula')}</h3>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 text-center">
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
                          <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 break-words">
                            <span className="font-bold text-teal-600">{nutritionRevenue.toLocaleString(localeString)}</span> (تغذية) ×
                            <span className="font-bold text-primary-600"> {result.percentage}%</span> =
                            <span className="font-bold text-green-600"> {nutritionCommission.toLocaleString(localeString)}</span>
                          </p>
                          <p className="text-base sm:text-lg font-bold text-gray-500 dark:text-gray-400 dark:text-gray-500">+</p>
                          <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 break-words">
                            <span className="font-bold text-green-600">{signupRevenue.toLocaleString(localeString)}</span> ({t('nutrition.commission.signupCommissions')})
                          </p>
                          <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-2 mt-2">
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
              <div className="bg-amber-50 dark:bg-amber-900/50 border-r-4 border-amber-500 dark:border-amber-600 rounded-lg p-3 sm:p-4">
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="text-lg sm:text-xl md:text-2xl">⚠️</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-amber-800 dark:text-amber-300 mb-1 text-sm sm:text-base">{t('nutrition.commission.importantNote')}</p>
                    <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-400">
                      {t('nutrition.commission.displayOnlyNote')}
                    </p>
                  </div>
                </div>
              </div>

              {/* زر التحصيل - الطريقة الأولى */}
              {(() => {
                const staff = coaches.find(c => c.name === result.nutritionistName)
                const lastDate = staff && lastPayrollDates[staff.id]
                return (
                  <div>
                    <button
                      onClick={() => openPayrollModal(result.nutritionistName, result.commission)}
                      className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-lg"
                    >
                      <span>💳</span>
                      <span>{t('nutrition.commission.payroll')}</span>
                    </button>
                    {lastDate && (
                      <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-1">
                        {t('nutrition.commission.lastPayroll')}: {new Date(lastDate).toLocaleDateString(localeString, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      </div>

      {/* نتائج الطريقة الثانية: حسب الحصص المستخدمة */}
      {calculationMethod === 'sessions' && (
        <div className="mt-6">
          <div className="bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-900/50 dark:to-teal-900/50 border-2 border-green-300 dark:border-green-700 rounded-xl shadow-lg p-6 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <span>📊</span>
              <span>{t('nutrition.commission.commissionBySessions')}</span>
            </h2>

            {loadingSessionData ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-300">{t('nutrition.commission.calculatingCommission')}</p>
              </div>
            ) : sessionCommissions.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📭</div>
                <p className="text-gray-600 dark:text-gray-300 font-bold">{t('nutrition.commission.noDataToDisplay')}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-2">
                  {selectedCoach ? t('nutrition.commission.noSessionsForSelectedCoach', { coach: selectedCoach }) : t('nutrition.commission.selectCoachToViewSessions')}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessionCommissions.map((coach, index) => (
                  <div key={index} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-md border-2 border-green-200 dark:border-green-700">
                    {/* معلومات الكوتش */}
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1">{coach.nutritionistName}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
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
                        <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">{t('nutrition.commission.commissionWithPercentage', { percentage: coach.percentage.toString() })}</p>
                      </div>
                    </div>

                    {/* إحصائيات */}
                    <div className={`grid ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'} gap-3 mb-4 pb-4 border-b dark:border-gray-700`}>
                      <div className="bg-blue-50 dark:bg-blue-900/50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">{t('nutrition.commission.sessionsValue')}</p>
                        <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                          {coach.totalSessionsValue.toLocaleString(localeString)} {t('nutrition.commission.egp')}
                        </p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/50 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">{t('nutrition.commission.coachCommission')}</p>
                        <p className="text-lg font-bold text-green-700 dark:text-green-300">
                          {coach.commission.toLocaleString(localeString)} {t('nutrition.commission.egp')}
                        </p>
                      </div>
                      {/* نصيب الجيم - للأدمن فقط */}
                      {isAdmin && (
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                          <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">{t('nutrition.commission.gymShare')}</p>
                          <p className="text-lg font-bold text-gray-700 dark:text-gray-200">
                            {coach.gymShare.toLocaleString(localeString)} {t('nutrition.commission.egp')}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* زر التحصيل - الطريقة الثانية */}
                    {(() => {
                      const staff = coaches.find(c => c.name === coach.nutritionistName)
                      const lastDate = staff && lastPayrollDates[staff.id]
                      return (
                        <div className="mt-2">
                          <button
                            onClick={() => openPayrollModal(coach.nutritionistName, coach.commission)}
                            className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold py-2 rounded-lg shadow transition-all flex items-center justify-center gap-2"
                          >
                            <span>💳</span>
                            <span>{t('nutrition.commission.payroll')}</span>
                          </button>
                          {lastDate && (
                            <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-1">
                              {t('nutrition.commission.lastPayroll')}: {new Date(lastDate).toLocaleDateString(localeString, { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          )}
                        </div>
                      )
                    })()}

                    {/* تفاصيل كل جلسة تغذية */}
                    <details className="group">
                      <summary className="cursor-pointer text-sm font-bold text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors flex items-center gap-2">
                        <span className="group-open:rotate-90 transition-transform">▶</span>
                        <span>{t('nutrition.commission.showSubscriptionDetails', { count: coach.nutritionCount.toString() })}</span>
                      </summary>
                      <div className="mt-3 space-y-2 pl-6">
                        {coach.details.map((pt) => (
                          <div key={pt.nutritionNumber} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-sm border border-gray-200 dark:border-gray-600">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-bold text-gray-800 dark:text-gray-100">
                                  تغذية #{pt.nutritionNumber} - {pt.clientName}
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
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
                                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 dark:text-gray-300 text-sm mb-1">{t('nutrition.commission.gymShare')}</p>
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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 dark:text-gray-300 text-sm mb-1">{t('nutrition.commission.gymPercentage')}</p>
                  <p className="text-2xl font-bold text-primary-600">{100 - result.percentage}%</p>
                </div>
                <div className="text-4xl">📉</div>
              </div>
            </div>
          )}

          {/* حالة الدخل - للجميع */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-300 text-sm mb-1">{t('nutrition.commission.incomeStatus')}</p>
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
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
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
              <thead className="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700">
                <tr>
                  <th className="px-4 py-3 text-right dark:text-gray-200">{t('nutrition.commission.coach')}</th>
                  <th className="px-4 py-3 text-right dark:text-gray-200">{t('nutrition.commission.clients')}</th>
                  <th className="px-4 py-3 text-right dark:text-gray-200">{t('nutrition.commission.totalSessions')}</th>
                  <th className="px-4 py-3 text-right dark:text-gray-200">{t('nutrition.commission.completedSessions')}</th>
                  <th className="px-4 py-3 text-right dark:text-gray-200">{t('nutrition.commission.totalIncome')}</th>
                  <th className="px-4 py-3 text-right dark:text-gray-200">{t('nutrition.commission.percentage')}</th>
                  <th className="px-4 py-3 text-right dark:text-gray-200">{t('nutrition.commission.expectedCommission')}</th>
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
                      <tr key={stat.nutritionistName} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3 font-semibold dark:text-gray-200">{stat.nutritionistName}</td>
                        <td className="px-4 py-3 text-center dark:text-gray-300">{stat.earnings.clients}</td>
                        <td className="px-4 py-3 text-center dark:text-gray-300">{stat.earnings.totalSessions}</td>
                        <td className="px-4 py-3 text-center text-green-600 dark:text-green-400 font-bold">
                          {stat.earnings.completedSessions}
                        </td>
                        <td className="px-4 py-3 font-bold text-primary-600 dark:text-primary-400">
                          {stat.earnings.totalRevenue.toLocaleString(localeString, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}{' '}
                          {t('nutrition.commission.egp')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold text-lg dark:text-gray-200">{percentage}%</span>
                        </td>
                        <td className="px-4 py-3 font-bold text-green-600 dark:text-green-400">
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
              <tfoot className="bg-gradient-to-r from-primary-50 to-primary-50 dark:from-primary-900/50 dark:to-primary-900/50 font-bold">
                <tr>
                  <td className="px-4 py-3 dark:text-gray-200">{t('nutrition.commission.total')}</td>
                  <td className="px-4 py-3 text-center dark:text-gray-200">
                    {new Set(
                      allCoachesStats.flatMap((s) =>
                        nutritionSessions
                          .filter((pt) => pt.nutritionistName === s.nutritionistName)
                          .map((pt) => pt.clientName)
                      )
                    ).size}
                  </td>
                  <td className="px-4 py-3 text-center dark:text-gray-200">
                    {allCoachesStats.reduce((sum, s) => sum + s.earnings.totalSessions, 0)}
                  </td>
                  <td className="px-4 py-3 text-center text-green-600 dark:text-green-400">
                    {allCoachesStats.reduce((sum, s) => sum + s.earnings.completedSessions, 0)}
                  </td>
                  <td className="px-4 py-3 text-primary-600 dark:text-primary-400">
                    {allCoachesStats
                      .reduce((sum, s) => sum + s.earnings.totalRevenue, 0)
                      .toLocaleString(localeString, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}{' '}
                    {t('nutrition.commission.egp')}
                  </td>
                  <td className="px-4 py-3 text-center dark:text-gray-200">-</td>
                  <td className="px-4 py-3 text-green-600 dark:text-green-400">
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
            <div className="text-center py-12 text-gray-500 dark:text-gray-400 dark:text-gray-500">
              <div className="text-6xl mb-4">📊</div>
              <p className="text-xl">{t('nutrition.commission.noPTDataForPeriod')}</p>
            </div>
          )}
        </div>
      )}

      {/* جدول عمولات تسجيل الأعضاء */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
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
            <thead className="bg-gradient-to-r from-green-100 to-emerald-200 dark:from-green-900/50 dark:to-emerald-900/50">
              <tr>
                <th className="px-4 py-3 text-right dark:text-gray-200">{t('nutrition.commission.coach')}</th>
                <th className="px-4 py-3 text-center dark:text-gray-200">{t('nutrition.commission.staffNumber')}</th>
                <th className="px-4 py-3 text-center dark:text-gray-200">{t('nutrition.commission.subscriptionCount')}</th>
                <th className="px-4 py-3 text-center dark:text-gray-200">{t('nutrition.commission.commissionPerSubscription')}</th>
                <th className="px-4 py-3 text-center dark:text-gray-200">{t('nutrition.commission.totalCommissions')}</th>
              </tr>
            </thead>
            <tbody>
              {memberSignupCommissions.length > 0 ? (
                memberSignupCommissions.map((commission) => (
                  <tr key={commission.nutritionistId} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 font-semibold dark:text-gray-200">{commission.nutritionistName}</td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">#{commission.staffCode}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-300 font-bold px-3 py-1 rounded-full">
                        {commission.count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-gray-700 dark:text-gray-200">
                      50 {t('nutrition.commission.egp')}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-green-600 dark:text-green-400 text-lg">
                      {commission.totalAmount.toLocaleString(localeString)} {t('nutrition.commission.egp')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="text-6xl mb-4">📭</div>
                    <p className="text-xl">{t('nutrition.commission.noCommissionsInPeriod')}</p>
                  </td>
                </tr>
              )}
            </tbody>
            {memberSignupCommissions.length > 0 && (
              <tfoot className="bg-gradient-to-r from-green-50 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50 font-bold">
                <tr>
                  <td className="px-4 py-3 dark:text-gray-200" colSpan={2}>{t('nutrition.commission.total')}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block bg-primary-500 dark:bg-primary-600 text-white font-bold px-3 py-1 rounded-full">
                      {memberSignupCommissions.reduce((sum, c) => sum + c.count, 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center dark:text-gray-200">-</td>
                  <td className="px-4 py-3 text-center text-green-600 dark:text-green-400 text-xl">
                    {memberSignupCommissions.reduce((sum, c) => sum + c.totalAmount, 0).toLocaleString(localeString)} {t('nutrition.commission.egp')}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* مودال التحصيل */}
      {showPayrollModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white p-5 rounded-t-2xl">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span>💳</span>
                <span>{t('nutrition.commission.payrollModalTitle', { name: payrollCoachName })}</span>
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl p-4">
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">{t('nutrition.commission.commissionLabel')}</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {payrollCommission.toLocaleString(localeString, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t('nutrition.commission.currency')}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('nutrition.commission.salaryLabel')}</label>
                <input
                  type="number"
                  value={payrollSalary}
                  onChange={e => setPayrollSalary(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl text-lg font-mono focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:bg-gray-700 dark:text-white"
                  placeholder="0"
                  min="0"
                />
              </div>
              {/* الخصومات المعلقة */}
              {loadingDeductions ? (
                <div className="text-center text-sm text-gray-400 dark:text-gray-500 py-2">{t('nutrition.commission.loadingDeductions')}</div>
              ) : payrollDeductions.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4">
                  <p className="text-sm font-bold text-red-700 dark:text-red-300 mb-2">
                    📉 {t('nutrition.commission.pendingDeductionsTitle', { count: payrollDeductions.length.toString() })}
                  </p>
                  {payrollDeductions.map(d => (
                    <div key={d.id} className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                      <span>{d.reason}</span>
                      <span className="font-bold text-red-600 dark:text-red-400">- {d.amount.toLocaleString(localeString)} {t('nutrition.commission.currency')}</span>
                    </div>
                  ))}
                  <div className="border-t border-red-200 dark:border-red-700 mt-2 pt-2 flex justify-between font-bold text-sm">
                    <span className="text-red-700 dark:text-red-300">{t('nutrition.commission.totalDeductionsLabel')}</span>
                    <span className="text-red-600 dark:text-red-400">- {payrollDeductions.reduce((s, d) => s + d.amount, 0).toLocaleString(localeString)} {t('nutrition.commission.currency')}</span>
                  </div>
                </div>
              )}
              <div className="bg-violet-50 dark:bg-violet-900/30 border-2 border-violet-300 dark:border-violet-700 rounded-xl p-4">
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">{t('nutrition.commission.totalLabel')}</p>
                <p className="text-3xl font-bold text-violet-600 dark:text-violet-400">
                  {(payrollCommission + (parseFloat(payrollSalary) || 0) - payrollDeductions.reduce((s, d) => s + d.amount, 0)).toLocaleString(localeString, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t('nutrition.commission.currency')}
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleConfirmPayroll}
                  disabled={payrollLoading}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {payrollLoading ? '...' : t('nutrition.commission.confirmPayroll')}
                </button>
                <button
                  onClick={() => setShowPayrollModal(false)}
                  className="px-6 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold py-3 rounded-xl transition-all"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
                  className="text-white hover:bg-white dark:bg-gray-800 hover:bg-opacity-20 rounded-lg p-2 transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="bg-blue-50 dark:bg-blue-900/50 border-l-4 border-blue-500 dark:border-blue-600 p-4 mb-6 rounded">
                <p className="text-blue-800 dark:text-blue-300 text-sm">
                  <strong>{t('nutrition.commission.settingsNote')}</strong> {t('nutrition.commission.settingsNoteText')}
                </p>
              </div>

              {/* طريقة حساب الكوميشن */}
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span>📐</span>
                  {t('nutrition.commission.calculationMethodLabel')}
                </h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setCalculationMethod('revenue')}
                    className={`flex-1 px-4 sm:px-6 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg transition-all ${
                      calculationMethod === 'revenue'
                        ? 'bg-primary-600 text-white shadow-lg sm:scale-105'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
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
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
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

                <div className="mt-4 bg-amber-50 dark:bg-amber-900/50 border-l-4 border-amber-500 dark:border-amber-600 p-3 rounded">
                  <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-300">
                    <strong>{t('nutrition.commission.methodDifferenceTitle')}</strong>
                  </p>
                  <ul className="list-disc list-inside text-xs text-amber-700 dark:text-amber-400 mt-2 space-y-1">
                    <li><strong>{t('nutrition.commission.byRevenue')}:</strong> {t('nutrition.commission.byRevenueFullDesc')}</li>
                    <li><strong>{t('nutrition.commission.bySessions')}:</strong> {t('nutrition.commission.bySessionsFullDesc')}</li>
                  </ul>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => saveDefaultCalculationMethod(calculationMethod)}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                  >
                    <span>💾</span>
                    <span>{t('nutrition.commission.saveAsDefault')}</span>
                  </button>
                </div>
              </div>

              {/* حدود الدخل الشهري - يظهر فقط عند اختيار "نسبة من الدخل" */}
              {calculationMethod === 'revenue' && (
              <>
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span>💰</span>
                  {t('nutrition.commission.monthlyIncomeLimits')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-600">
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">
                      {t('nutrition.commission.tier1Label')}
                    </label>
                    <input
                      type="number"
                      value={commissionSettings.tier1Limit}
                      onChange={(e) => setCommissionSettings({ ...commissionSettings, tier1Limit: parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-lg font-mono focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:bg-gray-700 dark:text-white"
                      placeholder="5000"
                    />
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-600">
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">
                      {t('nutrition.commission.tier2Label')}
                    </label>
                    <input
                      type="number"
                      value={commissionSettings.tier2Limit}
                      onChange={(e) => setCommissionSettings({ ...commissionSettings, tier2Limit: parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-lg font-mono focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:bg-gray-700 dark:text-white"
                      placeholder="11000"
                    />
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-600">
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">
                      {t('nutrition.commission.tier3Label')}
                    </label>
                    <input
                      type="number"
                      value={commissionSettings.tier3Limit}
                      onChange={(e) => setCommissionSettings({ ...commissionSettings, tier3Limit: parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-lg font-mono focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:bg-gray-700 dark:text-white"
                      placeholder="15000"
                    />
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-600">
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">
                      {t('nutrition.commission.tier4Label')}
                    </label>
                    <input
                      type="number"
                      value={commissionSettings.tier4Limit}
                      onChange={(e) => setCommissionSettings({ ...commissionSettings, tier4Limit: parseFloat(e.target.value) })}
                      className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-lg font-mono focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:bg-gray-700 dark:text-white"
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
                  <div className="bg-green-50 dark:bg-green-900/50 p-4 rounded-lg border-2 border-green-200 dark:border-green-700">
                    <label className="block text-sm font-medium mb-2 text-green-700 dark:text-green-300">
                      {t('nutrition.commission.tier1Percentage')}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={commissionSettings.tier1Rate}
                        onChange={(e) => setCommissionSettings({ ...commissionSettings, tier1Rate: parseFloat(e.target.value) })}
                        className="w-full px-4 py-3 border-2 border-green-300 dark:border-green-600 rounded-lg text-lg font-mono focus:border-green-500 focus:ring-2 focus:ring-green-200 dark:bg-gray-700 dark:text-white"
                        placeholder="25"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600 font-bold">%</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">{t('nutrition.commission.lessThanAmount', { amount: commissionSettings.tier1Limit.toLocaleString(localeString) })} {t('nutrition.commission.currency')}</p>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/50 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-700">
                    <label className="block text-sm font-medium mb-2 text-blue-700 dark:text-blue-300">
                      {t('nutrition.commission.tier2Percentage')}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={commissionSettings.tier2Rate}
                        onChange={(e) => setCommissionSettings({ ...commissionSettings, tier2Rate: parseFloat(e.target.value) })}
                        className="w-full px-4 py-3 border-2 border-blue-300 dark:border-blue-600 rounded-lg text-lg font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:bg-gray-700 dark:text-white"
                        placeholder="30"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600 font-bold">%</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">{commissionSettings.tier1Limit.toLocaleString(localeString)} - {(commissionSettings.tier2Limit - 1).toLocaleString(localeString)}</p>
                  </div>

                  <div className="bg-yellow-50 dark:bg-yellow-900/50 p-4 rounded-lg border-2 border-yellow-200 dark:border-yellow-700">
                    <label className="block text-sm font-medium mb-2 text-yellow-700 dark:text-yellow-300">
                      {t('nutrition.commission.tier3Percentage')}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={commissionSettings.tier3Rate}
                        onChange={(e) => setCommissionSettings({ ...commissionSettings, tier3Rate: parseFloat(e.target.value) })}
                        className="w-full px-4 py-3 border-2 border-yellow-300 dark:border-yellow-600 rounded-lg text-lg font-mono focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 dark:bg-gray-700 dark:text-white"
                        placeholder="35"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-yellow-600 font-bold">%</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">{commissionSettings.tier2Limit.toLocaleString(localeString)} - {(commissionSettings.tier3Limit - 1).toLocaleString(localeString)}</p>
                  </div>

                  <div className="bg-orange-50 dark:bg-orange-900/50 p-4 rounded-lg border-2 border-orange-200 dark:border-orange-700">
                    <label className="block text-sm font-medium mb-2 text-orange-700 dark:text-orange-300">
                      {t('nutrition.commission.tier4Percentage')}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={commissionSettings.tier4Rate}
                        onChange={(e) => setCommissionSettings({ ...commissionSettings, tier4Rate: parseFloat(e.target.value) })}
                        className="w-full px-4 py-3 border-2 border-orange-300 dark:border-orange-600 rounded-lg text-lg font-mono focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:bg-gray-700 dark:text-white"
                        placeholder="40"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-600 font-bold">%</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">{commissionSettings.tier3Limit.toLocaleString(localeString)} - {(commissionSettings.tier4Limit - 1).toLocaleString(localeString)}</p>
                  </div>

                  <div className="bg-red-50 dark:bg-red-900/50 p-4 rounded-lg border-2 border-red-200 dark:border-red-700">
                    <label className="block text-sm font-medium mb-2 text-red-700 dark:text-red-300">
                      {t('nutrition.commission.tier5Percentage')}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={commissionSettings.tier5Rate}
                        onChange={(e) => setCommissionSettings({ ...commissionSettings, tier5Rate: parseFloat(e.target.value) })}
                        className="w-full px-4 py-3 border-2 border-red-300 dark:border-red-600 rounded-lg text-lg font-mono focus:border-red-500 focus:ring-2 focus:ring-red-200 dark:bg-gray-700 dark:text-white"
                        placeholder="45"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-red-600 font-bold">%</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">{t('nutrition.commission.orMoreAmount', { amount: commissionSettings.tier4Limit.toLocaleString(localeString) })} {t('nutrition.commission.currency')}</p>
                  </div>
                </div>
              </div>
              </>
              )}

              {/* إعدادات الجلسات المجانية */}
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span>🥗</span>
                  إعدادات جلسات التغذية المجانية
                </h3>

                {/* Toggle */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-pink-50 dark:from-orange-900/20 dark:to-pink-900/20 rounded-lg border-2 border-orange-200 dark:border-orange-700 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">📊</span>
                    <div>
                      <h4 className="font-bold text-gray-800 dark:text-gray-100">احتساب تكلفة الجلسات المجانية</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-300">تفعيل/تعطيل حساب تكلفة جلسات التغذية المجانية في التحصيل</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setFreeSessionsSettings(prev => ({
                        ...prev,
                        trackFreeSessionsCost: !prev.trackFreeSessionsCost
                      }))
                    }}
                    className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors duration-200 ${
                      freeSessionsSettings.trackFreeSessionsCost ? 'bg-orange-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute inset-y-1 h-6 w-6 rounded-full bg-white shadow-sm transition-all duration-200 ease-in-out ${
                        freeSessionsSettings.trackFreeSessionsCost ? 'end-1' : 'start-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Price Input */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">🥗</span>
                    <h4 className="font-bold text-gray-800 dark:text-gray-100">سعر جلسة التغذية المجانية</h4>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={freeSessionsSettings.freeNutritionSessionPrice}
                      onChange={(e) => setFreeSessionsSettings(prev => ({
                        ...prev,
                        freeNutritionSessionPrice: parseFloat(e.target.value) || 0
                      }))}
                      disabled={!freeSessionsSettings.trackFreeSessionsCost}
                      className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-lg font-mono focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:bg-gray-800 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="0.00"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">ج.م</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    💡 هذا السعر يُستخدم لحساب قيمة جلسات التغذية المجانية في التحصيل
                  </p>
                </div>
              </div>

              {/* أزرار الحفظ */}
              <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-4 rounded-lg font-bold text-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingSettings ? t('nutrition.commission.savingSettings') : t('nutrition.commission.saveSettings')}
                </button>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="px-8 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-4 rounded-lg font-bold text-lg transition-all"
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
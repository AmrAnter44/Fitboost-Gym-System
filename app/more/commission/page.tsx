'use client'

//  حاسبة عمولات "مزيد" — نسخة مبسّطة من حاسبة تحصيل الـ PT (app/pt/commission/page.tsx)
//  طريقتين للحساب:
//   - revenue : إجمالي إيصالات مزيد (غير الملغية) المنسوبة للكوتش في الفترة × النسبة (tiers المشتركة أو نسبة يدوية)
//   - sessions: حصص مزيد المحضورة (غير المجانية) في الفترة × سعر الحصة لاشتراكها × النسبة
//  + تحصيل (مصروف staff_salary + تطبيق الخصومات المعلقة)

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useLanguage } from '../../../contexts/LanguageContext'
import { useToast } from '../../../contexts/ToastContext'
import { LoadingScreen } from '../../../components/Spinner'
import { usePermissions } from '../../../hooks/usePermissions'
import PermissionDenied from '../../../components/PermissionDenied'
import { countsAsRevenue } from '../../../lib/revenueFilters'
import { isMoreReceipt } from '../../../lib/translateReceiptType'

interface Staff {
  id: string
  name: string
  phone?: string
  position?: string
  salary?: number
  isActive: boolean
  //  كوتش موجود في اشتراكات مزيد بس مش متسجل كموظف مدرب نشط
  isVirtual?: boolean
}

interface MoreSubscription {
  moreNumber: number
  clientName: string
  coachName: string
  coachUserId: string | null
  sessionsPurchased: number
  sessionsRemaining: number
  pricePerSession: number
  totalAmount: number
}

interface MoreSessionRecord {
  id: string
  moreNumber: number
  coachName: string
  attended: boolean
  attendedAt: string | null
  isFreeSession: boolean
}

interface Receipt {
  receiptNumber: number
  type: string
  amount: number
  itemDetails: string
  createdAt: string
  moreNumber?: number | null
  isCancelled?: boolean
  refundMethod?: string | null
}

interface CoachEarnings {
  coachName: string
  totalSessions: number
  completedSessions: number
  remainingSessions: number
  revenue: number
  clients: number
}

interface CommissionResult {
  coachName: string
  monthlyIncome: number
  percentage: number
  commission: number
  gymShare: number
}

interface MoreSessionsData {
  moreNumber: number
  clientName: string
  coachName: string
  sessionsPurchased: number
  sessionsRemaining: number
  pricePerSession: number
  usedSessions: number
  sessionValue: number
}

interface SessionBasedCommission {
  coachName: string
  totalUsedSessions: number
  totalSessionsValue: number
  percentage: number
  commission: number
  gymShare: number
  moreCount: number
  details: MoreSessionsData[]
}

//  توحيد اسم الكوتش للمقارنة: يتجاهل المسافات وحالة الأحرف
const normName = (s: any): string => String(s ?? '').trim().toLowerCase()

const parseDetails = (raw: string): any => {
  try { return JSON.parse(raw || '{}') || {} } catch { return {} }
}

export default function MoreCommissionPage() {
  const { t, locale, direction } = useLanguage()
  const toast = useToast()
  const localeString = locale === 'ar' ? 'ar-EG' : 'en-US'
  const { hasPermission, loading: permissionsLoading, user: permUser } = usePermissions()

  const [coaches, setCoaches] = useState<Staff[]>([])
  const [moreSubscriptions, setMoreSubscriptions] = useState<MoreSubscription[]>([])
  const [moreAttendance, setMoreAttendance] = useState<MoreSessionRecord[]>([])
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [selectedCoach, setSelectedCoach] = useState<string>('')
  const [customIncome, setCustomIncome] = useState<string>('')
  const [useCustomIncome, setUseCustomIncome] = useState(false)
  const [useManualPercentage, setUseManualPercentage] = useState(false)
  const [manualPercentage, setManualPercentage] = useState<string>('')
  const [result, setResult] = useState<CommissionResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [coachEarnings, setCoachEarnings] = useState<CoachEarnings | null>(null)

  //  نسب العمولة (tiers) — مشتركة مع حاسبة الـ PT (/api/commission-settings)، للعرض فقط هنا
  const [commissionSettings, setCommissionSettings] = useState({
    tierCount: 5,
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

  const [calculationMethod, setCalculationMethod] = useState<'revenue' | 'sessions' | null>(null)
  const [methodLoaded, setMethodLoaded] = useState(false)
  const [sessionCommissions, setSessionCommissions] = useState<SessionBasedCommission[]>([])
  const [customSessionPercentage, setCustomSessionPercentage] = useState<string>('25')
  const [calculatedSessionCommission, setCalculatedSessionCommission] = useState<number>(0)

  // التحصيل
  const [showPayrollModal, setShowPayrollModal] = useState(false)
  const [payrollCommission, setPayrollCommission] = useState(0)
  const [payrollSalary, setPayrollSalary] = useState<string>('0')
  const [payrollCoachName, setPayrollCoachName] = useState('')
  const [payrollStaffId, setPayrollStaffId] = useState<string | null>(null)
  const [payrollLoading, setPayrollLoading] = useState(false)
  const [payrollDeductions, setPayrollDeductions] = useState<Array<{ id: string; amount: number; reason: string }>>([])
  const [loadingDeductions, setLoadingDeductions] = useState(false)
  const [lastPayrollDates, setLastPayrollDates] = useState<Record<string, string>>({})

  //  «يشوف كل الكباتن» = OWNER/ADMIN/MANAGER أو صلاحية canAccessMoreCommission. الكوتش العادي يشوف نفسه بس.
  const role = permUser?.role
  const isAdmin = role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER' || hasPermission('canAccessMoreCommission')
  const isCoachUser = role === 'COACH'

  //  🔗 خريطة رقم اشتراك مزيد → الكوتش (المصدر الموثوق لنسب الإيصالات)
  const moreNumberToCoach = useMemo(() => {
    const m = new Map<number, string>()
    moreSubscriptions.forEach((s) => { if (s.moreNumber != null) m.set(s.moreNumber, s.coachName) })
    return m
  }, [moreSubscriptions])

  const moreByNumber = useMemo(() => {
    const m = new Map<number, MoreSubscription>()
    moreSubscriptions.forEach((s) => m.set(s.moreNumber, s))
    return m
  }, [moreSubscriptions])

  // الفترة الافتراضية: الشهر الحالي (ISO محلي لتجنب الـ timezone shift)
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const toLocalISO = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const [dateFrom, setDateFrom] = useState(toLocalISO(firstDay))
  const [dateTo, setDateTo] = useState(toLocalISO(lastDay))

  const getRange = () => {
    const start = new Date(dateFrom)
    const end = new Date(dateTo)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  useEffect(() => {
    fetchData()
    fetchCommissionSettings()
    fetchDefaultCalculationMethod()
    fetchLastPayrollDates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchLastPayrollDates = async () => {
    try {
      const res = await fetch('/api/expenses?type=staff_salary')
      if (res.ok) {
        const expenses = await res.json()
        const dates: Record<string, string> = {}
        for (const exp of Array.isArray(expenses) ? expenses : []) {
          if (exp.staffId && !dates[exp.staffId]) {
            dates[exp.staffId] = exp.createdAt
          }
        }
        setLastPayrollDates(dates)
      }
    } catch { /* ignore */ }
  }

  const fetchReceiptsForRange = async () => {
    try {
      const receiptsResponse = await fetch(`/api/receipts?startDate=${dateFrom}&endDate=${dateTo}`)
      const receiptsData: Receipt[] = await receiptsResponse.json()
      if (Array.isArray(receiptsData)) setReceipts(receiptsData)
    } catch { /* نحتفظ بآخر بيانات */ }
  }

  const receiptsRangeInitialized = useRef(false)
  useEffect(() => {
    if (!receiptsRangeInitialized.current) {
      receiptsRangeInitialized.current = true
      return
    }
    fetchReceiptsForRange()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo])

  const fetchData = async () => {
    try {
      const [staffRes, moreRes, sessionsRes] = await Promise.all([
        fetch('/api/staff'),
        fetch('/api/more'),
        fetch('/api/more/sessions')
      ])

      const staffData: Staff[] = staffRes.ok ? await staffRes.json() : []
      const moreData: MoreSubscription[] = moreRes.ok ? await moreRes.json() : []
      const sessionsData: MoreSessionRecord[] = sessionsRes.ok ? await sessionsRes.json() : []

      const safeMore = Array.isArray(moreData) ? moreData : []
      setMoreSubscriptions(safeMore)
      setMoreAttendance(
        (Array.isArray(sessionsData) ? sessionsData : []).filter((s) => s.attended && !s.isFreeSession)
      )

      const activeCoaches: Staff[] = (Array.isArray(staffData) ? staffData : []).filter(
        (staff) => staff.isActive && staff.position?.toLowerCase().includes('مدرب')
      )
      //  أي كوتش موجود في اشتراكات مزيد ومش في قائمة المدربين النشطين يتضاف (من غير تحصيل مرتبط بموظف)
      const known = new Set(activeCoaches.map((c) => normName(c.name)))
      const extra: Staff[] = []
      for (const s of safeMore) {
        const n = normName(s.coachName)
        if (!n || known.has(n)) continue
        known.add(n)
        const staffMatch = (Array.isArray(staffData) ? staffData : []).find((st) => normName(st.name) === n)
        extra.push(staffMatch
          ? { ...staffMatch }
          : { id: `more-coach-${n}`, name: s.coachName.trim(), isActive: true, isVirtual: true })
      }
      setCoaches([...activeCoaches, ...extra])

      await fetchReceiptsForRange()
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCommissionSettings = async () => {
    try {
      const response = await fetch('/api/commission-settings')
      if (response.ok) {
        const data = await response.json()
        setCommissionSettings((prev) => ({
          tierCount: data.tierCount ?? prev.tierCount,
          tier1Limit: data.tier1Limit ?? prev.tier1Limit,
          tier2Limit: data.tier2Limit ?? prev.tier2Limit,
          tier3Limit: data.tier3Limit ?? prev.tier3Limit,
          tier4Limit: data.tier4Limit ?? prev.tier4Limit,
          tier1Rate: data.tier1Rate ?? prev.tier1Rate,
          tier2Rate: data.tier2Rate ?? prev.tier2Rate,
          tier3Rate: data.tier3Rate ?? prev.tier3Rate,
          tier4Rate: data.tier4Rate ?? prev.tier4Rate,
          tier5Rate: data.tier5Rate ?? prev.tier5Rate
        }))
      }
    } catch (error) {
      console.error('Error fetching commission settings:', error)
    }
  }

  //  الطريقة الافتراضية بتتقري من إعداد الـ PT المشترك — تغييرها هنا محلي (للعرض) ومش بيتحفظ
  const fetchDefaultCalculationMethod = async () => {
    try {
      const response = await fetch('/api/settings/commission')
      if (response.ok) {
        const data = await response.json()
        setCalculationMethod(data.defaultCommissionMethod === 'sessions' ? 'sessions' : 'revenue')
      } else {
        setCalculationMethod('revenue')
      }
    } catch {
      setCalculationMethod('revenue')
    } finally {
      setMethodLoaded(true)
    }
  }

  // اختيار الكوتش تلقائياً
  useEffect(() => {
    if (coaches.length === 0 || !permUser || selectedCoach) return
    if (isCoachUser && permUser.staffId) {
      const coachStaff = coaches.find((c) => c.id === permUser.staffId)
      if (coachStaff) setSelectedCoach(coachStaff.name)
    } else if (coaches.length === 1) {
      setSelectedCoach(coaches[0].name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coaches, permUser])

  // النسبة حسب الدخل — flex tiers (2-5 مستوى) أو يدوية
  const calculatePercentage = (income: number): number => {
    if (useManualPercentage) {
      const manual = parseFloat(manualPercentage)
      return Number.isFinite(manual) && manual > 0 ? manual : 0
    }
    const cs = commissionSettings
    const n = Math.min(5, Math.max(2, cs.tierCount || 5))
    const limits = [cs.tier1Limit, cs.tier2Limit, cs.tier3Limit, cs.tier4Limit]
    const rates = [cs.tier1Rate, cs.tier2Rate, cs.tier3Rate, cs.tier4Rate, cs.tier5Rate]
    for (let i = 0; i < n - 1; i++) {
      if (income < limits[i]) return rates[i]
    }
    return rates[n - 1]
  }

  //  إيصالات مزيد المنسوبة لكوتش في الفترة (غير الملغية)
  const getCoachMoreReceipts = (coachName: string): Receipt[] => {
    const { start, end } = getRange()
    return receipts.filter((receipt) => {
      if (receipt.isCancelled) return false
      if (!isMoreReceipt(receipt.type)) return false
      const d = new Date(receipt.createdAt)
      if (d < start || d > end) return false
      //  رقم اشتراك مزيد هو الحَكَم؛ الاسم في itemDetails fallback بس
      const mNum = receipt.moreNumber
      if (mNum != null && moreNumberToCoach.has(mNum)) {
        return normName(moreNumberToCoach.get(mNum)) === normName(coachName)
      }
      return normName(parseDetails(receipt.itemDetails).coachName) === normName(coachName)
    })
  }

  //  حصص مزيد المحضورة (المدفوعة) لكوتش في الفترة × سعر حصة اشتراكها
  const calculateSessionBasedCommission = (coachNameFilter?: string): SessionBasedCommission[] => {
    const { start, end } = getRange()
    const perMore = new Map<number, number>()
    for (const rec of moreAttendance) {
      if (!rec.attendedAt) continue
      const d = new Date(rec.attendedAt)
      if (d < start || d > end) continue
      perMore.set(rec.moreNumber, (perMore.get(rec.moreNumber) || 0) + 1)
    }

    const coachMap = new Map<string, { name: string; list: MoreSessionsData[] }>()
    for (const [moreNumber, usedSessions] of perMore.entries()) {
      const sub = moreByNumber.get(moreNumber)
      if (!sub) continue
      if (coachNameFilter && normName(sub.coachName) !== normName(coachNameFilter)) continue
      const key = normName(sub.coachName)
      if (!coachMap.has(key)) coachMap.set(key, { name: coachNameFilter || sub.coachName, list: [] })
      coachMap.get(key)!.list.push({
        moreNumber: sub.moreNumber,
        clientName: sub.clientName,
        coachName: sub.coachName,
        sessionsPurchased: sub.sessionsPurchased,
        sessionsRemaining: sub.sessionsRemaining,
        pricePerSession: sub.pricePerSession || 0,
        usedSessions,
        sessionValue: usedSessions * (sub.pricePerSession || 0)
      })
    }

    const results: SessionBasedCommission[] = []
    for (const { name, list } of coachMap.values()) {
      const totalUsedSessions = list.reduce((s, x) => s + x.usedSessions, 0)
      const totalSessionsValue = list.reduce((s, x) => s + x.sessionValue, 0)
      const percentage = calculatePercentage(totalSessionsValue)
      const commission = (totalSessionsValue * percentage) / 100
      results.push({
        coachName: name,
        totalUsedSessions,
        totalSessionsValue,
        percentage,
        commission,
        gymShare: totalSessionsValue - commission,
        moreCount: list.length,
        details: list.sort((a, b) => b.sessionValue - a.sessionValue)
      })
    }
    return results.sort((a, b) => b.commission - a.commission)
  }

  // حساب طريقة الحصص عند تغيّر البيانات
  useEffect(() => {
    if (calculationMethod !== 'sessions') return
    if (!isAdmin && !selectedCoach) { setSessionCommissions([]); return }
    const results = calculateSessionBasedCommission(selectedCoach || undefined)
    setSessionCommissions(results)
    if (selectedCoach) {
      const coachData = results.find((c) => normName(c.coachName) === normName(selectedCoach))
      if (coachData) setCustomSessionPercentage(coachData.percentage.toString())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculationMethod, dateFrom, dateTo, selectedCoach, moreSubscriptions, moreAttendance, commissionSettings, useManualPercentage, manualPercentage, isAdmin])

  const selectedSessionData = selectedCoach
    ? sessionCommissions.find((c) => normName(c.coachName) === normName(selectedCoach))
    : undefined

  useEffect(() => {
    if (calculationMethod === 'sessions' && selectedSessionData) {
      const percentage = parseFloat(customSessionPercentage) || 0
      setCalculatedSessionCommission((selectedSessionData.totalSessionsValue * percentage) / 100)
    } else {
      setCalculatedSessionCommission(0)
    }
  }, [customSessionPercentage, calculationMethod, selectedSessionData])

  // إحصائيات كوتش (طريقة الإيرادات)
  const calculateCoachEarnings = (coachName: string): CoachEarnings => {
    const { start, end } = getRange()
    const coachReceipts = getCoachMoreReceipts(coachName)
    const revenue = coachReceipts.reduce((sum, r) => sum + r.amount, 0)

    const moreNumbersFromReceipts = new Set<number>()
    coachReceipts.forEach((r) => {
      const n = r.moreNumber ?? parseDetails(r.itemDetails).moreNumber
      if (n != null) moreNumbersFromReceipts.add(Number(n))
    })
    const related = moreSubscriptions.filter((s) =>
      moreNumbersFromReceipts.has(s.moreNumber) && normName(s.coachName) === normName(coachName)
    )
    const relatedNumbers = new Set(related.map((s) => s.moreNumber))
    const completedSessions = moreAttendance.filter((rec) => {
      if (!relatedNumbers.has(rec.moreNumber) || !rec.attendedAt) return false
      const d = new Date(rec.attendedAt)
      return d >= start && d <= end
    }).length

    return {
      coachName,
      totalSessions: related.reduce((s, x) => s + x.sessionsPurchased, 0),
      completedSessions,
      remainingSessions: related.reduce((s, x) => s + x.sessionsRemaining, 0),
      revenue,
      clients: new Set(related.map((s) => s.clientName)).size
    }
  }

  const openPayrollModal = async (coachName: string, commission: number) => {
    const staff = coaches.find((c) => c.name === coachName && !c.isVirtual)
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
          description: `تحصيل مزيد: ${payrollCoachName}`,
          notes: `كوميشن مزيد (${dateFrom} → ${dateTo}): ${payrollCommission.toFixed(2)} + مرتب: ${salary.toFixed(2)}${deductionTotal > 0 ? ` - خصومات: ${deductionTotal.toFixed(2)}` : ''}`,
          staffId: payrollStaffId
        })
      })
      if (res.ok) {
        for (const d of payrollDeductions) {
          await fetch('/api/staff-deductions', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: d.id, isApplied: true, appliedAt: new Date().toISOString() })
          })
        }
        toast.success(t('more.commission.payrollSuccess', { name: payrollCoachName }))
        setShowPayrollModal(false)
        fetchLastPayrollDates()
      } else {
        toast.error(t('more.commission.payrollFail'))
      }
    } catch {
      toast.error(t('more.commission.payrollConnectionError'))
    } finally {
      setPayrollLoading(false)
    }
  }

  const handleCalculate = () => {
    if (!selectedCoach) {
      toast.warning(t('more.commission.selectCoach'))
      return
    }
    const earnings = calculateCoachEarnings(selectedCoach)
    setCoachEarnings(earnings)

    const totalIncome = useCustomIncome ? (parseFloat(customIncome) || 0) : earnings.revenue
    const percentage = totalIncome > 0 ? calculatePercentage(totalIncome) : 0
    const commission = (totalIncome * percentage) / 100

    setResult({
      coachName: selectedCoach,
      monthlyIncome: totalIncome,
      percentage,
      commission,
      gymShare: totalIncome - commission
    })
  }

  const getPercentageBgColor = (percentage: number): string => {
    if (percentage <= 25) return 'from-orange-500 to-orange-600'
    if (percentage <= 30) return 'from-yellow-500 to-yellow-600'
    if (percentage <= 40) return 'from-primary-500 to-primary-600'
    return 'from-green-500 to-green-600'
  }

  //  ملخص الكوتشات — الأدمن يشوف الكل، الكوتش يشوف نفسه بس
  const visibleCoaches = isAdmin ? coaches : coaches.filter((c) => c.name === selectedCoach)
  const allCoachesStats = visibleCoaches.map((coach) => ({
    coachName: coach.name,
    earnings: calculateCoachEarnings(coach.name)
  }))

  const renderPayrollButton = (coachName: string, commission: number, compact = false) => {
    if (isCoachUser) return null // مطابق للـ PT: الكوتش مايعملش تحصيل لنفسه
    const staff = coaches.find((c) => c.name === coachName && !c.isVirtual)
    const lastDate = staff && lastPayrollDates[staff.id]
    return (
      <div className={compact ? 'mt-2' : ''}>
        <button
          onClick={() => openPayrollModal(coachName, commission)}
          className={`w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold ${compact ? 'py-2 rounded-lg shadow' : 'py-3 rounded-xl shadow-lg text-lg'} transition-colors duration-200 flex items-center justify-center gap-2`}
        >
          <span>{t('more.commission.payroll')}</span>
        </button>
        {!staff && (
          <p className="text-xs text-center text-amber-600 dark:text-amber-400 mt-1">{t('more.commission.coachNotStaffNote')}</p>
        )}
        {lastDate && (
          <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-1">
            {t('more.commission.lastPayroll')}: {new Date(lastDate).toLocaleDateString(localeString, { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>
    )
  }

  //  Permission gate — OWNER/ADMIN/MANAGER | COACH (يشوف نفسه) | canAccessMoreCommission
  if (permissionsLoading) {
    return <LoadingScreen message={t('more.commission.loading')} />
  }
  if (!isAdmin && !isCoachUser) {
    return <PermissionDenied message={t('more.commission.noPermission')} />
  }

  const fmt2 = (n: number) => n.toLocaleString(localeString, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmt0 = (n: number) => Math.round(n).toLocaleString(localeString)

  return (
    <div className="container mx-auto p-3 sm:p-4 md:p-6" dir={direction}>
      {/* Header */}
      <div className="mb-4 md:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">{t('more.commission.calculatorTitle')}</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1">{t('more.commission.subtitle')}</p>
        </div>
        <Link
          href="/more"
          className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 text-sm sm:text-base"
        >
          {t('more.commission.backToMore')}
        </Link>
      </div>

      {/* الفترة */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-6">
        <label className="block text-sm font-bold mb-3 text-gray-700 dark:text-gray-200">{t('more.commission.selectPeriod')}</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">{t('more.commission.fromDate')}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setResult(null) }}
              className="w-full px-4 py-3 ring-1 ring-gray-300 dark:ring-gray-600 rounded-lg text-lg focus:ring-2 focus:ring-primary-200 transition dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">{t('more.commission.toDate')}</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setResult(null) }}
              className="w-full px-4 py-3 ring-1 ring-gray-300 dark:ring-gray-600 rounded-lg text-lg focus:ring-2 focus:ring-primary-200 transition dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* طريقة الحساب */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 mb-4 sm:mb-6">
        <label className="block text-sm font-bold mb-3 text-gray-700 dark:text-gray-200">{t('more.commission.calculationMethodLabel')}</label>
        {!methodLoaded || calculationMethod === null ? (
          <div className="px-4 py-3 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-center text-sm">{t('more.commission.loading')}</div>
        ) : isAdmin ? (
          <>
            <div className="flex flex-col sm:flex-row gap-3">
              {(['revenue', 'sessions'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setCalculationMethod(m); setResult(null) }}
                  className={`flex-1 px-4 py-3 rounded-lg font-bold transition-colors duration-200 ${
                    calculationMethod === m
                      ? (m === 'revenue' ? 'bg-primary-600 text-primary-contrast shadow-lg' : 'bg-green-600 text-white shadow-lg')
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <span className="text-sm sm:text-base">{m === 'revenue' ? t('more.commission.byRevenue') : t('more.commission.bySessions')}</span>
                  <p className="text-xs mt-1 opacity-80">{m === 'revenue' ? t('more.commission.byRevenueDesc') : t('more.commission.bySessionsDesc')}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('more.commission.methodLocalNote')}</p>
          </>
        ) : (
          <>
            <div className={`px-4 py-3 rounded-lg font-bold text-center ${calculationMethod === 'revenue' ? 'bg-primary-600 text-primary-contrast' : 'bg-green-600 text-white'}`}>
              <span className="text-sm sm:text-base">{calculationMethod === 'revenue' ? t('more.commission.byRevenue') : t('more.commission.bySessions')}</span>
              <p className="text-xs mt-1 opacity-90">{calculationMethod === 'revenue' ? t('more.commission.byRevenueDesc') : t('more.commission.bySessionsDesc')}</p>
            </div>
            <div className="mt-3 bg-blue-50 dark:bg-blue-900/50 border-l-4 border-blue-500 dark:border-blue-600 p-3 rounded">
              <p className="text-xs text-blue-800 dark:text-blue-300">ℹ️ <strong>{t('more.commission.currentMethodInfo')}</strong></p>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* بيانات الحساب */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">{t('more.commission.calculationData')}</h2>

          {loading ? (
            <div className="text-center py-8 sm:py-12 text-gray-500 dark:text-gray-400">{t('more.commission.loading')}</div>
          ) : coaches.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">{t('more.commission.noActiveCoaches')}</p>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-2">{t('more.commission.addCoachesHint')}</p>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {isAdmin ? (
                <div>
                  <label className="block text-xs sm:text-sm font-bold mb-2 sm:mb-3 text-gray-700 dark:text-gray-200">
                    {t('more.commission.selectCoach')} <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={selectedCoach}
                    onChange={(e) => { setSelectedCoach(e.target.value); setResult(null); setCoachEarnings(null) }}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 ring-1 ring-gray-300 dark:ring-gray-600 rounded-lg text-base sm:text-lg focus:ring-2 focus:ring-primary-200 transition dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">{t('more.commission.selectCoachOption')}</option>
                    {coaches.map((coach) => (
                      <option key={coach.id} value={coach.name}>
                        {coach.name} {coach.phone && `(${coach.phone})`}
                      </option>
                    ))}
                  </select>
                </div>
              ) : selectedCoach ? (
                <div>
                  <label className="block text-xs sm:text-sm font-bold mb-2 sm:mb-3 text-gray-700 dark:text-gray-200">{t('more.commission.theCoach')}</label>
                  <div className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-primary-50 dark:bg-primary-900/50 ring-1 ring-primary-300 dark:ring-primary-700 rounded-lg text-base sm:text-lg font-bold text-primary-800 dark:text-primary-300">
                    {selectedCoach}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-amber-700 dark:text-amber-300">{t('more.commission.coachNotLinked')}</p>
              )}

              {/* دخل مخصص — طريقة الإيرادات فقط */}
              {calculationMethod === 'revenue' && (
                <div className="bg-primary-50 dark:bg-primary-900/50 ring-1 ring-primary-200 dark:ring-primary-700 rounded-xl p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={useCustomIncome} onChange={(e) => setUseCustomIncome(e.target.checked)} className="w-5 h-5 text-primary-600 rounded" />
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{t('more.commission.useCustomIncome')}</span>
                  </label>
                </div>
              )}
              {calculationMethod === 'revenue' && useCustomIncome && (
                <div>
                  <label className="block text-sm font-bold mb-3 text-gray-700 dark:text-gray-200">
                    {t('more.commission.customMonthlyIncome')} <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number" min="0" step="0.01"
                    value={customIncome}
                    onChange={(e) => setCustomIncome(e.target.value)}
                    className="w-full px-4 py-3 ring-1 ring-gray-300 dark:ring-gray-600 rounded-lg text-lg focus:ring-2 focus:ring-primary-200 transition dark:bg-gray-700 dark:text-white"
                    placeholder={t('more.commission.exampleIncome')}
                  />
                </div>
              )}

              {/* نسبة يدوية بدل الـ tiers — للأدمن */}
              {isAdmin && (
                <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-200 dark:ring-purple-700">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={useManualPercentage} onChange={(e) => setUseManualPercentage(e.target.checked)} className="w-5 h-5 rounded" />
                    <span className="text-sm font-bold text-purple-800 dark:text-purple-200">{t('more.commission.useManualPercentage')}</span>
                  </label>
                  {useManualPercentage && (
                    <div className="relative mt-3">
                      <input
                        type="number" min="0" max="100" step="0.5"
                        value={manualPercentage}
                        onChange={(e) => setManualPercentage(e.target.value)}
                        className="w-full px-4 py-3 pr-12 ring-2 ring-purple-300 dark:ring-purple-700 rounded-lg text-lg font-bold focus:ring-purple-400 transition dark:bg-gray-700 dark:text-white"
                        placeholder={t('more.commission.manualPercentagePlaceholder')}
                      />
                      <span className="absolute inset-y-0 right-4 flex items-center text-purple-600 dark:text-purple-300 font-bold">%</span>
                    </div>
                  )}
                </div>
              )}

              {/* جدول النسب (مشترك مع PT) */}
              {!useManualPercentage && (() => {
                const cs = commissionSettings
                const n = Math.min(5, Math.max(2, cs.tierCount || 5))
                const limits = [cs.tier1Limit, cs.tier2Limit, cs.tier3Limit, cs.tier4Limit]
                const rates = [cs.tier1Rate, cs.tier2Rate, cs.tier3Rate, cs.tier4Rate, cs.tier5Rate]
                const tierColors = ['text-orange-600', 'text-yellow-600', 'text-primary-600 dark:text-primary-400', 'text-primary-600', 'text-green-600']
                return (
                  <div className="bg-primary-50 dark:bg-primary-900/50 ring-1 ring-primary-200 dark:ring-primary-700 rounded-xl p-5">
                    <h3 className="font-bold text-lg mb-3 dark:text-gray-100">{t('more.commission.percentageTable')}</h3>
                    <div className="space-y-2 text-sm">
                      {Array.from({ length: n }).map((_, i) => {
                        let label: string
                        if (i === 0) label = `${t('more.commission.lessThanAmount', { amount: limits[0].toLocaleString(localeString) })} ${t('more.commission.egp')}`
                        else if (i === n - 1) label = `${t('more.commission.orMoreAmount', { amount: limits[n - 2].toLocaleString(localeString) })} ${t('more.commission.egp')}`
                        else label = `${limits[i - 1].toLocaleString(localeString)} - ${(limits[i] - 1).toLocaleString(localeString)} ${t('more.commission.egp')}`
                        return (
                          <div key={i} className="flex justify-between items-center py-2 px-3 bg-white dark:bg-gray-800 rounded-lg">
                            <span>{label}</span>
                            <span className={`font-bold ${tierColors[i]}`}>{rates[i]}%</span>
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">{t('more.commission.sharedTiersNote')}</p>
                  </div>
                )
              })()}

              {calculationMethod === 'revenue' && (
                <button
                  onClick={handleCalculate}
                  disabled={!selectedCoach || (useCustomIncome && !customIncome) || (useManualPercentage && !parseFloat(manualPercentage))}
                  className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-primary-contrast py-3 sm:py-4 rounded-lg hover:from-primary-700 hover:to-primary-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed font-bold text-base sm:text-lg shadow-lg transition-colors duration-200"
                >
                  {t('more.commission.calculateButton')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* النتيجة */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">
            {calculationMethod === 'sessions' ? t('more.commission.sessionsResult') : t('more.commission.result')}
          </h2>

          {calculationMethod === 'sessions' ? (
            !selectedCoach ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">{t('more.commission.selectCoachToViewSessions')}</p>
            ) : !selectedSessionData ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">{t('more.commission.noSessionsForCoach')}</p>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                <div className="bg-green-50 dark:bg-green-900/50 ring-1 ring-green-200 dark:ring-green-700 rounded-xl p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">{t('more.commission.coach')}</p>
                  <p className="text-base sm:text-xl md:text-2xl font-bold text-green-900 dark:text-green-300">{selectedSessionData.coachName}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/50 ring-1 ring-blue-200 dark:ring-blue-700 rounded-xl p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">{t('more.commission.usedSessionsCount')}</p>
                  <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-blue-900 dark:text-blue-300">{selectedSessionData.totalUsedSessions}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('more.commission.fromMoreSubscriptions', { count: selectedSessionData.moreCount.toString() })}</p>
                </div>
                <div className="bg-primary-50 dark:bg-primary-900/50 ring-1 ring-primary-200 dark:ring-primary-700 rounded-xl p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">{t('more.commission.totalSessionsValue')}</p>
                  <p className="text-lg sm:text-2xl md:text-3xl font-bold text-primary-900 dark:text-primary-300 break-words">
                    {fmt2(selectedSessionData.totalSessionsValue)} {t('more.commission.egp')}
                  </p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/50 ring-1 ring-orange-200 dark:ring-orange-700 rounded-xl p-3 sm:p-4">
                  <label className="block text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-200 mb-2 sm:mb-3">{t('more.commission.editablePercentage')}</label>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <input
                      type="number" min="0" max="100" step="0.1"
                      value={customSessionPercentage}
                      onChange={(e) => setCustomSessionPercentage(e.target.value)}
                      disabled={!isAdmin}
                      className="flex-1 px-3 sm:px-4 py-2 sm:py-3 ring-1 ring-orange-300 dark:ring-orange-600 rounded-lg text-xl sm:text-2xl md:text-3xl font-bold text-center focus:ring-2 focus:ring-orange-200 dark:bg-gray-700 dark:text-white disabled:opacity-70"
                    />
                    <span className="text-2xl sm:text-3xl md:text-4xl font-black text-orange-600 dark:text-orange-400">%</span>
                  </div>
                  {isAdmin && <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 text-center">{t('more.commission.enterPercentageHint')}</p>}
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-xl p-4 sm:p-5 md:p-6 shadow-xl">
                  <p className="text-white/90 text-xs sm:text-sm">{t('more.commission.coachAmount')}</p>
                  <p className="text-xl sm:text-3xl md:text-4xl font-black break-words">{fmt2(calculatedSessionCommission)} {t('more.commission.egp')}</p>
                  <p className="text-white/70 text-xs mt-1 break-words">
                    = {selectedSessionData.totalSessionsValue.toLocaleString(localeString)} × {customSessionPercentage}%
                  </p>
                </div>
                {isAdmin && (
                  <div className="bg-gray-100 dark:bg-gray-700 ring-1 ring-gray-300 dark:ring-gray-600 rounded-xl p-3 sm:p-4">
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">{t('more.commission.gymShare')}</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 break-words">
                      {fmt2(selectedSessionData.totalSessionsValue - calculatedSessionCommission)} {t('more.commission.egp')}
                    </p>
                  </div>
                )}
                {renderPayrollButton(selectedSessionData.coachName, calculatedSessionCommission)}
              </div>
            )
          ) : !result ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">{t('more.commission.selectCoachToCalculate')}</p>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-primary-50 dark:bg-primary-900/50 ring-1 ring-primary-200 dark:ring-primary-700 rounded-xl p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">{t('more.commission.coach')}</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-primary-900 dark:text-primary-300">{result.coachName}</p>
              </div>

              {/* إيصالات مزيد */}
              {coachEarnings && !useCustomIncome && (() => {
                const coachReceipts = getCoachMoreReceipts(result.coachName)
                return coachReceipts.length > 0 ? (
                  <div className="bg-teal-50 dark:bg-teal-900/50 ring-1 ring-teal-200 dark:ring-teal-700 rounded-xl p-3 sm:p-4 md:p-5">
                    <h3 className="font-bold text-base sm:text-lg mb-3 dark:text-gray-100">{t('more.commission.moreReceipts', { count: coachReceipts.length.toString() })}</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {coachReceipts.map((receipt, index) => {
                        const details = parseDetails(receipt.itemDetails)
                        const mNum = receipt.moreNumber ?? details.moreNumber
                        return (
                          <div key={receipt.receiptNumber} className="bg-white dark:bg-gray-800 rounded-lg p-2 sm:p-3 border border-teal-200 dark:border-teal-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                              <div className="bg-teal-100 dark:bg-teal-900/50 text-teal-800 dark:text-teal-300 font-bold w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm flex-shrink-0">{index + 1}</div>
                              <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 break-words">
                                  {t('more.commission.receiptLabel', { number: receipt.receiptNumber.toString() })} - {receipt.type}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 break-words">
                                  {details.clientName || 'N/A'} - #{mNum ?? 'N/A'}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {new Date(receipt.createdAt).toLocaleDateString(localeString, { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                              </div>
                            </div>
                            <p className="text-base sm:text-lg font-bold text-teal-600 dark:text-teal-400">{receipt.amount.toLocaleString(localeString)} {t('more.commission.currency')}</p>
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-3 pt-3 border-t-2 border-teal-200 dark:border-teal-700 flex justify-between items-center bg-teal-100 dark:bg-teal-900/50 rounded-lg p-3">
                      <span className="font-bold text-sm sm:text-base text-gray-700 dark:text-gray-200">{t('more.commission.totalMoreRevenue')}</span>
                      <span className="text-lg sm:text-xl font-bold text-teal-600 dark:text-teal-400">
                        {coachReceipts.reduce((s, r) => s + r.amount, 0).toLocaleString(localeString)} {t('more.commission.currency')}
                      </span>
                    </div>
                  </div>
                ) : null
              })()}

              <div className="bg-cyan-50 dark:bg-cyan-900/50 ring-1 ring-cyan-200 dark:ring-cyan-700 rounded-xl p-3 sm:p-4 md:p-5">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                  {useCustomIncome ? t('more.commission.customIncome') : t('more.commission.totalMoreIncome')}
                </p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-cyan-900 dark:text-cyan-300 break-words">
                  {fmt2(result.monthlyIncome)} <span className="text-base sm:text-lg">{t('more.commission.egp')}</span>
                </p>
              </div>

              <div className={`bg-gradient-to-br ${getPercentageBgColor(result.percentage)} text-white rounded-xl p-4 sm:p-5 md:p-6 shadow-lg`}>
                <p className="text-white/90 text-xs sm:text-sm mb-1">{t('more.commission.percentage')}</p>
                <p className="text-3xl sm:text-4xl md:text-5xl font-black">{result.percentage}%</p>
                <p className="text-white/70 text-xs mt-2">{t('more.commission.onMoreRevenueOnly')}</p>
              </div>

              <div className="bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-xl p-4 sm:p-5 md:p-6 shadow-xl">
                <p className="text-white/90 text-xs sm:text-sm">{t('more.commission.coachDue')}</p>
                <p className="text-2xl sm:text-3xl font-bold font-mono break-words">{fmt2(result.commission)} <span className="text-base sm:text-lg font-semibold">{t('more.commission.egp')}</span></p>
                <p className="text-white/90 text-xs sm:text-sm text-center font-semibold mt-3 pt-3 border-t-2 border-white/30">
                  {t('more.commission.percentageOfIncome', { percentage: result.percentage.toString() })}
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/50 ring-1 ring-slate-300 dark:ring-slate-700 rounded-xl p-3 sm:p-4">
                <h3 className="font-bold text-center mb-3 text-sm sm:text-base text-gray-700 dark:text-gray-200">{t('more.commission.calculationFormula')}</h3>
                <p className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center text-sm sm:text-base break-words">
                  {result.monthlyIncome.toLocaleString(localeString)} × {result.percentage}% = <span className="font-bold text-green-600">{fmt2(result.commission)}</span> {t('more.commission.egp')}
                </p>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/50 border-r-4 border-amber-500 dark:border-amber-600 rounded-lg p-3 sm:p-4">
                <p className="font-bold text-amber-800 dark:text-amber-300 mb-1 text-sm sm:text-base">{t('more.commission.importantNote')}</p>
                <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300">{t('more.commission.displayOnlyNote')}</p>
              </div>

              {renderPayrollButton(result.coachName, result.commission)}
            </div>
          )}
        </div>
      </div>

      {/* طريقة الحصص: كل الكوتشات */}
      {calculationMethod === 'sessions' && (
        <div className="mt-6 bg-green-50 dark:bg-green-900/30 ring-1 ring-green-300 dark:ring-green-700 rounded-xl shadow-lg p-4 sm:p-6">
          <h2 className="text-2xl font-bold mb-6">{t('more.commission.commissionBySessions')}</h2>
          {loading ? (
            <LoadingScreen message={t('more.commission.calculatingCommission')} />
          ) : sessionCommissions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-300 font-bold">{t('more.commission.noDataToDisplay')}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {selectedCoach ? t('more.commission.noSessionsForSelectedCoach', { coach: selectedCoach }) : t('more.commission.selectCoachToViewSessions')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessionCommissions.map((coach) => (
                <div key={coach.coachName} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-md ring-1 ring-green-200 dark:ring-green-700">
                  <div className="flex justify-between items-start mb-4 gap-2">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1">{coach.coachName}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {t('more.commission.moreSubscriptionsAndSessions', { count: coach.moreCount.toString(), sessions: coach.totalUsedSessions.toString() })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl sm:text-3xl font-bold text-green-600">{fmt2(coach.commission)} {t('more.commission.egp')}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('more.commission.commissionWithPercentage', { percentage: coach.percentage.toString() })}</p>
                    </div>
                  </div>

                  <div className={`grid ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'} gap-3 mb-4 pb-4 border-b dark:border-gray-700`}>
                    <div className="bg-blue-50 dark:bg-blue-900/50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">{t('more.commission.sessionsValue')}</p>
                      <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{coach.totalSessionsValue.toLocaleString(localeString)} {t('more.commission.egp')}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">{t('more.commission.coachCommission')}</p>
                      <p className="text-lg font-bold text-green-700 dark:text-green-300">{coach.commission.toLocaleString(localeString)} {t('more.commission.egp')}</p>
                    </div>
                    {isAdmin && (
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">{t('more.commission.gymShare')}</p>
                        <p className="text-lg font-bold text-gray-700 dark:text-gray-200">{coach.gymShare.toLocaleString(localeString)} {t('more.commission.egp')}</p>
                      </div>
                    )}
                  </div>

                  {renderPayrollButton(coach.coachName, coach.commission, true)}

                  <details className="group mt-3">
                    <summary className="cursor-pointer text-sm font-bold text-green-700 dark:text-green-400 flex items-center gap-2">
                      <span className="group-open:rotate-90 transition-transform">▶</span>
                      <span>{t('more.commission.showSubscriptionDetails', { count: coach.moreCount.toString() })}</span>
                    </summary>
                    <div className="mt-3 space-y-2 pl-6">
                      {coach.details.map((d) => (
                        <div key={d.moreNumber} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-sm border border-gray-200 dark:border-gray-600 flex justify-between items-start gap-2">
                          <div>
                            <p className="font-bold text-gray-800 dark:text-gray-100">#{d.moreNumber} - {d.clientName}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                              {t('more.commission.sessionUsageDetails', { used: d.usedSessions.toString(), total: d.sessionsPurchased.toString(), remaining: d.sessionsRemaining.toString() })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600">{d.sessionValue.toLocaleString(localeString)} {t('more.commission.egp')}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{d.usedSessions} × {d.pricePerSession} {t('more.commission.egp')}</p>
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
      )}

      {/* نصيب الجيم — طريقة الإيرادات، للأدمن */}
      {result && calculationMethod === 'revenue' && isAdmin && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-1">{t('more.commission.gymShare')}</p>
            <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{fmt2(result.gymShare)} {t('more.commission.egp')}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-1">{t('more.commission.gymPercentage')}</p>
            <p className="text-2xl font-bold text-primary-600">{100 - result.percentage}%</p>
          </div>
        </div>
      )}

      {/* ملخص كل الكوتشات (طريقة الإيرادات) */}
      {!loading && calculationMethod === 'revenue' && allCoachesStats.length > 0 && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-6">
            {t('more.commission.allCoachesSummary', {
              fromDate: new Date(dateFrom).toLocaleDateString(localeString),
              toDate: new Date(dateTo).toLocaleDateString(localeString)
            })}
          </h2>

          {(() => {
            const rows = allCoachesStats
              .filter((s) => s.earnings.revenue > 0)
              .sort((a, b) => b.earnings.revenue - a.earnings.revenue)
            if (rows.length === 0) {
              return <p className="text-center py-12 text-xl text-gray-500 dark:text-gray-400">{t('more.commission.noMoreDataForPeriod')}</p>
            }
            return (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-right dark:text-gray-200">{t('more.commission.coach')}</th>
                      <th className="px-4 py-3 text-right dark:text-gray-200">{t('more.commission.clients')}</th>
                      <th className="px-4 py-3 text-right dark:text-gray-200">{t('more.commission.totalSessions')}</th>
                      <th className="px-4 py-3 text-right dark:text-gray-200">{t('more.commission.completedSessions')}</th>
                      <th className="px-4 py-3 text-right dark:text-gray-200">{t('more.commission.totalIncome')}</th>
                      <th className="px-4 py-3 text-right dark:text-gray-200">{t('more.commission.percentage')}</th>
                      <th className="px-4 py-3 text-right dark:text-gray-200">{t('more.commission.expectedCommission')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((stat) => {
                      const percentage = calculatePercentage(stat.earnings.revenue)
                      const commission = (stat.earnings.revenue * percentage) / 100
                      return (
                        <tr key={stat.coachName} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-3 font-semibold dark:text-gray-200">{stat.coachName}</td>
                          <td className="px-4 py-3 text-center dark:text-gray-300">{stat.earnings.clients}</td>
                          <td className="px-4 py-3 text-center dark:text-gray-300">{stat.earnings.totalSessions}</td>
                          <td className="px-4 py-3 text-center text-green-600 dark:text-green-400 font-bold">{stat.earnings.completedSessions}</td>
                          <td className="px-4 py-3 font-bold text-primary-600 dark:text-primary-400">{fmt0(stat.earnings.revenue)} {t('more.commission.egp')}</td>
                          <td className="px-4 py-3 text-center"><span className="font-bold text-lg">{percentage}%</span></td>
                          <td className="px-4 py-3 font-bold text-green-600">{fmt0(commission)} {t('more.commission.egp')}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-primary-50 dark:bg-primary-900/50 font-bold">
                    <tr>
                      <td className="px-4 py-3">{t('more.commission.total')}</td>
                      <td className="px-4 py-3 text-center">{rows.reduce((s, r) => s + r.earnings.clients, 0)}</td>
                      <td className="px-4 py-3 text-center">{rows.reduce((s, r) => s + r.earnings.totalSessions, 0)}</td>
                      <td className="px-4 py-3 text-center text-green-600 dark:text-green-400">{rows.reduce((s, r) => s + r.earnings.completedSessions, 0)}</td>
                      <td className="px-4 py-3 text-primary-600">{fmt0(rows.reduce((s, r) => s + r.earnings.revenue, 0))} {t('more.commission.egp')}</td>
                      <td className="px-4 py-3 text-center">-</td>
                      <td className="px-4 py-3 text-green-600">
                        {fmt0(rows.reduce((s, r) => s + (r.earnings.revenue * calculatePercentage(r.earnings.revenue)) / 100, 0))} {t('more.commission.egp')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          })()}

          {/* مطابقة مع التقفيل — للأدمن */}
          {isAdmin && (() => {
            const { start, end } = getRange()
            const inRange = (r: Receipt) => { const d = new Date(r.createdAt); return d >= start && d <= end }
            const closingMatchTotal = receipts
              .filter((r) => countsAsRevenue(r) && isMoreReceipt(r.type) && inRange(r))
              .reduce((s, r) => s + r.amount, 0)
            const coachesSumTotal = allCoachesStats.reduce((s, x) => s + x.earnings.revenue, 0)
            const refundedTotal = receipts
              .filter((r) => r.isCancelled && r.refundMethod && isMoreReceipt(r.type) && inRange(r))
              .reduce((s, r) => s + r.amount, 0)
            const gap = closingMatchTotal - coachesSumTotal
            const ok = Math.abs(gap) < 1
            return (
              <div className="mt-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-800">
                <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200 mb-2">{t('more.commission.matchTitle')}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 ring-1 ring-gray-200 dark:ring-gray-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t('more.commission.totalMoreInPeriod')}</p>
                    <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">{fmt0(closingMatchTotal)} {t('more.commission.egp')}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 ring-1 ring-gray-200 dark:ring-gray-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t('more.commission.sumOfCoaches')}</p>
                    <p className="text-lg font-black text-primary-700 dark:text-primary-400">{fmt0(coachesSumTotal)} {t('more.commission.egp')}</p>
                  </div>
                  <div className={`rounded-lg p-3 ring-1 ${ok ? 'bg-green-50 dark:bg-green-900/20 ring-green-200 dark:ring-green-800' : 'bg-amber-50 dark:bg-amber-900/20 ring-amber-200 dark:ring-amber-800'}`}>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{t('more.commission.gap')}</p>
                    <p className={`text-lg font-black ${ok ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>{fmt0(gap)} {t('more.commission.egp')}</p>
                    {refundedTotal > 0 && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{t('more.commission.inclRefunds', { amount: fmt0(refundedTotal) })}</p>
                    )}
                  </div>
                </div>
                {!ok && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">⚠️ {t('more.commission.gapNote')}</p>}
              </div>
            )
          })()}
        </div>
      )}

      {/* مودال التحصيل */}
      {showPayrollModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white p-5 rounded-t-2xl">
              <h2 className="text-xl font-bold">{t('more.commission.payrollModalTitle', { name: payrollCoachName })}</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl p-4">
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">{t('more.commission.commissionLabel')}</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{fmt2(payrollCommission)} {t('more.commission.currency')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{t('more.commission.salaryLabel')}</label>
                <input
                  type="number"
                  value={payrollSalary}
                  onChange={(e) => setPayrollSalary(e.target.value)}
                  className="w-full px-4 py-3 ring-1 ring-gray-300 dark:ring-gray-600 rounded-xl text-lg font-mono focus:ring-2 focus:ring-violet-200 dark:bg-gray-700 dark:text-white"
                  placeholder="0"
                  min="0"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('more.commission.salaryHint')}</p>
              </div>

              {loadingDeductions ? (
                <div className="text-center text-sm text-gray-400 dark:text-gray-500 py-2">{t('more.commission.loadingDeductions')}</div>
              ) : payrollDeductions.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4">
                  <p className="text-sm font-bold text-red-700 dark:text-red-300 mb-2">
                    {t('more.commission.pendingDeductionsTitle', { count: payrollDeductions.length.toString() })}
                  </p>
                  <div className="space-y-1">
                    {payrollDeductions.map((d) => (
                      <div key={d.id} className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                        <span>{d.reason}</span>
                        <span className="font-bold text-red-600 dark:text-red-400">- {d.amount.toLocaleString(localeString)} {t('more.commission.currency')}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-red-200 dark:border-red-700 mt-2 pt-2 flex justify-between font-bold text-sm">
                    <span className="text-red-700 dark:text-red-300">{t('more.commission.totalDeductionsLabel')}</span>
                    <span className="text-red-600 dark:text-red-400">- {payrollDeductions.reduce((s, d) => s + d.amount, 0).toLocaleString(localeString)} {t('more.commission.currency')}</span>
                  </div>
                </div>
              )}

              <div className="bg-violet-50 dark:bg-violet-900/30 ring-1 ring-violet-300 dark:ring-violet-700 rounded-xl p-4">
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">{t('more.commission.totalLabel')}</p>
                <p className="text-3xl font-bold text-violet-600 dark:text-violet-400">
                  {fmt2(payrollCommission + (parseFloat(payrollSalary) || 0) - payrollDeductions.reduce((s, d) => s + d.amount, 0))} {t('more.commission.currency')}
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleConfirmPayroll}
                  disabled={payrollLoading}
                  className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {payrollLoading ? '...' : t('more.commission.confirmPayroll')}
                </button>
                <button
                  onClick={() => setShowPayrollModal(false)}
                  className="px-6 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold py-3 rounded-xl transition-colors duration-200"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

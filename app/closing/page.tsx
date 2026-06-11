'use client'

import React, { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import ExcelJS from 'exceljs'
import { useLanguage } from '../../contexts/LanguageContext'
import { normalizePaymentMethod, isMultiPayment } from '../../lib/paymentHelpers'
import { PRIMARY_COLOR, THEME_COLORS } from '@/lib/theme/colors'
import { getReceiptTypeTranslationKey, isFloorReceipt, isPTReceipt, isNutritionReceipt, isPhysiotherapyReceipt } from '../../lib/translateReceiptType'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionDenied from '../../components/PermissionDenied'
import { LoadingScreen } from '../../components/Spinner'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

const IconCash = (
  <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h18M7 7v10M17 7v10"/></svg>
)
const IconCard = (
  <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z"/></svg>
)
const IconPhone = (
  <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 3h8a1 1 0 011 1v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1zm4 17h.01"/></svg>
)
const IconWallet = (
  <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-1M16 12h5v4h-5a2 2 0 010-4z"/></svg>
)
const IconTrophy = (
  <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8M12 17v4M6 4h12v4a6 6 0 11-12 0V4zM6 4H3v3a3 3 0 003 3M18 4h3v3a3 3 0 01-3 3"/></svg>
)
const IconPrint = (
  <svg className="w-4 h-4" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z"/></svg>
)
const IconExport = (
  <svg className="w-4 h-4" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
)
const IconRefresh = (
  <svg className="w-4 h-4" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M5 19a9 9 0 0014.65-3.36M19 5a9 9 0 00-14.65 3.36"/></svg>
)
const IconReceipt = (
  <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 14h6m-6-4h6m-6-4h6M7 21l1.5-1.5L10 21l1.5-1.5L13 21l1.5-1.5L16 21l1.5-1.5L19 21V3H5v18l1-1z"/></svg>
)
const IconExpense = (
  <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zM3 12c0 4.97 4.03 9 9 9s9-4.03 9-9-4.03-9-9-9-9 4.03-9 9z"/></svg>
)
const IconCheck = (
  <svg className="w-4 h-4" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
)
const IconX = (
  <svg className="w-4 h-4" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6"/></svg>
)
const IconCalendar = (
  <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
)
const IconChartBar = (
  <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 14l3-3 4 4 5-5"/></svg>
)
const IconNutrition = (
  <svg className="w-4 h-4" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7zm0 9a2 2 0 100-4 2 2 0 000 4z"/></svg>
)
const IconPhysio = (
  <svg className="w-4 h-4" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
)
const IconEmptyBox = (
  <svg className="w-12 h-12 text-gray-400" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0l-2 7H6l-2-7m16 0H4"/></svg>
)
const IconChevronDown = (
  <svg className="w-4 h-4" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6"/></svg>
)
const IconChevronRight = (
  <svg className="w-4 h-4" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6"/></svg>
)
const IconChevronLeftSvg = (
  <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
)
const IconChevronRightSvg = (
  <svg className="w-5 h-5" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
)
const IconShuffle = (
  <svg className="w-4 h-4" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>
)
const IconSpinner = (
  <svg className="w-8 h-8 animate-spin text-primary-500" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
)
const IconArrowUp = (
  <svg className="w-3.5 h-3.5 inline" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7"/></svg>
)
const IconArrowDown = (
  <svg className="w-3.5 h-3.5 inline" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M19 12l-7 7-7-7"/></svg>
)
const IconTrendUp = (
  <svg className="w-5 h-5 inline" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8M14 7h7v7"/></svg>
)
const IconTrendDown = (
  <svg className="w-5 h-5 inline" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3 7l6 6 4-4 8 8M14 17h7v-7"/></svg>
)
const IconTrendFlat = (
  <svg className="w-5 h-5 inline" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M14 7l5 5-5 5"/></svg>
)

const ClosingCharts = dynamic(() => import('@/components/ClosingCharts'), {
  ssr: false,
  loading: () => (
    <div className="space-y-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="skeleton-shimmer h-[420px] rounded-lg" />
      ))}
    </div>
  ),
})

interface DailyData {
  date: string
  floor: number
  pt: number
  nutrition: number
  physiotherapy: number
  other: number
  expenses: number
  expenseDetails: string
  visa: number
  instapay: number
  cash: number
  wallet: number
  points: number  // النقاط المستخدمة
  remainingAmount: number  // الفلوس الباقية
  remainingInstapay: number // الفلوس الباقية - إنستاباي
  remainingWallet: number   // الفلوس الباقية - محفظة
  staffLoans: { [key: string]: number }
  receipts: any[]
  expensesList: any[]
}

interface Staff {
  id: string
  name: string
}

export default function ClosingPage() {
  const { hasPermission, isAdmin, loading: permissionsLoading, user } = usePermissions()
  const [dailyData, setDailyData] = useState<DailyData[]>([])
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'daily' | 'monthly' | 'yearly' | 'comparison'>('monthly')
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().split('T')[0])
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())

  // للمقارنة بين الشهور
  const [comparisonStartMonth, setComparisonStartMonth] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 3)
    return date.toISOString().slice(0, 7)
  })
  const [comparisonEndMonth, setComparisonEndMonth] = useState(new Date().toISOString().slice(0, 7))
  const [monthlyComparison, setMonthlyComparison] = useState<any[]>([])

  const [totals, setTotals] = useState({
    floor: 0,
    pt: 0,
    nutrition: 0,
    physiotherapy: 0,
    other: 0,
    expenses: 0,
    visa: 0,
    instapay: 0,
    cash: 0,
    wallet: 0,
    points: 0,               // النقاط المستخدمة
    remainingAmount: 0,      // الفلوس الباقية
    remainingInstapay: 0,    // الفلوس الباقية - إنستاباي
    remainingWallet: 0,      // الفلوس الباقية - محفظة
    totalPayments: 0,
    totalRevenue: 0,
    netProfit: 0
  })

  const [pointsValueInEGP, setPointsValueInEGP] = useState(0.1) // القيمة الافتراضية
  const [nutritionEnabled, setNutritionEnabled] = useState(false)
  const [physiotherapyEnabled, setPhysiotherapyEnabled] = useState(false)

  const { t, direction } = useLanguage()

  const fetchData = async () => {
    try {
      setLoading(true)

      const staffRes = await fetch('/api/staff')
      const staff = await staffRes.json()
      setStaffList(staff)

      const receiptsRes = await fetch('/api/receipts')
      const receipts = await receiptsRes.json()

      const expensesRes = await fetch('/api/expenses')
      const expenses = await expensesRes.json()

      // جلب إعدادات النظام للحصول على قيمة النقطة بالجنيه
      try {
        const settingsRes = await fetch('/api/settings/services')
        if (settingsRes.ok) {
          const settings = await settingsRes.json()
          if (settings.pointsValueInEGP) {
            setPointsValueInEGP(settings.pointsValueInEGP)
          }
          setNutritionEnabled(!!settings.nutritionEnabled)
          setPhysiotherapyEnabled(!!settings.physiotherapyEnabled)
        }
      } catch (error) {
        console.error('Error fetching settings:', error)
      }

      const now = new Date()
      const filterDate = (dateString: string) => {
        const d = new Date(dateString)

        if (viewMode === 'daily') {
          // في الوضع اليومي، نعرض اليوم المحدد فقط
          const selectedDate = new Date(selectedDay)
          return d.toDateString() === selectedDate.toDateString()
        } else if (viewMode === 'monthly') {
          // في الوضع الشهري، نعرض الشهر المحدد
          const [year, month] = selectedMonth.split('-')
          return d.getFullYear() === parseInt(year) && d.getMonth() === parseInt(month) - 1
        } else if (viewMode === 'yearly') {
          // في الوضع السنوي، نعرض السنة المحددة
          return d.getFullYear() === parseInt(selectedYear)
        }
        return false
      }

      const filteredReceipts = receipts.filter((r: any) => !r.isCancelled && filterDate(r.createdAt))
      const filteredExpenses = expenses.filter((e: any) => filterDate(e.createdAt))

      // بناء map للمدفوعات اللاحقة (Payment receipts) عشان نحسب الباقي الفعلي الحالي
      // نـ index الـ payments بـ memberId / ptNumber + تاريخها — مرتبة من الأقدم للأحدث.
      // ملاحظة: بنشتغل على كل الإيصالات (مش filteredReceipts) عشان الـ payments اللي حصلت
      // بعد الفترة المعروضة بتأثر برضو على البواقي الحالية للإيصالات القديمة.
      const activeReceipts = (receipts as any[]).filter(r => !r.isCancelled)
      const paymentsByMember: Record<string, Array<{ amount: number; date: number }>> = {}
      const paymentsByPT: Record<string, Array<{ amount: number; date: number }>> = {}
      activeReceipts.forEach((r: any) => {
        if (r.type !== 'Payment') return
        const ts = new Date(r.createdAt).getTime()
        if (r.memberId) {
          if (!paymentsByMember[r.memberId]) paymentsByMember[r.memberId] = []
          paymentsByMember[r.memberId].push({ amount: r.amount || 0, date: ts })
        }
        if (r.ptNumber) {
          const key = String(r.ptNumber)
          if (!paymentsByPT[key]) paymentsByPT[key] = []
          paymentsByPT[key].push({ amount: r.amount || 0, date: ts })
        }
      })
      Object.values(paymentsByMember).forEach(arr => arr.sort((a, b) => a.date - b.date))
      Object.values(paymentsByPT).forEach(arr => arr.sort((a, b) => a.date - b.date))

      // نبني map للاشتراكات المتتالية لكل عضو/PT عشان نحدد "النافذة" بتاعت كل اشتراك
      // (الـ payments قبل الاشتراك التالي بتطرح من الباقي الحالي، اللي بعده مالهاش علاقة).
      const subsByMember: Record<string, number[]> = {} // memberId → sorted timestamps
      const subsByPT: Record<string, number[]> = {}    // ptNumber → sorted timestamps
      activeReceipts.forEach((r: any) => {
        if (r.type === 'Payment') return
        // فقط الإيصالات اللي ليها فعلاً remainingAmount في الـ snapshot بتعتبر "اشتراك"
        let hasRemainingField = false
        try {
          const det = r.itemDetails ? JSON.parse(r.itemDetails) : null
          hasRemainingField = det && typeof det.remainingAmount === 'number'
        } catch {}
        if (!hasRemainingField) return
        const ts = new Date(r.createdAt).getTime()
        if (r.memberId) {
          if (!subsByMember[r.memberId]) subsByMember[r.memberId] = []
          subsByMember[r.memberId].push(ts)
        }
        if (r.ptNumber) {
          const key = String(r.ptNumber)
          if (!subsByPT[key]) subsByPT[key] = []
          subsByPT[key].push(ts)
        }
      })
      Object.values(subsByMember).forEach(arr => arr.sort((a, b) => a - b))
      Object.values(subsByPT).forEach(arr => arr.sort((a, b) => a - b))

      /** يطرح من originalRemaining أي payments حصلت بعد الاشتراك ده وقبل الاشتراك اللي بعده. */
      const computeActualRemaining = (receipt: any, originalRemaining: number): number => {
        if (originalRemaining <= 0) return 0
        const recTs = new Date(receipt.createdAt).getTime()
        const memberId = receipt.memberId as string | null
        const ptNumber = receipt.ptNumber as number | null

        // نلاقي الـ timestamp بتاع الاشتراك اللي بعد ده مباشرة (لو في) عشان نحدد نهاية النافذة
        let nextSubTs: number = Infinity
        if (memberId && subsByMember[memberId]) {
          const idx = subsByMember[memberId].findIndex(t => t > recTs)
          if (idx >= 0) nextSubTs = subsByMember[memberId][idx]
        } else if (ptNumber && subsByPT[String(ptNumber)]) {
          const idx = subsByPT[String(ptNumber)].findIndex(t => t > recTs)
          if (idx >= 0) nextSubTs = subsByPT[String(ptNumber)][idx]
        }

        // نجمع كل الـ payments في النافذة (recTs, nextSubTs)
        const payments = memberId
          ? (paymentsByMember[memberId] || [])
          : (ptNumber ? (paymentsByPT[String(ptNumber)] || []) : [])
        let paid = 0
        for (const p of payments) {
          if (p.date > recTs && p.date < nextSubTs) paid += p.amount
        }
        return Math.max(0, originalRemaining - paid)
      }

      const dailyMap: { [key: string]: DailyData } = {}

      filteredReceipts.forEach((receipt: any) => {
        // استخدام التاريخ المحلي بدلاً من UTC
        const receiptDate = new Date(receipt.createdAt)
        const year = receiptDate.getFullYear()
        const month = String(receiptDate.getMonth() + 1).padStart(2, '0')
        const day = String(receiptDate.getDate()).padStart(2, '0')
        const date = `${year}-${month}-${day}`

        if (!dailyMap[date]) {
          dailyMap[date] = {
            date,
            floor: 0,
            pt: 0,
            nutrition: 0,
            physiotherapy: 0,
            other: 0,
            expenses: 0,
            expenseDetails: '',
            visa: 0,
            instapay: 0,
            cash: 0,
            wallet: 0,
            points: 0,               // النقاط المستخدمة
            remainingAmount: 0,      // الفلوس الباقية
            remainingInstapay: 0,    // الفلوس الباقية - إنستاباي
            remainingWallet: 0,      // الفلوس الباقية - محفظة
            staffLoans: {},
            receipts: [],
            expensesList: []
          }
        }

        dailyMap[date].receipts.push(receipt)

        // استخراج المبلغ المتبقي من itemDetails ثم خصم أي مدفوعات لاحقة (Payment)
        // عشان نعرض الباقي الفعلي الحالي مش snapshot الإصدار
        let remainingAmountInReceipt = 0
        try {
          const details = JSON.parse(receipt.itemDetails)
          const originalRemaining = details.remainingAmount || 0
          remainingAmountInReceipt = computeActualRemaining(receipt, originalRemaining)
        } catch (e) {
          // ignore parsing errors
        }

        // تحديد نوع الإيصال
        if (isPTReceipt(receipt.type)) {
          // PT يشمل: اشتراكات جديدة، تجديدات، ودفع الباقي
          dailyMap[date].pt += receipt.amount
        } else if (isNutritionReceipt(receipt.type)) {
          dailyMap[date].nutrition += receipt.amount
        } else if (isPhysiotherapyReceipt(receipt.type)) {
          dailyMap[date].physiotherapy += receipt.amount
        } else {
          // floor يشمل: عضويات، تجديدات، Payment، day use، upgrade، جروب كلاسيس، inBody، إلخ
          dailyMap[date].floor += receipt.amount

          // إضافة المبلغ المتبقي (فقط للأنواع اللي عندها remaining ومش Payment)
          if (remainingAmountInReceipt > 0 && receipt.type !== 'Payment') {
            dailyMap[date].remainingAmount += remainingAmountInReceipt

            // توزيع المبلغ المتبقي حسب طريقة الدفع
            const paymentMethodRaw = receipt.paymentMethod || 'cash'
            if (isMultiPayment(paymentMethodRaw)) {
              // دفع متعدد - توزيع المبلغ المتبقي بنفس نسبة التوزيع
              const normalized = normalizePaymentMethod(paymentMethodRaw, receipt.amount)
              normalized.methods.forEach(pm => {
                const ratio = pm.amount / receipt.amount
                const remainingForThisMethod = remainingAmountInReceipt * ratio

                if (pm.method === 'instapay') {
                  dailyMap[date].remainingInstapay += remainingForThisMethod
                } else if (pm.method === 'wallet') {
                  dailyMap[date].remainingWallet += remainingForThisMethod
                }
              })
            } else {
              // دفع واحد
              if (paymentMethodRaw === 'instapay') {
                dailyMap[date].remainingInstapay += remainingAmountInReceipt
              } else if (paymentMethodRaw === 'wallet') {
                dailyMap[date].remainingWallet += remainingAmountInReceipt
              }
            }
          }
        }

        // CRITICAL: توزيع المبالغ حسب وسائل الدفع الفعلية (دعم الدفع المتعدد)
        const paymentMethodRaw = receipt.paymentMethod || 'cash'
        if (isMultiPayment(paymentMethodRaw)) {
          // دفع متعدد - توزيع المبالغ حسب كل طريقة
          const normalized = normalizePaymentMethod(paymentMethodRaw, receipt.amount)
          normalized.methods.forEach(pm => {
            if (pm.method === 'visa') {
              dailyMap[date].visa += pm.amount
            } else if (pm.method === 'instapay') {
              dailyMap[date].instapay += pm.amount
            } else if (pm.method === 'wallet') {
              dailyMap[date].wallet += pm.amount
            } else if (pm.method === 'points') {
              dailyMap[date].points += pm.amount
            } else {
              dailyMap[date].cash += pm.amount
            }
          })
        } else {
          // دفع واحد (backward compatible)
          if (paymentMethodRaw === 'visa') {
            dailyMap[date].visa += receipt.amount
          } else if (paymentMethodRaw === 'instapay') {
            dailyMap[date].instapay += receipt.amount
          } else if (paymentMethodRaw === 'wallet') {
            dailyMap[date].wallet += receipt.amount
          } else if (paymentMethodRaw === 'points') {
            dailyMap[date].points += receipt.amount
          } else {
            dailyMap[date].cash += receipt.amount
          }
        }
      })

      filteredExpenses.forEach((expense: any) => {
        // استخدام التاريخ المحلي بدلاً من UTC
        const expenseDate = new Date(expense.createdAt)
        const year = expenseDate.getFullYear()
        const month = String(expenseDate.getMonth() + 1).padStart(2, '0')
        const day = String(expenseDate.getDate()).padStart(2, '0')
        const date = `${year}-${month}-${day}`

        if (!dailyMap[date]) {
          dailyMap[date] = {
            date,
            floor: 0,
            pt: 0,
            nutrition: 0,
            physiotherapy: 0,
            other: 0,
            expenses: 0,
            expenseDetails: '',
            visa: 0,
            instapay: 0,
            cash: 0,
            wallet: 0,
            points: 0,               // النقاط المستخدمة
            remainingAmount: 0,      // الفلوس الباقية
            remainingInstapay: 0,    // الفلوس الباقية - إنستاباي
            remainingWallet: 0,      // الفلوس الباقية - محفظة
            staffLoans: {},
            receipts: [],
            expensesList: []
          }
        }

        dailyMap[date].expensesList.push(expense)
        dailyMap[date].expenses += expense.amount

        if (expense.type === 'staff_loan' && expense.staff) {
          const staffName = expense.staff.name
          if (!dailyMap[date].staffLoans[staffName]) {
            dailyMap[date].staffLoans[staffName] = 0
          }
          dailyMap[date].staffLoans[staffName] += expense.amount
        }

        if (dailyMap[date].expenseDetails) {
          dailyMap[date].expenseDetails += ' + '
        }
        dailyMap[date].expenseDetails += `${expense.amount}${expense.description}`
      })

      const sortedData = Object.values(dailyMap).sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )

      setDailyData(sortedData)

      const newTotals = sortedData.reduce((acc, day) => {
        acc.floor += day.floor
        acc.pt += day.pt
        acc.nutrition += day.nutrition
        acc.physiotherapy += day.physiotherapy
        acc.other += day.other
        acc.expenses += day.expenses
        acc.visa += day.visa
        acc.instapay += day.instapay
        acc.cash += day.cash
        acc.wallet += day.wallet
        acc.points += day.points                          // النقاط المستخدمة
        acc.remainingAmount += day.remainingAmount        // الفلوس الباقية
        acc.remainingInstapay += day.remainingInstapay    // الفلوس الباقية - إنستاباي
        acc.remainingWallet += day.remainingWallet        // الفلوس الباقية - محفظة
        return acc
      }, {
        floor: 0,
        pt: 0,
        nutrition: 0,
        physiotherapy: 0,
        other: 0,
        expenses: 0,
        visa: 0,
        instapay: 0,
        cash: 0,
        wallet: 0,
        points: 0,               // النقاط المستخدمة
        remainingAmount: 0,      // الفلوس الباقية
        remainingInstapay: 0,    // الفلوس الباقية - إنستاباي
        remainingWallet: 0,      // الفلوس الباقية - محفظة
        totalPayments: 0,
        totalRevenue: 0,
        netProfit: 0
      })

      newTotals.totalPayments = newTotals.cash + newTotals.visa + newTotals.instapay + newTotals.wallet + newTotals.points
      newTotals.totalRevenue = newTotals.floor + newTotals.pt + newTotals.nutrition + newTotals.physiotherapy
      newTotals.netProfit = newTotals.totalRevenue - newTotals.expenses

      setTotals(newTotals)

    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (viewMode === 'comparison') {
      fetchComparisonData()
    } else {
      fetchData()
    }
  }, [viewMode, selectedDay, selectedMonth, selectedYear, comparisonStartMonth, comparisonEndMonth])

  // 📅 لو اليوزر معاه canCloseDayOnly فقط — افتح على daily mode تلقائياً عند الـ load
  useEffect(() => {
    if (permissionsLoading) return
    const fullClosing = hasPermission('canAccessClosing')
    const dayOnly = hasPermission('canCloseDayOnly')
    if (!fullClosing && dayOnly && viewMode !== 'daily') {
      setViewMode('daily')
    }
  }, [permissionsLoading, hasPermission, viewMode])

  const fetchComparisonData = async () => {
    try {
      setLoading(true)

      const receiptsRes = await fetch('/api/receipts')
      const receipts = await receiptsRes.json()

      const expensesRes = await fetch('/api/expenses')
      const expenses = await expensesRes.json()

      // تحديد الأشهر المطلوبة
      const startDate = new Date(comparisonStartMonth + '-01')
      const endDate = new Date(comparisonEndMonth + '-01')

      const monthsData: any[] = []
      const currentDate = new Date(startDate)

      while (currentDate <= endDate) {
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`

        // فلترة البيانات لهذا الشهر
        const monthReceipts = receipts.filter((r: any) => {
          if (r.isCancelled) return false
          const d = new Date(r.createdAt)
          return d.getFullYear() === year && d.getMonth() === month
        })

        const monthExpenses = expenses.filter((e: any) => {
          const d = new Date(e.createdAt)
          return d.getFullYear() === year && d.getMonth() === month
        })

        // حساب المجاميع
        const ptRevenue = monthReceipts
          .filter((r: any) => isPTReceipt(r.type))
          .reduce((sum: number, r: any) => sum + r.amount, 0)

        const floorRevenue = monthReceipts
          .filter((r: any) => !isPTReceipt(r.type) && !isNutritionReceipt(r.type) && !isPhysiotherapyReceipt(r.type))
          .reduce((sum: number, r: any) => sum + r.amount, 0)

        const totalExpenses = monthExpenses.reduce((sum: number, e: any) => sum + e.amount, 0)
        const totalRevenue = floorRevenue + ptRevenue +
          monthReceipts.filter((r: any) => isNutritionReceipt(r.type)).reduce((sum: number, r: any) => sum + r.amount, 0) +
          monthReceipts.filter((r: any) => isPhysiotherapyReceipt(r.type)).reduce((sum: number, r: any) => sum + r.amount, 0)
        const netProfit = totalRevenue - totalExpenses

        // عدد الاشتراكات
        const memberSubscriptions = monthReceipts.filter((r: any) => !isPTReceipt(r.type)).length
        const ptSubscriptions = monthReceipts.filter((r: any) => isPTReceipt(r.type)).length

        monthsData.push({
          month: monthKey,
          monthName: currentDate.toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' }),
          floorRevenue,
          ptRevenue,
          totalRevenue,
          totalExpenses,
          netProfit,
          memberSubscriptions,
          ptSubscriptions,
          totalSubscriptions: memberSubscriptions + ptSubscriptions,
          receiptsCount: monthReceipts.length
        })

        currentDate.setMonth(currentDate.getMonth() + 1)
      }

      setMonthlyComparison(monthsData)

    } catch (error) {
      console.error('Error fetching comparison data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'X-GYM'
      workbook.created = new Date()

      const mainSheet = workbook.addWorksheet(t('closing.excel.mainSheet'), {
        views: [{ rightToLeft: direction === 'rtl' }],
        properties: { defaultColWidth: 12 }
      })

      const headerRow = mainSheet.addRow([
        t('closing.table.date'),
        t('closing.table.floor'),
        direction === 'rtl' ? 'الفلوس الباقية' : 'Remaining',
        t('closing.table.pt'),
        ...(nutritionEnabled ? [direction === 'rtl' ? 'تغذية' : 'Nutrition'] : []),
        ...(physiotherapyEnabled ? [direction === 'rtl' ? 'علاج طبيعي' : 'Physiotherapy'] : []),
        t('closing.table.cash'),
        t('closing.table.visa'),
        t('closing.table.instapay'),
        t('closing.table.wallet'),
        t('closing.table.total'),
        t('closing.table.expenses'),
        t('closing.table.expenseDetails'),
        t('closing.table.totalLoans'),
        ...(staffList || []).map(staff => staff.name)
      ])

      headerRow.font = { bold: true, size: 12, name: 'Arial' }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.height = 25
      headerRow.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }

      dailyData.forEach((day, index) => {
        const totalStaffLoans = Object.values(day.staffLoans).reduce((a, b) => a + b, 0)
        const dayTotalPayments = day.cash + day.visa + day.instapay + day.wallet + day.points
        const row = mainSheet.addRow([
          new Date(day.date).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US'),
          day.floor > 0 ? day.floor : 0,
          day.remainingAmount > 0 ? day.remainingAmount : 0,
          day.pt > 0 ? day.pt : 0,
          ...(nutritionEnabled ? [day.nutrition > 0 ? day.nutrition : 0] : []),
          ...(physiotherapyEnabled ? [day.physiotherapy > 0 ? day.physiotherapy : 0] : []),
          day.cash > 0 ? day.cash : 0,
          day.visa > 0 ? day.visa : 0,
          day.instapay > 0 ? day.instapay : 0,
          day.wallet > 0 ? day.wallet : 0,
          day.points > 0 ? day.points : 0,
          dayTotalPayments,
          day.expenses > 0 ? day.expenses : 0,
          day.expenseDetails || '-',
          totalStaffLoans > 0 ? totalStaffLoans : 0,
          ...(staffList || []).map(staff => day.staffLoans[staff.name] || 0)
        ])

        if (index % 2 === 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F5F5' }
          }
        }

        row.alignment = { horizontal: direction === 'rtl' ? 'right' : 'left', vertical: 'middle' }
        row.font = { name: 'Arial', size: 11 }

        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
        })
      })

      const totalStaffLoansAll = dailyData.reduce((sum, day) =>
        sum + Object.values(day.staffLoans).reduce((a, b) => a + b, 0), 0
      )
      const totalsRow = mainSheet.addRow([
        t('closing.table.totalLabel'),
        totals.floor,
        totals.remainingAmount,
        totals.pt,
        ...(nutritionEnabled ? [totals.nutrition] : []),
        ...(physiotherapyEnabled ? [totals.physiotherapy] : []),
        totals.cash,
        totals.visa,
        totals.instapay,
        totals.wallet,
        totals.points,
        totals.totalPayments,
        totals.expenses,
        '',
        totalStaffLoansAll,
        ...(staffList || []).map(staff => {
          const total = dailyData.reduce((sum, day) =>
            sum + (day.staffLoans[staff.name] || 0), 0
          )
          return total
        })
      ])

      totalsRow.font = { bold: true, size: 13, name: 'Arial' }
      totalsRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFD700' }
      }
      totalsRow.alignment = { horizontal: direction === 'rtl' ? 'right' : 'left', vertical: 'middle' }
      totalsRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'medium' },
          left: { style: 'thin' },
          bottom: { style: 'medium' },
          right: { style: 'thin' }
        }
      })

      mainSheet.addRow([])
      const profitRow = mainSheet.addRow([t('closing.stats.netProfit'), totals.netProfit])
      profitRow.font = { bold: true, size: 14, name: 'Arial' }
      profitRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF90EE90' }
      }
      profitRow.alignment = { horizontal: direction === 'rtl' ? 'right' : 'left', vertical: 'middle' }

      mainSheet.addRow([])
      const summaryTitle = mainSheet.addRow([t('closing.excel.summaryTitle')])
      summaryTitle.font = { bold: true, size: 13, name: 'Arial' }
      summaryTitle.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      }

      mainSheet.addRow([t('closing.stats.totalExpenses'), totals.expenses])
      mainSheet.addRow([t('closing.stats.netProfit'), totals.netProfit])
      mainSheet.addRow([t('closing.stats.numberOfDays'), dailyData.length])
      mainSheet.addRow([t('closing.stats.dailyAverage'), dailyData.length > 0 ? Math.round(totals.totalPayments / dailyData.length) : 0])

      mainSheet.addRow([])
      const paymentTitle = mainSheet.addRow([t('closing.paymentMethods.title')])
      paymentTitle.font = { bold: true, size: 13, name: 'Arial' }
      paymentTitle.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      }

      mainSheet.addRow([t('closing.paymentMethods.cash'), totals.cash])
      mainSheet.addRow([t('closing.paymentMethods.visa'), totals.visa])
      mainSheet.addRow([t('closing.paymentMethods.instapay'), totals.instapay])
      mainSheet.addRow([t('closing.paymentMethods.wallet'), totals.wallet])
      mainSheet.addRow([t('closing.paymentMethods.points'), totals.points])
      mainSheet.addRow([t('closing.stats.totalPayments'), totals.totalPayments])

      mainSheet.columns = [
        { width: 15 },  // التاريخ
        { width: 12 },  // Floor
        { width: 12 },  // PT
        { width: 12 },  // كاش
        { width: 12 },  // فيزا
        { width: 14 },  // إنستاباي
        { width: 12 },  // محفظة
        { width: 14 },  // Total
        { width: 12 },  // مصاريف
        { width: 45 },  // تفاصيل المصاريف
        { width: 14 },  // إجمالي السلف
        ...(staffList || []).map(() => ({ width: 14 }))
      ]

      if (dailyData.some(day => day.receipts.length > 0)) {
        const receiptsSheet = workbook.addWorksheet(t('closing.excel.receiptsSheet'), {
          views: [{ rightToLeft: direction === 'rtl' }]
        })

        const receiptsHeader = receiptsSheet.addRow([
          t('closing.receipts.date'), t('closing.receipts.time'), t('closing.receipts.receiptNumber'), t('closing.receipts.type'), t('closing.receipts.amount'), t('closing.receipts.paymentMethod'), t('closing.receipts.details')
        ])
        receiptsHeader.font = { bold: true, size: 12, name: 'Arial' }
        receiptsHeader.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF87CEEB' }
        }
        receiptsHeader.alignment = { horizontal: 'center', vertical: 'middle' }
        receiptsHeader.height = 25

        dailyData.forEach(day => {
          day.receipts.forEach((receipt: any) => {
            const details = JSON.parse(receipt.itemDetails)
            const detailsText = details.memberName || details.clientName || details.name || '-'
            const row = receiptsSheet.addRow([
              new Date(receipt.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US'),
              new Date(receipt.createdAt).toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US'),
              receipt.receiptNumber,
              t(getReceiptTypeTranslationKey(receipt.type) as any),
              receipt.amount,
              receipt.paymentMethod === 'visa' ? t('closing.paymentMethods.visa') : receipt.paymentMethod === 'instapay' ? t('closing.paymentMethods.instapay') : receipt.paymentMethod === 'wallet' ? t('closing.paymentMethods.wallet') : receipt.paymentMethod === 'points' ? t('closing.paymentMethods.points') : t('closing.paymentMethods.cash'),
              detailsText
            ])
            row.alignment = { horizontal: direction === 'rtl' ? 'right' : 'left', vertical: 'middle' }
            row.font = { name: 'Arial', size: 10 }
          })
        })

        receiptsSheet.columns = [
          { width: 15 },
          { width: 12 },
          { width: 15 },
          { width: 18 },
          { width: 12 },
          { width: 15 },
          { width: 35 }
        ]
      }

      if (dailyData.some(day => day.expensesList.length > 0)) {
        const expensesSheet = workbook.addWorksheet(t('closing.excel.expensesSheet'), {
          views: [{ rightToLeft: direction === 'rtl' }]
        })

        const expensesHeader = expensesSheet.addRow([
          t('closing.expenses.date'), t('closing.expenses.time'), t('closing.expenses.type'), t('closing.expenses.description'), t('closing.expenses.staff'), t('closing.expenses.amount'), t('closing.expenses.status')
        ])
        expensesHeader.font = { bold: true, size: 12, name: 'Arial' }
        expensesHeader.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFA07A' }
        }
        expensesHeader.alignment = { horizontal: 'center', vertical: 'middle' }
        expensesHeader.height = 25

        dailyData.forEach(day => {
          day.expensesList.forEach((expense: any) => {
            const row = expensesSheet.addRow([
              new Date(expense.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US'),
              new Date(expense.createdAt).toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US'),
              expense.type === 'gym_expense' ? t('closing.expenses.gymExpense') : expense.type === 'staff_salary' ? t('closing.expenses.staffSalary') : t('closing.expenses.staffLoan'),
              expense.description,
              expense.staff ? expense.staff.name : '-',
              expense.amount,
              expense.type === 'staff_loan' ? (expense.isPaid ? t('closing.expenses.paid') : t('closing.expenses.unpaid')) : '-'
            ])
            row.alignment = { horizontal: direction === 'rtl' ? 'right' : 'left', vertical: 'middle' }
            row.font = { name: 'Arial', size: 10 }
          })
        })

        expensesSheet.columns = [
          { width: 15 },
          { width: 12 },
          { width: 15 },
          { width: 35 },
          { width: 18 },
          { width: 12 },
          { width: 15 }
        ]
      }

      let fileName = 'تقفيل_مالي'
      if (viewMode === 'daily') {
        fileName += `_${selectedDay}`
      } else {
        fileName += `_${selectedMonth}`
      }
      fileName += '.xlsx'

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      link.click()
      window.URL.revokeObjectURL(url)


    } catch (error) {
      console.error('خطأ في التصدير:', error)
      // يمكن استخدام toast هنا إذا تم إضافة ToastContext
      console.error(t('closing.excel.error'))
    }
  }

  const toggleDayDetails = (date: string) => {
    setExpandedDay(expandedDay === date ? null : date)
  }

  const getTypeLabel = (type: string) => {
    const translationKey = getReceiptTypeTranslationKey(type)
    return t(translationKey as any) || type
  }

  const renderMethodIcon = (m: string) => {
    if (m === 'visa') return IconCard
    if (m === 'instapay') return IconPhone
    if (m === 'wallet') return IconWallet
    if (m === 'points') return IconTrophy
    return IconCash
  }

  const getPaymentMethodLabel = (method: string, amount?: number) => {
    if (isMultiPayment(method)) {
      const normalized = normalizePaymentMethod(method, amount || 0)
      return (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold text-primary-700 dark:text-primary-400 inline-flex items-center gap-1">
            {IconShuffle}
            <span className="inline-flex items-center gap-0.5">
              {normalized.methods.map((m, i) => <span key={i}>{renderMethodIcon(m.method)}</span>)}
            </span>
          </span>
          {normalized.methods.map((m, idx) => {
            const methodLabels: { [key: string]: string } = {
              'cash': t('closing.paymentMethods.cash'),
              'visa': t('closing.paymentMethods.visa'),
              'instapay': t('closing.paymentMethods.instapay'),
              'wallet': t('closing.paymentMethods.wallet'),
              'points': t('closing.paymentMethods.points')
            }
            return (
              <span key={idx} className="text-xs whitespace-nowrap">
                {methodLabels[m.method]}: {m.amount.toFixed(0)}
              </span>
            )
          })}
        </div>
      )
    }

    const labels: { [key: string]: string } = {
      'cash': t('closing.paymentMethods.cash'),
      'visa': t('closing.paymentMethods.visa'),
      'instapay': t('closing.paymentMethods.instapay'),
      'wallet': t('closing.paymentMethods.wallet'),
      'points': t('closing.paymentMethods.points')
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        {renderMethodIcon(method)}
        <span>{labels[method] || t('closing.paymentMethods.cash')}</span>
      </span>
    )
  }

  // التحقق من صلاحية الوصول — مفتوحة لو canAccessClosing أو canCloseDayOnly
  const hasFullClosing = hasPermission('canAccessClosing')
  const hasDayOnly = hasPermission('canCloseDayOnly')
  if (!permissionsLoading && !hasFullClosing && !hasDayOnly) {
    return <PermissionDenied message="ليس لديك صلاحية الوصول لصفحة الإقفال" />
  }

  // 📅 لو معاه canCloseDayOnly بس (مش canAccessClosing) — حصره على daily mode فقط
  const restrictedToDayOnly = hasDayOnly && !hasFullClosing
  // 🔧 helpers لـ التواريخ
  const formatDate = (d: Date) => d.toISOString().split('T')[0]
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const todayStr = formatDate(today)
  const yesterdayStr = formatDate(yesterday)
  const tomorrowStr = formatDate(tomorrow)

  return (
    <div className="container mx-auto p-3 sm:p-4 md:p-6" dir={direction}>
      <div className="mb-4 sm:mb-6 no-print">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <svg className="w-7 h-7 text-primary-500" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 14l3-3 4 4 5-5"/></svg>
          <span>{t('closing.title')}</span>
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('closing.subtitle')}</p>

        {/* 📅 صلاحية اليوم — أزرار سريعة لـ تقفيل أمس/اليوم/غدا */}
        <div className="mt-3 sm:mt-4 flex flex-wrap gap-1.5 sm:gap-2">
          <button
            onClick={() => { setViewMode('daily'); setSelectedDay(yesterdayStr) }}
            aria-current={viewMode === 'daily' && selectedDay === yesterdayStr ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 px-3 sm:px-4 md:px-6 py-2 sm:py-3 rounded-lg font-bold transition-colors duration-200 text-xs sm:text-sm md:text-base ${
              viewMode === 'daily' && selectedDay === yesterdayStr
                ? 'bg-amber-500 text-white shadow-md'
                : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ring-1 ring-amber-300 dark:ring-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50'
            }`}
          >
            <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            تقفيل أمس
          </button>
          <button
            onClick={() => { setViewMode('daily'); setSelectedDay(todayStr) }}
            aria-current={viewMode === 'daily' && selectedDay === todayStr ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 px-3 sm:px-4 md:px-6 py-2 sm:py-3 rounded-lg font-bold transition-colors duration-200 text-xs sm:text-sm md:text-base ${
              viewMode === 'daily' && selectedDay === todayStr
                ? 'bg-emerald-500 text-white shadow-md'
                : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-300 dark:ring-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
            }`}
          >
            <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            تقفيل اليوم
          </button>
          <button
            onClick={() => { setViewMode('daily'); setSelectedDay(tomorrowStr) }}
            aria-current={viewMode === 'daily' && selectedDay === tomorrowStr ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 px-3 sm:px-4 md:px-6 py-2 sm:py-3 rounded-lg font-bold transition-colors duration-200 text-xs sm:text-sm md:text-base ${
              viewMode === 'daily' && selectedDay === tomorrowStr
                ? 'bg-sky-500 text-white shadow-md'
                : 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 ring-1 ring-sky-300 dark:ring-sky-700 hover:bg-sky-100 dark:hover:bg-sky-900/50'
            }`}
          >
            <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
            تقفيل غدا
          </button>
        </div>

        {/* View Mode Tabs — يختفي لو اليوزر معاه canCloseDayOnly فقط */}
        {!restrictedToDayOnly && (
        <div className="mt-3 sm:mt-4 flex flex-wrap gap-1.5 sm:gap-2">
          <button
            onClick={() => setViewMode('daily')}
            aria-current={viewMode === 'daily' ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 px-3 sm:px-4 md:px-6 py-2 sm:py-3 rounded-lg font-bold transition-colors duration-200 text-xs sm:text-sm md:text-base ${
              viewMode === 'daily'
                ? 'bg-primary-500 text-primary-contrast'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            {t('closing.viewMode.daily')}
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            aria-current={viewMode === 'monthly' ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 px-3 sm:px-4 md:px-6 py-2 sm:py-3 rounded-lg font-bold transition-colors duration-200 text-xs sm:text-sm md:text-base ${
              viewMode === 'monthly'
                ? 'bg-primary-500 text-primary-contrast'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M3 12h18M3 19h18"/></svg>
            {t('closing.viewMode.monthly')}
          </button>
          <button
            onClick={() => setViewMode('yearly')}
            aria-current={viewMode === 'yearly' ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 px-3 sm:px-4 md:px-6 py-2 sm:py-3 rounded-lg font-bold transition-colors duration-200 text-xs sm:text-sm md:text-base ${
              viewMode === 'yearly'
                ? 'bg-primary-500 text-primary-contrast'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
            {t('closing.viewMode.yearly')}
          </button>
          <button
            onClick={() => setViewMode('comparison')}
            aria-current={viewMode === 'comparison' ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 px-3 sm:px-4 md:px-6 py-2 sm:py-3 rounded-lg font-bold transition-colors duration-200 text-xs sm:text-sm md:text-base ${
              viewMode === 'comparison'
                ? 'bg-primary-500 text-primary-contrast'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6m0 13l-3-3m3 3l3-3m6 3V10m0 9l3-3m-3 3l-3-3"/></svg>
            {t('closing.viewMode.comparison')}
          </button>
        </div>
        )}
      </div>

      {/* Controls */}
      <div className="mb-4 sm:mb-6 no-print">
        <div className="space-y-3 sm:space-y-4">
          {viewMode === 'daily' ? (
            /* اختيار اليوم للعرض اليومي */
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-primary-500 to-primary-600 dark:from-primary-700 dark:to-primary-800 px-4 py-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      const d = new Date(selectedDay)
                      d.setDate(d.getDate() - 1)
                      setSelectedDay(d.toISOString().split('T')[0])
                    }}
                    aria-label={direction === 'rtl' ? 'التالي' : 'Previous'}
                    className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors duration-200"
                  >
                    {direction === 'rtl' ? IconChevronRightSvg : IconChevronLeftSvg}
                  </button>
                  <div className="text-center text-white">
                    <p className="text-lg sm:text-xl font-bold">
                      {new Date(selectedDay).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const d = new Date(selectedDay)
                      d.setDate(d.getDate() + 1)
                      setSelectedDay(d.toISOString().split('T')[0])
                    }}
                    aria-label={direction === 'rtl' ? 'السابق' : 'Next'}
                    className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors duration-200"
                  >
                    {direction === 'rtl' ? IconChevronLeftSvg : IconChevronRightSvg}
                  </button>
                </div>
              </div>
              <div className="p-3 flex items-center justify-center gap-2">
                <input
                  type="date"
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
                />
                <button
                  onClick={() => setSelectedDay(new Date().toISOString().split('T')[0])}
                  className="px-3 py-1.5 text-sm bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors duration-200 font-bold"
                >
                  {t('time.today')}
                </button>
              </div>
            </div>
          ) : viewMode === 'monthly' ? (
            /* اختيار الشهر للعرض الشهري */
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-primary-500 to-primary-600 dark:from-primary-700 dark:to-primary-800 px-4 py-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      const [y, m] = selectedMonth.split('-').map(Number)
                      // الشهر اللي قبله — نستخدم getFullYear/getMonth بدل toISOString
                      // عشان توقيت القاهرة UTC+2/+3 كان بيرجّع اليوم لـ UTC ويدّينا شهر غلط
                      const d = new Date(y, m - 2, 1)
                      setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
                    }}
                    aria-label={direction === 'rtl' ? 'التالي' : 'Previous'}
                    className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors duration-200"
                  >
                    {direction === 'rtl' ? IconChevronRightSvg : IconChevronLeftSvg}
                  </button>
                  <div className="text-center text-white">
                    <p className="text-lg sm:text-xl font-bold">
                      {new Date(selectedMonth + '-01').toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', {
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const [y, m] = selectedMonth.split('-').map(Number)
                      const d = new Date(y, m, 1)
                      setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
                    }}
                    aria-label={direction === 'rtl' ? 'السابق' : 'Next'}
                    className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors duration-200"
                  >
                    {direction === 'rtl' ? IconChevronLeftSvg : IconChevronRightSvg}
                  </button>
                </div>
              </div>
              <div className="p-3 flex items-center justify-center gap-2">
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
                />
                <button
                  onClick={() => setSelectedMonth(new Date().toISOString().slice(0, 7))}
                  className="px-3 py-1.5 text-sm bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors duration-200 font-bold"
                >
                  {t('time.thisMonth')}
                </button>
              </div>
            </div>
          ) : viewMode === 'yearly' ? (
            /* اختيار السنة للعرض السنوي */
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-primary-500 to-primary-600 dark:from-primary-700 dark:to-primary-800 px-4 py-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setSelectedYear((parseInt(selectedYear) - 1).toString())}
                    aria-label={direction === 'rtl' ? 'التالي' : 'Previous'}
                    className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors duration-200"
                  >
                    {direction === 'rtl' ? IconChevronRightSvg : IconChevronLeftSvg}
                  </button>
                  <div className="text-center text-white">
                    <p className="text-lg sm:text-xl font-bold">{selectedYear}</p>
                  </div>
                  <button
                    onClick={() => setSelectedYear((parseInt(selectedYear) + 1).toString())}
                    aria-label={direction === 'rtl' ? 'السابق' : 'Next'}
                    className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors duration-200"
                  >
                    {direction === 'rtl' ? IconChevronLeftSvg : IconChevronRightSvg}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* اختيار فترة المقارنة */
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-primary-500 to-primary-600 dark:from-primary-700 dark:to-primary-800 px-4 py-3">
                <p className="text-center text-white text-lg sm:text-xl font-bold inline-flex items-center justify-center gap-2 w-full">{IconChartBar}<span>{t('closing.viewMode.comparison')}</span></p>
              </div>
              <div className="p-3 sm:p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium mb-2 dark:text-gray-200">{t('closing.comparison.startMonth')}</label>
                    <input
                      type="month"
                      value={comparisonStartMonth}
                      onChange={(e) => setComparisonStartMonth(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-lg text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium mb-2 dark:text-gray-200">{t('closing.comparison.endMonth')}</label>
                    <input
                      type="month"
                      value={comparisonEndMonth}
                      onChange={(e) => setComparisonEndMonth(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-lg text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                  {t('closing.comparison.periodInfo', {
                    start: new Date(comparisonStartMonth + '-01').toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' }),
                    end: new Date(comparisonEndMonth + '-01').toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' }),
                    count: monthlyComparison.length.toString()
                  })}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 md:px-6 py-2 rounded-lg transition-colors duration-200 text-xs sm:text-sm md:text-base font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
            >
              {IconPrint}
              <span className="hidden sm:inline">{t('closing.buttons.print')}</span>
            </button>
            {user?.role === 'OWNER' && (
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-primary-contrast px-3 sm:px-4 md:px-6 py-2 rounded-lg transition-colors duration-200 text-xs sm:text-sm md:text-base font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
            >
              {IconExport}
              <span className="hidden sm:inline">{t('closing.buttons.export')}</span>
            </button>
            )}
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-primary-contrast px-3 sm:px-4 md:px-6 py-2 rounded-lg transition-colors duration-200 text-xs sm:text-sm md:text-base font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
            >
              {IconRefresh}
              <span className="hidden sm:inline">{t('closing.buttons.refresh')}</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingScreen message={t('closing.loading')} />
      ) : (
        <>
          {/* Header للطباعة */}
          <div className="text-center mb-6 print-only" style={{ display: 'none' }}>
            <h1 className="text-3xl font-bold mb-2">X - GYM</h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              {viewMode === 'daily'
                ? `${t('closing.viewMode.daily')} - ${new Date(selectedDay).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`
                : `${t('closing.viewMode.monthly')} - ${new Date(selectedMonth + '-01').toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' })}`
              }
            </p>
          </div>

          {/* Comparison View */}
          {viewMode === 'comparison' ? (
            <div className="space-y-6">
              {/* Summary Cards for Comparison */}
              {monthlyComparison.length > 0 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    <div className="bg-gradient-to-br from-red-500 to-red-600 dark:from-red-700 dark:to-red-800 text-white p-4 sm:p-5 md:p-6 rounded-xl shadow-sm transition-colors duration-200">
                      <p className="text-xs sm:text-sm uppercase tracking-wider opacity-90 font-bold">{t('closing.comparison.totalExpenses')}</p>
                      <p className="text-2xl sm:text-3xl font-bold mt-1">
                        {monthlyComparison.reduce((sum, m) => sum + m.totalExpenses, 0).toFixed(0)}
                      </p>
                      <p className="text-[10px] sm:text-xs opacity-75 mt-2">
                        {t('closing.comparison.average')}: {(monthlyComparison.reduce((sum, m) => sum + m.totalExpenses, 0) / monthlyComparison.length).toFixed(0)}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-green-500 to-green-600 dark:from-green-700 dark:to-green-800 text-white p-4 sm:p-5 md:p-6 rounded-xl shadow-sm transition-colors duration-200">
                      <p className="text-xs sm:text-sm uppercase tracking-wider opacity-90 font-bold">{t('closing.comparison.totalNetProfit')}</p>
                      <p className="text-2xl sm:text-3xl font-bold mt-1">
                        {monthlyComparison.reduce((sum, m) => sum + m.netProfit, 0).toFixed(0)}
                      </p>
                      <p className="text-[10px] sm:text-xs opacity-75 mt-2">
                        {t('closing.comparison.average')}: {(monthlyComparison.reduce((sum, m) => sum + m.netProfit, 0) / monthlyComparison.length).toFixed(0)}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-700 dark:to-primary-800 text-primary-contrast dark:text-primary-contrast p-4 sm:p-5 md:p-6 rounded-xl shadow-sm transition-colors duration-200">
                      <p className="text-xs sm:text-sm uppercase tracking-wider opacity-90 font-bold">{t('closing.comparison.totalSubscriptions')}</p>
                      <p className="text-2xl sm:text-3xl font-bold mt-1">
                        {monthlyComparison.reduce((sum, m) => sum + m.totalSubscriptions, 0)}
                      </p>
                      <p className="text-[10px] sm:text-xs opacity-75 mt-2">
                        {t('closing.comparison.average')}: {(monthlyComparison.reduce((sum, m) => sum + m.totalSubscriptions, 0) / monthlyComparison.length).toFixed(0)}
                      </p>
                    </div>
                  </div>

                  <ClosingCharts monthlyComparison={monthlyComparison} />

                  {/* Detailed Comparison Table */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-x-auto ring-1 ring-gray-200 dark:ring-gray-700 transition-colors duration-200">
                    <h3 className="text-lg font-bold p-5 border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">{t('closing.comparison.detailedTable')}</h3>
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-900/40">
                        <tr className="text-gray-700 dark:text-gray-300 uppercase text-xs">
                          <th className="px-2 sm:px-4 py-3 text-start font-bold">{t('closing.comparison.month')}</th>
                          <th className="px-2 sm:px-4 py-3 text-start font-bold">{t('closing.comparison.floorRevenue')}</th>
                          <th className="px-2 sm:px-4 py-3 text-start font-bold">{t('closing.comparison.ptRevenue')}</th>
                          <th className="px-2 sm:px-4 py-3 text-start font-bold">{t('closing.comparison.expenses')}</th>
                          <th className="px-2 sm:px-4 py-3 text-start font-bold">{t('closing.comparison.netProfit')}</th>
                          <th className="px-2 sm:px-4 py-3 text-center font-bold">{t('closing.comparison.subscriptions')}</th>
                          <th className="px-2 sm:px-4 py-3 text-center font-bold">{t('closing.comparison.growth')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                        {monthlyComparison.map((month, index) => {
                          const prevMonth = index > 0 ? monthlyComparison[index - 1] : null
                          const growthPercent = prevMonth ? ((month.netProfit - prevMonth.netProfit) / prevMonth.netProfit * 100) : 0

                          return (
                            <tr key={month.month} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors duration-200">
                              <td className="px-2 sm:px-4 py-3 font-bold text-gray-900 dark:text-gray-100">{month.monthName}</td>
                              <td className="px-2 sm:px-4 py-3 text-start font-bold text-primary-700 dark:text-primary-400">
                                {month.floorRevenue.toFixed(0)}
                              </td>
                              <td className="px-2 sm:px-4 py-3 text-start font-bold text-green-700 dark:text-green-400">
                                {month.ptRevenue.toFixed(0)}
                              </td>
                              <td className="px-2 sm:px-4 py-3 text-start font-bold text-red-700 dark:text-red-400">
                                {month.totalExpenses.toFixed(0)}
                              </td>
                              <td className="px-2 sm:px-4 py-3 text-start font-bold text-green-700 dark:text-green-400 text-lg">
                                {month.netProfit.toFixed(0)}
                              </td>
                              <td className="px-2 sm:px-4 py-3 text-center font-bold text-primary-700 dark:text-primary-400">
                                {month.totalSubscriptions}
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-normal">
                                  {t('closing.comparison.members')}: {month.memberSubscriptions} | PT: {month.ptSubscriptions}
                                </div>
                              </td>
                              <td className="px-2 sm:px-4 py-3 text-center">
                                {prevMonth ? (
                                  <span className={`inline-flex items-center gap-1 font-bold ${growthPercent >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                    {growthPercent >= 0 ? IconArrowUp : IconArrowDown}
                                    <span>{Math.abs(growthPercent).toFixed(1)}%</span>
                                  </span>
                                ) : (
                                  <span className="text-gray-400 dark:text-gray-500">-</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-primary-100 dark:bg-primary-900/40 font-bold border-t border-gray-200 dark:border-gray-700">
                          <td className="px-2 sm:px-4 py-3 text-start text-gray-900 dark:text-gray-100">{t('closing.comparison.total')}</td>
                          <td className="px-2 sm:px-4 py-3 text-start text-primary-700 dark:text-primary-400">
                            {monthlyComparison.reduce((sum, m) => sum + m.floorRevenue, 0).toFixed(0)}
                          </td>
                          <td className="px-2 sm:px-4 py-3 text-start text-green-700 dark:text-green-400">
                            {monthlyComparison.reduce((sum, m) => sum + m.ptRevenue, 0).toFixed(0)}
                          </td>
                          <td className="px-2 sm:px-4 py-3 text-start text-red-700 dark:text-red-400">
                            {monthlyComparison.reduce((sum, m) => sum + m.totalExpenses, 0).toFixed(0)}
                          </td>
                          <td className="px-2 sm:px-4 py-3 text-start text-green-700 dark:text-green-400 text-lg">
                            {monthlyComparison.reduce((sum, m) => sum + m.netProfit, 0).toFixed(0)}
                          </td>
                          <td className="px-2 sm:px-4 py-3 text-center text-primary-700 dark:text-primary-400">
                            {monthlyComparison.reduce((sum, m) => sum + m.totalSubscriptions, 0)}
                          </td>
                          <td className="px-2 sm:px-4 py-3"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Performance Insights */}
                  <div className="bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-700 dark:to-primary-800 text-primary-contrast dark:text-primary-contrast p-5 sm:p-6 rounded-xl shadow-sm transition-colors duration-200">
                    <h3 className="text-lg font-bold mb-4">{t('closing.comparison.insights')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {monthlyComparison.length > 0 && (
                        <>
                          <div className="bg-white/20 dark:bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm transition-colors duration-200">
                            <p className="text-xs uppercase tracking-wider font-bold opacity-90">{t('closing.comparison.bestMonth')}</p>
                            <p className="text-2xl font-bold mt-2">
                              {monthlyComparison.reduce((best, m) => m.netProfit > best.netProfit ? m : best).monthName}
                            </p>
                            <p className="text-sm opacity-75 mt-1">
                              {monthlyComparison.reduce((best, m) => m.netProfit > best.netProfit ? m : best).netProfit.toFixed(0)} {t('closing.currency')}
                            </p>
                          </div>
                          <div className="bg-white/20 dark:bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm transition-colors duration-200">
                            <p className="text-xs uppercase tracking-wider font-bold opacity-90">{t('closing.comparison.worstMonth')}</p>
                            <p className="text-2xl font-bold mt-2">
                              {monthlyComparison.reduce((worst, m) => m.netProfit < worst.netProfit ? m : worst).monthName}
                            </p>
                            <p className="text-sm opacity-75 mt-1">
                              {monthlyComparison.reduce((worst, m) => m.netProfit < worst.netProfit ? m : worst).netProfit.toFixed(0)} {t('closing.currency')}
                            </p>
                          </div>
                          <div className="bg-white/20 dark:bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm transition-colors duration-200">
                            <p className="text-xs uppercase tracking-wider font-bold opacity-90">{t('closing.comparison.trend')}</p>
                            <p className="text-2xl font-bold mt-2 inline-flex items-center gap-2">
                              {monthlyComparison.length > 1 &&
                                monthlyComparison[monthlyComparison.length - 1].netProfit > monthlyComparison[0].netProfit
                                ? <>{IconTrendUp}<span>{t('closing.comparison.growing')}</span></>
                                : monthlyComparison[monthlyComparison.length - 1].netProfit < monthlyComparison[0].netProfit
                                ? <>{IconTrendDown}<span>{t('closing.comparison.declining')}</span></>
                                : <>{IconTrendFlat}<span>{t('closing.comparison.stable')}</span></>
                              }
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}

              {monthlyComparison.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
                  {IconEmptyBox}
                  <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">{t('closing.comparison.noData')}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('closing.comparison.selectPeriod')}</p>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Summary Cards - hidden in daily view */}
              {viewMode !== 'daily' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6 no-print">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-5">
              <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('closing.stats.totalExpenses')}</div>
              <div className="mt-1 text-xl sm:text-2xl md:text-3xl font-bold text-red-600 dark:text-red-400">{totals.expenses.toFixed(0)}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-5">
              <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('closing.stats.netProfit')}</div>
              <div className="mt-1 text-xl sm:text-2xl md:text-3xl font-bold text-primary-700 dark:text-primary-400">{totals.netProfit.toFixed(0)}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-5">
              <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('closing.stats.totalPayments')}</div>
              <div className="mt-1 text-xl sm:text-2xl md:text-3xl font-bold text-amber-600 dark:text-amber-400">{totals.totalPayments.toFixed(0)}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-5">
              <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('closing.stats.dailyAverage')}</div>
              <div className="mt-1 text-xl sm:text-2xl md:text-3xl font-bold text-orange-600 dark:text-orange-400">
                {dailyData.length > 0 ? (totals.totalPayments / dailyData.length).toFixed(0) : 0}
              </div>
            </div>
          </div>
              )}

          {/*  Daily view: Total Income + Net cards */}
          {viewMode === 'daily' && dailyData.length > 0 && (() => {
            const dayTotalIncome = dailyData.reduce(
              (s, d) => s + d.floor + d.pt + (d.nutrition || 0) + (d.physiotherapy || 0),
              0
            )
            const dayExpenses = dailyData.reduce((s, d) => s + (d.expenses || 0), 0)
            const dayNet = dayTotalIncome - dayExpenses
            return (
              <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6 no-print">
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/30 dark:to-emerald-900/10 rounded-xl shadow-sm ring-1 ring-emerald-200 dark:ring-emerald-700/50 p-4 sm:p-5">
                  <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    {t('closing.stats.totalIncome') !== 'closing.stats.totalIncome' ? t('closing.stats.totalIncome') : (direction === 'rtl' ? 'إجمالي الدخل' : 'Total Income')}
                  </div>
                  <div className="mt-1 text-xl sm:text-2xl md:text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                    {dayTotalIncome.toFixed(0)}
                    <span className="text-xs sm:text-sm font-medium text-emerald-600/80 dark:text-emerald-400/80 ms-1">{t('closing.currency')}</span>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-primary-50 to-primary-100/50 dark:from-primary-900/30 dark:to-primary-900/10 rounded-xl shadow-sm ring-1 ring-primary-200 dark:ring-primary-700/50 p-4 sm:p-5">
                  <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300">
                    {t('closing.stats.netProfit')}
                  </div>
                  <div className={`mt-1 text-xl sm:text-2xl md:text-3xl font-bold ${dayNet >= 0 ? 'text-primary-700 dark:text-primary-300' : 'text-red-600 dark:text-red-400'}`}>
                    {dayNet.toFixed(0)}
                    <span className={`text-xs sm:text-sm font-medium ms-1 ${dayNet >= 0 ? 'text-primary-600/80 dark:text-primary-400/80' : 'text-red-500/80 dark:text-red-400/80'}`}>{t('closing.currency')}</span>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Payment Methods Summary - hidden in daily view */}
          {viewMode !== 'daily' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6 no-print">
            <div className="bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 p-4 rounded-xl shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('closing.paymentMethods.cash')}</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-green-700 dark:text-green-400 mt-1">{totals.cash.toFixed(0)}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center justify-center flex-shrink-0">
                  {IconCash}
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 p-4 rounded-xl shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('closing.paymentMethods.visa')}</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-primary-700 dark:text-primary-400 mt-1">{totals.visa.toFixed(0)}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                  {IconCard}
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 p-4 rounded-xl shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('closing.paymentMethods.instapay')}</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-primary-700 dark:text-primary-400 mt-1">{totals.instapay.toFixed(0)}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                  {IconPhone}
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 p-4 rounded-xl shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('closing.paymentMethods.wallet')}</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-orange-700 dark:text-orange-400 mt-1">{totals.wallet.toFixed(0)}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 flex items-center justify-center flex-shrink-0">
                  {IconWallet}
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 p-4 rounded-xl shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('closing.paymentMethods.points')}</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{totals.points.toFixed(0)}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t('closing.pointsValueLabel')}: {(totals.points * pointsValueInEGP).toFixed(2)} {t('common.egp')}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                  {IconTrophy}
                </div>
              </div>
            </div>
          </div>
          )}

            </>
          )}

          {/* Excel-like Table */}
          {viewMode !== 'comparison' && (
            <>
              <div className="bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-900/50 rounded-lg p-2 sm:p-3 mb-3 sm:mb-4 lg:hidden">
                <p className="text-xs sm:text-sm text-primary-800 dark:text-primary-300 flex items-center gap-2">
                  <svg className="w-4 h-4" {...stroke} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h13M3 12l4-4m0 8l-4-4"/></svg>
                  <span>{direction === 'rtl' ? 'اسحب الجدول يميناً ويساراً لرؤية جميع البيانات' : 'Scroll the table horizontally to see all data'}</span>
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-x-auto mb-4 sm:mb-6 ring-1 ring-gray-200 dark:ring-gray-700">
              {viewMode === 'daily' ? (
              /* عرض تفاصيل اليوم المحدد مباشرة */
              dailyData.length > 0 ? (
                <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
                  {dailyData.map((day) => (
                    <div key={day.date} className="space-y-3 sm:space-y-4">
                      {/* معلومات اليوم */}
                      <div className="bg-gradient-to-r from-primary-500 to-primary-600 dark:from-primary-700 dark:to-primary-800 text-primary-contrast dark:text-primary-contrast p-3 sm:p-4 rounded-xl shadow-sm">
                        <h2 className="text-sm sm:text-xl md:text-2xl font-bold mb-2 inline-flex items-start gap-2 break-words text-gray-900 dark:text-white">
                          <span className="shrink-0 mt-0.5">{IconCalendar}</span>
                          <span>{new Date(day.date).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}</span>
                        </h2>
                        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-3 sm:mt-4">
                          <div className="bg-white/30 dark:bg-white/10 p-2.5 sm:p-3 rounded-lg">
                            <p className="text-[11px] sm:text-sm text-gray-900/80 dark:text-white/80">{t('closing.table.floor')}</p>
                            <p className="text-base sm:text-xl font-bold text-gray-900 dark:text-white">{day.floor > 0 ? day.floor.toFixed(0) : '0'} <span className="text-xs sm:text-sm font-medium text-gray-900/70 dark:text-white/70">{t('closing.currency')}</span></p>
                          </div>
                          <div className="bg-white/30 dark:bg-white/10 p-2.5 sm:p-3 rounded-lg">
                            <p className="text-[11px] sm:text-sm text-gray-900/80 dark:text-white/80">{t('closing.table.pt')}</p>
                            <p className="text-base sm:text-xl font-bold text-gray-900 dark:text-white">{day.pt > 0 ? day.pt.toFixed(0) : '0'} <span className="text-xs sm:text-sm font-medium text-gray-900/70 dark:text-white/70">{t('closing.currency')}</span></p>
                          </div>
                          <div className="bg-white/30 dark:bg-white/10 p-2.5 sm:p-3 rounded-lg">
                            <p className="text-[11px] sm:text-sm text-gray-900/80 dark:text-white/80">{t('closing.table.expenses')}</p>
                            <p className="text-base sm:text-xl font-bold text-gray-900 dark:text-white">{day.expenses > 0 ? day.expenses.toFixed(0) : '0'} <span className="text-xs sm:text-sm font-medium text-gray-900/70 dark:text-white/70">{t('closing.currency')}</span></p>
                          </div>
                        </div>
                      </div>

                      {/* طرق الدفع */}
                      <div className="bg-gray-50 dark:bg-gray-900/40 p-3 sm:p-4 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700">
                        <h3 className="font-bold text-base sm:text-lg mb-3 text-gray-900 dark:text-gray-100 inline-flex items-center gap-2">{IconCard}<span>{t('closing.paymentMethods.title')}</span></h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3">
                          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg ring-1 ring-green-200 dark:ring-green-900/50">
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 inline-flex items-center gap-1.5">{IconCash}<span>{t('closing.paymentMethods.cash')}</span></p>
                            <p className="text-lg font-bold text-green-700 dark:text-green-400 mt-1">{day.cash > 0 ? day.cash.toFixed(0) : '0'}</p>
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                              <p className="text-xs text-gray-500 dark:text-gray-400">{t('closing.paymentMethods.netCash')}</p>
                              <p className="text-sm font-bold text-orange-600 dark:text-orange-400">{(day.cash - day.expenses).toFixed(0)} {t('closing.currency')}</p>
                            </div>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg ring-1 ring-primary-200 dark:ring-primary-900/50">
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 inline-flex items-center gap-1.5">{IconCard}<span>{t('closing.paymentMethods.visa')}</span></p>
                            <p className="text-lg font-bold text-primary-700 dark:text-primary-400 mt-1">{day.visa > 0 ? day.visa.toFixed(0) : '0'}</p>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg ring-1 ring-primary-200 dark:ring-primary-900/50">
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 inline-flex items-center gap-1.5">{IconPhone}<span>{t('closing.paymentMethods.instapay')}</span></p>
                            <p className="text-lg font-bold text-primary-700 dark:text-primary-400 mt-1">{day.instapay > 0 ? day.instapay.toFixed(0) : '0'}</p>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg ring-1 ring-orange-200 dark:ring-orange-900/50">
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 inline-flex items-center gap-1.5">{IconWallet}<span>{t('closing.paymentMethods.wallet')}</span></p>
                            <p className="text-lg font-bold text-orange-700 dark:text-orange-400 mt-1">{day.wallet > 0 ? day.wallet.toFixed(0) : '0'}</p>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg ring-1 ring-amber-200 dark:ring-amber-900/50">
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 inline-flex items-center gap-1.5">{IconTrophy}<span>{t('closing.paymentMethods.points')}</span></p>
                            <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">{day.points > 0 ? day.points.toFixed(0) : '0'}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {t('closing.pointsValueLabel')}: {(day.points * pointsValueInEGP).toFixed(2)} {t('common.egp')}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* السلف */}
                      {Object.keys(day.staffLoans).length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl ring-1 ring-amber-200 dark:ring-amber-900/50">
                          <h3 className="font-bold text-lg mb-3 text-gray-900 dark:text-gray-100 inline-flex items-center gap-2">{IconWallet}<span>{t('closing.staffLoans.title')}</span></h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {Object.entries(day.staffLoans).map(([staffName, amount]) => (
                              <div key={staffName} className="bg-white dark:bg-gray-800 p-3 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700">
                                <p className="text-sm text-gray-600 dark:text-gray-400">{staffName}</p>
                                <p className="text-lg font-bold text-red-700 dark:text-red-400">{amount.toFixed(0)} {t('closing.currency')}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* الإيصالات */}
                      {day.receipts.length > 0 ? (
                        <div>
                          <h4 className="font-bold text-base sm:text-lg mb-3 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                            {IconReceipt}
                            <span>{t('closing.receipts.count', { count: day.receipts.length.toString() })}</span>
                          </h4>

                          {/* Mobile cards (<md) */}
                          <div className="md:hidden space-y-2">
                            {day.receipts.map((receipt: any) => {
                              const details = JSON.parse(receipt.itemDetails)
                              return (
                                <div key={receipt.id} className="bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg p-3">
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold text-green-700 dark:text-green-400 text-sm">#{receipt.receiptNumber}</span>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                                          {getTypeLabel(receipt.type)}
                                        </span>
                                      </div>
                                      <p className="text-xs text-gray-700 dark:text-gray-300 mt-1.5 truncate">
                                        {details.memberName ? `${details.memberName}${details.memberNumber ? ` (#${details.memberNumber})` : ''}` : details.clientName || details.name || '-'}
                                      </p>
                                    </div>
                                    <div className="text-end shrink-0">
                                      <p className="font-bold text-green-700 dark:text-green-400 text-sm whitespace-nowrap">{receipt.amount} {t('closing.currency')}</p>
                                      <p className="font-mono text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                        {new Date(receipt.createdAt).toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400">{t('closing.receipts.paymentMethod')}:</p>
                                    <div className="mt-0.5 text-xs">{getPaymentMethodLabel(receipt.paymentMethod)}</div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          {/* Desktop table (≥md) */}
                          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl overflow-hidden ring-1 ring-gray-200 dark:ring-gray-700">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300 uppercase text-xs">
                                <tr>
                                  <th className="px-3 py-3 text-start font-bold">{t('closing.receipts.time')}</th>
                                  <th className="px-3 py-3 text-start font-bold">{t('closing.receipts.receiptNumber')}</th>
                                  <th className="px-3 py-3 text-start font-bold">{t('closing.receipts.type')}</th>
                                  <th className="px-3 py-3 text-start font-bold">{t('closing.receipts.details')}</th>
                                  <th className="px-3 py-3 text-start font-bold">{t('closing.receipts.amount')}</th>
                                  <th className="px-3 py-3 text-start font-bold">{t('closing.receipts.paymentMethod')}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                                {day.receipts.map((receipt: any) => {
                                  const details = JSON.parse(receipt.itemDetails)
                                  return (
                                    <tr key={receipt.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors duration-200">
                                      <td className="px-3 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                                        {new Date(receipt.createdAt).toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                                      </td>
                                      <td className="px-3 py-3 font-bold text-green-700 dark:text-green-400">
                                        #{receipt.receiptNumber}
                                      </td>
                                      <td className="px-3 py-3">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                                          {getTypeLabel(receipt.type)}
                                        </span>
                                      </td>
                                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                                        {details.memberName && (
                                          <div>
                                            {details.memberName}
                                            {details.memberNumber && (
                                              <span className="text-xs text-gray-500 dark:text-gray-400"> (#{details.memberNumber})</span>
                                            )}
                                          </div>
                                        )}
                                        {details.clientName && <div>{details.clientName}</div>}
                                        {details.name && <div>{details.name}</div>}
                                      </td>
                                      <td className="px-3 py-3 font-bold text-green-700 dark:text-green-400">
                                        {receipt.amount} {t('closing.currency')}
                                      </td>
                                      <td className="px-3 py-3">
                                        {getPaymentMethodLabel(receipt.paymentMethod)}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50 dark:bg-gray-900/40 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700">
                          {IconEmptyBox}
                          <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">{t('closing.receipts.noReceipts')}</h3>
                        </div>
                      )}

                      {/* المصروفات */}
                      {day.expensesList.length > 0 ? (
                        <div>
                          <h4 className="font-bold text-base sm:text-lg mb-3 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                            {IconExpense}
                            <span>{t('closing.expenses.count', { count: day.expensesList.length.toString() })}</span>
                          </h4>

                          {/* Mobile cards (<md) */}
                          <div className="md:hidden space-y-2">
                            {day.expensesList.map((expense: any) => (
                              <div key={expense.id} className="bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg p-3">
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        expense.type === 'gym_expense'
                                          ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                                          : expense.type === 'staff_salary'
                                          ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
                                          : 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                                      }`}>
                                        {expense.type === 'gym_expense' ? t('closing.expenses.gymExpense') : expense.type === 'staff_salary' ? t('closing.expenses.staffSalary') : t('closing.expenses.staffLoan')}
                                      </span>
                                      {expense.type === 'staff_loan' && (
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                          expense.isPaid
                                            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                                            : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                                        }`}>
                                          {expense.isPaid ? IconCheck : IconX}
                                          <span>{expense.isPaid ? t('closing.expenses.paid') : t('closing.expenses.unpaid')}</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-end shrink-0">
                                    <p className="font-bold text-red-700 dark:text-red-400 text-sm whitespace-nowrap">{expense.amount} {t('closing.currency')}</p>
                                    <p className="font-mono text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                      {new Date(expense.createdAt).toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                </div>
                                <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">{expense.description}</p>
                                {expense.staff && (
                                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                    <span>{t('closing.expenses.staff')}:</span>
                                    <span className="ms-1 text-gray-600 dark:text-gray-300 font-medium">{expense.staff.name}</span>
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Desktop table (≥md) */}
                          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl overflow-hidden ring-1 ring-gray-200 dark:ring-gray-700">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300 uppercase text-xs">
                                <tr>
                                  <th className="px-3 py-3 text-start font-bold">{t('closing.expenses.time')}</th>
                                  <th className="px-3 py-3 text-start font-bold">{t('closing.expenses.type')}</th>
                                  <th className="px-3 py-3 text-start font-bold">{t('closing.expenses.description')}</th>
                                  <th className="px-3 py-3 text-start font-bold">{t('closing.expenses.staff')}</th>
                                  <th className="px-3 py-3 text-start font-bold">{t('closing.expenses.amount')}</th>
                                  <th className="px-3 py-3 text-start font-bold">{t('closing.expenses.status')}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                                {day.expensesList.map((expense: any) => (
                                  <tr key={expense.id} className="hover:bg-red-50/40 dark:hover:bg-red-900/10 transition-colors duration-200">
                                    <td className="px-3 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                                      {new Date(expense.createdAt).toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                                    </td>
                                    <td className="px-3 py-3">
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                        expense.type === 'gym_expense'
                                          ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                                          : expense.type === 'staff_salary'
                                          ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
                                          : 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                                      }`}>
                                        {expense.type === 'gym_expense' ? t('closing.expenses.gymExpense') : expense.type === 'staff_salary' ? t('closing.expenses.staffSalary') : t('closing.expenses.staffLoan')}
                                      </span>
                                    </td>
                                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{expense.description}</td>
                                    <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                                      {expense.staff ? expense.staff.name : '-'}
                                    </td>
                                    <td className="px-3 py-3 font-bold text-red-700 dark:text-red-400">
                                      {expense.amount} {t('closing.currency')}
                                    </td>
                                    <td className="px-3 py-3">
                                      {expense.type === 'staff_loan' && (
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                          expense.isPaid
                                            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                                            : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                                        }`}>
                                          {expense.isPaid ? IconCheck : IconX}
                                          <span>{expense.isPaid ? t('closing.expenses.paid') : t('closing.expenses.unpaid')}</span>
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50 dark:bg-gray-900/40 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700">
                          {IconEmptyBox}
                          <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">{t('closing.expenses.noExpenses')}</h3>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
                  {IconEmptyBox}
                  <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">{t('closing.noData')}</h3>
                </div>
              )
            ) : (
              /* الجدول العادي للعرض الشهري */
            <table className="w-full text-sm excel-table">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300 uppercase text-xs">
                <tr>
                  <th className="px-3 py-3 text-center font-bold">{t('closing.table.date')}</th>
                  <th className="px-3 py-3 text-center font-bold">{t('closing.table.floor')}</th>
                  <th className="px-3 py-3 text-center font-bold">{direction === 'rtl' ? 'الفلوس الباقية' : 'Remaining'}</th>
                  <th className="px-3 py-3 text-center font-bold">{t('closing.table.pt')}</th>
                  {nutritionEnabled && <th className="px-3 py-3 text-center font-bold">{direction === 'rtl' ? 'تغذية' : 'Nutrition'}</th>}
                  {physiotherapyEnabled && <th className="px-3 py-3 text-center font-bold">{direction === 'rtl' ? 'علاج طبيعي' : 'Physio'}</th>}
                  <th className="px-3 py-3 text-center font-bold">{t('closing.table.cash')}</th>
                  <th className="px-3 py-3 text-center font-bold">{t('closing.table.visa')}</th>
                  <th className="px-3 py-3 text-center font-bold">{t('closing.table.instapay')}</th>
                  <th className="px-3 py-3 text-center font-bold">{t('closing.table.wallet')}</th>
                  <th className="px-3 py-3 text-center font-bold">{t('closing.table.points')}</th>
                  <th className="px-3 py-3 text-center font-bold bg-primary-50 dark:bg-primary-900/30">{t('closing.table.total')}</th>
                  <th className="px-3 py-3 text-center font-bold">{t('closing.table.expenses')}</th>
                  <th className="px-3 py-3 text-center font-bold min-w-[300px]">{t('closing.table.expenseDetails')}</th>
                  <th className="px-3 py-3 text-center font-bold">{t('closing.table.loans')}</th>
                  {(staffList || []).map(staff => (
                    <th key={staff.id} className="px-3 py-3 text-center font-bold min-w-[80px]">
                      {staff.name}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center font-bold no-print">{t('closing.table.details')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {dailyData.map((day, index) => (
                  <React.Fragment key={day.date}>
                    <tr
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors duration-200 cursor-pointer"
                      onClick={() => toggleDayDetails(day.date)}
                    >
                      <td className="px-3 py-3 text-center font-mono text-gray-700 dark:text-gray-300">
                        {new Date(day.date).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                      </td>
                      <td className="px-3 py-3 text-start font-bold text-primary-700 dark:text-primary-400">
                        {day.floor > 0 ? day.floor.toFixed(0) : '-'}
                      </td>
                      <td className="px-3 py-3 text-start font-bold text-red-700 dark:text-red-400">
                        {day.remainingAmount > 0 ? day.remainingAmount.toFixed(0) : '-'}
                      </td>
                      <td className="px-3 py-3 text-start font-bold text-green-700 dark:text-green-400">
                        {day.pt > 0 ? day.pt.toFixed(0) : '-'}
                      </td>
                      {nutritionEnabled && <td className="px-3 py-3 text-start font-bold text-lime-700 dark:text-lime-400">
                        {day.nutrition > 0 ? day.nutrition.toFixed(0) : '-'}
                      </td>}
                      {physiotherapyEnabled && <td className="px-3 py-3 text-start font-bold text-teal-700 dark:text-teal-400">
                        {day.physiotherapy > 0 ? day.physiotherapy.toFixed(0) : '-'}
                      </td>}
                      <td className="px-3 py-3 text-start font-bold text-green-700 dark:text-green-400">
                        {day.cash > 0 ? day.cash.toFixed(0) : '-'}
                      </td>
                      <td className="px-3 py-3 text-start font-bold text-primary-700 dark:text-primary-400">
                        {day.visa > 0 ? day.visa.toFixed(0) : '-'}
                      </td>
                      <td className="px-3 py-3 text-start font-bold text-primary-700 dark:text-primary-400">
                        {day.instapay > 0 ? day.instapay.toFixed(0) : '-'}
                      </td>
                      <td className="px-3 py-3 text-start font-bold text-orange-700 dark:text-orange-400">
                        {day.wallet > 0 ? day.wallet.toFixed(0) : '-'}
                      </td>
                      <td className="px-3 py-3 text-start font-bold text-amber-600 dark:text-amber-400">
                        {day.points > 0 ? day.points.toFixed(0) : '-'}
                      </td>
                      <td className="px-3 py-3 text-start font-bold text-primary-700 dark:text-primary-400 bg-primary-50/60 dark:bg-primary-900/20">
                        {(day.cash + day.visa + day.instapay + day.wallet + day.points).toFixed(0)}
                      </td>
                      <td className="px-3 py-3 text-start font-bold text-red-700 dark:text-red-400">
                        {day.expenses > 0 ? day.expenses.toFixed(0) : '-'}
                      </td>
                      <td className="px-3 py-3 text-start text-xs text-gray-600 dark:text-gray-400">
                        {day.expenseDetails || '-'}
                      </td>
                      <td className="px-3 py-3 text-start font-bold text-orange-700 dark:text-orange-400">
                        {Object.values(day.staffLoans).reduce((a, b) => a + b, 0).toFixed(0) || '-'}
                      </td>
                      {(staffList || []).map(staff => (
                        <td key={staff.id} className="px-3 py-3 text-start text-red-700 dark:text-red-400">
                          {day.staffLoans[staff.name] ? day.staffLoans[staff.name].toFixed(0) : '-'}
                        </td>
                      ))}
                      <td className="px-3 py-3 text-center no-print">
                        <button
                          type="button"
                          aria-label={expandedDay === day.date ? t('closing.buttons.hide') : t('closing.buttons.show')}
                          aria-expanded={expandedDay === day.date}
                          className="inline-flex items-center gap-1 text-primary-700 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-bold transition-colors duration-200"
                        >
                          {expandedDay === day.date ? IconChevronDown : IconChevronRight}
                          <span>{expandedDay === day.date ? t('closing.buttons.hide') : t('closing.buttons.show')}</span>
                        </button>
                      </td>
                    </tr>

                    {/* تفاصيل اليوم */}
                    {expandedDay === day.date && (
                      <tr className="bg-primary-50/40 dark:bg-primary-900/20 no-print">
                        <td colSpan={(staffList?.length || 0) + 17} className="p-4">
                          <div className="space-y-4">
                            {/* الإيصالات */}
                            {day.receipts.length > 0 && (
                              <div>
                                <h4 className="font-bold text-lg mb-3 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                                  {IconReceipt}
                                  <span>{t('closing.receipts.count', { count: day.receipts.length.toString() })}</span>
                                </h4>
                                <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden ring-1 ring-gray-200 dark:ring-gray-700">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300 uppercase text-xs">
                                      <tr>
                                        <th className="px-3 py-3 text-start font-bold">{t('closing.receipts.time')}</th>
                                        <th className="px-3 py-3 text-start font-bold">{t('closing.receipts.receiptNumber')}</th>
                                        <th className="px-3 py-3 text-start font-bold">{t('closing.receipts.type')}</th>
                                        <th className="px-3 py-3 text-start font-bold">{t('closing.receipts.details')}</th>
                                        <th className="px-3 py-3 text-start font-bold">{t('closing.receipts.amount')}</th>
                                        <th className="px-3 py-3 text-start font-bold">{t('closing.receipts.paymentMethod')}</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                                      {day.receipts.map((receipt: any) => {
                                        const details = JSON.parse(receipt.itemDetails)
                                        return (
                                          <tr key={receipt.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors duration-200">
                                            <td className="px-3 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                                              {new Date(receipt.createdAt).toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                                            </td>
                                            <td className="px-3 py-3 font-bold text-green-700 dark:text-green-400">
                                              #{receipt.receiptNumber}
                                            </td>
                                            <td className="px-3 py-3">
                                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                                                {getTypeLabel(receipt.type)}
                                              </span>
                                            </td>
                                            <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                                              {details.memberName && (
                                                <div>
                                                  {details.memberName}
                                                  {details.memberNumber && (
                                                    <span className="text-xs text-gray-500 dark:text-gray-400"> (#{details.memberNumber})</span>
                                                  )}
                                                </div>
                                              )}
                                              {details.clientName && <div>{details.clientName}</div>}
                                              {details.name && <div>{details.name}</div>}
                                            </td>
                                            <td className="px-3 py-3 font-bold text-green-700 dark:text-green-400">
                                              {receipt.amount} {t('closing.currency')}
                                            </td>
                                            <td className="px-3 py-3">
                                              {getPaymentMethodLabel(receipt.paymentMethod)}
                                            </td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* المصروفات */}
                            {day.expensesList.length > 0 && (
                              <div>
                                <h4 className="font-bold text-lg mb-3 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                                  {IconExpense}
                                  <span>{t('closing.expenses.count', { count: day.expensesList.length.toString() })}</span>
                                </h4>
                                <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden ring-1 ring-gray-200 dark:ring-gray-700">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300 uppercase text-xs">
                                      <tr>
                                        <th className="px-3 py-3 text-start font-bold">{t('closing.expenses.time')}</th>
                                        <th className="px-3 py-3 text-start font-bold">{t('closing.expenses.type')}</th>
                                        <th className="px-3 py-3 text-start font-bold">{t('closing.expenses.description')}</th>
                                        <th className="px-3 py-3 text-start font-bold">{t('closing.expenses.staff')}</th>
                                        <th className="px-3 py-3 text-start font-bold">{t('closing.expenses.amount')}</th>
                                        <th className="px-3 py-3 text-start font-bold">{t('closing.expenses.status')}</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                                      {day.expensesList.map((expense: any) => (
                                        <tr key={expense.id} className="hover:bg-red-50/40 dark:hover:bg-red-900/10 transition-colors duration-200">
                                          <td className="px-3 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                                            {new Date(expense.createdAt).toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                                          </td>
                                          <td className="px-3 py-3">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                              expense.type === 'gym_expense'
                                                ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                                                : 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                                            }`}>
                                              {expense.type === 'gym_expense' ? t('closing.expenses.gymExpense') : t('closing.expenses.staffLoan')}
                                            </span>
                                          </td>
                                          <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{expense.description}</td>
                                          <td className="px-3 py-3 text-gray-700 dark:text-gray-300">
                                            {expense.staff ? expense.staff.name : '-'}
                                          </td>
                                          <td className="px-3 py-3 font-bold text-red-700 dark:text-red-400">
                                            {expense.amount} {t('closing.currency')}
                                          </td>
                                          <td className="px-3 py-3">
                                            {expense.type === 'staff_loan' && (
                                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                                expense.isPaid
                                                  ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                                                  : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                                              }`}>
                                                {expense.isPaid ? IconCheck : IconX}
                                                <span>{expense.isPaid ? t('closing.expenses.paid') : t('closing.expenses.unpaid')}</span>
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}

                {/* Totals Row */}
                <tr className="bg-primary-100 dark:bg-primary-900/40 font-bold border-t border-gray-200 dark:border-gray-700">
                  <td className="px-3 py-3 text-center text-gray-900 dark:text-gray-100">{t('closing.table.totalLabel')}</td>
                  <td className="px-3 py-3 text-start text-primary-700 dark:text-primary-400 text-lg">
                    {totals.floor.toFixed(0)}
                  </td>
                  <td className="px-3 py-3 text-start text-red-700 dark:text-red-400 text-lg">
                    {totals.remainingAmount.toFixed(0)}
                  </td>
                  <td className="px-3 py-3 text-start text-green-700 dark:text-green-400 text-lg">
                    {totals.pt.toFixed(0)}
                  </td>
                  {nutritionEnabled && <td className="px-3 py-3 text-start text-lime-700 dark:text-lime-400 text-lg">
                    {totals.nutrition.toFixed(0)}
                  </td>}
                  {physiotherapyEnabled && <td className="px-3 py-3 text-start text-teal-700 dark:text-teal-400 text-lg">
                    {totals.physiotherapy.toFixed(0)}
                  </td>}
                  <td className="px-3 py-3 text-start text-green-700 dark:text-green-400 text-lg">
                    {totals.cash.toFixed(0)}
                  </td>
                  <td className="px-3 py-3 text-start text-primary-700 dark:text-primary-400 text-lg">
                    {totals.visa.toFixed(0)}
                  </td>
                  <td className="px-3 py-3 text-start text-primary-700 dark:text-primary-400 text-lg">
                    {totals.instapay.toFixed(0)}
                  </td>
                  <td className="px-3 py-3 text-start text-orange-700 dark:text-orange-400 text-lg">
                    {totals.wallet.toFixed(0)}
                  </td>
                  <td className="px-3 py-3 text-start text-amber-600 dark:text-amber-400 text-lg">
                    {totals.points.toFixed(0)}
                  </td>
                  <td className="px-3 py-3 text-start text-primary-800 dark:text-primary-300 text-lg bg-primary-200/60 dark:bg-primary-900/60">
                    {totals.totalPayments.toFixed(0)}
                  </td>
                  <td className="px-3 py-3 text-start text-red-700 dark:text-red-400 text-lg">
                    {totals.expenses.toFixed(0)}
                  </td>
                  <td className="px-3 py-3"></td>
                  <td className="px-3 py-3 text-start text-orange-700 dark:text-orange-400 text-lg">
                    {dailyData.reduce((sum, day) =>
                      sum + Object.values(day.staffLoans).reduce((a, b) => a + b, 0), 0
                    ).toFixed(0)}
                  </td>
                  {(staffList || []).map(staff => {
                    const total = dailyData.reduce((sum, day) =>
                      sum + (day.staffLoans[staff.name] || 0), 0
                    )
                    return (
                      <td key={staff.id} className="px-3 py-3 text-start text-red-700 dark:text-red-400">
                        {total > 0 ? total.toFixed(0) : '-'}
                      </td>
                    )
                  })}
                  <td className="px-3 py-3 no-print"></td>
                </tr>

                {/* Net Profit Row */}
                <tr className="bg-green-100 dark:bg-green-900/40 font-bold border-t border-green-200 dark:border-green-900/50">
                  <td colSpan={8} className="px-3 py-3 text-center text-lg text-gray-900 dark:text-gray-100">
                    {t('closing.stats.netProfit')}
                  </td>
                  <td colSpan={(staffList?.length || 0) + 9} className="px-3 py-3 text-start text-2xl text-green-700 dark:text-green-400">
                    {totals.netProfit.toFixed(0)} {t('closing.currency')}
                  </td>
                </tr>
              </tbody>
            </table>
              )}
            </div>
            </>
          )}
        </>
      )}

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .excel-table {
            font-size: 10px;
          }
          .excel-table th,
          .excel-table td {
            padding: 4px 6px !important;
          }
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
        }

        .excel-table {
          font-family: 'Arial', sans-serif;
        }

        .excel-table th {
          background-color: #e5e7eb;
          font-weight: 700;
        }

        .excel-table td,
        .excel-table th {
          white-space: nowrap;
        }
      `}</style>
    </div>
  )
}

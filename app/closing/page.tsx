'use client'

import React, { useEffect, useState } from 'react'
import ExcelJS from 'exceljs'
import { useLanguage } from '../../contexts/LanguageContext'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'
import { normalizePaymentMethod, isMultiPayment } from '../../lib/paymentHelpers'
import { PRIMARY_COLOR, THEME_COLORS } from '@/lib/theme/colors'
import { getReceiptTypeTranslationKey, isFloorReceipt, isPTReceipt } from '../../lib/translateReceiptType'

interface DailyData {
  date: string
  floor: number
  pt: number
  expenses: number
  expenseDetails: string
  visa: number
  instapay: number
  cash: number
  wallet: number
  points: number  // 🏆 النقاط المستخدمة
  remainingAmount: number  // 💰 الفلوس الباقية
  remainingInstapay: number // 💰 الفلوس الباقية - إنستاباي
  remainingWallet: number   // 💰 الفلوس الباقية - محفظة
  staffLoans: { [key: string]: number }
  receipts: any[]
  expensesList: any[]
}

interface Staff {
  id: string
  name: string
}

export default function ClosingPage() {
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
    expenses: 0,
    visa: 0,
    instapay: 0,
    cash: 0,
    wallet: 0,
    points: 0,               // 🏆 النقاط المستخدمة
    remainingAmount: 0,      // 💰 الفلوس الباقية
    remainingInstapay: 0,    // 💰 الفلوس الباقية - إنستاباي
    remainingWallet: 0,      // 💰 الفلوس الباقية - محفظة
    totalPayments: 0,
    totalRevenue: 0,
    netProfit: 0
  })

  const [pointsValueInEGP, setPointsValueInEGP] = useState(0.1) // القيمة الافتراضية

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
            expenses: 0,
            expenseDetails: '',
            visa: 0,
            instapay: 0,
            cash: 0,
            wallet: 0,
            points: 0,               // 🏆 النقاط المستخدمة
            remainingAmount: 0,      // 💰 الفلوس الباقية
            remainingInstapay: 0,    // 💰 الفلوس الباقية - إنستاباي
            remainingWallet: 0,      // 💰 الفلوس الباقية - محفظة
            staffLoans: {},
            receipts: [],
            expensesList: []
          }
        }

        dailyMap[date].receipts.push(receipt)

        // استخراج المبلغ المتبقي من itemDetails
        let remainingAmountInReceipt = 0
        try {
          const details = JSON.parse(receipt.itemDetails)
          remainingAmountInReceipt = details.remainingAmount || 0
        } catch (e) {
          // ignore parsing errors
        }

        // تحديد نوع الإيصال
        if (isFloorReceipt(receipt.type)) {
          // floor يشمل: اشتراكات جديدة، تجديدات، ودفع المتبقي من العضويات
          dailyMap[date].floor += receipt.amount

          // إضافة المبلغ المتبقي للعضويات الجديدة فقط (ليس Payment)
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
        } else if (isPTReceipt(receipt.type)) {
          // PT يشمل: اشتراكات جديدة، تجديدات، ودفع الباقي
          dailyMap[date].pt += receipt.amount
        }

        // ✅ CRITICAL: توزيع المبالغ حسب وسائل الدفع الفعلية (دعم الدفع المتعدد)
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
            expenses: 0,
            expenseDetails: '',
            visa: 0,
            instapay: 0,
            cash: 0,
            wallet: 0,
            points: 0,               // 🏆 النقاط المستخدمة
            remainingAmount: 0,      // 💰 الفلوس الباقية
            remainingInstapay: 0,    // 💰 الفلوس الباقية - إنستاباي
            remainingWallet: 0,      // 💰 الفلوس الباقية - محفظة
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
        acc.expenses += day.expenses
        acc.visa += day.visa
        acc.instapay += day.instapay
        acc.cash += day.cash
        acc.wallet += day.wallet
        acc.points += day.points                          // 🏆 النقاط المستخدمة
        acc.remainingAmount += day.remainingAmount        // 💰 الفلوس الباقية
        acc.remainingInstapay += day.remainingInstapay    // 💰 الفلوس الباقية - إنستاباي
        acc.remainingWallet += day.remainingWallet        // 💰 الفلوس الباقية - محفظة
        return acc
      }, {
        floor: 0,
        pt: 0,
        expenses: 0,
        visa: 0,
        instapay: 0,
        cash: 0,
        wallet: 0,
        points: 0,               // 🏆 النقاط المستخدمة
        remainingAmount: 0,      // 💰 الفلوس الباقية
        remainingInstapay: 0,    // 💰 الفلوس الباقية - إنستاباي
        remainingWallet: 0,      // 💰 الفلوس الباقية - محفظة
        totalPayments: 0,
        totalRevenue: 0,
        netProfit: 0
      })

      newTotals.totalPayments = newTotals.cash + newTotals.visa + newTotals.instapay + newTotals.wallet + newTotals.points
      newTotals.totalRevenue = newTotals.floor + newTotals.pt
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
        const floorRevenue = monthReceipts
          .filter((r: any) => r.type === 'Member' || r.type === 'تجديد عضويه' || r.type === 'Payment')
          .reduce((sum: number, r: any) => sum + r.amount, 0)

        const ptRevenue = monthReceipts
          .filter((r: any) => r.type === 'PT' || r.type === 'اشتراك برايفت' || r.type === 'تجديد برايفت' || r.type === 'دفع باقي برايفت' || r.type === 'برايفت جديد')
          .reduce((sum: number, r: any) => sum + r.amount, 0)

        const totalExpenses = monthExpenses.reduce((sum: number, e: any) => sum + e.amount, 0)
        const totalRevenue = floorRevenue + ptRevenue
        const netProfit = totalRevenue - totalExpenses

        // عدد الاشتراكات
        const memberSubscriptions = monthReceipts.filter((r: any) => r.type === 'Member' || r.type === 'تجديد عضويه').length
        const ptSubscriptions = monthReceipts.filter((r: any) => r.type === 'PT' || r.type === 'اشتراك برايفت' || r.type === 'تجديد برايفت' || r.type === 'برايفت جديد').length

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

      mainSheet.addRow([t('closing.stats.totalRevenue'), totals.totalRevenue])
      mainSheet.addRow([t('closing.stats.totalExpenses'), totals.expenses])
      mainSheet.addRow([t('closing.stats.netProfit'), totals.netProfit])
      mainSheet.addRow([t('closing.stats.numberOfDays'), dailyData.length])
      mainSheet.addRow([t('closing.stats.dailyAverage'), dailyData.length > 0 ? Math.round(totals.totalRevenue / dailyData.length) : 0])

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
              expense.type === 'gym_expense' ? t('closing.expenses.gymExpense') : t('closing.expenses.staffLoan'),
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

      console.log('✅', t('closing.excel.success'))

    } catch (error) {
      console.error('❌ خطأ في التصدير:', error)
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

  const getPaymentMethodLabel = (method: string, amount?: number) => {
    // ✅ معالجة الدفع المتعدد
    if (isMultiPayment(method)) {
      const normalized = normalizePaymentMethod(method, amount || 0)
      const emojis = normalized.methods.map(m => {
        if (m.method === 'cash') return '💵'
        if (m.method === 'visa') return '💳'
        if (m.method === 'instapay') return '📱'
        if (m.method === 'wallet') return '💰'
        if (m.method === 'points') return '🏆'
        return '💵'
      }).join('')

      return (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold text-primary-600">🔀 {emojis}</span>
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

    // دفع واحد
    const methods: { [key: string]: string } = {
      'cash': `${t('closing.paymentMethods.cash')} 💵`,
      'visa': `${t('closing.paymentMethods.visa')} 💳`,
      'instapay': `${t('closing.paymentMethods.instapay')} 📱`,
      'wallet': `${t('closing.paymentMethods.wallet')} 💰`,
      'points': `${t('closing.paymentMethods.points')} 🏆`
    }
    return methods[method] || `${t('closing.paymentMethods.cash')} 💵`
  }

  return (
    <div className="container mx-auto p-3 sm:p-4 md:p-6" dir={direction}>
      <div className="mb-4 sm:mb-6 no-print">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">💰 {t('closing.title')}</h1>
        <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base">{t('closing.subtitle')}</p>

        {/* View Mode Tabs */}
        <div className="mt-3 sm:mt-4 flex flex-wrap gap-1.5 sm:gap-2">
          <button
            onClick={() => setViewMode('daily')}
            className={`px-3 sm:px-4 md:px-6 py-2 sm:py-3 rounded-lg font-bold transition text-xs sm:text-sm md:text-base ${
              viewMode === 'daily'
                ? 'bg-primary-600 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            📅 {t('closing.viewMode.daily')}
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={`px-3 sm:px-4 md:px-6 py-2 sm:py-3 rounded-lg font-bold transition text-xs sm:text-sm md:text-base ${
              viewMode === 'monthly'
                ? 'bg-primary-600 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            📆 {t('closing.viewMode.monthly')}
          </button>
          <button
            onClick={() => setViewMode('yearly')}
            className={`px-3 sm:px-4 md:px-6 py-2 sm:py-3 rounded-lg font-bold transition text-xs sm:text-sm md:text-base ${
              viewMode === 'yearly'
                ? 'bg-primary-600 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            📅 {t('closing.viewMode.yearly')}
          </button>
          <button
            onClick={() => setViewMode('comparison')}
            className={`px-3 sm:px-4 md:px-6 py-2 sm:py-3 rounded-lg font-bold transition text-xs sm:text-sm md:text-base ${
              viewMode === 'comparison'
                ? 'bg-primary-600 text-white shadow-lg'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            📊 {t('closing.viewMode.comparison')}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-4 sm:mb-6 bg-white dark:bg-gray-800 p-3 sm:p-4 md:p-6 rounded-lg shadow-md no-print border dark:border-gray-700">
        <div className="space-y-3 sm:space-y-4">
          {viewMode === 'daily' ? (
            /* اختيار اليوم للعرض اليومي */
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-2 dark:text-gray-200">📅 {t('closing.controls.selectDay')}</label>
              <input
                type="date"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="w-full sm:w-auto px-3 sm:px-4 py-2 border-2 rounded-lg font-mono text-sm sm:text-base md:text-lg dark:bg-gray-700 dark:text-white dark:border-gray-600"
              />
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-2">
                {t('closing.controls.viewDayDetails', {
                  date: new Date(selectedDay).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })
                })}
              </p>
            </div>
          ) : viewMode === 'monthly' ? (
            /* اختيار الشهر للعرض الشهري */
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-2 dark:text-gray-200">📅 {t('closing.controls.selectMonth')}</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full sm:w-auto px-3 sm:px-4 py-2 border-2 rounded-lg font-mono text-sm sm:text-base md:text-lg dark:bg-gray-700 dark:text-white dark:border-gray-600"
              />
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-2">
                {t('closing.controls.viewMonthDetails', {
                  month: new Date(selectedMonth + '-01').toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' })
                })}
              </p>
            </div>
          ) : viewMode === 'yearly' ? (
            /* اختيار السنة للعرض السنوي */
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-2 dark:text-gray-200">📅 {t('closing.controls.selectYear')}</label>
              <input
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                min="2020"
                max="2030"
                className="w-full sm:w-auto px-3 sm:px-4 py-2 border-2 rounded-lg font-mono text-sm sm:text-base md:text-lg dark:bg-gray-700 dark:text-white dark:border-gray-600"
              />
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-2">
                {t('closing.controls.viewYearDetails', { year: selectedYear })}
              </p>
            </div>
          ) : (
            /* اختيار فترة المقارنة */
            <div className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-2 dark:text-gray-200">📅 {t('closing.comparison.startMonth')}</label>
                  <input
                    type="month"
                    value={comparisonStartMonth}
                    onChange={(e) => setComparisonStartMonth(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 border-2 rounded-lg font-mono text-sm sm:text-base md:text-lg dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-2 dark:text-gray-200">📅 {t('closing.comparison.endMonth')}</label>
                  <input
                    type="month"
                    value={comparisonEndMonth}
                    onChange={(e) => setComparisonEndMonth(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 border-2 rounded-lg font-mono text-sm sm:text-base md:text-lg dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  />
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                {t('closing.comparison.periodInfo', {
                  start: new Date(comparisonStartMonth + '-01').toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' }),
                  end: new Date(comparisonEndMonth + '-01').toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' }),
                  count: monthlyComparison.length.toString()
                })}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <button
              onClick={handlePrint}
              className="bg-green-600 text-white px-3 sm:px-4 md:px-6 py-2 rounded-lg hover:bg-green-700 dark:hover:bg-green-800 transition flex items-center gap-1 sm:gap-2 text-xs sm:text-sm md:text-base"
            >
              🖨️ <span className="hidden sm:inline">{t('closing.buttons.print')}</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="bg-primary-600 text-white px-3 sm:px-4 md:px-6 py-2 rounded-lg hover:bg-primary-700 dark:hover:bg-primary-800 transition flex items-center gap-1 sm:gap-2 text-xs sm:text-sm md:text-base"
            >
              📊 <span className="hidden sm:inline">{t('closing.buttons.export')}</span>
            </button>
            <button
              onClick={fetchData}
              className="bg-primary-600 text-white px-3 sm:px-4 md:px-6 py-2 rounded-lg hover:bg-primary-700 dark:hover:bg-primary-800 transition flex items-center gap-1 sm:gap-2 text-xs sm:text-sm md:text-base"
            >
              🔄 <span className="hidden sm:inline">{t('closing.buttons.refresh')}</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin text-6xl mb-4">⏳</div>
          <p className="text-xl text-gray-600 dark:text-gray-300">{t('closing.loading')}</p>
        </div>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-700 dark:to-primary-800 text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-2xl hover:scale-105 transition-all duration-300 cursor-pointer">
                      <p className="text-xs sm:text-sm opacity-90">{t('closing.comparison.totalRevenue')}</p>
                      <p className="text-2xl sm:text-3xl font-bold">
                        {monthlyComparison.reduce((sum, m) => sum + m.totalRevenue, 0).toFixed(0)}
                      </p>
                      <p className="text-[10px] sm:text-xs opacity-75 mt-2">
                        {t('closing.comparison.average')}: {(monthlyComparison.reduce((sum, m) => sum + m.totalRevenue, 0) / monthlyComparison.length).toFixed(0)}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-red-500 to-red-600 dark:from-red-700 dark:to-red-800 text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-2xl hover:scale-105 transition-all duration-300 cursor-pointer">
                      <p className="text-xs sm:text-sm opacity-90">{t('closing.comparison.totalExpenses')}</p>
                      <p className="text-2xl sm:text-3xl font-bold">
                        {monthlyComparison.reduce((sum, m) => sum + m.totalExpenses, 0).toFixed(0)}
                      </p>
                      <p className="text-[10px] sm:text-xs opacity-75 mt-2">
                        {t('closing.comparison.average')}: {(monthlyComparison.reduce((sum, m) => sum + m.totalExpenses, 0) / monthlyComparison.length).toFixed(0)}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-green-500 to-green-600 dark:from-green-700 dark:to-green-800 text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-2xl hover:scale-105 transition-all duration-300 cursor-pointer">
                      <p className="text-xs sm:text-sm opacity-90">{t('closing.comparison.totalNetProfit')}</p>
                      <p className="text-2xl sm:text-3xl font-bold">
                        {monthlyComparison.reduce((sum, m) => sum + m.netProfit, 0).toFixed(0)}
                      </p>
                      <p className="text-[10px] sm:text-xs opacity-75 mt-2">
                        {t('closing.comparison.average')}: {(monthlyComparison.reduce((sum, m) => sum + m.netProfit, 0) / monthlyComparison.length).toFixed(0)}
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-700 dark:to-primary-800 text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-2xl hover:scale-105 transition-all duration-300 cursor-pointer">
                      <p className="text-xs sm:text-sm opacity-90">{t('closing.comparison.totalSubscriptions')}</p>
                      <p className="text-2xl sm:text-3xl font-bold">
                        {monthlyComparison.reduce((sum, m) => sum + m.totalSubscriptions, 0)}
                      </p>
                      <p className="text-[10px] sm:text-xs opacity-75 mt-2">
                        {t('closing.comparison.average')}: {(monthlyComparison.reduce((sum, m) => sum + m.totalSubscriptions, 0) / monthlyComparison.length).toFixed(0)}
                      </p>
                    </div>
                  </div>

                  {/* Revenue & Expenses Trend Chart */}
                  <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 md:p-6 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-2xl transition-shadow duration-300 border border-transparent dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-700">
                    <h3 className="text-base sm:text-lg md:text-xl font-bold mb-3 sm:mb-4 text-gray-900 dark:text-gray-100">{t('closing.comparison.revenueExpensesTrend')}</h3>
                    <ResponsiveContainer width="100%" height={300} className="sm:!h-[350px] md:!h-[400px]">
                      <LineChart data={monthlyComparison}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="monthName"
                          angle={-45}
                          textAnchor="end"
                          height={100}
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis style={{ fontSize: '12px' }} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="totalRevenue"
                          stroke="#10b981"
                          strokeWidth={3}
                          name={t('closing.comparison.revenue')}
                        />
                        <Line
                          type="monotone"
                          dataKey="totalExpenses"
                          stroke="#ef4444"
                          strokeWidth={3}
                          name={t('closing.comparison.expenses')}
                        />
                        <Line
                          type="monotone"
                          dataKey="netProfit"
                          stroke={PRIMARY_COLOR}
                          strokeWidth={3}
                          name={t('closing.comparison.netProfit')}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Revenue Breakdown Chart */}
                  <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 md:p-6 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-2xl transition-shadow duration-300 border border-transparent dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-700">
                    <h3 className="text-base sm:text-lg md:text-xl font-bold mb-3 sm:mb-4 text-gray-900 dark:text-gray-100">{t('closing.comparison.revenueBreakdown')}</h3>
                    <ResponsiveContainer width="100%" height={300} className="sm:!h-[350px] md:!h-[400px]">
                      <BarChart data={monthlyComparison}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="monthName"
                          angle={-45}
                          textAnchor="end"
                          height={100}
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis style={{ fontSize: '12px' }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="floorRevenue" fill={THEME_COLORS.primary[400]} name={t('closing.comparison.floorRevenue')} />
                        <Bar dataKey="ptRevenue" fill="#34d399" name={t('closing.comparison.ptRevenue')} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Subscriptions Chart */}
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-2xl transition-shadow duration-300 border border-transparent dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-700">
                    <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">{t('closing.comparison.subscriptionsChart')}</h3>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={monthlyComparison}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="monthName"
                          angle={-45}
                          textAnchor="end"
                          height={100}
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis style={{ fontSize: '12px' }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="memberSubscriptions" fill="#8b5cf6" name={t('closing.comparison.memberSubscriptions')} />
                        <Bar dataKey="ptSubscriptions" fill="#ec4899" name={t('closing.comparison.ptSubscriptions')} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Payment Methods Distribution (PieChart) */}
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-2xl transition-shadow duration-300 border border-transparent dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-700">
                    <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">{t('closing.comparison.paymentMethodsDistribution')}</h3>
                    <ResponsiveContainer width="100%" height={400}>
                      <PieChart>
                        <Pie
                          data={(() => {
                            const totalCash = monthlyComparison.reduce((sum, m) => sum + (m.cash || 0), 0)
                            const totalVisa = monthlyComparison.reduce((sum, m) => sum + (m.visa || 0), 0)
                            const totalInstapay = monthlyComparison.reduce((sum, m) => sum + (m.instapay || 0), 0)
                            const totalWallet = monthlyComparison.reduce((sum, m) => sum + (m.wallet || 0), 0)
                            const totalPoints = monthlyComparison.reduce((sum, m) => sum + (m.points || 0), 0)

                            return [
                              { name: t('closing.comparison.cash'), value: totalCash, color: THEME_COLORS.primary[500] },
                              { name: t('closing.comparison.visa'), value: totalVisa, color: '#3b82f6' },
                              { name: t('closing.comparison.instapay'), value: totalInstapay, color: '#f59e0b' },
                              { name: t('closing.comparison.wallet'), value: totalWallet, color: '#10b981' },
                              { name: t('closing.comparison.points'), value: totalPoints, color: '#eab308' }
                            ].filter(item => item.value > 0)
                          })()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                          outerRadius={120}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {(() => {
                            const totalCash = monthlyComparison.reduce((sum, m) => sum + (m.cash || 0), 0)
                            const totalVisa = monthlyComparison.reduce((sum, m) => sum + (m.visa || 0), 0)
                            const totalInstapay = monthlyComparison.reduce((sum, m) => sum + (m.instapay || 0), 0)
                            const totalWallet = monthlyComparison.reduce((sum, m) => sum + (m.wallet || 0), 0)
                            const totalPoints = monthlyComparison.reduce((sum, m) => sum + (m.points || 0), 0)

                            const colors = [
                              THEME_COLORS.primary[500],
                              '#3b82f6',
                              '#f59e0b',
                              '#10b981',
                              '#eab308'
                            ]

                            return colors.map((color, index) => <Cell key={`cell-${index}`} fill={color} />)
                          })()}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Cumulative Growth (AreaChart) */}
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-2xl transition-shadow duration-300 border border-transparent dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-700">
                    <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">{t('closing.comparison.cumulativeGrowth')}</h3>
                    <ResponsiveContainer width="100%" height={400}>
                      <AreaChart
                        data={(() => {
                          let cumulativeRevenue = 0
                          let cumulativeExpenses = 0
                          let cumulativeProfit = 0

                          return monthlyComparison.map(month => {
                            cumulativeRevenue += month.totalRevenue
                            cumulativeExpenses += month.totalExpenses
                            cumulativeProfit += month.netProfit

                            return {
                              ...month,
                              cumulativeRevenue,
                              cumulativeExpenses,
                              cumulativeProfit
                            }
                          })
                        })()}
                      >
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                          </linearGradient>
                          <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                          </linearGradient>
                          <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={THEME_COLORS.primary[500]} stopOpacity={0.8}/>
                            <stop offset="95%" stopColor={THEME_COLORS.primary[500]} stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="monthName"
                          angle={-45}
                          textAnchor="end"
                          height={100}
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis style={{ fontSize: '12px' }} />
                        <Tooltip />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="cumulativeRevenue"
                          stroke="#10b981"
                          fillOpacity={1}
                          fill="url(#colorRevenue)"
                          name={t('closing.comparison.cumulativeRevenue')}
                        />
                        <Area
                          type="monotone"
                          dataKey="cumulativeExpenses"
                          stroke="#ef4444"
                          fillOpacity={1}
                          fill="url(#colorExpenses)"
                          name={t('closing.comparison.cumulativeExpenses')}
                        />
                        <Area
                          type="monotone"
                          dataKey="cumulativeProfit"
                          stroke={THEME_COLORS.primary[500]}
                          fillOpacity={1}
                          fill="url(#colorProfit)"
                          name={t('closing.comparison.cumulativeProfit')}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Performance Radar Chart */}
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-2xl transition-shadow duration-300 border border-transparent dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-700">
                    <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">{t('closing.comparison.performanceRadar')}</h3>
                    <ResponsiveContainer width="100%" height={500}>
                      <RadarChart data={monthlyComparison.slice(-6)}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="monthName" style={{ fontSize: '12px' }} />
                        <PolarRadiusAxis style={{ fontSize: '10px' }} />
                        <Radar
                          name={t('closing.comparison.revenue')}
                          dataKey="totalRevenue"
                          stroke="#10b981"
                          fill="#10b981"
                          fillOpacity={0.6}
                        />
                        <Radar
                          name={t('closing.comparison.subscriptions')}
                          dataKey="totalSubscriptions"
                          stroke={THEME_COLORS.primary[500]}
                          fill={THEME_COLORS.primary[500]}
                          fillOpacity={0.6}
                        />
                        <Legend />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Detailed Comparison Table */}
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-x-auto border dark:border-gray-700 hover:shadow-xl dark:hover:shadow-2xl transition-shadow duration-300 hover:border-primary-200 dark:hover:border-primary-700">
                    <h3 className="text-xl font-bold p-6 border-b dark:border-gray-700 text-gray-900 dark:text-gray-100">{t('closing.comparison.detailedTable')}</h3>
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-gray-200 dark:bg-gray-700">
                          <th className="border border-gray-400 dark:border-gray-600 px-4 py-3 text-center font-bold dark:text-gray-200">{t('closing.comparison.month')}</th>
                          <th className="border border-gray-400 dark:border-gray-600 px-4 py-3 text-center font-bold bg-primary-100 dark:bg-primary-900/50 dark:text-gray-200">{t('closing.comparison.floorRevenue')}</th>
                          <th className="border border-gray-400 dark:border-gray-600 px-4 py-3 text-center font-bold bg-green-100 dark:bg-green-900/50 dark:text-gray-200">{t('closing.comparison.ptRevenue')}</th>
                          <th className="border border-gray-400 dark:border-gray-600 px-4 py-3 text-center font-bold bg-yellow-100 dark:bg-yellow-900/50 dark:text-gray-200">{t('closing.comparison.totalRevenue')}</th>
                          <th className="border border-gray-400 dark:border-gray-600 px-4 py-3 text-center font-bold bg-red-100 dark:bg-red-900/50 dark:text-gray-200">{t('closing.comparison.expenses')}</th>
                          <th className="border border-gray-400 dark:border-gray-600 px-4 py-3 text-center font-bold bg-green-200 dark:bg-green-900/50 dark:text-gray-200">{t('closing.comparison.netProfit')}</th>
                          <th className="border border-gray-400 dark:border-gray-600 px-4 py-3 text-center font-bold bg-primary-100 dark:bg-primary-900/50 dark:text-gray-200">{t('closing.comparison.subscriptions')}</th>
                          <th className="border border-gray-400 dark:border-gray-600 px-4 py-3 text-center font-bold bg-gray-100 dark:bg-gray-700 dark:text-gray-200">{t('closing.comparison.growth')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyComparison.map((month, index) => {
                          const prevMonth = index > 0 ? monthlyComparison[index - 1] : null
                          const growthPercent = prevMonth ? ((month.totalRevenue - prevMonth.totalRevenue) / prevMonth.totalRevenue * 100) : 0

                          return (
                            <tr key={month.month} className={`${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'} hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors duration-200 cursor-pointer`}>
                              <td className="border border-gray-300 dark:border-gray-600 px-4 py-3 font-medium dark:text-gray-200">{month.monthName}</td>
                              <td className={`border border-gray-300 dark:border-gray-600 px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-primary-600 dark:text-primary-400`}>
                                {month.floorRevenue.toFixed(0)}
                              </td>
                              <td className={`border border-gray-300 dark:border-gray-600 px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-green-600 dark:text-green-400`}>
                                {month.ptRevenue.toFixed(0)}
                              </td>
                              <td className={`border border-gray-300 dark:border-gray-600 px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-yellow-600 dark:text-yellow-400 text-lg`}>
                                {month.totalRevenue.toFixed(0)}
                              </td>
                              <td className={`border border-gray-300 dark:border-gray-600 px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-red-600 dark:text-red-400`}>
                                {month.totalExpenses.toFixed(0)}
                              </td>
                              <td className={`border border-gray-300 dark:border-gray-600 px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-green-700 dark:text-green-400 text-lg`}>
                                {month.netProfit.toFixed(0)}
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-center font-bold text-primary-600 dark:text-primary-400">
                                {month.totalSubscriptions}
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {t('closing.comparison.members')}: {month.memberSubscriptions} | PT: {month.ptSubscriptions}
                                </div>
                              </td>
                              <td className="border border-gray-300 dark:border-gray-600 px-4 py-3 text-center">
                                {prevMonth ? (
                                  <span className={`font-bold ${growthPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {growthPercent >= 0 ? '↑' : '↓'} {Math.abs(growthPercent).toFixed(1)}%
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
                        <tr className="bg-yellow-100 dark:bg-yellow-900/50 font-bold">
                          <td className="border border-gray-400 dark:border-gray-600 px-4 py-3 text-center dark:text-gray-200">{t('closing.comparison.total')}</td>
                          <td className={`border border-gray-400 dark:border-gray-600 px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-primary-700 dark:text-primary-400`}>
                            {monthlyComparison.reduce((sum, m) => sum + m.floorRevenue, 0).toFixed(0)}
                          </td>
                          <td className={`border border-gray-400 dark:border-gray-600 px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-green-700 dark:text-green-400`}>
                            {monthlyComparison.reduce((sum, m) => sum + m.ptRevenue, 0).toFixed(0)}
                          </td>
                          <td className={`border border-gray-400 dark:border-gray-600 px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-yellow-700 dark:text-yellow-400 text-lg`}>
                            {monthlyComparison.reduce((sum, m) => sum + m.totalRevenue, 0).toFixed(0)}
                          </td>
                          <td className={`border border-gray-400 dark:border-gray-600 px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-red-700 dark:text-red-400`}>
                            {monthlyComparison.reduce((sum, m) => sum + m.totalExpenses, 0).toFixed(0)}
                          </td>
                          <td className={`border border-gray-400 dark:border-gray-600 px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-green-800 dark:text-green-400 text-lg`}>
                            {monthlyComparison.reduce((sum, m) => sum + m.netProfit, 0).toFixed(0)}
                          </td>
                          <td className="border border-gray-400 dark:border-gray-600 px-4 py-3 text-center text-primary-700 dark:text-primary-400">
                            {monthlyComparison.reduce((sum, m) => sum + m.totalSubscriptions, 0)}
                          </td>
                          <td className="border border-gray-400 dark:border-gray-600 px-4 py-3"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Performance Insights */}
                  <div className="bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-700 dark:to-primary-800 text-white p-6 rounded-lg shadow-lg hover:shadow-xl dark:hover:shadow-2xl hover:scale-[1.02] transition-all duration-300">
                    <h3 className="text-xl font-bold mb-4">{t('closing.comparison.insights')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {monthlyComparison.length > 0 && (
                        <>
                          <div className="bg-white/20 dark:bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm hover:bg-white/30 dark:hover:bg-gray-800/40 transition-all duration-300 cursor-pointer">
                            <p className="text-sm opacity-90">{t('closing.comparison.bestMonth')}</p>
                            <p className="text-2xl font-bold mt-2">
                              {monthlyComparison.reduce((best, m) => m.totalRevenue > best.totalRevenue ? m : best).monthName}
                            </p>
                            <p className="text-sm opacity-75 mt-1">
                              {monthlyComparison.reduce((best, m) => m.totalRevenue > best.totalRevenue ? m : best).totalRevenue.toFixed(0)} {t('closing.currency')}
                            </p>
                          </div>
                          <div className="bg-white/20 dark:bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm hover:bg-white/30 dark:hover:bg-gray-800/40 transition-all duration-300 cursor-pointer">
                            <p className="text-sm opacity-90">{t('closing.comparison.worstMonth')}</p>
                            <p className="text-2xl font-bold mt-2">
                              {monthlyComparison.reduce((worst, m) => m.totalRevenue < worst.totalRevenue ? m : worst).monthName}
                            </p>
                            <p className="text-sm opacity-75 mt-1">
                              {monthlyComparison.reduce((worst, m) => m.totalRevenue < worst.totalRevenue ? m : worst).totalRevenue.toFixed(0)} {t('closing.currency')}
                            </p>
                          </div>
                          <div className="bg-white/20 dark:bg-gray-800/30 p-4 rounded-lg backdrop-blur-sm hover:bg-white/30 dark:hover:bg-gray-800/40 transition-all duration-300 cursor-pointer">
                            <p className="text-sm opacity-90">{t('closing.comparison.trend')}</p>
                            <p className="text-2xl font-bold mt-2">
                              {monthlyComparison.length > 1 &&
                                monthlyComparison[monthlyComparison.length - 1].totalRevenue > monthlyComparison[0].totalRevenue
                                ? `↗ ${t('closing.comparison.growing')}`
                                : monthlyComparison[monthlyComparison.length - 1].totalRevenue < monthlyComparison[0].totalRevenue
                                ? `↘ ${t('closing.comparison.declining')}`
                                : `→ ${t('closing.comparison.stable')}`
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
                <div className="bg-white dark:bg-gray-800 p-12 rounded-lg shadow-lg text-center border dark:border-gray-700">
                  <p className="text-gray-500 dark:text-gray-400 text-xl">{t('closing.comparison.noData')}</p>
                  <p className="text-gray-400 dark:text-gray-500 mt-2">{t('closing.comparison.selectPeriod')}</p>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6 no-print">
            <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-3 sm:p-4 rounded-lg shadow-lg">
              <p className="text-[10px] sm:text-xs md:text-sm opacity-90">{t('closing.stats.totalRevenue')}</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold">{totals.totalRevenue.toFixed(0)}</p>
            </div>
            <div className="bg-gradient-to-br from-red-500 to-red-600 text-white p-3 sm:p-4 rounded-lg shadow-lg">
              <p className="text-[10px] sm:text-xs md:text-sm opacity-90">{t('closing.stats.totalExpenses')}</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold">{totals.expenses.toFixed(0)}</p>
            </div>
            <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white p-3 sm:p-4 rounded-lg shadow-lg">
              <p className="text-[10px] sm:text-xs md:text-sm opacity-90">{t('closing.stats.netProfit')}</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold">{totals.netProfit.toFixed(0)}</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white p-3 sm:p-4 rounded-lg shadow-lg">
              <p className="text-[10px] sm:text-xs md:text-sm opacity-90">{t('closing.stats.totalPayments')}</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold">{totals.totalPayments.toFixed(0)}</p>
            </div>
            <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white p-3 sm:p-4 rounded-lg shadow-lg">
              <p className="text-[10px] sm:text-xs md:text-sm opacity-90">{t('closing.stats.numberOfDays')}</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold">{dailyData.length}</p>
            </div>
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-3 sm:p-4 rounded-lg shadow-lg">
              <p className="text-[10px] sm:text-xs md:text-sm opacity-90">{t('closing.stats.dailyAverage')}</p>
              <p className="text-xl sm:text-2xl md:text-3xl font-bold">
                {dailyData.length > 0 ? (totals.totalRevenue / dailyData.length).toFixed(0) : 0}
              </p>
            </div>
          </div>

          {/* Payment Methods Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6 no-print">
            <div className="bg-white dark:bg-gray-800 border-2 border-green-300 dark:border-green-700 p-3 sm:p-4 rounded-lg shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs md:text-sm text-gray-600 dark:text-gray-300">{t('closing.paymentMethods.cash')} 💵</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-green-600 dark:text-green-400">{totals.cash.toFixed(0)}</p>
                </div>
                <span className="text-2xl sm:text-3xl md:text-4xl">💵</span>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border-2 border-primary-300 dark:border-primary-700 p-3 sm:p-4 rounded-lg shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs md:text-sm text-gray-600 dark:text-gray-300">{t('closing.paymentMethods.visa')} 💳</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-primary-600 dark:text-primary-400">{totals.visa.toFixed(0)}</p>
                </div>
                <span className="text-2xl sm:text-3xl md:text-4xl">💳</span>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border-2 border-primary-300 dark:border-primary-700 p-3 sm:p-4 rounded-lg shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs md:text-sm text-gray-600 dark:text-gray-300">{t('closing.paymentMethods.instapay')} 📱</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-primary-600 dark:text-primary-400">{totals.instapay.toFixed(0)}</p>
                </div>
                <span className="text-2xl sm:text-3xl md:text-4xl">📱</span>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border-2 border-orange-300 dark:border-orange-700 p-3 sm:p-4 rounded-lg shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs md:text-sm text-gray-600 dark:text-gray-300">{t('closing.paymentMethods.wallet')} 💰</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-orange-600 dark:text-orange-400">{totals.wallet.toFixed(0)}</p>
                </div>
                <span className="text-2xl sm:text-3xl md:text-4xl">💰</span>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border-2 border-yellow-300 dark:border-yellow-700 p-3 sm:p-4 rounded-lg shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] sm:text-xs md:text-sm text-gray-600 dark:text-gray-300">{t('closing.paymentMethods.points')} 🏆</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-yellow-600 dark:text-yellow-400">{totals.points.toFixed(0)}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                    {t('closing.pointsValueLabel')}: {(totals.points * pointsValueInEGP).toFixed(2)} {t('common.egp')}
                  </p>
                </div>
                <span className="text-2xl sm:text-3xl md:text-4xl">🏆</span>
              </div>
            </div>
          </div>
            </>
          )}

          {/* Excel-like Table */}
          {viewMode !== 'comparison' && (
            <>
              <div className="bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-700 rounded-lg p-2 sm:p-3 mb-3 sm:mb-4 lg:hidden">
                <p className="text-xs sm:text-sm text-primary-800 dark:text-primary-300 flex items-center gap-2">
                  <span>👉</span>
                  <span>اسحب الجدول يميناً ويساراً لرؤية جميع البيانات</span>
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-x-auto mb-4 sm:mb-6 border dark:border-gray-700">
              {viewMode === 'daily' ? (
              /* عرض تفاصيل اليوم المحدد مباشرة */
              dailyData.length > 0 ? (
                <div className="p-6 space-y-6">
                  {dailyData.map((day) => (
                    <div key={day.date} className="space-y-4">
                      {/* معلومات اليوم */}
                      <div className="bg-gradient-to-r from-primary-500 to-primary-600 dark:from-primary-700 dark:to-primary-800 text-white p-4 rounded-lg shadow-lg">
                        <h2 className="text-2xl font-bold mb-2">
                          📅 {new Date(day.date).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                          <div className="bg-white/20 dark:bg-gray-800/20 p-3 rounded-lg">
                            <p className="text-sm opacity-90">{t('closing.table.floor')}</p>
                            <p className="text-xl font-bold">{day.floor > 0 ? day.floor.toFixed(0) : '0'} {t('closing.currency')}</p>
                          </div>
                          <div className="bg-white/20 dark:bg-gray-800/20 p-3 rounded-lg">
                            <p className="text-sm opacity-90">{t('closing.table.pt')}</p>
                            <p className="text-xl font-bold">{day.pt > 0 ? day.pt.toFixed(0) : '0'} {t('closing.currency')}</p>
                          </div>
                          <div className="bg-white/20 dark:bg-gray-800/20 p-3 rounded-lg">
                            <p className="text-sm opacity-90">{t('closing.table.expenses')}</p>
                            <p className="text-xl font-bold">{day.expenses > 0 ? day.expenses.toFixed(0) : '0'} {t('closing.currency')}</p>
                          </div>
                          <div className="bg-white/20 dark:bg-gray-800/20 p-3 rounded-lg">
                            <p className="text-sm opacity-90">{t('closing.table.total')}</p>
                            <p className="text-xl font-bold">{((day.floor + day.pt) - day.expenses).toFixed(0)} {t('closing.currency')}</p>
                          </div>
                        </div>
                      </div>

                      {/* طرق الدفع */}
                      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border dark:border-gray-600">
                        <h3 className="font-bold text-lg mb-3 dark:text-white">💳 {t('closing.paymentMethods.title')}</h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border-2 border-green-200 dark:border-green-700">
                            <p className="text-sm text-gray-600 dark:text-gray-300">{t('closing.paymentMethods.cash')} 💵</p>
                            <p className="text-lg font-bold text-green-600 dark:text-green-400">{day.cash > 0 ? day.cash.toFixed(0) : '0'}</p>
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                              <p className="text-xs text-gray-500 dark:text-gray-400">{t('closing.paymentMethods.netCash')}</p>
                              <p className="text-sm font-bold text-orange-600 dark:text-orange-400">{(day.cash - day.expenses).toFixed(0)} {t('closing.currency')}</p>
                            </div>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border-2 border-primary-200 dark:border-primary-700">
                            <p className="text-sm text-gray-600 dark:text-gray-300">{t('closing.paymentMethods.visa')} 💳</p>
                            <p className="text-lg font-bold text-primary-600 dark:text-primary-400">{day.visa > 0 ? day.visa.toFixed(0) : '0'}</p>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border-2 border-primary-200 dark:border-primary-700">
                            <p className="text-sm text-gray-600 dark:text-gray-300">{t('closing.paymentMethods.instapay')} 📱</p>
                            <p className="text-lg font-bold text-primary-600 dark:text-primary-400">{day.instapay > 0 ? day.instapay.toFixed(0) : '0'}</p>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border-2 border-orange-200 dark:border-orange-700">
                            <p className="text-sm text-gray-600 dark:text-gray-300">{t('closing.paymentMethods.wallet')} 💰</p>
                            <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{day.wallet > 0 ? day.wallet.toFixed(0) : '0'}</p>
                          </div>
                          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border-2 border-yellow-200 dark:border-yellow-700">
                            <p className="text-sm text-gray-600 dark:text-gray-300">{t('closing.paymentMethods.points')} 🏆</p>
                            <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{day.points > 0 ? day.points.toFixed(0) : '0'}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {t('closing.pointsValueLabel')}: {(day.points * pointsValueInEGP).toFixed(2)} {t('common.egp')}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* السلف */}
                      {Object.keys(day.staffLoans).length > 0 && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/30 p-4 rounded-lg border-2 border-yellow-200 dark:border-yellow-700">
                          <h3 className="font-bold text-lg mb-3 dark:text-white">💰 {t('closing.staffLoans.title')}</h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {Object.entries(day.staffLoans).map(([staffName, amount]) => (
                              <div key={staffName} className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
                                <p className="text-sm text-gray-600 dark:text-gray-300">{staffName}</p>
                                <p className="text-lg font-bold text-red-600 dark:text-red-400">{amount.toFixed(0)} {t('closing.currency')}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* الإيصالات */}
                      {day.receipts.length > 0 ? (
                        <div>
                          <h4 className="font-bold text-lg mb-3 flex items-center gap-2 dark:text-white">
                            <span>🧾</span>
                            <span>{t('closing.receipts.count', { count: day.receipts.length.toString() })}</span>
                          </h4>
                          <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden border-2 border-primary-200 dark:border-primary-700">
                            <table className="w-full text-sm">
                              <thead className="bg-primary-100 dark:bg-primary-900/50">
                                <tr>
                                  <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} dark:text-gray-200`}>{t('closing.receipts.time')}</th>
                                  <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} dark:text-gray-200`}>{t('closing.receipts.receiptNumber')}</th>
                                  <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} dark:text-gray-200`}>{t('closing.receipts.type')}</th>
                                  <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} dark:text-gray-200`}>{t('closing.receipts.details')}</th>
                                  <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} dark:text-gray-200`}>{t('closing.receipts.amount')}</th>
                                  <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} dark:text-gray-200`}>{t('closing.receipts.paymentMethod')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {day.receipts.map((receipt: any) => {
                                  const details = JSON.parse(receipt.itemDetails)
                                  return (
                                    <tr key={receipt.id} className="border-t dark:border-gray-700 hover:bg-primary-50 dark:hover:bg-primary-900/20">
                                      <td className="px-3 py-2 font-mono text-xs dark:text-gray-300">
                                        {new Date(receipt.createdAt).toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                                      </td>
                                      <td className="px-3 py-2 font-bold text-green-600 dark:text-green-400">
                                        #{receipt.receiptNumber}
                                      </td>
                                      <td className="px-3 py-2">
                                        <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-300 rounded text-xs">
                                          {getTypeLabel(receipt.type)}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 dark:text-gray-300">
                                        {details.memberName && (
                                          <div>
                                            {details.memberName}
                                            {details.memberNumber && (
                                              <span className="text-xs text-gray-600 dark:text-gray-400"> (#{details.memberNumber})</span>
                                            )}
                                          </div>
                                        )}
                                        {details.clientName && <div>{details.clientName}</div>}
                                        {details.name && <div>{details.name}</div>}
                                      </td>
                                      <td className="px-3 py-2 font-bold text-green-600 dark:text-green-400">
                                        {receipt.amount} {t('closing.currency')}
                                      </td>
                                      <td className="px-3 py-2">
                                        <span className="text-xs">
                                          {getPaymentMethodLabel(receipt.paymentMethod)}
                                        </span>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 dark:bg-gray-700 p-8 rounded-lg text-center border dark:border-gray-600">
                          <p className="text-gray-500 dark:text-gray-400 text-lg">📭 {t('closing.receipts.noReceipts')}</p>
                        </div>
                      )}

                      {/* المصروفات */}
                      {day.expensesList.length > 0 ? (
                        <div>
                          <h4 className="font-bold text-lg mb-3 flex items-center gap-2 dark:text-white">
                            <span>💸</span>
                            <span>{t('closing.expenses.count', { count: day.expensesList.length.toString() })}</span>
                          </h4>
                          <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden border-2 border-red-200 dark:border-red-700">
                            <table className="w-full text-sm">
                              <thead className="bg-red-100 dark:bg-red-900/50">
                                <tr>
                                  <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} dark:text-gray-200`}>{t('closing.expenses.time')}</th>
                                  <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} dark:text-gray-200`}>{t('closing.expenses.type')}</th>
                                  <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} dark:text-gray-200`}>{t('closing.expenses.description')}</th>
                                  <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} dark:text-gray-200`}>{t('closing.expenses.staff')}</th>
                                  <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} dark:text-gray-200`}>{t('closing.expenses.amount')}</th>
                                  <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} dark:text-gray-200`}>{t('closing.expenses.status')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {day.expensesList.map((expense: any) => (
                                  <tr key={expense.id} className="border-t dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20">
                                    <td className="px-3 py-2 font-mono text-xs dark:text-gray-300">
                                      {new Date(expense.createdAt).toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span className={`px-2 py-1 rounded text-xs ${
                                        expense.type === 'gym_expense'
                                          ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300'
                                          : 'bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-300'
                                      }`}>
                                        {expense.type === 'gym_expense' ? t('closing.expenses.gymExpense') : t('closing.expenses.staffLoan')}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 dark:text-gray-300">{expense.description}</td>
                                    <td className="px-3 py-2 dark:text-gray-300">
                                      {expense.staff ? expense.staff.name : '-'}
                                    </td>
                                    <td className="px-3 py-2 font-bold text-red-600 dark:text-red-400">
                                      {expense.amount} {t('closing.currency')}
                                    </td>
                                    <td className="px-3 py-2">
                                      {expense.type === 'staff_loan' && (
                                        <span className={`px-2 py-1 rounded text-xs ${
                                          expense.isPaid
                                            ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300'
                                            : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'
                                        }`}>
                                          {expense.isPaid ? `✅ ${t('closing.expenses.paid')}` : `❌ ${t('closing.expenses.unpaid')}`}
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
                        <div className="bg-gray-50 dark:bg-gray-700 p-8 rounded-lg text-center border dark:border-gray-600">
                          <p className="text-gray-500 dark:text-gray-400 text-lg">📭 {t('closing.expenses.noExpenses')}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-gray-500 dark:text-gray-400 text-lg">📭 {t('closing.noData')}</p>
                </div>
              )
            ) : (
              /* الجدول العادي للعرض الشهري */
            <table className="w-full border-collapse text-sm excel-table">
              <thead className="bg-gray-200 dark:bg-gray-700">
                <tr className="border-2 border-gray-400 dark:border-gray-600">
                  <th className="border border-gray-400 dark:border-gray-600 px-3 py-2 text-center font-bold text-gray-900 dark:text-gray-200 bg-gray-100 dark:bg-gray-700">{t('closing.table.date')}</th>
                  <th className="border border-gray-400 dark:border-gray-600 px-3 py-2 text-center font-bold text-gray-900 dark:text-gray-200 bg-primary-100 dark:bg-primary-900/50">{t('closing.table.floor')}</th>
                  <th className="border border-gray-400 dark:border-gray-600 px-3 py-2 text-center font-bold text-gray-900 dark:text-gray-200 bg-red-100 dark:bg-red-900/50">💰 {direction === 'rtl' ? 'الفلوس الباقية' : 'Remaining'}</th>
                  <th className="border border-gray-400 dark:border-gray-600 px-3 py-2 text-center font-bold text-gray-900 dark:text-gray-200 bg-green-100 dark:bg-green-900/50">{t('closing.table.pt')}</th>
                  <th className="border border-gray-400 dark:border-gray-600 px-3 py-2 text-center font-bold text-gray-900 dark:text-gray-200 bg-green-50 dark:bg-green-900/30">{t('closing.table.cash')} 💵</th>
                  <th className="border border-gray-400 dark:border-gray-600 px-3 py-2 text-center font-bold text-gray-900 dark:text-gray-200 bg-primary-50 dark:bg-primary-900/30">{t('closing.table.visa')} 💳</th>
                  <th className="border border-gray-400 dark:border-gray-600 px-3 py-2 text-center font-bold text-gray-900 dark:text-gray-200 bg-primary-50 dark:bg-primary-900/30">{t('closing.table.instapay')} 📱</th>
                  <th className="border border-gray-400 dark:border-gray-600 px-3 py-2 text-center font-bold text-gray-900 dark:text-gray-200 bg-orange-50 dark:bg-orange-900/30">{t('closing.table.wallet')} 💰</th>
                  <th className="border border-gray-400 dark:border-gray-600 px-3 py-2 text-center font-bold text-gray-900 dark:text-gray-200 bg-yellow-50 dark:bg-yellow-900/30">{t('closing.table.points')} 🏆</th>
                  <th className="border border-gray-400 dark:border-gray-600 px-3 py-2 text-center font-bold text-gray-900 dark:text-gray-200 bg-yellow-100 dark:bg-yellow-900/50">{t('closing.table.total')} 💰</th>
                  <th className="border border-gray-400 dark:border-gray-600 px-3 py-2 text-center font-bold text-gray-900 dark:text-gray-200 bg-orange-100 dark:bg-orange-900/50">{t('closing.table.expenses')}</th>
                  <th className="border border-gray-400 dark:border-gray-600 px-3 py-2 text-center font-bold text-gray-900 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 min-w-[300px]">{t('closing.table.expenseDetails')}</th>
                  <th className="border border-gray-400 dark:border-gray-600 px-3 py-2 text-center font-bold text-gray-900 dark:text-gray-200 bg-yellow-50 dark:bg-yellow-900/30">{t('closing.table.loans')}</th>
                  {(staffList || []).map(staff => (
                    <th key={staff.id} className="border border-gray-400 dark:border-gray-600 px-3 py-2 text-center font-bold text-gray-900 dark:text-gray-200 bg-red-50 dark:bg-red-900/30 min-w-[80px]">
                      {staff.name}
                    </th>
                  ))}
                  <th className="border border-gray-400 dark:border-gray-600 px-3 py-2 text-center font-bold text-gray-900 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 no-print">{t('closing.table.details')}</th>
                </tr>
              </thead>
              <tbody>
                {dailyData.map((day, index) => (
                  <React.Fragment key={day.date}>
                    <tr
                      className={`${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'} cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/20`}
                      onClick={() => toggleDayDetails(day.date)}
                    >
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center font-mono dark:text-gray-200">
                        {new Date(day.date).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                      </td>
                      <td className={`border border-gray-300 dark:border-gray-600 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-primary-600 dark:text-primary-400`}>
                        {day.floor > 0 ? day.floor.toFixed(0) : '-'}
                      </td>
                      <td className={`border border-gray-300 dark:border-gray-600 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-red-600 dark:text-red-400`}>
                        {day.remainingAmount > 0 ? day.remainingAmount.toFixed(0) : '-'}
                      </td>
                      <td className={`border border-gray-300 dark:border-gray-600 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-green-600 dark:text-green-400`}>
                        {day.pt > 0 ? day.pt.toFixed(0) : '-'}
                      </td>
                      <td className={`border border-gray-300 dark:border-gray-600 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-green-700 dark:text-green-400`}>
                        {day.cash > 0 ? day.cash.toFixed(0) : '-'}
                      </td>
                      <td className={`border border-gray-300 dark:border-gray-600 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-primary-700 dark:text-primary-400`}>
                        {day.visa > 0 ? day.visa.toFixed(0) : '-'}
                      </td>
                      <td className={`border border-gray-300 dark:border-gray-600 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-primary-700 dark:text-primary-400`}>
                        {day.instapay > 0 ? day.instapay.toFixed(0) : '-'}
                      </td>
                      <td className={`border border-gray-300 dark:border-gray-600 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-orange-700 dark:text-orange-400`}>
                        {day.wallet > 0 ? day.wallet.toFixed(0) : '-'}
                      </td>
                      <td className={`border border-gray-300 dark:border-gray-600 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-yellow-600 dark:text-yellow-400`}>
                        {day.points > 0 ? day.points.toFixed(0) : '-'}
                      </td>
                      <td className={`border border-gray-300 dark:border-gray-600 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30`}>
                        {(day.cash + day.visa + day.instapay + day.wallet + day.points).toFixed(0)}
                      </td>
                      <td className={`border border-gray-300 dark:border-gray-600 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-red-600 dark:text-red-400`}>
                        {day.expenses > 0 ? day.expenses.toFixed(0) : '-'}
                      </td>
                      <td className={`border border-gray-300 dark:border-gray-600 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} text-xs dark:text-gray-300`}>
                        {day.expenseDetails || '-'}
                      </td>
                      <td className={`border border-gray-300 dark:border-gray-600 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} font-bold text-orange-600 dark:text-orange-400`}>
                        {Object.values(day.staffLoans).reduce((a, b) => a + b, 0).toFixed(0) || '-'}
                      </td>
                      {(staffList || []).map(staff => (
                        <td key={staff.id} className={`border border-gray-300 dark:border-gray-600 px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} text-red-600 dark:text-red-400`}>
                          {day.staffLoans[staff.name] ? day.staffLoans[staff.name].toFixed(0) : '-'}
                        </td>
                      ))}
                      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center no-print">
                        <button className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-bold">
                          {expandedDay === day.date ? `▼ ${t('closing.buttons.hide')}` : `▶ ${t('closing.buttons.show')}`}
                        </button>
                      </td>
                    </tr>

                    {/* تفاصيل اليوم */}
                    {expandedDay === day.date && (
                      <tr className="bg-primary-50 dark:bg-primary-900/30 no-print">
                        <td colSpan={(staffList?.length || 0) + 17} className="border border-gray-400 dark:border-gray-600 p-4">
                          <div className="space-y-4">
                            {/* الإيصالات */}
                            {day.receipts.length > 0 && (
                              <div>
                                <h4 className="font-bold text-lg mb-3 flex items-center gap-2 dark:text-white">
                                  <span>🧾</span>
                                  <span>{t('closing.receipts.count', { count: day.receipts.length.toString() })}</span>
                                </h4>
                                <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden border-2 border-primary-200 dark:border-primary-700">
                                  <table className="w-full text-sm">
                                    <thead className="bg-primary-100 dark:bg-primary-900/50">
                                      <tr>
                                        <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} dark:text-gray-200`}>{t('closing.receipts.time')}</th>
                                        <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} dark:text-gray-200`}>{t('closing.receipts.receiptNumber')}</th>
                                        <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} dark:text-gray-200`}>{t('closing.receipts.type')}</th>
                                        <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} dark:text-gray-200`}>{t('closing.receipts.details')}</th>
                                        <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} dark:text-gray-200`}>{t('closing.receipts.amount')}</th>
                                        <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} dark:text-gray-200`}>{t('closing.receipts.paymentMethod')}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {day.receipts.map((receipt: any) => {
                                        const details = JSON.parse(receipt.itemDetails)
                                        return (
                                          <tr key={receipt.id} className="border-t dark:border-gray-700 hover:bg-primary-50 dark:hover:bg-primary-900/20">
                                            <td className="px-3 py-2 font-mono text-xs dark:text-gray-300">
                                              {new Date(receipt.createdAt).toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                                            </td>
                                            <td className="px-3 py-2 font-bold text-green-600 dark:text-green-400">
                                              #{receipt.receiptNumber}
                                            </td>
                                            <td className="px-3 py-2">
                                              <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-300 rounded text-xs">
                                                {getTypeLabel(receipt.type)}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 dark:text-gray-300">
                                              {details.memberName && (
                                                <div>
                                                  {details.memberName}
                                                  {details.memberNumber && (
                                                    <span className="text-xs text-gray-600 dark:text-gray-400"> (#{details.memberNumber})</span>
                                                  )}
                                                </div>
                                              )}
                                              {details.clientName && <div>{details.clientName}</div>}
                                              {details.name && <div>{details.name}</div>}
                                            </td>
                                            <td className="px-3 py-2 font-bold text-green-600 dark:text-green-400">
                                              {receipt.amount} {t('closing.currency')}
                                            </td>
                                            <td className="px-3 py-2">
                                              <span className="text-xs">
                                                {getPaymentMethodLabel(receipt.paymentMethod)}
                                              </span>
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
                                <h4 className="font-bold text-lg mb-3 flex items-center gap-2 dark:text-white">
                                  <span>💸</span>
                                  <span>{t('closing.expenses.count', { count: day.expensesList.length.toString() })}</span>
                                </h4>
                                <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden border-2 border-red-200 dark:border-red-700">
                                  <table className="w-full text-sm">
                                    <thead className="bg-red-100 dark:bg-red-900/50">
                                      <tr>
                                        <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} dark:text-gray-200`}>{t('closing.expenses.time')}</th>
                                        <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} dark:text-gray-200`}>{t('closing.expenses.type')}</th>
                                        <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} dark:text-gray-200`}>{t('closing.expenses.description')}</th>
                                        <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} dark:text-gray-200`}>{t('closing.expenses.staff')}</th>
                                        <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} dark:text-gray-200`}>{t('closing.expenses.amount')}</th>
                                        <th className={`px-3 py-2 text-${direction === 'rtl' ? 'right' : 'left'} dark:text-gray-200`}>{t('closing.expenses.status')}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {day.expensesList.map((expense: any) => (
                                        <tr key={expense.id} className="border-t dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20">
                                          <td className="px-3 py-2 font-mono text-xs dark:text-gray-300">
                                            {new Date(expense.createdAt).toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                                          </td>
                                          <td className="px-3 py-2">
                                            <span className={`px-2 py-1 rounded text-xs ${
                                              expense.type === 'gym_expense'
                                                ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300'
                                                : 'bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-300'
                                            }`}>
                                              {expense.type === 'gym_expense' ? t('closing.expenses.gymExpense') : t('closing.expenses.staffLoan')}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 dark:text-gray-300">{expense.description}</td>
                                          <td className="px-3 py-2 dark:text-gray-300">
                                            {expense.staff ? expense.staff.name : '-'}
                                          </td>
                                          <td className="px-3 py-2 font-bold text-red-600 dark:text-red-400">
                                            {expense.amount} {t('closing.currency')}
                                          </td>
                                          <td className="px-3 py-2">
                                            {expense.type === 'staff_loan' && (
                                              <span className={`px-2 py-1 rounded text-xs ${
                                                expense.isPaid
                                                  ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300'
                                                  : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'
                                              }`}>
                                                {expense.isPaid ? `✅ ${t('closing.expenses.paid')}` : `❌ ${t('closing.expenses.unpaid')}`}
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
                <tr className="bg-yellow-100 dark:bg-yellow-900/50 border-t-4 border-yellow-600 dark:border-yellow-700 font-bold">
                  <td className="border border-gray-400 dark:border-gray-600 px-3 py-3 text-center dark:text-gray-200">{t('closing.table.totalLabel')}</td>
                  <td className={`border border-gray-400 dark:border-gray-600 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-primary-700 dark:text-primary-400 text-lg`}>
                    {totals.floor.toFixed(0)}
                  </td>
                  <td className={`border border-gray-400 dark:border-gray-600 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-red-700 dark:text-red-400 text-lg`}>
                    {totals.remainingAmount.toFixed(0)}
                  </td>
                  <td className={`border border-gray-400 dark:border-gray-600 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-green-700 dark:text-green-400 text-lg`}>
                    {totals.pt.toFixed(0)}
                  </td>
                  <td className={`border border-gray-400 dark:border-gray-600 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-green-800 dark:text-green-400 text-lg`}>
                    {totals.cash.toFixed(0)}
                  </td>
                  <td className={`border border-gray-400 dark:border-gray-600 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-primary-800 dark:text-primary-400 text-lg`}>
                    {totals.visa.toFixed(0)}
                  </td>
                  <td className={`border border-gray-400 dark:border-gray-600 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-primary-800 dark:text-primary-400 text-lg`}>
                    {totals.instapay.toFixed(0)}
                  </td>
                  <td className={`border border-gray-400 dark:border-gray-600 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-orange-800 dark:text-orange-400 text-lg`}>
                    {totals.wallet.toFixed(0)}
                  </td>
                  <td className={`border border-gray-400 dark:border-gray-600 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-yellow-700 dark:text-yellow-400 text-lg`}>
                    {totals.points.toFixed(0)}
                  </td>
                  <td className={`border border-gray-400 dark:border-gray-600 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-yellow-800 dark:text-yellow-400 text-lg bg-yellow-200 dark:bg-yellow-900/50`}>
                    {totals.totalPayments.toFixed(0)}
                  </td>
                  <td className={`border border-gray-400 dark:border-gray-600 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-red-700 dark:text-red-400 text-lg`}>
                    {totals.expenses.toFixed(0)}
                  </td>
                  <td className="border border-gray-400 dark:border-gray-600 px-3 py-3"></td>
                  <td className={`border border-gray-400 dark:border-gray-600 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-orange-700 dark:text-orange-400 text-lg`}>
                    {dailyData.reduce((sum, day) =>
                      sum + Object.values(day.staffLoans).reduce((a, b) => a + b, 0), 0
                    ).toFixed(0)}
                  </td>
                  {(staffList || []).map(staff => {
                    const total = dailyData.reduce((sum, day) =>
                      sum + (day.staffLoans[staff.name] || 0), 0
                    )
                    return (
                      <td key={staff.id} className={`border border-gray-400 dark:border-gray-600 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-red-700 dark:text-red-400`}>
                        {total > 0 ? total.toFixed(0) : '-'}
                      </td>
                    )
                  })}
                  <td className="border border-gray-400 dark:border-gray-600 px-3 py-3 no-print"></td>
                </tr>

                {/* Net Profit Row */}
                <tr className="bg-green-100 dark:bg-green-900/50 border-t-2 border-green-600 dark:border-green-700 font-bold">
                  <td colSpan={8} className="border border-gray-400 dark:border-gray-600 px-3 py-3 text-center text-lg dark:text-gray-200">
                    {t('closing.stats.netProfit')}
                  </td>
                  <td colSpan={(staffList?.length || 0) + 9} className={`border border-gray-400 dark:border-gray-600 px-3 py-3 text-${direction === 'rtl' ? 'right' : 'left'} text-2xl text-green-700 dark:text-green-400`}>
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

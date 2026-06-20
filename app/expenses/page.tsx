'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { usePermissions } from '../../hooks/usePermissions'
import { useLanguage } from '../../contexts/LanguageContext'
import PermissionDenied from '../../components/PermissionDenied'
import { useAdminDate } from '../../contexts/AdminDateContext'
import { useToast } from '../../contexts/ToastContext'
import { fetchExpenses } from '../../lib/api/expenses'
import { fetchStaff } from '../../lib/api/staff'
import { LoadingScreen } from '../../components/Spinner'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface Staff {
  id: string
  name: string
}

interface Expense {
  id: string
  type: string
  amount: number
  description: string
  notes?: string
  isPaid: boolean
  createdAt: string
  staff?: Staff
}

export default function ExpensesPage() {
  const router = useRouter()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const { t, direction } = useLanguage()
  const { customCreatedAt } = useAdminDate()
  const toast = useToast()

  const {
    data: expenses = [],
    isLoading: loading,
    error: expensesError,
    refetch: refetchExpenses
  } = useQuery({
    queryKey: ['expenses'],
    queryFn: fetchExpenses,
    enabled: !permissionsLoading && hasPermission('canViewFinancials'),
    retry: 1,
    staleTime: 2 * 60 * 1000,
  })

  const {
    data: staffList = [],
  } = useQuery({
    queryKey: ['staff'],
    queryFn: fetchStaff,
    enabled: !permissionsLoading,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  })

  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'gym_expense' | 'staff_loan' | 'staff_salary'>('all')
  // بحث بالاسم (الوصف) أو بالمبلغ
  const [searchQuery, setSearchQuery] = useState('')
  // فلتر التاريخ — 'all' / 'month' / 'day'
  const [dateFilterMode, setDateFilterMode] = useState<'all' | 'month' | 'day'>('all')
  const [dateFilterValue, setDateFilterValue] = useState<string>('') // YYYY-MM للشهر، YYYY-MM-DD لليوم
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; expenseId: string | null; expenseName: string }>({
    show: false,
    expenseId: null,
    expenseName: ''
  })
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [showLoansModal, setShowLoansModal] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const [formData, setFormData] = useState({
    type: 'gym_expense' as 'gym_expense' | 'staff_loan' | 'staff_salary',
    amount: 0,
    description: '',
    notes: '',
    staffId: '',
    createdAt: '',
    paymentMethod: 'cash' as 'cash' | 'instapay' | 'wallet', //  البنك اللي بنخصم منه
  })

  // Error handling for expenses query
  useEffect(() => {
    if (expensesError) {
      const errorMessage = (expensesError as Error).message
      if (errorMessage === 'UNAUTHORIZED') {
        toast.error('يجب تسجيل الدخول أولاً')
        setTimeout(() => router.push('/login'), 2000)
      } else if (errorMessage === 'FORBIDDEN') {
        toast.error('ليس لديك صلاحية عرض المصروفات')
      } else {
        toast.error(errorMessage || 'حدث خطأ أثناء جلب المصروفات')
      }
    }
  }, [expensesError, toast, router])

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense)
    setFormData({
      type: expense.type as 'gym_expense' | 'staff_loan',
      amount: expense.amount,
      description: expense.description,
      notes: expense.notes || '',
      staffId: expense.staff?.id || '',
      createdAt: new Date(expense.createdAt).toISOString().split('T')[0],
      paymentMethod: ((expense as any).paymentMethod || 'cash') as 'cash' | 'instapay' | 'wallet',
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      // إذا كان تعديل، استخدم handleUpdate
      if (editingExpense) {
        await handleUpdate()
        return
      }

      // إذا كانت سلفة أو مرتب، نملي الوصف تلقائياً لو الـ user ساب الحقل فاضي
      const dataToSend: any = { ...formData }
      if (!dataToSend.description || !dataToSend.description.trim()) {
        const selectedStaff = formData.staffId
          ? staffList.find(s => s.id === formData.staffId)
          : null
        if (formData.type === 'staff_salary') {
          dataToSend.description = selectedStaff ? `مرتب: ${selectedStaff.name}` : 'مرتب'
        } else if (formData.type === 'staff_loan' && selectedStaff) {
          dataToSend.description = selectedStaff.name
        }
      }

      // إضافة التاريخ المخصص إذا كان مفعّل
      if (customCreatedAt) {
        dataToSend.customCreatedAt = customCreatedAt.toISOString()
      }

      const response = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      })

      if (response.ok) {
        setFormData({
          type: 'gym_expense',
          amount: 0,
          description: '',
          notes: '',
          staffId: '',
          createdAt: '',
          paymentMethod: 'cash',
        })

        toast.success(t('expenses.messages.addSuccess'))
        refetchExpenses()
        setShowForm(false)
      } else {
        toast.error(t('expenses.messages.addError'))
      }
    } catch (error) {
      console.error(error)
      toast.error(t('expenses.messages.error'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingExpense) return

    try {
      const dataToSend: any = {
        id: editingExpense.id,
        amount: formData.amount,
        description: formData.description,
        createdAt: formData.createdAt,
        paymentMethod: formData.paymentMethod, //  البنك اللي اتخصم منه
      }

      const response = await fetch('/api/expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      })

      if (response.ok) {
        setFormData({
          type: 'gym_expense',
          amount: 0,
          description: '',
          notes: '',
          staffId: '',
          createdAt: '',
          paymentMethod: 'cash',
        })
        setEditingExpense(null)
        toast.success(t('expenses.messages.updateSuccess'))
        refetchExpenses()
        setShowForm(false)
      } else {
        toast.error(t('expenses.messages.updateError'))
      }
    } catch (error) {
      console.error(error)
      toast.error(t('expenses.messages.error'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = (expense: Expense) => {
    setDeleteConfirm({
      show: true,
      expenseId: expense.id,
      expenseName: expense.description
    })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm.expenseId) return

    try {
      await fetch(`/api/expenses?id=${deleteConfirm.expenseId}`, { method: 'DELETE' })
      refetchExpenses()
      toast.success(t('expenses.messages.deleteSuccess'))
    } catch (error) {
      console.error('Error:', error)
      toast.error(t('expenses.messages.deleteError'))
    } finally {
      setDeleteConfirm({ show: false, expenseId: null, expenseName: '' })
    }
  }

  const cancelDelete = () => {
    setDeleteConfirm({ show: false, expenseId: null, expenseName: '' })
  }

  const togglePaid = async (expense: Expense) => {
    try {
      await fetch('/api/expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: expense.id, isPaid: !expense.isPaid }),
      })
      refetchExpenses()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const filteredExpenses = (() => {
    let list = filterType === 'all' ? expenses : expenses.filter(e => e.type === filterType)

    // search — يطابق الوصف (اسم/notes) أو المبلغ
    const q = searchQuery.trim()
    if (q) {
      const qLower = q.toLowerCase()
      const numericQ = Number(q)
      const isNumeric = !isNaN(numericQ) && q !== ''
      list = list.filter(e => {
        const desc = (e.description || '').toLowerCase()
        const notes = (e.notes || '').toLowerCase()
        const staffName = (e.staff?.name || '').toLowerCase()
        if (desc.includes(qLower) || notes.includes(qLower) || staffName.includes(qLower)) return true
        if (isNumeric && Number(e.amount) === numericQ) return true
        return false
      })
    }

    // date filter — month أو day
    if (dateFilterMode !== 'all' && dateFilterValue) {
      list = list.filter(e => {
        const d = new Date(e.createdAt)
        if (dateFilterMode === 'month') {
          // dateFilterValue = "YYYY-MM"
          const [y, m] = dateFilterValue.split('-').map(Number)
          return d.getFullYear() === y && d.getMonth() === m - 1
        } else {
          // day — dateFilterValue = "YYYY-MM-DD"
          const [y, m, day] = dateFilterValue.split('-').map(Number)
          return d.getFullYear() === y && d.getMonth() === m - 1 && d.getDate() === day
        }
      })
    }

    // ترتيب: الأحدث أولاً حسب التاريخ
    return [...list].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  })()

  // فلترة المصروفات للشهر الحالي فقط للإحصائيات
  const currentMonthExpenses = expenses.filter(expense => {
    const expenseDate = new Date(expense.createdAt)
    const now = new Date()
    return expenseDate.getMonth() === now.getMonth() &&
           expenseDate.getFullYear() === now.getFullYear()
  })

  // حساب سلف كل موظف للشهر المختار
  const getStaffLoansGrouped = () => {
    const loansMap = new Map<string, { staffName: string; total: number }>()

    // فلترة المصروفات للشهر والسنة المختارة
    const selectedMonthExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.createdAt)
      return expenseDate.getMonth() === selectedMonth &&
             expenseDate.getFullYear() === selectedYear
    })

    selectedMonthExpenses
      .filter(e => e.type === 'staff_loan' && e.staff)
      .forEach(expense => {
        const staffName = expense.staff!.name
        const current = loansMap.get(staffName) || { staffName, total: 0 }
        loansMap.set(staffName, {
          staffName,
          total: current.total + expense.amount
        })
      })

    return Array.from(loansMap.values()).sort((a, b) => b.total - a.total)
  }

  // حساب إجمالي السلف للشهر المختار
  const getSelectedMonthTotalLoans = () => {
    const selectedMonthExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.createdAt)
      return expenseDate.getMonth() === selectedMonth &&
             expenseDate.getFullYear() === selectedYear
    })

    return selectedMonthExpenses
      .filter(e => e.type === 'staff_loan')
      .reduce((sum, e) => sum + e.amount, 0)
  }

  const getTotalExpenses = () => {
    return filteredExpenses.reduce((sum, e) => sum + e.amount, 0)
  }

  const getTypeLabel = (type: string) => {
    if (type === 'gym_expense') return t('expenses.types.gymExpense')
    if (type === 'staff_salary') return t('expenses.types.staffSalary')
    return t('expenses.types.staffLoan')
  }

  const getTypeColor = (type: string) => {
    if (type === 'gym_expense') return 'bg-orange-100 text-orange-800'
    if (type === 'staff_salary') return 'bg-violet-100 text-violet-800'
    return 'bg-primary-100 text-primary-800'
  }

  // التحقق من الصلاحيات
  if (permissionsLoading) {
    return <LoadingScreen fullScreen message={t('expenses.loading')} />
  }

  if (!hasPermission('canViewFinancials')) {
    return <PermissionDenied message={t('expenses.noPermission')} />
  }

  return (
    <div className="container mx-auto px-4 py-6 md:px-6" dir={direction}>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <svg className="w-7 h-7 text-orange-500" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
            <span>{t('expenses.title')}</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('expenses.subtitle')}</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setShowLoansModal(true)}
            className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2.5 rounded-lg font-bold transition-colors duration-200"
          >
            <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            {t('expenses.loansButton')}
          </button>
          <button
            onClick={() => {
              setEditingExpense(null)
              setFormData({
                type: 'gym_expense',
                amount: 0,
                description: '',
                notes: '',
                staffId: '',
                createdAt: '',
                paymentMethod: 'cash',
              })
              setShowForm(true)
            }}
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
            {t('expenses.addExpense')}
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6" dir={direction}>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('expenses.stats.totalExpenses')}</div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0)} {t('members.egp')}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                {t('expenses.stats.currentMonth')}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 flex items-center justify-center">
              <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('expenses.stats.gymExpenses')}</div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {currentMonthExpenses.filter(e => e.type === 'gym_expense').reduce((sum, e) => sum + e.amount, 0)} {t('members.egp')}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                {t('expenses.stats.currentMonth')}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 flex items-center justify-center">
              <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/></svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('expenses.stats.staffLoans')}</div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {currentMonthExpenses.filter(e => e.type === 'staff_loan').reduce((sum, e) => sum + e.amount, 0)} {t('members.egp')}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                {t('expenses.stats.currentMonth')}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center">
              <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('expenses.types.staffSalary')}</div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {currentMonthExpenses.filter(e => e.type === 'staff_salary').reduce((sum, e) => sum + e.amount, 0)} {t('members.egp')}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                {t('expenses.stats.currentMonth')}
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 flex items-center justify-center">
              <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
            </div>
          </div>
        </div>
      </div>

      {/* Form - Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowForm(false); setEditingExpense(null) } }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="expense-form-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto animate-modal-in" dir={direction} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 id="expense-form-title" className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                {editingExpense ? (
                  <>
                    <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    {direction === 'rtl' ? 'تعديل المصروف' : 'Edit Expense'}
                  </>
                ) : (
                  t('expenses.form.title')
                )}
              </h2>
              <button
                onClick={() => { setShowForm(false); setEditingExpense(null) }}
                aria-label={direction === 'rtl' ? 'إغلاق' : 'Close'}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors duration-200"
              >
                <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* نوع المصروف */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('expenses.form.expenseType')}</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any, staffId: '' })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  required
                  disabled={!!editingExpense}
                >
                  <option value="gym_expense">{t('expenses.types.gymExpense')}</option>
                  <option value="staff_loan">{t('expenses.types.staffLoan')}</option>
                  <option value="staff_salary">{t('expenses.types.staffSalary')}</option>
                </select>
              </div>

              {formData.type === 'staff_loan' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('expenses.form.staff')}</label>
                  <select
                    value={formData.staffId}
                    onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                    required
                    disabled={!!editingExpense}
                  >
                    <option value="">{t('expenses.form.selectStaff')}</option>
                    {(staffList || []).map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formData.type === 'staff_salary' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('expenses.form.staff')} <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">({direction === 'rtl' ? 'اختياري' : 'optional'})</span>
                  </label>
                  <select
                    value={formData.staffId}
                    onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                    disabled={!!editingExpense}
                  >
                    <option value="">{direction === 'rtl' ? '— بدون اختيار موظف —' : '— No staff selected —'}</option>
                    {(staffList || []).map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* المبلغ */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('expenses.form.amount')}</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  placeholder={t('expenses.form.amountPlaceholder')}
                />
              </div>

              {/* الوصف */}
              {formData.type === 'gym_expense' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('expenses.form.description')}</label>
                  <input
                    type="text"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                    placeholder={t('expenses.form.descriptionPlaceholder')}
                  />
                </div>
              )}

              {/* التاريخ - يظهر فقط في وضع التعديل */}
              {editingExpense && (
                <div>
                  <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    {direction === 'rtl' ? 'التاريخ' : 'Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.createdAt}
                    onChange={(e) => setFormData({ ...formData, createdAt: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  />
                </div>
              )}
            </div>

            {/*  اختيار البنك اللي اتخصم منه المصروف */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                💳 {direction === 'rtl' ? 'البنك اللي اتخصم منه المصروف' : 'Deduct from'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'cash',     label: direction === 'rtl' ? '💵 كاش'     : '💵 Cash',     activeBg: 'bg-green-600 ring-green-700' },
                  { id: 'instapay', label: direction === 'rtl' ? '📲 إنستا باي' : '📲 Instapay', activeBg: 'bg-blue-600 ring-blue-700' },
                  { id: 'wallet',   label: direction === 'rtl' ? '👛 محفظة'   : '👛 Wallet',   activeBg: 'bg-purple-600 ring-purple-700' },
                ] as const).map(opt => {
                  const isActive = formData.paymentMethod === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, paymentMethod: opt.id })}
                      className={`px-3 py-2.5 rounded-lg text-sm font-bold transition-all ring-2 ${
                        isActive
                          ? `${opt.activeBg} text-white shadow-md`
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 ring-gray-200 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                {direction === 'rtl'
                  ? '💡 المصروف هيتخصم من الفلوس الفعلية في البنك المختار وقت التقفيل'
                  : '💡 The expense will be deducted from the selected payment bucket in the closing report'}
              </p>
            </div>

            {/* الملاحظات */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('expenses.form.notes')}</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                rows={3}
                placeholder={t('expenses.form.notesPlaceholder')}
                disabled={!!editingExpense}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold py-2.5 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              >
                {submitting
                  ? t('expenses.form.saving')
                  : editingExpense
                    ? (<><svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>{direction === 'rtl' ? 'حفظ التعديل' : 'Save Changes'}</>)
                    : t('expenses.form.submit')
                }
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingExpense(null) }}
                className="px-6 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-bold transition-colors duration-200"
              >
                {t('expenses.form.cancel') || (direction === 'rtl' ? 'إلغاء' : 'Cancel')}
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {/* Filters card */}
      {(() => {
        const hasActiveFilters = !!searchQuery || filterType !== 'all' || dateFilterMode !== 'all'
        const filteredTotal = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0)
        return (
          <div className="mb-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden" dir={direction}>
            {/* الفلاتر */}
            <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
              {/* search — lg:col-span-5 */}
              <div className="lg:col-span-5">
                <div className="relative">
                  <span className={`absolute inset-y-0 ${direction === 'rtl' ? 'end-3' : 'start-3'} flex items-center text-gray-400 pointer-events-none`}>
                    <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={direction === 'rtl' ? 'ابحث بالاسم، الموظف، أو المبلغ…' : 'Search by name, staff, or amount…'}
                    className={`w-full ${direction === 'rtl' ? 'pe-10 ps-9' : 'ps-10 pe-9'} py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200`}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label={direction === 'rtl' ? 'مسح' : 'Clear'}
                      className={`absolute inset-y-0 ${direction === 'rtl' ? 'start-2' : 'end-2'} flex items-center text-gray-400 hover:text-red-500 px-1 rounded transition-colors duration-200`}
                      title={direction === 'rtl' ? 'مسح' : 'Clear'}
                    >
                      <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  )}
                </div>
              </div>

              {/* type filter — lg:col-span-3 */}
              <div className="lg:col-span-3">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 cursor-pointer"
                  dir={direction}
                >
                  <option value="all">{t('expenses.filter.all')}</option>
                  <option value="gym_expense">{t('expenses.filter.gymExpenses')}</option>
                  <option value="staff_loan">{t('expenses.filter.staffLoans')}</option>
                  <option value="staff_salary">{t('expenses.filter.staffSalaries')}</option>
                </select>
              </div>

              {/* date filter — lg:col-span-4 */}
              <div className="lg:col-span-4">
                <div className="flex gap-1.5 h-full">
                  {/* mode pills */}
                  <div className="inline-flex rounded-lg ring-1 ring-gray-200 dark:ring-gray-600 bg-gray-50 dark:bg-gray-900 p-0.5 shrink-0">
                    {([
                      { v: 'all', label: direction === 'rtl' ? 'الكل' : 'All' },
                      { v: 'month', label: direction === 'rtl' ? ' شهر' : ' Month' },
                      { v: 'day', label: direction === 'rtl' ? ' يوم' : ' Day' }
                    ] as const).map(opt => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => {
                          setDateFilterMode(opt.v)
                          if (opt.v === 'all') {
                            setDateFilterValue('')
                          } else if (opt.v === 'month' && !dateFilterValue.match(/^\d{4}-\d{2}$/)) {
                            const now = new Date()
                            setDateFilterValue(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
                          } else if (opt.v === 'day' && !dateFilterValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
                            const now = new Date()
                            setDateFilterValue(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`)
                          }
                        }}
                        className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition ${
                          dateFilterMode === opt.v
                            ? 'bg-primary-600 text-primary-contrast shadow-sm'
                            : 'text-gray-600 dark:text-gray-300 hover:text-primary-contrast dark:hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {/* date picker — يظهر فقط مع شهر أو يوم */}
                  {dateFilterMode === 'month' && (
                    <input
                      type="month"
                      value={dateFilterValue}
                      onChange={(e) => setDateFilterValue(e.target.value)}
                      className="flex-1 min-w-0 px-2.5 py-2 ring-1 ring-gray-200 dark:ring-gray-600 dark:bg-gray-900 dark:text-white rounded-lg text-sm focus:border-primary-500 focus:outline-none transition"
                    />
                  )}
                  {dateFilterMode === 'day' && (
                    <input
                      type="date"
                      value={dateFilterValue}
                      onChange={(e) => setDateFilterValue(e.target.value)}
                      className="flex-1 min-w-0 px-2.5 py-2 ring-1 ring-gray-200 dark:ring-gray-600 dark:bg-gray-900 dark:text-white rounded-lg text-sm focus:border-primary-500 focus:outline-none transition"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Filter summary — يظهر فقط لما يكون فيه فلتر شغال */}
            {hasActiveFilters && (
              <div className="border-t border-gray-200 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/20 px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-yellow-800 dark:text-yellow-200">
                  <span className="inline-flex items-center gap-1.5">
                     <strong>{filteredExpenses.length}</strong>
                    <span className="opacity-70">/</span>
                    <span className="opacity-70">{expenses.length}</span>
                  </span>
                  {filteredExpenses.length > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      
                      <strong>{filteredTotal.toLocaleString(direction === 'rtl' ? 'ar-EG' : 'en-US')}</strong>
                      <span className="opacity-70 text-xs">{t('members.egp')}</span>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setFilterType('all')
                    setDateFilterMode('all')
                    setDateFilterValue('')
                  }}
                  className="text-xs px-3 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-yellow-300 dark:border-yellow-700 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/40 font-medium transition"
                >
                   {direction === 'rtl' ? 'مسح الفلاتر' : 'Clear all'}
                </button>
              </div>
            )}
          </div>
        )
      })()}

      {/* Cards Grid */}
      {loading ? (
        <LoadingScreen message={t('expenses.loading')} />
      ) : filteredExpenses.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          
          <p className="text-xl">{t('expenses.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" dir={direction}>
          {filteredExpenses.map((expense) => (
            <div
              key={expense.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition"
            >
              {/* Header */}
              <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-2.5 flex justify-between items-center border-b dark:border-gray-700">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor(expense.type)}`}>
                  {getTypeLabel(expense.type)}
                </span>
                <div className="flex gap-3 text-sm">
                  {hasPermission('canEditExpense') && (
                    <button
                      onClick={() => handleEdit(expense)}
                      className="text-primary-600 hover:text-primary-800 font-bold"
                    >
                       {t('expenses.actions.edit')}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(expense)}
                    className="text-red-600 hover:text-red-800 font-bold"
                  >
                     {t('expenses.actions.delete')}
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 line-clamp-2">{expense.description}</h3>
                  {expense.staff && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1"> {expense.staff.name}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-2.5 ring-1 ring-primary-200 dark:ring-primary-900/50">
                    <p className="text-xs text-primary-700 dark:text-primary-400 mb-1"> {t('expenses.table.amount')}</p>
                    <p className="text-xl font-bold text-primary-700 dark:text-primary-400">
                      {expense.amount} {t('common.currency')}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2.5">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1"> {t('expenses.table.date')}</p>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      {new Date(expense.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                    </p>
                  </div>
                </div>

                {expense.type === 'staff_loan' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400"> {t('expenses.table.status')}:</span>
                    <button
                      onClick={() => togglePaid(expense)}
                      className={`px-3 py-1 rounded-full text-sm font-semibold transition ${
                        expense.isPaid
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}
                    >
                      {expense.isPaid ? ` ${t('expenses.status.paid')}` : ` ${t('expenses.status.unpaid')}`}
                    </button>
                  </div>
                )}

                {expense.notes && (
                  <div className="bg-gray-50 dark:bg-gray-700 p-2.5 rounded-lg">
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      <span className="font-semibold"> {t('expenses.form.notes')}:</span> {expense.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Popup */}
      {deleteConfirm.show && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 z-[9998] animate-fadeIn"
            onClick={cancelDelete}
          />

          {/* Modal */}
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-full max-w-md px-4 animate-scaleIn">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 ring-1 ring-red-500" dir={direction}>
              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                  
                </div>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-center mb-3 text-red-600">
                {t('expenses.deleteModal.title')}
              </h2>

              {/* Message */}
              <p className="text-center text-gray-700 dark:text-gray-200 mb-2">
                {t('expenses.deleteModal.message')}
              </p>
              <p className="text-center text-lg font-bold text-gray-900 dark:text-white mb-6 bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                {deleteConfirm.expenseName}
              </p>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={cancelDelete}
                  className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition font-bold"
                >
                   {t('expenses.deleteModal.cancel')}
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition font-bold"
                >
                   {t('expenses.deleteModal.confirm')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>

      {/* Staff Loans Modal */}
      {showLoansModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in flex items-center justify-center z-50 p-4" dir={direction}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-primary-contrast p-4 rounded-t-2xl">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold mb-1"> {t('expenses.loansModal.title')}</h2>
                  <p className="text-primary-100 text-sm">{t('expenses.loansModal.subtitle')}</p>
                </div>
                <button
                  onClick={() => setShowLoansModal(false)}
                  className="text-white hover:bg-white dark:bg-gray-800 hover:bg-opacity-20 rounded-full w-8 h-8 flex items-center justify-center transition"
                >
                  
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Month/Year Selector */}
              <div className="mb-4 flex gap-2 items-center">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('expenses.loansModal.selectMonth')}</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="px-3 py-2 ring-1 ring-primary-300 dark:ring-primary-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:border-primary-500 focus:outline-none"
                >
                  <option value={0}>{t('expenses.loansModal.months.january')}</option>
                  <option value={1}>{t('expenses.loansModal.months.february')}</option>
                  <option value={2}>{t('expenses.loansModal.months.march')}</option>
                  <option value={3}>{t('expenses.loansModal.months.april')}</option>
                  <option value={4}>{t('expenses.loansModal.months.may')}</option>
                  <option value={5}>{t('expenses.loansModal.months.june')}</option>
                  <option value={6}>{t('expenses.loansModal.months.july')}</option>
                  <option value={7}>{t('expenses.loansModal.months.august')}</option>
                  <option value={8}>{t('expenses.loansModal.months.september')}</option>
                  <option value={9}>{t('expenses.loansModal.months.october')}</option>
                  <option value={10}>{t('expenses.loansModal.months.november')}</option>
                  <option value={11}>{t('expenses.loansModal.months.december')}</option>
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-3 py-2 ring-1 ring-primary-300 dark:ring-primary-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:border-primary-500 focus:outline-none"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              {getStaffLoansGrouped().length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 dark:text-gray-500">
                  <p className="text-lg"> {t('expenses.loansModal.noLoans')}</p>
                </div>
              ) : (
                <>
                  <div className="bg-primary-50 dark:bg-primary-900/20 border-l-4 border-r-4 border-primary-500 p-4 rounded-lg mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('expenses.loansModal.totalLoans')}</span>
                      <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                        {getSelectedMonthTotalLoans()} {t('members.egp')}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {getStaffLoansGrouped().map((loan, index) => (
                      <div
                        key={loan.staffName}
                        className="bg-white dark:bg-gray-700 ring-1 ring-primary-100 dark:ring-primary-700 hover:border-primary-300 dark:hover:border-primary-500 rounded-lg p-4 transition"
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 font-bold rounded-full w-10 h-10 flex items-center justify-center">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-bold text-gray-800 dark:text-gray-100">{loan.staffName}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{t('expenses.loansModal.staffMember')}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-primary-600 dark:text-primary-400">{loan.total} {t('members.egp')}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{t('expenses.loansModal.totalAmount')}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
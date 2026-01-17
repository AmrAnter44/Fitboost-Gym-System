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
  const [filterType, setFilterType] = useState<'all' | 'gym_expense' | 'staff_loan'>('all')
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
    type: 'gym_expense' as 'gym_expense' | 'staff_loan',
    amount: 0,
    description: '',
    notes: '',
    staffId: '',
    createdAt: '',
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

      // إذا كانت سلفة موظف، ضع اسم الموظف في الوصف تلقائياً
      const dataToSend: any = { ...formData }
      if (formData.type === 'staff_loan' && formData.staffId) {
        const selectedStaff = staffList.find(s => s.id === formData.staffId)
        if (selectedStaff) {
          dataToSend.description = selectedStaff.name
        }
      }

      // ✅ إضافة التاريخ المخصص إذا كان مفعّل
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
        description: formData.description,
        createdAt: formData.createdAt,
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

  const filteredExpenses = filterType === 'all'
    ? expenses
    : expenses.filter(e => e.type === filterType)

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
    return type === 'gym_expense' ? t('expenses.types.gymExpense') : t('expenses.types.staffLoan')
  }

  const getTypeColor = (type: string) => {
    return type === 'gym_expense'
      ? 'bg-orange-100 text-orange-800'
      : 'bg-purple-100 text-purple-800'
  }

  // ✅ التحقق من الصلاحيات
  if (permissionsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen" dir={direction}>
        <div className="text-xl">{t('expenses.loading')}</div>
      </div>
    )
  }

  if (!hasPermission('canViewFinancials')) {
    return <PermissionDenied message={t('expenses.noPermission')} />
  }

  return (
    <div className="container mx-auto px-4 py-6 md:px-6" dir={direction}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">💸 {t('expenses.title')}</h1>
          <p className="text-gray-600">{t('expenses.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowLoansModal(true)}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition"
          >
            💵 {t('expenses.loansButton')}
          </button>
          <button
            onClick={() => {
              if (showForm) {
                setShowForm(false)
                setEditingExpense(null)
                setFormData({
                  type: 'gym_expense',
                  amount: 0,
                  description: '',
                  notes: '',
                  staffId: '',
                  createdAt: '',
                })
              } else {
                setShowForm(true)
              }
            }}
            className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition"
          >
            {showForm ? t('expenses.hideForm') : `➕ ${t('expenses.addExpense')}`}
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" dir={direction}>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">{t('expenses.stats.totalExpenses')}</p>
              <p className="text-3xl font-bold text-orange-600">
                {currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0)} {t('members.egp')}
              </p>
              <p className="text-xs text-gray-500 mt-1">📅 {t('expenses.stats.currentMonth')}</p>
            </div>
            <div className="text-4xl">💸</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">{t('expenses.stats.gymExpenses')}</p>
              <p className="text-3xl font-bold text-orange-600">
                {currentMonthExpenses.filter(e => e.type === 'gym_expense').reduce((sum, e) => sum + e.amount, 0)} {t('members.egp')}
              </p>
              <p className="text-xs text-gray-500 mt-1">📅 {t('expenses.stats.currentMonth')}</p>
            </div>
            <div className="text-4xl">🔧</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">{t('expenses.stats.staffLoans')}</p>
              <p className="text-3xl font-bold text-purple-600">
                {currentMonthExpenses.filter(e => e.type === 'staff_loan').reduce((sum, e) => sum + e.amount, 0)} {t('members.egp')}
              </p>
              <p className="text-xs text-gray-500 mt-1">📅 {t('expenses.stats.currentMonth')}</p>
            </div>
            <div className="text-4xl">💵</div>
          </div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6" dir={direction}>
          <h2 className="text-xl font-semibold mb-4">
            {editingExpense ? '✏️ تعديل المصروف' : t('expenses.form.title')}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* نوع المصروف - معطل في وضع التعديل */}
              <div>
                <label className="block text-sm font-medium mb-1">{t('expenses.form.expenseType')}</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any, staffId: '' })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                  disabled={!!editingExpense}
                >
                  <option value="gym_expense">{t('expenses.types.gymExpense')}</option>
                  <option value="staff_loan">{t('expenses.types.staffLoan')}</option>
                </select>
              </div>

              {formData.type === 'staff_loan' && (
                <div>
                  <label className="block text-sm font-medium mb-1">{t('expenses.form.staff')}</label>
                  <select
                    value={formData.staffId}
                    onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
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

              {/* المبلغ - معطل في وضع التعديل */}
              <div>
                <label className="block text-sm font-medium mb-1">{t('expenses.form.amount')}</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder={t('expenses.form.amountPlaceholder')}
                  disabled={!!editingExpense}
                />
              </div>

              {/* الوصف - قابل للتعديل */}
              {formData.type === 'gym_expense' && (
                <div>
                  <label className="block text-sm font-medium mb-1">{t('expenses.form.description')}</label>
                  <input
                    type="text"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder={t('expenses.form.descriptionPlaceholder')}
                  />
                </div>
              )}

              {/* التاريخ - يظهر فقط في وضع التعديل */}
              {editingExpense && (
                <div>
                  <label className="block text-sm font-medium mb-1">📅 التاريخ</label>
                  <input
                    type="date"
                    required
                    value={formData.createdAt}
                    onChange={(e) => setFormData({ ...formData, createdAt: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              )}
            </div>

            {/* الملاحظات - معطل في وضع التعديل */}
            <div>
              <label className="block text-sm font-medium mb-1">{t('expenses.form.notes')}</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                rows={3}
                placeholder={t('expenses.form.notesPlaceholder')}
                disabled={!!editingExpense}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 disabled:bg-gray-400"
            >
              {submitting
                ? t('expenses.form.saving')
                : editingExpense
                  ? '💾 حفظ التعديل'
                  : t('expenses.form.submit')
              }
            </button>
          </form>
        </div>
      )}

      {/* Filter */}
      <div className="mb-4" dir={direction}>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="px-4 py-2 border rounded-lg"
          dir={direction}
        >
          <option value="all">{t('expenses.filter.all')}</option>
          <option value="gym_expense">{t('expenses.filter.gymExpenses')}</option>
          <option value="staff_loan">{t('expenses.filter.staffLoans')}</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12">{t('expenses.loading')}</div>
      ) : (
        <>
          {/* Cards للموبايل */}
          <div className="md:hidden space-y-4" dir={direction}>
            {filteredExpenses.map((expense) => (
              <div
                key={expense.id}
                className="bg-white rounded-lg shadow-md border-r-4 border-red-500 overflow-hidden"
              >
                {/* Actions في الأعلى */}
                <div className="bg-gray-50 px-4 py-2 flex justify-between items-center border-b">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getTypeColor(expense.type)}`}>
                    {getTypeLabel(expense.type)}
                  </span>
                  <div className="flex gap-2">
                    {hasPermission('canEditExpense') && (
                      <button
                        onClick={() => handleEdit(expense)}
                        className="text-blue-600 hover:text-blue-800 font-bold text-sm"
                      >
                        ✏️ {t('expenses.actions.edit')}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(expense)}
                      className="text-red-600 hover:text-red-800 font-bold text-sm"
                    >
                      🗑️ {t('expenses.actions.delete')}
                    </button>
                  </div>
                </div>

                {/* محتوى الكارت */}
                <div className="p-4 space-y-3">
                  {/* الوصف */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">{expense.description}</h3>
                    {expense.staff && (
                      <p className="text-sm text-gray-600 mt-1">👤 {expense.staff.name}</p>
                    )}
                  </div>

                  {/* المبلغ */}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm">💰</span>
                    <span className="text-2xl font-bold text-orange-600">{expense.amount} {t('common.currency')}</span>
                  </div>

                  {/* التاريخ */}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm">📅</span>
                    <span className="text-gray-700">
                      {new Date(expense.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                    </span>
                  </div>

                  {/* الحالة للسلف */}
                  {expense.type === 'staff_loan' && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm">📊</span>
                      <button
                        onClick={() => togglePaid(expense)}
                        className={`px-3 py-1 rounded-full text-sm font-semibold transition ${
                          expense.isPaid
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {expense.isPaid ? `✅ ${t('expenses.status.paid')}` : `❌ ${t('expenses.status.unpaid')}`}
                      </button>
                    </div>
                  )}

                  {/* الملاحظات */}
                  {expense.notes && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold">📝 ملاحظات:</span> {expense.notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredExpenses.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">💸</div>
                <p className="text-xl">{t('expenses.empty')}</p>
              </div>
            )}
          </div>

          {/* الجدول للشاشات الكبيرة */}
          <div className="hidden md:block bg-white rounded-lg shadow-md overflow-hidden" dir={direction}>
            <table className="w-full" dir={direction}>
              <thead className="bg-gray-100">
                <tr>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.table.type')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.table.staff')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.table.description')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.table.amount')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.table.status')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.table.date')}</th>
                  <th className={`px-4 py-3 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>{t('expenses.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`px-3 py-1 rounded text-sm ${getTypeColor(expense.type)}`}>
                        {getTypeLabel(expense.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {expense.staff ? expense.staff.name : '-'}
                    </td>
                    <td className="px-4 py-3">{expense.description}</td>
                    <td className="px-4 py-3 font-bold text-orange-600">{expense.amount} {t('common.currency')}</td>
                    <td className="px-4 py-3">
                      {expense.type === 'staff_loan' && (
                        <button
                          onClick={() => togglePaid(expense)}
                          className={`px-3 py-1 rounded text-sm ${
                            expense.isPaid
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {expense.isPaid ? `✅ ${t('expenses.status.paid')}` : `❌ ${t('expenses.status.unpaid')}`}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {new Date(expense.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {hasPermission('canEditExpense') && (
                          <button
                            onClick={() => handleEdit(expense)}
                            className="text-blue-600 hover:text-blue-800 font-bold"
                          >
                            ✏️ {t('expenses.actions.edit')}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(expense)}
                          className="text-red-600 hover:text-red-800 font-bold"
                        >
                          🗑️ {t('expenses.actions.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredExpenses.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">💸</div>
                <p className="text-xl">{t('expenses.empty')}</p>
              </div>
            )}
          </div>
        </>
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
            <div className="bg-white rounded-2xl shadow-2xl p-6 border-4 border-red-500" dir={direction}>
              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-5xl">🗑️</span>
                </div>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-center mb-3 text-red-600">
                {t('expenses.deleteModal.title')}
              </h2>

              {/* Message */}
              <p className="text-center text-gray-700 mb-2">
                {t('expenses.deleteModal.message')}
              </p>
              <p className="text-center text-lg font-bold text-gray-900 mb-6 bg-gray-100 p-3 rounded-lg">
                {deleteConfirm.expenseName}
              </p>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={cancelDelete}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition font-bold"
                >
                  ✕ {t('expenses.deleteModal.cancel')}
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition font-bold"
                >
                  🗑️ {t('expenses.deleteModal.confirm')}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" dir={direction}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4 rounded-t-2xl">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold mb-1">💵 {t('expenses.loansModal.title')}</h2>
                  <p className="text-purple-100 text-sm">{t('expenses.loansModal.subtitle')}</p>
                </div>
                <button
                  onClick={() => setShowLoansModal(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full w-8 h-8 flex items-center justify-center transition"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Month/Year Selector */}
              <div className="mb-4 flex gap-2 items-center">
                <label className="text-sm font-medium text-gray-700">{t('expenses.loansModal.selectMonth')}</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="px-3 py-2 border-2 border-purple-300 rounded-lg text-sm focus:border-purple-500 focus:outline-none"
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
                  className="px-3 py-2 border-2 border-purple-300 rounded-lg text-sm focus:border-purple-500 focus:outline-none"
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              {getStaffLoansGrouped().length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-lg">📭 {t('expenses.loansModal.noLoans')}</p>
                </div>
              ) : (
                <>
                  <div className="bg-purple-50 border-l-4 border-r-4 border-purple-500 p-4 rounded-lg mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">{t('expenses.loansModal.totalLoans')}</span>
                      <span className="text-2xl font-bold text-purple-600">
                        {getSelectedMonthTotalLoans()} {t('members.egp')}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {getStaffLoansGrouped().map((loan, index) => (
                      <div
                        key={loan.staffName}
                        className="bg-white border-2 border-purple-100 hover:border-purple-300 rounded-lg p-4 transition"
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="bg-purple-100 text-purple-700 font-bold rounded-full w-10 h-10 flex items-center justify-center">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-bold text-gray-800">{loan.staffName}</p>
                              <p className="text-xs text-gray-500">{t('expenses.loansModal.staffMember')}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-purple-600">{loan.total} {t('members.egp')}</p>
                            <p className="text-xs text-gray-500">{t('expenses.loansModal.totalAmount')}</p>
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
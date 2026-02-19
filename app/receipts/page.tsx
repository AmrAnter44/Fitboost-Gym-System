'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import nextDynamic from 'next/dynamic'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePermissions } from '../../hooks/usePermissions'
import { useLanguage } from '../../contexts/LanguageContext'
import PermissionDenied from '../../components/PermissionDenied'
import { printReceiptFromData } from '../../lib/printSystem'
import { useConfirm } from '../../hooks/useConfirm'
import ConfirmDialog from '../../components/ConfirmDialog'

// ✅ Dynamic imports - تحميل عند الحاجة فقط
const ReceiptWhatsApp = nextDynamic(() => import('../../components/ReceiptWhatsApp'), { ssr: false })
const ReceiptDetailModal = nextDynamic(
  () => import('../../components/ReceiptDetailModal').then(m => ({ default: m.ReceiptDetailModal })),
  { ssr: false, loading: () => <div className="animate-pulse h-40 bg-gray-200 dark:bg-gray-700 rounded-xl" /> }
)
import { normalizePaymentMethod, isMultiPayment, getPaymentMethodLabel as getPaymentLabel } from '../../lib/paymentHelpers'
import { useToast } from '../../contexts/ToastContext'
import { fetchReceipts } from '../../lib/api/receipts'
import LoadingSkeleton from '../../components/LoadingSkeleton'
import { useDebounce } from '../../hooks/useDebounce'

interface Receipt {
  id: string
  receiptNumber: number
  type: string
  amount: number
  paymentMethod: string
  staffName?: string
  itemDetails: string
  createdAt: string
  memberId?: string
  ptNumber?: number
  dayUseId?: string
  isCancelled?: boolean
  cancelledAt?: string
  cancelledBy?: string
  cancelReason?: string
}

// أنواع إيصالات PT المدعومة (جميع الأنواع الحالية والقديمة) - خارج الـ component لتجنب re-creation
const PT_RECEIPT_TYPES = ['برايفت جديد', 'تجديد برايفت', 'دفع باقي برايفت', 'new pt', 'اشتراك برايفت', 'PT Day Use']

export default function ReceiptsPage() {
  const router = useRouter()
  const { hasPermission, loading: permissionsLoading, user } = usePermissions()
  const { t, direction } = useLanguage()
  const { confirm, isOpen, options, handleConfirm, handleCancel } = useConfirm()
  const toast = useToast()
  const queryClient = useQueryClient()

  // ✅ استخدام useQuery لجلب الإيصالات
  const {
    data: receipts = [],
    isLoading: loading,
    error: receiptsError,
    refetch: refetchReceipts
  } = useQuery({
    queryKey: ['receipts'],
    queryFn: fetchReceipts,
    enabled: !permissionsLoading && hasPermission('canViewReceipts'),
    retry: 1,
    staleTime: 2 * 60 * 1000, // البيانات تعتبر fresh لمدة دقيقتين
  })

  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterPayment, setFilterPayment] = useState('all')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null)
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editFormData, setEditFormData] = useState({
    receiptNumber: 0,
    amount: 0,
    paymentMethod: 'cash',
    staffName: '',
    createdAt: ''
  })

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // ✅ جميع الـ hooks يجب أن تكون قبل أي return
  const canEdit = hasPermission('canEditReceipts')
  const canDelete = hasPermission('canDeleteReceipts')
  const canCancel = hasPermission('canEditReceipts') // استخدام canEditReceipts للإلغاء

  // ✅ معالجة أخطاء الإيصالات
  useEffect(() => {
    if (receiptsError) {
      const errorMessage = (receiptsError as Error).message

      if (errorMessage === 'UNAUTHORIZED') {
        toast.error('يجب تسجيل الدخول أولاً')
        setTimeout(() => router.push('/login'), 2000)
      } else if (errorMessage === 'FORBIDDEN') {
        toast.error('ليس لديك صلاحية عرض الإيصالات')
      } else {
        toast.error(errorMessage || 'حدث خطأ أثناء جلب الإيصالات')
      }
    }
  }, [receiptsError, toast, router])

  // ✅ استخدام useMemo بدل useState + useEffect لتجنب infinite loop
  const filteredReceipts = useMemo(() => {
    if (!Array.isArray(receipts)) {
      return []
    }

    let filtered = [...receipts]

    // فلتر البحث
    if (debouncedSearchTerm) {
      filtered = filtered.filter(r => {
        try {
          const details = JSON.parse(r.itemDetails)
          return (
            r.receiptNumber.toString().includes(debouncedSearchTerm) ||
            details.memberName?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
            details.clientName?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
            details.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
            details.memberNumber?.toString().includes(debouncedSearchTerm) ||
            details.ptNumber?.toString().includes(debouncedSearchTerm) ||
            details.phone?.includes(debouncedSearchTerm) ||
            r.staffName?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
          )
        } catch {
          return false
        }
      })
    }

    // فلتر النوع
    if (filterType !== 'all') {
      if (filterType === 'PT') {
        // فلتر PT: يعرض كل أنواع إيصالات PT
        filtered = filtered.filter(r => PT_RECEIPT_TYPES.includes(r.type))
      } else {
        filtered = filtered.filter(r => r.type === filterType)
      }
    }

    // فلتر طريقة الدفع
    if (filterPayment !== 'all') {
      filtered = filtered.filter(r => r.paymentMethod === filterPayment)
    }

    return filtered
  }, [receipts, debouncedSearchTerm, filterType, filterPayment])

  // ✅ useEffect منفصل لإعادة ضبط الصفحة عند تغيير الفلاتر
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm, filterType, filterPayment])

  // حساب الصفحات
  const totalPages = Math.ceil(filteredReceipts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentReceipts = filteredReceipts.slice(startIndex, endIndex)

  const goToPage = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ✅ التحقق من الصلاحيات بعد كل الـ hooks
  if (permissionsLoading) {
    return (
      <div className="container mx-auto p-6 text-center" dir={direction}>
        <div className="text-6xl mb-4">⏳</div>
        <p className="text-xl">{t('receipts.loading')}</p>
      </div>
    )
  }

  // ✅ إذا لم يكن لديه صلاحية العرض
  if (!hasPermission('canViewReceipts')) {
    return <PermissionDenied message={t('receipts.noPermission')} />
  }

  const getTotalRevenue = () => {
    if (!Array.isArray(filteredReceipts)) return 0
    return filteredReceipts
      .filter(r => !r.isCancelled)
      .reduce((sum, r) => sum + r.amount, 0)
  }

  const getTodayCount = () => {
    if (!Array.isArray(filteredReceipts)) return 0
    const today = new Date().toDateString()
    return filteredReceipts.filter(r =>
      !r.isCancelled && new Date(r.createdAt).toDateString() === today
    ).length
  }

  const getTodayRevenue = () => {
    if (!Array.isArray(filteredReceipts)) return 0
    const today = new Date().toDateString()
    return filteredReceipts
      .filter(r => !r.isCancelled && new Date(r.createdAt).toDateString() === today)
      .reduce((sum, r) => sum + r.amount, 0)
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'Member': `🆕 ${t('receipts.types.Member')}`,
      'تجديد عضويه': `🔄 ${t('receipts.types.membershipRenewal')}`,
      'ترقية باكدج': `🚀 ${t('receipts.types.packageUpgrade')}`,
      'عضوية': `🆕 ${t('receipts.types.membership')}`,
      'اشتراك برايفت': `💪 ${t('receipts.types.newPT')}`,
      'تجديد برايفت': `🔄 ${t('receipts.types.ptRenewal')}`,
      'PT': '💪 PT',
      'DayUse': `📅 ${t('receipts.types.dayUse')}`,
      'يوم استخدام': `📅 ${t('receipts.types.dayUse')}`,
      'تأجير لوجر': `🔐 ${t('receipts.types.lockerRental')}`,
      'Payment': `💰 ${t('receipts.types.Payment')}`,
      'InBody': `⚖️ ${t('receipts.types.InBody')}`
    }
    return labels[type] || type
  }

  const getPaymentMethodLabel = (method: string, amount?: number) => {
    // ✅ معالجة الدفع المتعدد
    if (isMultiPayment(method)) {
      const normalized = normalizePaymentMethod(method, amount || 0)

      // لو في طريقة دفع واحدة بس، نعرضها عادي بدون "دفع متعدد"
      if (normalized.methods.length === 1) {
        return getPaymentLabel(normalized.methods[0].method, 'ar')
      }

      // لو أكتر من طريقة دفع، نعرض الإيموجي مع المبلغ تحت بعض
      const emojis: Record<string, string> = {
        'cash': '💵',
        'visa': '💳',
        'wallet': '👛',
        'instapay': '💸',
        'points': '🏆'
      }

      return (
        <div className="flex flex-col gap-0.5 text-xs">
          {normalized.methods.map((m, idx) => (
            <div key={idx}>
              {emojis[m.method] || '💰'} {Math.round(m.amount)}
              {m.method === 'points' && m.pointsUsed && (
                <span className="text-yellow-600 font-bold"> ({m.pointsUsed} نقطة)</span>
              )}
            </div>
          ))}
        </div>
      )
    }

    // دفع واحد
    const labels: Record<string, string> = {
      'cash': `💵 ${t('receipts.paymentMethods.cash')}`,
      'visa': `💳 ${t('receipts.paymentMethods.visa')}`,
      'wallet': `👛 ${t('receipts.paymentMethods.wallet')}`,
      'instapay': `💸 ${t('receipts.paymentMethods.instapay')}`,
      'points': `🏆 ${t('receipts.paymentMethods.points') || 'نقاط'}`
    }
    return labels[method] || method
  }

  const handleCancelReceipt = async (receiptId: string) => {
    if (!canCancel) {
      toast.error('ليس لديك صلاحية إلغاء الإيصالات')
      return
    }

    const confirmed = await confirm({
      title: `⚠️ إلغاء الإيصال`,
      message: 'هل أنت متأكد من إلغاء هذا الإيصال؟ سيتم إنشاء مصروف بنفس المبلغ.',
      confirmText: 'إلغاء الإيصال',
      cancelText: 'رجوع',
      type: 'danger'
    })

    if (!confirmed) return

    // ✅ Optimistic Update - علّم الإيصال كملغي فوراً
    const previousData = queryClient.getQueryData<any[]>(['receipts'])
    queryClient.setQueryData<any[]>(['receipts'], (old) =>
      old ? old.map(r => r.id === receiptId ? { ...r, isCancelled: true } : r) : old
    )

    try {
      const response = await fetch(`/api/receipts/${receiptId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'إلغاء يدوي' })
      })

      if (response.ok) {
        toast.success('تم إلغاء الإيصال بنجاح')
        queryClient.invalidateQueries({ queryKey: ['receipts'] })
      } else {
        queryClient.setQueryData(['receipts'], previousData)
        const error = await response.json()
        toast.error(error.error || 'فشل إلغاء الإيصال')
      }
    } catch (error) {
      queryClient.setQueryData(['receipts'], previousData)
      console.error('Error:', error)
      toast.error('حدث خطأ أثناء إلغاء الإيصال')
    }
  }

  const handleDelete = async (receiptId: string) => {
    if (!canDelete) {
      toast.error(t('receipts.noPermissionDelete'))
      return
    }

    const confirmed = await confirm({
      title: `⚠️ ${t('receipts.delete.title')}`,
      message: t('receipts.delete.message'),
      confirmText: t('receipts.delete.confirm'),
      cancelText: t('receipts.delete.cancel'),
      type: 'danger'
    })

    if (!confirmed) return

    // ✅ Optimistic Update - احذف الإيصال فوراً
    const previousData = queryClient.getQueryData<any[]>(['receipts'])
    queryClient.setQueryData<any[]>(['receipts'], (old) =>
      old ? old.filter(r => r.id !== receiptId) : old
    )

    try {
      const response = await fetch(`/api/receipts/update?id=${receiptId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success(t('receipts.delete.success'))
        queryClient.invalidateQueries({ queryKey: ['receipts'] })
      } else {
        queryClient.setQueryData(['receipts'], previousData)
        const error = await response.json()
        toast.error(error.error || t('receipts.delete.error'))
      }
    } catch (error) {
      queryClient.setQueryData(['receipts'], previousData)
      console.error('Error:', error)
      toast.error(t('receipts.delete.errorOccurred'))
    }
  }

  const handleOpenEdit = (receipt: Receipt) => {
    if (!canEdit) {
      toast.error(t('receipts.noPermissionEdit'))
      return
    }

    setEditingReceipt(receipt)
    // تحويل التاريخ لصيغة datetime-local
    const date = new Date(receipt.createdAt)
    const formattedDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)

    setEditFormData({
      receiptNumber: receipt.receiptNumber,
      amount: receipt.amount,
      paymentMethod: receipt.paymentMethod,
      staffName: receipt.staffName || '',
      createdAt: formattedDate
    })
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!editingReceipt) return

    // ✅ Optimistic Update - حدّث الإيصال فوراً
    const previousData = queryClient.getQueryData<any[]>(['receipts'])
    const updatedCreatedAt = editFormData.createdAt ? new Date(editFormData.createdAt).toISOString() : editingReceipt.createdAt
    queryClient.setQueryData<any[]>(['receipts'], (old) =>
      old ? old.map(r => r.id === editingReceipt.id ? {
        ...r,
        receiptNumber: editFormData.receiptNumber,
        amount: editFormData.amount,
        paymentMethod: editFormData.paymentMethod,
        staffName: editFormData.staffName,
        createdAt: updatedCreatedAt
      } : r) : old
    )
    setShowEditModal(false)
    setEditingReceipt(null)

    try {
      const response = await fetch('/api/receipts/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptId: editingReceipt.id,
          receiptNumber: editFormData.receiptNumber,
          amount: editFormData.amount,
          paymentMethod: editFormData.paymentMethod,
          staffName: editFormData.staffName,
          createdAt: updatedCreatedAt
        })
      })

      if (response.ok) {
        toast.success(t('receipts.edit.success'))
        queryClient.invalidateQueries({ queryKey: ['receipts'] })
      } else {
        queryClient.setQueryData(['receipts'], previousData)
        setShowEditModal(true)
        setEditingReceipt(editingReceipt)
        const error = await response.json()
        toast.error(error.error || t('receipts.edit.error'))
      }
    } catch (error) {
      queryClient.setQueryData(['receipts'], previousData)
      console.error('Error:', error)
      toast.error(t('receipts.messages.updateError'))
    }
  }

  const handlePrint = (receipt: Receipt, options?: { printOnly?: boolean; pdfOnly?: boolean }) => {
    try {
      const details = JSON.parse(receipt.itemDetails)

      // استخدام نظام الطباعة مع الخيارات
      printReceiptFromData(
        receipt.receiptNumber,
        receipt.type,
        receipt.amount,
        details,
        receipt.createdAt,
        receipt.paymentMethod,
        options  // ✅ تمرير الخيارات (printOnly أو pdfOnly)
      )
    } catch (error) {
      console.error('Error printing receipt:', error)
      toast.error(`❌ ${t('receipts.actions.printError')}`)
    }
  }

  // ✅ دالة جديدة: تحميل PDF وفتح واتساب
  const handleDownloadAndWhatsApp = async (receipt: Receipt) => {
    try {
      const details = JSON.parse(receipt.itemDetails)

      // استخراج رقم الهاتف
      const phoneNumber = details.phone || details.memberPhone || ''

      if (!phoneNumber) {
        toast.error('رقم الهاتف غير موجود في الإيصال')
        return
      }

      // تحميل PDF
      const pdfResult = await printReceiptFromData(
        receipt.receiptNumber,
        receipt.type,
        receipt.amount,
        details,
        receipt.createdAt,
        receipt.paymentMethod,
        { pdfOnly: true }  // ✅ تحميل PDF فقط
      )

      // انتظار ثانية لضمان اكتمال التحميل
      await new Promise(resolve => setTimeout(resolve, 1500))

      // فتح واتساب
      const message = `إيصال رقم ${receipt.receiptNumber}\nالمبلغ: ${receipt.amount} جنيه\n\nتم إرفاق الإيصال كملف PDF 📄`

      // ✅ إضافة +20 إذا لم يكن الرقم يبدأ بـ + أو 00
      let formattedPhone = phoneNumber
      if (!phoneNumber.startsWith('+') && !phoneNumber.startsWith('00')) {
        // إزالة الصفر الأول إذا كان موجود (مثل 01234567890 → 1234567890)
        const cleanPhone = phoneNumber.startsWith('0') ? phoneNumber.substring(1) : phoneNumber
        formattedPhone = `20${cleanPhone}`  // إضافة 20 (كود مصر)
      }

      // ✅ في Electron، استخدم API خاص لفتح واتساب مع الملف
      if (typeof window !== 'undefined' && (window as any).electron?.openWhatsAppWithPDF) {
        const pdfPath = pdfResult && typeof pdfResult === 'object' ? pdfResult.filePath : undefined
        if (pdfPath) {
          console.log('📱 Opening WhatsApp with PDF from Electron:', pdfPath)
          console.log('📞 Phone number:', formattedPhone)
          await (window as any).electron.openWhatsAppWithPDF(message, pdfPath, formattedPhone)
          toast.success('تم فتح واتساب - اسحب ملف PDF من المجلد المفتوح إلى واتساب ✅')
        } else {
          // Fallback: فتح واتساب عادي
          window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank')
          toast.success('تم تحميل PDF وفتح واتساب ✅')
        }
      } else {
        // في المتصفح العادي
        window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank')
        toast.success('تم تحميل PDF وفتح واتساب ✅')
      }
    } catch (error) {
      console.error('Error in download and WhatsApp:', error)
      toast.error('حدث خطأ أثناء العملية')
    }
  }

  // ✅ تصدير CSV للإيصالات
  const exportReceiptsCSV = () => {
    const headers = ['رقم الإيصال', 'النوع', 'العميل', 'المبلغ', 'طريقة الدفع', 'الموظف', 'التاريخ', 'ملغي']
    const rows = filteredReceipts.map(r => {
      let clientName = ''
      try {
        const d = JSON.parse(r.itemDetails)
        clientName = d.memberName || d.clientName || d.name || ''
      } catch {}
      return [
        r.receiptNumber,
        r.type,
        clientName,
        r.amount,
        r.paymentMethod,
        r.staffName || '',
        new Date(r.createdAt).toLocaleDateString('ar-EG'),
        r.isCancelled ? 'نعم' : 'لا',
      ]
    })
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `receipts_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6" dir={direction}>
        <div className="mb-6">
          <div className="h-10 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
          <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
        <div className="mb-6">
          <LoadingSkeleton type="stats" />
        </div>
        <LoadingSkeleton type="table" count={12} />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 md:px-6" dir={direction}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold dark:text-gray-100">🧾 {t('receipts.title')}</h1>
          <p className="text-gray-600 dark:text-gray-300">{t('receipts.subtitle')}</p>
          {user && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              👤 {user.name} - {user.role === 'ADMIN' ? '👑 مدير' : user.role === 'MANAGER' ? '📊 مشرف' : '👷 موظف'}
            </p>
          )}
        </div>
        <button
          onClick={exportReceiptsCSV}
          title="تصدير CSV"
          className="flex items-center gap-2 bg-green-600 dark:bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-700 dark:hover:bg-green-800 text-sm font-bold shadow"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          CSV
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-700 dark:to-primary-800 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold">{filteredReceipts.length}</div>
              <div className="text-sm opacity-90">{t('receipts.stats.totalReceipts')}</div>
            </div>
            <div className="text-5xl opacity-20">📊</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-700 dark:to-primary-800 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold">{getTodayCount()}</div>
              <div className="text-sm opacity-90">{t('receipts.stats.todayReceipts')}</div>
            </div>
            <div className="text-5xl opacity-20">📅</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 dark:from-orange-700 dark:to-orange-800 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold">{getTodayRevenue().toLocaleString()}</div>
              <div className="text-sm opacity-90">{t('receipts.stats.todayRevenue')}</div>
            </div>
            <div className="text-5xl opacity-20">💵</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6" dir={direction}>
        <h3 className="text-lg font-bold mb-4 dark:text-gray-100">🔍 {t('receipts.filters.title')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-100">🔍 {t('receipts.filters.search')}</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('receipts.filters.searchPlaceholder')}
              className="w-full px-3 py-2 md:px-4 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500"
              dir={direction}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-100">📋 {t('receipts.filters.receiptType')}</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 md:px-4 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">{t('receipts.filters.all')}</option>
              <option value="Member">{t('receipts.types.Member')}</option>
              <option value="عضوية">{t('receipts.types.membership')}</option>
              <option value="تجديد عضويه">{t('receipts.types.membershipRenewal')}</option>
              <option value="PT">💪 PT (جميع الأنواع)</option>
              <option value="يوم استخدام">{t('receipts.types.dayUse')}</option>
              <option value="تأجير لوجر">{t('receipts.types.lockerRental')}</option>
              <option value="InBody">{t('receipts.types.InBody')}</option>
              <option value="Payment">{t('receipts.types.Payment')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 dark:text-gray-100">💳 {t('receipts.filters.paymentMethod')}</label>
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              className="w-full px-3 py-2 md:px-4 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">{t('receipts.filters.all')}</option>
              <option value="cash">{t('receipts.paymentMethods.cash')}</option>
              <option value="visa">{t('receipts.paymentMethods.visa')}</option>
              <option value="wallet">{t('receipts.paymentMethods.wallet')}</option>
              <option value="instapay">{t('receipts.paymentMethods.instapay')}</option>
              <option value="points">{t('receipts.paymentMethods.points') || 'نقاط'}</option>
            </select>
          </div>
        </div>

        {(searchTerm || filterType !== 'all' || filterPayment !== 'all') && (
          <button
            onClick={() => {
              setSearchTerm('')
              setFilterType('all')
              setFilterPayment('all')
            }}
            className="mt-4 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
          >
            ❌ {t('receipts.filters.clearFilters')}
          </button>
        )}
      </div>

      {/* Receipts Display */}
      <>
        {/* Mobile Cards View */}
        <div className="md:hidden space-y-4 mb-6" dir={direction}>
          {currentReceipts.map((receipt) => {
            let details: any = {}
            try {
              details = JSON.parse(receipt.itemDetails)
            } catch {}

            const clientName = details.memberName || details.clientName || details.name || '-'

            return (
              <div
                key={receipt.id}
                className="bg-white dark:bg-gray-800 border-r-4 border-primary-500 rounded-lg shadow-lg p-5"
              >
                {/* Header Section */}
                <div className="flex justify-between items-start mb-4 pb-3 border-b-2 border-gray-100 dark:border-gray-700">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">رقم الإيصال</span>
                    </div>
                    <span className="font-bold text-primary-600 dark:text-primary-400 text-xl">#{receipt.receiptNumber}</span>
                  </div>
                  <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-300">
                    {getTypeLabel(receipt.type)}
                  </span>
                </div>

                {/* Client Info Section */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-4">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-gray-500 dark:text-gray-400 text-sm min-w-[80px]">👤 العميل:</span>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 dark:text-white text-lg">{clientName}</p>
                      {details.phone && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">📱 {details.phone}</p>
                      )}
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {details.memberNumber && (
                          <span className="text-xs bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 px-2 py-1 rounded-full font-semibold">
                            عضوية #{details.memberNumber}
                          </span>
                        )}
                        {details.ptNumber && (
                          <span className="text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-1 rounded-full font-semibold">
                            {details.ptNumber < 0 ? '🏃 Day Use' : `PT #${details.ptNumber}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subscription Duration - للتجديد والاشتراك الجديد */}
                {(receipt.type === 'تجديد عضويه' || receipt.type === 'عضوية' || receipt.type === 'Member') && (details.duration || details.subscriptionDays) && (
                  <div className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/30 dark:to-yellow-900/30 rounded-lg p-3 mb-4 border-2 border-orange-200 dark:border-orange-700">
                    <div className="flex items-center gap-2">
                      <span className="text-orange-600 dark:text-orange-400 text-lg">⏰</span>
                      <div>
                        <p className="text-xs text-orange-700 dark:text-orange-300 font-semibold">{t('receipts.card.subscriptionDuration')}</p>
                        <p className="font-bold text-orange-900 dark:text-orange-200 text-lg">
                          {details.duration ? (
                            `${details.duration} ${details.duration === 1 ? t('receipts.card.month') : t('receipts.card.months')}`
                          ) : details.subscriptionDays ? (
                            details.subscriptionDays >= 30 ?
                              `${Math.round(details.subscriptionDays / 30)} ${Math.round(details.subscriptionDays / 30) === 1 ? 'شهر' : 'شهور'}`
                              : `${details.subscriptionDays} ${details.subscriptionDays === 1 ? 'يوم' : 'أيام'}`
                          ) : '-'}
                        </p>
                      </div>
                    </div>
                    {(details.endDate || details.expiryDate) && (
                      <div className="mt-2 pt-2 border-t border-orange-200 dark:border-orange-700">
                        <p className="text-xs text-orange-700 dark:text-orange-300">
                          📅 {t('receipts.card.expiresOn')}: <span className="font-semibold">{new Date(details.endDate || details.expiryDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}</span>
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* PT Details - معلومات البرايفت */}
                {(receipt.type === 'اشتراك برايفت' || receipt.type === 'تجديد برايفت') && (
                  <div className="bg-gradient-to-r from-primary-50 to-primary-50 dark:from-primary-900/30 dark:to-primary-900/30 rounded-lg p-4 mb-4 border-2 border-primary-300 dark:border-primary-700">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-primary-600 dark:text-primary-400 text-2xl">🏋️</span>
                      <div>
                        <p className="text-xs text-primary-700 dark:text-primary-300 font-semibold">تفاصيل البرايفت</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {details.sessionsPurchased && (
                        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-2 border border-primary-200 dark:border-primary-700">
                          <span className="text-sm text-gray-600 dark:text-gray-300">🎯 عدد الجلسات:</span>
                          <span className="font-bold text-primary-700 dark:text-primary-400 text-lg">{details.sessionsPurchased} جلسة</span>
                        </div>
                      )}
                      {details.coachName && (
                        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-2 border border-primary-200 dark:border-primary-700">
                          <span className="text-sm text-gray-600 dark:text-gray-300">👨‍🏫 الكوتش:</span>
                          <span className="font-bold text-primary-700 dark:text-primary-400">{details.coachName}</span>
                        </div>
                      )}
                      {details.pricePerSession && (
                        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-2 border border-primary-200 dark:border-primary-700">
                          <span className="text-sm text-gray-600 dark:text-gray-300">💵 سعر الجلسة:</span>
                          <span className="font-bold text-primary-700 dark:text-primary-400">{details.pricePerSession} {t('members.egp')}</span>
                        </div>
                      )}
                      {(details.startDate && details.expiryDate) && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-primary-200 dark:border-primary-700">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600 dark:text-gray-300">📅 من:</span>
                            <span className="font-semibold text-primary-700 dark:text-primary-400">{new Date(details.startDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs mt-1">
                            <span className="text-gray-600 dark:text-gray-300">📅 إلى:</span>
                            <span className="font-semibold text-primary-700 dark:text-primary-400">{new Date(details.expiryDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}</span>
                          </div>
                          {details.subscriptionDays && (
                            <div className="text-xs text-primary-600 dark:text-primary-400 text-center mt-2 pt-2 border-t border-primary-200 dark:border-primary-700">
                              ⏰ المدة: {details.subscriptionDays} يوم
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Upgrade Details - للترقية */}
                {receipt.type === 'ترقية باكدج' && details.isUpgrade && (
                  <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/30 dark:to-red-900/30 rounded-lg p-4 mb-4 border-2 border-orange-300 dark:border-orange-700">
                    <h4 className="font-bold text-orange-800 dark:text-orange-300 mb-3 flex items-center gap-2">
                      <span>🚀</span>
                      <span>{t('receipts.upgrade.title')}</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3">
                        <p className="text-orange-700 dark:text-orange-300 font-semibold mb-2">{t('receipts.upgrade.oldPackage')}</p>
                        <div className="space-y-1 text-gray-700 dark:text-gray-200">
                          <p className="text-xs">{t('offers.price')}: <span className="font-bold">{details.oldPackagePrice} {t('members.egp')}</span></p>
                          <p className="text-xs">PT: {details.oldFreePTSessions}</p>
                          <p className="text-xs">InBody: {details.oldInBodyScans}</p>
                          <p className="text-xs">{t('offers.invitations')}: {details.oldInvitations}</p>
                          {details.oldExpiryDate && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {t('members.expiryDate')}: {new Date(details.oldExpiryDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3">
                        <p className="text-green-700 dark:text-green-400 font-semibold mb-2">{t('receipts.upgrade.newPackage')}</p>
                        <div className="space-y-1 text-gray-700 dark:text-gray-200">
                          <p className="text-xs">{t('offers.price')}: <span className="font-bold text-green-600 dark:text-green-400">{details.newPackagePrice} {t('members.egp')}</span></p>
                          <p className="text-xs">PT: {details.newFreePTSessions}</p>
                          <p className="text-xs">InBody: {details.newInBodyScans}</p>
                          <p className="text-xs">{t('offers.invitations')}: {details.newInvitations}</p>
                          {details.newExpiryDate && (
                            <p className="text-xs text-green-600 dark:text-green-400">
                              {t('members.expiryDate')}: {new Date(details.newExpiryDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-orange-300 dark:border-orange-700">
                      <div className="flex justify-between items-center">
                        <span className="text-orange-800 dark:text-orange-300 font-bold text-sm">{t('receipts.upgrade.upgradeCost')}:</span>
                        <span className="text-xl font-bold text-green-600 dark:text-green-400">
                          {details.upgradeAmount} {t('members.egp')}
                        </span>
                      </div>
                      {details.startDate && (
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">
                          {t('receipts.upgrade.startDate')}: {new Date(details.startDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Payment Info Section */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/30 rounded-lg p-3">
                    <span className="text-gray-600 dark:text-gray-300 text-sm font-semibold">💰 {t('receipts.card.paidAmount')}</span>
                    <span className="font-bold text-green-600 dark:text-green-400 text-xl">{receipt.amount.toLocaleString()} {t('members.egp')}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400 text-sm">💳 {t('receipts.table.paymentMethod')}</span>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{getPaymentMethodLabel(receipt.paymentMethod, receipt.amount)}</span>
                  </div>

                  {details.discount > 0 && (
                    <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/30 rounded-lg p-2">
                      <span className="text-gray-500 dark:text-gray-400 text-sm">🏷️ {t('receipts.card.discount')}</span>
                      <span className="text-sm font-bold text-red-600 dark:text-red-400">{details.discount} {t('members.egp')}</span>
                    </div>
                  )}

                  {details.services && details.services.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-semibold">📋 {t('receipts.card.services')}</p>
                      <div className="space-y-1">
                        {details.services.map((service: any, idx: number) => (
                          <div key={idx} className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded">
                            • {service.name || service}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Info */}
                <div className="space-y-2 pt-3 border-t border-gray-200 dark:border-gray-600">
                  {receipt.staffName && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-gray-400 text-xs">👨‍💼</span>
                      <span className="text-sm text-gray-700 dark:text-gray-200">{receipt.staffName}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 dark:text-gray-400 text-xs">📅</span>
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      {new Date(receipt.createdAt).toLocaleString(direction === 'rtl' ? 'ar-EG' : 'en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>

                {/* Action Buttons - Grid Layout */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                  {/* الصف الأول - 3 أزرار */}
                  <ReceiptWhatsApp
                    receipt={receipt}
                    onDetailsClick={() => setSelectedReceipt(receipt)}
                  />

                  <button
                    onClick={() => handlePrint(receipt, { printOnly: true })}
                    className="bg-primary-600 text-white px-3 py-2 rounded-lg hover:bg-primary-700 text-sm transition shadow-md font-semibold"
                    title="طباعة فقط"
                  >
                    🖨️ {t('receipts.actions.print')}
                  </button>

                  <button
                    onClick={() => handleDownloadAndWhatsApp(receipt)}
                    className="bg-primary-600 text-white px-3 py-2 rounded-lg hover:bg-primary-700 text-sm transition shadow-md font-semibold"
                    title="تحميل PDF وإرسال واتساب"
                  >
                    PDF
                  </button>

                  {/* الصف الثاني - زر التعديل بمساحة 2، والحذف بمساحة 1 */}
                  {canEdit && !receipt.isCancelled && (
                    <button
                      onClick={() => handleOpenEdit(receipt)}
                      className="col-span-2 bg-orange-600 text-white px-3 py-2 rounded-lg hover:bg-orange-700 text-sm transition shadow-md font-semibold"
                      title={t('receipts.actions.edit')}
                    >
                      ✏️ {t('receipts.actions.edit')}
                    </button>
                  )}

                  {canCancel && !receipt.isCancelled && (
                    <button
                      onClick={() => handleCancelReceipt(receipt.id)}
                      className="bg-yellow-600 text-white px-3 py-2 rounded-lg hover:bg-yellow-700 text-sm transition shadow-md font-semibold"
                      title="إلغاء الإيصال"
                    >
                      🚫
                    </button>
                  )}

                  {canDelete && (
                    <button
                      onClick={() => handleDelete(receipt.id)}
                      className={`bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-sm transition shadow-md ${(!canEdit && !canCancel) || receipt.isCancelled ? 'col-span-3' : ''}`}
                      title={t('receipts.actions.delete')}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {filteredReceipts.length === 0 && !loading && (
            <div className="text-center py-20 text-gray-500 dark:text-gray-400">
              <div className="text-6xl mb-4">🧾</div>
              <p className="text-xl font-medium mb-2">
                {searchTerm || filterType !== 'all' || filterPayment !== 'all'
                  ? t('receipts.empty.noSearchResults')
                  : t('receipts.empty.noReceipts')}
              </p>
              {(searchTerm || filterType !== 'all' || filterPayment !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('')
                    setFilterType('all')
                    setFilterPayment('all')
                  }}
                  className="mt-4 bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
                >
                  {t('receipts.empty.clearFilters')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden" dir={direction}>
          <div className="overflow-x-auto">
            <table className="w-full" dir={direction}>
              <thead className="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800">
                <tr>
                  <th className={`px-4 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} font-bold dark:text-gray-100`}>{t('receipts.table.receiptNumber')}</th>
                  <th className={`px-4 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} font-bold dark:text-gray-100`}>{t('receipts.table.type')}</th>
                  <th className={`px-4 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} font-bold dark:text-gray-100`}>{t('receipts.table.client')}</th>
                  <th className={`px-4 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} font-bold dark:text-gray-100`}>{t('receipts.table.details')}</th>
                  <th className={`px-4 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} font-bold dark:text-gray-100`}>{t('receipts.table.amount')}</th>
                  <th className={`px-4 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} font-bold dark:text-gray-100`}>{t('receipts.table.paymentMethod')}</th>
                  <th className={`px-4 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} font-bold dark:text-gray-100`}>{t('receipts.table.staff')}</th>
                  <th className={`px-4 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} font-bold dark:text-gray-100`}>{t('receipts.table.date')}</th>
                  <th className={`px-4 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} font-bold dark:text-gray-100`}>{t('receipts.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {currentReceipts.map((receipt) => {
                let details: any = {}
                try {
                  details = JSON.parse(receipt.itemDetails)
                } catch {}

                const clientName = details.memberName || details.clientName || details.name || '-'

                return (
                  <tr
                    key={receipt.id}
                    className={`border-t dark:border-gray-700 transition ${
                      receipt.isCancelled
                        ? 'bg-red-200 hover:bg-red-300 dark:bg-red-900/30 dark:hover:bg-red-900/50 border-l-4 border-red-600 dark:border-red-500'
                        : 'hover:bg-primary-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <td className="px-4 py-4">
                      <div>
                        <span className={`font-bold text-lg ${
                          receipt.isCancelled ? 'text-red-600 dark:text-red-400' : 'text-primary-600 dark:text-primary-400'
                        }`}>#{receipt.receiptNumber}</span>
                        {receipt.isCancelled && (
                          <div className="mt-1">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 dark:bg-red-700 text-white">
                              ❌ ملغي
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-300">
                        {getTypeLabel(receipt.type)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">{clientName}</p>
                        {details.phone && (
                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">{details.phone}</p>
                        )}
                        <div className="flex gap-1 mt-1">
                          {details.memberNumber && (
                            <span className="text-xs bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full">
                              عضوية #{details.memberNumber}
                            </span>
                          )}
                          {details.ptNumber && (
                            <span className="text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                              {details.ptNumber < 0 ? '🏃 Day Use' : `PT #${details.ptNumber}`}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        {/* مدة الاشتراك للعضويات */}
                        {(receipt.type === 'تجديد عضويه' || receipt.type === 'عضوية' || receipt.type === 'Member') && (details.duration || details.subscriptionDays) && (
                          <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 rounded px-2 py-1">
                            <p className="text-xs text-orange-700 dark:text-orange-300 font-semibold">
                              ⏰ {details.duration ? (
                                `${details.duration} ${details.duration === 1 ? 'شهر' : 'شهور'}`
                              ) : details.subscriptionDays ? (
                                details.subscriptionDays >= 30 ?
                                  `${Math.round(details.subscriptionDays / 30)} ${Math.round(details.subscriptionDays / 30) === 1 ? 'شهر' : 'شهور'}`
                                  : `${details.subscriptionDays} ${details.subscriptionDays === 1 ? 'يوم' : 'أيام'}`
                              ) : '-'}
                            </p>
                            {(details.endDate || details.expiryDate) && (
                              <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                                حتى {new Date(details.endDate || details.expiryDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                              </p>
                            )}
                          </div>
                        )}
                        {/* تفاصيل PT */}
                        {(receipt.type === 'اشتراك برايفت' || receipt.type === 'تجديد برايفت') && (
                          <div className="bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-700 rounded px-2 py-1 space-y-1">
                            {details.sessionsPurchased && (
                              <p className="text-xs text-primary-700 dark:text-primary-300 font-semibold">
                                🎯 {details.sessionsPurchased} جلسة
                              </p>
                            )}
                            {details.coachName && (
                              <p className="text-xs text-primary-600 dark:text-primary-400">
                                👨‍🏫 {details.coachName}
                              </p>
                            )}
                            {details.subscriptionDays && (
                              <p className="text-xs text-primary-600 dark:text-primary-400">
                                ⏰ {details.subscriptionDays} يوم
                              </p>
                            )}
                          </div>
                        )}
                        {details.discount > 0 && (
                          <p className="text-xs text-red-600 dark:text-red-400 font-semibold">
                            🏷️ خصم: {details.discount} {t('common.currency')}
                          </p>
                        )}
                        {details.services && details.services.length > 0 && (
                          <p className="text-xs text-gray-600 dark:text-gray-300">
                            📋 {details.services.length} خدمة
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-bold text-green-600 dark:text-green-400 text-lg">{receipt.amount.toLocaleString()} {t('common.currency')}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-semibold dark:text-gray-200">{getPaymentMethodLabel(receipt.paymentMethod, receipt.amount)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-600 dark:text-gray-300">{receipt.staffName || '-'}</span>
                    </td>
                    <td className="px-4 py-4 text-xs text-gray-600 dark:text-gray-300">
                      {new Date(receipt.createdAt).toLocaleString(direction === 'rtl' ? 'ar-EG' : 'en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {/* ✅ WhatsApp Component */}
                        <ReceiptWhatsApp 
                          receipt={receipt} 
                          onDetailsClick={() => setSelectedReceipt(receipt)}
                        />
                        
                        <button
                          onClick={() => handlePrint(receipt, { printOnly: true })}
                          className="bg-primary-600 text-white px-3 py-2 rounded-lg hover:bg-primary-700 text-sm transition shadow-md hover:shadow-lg"
                          title="طباعة فقط"
                        >
                          🖨️
                        </button>

                        <button
                          onClick={() => handleDownloadAndWhatsApp(receipt)}
                          className="bg-primary-600 text-white px-3 py-2 rounded-lg hover:bg-primary-700 text-sm transition shadow-md hover:shadow-lg font-semibold"
                          title="تحميل PDF وإرسال واتساب"
                        >
                          PDF
                        </button>

                        {canEdit && !receipt.isCancelled && (
                          <button
                            onClick={() => handleOpenEdit(receipt)}
                            className="bg-orange-600 text-white px-3 py-2 rounded-lg hover:bg-orange-700 text-sm transition shadow-md hover:shadow-lg"
                            title={t('receipts.actions.edit')}
                          >
                            ✏️
                          </button>
                        )}

                        {canCancel && !receipt.isCancelled && (
                          <button
                            onClick={() => handleCancelReceipt(receipt.id)}
                            className="bg-yellow-600 text-white px-3 py-2 rounded-lg hover:bg-yellow-700 text-sm transition shadow-md hover:shadow-lg"
                            title="إلغاء الإيصال"
                          >
                            🚫
                          </button>
                        )}

                        {canDelete && (
                          <button
                            onClick={() => handleDelete(receipt.id)}
                            className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-sm transition shadow-md hover:shadow-lg"
                            title={t('receipts.actions.delete')}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

          {filteredReceipts.length === 0 && !loading && (
            <div className="text-center py-20 text-gray-500 dark:text-gray-400">
              <div className="text-6xl mb-4">🧾</div>
              <p className="text-xl font-medium mb-2">
                {searchTerm || filterType !== 'all' || filterPayment !== 'all'
                  ? t('receipts.empty.noSearchResults')
                  : t('receipts.empty.noReceipts')}
              </p>
              {(searchTerm || filterType !== 'all' || filterPayment !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('')
                    setFilterType('all')
                    setFilterPayment('all')
                  }}
                  className="mt-4 bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
                >
                  {t('receipts.empty.clearFilters')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {filteredReceipts.length > 0 && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-lg" dir={direction}>
            {/* معلومات الصفحة */}
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {t('receipts.pagination.showing', {
                start: (startIndex + 1).toString(),
                end: Math.min(endIndex, filteredReceipts.length).toString(),
                total: filteredReceipts.length.toString()
              })}
            </div>

            {/* أزرار التنقل */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors dark:text-gray-100"
                title={t('receipts.pagination.first')}
              >
                {t('receipts.pagination.first')}
              </button>

              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors dark:text-gray-100"
                title={t('receipts.pagination.previous')}
              >
                {t('receipts.pagination.previous')}
              </button>

              {/* أرقام الصفحات */}
              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => goToPage(pageNum)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === pageNum
                          ? 'bg-primary-600 text-white'
                          : 'hover:bg-gray-200 dark:hover:bg-gray-600 dark:text-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors dark:text-gray-100"
                title={t('receipts.pagination.next')}
              >
                {t('receipts.pagination.next')}
              </button>

              <button
                onClick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors dark:text-gray-100"
                title={t('receipts.pagination.last')}
              >
                {t('receipts.pagination.last')}
              </button>
            </div>

            {/* اختيار عدد العناصر في الصفحة */}
            <div className="flex items-center gap-2 text-sm">
              <label className="text-gray-600 dark:text-gray-300">{t('receipts.pagination.itemsPerPage')}:</label>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1 focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        )}
      </>

      {/* Detail Modal */}
      {selectedReceipt && (
        <ReceiptDetailModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && editingReceipt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-5xl w-full p-5 max-h-[90vh] overflow-y-auto" dir={direction}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold">✏️ {t('receipts.edit.title')}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">{t('receipts.edit.subtitle')} #{editingReceipt.receiptNumber}</p>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingReceipt(null)
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-3xl leading-none"
              >
                ×
              </button>
            </div>

            {/* معلومات الإيصال الأساسية */}
            <div className={`bg-primary-50 dark:bg-primary-900/30 ${direction === 'rtl' ? 'border-r-4' : 'border-l-4'} border-primary-500 dark:border-primary-700 rounded-lg p-3 mb-4`}>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-300">{t('receipts.edit.type')}:</span>
                  <span className={`font-bold dark:text-gray-100 ${direction === 'rtl' ? 'mr-2' : 'ml-2'}`}>{getTypeLabel(editingReceipt.type)}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-300">{t('receipts.edit.date')}:</span>
                  <span className={`font-bold dark:text-gray-100 ${direction === 'rtl' ? 'mr-2' : 'ml-2'}`}>
                    {new Date(editingReceipt.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {/* الصف الأول: رقم الإيصال والمبلغ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* رقم الإيصال */}
                <div>
                  <label className="block text-sm font-bold mb-1.5 dark:text-gray-100">
                    {t('receipts.edit.receiptNumberRequired')}
                  </label>
                  <input
                    type="number"
                    value={editFormData.receiptNumber}
                    onChange={(e) => setEditFormData({ ...editFormData, receiptNumber: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    placeholder="1000"
                  />
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    ⚠️ {t('receipts.edit.receiptNumberWarning')}
                  </p>
                </div>

                {/* المبلغ */}
                <div>
                  <label className="block text-sm font-bold mb-1.5 dark:text-gray-100">
                    {t('receipts.edit.amountRequired')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.amount}
                    onChange={(e) => setEditFormData({ ...editFormData, amount: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* الصف الثاني: طريقة الدفع واسم الموظف */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* طريقة الدفع */}
                <div>
                  <label className="block text-sm font-bold mb-1.5 dark:text-gray-100">
                    {t('receipts.edit.paymentMethodRequired')}
                  </label>
                  <select
                    value={editFormData.paymentMethod}
                    onChange={(e) => setEditFormData({ ...editFormData, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="cash">💵 {t('receipts.paymentMethods.cash')}</option>
                    <option value="visa">💳 {t('receipts.paymentMethods.visa')}</option>
                    <option value="wallet">👛 {t('receipts.paymentMethods.wallet')}</option>
                    <option value="instapay">💸 {t('receipts.paymentMethods.instapay')}</option>
                    <option value="points">🏆 {t('receipts.paymentMethods.points') || 'نقاط'}</option>
                  </select>
                </div>

                {/* اسم الموظف */}
                <div>
                  <label className="block text-sm font-bold mb-1.5 dark:text-gray-100">
                    {t('receipts.edit.staffNameOptional')}
                  </label>
                  <input
                    type="text"
                    value={editFormData.staffName}
                    onChange={(e) => setEditFormData({ ...editFormData, staffName: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    placeholder={t('receipts.edit.staffPlaceholder')}
                  />
                </div>
              </div>

              {/* تاريخ الإيصال */}
              <div>
                <label className="block text-sm font-bold mb-1.5 dark:text-gray-100">
                  {t('receipts.edit.receiptDateRequired')}
                </label>
                <input
                  type="datetime-local"
                  value={editFormData.createdAt}
                  onChange={(e) => setEditFormData({ ...editFormData, createdAt: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  ℹ️ {t('receipts.edit.dateNote')}
                </p>
              </div>

              {/* ملاحظة تحذيرية */}
              <div className={`bg-yellow-50 dark:bg-yellow-900/30 ${direction === 'rtl' ? 'border-r-4' : 'border-l-4'} border-yellow-500 dark:border-yellow-700 rounded-lg p-3`}>
                <div className="flex items-start gap-2">
                  <div className="text-xl">⚠️</div>
                  <div>
                    <p className="font-bold text-yellow-800 dark:text-yellow-300 text-sm mb-0.5">{t('receipts.edit.warning')}</p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-400">
                      {t('receipts.edit.warningMessage')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* الأزرار */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSaveEdit}
                className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg hover:bg-primary-700 transition font-bold shadow-lg hover:shadow-xl"
              >
                ✅ {t('receipts.edit.save')}
              </button>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingReceipt(null)
                }}
                className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg hover:bg-gray-300 transition font-bold"
              >
                {t('receipts.edit.cancel')}
              </button>
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
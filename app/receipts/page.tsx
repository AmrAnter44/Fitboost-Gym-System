'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { usePermissions } from '../../hooks/usePermissions'
import { useLanguage } from '../../contexts/LanguageContext'
import PermissionDenied from '../../components/PermissionDenied'
import ReceiptWhatsApp from '../../components/ReceiptWhatsApp'
import { ReceiptDetailModal } from '../../components/ReceiptDetailModal'
import { printReceiptFromData } from '../../lib/printSystem'
import { useConfirm } from '../../hooks/useConfirm'
import ConfirmDialog from '../../components/ConfirmDialog'
import { normalizePaymentMethod, isMultiPayment, getPaymentMethodLabel as getPaymentLabel } from '../../lib/paymentHelpers'
import { useToast } from '../../contexts/ToastContext'
import { fetchReceipts, fetchNextReceiptNumber } from '../../lib/api/receipts'

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

  // ✅ استخدام useQuery لجلب رقم الإيصال التالي
  const {
    data: fetchedNextReceiptNumber = 1000
  } = useQuery({
    queryKey: ['nextReceiptNumber'],
    queryFn: fetchNextReceiptNumber,
    enabled: !permissionsLoading && hasPermission('canViewReceipts'),
    retry: 1,
    staleTime: 60 * 1000, // fresh لمدة دقيقة
  })

  // State محلي لتعديل رقم الإيصال التالي
  const [nextReceiptNumber, setNextReceiptNumber] = useState(fetchedNextReceiptNumber)

  // تحديث الـ state المحلي عند تغيير البيانات المجلوبة
  useEffect(() => {
    setNextReceiptNumber(fetchedNextReceiptNumber)
  }, [fetchedNextReceiptNumber])

  const [filteredReceipts, setFilteredReceipts] = useState<Receipt[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterPayment, setFilterPayment] = useState('all')
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
  const [showReceiptNumberEdit, setShowReceiptNumberEdit] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // ✅ جميع الـ hooks يجب أن تكون قبل أي return
  const canEdit = hasPermission('canEditReceipts')
  const canDelete = hasPermission('canDeleteReceipts')

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

  // حساب الصفحات
  const totalPages = Math.ceil(filteredReceipts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentReceipts = filteredReceipts.slice(startIndex, endIndex)

  const goToPage = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ✅ تطبيق الفلاتر عند تغيير البيانات أو الفلاتر
  useEffect(() => {
    if (!Array.isArray(receipts)) {
      setFilteredReceipts([])
      return
    }

    let filtered = [...receipts]

    // فلتر البحث
    if (searchTerm) {
      filtered = filtered.filter(r => {
        try {
          const details = JSON.parse(r.itemDetails)
          return (
            r.receiptNumber.toString().includes(searchTerm) ||
            details.memberName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            details.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            details.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            details.memberNumber?.toString().includes(searchTerm) ||
            details.ptNumber?.toString().includes(searchTerm) ||
            details.phone?.includes(searchTerm) ||
            r.staffName?.toLowerCase().includes(searchTerm.toLowerCase())
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

    setFilteredReceipts(filtered)
    setCurrentPage(1)
  }, [receipts, searchTerm, filterType, filterPayment])

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
        'instapay': '💸'
      }

      return (
        <div className="flex flex-col gap-0.5 text-xs">
          {normalized.methods.map((m, idx) => (
            <div key={idx}>
              {emojis[m.method] || '💰'} {Math.round(m.amount)}
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
      'instapay': `💸 ${t('receipts.paymentMethods.instapay')}`
    }
    return labels[method] || method
  }

  const handleCancelReceipt = async (receiptId: string) => {
    if (!canEdit) {
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

    try {
      const response = await fetch(`/api/receipts/${receiptId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'إلغاء يدوي' })
      })

      if (response.ok) {
        toast.success('تم إلغاء الإيصال بنجاح')
        refetchReceipts()
      } else {
        const error = await response.json()
        toast.error(error.error || 'فشل إلغاء الإيصال')
      }
    } catch (error) {
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

    try {
      const response = await fetch(`/api/receipts/update?id=${receiptId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success(t('receipts.delete.success'))
        refetchReceipts()
      } else {
        const error = await response.json()
        toast.error(error.error || t('receipts.delete.error'))
      }
    } catch (error) {
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
          createdAt: editFormData.createdAt ? new Date(editFormData.createdAt).toISOString() : undefined
        })
      })

      if (response.ok) {
        toast.success(t('receipts.edit.success'))
        setShowEditModal(false)
        setEditingReceipt(null)
        refetchReceipts()
      } else {
        const error = await response.json()
        toast.error(error.error || t('receipts.edit.error'))
      }
    } catch (error) {
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
      alert(`❌ ${t('receipts.actions.printError')}`)
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
        const pdfPath = pdfResult?.filePath
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

  const handleUpdateNextReceiptNumber = async () => {
    if (nextReceiptNumber < 1) {
      alert(t('receipts.nextReceiptNumber.invalidNumber'))
      return
    }

    try {
      const response = await fetch('/api/receipts/next-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startNumber: nextReceiptNumber })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message)
        setShowReceiptNumberEdit(false)
      } else {
        toast.error(data.error)
      }
    } catch (error) {
      toast.error('حدث خطأ في التحديث')
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 text-center" dir={direction}>
        <div className="text-6xl mb-4">⏳</div>
        <p className="text-xl">{t('receipts.loading')}</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 md:px-6" dir={direction}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">🧾 {t('receipts.title')}</h1>
          <p className="text-gray-600">{t('receipts.subtitle')}</p>
          {user && (
            <p className="text-sm text-gray-500 mt-1">
              👤 {user.name} - {user.role === 'ADMIN' ? '👑 مدير' : user.role === 'MANAGER' ? '📊 مشرف' : '👷 موظف'}
            </p>
          )}
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold">{filteredReceipts.length}</div>
              <div className="text-sm opacity-90">{t('receipts.stats.totalReceipts')}</div>
            </div>
            <div className="text-5xl opacity-20">📊</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold">{getTodayCount()}</div>
              <div className="text-sm opacity-90">{t('receipts.stats.todayReceipts')}</div>
            </div>
            <div className="text-5xl opacity-20">📅</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold">{getTodayRevenue().toLocaleString()}</div>
              <div className="text-sm opacity-90">{t('receipts.stats.todayRevenue')}</div>
            </div>
            <div className="text-5xl opacity-20">💵</div>
          </div>
        </div>
      </div>

      {/* تعديل رقم الإيصال التالي - قسم صغير */}
      <div className="bg-white rounded-xl shadow-lg p-4 mb-6" dir={direction}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔢</span>
            <div>
              <p className="font-bold text-sm">{t('receipts.nextReceiptNumber.title')}</p>
              <p className="text-xs text-gray-600">#{nextReceiptNumber}</p>
            </div>
          </div>
          <button
            onClick={() => setShowReceiptNumberEdit(!showReceiptNumberEdit)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition"
          >
            {showReceiptNumberEdit ? `✕ ${t('receipts.nextReceiptNumber.cancel')}` : `✏️ ${t('receipts.nextReceiptNumber.edit')}`}
          </button>
        </div>

        {showReceiptNumberEdit && (
          <div className="mt-4 pt-4 border-t flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1 text-gray-700">
                {t('receipts.nextReceiptNumber.newNumber')}
              </label>
              <input
                type="number"
                value={nextReceiptNumber}
                onChange={(e) => setNextReceiptNumber(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="1000"
              />
            </div>
            <button
              onClick={handleUpdateNextReceiptNumber}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition"
            >
              ✓ {t('receipts.nextReceiptNumber.save')}
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6" dir={direction}>
        <h3 className="text-lg font-bold mb-4">🔍 {t('receipts.filters.title')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">🔍 {t('receipts.filters.search')}</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('receipts.filters.searchPlaceholder')}
              className="w-full px-3 py-2 md:px-4 border-2 rounded-lg focus:ring-2 focus:ring-blue-500"
              dir={direction}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">📋 {t('receipts.filters.receiptType')}</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 md:px-4 border-2 rounded-lg focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-sm font-medium mb-2">💳 {t('receipts.filters.paymentMethod')}</label>
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              className="w-full px-3 py-2 md:px-4 border-2 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t('receipts.filters.all')}</option>
              <option value="cash">{t('receipts.paymentMethods.cash')}</option>
              <option value="visa">{t('receipts.paymentMethods.visa')}</option>
              <option value="wallet">{t('receipts.paymentMethods.wallet')}</option>
              <option value="instapay">{t('receipts.paymentMethods.instapay')}</option>
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
            className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
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
                className="bg-white border-r-4 border-blue-500 rounded-lg shadow-lg p-5"
              >
                {/* Header Section */}
                <div className="flex justify-between items-start mb-4 pb-3 border-b-2 border-gray-100">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-500">رقم الإيصال</span>
                    </div>
                    <span className="font-bold text-blue-600 text-xl">#{receipt.receiptNumber}</span>
                  </div>
                  <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                    {getTypeLabel(receipt.type)}
                  </span>
                </div>

                {/* Client Info Section */}
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-gray-500 text-sm min-w-[80px]">👤 العميل:</span>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 text-lg">{clientName}</p>
                      {details.phone && (
                        <p className="text-sm text-gray-600 mt-1">📱 {details.phone}</p>
                      )}
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {details.memberNumber && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">
                            عضوية #{details.memberNumber}
                          </span>
                        )}
                        {details.ptNumber && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">
                            {details.ptNumber < 0 ? '🏃 Day Use' : `PT #${details.ptNumber}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Subscription Duration - للتجديد والاشتراك الجديد */}
                {(receipt.type === 'تجديد عضويه' || receipt.type === 'عضوية' || receipt.type === 'Member') && (details.duration || details.subscriptionDays) && (
                  <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg p-3 mb-4 border-2 border-orange-200">
                    <div className="flex items-center gap-2">
                      <span className="text-orange-600 text-lg">⏰</span>
                      <div>
                        <p className="text-xs text-orange-700 font-semibold">{t('receipts.card.subscriptionDuration')}</p>
                        <p className="font-bold text-orange-900 text-lg">
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
                      <div className="mt-2 pt-2 border-t border-orange-200">
                        <p className="text-xs text-orange-700">
                          📅 {t('receipts.card.expiresOn')}: <span className="font-semibold">{new Date(details.endDate || details.expiryDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}</span>
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* PT Details - معلومات البرايفت */}
                {(receipt.type === 'اشتراك برايفت' || receipt.type === 'تجديد برايفت') && (
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4 mb-4 border-2 border-purple-300">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-purple-600 text-2xl">🏋️</span>
                      <div>
                        <p className="text-xs text-purple-700 font-semibold">تفاصيل البرايفت</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {details.sessionsPurchased && (
                        <div className="flex items-center justify-between bg-white rounded-lg p-2 border border-purple-200">
                          <span className="text-sm text-gray-600">🎯 عدد الجلسات:</span>
                          <span className="font-bold text-purple-700 text-lg">{details.sessionsPurchased} جلسة</span>
                        </div>
                      )}
                      {details.coachName && (
                        <div className="flex items-center justify-between bg-white rounded-lg p-2 border border-purple-200">
                          <span className="text-sm text-gray-600">👨‍🏫 الكوتش:</span>
                          <span className="font-bold text-purple-700">{details.coachName}</span>
                        </div>
                      )}
                      {details.pricePerSession && (
                        <div className="flex items-center justify-between bg-white rounded-lg p-2 border border-purple-200">
                          <span className="text-sm text-gray-600">💵 سعر الجلسة:</span>
                          <span className="font-bold text-purple-700">{details.pricePerSession} {t('members.egp')}</span>
                        </div>
                      )}
                      {(details.startDate && details.expiryDate) && (
                        <div className="bg-white rounded-lg p-2 border border-purple-200">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">📅 من:</span>
                            <span className="font-semibold text-purple-700">{new Date(details.startDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs mt-1">
                            <span className="text-gray-600">📅 إلى:</span>
                            <span className="font-semibold text-purple-700">{new Date(details.expiryDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}</span>
                          </div>
                          {details.subscriptionDays && (
                            <div className="text-xs text-purple-600 text-center mt-2 pt-2 border-t border-purple-200">
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
                  <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-4 mb-4 border-2 border-orange-300">
                    <h4 className="font-bold text-orange-800 mb-3 flex items-center gap-2">
                      <span>🚀</span>
                      <span>{t('receipts.upgrade.title')}</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-white/50 rounded-lg p-3">
                        <p className="text-orange-700 font-semibold mb-2">{t('receipts.upgrade.oldPackage')}</p>
                        <div className="space-y-1 text-gray-700">
                          <p className="text-xs">{t('offers.price')}: <span className="font-bold">{details.oldPackagePrice} {t('members.egp')}</span></p>
                          <p className="text-xs">PT: {details.oldFreePTSessions}</p>
                          <p className="text-xs">InBody: {details.oldInBodyScans}</p>
                          <p className="text-xs">{t('offers.invitations')}: {details.oldInvitations}</p>
                          {details.oldExpiryDate && (
                            <p className="text-xs text-gray-500">
                              {t('members.expiryDate')}: {new Date(details.oldExpiryDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="bg-white/50 rounded-lg p-3">
                        <p className="text-green-700 font-semibold mb-2">{t('receipts.upgrade.newPackage')}</p>
                        <div className="space-y-1 text-gray-700">
                          <p className="text-xs">{t('offers.price')}: <span className="font-bold text-green-600">{details.newPackagePrice} {t('members.egp')}</span></p>
                          <p className="text-xs">PT: {details.newFreePTSessions}</p>
                          <p className="text-xs">InBody: {details.newInBodyScans}</p>
                          <p className="text-xs">{t('offers.invitations')}: {details.newInvitations}</p>
                          {details.newExpiryDate && (
                            <p className="text-xs text-green-600">
                              {t('members.expiryDate')}: {new Date(details.newExpiryDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-orange-300">
                      <div className="flex justify-between items-center">
                        <span className="text-orange-800 font-bold text-sm">{t('receipts.upgrade.upgradeCost')}:</span>
                        <span className="text-xl font-bold text-green-600">
                          {details.upgradeAmount} {t('members.egp')}
                        </span>
                      </div>
                      {details.startDate && (
                        <p className="text-xs text-gray-600 mt-2">
                          {t('receipts.upgrade.startDate')}: {new Date(details.startDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Payment Info Section */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between bg-green-50 rounded-lg p-3">
                    <span className="text-gray-600 text-sm font-semibold">💰 {t('receipts.card.paidAmount')}</span>
                    <span className="font-bold text-green-600 text-xl">{receipt.amount.toLocaleString()} {t('members.egp')}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-sm">💳 {t('receipts.table.paymentMethod')}</span>
                    <span className="text-sm font-semibold text-gray-700">{getPaymentMethodLabel(receipt.paymentMethod, receipt.amount)}</span>
                  </div>

                  {details.discount > 0 && (
                    <div className="flex items-center justify-between bg-red-50 rounded-lg p-2">
                      <span className="text-gray-500 text-sm">🏷️ {t('receipts.card.discount')}</span>
                      <span className="text-sm font-bold text-red-600">{details.discount} {t('members.egp')}</span>
                    </div>
                  )}

                  {details.services && details.services.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-2 font-semibold">📋 {t('receipts.card.services')}</p>
                      <div className="space-y-1">
                        {details.services.map((service: any, idx: number) => (
                          <div key={idx} className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                            • {service.name || service}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Info */}
                <div className="space-y-2 pt-3 border-t border-gray-200">
                  {receipt.staffName && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-xs">👨‍💼</span>
                      <span className="text-sm text-gray-700">{receipt.staffName}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-xs">📅</span>
                    <span className="text-xs text-gray-600">
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
                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-gray-200">
                  {/* الصف الأول - 3 أزرار */}
                  <ReceiptWhatsApp
                    receipt={receipt}
                    onDetailsClick={() => setSelectedReceipt(receipt)}
                  />

                  <button
                    onClick={() => handlePrint(receipt, { printOnly: true })}
                    className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm transition shadow-md font-semibold"
                    title="طباعة فقط"
                  >
                    🖨️ {t('receipts.actions.print')}
                  </button>

                  <button
                    onClick={() => handleDownloadAndWhatsApp(receipt)}
                    className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 text-sm transition shadow-md font-semibold"
                    title="تحميل PDF وإرسال واتساب"
                  >
                    PDF
                  </button>

                  {/* الصف الثاني - زر التعديل بمساحة 2، والحذف بمساحة 1 */}
                  {canEdit && (
                    <button
                      onClick={() => handleOpenEdit(receipt)}
                      className="col-span-2 bg-orange-600 text-white px-3 py-2 rounded-lg hover:bg-orange-700 text-sm transition shadow-md font-semibold"
                      title={t('receipts.actions.edit')}
                    >
                      ✏️ {t('receipts.actions.edit')}
                    </button>
                  )}

                  {canDelete && (
                    <button
                      onClick={() => handleDelete(receipt.id)}
                      className={`bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-sm transition shadow-md ${!canEdit ? 'col-span-3' : ''}`}
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
            <div className="text-center py-20 text-gray-500">
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
                  className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                >
                  {t('receipts.empty.clearFilters')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block bg-white rounded-xl shadow-lg overflow-hidden" dir={direction}>
          <div className="overflow-x-auto">
            <table className="w-full" dir={direction}>
              <thead className="bg-gradient-to-r from-gray-100 to-gray-200">
                <tr>
                  <th className={`px-4 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} font-bold`}>{t('receipts.table.receiptNumber')}</th>
                  <th className={`px-4 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} font-bold`}>{t('receipts.table.type')}</th>
                  <th className={`px-4 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} font-bold`}>{t('receipts.table.client')}</th>
                  <th className={`px-4 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} font-bold`}>{t('receipts.table.details')}</th>
                  <th className={`px-4 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} font-bold`}>{t('receipts.table.amount')}</th>
                  <th className={`px-4 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} font-bold`}>{t('receipts.table.paymentMethod')}</th>
                  <th className={`px-4 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} font-bold`}>{t('receipts.table.staff')}</th>
                  <th className={`px-4 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} font-bold`}>{t('receipts.table.date')}</th>
                  <th className={`px-4 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} font-bold`}>{t('receipts.table.actions')}</th>
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
                    className={`border-t transition ${
                      receipt.isCancelled
                        ? 'bg-red-200 hover:bg-red-300 border-l-4 border-red-600'
                        : 'hover:bg-blue-50'
                    }`}
                  >
                    <td className="px-4 py-4">
                      <div>
                        <span className={`font-bold text-lg ${
                          receipt.isCancelled ? 'text-red-600' : 'text-blue-600'
                        }`}>#{receipt.receiptNumber}</span>
                        {receipt.isCancelled && (
                          <div className="mt-1">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
                              ❌ ملغي
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                        {getTypeLabel(receipt.type)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-bold text-gray-900">{clientName}</p>
                        {details.phone && (
                          <p className="text-xs text-gray-600 mt-0.5">{details.phone}</p>
                        )}
                        <div className="flex gap-1 mt-1">
                          {details.memberNumber && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                              عضوية #{details.memberNumber}
                            </span>
                          )}
                          {details.ptNumber && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
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
                          <div className="bg-orange-50 border border-orange-200 rounded px-2 py-1">
                            <p className="text-xs text-orange-700 font-semibold">
                              ⏰ {details.duration ? (
                                `${details.duration} ${details.duration === 1 ? 'شهر' : 'شهور'}`
                              ) : details.subscriptionDays ? (
                                details.subscriptionDays >= 30 ?
                                  `${Math.round(details.subscriptionDays / 30)} ${Math.round(details.subscriptionDays / 30) === 1 ? 'شهر' : 'شهور'}`
                                  : `${details.subscriptionDays} ${details.subscriptionDays === 1 ? 'يوم' : 'أيام'}`
                              ) : '-'}
                            </p>
                            {(details.endDate || details.expiryDate) && (
                              <p className="text-xs text-orange-600 mt-0.5">
                                حتى {new Date(details.endDate || details.expiryDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                              </p>
                            )}
                          </div>
                        )}
                        {/* تفاصيل PT */}
                        {(receipt.type === 'اشتراك برايفت' || receipt.type === 'تجديد برايفت') && (
                          <div className="bg-purple-50 border border-purple-200 rounded px-2 py-1 space-y-1">
                            {details.sessionsPurchased && (
                              <p className="text-xs text-purple-700 font-semibold">
                                🎯 {details.sessionsPurchased} جلسة
                              </p>
                            )}
                            {details.coachName && (
                              <p className="text-xs text-purple-600">
                                👨‍🏫 {details.coachName}
                              </p>
                            )}
                            {details.subscriptionDays && (
                              <p className="text-xs text-purple-600">
                                ⏰ {details.subscriptionDays} يوم
                              </p>
                            )}
                          </div>
                        )}
                        {details.discount > 0 && (
                          <p className="text-xs text-red-600 font-semibold">
                            🏷️ خصم: {details.discount} {t('common.currency')}
                          </p>
                        )}
                        {details.services && details.services.length > 0 && (
                          <p className="text-xs text-gray-600">
                            📋 {details.services.length} خدمة
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-bold text-green-600 text-lg">{receipt.amount.toLocaleString()} {t('common.currency')}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-semibold">{getPaymentMethodLabel(receipt.paymentMethod, receipt.amount)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-600">{receipt.staffName || '-'}</span>
                    </td>
                    <td className="px-4 py-4 text-xs text-gray-600">
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
                          className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm transition shadow-md hover:shadow-lg"
                          title="طباعة فقط"
                        >
                          🖨️
                        </button>

                        <button
                          onClick={() => handleDownloadAndWhatsApp(receipt)}
                          className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 text-sm transition shadow-md hover:shadow-lg font-semibold"
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

                        {canEdit && !receipt.isCancelled && (
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
            <div className="text-center py-20 text-gray-500">
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
                  className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                >
                  {t('receipts.empty.clearFilters')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {filteredReceipts.length > 0 && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 px-4 py-3 bg-gray-50 rounded-lg" dir={direction}>
            {/* معلومات الصفحة */}
            <div className="text-sm text-gray-600">
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
                className="px-3 py-1 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
                title={t('receipts.pagination.first')}
              >
                {t('receipts.pagination.first')}
              </button>

              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
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
                          ? 'bg-blue-600 text-white'
                          : 'hover:bg-gray-200'
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
                className="px-3 py-1 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
                title={t('receipts.pagination.next')}
              >
                {t('receipts.pagination.next')}
              </button>

              <button
                onClick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
                title={t('receipts.pagination.last')}
              >
                {t('receipts.pagination.last')}
              </button>
            </div>

            {/* اختيار عدد العناصر في الصفحة */}
            <div className="flex items-center gap-2 text-sm">
              <label className="text-gray-600">{t('receipts.pagination.itemsPerPage')}:</label>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value))
                  setCurrentPage(1)
                }}
                className="border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full p-5 max-h-[90vh] overflow-y-auto" dir={direction}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold">✏️ {t('receipts.edit.title')}</h2>
                <p className="text-sm text-gray-600">{t('receipts.edit.subtitle')} #{editingReceipt.receiptNumber}</p>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingReceipt(null)
                }}
                className="text-gray-400 hover:text-gray-600 text-3xl leading-none"
              >
                ×
              </button>
            </div>

            {/* معلومات الإيصال الأساسية */}
            <div className={`bg-blue-50 ${direction === 'rtl' ? 'border-r-4' : 'border-l-4'} border-blue-500 rounded-lg p-3 mb-4`}>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">{t('receipts.edit.type')}:</span>
                  <span className={`font-bold ${direction === 'rtl' ? 'mr-2' : 'ml-2'}`}>{getTypeLabel(editingReceipt.type)}</span>
                </div>
                <div>
                  <span className="text-gray-600">{t('receipts.edit.date')}:</span>
                  <span className={`font-bold ${direction === 'rtl' ? 'mr-2' : 'ml-2'}`}>
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
                  <label className="block text-sm font-bold mb-1.5">
                    {t('receipts.edit.receiptNumberRequired')}
                  </label>
                  <input
                    type="number"
                    value={editFormData.receiptNumber}
                    onChange={(e) => setEditFormData({ ...editFormData, receiptNumber: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="1000"
                  />
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ {t('receipts.edit.receiptNumberWarning')}
                  </p>
                </div>

                {/* المبلغ */}
                <div>
                  <label className="block text-sm font-bold mb-1.5">
                    {t('receipts.edit.amountRequired')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.amount}
                    onChange={(e) => setEditFormData({ ...editFormData, amount: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* الصف الثاني: طريقة الدفع واسم الموظف */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* طريقة الدفع */}
                <div>
                  <label className="block text-sm font-bold mb-1.5">
                    {t('receipts.edit.paymentMethodRequired')}
                  </label>
                  <select
                    value={editFormData.paymentMethod}
                    onChange={(e) => setEditFormData({ ...editFormData, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="cash">💵 {t('receipts.paymentMethods.cash')}</option>
                    <option value="visa">💳 {t('receipts.paymentMethods.visa')}</option>
                    <option value="wallet">👛 {t('receipts.paymentMethods.wallet')}</option>
                    <option value="instapay">💸 {t('receipts.paymentMethods.instapay')}</option>
                  </select>
                </div>

                {/* اسم الموظف */}
                <div>
                  <label className="block text-sm font-bold mb-1.5">
                    {t('receipts.edit.staffNameOptional')}
                  </label>
                  <input
                    type="text"
                    value={editFormData.staffName}
                    onChange={(e) => setEditFormData({ ...editFormData, staffName: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={t('receipts.edit.staffPlaceholder')}
                  />
                </div>
              </div>

              {/* تاريخ الإيصال */}
              <div>
                <label className="block text-sm font-bold mb-1.5">
                  {t('receipts.edit.receiptDateRequired')}
                </label>
                <input
                  type="datetime-local"
                  value={editFormData.createdAt}
                  onChange={(e) => setEditFormData({ ...editFormData, createdAt: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  ℹ️ {t('receipts.edit.dateNote')}
                </p>
              </div>

              {/* ملاحظة تحذيرية */}
              <div className={`bg-yellow-50 ${direction === 'rtl' ? 'border-r-4' : 'border-l-4'} border-yellow-500 rounded-lg p-3`}>
                <div className="flex items-start gap-2">
                  <div className="text-xl">⚠️</div>
                  <div>
                    <p className="font-bold text-yellow-800 text-sm mb-0.5">{t('receipts.edit.warning')}</p>
                    <p className="text-xs text-yellow-700">
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
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition font-bold shadow-lg hover:shadow-xl"
              >
                ✅ {t('receipts.edit.save')}
              </button>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingReceipt(null)
                }}
                className="px-6 bg-gray-200 text-gray-700 py-2.5 rounded-lg hover:bg-gray-300 transition font-bold"
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
'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useDebounce } from '../../hooks/useDebounce'
import { ReceiptToPrint } from '../../components/ReceiptToPrint'
import PaymentMethodSelector from '../../components/Paymentmethodselector'
import { usePermissions } from '../../hooks/usePermissions'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast } from '../../contexts/ToastContext'
import { useServiceSettings } from '../../contexts/ServiceSettingsContext'
import type { PaymentMethod } from '../../lib/paymentHelpers'
import { fetchDayUseRecords } from '../../lib/api/dayuse'
import AssignSalesButton from '../../components/AssignSalesButton'
import { LoadingScreen } from '../../components/Spinner'

interface DayUseEntry {
  id: string
  name: string
  phone: string
  serviceType: string
  price: number
  staffName: string
  createdAt: string
  salesStaffId?: string | null
  salesStaff?: { id: string; name: string } | null
  receipts?: {
    receiptNumber: number
    amount: number
  }[]
}

export default function DayUsePage() {
  const { t, direction } = useLanguage()
  const { user } = usePermissions()
  const toast = useToast()
  const { settings } = useServiceSettings()
  const queryClient = useQueryClient()

  const {
    data: entries = [],
    isLoading: loading,
    refetch: refetchEntries
  } = useQuery({
    queryKey: ['dayuse'],
    queryFn: fetchDayUseRecords,
    retry: 1,
    staleTime: 2 * 60 * 1000,
  })

  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  //  بحث + فلتر على Day Use
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)
  const [filterType, setFilterType] = useState<'all' | 'DayUse' | 'InBody' | 'LockerRental'>('all')
  const [filterDate, setFilterDate] = useState<'all' | 'today' | 'week' | 'month'>('all')

  //  الـ entries بعد تطبيق البحث + الفلتر
  const filteredEntries = useMemo(() => {
    let list = entries as DayUseEntry[]
    if (filterType !== 'all') {
      list = list.filter(e => e.serviceType === filterType)
    }
    if (filterDate !== 'all') {
      const now = new Date(); now.setHours(0, 0, 0, 0)
      const cutoff = new Date(now)
      if (filterDate === 'week') cutoff.setDate(now.getDate() - 6)
      else if (filterDate === 'month') cutoff.setDate(now.getDate() - 29)
      list = list.filter(e => {
        if (!e.createdAt) return false
        const d = new Date(e.createdAt); d.setHours(0, 0, 0, 0)
        return d >= cutoff
      })
    }
    const q = debouncedSearch.trim()
    if (q) {
      const isDigits = /^\d+$/.test(q)
      const ql = q.toLowerCase()
      list = list.filter(e => {
        if (isDigits) return (e.phone || '').includes(q)
        return (e.name || '').toLowerCase().includes(ql)
      })
    }
    return list
  }, [entries, debouncedSearch, filterType, filterDate])
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    serviceType: 'DayUse',
    price: 0,
    staffName: user?.name || '',
    salesStaffId: '',
    paymentMethod: 'cash' as string | PaymentMethod[],
  })
  const [salesStaffList, setSalesStaffList] = useState<{ id: string; name: string; leadsCount: number }[]>([])
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState<any>(null)
  const [showDeletePopup, setShowDeletePopup] = useState(false)
  const [entryToDelete, setEntryToDelete] = useState<DayUseEntry | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [isRenewing, setIsRenewing] = useState(false)
  const [renewingEntryId, setRenewingEntryId] = useState<string | null>(null)
  const [memberPoints, setMemberPoints] = useState(0)

  useEffect(() => {
    if (user && !formData.staffName) {
      setFormData(prev => ({ ...prev, staffName: user.name }))
    }
  }, [user])

  useEffect(() => {
    fetch('/api/followups/sales')
      .then(r => r.json())
      .then((data: any) => {
        const list = (data?.staff ?? []).map((s: any) => ({
          id: s.staffId,
          name: s.name,
          leadsCount: s.leadsCount ?? 0,
        })).sort((a: any, b: any) => a.leadsCount - b.leadsCount)
        setSalesStaffList(list)
        // اقترح الأقل تلقائياً
        if (list.length > 0) {
          setFormData(prev => ({ ...prev, salesStaffId: list[0].id }))
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const fetchMemberPoints = async () => {
      if (!formData.phone) {
        setMemberPoints(0)
        return
      }

      try {
        const response = await fetch(`/api/members?phone=${encodeURIComponent(formData.phone)}`)
        if (response.ok) {
          const members = await response.json()
          if (members.length > 0) {
            setMemberPoints(members[0].points || 0)
          } else {
            setMemberPoints(0)
          }
        }
      } catch (error) {
        console.error('Error fetching member points:', error)
        setMemberPoints(0)
      }
    }

    fetchMemberPoints()
  }, [formData.phone])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      // If renewing, use renew endpoint, otherwise use create endpoint
      const endpoint = isRenewing && renewingEntryId ? '/api/dayuse/renew' : '/api/dayuse'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          staffName: user?.name || '',
          ...(isRenewing && renewingEntryId ? { entryId: renewingEntryId } : {})
        }),
      })

      if (response.ok) {
        const data = await response.json()

        try {
          // If renewing, receipt is returned directly
          if (isRenewing && data.receipt) {
            setReceiptData({
              receiptNumber: data.receipt.receiptNumber,
              type: data.receipt.type,
              amount: data.receipt.amount,
              details: JSON.parse(data.receipt.itemDetails),
              date: new Date(data.receipt.createdAt),
              paymentMethod: formData.paymentMethod
            })
            setShowReceipt(true)
            queryClient.invalidateQueries({ queryKey: ['receipts'] })
          } else {
            // For new entries, fetch receipt from API
            const receiptsResponse = await fetch(`/api/receipts?dayUseId=${data.id}`)
            const receipts = await receiptsResponse.json()

            if (receipts.length > 0) {
              const receipt = receipts[0]
              setReceiptData({
                receiptNumber: receipt.receiptNumber,
                type: receipt.type,
                amount: receipt.amount,
                details: JSON.parse(receipt.itemDetails),
                date: new Date(receipt.createdAt),
                paymentMethod: formData.paymentMethod
              })
              setShowReceipt(true)
              queryClient.invalidateQueries({ queryKey: ['receipts'] })
            }
          }
        } catch (err) {
          console.error('Error fetching receipt:', err)
        }

        setFormData({
          name: '',
          phone: '',
          serviceType: 'DayUse',
          price: 0,
          staffName: user?.name || '',
          salesStaffId: '',
          paymentMethod: 'cash',
        })

        toast.success(t('dayUse.messages.success'))
        refetchEntries()
        setShowForm(false)
        setIsRenewing(false)
        setRenewingEntryId(null)
      } else {
        toast.error(t('dayUse.messages.failed'))
      }
    } catch (error) {
      console.error(error)
      toast.error(t('dayUse.messages.error'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleRenewClick = (entry: DayUseEntry) => {
    setFormData({
      name: entry.name,
      phone: entry.phone,
      serviceType: entry.serviceType,
      price: entry.price,
      staffName: user?.name || '',
      salesStaffId: '',
      paymentMethod: 'cash',
    })
    setIsRenewing(true)
    setRenewingEntryId(entry.id)
    setShowForm(true)
    // Scroll to top to show the form
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeleteClick = (entry: DayUseEntry) => {
    setEntryToDelete(entry)
    setShowDeletePopup(true)
  }

  const handleDeleteConfirm = async () => {
    if (!entryToDelete) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/dayuse?id=${entryToDelete.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success(t('dayUse.messages.deleteSuccess'))
        refetchEntries()
        setShowDeletePopup(false)
        setEntryToDelete(null)
      } else {
        toast.error(t('dayUse.messages.deleteFailed'))
      }
    } catch (error) {
      console.error(error)
      toast.error(t('dayUse.messages.deleteError'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 md:px-6" dir={direction}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold dark:text-white">{t('dayUse.title')}</h1>
        <button
          onClick={() => {
            setShowForm(!showForm)
            if (!showForm) {
              // Reset form when opening
              setFormData({
                name: '',
                phone: '',
                serviceType: 'DayUse',
                price: 0,
                staffName: user?.name || '',
                salesStaffId: '',
                paymentMethod: 'cash',
              })
              setIsRenewing(false)
              setRenewingEntryId(null)
            }
          }}
          className="w-full sm:w-auto bg-primary-600 text-primary-contrast px-6 py-2 rounded-lg hover:bg-primary-700"
        >
          {showForm ? t('dayUse.hideForm') : t('dayUse.addNewOperation')}
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {isRenewing ? ` ${t('dayUse.renewService')}` : t('dayUse.addOperationTitle')}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('dayUse.name')}</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder={t('dayUse.namePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('dayUse.phone')}</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/s/g, '') })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder={t('dayUse.phonePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('dayUse.serviceType')}</label>
                <select
                  value={formData.serviceType}
                  onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                >
                  <option value="DayUse">{t('dayUse.dayUse')}</option>
                  {settings.inBodyEnabled && <option value="InBody">{t('dayUse.inBody')}</option>}
                  <option value="LockerRental">{t('dayUse.lockerRental')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('dayUse.price')}</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder={t('dayUse.pricePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">{t('dayUse.staffName')}</label>
                <input
                  type="text"
                  required
                  value={formData.staffName}
                  readOnly
                  className="w-full px-3 py-2 border rounded-lg bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
                  placeholder={t('dayUse.staffNamePlaceholder')}
                />
              </div>

              {salesStaffList.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1"> موظف السيلز</label>
                  <select
                    value={formData.salesStaffId}
                    onChange={(e) => setFormData({ ...formData, salesStaffId: e.target.value })}
                    className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">— بدون سيلز —</option>
                    {salesStaffList.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.leadsCount} ليد)</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* قسم طريقة الدفع */}
            <div className="bg-gradient-to-br from-green-50 to-primary-50 dark:from-green-900/30 dark:to-primary-900/30 ring-1 ring-green-200 dark:ring-green-700 rounded-xl p-5 dark:border-gray-600 dark:bg-gray-700 dark:text-primary-contrast">
              <PaymentMethodSelector
                value={formData.paymentMethod}
                onChange={(method) => setFormData({ ...formData, paymentMethod: method })}
                allowMultiple={true}
                totalAmount={formData.price}
                required
                memberPoints={memberPoints}
                pointsValueInEGP={settings.pointsValueInEGP}
                pointsEnabled={settings.pointsEnabled}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary-600 text-primary-contrast py-2 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? t('dayUse.saving') : t('dayUse.add')}
            </button>
          </form>
        </div>
      )}

      {/*  Search + Filters Toolbar */}
      {!loading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-3 mb-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <span className={`absolute inset-y-0 ${direction === 'rtl' ? 'right-3' : 'left-3'} flex items-center text-gray-400 pointer-events-none`}>
                <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full ${direction === 'rtl' ? 'pr-10 pl-10' : 'pl-10 pr-10'} py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm`}
                placeholder={direction === 'rtl' ? 'ابحث بالاسم أو التليفون...' : 'Search by name or phone...'}
                dir={direction}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className={`absolute inset-y-0 ${direction === 'rtl' ? 'left-3' : 'right-3'} flex items-center text-gray-400 hover:text-red-500 transition-colors`}
                  aria-label="clear"
                >
                  <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
            {/* Date filter dropdown */}
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value as any)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">{direction === 'rtl' ? '— كل الفترات —' : '— All time —'}</option>
              <option value="today">{direction === 'rtl' ? 'اليوم' : 'Today'}</option>
              <option value="week">{direction === 'rtl' ? 'آخر 7 أيام' : 'Last 7 days'}</option>
              <option value="month">{direction === 'rtl' ? 'آخر 30 يوم' : 'Last 30 days'}</option>
            </select>
          </div>
          {/* Service type filter chips */}
          <div className="flex flex-wrap gap-2">
            {([
              { id: 'all', label: direction === 'rtl' ? 'الكل' : 'All', color: 'gray' },
              { id: 'DayUse', label: t('dayUse.dayUse'), color: 'primary' },
              ...(settings.inBodyEnabled ? [{ id: 'InBody', label: t('dayUse.inBody'), color: 'purple' }] : []),
              { id: 'LockerRental', label: t('dayUse.lockerRental'), color: 'amber' },
            ] as const).map(chip => {
              const isActive = filterType === chip.id
              const activeBg =
                chip.color === 'primary' ? 'bg-primary-600 text-primary-contrast ring-primary-600' :
                chip.color === 'purple' ? 'bg-purple-600 text-white ring-purple-600' :
                chip.color === 'amber' ? 'bg-amber-600 text-white ring-amber-600' :
                'bg-gray-700 text-white ring-gray-700'
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setFilterType(chip.id as any)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold ring-1 transition-colors ${
                    isActive ? activeBg : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 ring-gray-200 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>
          {/*  عدّاد النتائج */}
          {(search || filterType !== 'all' || filterDate !== 'all') && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {direction === 'rtl'
                ? `${filteredEntries.length} نتيجة من إجمالي ${(entries as DayUseEntry[]).length}`
                : `${filteredEntries.length} results of ${(entries as DayUseEntry[]).length}`}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <LoadingScreen message={t('dayUse.loading')} />
      ) : (
        <>
          {/* Mobile Cards View */}
          <div className="lg:hidden space-y-4">
            {filteredEntries.map((entry) => (
              <div
                key={entry.id}
                className="bg-white dark:bg-gray-800 border-r-4 border-primary-500 rounded-lg shadow-md p-4"
              >
                {/* Action Buttons at Top */}
                <div className="flex flex-col sm:flex-row justify-end gap-2 mb-3">
                  <AssignSalesButton
                    entityType="dayuse"
                    entityId={entry.id}
                    currentSalesStaff={entry.salesStaff || null}
                    size="sm"
                    onAssigned={() => queryClient.invalidateQueries({ queryKey: ['dayuse'] })}
                  />
                  <button
                    onClick={() => handleRenewClick(entry)}
                    className="bg-primary-500 text-primary-contrast px-4 py-2 rounded-lg hover:bg-primary-600 transition text-sm font-medium shadow-sm"
                  >
                     {t('dayUse.renew')}
                  </button>
                  <button
                    onClick={() => handleDeleteClick(entry)}
                    className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition text-sm font-medium shadow-sm"
                  >
                     {t('dayUse.delete')}
                  </button>
                </div>

                {/* Entry Info */}
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 dark:text-gray-400 text-sm min-w-[80px]"> {t('dayUse.nameLabel')}</span>
                    <span className="font-bold text-gray-900 dark:text-white">{entry.name}</span>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 dark:text-gray-400 text-sm min-w-[80px]"> {t('dayUse.phoneLabel')}</span>
                    <a
                      href={`https://wa.me/20${entry.phone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 font-medium hover:text-green-700"
                    >
                      {entry.phone}
                    </a>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 dark:text-gray-400 text-sm min-w-[80px]"> {t('dayUse.serviceLabel')}</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      entry.serviceType === 'DayUse'
                        ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-200'
                        : entry.serviceType === 'InBody'
                        ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200'
                        : 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200'
                    }`}>
                      {entry.serviceType === 'DayUse' ? t('dayUse.dayUse') :
                       entry.serviceType === 'InBody' ? t('dayUse.inBody') : t('dayUse.lockerRental')}
                    </span>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 dark:text-gray-400 text-sm min-w-[80px]"> {t('dayUse.priceLabel')}</span>
                    <span className="font-bold text-green-600">{entry.price} {t('dayUse.egp')}</span>
                  </div>

                  {entry.receipts && entry.receipts.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 dark:text-gray-400 text-sm min-w-[80px]"> {t('dayUse.receiptNumber')}</span>
                      <span className="text-primary-600 dark:text-primary-400 font-semibold">#{entry.receipts[0].receiptNumber}</span>
                    </div>
                  )}

                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 dark:text-gray-400 text-sm min-w-[80px]">‍ {t('dayUse.staffLabel')}</span>
                    <span className="text-gray-700 dark:text-gray-200">{entry.staffName}</span>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 dark:text-gray-400 text-sm min-w-[80px]"> {t('dayUse.dateLabel')}</span>
                    <span className="text-gray-700 dark:text-gray-200">
                      {new Date(entry.createdAt).toLocaleDateString('ar-EG')}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {filteredEntries.length === 0 && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p>{
                  (entries as DayUseEntry[]).length === 0
                    ? t('dayUse.noOperationsYet')
                    : (direction === 'rtl' ? 'لا توجد نتائج مطابقة' : 'No matching results')
                }</p>
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-700 dark:bg-gray-700 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-right dark:text-gray-200">{t('dayUse.name')}</th>
                  <th className="px-4 py-3 text-right dark:text-gray-200">{t('dayUse.phone')}</th>
                  <th className="px-4 py-3 text-right dark:text-gray-200">{t('dayUse.serviceType')}</th>
                  <th className="px-4 py-3 text-right dark:text-gray-200">{t('dayUse.receiptNumber')}</th>
                  <th className="px-4 py-3 text-right dark:text-gray-200">{t('dayUse.price')}</th>
                  <th className="px-4 py-3 text-right dark:text-gray-200">{t('dayUse.staffName')}</th>
                  <th className="px-4 py-3 text-right dark:text-gray-200">{t('dayUse.dateLabel')}</th>
                  <th className="px-4 py-3 text-center dark:text-gray-200">{t('dayUse.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="border-t hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3">{entry.name}</td>
                    <td className="px-4 py-3">{entry.phone}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-sm ${
                        entry.serviceType === 'DayUse'
                          ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-200'
                          : entry.serviceType === 'InBody'
                          ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200'
                          : 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200'
                      }`}>
                        {entry.serviceType === 'DayUse' ? t('dayUse.dayUse') :
                         entry.serviceType === 'InBody' ? t('dayUse.inBody') : t('dayUse.lockerRental')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {entry.receipts && entry.receipts.length > 0 ? (
                        <span className="text-primary-600 dark:text-primary-400 font-semibold">
                          #{entry.receipts[0].receiptNumber}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{entry.price} {t('dayUse.egp')}</td>
                    <td className="px-4 py-3">{entry.staffName}</td>
                    <td className="px-4 py-3">
                      {new Date(entry.createdAt).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-2 justify-center items-center flex-wrap">
                        <AssignSalesButton
                          entityType="dayuse"
                          entityId={entry.id}
                          currentSalesStaff={entry.salesStaff || null}
                          size="xs"
                          onAssigned={() => queryClient.invalidateQueries({ queryKey: ['dayuse'] })}
                        />
                        <button
                          onClick={() => handleRenewClick(entry)}
                          className="bg-primary-500 text-primary-contrast px-3 py-1 rounded hover:bg-primary-600 transition text-sm"
                        >
                           {t('dayUse.renew')}
                        </button>
                        <button
                          onClick={() => handleDeleteClick(entry)}
                          className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition text-sm"
                        >
                           {t('dayUse.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredEntries.length === 0 && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                {(entries as DayUseEntry[]).length === 0
                  ? t('dayUse.noOperationsYet')
                  : (direction === 'rtl' ? 'لا توجد نتائج مطابقة' : 'No matching results')}
              </div>
            )}
          </div>
        </>
      )}

      {receiptData && (
        <div className="mt-6">
          <button
            onClick={() => setShowReceipt(true)}
            className="w-full sm:w-auto bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
          >
             {t('dayUse.printLastReceipt')}
          </button>
        </div>
      )}

      {showReceipt && receiptData && (
        <ReceiptToPrint
          receiptNumber={receiptData.receiptNumber}
          type={receiptData.type}
          amount={receiptData.amount}
          details={receiptData.details}
          date={receiptData.date}
          paymentMethod={receiptData.paymentMethod}
          onClose={() => setShowReceipt(false)}
        />
      )}

      {/* Delete Confirmation Popup */}
      {showDeletePopup && entryToDelete && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => !deleting && setShowDeletePopup(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              {/* Warning Icon */}
              <div className="mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/40 rounded-full mb-3">
                  
                </div>
                <h3 className="text-2xl font-bold text-red-700 dark:text-red-400 mb-2">
                  {t('dayUse.deleteModal.title')}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  {t('dayUse.deleteModal.message')}
                </p>
              </div>

              {/* Entry Details */}
              <div className="bg-gray-50 dark:bg-gray-700 ring-1 ring-gray-200 dark:ring-gray-600 rounded-xl p-4 mb-6 text-right">
                <div className="space-y-2">
                  <p><span className="font-semibold">{t('dayUse.deleteModal.nameLabel')}</span> {entryToDelete.name}</p>
                  <p><span className="font-semibold">{t('dayUse.deleteModal.phoneLabel')}</span> {entryToDelete.phone}</p>
                  <p>
                    <span className="font-semibold">{t('dayUse.deleteModal.serviceTypeLabel')}</span>
                    {entryToDelete.serviceType === 'DayUse' ? t('dayUse.dayUse') :
                     entryToDelete.serviceType === 'InBody' ? t('dayUse.inBody') : t('dayUse.lockerRental')}
                  </p>
                  <p><span className="font-semibold">{t('dayUse.deleteModal.priceLabel')}</span> {entryToDelete.price} {t('dayUse.egp')}</p>
                  <p><span className="font-semibold">{t('dayUse.deleteModal.dateLabel')}</span> {new Date(entryToDelete.createdAt).toLocaleDateString('ar-EG')}</p>
                </div>
              </div>

              {/* Warning Message */}
              <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 mb-4">
                <p className="text-xs text-yellow-800 dark:text-yellow-300">
                  {t('dayUse.deleteModal.warning')}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="flex-1 bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition"
                >
                  {deleting ? ` ${t('dayUse.deleteModal.deleting')}` : ` ${t('dayUse.deleteModal.confirmDelete')}`}
                </button>
                <button
                  onClick={() => setShowDeletePopup(false)}
                  disabled={deleting}
                  className="flex-1 bg-gray-200 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 dark:bg-gray-700 disabled:cursor-not-allowed font-medium transition"
                >
                   {t('dayUse.deleteModal.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
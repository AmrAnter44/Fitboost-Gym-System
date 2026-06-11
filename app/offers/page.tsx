'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useConfirm } from '../../hooks/useConfirm'
import { useLanguage } from '@/contexts/LanguageContext'
import { useToast } from '@/contexts/ToastContext'
import { useServiceSettings } from '@/contexts/ServiceSettingsContext'
import { useRouter } from 'next/navigation'
import { fetchOffers } from '@/lib/api/offers'
import { LoadingScreen } from '@/components/Spinner'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface Offer {
  id: string
  name: string
  duration: number
  price: number
  minPrice?: number | null
  freePTSessions: number
  inBodyScans: number
  invitations: number
  freezeDays: number
  ptCommission?: number
  icon: string
  isActive: boolean
  upgradeEligibilityDays?: number | null
  upgradePoints?: number
  createdAt: string
  updatedAt: string
}

const ICON_PATHS: Record<string, JSX.Element> = {
  calendar: (<path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />),
  star: (<path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />),
  gift: (<path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />),
  sparkles: (<path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />),
  fire: (<path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />),
  trophy: (<path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />),
  bolt: (<path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />),
}

const ICON_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'calendar', label: 'Calendar' },
  { key: 'star', label: 'Star' },
  { key: 'gift', label: 'Gift' },
  { key: 'sparkles', label: 'Sparkles' },
  { key: 'fire', label: 'Fire' },
  { key: 'trophy', label: 'Trophy' },
  { key: 'bolt', label: 'Bolt' },
]

const renderOfferIcon = (icon: string, className = 'w-6 h-6') => {
  const path = ICON_PATHS[icon] || ICON_PATHS.gift
  return (
    <svg {...stroke} className={className} aria-hidden="true">{path}</svg>
  )
}

export default function OffersPage() {
  const { t, direction } = useLanguage()
  const toast = useToast()
  const router = useRouter()
  const { settings } = useServiceSettings()

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { confirm, isOpen, options, handleConfirm, handleCancel } = useConfirm()

  const {
    data: offers = [],
    isLoading: loading,
    error: offersError,
    refetch: refetchOffers
  } = useQuery({
    queryKey: ['offers'],
    queryFn: fetchOffers,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (offersError) {
      const errorMessage = (offersError as Error).message
      if (errorMessage === 'UNAUTHORIZED') {
        toast.error(t('offers.messages.unauthorized'))
        setTimeout(() => router.push('/login'), 2000)
      } else if (errorMessage === 'FORBIDDEN') {
        toast.error(t('offers.messages.forbidden'))
      } else {
        toast.error(errorMessage || t('offers.messages.fetchErrorGeneral'))
      }
    }
  }, [offersError, toast, router, t])

  const [formData, setFormData] = useState({
    name: '',
    duration: '',
    price: '',
    minPrice: '',
    freePTSessions: '',
    freeNutritionSessions: '',
    freePhysioSessions: '',
    freeGroupClassSessions: '',
    freeMoreSessions: '',
    freePoolSessions: '',
    freePadelSessions: '',
    freeAssessmentSessions: '',
    nutritionPrice: '',
    physioPrice: '',
    groupClassPrice: '',
    morePrice: '',
    inBodyScans: '',
    invitations: '',
    freezeDays: '',
    ptCommission: '0',
    icon: 'calendar',
    upgradeEligibilityDays: '7',
    upgradePoints: '0',
    allowedCheckInStart: '',
    allowedCheckInEnd: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      const url = '/api/offers'
      const method = editingOffer ? 'PUT' : 'POST'
      const body = editingOffer
        ? { ...formData, id: editingOffer.id }
        : formData

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || t('offers.messages.saveError'))
      }

      setSuccess(editingOffer ? t('offers.messages.updateSuccess') : t('offers.messages.addSuccess'))
      resetForm()
      refetchOffers()
    } catch (error: any) {
      setError(error.message || t('offers.messages.saveErrorGeneral'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (offer: Offer) => {
    setEditingOffer(offer)
    setFormData({
      name: offer.name,
      duration: offer.duration.toString(),
      price: offer.price.toString(),
      minPrice: offer.minPrice != null ? offer.minPrice.toString() : '',
      freePTSessions: offer.freePTSessions.toString(),
      freeNutritionSessions: (offer as any).freeNutritionSessions?.toString() || '0',
      freePhysioSessions: (offer as any).freePhysioSessions?.toString() || '0',
      freeGroupClassSessions: (offer as any).freeGroupClassSessions?.toString() || '0',
      freeMoreSessions: (offer as any).freeMoreSessions?.toString() || '0',
      freePoolSessions: (offer as any).freePoolSessions?.toString() || '0',
      freePadelSessions: (offer as any).freePadelSessions?.toString() || '0',
      freeAssessmentSessions: (offer as any).freeAssessmentSessions?.toString() || '0',
      nutritionPrice: (offer as any).nutritionPrice?.toString() || '0',
      physioPrice: (offer as any).physioPrice?.toString() || '0',
      groupClassPrice: (offer as any).groupClassPrice?.toString() || '0',
      morePrice: (offer as any).morePrice?.toString() || '0',
      inBodyScans: offer.inBodyScans.toString(),
      invitations: offer.invitations.toString(),
      freezeDays: offer.freezeDays.toString(),
      ptCommission: offer.ptCommission?.toString() || '0',
      icon: ICON_PATHS[offer.icon] ? offer.icon : 'calendar',
      upgradeEligibilityDays: offer.upgradeEligibilityDays?.toString() || '7',
      upgradePoints: offer.upgradePoints?.toString() || '0',
      allowedCheckInStart: (offer as any).allowedCheckInStart || '',
      allowedCheckInEnd: (offer as any).allowedCheckInEnd || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (offer: Offer) => {
    const confirmed = await confirm({
      title: t('offers.deleteConfirmTitle'),
      message: t('offers.deleteConfirmMessage', { name: offer.name }),
      confirmText: t('offers.confirmDelete'),
      cancelText: t('offers.cancelDelete'),
      type: 'danger'
    })

    if (!confirmed) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/offers?id=${offer.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || t('offers.messages.deleteError'))
      }

      setSuccess(t('offers.messages.deleteSuccess'))
      refetchOffers()
    } catch (error: any) {
      setError(error.message || t('offers.messages.deleteErrorGeneral'))
    } finally {
      setSubmitting(false)
    }
  }

  const toggleActive = async (offer: Offer) => {
    setSubmitting(true)
    try {
      const response = await fetch('/api/offers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...offer,
          isActive: !offer.isActive
        })
      })

      if (!response.ok) {
        throw new Error(t('offers.messages.toggleError'))
      }

      setSuccess(t('offers.messages.toggleSuccess'))
      refetchOffers()
    } catch (error: any) {
      setError(error.message || t('offers.messages.toggleErrorGeneral'))
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      duration: '',
      price: '',
      minPrice: '',
      freePTSessions: '',
      freeNutritionSessions: '',
      freePhysioSessions: '',
      freeGroupClassSessions: '',
      freeMoreSessions: '',
      freePoolSessions: '',
      freePadelSessions: '',
      freeAssessmentSessions: '',
      nutritionPrice: '',
      physioPrice: '',
      groupClassPrice: '',
      morePrice: '',
      inBodyScans: '',
      invitations: '',
      freezeDays: '',
      ptCommission: '0',
      icon: 'calendar',
      upgradeEligibilityDays: '7',
      upgradePoints: '0',
      allowedCheckInStart: '',
      allowedCheckInEnd: ''
    })
    setEditingOffer(null)
    setShowForm(false)
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
  const labelCls = "block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5"

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" dir={direction}>
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
              <svg {...stroke} className="w-6 h-6" aria-hidden="true">{ICON_PATHS.gift}</svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{t('offers.title')}</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('offers.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 text-sm"
          >
            <svg {...stroke} className="w-4 h-4" aria-hidden="true">
              {showForm ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              )}
            </svg>
            <span>{showForm ? t('offers.cancel') : t('offers.addNewOffer')}</span>
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/50 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg flex items-center gap-2">
            <svg {...stroke} className="w-5 h-5 flex-shrink-0" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-900/50 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg flex items-center gap-2">
            <svg {...stroke} className="w-5 h-5 flex-shrink-0" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            <span>{success}</span>
          </div>
        )}

        {/* Add/Edit Form */}
        {showForm && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <svg {...stroke} className="w-5 h-5 text-primary-600 dark:text-primary-400" aria-hidden="true">
                {editingOffer ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487 18.549 2.799a2.122 2.122 0 1 1 3 3L19.862 7.487m-3-3L8.078 13.27a2 2 0 0 0-.5.831l-1.111 4.222 4.222-1.111a2 2 0 0 0 .832-.5l8.781-8.781m-3-3 3 3" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                )}
              </svg>
              <span>{editingOffer ? t('offers.editOffer') : t('offers.newOffer')}</span>
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('offers.offerName')} *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputCls} placeholder={t('offers.offerNamePlaceholder')} required />
              </div>

              <div>
                <label className={labelCls}>{t('offers.duration')} *</label>
                <input type="number" value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: e.target.value })} className={inputCls} placeholder={t('offers.durationPlaceholder')} required />
              </div>

              <div>
                <label className={labelCls}>{t('offers.price')} *</label>
                <input type="number" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} className={inputCls} placeholder={t('offers.pricePlaceholder')} required />
              </div>

              <div>
                <label className={labelCls}>{direction === 'rtl' ? 'الحد الأدنى للسعر بعد الخصم' : 'Minimum Price After Discount'}</label>
                <input type="number" step="0.01" min="0" value={formData.minPrice} onChange={(e) => setFormData({ ...formData, minPrice: e.target.value })} className={inputCls} placeholder={direction === 'rtl' ? 'سيب فاضي = مفيش حد أدنى' : 'Leave empty = no minimum'} />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {direction === 'rtl' ? 'الريسبشن مش هيقدر يخفّض السعر تحت ده' : 'Reception cannot discount below this price'}
                </p>
              </div>

              <div>
                <label className={labelCls}>{t('offers.freePTSessions')}</label>
                <input type="number" value={formData.freePTSessions} onChange={(e) => setFormData({ ...formData, freePTSessions: e.target.value })} className={inputCls} placeholder="0" />
              </div>

              {settings.nutritionEnabled && (
                <div>
                  <label className={labelCls}>{t('offers.freeNutritionSessions')}</label>
                  <input type="number" value={formData.freeNutritionSessions} onChange={(e) => setFormData({ ...formData, freeNutritionSessions: e.target.value })} className={inputCls} placeholder="0" />
                </div>
              )}

              {settings.physiotherapyEnabled && (
                <div>
                  <label className={labelCls}>{t('offers.freePhysioSessions')}</label>
                  <input type="number" value={formData.freePhysioSessions} onChange={(e) => setFormData({ ...formData, freePhysioSessions: e.target.value })} className={inputCls} placeholder="0" />
                </div>
              )}

              {settings.groupClassEnabled && (
                <div>
                  <label className={labelCls}>{t('offers.freeGroupClassSessions')}</label>
                  <input type="number" value={formData.freeGroupClassSessions} onChange={(e) => setFormData({ ...formData, freeGroupClassSessions: e.target.value })} className={inputCls} placeholder="0" />
                </div>
              )}

              {settings.inBodyEnabled && (
                <div>
                  <label className={labelCls}>{t('offers.inBodyScans')}</label>
                  <input type="number" value={formData.inBodyScans} onChange={(e) => setFormData({ ...formData, inBodyScans: e.target.value })} className={inputCls} placeholder="0" />
                </div>
              )}

              {settings.poolEnabled && (
                <div>
                  <label className={labelCls}>جلسات حمام السباحة</label>
                  <input type="number" value={formData.freePoolSessions} onChange={(e) => setFormData({ ...formData, freePoolSessions: e.target.value })} className={inputCls} placeholder="0" />
                </div>
              )}

              {settings.padelEnabled && (
                <div>
                  <label className={labelCls}>جلسات البادل</label>
                  <input type="number" value={formData.freePadelSessions} onChange={(e) => setFormData({ ...formData, freePadelSessions: e.target.value })} className={inputCls} placeholder="0" />
                </div>
              )}

              {settings.assessmentEnabled && (
                <div>
                  <label className={labelCls}>جلسات التقييم</label>
                  <input type="number" value={formData.freeAssessmentSessions} onChange={(e) => setFormData({ ...formData, freeAssessmentSessions: e.target.value })} className={inputCls} placeholder="0" />
                </div>
              )}

              <div>
                <label className={labelCls}>{t('offers.freeInvitations')}</label>
                <input type="number" value={formData.invitations} onChange={(e) => setFormData({ ...formData, invitations: e.target.value })} className={inputCls} placeholder="0" />
              </div>

              <div>
                <label className={labelCls}>أيام الفريز</label>
                <input type="number" value={formData.freezeDays} onChange={(e) => setFormData({ ...formData, freezeDays: e.target.value })} className={inputCls} placeholder="0" min="0" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">عدد أيام الفريز المسموح بها لهذا العرض</p>
              </div>

              <div>
                <label className={labelCls}>{t('offers.upgradeEligibilityDays')}</label>
                <input type="number" value={formData.upgradeEligibilityDays} onChange={(e) => setFormData({ ...formData, upgradeEligibilityDays: e.target.value })} className={inputCls} placeholder="7" min="0" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('offers.upgradeEligibilityDaysHelp')}</p>
              </div>

              <div>
                <label className={labelCls}>{t('offers.upgradePoints')}</label>
                <input type="number" value={formData.upgradePoints} onChange={(e) => setFormData({ ...formData, upgradePoints: e.target.value })} className={inputCls} placeholder="0" min="0" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('offers.upgradePointsHelp')}</p>
              </div>

              {settings.ptCommissionEnabled && (
                <div>
                  <label className={labelCls}>عمولة الكوتش (جنيه)</label>
                  <input type="number" value={formData.ptCommission} onChange={(e) => setFormData({ ...formData, ptCommission: e.target.value })} className={inputCls} placeholder="0" min="0" step="10" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    مبلغ العمولة للكوتش عند اشتراك عضو بهذا العرض
                    <br />
                    <span>(0 = استخدام المبلغ الافتراضي من الإعدادات: {settings.ptCommissionAmount || 50} ج.م)</span>
                  </p>
                </div>
              )}

              <div className="md:col-span-2 bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg p-4">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                  ساعات الدخول المسموح بها (اختياري)
                </label>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  لو حددت ساعات، كل عضو يشترك في العرض ده هيتحدد له نفس الساعات تلقائياً. سيب فاضي عشان يدخل أي وقت.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">من</label>
                    <input type="time" value={formData.allowedCheckInStart} onChange={(e) => setFormData({ ...formData, allowedCheckInStart: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-300 mb-1">إلى</label>
                    <input type="time" value={formData.allowedCheckInEnd} onChange={(e) => setFormData({ ...formData, allowedCheckInEnd: e.target.value })} className={inputCls} />
                  </div>
                </div>
                {(formData.allowedCheckInStart || formData.allowedCheckInEnd) && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, allowedCheckInStart: '', allowedCheckInEnd: '' })}
                    className="mt-2 text-xs text-red-600 hover:underline inline-flex items-center gap-1"
                  >
                    <svg {...stroke} className="w-3 h-3" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                    <span>إلغاء التحديد</span>
                  </button>
                )}
              </div>

              <div className="md:col-span-2">
                <label className={labelCls}>{t('offers.icon')}</label>
                <div className="flex flex-wrap gap-2">
                  {ICON_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon: opt.key })}
                      aria-label={opt.label}
                      aria-pressed={formData.icon === opt.key}
                      className={`p-3 rounded-lg ring-1 transition-colors duration-200 ${
                        formData.icon === opt.key
                          ? 'ring-primary-500 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                          : 'ring-gray-200 dark:ring-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {renderOfferIcon(opt.key, 'w-5 h-5')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2 flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                >
                  {submitting ? (
                    <svg {...stroke} className="w-4 h-4 animate-spin" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                  <span>{submitting ? t('offers.messages.saving') : editingOffer ? t('offers.saveChanges') : t('offers.addOffer')}</span>
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 text-sm"
                >
                  {t('offers.cancel')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Offers Grid */}
        {loading ? (
          <LoadingScreen message={t('offers.loading')} />
        ) : !Array.isArray(offers) || offers.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 flex flex-col items-center justify-center py-12 text-center">
            <svg {...stroke} className="w-12 h-12 text-gray-400" aria-hidden="true">{ICON_PATHS.gift}</svg>
            <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">{t('offers.noOffers')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('offers.addFirstOffer')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 p-5 transition-colors duration-200 ${
                  offer.isActive ? 'ring-gray-200 dark:ring-gray-700' : 'ring-gray-200 dark:ring-gray-700 opacity-60'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                      {renderOfferIcon(offer.icon, 'w-6 h-6')}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{offer.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{offer.duration} {t('offers.days')}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleActive(offer)}
                    aria-label={offer.isActive ? t('offers.active') : t('offers.inactive')}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold transition-colors duration-200 ${
                      offer.isActive
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    <svg {...stroke} className="w-3.5 h-3.5" aria-hidden="true">
                      {offer.isActive ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      )}
                    </svg>
                    {offer.isActive ? t('offers.active') : t('offers.inactive')}
                  </button>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{t('offers.price')}</span>
                    <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">{offer.price} {t('offers.priceEGP')}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{t('offers.ptSessions')}</span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">{offer.freePTSessions}</span>
                  </div>
                  {settings.ptCommissionEnabled && offer.ptCommission !== undefined && offer.ptCommission > 0 && (
                    <div className="flex justify-between items-center text-sm bg-primary-50 dark:bg-primary-900/30 px-3 py-2 rounded-lg">
                      <span className="text-primary-700 dark:text-primary-300 font-semibold">عمولة الكوتش</span>
                      <span className="font-bold text-primary-700 dark:text-primary-300">{offer.ptCommission} ج.م</span>
                    </div>
                  )}
                  {settings.nutritionEnabled && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{t('offers.nutritionSessions')}</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{(offer as any).freeNutritionSessions || 0}</span>
                    </div>
                  )}
                  {settings.physiotherapyEnabled && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{t('offers.physioSessions')}</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{(offer as any).freePhysioSessions || 0}</span>
                    </div>
                  )}
                  {settings.groupClassEnabled && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{t('offers.groupClassSessions')}</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{(offer as any).freeGroupClassSessions || 0}</span>
                    </div>
                  )}
                  {settings.inBodyEnabled && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{t('offers.inBody')}</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{offer.inBodyScans}</span>
                    </div>
                  )}
                  {settings.poolEnabled && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 dark:text-gray-400">جلسات حمام السباحة</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{(offer as any).freePoolSessions || 0}</span>
                    </div>
                  )}
                  {settings.padelEnabled && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 dark:text-gray-400">جلسات البادل</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{(offer as any).freePadelSessions || 0}</span>
                    </div>
                  )}
                  {settings.assessmentEnabled && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 dark:text-gray-400">جلسات التقييم</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{(offer as any).freeAssessmentSessions || 0}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{t('offers.invitations')}</span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">{offer.invitations}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-400">أيام الفريز</span>
                    <span className="font-bold text-primary-600 dark:text-primary-400">{offer.freezeDays}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                    <span className="text-gray-600 dark:text-gray-400">{t('offers.upgradeWindow')}</span>
                    <span className="font-bold text-primary-600 dark:text-primary-400">
                      {offer.upgradeEligibilityDays !== null && offer.upgradeEligibilityDays !== undefined
                        ? `${offer.upgradeEligibilityDays} ${t('offers.days')}`
                        : t('offers.noUpgrade')
                      }
                    </span>
                  </div>
                  {offer.upgradePoints && offer.upgradePoints > 0 && (
                    <div className="flex justify-between items-center text-sm border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                      <span className="text-gray-600 dark:text-gray-400">{t('offers.upgradePointsReward')}</span>
                      <span className="font-bold text-green-600 dark:text-green-400">
                        {offer.upgradePoints} {t('offers.pointsLabel')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(offer)}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold py-2 rounded-lg transition-colors duration-200 text-sm"
                  >
                    <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487 18.549 2.799a2.122 2.122 0 1 1 3 3L19.862 7.487m-3-3L8.078 13.27a2 2 0 0 0-.5.831l-1.111 4.222 4.222-1.111a2 2 0 0 0 .832-.5l8.781-8.781m-3-3 3 3" />
                    </svg>
                    <span>{t('offers.edit')}</span>
                  </button>
                  <button
                    onClick={() => handleDelete(offer)}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg transition-colors duration-200 text-sm"
                  >
                    <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165" />
                    </svg>
                    <span>{t('offers.delete')}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={isOpen}
        title={options.title}
        message={options.message}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        type={options.type}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  )
}

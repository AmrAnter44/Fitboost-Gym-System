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

interface Offer {
  id: string
  name: string
  duration: number
  price: number
  freePTSessions: number
  inBodyScans: number
  invitations: number
  freezeDays: number
  ptCommission?: number  // 💰 عمولة الكوتش
  icon: string
  isActive: boolean
  upgradeEligibilityDays?: number | null
  upgradePoints?: number
  createdAt: string
  updatedAt: string
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

  // Fetch offers using TanStack Query
  const {
    data: offers = [],
    isLoading: loading,
    error: offersError,
    refetch: refetchOffers
  } = useQuery({
    queryKey: ['offers'],
    queryFn: fetchOffers,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Error handling
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
    ptCommission: '0',  // 💰 عمولة الكوتش
    icon: '📅',
    upgradeEligibilityDays: '7',
    upgradePoints: '0',
    allowedCheckInStart: '',  // 🕐 ساعات الدخول المسموح بها
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

      setSuccess(editingOffer ? `✅ ${t('offers.messages.updateSuccess')}` : `✅ ${t('offers.messages.addSuccess')}`)
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
      ptCommission: offer.ptCommission?.toString() || '0',  // 💰 عمولة الكوتش
      icon: offer.icon,
      upgradeEligibilityDays: offer.upgradeEligibilityDays?.toString() || '7',
      upgradePoints: offer.upgradePoints?.toString() || '0',
      allowedCheckInStart: (offer as any).allowedCheckInStart || '',
      allowedCheckInEnd: (offer as any).allowedCheckInEnd || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (offer: Offer) => {
    const confirmed = await confirm({
      title: `⚠️ ${t('offers.deleteConfirmTitle')}`,
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

      setSuccess(`✅ ${t('offers.messages.deleteSuccess')}`)
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

      setSuccess(`✅ ${t('offers.messages.toggleSuccess')}`)
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
      ptCommission: '0',  // 💰 عمولة الكوتش
      icon: '📅',
      upgradeEligibilityDays: '7',
      upgradePoints: '0',
      allowedCheckInStart: '',
      allowedCheckInEnd: ''
    })
    setEditingOffer(null)
    setShowForm(false)
  }

  const iconOptions = ['📅', '⭐', '🎁', '💎', '🔥', '✨', '🏆', '💪']

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-50 dark:from-primary-900/20 dark:to-primary-900/20" dir={direction}>
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-2">🎁 {t('offers.title')}</h1>
              <p className="text-gray-600 dark:text-gray-300">{t('offers.subtitle')}</p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-gradient-to-r from-primary-600 to-primary-600 text-white px-6 py-3 rounded-xl font-bold hover:scale-105 dark:hover:scale-105 transition-transform"
            >
              {showForm ? `✖ ${t('offers.cancel')}` : `➕ ${t('offers.addNewOffer')}`}
            </button>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/30 border-2 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-6 py-4 rounded-xl">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-6 bg-green-50 dark:bg-green-900/30 border-2 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 px-6 py-4 rounded-xl">
              {success}
            </div>
          )}

          {/* Add/Edit Form */}
          {showForm && (
            <div className="mb-8 bg-gradient-to-r from-primary-50 to-primary-50 dark:from-primary-900/50 dark:to-primary-900/50 p-6 rounded-xl border-2 border-primary-200 dark:border-primary-700">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
                {editingOffer ? `✏️ ${t('offers.editOffer')}` : `➕ ${t('offers.newOffer')}`}
              </h2>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-gray-700 dark:text-gray-200 font-bold mb-2">{t('offers.offerName')} *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                    placeholder={t('offers.offerNamePlaceholder')}
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 dark:text-gray-200 font-bold mb-2">{t('offers.duration')} *</label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                    placeholder={t('offers.durationPlaceholder')}
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 dark:text-gray-200 font-bold mb-2">{t('offers.price')} *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                    placeholder={t('offers.pricePlaceholder')}
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-700 dark:text-gray-200 font-bold mb-2">{t('offers.freePTSessions')}</label>
                  <input
                    type="number"
                    value={formData.freePTSessions}
                    onChange={(e) => setFormData({ ...formData, freePTSessions: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                    placeholder="0"
                  />
                </div>

                {settings.nutritionEnabled && (
                  <div>
                    <label className="block text-gray-700 dark:text-gray-200 font-bold mb-2">
                      🥗 {t('offers.freeNutritionSessions')}
                    </label>
                    <input
                      type="number"
                      value={formData.freeNutritionSessions}
                      onChange={(e) => setFormData({ ...formData, freeNutritionSessions: e.target.value })}
                      className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                      placeholder="0"
                    />
                  </div>
                )}

                {settings.physiotherapyEnabled && (
                  <div>
                    <label className="block text-gray-700 dark:text-gray-200 font-bold mb-2">
                      🏥 {t('offers.freePhysioSessions')}
                    </label>
                    <input
                      type="number"
                      value={formData.freePhysioSessions}
                      onChange={(e) => setFormData({ ...formData, freePhysioSessions: e.target.value })}
                      className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                      placeholder="0"
                    />
                  </div>
                )}

                {settings.groupClassEnabled && (
                  <div>
                    <label className="block text-gray-700 dark:text-gray-200 font-bold mb-2">
                      👥 {t('offers.freeGroupClassSessions')}
                    </label>
                    <input
                      type="number"
                      value={formData.freeGroupClassSessions}
                      onChange={(e) => setFormData({ ...formData, freeGroupClassSessions: e.target.value })}
                      className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                      placeholder="0"
                    />
                  </div>
                )}

                {settings.inBodyEnabled && (
                  <div>
                    <label className="block text-gray-700 dark:text-gray-200 font-bold mb-2">{t('offers.inBodyScans')}</label>
                    <input
                      type="number"
                      value={formData.inBodyScans}
                      onChange={(e) => setFormData({ ...formData, inBodyScans: e.target.value })}
                      className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                      placeholder="0"
                    />
                  </div>
                )}

                {settings.poolEnabled && (
                  <div>
                    <label className="block text-gray-700 dark:text-gray-200 font-bold mb-2">
                      🏊 جلسات حمام السباحة
                    </label>
                    <input
                      type="number"
                      value={formData.freePoolSessions}
                      onChange={(e) => setFormData({ ...formData, freePoolSessions: e.target.value })}
                      className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                      placeholder="0"
                    />
                  </div>
                )}

                {settings.padelEnabled && (
                  <div>
                    <label className="block text-gray-700 dark:text-gray-200 font-bold mb-2">
                      🎾 جلسات البادل
                    </label>
                    <input
                      type="number"
                      value={formData.freePadelSessions}
                      onChange={(e) => setFormData({ ...formData, freePadelSessions: e.target.value })}
                      className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                      placeholder="0"
                    />
                  </div>
                )}

                {settings.assessmentEnabled && (
                  <div>
                    <label className="block text-gray-700 dark:text-gray-200 font-bold mb-2">
                      📊 جلسات التقييم
                    </label>
                    <input
                      type="number"
                      value={formData.freeAssessmentSessions}
                      onChange={(e) => setFormData({ ...formData, freeAssessmentSessions: e.target.value })}
                      className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                      placeholder="0"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-gray-700 dark:text-gray-200 font-bold mb-2">{t('offers.freeInvitations')}</label>
                  <input
                    type="number"
                    value={formData.invitations}
                    onChange={(e) => setFormData({ ...formData, invitations: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 dark:text-gray-200 font-bold mb-2">❄️ أيام الفريز</label>
                  <input
                    type="number"
                    value={formData.freezeDays}
                    onChange={(e) => setFormData({ ...formData, freezeDays: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                    placeholder="0"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">عدد أيام الفريز المسموح بها لهذا العرض</p>
                </div>

                <div>
                  <label className="block text-gray-700 dark:text-gray-200 font-bold mb-2">{t('offers.upgradeEligibilityDays')}</label>
                  <input
                    type="number"
                    value={formData.upgradeEligibilityDays}
                    onChange={(e) => setFormData({ ...formData, upgradeEligibilityDays: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                    placeholder="7"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('offers.upgradeEligibilityDaysHelp')}</p>
                </div>

                <div>
                  <label className="block text-gray-700 dark:text-gray-200 font-bold mb-2">
                    🎁 {t('offers.upgradePoints')}
                  </label>
                  <input
                    type="number"
                    value={formData.upgradePoints}
                    onChange={(e) => setFormData({ ...formData, upgradePoints: e.target.value })}
                    className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                    placeholder="0"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('offers.upgradePointsHelp')}
                  </p>
                </div>

                {/* 💰 عمولة الكوتش */}
                {settings.ptCommissionEnabled && (
                  <div>
                    <label className="block text-gray-700 dark:text-gray-200 font-bold mb-2">
                      👨‍🏫 عمولة الكوتش (جنيه)
                    </label>
                    <input
                      type="number"
                      value={formData.ptCommission}
                      onChange={(e) => setFormData({ ...formData, ptCommission: e.target.value })}
                      className="w-full p-3 border-2 border-purple-300 dark:border-purple-600 rounded-lg focus:border-purple-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                      placeholder="0"
                      min="0"
                      step="10"
                    />
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                      💰 مبلغ العمولة للكوتش عند اشتراك عضو بهذا العرض
                      <br />
                      <span className="text-gray-500 dark:text-gray-400">(0 = استخدام المبلغ الافتراضي من الإعدادات: {settings.ptCommissionAmount || 50} ج.م)</span>
                    </p>
                  </div>
                )}

                {/* 🕐 ساعات الدخول المسموح بها */}
                <div className="md:col-span-2 border-2 border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <label className="block text-gray-700 dark:text-gray-200 font-bold mb-1">
                    🕐 ساعات الدخول المسموح بها (اختياري)
                  </label>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                    لو حددت ساعات، كل عضو يشترك في العرض ده هيتحدد له نفس الساعات تلقائياً. سيب فاضي عشان يدخل أي وقت.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">من</label>
                      <input
                        type="time"
                        value={formData.allowedCheckInStart}
                        onChange={(e) => setFormData({ ...formData, allowedCheckInStart: e.target.value })}
                        className="w-full p-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">إلى</label>
                      <input
                        type="time"
                        value={formData.allowedCheckInEnd}
                        onChange={(e) => setFormData({ ...formData, allowedCheckInEnd: e.target.value })}
                        className="w-full p-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                  {(formData.allowedCheckInStart || formData.allowedCheckInEnd) && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, allowedCheckInStart: '', allowedCheckInEnd: '' })}
                      className="mt-2 text-xs text-red-600 hover:underline"
                    >
                      ✕ إلغاء التحديد
                    </button>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-gray-700 dark:text-gray-200 font-bold mb-2">{t('offers.icon')}</label>
                  <div className="flex gap-3">
                    {iconOptions.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon })}
                        className={`text-3xl p-3 rounded-lg border-2 transition-all ${
                          formData.icon === icon
                            ? 'border-primary-500 bg-primary-100 dark:bg-primary-900/50 scale-110'
                            : 'border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-500'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2 flex gap-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white py-3 rounded-lg font-bold hover:scale-105 dark:hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? `⏳ ${t('offers.messages.saving')}` : editingOffer ? `💾 ${t('offers.saveChanges')}` : `➕ ${t('offers.addOffer')}`}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-8 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg font-bold hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors"
                  >
                    {t('offers.cancel')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Offers Grid */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-300">{t('offers.loading')}</p>
            </div>
          ) : !Array.isArray(offers) || offers.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <p className="text-2xl text-gray-400 mb-2">🎁</p>
              <p className="text-gray-600 dark:text-gray-300">{t('offers.noOffers')}</p>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">{t('offers.addFirstOffer')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  className={`bg-white dark:bg-gray-800 border-2 rounded-xl p-6 transition-all hover:shadow-lg ${
                    offer.isActive ? 'border-primary-200 dark:border-primary-700' : 'border-gray-200 dark:border-gray-600 opacity-60'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{offer.icon}</span>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{offer.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{offer.duration} {t('offers.days')}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleActive(offer)}
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        offer.isActive
                          ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {offer.isActive ? `✓ ${t('offers.active')}` : `✕ ${t('offers.inactive')}`}
                    </button>
                  </div>

                  <div className="space-y-2 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-300">{t('offers.price')}</span>
                      <span className="text-2xl font-bold text-primary-600">{offer.price} {t('offers.priceEGP')}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 dark:text-gray-300">{t('offers.ptSessions')}</span>
                      <span className="font-bold text-gray-800 dark:text-gray-100">{offer.freePTSessions}</span>
                    </div>
                    {settings.ptCommissionEnabled && offer.ptCommission !== undefined && offer.ptCommission > 0 && (
                      <div className="flex justify-between items-center text-sm bg-purple-50 dark:bg-purple-900/30 p-2 rounded-lg border border-purple-200 dark:border-purple-700">
                        <span className="text-purple-700 dark:text-purple-300 font-semibold">👨‍🏫 عمولة الكوتش</span>
                        <span className="font-bold text-purple-700 dark:text-purple-300">{offer.ptCommission} ج.م</span>
                      </div>
                    )}
                    {settings.nutritionEnabled && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 dark:text-gray-300">🥗 {t('offers.nutritionSessions')}</span>
                        <span className="font-bold text-gray-800 dark:text-gray-100">{(offer as any).freeNutritionSessions || 0}</span>
                      </div>
                    )}
                    {settings.physiotherapyEnabled && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 dark:text-gray-300">🏥 {t('offers.physioSessions')}</span>
                        <span className="font-bold text-gray-800 dark:text-gray-100">{(offer as any).freePhysioSessions || 0}</span>
                      </div>
                    )}
                    {settings.groupClassEnabled && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 dark:text-gray-300">👥 {t('offers.groupClassSessions')}</span>
                        <span className="font-bold text-gray-800 dark:text-gray-100">{(offer as any).freeGroupClassSessions || 0}</span>
                      </div>
                    )}
                    {settings.inBodyEnabled && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 dark:text-gray-300">{t('offers.inBody')}</span>
                        <span className="font-bold text-gray-800 dark:text-gray-100">{offer.inBodyScans}</span>
                      </div>
                    )}
                    {settings.poolEnabled && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 dark:text-gray-300">🏊 جلسات حمام السباحة</span>
                        <span className="font-bold text-gray-800 dark:text-gray-100">{(offer as any).freePoolSessions || 0}</span>
                      </div>
                    )}
                    {settings.padelEnabled && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 dark:text-gray-300">🎾 جلسات البادل</span>
                        <span className="font-bold text-gray-800 dark:text-gray-100">{(offer as any).freePadelSessions || 0}</span>
                      </div>
                    )}
                    {settings.assessmentEnabled && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 dark:text-gray-300">📊 جلسات التقييم</span>
                        <span className="font-bold text-gray-800 dark:text-gray-100">{(offer as any).freeAssessmentSessions || 0}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 dark:text-gray-300">{t('offers.invitations')}</span>
                      <span className="font-bold text-gray-800 dark:text-gray-100">{offer.invitations}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 dark:text-gray-300">❄️ أيام الفريز</span>
                      <span className="font-bold text-primary-600 dark:text-primary-400">{offer.freezeDays}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                      <span className="text-gray-600 dark:text-gray-300">{t('offers.upgradeWindow')}</span>
                      <span className="font-bold text-primary-600 dark:text-primary-400">
                        {offer.upgradeEligibilityDays !== null && offer.upgradeEligibilityDays !== undefined
                          ? `${offer.upgradeEligibilityDays} ${t('offers.days')}`
                          : t('offers.noUpgrade')
                        }
                      </span>
                    </div>
                    {offer.upgradePoints && offer.upgradePoints > 0 && (
                      <div className="flex justify-between items-center text-sm border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                        <span className="text-gray-600 dark:text-gray-300">🎁 {t('offers.upgradePointsReward')}</span>
                        <span className="font-bold text-green-600 dark:text-green-400">
                          {offer.upgradePoints} {t('offers.pointsLabel')}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(offer)}
                      className="flex-1 bg-primary-500 text-white py-2 rounded-lg font-bold hover:bg-primary-600 dark:hover:bg-primary-500 transition-colors"
                    >
                      ✏️ {t('offers.edit')}
                    </button>
                    <button
                      onClick={() => handleDelete(offer)}
                      className="flex-1 bg-red-500 text-white py-2 rounded-lg font-bold hover:bg-red-600 dark:hover:bg-red-500 transition-colors"
                    >
                      🗑️ {t('offers.delete')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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

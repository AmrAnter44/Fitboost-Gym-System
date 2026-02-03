'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useToast } from '@/contexts/ToastContext'
import { useServiceSettings } from '@/contexts/ServiceSettingsContext'
import { useRouter } from 'next/navigation'

interface ServicePackage {
  id: string
  name: string
  serviceType: string
  sessions: number
  price: number
  isActive: boolean
}

export default function PackagesManagementPage() {
  const { t, direction } = useLanguage()
  const toast = useToast()
  const router = useRouter()
  const { settings } = useServiceSettings()

  const [packages, setPackages] = useState<ServicePackage[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPackage, setEditingPackage] = useState<ServicePackage | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    serviceType: 'PT',
    sessions: '',
    price: ''
  })

  useEffect(() => {
    fetchPackages()
  }, [])

  const fetchPackages = async () => {
    try {
      const response = await fetch('/api/packages')
      if (response.ok) {
        const data = await response.json()
        setPackages(data)
      }
    } catch (error) {
      console.error('Error fetching packages:', error)
      toast.error(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.sessions || !formData.price) {
      toast.error('جميع الحقول مطلوبة')
      return
    }

    try {
      const url = editingPackage ? '/api/packages' : '/api/packages'
      const method = editingPackage ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingPackage
            ? { id: editingPackage.id, ...formData }
            : formData
        )
      })

      if (response.ok) {
        toast.success(editingPackage ? 'تم تحديث الباقة' : 'تمت إضافة الباقة')
        fetchPackages()
        resetForm()
      } else {
        const data = await response.json()
        toast.error(data.error || t('common.error'))
      }
    } catch (error) {
      console.error('Error saving package:', error)
      toast.error(t('common.error'))
    }
  }

  const handleEdit = (pkg: ServicePackage) => {
    setEditingPackage(pkg)
    setFormData({
      name: pkg.name,
      serviceType: pkg.serviceType,
      sessions: pkg.sessions.toString(),
      price: pkg.price.toString()
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذه الباقة؟')) return

    try {
      const response = await fetch(`/api/packages?id=${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('تم حذف الباقة')
        fetchPackages()
      } else {
        toast.error(t('common.error'))
      }
    } catch (error) {
      console.error('Error deleting package:', error)
      toast.error(t('common.error'))
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      serviceType: 'PT',
      sessions: '',
      price: ''
    })
    setEditingPackage(null)
    setShowForm(false)
  }

  const getServiceIcon = (serviceType: string) => {
    switch (serviceType) {
      case 'PT': return '💪'
      case 'Nutrition': return '🥗'
      case 'Physiotherapy': return '🏥'
      case 'GroupClass': return '👥'
      default: return '📦'
    }
  }

  const getServiceColor = (serviceType: string) => {
    switch (serviceType) {
      case 'PT': return 'bg-purple-50 border-purple-300'
      case 'Nutrition': return 'bg-lime-50 border-lime-400'
      case 'Physiotherapy': return 'bg-blue-50 border-blue-400'
      case 'GroupClass': return 'bg-fuchsia-50 border-fuchsia-400'
      default: return 'bg-gray-50 border-gray-300'
    }
  }

  const groupedPackages = {
    PT: packages.filter(p => p.serviceType === 'PT'),
    Nutrition: packages.filter(p => p.serviceType === 'Nutrition'),
    Physiotherapy: packages.filter(p => p.serviceType === 'Physiotherapy'),
    GroupClass: packages.filter(p => p.serviceType === 'GroupClass')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-spin">⏳</div>
          <p className="text-xl text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <span>📦</span>
            {t('packages.title')}
          </h1>
          <p className="text-gray-600 mt-2">{t('packages.description')}</p>
        </div>
        <button
          onClick={() => router.back()}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-bold"
        >
          ← {t('common.back')}
        </button>
      </div>

      {/* زر إضافة باقة جديدة */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="mb-6 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white px-8 py-3 rounded-lg font-bold shadow-lg transition-all hover:scale-105"
        >
          + {t('packages.addNew')}
        </button>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-purple-200">
          <h2 className="text-2xl font-bold mb-4">
            {editingPackage ? t('packages.edit') : t('packages.addNew')}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 font-bold mb-2">
                {t('packages.packageName')}
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                placeholder="مثال: 8 جلسات"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-2">
                {t('packages.serviceType')}
              </label>
              <select
                value={formData.serviceType}
                onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                disabled={!!editingPackage}
              >
                <option value="PT">💪 PT</option>
                {settings.nutritionEnabled && <option value="Nutrition">🥗 {t('services.nutrition')}</option>}
                {settings.physiotherapyEnabled && <option value="Physiotherapy">🏥 {t('services.physiotherapy')}</option>}
                {settings.groupClassEnabled && <option value="GroupClass">👥 {t('services.groupClasses')}</option>}
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-2">
                {t('packages.sessions')}
              </label>
              <input
                type="number"
                value={formData.sessions}
                onChange={(e) => setFormData({ ...formData, sessions: e.target.value })}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                placeholder="8"
                required
              />
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-2">
                {t('packages.price')}
              </label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none"
                placeholder="800"
                required
              />
            </div>

            <div className="md:col-span-2 flex gap-3">
              <button
                type="submit"
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-bold"
              >
                {editingPackage ? t('common.save') : t('common.add')}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-6 py-3 rounded-lg font-bold"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* عرض الباقات مجمعة حسب نوع الخدمة */}
      <div className="space-y-6">
        {Object.entries(groupedPackages).map(([serviceType, pkgs]) => {
          if (pkgs.length === 0) return null

          // إخفاء الخدمات المقفولة
          if (serviceType === 'Nutrition' && !settings.nutritionEnabled) return null
          if (serviceType === 'Physiotherapy' && !settings.physiotherapyEnabled) return null
          if (serviceType === 'GroupClass' && !settings.groupClassEnabled) return null

          return (
            <div key={serviceType} className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                {getServiceIcon(serviceType)}
                {serviceType === 'PT' ? 'PT' :
                 serviceType === 'Nutrition' ? t('services.nutrition') :
                 serviceType === 'Physiotherapy' ? t('services.physiotherapy') :
                 t('services.groupClasses')}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pkgs.map((pkg) => (
                  <div
                    key={pkg.id}
                    className={`p-4 rounded-lg border-2 ${getServiceColor(pkg.serviceType)}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-lg">{pkg.name}</h3>
                        <p className="text-sm text-gray-600">
                          {pkg.sessions} {t('packages.sessions')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-purple-600">
                          {pkg.price}
                        </p>
                        <p className="text-xs text-gray-500">{t('members.egp')}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(pkg)}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-sm font-bold"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        onClick={() => handleDelete(pkg.id)}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded text-sm font-bold"
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {packages.length === 0 && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <p className="text-xl text-gray-600">{t('packages.noPackages')}</p>
            <p className="text-gray-500 mt-2">{t('packages.addFirstPackage')}</p>
          </div>
        )}
      </div>
    </div>
  )
}

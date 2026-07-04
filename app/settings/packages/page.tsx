'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useToast } from '@/contexts/ToastContext'
import { useServiceSettings } from '@/contexts/ServiceSettingsContext'
import { useRouter } from 'next/navigation'
import { LoadingScreen } from '@/components/Spinner'
import ConfirmDialog from '@/components/ConfirmDialog'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface ServicePackage {
  id: string
  name: string
  serviceType: string
  sessions: number
  price: number
  durationDays: number
  moreCommission?: number
  isActive: boolean
}

const SERVICE_ICONS: Record<string, JSX.Element> = {
  PT: (<path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3 2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75 2.25-1.313M12 21.75V19.5m0 2.25-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25" />),
  Nutrition: (<path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Zm0 0V9m0 12c-1.657 0-3-2.69-3-6m3 6c1.657 0 3-2.69 3-6m0 0c0-3.31-1.343-6-3-6S9 5.69 9 9m6 0H9" />),
  Physiotherapy: (<path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12h19.5M3 16.5h18M3 7.5h18M12 3v18" />),
  GroupClass: (<path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />),
  More: (<path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />),
  default: (<path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />)
}

const SERVICE_TONES: Record<string, string> = {
  PT: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
  Nutrition: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  Physiotherapy: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  GroupClass: 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-400',
  More: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400',
  default: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
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
  const [confirmState, setConfirmState] = useState<{ open: boolean; message: string; title?: string; onConfirm: () => void }>({ open: false, message: '', onConfirm: () => {} })

  const [formData, setFormData] = useState({
    name: '',
    serviceType: 'PT',
    sessions: '',
    price: '',
    durationDays: '30',
    moreCommission: ''
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
      price: pkg.price.toString(),
      durationDays: pkg.durationDays?.toString() || '30',
      moreCommission: pkg.moreCommission?.toString() || '0'
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    setConfirmState({
      open: true,
      message: 'هل تريد حذف هذه الباقة؟',
      title: t('common.delete'),
      onConfirm: async () => {
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
      },
    })
  }

  const resetForm = () => {
    setFormData({
      name: '',
      serviceType: 'PT',
      sessions: '',
      price: '',
      durationDays: '30',
      moreCommission: ''
    })
    setEditingPackage(null)
    setShowForm(false)
  }

  const getServiceIcon = (serviceType: string) => SERVICE_ICONS[serviceType] || SERVICE_ICONS.default
  const getServiceTone = (serviceType: string) => SERVICE_TONES[serviceType] || SERVICE_TONES.default

  const groupedPackages = {
    PT: packages.filter(p => p.serviceType === 'PT'),
    Nutrition: packages.filter(p => p.serviceType === 'Nutrition'),
    Physiotherapy: packages.filter(p => p.serviceType === 'Physiotherapy'),
    GroupClass: packages.filter(p => p.serviceType === 'GroupClass'),
    More: packages.filter(p => p.serviceType === 'More')
  }

  if (loading) {
    return <LoadingScreen fullScreen />
  }

  return (
    <div className="container mx-auto p-6" dir={direction}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
            <svg {...stroke} className="w-6 h-6" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{t('packages.title')}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('packages.description')}</p>
          </div>
        </div>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 text-sm"
        >
          <svg {...stroke} className={`w-4 h-4 ${direction === 'rtl' ? 'rotate-180' : ''}`} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          <span>{t('common.back')}</span>
        </button>
      </div>

      {/* Add new package button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="mb-6 inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 text-sm"
        >
          <svg {...stroke} className="w-4 h-4" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>{t('packages.addNew')}</span>
        </button>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 mb-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
            {editingPackage ? t('packages.edit') : t('packages.addNew')}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                {t('packages.packageName')}
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                placeholder="مثال: 8 جلسات"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                {t('packages.serviceType')}
              </label>
              <select
                value={formData.serviceType}
                onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 disabled:opacity-60"
                disabled={!!editingPackage}
              >
                <option value="PT">PT</option>
                {settings.nutritionEnabled && <option value="Nutrition">{t('services.nutrition')}</option>}
                {settings.physiotherapyEnabled && <option value="Physiotherapy">{t('services.physiotherapy')}</option>}
                {settings.groupClassEnabled && <option value="GroupClass">{t('services.groupClasses')}</option>}
                {settings.moreEnabled && <option value="More">{t('nav.more')}</option>}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                {t('packages.sessions')}
              </label>
              <input
                type="number"
                value={formData.sessions}
                onChange={(e) => setFormData({ ...formData, sessions: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                placeholder="8"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                {t('packages.price')}
              </label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                placeholder="800"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                مدة الاشتراك (يوم)
              </label>
              <input
                type="number"
                value={formData.durationDays}
                onChange={(e) => setFormData({ ...formData, durationDays: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                placeholder="30"
                min="1"
                required
              />
            </div>

            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 text-sm"
              >
                <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                <span>{editingPackage ? t('common.save') : t('common.add')}</span>
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 text-sm"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grouped packages */}
      <div className="space-y-6">
        {Object.entries(groupedPackages).map(([serviceType, pkgs]) => {
          if (pkgs.length === 0) return null

          if (serviceType === 'Nutrition' && !settings.nutritionEnabled) return null
          if (serviceType === 'Physiotherapy' && !settings.physiotherapyEnabled) return null
          if (serviceType === 'GroupClass' && !settings.groupClassEnabled) return null

          const tone = getServiceTone(serviceType)

          return (
            <div key={serviceType} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-3 text-gray-900 dark:text-gray-100">
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone}`}>
                  <svg {...stroke} className="w-5 h-5" aria-hidden="true">{getServiceIcon(serviceType)}</svg>
                </span>
                <span>
                  {serviceType === 'PT' ? 'PT' :
                   serviceType === 'Nutrition' ? t('services.nutrition') :
                   serviceType === 'Physiotherapy' ? t('services.physiotherapy') :
                   serviceType === 'GroupClass' ? t('services.groupClasses') :
                   t('nav.more')}
                </span>
              </h2>

              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3 text-start font-bold">{t('packages.packageName')}</th>
                      <th className="px-4 py-3 text-start font-bold">{t('packages.sessions')}</th>
                      <th className="px-4 py-3 text-start font-bold">مدة (يوم)</th>
                      <th className="px-4 py-3 text-start font-bold">{t('packages.price')}</th>
                      <th className="px-4 py-3 text-end font-bold">{t('common.actions') || 'إجراءات'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                    {pkgs.map((pkg) => (
                      <tr key={pkg.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                        <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100">{pkg.name}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{pkg.sessions}</td>
                        <td className="px-4 py-3">
                          {pkg.durationDays ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                              {pkg.durationDays} يوم
                            </span>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-primary-600 dark:text-primary-400">{pkg.price}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ms-1">{t('members.egp')}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => handleEdit(pkg)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors duration-200"
                              title={t('common.edit')}
                              aria-label={t('common.edit')}
                            >
                              <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487 18.549 2.799a2.122 2.122 0 1 1 3 3L19.862 7.487m-3-3L8.078 13.27a2 2 0 0 0-.5.831l-1.111 4.222 4.222-1.111a2 2 0 0 0 .832-.5l8.781-8.781m-3-3 3 3" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(pkg.id)}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors duration-200"
                              title={t('common.delete')}
                              aria-label={t('common.delete')}
                            >
                              <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}

        {packages.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 flex flex-col items-center justify-center py-12 text-center">
            <svg {...stroke} className="w-12 h-12 text-gray-400" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
            </svg>
            <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">{t('packages.noPackages')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('packages.addFirstPackage')}</p>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmState.open}
        title={confirmState.title || ''}
        message={confirmState.message}
        type="danger"
        onConfirm={() => {
          confirmState.onConfirm()
          setConfirmState((s) => ({ ...s, open: false }))
        }}
        onCancel={() => setConfirmState((s) => ({ ...s, open: false }))}
      />
    </div>
  )
}

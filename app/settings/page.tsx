'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '../../contexts/LanguageContext'
import { useDarkMode } from '../../contexts/DarkModeContext'

export default function SettingsPage() {
  const router = useRouter()
  const { locale, setLanguage, t, direction } = useLanguage()
  const { isDarkMode, toggleDarkMode } = useDarkMode()
  const [user, setUser] = useState<any>(null)
  const [activeSection, setActiveSection] = useState('services')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isAwardingBirthday, setIsAwardingBirthday] = useState(false)
  const [birthdayResult, setBirthdayResult] = useState<any>(null)

  const [serviceSettings, setServiceSettings] = useState({
    nutritionEnabled: true,
    physiotherapyEnabled: true,
    groupClassEnabled: true,
    spaEnabled: true,
    inBodyEnabled: true,
    poolEnabled: true,
    padelEnabled: true,
    assessmentEnabled: true,
    websiteUrl: 'https://www.xgym.website',
    showWebsiteOnReceipts: true,
    receiptTerms: '',
    pointsEnabled: false,
    pointsPerCheckIn: 0,
    pointsPerInvitation: 0,
    pointsPerReferral: 0,
    pointsPerEGPSpent: 0,
    pointsPerBirthday: 10,
    pointsValueInEGP: 0,
    nutritionReferralEnabled: false,
    nutritionReferralPercentage: 0,
    physioReferralEnabled: false,
    physioReferralPercentage: 0,
    trackFreeSessionsCost: false,
    freePTSessionPrice: 0,
    freeNutritionSessionPrice: 0,
    freePhysioSessionPrice: 0,
    freeGroupClassSessionPrice: 0
  })

  const [nextReceiptNumber, setNextReceiptNumber] = useState(1001)
  const [nextMemberNumber, setNextMemberNumber] = useState(1001)

  // Database & Prisma states
  const [dbUploading, setDbUploading] = useState(false)
  const [dbUploadResult, setDbUploadResult] = useState<{ success?: string; error?: string } | null>(null)
  const [updatingPrisma, setUpdatingPrisma] = useState(false)
  const [prismaMessage, setPrismaMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Save notification state
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    checkAuth()
    fetchServiceSettings()
    fetchNumbers()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        const hasAccess = data.user.role === 'ADMIN' || data.user.role === 'OWNER' || data.user.permissions?.canAccessSettings === true
        if (!hasAccess) {
          router.push('/')
          return
        }
        setUser(data.user)
      } else {
        router.push('/login')
      }
    } catch (error) {
      router.push('/login')
    }
  }

  const fetchServiceSettings = async () => {
    try {
      const response = await fetch('/api/settings/services')
      if (response.ok) {
        const data = await response.json()
        setServiceSettings(data)
      }
    } catch (error) {
      console.error('Error fetching service settings:', error)
    }
  }

  const fetchNumbers = async () => {
    try {
      const receiptResponse = await fetch('/api/receipts/next-number')
      if (receiptResponse.ok) {
        const receiptData = await receiptResponse.json()
        setNextReceiptNumber(receiptData.nextNumber)
      }
      const memberResponse = await fetch('/api/members/next-number')
      if (memberResponse.ok) {
        const memberData = await memberResponse.json()
        setNextMemberNumber(memberData.nextNumber)
      }
    } catch (error) {
      console.error('Error fetching numbers:', error)
    }
  }

  const saveServiceSettings = async () => {
    setIsSaving(true)
    setSaveMessage(null)
    try {
      const response = await fetch('/api/settings/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serviceSettings)
      })
      if (response.ok) {
        setSaveMessage({
          type: 'success',
          text: t('settingsPage.saveSuccess')
        })
        setTimeout(() => setSaveMessage(null), 5000)
      } else {
        setSaveMessage({
          type: 'error',
          text: t('settingsPage.saveError')
        })
      }
    } catch (error) {
      setSaveMessage({
        type: 'error',
        text: t('settingsPage.saveNetworkError')
      })
    } finally {
      setIsSaving(false)
    }
  }

  const awardBirthdayPoints = async () => {
    if (!confirm(t('settingsPage.points.confirmAward'))) {
      return
    }

    setIsAwardingBirthday(true)
    setBirthdayResult(null)
    try {
      const response = await fetch('/api/birthday-points', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer birthday-points-secret-2024'
        }
      })
      const data = await response.json()

      if (response.ok && data.success) {
        setBirthdayResult({
          type: 'success',
          message: data.message,
          count: data.count,
          members: data.members
        })
        setTimeout(() => setBirthdayResult(null), 10000)
      } else {
        setBirthdayResult({
          type: 'error',
          message: data.message || t('settingsPage.points.failedToAward')
        })
      }
    } catch (error) {
      setBirthdayResult({
        type: 'error',
        message: t('settingsPage.networkError')
      })
    } finally {
      setIsAwardingBirthday(false)
    }
  }

  const toggleService = (serviceName: string) => {
    setServiceSettings(prev => ({
      ...prev,
      [`${serviceName}Enabled`]: !prev[`${serviceName}Enabled` as keyof typeof prev]
    }))
  }

  const updateSetting = (key: string, value: any) => {
    setServiceSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleLanguageChange = (newLocale: string) => {
    setLanguage(newLocale as 'ar' | 'en')
  }

  const handleDbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setDbUploading(true)
    setDbUploadResult(null)
    try {
      const formData = new FormData()
      formData.append('database', file)
      const res = await fetch('/api/settings/restore-db', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok && data.success) {
        setDbUploadResult({ success: `✅ ${data.message}` })
      } else {
        setDbUploadResult({ error: data.error || t('settingsPage.unexpectedError') })
      }
    } catch (err: any) {
      setDbUploadResult({ error: err.message })
    } finally {
      setDbUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleUpdatePrisma = async () => {
    if (!confirm(`⚠️ ${t('settingsPage.database.prismaConfirm')}`)) {
      return
    }

    setUpdatingPrisma(true)
    setPrismaMessage(null)

    try {
      const response = await fetch('/api/admin/prisma-update', {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        setPrismaMessage({
          type: 'success',
          text: t('settingsPage.database.prismaSuccess')
        })
        setTimeout(() => setPrismaMessage(null), 10000)
      } else {
        setPrismaMessage({
          type: 'error',
          text: data.message || 'فشل تحديث Prisma'
        })
      }
    } catch (error) {
      setPrismaMessage({
        type: 'error',
        text: t('settingsPage.prismaUpdateError')
      })
    } finally {
      setUpdatingPrisma(false)
    }
  }

  const navigationItems = [
    ...(user?.role === 'ADMIN' || user?.role === 'OWNER' ? [{ id: 'quick-links', label: t('settingsPage.navigation.quickLinks'), icon: '⚡' }] : []),
    { id: 'services', label: t('settingsPage.navigation.services'), icon: '🏋️' },
    { id: 'points', label: t('settingsPage.navigation.points'), icon: '🎯' },
    { id: 'referral', label: t('settingsPage.navigation.referral'), icon: '🎁' },
    { id: 'free-sessions', label: t('settingsPage.navigation.freeSessions'), icon: '🎫' },
    { id: 'receipts', label: t('settingsPage.navigation.receipts'), icon: '📋' },
    { id: 'display', label: t('settingsPage.navigation.display'), icon: '🎨' },
    ...(user?.role === 'OWNER' ? [{ id: 'database', label: t('settingsPage.navigation.database'), icon: '💾' }] : []),
    { id: 'support', label: t('settingsPage.navigation.support'), icon: '📞' }
  ]

  const services = [
    { id: 'nutrition', icon: '🥗', name: t('settingsPage.services.nutrition.name'), desc: t('settingsPage.services.nutrition.desc') },
    { id: 'physiotherapy', icon: '💆', name: t('settingsPage.services.physiotherapy.name'), desc: t('settingsPage.services.physiotherapy.desc') },
    { id: 'groupClass', icon: '🤸', name: t('settingsPage.services.groupClass.name'), desc: t('settingsPage.services.groupClass.desc') },
    { id: 'spa', icon: '🛁', name: t('settingsPage.services.spa.name'), desc: t('settingsPage.services.spa.desc') },
    { id: 'inBody', icon: '⚖️', name: t('settingsPage.services.inBody.name'), desc: t('settingsPage.services.inBody.desc') },
    { id: 'pool', icon: '🏊', name: t('settingsPage.services.pool.name'), desc: t('settingsPage.services.pool.desc') },
    { id: 'padel', icon: '🎾', name: t('settingsPage.services.padel.name'), desc: t('settingsPage.services.padel.desc') },
    { id: 'assessment', icon: '📊', name: t('settingsPage.services.assessment.name'), desc: t('settingsPage.services.assessment.desc') }
  ]

  if (!user) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-xl">{t('settingsPage.loading')}</div></div>
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" dir={direction}>
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('settingsPage.title')}</h1>
          </div>
        </div>
      </div>

      <div className="flex relative">
        {/* Sidebar Overlay for Mobile */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed lg:sticky
            top-[73px]
            ${direction === 'rtl' ? 'right-0' : 'left-0'}
            z-50 lg:z-30
            h-[calc(100vh-73px)]
            w-72 sm:w-80 lg:w-64
            bg-white dark:bg-gray-800
            ${direction === 'rtl' ? 'border-l' : 'border-r'} border-gray-200 dark:border-gray-700
            shadow-2xl lg:shadow-none
            transition-all duration-300 ease-in-out
            ${isSidebarOpen
              ? 'translate-x-0 opacity-100'
              : `${direction === 'rtl' ? 'translate-x-full' : '-translate-x-full'} opacity-0 lg:translate-x-0 lg:opacity-100`
            }
          `}
        >
          {/* Sidebar Header - Mobile Only */}
          <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {t('settingsPage.navigation.quickLinks')}
            </h2>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close sidebar"
            >
              <svg className="w-6 h-6 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 lg:p-4 space-y-1 overflow-y-auto h-[calc(100%-73px)] lg:h-full scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id);
                  setIsSidebarOpen(false);
                }}
                className={`
                  w-full
                  ${direction === 'rtl' ? 'text-right' : 'text-left'}
                  px-4 py-3.5
                  rounded-xl
                  transition-all duration-200
                  flex items-center gap-3
                  ${activeSection === item.id
                    ? 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/40 dark:to-blue-800/40 text-blue-600 dark:text-blue-400 font-semibold shadow-md scale-105'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:scale-102'
                  }
                  active:scale-95
                `}
              >
                <span className="text-2xl flex-shrink-0">{item.icon}</span>
                <span className="flex-1 truncate">{item.label}</span>
                {activeSection === item.id && (
                  <span className="text-blue-500 dark:text-blue-400 text-xl">✓</span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6 lg:p-8 max-w-5xl mx-auto w-full">
          {/* Save Notification Toast */}
          {saveMessage && (
            <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-50 p-5 rounded-2xl border-2 shadow-2xl backdrop-blur-sm animate-[slideDown_0.4s_ease-out] ${saveMessage.type === 'success' ? 'bg-green-50/95 dark:bg-green-900/40 border-green-300 dark:border-green-600' : 'bg-red-50/95 dark:bg-red-900/40 border-red-300 dark:border-red-600'}`}>
              <div className="flex items-center gap-4 min-w-[320px]">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${saveMessage.type === 'success' ? 'bg-green-100 dark:bg-green-800/50' : 'bg-red-100 dark:bg-red-800/50'}`}>
                  <span className="text-2xl">{saveMessage.type === 'success' ? '✅' : '❌'}</span>
                </div>
                <p className={`flex-1 text-sm font-semibold ${saveMessage.type === 'success' ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'}`}>{saveMessage.text}</p>
                <button onClick={() => setSaveMessage(null)} className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${saveMessage.type === 'success' ? 'hover:bg-green-200 dark:hover:bg-green-700/50 text-green-700 dark:text-green-200' : 'hover:bg-red-200 dark:hover:bg-red-700/50 text-red-700 dark:text-red-200'}`}>
                  <span className="text-lg">✕</span>
                </button>
              </div>
            </div>
          )}

          {activeSection === 'services' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3"><span className="text-4xl">🏋️</span><div><h2 className="text-2xl font-bold">{t('settingsPage.services.title')}</h2><p className="text-green-50 text-sm mt-1">{t('settingsPage.services.description')}</p></div></div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="grid gap-4">
                  {services.map((service) => (
                    <div key={service.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                      <div className="flex items-center gap-3"><span className="text-3xl">{service.icon}</span><div><h4 className="font-semibold text-gray-800 dark:text-gray-100">{service.name}</h4><p className="text-sm text-gray-600 dark:text-gray-300">{service.desc}</p></div></div>
                      <label className="toggle-switch toggle-green">
                        <input
                          type="checkbox"
                          checked={serviceSettings[`${service.id}Enabled` as keyof typeof serviceSettings] as boolean}
                          onChange={() => toggleService(service.id)}
                        />
                        <span className="toggle-track">
                          <span className="toggle-thumb"></span>
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex justify-end"><button onClick={saveServiceSettings} disabled={isSaving} className="px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-lg">{isSaving ? t('settingsPage.saving') : t('settingsPage.saveChanges')}</button></div>
              </div>
            </div>
          )}

          {activeSection === 'points' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3"><span className="text-4xl">🎯</span><div><h2 className="text-2xl font-bold">{t('settingsPage.points.title')}</h2><p className="text-yellow-50 text-sm mt-1">{t('settingsPage.points.description')}</p></div></div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-6">
                  <div><h4 className="font-semibold text-gray-800 dark:text-gray-100">{t('settingsPage.points.enable')}</h4><p className="text-sm text-gray-600 dark:text-gray-300">{t('settingsPage.points.enableDesc')}</p></div>
                  <label className="toggle-switch toggle-yellow">
                    <input
                      type="checkbox"
                      checked={serviceSettings.pointsEnabled}
                      onChange={() => updateSetting('pointsEnabled', !serviceSettings.pointsEnabled)}
                    />
                    <span className="toggle-track">
                      <span className="toggle-thumb"></span>
                    </span>
                  </label>
                </div>
                {serviceSettings.pointsEnabled && (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settingsPage.points.perCheckIn')}</label>
                      <input type="number" min="0" value={serviceSettings.pointsPerCheckIn} onChange={(e) => updateSetting('pointsPerCheckIn', parseInt(e.target.value) || 0)} className="w-full px-4 py-2 border-2 border-green-300 dark:border-green-700 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none" />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('settingsPage.points.perCheckInDesc')}</p>
                    </div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settingsPage.points.perInvitation')}</label>
                      <input type="number" min="0" value={serviceSettings.pointsPerInvitation} onChange={(e) => updateSetting('pointsPerInvitation', parseInt(e.target.value) || 0)} className="w-full px-4 py-2 border-2 border-blue-300 dark:border-blue-700 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none" />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('settingsPage.points.perInvitationDesc')}</p>
                    </div>
                    <div className="p-4 bg-teal-50 dark:bg-teal-900/20 border-2 border-teal-200 dark:border-teal-700 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">👥 {t('settingsPage.points.perReferral')}</label>
                      <input type="number" min="0" value={serviceSettings.pointsPerReferral} onChange={(e) => updateSetting('pointsPerReferral', parseInt(e.target.value) || 0)} className="w-full px-4 py-2 border-2 border-teal-300 dark:border-teal-700 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none" />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">💡 {t('settingsPage.points.perReferralDesc')}</p>
                    </div>
                    <div className="p-4 bg-pink-50 dark:bg-pink-900/20 border-2 border-pink-200 dark:border-pink-700 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">🎂 {t('settingsPage.points.perBirthday')}</label>
                      <input type="number" min="0" value={serviceSettings.pointsPerBirthday || 10} onChange={(e) => updateSetting('pointsPerBirthday', parseInt(e.target.value) || 0)} className="w-full px-4 py-2 border-2 border-pink-300 dark:border-pink-700 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none" />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">🎉 {t('settingsPage.points.perBirthdayDesc')}</p>

                      {/* زر منح نقاط عيد الميلاد */}
                      <button
                        onClick={awardBirthdayPoints}
                        disabled={isAwardingBirthday || !serviceSettings.pointsEnabled}
                        className="mt-4 w-full px-4 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold rounded-lg shadow-lg transition-all flex items-center justify-center gap-2"
                      >
                        {isAwardingBirthday ? (
                          <>
                            <span className="animate-spin">⚙️</span>
                            <span>{t('settingsPage.points.awardingPoints')}</span>
                          </>
                        ) : (
                          <>
                            <span>🎁</span>
                            <span>{t('settingsPage.points.awardNow')}</span>
                          </>
                        )}
                      </button>

                      {/* نتيجة منح النقاط */}
                      {birthdayResult && (
                        <div className={`mt-3 p-3 rounded-lg border-2 ${
                          birthdayResult.type === 'success'
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-800 dark:text-green-300'
                            : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300'
                        }`}>
                          <div className="font-bold">{birthdayResult.message}</div>
                          {birthdayResult.members && birthdayResult.members.length > 0 && (
                            <div className="mt-2 text-sm space-y-1">
                              {birthdayResult.members.map((member: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <span>✅</span>
                                  <span>{member.name} (#{member.memberNumber}): +{member.pointsAwarded} {t('members.pointsLabel')}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-200 dark:border-purple-700 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settingsPage.points.perEGP')}</label>
                      <input type="number" min="0" step="0.1" value={serviceSettings.pointsPerEGPSpent} onChange={(e) => updateSetting('pointsPerEGPSpent', parseFloat(e.target.value) || 0)} className="w-full px-4 py-2 border-2 border-purple-300 dark:border-purple-700 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none" />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('settingsPage.points.perEGPDesc')}</p>
                    </div>
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-700 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settingsPage.points.valueInEGP')}</label>
                      <input type="number" min="0" step="0.1" value={serviceSettings.pointsValueInEGP} onChange={(e) => updateSetting('pointsValueInEGP', parseFloat(e.target.value) || 0)} className="w-full px-4 py-2 border-2 border-orange-300 dark:border-orange-700 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none" />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('settingsPage.points.valueInEGPDesc')}</p>
                    </div>
                  </div>
                )}
                <div className="mt-6 flex justify-end"><button onClick={saveServiceSettings} disabled={isSaving} className="px-6 py-2.5 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white font-medium rounded-lg">{isSaving ? t('settingsPage.saving') : t('settingsPage.saveChanges')}</button></div>
              </div>
            </div>
          )}

          {activeSection === 'referral' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3"><span className="text-4xl">🎁</span><div><h2 className="text-2xl font-bold">{t('settingsPage.referral.title')}</h2><p className="text-purple-50 text-sm mt-1">{t('settingsPage.referral.description')}</p></div></div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
                <div className="p-5 bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-200 dark:border-purple-700 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3"><span className="text-2xl">🥗</span><div><h4 className="font-semibold text-gray-800 dark:text-gray-100">{t('settingsPage.referral.nutritionTitle')}</h4><p className="text-sm text-gray-600 dark:text-gray-300">{t('settingsPage.referral.nutritionDesc')}</p></div></div>
                    <label className="toggle-switch toggle-purple">
                      <input
                        type="checkbox"
                        checked={serviceSettings.nutritionReferralEnabled}
                        onChange={() => updateSetting('nutritionReferralEnabled', !serviceSettings.nutritionReferralEnabled)}
                      />
                      <span className="toggle-track">
                        <span className="toggle-thumb"></span>
                      </span>
                    </label>
                  </div>
                  {serviceSettings.nutritionReferralEnabled && (
                    <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settingsPage.referral.percentage')}</label>
                      <input type="number" min="0" max="100" step="0.5" value={serviceSettings.nutritionReferralPercentage} onChange={(e) => updateSetting('nutritionReferralPercentage', parseFloat(e.target.value) || 0)} className="w-full px-4 py-2 border-2 border-purple-300 dark:border-purple-700 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none" placeholder="5" />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('settingsPage.referral.exampleNutrition')}</p>
                    </div>
                  )}
                </div>
                <div className="p-5 bg-pink-50 dark:bg-pink-900/20 border-2 border-pink-200 dark:border-pink-700 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3"><span className="text-2xl">💆</span><div><h4 className="font-semibold text-gray-800 dark:text-gray-100">{t('settingsPage.referral.physioTitle')}</h4><p className="text-sm text-gray-600 dark:text-gray-300">{t('settingsPage.referral.physioDesc')}</p></div></div>
                    <label className="toggle-switch toggle-pink">
                      <input
                        type="checkbox"
                        checked={serviceSettings.physioReferralEnabled}
                        onChange={() => updateSetting('physioReferralEnabled', !serviceSettings.physioReferralEnabled)}
                      />
                      <span className="toggle-track">
                        <span className="toggle-thumb"></span>
                      </span>
                    </label>
                  </div>
                  {serviceSettings.physioReferralEnabled && (
                    <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settingsPage.referral.percentage')}</label>
                      <input type="number" min="0" max="100" step="0.5" value={serviceSettings.physioReferralPercentage} onChange={(e) => updateSetting('physioReferralPercentage', parseFloat(e.target.value) || 0)} className="w-full px-4 py-2 border-2 border-pink-300 dark:border-pink-700 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none" placeholder="3" />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('settingsPage.referral.examplePhysio')}</p>
                    </div>
                  )}
                </div>
                <div className="flex justify-end"><button onClick={saveServiceSettings} disabled={isSaving} className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-medium rounded-lg">{isSaving ? t('settingsPage.saving') : t('settingsPage.saveChanges')}</button></div>
              </div>
            </div>
          )}

          {activeSection === 'receipts' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3"><span className="text-4xl">📋</span><div><h2 className="text-2xl font-bold">{t('settingsPage.receipts.title')}</h2><p className="text-indigo-50 text-sm mt-1">{t('settingsPage.receipts.description')}</p></div></div>
              </div>

              {/* الموقع الإلكتروني */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <span className="text-2xl">🌐</span>
                  {t('settingsPage.receipts.website')}
                </h3>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settingsPage.receipts.websiteUrl')}</label>
                  <input type="url" value={serviceSettings.websiteUrl} onChange={(e) => updateSetting('websiteUrl', e.target.value)} placeholder="https://www.example.com" className="w-full px-4 py-2 border-2 border-blue-300 dark:border-blue-700 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none" dir="ltr" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('settingsPage.receipts.websiteUrlDesc')}</p>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div><h4 className="font-semibold text-gray-800 dark:text-gray-100">{t('settingsPage.receipts.showOnReceipts')}</h4><p className="text-sm text-gray-600 dark:text-gray-300">{t('settingsPage.receipts.showOnReceiptsDesc')}</p></div>
                  <label className="toggle-switch toggle-indigo">
                    <input
                      type="checkbox"
                      checked={serviceSettings.showWebsiteOnReceipts}
                      onChange={() => updateSetting('showWebsiteOnReceipts', !serviceSettings.showWebsiteOnReceipts)}
                    />
                    <span className="toggle-track">
                      <span className="toggle-thumb"></span>
                    </span>
                  </label>
                </div>
              </div>

              {/* الأرقام التسلسلية */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <span className="text-2xl">🔢</span>
                  {t('settingsPage.receipts.serialNumbers')}
                </h3>
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-700 rounded-lg">
                  <div className="flex items-center justify-between"><div><h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">{t('settingsPage.receipts.nextReceiptNumber')}</h4><p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{nextReceiptNumber}</p></div><span className="text-4xl">🧾</span></div>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg">
                  <div className="flex items-center justify-between"><div><h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">{t('settingsPage.receipts.nextMemberNumber')}</h4><p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{nextMemberNumber}</p></div><span className="text-4xl">👤</span></div>
                </div>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-300">ℹ️ {t('settingsPage.receipts.serialInfo')}</p>
                </div>
              </div>

              {/* شروط وأحكام الإيصال */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <span className="text-2xl">📝</span>
                  {t('settingsPage.receipts.terms')}
                </h3>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('settingsPage.receipts.termsLabel')}</label>
                <textarea value={serviceSettings.receiptTerms} onChange={(e) => updateSetting('receiptTerms', e.target.value)} rows={12} className="w-full px-4 py-3 border-2 border-indigo-200 dark:border-indigo-700 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none resize-none" placeholder={t('settingsPage.receipts.termsPlaceholder')} />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('settingsPage.receipts.termsDesc')}</p>
                <div className="mt-6 flex justify-end"><button onClick={saveServiceSettings} disabled={isSaving} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-medium rounded-lg">{isSaving ? t('settingsPage.saving') : t('settingsPage.saveChanges')}</button></div>
              </div>
            </div>
          )}

          {activeSection === 'quick-links' && (user?.role === 'ADMIN' || user?.role === 'OWNER') && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3"><span className="text-4xl">⚡</span><div><h2 className="text-2xl font-bold">{t('settingsPage.quickLinks.title')}</h2><p className="text-red-50 text-sm mt-1">{t('settingsPage.quickLinks.description')}</p></div></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link href="/admin/users" className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-xl p-6 border-2 border-red-200 dark:border-red-700 hover:shadow-lg transition-all hover:scale-105">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">👥</span>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{t('settingsPage.quickLinks.users.title')}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{t('settingsPage.quickLinks.users.desc')}</p>
                    </div>
                    <span className="text-2xl">→</span>
                  </div>
                </Link>
                <Link href="/offers" className="bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-xl p-6 border-2 border-orange-200 dark:border-orange-700 hover:shadow-lg transition-all hover:scale-105">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">🎁</span>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{t('settingsPage.quickLinks.offers.title')}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{t('settingsPage.quickLinks.offers.desc')}</p>
                    </div>
                    <span className="text-2xl">→</span>
                  </div>
                </Link>
                <Link href="/settings/packages" className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-700 hover:shadow-lg transition-all hover:scale-105">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">📦</span>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{t('settingsPage.quickLinks.packages.title')}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{t('settingsPage.quickLinks.packages.desc')}</p>
                    </div>
                    <span className="text-2xl">→</span>
                  </div>
                </Link>
                <Link href="/admin/audit" className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-xl p-6 border-2 border-purple-200 dark:border-purple-700 hover:shadow-lg transition-all hover:scale-105">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">🔒</span>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{t('settingsPage.quickLinks.audit.title')}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">{t('settingsPage.quickLinks.audit.desc')}</p>
                    </div>
                    <span className="text-2xl">→</span>
                  </div>
                </Link>
              </div>
            </div>
          )}

          {activeSection === 'free-sessions' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3"><span className="text-4xl">🎫</span><div><h2 className="text-2xl font-bold">{t('settingsPage.freeSessions.title')}</h2><p className="text-teal-50 text-sm mt-1">{t('settingsPage.freeSessions.description')}</p></div></div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div><h4 className="font-semibold text-gray-800 dark:text-gray-100">{t('settingsPage.freeSessions.enable')}</h4><p className="text-sm text-gray-600 dark:text-gray-300">{t('settingsPage.freeSessions.enableDesc')}</p></div>
                  <label className="toggle-switch toggle-teal">
                    <input
                      type="checkbox"
                      checked={serviceSettings.trackFreeSessionsCost}
                      onChange={() => updateSetting('trackFreeSessionsCost', !serviceSettings.trackFreeSessionsCost)}
                    />
                    <span className="toggle-track">
                      <span className="toggle-thumb"></span>
                    </span>
                  </label>
                </div>
                {serviceSettings.trackFreeSessionsCost && (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settingsPage.freeSessions.ptPrice')}</label>
                      <input type="number" min="0" value={serviceSettings.freePTSessionPrice} onChange={(e) => updateSetting('freePTSessionPrice', parseFloat(e.target.value) || 0)} className="w-full px-4 py-2 border-2 border-green-300 dark:border-green-700 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none" />
                    </div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settingsPage.freeSessions.nutritionPrice')}</label>
                      <input type="number" min="0" value={serviceSettings.freeNutritionSessionPrice} onChange={(e) => updateSetting('freeNutritionSessionPrice', parseFloat(e.target.value) || 0)} className="w-full px-4 py-2 border-2 border-blue-300 dark:border-blue-700 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none" />
                    </div>
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-200 dark:border-purple-700 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settingsPage.freeSessions.physioPrice')}</label>
                      <input type="number" min="0" value={serviceSettings.freePhysioSessionPrice} onChange={(e) => updateSetting('freePhysioSessionPrice', parseFloat(e.target.value) || 0)} className="w-full px-4 py-2 border-2 border-purple-300 dark:border-purple-700 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none" />
                    </div>
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-700 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settingsPage.freeSessions.groupClassPrice')}</label>
                      <input type="number" min="0" value={serviceSettings.freeGroupClassSessionPrice} onChange={(e) => updateSetting('freeGroupClassSessionPrice', parseFloat(e.target.value) || 0)} className="w-full px-4 py-2 border-2 border-orange-300 dark:border-orange-700 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none" />
                    </div>
                  </div>
                )}
                <div className="flex justify-end"><button onClick={saveServiceSettings} disabled={isSaving} className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white font-medium rounded-lg">{isSaving ? t('settingsPage.saving') : t('settingsPage.saveChanges')}</button></div>
              </div>
            </div>
          )}

          {activeSection === 'display' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3"><span className="text-4xl">🎨</span><div><h2 className="text-2xl font-bold">{t('settingsPage.display.title')}</h2><p className="text-violet-50 text-sm mt-1">{t('settingsPage.display.description')}</p></div></div>
              </div>

              {/* المظهر */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <span className="text-2xl">{isDarkMode ? '🌙' : '☀️'}</span>
                  {t('settingsPage.display.appearance')}
                </h3>
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">{isDarkMode ? t('settingsPage.display.darkMode') : t('settingsPage.display.lightMode')}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{isDarkMode ? t('settingsPage.display.switchToLight') : t('settingsPage.display.switchToDark')}</p>
                  </div>
                  <button
                    onClick={toggleDarkMode}
                    className={`relative inline-flex h-10 w-20 items-center rounded-full transition-colors ${isDarkMode ? 'bg-slate-600' : 'bg-gray-300'}`}
                    dir="ltr"
                  >
                    <span className={`flex h-8 w-8 rounded-full bg-white shadow-lg transition-transform items-center justify-center text-xl ${isDarkMode ? 'translate-x-11' : 'translate-x-1'}`}>
                      {isDarkMode ? '🌙' : '☀️'}
                    </span>
                  </button>
                </div>
              </div>

              {/* اللغة */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <span className="text-2xl">🌍</span>
                  {t('settingsPage.display.language')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button onClick={() => handleLanguageChange('ar')} className={`p-6 rounded-xl border-2 transition-all ${locale === 'ar' ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30 shadow-md' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">🇸🇦</span>
                      <div className="flex-1 text-right">
                        <div className="font-bold text-lg">{t('settingsPage.display.arabic')}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">{t('settingsPage.display.arabicSubtitle')}</div>
                      </div>
                      {locale === 'ar' && <span className="text-violet-500 text-2xl">✓</span>}
                    </div>
                  </button>
                  <button onClick={() => handleLanguageChange('en')} className={`p-6 rounded-xl border-2 transition-all ${locale === 'en' ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30 shadow-md' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">🇬🇧</span>
                      <div className="flex-1 text-left">
                        <div className="font-bold text-lg">{t('settingsPage.display.english')}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">{t('settingsPage.display.englishSubtitle')}</div>
                      </div>
                      {locale === 'en' && <span className="text-violet-500 text-2xl">✓</span>}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'database' && user?.role === 'OWNER' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3"><span className="text-4xl">💾</span><div><h2 className="text-2xl font-bold">{t('settingsPage.database.title')}</h2><p className="text-blue-50 text-sm mt-1">{t('settingsPage.database.description')}</p></div></div>
              </div>

              {/* استعادة قاعدة البيانات */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <span className="text-2xl">📥</span>
                  {t('settingsPage.database.restore')}
                </h3>

                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-700 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">⚠️</span>
                    <h4 className="font-bold text-gray-800 dark:text-gray-100">{t('settingsPage.database.warningTitle')}</h4>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{t('settingsPage.database.warningText')}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{t('settingsPage.database.uploadLabel')}</label>
                  <input
                    type="file"
                    accept=".db"
                    onChange={handleDbUpload}
                    disabled={dbUploading}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none disabled:opacity-50"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{t('settingsPage.database.uploadDesc')}</p>
                </div>

                {dbUploading && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl animate-spin">⏳</span>
                      <span className="text-gray-700 dark:text-gray-300">{t('settingsPage.database.uploading')}</span>
                    </div>
                  </div>
                )}

                {dbUploadResult?.success && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700 rounded-lg">
                    <p className="text-green-800 dark:text-green-200">{dbUploadResult.success}</p>
                  </div>
                )}

                {dbUploadResult?.error && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700 rounded-lg">
                    <p className="text-red-800 dark:text-red-200">❌ {dbUploadResult.error}</p>
                  </div>
                )}
              </div>

              {/* تحديث Prisma */}
              {prismaMessage && (
                <div className={`p-4 rounded-xl border-2 ${prismaMessage.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{prismaMessage.type === 'success' ? '✅' : '❌'}</span>
                    <div className="flex-1">
                      <p className={`text-sm whitespace-pre-line ${prismaMessage.type === 'success' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>{prismaMessage.text}</p>
                    </div>
                    <button onClick={() => setPrismaMessage(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">✕</button>
                  </div>
                </div>
              )}

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <span className="text-2xl">🔄</span>
                  {t('settingsPage.database.prismaUpdate')}
                </h3>

                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-200 dark:border-purple-700 rounded-lg">
                  <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <span>📝</span>
                    {t('settingsPage.database.prismaWhat')}
                  </h4>
                  <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 mr-4">
                    <li>• {t('settingsPage.database.prismaStep1')}</li>
                    <li>• {t('settingsPage.database.prismaStep2')}</li>
                    <li>• {t('settingsPage.database.prismaStep3')}</li>
                  </ul>
                </div>

                <button
                  onClick={handleUpdatePrisma}
                  disabled={updatingPrisma}
                  className={`w-full px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-all shadow-lg flex items-center justify-center gap-3 ${updatingPrisma ? 'opacity-70 cursor-not-allowed' : 'hover:scale-105'}`}
                >
                  {updatingPrisma ? (
                    <>
                      <span className="animate-spin text-xl">⏳</span>
                      <span>{t('settingsPage.database.prismaUpdating')}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xl">🔄</span>
                      <span>{t('settingsPage.database.prismaButton')}</span>
                    </>
                  )}
                </button>

                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400">💡 {t('settingsPage.database.prismaInfo')}</p>
                </div>
              </div>
            </div>
          )}


          {activeSection === 'support' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3"><span className="text-4xl">📞</span><div><h2 className="text-2xl font-bold">{t('settingsPage.support.title')}</h2><p className="text-green-50 text-sm mt-1">{t('settingsPage.support.description')}</p></div></div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="text-center space-y-4">
                  <div className="inline-block p-6 bg-green-50 dark:bg-green-900/20 rounded-full">
                    <span className="text-6xl">💬</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('settingsPage.support.needHelp')}</h3>
                  <p className="text-gray-600 dark:text-gray-300">{t('settingsPage.support.contactText')}</p>
                  <div className="flex items-center justify-center gap-2 text-lg font-semibold text-green-700 dark:text-green-300">
                    <span>📱</span>
                    <span dir="ltr">01028518754</span>
                  </div>
                  <a href="https://wa.me/201028518754" target="_blank" rel="noopener noreferrer" className="inline-block px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-all hover:scale-105 shadow-lg">
                    <span className="text-xl mr-2">💬</span>
                    {t('settingsPage.support.whatsappButton')}
                  </a>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

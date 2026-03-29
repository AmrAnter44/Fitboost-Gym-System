'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '../../contexts/LanguageContext'
import { useDarkMode } from '../../contexts/DarkModeContext'
import { useServiceSettings } from '../../contexts/ServiceSettingsContext'

// ==================== System Update Section ====================
function SystemUpdateSection() {
  const { t } = useLanguage()
  const [currentVersion, setCurrentVersion] = useState('...')
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error'>('idle')
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [isElectronApp, setIsElectronApp] = useState(false)

  useEffect(() => {
    const electron = (window as any).electron
    if (electron?.isElectron) {
      setIsElectronApp(true)

      if (electron.getAppVersion) {
        electron.getAppVersion().then((v: string) => setCurrentVersion(v)).catch(() => setCurrentVersion('unknown'))
      }

      electron.onUpdateAvailable?.((info: any) => {
        setUpdateInfo(info)
        setUpdateStatus('available')
      })

      electron.onUpdateNotAvailable?.(() => {
        setUpdateStatus('up-to-date')
      })

      electron.onDownloadProgress?.((progress: any) => {
        setDownloadProgress(Math.round(progress.percent))
        setUpdateStatus('downloading')
      })

      electron.onUpdateDownloaded?.((info: any) => {
        setUpdateInfo(info)
        setUpdateStatus('downloaded')
      })

      electron.onUpdateError?.((err: any) => {
        setErrorMessage(err.message || t('settingsPage.updates.checkFailed'))
        setUpdateStatus('error')
      })

      return () => {
        electron.offUpdateListeners?.()
      }
    } else {
      setCurrentVersion(process.env.NEXT_PUBLIC_APP_VERSION || 'unknown')
    }
  }, [])

  const handleCheckForUpdates = async () => {
    const electron = (window as any).electron
    if (!electron?.isElectron) return
    setUpdateStatus('checking')
    setErrorMessage('')
    try {
      const result = await electron.checkForUpdates?.()
      if (result?.error) {
        setErrorMessage(result.error)
        setUpdateStatus('error')
      }
    } catch (err: any) {
      setErrorMessage(err.message || t('settingsPage.updates.checkFailed'))
      setUpdateStatus('error')
    }
  }

  const handleDownload = async () => {
    const electron = (window as any).electron
    if (!electron?.isElectron) return
    setUpdateStatus('downloading')
    setDownloadProgress(0)
    try {
      const result = await electron.downloadUpdate?.()
      if (result?.error) {
        setErrorMessage(result.error)
        setUpdateStatus('error')
      }
    } catch (err: any) {
      setErrorMessage(err.message || t('settingsPage.updates.downloadFailed'))
      setUpdateStatus('error')
    }
  }

  const handleInstall = async () => {
    const electron = (window as any).electron
    if (!electron?.isElectron) return
    try {
      await electron.installUpdate?.()
    } catch (err: any) {
      setErrorMessage(err.message || t('settingsPage.updates.installFailed'))
      setUpdateStatus('error')
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
      {/* Current Version */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <div className="flex items-center gap-3">
          <span className="text-3xl">📦</span>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('settingsPage.updates.currentVersion')}</p>
            <p className="text-xl font-bold text-gray-800 dark:text-gray-100 font-mono">v{currentVersion}</p>
          </div>
        </div>

        {updateStatus === 'up-to-date' && (
          <span className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-bold flex items-center gap-1">
            ✅ {t('settingsPage.updates.upToDate')}
          </span>
        )}
        {updateStatus === 'available' && (
          <span className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm font-bold flex items-center gap-1">
            🆕 {t('settingsPage.updates.updateAvailable')}
          </span>
        )}
        {updateStatus === 'downloaded' && (
          <span className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-sm font-bold flex items-center gap-1">
            ✅ {t('settingsPage.updates.readyToInstall')}
          </span>
        )}
      </div>

      {/* Error */}
      {updateStatus === 'error' && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
          <span>❌</span>
          {errorMessage}
        </div>
      )}

      {/* Update Available Info */}
      {updateStatus === 'available' && updateInfo && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="font-bold text-gray-800 dark:text-gray-100">{t('settingsPage.updates.newUpdateAvailable')}</p>
              {updateInfo.version && (
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('settingsPage.updates.version')}: <span className="font-mono font-bold">v{updateInfo.version}</span></p>
              )}
            </div>
          </div>
          {updateInfo.releaseNotes && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 max-h-24 overflow-y-auto text-xs text-gray-600 dark:text-gray-400 border border-blue-100 dark:border-gray-600">
              {updateInfo.releaseNotes.split('\n').slice(0, 5).map((line: string, i: number) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          )}
          <button
            onClick={handleDownload}
            className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold rounded-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
          >
            <span>📥</span>
            {t('settingsPage.updates.downloadUpdate')}
          </button>
        </div>
      )}

      {/* Download Progress */}
      {updateStatus === 'downloading' && (
        <div className="p-4 bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-200 dark:border-primary-700 rounded-lg space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-spin">⏳</span>
            <p className="font-bold text-gray-800 dark:text-gray-100">{t('settingsPage.updates.downloading')}</p>
          </div>
          <div className="bg-gray-200 dark:bg-gray-600 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-primary-500 to-primary-600 h-full transition-all duration-300 rounded-full"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
          <p className="text-center text-sm font-bold text-gray-600 dark:text-gray-400">{downloadProgress}%</p>
        </div>
      )}

      {/* Downloaded - Ready to Install */}
      {updateStatus === 'downloaded' && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700 rounded-lg space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-bold text-gray-800 dark:text-gray-100">{t('settingsPage.updates.downloadComplete')}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('settingsPage.updates.downloadCompleteDesc')}</p>
            </div>
          </div>
          <button
            onClick={handleInstall}
            className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
          >
            <span>🔄</span>
            {t('settingsPage.updates.restartAndInstall')}
          </button>
        </div>
      )}

      {/* Checking Spinner */}
      {updateStatus === 'checking' && (
        <div className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-lg flex items-center justify-center gap-2">
          <span className="animate-spin">⏳</span>
          {t('settingsPage.updates.checking')}
        </div>
      )}

      {/* Check Button */}
      {isElectronApp ? (
        (updateStatus === 'idle' || updateStatus === 'up-to-date' || updateStatus === 'error') && (
          <button
            onClick={handleCheckForUpdates}
            className="w-full px-4 py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 hover:scale-[1.02]"
          >
            <span>🔍</span>
            {t('settingsPage.updates.checkForUpdates')}
          </button>
        )
      ) : (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg text-yellow-700 dark:text-yellow-400 text-sm flex items-center gap-2">
          <span>ℹ️</span>
          {t('settingsPage.updates.electronOnly')}
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const { locale, setLanguage, t, direction } = useLanguage()
  const { isDarkMode, toggleDarkMode } = useDarkMode()
  const { refetch: refetchServiceSettings } = useServiceSettings()
  const [user, setUser] = useState<any>(null)
  const [activeSection, setActiveSection] = useState('display')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isAwardingBirthday, setIsAwardingBirthday] = useState(false)
  const [birthdayResult, setBirthdayResult] = useState<any>(null)
  const [gymName, setGymName] = useState('')
  const [gymLogo, setGymLogo] = useState<string | null>(null)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [primaryColor, setPrimaryColor] = useState<string | null>(null)
  const [customColorInput, setCustomColorInput] = useState('')
  const [isSavingColor, setIsSavingColor] = useState(false)

  const [serviceSettings, setServiceSettings] = useState({
    nutritionEnabled: true,
    physiotherapyEnabled: true,
    groupClassEnabled: true,
    spaEnabled: true,
    inBodyEnabled: true,
    poolEnabled: true,
    padelEnabled: true,
    assessmentEnabled: true,
    gymName: '',
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

  const [nextReceiptNumber, setNextReceiptNumber] = useState(1)
  const [nextMemberNumber, setNextMemberNumber] = useState(1)
  const [editingReceiptNumber, setEditingReceiptNumber] = useState(false)
  const [editingMemberNumber, setEditingMemberNumber] = useState(false)
  const [tempReceiptNumber, setTempReceiptNumber] = useState(1)
  const [tempMemberNumber, setTempMemberNumber] = useState(1)
  const [savingReceiptNumber, setSavingReceiptNumber] = useState(false)
  const [savingMemberNumber, setSavingMemberNumber] = useState(false)

  // Database states
  const [dbUploading, setDbUploading] = useState(false)
  const [dbUploadResult, setDbUploadResult] = useState<{ success?: string; error?: string } | null>(null)

  // Database Sync state (all-in-one)
  const [syncingDatabase, setSyncingDatabase] = useState(false)
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string; steps?: any[] } | null>(null)

  // Save notification state
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Port Forwarding states
  const [localIP, setLocalIP] = useState<string>('')
  const [localURL, setLocalURL] = useState<string>('')
  const [isLoadingIP, setIsLoadingIP] = useState(false)

  // License states
  const [gyms, setGyms] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [selectedGymId, setSelectedGymId] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [currentLicense, setCurrentLicense] = useState<any>(null)
  const [loadingGyms, setLoadingGyms] = useState(false)
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [savingLicense, setSavingLicense] = useState(false)

  useEffect(() => {
    checkAuth()
    fetchServiceSettings()
    fetchNumbers()
    fetchLocalIP()
  }, [])

  // Fetch license data when user is loaded and is OWNER
  useEffect(() => {
    if (user?.role === 'OWNER') {
      fetchCurrentLicense()
      fetchGyms()
    }
  }, [user])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        // السماح لجميع المستخدمين بالوصول لصفحة الإعدادات
        // (navigationItems تتحكم في الأقسام المتاحة لكل مستخدم)
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
        if (data.gymName) setGymName(data.gymName)
        if (data.gymLogo) setGymLogo(data.gymLogo)
        if (data.primaryColor) setPrimaryColor(data.primaryColor)
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

  const saveReceiptNumber = async () => {
    if (tempReceiptNumber < 1) return
    setSavingReceiptNumber(true)
    try {
      const res = await fetch('/api/receipts/next-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startNumber: tempReceiptNumber })
      })
      if (res.ok) {
        setNextReceiptNumber(tempReceiptNumber)
        setEditingReceiptNumber(false)
        setSaveMessage({ type: 'success', text: 'تم تحديث رقم الإيصال القادم' })
      } else {
        const data = await res.json()
        setSaveMessage({ type: 'error', text: data.error || 'فشل تحديث الرقم' })
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'حدث خطأ' })
    } finally {
      setSavingReceiptNumber(false)
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }

  const saveMemberNumber = async () => {
    if (tempMemberNumber < 1) return
    setSavingMemberNumber(true)
    try {
      const res = await fetch('/api/members/next-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startNumber: tempMemberNumber })
      })
      if (res.ok) {
        setNextMemberNumber(tempMemberNumber)
        setEditingMemberNumber(false)
        setSaveMessage({ type: 'success', text: 'تم تحديث رقم العضوية القادم' })
      } else {
        const data = await res.json()
        setSaveMessage({ type: 'error', text: data.error || 'فشل تحديث الرقم' })
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'حدث خطأ' })
    } finally {
      setSavingMemberNumber(false)
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }

  const saveServiceSettings = async () => {
    setIsSaving(true)
    setSaveMessage(null)
    try {
      // Exclude gymLogo and primaryColor — they are managed by their own dedicated APIs
      // Including them here could accidentally overwrite them to null
      const { gymLogo: _gl, primaryColor: _pc, id: _id, createdAt: _ca, updatedAt: _ua, updatedBy: _ub, ...settingsToSave } = serviceSettings as any
      const response = await fetch('/api/settings/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsToSave)
      })
      if (response.ok) {
        localStorage.removeItem('serviceSettingsCache')
        refetchServiceSettings()
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('logo', file)
      const res = await fetch('/api/settings/gym-logo', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok && data.logoUrl) {
        setGymLogo(data.logoUrl)
        localStorage.setItem('gymLogo', data.logoUrl)
        localStorage.removeItem('serviceSettingsCache')
        refetchServiceSettings()
      } else {
        alert(data.error || t('settingsPage.display.logoUploadFailed'))
      }
    } catch {
      alert(t('settingsPage.display.logoUploadFailed'))
    } finally {
      setIsUploadingLogo(false)
      e.target.value = ''
    }
  }

  const handleLogoRemove = async () => {
    if (!confirm(t('settingsPage.display.confirmRemoveLogo'))) return
    setIsUploadingLogo(true)
    try {
      const res = await fetch('/api/settings/gym-logo', { method: 'DELETE' })
      if (res.ok) {
        setGymLogo(null)
        localStorage.removeItem('gymLogo')
        localStorage.removeItem('serviceSettingsCache')
        refetchServiceSettings()
      }
    } catch {
      alert(t('settingsPage.display.logoRemoveFailed'))
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const handleColorChange = async (color: string | null) => {
    setIsSavingColor(true)
    try {
      // Preview مباشر
      if (color) {
        const { applyPaletteToDOM } = await import('../../lib/theme/generatePalette')
        applyPaletteToDOM(color)
      } else {
        // Reset to defaults
        const root = document.documentElement
        const shades = ['50','100','200','300','400','500','600','700','800','900','950']
        shades.forEach(s => {
          root.style.removeProperty(`--color-primary-${s}`)
          root.style.removeProperty(`--color-primary-${s}-rgb`)
        })
      }

      const res = await fetch('/api/settings/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryColor: color })
      })
      if (res.ok) {
        setPrimaryColor(color)
        localStorage.removeItem('serviceSettingsCache')
        if (color) {
          localStorage.setItem('primaryColor', color)
        } else {
          localStorage.removeItem('primaryColor')
        }
        refetchServiceSettings()
      }
    } catch {
      alert(t('settingsPage.display.colorSaveFailed'))
    } finally {
      setIsSavingColor(false)
    }
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

  const handleSyncDatabase = async () => {
    if (!confirm('⚠️ هل تريد تحديث قاعدة البيانات؟\n\nسيتم:\n• إصلاح الصلاحيات\n• مزامنة Schema\n• تطبيق Migrations\n• تحديث Prisma Client')) {
      return
    }

    setSyncingDatabase(true)
    setSyncMessage(null)

    try {
      const response = await fetch('/api/database/sync', {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        const stepsText = data.steps
          ? '\n\n' + data.steps.map((s: any) => `${s.status === 'success' ? '✅' : s.status === 'error' ? '❌' : '⏭️'} ${s.message}`).join('\n')
          : ''

        setSyncMessage({
          type: 'success',
          text: `${data.message}${stepsText}`,
          steps: data.steps
        })
        setTimeout(() => setSyncMessage(null), 20000)
      } else {
        const stepsText = data.steps
          ? '\n\n' + data.steps.map((s: any) => `${s.status === 'success' ? '✅' : s.status === 'error' ? '❌' : '⏭️'} ${s.message}`).join('\n')
          : ''

        setSyncMessage({
          type: 'error',
          text: `${data.error || 'فشل التحديث'}${stepsText}`,
          steps: data.steps
        })
      }
    } catch (error) {
      setSyncMessage({
        type: 'error',
        text: 'حدث خطأ أثناء تحديث قاعدة البيانات'
      })
    } finally {
      setSyncingDatabase(false)
    }
  }

  const fetchLocalIP = async () => {
    setIsLoadingIP(true)
    try {
      const response = await fetch('/api/network/local-ip')
      if (response.ok) {
        const data = await response.json()
        setLocalIP(data.ip)
        setLocalURL(data.url)
      }
    } catch (error) {
      console.error('Error fetching local IP:', error)
    } finally {
      setIsLoadingIP(false)
    }
  }

  // License functions
  const fetchCurrentLicense = async () => {
    try {
      const response = await fetch('/api/license/current')
      if (response.ok) {
        const data = await response.json()
        if (data.license) {
          setCurrentLicense(data.license)
          setSelectedGymId(data.license.gymId)
          setSelectedBranchId(data.license.branchId)
          // ✅ جلب الفروع للـ gym المحفوظ لعرض الـ branch الصحيح
          if (data.license.gymId) {
            fetchBranches(data.license.gymId)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching current license:', error)
    }
  }

  const fetchGyms = async () => {
    setLoadingGyms(true)
    try {
      const response = await fetch('/api/license/gyms')

      if (response.ok) {
        const data = await response.json()
        setGyms(data.gyms || [])
        if (!data.gyms || data.gyms.length === 0) {
          setSaveMessage({ type: 'error', text: '⚠️ لا توجد صالات متاحة في قاعدة البيانات' })
        }
      } else {
        const errorData = await response.json()
        console.error('❌ Fetch gyms error - Status:', response.status)
        console.error('❌ Error data:', errorData)
        setSaveMessage({ type: 'error', text: errorData.error || 'فشل جلب الصالات' })
      }
    } catch (error) {
      console.error('❌ Exception fetching gyms:', error)
      setSaveMessage({ type: 'error', text: 'خطأ في الاتصال - تحقق من الإنترنت أو إعدادات Supabase' })
    } finally {
      setLoadingGyms(false)
    }
  }

  const fetchBranches = async (gymId: string) => {
    if (!gymId) {
      setBranches([])
      return
    }
    setLoadingBranches(true)
    try {
      const response = await fetch(`/api/license/branches?gymId=${gymId}`)
      if (response.ok) {
        const data = await response.json()
        setBranches(data.branches || [])
      }
    } catch (error) {
      console.error('Error fetching branches:', error)
    } finally {
      setLoadingBranches(false)
    }
  }

  const handleGymChange = (gymId: string) => {
    setSelectedGymId(gymId)
    setSelectedBranchId('')
    setBranches([])
    if (gymId) {
      fetchBranches(gymId)
    }
  }

  const saveLicenseSelection = async () => {
    if (!selectedGymId || !selectedBranchId) {
      setSaveMessage({ type: 'error', text: 'يرجى اختيار الصالة والفرع' })
      return
    }

    setSavingLicense(true)
    try {
      const selectedGym = gyms.find(g => g.id === selectedGymId)
      const selectedBranch = branches.find(b => b.id === selectedBranchId)

      const response = await fetch('/api/license/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gymId: selectedGymId,
          gymName: selectedGym?.name_ar || selectedGym?.name_en,
          branchId: selectedBranchId,
          branchName: selectedBranch?.name_ar || selectedBranch?.name_en,
          systemLicense: selectedBranch?.system_license
        })
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentLicense(data.license)
        setSaveMessage({ type: 'success', text: '✅ تم حفظ اختيار الصالة والفرع بنجاح' })
        setTimeout(() => setSaveMessage(null), 3000)
      } else {
        setSaveMessage({ type: 'error', text: 'فشل حفظ الاختيار' })
      }
    } catch (error) {
      console.error('Error saving license:', error)
      setSaveMessage({ type: 'error', text: 'حدث خطأ أثناء الحفظ' })
    } finally {
      setSavingLicense(false)
    }
  }

  // تحديد من يمتلك صلاحيات الإعدادات الإدارية
  const hasAdminAccess = user?.role === 'ADMIN' || user?.role === 'OWNER' || user?.permissions?.canAccessSettings === true

  const navigationItems = [
    ...(user?.role === 'ADMIN' || user?.role === 'OWNER' ? [{ id: 'quick-links', label: t('settingsPage.navigation.quickLinks'), icon: '⚡' }] : []),
    ...(hasAdminAccess ? [
      { id: 'services', label: t('settingsPage.navigation.services'), icon: '🏋️' },
      { id: 'points', label: t('settingsPage.navigation.points'), icon: '🎯' },
      { id: 'referral', label: t('settingsPage.navigation.referral'), icon: '🎁' },
      { id: 'free-sessions', label: t('settingsPage.navigation.freeSessions'), icon: '🎫' },
      { id: 'receipts', label: t('settingsPage.navigation.receipts'), icon: '📋' },
      { id: 'port-forwarding', label: t('settingsPage.navigation.portForwarding'), icon: '🌐' }
    ] : []),
    ...(user?.role !== 'COACH' ? [{ id: 'whatsapp', label: t('settingsPage.navigation.whatsapp'), icon: '📱' }] : []),
    { id: 'display', label: t('settingsPage.navigation.display'), icon: '🎨' },
    ...(user?.role === 'OWNER' ? [
      { id: 'license', label: 'رخصة النظام', icon: '🔑' },
      { id: 'database', label: t('settingsPage.navigation.database'), icon: '💾' }
    ] : []),
    ...(typeof window !== 'undefined' && (window as any).electron?.isElectron ? [{ id: 'updates', label: t('settingsPage.navigation.updates'), icon: '🔄' }] : []),
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
            ltr:left-0 rtl:right-0
            z-50 lg:z-30
            h-[calc(100vh-73px)]
            w-72 sm:w-80 lg:w-64
            bg-white dark:bg-gray-800
            ltr:border-r rtl:border-l border-gray-200 dark:border-gray-700
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
                  ltr:text-left rtl:text-right
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
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">{t('settingsPage.receipts.nextReceiptNumber')}</h4>
                      {editingReceiptNumber ? (
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="number"
                            min={1}
                            value={tempReceiptNumber}
                            onChange={(e) => setTempReceiptNumber(parseInt(e.target.value) || 1)}
                            className="w-32 px-3 py-2 border-2 border-orange-400 dark:border-orange-600 dark:bg-gray-700 dark:text-white rounded-lg font-bold text-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                            autoFocus
                          />
                          <button
                            onClick={saveReceiptNumber}
                            disabled={savingReceiptNumber}
                            className="px-3 py-2 bg-orange-600 text-white rounded-lg font-bold text-sm hover:bg-orange-700 disabled:opacity-50"
                          >
                            {savingReceiptNumber ? '...' : '✅'}
                          </button>
                          <button
                            onClick={() => setEditingReceiptNumber(false)}
                            className="px-3 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-bold text-sm hover:bg-gray-300"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{nextReceiptNumber}</p>
                          <button
                            onClick={() => { setTempReceiptNumber(nextReceiptNumber); setEditingReceiptNumber(true) }}
                            className="px-2 py-1 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 rounded-lg text-sm"
                          >
                            ✏️
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="text-4xl">🧾</span>
                  </div>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">{t('settingsPage.receipts.nextMemberNumber')}</h4>
                      {editingMemberNumber ? (
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="number"
                            min={1}
                            value={tempMemberNumber}
                            onChange={(e) => setTempMemberNumber(parseInt(e.target.value) || 1)}
                            className="w-32 px-3 py-2 border-2 border-blue-400 dark:border-blue-600 dark:bg-gray-700 dark:text-white rounded-lg font-bold text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                          />
                          <button
                            onClick={saveMemberNumber}
                            disabled={savingMemberNumber}
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 disabled:opacity-50"
                          >
                            {savingMemberNumber ? '...' : '✅'}
                          </button>
                          <button
                            onClick={() => setEditingMemberNumber(false)}
                            className="px-3 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-bold text-sm hover:bg-gray-300"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{nextMemberNumber}</p>
                          <button
                            onClick={() => { setTempMemberNumber(nextMemberNumber); setEditingMemberNumber(true) }}
                            className="px-2 py-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg text-sm"
                          >
                            ✏️
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="text-4xl">👤</span>
                  </div>
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

              {/* لوجو واسم الجيم - OWNER فقط */}
              {user?.role === 'OWNER' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <span className="text-2xl">🏷️</span>
                    {locale === 'ar' ? 'لوجو واسم الجيم' : 'Gym Logo & Name'}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{locale === 'ar' ? 'ارفع لوجو الجيم واكتب اسمه (يظهر في الإيصالات والسايدبار)' : 'Upload gym logo and set its name (shown on receipts & sidebar)'}</p>

                  {/* اسم الجيم */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {locale === 'ar' ? '📝 اسم الجيم' : '📝 Gym Name'}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={serviceSettings.gymName || ''}
                        onChange={(e) => updateSetting('gymName', e.target.value)}
                        placeholder={locale === 'ar' ? 'مثال: FitBoost Gym' : 'e.g. FitBoost Gym'}
                        className="flex-1 px-4 py-2.5 border-2 border-violet-200 dark:border-violet-700 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:border-violet-500 text-lg font-semibold"
                      />
                      <button
                        onClick={saveServiceSettings}
                        disabled={isSaving}
                        className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-all"
                      >
                        {isSaving ? '⏳' : '💾'} {locale === 'ar' ? 'حفظ' : 'Save'}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden bg-white dark:bg-gray-800 shrink-0">
                      <img
                        src={gymLogo || '/assets/icon.png'}
                        alt="Gym Logo"
                        className="w-full h-full object-contain p-1"
                      />
                    </div>
                    <div className="flex flex-col gap-2 flex-1">
                      <label className={`cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${isUploadingLogo ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-700 text-white'}`}>
                        {isUploadingLogo ? (
                          <span className="animate-spin">⏳</span>
                        ) : (
                          <span>📤</span>
                        )}
                        {t('settingsPage.display.uploadLogo')}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleLogoUpload}
                          disabled={isUploadingLogo}
                          className="hidden"
                        />
                      </label>
                      {gymLogo && (
                        <button
                          onClick={handleLogoRemove}
                          disabled={isUploadingLogo}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                        >
                          <span>🗑️</span>
                          {t('settingsPage.display.removeLogo')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* اللون الأساسي - OWNER فقط */}
              {user?.role === 'OWNER' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <span className="text-2xl">🎨</span>
                    {t('settingsPage.display.primaryColor')}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{t('settingsPage.display.primaryColorDesc')}</p>

                  {/* ألوان جاهزة */}
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 mb-4">
                    {[
                      { hex: '#fbe003', label: 'أصفر' },
                      { hex: '#ef4444', label: 'أحمر' },
                      { hex: '#3b82f6', label: 'أزرق' },
                      { hex: '#10b981', label: 'أخضر' },
                      { hex: '#f97316', label: 'برتقالي' },
                      { hex: '#8b5cf6', label: 'بنفسجي' },
                      { hex: '#14b8a6', label: 'تركواز' },
                      { hex: '#ec4899', label: 'وردي' },
                    ].map(c => (
                      <button
                        key={c.hex}
                        onClick={() => handleColorChange(c.hex)}
                        disabled={isSavingColor}
                        className={`w-full aspect-square rounded-xl border-3 transition-all hover:scale-110 active:scale-95 ${
                          primaryColor === c.hex || (!primaryColor && c.hex === '#fbe003')
                            ? 'border-gray-800 dark:border-white shadow-lg scale-110 ring-2 ring-offset-2 ring-gray-400'
                            : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.label}
                      />
                    ))}
                  </div>

                  {/* لون مخصص */}
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <input
                      type="color"
                      value={primaryColor || '#fbe003'}
                      onChange={(e) => {
                        setCustomColorInput(e.target.value)
                        handleColorChange(e.target.value)
                      }}
                      className="w-10 h-10 rounded-lg border-2 border-gray-300 dark:border-gray-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      placeholder="#fbe003"
                      value={customColorInput || primaryColor || ''}
                      onChange={(e) => setCustomColorInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && /^#[0-9a-fA-F]{6}$/.test(customColorInput)) {
                          handleColorChange(customColorInput)
                        }
                      }}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono text-gray-800 dark:text-gray-200"
                      dir="ltr"
                    />
                    {primaryColor && primaryColor !== '#fbe003' && (
                      <button
                        onClick={() => { handleColorChange('#fbe003'); setCustomColorInput('') }}
                        disabled={isSavingColor}
                        className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-all"
                      >
                        {t('settingsPage.display.resetColor')}
                      </button>
                    )}
                  </div>
                </div>
              )}

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

          {/* License Section */}
          {activeSection === 'license' && user?.role === 'OWNER' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">🔑</span>
                  <div>
                    <h2 className="text-2xl font-bold">رخصة النظام</h2>
                    <p className="text-purple-50 text-sm mt-1">اختر الصالة والفرع التابع لها هذا النظام</p>
                  </div>
                </div>
              </div>

              {/* Current License Info */}
              {currentLicense && (
                <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-2xl">✅</span>
                    <h3 className="text-lg font-bold text-green-800 dark:text-green-300">النظام مفعّل حالياً</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">الصالة:</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{currentLicense.gymName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">الفرع:</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{currentLicense.branchName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">حالة الترخيص:</span>
                      <span className={`font-bold ${currentLicense.systemLicense === 'true' || currentLicense.systemLicense === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                        {currentLicense.systemLicense === 'true' || currentLicense.systemLicense === 'active' ? 'نشط ✓' : 'منتهي ✗'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* License Selection Form */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <span className="text-2xl">🏢</span>
                  اختيار الصالة والفرع
                </h3>

                {/* Debug Info */}
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      🔍 معلومات التشخيص
                    </span>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/license/test')
                          const data = await res.json()
                          alert(`Test Result:\nGyms: ${data.gyms?.count || 0}\nBranches: ${data.branches?.count || 0}\nCheck console for details`)
                        } catch (err) {
                          console.error('Test failed:', err)
                          alert('Test failed - check console')
                        }
                      }}
                      className="text-xs px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded"
                    >
                      اختبار الاتصال
                    </button>
                  </div>
                  <div className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
                    <div>عدد الصالات المحملة: <span className="font-bold">{gyms.length}</span></div>
                    <div>حالة التحميل: <span className="font-bold">{loadingGyms ? 'جاري التحميل...' : 'مكتمل'}</span></div>
                    <div>دور المستخدم: <span className="font-bold">{user?.role || 'غير محدد'}</span></div>
                  </div>
                </div>

                {/* Gym Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    الصالة الرياضية *
                  </label>
                  <select
                    value={selectedGymId}
                    onChange={(e) => handleGymChange(e.target.value)}
                    disabled={loadingGyms}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-primary-500 disabled:opacity-50"
                  >
                    <option value="">-- اختر الصالة --</option>
                    {gyms.map(gym => (
                      <option key={gym.id} value={gym.id}>
                        {gym.name_ar || gym.name_en}
                      </option>
                    ))}
                  </select>
                  {loadingGyms && <p className="text-xs text-gray-500 mt-1">جاري التحميل...</p>}
                  {!loadingGyms && gyms.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">⚠️ لم يتم تحميل أي صالات - تحقق من الكونسول</p>
                  )}
                </div>

                {/* Branch Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    الفرع *
                  </label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    disabled={!selectedGymId || loadingBranches}
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-primary-500 disabled:opacity-50"
                  >
                    <option value="">-- اختر الفرع --</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name_ar || branch.name_en}
                        {branch.system_license === true || branch.system_license === 'true' ? ' ✓' : ' (منتهي)'}
                      </option>
                    ))}
                  </select>
                  {loadingBranches && <p className="text-xs text-gray-500 mt-1">جاري تحميل الفروع...</p>}
                </div>

                {/* Save Button */}
                <div className="pt-4">
                  <button
                    onClick={saveLicenseSelection}
                    disabled={!selectedGymId || !selectedBranchId || savingLicense}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {savingLicense ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        <span>جاري الحفظ...</span>
                      </>
                    ) : (
                      <>
                        <span>💾</span>
                        <span>حفظ الاختيار</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Info Note */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg">
                  <div className="flex items-start gap-2">
                    <span className="text-xl">ℹ️</span>
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      <p className="font-bold mb-1">ملاحظة:</p>
                      <p>• يجب اختيار الصالة والفرع الصحيح لتفعيل الرخصة</p>
                      <p>• سيتم التحقق من حالة الترخيص تلقائياً كل 8 ساعات</p>
                      <p>• في حالة انقطاع الإنترنت، سيعمل النظام بالترخيص المحفوظ</p>
                    </div>
                  </div>
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

              {/* مزامنة قاعدة البيانات - All-in-One */}
              {syncMessage && (
                <div className={`p-4 rounded-xl border-2 ${syncMessage.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{syncMessage.type === 'success' ? '✅' : '❌'}</span>
                    <div className="flex-1">
                      <p className={`text-sm whitespace-pre-line ${syncMessage.type === 'success' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>{syncMessage.text}</p>
                    </div>
                    <button onClick={() => setSyncMessage(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">✕</button>
                  </div>
                </div>
              )}

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <span className="text-2xl">🔄</span>
                  مزامنة قاعدة البيانات (الكل في واحد)
                </h3>

                <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-2 border-purple-200 dark:border-purple-700 rounded-lg">
                  <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <span>✨</span>
                    ماذا يفعل هذا الزر؟
                  </h4>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                    زر واحد يقوم بجميع عمليات التحديث بشكل تلقائي:
                  </p>
                  <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2 mr-4">
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 font-bold">1️⃣</span>
                      <span><strong>إصلاح الصلاحيات:</strong> يتحقق من صلاحيات قاعدة البيانات ويصلحها تلقائياً</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 font-bold">2️⃣</span>
                      <span><strong>مزامنة Schema:</strong> يطبق التغييرات من schema.prisma على قاعدة البيانات</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 dark:text-purple-400 font-bold">3️⃣</span>
                      <span><strong>تطبيق Migrations:</strong> يشغل جميع التحديثات الجديدة من مجلد migrations/</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-600 dark:text-orange-400 font-bold">4️⃣</span>
                      <span><strong>تحديث Prisma Client:</strong> يولد Prisma Client الجديد للتعامل مع قاعدة البيانات</span>
                    </li>
                  </ul>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg">
                  <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <span>📅</span>
                    متى تستخدم هذا الزر؟
                  </h4>
                  <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 mr-4">
                    <li>• بعد تحديث النظام لإصدار جديد</li>
                    <li>• إذا ظهرت رسالة خطأ: &quot;attempt to write a readonly database&quot;</li>
                    <li>• إذا ظهرت رسالة خطأ عن جدول أو عمود مفقود</li>
                    <li>• لتفعيل مزايا جديدة تحتاج تحديثات في قاعدة البيانات</li>
                    <li>• عند مواجهة أي مشكلة في قاعدة البيانات</li>
                  </ul>
                </div>

                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-700 rounded-lg">
                  <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
                    <span>⚠️</span>
                    قبل الضغط على الزر:
                  </h4>
                  <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 mr-4">
                    <li>• أغلق Prisma Studio إذا كان مفتوحاً</li>
                    <li>• أغلق أي برامج أخرى تستخدم قاعدة البيانات</li>
                    <li>• في Mac: قد تحتاج منح Full Disk Access للتطبيق في إعدادات النظام</li>
                  </ul>
                </div>

                <button
                  onClick={handleSyncDatabase}
                  disabled={syncingDatabase}
                  className={`w-full px-6 py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:via-indigo-700 hover:to-blue-700 text-white font-bold rounded-lg transition-all shadow-lg flex items-center justify-center gap-3 ${syncingDatabase ? 'opacity-70 cursor-not-allowed' : 'hover:scale-105'}`}
                >
                  {syncingDatabase ? (
                    <>
                      <span className="animate-spin text-xl">⏳</span>
                      <span>جاري المزامنة... (قد يستغرق دقيقة)</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xl">🚀</span>
                      <span>مزامنة وتحديث قاعدة البيانات (الكل في واحد)</span>
                    </>
                  )}
                </button>

                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    💡 <strong>آمن تماماً:</strong> هذا الزر يقوم بجميع العمليات بالترتيب الصحيح ولن يؤثر على بياناتك الموجودة. إذا فشلت أي خطوة، سيتوقف تلقائياً ويعرض رسالة الخطأ. يُنصح بتطبيق التحديثات بعد كل تحديث للنظام.
                  </p>
                </div>
              </div>

            </div>
          )}

          {activeSection === 'whatsapp' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">📱</span>
                  <div>
                    <h2 className="text-2xl font-bold">{t('settingsPage.whatsapp.title')}</h2>
                    <p className="text-green-50 text-sm mt-1">{t('settingsPage.whatsapp.description')}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
                <div className="text-center space-y-6">
                  <div className="inline-block p-6 bg-green-50 dark:bg-green-900/20 rounded-full">
                    <span className="text-7xl">📲</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                    {t('settingsPage.whatsapp.autoSendTitle')}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                    {t('settingsPage.whatsapp.autoSendDescription')}
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
                    <Link
                      href="/settings/whatsapp"
                      className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-all hover:scale-105 shadow-lg"
                    >
                      <span className="text-2xl">⚙️</span>
                      <span>{t('settingsPage.whatsapp.manageButton')}</span>
                    </Link>
                  </div>

                  <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg text-right">
                    <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
                      <span>✨</span>
                      <span>{t('settingsPage.whatsapp.availableFeatures')}</span>
                    </h4>
                    <ul className="space-y-2 text-blue-700 dark:text-blue-300 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-green-500">✓</span>
                        <span>{t('settingsPage.whatsapp.featureAutoReceipts')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500">✓</span>
                        <span>{t('settingsPage.whatsapp.featureSubReminders')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500">✓</span>
                        <span>{t('settingsPage.whatsapp.featureSessionNotifications')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500">✓</span>
                        <span>{t('settingsPage.whatsapp.featureWelcomeMessages')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-500">✓</span>
                        <span>{t('settingsPage.whatsapp.featureAutoFollowUp')}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'port-forwarding' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">🌐</span>
                  <div>
                    <h2 className="text-2xl font-bold">{t('settingsPage.portForwarding.title')}</h2>
                    <p className="text-blue-50 text-sm mt-1">{t('settingsPage.portForwarding.description')}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
                <div className="space-y-8">
                  {/* Local Network Access */}
                  <div className="text-center space-y-6">
                    <div className="inline-block p-6 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                      <span className="text-7xl">📱</span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                      {t('settingsPage.portForwarding.localAccess')}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                      {t('settingsPage.portForwarding.localAccessDesc')}
                    </p>

                    {/* QR Code & URL */}
                    {isLoadingIP ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin text-6xl">⏳</div>
                      </div>
                    ) : localURL ? (
                      <div className="flex flex-col items-center gap-6">
                        {/* QR Code */}
                        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border-4 border-blue-200 dark:border-blue-700">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(localURL)}&color=2563eb&bgcolor=ffffff`}
                            alt="QR Code"
                            className="w-64 h-64 sm:w-80 sm:h-80"
                          />
                        </div>

                        {/* URL Display */}
                        <div className="w-full max-w-2xl">
                          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 border-2 border-gray-200 dark:border-gray-600">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                  {t('settingsPage.portForwarding.localURL')}:
                                </p>
                                <p className="text-lg font-mono font-bold text-blue-600 dark:text-blue-400 break-all" dir="ltr">
                                  {localURL}
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(localURL)
                                  setSaveMessage({ type: 'success', text: t('settingsPage.portForwarding.urlCopied') })
                                  setTimeout(() => setSaveMessage(null), 3000)
                                }}
                                className="flex-shrink-0 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all hover:scale-105"
                                title={t('settingsPage.portForwarding.copyURL')}
                              >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {localIP && (
                            <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                              <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                                <span>🔌</span>
                                <span>{t('settingsPage.portForwarding.localIP')}:</span>
                                <span className="font-mono font-bold" dir="ltr">{localIP}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Refresh Button */}
                        <button
                          onClick={fetchLocalIP}
                          className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all hover:scale-105 flex items-center gap-2"
                        >
                          <span className="text-xl">🔄</span>
                          <span>{t('settingsPage.portForwarding.refresh')}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="py-8">
                        <p className="text-gray-500 dark:text-gray-400">
                          {t('settingsPage.portForwarding.noConnection')}
                        </p>
                        <button
                          onClick={fetchLocalIP}
                          className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all hover:scale-105"
                        >
                          {t('settingsPage.portForwarding.tryAgain')}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Instructions */}
                  <div className="mt-8 p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-xl">
                    <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-4 flex items-center gap-2 text-lg">
                      <span>📖</span>
                      <span>{t('settingsPage.portForwarding.instructions.title')}</span>
                    </h4>
                    <ul className="space-y-3 text-blue-700 dark:text-blue-300 text-sm">
                      <li className="flex items-start gap-3">
                        <span className="text-green-500 text-xl flex-shrink-0">1️⃣</span>
                        <span>{t('settingsPage.portForwarding.instructions.step1')}</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-green-500 text-xl flex-shrink-0">2️⃣</span>
                        <span>{t('settingsPage.portForwarding.instructions.step2')}</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-green-500 text-xl flex-shrink-0">3️⃣</span>
                        <span>{t('settingsPage.portForwarding.instructions.step3')}</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="text-green-500 text-xl flex-shrink-0">4️⃣</span>
                        <span>{t('settingsPage.portForwarding.instructions.step4')}</span>
                      </li>
                    </ul>

                    <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                      <div className="flex items-start gap-2 text-yellow-800 dark:text-yellow-300 text-sm">
                        <span className="text-xl flex-shrink-0">⚠️</span>
                        <p>{t('settingsPage.portForwarding.instructions.warning')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'updates' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">🔄</span>
                  <div>
                    <h2 className="text-2xl font-bold">{t('settingsPage.updates.title')}</h2>
                    <p className="text-blue-50 text-sm mt-1">{t('settingsPage.updates.description')}</p>
                  </div>
                </div>
              </div>
              <SystemUpdateSection />
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

'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '../../contexts/LanguageContext'
import { useDeviceSettings } from '../../contexts/DeviceSettingsContext'
import { useDarkMode } from '../../contexts/DarkModeContext'
import LinkModal from '../../components/LinkModal'
import { Html5Qrcode } from 'html5-qrcode'
import { EXTERNAL_LINKS } from '../../lib/config'

export default function SettingsPage() {
  const router = useRouter()
  const { locale, setLanguage, t, direction } = useLanguage()
  const { selectedScanner, selectedScannerFingerprint, setSelectedScanner, autoScanEnabled, setAutoScanEnabled, strictMode, setStrictMode } = useDeviceSettings()
  const { isDarkMode, toggleDarkMode } = useDarkMode()
  const [user, setUser] = useState<any>(null)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [devices, setDevices] = useState<any[]>([])
  const [loadingDevices, setLoadingDevices] = useState(false)
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [showUpdateSuccess, setShowUpdateSuccess] = useState(false)
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isElectron, setIsElectron] = useState(false)

  // Auto-detection states
  const [isDetecting, setIsDetecting] = useState(false)
  const [detectionInput, setDetectionInput] = useState('')

  // Service Settings State
  const [serviceSettings, setServiceSettings] = useState({
    nutritionEnabled: true,
    physiotherapyEnabled: true,
    groupClassEnabled: true,
    spaEnabled: true,
    inBodyEnabled: true,
    websiteUrl: 'https://www.xgym.website',
    showWebsiteOnReceipts: true,
    pointsEnabled: false,
    pointsPerCheckIn: 0,
    pointsPerInvitation: 0,
    pointsPerEGPSpent: 0,
    pointsValueInEGP: 0
  })
  const [loadingServices, setLoadingServices] = useState(false)

  // Database Restore State
  const [dbInfo, setDbInfo] = useState<any>(null)
  const [dbUploading, setDbUploading] = useState(false)
  const [dbUploadResult, setDbUploadResult] = useState<{ success?: string; error?: string } | null>(null)
  const dbFileRef = useRef<HTMLInputElement>(null)

  // Numbers Settings State
  const [nextReceiptNumber, setNextReceiptNumber] = useState(1001)
  const [nextMemberNumber, setNextMemberNumber] = useState(1001)
  const [showReceiptNumberEdit, setShowReceiptNumberEdit] = useState(false)
  const [showMemberNumberEdit, setShowMemberNumberEdit] = useState(false)
  const [loadingNumbers, setLoadingNumbers] = useState(false)

  useEffect(() => {
    // Check if running in Electron
    if (typeof window !== 'undefined') {
      setIsElectron(!!(window as any).electron?.isElectron)
    }
    checkAuth()
    fetchServiceSettings()
    fetchNumbers()
    fetchDbInfo()
  }, [])

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
      // Fetch receipt number
      const receiptResponse = await fetch('/api/receipts/next-number')
      if (receiptResponse.ok) {
        const receiptData = await receiptResponse.json()
        setNextReceiptNumber(receiptData.nextNumber)
      }

      // Fetch member number
      const memberResponse = await fetch('/api/members/next-number')
      if (memberResponse.ok) {
        const memberData = await memberResponse.json()
        setNextMemberNumber(memberData.nextNumber)
      }
    } catch (error) {
      console.error('Error fetching numbers:', error)
    }
  }

  const fetchDbInfo = async () => {
    try {
      const res = await fetch('/api/settings/restore-db')
      if (res.ok) setDbInfo(await res.json())
    } catch {}
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
        setDbUploadResult({ success: `✅ ${data.message} — حجم الملف: ${data.fileSize} — ${data.migrate}` })
        fetchDbInfo()
      } else {
        setDbUploadResult({ error: data.error || 'حدث خطأ غير متوقع' })
      }
    } catch (err: any) {
      setDbUploadResult({ error: err.message })
    } finally {
      setDbUploading(false)
      if (dbFileRef.current) dbFileRef.current.value = ''
    }
  }

  const handleUpdateReceiptNumber = async () => {
    if (nextReceiptNumber < 1) {
      alert(locale === 'ar' ? 'رقم الإيصال غير صحيح' : 'Invalid receipt number')
      return
    }

    setLoadingNumbers(true)
    try {
      const response = await fetch('/api/receipts/next-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startNumber: nextReceiptNumber })
      })

      const data = await response.json()

      if (response.ok) {
        alert(data.message)
        setShowReceiptNumberEdit(false)
        fetchNumbers()
      } else {
        alert(data.error)
      }
    } catch (error) {
      alert(locale === 'ar' ? 'حدث خطأ في التحديث' : 'Update failed')
    } finally {
      setLoadingNumbers(false)
    }
  }

  const handleUpdateMemberNumber = async () => {
    if (nextMemberNumber < 1) {
      alert(locale === 'ar' ? 'رقم العضوية غير صحيح' : 'Invalid member number')
      return
    }

    setLoadingNumbers(true)
    try {
      const response = await fetch('/api/members/next-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startNumber: nextMemberNumber })
      })

      const data = await response.json()

      if (response.ok) {
        alert(data.message)
        setShowMemberNumberEdit(false)
        fetchNumbers()
      } else {
        alert(data.error)
      }
    } catch (error) {
      alert(locale === 'ar' ? 'حدث خطأ في التحديث' : 'Update failed')
    } finally {
      setLoadingNumbers(false)
    }
  }

  const toggleService = async (serviceName: 'nutrition' | 'physiotherapy' | 'groupClass' | 'spa' | 'inBody' | 'points') => {
    setLoadingServices(true)
    try {
      const newSettings = {
        ...serviceSettings,
        [`${serviceName}Enabled`]: !serviceSettings[`${serviceName}Enabled` as keyof typeof serviceSettings]
      }

      const response = await fetch('/api/settings/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      })

      if (response.ok) {
        setServiceSettings(newSettings)
        // toast.success(t('settings.servicesUpdatedSuccess') || 'تم تحديث الإعدادات بنجاح')
      }
    } catch (error) {
      console.error('Error updating service settings:', error)
      // toast.error(t('settings.servicesUpdateFailed') || 'فشل تحديث الإعدادات')
    } finally {
      setLoadingServices(false)
    }
  }

  const updatePointsSettings = async (setting: 'pointsPerCheckIn' | 'pointsPerInvitation' | 'pointsPerEGPSpent' | 'pointsValueInEGP', value: number) => {
    setLoadingServices(true)
    try {
      const newSettings = {
        ...serviceSettings,
        [setting]: value
      }

      const response = await fetch('/api/settings/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      })

      if (response.ok) {
        setServiceSettings(newSettings)
      }
    } catch (error) {
      console.error('Error updating points settings:', error)
    } finally {
      setLoadingServices(false)
    }
  }

  const updateWebsiteSettings = async (setting: 'websiteUrl' | 'showWebsiteOnReceipts', value: string | boolean) => {
    setLoadingServices(true)
    try {
      const newSettings = {
        ...serviceSettings,
        [setting]: value
      }

      const response = await fetch('/api/settings/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      })

      if (response.ok) {
        setServiceSettings(newSettings)
      }
    } catch (error) {
      console.error('Error updating website settings:', error)
    } finally {
      setLoadingServices(false)
    }
  }

  // ✅ Send device name to Electron when component mounts (restore from localStorage)
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electron?.setCurrentDeviceName) {
      if (selectedScanner && selectedScannerFingerprint?.deviceName) {
        const deviceName = selectedScannerFingerprint.deviceName
        ;(window as any).electron.setCurrentDeviceName(deviceName)
      }
    }
  }, [selectedScanner, selectedScannerFingerprint])

  // Setup electron update listeners
  useEffect(() => {
    if (typeof window === 'undefined') return

    const electron = (window as any).electron
    if (!electron?.isElectron) return

    // Listen for update available
    electron.onUpdateAvailable?.((info: any) => {
      // لا نعرض updateInfo في الصفحة، سيتم عرضه فقط في toast
      setIsCheckingUpdates(false)
      // عرض رسالة نجاح بدلاً من updateInfo
      setShowUpdateSuccess(true)
      setTimeout(() => setShowUpdateSuccess(false), 4000)
    })

    // Listen for no update
    electron.onUpdateNotAvailable?.((info: any) => {
      setShowUpdateSuccess(true)
      setIsCheckingUpdates(false)
      setTimeout(() => setShowUpdateSuccess(false), 4000)
    })

    // Listen for update error
    electron.onUpdateError?.((err: any) => {
      console.error('❌ Update error:', err)
      setUpdateError(err.message || 'فشل التحقق من التحديثات')
      setIsCheckingUpdates(false)
      setTimeout(() => setUpdateError(null), 5000)
    })

    // Cleanup listeners
    return () => {
      electron.offUpdateListeners?.()
    }
  }, [])

  // Handle check for updates using Electron
  const handleCheckForUpdates = async () => {
    if (typeof window === 'undefined') return

    const electron = (window as any).electron
    if (!electron?.isElectron) {
      setUpdateError('التحديثات متاحة فقط في تطبيق Electron')
      setTimeout(() => setUpdateError(null), 3000)
      return
    }

    setIsCheckingUpdates(true)
    setUpdateError(null)
    setUpdateInfo(null)
    setShowUpdateSuccess(false)

    try {
      const result = await electron.checkForUpdates?.()
      if (result?.error) {
        throw new Error(result.error)
      }
    } catch (err: any) {
      console.error('Error checking for updates:', err)
      setUpdateError(err.message || 'فشل التحقق من التحديثات')
      setIsCheckingUpdates(false)
      setTimeout(() => setUpdateError(null), 5000)
    }
  }

  // handleDownloadUpdate removed - updates are now handled via UpdateNotification toast component

  // إضافة الخيارات الأساسية عند التحميل الأول وتحديث التسميات عند تغيير اللغة
  useEffect(() => {
    // إضافة الخيارات الأساسية فقط عند التحميل الأول (بدون طلب إذن)
    if (devices.length === 0) {
      const basicOptions = [
        {
          id: 'keyboard-wedge-scanner',
          label: locale === 'ar' ? '🔦 قارئ باركود (Keyboard Wedge)' : '🔦 Barcode Scanner (Keyboard Wedge)',
          kind: 'barcodescanner'
        }
      ]


      // ✅ إذا كان فيه جهاز محفوظ ومش موجود في القائمة، نضيفه
      if (selectedScanner && selectedScanner !== 'keyboard-wedge-scanner') {
        const savedDeviceLabel = selectedScannerFingerprint?.deviceName || selectedScanner
        basicOptions.push({
          id: selectedScanner,
          label: `📱 ${savedDeviceLabel}`,
          kind: 'hid'
        })
      }

      setDevices(basicOptions)
    } else {
      // تحديث تسميات الأجهزة عند تغيير اللغة
      const updatedDevices = devices.map(device => {
        if (device.kind === 'barcodescanner' && device.id === 'keyboard-wedge-scanner') {
          return {
            ...device,
            label: locale === 'ar' ? '🔦 قارئ باركود (Keyboard Wedge)' : '🔦 Barcode Scanner (Keyboard Wedge)'
          }
        }
        return device
      })
      setDevices(updatedDevices)
    }
  }, [locale, selectedScanner, selectedScannerFingerprint])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()

        // التحقق من أن المستخدم Admin
        if (data.user.role !== 'ADMIN') {
          // سيتم redirect مباشرة دون عرض رسالة لأن الصفحة محمية
          router.push('/')
          return
        }

        setUser(data.user)
      } else {
        router.push('/login')
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      router.push('/login')
    }
  }

  const handleLanguageChange = (newLocale: 'ar' | 'en') => {
    setLanguage(newLocale)
  }

  const detectDevices = async () => {
    setLoadingDevices(true)
    try {
      const allDevices: any[] = []

      // 1. إضافة خيار barcode scanner الافتراضي (Keyboard Wedge)
      const barcodeScannerOption = {
        id: 'keyboard-wedge-scanner',
        label: locale === 'ar' ? '🔦 قارئ باركود (Keyboard Wedge)' : '🔦 Barcode Scanner (Keyboard Wedge)',
        kind: 'barcodescanner'
      }
      allDevices.push(barcodeScannerOption)

      // 2. استخدام Electron API للكشف عن أجهزة HID
      if (typeof window !== 'undefined' && (window as any).electron?.detectHIDDevices) {
        try {

          const hidDevices = await (window as any).electron.detectHIDDevices()

          // إضافة الأجهزة المكتشفة
          hidDevices.forEach((device: any) => {
            allDevices.push({
              id: device.id,
              label: device.label,
              kind: 'hid',
              raw: device
            })
          })

        } catch (error: any) {
        }
      } else {
      }

      // 3. قراءة أجهزة الميديا (كاميرات، ميكروفونات)
      try {
        const mediaDevices = await navigator.mediaDevices.enumerateDevices()

        mediaDevices.forEach(device => {
          if (device.kind === 'videoinput' || device.kind === 'audioinput') {
            const emoji = device.kind === 'videoinput' ? '📹' : '🎤'
            const label = device.label || `${device.kind === 'videoinput' ? 'Camera' : 'Microphone'} ${device.deviceId.substring(0, 8)}`

            allDevices.push({
              id: device.deviceId,
              label: `${emoji} ${label}`,
              kind: device.kind
            })
          }
        })
      } catch (error) {
      }

      // 4. تعيين الأجهزة المكتشفة
      setDevices(allDevices)

    } catch (error) {
      console.error('❌ Error detecting devices:', error)
      // في حالة الخطأ، نضيف الخيار الافتراضي على الأقل
      const basicOptions = [
        {
          id: 'keyboard-wedge-scanner',
          label: locale === 'ar' ? '🔦 قارئ باركود (Keyboard Wedge)' : '🔦 Barcode Scanner (Keyboard Wedge)',
          kind: 'barcodescanner'
        }
      ]
      setDevices(basicOptions)
    } finally {
      setLoadingDevices(false)
    }
  }


  // ✅ Auto-match saved device when devices list changes
  useEffect(() => {
    if (devices.length === 0) {
      return
    }

    // If we already have a selected scanner and it exists in the list, we're good
    if (selectedScanner && devices.some(d => d.id === selectedScanner)) {
      return
    }

    // If we don't have a saved fingerprint or scanner, nothing to restore
    if (!selectedScannerFingerprint && !selectedScanner) {
      return
    }

    // Try to find device by fingerprint or ID

    let matchedDevice = null

    // First try: exact ID match
    if (selectedScanner) {
      matchedDevice = devices.find(d => d.id === selectedScanner)
      if (matchedDevice) {
      }
    }

    // Second try: Match HID devices by vendorId + productId (most reliable)
    if (!matchedDevice && selectedScannerFingerprint?.vendorId && selectedScannerFingerprint?.productId) {
      matchedDevice = devices.find(d => {
        if (d.kind !== 'hid' || !d.raw) return false
        const deviceVendorId = d.raw.vendorId?.toString(16)
        const deviceProductId = d.raw.productId?.toString(16)
        const match = deviceVendorId === selectedScannerFingerprint.vendorId &&
               deviceProductId === selectedScannerFingerprint.productId
        if (match) {
        }
        return match
      })
    }

    // Third try: Match by device name (for keyboard-wedge or cameras)
    if (!matchedDevice && selectedScannerFingerprint?.deviceName) {
      matchedDevice = devices.find(d => {
        const match = d.label === selectedScannerFingerprint.deviceName ||
                      d.id === selectedScannerFingerprint.deviceName
        if (match) {
        }
        return match
      })
    }

    if (matchedDevice) {
      // Don't call setSelectedScanner here - it's already in state, just verify it matches
    } else {
    }
  }, [devices])


  const handleDeviceChange = (deviceId: string) => {
    if (deviceId === 'none') {
      setSelectedScanner(undefined, undefined)
      // Clear device name in Electron
      if (typeof window !== 'undefined' && (window as any).electron?.setCurrentDeviceName) {
        (window as any).electron.setCurrentDeviceName('No Device')
      }
    } else {
      // Find the device in our list to get its raw data
      const device = devices.find(d => d.id === deviceId)

      // Extract fingerprint for HID devices
      let fingerprint = undefined
      if (device?.kind === 'hid' && device.raw) {
        fingerprint = {
          vendorId: device.raw.vendorId?.toString(16),
          productId: device.raw.productId?.toString(16),
          manufacturer: device.raw.manufacturer,
          product: device.raw.product,
          deviceName: device.label
        }
      } else if (device) {
        // For other devices (keyboard-wedge, cameras), just save the name
        fingerprint = {
          deviceName: device.label
        }
      }

      setSelectedScanner(deviceId, fingerprint)

      // ✅ Send device name to Electron main process for logging
      if (typeof window !== 'undefined' && (window as any).electron?.setCurrentDeviceName) {
        const nameToSend = device?.label || deviceId
        ;(window as any).electron.setCurrentDeviceName(nameToSend)
      }
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-4 md:p-6" dir={direction}>
      <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 md:p-8">
        {/* العنوان */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2 sm:gap-3">
            <span>⚙️</span>
            <span>{t('settings.title')}</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2 text-sm sm:text-base">{t('settings.systemSettings')}</p>
        </div>

        {/* قسم إدارة المستخدمين */}
        {user?.role === 'ADMIN' && (
          <div className="border-t pt-4 sm:pt-6 mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3 sm:mb-4 flex items-center gap-2">
              <span>👑</span>
              <span>{t('settings.adminSettings')}</span>
            </h2>

            <div className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-xl p-4 sm:p-6 border-2 border-red-200 dark:border-red-700 mb-3 sm:mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 mb-1 sm:mb-2">
                    {t('dashboard.manageUsers')}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                    {t('settings.manageUsersDescription')}
                  </p>
                </div>
                <Link
                  href="/admin/users"
                  className="bg-red-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-red-700 font-bold flex items-center justify-center gap-2 transition-colors text-sm sm:text-base"
                >
                  <span>👥</span>
                  <span>{t('settings.goToUsers')}</span>
                </Link>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-xl p-4 sm:p-6 border-2 border-orange-200 dark:border-orange-700 mb-3 sm:mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 mb-1 sm:mb-2">
                    {t('nav.offers')}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                    {t('settings.offersDescription')}
                  </p>
                </div>
                <Link
                  href="/offers"
                  className="bg-gradient-to-r from-orange-600 to-yellow-600 text-white px-6 py-3 rounded-lg hover:from-orange-700 hover:to-yellow-700 font-bold flex items-center gap-2 transition-all hover:scale-105 shadow-lg"
                >
                  <span>🎁</span>
                  <span>{t('nav.offers')}</span>
                </Link>
              </div>
            </div>

            {/* قسم إدارة الباقات */}
            <div className="bg-gradient-to-br from-primary-50 to-primary-50 dark:from-primary-900/20 dark:to-primary-900/20 rounded-xl p-4 sm:p-6 border-2 border-primary-200 dark:border-primary-700 mb-3 sm:mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 mb-1 sm:mb-2 flex items-center gap-2">
                    <span>📦</span> {t('packages.management')}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                    {t('packages.managementDesc')}
                  </p>
                </div>
                <Link
                  href="/settings/packages"
                  className="bg-gradient-to-r from-primary-600 to-primary-600 text-white px-6 py-3 rounded-lg hover:from-primary-700 hover:to-primary-700 font-bold flex items-center gap-2 transition-all hover:scale-105 shadow-lg"
                >
                  <span>📦</span>
                  <span>{t('packages.manage')}</span>
                </Link>
              </div>
            </div>

            <div className="bg-gradient-to-br from-primary-50 to-primary-50 dark:from-primary-900/20 dark:to-primary-900/20 rounded-xl p-4 sm:p-6 border-2 border-primary-200 dark:border-primary-700">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 mb-1 sm:mb-2">
                    {t('settings.auditLogsTitle')}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                    {t('settings.auditLogsDescription')}
                  </p>
                </div>
                <Link
                  href="/admin/audit"
                  className="bg-primary-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-primary-700 font-bold flex items-center justify-center gap-2 transition-colors text-sm sm:text-base"
                >
                  <span>🔒</span>
                  <span>{t('settings.viewAuditLogs')}</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* قسم إعدادات الأرقام */}
        {user?.role === 'ADMIN' && (
          <div className="border-t pt-4 sm:pt-6 mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3 sm:mb-4 flex items-center gap-2">
              <span>🔢</span>
              <span>{locale === 'ar' ? 'إعدادات الأرقام' : 'Numbers Settings'}</span>
            </h2>

            {/* رقم الإيصال التالي */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-4" dir={direction}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🧾</span>
                  <div>
                    <p className="font-bold text-sm dark:text-gray-100">
                      {locale === 'ar' ? 'رقم الإيصال التالي' : 'Next Receipt Number'}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-300">#{nextReceiptNumber}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowReceiptNumberEdit(!showReceiptNumberEdit)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium transition"
                >
                  {showReceiptNumberEdit ? `✕ ${locale === 'ar' ? 'إلغاء' : 'Cancel'}` : `✏️ ${locale === 'ar' ? 'تعديل' : 'Edit'}`}
                </button>
              </div>

              {showReceiptNumberEdit && (
                <div className="mt-4 pt-4 border-t dark:border-gray-700 flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-200">
                      {locale === 'ar' ? 'الرقم الجديد' : 'New Number'}
                    </label>
                    <input
                      type="number"
                      value={nextReceiptNumber}
                      onChange={(e) => setNextReceiptNumber(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                      placeholder="1000"
                    />
                  </div>
                  <button
                    onClick={handleUpdateReceiptNumber}
                    disabled={loadingNumbers}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition disabled:opacity-50"
                  >
                    ✓ {locale === 'ar' ? 'حفظ' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            {/* رقم العضو التالي */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4" dir={direction}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">👤</span>
                  <div>
                    <p className="font-bold text-sm dark:text-gray-100">
                      {locale === 'ar' ? 'رقم العضو التالي' : 'Next Member Number'}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-300">#{nextMemberNumber}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMemberNumberEdit(!showMemberNumberEdit)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium transition"
                >
                  {showMemberNumberEdit ? `✕ ${locale === 'ar' ? 'إلغاء' : 'Cancel'}` : `✏️ ${locale === 'ar' ? 'تعديل' : 'Edit'}`}
                </button>
              </div>

              {showMemberNumberEdit && (
                <div className="mt-4 pt-4 border-t dark:border-gray-700 flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-200">
                      {locale === 'ar' ? 'الرقم الجديد' : 'New Number'}
                    </label>
                    <input
                      type="number"
                      value={nextMemberNumber}
                      onChange={(e) => setNextMemberNumber(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                      placeholder="1000"
                    />
                  </div>
                  <button
                    onClick={handleUpdateMemberNumber}
                    disabled={loadingNumbers}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition disabled:opacity-50"
                  >
                    ✓ {locale === 'ar' ? 'حفظ' : 'Save'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* قسم الوضع الداكن / الفاتح */}
        <div className="border-t pt-4 sm:pt-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3 sm:mb-4 flex items-center gap-2">
            <span>{isDarkMode ? '🌙' : '☀️'}</span>
            <span>{t('settings.darkMode')}</span>
          </h2>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  {isDarkMode ? t('settings.currentModeDark') : t('settings.currentModeLight')}
                </label>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  {isDarkMode ? t('settings.switchToLight') : t('settings.switchToDark')}
                </p>
              </div>

              <button
                onClick={toggleDarkMode}
                className={`relative inline-flex h-10 w-20 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                  isDarkMode ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className="absolute h-8 w-8 rounded-full bg-white transition-all duration-200 shadow-lg"
                  style={{
                    [direction === 'rtl' ? 'right' : 'left']: isDarkMode ? '2.5rem' : '0.25rem'
                  }}
                >
                  <span className="flex items-center justify-center h-full text-lg">
                    {isDarkMode ? '🌙' : '☀️'}
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* قسم اللغة */}
        <div className="border-t pt-4 sm:pt-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3 sm:mb-4 flex items-center gap-2">
            <span>🌐</span>
            <span>{t('settings.languageSettings')}</span>
          </h2>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 sm:p-6">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
              {t('settings.currentLanguage')}
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* زر العربية */}
              <button
                onClick={() => handleLanguageChange('ar')}
                className={`p-3 sm:p-4 rounded-xl border-2 transition-all ${
                  locale === 'ar'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 shadow-md'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-2xl sm:text-3xl">🇸🇦</span>
                  <div className="text-right flex-1">
                    <div className="font-bold text-base sm:text-lg">العربية</div>
                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Arabic</div>
                  </div>
                  {locale === 'ar' && (
                    <span className="text-primary-500 text-lg sm:text-xl">✓</span>
                  )}
                </div>
              </button>

              {/* زر الإنجليزية */}
              <button
                onClick={() => handleLanguageChange('en')}
                className={`p-3 sm:p-4 rounded-xl border-2 transition-all ${
                  locale === 'en'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 shadow-md'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-2xl sm:text-3xl">🇬🇧</span>
                  <div className="text-left flex-1">
                    <div className="font-bold text-base sm:text-lg">English</div>
                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">الإنجليزية</div>
                  </div>
                  {locale === 'en' && (
                    <span className="text-primary-500 text-lg sm:text-xl">✓</span>
                  )}
                </div>
              </button>
            </div>

            {/* رسالة معلومات */}
            <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 bg-primary-100 dark:bg-primary-900/30 border border-primary-300 dark:border-primary-600 rounded-lg text-primary-800 dark:text-primary-200 text-xs sm:text-sm">
              ℹ️ {t('settings.languageChangedSuccessfully')}
            </div>
          </div>
        </div>

        {/* قسم إعدادات الباركود سكانر - Electron only */}
        {isElectron && (
        <div className="border-t pt-4 sm:pt-6 mt-4 sm:mt-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3 sm:mb-4 flex items-center gap-2">
            <span>📷</span>
            <span>{t('settings.barcodeScanner')}</span>
          </h2>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 sm:p-6">
            {/* Auto-Scan Toggle */}
            <div className="mb-4 p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-600">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1 text-sm sm:text-base">
                    {t('settings.autoScanEnabled')}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                    {locale === 'ar'
                      ? 'تفعيل المسح التلقائي للباركود عند الإدخال'
                      : 'Enable automatic barcode scanning on input'
                    }
                  </p>
                </div>
                <button
                  onClick={() => setAutoScanEnabled(!autoScanEnabled)}
                  className={`relative w-14 sm:w-16 h-7 sm:h-8 rounded-full transition-colors flex-shrink-0 ${
                    autoScanEnabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                  style={{ direction: 'ltr' }}
                >
                  <div
                    className={`absolute top-0.5 sm:top-1 w-6 h-6 sm:h-6 bg-white rounded-full shadow-md transition-all duration-200 ${
                      autoScanEnabled ? 'left-7 sm:left-8' : 'left-0.5 sm:left-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Strict Mode Toggle */}
            {selectedScanner && (
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg border-2 border-amber-200 dark:border-amber-700">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1 flex items-center gap-2 text-sm sm:text-base">
                      <span>🔒</span>
                      <span>{locale === 'ar' ? 'وضع العزل الكامل' : 'Strict Isolation Mode'}</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                      {locale === 'ar'
                        ? 'عزل الجهاز تماماً - كل الكتابة منه تروح للبحث فقط'
                        : 'Complete device isolation - all input goes to search only'
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => setStrictMode(!strictMode)}
                    className={`relative w-14 sm:w-16 h-7 sm:h-8 rounded-full transition-colors flex-shrink-0 ${
                      strictMode ? 'bg-amber-500' : 'bg-gray-300'
                    }`}
                    style={{ direction: 'ltr' }}
                  >
                    <div
                      className={`absolute top-0.5 sm:top-1 w-6 h-6 sm:h-6 bg-white rounded-full shadow-md transition-all duration-200 ${
                        strictMode ? 'left-7 sm:left-8' : 'left-0.5 sm:left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}


            {/* Device Selector */}
            <div className="mb-3 sm:mb-4">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 mb-2 sm:mb-3">
                {t('settings.selectDevice')}
              </label>

              {loadingDevices && (
                <div className="p-3 sm:p-4 bg-primary-50 dark:bg-primary-900/30 rounded-xl text-primary-700 dark:text-primary-300 text-center text-sm">
                  <span className="animate-spin inline-block">⏳</span> {locale === 'ar' ? 'جاري الكشف عن الأجهزة...' : 'Detecting devices...'}
                </div>
              )}

              {!loadingDevices && (
                <div className="space-y-2 sm:space-y-3">
                  <select
                    key={`scanner-select-${selectedScanner || 'none'}`}
                    value={selectedScanner || 'none'}
                    onChange={(e) => handleDeviceChange(e.target.value)}
                    className="w-full p-2.5 sm:p-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:border-primary-500 focus:outline-none text-sm sm:text-base"
                  >
                    <option value="none">{t('settings.defaultDevice')}</option>
                    {devices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.label} {selectedScanner === device.id ? '✓' : ''}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={detectDevices}
                    className="w-full sm:w-auto text-xs sm:text-sm bg-gradient-to-r from-primary-600 to-primary-600 text-white font-semibold flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg hover:from-primary-700 hover:to-primary-700 transition-all shadow-md hover:shadow-lg"
                  >
                    <span>🔍</span>
                    <span className="hidden sm:inline">{locale === 'ar' ? 'اكتشف جميع الأجهزة (USB, كاميرات, وغيرها)' : 'Detect All Devices (USB, Cameras, etc.)'}</span>
                    <span className="sm:hidden">{locale === 'ar' ? 'اكتشف الأجهزة' : 'Detect Devices'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Info Message */}
            <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-gradient-to-br from-primary-50 to-primary-50 dark:from-primary-900/20 dark:to-primary-900/20 border-2 border-primary-300 dark:border-primary-600 rounded-xl text-primary-800 dark:text-primary-200 text-xs sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <div className="font-bold mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base">
                <span>💡</span>
                <span>{locale === 'ar' ? 'كيفية إعداد الباركود سكانر:' : 'How to Setup Barcode Scanner:'}</span>
              </div>
              <ol className={`space-y-1.5 sm:space-y-2 ${locale === 'ar' ? 'pr-5 sm:pr-6' : 'pl-5 sm:pl-6'} list-decimal`}>
                <li className="font-semibold">
                  {locale === 'ar'
                    ? '🔍 اضغط زر "اكتشف جميع الأجهزة" أعلاه'
                    : '🔍 Click "Detect All Devices" button above'
                  }
                </li>
                <li>
                  {locale === 'ar'
                    ? '📋 سيتم الكشف تلقائياً عن جميع أجهزة USB المتصلة (كيبورد، ماوس، باركود سكانر)'
                    : '📋 All connected USB devices will be detected automatically (keyboard, mouse, barcode scanner)'
                  }
                </li>
                <li>
                  {locale === 'ar'
                    ? '🔌 اختر جهاز الباركود سكانر من القائمة المنسدلة أعلاه'
                    : '🔌 Select your barcode scanner from the dropdown list above'
                  }
                </li>
                <li>
                  {locale === 'ar'
                    ? '✅ فعّل "المسح التلقائي للباركود"'
                    : '✅ Enable "Auto Scan for Barcode"'
                  }
                </li>
                <li>
                  {locale === 'ar'
                    ? '🚀 ابدأ باستخدام الباركود سكانر - سيفتح البحث تلقائياً!'
                    : '🚀 Start using your barcode scanner - search will open automatically!'
                  }
                </li>
              </ol>
              <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-primary-300">
                <p className="text-[10px] sm:text-xs">
                  {locale === 'ar'
                    ? '💡 نصيحة: إذا لم يظهر جهازك في القائمة، اختر "قارئ باركود (Keyboard Wedge)" - يعمل مع 99% من الأجهزة بدون إعدادات'
                    : '💡 Tip: If your device doesn\'t appear, select "Barcode Scanner (Keyboard Wedge)" - works with 99% of devices without configuration'
                  }
                </p>
              </div>
            </div>

            {/* Status Indicator */}
            {autoScanEnabled && (
              <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 rounded-lg">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-xl sm:text-2xl">✅</span>
                  <div>
                    <p className="font-semibold text-green-800 dark:text-green-200 text-sm sm:text-base">
                      {t('settings.autoScanEnabled')}
                    </p>
                    <p className="text-xs sm:text-sm text-green-700 dark:text-green-300">
                      {locale === 'ar'
                        ? 'سيتم فتح نافذة البحث تلقائياً عند مسح الباركود'
                        : 'Search window will open automatically on barcode scan'
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {/* قسم مشاركة اللينك */}
        <div className="border-t pt-4 sm:pt-6 mt-4 sm:mt-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3 sm:mb-4 flex items-center gap-2">
            <span>🔗</span>
            <span>{t('settings.networkAccess')}</span>
          </h2>

          <div className="bg-gradient-to-br from-primary-50 to-primary-50 dark:from-primary-900/20 dark:to-primary-900/20 rounded-xl p-4 sm:p-6 border-2 border-primary-200 dark:border-primary-700">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="flex-1">
                <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 mb-1 sm:mb-2">
                  {t('settings.shareLink')}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                  {t('settings.shareLinkDescription')}
                </p>
              </div>
              <button
                onClick={() => setShowLinkModal(true)}
                className="w-full sm:w-auto bg-gradient-to-r from-primary-600 to-primary-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg hover:from-primary-700 hover:to-primary-700 font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 shadow-lg text-sm sm:text-base"
              >
                <span>🔗</span>
                <span>{t('settings.showLink')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* قسم التحديثات - Electron only */}
        {isElectron && (
        <div className="border-t pt-4 sm:pt-6 mt-4 sm:mt-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3 sm:mb-4 flex items-center gap-2">
            <span>🔄</span>
            <span>{locale === 'ar' ? 'التحديثات' : 'Updates'}</span>
          </h2>

          {/* Error notification */}
          {updateError && (
            <div className="mb-3 sm:mb-4 bg-gradient-to-br from-red-500 to-red-600 text-white p-3 sm:p-4 rounded-xl shadow-lg animate-slideDown border border-red-400">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-xl sm:text-2xl">❌</span>
                <div className="flex-1">
                  <p className="font-bold text-sm sm:text-base">{locale === 'ar' ? 'خطأ في التحديث' : 'Update Error'}</p>
                  <p className="text-xs sm:text-sm opacity-90">{updateError}</p>
                </div>
                <button
                  onClick={() => setUpdateError(null)}
                  className="text-white/70 hover:text-white transition-colors text-lg sm:text-xl"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Success notification - up to date */}
          {showUpdateSuccess && (
            <div className="mb-3 sm:mb-4 bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-3 sm:p-4 rounded-xl shadow-lg animate-slideDown border border-emerald-400">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-2xl sm:text-3xl">✨</span>
                <div className="flex-1">
                  <p className="font-bold text-base sm:text-lg">
                    {locale === 'ar' ? 'أنت تستخدم أحدث إصدار! 🎉' : 'You\'re up to date! 🎉'}
                  </p>
                </div>
                <button
                  onClick={() => setShowUpdateSuccess(false)}
                  className="text-white/70 hover:text-white transition-colors text-lg sm:text-xl"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Update notifications removed - now shown only in toast via UpdateNotification component */}

          {/* Main update check card */}
          <div className="bg-gradient-to-br from-primary-50 to-cyan-50 dark:from-primary-900/20 dark:to-cyan-900/20 rounded-xl p-4 sm:p-6 border-2 border-primary-200 dark:border-primary-700">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="flex-1">
                <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 mb-1 sm:mb-2 flex items-center gap-2">
                  <span>⬇️</span>
                  <span>{locale === 'ar' ? 'التحقق من التحديثات' : 'Check for Updates'}</span>
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-1 sm:mb-2">
                  {locale === 'ar'
                    ? 'تحقق من وجود تحديثات جديدة للتطبيق'
                    : 'Check if new updates are available'}
                </p>
              </div>
              <button
                onClick={handleCheckForUpdates}
                disabled={isCheckingUpdates}
                className={`w-full sm:w-auto bg-gradient-to-r from-primary-600 to-cyan-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg text-sm sm:text-base ${
                  isCheckingUpdates
                    ? 'opacity-70 cursor-not-allowed'
                    : 'hover:from-primary-700 hover:to-cyan-700 hover:scale-105 active:scale-95'
                }`}
              >
                {isCheckingUpdates ? (
                  <>
                    <span className="inline-block animate-spin">⏳</span>
                    <span className="hidden sm:inline">{locale === 'ar' ? 'جاري التحقق...' : 'Checking...'}</span>
                    <span className="sm:hidden">{locale === 'ar' ? 'جاري...' : 'Checking...'}</span>
                  </>
                ) : (
                  <>
                    <span>🔍</span>
                    <span className="hidden sm:inline">{locale === 'ar' ? 'التحقق من التحديثات' : 'Check for Updates'}</span>
                    <span className="sm:hidden">{locale === 'ar' ? 'تحقق' : 'Check'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        )}

        {/* قسم الدعم الفني */}
        <div className="border-t pt-4 sm:pt-6 mt-4 sm:mt-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-700 dark:text-gray-200 mb-3 sm:mb-4 flex items-center gap-2">
            <span>📞</span>
            <span>{t('settings.technicalSupport')}</span>
          </h2>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 sm:p-6 border-2 border-green-200 dark:border-green-700">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="flex-1">
                <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100 mb-1 sm:mb-2 flex items-center gap-2">
                  <span>💬</span>
                  <span>{t('settings.technicalSupport')}</span>
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mb-2 sm:mb-3">
                  {t('settings.supportDescription')}
                </p>
                <p className="text-xs sm:text-sm font-semibold text-green-700 dark:text-green-300 flex items-center gap-2">
                  <span>📱</span>
                  <span>01028518754</span>
                </p>
              </div>
              <a
                href={EXTERNAL_LINKS.support.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto bg-green-600 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg hover:bg-green-700 font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg text-sm sm:text-base"
              >
                <span className="text-lg sm:text-xl">💬</span>
                <span>{t('settings.contactSupport')}</span>
              </a>
            </div>
          </div>
        </div>

        {/* قسم إدارة الخدمات */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
            🔧 {t('settings.servicesManagement')}
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {t('settings.servicesManagementDesc')}
          </p>

          <div className="space-y-4">
            {/* Nutrition Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🥗</span>
                <div>
                  <h4 className="font-bold text-gray-800 dark:text-gray-100">{t('services.nutrition')}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{t('services.nutritionDesc')}</p>
                </div>
              </div>
              <button
                onClick={() => toggleService('nutrition')}
                disabled={loadingServices}
                className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors duration-200 ${
                  serviceSettings.nutritionEnabled ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute inset-y-1 h-6 w-6 rounded-full bg-white shadow-sm transition-all duration-200 ease-in-out ${
                    serviceSettings.nutritionEnabled
                      ? 'end-1'
                      : 'start-1'
                  }`}
                />
              </button>
            </div>

            {/* Physiotherapy Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🏥</span>
                <div>
                  <h4 className="font-bold text-gray-800 dark:text-gray-100">{t('services.physiotherapy')}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{t('services.physiotherapyDesc')}</p>
                </div>
              </div>
              <button
                onClick={() => toggleService('physiotherapy')}
                disabled={loadingServices}
                className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors duration-200 ${
                  serviceSettings.physiotherapyEnabled ? 'bg-blue-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute inset-y-1 h-6 w-6 rounded-full bg-white shadow-sm transition-all duration-200 ease-in-out ${
                    serviceSettings.physiotherapyEnabled
                      ? 'end-1'
                      : 'start-1'
                  }`}
                />
              </button>
            </div>

            {/* Group Classes Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-3xl">👥</span>
                <div>
                  <h4 className="font-bold text-gray-800 dark:text-gray-100">{t('services.groupClasses')}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{t('services.groupClassesDesc')}</p>
                </div>
              </div>
              <button
                onClick={() => toggleService('groupClass')}
                disabled={loadingServices}
                className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors duration-200 ${
                  serviceSettings.groupClassEnabled ? 'bg-primary-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute inset-y-1 h-6 w-6 rounded-full bg-white shadow-sm transition-all duration-200 ease-in-out ${
                    serviceSettings.groupClassEnabled
                      ? 'end-1'
                      : 'start-1'
                  }`}
                />
              </button>
            </div>

            {/* SPA Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-3xl">💆</span>
                <div>
                  <h4 className="font-bold text-gray-800 dark:text-gray-100">{t('services.spa')}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{t('services.spaDesc')}</p>
                </div>
              </div>
              <button
                onClick={() => toggleService('spa')}
                disabled={loadingServices}
                className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors duration-200 ${
                  serviceSettings.spaEnabled ? 'bg-pink-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute inset-y-1 h-6 w-6 rounded-full bg-white shadow-sm transition-all duration-200 ease-in-out ${
                    serviceSettings.spaEnabled
                      ? 'end-1'
                      : 'start-1'
                  }`}
                />
              </button>
            </div>

            {/* InBody Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-3xl">⚖️</span>
                <div>
                  <h4 className="font-bold text-gray-800 dark:text-gray-100">{t('services.inBody')}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{t('services.inBodyDesc')}</p>
                </div>
              </div>
              <button
                onClick={() => toggleService('inBody')}
                disabled={loadingServices}
                className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors duration-200 ${
                  serviceSettings.inBodyEnabled ? 'bg-cyan-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute inset-y-1 h-6 w-6 rounded-full bg-white shadow-sm transition-all duration-200 ease-in-out ${
                    serviceSettings.inBodyEnabled
                      ? 'end-1'
                      : 'start-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Points System Management */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden mb-3 sm:mb-4">
          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl sm:text-4xl">🏆</span>
              <div>
                <h3 className="text-lg sm:text-xl font-bold">{t('settings.pointsManagement')}</h3>
                <p className="text-sm text-yellow-50">{t('settings.pointsManagementDesc')}</p>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            {/* Points System Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🏆</span>
                <div>
                  <h4 className="font-bold text-gray-800 dark:text-gray-100">{t('settings.pointsEnabled')}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{t('settings.pointsEnabledDesc')}</p>
                </div>
              </div>
              <button
                onClick={() => toggleService('points')}
                disabled={loadingServices}
                className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors duration-200 ${
                  serviceSettings.pointsEnabled ? 'bg-yellow-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute inset-y-1 h-6 w-6 rounded-full bg-white shadow-sm transition-all duration-200 ease-in-out ${
                    serviceSettings.pointsEnabled
                      ? 'end-1'
                      : 'start-1'
                  }`}
                />
              </button>
            </div>

            {/* Points Configuration */}
            {serviceSettings.pointsEnabled && (
              <div className="space-y-4 animate-slideDown">
                {/* Points per Check-in */}
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">✅</span>
                      <h4 className="font-bold text-gray-800 dark:text-gray-100">{t('settings.pointsPerCheckIn')}</h4>
                    </div>
                    <span className="text-2xl font-bold text-green-600 dark:text-green-400">{serviceSettings.pointsPerCheckIn}</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={serviceSettings.pointsPerCheckIn}
                    onChange={(e) => updatePointsSettings('pointsPerCheckIn', parseInt(e.target.value) || 0)}
                    className="w-full p-2 border-2 border-green-300 dark:border-green-700 dark:bg-gray-700 dark:text-white rounded-lg focus:border-green-500 focus:outline-none"
                  />
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{t('settings.pointsPerCheckInDesc')}</p>
                </div>

                {/* Points per Invitation */}
                <div className="p-4 bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-200 dark:border-primary-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🎁</span>
                      <h4 className="font-bold text-gray-800 dark:text-gray-100">{t('settings.pointsPerInvitation')}</h4>
                    </div>
                    <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">{serviceSettings.pointsPerInvitation}</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={serviceSettings.pointsPerInvitation}
                    onChange={(e) => updatePointsSettings('pointsPerInvitation', parseInt(e.target.value) || 0)}
                    className="w-full p-2 border-2 border-primary-300 dark:border-primary-700 dark:bg-gray-700 dark:text-white rounded-lg focus:border-primary-500 focus:outline-none"
                  />
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{t('settings.pointsPerInvitationDesc')}</p>
                </div>

                {/* Points per EGP Spent */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">💰</span>
                      <h4 className="font-bold text-gray-800 dark:text-gray-100">{t('settings.pointsPerEGPSpent')}</h4>
                    </div>
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{serviceSettings.pointsPerEGPSpent}</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={serviceSettings.pointsPerEGPSpent}
                    onChange={(e) => updatePointsSettings('pointsPerEGPSpent', parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border-2 border-blue-300 dark:border-blue-700 dark:bg-gray-700 dark:text-white rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{t('settings.pointsPerEGPSpentDesc')}</p>
                </div>

                {/* Points Value in EGP */}
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">💰</span>
                      <h4 className="font-bold text-gray-800 dark:text-gray-100">{t('settings.pointsValueInEGP')}</h4>
                    </div>
                    <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{serviceSettings.pointsValueInEGP}</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={serviceSettings.pointsValueInEGP}
                    onChange={(e) => updatePointsSettings('pointsValueInEGP', parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border-2 border-yellow-300 dark:border-yellow-700 dark:bg-gray-700 dark:text-white rounded-lg focus:border-yellow-500 focus:outline-none"
                  />
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{t('settings.pointsValueInEGPDesc')}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Website Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden mb-3 sm:mb-4">
          <div className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl sm:text-4xl">🌐</span>
              <div>
                <h3 className="text-lg sm:text-xl font-bold">{t('settings.websiteSettings')}</h3>
                <p className="text-sm text-cyan-50">{t('settings.websiteSettingsDesc')}</p>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            {/* Website URL */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🔗</span>
                <h4 className="font-bold text-gray-800 dark:text-gray-100">{t('settings.websiteUrl')}</h4>
              </div>
              <input
                type="url"
                value={serviceSettings.websiteUrl}
                onChange={(e) => updateWebsiteSettings('websiteUrl', e.target.value)}
                placeholder="https://www.example.com"
                className="w-full p-3 border-2 border-blue-300 dark:border-blue-700 dark:bg-gray-700 dark:text-white rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                dir="ltr"
              />
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">{t('settings.websiteUrlDesc')}</p>
            </div>

            {/* Show Website on Receipts Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-3xl">📄</span>
                <div>
                  <h4 className="font-bold text-gray-800 dark:text-gray-100">{t('settings.showWebsiteOnReceipts')}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{t('settings.showWebsiteOnReceiptsDesc')}</p>
                </div>
              </div>
              <button
                onClick={() => updateWebsiteSettings('showWebsiteOnReceipts', !serviceSettings.showWebsiteOnReceipts)}
                disabled={loadingServices}
                className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors duration-200 ${
                  serviceSettings.showWebsiteOnReceipts ? 'bg-cyan-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute inset-y-1 h-6 w-6 rounded-full bg-white shadow-sm transition-all duration-200 ease-in-out ${
                    serviceSettings.showWebsiteOnReceipts
                      ? 'end-1'
                      : 'start-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Database Restore */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden mb-3 sm:mb-4">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl sm:text-4xl">🗄️</span>
              <div>
                <h3 className="text-lg sm:text-xl font-bold">استعادة قاعدة البيانات</h3>
                <p className="text-sm text-orange-50">رفع ملف gym.db قديم واستعادته بأمان</p>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            {/* Current DB Info */}
            {dbInfo && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
                  <span>📊</span> قاعدة البيانات الحالية
                </h4>
                <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                  <p>📁 المسار: <span className="font-mono text-xs break-all">{dbInfo.dbPath}</span></p>
                  <p>💾 الحجم: <span className="font-semibold">{dbInfo.size}</span></p>
                  {dbInfo.lastModified && <p>🕐 آخر تعديل: <span className="font-semibold">{dbInfo.lastModified}</span></p>}
                </div>
              </div>
            )}

            {/* Upload Section */}
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-700 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">⬆️</span>
                <h4 className="font-bold text-gray-800 dark:text-gray-100">رفع ملف قاعدة بيانات</h4>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                ارفع ملف <span className="font-mono font-bold">.db</span> — سيتم التحقق منه، عمل نسخة احتياطية من الحالي، وتطبيق التحديثات تلقائيًا.
              </p>

              <input
                ref={dbFileRef}
                type="file"
                accept=".db"
                className="hidden"
                onChange={handleDbUpload}
              />

              <button
                onClick={() => dbFileRef.current?.click()}
                disabled={dbUploading}
                className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg font-bold transition-colors"
              >
                {dbUploading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    جاري الاستعادة...
                  </>
                ) : (
                  <>⬆️ اختر ملف قاعدة البيانات</>
                )}
              </button>

              {/* Result Message */}
              {dbUploadResult && (
                <div className={`mt-3 p-3 rounded-lg text-sm font-medium ${
                  dbUploadResult.success
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                }`}>
                  {dbUploadResult.success || dbUploadResult.error}
                </div>
              )}
            </div>

            {/* Backups List */}
            {dbInfo?.backups?.length > 0 && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
                  <span>🗂️</span> النسخ الاحتياطية الأخيرة
                </h4>
                <ul className="space-y-1">
                  {dbInfo.backups.map((backup: any) => (
                    <li key={backup.name} className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300 py-1 border-b border-blue-100 dark:border-blue-800 last:border-0">
                      <span className="font-mono text-xs truncate flex-1">{backup.name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">{backup.size}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{backup.date}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Powered by FitBoost */}
        <div className="border-t pt-4 sm:pt-6 mt-4 sm:mt-6">
          <div className="text-center">
            <a
              href={EXTERNAL_LINKS.support.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{t('settings.poweredBy')}</span>
              <span className="text-base sm:text-lg font-bold bg-gradient-to-r from-primary-600 to-cyan-600 bg-clip-text text-transparent">
                FitBoost
              </span>
            </a>
          </div>
        </div>
      </div>

      {/* Link Modal */}
      {showLinkModal && (
        <LinkModal onClose={() => setShowLinkModal(false)} />
      )}


      {/* Animation styles */}
      <style jsx global>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}

'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '../../contexts/LanguageContext'
import { useDeviceSettings } from '../../contexts/DeviceSettingsContext'
import LinkModal from '../../components/LinkModal'
import { Html5Qrcode } from 'html5-qrcode'

export default function SettingsPage() {
  const router = useRouter()
  const { locale, setLanguage, t, direction } = useLanguage()
  const { selectedScanner, selectedScannerFingerprint, setSelectedScanner, autoScanEnabled, setAutoScanEnabled, strictMode, setStrictMode } = useDeviceSettings()
  const [user, setUser] = useState<any>(null)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [devices, setDevices] = useState<any[]>([])
  const [loadingDevices, setLoadingDevices] = useState(false)
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [showUpdateSuccess, setShowUpdateSuccess] = useState(false)
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Auto-detection states
  const [isDetecting, setIsDetecting] = useState(false)
  const [detectionInput, setDetectionInput] = useState('')

  useEffect(() => {
    checkAuth()
  }, [])

  // ✅ Send device name to Electron when component mounts (restore from localStorage)
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electron?.setCurrentDeviceName) {
      if (selectedScanner && selectedScannerFingerprint?.deviceName) {
        const deviceName = selectedScannerFingerprint.deviceName
        ;(window as any).electron.setCurrentDeviceName(deviceName)
        console.log('📤 Restored device name in Electron:', deviceName)
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
      console.log('✅ Update available:', info)
      setUpdateInfo(info)
      setIsCheckingUpdates(false)
    })

    // Listen for no update
    electron.onUpdateNotAvailable?.((info: any) => {
      console.log('ℹ️ No updates available')
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

  const handleDownloadUpdate = async () => {
    if (typeof window === 'undefined') return

    const electron = (window as any).electron
    if (!electron?.isElectron) return

    try {
      await electron.downloadUpdate?.()
      setUpdateInfo(null) // سيتم عرض progress من خلال UpdateNotification
    } catch (err: any) {
      console.error('Error downloading update:', err)
      setUpdateError(err.message || 'فشل تحميل التحديث')
      setTimeout(() => setUpdateError(null), 5000)
    }
  }

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

      console.log('📋 Setting initial devices:', basicOptions)
      console.log('💾 Current selectedScanner from context:', selectedScanner)
      console.log('🔑 Current selectedScannerFingerprint:', selectedScannerFingerprint)

      // ✅ إذا كان فيه جهاز محفوظ ومش موجود في القائمة، نضيفه
      if (selectedScanner && selectedScanner !== 'keyboard-wedge-scanner') {
        const savedDeviceLabel = selectedScannerFingerprint?.deviceName || selectedScanner
        console.log('➕ Adding saved device to initial list:', savedDeviceLabel)
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
          console.log('🔍 Using Electron HID API to detect devices...')

          const hidDevices = await (window as any).electron.detectHIDDevices()
          console.log('📱 HID Devices found:', hidDevices.length)

          // إضافة الأجهزة المكتشفة
          hidDevices.forEach((device: any) => {
            allDevices.push({
              id: device.id,
              label: device.label,
              kind: 'hid',
              raw: device
            })
          })

          console.log('✅ Devices detected successfully via Electron')
        } catch (error: any) {
          console.log('⚠️ Could not get HID devices from Electron:', error)
        }
      } else {
        console.log('ℹ️ Not running in Electron, using basic options only')
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
        console.log('⚠️ Could not get media devices:', error)
      }

      // 4. تعيين الأجهزة المكتشفة
      setDevices(allDevices)

      console.log('✅ Total devices detected:', allDevices.length)
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
      console.log('⏳ No devices loaded yet, waiting...')
      return
    }

    // If we already have a selected scanner and it exists in the list, we're good
    if (selectedScanner && devices.some(d => d.id === selectedScanner)) {
      console.log('✅ Current device is valid:', selectedScanner)
      return
    }

    // If we don't have a saved fingerprint or scanner, nothing to restore
    if (!selectedScannerFingerprint && !selectedScanner) {
      console.log('ℹ️ No saved device found')
      return
    }

    // Try to find device by fingerprint or ID
    console.log('🔍 Trying to restore saved device:', { selectedScanner, selectedScannerFingerprint })

    let matchedDevice = null

    // First try: exact ID match
    if (selectedScanner) {
      matchedDevice = devices.find(d => d.id === selectedScanner)
      if (matchedDevice) {
        console.log('🎯 Matched by exact ID:', selectedScanner)
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
          console.log('🎯 Matched by VID/PID:', deviceVendorId, deviceProductId)
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
          console.log('🎯 Matched by device name:', d.label)
        }
        return match
      })
    }

    if (matchedDevice) {
      console.log('✅ Restored saved device:', matchedDevice.id, matchedDevice.label)
      // Don't call setSelectedScanner here - it's already in state, just verify it matches
    } else {
      console.log('⚠️ Could not find saved device in list')
      console.log('📋 Available devices:', devices.map(d => ({ id: d.id, label: d.label, kind: d.kind })))
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
      console.log('💾 Saving device:', { deviceId, fingerprint })

      // ✅ Send device name to Electron main process for logging
      if (typeof window !== 'undefined' && (window as any).electron?.setCurrentDeviceName) {
        const nameToSend = device?.label || deviceId
        ;(window as any).electron.setCurrentDeviceName(nameToSend)
        console.log('📤 Sent device name to Electron:', nameToSend)
      }
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6" dir={direction}>
      <div className="bg-white rounded-2xl shadow-lg p-8">
        {/* العنوان */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <span>⚙️</span>
            <span>{t('settings.title')}</span>
          </h1>
          <p className="text-gray-600 mt-2">{t('settings.systemSettings')}</p>
        </div>

        {/* قسم إدارة المستخدمين */}
        {user?.role === 'ADMIN' && (
          <div className="border-t pt-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span>👑</span>
              <span>{t('settings.adminSettings')}</span>
            </h2>

            <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-6 border-2 border-red-200 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">
                    {t('dashboard.manageUsers')}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {t('settings.manageUsersDescription')}
                  </p>
                </div>
                <Link
                  href="/admin/users"
                  className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 font-bold flex items-center gap-2 transition-colors"
                >
                  <span>👥</span>
                  <span>{t('settings.goToUsers')}</span>
                </Link>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl p-6 border-2 border-orange-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">
                    {t('nav.offers')}
                  </h3>
                  <p className="text-sm text-gray-600">
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
          </div>
        )}

        {/* قسم اللغة */}
        <div className="border-t pt-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span>🌐</span>
            <span>{t('settings.languageSettings')}</span>
          </h2>

          <div className="bg-gray-50 rounded-xl p-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t('settings.currentLanguage')}
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* زر العربية */}
              <button
                onClick={() => handleLanguageChange('ar')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  locale === 'ar'
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🇸🇦</span>
                  <div className="text-right flex-1">
                    <div className="font-bold text-lg">العربية</div>
                    <div className="text-sm text-gray-600">Arabic</div>
                  </div>
                  {locale === 'ar' && (
                    <span className="text-blue-500 text-xl">✓</span>
                  )}
                </div>
              </button>

              {/* زر الإنجليزية */}
              <button
                onClick={() => handleLanguageChange('en')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  locale === 'en'
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🇬🇧</span>
                  <div className="text-left flex-1">
                    <div className="font-bold text-lg">English</div>
                    <div className="text-sm text-gray-600">الإنجليزية</div>
                  </div>
                  {locale === 'en' && (
                    <span className="text-blue-500 text-xl">✓</span>
                  )}
                </div>
              </button>
            </div>

            {/* رسالة معلومات */}
            <div className="mt-4 p-3 bg-blue-100 border border-blue-300 rounded-lg text-blue-800 text-sm">
              ℹ️ {t('settings.languageChangedSuccessfully')}
            </div>
          </div>
        </div>

        {/* قسم إعدادات الباركود سكانر */}
        <div className="border-t pt-6 mt-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span>📷</span>
            <span>{t('settings.barcodeScanner')}</span>
          </h2>

          <div className="bg-gray-50 rounded-xl p-6">
            {/* Auto-Scan Toggle */}
            <div className="mb-4 p-4 bg-white rounded-lg border-2 border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800 mb-1">
                    {t('settings.autoScanEnabled')}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {locale === 'ar'
                      ? 'تفعيل المسح التلقائي للباركود عند الإدخال'
                      : 'Enable automatic barcode scanning on input'
                    }
                  </p>
                </div>
                <button
                  onClick={() => setAutoScanEnabled(!autoScanEnabled)}
                  className={`relative w-16 h-8 rounded-full transition-colors ${
                    autoScanEnabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${
                      autoScanEnabled
                        ? (locale === 'ar' ? 'translate-x-1' : 'translate-x-8')
                        : (locale === 'ar' ? 'translate-x-8' : 'translate-x-1')
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Strict Mode Toggle */}
            {selectedScanner && (
              <div className="mb-6 p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg border-2 border-amber-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                      <span>🔒</span>
                      <span>{locale === 'ar' ? 'وضع العزل الكامل' : 'Strict Isolation Mode'}</span>
                    </h3>
                    <p className="text-sm text-gray-600">
                      {locale === 'ar'
                        ? 'عزل الجهاز تماماً - كل الكتابة منه تروح للبحث فقط'
                        : 'Complete device isolation - all input goes to search only'
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => setStrictMode(!strictMode)}
                    className={`relative w-16 h-8 rounded-full transition-colors ${
                      strictMode ? 'bg-amber-500' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${
                        strictMode
                          ? (locale === 'ar' ? 'translate-x-1' : 'translate-x-8')
                          : (locale === 'ar' ? 'translate-x-8' : 'translate-x-1')
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}


            {/* Device Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                {t('settings.selectDevice')}
              </label>

              {loadingDevices && (
                <div className="p-4 bg-blue-50 rounded-xl text-blue-700 text-center">
                  <span className="animate-spin inline-block">⏳</span> {locale === 'ar' ? 'جاري الكشف عن الأجهزة...' : 'Detecting devices...'}
                </div>
              )}

              {!loadingDevices && (
                <div className="space-y-3">
                  <select
                    key={`scanner-select-${selectedScanner || 'none'}`}
                    value={selectedScanner || 'none'}
                    onChange={(e) => handleDeviceChange(e.target.value)}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
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
                    className="text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold flex items-center gap-2 px-4 py-2 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
                  >
                    <span>🔍</span>
                    <span>{locale === 'ar' ? 'اكتشف جميع الأجهزة (USB, كاميرات, وغيرها)' : 'Detect All Devices (USB, Cameras, etc.)'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Info Message */}
            <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl text-blue-800 text-sm">
              <div className="font-bold mb-3 flex items-center gap-2 text-base">
                <span>💡</span>
                <span>{locale === 'ar' ? 'كيفية إعداد الباركود سكانر:' : 'How to Setup Barcode Scanner:'}</span>
              </div>
              <ol className={`space-y-2 ${locale === 'ar' ? 'pr-6' : 'pl-6'} list-decimal`}>
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
              <div className="mt-3 pt-3 border-t border-blue-300">
                <p className="text-xs">
                  {locale === 'ar'
                    ? '💡 نصيحة: إذا لم يظهر جهازك في القائمة، اختر "قارئ باركود (Keyboard Wedge)" - يعمل مع 99% من الأجهزة بدون إعدادات'
                    : '💡 Tip: If your device doesn\'t appear, select "Barcode Scanner (Keyboard Wedge)" - works with 99% of devices without configuration'
                  }
                </p>
              </div>
            </div>

            {/* Status Indicator */}
            {autoScanEnabled && (
              <div className="mt-4 p-4 bg-green-50 border-2 border-green-300 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✅</span>
                  <div>
                    <p className="font-semibold text-green-800">
                      {t('settings.autoScanEnabled')}
                    </p>
                    <p className="text-sm text-green-700">
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

        {/* قسم مشاركة اللينك */}
        <div className="border-t pt-6 mt-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span>🔗</span>
            <span>{t('settings.networkAccess')}</span>
          </h2>

          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6 border-2 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">
                  {t('settings.shareLink')}
                </h3>
                <p className="text-sm text-gray-600">
                  {t('settings.shareLinkDescription')}
                </p>
              </div>
              <button
                onClick={() => setShowLinkModal(true)}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-indigo-700 font-bold flex items-center gap-2 transition-all hover:scale-105 shadow-lg"
              >
                <span>🔗</span>
                <span>{t('settings.showLink')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* قسم التحديثات */}
        <div className="border-t pt-6 mt-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span>🔄</span>
            <span>{locale === 'ar' ? 'التحديثات' : 'Updates'}</span>
          </h2>

          {/* Error notification */}
          {updateError && (
            <div className="mb-4 bg-gradient-to-br from-red-500 to-red-600 text-white p-4 rounded-xl shadow-lg animate-slideDown border border-red-400">
              <div className="flex items-center gap-3">
                <span className="text-2xl">❌</span>
                <div className="flex-1">
                  <p className="font-bold">{locale === 'ar' ? 'خطأ في التحديث' : 'Update Error'}</p>
                  <p className="text-sm opacity-90">{updateError}</p>
                </div>
                <button
                  onClick={() => setUpdateError(null)}
                  className="text-white/70 hover:text-white transition-colors text-xl"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Success notification - up to date */}
          {showUpdateSuccess && (
            <div className="mb-4 bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-4 rounded-xl shadow-lg animate-slideDown border border-emerald-400">
              <div className="flex items-center gap-3">
                <span className="text-3xl">✨</span>
                <div className="flex-1">
                  <p className="font-bold text-lg">
                    {locale === 'ar' ? 'أنت تستخدم أحدث إصدار! 🎉' : 'You\'re up to date! 🎉'}
                  </p>
                  <p className="text-sm opacity-90">
                    {locale === 'ar'
                      ? 'النسخة 1.0.13 هي أحدث إصدار متاح'
                      : 'Version 1.0.13 is the latest available'}
                  </p>
                </div>
                <button
                  onClick={() => setShowUpdateSuccess(false)}
                  className="text-white/70 hover:text-white transition-colors text-xl"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Update available notification */}
          {updateInfo && (
            <div className="mb-4 bg-gradient-to-br from-green-500 to-green-600 text-white p-5 rounded-xl shadow-lg animate-slideDown border border-green-400">
              <div className="flex items-start gap-3">
                <span className="text-3xl">🎉</span>
                <div className="flex-1">
                  <p className="font-bold mb-2 text-xl">
                    {locale === 'ar' ? 'تحديث جديد متاح!' : 'New Update Available!'}
                  </p>

                  {/* Current vs Latest */}
                  <div className="bg-white/20 rounded-lg p-3 mb-3 backdrop-blur-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs opacity-90">
                        {locale === 'ar' ? 'الإصدار الحالي:' : 'Current:'}
                      </span>
                      <span className="font-bold">1.0.13</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs opacity-90">
                        {locale === 'ar' ? 'الإصدار الجديد:' : 'Latest:'}
                      </span>
                      <span className="font-bold text-yellow-200">{updateInfo.version}</span>
                    </div>
                  </div>

                  {/* Release Notes Preview */}
                  {updateInfo.releaseNotes && (
                    <div className="bg-white/10 rounded-lg p-2 mb-3 max-h-20 overflow-y-auto text-xs opacity-90">
                      {updateInfo.releaseNotes.split('\n').slice(0, 3).join('\n')}
                      {updateInfo.releaseNotes.split('\n').length > 3 && '...'}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleDownloadUpdate}
                      className="flex-1 bg-white text-green-600 px-4 py-2.5 rounded-lg font-bold hover:bg-green-50 hover:shadow-lg transition-all transform hover:scale-105"
                    >
                      <span className="flex items-center justify-center gap-2">
                        📥
                        {locale === 'ar' ? 'تحميل التحديث' : 'Download Update'}
                      </span>
                    </button>
                    <button
                      onClick={() => setUpdateInfo(null)}
                      className="px-4 py-2.5 rounded-lg font-bold bg-white/20 hover:bg-white/30 transition-colors"
                    >
                      {locale === 'ar' ? 'لاحقاً' : 'Later'}
                    </button>
                  </div>

                  <p className="text-xs opacity-75 mt-2 text-center">
                    {locale === 'ar'
                      ? 'سيتم فتح صفحة التحميل في متصفح جديد'
                      : 'Download page will open in browser'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Main update check card */}
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border-2 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <span>⬇️</span>
                  <span>{locale === 'ar' ? 'التحقق من التحديثات' : 'Check for Updates'}</span>
                </h3>
                <p className="text-sm text-gray-600 mb-2">
                  {locale === 'ar'
                    ? 'تحقق من وجود تحديثات جديدة للتطبيق'
                    : 'Check if new updates are available'}
                </p>
                <p className="text-xs text-gray-500">
                  {locale === 'ar'
                    ? 'النسخة الحالية: 1.0.13'
                    : 'Current version: 1.0.13'
                  }
                </p>
              </div>
              <button
                onClick={handleCheckForUpdates}
                disabled={isCheckingUpdates}
                className={`bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg ${
                  isCheckingUpdates
                    ? 'opacity-70 cursor-not-allowed'
                    : 'hover:from-blue-700 hover:to-cyan-700 hover:scale-105 active:scale-95'
                }`}
              >
                {isCheckingUpdates ? (
                  <>
                    <span className="inline-block animate-spin">⏳</span>
                    <span>{locale === 'ar' ? 'جاري التحقق...' : 'Checking...'}</span>
                  </>
                ) : (
                  <>
                    <span>🔍</span>
                    <span>{locale === 'ar' ? 'التحقق من التحديثات' : 'Check for Updates'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* قسم الدعم الفني */}
        <div className="border-t pt-6 mt-6">
          <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span>📞</span>
            <span>{t('settings.technicalSupport')}</span>
          </h2>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                  <span>💬</span>
                  <span>{t('settings.technicalSupport')}</span>
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  {t('settings.supportDescription')}
                </p>
                <p className="text-sm font-semibold text-green-700 flex items-center gap-2">
                  <span>📱</span>
                  <span>01028518754</span>
                </p>
              </div>
              <a
                href="https://wa.me/201028518754"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-bold flex items-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg"
              >
                <span className="text-xl">💬</span>
                <span>{t('settings.contactSupport')}</span>
              </a>
            </div>
          </div>
        </div>

        {/* Powered by FitBoost */}
        <div className="border-t pt-6 mt-6">
          <div className="text-center">
            <a
              href="https://www.fitboost.website/en"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2"
            >
              <span className="text-sm text-gray-500">{t('settings.poweredBy')}</span>
              <img
                src="/FB.png"
                alt="FitBoost"
                className="h-6 w-auto"
              />
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

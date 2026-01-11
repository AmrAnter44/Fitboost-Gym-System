'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '../../contexts/LanguageContext'
import { useDeviceSettings } from '../../contexts/DeviceSettingsContext'
import LinkModal from '../../components/LinkModal'
import { Html5Qrcode } from 'html5-qrcode'

export default function SettingsPage() {
  const router = useRouter()
  const { locale, setLanguage, t, direction } = useLanguage()
  const { selectedScanner, setSelectedScanner, autoScanEnabled, setAutoScanEnabled } = useDeviceSettings()
  const [user, setUser] = useState<any>(null)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [devices, setDevices] = useState<any[]>([])
  const [loadingDevices, setLoadingDevices] = useState(false)
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  // استمع لأحداث التحديث عشان نوقف loading
  useEffect(() => {
    if (typeof window === 'undefined') return

    const electron = (window as any).electron
    if (!electron?.isElectron) return

    const handleUpdateResult = () => {
      setIsCheckingUpdates(false)
    }

    // استمع لكل النتائج الممكنة
    electron.onUpdateAvailable?.(handleUpdateResult)
    electron.onUpdateNotAvailable?.(handleUpdateResult)
    electron.onUpdateError?.(handleUpdateResult)

    return () => {
      electron.offUpdateListeners?.()
    }
  }, [])

  // تحديث خيار barcode scanner عند تغيير اللغة
  useEffect(() => {
    const barcodeScannerOption = {
      id: 'keyboard-wedge-scanner',
      label: locale === 'ar' ? 'قارئ باركود (Keyboard Wedge)' : 'Barcode Scanner (Keyboard Wedge)',
      kind: 'barcodescanner'
    }

    // إذا كانت القائمة فارغة أو تحتوي على barcode scanner فقط، نضيفه
    if (devices.length === 0) {
      setDevices([barcodeScannerOption])
    } else if (devices.length > 0 && devices[0]?.kind === 'barcodescanner') {
      // تحديث barcode scanner مع الاحتفاظ بالأجهزة الأخرى
      setDevices([barcodeScannerOption, ...devices.slice(1)])
    }
  }, [locale])

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
      // قراءة جميع الأجهزة المتصلة (كاميرات، ماكينات باركود، إلخ)
      const allDevices = await navigator.mediaDevices.enumerateDevices()

      // فلترة الأجهزة لتشمل videoinput (كاميرات) و audioinput (بعض الباركود سكانرز)
      const inputDevices = allDevices.filter(
        device => device.kind === 'videoinput' || device.kind === 'audioinput'
      )

      // تحويل الأجهزة للصيغة المطلوبة
      const formattedDevices = inputDevices.map(device => ({
        id: device.deviceId,
        label: device.label || `${device.kind === 'videoinput' ? 'Camera' : 'Input Device'} ${device.deviceId.substring(0, 8)}`,
        kind: device.kind
      }))

      // إضافة خيار barcode scanner يدوياً لأنها تعمل بنظام keyboard wedge
      const barcodeScannerOption = {
        id: 'keyboard-wedge-scanner',
        label: locale === 'ar' ? 'قارئ باركود (Keyboard Wedge)' : 'Barcode Scanner (Keyboard Wedge)',
        kind: 'barcodescanner'
      }

      setDevices([barcodeScannerOption, ...formattedDevices])
    } catch (error) {
      console.error('Error detecting devices:', error)
      // في حالة الخطأ، نضيف خيار barcode scanner على الأقل
      const barcodeScannerOption = {
        id: 'keyboard-wedge-scanner',
        label: locale === 'ar' ? 'قارئ باركود (Keyboard Wedge)' : 'Barcode Scanner (Keyboard Wedge)',
        kind: 'barcodescanner'
      }
      setDevices([barcodeScannerOption])
    } finally {
      setLoadingDevices(false)
    }
  }

  const handleDeviceChange = (deviceId: string) => {
    if (deviceId === 'none') {
      setSelectedScanner(undefined)
    } else {
      setSelectedScanner(deviceId)
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
            <div className="mb-6 p-4 bg-white rounded-lg border-2 border-gray-200">
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

            {/* Device Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                {t('settings.selectDevice')}
              </label>

              {loadingDevices && (
                <div className="p-4 bg-blue-50 rounded-xl text-blue-700 text-center">
                  <span className="animate-spin inline-block">⏳</span> {locale === 'ar' ? 'جاري الكشف عن الكاميرات...' : 'Detecting cameras...'}
                </div>
              )}

              {!loadingDevices && (
                <div className="space-y-3">
                  <select
                    value={selectedScanner || 'none'}
                    onChange={(e) => handleDeviceChange(e.target.value)}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value="none">{t('settings.defaultDevice')}</option>
                    {devices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.kind === 'barcodescanner' ? '🔦' : device.kind === 'videoinput' ? '📹' : '🔌'} {device.label}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={detectDevices}
                    className="text-sm text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                  >
                    <span>📹</span>
                    <span>{locale === 'ar' ? 'اكتشف الكاميرات' : 'Detect Cameras'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Info Message */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-300 rounded-lg text-blue-800 text-sm">
              💡 {locale === 'ar'
                ? 'نصيحة: اختر "قارئ باركود (Keyboard Wedge)" إذا كنت تستخدم ماسح باركود USB. الكاميرات مخصصة لمسح QR Code من الموبايل فقط.'
                : 'Tip: Select "Barcode Scanner (Keyboard Wedge)" if you are using a USB barcode scanner. Cameras are for QR Code scanning from mobile only.'
              }
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
        {typeof window !== 'undefined' && (window as any).electron?.isElectron && (
          <div className="border-t pt-6 mt-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <span>🔄</span>
              <span>{locale === 'ar' ? 'التحديثات' : 'Updates'}</span>
            </h2>

            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border-2 border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                    <span>⬇️</span>
                    <span>{locale === 'ar' ? 'التحديثات التلقائية' : 'Automatic Updates'}</span>
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">
                    {locale === 'ar'
                      ? 'يتم فحص التحديثات تلقائياً كل 10 دقائق'
                      : 'Updates are checked automatically every 10 minutes'
                    }
                  </p>
                  <p className="text-xs text-gray-500">
                    {locale === 'ar'
                      ? 'النسخة الحالية: 1.0.0'
                      : 'Current version: 1.0.0'
                    }
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsCheckingUpdates(true)
                    const electron = (window as any).electron
                    electron?.checkForUpdates?.()
                  }}
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
        )}

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
    </div>
  )
}

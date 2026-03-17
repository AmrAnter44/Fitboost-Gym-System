'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../../../contexts/LanguageContext'
import { useToast } from '../../../contexts/ToastContext'
import QRCode from 'qrcode'
import { getWhatsAppBrowserClient } from '../../../lib/whatsappClient'

export default function WhatsAppSettingsPage() {
  const { t } = useLanguage()
  const toast = useToast()
  const [status, setStatus] = useState<{
    isReady: boolean
    qrCode: string | null
    hasClient: boolean
  } | null>(null)
  const [qrCodeImage, setQrCodeImage] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [connectionProgress, setConnectionProgress] = useState<{percent: number, message: string} | null>(null)
  const [testPhone, setTestPhone] = useState('')
  const [testMessage, setTestMessage] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  // 🔧 Improvement: Prevent double-click and track operation type
  const [operationType, setOperationType] = useState<'initializing' | 'reconnecting' | 'resetting' | null>(null)
  // 🔧 Improvement: Better error display
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // تعيين الرسالة الافتراضية بناءً على اللغة
  useEffect(() => {
    const defaultMessage = t('common.language') === 'ar'
      ? 'مرحباً! هذه رسالة تجريبية من نظام Fitboost 💪'
      : 'Hello! This is a test message from Fitboost system 💪'
    setTestMessage(defaultMessage)
  }, [t])
  const [isElectron, setIsElectron] = useState(false)

  // 🔧 Improvement: Memory leak prevention - Properly cleanup event listeners
  useEffect(() => {
    const electron = typeof window !== 'undefined' && (window as any).electron
    const hasElectron = !!electron?.whatsapp
    setIsElectron(hasElectron)

    // Electron Mode - Use IPC
    if (hasElectron) {
      // الاستماع لأحداث WhatsApp عبر IPC
      electron.whatsapp.onQR((qr: string) => {
        console.log('📱 [Electron] QR Code received:', qr.substring(0, 50) + '...');
        setStatus(prev => ({
          hasClient: prev?.hasClient ?? true,
          isReady: false,
          qrCode: qr
        }));
        setConnectionProgress(null);
        setOperationType(null);
      });

      electron.whatsapp.onReady(() => {
        console.log('✅ [Electron] WhatsApp ready');
        setStatus(prev => ({
          hasClient: true,
          isReady: true,
          qrCode: null
        }));
        setConnectionProgress(null);
        setOperationType(null);
        setErrorMessage(null);
        toast.success(`✅ ${t('settings.whatsapp.toast.connected')}`);
      });

      electron.whatsapp.onDisconnected((reason: string) => {
        console.log('❌ [Electron] WhatsApp disconnected:', reason);
        setStatus(prev => ({
          hasClient: prev?.hasClient ?? true,
          isReady: false,
          qrCode: null
        }));
        setConnectionProgress(null);
        setOperationType(null);
        toast.error(`❌ ${t('settings.whatsapp.toast.disconnected')}`);
      });

      electron.whatsapp.onAuthFailure((msg: string) => {
        console.error('❌ [Electron] Auth failure:', msg);
        setErrorMessage(`${t('settings.whatsapp.toast.authFailed')}: ${msg}`);
        setOperationType(null);
        toast.error(`❌ ${t('settings.whatsapp.toast.authFailed')}`);
      });

      electron.whatsapp.onLoadingScreen((percent: number, message: string) => {
        console.log(`⏳ [Electron] Loading: ${percent}% - ${message}`);
        setConnectionProgress({ percent, message });
      });

      return () => {
        console.log('🧹 [Electron] Cleaning up WhatsApp event listeners');
        electron.whatsapp.offAllListeners();
      };
    }
    // Browser Mode - Use SSE
    else {
      const browserClient = getWhatsAppBrowserClient();

      // Setup event listeners for browser mode
      const onQR = (qr: string) => {
        console.log('📱 [Browser] QR Code received:', qr.substring(0, 50) + '...');
        setStatus(prev => ({
          hasClient: prev?.hasClient ?? true,
          isReady: false,
          qrCode: qr
        }));
        setConnectionProgress(null);
        setOperationType(null);
      };

      const onReady = () => {
        console.log('✅ [Browser] WhatsApp ready');
        setStatus(prev => ({
          hasClient: true,
          isReady: true,
          qrCode: null
        }));
        setConnectionProgress(null);
        setOperationType(null);
        setErrorMessage(null);
        toast.success(`✅ ${t('settings.whatsapp.toast.connected')}`);
      };

      const onConnecting = (data: { message: string; percent: number }) => {
        console.log(`⏳ [Browser] Connecting: ${data.percent}%`);
        setConnectionProgress(data);
      };

      const onDisconnected = (reason: string) => {
        console.log('❌ [Browser] WhatsApp disconnected:', reason);
        setStatus(prev => ({
          hasClient: prev?.hasClient ?? true,
          isReady: false,
          qrCode: null
        }));
        setConnectionProgress(null);
        setOperationType(null);
        toast.error(`❌ ${t('settings.whatsapp.toast.disconnected')}`);
      };

      browserClient.on('qr', onQR);
      browserClient.on('ready', onReady);
      browserClient.on('connecting', onConnecting);
      browserClient.on('disconnected', onDisconnected);

      return () => {
        console.log('🧹 [Browser] Cleaning up WhatsApp event listeners');
        browserClient.off('qr', onQR);
        browserClient.off('ready', onReady);
        browserClient.off('connecting', onConnecting);
        browserClient.off('disconnected', onDisconnected);
      };
    }
  }, [t, toast]);

  // جلب حالة الواتساب كل 3 ثوان
  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 3000)
    return () => clearInterval(interval)
  }, [isElectron])

  // تحويل QR code text إلى صورة
  useEffect(() => {
    if (status?.qrCode) {
      console.log('🔄 Converting QR code to image...');
      QRCode.toDataURL(status.qrCode, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
        .then(url => {
          console.log('✅ QR Code image generated successfully');
          setQrCodeImage(url);
        })
        .catch(err => {
          console.error('❌ Error generating QR code:', err);
          // Fallback: عرض QR text مباشرة
          setQrCodeImage('');
        })
    } else {
      console.log('⚪ No QR code to display');
      setQrCodeImage('');
    }
  }, [status?.qrCode])

  const fetchStatus = async () => {
    try {
      if (isElectron && (window as any).electron?.whatsapp) {
        // Electron Mode - Use IPC
        const data = await (window as any).electron.whatsapp.getStatus()
        setStatus(data)
      } else {
        // Browser Mode - Use API
        const browserClient = getWhatsAppBrowserClient()
        const data = await browserClient.getStatus()
        setStatus(data)
      }
    } catch (error) {
      console.error('Error fetching WhatsApp status:', error)
    }
  }

  const handleInitialize = async () => {
    // 🔧 Prevent double-click
    if (operationType) return;

    setLoading(true)
    setOperationType('initializing')
    setErrorMessage(null)

    try {
      let result;

      if (isElectron && (window as any).electron?.whatsapp) {
        // Electron Mode - Use IPC
        result = await (window as any).electron.whatsapp.init()
      } else {
        // Browser Mode - Use API
        const browserClient = getWhatsAppBrowserClient()
        result = await browserClient.init()
      }

      if (result.success) {
        toast.success(`✅ ${t('settings.whatsapp.toast.initialized')}`)
        fetchStatus()
      } else {
        const errorMsg = `${t('settings.whatsapp.toast.initFailed')}: ${result.error || ''}`
        setErrorMessage(errorMsg)
        toast.error(`❌ ${errorMsg}`)
      }
    } catch (error) {
      console.error('Error initializing WhatsApp:', error)
      const errorMsg = `${t('settings.whatsapp.toast.initError')}: ${error instanceof Error ? error.message : String(error)}`
      setErrorMessage(errorMsg)
      toast.error(`❌ ${errorMsg}`)
    } finally {
      setLoading(false)
      setOperationType(null)
    }
  }

  const handleReconnect = async () => {
    // 🔧 Prevent double-click
    if (operationType) return;

    setLoading(true)
    setOperationType('reconnecting')
    setErrorMessage(null)

    try {
      console.log('🔄 Starting reconnect...')
      let result;

      if (isElectron && (window as any).electron?.whatsapp) {
        // Electron Mode - Use IPC
        result = await (window as any).electron.whatsapp.reconnect()
      } else {
        // Browser Mode - Use API
        const browserClient = getWhatsAppBrowserClient()
        result = await browserClient.reconnect()
      }

      if (result.success) {
        toast.success(`✅ ${t('settings.whatsapp.toast.reconnectSuccess')}`)
        fetchStatus()
      } else {
        const errorMsg = `${t('settings.whatsapp.toast.reconnectFailed')}: ${result.error || ''}`
        setErrorMessage(errorMsg)
        toast.error(`❌ ${errorMsg}`)
      }
    } catch (error) {
      console.error('Error reconnecting WhatsApp:', error)
      const errorMsg = `${t('settings.whatsapp.toast.reconnectError')}: ${error instanceof Error ? error.message : String(error)}`
      setErrorMessage(errorMsg)
      toast.error(`❌ ${errorMsg}`)
    } finally {
      setLoading(false)
      setOperationType(null)
    }
  }

  const handleResetSession = async () => {
    // 🔧 Prevent double-click
    if (operationType) return;

    setLoading(true)
    setOperationType('resetting')
    setErrorMessage(null)

    try {
      console.log('🔄 Starting reset session...')
      let result;

      if (isElectron && (window as any).electron?.whatsapp) {
        // Electron Mode - Use IPC
        result = await (window as any).electron.whatsapp.resetSession()
      } else {
        // Browser Mode - Use API
        const browserClient = getWhatsAppBrowserClient()
        result = await browserClient.resetSession()
      }

      if (result.success) {
        toast.success(`✅ ${t('settings.whatsapp.toast.resetSuccess')}`)
        fetchStatus()
      } else {
        const errorMsg = `${t('settings.whatsapp.toast.resetFailed')}: ${result.error || ''}`
        setErrorMessage(errorMsg)
        toast.error(`❌ ${errorMsg}`)
      }
    } catch (error) {
      console.error('Error resetting session:', error)
      const errorMsg = `${t('settings.whatsapp.toast.resetError')}: ${error instanceof Error ? error.message : String(error)}`
      setErrorMessage(errorMsg)
      toast.error(`❌ ${errorMsg}`)
    } finally {
      setLoading(false)
      setOperationType(null)
    }
  }

  const handleSendTest = async () => {
    if (!testPhone || testPhone.length < 10) {
      toast.error(`⚠️ ${t('settings.whatsapp.toast.invalidPhone')}`)
      return
    }

    setSendingTest(true)
    try {
      let result;

      if (isElectron && (window as any).electron?.whatsapp) {
        // Electron Mode - Use IPC
        result = await (window as any).electron.whatsapp.sendMessage(testPhone, testMessage)
      } else {
        // Browser Mode - Use API
        const browserClient = getWhatsAppBrowserClient()
        result = await browserClient.sendMessage(testPhone, testMessage)
      }

      if (result.success) {
        toast.success(`✅ ${t('settings.whatsapp.toast.testSent')}`)
        setTestPhone('')
      } else {
        toast.error(`❌ ${result.error || t('settings.whatsapp.toast.sendFailed')}`)
      }
    } catch (error) {
      console.error('Error sending test message:', error)
      toast.error(`❌ ${t('settings.whatsapp.toast.sendError')}`)
    } finally {
      setSendingTest(false)
    }
  }

  return (
    <div className="container mx-auto p-4 md:p-6" dir={t('common.language') === 'ar' ? 'rtl' : 'ltr'}>
      {/* 🎨 Enhanced Header with Gradient */}
      <div className="mb-8 relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-500 via-emerald-600 to-teal-600 p-8 shadow-2xl">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-black text-white mb-3 flex items-center gap-3">
            <span className="text-5xl">💬</span>
            {t('settings.whatsapp.title')}
          </h1>
          <p className="text-green-50 text-lg font-medium">
            ⚡ {t('settings.whatsapp.subtitle')} - Powered by Baileys
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm text-green-100 flex-wrap">
            <span className="px-3 py-1 bg-white/20 rounded-full backdrop-blur-sm">
              🚀 Fast & Stable
            </span>
            <span className="px-3 py-1 bg-white/20 rounded-full backdrop-blur-sm">
              {isElectron ? '💻 Electron Mode' : '🌐 Browser Mode'}
            </span>
            <span className="px-3 py-1 bg-white/20 rounded-full backdrop-blur-sm">
              ⚡ Cross-Platform
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* حالة الاتصال */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>📊</span>
            <span className="dark:text-gray-100">{t('settings.whatsapp.connectionStatus')}</span>
          </h2>

          {!status ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">{t('settings.whatsapp.loading')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* حالة العميل */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="font-semibold dark:text-gray-200">{t('settings.whatsapp.client')}</span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  status.hasClient
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200'
                }`}>
                  {status.hasClient ? `✅ ${t('settings.whatsapp.initialized')}` : `⚪ ${t('settings.whatsapp.notInitialized')}`}
                </span>
              </div>

              {/* حالة الاتصال */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="font-semibold dark:text-gray-200">{t('settings.whatsapp.connection')}</span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  status.isReady
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : connectionProgress
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}>
                  {status.isReady ? `🟢 ${t('settings.whatsapp.connected')}` : connectionProgress ? `🟡 ${t('settings.whatsapp.connecting')}` : `🔴 ${t('settings.whatsapp.disconnected')}`}
                </span>
              </div>

              {/* Connection Progress Bar */}
              {connectionProgress && !status.isReady && (
                <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-gray-800 dark:to-gray-700 rounded-lg border-2 border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                      ⏳ {t('settings.whatsapp.connecting')}...
                    </span>
                    <span className="text-sm font-bold text-yellow-900 dark:text-yellow-100">
                      {connectionProgress.percent}%
                    </span>
                  </div>
                  <div className="w-full bg-yellow-200 dark:bg-gray-600 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-yellow-500 to-orange-500 h-3 rounded-full transition-all duration-300 flex items-center justify-end"
                      style={{ width: `${connectionProgress.percent}%` }}
                    >
                      <div className="w-2 h-2 bg-white rounded-full mr-1 animate-pulse"></div>
                    </div>
                  </div>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2 text-center">
                    {connectionProgress.message}
                  </p>
                </div>
              )}

              {/* 🔧 Error Message Display */}
              {errorMessage && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
                        ❌ خطأ في الاتصال
                      </p>
                      <p className="text-xs text-red-700 dark:text-red-400">
                        {errorMessage}
                      </p>
                    </div>
                    <button
                      onClick={() => setErrorMessage(null)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* 🔧 أزرار الاتصال - Prevent double-click */}
              {!status.hasClient ? (
                <button
                  onClick={handleInitialize}
                  disabled={!!operationType}
                  className="w-full bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold transition"
                >
                  {operationType === 'initializing' ? `⏳ ${t('settings.whatsapp.initializing')}` : `🚀 ${t('settings.whatsapp.initialize')}`}
                </button>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={handleReconnect}
                    disabled={!!operationType}
                    className={`w-full px-6 py-3 rounded-lg font-bold transition disabled:cursor-not-allowed ${
                      status.isReady
                        ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400'
                        : 'bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-400'
                    }`}
                  >
                    {operationType === 'reconnecting' ? `⏳ ${t('settings.whatsapp.reconnecting')}` : `🔄 ${t('settings.whatsapp.reconnect')}`}
                  </button>
                  <p className="text-center text-xs text-gray-600 dark:text-gray-400">
                    {status.isReady
                      ? t('settings.whatsapp.restartInfo')
                      : t('settings.whatsapp.reconnectInfo')
                    }
                  </p>

                  {/* زر بداية جديدة */}
                  <button
                    onClick={handleResetSession}
                    disabled={!!operationType}
                    className="w-full bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {operationType === 'resetting' ? `⏳ ${t('settings.whatsapp.resetting')}` : `🔥 ${t('settings.whatsapp.resetSession')}`}
                  </button>
                  <p className="text-center text-xs text-red-600 dark:text-red-400">
                    {t('settings.whatsapp.resetInfo')}
                  </p>
                </div>
              )}

              {/* 🎨 Enhanced QR Code with Animation */}
              {status.qrCode && (
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-800 dark:to-gray-700 p-6 shadow-xl border-4 border-green-400 dark:border-green-600">
                  {/* Animated background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 to-emerald-400/20 animate-pulse"></div>

                  <div className="relative z-10">
                    <div className="text-center mb-4">
                      <div className="inline-flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-full font-bold text-sm shadow-lg">
                        <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-green-300 opacity-75"></span>
                        <span className="relative">📱</span>
                        {t('settings.whatsapp.scanQR')}
                      </div>
                    </div>

                    <div className="flex justify-center">
                      {qrCodeImage ? (
                        <div className="relative">
                          {/* QR Container with gradient border */}
                          <div className="p-4 bg-white rounded-2xl shadow-2xl transform hover:scale-105 transition-transform duration-300">
                            <img
                              src={qrCodeImage}
                              alt="QR Code"
                              className="w-72 h-72 rounded-xl"
                            />
                          </div>
                          {/* Scan indicator corners */}
                          <div className="absolute top-2 left-2 w-8 h-8 border-t-4 border-l-4 border-green-500 rounded-tl-lg"></div>
                          <div className="absolute top-2 right-2 w-8 h-8 border-t-4 border-r-4 border-green-500 rounded-tr-lg"></div>
                          <div className="absolute bottom-2 left-2 w-8 h-8 border-b-4 border-l-4 border-green-500 rounded-bl-lg"></div>
                          <div className="absolute bottom-2 right-2 w-8 h-8 border-b-4 border-r-4 border-green-500 rounded-br-lg"></div>
                        </div>
                      ) : (
                        <div className="w-72 h-72 flex items-center justify-center bg-white dark:bg-gray-700 rounded-2xl shadow-2xl">
                          <div className="text-center">
                            <div className="relative">
                              <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-200 border-t-green-600 mx-auto mb-4"></div>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-8 h-8 bg-green-600 rounded-full animate-pulse"></div>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 font-semibold">جاري توليد QR Code...</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-4">
                      <p className="text-center text-sm text-gray-700 dark:text-gray-300 font-semibold mb-2">
                        📲 {t('settings.whatsapp.qrInstructions')}
                      </p>
                      <div className="flex items-center justify-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                          Scan within 60 seconds
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* رسالة النجاح */}
              {status.isReady && (
                <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-500 dark:border-green-700 rounded-lg p-4">
                  <p className="text-green-800 dark:text-green-300 font-bold text-center">
                    ✅ {t('settings.whatsapp.readyToSend')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* اختبار الإرسال */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🧪</span>
            <span className="dark:text-gray-100">{t('settings.whatsapp.testSending')}</span>
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                📞 {t('settings.whatsapp.phoneNumber')}
              </label>
              <input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                💬 {t('settings.whatsapp.message')}
              </label>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                placeholder={t('common.language') === 'ar' ? 'اكتب رسالتك التجريبية هنا...' : 'Write your test message here...'}
              />
            </div>

            <button
              onClick={handleSendTest}
              disabled={!status?.isReady || sendingTest || !testPhone}
              className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-bold transition flex items-center justify-center gap-2"
            >
              {sendingTest ? (
                <>{`⏳ ${t('settings.whatsapp.sending')}`}</>
              ) : (
                <>{`📲 ${t('settings.whatsapp.sendTestMessage')}`}</>
              )}
            </button>

            {!status?.isReady && (
              <p className="text-center text-sm text-amber-600 dark:text-amber-400">
                ⚠️ {t('settings.whatsapp.mustBeConnected')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* معلومات مهمة */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-3 flex items-center gap-2">
          <span>ℹ️</span>
          <span>{t('settings.whatsapp.importantInfo')}</span>
        </h3>
        <ul className="space-y-2 text-blue-700 dark:text-blue-300">
          <li>• {t('settings.whatsapp.infoItems.qrOnce')}</li>
          <li>• {t('settings.whatsapp.infoItems.sessionPersists')}</li>
          <li>• {t('settings.whatsapp.infoItems.autoSend')}</li>
          <li>• {t('settings.whatsapp.infoItems.fromConnected')}</li>
          <li>• {t('settings.whatsapp.infoItems.keepConnected')}</li>
        </ul>
      </div>
    </div>
  )
}

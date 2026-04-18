'use client'

import { useEffect, useState, useRef } from 'react'
import QRCode from 'qrcode'
import { useLanguage } from '../contexts/LanguageContext'
import { openWhatsApp } from '../lib/whatsappHelper'

interface LinkModalProps {
  onClose: () => void
}

export default function LinkModal({ onClose }: LinkModalProps) {
  const { direction } = useLanguage()
  const [url, setUrl] = useState<string>('')
  const [ip, setIp] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    fetchIP()
  }, [])

  const fetchIP = async () => {
    try {
      setLoading(true)

      // محاولة الحصول على IP من Electron API
      if (typeof window !== 'undefined' && (window as any).electron) {
        try {
          const electronIP = await (window as any).electron.getLocalIP()
          if (electronIP && electronIP !== 'localhost') {
            const generatedUrl = `http://${electronIP}:4001`
            setIp(electronIP)
            setUrl(generatedUrl)
            await generateQRCode(generatedUrl)
            setLoading(false)
            return
          }
        } catch (error) {
          console.error('Electron API error:', error)
        }
      }

      // Fallback: استخدام API endpoint
      const response = await fetch('/api/system/ip')
      if (response.ok) {
        const data = await response.json()
        setIp(data.ip)
        setUrl(data.url)
        await generateQRCode(data.url)
      } else {
        throw new Error('Failed to fetch IP')
      }
    } catch (error) {
      console.error('Error fetching IP:', error)
      setUrl('http://localhost:4001')
      setIp('localhost')
      await generateQRCode('http://localhost:4001')
    } finally {
      setLoading(false)
    }
  }

  const generateQRCode = async (text: string) => {
    try {
      const dataUrl = await QRCode.toDataURL(text, {
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
      setQrCodeDataUrl(dataUrl)
    } catch (error) {
      console.error('Error generating QR code:', error)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const shareOnWhatsApp = async () => {
    const message = `🏋️ رابط نظام إدارة الصالة الرياضية:\n\n${url}\n\nافتح الرابط من أي جهاز على نفس الشبكة للدخول للنظام`
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`

    // استخدام الـ helper الجديد
    await openWhatsApp(whatsappUrl)
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[10000]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      dir={direction}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-6xl w-full p-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <span>🔗</span>
            <span>مشاركة اللينك</span>
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-2xl leading-none"
            type="button"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="text-center py-6">
            <div className="inline-block animate-spin text-3xl mb-3">⏳</div>
            <p className="text-base text-gray-600 dark:text-gray-300">جاري الحصول على اللينك...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* QR Code - عمود واحد */}
            {qrCodeDataUrl && (
              <div className="flex justify-center items-start">
                <div className="bg-white dark:bg-gray-700 p-2 rounded-xl border-2 border-primary-200 dark:border-primary-700 shadow-lg">
                  <img src={qrCodeDataUrl} alt="QR Code" className="w-36 h-36" />
                </div>
              </div>
            )}

            {/* المعلومات - عمودين */}
            <div className="md:col-span-2 space-y-2">
              {/* IP Address و URL في صف واحد */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {/* IP Address */}
                <div className="bg-primary-50 dark:bg-primary-900/30 border-2 border-primary-300 dark:border-primary-700 rounded-lg p-2">
                  <p className="text-xs font-bold text-primary-800 dark:text-primary-300 mb-1">📡 IP Address:</p>
                  <p className="text-lg font-mono font-bold text-primary-600 dark:text-primary-400 text-center">
                    {ip}
                  </p>
                </div>

                {/* URL */}
                <div className="bg-green-50 dark:bg-green-900/30 border-2 border-green-300 dark:border-green-700 rounded-lg p-2">
                  <p className="text-xs font-bold text-green-800 dark:text-green-300 mb-1">🔗 اللينك الكامل:</p>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={url}
                      readOnly
                      className="flex-1 px-2 py-1 border border-green-400 dark:border-green-600 rounded text-xs font-mono bg-white dark:bg-gray-700 dark:text-white"
                      onClick={(e) => e.currentTarget.select()}
                    />
                    <button
                      type="button"
                      onClick={copyToClipboard}
                      className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 font-bold text-xs whitespace-nowrap"
                    >
                      {copied ? '✅' : '📋'}
                    </button>
                  </div>
                </div>
              </div>

              {/* معلومات */}
              <div className="bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-300 dark:border-yellow-700 rounded-lg p-2">
                <p className="text-xs font-bold text-yellow-800 dark:text-yellow-300 mb-1">ℹ️ كيفية الاستخدام:</p>
                <ul className="text-xs text-yellow-700 dark:text-yellow-400 space-y-0.5">
                  <li>• افتح اللينك من أي جهاز على <strong>نفس الشبكة</strong></li>
                  <li>• يمكنك استخدام الموبايل أو التابلت أو أي كمبيوتر آخر</li>
                  <li>• امسح QR Code بكاميرا الموبايل للدخول مباشرة</li>
                  <li>• شارك اللينك على واتساب لأي شخص على نفس الشبكة</li>
                </ul>
              </div>

              {/* أزرار */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={shareOnWhatsApp}
                  className="bg-green-500 text-white py-1.5 px-3 rounded-lg hover:bg-green-600 font-bold text-sm flex items-center justify-center gap-1"
                >
                  <span>💬</span>
                  <span>واتساب</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-1.5 px-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold text-sm"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

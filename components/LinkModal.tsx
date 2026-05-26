'use client'

import { useEffect, useState, useRef } from 'react'
import QRCode from 'qrcode'
import { useLanguage } from '../contexts/LanguageContext'
import { openWhatsApp } from '../lib/whatsappHelper'

interface LinkModalProps {
  onClose: () => void
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

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

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const fetchIP = async () => {
    try {
      setLoading(true)

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
    const message = `رابط نظام إدارة الصالة الرياضية:\n\n${url}\n\nافتح الرابط من أي جهاز على نفس الشبكة للدخول للنظام`
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    await openWhatsApp(whatsappUrl)
  }

  return (
    <div
      className="fixed inset-0 z-[10000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-backdrop-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="link-modal-title"
      dir={direction}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full p-4 ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <h3 id="link-modal-title" className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <svg className="w-6 h-6 text-primary-600 dark:text-primary-400" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
            <span>مشاركة اللينك</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            aria-label="إغلاق"
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
          >
            <svg className="w-5 h-5" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10" aria-busy="true" aria-live="polite">
            <svg className="w-12 h-12 mx-auto mb-3 text-primary-600 dark:text-primary-400 animate-spin" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-4.992 4.992l3.181-3.183a8.25 8.25 0 00-13.803 3.7M4.031 9.865v-4.992m0 0H8.99M3 12a9 9 0 0015.357 6.364l-1.06-1.06" />
            </svg>
            <p className="text-base text-gray-600 dark:text-gray-300">جاري الحصول على اللينك...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {qrCodeDataUrl && (
              <div className="flex justify-center items-start">
                <div className="bg-white dark:bg-gray-700 p-2 rounded-xl ring-1 ring-primary-200 dark:ring-primary-700 shadow-sm">
                  <img src={qrCodeDataUrl} alt="QR Code" className="w-36 h-36" />
                </div>
              </div>
            )}

            <div className="md:col-span-2 space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-200 dark:ring-primary-800 rounded-lg p-2">
                  <p className="text-xs font-bold text-primary-800 dark:text-primary-300 mb-1 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" {...stroke}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
                    </svg>
                    <span>IP Address:</span>
                  </p>
                  <p className="text-lg font-mono font-bold text-primary-600 dark:text-primary-400 text-center">
                    {ip}
                  </p>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-900/30 ring-1 ring-emerald-200 dark:ring-emerald-800 rounded-lg p-2">
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-1 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" {...stroke}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                    <span>اللينك الكامل:</span>
                  </p>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={url}
                      readOnly
                      className="flex-1 px-2 py-1 rounded text-xs font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-emerald-300 dark:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      onClick={(e) => e.currentTarget.select()}
                    />
                    <button
                      type="button"
                      onClick={copyToClipboard}
                      aria-label={copied ? 'تم النسخ' : 'نسخ'}
                      className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      {copied ? (
                        <svg className="w-4 h-4" {...stroke}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" {...stroke}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/30 ring-1 ring-amber-200 dark:ring-amber-800 rounded-lg p-2">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" {...stroke}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                  <span>كيفية الاستخدام:</span>
                </p>
                <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
                  <li>افتح اللينك من أي جهاز على <strong>نفس الشبكة</strong></li>
                  <li>يمكنك استخدام الموبايل أو التابلت أو أي كمبيوتر آخر</li>
                  <li>امسح QR Code بكاميرا الموبايل للدخول مباشرة</li>
                  <li>شارك اللينك على واتساب لأي شخص على نفس الشبكة</li>
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={shareOnWhatsApp}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
                >
                  <svg className="w-4 h-4" {...stroke}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                  <span>واتساب</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 py-2 px-3 rounded-lg font-bold text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
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

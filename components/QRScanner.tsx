'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import jsQR from 'jsqr'
import { useLanguage } from '@/contexts/LanguageContext'

interface QRScannerProps {
  onScan: (decodedText: string) => void
  onError?: (error: string) => void
  isScanning: boolean
  onClose: () => void
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

export default function QRScanner({ onScan, onError, isScanning, onClose }: QRScannerProps) {
  const { tr } = useLanguage()
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null)
  const [cameras, setCameras] = useState<any[]>([])
  const [selectedCamera, setSelectedCamera] = useState<string>('')
  const [scannerReady, setScannerReady] = useState(false)
  const [scanMode, setScanMode] = useState<'camera' | 'upload'>('camera')
  const [uploadingImage, setUploadingImage] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qrCodeRegionId = 'qr-reader'

  useEffect(() => {
    const requestCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        })

        stream.getTracks().forEach(track => track.stop())

        const devices = await Html5Qrcode.getCameras()
        if (devices && devices.length) {
          setCameras(devices)
          const backCamera = devices.find(d =>
            d.label?.toLowerCase().includes('back') ||
            d.label?.toLowerCase().includes('rear') ||
            d.label?.toLowerCase().includes('environment')
          )
          setSelectedCamera(backCamera?.id || devices[0].id)
        }
      } catch (err: any) {
        console.error('Error requesting camera permission:', err)
        onError?.(tr('يرجى السماح بالوصول للكاميرا من إعدادات المتصفح', 'Please allow camera access in your browser settings'))
      }
    }

    requestCameraPermission()

    return () => {
      stopScanner()
    }
  }, [])

  useEffect(() => {
    if (isScanning && selectedCamera && !scannerReady && scanMode === 'camera') {
      startScanner()
    } else if (!isScanning && scannerReady) {
      stopScanner()
    }
  }, [isScanning, selectedCamera, scanMode])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopScanner()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const startScanner = async () => {
    try {
      const html5QrCode = new Html5Qrcode(qrCodeRegionId)
      scannerRef.current = html5QrCode
      setScanner(html5QrCode)

      await html5QrCode.start(
        selectedCamera,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        (decodedText) => {
          onScan(decodedText)
          stopScanner()
        },
        (errorMessage) => {
          // intentionally ignore scan failures
        }
      )

      setScannerReady(true)
    } catch (err: any) {
      console.error('Error starting scanner:', err)
      onError?.(tr('فشل تشغيل الكاميرا: ', 'Failed to start camera: ') + err.message)
    }
  }

  const stopScanner = async () => {
    if (scannerRef.current && scannerReady) {
      try {
        await scannerRef.current.stop()
        scannerRef.current.clear()
        setScannerReady(false)
      } catch (err) {
        console.error('Error stopping scanner:', err)
      }
    }
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingImage(true)

    try {
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const img = new Image()
      img.src = imageDataUrl

      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Failed to get canvas context')

      canvas.width = img.width
      canvas.height = img.height
      context.drawImage(img, 0, 0)

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)

      const code = jsQR(imageData.data, imageData.width, imageData.height)

      if (code && code.data) {
        onScan(code.data)
        stopScanner()
      } else {
        onError?.(tr('لم يتم العثور على QR Code في الصورة. تأكد من وضوح الصورة.', 'No QR code found in the image. Make sure the image is clear.'))
      }
    } catch (err: any) {
      console.error('Error reading QR from image:', err)
      onError?.(tr('فشل قراءة الصورة: ', 'Failed to read image: ') + err.message)
    } finally {
      setUploadingImage(false)
      if (event.target) {
        event.target.value = ''
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-backdrop-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-scanner-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in">
        <div className="flex justify-between items-center mb-4">
          <h3 id="qr-scanner-title" className="text-lg sm:text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <svg className="w-7 h-7 text-primary-600 dark:text-primary-400" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
            <span>{tr('مسح QR Code', 'Scan QR Code')}</span>
          </h3>
          <button
            type="button"
            onClick={() => {
              stopScanner()
              onClose()
            }}
            aria-label={tr('إغلاق', 'Close')}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
          >
            <svg className="w-5 h-5" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => {
              setScanMode('camera')
              if (!scannerReady && isScanning && selectedCamera) {
                startScanner()
              }
            }}
            className={`flex-1 py-3 px-3 sm:px-4 rounded-lg font-bold transition-colors duration-200 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 ${
              scanMode === 'camera'
                ? 'bg-primary-600 text-primary-contrast'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <svg className="w-5 h-5" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
            <span className="text-sm sm:text-base">{tr('الكاميرا المباشرة', 'Live Camera')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setScanMode('upload')
              stopScanner()
            }}
            className={`flex-1 py-3 px-3 sm:px-4 rounded-lg font-bold transition-colors duration-200 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 ${
              scanMode === 'upload'
                ? 'bg-primary-600 text-primary-contrast'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <svg className="w-5 h-5" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <span className="text-sm sm:text-base">{tr('رفع صورة', 'Upload Image')}</span>
          </button>
        </div>

        {scanMode === 'camera' && cameras.length > 1 && (
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{tr('اختر الكاميرا:', 'Choose camera:')}</label>
            <select
              value={selectedCamera}
              onChange={(e) => {
                stopScanner()
                setSelectedCamera(e.target.value)
              }}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            >
              {cameras.map((camera) => (
                <option key={camera.id} value={camera.id}>
                  {camera.label || `Camera ${camera.id}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {scanMode === 'camera' && (
          <div className="mb-4 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
            <div id={qrCodeRegionId} className="w-full"></div>
          </div>
        )}

        {scanMode === 'upload' && (
          <div className="mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="w-full bg-primary-600 hover:bg-primary-700 text-primary-contrast py-10 sm:py-16 px-4 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
            >
              {uploadingImage ? (
                <div className="flex flex-col items-center gap-3">
                  <svg className="w-12 h-12 animate-spin" {...stroke}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-4.992 4.992l3.181-3.183a8.25 8.25 0 00-13.803 3.7M4.031 9.865v-4.992m0 0H8.99M3 12a9 9 0 0015.357 6.364l-1.06-1.06" />
                  </svg>
                  <span className="text-lg font-bold">{tr('جاري قراءة QR Code...', 'Reading QR code...')}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <svg className="w-14 h-14" {...stroke}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                  <span className="text-xl font-bold">{tr('التقط أو ارفع صورة QR Code', 'Capture or upload a QR code image')}</span>
                  <span className="text-sm opacity-90">{tr('اضغط لفتح الكاميرا أو اختيار صورة', 'Tap to open the camera or choose an image')}</span>
                </div>
              )}
            </button>
          </div>
        )}

        <div className="bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-800 p-4 rounded-lg mb-4">
          <p className="text-sm font-bold text-primary-800 dark:text-primary-300 flex items-center gap-2 mb-2">
            <svg className="w-4 h-4" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
            </svg>
            <span>{tr('تعليمات:', 'Instructions:')}</span>
          </p>
          {scanMode === 'camera' ? (
            <ul className="text-xs text-primary-700 dark:text-primary-400 mt-2 ms-4 list-disc space-y-1">
              <li>{tr('وجه الكاميرا نحو QR Code الخاص بالعميل', 'Point the camera at the client\'s QR code')}</li>
              <li>{tr('تأكد من وضوح الصورة والإضاءة الجيدة', 'Make sure the image is clear and well lit')}</li>
              <li>{tr('انتظر حتى يتم المسح تلقائياً', 'Wait for it to scan automatically')}</li>
            </ul>
          ) : (
            <ul className="text-xs text-primary-700 dark:text-primary-400 mt-2 ms-4 list-disc space-y-1">
              <li>{tr('اضغط على الزر لفتح كاميرا هاتفك', 'Tap the button to open your phone\'s camera')}</li>
              <li>{tr('صور QR Code الخاص بالعميل', 'Take a photo of the client\'s QR code')}</li>
              <li>{tr('أو اختر صورة موجودة من معرض الصور', 'Or choose an existing photo from your gallery')}</li>
              <li>{tr('سيتم قراءة الكود تلقائياً من الصورة', 'The code will be read automatically from the image')}</li>
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            stopScanner()
            onClose()
          }}
          autoFocus
          className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
        >
          {tr('إلغاء', 'Cancel')}
        </button>
      </div>
    </div>
  )
}

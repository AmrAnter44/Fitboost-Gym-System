'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import jsQR from 'jsqr'

interface QRScannerProps {
  onScan: (decodedText: string) => void
  onError?: (error: string) => void
  isScanning: boolean
  onClose: () => void
}

export default function QRScanner({ onScan, onError, isScanning, onClose }: QRScannerProps) {
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
    // ✅ طلب إذن الوصول للكاميرا أولاً
    const requestCameraPermission = async () => {
      try {
        // طلب الإذن صراحةً
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' } // الكاميرا الخلفية
        })

        // إيقاف الـ stream فوراً (فقط للتأكد من الإذن)
        stream.getTracks().forEach(track => track.stop())

        // الآن نحصل على قائمة الكاميرات
        const devices = await Html5Qrcode.getCameras()
        if (devices && devices.length) {
          setCameras(devices)
          // اختيار الكاميرا الخلفية تلقائياً (إن وجدت)
          const backCamera = devices.find(d =>
            d.label?.toLowerCase().includes('back') ||
            d.label?.toLowerCase().includes('rear') ||
            d.label?.toLowerCase().includes('environment')
          )
          setSelectedCamera(backCamera?.id || devices[0].id)
        }
      } catch (err: any) {
        console.error('Error requesting camera permission:', err)
        onError?.('يرجى السماح بالوصول للكاميرا من إعدادات المتصفح')
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
          // تجاهل أخطاء القراءة العادية
          // console.log('Scanning...', errorMessage)
        }
      )

      setScannerReady(true)
    } catch (err: any) {
      console.error('Error starting scanner:', err)
      onError?.('فشل تشغيل الكاميرا: ' + err.message)
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
      // قراءة الصورة
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      // إنشاء عنصر صورة لقراءة البيانات
      const img = new Image()
      img.src = imageDataUrl

      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })

      // إنشاء canvas لقراءة بيانات الصورة
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Failed to get canvas context')

      canvas.width = img.width
      canvas.height = img.height
      context.drawImage(img, 0, 0)

      // قراءة بيانات الصورة
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)

      // استخدام jsQR لقراءة الـ QR Code
      const code = jsQR(imageData.data, imageData.width, imageData.height)

      if (code && code.data) {
        onScan(code.data)
        stopScanner()
      } else {
        onError?.('❌ لم يتم العثور على QR Code في الصورة. تأكد من وضوح الصورة.')
      }
    } catch (err: any) {
      console.error('Error reading QR from image:', err)
      onError?.('❌ فشل قراءة الصورة: ' + err.message)
    } finally {
      setUploadingImage(false)
      // إعادة تعيين input لإمكانية رفع نفس الصورة مرة أخرى
      if (event.target) {
        event.target.value = ''
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-3 sm:p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-4 sm:p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
            <span className="text-2xl sm:text-3xl">📷</span>
            <span>مسح QR Code</span>
          </h3>
          <button
            onClick={() => {
              stopScanner()
              onClose()
            }}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-3xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Mode Selector */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => {
              setScanMode('camera')
              if (!scannerReady && isScanning && selectedCamera) {
                startScanner()
              }
            }}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
              scanMode === 'camera'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <span>📷</span>
            <span className="text-sm sm:text-base">الكاميرا المباشرة</span>
          </button>
          <button
            onClick={() => {
              setScanMode('upload')
              stopScanner()
            }}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
              scanMode === 'upload'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <span>🖼️</span>
            <span className="text-sm sm:text-base">رفع صورة</span>
          </button>
        </div>

        {/* Camera Selector - Only for camera mode */}
        {scanMode === 'camera' && cameras.length > 1 && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">اختر الكاميرا:</label>
            <select
              value={selectedCamera}
              onChange={(e) => {
                stopScanner()
                setSelectedCamera(e.target.value)
              }}
              className="w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:border-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              {cameras.map((camera) => (
                <option key={camera.id} value={camera.id}>
                  {camera.label || `Camera ${camera.id}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Scanner Region - Camera Mode */}
        {scanMode === 'camera' && (
          <div className="mb-4 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
            <div id={qrCodeRegionId} className="w-full"></div>
          </div>
        )}

        {/* Upload Region - Upload Mode */}
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
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="w-full bg-gradient-to-r from-primary-600 to-primary-600 text-white py-16 rounded-lg hover:from-primary-700 hover:to-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {uploadingImage ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin text-5xl">⏳</div>
                  <span className="text-lg font-medium">جاري قراءة QR Code...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <span className="text-6xl">📸</span>
                  <span className="text-xl font-bold">التقط أو ارفع صورة QR Code</span>
                  <span className="text-sm opacity-90">اضغط لفتح الكاميرا أو اختيار صورة</span>
                </div>
              )}
            </button>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-primary-50 border-r-4 border-primary-500 p-4 rounded-lg mb-4">
          <p className="text-sm text-primary-800">
            <strong>📱 تعليمات:</strong>
          </p>
          {scanMode === 'camera' ? (
            <ul className="text-xs text-primary-700 mt-2 mr-4 list-disc space-y-1">
              <li>وجه الكاميرا نحو QR Code الخاص بالعميل</li>
              <li>تأكد من وضوح الصورة والإضاءة الجيدة</li>
              <li>انتظر حتى يتم المسح تلقائياً</li>
            </ul>
          ) : (
            <ul className="text-xs text-primary-700 mt-2 mr-4 list-disc space-y-1">
              <li>اضغط على الزر لفتح كاميرا هاتفك</li>
              <li>صور QR Code الخاص بالعميل</li>
              <li>أو اختر صورة موجودة من معرض الصور</li>
              <li>سيتم قراءة الكود تلقائياً من الصورة</li>
            </ul>
          )}
        </div>

        {/* Actions */}
        <button
          onClick={() => {
            stopScanner()
            onClose()
          }}
          className="w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium"
        >
          إلغاء
        </button>
      </div>
    </div>
  )
}

// components/CameraModal.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

interface CameraModalProps {
  isOpen: boolean
  onClose: () => void
  onCapture: (file: File) => void
}

export default function CameraModal({ isOpen, onClose, onCapture }: CameraModalProps) {
  const { t } = useLanguage()
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCameraReady, setIsCameraReady] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // بدء الكاميرا
  useEffect(() => {
    if (!isOpen) {
      // إيقاف الكاميرا عند إغلاق المودال
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
        setStream(null)
        setIsCameraReady(false)
      }
      setCapturedImage(null)
      setError(null)
      return
    }

    // طلب الوصول للكاميرا
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user' // كاميرا أمامية، يمكن تغييرها لـ 'environment' للخلفية
          },
          audio: false
        })

        setStream(mediaStream)
        setError(null)

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
          // انتظار تحميل الفيديو
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play()
            setIsCameraReady(true)
          }
        }
      } catch (err: any) {
        console.error('خطأ في الوصول للكاميرا:', err)
        setError(t('members.form.cameraAccessFailed'))
      }
    }

    startCamera()

    // تنظيف عند إلغاء المودال
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [isOpen])

  // التقاط الصورة
  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current

    // ضبط حجم الـ canvas مع حجم الفيديو
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // رسم الصورة الحالية من الفيديو على الـ canvas
    const context = canvas.getContext('2d')
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height)

      // تحويل الـ canvas لـ data URL
      const imageData = canvas.toDataURL('image/jpeg', 0.9)
      setCapturedImage(imageData)
    }
  }

  // إعادة التصوير
  const handleRetake = () => {
    setCapturedImage(null)
  }

  // تأكيد واستخدام الصورة
  const handleConfirm = () => {
    if (!capturedImage) return

    try {
      // تحويل data URL لـ Blob بدون استخدام fetch (لتجنب CSP)
      const base64Data = capturedImage.split(',')[1]
      const byteCharacters = atob(base64Data)
      const byteNumbers = new Array(byteCharacters.length)

      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }

      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'image/jpeg' })
      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' })

      console.log('✅ تم تحويل الصورة بنجاح:', file.size, 'bytes')

      onCapture(file)
      onClose()
    } catch (err) {
      console.error('❌ خطأ في تحويل الصورة:', err)
      setError(t('members.form.imageProcessingFailed'))
      setCapturedImage(null) // إعادة تعيين للسماح بإعادة المحاولة
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold">{t('members.form.capturePhoto')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200 p-2 rounded-lg hover:bg-gray-100 dark:bg-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Camera Preview / Captured Image */}
        <div className="flex-1 bg-gray-900 flex items-center justify-center p-4 overflow-hidden">
          {error ? (
            <div className="text-center text-white">
              <svg className="w-16 h-16 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-lg">{error}</p>
            </div>
          ) : capturedImage ? (
            <img
              src={capturedImage}
              alt="الصورة الملتقطة"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          ) : (
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="max-w-full max-h-full object-contain rounded-lg"
              />
              {!isCameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <div className="text-center text-white">
                    <svg className="animate-spin h-12 w-12 mx-auto mb-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p>{t('members.form.cameraLoading')}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Canvas مخفي للالتقاط */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Controls */}
        <div className="p-4 border-t bg-gray-50 dark:bg-gray-700">
          {capturedImage ? (
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={handleRetake}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t('members.form.retakePhoto')}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {t('members.form.usePhoto')}
              </button>
            </div>
          ) : (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleCapture}
                disabled={!isCameraReady || !!error}
                className="px-8 py-4 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl font-medium flex items-center gap-3 text-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {t('members.form.capturePhoto')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

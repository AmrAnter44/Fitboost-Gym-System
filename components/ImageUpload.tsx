// components/ImageUpload.tsx
'use client'

import { useState, useRef } from 'react'
import CameraModal from './CameraModal'
import { useLanguage } from '../contexts/LanguageContext'

interface ImageUploadProps {
  currentImage?: string | null
  onImageChange: (imageUrl: string | null) => void
  disabled?: boolean
  label?: string
  variant?: 'profile' | 'idCard'
}

export default function ImageUpload({
  currentImage,
  onImageChange,
  disabled = false,
  label,
  variant = 'profile'
}: ImageUploadProps) {
  const { t } = useLanguage()
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentImage || null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // معاينة مباشرة
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    // رفع الصورة
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (response.ok) {
        onImageChange(data.imageUrl)
      } else {
        console.error(data.error || 'فشل رفع الصورة')
        setPreview(currentImage || null)
      }
    } catch (error) {
      console.error('خطأ في رفع الصورة:', error)
      console.error('حدث خطأ في رفع الصورة')
      setPreview(currentImage || null)
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = async () => {
    if (!currentImage) return

    try {
      await fetch(`/api/upload-image?url=${encodeURIComponent(currentImage)}`, {
        method: 'DELETE'
      })
    } catch (error) {
      console.error('خطأ في حذف الصورة:', error)
    }

    setPreview(null)
    onImageChange(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCameraCapture = async (file: File) => {
    // معاينة مباشرة
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    // رفع الصورة
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (response.ok) {
        onImageChange(data.imageUrl)
      } else {
        console.error(data.error || 'فشل رفع الصورة')
        setPreview(currentImage || null)
      }
    } catch (error) {
      console.error('خطأ في رفع الصورة:', error)
      console.error('حدث خطأ في رفع الصورة')
      setPreview(currentImage || null)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {(label || variant === 'profile') && (
        <label className="block text-sm font-medium mb-2">
          {label || t('members.form.profilePicture')}
        </label>
      )}

      <div className="flex flex-col items-center gap-4">
        {/* معاينة الصورة */}
        <div className="relative w-48 h-48 rounded-2xl overflow-hidden border-4 border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700">
          {preview ? (
            <>
              <img 
                src={preview} 
                alt="صورة العضو" 
                className="w-full h-full object-cover"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full hover:bg-red-700 shadow-lg"
                  title="حذف الصورة"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              {variant === 'idCard' ? (
                // أيقونة بطاقة الهوية
                <svg className="w-20 h-20 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                </svg>
              ) : (
                // أيقونة الشخص (للصورة الشخصية)
                <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
              <p className="text-sm">{t('members.form.noImage')}</p>
            </div>
          )}
        </div>

        {/* أزرار الرفع */}
        {!disabled && (
          <div className="flex gap-3">
            {/* Input للمعرض */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
              id="gallery-upload"
            />

            {/* زر الكاميرا */}
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              disabled={uploading}
              className={`
                inline-flex items-center gap-2 px-5 py-3
                bg-primary-600 text-white rounded-lg
                hover:bg-primary-700
                transition-all shadow-md hover:shadow-lg
                font-medium text-sm
                ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {uploading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>{t('members.form.uploadingImage')}</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{t('members.form.cameraButton')}</span>
                </>
              )}
            </button>

            {/* زر المعرض */}
            <label
              htmlFor="gallery-upload"
              className={`
                inline-flex items-center gap-2 px-5 py-3
                bg-gray-600 text-white rounded-lg
                hover:bg-gray-700 cursor-pointer
                transition-all shadow-md hover:shadow-lg
                font-medium text-sm
                ${uploading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
              `}
            >
              {uploading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>{t('members.form.uploadingImage')}</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{t('members.form.galleryButton')}</span>
                </>
              )}
            </label>
          </div>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          {t('members.form.imageFormatInfo')}<br />
          {t('members.form.maxImageSize')}
        </p>
      </div>

      {/* Camera Modal */}
      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  )
}
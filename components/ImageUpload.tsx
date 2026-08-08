// components/ImageUpload.tsx
'use client'

import { useState, useRef, useId } from 'react'
import CameraModal from './CameraModal'
import { useLanguage } from '../contexts/LanguageContext'
import { compressImage } from '../lib/imageCompress'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

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
  const inputId = useId()
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(currentImage || null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    setUploading(true)
    try {
      // ضغط الصورة قبل الرفع — صورة الموبايل 3-5MB بتنزل لـ ~100KB
      const compressed = await compressImage(file)
      const formData = new FormData()
      formData.append('image', compressed)

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
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    setUploading(true)
    try {
      const compressed = await compressImage(file)
      const formData = new FormData()
      formData.append('image', compressed)

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
        <label htmlFor={inputId} className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
          {label || t('members.form.profilePicture')}
        </label>
      )}

      <div className="flex flex-col items-center gap-4">
        <div className="relative w-48 h-48">
          {/*  صورة البروفايل دايرة (سيركل) — بطاقة الهوية تفضل مستطيلة */}
          <div className={`w-full h-full overflow-hidden ring-1 ring-gray-200 dark:ring-gray-700 bg-gray-100 dark:bg-gray-700 ${variant === 'profile' ? 'rounded-full' : 'rounded-2xl'}`}>
            {preview ? (
              <img
                src={preview}
                alt={t('members.form.profilePicture')}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
                {variant === 'idCard' ? (
                  <svg className="w-20 h-20 mb-2" {...stroke}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                  </svg>
                ) : (
                  <svg className="w-16 h-16 mb-2" {...stroke}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
                <p className="text-sm">{t('members.form.noImage')}</p>
              </div>
            )}
          </div>
          {/*  زر الحذف بره الـ overflow-hidden عشان مايتقصّش على حافة الدايرة */}
          {preview && !disabled && (
            <button
              type="button"
              onClick={handleRemoveImage}
              className={`absolute bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full shadow-md ring-2 ring-white dark:ring-gray-800 transition-colors duration-200 ${variant === 'profile' ? 'top-2 end-2' : 'top-1 end-1'}`}
              aria-label={t('members.form.removeImage') || 'Remove image'}
              title={t('members.form.removeImage') || 'Remove image'}
            >
              <svg className="w-4 h-4" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {!disabled && (
          <div className="flex gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
              id={inputId}
            />

            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              disabled={uploading}
              className={`inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-primary-contrast rounded-lg font-bold text-sm transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {uploading ? (
                <>
                  <svg className="animate-spin h-5 w-5" {...stroke}>
                    <circle className="opacity-25" cx="12" cy="12" r="10" />
                    <path className="opacity-75" d="M4 12a8 8 0 018-8" strokeLinecap="round" />
                  </svg>
                  <span>{t('members.form.uploadingImage')}</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" {...stroke}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{t('members.form.cameraButton')}</span>
                </>
              )}
            </button>

            <label
              htmlFor={inputId}
              className={`inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg cursor-pointer font-bold text-sm transition-colors duration-200 ${uploading ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}
            >
              {uploading ? (
                <>
                  <svg className="animate-spin h-5 w-5" {...stroke}>
                    <circle className="opacity-25" cx="12" cy="12" r="10" />
                    <path className="opacity-75" d="M4 12a8 8 0 018-8" strokeLinecap="round" />
                  </svg>
                  <span>{t('members.form.uploadingImage')}</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" {...stroke}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
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

      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  )
}

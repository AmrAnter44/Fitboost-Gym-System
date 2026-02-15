'use client'

import { useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

interface SuccessDialogProps {
  isOpen: boolean
  title: string
  message: string
  buttonText?: string
  onClose: () => void
  type?: 'success' | 'error' | 'info'
}

export default function SuccessDialog({
  isOpen,
  title,
  message,
  buttonText = 'حسناً',
  onClose,
  type = 'success'
}: SuccessDialogProps) {
  const { direction } = useLanguage()

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const typeColors = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      icon: '✅',
      iconBg: 'bg-green-100',
      button: 'bg-green-600 hover:bg-green-700'
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: '❌',
      iconBg: 'bg-red-100',
      button: 'bg-red-600 hover:bg-red-700'
    },
    info: {
      bg: 'bg-primary-50',
      border: 'border-primary-200',
      icon: 'ℹ️',
      iconBg: 'bg-primary-100',
      button: 'bg-primary-600 hover:bg-primary-700'
    }
  }

  const colors = typeColors[type]

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 border-4 ${colors.border}`}
        onClick={(e) => e.stopPropagation()}
        dir={direction}
      >
        <div className={`${colors.bg} p-6 rounded-t-xl`}>
          <div className="flex items-center gap-4">
            <div className={`${colors.iconBg} p-4 rounded-full`}>
              <span className="text-4xl">{colors.icon}</span>
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{title}</h3>
            </div>
          </div>
        </div>

        <div className="p-6">
          <p className="text-lg text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-line">
            {message}
          </p>
        </div>

        <div className="p-6 pt-0">
          <button
            type="button"
            onClick={onClose}
            className={`w-full ${colors.button} text-white py-3 px-6 rounded-lg font-bold text-lg transition transform hover:scale-105 shadow-lg`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  )
}

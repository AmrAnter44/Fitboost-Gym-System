'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'warning' | 'info'
  onClose: () => void
  duration?: number
  index?: number
}

export default function Toast({ message, type = 'info', onClose, duration = 4000, index = 0 }: ToastProps) {
  const { direction } = useLanguage()
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose()
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [duration])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      onClose()
    }, 300) // Animation duration
  }

  const colors = {
    success: {
      bg: 'bg-gradient-to-r from-green-500 to-green-600',
      border: 'border-green-400',
      progress: 'bg-green-300'
    },
    error: {
      bg: 'bg-gradient-to-r from-red-500 to-red-600',
      border: 'border-red-400',
      progress: 'bg-red-300'
    },
    warning: {
      bg: 'bg-gradient-to-r from-orange-500 to-orange-600',
      border: 'border-orange-400',
      progress: 'bg-orange-300'
    },
    info: {
      bg: 'bg-gradient-to-r from-primary-500 to-primary-600',
      border: 'border-primary-400',
      progress: 'bg-primary-300'
    }
  }

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  }

  const titles = {
    success: direction === 'rtl' ? 'نجح' : 'Success',
    error: direction === 'rtl' ? 'خطأ' : 'Error',
    warning: direction === 'rtl' ? 'تحذير' : 'Warning',
    info: direction === 'rtl' ? 'معلومات' : 'Info'
  }

  const topPosition = 20 + (index * 100) // Stack toasts vertically

  return (
    <div
      className={`fixed z-[10000] transition-all duration-300 ${
        isExiting
          ? 'opacity-0 translate-x-full'
          : 'opacity-100 translate-x-0'
      }`}
      style={{
        top: `${topPosition}px`,
        [direction === 'rtl' ? 'right' : 'left']: '20px',
        animation: isExiting ? 'none' : 'slideInToast 0.3s ease-out'
      }}
    >
      <div
        className={`${colors[type].bg} text-white rounded-xl shadow-2xl overflow-hidden min-w-[320px] max-w-md border-2 ${colors[type].border}`}
        dir={direction}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <span className="text-3xl flex-shrink-0">{icons[type]}</span>
          <div className="flex-1">
            <h4 className="font-bold text-lg">{titles[type]}</h4>
          </div>
          <button
            onClick={handleClose}
            className="text-white hover:bg-white dark:bg-gray-800/20 rounded-full w-8 h-8 flex items-center justify-center text-2xl font-bold transition flex-shrink-0"
            title={direction === 'rtl' ? 'إغلاق' : 'Close'}
          >
            ×
          </button>
        </div>

        {/* Message */}
        <div className="px-4 pb-4">
          <p className="text-sm font-medium whitespace-pre-line leading-relaxed">
            {message}
          </p>
        </div>

        {/* Progress Bar */}
        {duration > 0 && (
          <div className="h-1 bg-white dark:bg-gray-800/20 relative overflow-hidden">
            <div
              className={`h-full ${colors[type].progress}`}
              style={{
                animation: `shrinkWidth ${duration}ms linear`
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

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
  const { direction, t } = useLanguage()
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
    success: t('toast.success'),
    error: t('toast.error'),
    warning: t('toast.warning'),
    info: t('toast.info')
  }

  const topPosition = 16 + (index * 75) // Stack toasts vertically (more compact)

  return (
    <div
      className={`fixed z-[10000] transition-all duration-300 ${
        isExiting
          ? 'opacity-0 translate-x-full'
          : 'opacity-100 translate-x-0'
      }`}
      style={{
        top: `${topPosition}px`,
        [direction === 'rtl' ? 'right' : 'left']: '16px',
        animation: isExiting ? 'none' : 'slideInToast 0.3s ease-out'
      }}
    >
      <div
        className={`${colors[type].bg} text-white rounded-lg shadow-xl overflow-hidden min-w-[260px] max-w-sm border ${colors[type].border}`}
        dir={direction}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
          <span className="text-xl flex-shrink-0">{icons[type]}</span>
          <div className="flex-1">
            <h4 className="font-bold text-sm">{titles[type]}</h4>
          </div>
          <button
            onClick={handleClose}
            className="text-white hover:bg-white dark:bg-gray-800/20 rounded-full w-6 h-6 flex items-center justify-center text-xl font-bold transition flex-shrink-0"
            title={t('toast.close')}
          >
            ×
          </button>
        </div>

        {/* Message */}
        <div className="px-3 pb-2.5">
          <p className="text-xs font-medium whitespace-pre-line leading-snug">
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

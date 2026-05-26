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

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, viewBox: '0 0 24 24' } as const

const icons: Record<string, JSX.Element> = {
  success: (
    <svg className="w-5 h-5" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  ),
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
    }, 300)
  }

  const colors = {
    success: {
      bar: 'bg-emerald-500',
      accent: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
      progress: 'bg-emerald-500',
      iconRing: 'ring-emerald-200 dark:ring-emerald-800/60',
    },
    error: {
      bar: 'bg-red-500',
      accent: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300',
      progress: 'bg-red-500',
      iconRing: 'ring-red-200 dark:ring-red-800/60',
    },
    warning: {
      bar: 'bg-amber-500',
      accent: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
      progress: 'bg-amber-500',
      iconRing: 'ring-amber-200 dark:ring-amber-800/60',
    },
    info: {
      bar: 'bg-primary-500',
      accent: 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
      progress: 'bg-primary-500',
      iconRing: 'ring-primary-200 dark:ring-primary-800/60',
    },
  }

  const titles = {
    success: t('toast.success'),
    error: t('toast.error'),
    warning: t('toast.warning'),
    info: t('toast.info')
  }

  const topPosition = 16 + (index * 80)

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
      role="alert"
      aria-live="polite"
    >
      <div
        className="relative flex bg-white dark:bg-gray-800 rounded-xl shadow-xl ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden min-w-[280px] max-w-sm"
        dir={direction}
      >
        {/* Left accent bar */}
        <div className={`${colors[type].bar} w-1 flex-shrink-0`} aria-hidden="true" />

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3 px-3 pt-3 pb-2">
            <div className={`${colors[type].accent} ${colors[type].iconRing} ring-1 rounded-full p-1.5 flex-shrink-0`}>
              {icons[type]}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">{titles[type]}</h4>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 whitespace-pre-line leading-snug">
                {message}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md w-6 h-6 flex items-center justify-center transition-colors flex-shrink-0"
              title={t('toast.close')}
              aria-label={t('toast.close')}
            >
              <svg className="w-4 h-4" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {duration > 0 && (
            <div className="h-1 bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
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
    </div>
  )
}

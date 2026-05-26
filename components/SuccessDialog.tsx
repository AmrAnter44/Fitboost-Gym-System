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

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

const iconFor: Record<string, JSX.Element> = {
  success: (
    <svg className="w-7 h-7" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="w-7 h-7" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  info: (
    <svg className="w-7 h-7" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  ),
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
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape' || e.key === 'Enter') onClose()
      }
      window.addEventListener('keydown', onKey)
      return () => {
        document.body.style.overflow = 'unset'
        window.removeEventListener('keydown', onKey)
      }
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const typeColors = {
    success: {
      ring: 'ring-emerald-200 dark:ring-emerald-900/50',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
      button: 'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500',
    },
    error: {
      ring: 'ring-red-200 dark:ring-red-900/50',
      iconBg: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
      button: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500',
    },
    info: {
      ring: 'ring-primary-200 dark:ring-primary-900/50',
      iconBg: 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300',
      button: 'bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500',
    }
  }

  const colors = typeColors[type]

  return (
    <div
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[10000] p-4 animate-backdrop-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="success-dialog-title"
    >
      <div
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full ring-1 ${colors.ring} animate-modal-in overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
        dir={direction}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`${colors.iconBg} p-3 rounded-full flex items-center justify-center flex-shrink-0`}>
              {iconFor[type]}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h3 id="success-dialog-title" className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                {message}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className={`w-full ${colors.button} text-white py-2.5 px-5 rounded-lg font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  )
}

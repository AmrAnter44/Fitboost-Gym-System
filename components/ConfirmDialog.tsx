'use client'

import { useEffect, useRef } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  type?: 'danger' | 'warning' | 'info'
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

const iconFor: Record<string, JSX.Element> = {
  danger: (
    <svg className="w-7 h-7" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  ),
  warning: (
    <svg className="w-7 h-7" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" />
    </svg>
  ),
  info: (
    <svg className="w-7 h-7" {...stroke}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  ),
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  onConfirm,
  onCancel,
  type = 'warning'
}: ConfirmDialogProps) {
  const { direction } = useLanguage()
  const panelRef = useRef<HTMLDivElement>(null)

  useFocusTrap(panelRef, isOpen)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCancel()
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
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const typeColors = {
    danger: {
      ring: 'ring-red-200 dark:ring-red-900/50',
      iconBg: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400',
      confirmBtn: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500',
    },
    warning: {
      ring: 'ring-amber-200 dark:ring-amber-900/50',
      iconBg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
      confirmBtn: 'bg-amber-500 hover:bg-amber-600 focus-visible:ring-amber-400',
    },
    info: {
      ring: 'ring-primary-200 dark:ring-primary-900/50',
      iconBg: 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300',
      confirmBtn: 'bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500',
    }
  }

  const colors = typeColors[type]

  return (
    <div
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[10000] p-4 animate-backdrop-in"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        ref={panelRef}
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
              <h3 id="confirm-dialog-title" className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                {message}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-6 pb-6 flex-row-reverse">
          <button
            type="button"
            onClick={onConfirm}
            autoFocus={type !== 'danger'}
            className={`flex-1 ${colors.confirmBtn} text-white py-2.5 px-5 rounded-lg font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800`}
          >
            {confirmText}
          </button>
          <button
            type="button"
            onClick={onCancel}
            autoFocus={type === 'danger'}
            className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 px-5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  )
}

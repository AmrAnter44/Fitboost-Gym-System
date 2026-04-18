'use client'

import { useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

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
    danger: {
      bg: 'bg-red-50 dark:bg-red-900/30',
      border: 'border-red-200 dark:border-red-700',
      icon: '⚠️',
      iconBg: 'bg-red-100 dark:bg-red-900/50',
      confirmBtn: 'bg-red-600 hover:bg-red-700'
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/30',
      border: 'border-yellow-200 dark:border-yellow-700',
      icon: '⚡',
      iconBg: 'bg-yellow-100 dark:bg-yellow-900/50',
      confirmBtn: 'bg-yellow-600 hover:bg-yellow-700'
    },
    info: {
      bg: 'bg-primary-50 dark:bg-primary-900/30',
      border: 'border-primary-200 dark:border-primary-700',
      icon: 'ℹ️',
      iconBg: 'bg-primary-100 dark:bg-primary-900/50',
      confirmBtn: 'bg-primary-600 hover:bg-primary-700'
    }
  }

  const colors = typeColors[type]

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]"
      onClick={onCancel}
    >
      <div
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 border-4 ${colors.border}`}
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

        <div className="flex gap-3 p-6 pt-0">
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 ${colors.confirmBtn} text-white py-3 px-6 rounded-lg font-bold text-lg transition transform hover:scale-105 shadow-lg`}
          >
            {confirmText}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 px-6 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold text-lg transition"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  )
}

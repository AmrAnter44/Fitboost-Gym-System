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
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: '⚠️',
      iconBg: 'bg-red-100',
      confirmBtn: 'bg-red-600 hover:bg-red-700'
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      icon: '⚡',
      iconBg: 'bg-yellow-100',
      confirmBtn: 'bg-yellow-600 hover:bg-yellow-700'
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: 'ℹ️',
      iconBg: 'bg-blue-100',
      confirmBtn: 'bg-blue-600 hover:bg-blue-700'
    }
  }

  const colors = typeColors[type]

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]"
      onClick={onCancel}
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
              <h3 className="text-2xl font-bold text-gray-800">{title}</h3>
            </div>
          </div>
        </div>

        <div className="p-6">
          <p className="text-lg text-gray-700 leading-relaxed whitespace-pre-line">
            {message}
          </p>
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <button
            onClick={onConfirm}
            className={`flex-1 ${colors.confirmBtn} text-white py-3 px-6 rounded-lg font-bold text-lg transition transform hover:scale-105 shadow-lg`}
          >
            {confirmText}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-200 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-300 font-bold text-lg transition"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

interface ConfirmDeleteModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  itemName?: string
  loading?: boolean
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

export default function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemName,
  loading = false,
}: ConfirmDeleteModalProps) {
  const { direction } = useLanguage()

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !loading) onClose()
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
  }, [isOpen, loading, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-backdrop-in"
      onClick={() => !loading && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden ring-1 ring-red-200 dark:ring-red-900/50 animate-modal-in"
        dir={direction}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 p-3 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h2 id="delete-dialog-title" className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{title}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{message}</p>
            </div>
          </div>

          {itemName && (
            <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                {direction === 'rtl' ? 'العنصر المراد حذفه:' : 'Item to delete:'}
              </p>
              <p className="text-base font-bold text-red-700 dark:text-red-300 break-all">{itemName}</p>
            </div>
          )}

          <p className="mt-4 text-xs text-red-600 dark:text-red-400 font-semibold text-center">
            {direction === 'rtl' ? 'هذه العملية لا يمكن التراجع عنها' : 'This action cannot be undone'}
          </p>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex gap-2 flex-row-reverse">
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 bg-red-600 text-white px-5 py-2.5 rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center gap-2 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-4.992 4.992l3.181-3.183a8.25 8.25 0 00-13.803 3.7M4.031 9.865v-4.992m0 0H8.99M3 12a9 9 0 0015.357 6.364l-1.06-1.06" />
                </svg>
                <span>{direction === 'rtl' ? 'جاري الحذف...' : 'Deleting...'}</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9M5.79 5.79l1.05 13.88a2.25 2.25 0 002.244 2.08h5.832a2.25 2.25 0 002.244-2.08l1.05-13.88M5.79 5.79h12.42M5.79 5.79c.51-.061 1.024-.116 1.54-.165M18.21 5.79c-.51-.061-1.024-.116-1.54-.165m-9.34 0a51.86 51.86 0 019.34 0M9.13 5.625v-.916c0-1.18.91-2.164 2.09-2.201a51.96 51.96 0 013.32 0c1.18.037 2.09 1.022 2.09 2.201v.916" />
                </svg>
                <span>{direction === 'rtl' ? 'تأكيد الحذف' : 'Confirm Delete'}</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-5 py-2.5 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
          >
            {direction === 'rtl' ? 'إلغاء' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}

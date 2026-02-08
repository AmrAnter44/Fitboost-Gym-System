'use client'

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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden" dir={direction}>
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 text-white">
          <div className="flex items-center gap-3">
            <span className="text-4xl">⚠️</span>
            <h2 className="text-2xl font-bold">{title}</h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 text-lg mb-4">{message}</p>
          {itemName && (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600 mb-1">العنصر المراد حذفه:</p>
              <p className="text-xl font-bold text-red-700">{itemName}</p>
            </div>
          )}
          <p className="text-red-600 font-semibold text-center">
            ⚠️ هذه العملية لا يمكن التراجع عنها!
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400 transition flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>جاري الحذف...</span>
              </>
            ) : (
              <>
                <span>🗑️</span>
                <span>تأكيد الحذف</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

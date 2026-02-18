'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function KeyboardShortcuts() {
  const router = useRouter()
  const [showHelp, setShowHelp] = useState(false)

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Show help with Shift + ?
      if (e.shiftKey && e.key === '?') {
        e.preventDefault()
        setShowHelp(!showHelp)
        return
      }

      // Only trigger shortcuts with Ctrl/Cmd
      if (!e.ctrlKey && !e.metaKey) return

      switch (e.key.toLowerCase()) {
        case 'h':
          e.preventDefault()
          router.push('/')
          break
        case 'm':
          e.preventDefault()
          router.push('/members')
          break
        case 'p':
          e.preventDefault()
          router.push('/pt')
          break
        case 'r':
          e.preventDefault()
          router.push('/receipts')
          break
        case 'k':
          e.preventDefault()
          setShowHelp(!showHelp)
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [router, showHelp])

  if (!showHelp) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={() => setShowHelp(false)}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <span>⌨️</span>
            <span>اختصارات لوحة المفاتيح</span>
          </h2>
          <button
            onClick={() => setShowHelp(false)}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-200 text-2xl"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span className="text-gray-700 dark:text-gray-200">الصفحة الرئيسية</span>
            <kbd className="px-3 py-1.5 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm shadow-sm">
              Ctrl + H
            </kbd>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span className="text-gray-700 dark:text-gray-200">الأعضاء</span>
            <kbd className="px-3 py-1.5 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm shadow-sm">
              Ctrl + M
            </kbd>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span className="text-gray-700 dark:text-gray-200">PT</span>
            <kbd className="px-3 py-1.5 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm shadow-sm">
              Ctrl + P
            </kbd>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span className="text-gray-700 dark:text-gray-200">الإيصالات</span>
            <kbd className="px-3 py-1.5 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm shadow-sm">
              Ctrl + R
            </kbd>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span className="text-gray-700 dark:text-gray-200">هذه القائمة</span>
            <kbd className="px-3 py-1.5 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm shadow-sm">
              Ctrl + K
            </kbd>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 border-2 border-blue-200 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white">
          <p className="text-sm text-blue-800">
            💡 <strong>نصيحة:</strong> اضغط <kbd className="px-2 py-0.5 bg-white dark:bg-gray-800 border border-blue-300 rounded text-xs font-mono">Shift + ?</kbd> في أي وقت لعرض هذه القائمة
          </p>
        </div>
      </div>
    </div>
  )
}

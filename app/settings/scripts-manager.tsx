'use client'

import { useState, useEffect } from 'react'
import { useToast } from '../../contexts/ToastContext'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface ScriptExecution {
  id: string
  scriptName: string
  executedAt: string
  success: boolean
  error?: string
}

export default function ScriptsManager() {
  const toast = useToast()
  const [scripts, setScripts] = useState<ScriptExecution[]>([])
  const [loading, setLoading] = useState(true)

  const fetchScripts = async () => {
    try {
      const response = await fetch('/api/scripts')
      const data = await response.json()
      setScripts(data.scripts || [])
    } catch (error) {
      toast.error('فشل جلب السكريبتات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchScripts()
  }, [])

  const resetScript = async (scriptName: string) => {
    if (!confirm(`هل أنت متأكد من إعادة تعيين "${scriptName}"؟\nسيتم تنفيذه مرة أخرى عند التشغيل التالي.`)) {
      return
    }

    try {
      const response = await fetch('/api/scripts/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptName })
      })

      if (response.ok) {
        toast.success('تم إعادة تعيين السكريبت بنجاح')
        fetchScripts()
      } else {
        toast.error('فشل إعادة تعيين السكريبت')
      }
    } catch (error) {
      toast.error('حدث خطأ')
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6" aria-busy="true" aria-live="polite">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center">
            <svg {...stroke} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25M6.75 17.25 1.5 12l5.25-5.25M14.25 4.5l-4.5 15" />
            </svg>
          </span>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">إدارة السكريبتات</h2>
        </div>
        <p className="text-gray-500 dark:text-gray-400">جاري التحميل...</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center">
            <svg {...stroke} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25M6.75 17.25 1.5 12l5.25-5.25M14.25 4.5l-4.5 15" />
            </svg>
          </span>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">إدارة السكريبتات</h2>
        </div>
        <button
          onClick={fetchScripts}
          className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          aria-label="تحديث القائمة"
        >
          <svg {...stroke} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356M2.985 19.644v-4.992h4.992m-4.992 0a8.25 8.25 0 0 0 13.803 3.7l3.181-3.182m-13.803-3.7a8.25 8.25 0 0 1 13.803-3.7L21 7.5" />
          </svg>
          <span>تحديث</span>
        </button>
      </div>

      <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
        قائمة السكريبتات التي تم تنفيذها على قاعدة البيانات
      </p>

      {scripts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <svg {...stroke} className="w-12 h-12 text-gray-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">لا توجد سكريبتات منفذة</h3>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-start font-bold">اسم السكريبت</th>
                <th className="px-4 py-3 text-start font-bold">تاريخ التنفيذ</th>
                <th className="px-4 py-3 text-start font-bold">الحالة</th>
                <th className="px-4 py-3 text-start font-bold">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {scripts.map(script => (
                <tr key={script.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    <span className="font-mono text-sm">{script.scriptName}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {new Date(script.executedAt).toLocaleString('ar-EG')}
                  </td>
                  <td className="px-4 py-3">
                    {script.success ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                        <svg {...stroke} className="w-3 h-3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        <span>نجح</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                        <svg {...stroke} className="w-3 h-3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                        <span>فشل</span>
                      </span>
                    )}
                    {script.error && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">{script.error}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => resetScript(script.scriptName)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition-colors duration-200"
                      aria-label={`إعادة تعيين ${script.scriptName}`}
                    >
                      <svg {...stroke} className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356M2.985 19.644v-4.992h4.992m-4.992 0a8.25 8.25 0 0 0 13.803 3.7l3.181-3.182m-13.803-3.7a8.25 8.25 0 0 1 13.803-3.7L21 7.5" />
                      </svg>
                      <span>إعادة تعيين</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

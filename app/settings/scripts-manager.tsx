'use client'

import { useState, useEffect } from 'react'
import { useToast } from '../../contexts/ToastContext'

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

  // جلب السكريبتات المنفذة
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

  // إعادة تعيين سكريبت
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
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">📜 إدارة السكريبتات</h2>
        <p className="text-gray-500">جاري التحميل...</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">📜 إدارة السكريبتات</h2>
        <button
          onClick={fetchScripts}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition"
        >
          🔄 تحديث
        </button>
      </div>

      <p className="text-gray-600 mb-4 text-sm">
        قائمة السكريبتات التي تم تنفيذها على قاعدة البيانات
      </p>

      {scripts.length === 0 ? (
        <p className="text-gray-400 text-center py-8">لا توجد سكريبتات منفذة</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-right text-sm font-bold">اسم السكريبت</th>
                <th className="px-4 py-3 text-right text-sm font-bold">تاريخ التنفيذ</th>
                <th className="px-4 py-3 text-right text-sm font-bold">الحالة</th>
                <th className="px-4 py-3 text-right text-sm font-bold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {scripts.map(script => (
                <tr key={script.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm">{script.scriptName}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(script.executedAt).toLocaleString('ar-EG')}
                  </td>
                  <td className="px-4 py-3">
                    {script.success ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">
                        ✅ نجح
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">
                        ❌ فشل
                      </span>
                    )}
                    {script.error && (
                      <p className="text-xs text-red-600 mt-1">{script.error}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => resetScript(script.scriptName)}
                      className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition text-xs font-bold"
                    >
                      🔄 إعادة تعيين
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

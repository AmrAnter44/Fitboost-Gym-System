// app/setup/page.tsx
'use client'

import { useState } from 'react'

export default function SetupPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handleSetup = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/setup', {
        method: 'POST'
      })
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ error: 'فشل الاتصال' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-600" dir="rtl">
      <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">🔧</div>
          <h1 className="text-3xl font-bold text-gray-800">إعداد النظام</h1>
          <p className="text-gray-600 mt-2">إنشاء أول حساب Admin</p>
        </div>

        <div className="bg-primary-50 border-r-4 border-primary-500 p-4 rounded-lg mb-6">
          <p className="text-sm text-primary-800">
            <strong>📌 ملاحظة:</strong> هذه الصفحة تستخدم مرة واحدة فقط لإنشاء حساب المدير الأول.
          </p>
        </div>

        {!result && (
          <button
            onClick={handleSetup}
            disabled={loading}
            className="w-full bg-gradient-to-r from-primary-500 to-purple-600 text-white py-4 rounded-xl hover:from-primary-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 font-bold text-lg shadow-lg transition transform hover:scale-105"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span>
                <span>جاري الإنشاء...</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>🚀</span>
                <span>إنشاء حساب Admin</span>
              </span>
            )}
          </button>
        )}

        {result && (
          <div className={`mt-6 rounded-xl overflow-hidden shadow-lg ${
            result.success ? 'bg-green-50 border-2 border-green-300' : 'bg-red-50 border-2 border-red-300'
          }`}>
            {result.success ? (
              <div className="p-6">
                <div className="text-center mb-4">
                  <div className="text-5xl mb-2">✅</div>
                  <p className="font-bold text-xl text-green-800">تم إنشاء الحساب بنجاح!</p>
                </div>

                <div className="bg-white p-5 rounded-lg border-2 border-green-200 mb-4">
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <span>🔑</span>
                    <span>بيانات تسجيل الدخول:</span>
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-gray-50 p-3 rounded">
                      <span className="text-gray-600 text-sm">البريد الإلكتروني:</span>
                      <code className="font-mono font-bold text-primary-600 text-sm" dir="ltr">
                        {result.credentials.email}
                      </code>
                    </div>
                    <div className="flex items-center justify-between bg-gray-50 p-3 rounded">
                      <span className="text-gray-600 text-sm">كلمة المرور الافتراضية:</span>
                      <code className="font-mono font-bold text-primary-600 text-sm">
                        admin123456
                      </code>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border-r-4 border-yellow-500 p-4 rounded-lg mb-4">
                  <p className="text-sm text-yellow-800">
                    <strong>⚠️ مهم:</strong> احفظ البيانات دي في مكان آمن! وغيّر الباسورد بعد أول تسجيل دخول.
                  </p>
                </div>

                <a 
                  href="/login"
                  className="block text-center bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-lg hover:from-green-600 hover:to-green-700 font-bold shadow-lg transition transform hover:scale-105"
                >
                  🚀 الذهاب لصفحة تسجيل الدخول
                </a>
              </div>
            ) : (
              <div className="p-6 text-center">
                <div className="text-5xl mb-4">❌</div>
                <p className="font-bold text-xl text-red-800 mb-2">فشل إنشاء الحساب</p>
                <p className="text-red-600 text-sm">{result.error}</p>
                <button
                  onClick={() => setResult(null)}
                  className="mt-4 bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700"
                >
                  إعادة المحاولة
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
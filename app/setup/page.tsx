// app/setup/page.tsx
'use client'

import { useState } from 'react'

export default function SetupPage() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [showPassword, setShowPassword] = useState(false)

  const handleSetup = async () => {
    if (form.password !== form.confirmPassword) {
      setResult({ error: 'كلمتا المرور غير متطابقتين' })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password
        })
      })
      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ error: 'فشل الاتصال' })
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = form.name && form.email && form.password && form.confirmPassword && !loading

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-pink-600 p-4" dir="rtl">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">🔧</div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">إعداد النظام</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">إنشاء أول حساب Admin</p>
        </div>

        <div className="bg-primary-50 border-r-4 border-primary-500 p-4 rounded-lg mb-6">
          <p className="text-sm text-primary-800">
            <strong>📌 ملاحظة:</strong> هذه الصفحة تستخدم مرة واحدة فقط لإنشاء حساب المدير الأول.
          </p>
        </div>

        {!result?.success && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                الاسم
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Admin"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="admin@example.com"
                dir="ltr"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                كلمة المرور
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="على الأقل 12 حرف، حروف كبيرة وصغيرة وأرقام ورموز"
                dir="ltr"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                تأكيد كلمة المرور
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                dir="ltr"
                disabled={loading}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={e => setShowPassword(e.target.checked)}
              />
              إظهار كلمة المرور
            </label>

            <div className="bg-yellow-50 border-r-4 border-yellow-500 p-3 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-700">
              <p className="text-xs text-yellow-800">
                <strong>متطلبات كلمة المرور:</strong> 12 حرف على الأقل، تحتوي على حرف كبير، حرف صغير، رقم، ورمز خاص.
              </p>
            </div>

            <button
              onClick={handleSetup}
              disabled={!canSubmit}
              className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white py-4 rounded-xl hover:from-primary-600 hover:to-primary-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed font-bold text-lg shadow-lg transition"
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
          </div>
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

                <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border-2 border-green-200 mb-4">
                  <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <span>🔑</span>
                    <span>البريد الإلكتروني:</span>
                  </h3>
                  <code className="font-mono font-bold text-primary-600 text-sm block" dir="ltr">
                    {result.credentials.email}
                  </code>
                </div>

                <a
                  href="/login"
                  className="block text-center bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-lg hover:from-green-600 hover:to-green-700 font-bold shadow-lg transition"
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

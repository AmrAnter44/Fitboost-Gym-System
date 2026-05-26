// app/setup/page.tsx
'use client'

import { useState } from 'react'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4" dir="rtl">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center mb-4">
            <svg {...stroke} className="w-9 h-9" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">إعداد النظام</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">إنشاء أول حساب Admin</p>
        </div>

        <div className="bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-900/50 p-4 rounded-lg mb-6 flex items-start gap-2">
          <svg {...stroke} className="w-5 h-5 text-primary-700 dark:text-primary-400 flex-shrink-0 mt-0.5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          <p className="text-sm text-primary-800 dark:text-primary-300">
            <strong>ملاحظة:</strong> هذه الصفحة تستخدم مرة واحدة فقط لإنشاء حساب المدير الأول.
          </p>
        </div>

        {!result?.success && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                الاسم
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                placeholder="Admin"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                placeholder="admin@example.com"
                dir="ltr"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                كلمة المرور
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                placeholder="على الأقل 12 حرف، حروف كبيرة وصغيرة وأرقام ورموز"
                dir="ltr"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                تأكيد كلمة المرور
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                dir="ltr"
                disabled={loading}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={e => setShowPassword(e.target.checked)}
                className="w-4 h-4 rounded accent-primary-500"
              />
              إظهار كلمة المرور
            </label>

            <div className="bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-900/50 p-3 rounded-lg flex items-start gap-2">
              <svg {...stroke} className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                <strong>متطلبات كلمة المرور:</strong> 12 حرف على الأقل، تحتوي على حرف كبير، حرف صغير، رقم، ورمز خاص.
              </p>
            </div>

            <button
              onClick={handleSetup}
              disabled={!canSubmit}
              className="w-full inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold py-3 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg {...stroke} className="w-5 h-5 animate-spin" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356M3.181 14.652a8.25 8.25 0 0 0 13.803 3.7l3.181-3.182m-9.348-4.992H3.825V4.356m0 0L7.006 7.538m12.992 8.924v-4.992" />
                  </svg>
                  <span>جاري الإنشاء...</span>
                </>
              ) : (
                <>
                  <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
                  </svg>
                  <span>إنشاء حساب Admin</span>
                </>
              )}
            </button>
          </div>
        )}

        {result && (
          <div className={`mt-6 rounded-xl overflow-hidden shadow-sm ${
            result.success
              ? 'bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-900/50'
              : 'bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/50'
          }`}>
            {result.success ? (
              <div className="p-6">
                <div className="text-center mb-4">
                  <div className="mx-auto w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 flex items-center justify-center mb-3">
                    <svg {...stroke} className="w-8 h-8" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <p className="font-bold text-xl text-green-800 dark:text-green-300">تم إنشاء الحساب بنجاح!</p>
                </div>

                <div className="bg-white dark:bg-gray-800 p-5 rounded-lg ring-1 ring-green-200 dark:ring-green-900/50 mb-4">
                  <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2 text-sm">
                    <svg {...stroke} className="w-4 h-4 text-primary-600 dark:text-primary-400" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                    </svg>
                    <span>البريد الإلكتروني:</span>
                  </h3>
                  <code className="font-mono font-bold text-primary-600 dark:text-primary-400 text-sm block" dir="ltr">
                    {result.credentials.email}
                  </code>
                </div>

                <a
                  href="/login"
                  className="w-full inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold py-3 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                >
                  <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                  </svg>
                  <span>الذهاب لصفحة تسجيل الدخول</span>
                </a>
              </div>
            ) : (
              <div className="p-6 text-center">
                <div className="mx-auto w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 flex items-center justify-center mb-4">
                  <svg {...stroke} className="w-8 h-8" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <p className="font-bold text-xl text-red-800 dark:text-red-300 mb-2">فشل إنشاء الحساب</p>
                <p className="text-red-600 dark:text-red-400 text-sm">{result.error}</p>
                <button
                  onClick={() => setResult(null)}
                  className="mt-4 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 font-bold"
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

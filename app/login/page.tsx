// app/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../../contexts/LanguageContext'

export default function LoginPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (response.ok) {
        // ✅ توجيه المستخدم بناءً على دوره
        const redirectUrl = data.user?.role === 'COACH' ? '/coach' : '/members'

        // استخدام window.location بدلاً من router.push عشان يعمل full reload
        // وبالتالي يعيد جلب الصلاحيات في الـ Navbar
        window.location.href = redirectUrl
      } else {
        setError(data.error || t('auth.loginFailed'))
      }
    } catch (error) {
      setError(t('auth.connectionError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-purple-600">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🔐</div>
          <h1 className="text-3xl font-bold text-gray-800">{t('auth.login')}</h1>
          <p className="text-gray-600 mt-2">{t('auth.gymSystem')}</p>
        </div>

        {error && (
          <div className="bg-red-100 border-r-4 border-red-500 text-red-700 p-4 rounded mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              البريد الإلكتروني أو الاسم
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="اكتب الاسم أو email"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('auth.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 transition font-bold text-lg"
          >
            {loading ? t('auth.loggingIn') : t('auth.login')}
          </button>
        </form>
      </div>
    </div>
  )
}
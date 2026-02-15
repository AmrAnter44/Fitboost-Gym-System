// app/emergency-signup/page.tsx
// ⚠️ احذف هذا الملف بعد إنشاء حساب الأدمن!
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '../../contexts/ToastContext'

export default function EmergencySignupPage() {
  const router = useRouter()
  const toast = useToast()
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    confirmPassword: '',
    secretKey: '' // مفتاح سري للحماية
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // التحقق من تطابق كلمة المرور
    if (formData.password !== formData.confirmPassword) {
      toast.error('كلمتا المرور غير متطابقتين')
      return
    }

    // التحقق من طول كلمة المرور
    if (formData.password.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/emergency-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
          password: formData.password,
          secretKey: formData.secretKey
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('تم إنشاء حساب الأدمن بنجاح! جاري التحويل...')
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      } else {
        toast.error(data.error || 'حدث خطأ')
      }
    } catch (error) {
      toast.error('حدث خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-8">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-3xl font-bold text-red-600 mb-2">
            إنشاء حساب أدمن طارئ
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            استخدم هذه الصفحة فقط في حالة فقدان حساب الأدمن
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              🔑 المفتاح السري <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formData.secretKey}
              onChange={(e) => setFormData({ ...formData, secretKey: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="أدخل المفتاح السري"
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
              المفتاح موجود في ملف .env تحت اسم EMERGENCY_SIGNUP_SECRET
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              👤 الاسم <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="أحمد محمد"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              📧 البريد الإلكتروني <span className="text-red-600">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="admin@gym.com"
              dir="ltr"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              🔐 كلمة المرور <span className="text-red-600">*</span>
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="••••••••"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              🔐 تأكيد كلمة المرور <span className="text-red-600">*</span>
            </label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="••••••••"
              required
            />
          </div>

          <div className="bg-yellow-50 border-r-4 border-yellow-500 p-4 rounded">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ تحذير:</strong> سيتم إنشاء حساب أدمن بصلاحيات كاملة. احذف هذه الصفحة فوراً بعد الاستخدام!
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 text-white py-4 rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-bold text-lg"
          >
            {loading ? '⏳ جاري الإنشاء...' : '✅ إنشاء حساب الأدمن'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
            هذه صفحة طوارئ - استخدمها مرة واحدة فقط ثم احذفها
          </p>
        </div>
      </div>
    </div>
  )
}
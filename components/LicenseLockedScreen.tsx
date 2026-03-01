'use client'

import { useLicense } from '../contexts/LicenseContext'
import { useEffect } from 'react'

export default function LicenseLockedScreen() {
  const { isValid, message, isChecking, checkLicense } = useLicense()

  // إذا كان الترخيص صالح، لا تعرض شيء
  if (isValid) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-red-600 flex items-center justify-center">
      <div className="text-center text-white p-8 max-w-2xl">
        {/* أيقونة القفل */}
        <div className="mb-8">
          <div className="text-9xl mb-4">🔒</div>
          <h1 className="text-4xl font-bold mb-4">النظام معطل</h1>
        </div>

        {/* الرسالة */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 mb-8">
          <p className="text-2xl mb-6">{message}</p>
          <p className="text-lg opacity-90">
            للاستفسار، يرجى التواصل مع المسؤول عن النظام
          </p>
        </div>

        {/* زر إعادة المحاولة */}
        <button
          onClick={checkLicense}
          disabled={isChecking}
          className="bg-white text-red-600 px-8 py-4 rounded-xl font-bold text-xl hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
        >
          {isChecking ? 'جاري الفحص...' : '🔄 إعادة المحاولة'}
        </button>

        {/* معلومات إضافية */}
        <div className="mt-8 text-sm opacity-75">
          <p>إذا كنت تعتقد أن هذه رسالة خطأ، يرجى الاتصال بالدعم الفني</p>
        </div>
      </div>
    </div>
  )
}

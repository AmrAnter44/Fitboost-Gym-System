'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { PRIMARY_COLOR, THEME_COLORS } from '@/lib/theme/colors';

export default function LoginPage() {
  const router = useRouter();
  const [memberNumber, setMemberNumber] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('🔵 Login attempt:', { memberNumber, phoneNumber });

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberNumber, phoneNumber }),
      });

      console.log('🔵 Response status:', res.status);

      const data = await res.json();
      console.log('🔵 Response data:', data);

      if (!res.ok) {
        console.error('❌ Login failed:', data.error);
        setError(data.error || 'فشل تسجيل الدخول');
        return;
      }

      console.log('✅ Login successful, redirecting to dashboard...');

      // Use window.location for full page reload to ensure cookie is sent
      window.location.href = '/dashboard';
    } catch (err) {
      console.error('❌ Login error:', err);
      setError('حدث خطأ. حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-6" style={{ backgroundColor: THEME_COLORS.primary[900] }}>
      <div className="bg-white p-6 sm:p-8 rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">X Gym</h1>
          <p className="text-sm text-gray-600">بوابة الأعضاء</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
              رقم العضوية
            </label>
            <input
              type="number"
              value={memberNumber}
              onChange={(e) => setMemberNumber(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="1001"
              required
              dir="ltr"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
              رقم الهاتف
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="01234567890"
              required
              dir="ltr"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg text-xs sm:text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full text-white py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
            style={{ backgroundColor: THEME_COLORS.primary[900] }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = THEME_COLORS.primary[800]}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = THEME_COLORS.primary[900]}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span className="text-sm">جاري تسجيل الدخول...</span>
              </span>
            ) : (
              'تسجيل الدخول'
            )}
          </button>
        </form>

        <div className="mt-4 sm:mt-6 text-center text-xs sm:text-sm text-gray-500">
          <p>للحصول على رقم العضوية ورقم الهاتف</p>
          <p>يرجى التواصل مع الإدارة</p>
        </div>
      </div>
    </div>
  );
}

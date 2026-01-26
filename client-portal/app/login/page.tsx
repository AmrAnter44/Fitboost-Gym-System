'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

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
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberNumber, phoneNumber }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'فشل تسجيل الدخول');
        return;
      }

      // Redirect to dashboard
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError('حدث خطأ. حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1e3a8a] px-4 py-6">
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
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
            className="w-full bg-[#1e3a8a] text-white py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-medium hover:bg-[#1e40af] disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
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

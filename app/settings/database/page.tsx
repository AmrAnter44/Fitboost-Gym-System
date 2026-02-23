'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DatabaseSettings from '../../../components/settings/DatabaseSettings';

export default function DatabaseSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // فحص تسجيل الدخول والصلاحيات
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
          router.push('/login');
          return;
        }

        const data = await response.json();

        // فقط الـ OWNER يمكنه الوصول
        if (data.user.role !== 'OWNER') {
          router.push('/');
          return;
        }

        setUser(data.user);
      } catch (error) {
        console.error('Auth check error:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/settings')}
            className="mb-4 flex items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            <span>←</span>
            <span>العودة للإعدادات</span>
          </button>

          <h1 className="text-3xl font-bold text-gray-900">
            🗄️ إعدادات قاعدة البيانات
          </h1>
          <p className="text-gray-600 mt-2">
            إدارة وصيانة قاعدة بيانات النظام
          </p>
        </div>

        {/* Database Settings Component */}
        <DatabaseSettings />
      </div>
    </div>
  );
}

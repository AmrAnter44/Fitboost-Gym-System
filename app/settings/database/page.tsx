'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DatabaseSettings from '../../../components/settings/DatabaseSettings';
import { LoadingScreen } from '../../../components/Spinner';
import { useLanguage } from '../../../contexts/LanguageContext';

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

export default function DatabaseSettingsPage() {
  const router = useRouter();
  const { tr } = useLanguage();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
          router.push('/login');
          return;
        }

        const data = await response.json();

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
    return <LoadingScreen fullScreen />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.push('/settings')}
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-700 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 transition-colors duration-200"
            aria-label={tr('العودة للإعدادات', 'Back to settings')}
          >
            <svg {...stroke} className="w-4 h-4 rtl:rotate-180">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            <span>{tr('العودة للإعدادات', 'Back to settings')}</span>
          </button>

          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
              <svg {...stroke} className="w-6 h-6">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5v6c0 1.657 4.03 3 9 3s9-1.343 9-3V5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 11v6c0 1.657 4.03 3 9 3s9-1.343 9-3v-6" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
                {tr('إعدادات قاعدة البيانات', 'Database Settings')}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {tr('إدارة وصيانة قاعدة بيانات النظام', 'Manage and maintain the system database')}
              </p>
            </div>
          </div>
        </div>

        <DatabaseSettings />
      </div>
    </div>
  );
}

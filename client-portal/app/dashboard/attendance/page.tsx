'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface CheckIn {
  id: string;
  checkInTime: string;
  checkInMethod: string | null;
}

interface CheckInStats {
  total: number;
  thisMonth: number;
  thisWeek: number;
}

export default function AttendancePage() {
  const router = useRouter();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [stats, setStats] = useState<CheckInStats>({
    total: 0,
    thisMonth: 0,
    thisWeek: 0,
  });
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  useEffect(() => {
    fetchCheckIns();
  }, [offset]);

  const fetchCheckIns = async () => {
    try {
      const res = await fetch(`/api/member/checkins?limit=${limit}&offset=${offset}`);

      if (!res.ok) {
        router.push('/login');
        return;
      }

      const data = await res.json();

      if (offset === 0) {
        setCheckIns(data.checkIns || []);
        setStats(data.stats || { total: 0, thisMonth: 0, thisWeek: 0 });
      } else {
        setCheckIns(prev => [...prev, ...(data.checkIns || [])]);
      }

      setHasMore(data.pagination?.hasMore || false);
    } catch (err) {
      console.error(err);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    setOffset(prev => prev + limit);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMethodLabel = (method: string | null) => {
    if (!method) return 'عادي';
    const methods: { [key: string]: string } = {
      card: 'بطاقة',
      fingerprint: 'بصمة',
      face: 'وجه',
      manual: 'يدوي',
    };
    return methods[method] || method;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-[#1e3a8a] text-white p-6 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/dashboard"
              className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">سجل الحضور</h1>
              <p className="text-blue-200">تاريخ حضورك للجيم</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{stats.thisWeek}</p>
            <p className="text-sm text-gray-600 mt-1">هذا الأسبوع</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{stats.thisMonth}</p>
            <p className="text-sm text-gray-600 mt-1">هذا الشهر</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <p className="text-3xl font-bold text-purple-600">{stats.total}</p>
            <p className="text-sm text-gray-600 mt-1">الإجمالي</p>
          </div>
        </div>

        {/* Check-ins List */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <h2 className="text-lg font-bold text-gray-800">آخر الحضور</h2>
          </div>

          {checkIns.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">📊</div>
              <p className="text-gray-600">لا توجد سجلات حضور حتى الآن</p>
            </div>
          ) : (
            <div className="divide-y">
              {checkIns.map((checkIn, index) => (
                <div key={checkIn.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                        {stats.total - offset - index}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">
                          {formatDate(checkIn.checkInTime)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatTime(checkIn.checkInTime)}
                        </p>
                      </div>
                    </div>
                    <div className="text-left">
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        {getMethodLabel(checkIn.checkInMethod)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Load More Button */}
          {hasMore && (
            <div className="p-4 bg-gray-50 border-t">
              <button
                onClick={loadMore}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                تحميل المزيد
              </button>
            </div>
          )}
        </div>

        {/* Info Card */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
          <p className="font-medium mb-1">💪 رائع!</p>
          <p>الانتظام في الحضور يساعدك على تحقيق أهدافك</p>
        </div>
      </div>
    </div>
  );
}

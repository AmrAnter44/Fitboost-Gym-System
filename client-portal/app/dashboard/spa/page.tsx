'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface SpaBooking {
  id: string;
  bookingDate: string;
  bookingTime: string;
  serviceType: string;
  status: string;
  duration: number | null;
  notes: string | null;
  createdAt: string;
}

interface SpaStats {
  total: number;
  upcoming: number;
}

export default function SpaPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<SpaBooking[]>([]);
  const [stats, setStats] = useState<SpaStats>({
    total: 0,
    upcoming: 0,
  });
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<string>('all');
  const limit = 20;

  useEffect(() => {
    setOffset(0);
    setBookings([]);
    fetchBookings(0);
  }, [filter]);

  useEffect(() => {
    if (offset > 0) {
      fetchBookings(offset);
    }
  }, [offset]);

  const fetchBookings = async (currentOffset: number) => {
    try {
      const statusParam = filter !== 'all' ? `&status=${filter}` : '';
      const res = await fetch(
        `/api/member/spa?limit=${limit}&offset=${currentOffset}${statusParam}`
      );

      if (!res.ok) {
        router.push('/login');
        return;
      }

      const data = await res.json();

      if (currentOffset === 0) {
        setBookings(data.bookings || []);
        setStats(data.stats || { total: 0, upcoming: 0 });
      } else {
        setBookings(prev => [...prev, ...(data.bookings || [])]);
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
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusLabel = (status: string) => {
    const statuses: { [key: string]: string } = {
      pending: 'قيد الانتظار',
      confirmed: 'مؤكد',
      completed: 'مكتمل',
      cancelled: 'ملغي',
    };
    return statuses[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getServiceIcon = (serviceType: string) => {
    const icons: { [key: string]: string } = {
      massage: '💆',
      sauna: '🧖',
      jacuzzi: '🛁',
      steam: '♨️',
    };
    return icons[serviceType] || '💆';
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
              <h1 className="text-2xl font-bold">حجوزات السبا</h1>
              <p className="text-blue-200">جلسات الاسترخاء</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow p-6 text-center">
            <p className="text-sm text-gray-600 mb-2">القادمة</p>
            <p className="text-4xl font-bold text-green-600">{stats.upcoming}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-6 text-center">
            <p className="text-sm text-gray-600 mb-2">الإجمالي</p>
            <p className="text-4xl font-bold text-blue-600">{stats.total}</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-xl shadow p-2 flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            الكل
          </button>
          <button
            onClick={() => setFilter('confirmed')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              filter === 'confirmed'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            مؤكد
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              filter === 'pending'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            قيد الانتظار
          </button>
        </div>

        {/* Bookings List */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <h2 className="text-lg font-bold text-gray-800">الحجوزات</h2>
          </div>

          {bookings.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">💆</div>
              <p className="text-gray-600">لا توجد حجوزات</p>
              <p className="text-sm text-gray-500 mt-2">
                تواصل مع الإدارة لحجز جلسة سبا
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {bookings.map((booking) => (
                <div key={booking.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">{getServiceIcon(booking.serviceType)}</div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-gray-800 text-lg">
                            {booking.serviceType}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatDate(booking.bookingDate)} - {booking.bookingTime}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            booking.status
                          )}`}
                        >
                          {getStatusLabel(booking.status)}
                        </span>
                      </div>

                      {booking.duration && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                          <span>⏱️</span>
                          <span>{booking.duration} دقيقة</span>
                        </div>
                      )}

                      {booking.notes && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                          📝 {booking.notes}
                        </div>
                      )}
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
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-purple-800">
          <p className="font-medium mb-1">💆‍♂️ للحجز</p>
          <p>تواصل مع الإدارة لحجز موعد جلسة السبا</p>
        </div>
      </div>
    </div>
  );
}

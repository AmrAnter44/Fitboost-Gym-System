'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PRIMARY_COLOR, THEME_COLORS } from '@/lib/theme/colors';

interface MemberData {
  id: string;
  name: string;
  memberNumber: number;
  remainingFreezeDays: number;
  isFrozen: boolean;
  expiryDate: string | null;
}

interface FreezeRequest {
  id: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export default function FreezePage() {
  const router = useRouter();
  const [member, setMember] = useState<MemberData | null>(null);
  const [freezeRequests, setFreezeRequests] = useState<FreezeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [startDate, setStartDate] = useState('');
  const [days, setDays] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [profileRes, freezeRes] = await Promise.all([
        fetch('/api/member/profile'),
        fetch('/api/member/freeze'),
      ]);

      if (!profileRes.ok || !freezeRes.ok) {
        router.push('/login');
        return;
      }

      const profileData = await profileRes.json();
      const freezeData = await freezeRes.json();

      setMember(profileData.member);
      setFreezeRequests(freezeData.requests || []);
    } catch (err) {
      console.error(err);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!startDate || !days) {
      setError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    const freezeDays = parseInt(days);
    if (freezeDays <= 0 || freezeDays > (member?.remainingFreezeDays || 0)) {
      setError(`عدد الأيام يجب أن يكون بين 1 و ${member?.remainingFreezeDays}`);
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/member/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          days: freezeDays,
          reason: reason.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'فشل إرسال الطلب');
        return;
      }

      setSuccess('✅ تم تطبيق التجميد بنجاح! تم تمديد تاريخ انتهاء الاشتراك');
      setStartDate('');
      setDays('');
      setReason('');
      setShowRequestForm(false);

      // Refresh data
      setTimeout(() => {
        fetchData();
        setSuccess('');
      }, 3000);
    } catch (err) {
      setError('حدث خطأ. حاول مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusLabel = (status: string) => {
    const statuses: { [key: string]: string } = {
      pending: 'قيد المراجعة',
      approved: 'مُطبق',
      rejected: 'مرفوض',
    };
    return statuses[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!member) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="text-white p-6 shadow-lg" style={{ backgroundColor: THEME_COLORS.primary[900] }}>
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
              <h1 className="text-2xl font-bold">تجميد الاشتراك</h1>
              <p className="text-primary-200">طلب تجميد مؤقت</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Current Status */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">الحالة الحالية</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-6 bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl">
              <p className="text-5xl font-bold text-primary-600 mb-2">
                {member.remainingFreezeDays}
              </p>
              <p className="text-sm text-gray-600">يوم متاح للتجميد</p>
            </div>

            <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl">
              <p className="text-3xl mb-2">
                {member.isFrozen ? '❄️' : '✅'}
              </p>
              <p className="text-lg font-bold text-gray-800 mb-1">
                {member.isFrozen ? 'مجمد حالياً' : 'نشط'}
              </p>
              <p className="text-sm text-gray-600">
                {member.isFrozen ? 'الاشتراك متوقف' : 'الاشتراك ساري'}
              </p>
            </div>
          </div>

          {member.remainingFreezeDays > 0 && !member.isFrozen && !showRequestForm && (
            <button
              onClick={() => setShowRequestForm(true)}
              className="w-full mt-6 py-4 text-white rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl"
              style={{ backgroundColor: THEME_COLORS.primary[900] }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = THEME_COLORS.primary[800]}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = THEME_COLORS.primary[900]}
            >
              ❄️ طلب تجميد جديد
            </button>
          )}

          {member.isFrozen && (
            <div className="mt-4 p-4 bg-primary-50 border border-primary-200 rounded-lg text-primary-800">
              <p className="font-medium">❄️ اشتراكك مجمد حالياً</p>
              <p className="text-sm mt-1">تم تمديد تاريخ انتهاء الاشتراك. للإلغاء، تواصل مع الإدارة</p>
            </div>
          )}

          {member.remainingFreezeDays === 0 && (
            <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg text-orange-800">
              <p className="font-medium">⚠️ تنبيه</p>
              <p className="text-sm mt-1">لا توجد أيام تجميد متبقية</p>
            </div>
          )}
        </div>

        {/* Request Form */}
        {showRequestForm && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">طلب تجميد جديد</h2>
              <button
                onClick={() => {
                  setShowRequestForm(false);
                  setError('');
                  setStartDate('');
                  setDays('');
                  setReason('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  تاريخ البداية <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={getMinDate()}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  عدد الأيام <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  min="1"
                  max={member.remainingFreezeDays}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder={`الحد الأقصى: ${member.remainingFreezeDays}`}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  السبب (اختياري)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  rows={3}
                  placeholder="اكتب سبب التجميد (اختياري)"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
              >
                {submitting ? 'جاري الإرسال...' : 'إرسال الطلب'}
              </button>
            </form>
          </div>
        )}

        {/* Previous Requests */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <h2 className="text-lg font-bold text-gray-800">سجل التجميد</h2>
          </div>

          {freezeRequests.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">❄️</div>
              <p className="text-gray-600">لا يوجد سجل تجميد</p>
            </div>
          ) : (
            <div className="divide-y">
              {freezeRequests.map((request) => (
                <div key={request.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">❄️</span>
                        <div>
                          <p className="font-semibold text-gray-800">
                            {formatDate(request.startDate)} - {formatDate(request.endDate)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {request.days} يوم
                          </p>
                        </div>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                      {getStatusLabel(request.status)}
                    </span>
                  </div>

                  {request.reason && (
                    <div className="p-2 bg-gray-50 rounded text-sm text-gray-600">
                      <span className="font-medium">السبب:</span> {request.reason}
                    </div>
                  )}

                  <p className="text-xs text-gray-400 mt-2">
                    تاريخ الطلب: {formatDate(request.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Cards */}
        <div className="space-y-3">
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 text-sm text-primary-800">
            <p className="font-medium mb-1">ℹ️ كيف يعمل التجميد؟</p>
            <ul className="list-disc list-inside space-y-1">
              <li>يتم إيقاف الاشتراك مؤقتاً لعدد الأيام المحددة</li>
              <li>يتم تمديد تاريخ انتهاء الاشتراك بنفس عدد الأيام</li>
              <li>لا يمكن الحضور للجيم خلال فترة التجميد</li>
            </ul>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
            <p className="font-medium mb-1">✅ ملاحظات هامة</p>
            <ul className="list-disc list-inside space-y-1">
              <li>يتم تطبيق التجميد مباشرة بعد إرسال الطلب</li>
              <li>يبدأ التجميد من التاريخ المحدد في الطلب</li>
              <li>يتم تمديد تاريخ انتهاء الاشتراك تلقائياً بعدد أيام التجميد</li>
              <li>لإلغاء التجميد، تواصل مع الإدارة</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

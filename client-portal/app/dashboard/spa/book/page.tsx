'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface TimeSlot {
  time: string;
  available: boolean;
}

const SERVICE_TYPES = {
  massage: { name: 'مساج', icon: '💆', color: 'from-purple-500 to-pink-500' },
  sauna: { name: 'ساونا', icon: '🧖', color: 'from-orange-500 to-red-500' },
  jacuzzi: { name: 'جاكوزي', icon: '🛀', color: 'from-blue-500 to-cyan-500' },
};

const DURATIONS = [
  { value: 30, label: '30 دقيقة' },
  { value: 60, label: '60 دقيقة' },
  { value: 90, label: '90 دقيقة' },
];

export default function SpaBookingPage() {
  const router = useRouter();

  // Booking form state
  const [serviceType, setServiceType] = useState('');
  const [date, setDate] = useState('');
  const [duration, setDuration] = useState(60);
  const [selectedTime, setSelectedTime] = useState('');
  const [notes, setNotes] = useState('');

  // Available slots state
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Booking action state
  const [booking, setBooking] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Get minimum date (today)
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Fetch available slots
  const fetchAvailableSlots = async () => {
    if (!serviceType || !date) return;

    setLoadingSlots(true);
    setError('');
    try {
      const response = await fetch(
        `/api/spa/available-slots?serviceType=${serviceType}&date=${date}&duration=${duration}`
      );
      const data = await response.json();

      if (data.slots) {
        setAvailableSlots(data.slots);
      } else {
        setError(data.error || 'فشل في جلب المواعيد');
      }
    } catch (err) {
      setError('حدث خطأ في الاتصال');
    } finally {
      setLoadingSlots(false);
    }
  };

  // Handle booking submission
  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!serviceType || !date || !selectedTime) {
      setError('يرجى ملء جميع الحقول');
      return;
    }

    setBooking(true);
    setError('');

    try {
      const response = await fetch('/api/spa/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType,
          bookingDate: date,
          bookingTime: selectedTime,
          duration,
          notes: notes || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        // Redirect after 2 seconds
        setTimeout(() => {
          router.push('/dashboard/spa');
        }, 2000);
      } else {
        setError(data.error || 'فشل في إنشاء الحجز');
      }
    } catch (err) {
      setError('حدث خطأ في الاتصال');
    } finally {
      setBooking(false);
    }
  };

  // Fetch slots when service type, date, or duration changes
  useEffect(() => {
    if (serviceType && date) {
      fetchAvailableSlots();
      setSelectedTime('');
    }
  }, [serviceType, date, duration]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 pb-20" dir="rtl">
      {/* Header */}
      <div className="bg-white shadow-lg sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/spa"
                className="text-gray-600 hover:text-gray-800 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">حجز موعد SPA</h1>
                <p className="text-sm text-gray-600">اختر الخدمة والموعد المناسب</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <form onSubmit={handleBooking} className="space-y-6">
          {/* Service Type Selection */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">1️⃣ اختر الخدمة</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(SERVICE_TYPES).map(([key, service]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setServiceType(key)}
                  className={`p-6 rounded-xl border-2 transition transform hover:scale-105 ${
                    serviceType === key
                      ? 'border-purple-500 bg-purple-50 shadow-lg scale-105'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="text-5xl mb-2">{service.icon}</div>
                  <div className="font-bold text-gray-800">{service.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Date and Duration */}
          {serviceType && (
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">2️⃣ اختر التاريخ والمدة</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    📅 التاريخ
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={getMinDate()}
                    required
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    ⏱️ المدة
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition"
                  >
                    {DURATIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Available Time Slots */}
          {serviceType && date && (
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">3️⃣ اختر الموعد</h2>
              {loadingSlots ? (
                <div className="text-center py-8">
                  <div className="animate-spin text-4xl mb-2">⏳</div>
                  <p className="text-gray-600">جاري تحميل المواعيد...</p>
                </div>
              ) : availableSlots.length > 0 ? (
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => slot.available && setSelectedTime(slot.time)}
                      disabled={!slot.available}
                      className={`py-3 px-2 rounded-lg font-bold transition ${
                        selectedTime === slot.time
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg scale-105'
                          : slot.available
                          ? 'bg-gray-100 text-gray-800 hover:bg-gray-200 hover:scale-105'
                          : 'bg-gray-50 text-gray-400 cursor-not-allowed line-through'
                      }`}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-xl">
                  <p className="text-gray-600">لا توجد مواعيد متاحة لهذا اليوم</p>
                  <p className="text-sm text-gray-500 mt-2">جرب تاريخ آخر</p>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {selectedTime && (
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">4️⃣ ملاحظات (اختياري)</h2>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أضف أي ملاحظات أو طلبات خاصة..."
                rows={3}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition"
              />
            </div>
          )}

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 text-red-800 flex items-center gap-2">
              <span className="text-2xl">❌</span>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 text-green-800 flex items-center gap-2">
              <span className="text-2xl">✅</span>
              <span>تم الحجز بنجاح! جاري التحويل...</span>
            </div>
          )}

          {/* Submit Button */}
          {selectedTime && (
            <button
              type="submit"
              disabled={booking || success}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {booking ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span>
                  <span>جاري الحجز...</span>
                </span>
              ) : (
                '🎉 تأكيد الحجز'
              )}
            </button>
          )}
        </form>

        {/* Info */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <p className="font-medium mb-1">💡 معلومة</p>
          <p>سيتم مراجعة حجزك وتأكيده من قبل الإدارة. سنقوم بإعلامك بحالة الحجز.</p>
        </div>
      </div>
    </div>
  );
}

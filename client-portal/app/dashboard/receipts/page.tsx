'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Receipt {
  id: string;
  receiptNumber: string;
  amount: number;
  paymentMethod: string;
  staffName: string | null;
  itemDetails: string | null;
  type: string;
  createdAt: string;
}

interface ReceiptStats {
  total: number;
  totalPaid: number;
}

export default function ReceiptsPage() {
  const router = useRouter();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [stats, setStats] = useState<ReceiptStats>({
    total: 0,
    totalPaid: 0,
  });
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  useEffect(() => {
    fetchReceipts();
  }, [offset]);

  const fetchReceipts = async () => {
    try {
      const res = await fetch(`/api/member/receipts?limit=${limit}&offset=${offset}`);

      if (!res.ok) {
        router.push('/login');
        return;
      }

      const data = await res.json();

      if (offset === 0) {
        setReceipts(data.receipts || []);
        setStats(data.stats || { total: 0, totalPaid: 0 });
      } else {
        setReceipts(prev => [...prev, ...(data.receipts || [])]);
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
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getPaymentMethodLabel = (method: string) => {
    const methods: { [key: string]: string } = {
      cash: 'نقدي',
      card: 'بطاقة',
      bank_transfer: 'تحويل بنكي',
      wallet: 'محفظة',
    };
    return methods[method] || method;
  };

  const getTypeLabel = (type: string) => {
    const types: { [key: string]: string } = {
      subscription: 'اشتراك',
      freeze: 'تجميد',
      pt_session: 'جلسة PT',
      product: 'منتج',
      other: 'أخرى',
    };
    return types[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      subscription: 'bg-blue-100 text-blue-800',
      freeze: 'bg-purple-100 text-purple-800',
      pt_session: 'bg-green-100 text-green-800',
      product: 'bg-orange-100 text-orange-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const parseItemDetails = (itemDetails: string | null) => {
    if (!itemDetails) return null;

    try {
      const data = JSON.parse(itemDetails);
      const items: Array<{ label: string; value: string }> = [];

      // Map fields to Arabic labels
      const fieldMap: { [key: string]: string } = {
        memberName: 'اسم العضو',
        memberNumber: 'رقم العضوية',
        subscriptionDays: 'مدة الاشتراك',
        remainingFreezeDays: 'أيام التجميد المتبقية',
        startDate: 'تاريخ البداية',
        expiryDate: 'تاريخ الانتهاء',
        freezeDays: 'أيام التجميد',
        sessions: 'عدد الجلسات',
        productName: 'اسم المنتج',
        quantity: 'الكمية',
        description: 'الوصف',
      };

      Object.keys(data).forEach((key) => {
        if (key === 'staffName' || key === 'isOther') return; // Skip these

        let value = data[key];

        // Format dates
        if (key.includes('Date') && value) {
          const date = new Date(value);
          value = date.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
        }

        // Format subscription days
        if (key === 'subscriptionDays' && value) {
          value = `${value} يوم`;
        }

        // Format freeze days
        if (key.includes('Days') && value && key !== 'subscriptionDays') {
          value = `${value} يوم`;
        }

        // Format sessions
        if (key === 'sessions' && value) {
          value = `${value} جلسة`;
        }

        if (value !== null && value !== undefined && value !== '') {
          items.push({
            label: fieldMap[key] || key,
            value: String(value),
          });
        }
      });

      return items;
    } catch (e) {
      // If not valid JSON, return as plain text
      return null;
    }
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
              <h1 className="text-2xl font-bold">الإيصالات</h1>
              <p className="text-blue-200">سجل المدفوعات</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow p-6 text-center">
            <p className="text-sm text-gray-600 mb-2">عدد الإيصالات</p>
            <p className="text-4xl font-bold text-blue-600">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-6 text-center">
            <p className="text-sm text-gray-600 mb-2">إجمالي المدفوعات</p>
            <p className="text-4xl font-bold text-green-600">{stats.totalPaid.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-1">جنيه</p>
          </div>
        </div>

        {/* Receipts List */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <h2 className="text-lg font-bold text-gray-800">كل الإيصالات</h2>
          </div>

          {receipts.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">🧾</div>
              <p className="text-gray-600">لا توجد إيصالات حتى الآن</p>
            </div>
          ) : (
            <div className="divide-y">
              {receipts.map((receipt) => (
                <div key={receipt.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-800">
                          إيصال #{receipt.receiptNumber}
                        </p>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(receipt.type)}`}>
                          {getTypeLabel(receipt.type)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {formatDate(receipt.createdAt)}
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="text-2xl font-bold text-green-600">
                        {receipt.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">جنيه</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <span>💳</span>
                      <span>{getPaymentMethodLabel(receipt.paymentMethod)}</span>
                    </div>
                    {receipt.staffName && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <span>👤</span>
                        <span>{receipt.staffName}</span>
                      </div>
                    )}
                  </div>

                  {receipt.itemDetails && (() => {
                    const details = parseItemDetails(receipt.itemDetails);
                    if (details && details.length > 0) {
                      return (
                        <div className="mt-3 p-3 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200">
                          <div className="grid grid-cols-2 gap-2">
                            {details.map((item, idx) => (
                              <div key={idx} className="text-sm">
                                <span className="text-gray-500">{item.label}:</span>
                                <span className="mr-1 font-medium text-gray-800">{item.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    } else if (receipt.itemDetails) {
                      return (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                          {receipt.itemDetails}
                        </div>
                      );
                    }
                    return null;
                  })()}
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
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          <p className="font-medium mb-1">📋 ملاحظة</p>
          <p>يمكنك طلب نسخة مطبوعة من أي إيصال من الإدارة</p>
        </div>
      </div>
    </div>
  );
}

'use client'

import { useState, useEffect } from 'react';
import Toast from './Toast';
import { normalizePaymentMethod, isMultiPayment, getPaymentMethodLabel } from '../lib/paymentHelpers';
import { sendWhatsAppMessage } from '../lib/whatsappHelper';
import { ANDROID_APP_URL, IOS_APP_URL } from '../lib/constants';
import { prepareReceiptMessage as buildReceiptMessage } from '../lib/whatsappReceiptMessage';

interface ReceiptWhatsAppProps {
  receipt: {
    id: string;
    receiptNumber: number;
    type: string;
    amount: number;
    itemDetails: string;
    paymentMethod: string;
    staffName?: string;
    createdAt: string;
    memberId?: string;
    ptNumber?: number;
    dayUseId?: string;
  };
  onDetailsClick?: () => void;
}

export default function ReceiptWhatsApp({ receipt, onDetailsClick }: ReceiptWhatsAppProps) {
  const [showSendModal, setShowSendModal] = useState(false);
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [showWebsite, setShowWebsite] = useState(false);
  // 🔒 روابط التطبيق ثابتة - من lib/constants.ts
  const androidAppUrl = ANDROID_APP_URL;
  const iosAppUrl = IOS_APP_URL;
  const [showAppLinks, setShowAppLinks] = useState(false);
  const [receiptTerms, setReceiptTerms] = useState('الساده الاعضاء حرصا منا على تقديم خدمه افضل وحفاظا على سير النظام العام للمكان بشكل مرضى يرجى الالتزام بالتعليمات الاتيه :\n\n١- الاشتراك لا يرد الا خلال ٢٤ ساعه بعد خصم قيمه الحصه\n٢- لا يجوز التمرين بخلاف الزى الرياضى\n٣- ممنوع اصطحاب الاطفال او الماكولات داخل الجيم\n٤- الاداره غير مسئوله عن المتعلقات الشخصيه');

  const details = JSON.parse(receipt.itemDetails);
  const [memberPhone, setMemberPhone] = useState<string>('');

  // جلب رقم هاتف العضو إذا لم يكن موجوداً في تفاصيل الإيصال
  useEffect(() => {
    const existingPhone = details.phone || details.memberPhone || details.clientPhone;
    if (!existingPhone && receipt.memberId) {
      fetch(`/api/members/${receipt.memberId}`)
        .then(r => r.ok ? r.json() : null)
        .then((data: any) => {
          if (data?.phone) setMemberPhone(data.phone);
        })
        .catch(() => {});
    }
  }, [receipt.memberId]);

  // جلب إعدادات الموقع والشروط
  useEffect(() => {
    const fetchWebsiteSettings = async () => {
      try {
        const response = await fetch('/api/settings/services');
        if (response.ok) {
          const data = await response.json();
          if (data.websiteUrl) setWebsiteUrl(data.websiteUrl);
          if (typeof data.showWebsiteOnReceipts === 'boolean') setShowWebsite(data.showWebsiteOnReceipts);
          if (typeof data.showAppLinksOnReceipts === 'boolean') setShowAppLinks(data.showAppLinksOnReceipts);
          if (data.receiptTerms) setReceiptTerms(data.receiptTerms);
        }
      } catch (error) {
        console.error('Error fetching website settings:', error);
        setShowWebsite(false);
      }
    };
    fetchWebsiteSettings();
  }, []);

  // ✅ نستخدم الـ helper الموحّد من lib/whatsappReceiptMessage.ts
  // (نفس الصياغة المستخدمة في صفحة العضو + popup الباركود)
  const prepareReceiptMessage = (data: any): string => {
    return buildReceiptMessage(
      {
        receiptNumber: data.receiptNumber,
        type: data.type,
        amount: data.amount,
        date: data.date,
        paymentMethod: data.paymentMethod,
        staffName: data.staffName,
        details: data.details,
        memberPhoneFallback: memberPhone,
      },
      {
        receiptTerms,
        websiteUrl,
        showWebsite,
        androidAppUrl,
        iosAppUrl,
        showAppLinks,
      }
    )
  }


  const handleSendWhatsApp = async () => {
    if (!phone || phone.trim().length < 10) {
      setToast({ message: 'يرجى إدخال رقم هاتف صحيح', type: 'warning' });
      return;
    }

    setSending(true);

    const receiptMessage = prepareReceiptMessage({
      receiptNumber: receipt.receiptNumber,
      type: receipt.type,
      amount: receipt.amount,
      memberName: details.memberName || details.clientName || details.name,
      memberNumber: details.memberNumber,
      date: receipt.createdAt,
      paymentMethod: receipt.paymentMethod,
      details: details,
    });

    try {
      const sendResult = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message: receiptMessage })
      });

      const sendData = await sendResult.json();

      if (sendData.success) {
        setToast({ message: '✅ تم إرسال الإيصال بنجاح على الواتساب', type: 'success' });
        setShowSendModal(false);
        setPhone('');
      } else {
        const errorMessage = sendData.error || 'فشل إرسال الرسالة';
        if (errorMessage.includes('not ready') || errorMessage.includes('not initialized')) {
          setToast({ message: '❌ الواتساب غير متصل. افتح الإعدادات → الواتساب لمسح QR code', type: 'error' });
        } else {
          setToast({ message: `❌ ${errorMessage}`, type: 'error' });
        }
      }
    } catch (err) {
      console.error('WhatsApp send error:', err);
      setToast({ message: '❌ حدث خطأ أثناء الإرسال. تأكد من اتصال الواتساب', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex gap-2">
        {onDetailsClick && (
          <button
            onClick={onDetailsClick}
            className="bg-primary-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-primary-700 flex items-center gap-1"
          >
            👁️
          </button>
        )}

        {/* زر الواتساب يظهر دائماً - إذا كان هناك رقم محفوظ سيتم ملؤه تلقائياً، وإلا سيُطلب إدخاله يدوياً */}
        <button
          onClick={() => {
            const phoneNumber = details.phone || details.memberPhone || details.clientPhone || memberPhone;
            if (phoneNumber) {
              setPhone(phoneNumber);
            }
            setShowSendModal(true);
          }}
          className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-700 flex items-center gap-1"
          title={details.phone || details.memberPhone || details.clientPhone || memberPhone ? 'إرسال عبر واتساب' : 'إرسال عبر واتساب (أدخل الرقم يدوياً)'}
        >
          📲
        </button>
      </div>

      {showSendModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSendModal(false);
              setPhone('');
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <span className="text-4xl">📱</span>
                <div>
                  <h3 className="text-2xl font-bold dark:text-gray-100">إرسال تفاصيل الإيصال</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">إيصال #{receipt.receiptNumber}</p>
                </div>
              </div>
              <button onClick={() => { setShowSendModal(false); setPhone(''); }} className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-3xl leading-none">×</button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">📞 رقم الهاتف *</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-lg dark:bg-gray-700 dark:text-white"
                dir="ltr"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSendWhatsApp}
                disabled={sending || !phone || phone.trim().length < 10}
                className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
              >
                {sending ? <>⏳ جاري الإرسال...</> : <>📲 إرسال عبر واتساب</>}
              </button>

              <button
                onClick={() => { setShowSendModal(false); setPhone(''); }}
                disabled={sending}
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

'use client'

import { useState, useEffect } from 'react';
import Toast from './Toast';
import { normalizePaymentMethod, isMultiPayment, getPaymentMethodLabel } from '../lib/paymentHelpers';
import { sendWhatsAppMessage } from '../lib/whatsappHelper';
import { ANDROID_APP_URL, IOS_APP_URL } from '../lib/constants';
import { prepareReceiptMessage as buildReceiptMessage } from '../lib/whatsappReceiptMessage';

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

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
  // روابط التطبيق ثابتة - من lib/constants.ts
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

  // نستخدم الـ helper الموحّد من lib/whatsappReceiptMessage.ts
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
        setToast({ message: ' تم إرسال الإيصال بنجاح على الواتساب', type: 'success' });
        setShowSendModal(false);
        setPhone('');
      } else {
        const errorMessage = sendData.error || 'فشل إرسال الرسالة';
        if (errorMessage.includes('not ready') || errorMessage.includes('not initialized')) {
          setToast({ message: ' الواتساب غير متصل. افتح الإعدادات → الواتساب لمسح QR code', type: 'error' });
        } else {
          setToast({ message: ` ${errorMessage}`, type: 'error' });
        }
      }
    } catch (err) {
      console.error('WhatsApp send error:', err);
      setToast({ message: ' حدث خطأ أثناء الإرسال. تأكد من اتصال الواتساب', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const iconEye = (
    <svg {...stroke} className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
  const iconWhatsApp = (
    <svg {...stroke} className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
  )
  const iconWhatsAppLg = (
    <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>
  )
  const iconClose = (
    <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12M18 6L6 18"/>
    </svg>
  )
  const iconPhone = (
    <svg {...stroke} className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z"/>
    </svg>
  )
  const iconSpinner = (
    <svg {...stroke} className="w-5 h-5 animate-spin" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex gap-2">
        {onDetailsClick && (
          <button
            onClick={onDetailsClick}
            aria-label="عرض التفاصيل"
            className="bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-3 py-2 rounded-lg text-sm transition-colors duration-200 flex items-center gap-1"
          >
            {iconEye}
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
          aria-label={details.phone || details.memberPhone || details.clientPhone || memberPhone ? 'إرسال عبر واتساب' : 'إرسال عبر واتساب (أدخل الرقم يدوياً)'}
          className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm transition-colors duration-200 flex items-center gap-1"
          title={details.phone || details.memberPhone || details.clientPhone || memberPhone ? 'إرسال عبر واتساب' : 'إرسال عبر واتساب (أدخل الرقم يدوياً)'}
        >
          {iconWhatsApp}
        </button>
      </div>

      {showSendModal && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
          style={{ zIndex: 9999 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSendModal(false);
              setPhone('');
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center justify-center">
                  {iconWhatsAppLg}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">إرسال تفاصيل الإيصال</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">إيصال #{receipt.receiptNumber}</p>
                </div>
              </div>
              <button
                onClick={() => { setShowSendModal(false); setPhone(''); }}
                aria-label="إغلاق"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                {iconClose}
              </button>
            </div>

            <div className="mb-6">
              <label className="flex items-center gap-1.5 text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                {iconPhone}
                <span>رقم الهاتف *</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 font-mono text-lg"
                dir="ltr"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSendWhatsApp}
                disabled={sending || !phone || phone.trim().length < 10}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
              >
                {sending ? (
                  <>{iconSpinner}<span>جاري الإرسال...</span></>
                ) : (
                  <>{iconWhatsAppLg}<span>إرسال عبر واتساب</span></>
                )}
              </button>

              <button
                onClick={() => { setShowSendModal(false); setPhone(''); }}
                disabled={sending}
                className="px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
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

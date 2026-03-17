'use client'

import { useState, useEffect } from 'react';
import Toast from './Toast';
import { normalizePaymentMethod, isMultiPayment, getPaymentMethodLabel } from '../lib/paymentHelpers';
import { sendWhatsAppMessage } from '../lib/whatsappHelper';

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
  const [websiteUrl, setWebsiteUrl] = useState(''); // ✅ يتم جلب القيمة من الإعدادات
  const [showWebsite, setShowWebsite] = useState(false); // ✅ البداية false

  const details = JSON.parse(receipt.itemDetails);

  // جلب إعدادات الموقع
  useEffect(() => {
    const fetchWebsiteSettings = async () => {
      try {
        const response = await fetch('/api/settings/services');
        if (response.ok) {
          const data = await response.json();
          if (data.websiteUrl) {
            setWebsiteUrl(data.websiteUrl);
          }
          if (typeof data.showWebsiteOnReceipts === 'boolean') {
            setShowWebsite(data.showWebsiteOnReceipts);
          }
        }
      } catch (error) {
        console.error('Error fetching website settings:', error);
        setShowWebsite(false);
      }
    };
    fetchWebsiteSettings();
  }, []);

  const prepareReceiptMessage = (data: any) => {
    const details = data.details;
    const date = new Date(data.date);
    const formattedDate = date.toLocaleDateString('ar-EG');
    const formattedTime = date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    // الترويسة
    let message = `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `*ايصال رقم #${data.receiptNumber}*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    // نوع الإيصال
    const typeName = data.type === 'Member' ? 'اشتراك عضوية' : data.type === 'PT' ? 'تدريب شخصي' : data.type === 'DayUse' ? 'Day Use' : data.type === 'Expense' ? 'مصروف' : data.type;
    message += `*النوع:* ${typeName}\n\n`;

    // تفاصيل العميل/العضو
    if (details.memberNumber) {
      message += `*رقم العضو:* ${details.memberNumber}\n`;
    }
    if (details.memberName || details.clientName || details.name) {
      message += `*الاسم:* ${details.memberName || details.clientName || details.name}\n`;
    }
    if (details.phone || details.memberPhone || details.clientPhone) {
      message += `*الهاتف:* ${details.phone || details.memberPhone || details.clientPhone}\n`;
    }
    message += `\n`;

    // تفاصيل الاشتراك (للأعضاء)
    if (data.type === 'Member' && details.subscriptionDays) {
      message += `━━━━━━━━━━━━━━━━━━━━\n`;
      message += `*تفاصيل الاشتراك*\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n`;
      if (details.startDate) {
        message += `• من: ${new Date(details.startDate).toLocaleDateString('ar-EG')}\n`;
      }
      if (details.expiryDate) {
        message += `• الى: ${new Date(details.expiryDate).toLocaleDateString('ar-EG')}\n`;
      }
      message += `• المدة: ${details.subscriptionDays} يوم\n`;

      // الخدمات الإضافية
      const extras = [];
      if (details.freePTSessions > 0) extras.push(`${details.freePTSessions} جلسة PT`);
      if (details.inBodyScans > 0) extras.push(`${details.inBodyScans} InBody`);
      if (details.invitations > 0) extras.push(`${details.invitations} دعوة`);
      if (extras.length > 0) {
        message += `*هدايا:* ${extras.join(' + ')}\n`;
      }
      message += `\n`;
    }

    // تفاصيل PT
    if (data.type === 'PT' || data.type.includes('برايفت')) {
      message += `━━━━━━━━━━━━━━━━━━━━\n`;
      message += `*تفاصيل التدريب*\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n`;
      if (details.ptNumber) {
        message += `• رقم PT: ${details.ptNumber}\n`;
      }
      if (details.sessions || details.sessionsPurchased) {
        message += `• عدد الجلسات: ${details.sessions || details.sessionsPurchased}\n`;
      }
      if (details.pricePerSession) {
        message += `• سعر الجلسة: ${details.pricePerSession} ج.م\n`;
      }
      // ✅ عرض المبلغ المتبقي المرتجع في حالة التجديد
      if (details.oldRemainingAmount && details.oldRemainingAmount > 0) {
        message += `• المبلغ المتبقي المرتجع: ${details.oldRemainingAmount} ج.م ✅\n`;
      }
      message += `\n`;
    }

    // المبالغ المالية
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `*التفاصيل المالية*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;

    if (details.subscriptionPrice > 0) {
      message += `• سعر الاشتراك: ${details.subscriptionPrice} ج.م\n`;
    }
    if (details.totalPrice > 0 && data.type === 'PT') {
      message += `• الاجمالي: ${details.totalPrice} ج.م\n`;
    }

    message += `*المدفوع:* ${data.amount} ج.م\n`;

    if (details.remainingAmount > 0) {
      message += `*المتبقي:* ${details.remainingAmount} ج.م\n`;
    }

    // ✅ طريقة الدفع (واحدة أو متعددة)
    const isMulti = isMultiPayment(data.paymentMethod)
    if (isMulti) {
      const normalized = normalizePaymentMethod(data.paymentMethod, data.amount)
      message += `*طريقة الدفع:* متعددة\n`
      normalized.methods.forEach(m => {
        message += `  • ${getPaymentMethodLabel(m.method, 'ar')}: ${m.amount.toFixed(2)} ج.م\n`
      })
    } else {
      const paymentName = getPaymentMethodLabel(data.paymentMethod, 'ar')
      message += `*طريقة الدفع:* ${paymentName}\n`
    }
    message += `\n`;

    // التاريخ والموظف
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `*التاريخ:* ${formattedDate}\n`;
    message += `*الوقت:* ${formattedTime}\n`;
    if (details.staffName || data.staffName) {
      message += `*الموظف:* ${details.staffName || data.staffName}\n`;
    }
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    // ملاحظة الشكر
    message += `شكرا لثقتكم بنا\n`;
    message += `نتمنى لكم تجربة رائعة\n\n`;

    // الشروط والأحكام
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `*شروط وأحكام*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `الساده الاعضاء حرصا منا على تقديم خدمه افضل وحفاظا على سير النظام العام للمكان بشكل مرضى يرجى الالتزام بالتعليمات الاتيه :\n\n`;
    message += `١- الاشتراك لا يرد الا خلال ٢٤ ساعه بعد خصم قيمه الحصه\n`;
    message += `٢- لا يجوز التمرين بخلاف الزى الرياضى\n`;
    message += `٣- ممنوع اصطحاب الاطفال او الماكولات داخل الجيم\n`;
    message += `٤- الاداره غير مسئوله عن المتعلقات الشخصيه\n\n`;

    // عرض الموقع الإلكتروني فقط إذا كان مفعلاً
    if (showWebsite && websiteUrl) {
      message += `🌐 *الموقع الإلكتروني:*\n`;
      message += `${websiteUrl}\n`;
    }

    return message;
  };

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
      // ✅ التحقق من بيئة Electron أولاً
      const electron = typeof window !== 'undefined' && (window as any).electron;

      if (electron?.whatsapp) {
        // ✅ Electron Mode: استخدام IPC
        console.log('📱 Using Electron WhatsApp integration');
        const result = await electron.whatsapp.sendMessage(phone, receiptMessage);

        if (result.success) {
          setToast({ message: '✅ تم إرسال الإيصال بنجاح على الواتساب', type: 'success' });
          setShowSendModal(false);
          setPhone('');
        } else {
          const errorMessage = result.error || 'فشل إرسال الرسالة';

          if (errorMessage.includes('not ready') || errorMessage.includes('not initialized')) {
            setToast({
              message: '❌ الواتساب غير متصل. افتح الإعدادات → الواتساب لمسح QR code',
              type: 'error'
            });
          } else {
            setToast({ message: `❌ ${errorMessage}`, type: 'error' });
          }
        }
      } else {
        // ✅ Browser Mode: استخدام API
        console.log('🌐 Using Browser WhatsApp API');
        try {
          const sendResult = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: phone,
              message: receiptMessage
            })
          });

          const sendData = await sendResult.json();

          if (sendData.success) {
            setToast({ message: '✅ تم إرسال الإيصال بنجاح على الواتساب', type: 'success' });
            setShowSendModal(false);
            setPhone('');
          } else {
            const errorMessage = sendData.error || 'فشل إرسال الرسالة';

            if (errorMessage.includes('not ready') || errorMessage.includes('not initialized')) {
              setToast({
                message: '❌ الواتساب غير متصل. افتح الإعدادات → الواتساب لمسح QR code',
                type: 'error'
              });
            } else {
              setToast({ message: `❌ ${errorMessage}`, type: 'error' });
            }
          }
        } catch (apiError) {
          console.error('WhatsApp API error:', apiError);
          setToast({ message: '❌ حدث خطأ في إرسال الرسالة عبر الواتساب', type: 'error' });
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
            const phoneNumber = details.phone || details.memberPhone || details.clientPhone;
            if (phoneNumber) {
              setPhone(phoneNumber);
            }
            setShowSendModal(true);
          }}
          className="bg-green-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-green-700 flex items-center gap-1"
          title={details.phone || details.memberPhone || details.clientPhone ? 'إرسال عبر واتساب' : 'إرسال عبر واتساب (أدخل الرقم يدوياً)'}
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

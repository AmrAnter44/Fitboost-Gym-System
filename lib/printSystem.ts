// نظام طباعة موحد - مع إضافة اسم الموظف + تحويل PDF
import { normalizePaymentMethod, isMultiPayment } from './paymentHelpers'
import { printAndSaveArabicPDF } from './pdfSystemArabic'
import { THEME_COLORS } from './theme'

interface ReceiptData {
  receiptNumber: number
  type: string
  amount: number
  details: any
  date: Date
}

// دالة لتحويل نوع الإيصال للعربية
function getTypeLabel(type: string): string {
  const types: { [key: string]: string } = {
    'Member': 'اشتراك عضوية',
    'PT': 'تدريب شخصي',
    'DayUse': 'يوم استخدام',
    'InBody': 'فحص InBody'
  }
  return types[type] || type
}

// دالة لتنسيق التاريخ: سنة-شهر-يوم
function formatDateYMD(dateString: string | Date): string {
  if (!dateString) return '-'
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// دالة للحصول على اسم طريقة الدفع بالعربية
function getPaymentMethodLabel(method: string): string {
  const methods: { [key: string]: string } = {
    'cash': 'كاش 💵',
    'visa': 'فيزا 💳',
    'instapay': 'إنستا باي 📱',
    'wallet': 'محفظة إلكترونية 💰'
  }
  return methods[method] || 'كاش 💵'
}

// دالة لإنشاء HTML الإيصال الموحد
function generateReceiptHTML(data: ReceiptData): string {
  const { receiptNumber, type, amount, details, date } = data
  
  const formattedDateOnly = date.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const formattedTimeOnly = date.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit'
  })

  // التحقق إذا كان إيصال تجديد
  const isRenewal = type.includes('تجديد') || details.isRenewal === true

  // ✅ معالجة طرق الدفع (واحدة أو متعددة)
  const paymentMethodRaw = details.paymentMethod || 'cash'
  const isMulti = typeof paymentMethodRaw === 'string' && isMultiPayment(paymentMethodRaw)

  let paymentMethodDisplay: string
  if (isMulti) {
    // دفع متعدد - عرض جميع الطرق
    const normalized = normalizePaymentMethod(paymentMethodRaw, amount)
    paymentMethodDisplay = normalized.methods
      .map(m => `${getPaymentMethodLabel(m.method)} (${m.amount.toFixed(2)} ج.م)`)
      .join('<br>')
  } else {
    // دفع واحد
    paymentMethodDisplay = getPaymentMethodLabel(paymentMethodRaw)
  }

  // اسم الموظف
  const staffName = details.staffName || ''

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=80mm">
  <link href="/fonts/almarai.css" rel="stylesheet">
  <title>إيصال ${receiptNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    @page {
      size: 80mm auto;
      margin: 0;
    }

    body {
      font-family: 'Almarai', Tahoma, 'Segoe UI', Arial, sans-serif;
      width: 80mm;
      padding: 5mm;
      background: #ffffff;
      color: #000;
      font-size: 15px;
      line-height: 1.6;
      direction: rtl;
      unicode-bidi: bidi-override;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: geometricPrecision;
      margin: 0;
      box-sizing: border-box;
    }
    
    .header {
      text-align: center;
      border-bottom: 2px dashed #000;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    
    .header h1 {
      font-size: 22px;
      font-weight: bold;
      margin-bottom: 6px;
    }
    
    .header p {
      font-size: 12px;
      margin: 3px 0;
      color: #333;
    }
    
    .type-badge {
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: bold;
      display: inline-block;
      margin: 10px 0;
      color: white;
    }

    .type-badge.renewal {
      background: #10b981;
    }

    .type-badge.new {
      background: ${THEME_COLORS.primary[500]};
    }

    .payment-method-badge {
      background: #6366f1;
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: bold;
      display: block;
      margin: 8px auto;
      max-width: 90%;
      word-wrap: break-word;
      line-height: 1.4;
    }

    .staff-info {
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      padding: 8px;
      border-radius: 4px;
      font-size: 12px;
      margin: 10px 0;
      text-align: center;
      color: #374151;
    }

    .staff-info strong {
      color: #1f2937;
      font-weight: 700;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 15px 0;
      padding: 10px 0;
      font-size: 12px;
      background: #ffffff;
      white-space: nowrap;
    }

    .info-row strong {
      font-weight: 600;
      flex-shrink: 0;
      margin-left: 5px;
      font-size: 12px;
    }

    .info-row span {
      text-align: left;
      white-space: nowrap;
      font-size: 11px;
      flex: 1;
      min-width: 0;
    }

    .details {
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      padding: 20px 0;
      margin-top: 25px;
      margin-bottom: 20px;
    }

    .details h3 {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 15px;
    }

    .detail-item {
      margin: 10px 0;
      font-size: 14px;
      line-height: 1.8;
    }

    .detail-item strong {
      font-weight: 600;
      margin-left: 8px;
    }
    
    .member-number {
      font-size: 20px;
      font-weight: bold;
      color: ${THEME_COLORS.primary[600]};
      text-align: center;
      margin: 15px 0;
      padding: 12px;
      background: #ffffff;
      border-radius: 6px;
      border: 2px solid ${THEME_COLORS.primary[600]};
    }

    .date-box {
      background: #ffffff;
      border: 2px solid ${THEME_COLORS.primary[500]};
      border-radius: 8px;
      padding: 14px;
      margin: 14px 0;
      font-family: 'Courier New', monospace;
    }

    .date-box p {
      margin: 6px 0;
      font-size: 13px;
      line-height: 1.6;
    }

    .date-value {
      font-weight: bold;
      color: #1e40af;
    }

    .renewal-info {
      background: #ffffff;
      border: 2px solid #10b981;
      border-radius: 8px;
      padding: 14px;
      margin: 14px 0;
    }

    .renewal-info p {
      margin: 6px 0;
      font-size: 13px;
      line-height: 1.6;
    }
    
    .total {
      display: flex;
      justify-content: space-between;
      font-size: 18px;
      font-weight: bold;
      margin: 20px 0;
      padding: 15px 0;
      border-top: 3px solid #000;
    }

    .footer {
      text-align: center;
      margin-top: 20px;
      font-size: 13px;
      color: #555;
      border-top: 2px dashed #000;
      padding-top: 15px;
    }
    
    .footer p {
      margin: 4px 0;
    }
    
    .remaining {
      color: #dc2626;
      font-weight: bold;
    }
    
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <img src='/assets/icon.png' alt="logo" style="width: 24px; height: 24px; display: inline-block;"/>
       <img src='/assets/qr.png' alt="logo" style="width: 24px; height: 24px; display: inline-block;"/>
      <h1>Gym System</h1>
    </div>
    <p>إيصال استلام</p>
    <p>${type}</p>
    
    ${isRenewal
      ? '<div class="type-badge renewal">🔄 تجديد اشتراك</div>'
      : '<div class="type-badge new">✨ اشتراك جديد</div>'
    }

    <div class="payment-method-badge">${paymentMethodDisplay}</div>
  </div>

  ${staffName ? `<div class="staff-info">👷 <strong>الموظف:</strong> ${staffName}</div>` : ''}

  <div class="info-row">
    <strong>رقم الإيصال:</strong>
    <span>#${receiptNumber}</span>
  </div>
  <div class="info-row">
    <strong>التاريخ:</strong>
    <span>${formattedDateOnly}</span>
  </div>
  <div class="info-row">
    <strong>الوقت:</strong>
    <span>${formattedTimeOnly}</span>
  </div>

  <div class="details">
    <h3>تفاصيل العملية:</h3>
    
    ${details.memberNumber ? `
      <div class="member-number">
        رقم العضوية: ${details.memberNumber}
      </div>
    ` : ''}
    
    ${details.ptNumber ? `
      <div class="member-number">
        رقم PT: ${details.ptNumber}
      </div>
    ` : ''}
    
    ${details.memberName ? `
      <div class="detail-item">
        <strong>الاسم:</strong> ${details.memberName}
      </div>
    ` : ''}
    
    ${details.clientName ? `
      <div class="detail-item">
        <strong>العميل:</strong> ${details.clientName}
      </div>
    ` : ''}
    
    ${details.name ? `
      <div class="detail-item">
        <strong>الاسم:</strong> ${details.name}
      </div>
    ` : ''}
    
    ${details.startDate || details.expiryDate ? `
      <div class="date-box">
        <p><strong>📅 فترة الاشتراك:</strong></p>
        ${details.startDate ? `<p>من: <span class="date-value">${formatDateYMD(details.startDate)}</span></p>` : ''}
        ${details.expiryDate ? `<p>إلى: <span class="date-value">${formatDateYMD(details.expiryDate)}</span></p>` : ''}
        ${details.subscriptionDays ? `<p>المدة: <span class="date-value">${details.subscriptionDays} يوم</span></p>` : ''}
      </div>
    ` : ''}
    
    ${isRenewal && (details.newStartDate || details.newExpiryDate) ? `
      <div class="renewal-info">
        <p><strong>🔄 معلومات التجديد:</strong></p>
        ${details.newStartDate ? `<p>• من: ${formatDateYMD(details.newStartDate)}</p>` : ''}
        ${details.newExpiryDate ? `<p>• إلى: ${formatDateYMD(details.newExpiryDate)}</p>` : ''}
        ${details.subscriptionDays ? `<p>• المدة: ${details.subscriptionDays} يوم</p>` : ''}
      </div>
    ` : ''}
    
    ${isRenewal && (details.oldSessionsRemaining !== undefined || details.newSessionsRemaining !== undefined) ? `
      <div class="renewal-info">
        <p><strong>🔄 تفاصيل التجديد:</strong></p>
        ${details.oldSessionsRemaining !== undefined ? `<p>• الجلسات قبل التجديد: ${details.oldSessionsRemaining}</p>` : ''}
        ${details.newSessionsRemaining !== undefined ? `<p>• الجلسات بعد التجديد: ${details.newSessionsRemaining}</p>` : ''}
      </div>
    ` : ''}
    
    ${details.subscriptionPrice ? `
      <div class="detail-item">
        <strong>سعر الاشتراك:</strong> ${details.subscriptionPrice} جنيه
      </div>
    ` : ''}
    
    ${details.sessionsPurchased ? `
      <div class="detail-item">
        <strong>عدد الجلسات:</strong> ${details.sessionsPurchased}
      </div>
      ${details.pricePerSession ? `
        <div class="detail-item">
          <strong>سعر الجلسة:</strong> ${details.pricePerSession} جنيه
        </div>
      ` : ''}
    ` : ''}
    
    ${details.coachName ? `
      <div class="detail-item">
        <strong>المدرب:</strong> ${details.coachName}
      </div>
    ` : ''}
    
    ${details.staffName ? `
      <div>
        <strong> الموظف المسجل:</strong> ${details.staffName}
      </div>
    ` : ''}
    
    ${details.serviceType ? `
      <div class="detail-item">
        <strong>نوع الخدمة:</strong> ${details.serviceType === 'DayUse' ? 'يوم استخدام' : 'InBody'}
      </div>
    ` : ''}
    
    ${details.paidAmount !== undefined ? `
      <div class="detail-item">
        <strong>المبلغ المدفوع:</strong> ${details.paidAmount} جنيه
      </div>
    ` : ''}
    
    ${details.remainingAmount && details.remainingAmount > 0 ? `
      <div class="detail-item remaining">
        <strong>المتبقي:</strong> ${details.remainingAmount} جنيه
      </div>
    ` : ''}
  </div>

  <div class="total">
    <span>الإجمالي:</span>
    <span>${amount} جنيه</span>
  </div>

  <div class="footer">
    ${isRenewal
      ? '<p style="color: #10b981; font-weight: bold;">تم تجديد اشتراكك بنجاح 🎉</p>'
      : `<p style="color: ${THEME_COLORS.primary[500]}; font-weight: bold;">مرحباً بك معنا 🎉</p>`
    }
    <p style="font-size: 10px; margin-top: 8px;">
      مدة استرداد الأشتراك 24 ساعه
    </p>
  </div>
</body>
</html>
  `
}

// الدالة الرئيسية للطباعة
export async function printReceipt(
  data: ReceiptData,
  options?: {
    printOnly?: boolean  // ✅ طباعة فقط (بدون PDF)
    pdfOnly?: boolean    // ✅ PDF فقط (بدون طباعة)
    skipBoth?: boolean   // تخطي الطباعة والـ PDF (للاستخدام الداخلي)
  }
): Promise<{ filePath?: string } | void> {
  const receiptHTML = generateReceiptHTML(data)

  // ✅ حالة 1: طباعة فقط (بدون PDF)
  if (options?.printOnly) {
    console.log('📄 طباعة فقط (بدون PDF)')
    printReceiptTraditional(receiptHTML)
    return
  }

  // ✅ حالة 2: PDF فقط (بدون طباعة)
  if (options?.pdfOnly) {
    console.log('💾 PDF فقط (بدون طباعة)')
    try {
      const result = await printAndSaveArabicPDF(receiptHTML, data.receiptNumber, {
        skipPrint: true,
        autoDownload: true
      })
      // ✅ إرجاع مسار الملف الحقيقي (filePath) وليس blob URL
      return { filePath: result.filePath || undefined }
    } catch (error) {
      console.error('❌ خطأ في تحويل PDF:', error)
      alert('فشل تحويل الإيصال إلى PDF')
      return
    }
  }

  // ✅ حالة 3: تخطي الاثنين (للاستخدام الداخلي)
  if (options?.skipBoth) {
    console.log('⏭️ تخطي الطباعة والـ PDF')
    return
  }

  // ✅ حالة 4 (الافتراضي): طباعة + PDF معاً
  console.log('📄💾 طباعة + PDF')
  try {
    const result = await printAndSaveArabicPDF(receiptHTML, data.receiptNumber, {
      skipPrint: false,  // طباعة
      autoDownload: true // + PDF
    })

    if (!result.success) {
      console.warn('⚠️ فشل تحويل الإيصال إلى PDF، الطباعة فقط...')
      printReceiptTraditional(receiptHTML)
    }
  } catch (error) {
    console.error('❌ خطأ في طباعة/PDF:', error)
    // Fallback للطباعة فقط
    printReceiptTraditional(receiptHTML)
  }
}

// الطباعة التقليدية (كـ fallback)
function printReceiptTraditional(receiptHTML: string): void {
  const printWindow = window.open('', '_blank', 'width=302,height=600,scrollbars=no')

  if (!printWindow) {
    alert('يرجى السماح بالنوافذ المنبثقة لطباعة الإيصال')
    return
  }

  printWindow.document.open()
  printWindow.document.write(receiptHTML)
  printWindow.document.close()

  printWindow.onload = function() {
    setTimeout(() => {
      printWindow.focus()
      printWindow.print()

      printWindow.onafterprint = function() {
        printWindow.close()
      }

      setTimeout(() => {
        if (!printWindow.closed) {
          printWindow.close()
        }
      }, 1000)
    }, 500)
  }
}

// دالة مساعدة للطباعة المباشرة
export async function printReceiptFromData(
  receiptNumber: number,
  type: string,
  amount: number,
  details: any,
  date: Date | string,
  paymentMethod?: string,
  options?: {
    printOnly?: boolean  // ✅ طباعة فقط
    pdfOnly?: boolean    // ✅ PDF فقط
    skipBoth?: boolean   // تخطي الاثنين
  }
): Promise<{ filePath?: string } | void> {
  const dateObj = date instanceof Date ? date : new Date(date)

  // إضافة paymentMethod إلى details إذا تم تمريره
  const enrichedDetails = paymentMethod
    ? { ...details, paymentMethod }
    : details

  return await printReceipt({
    receiptNumber,
    type,
    amount,
    details: enrichedDetails,
    date: dateObj
  }, options)
}

// ✅ دالة جديدة: تصدير HTML الإيصال (للاستخدام في مكان آخر)
export function generateReceiptHTMLExport(
  receiptNumber: number,
  type: string,
  amount: number,
  details: any,
  date: Date | string,
  paymentMethod?: string
): string {
  const dateObj = date instanceof Date ? date : new Date(date)
  const enrichedDetails = paymentMethod
    ? { ...details, paymentMethod }
    : details

  return generateReceiptHTML({
    receiptNumber,
    type,
    amount,
    details: enrichedDetails,
    date: dateObj
  })
}
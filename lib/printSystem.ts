// نظام طباعة موحد - مع إضافة اسم الموظف + تحويل PDF
import { normalizePaymentMethod, isMultiPayment } from './paymentHelpers'
import { printAndSavePDF } from './pdfSystem'

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
  
  const formattedDate = date.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
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
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      width: 80mm;
      padding: 8mm;
      background: white;
      color: #000;
      font-size: 13px;
      line-height: 1.4;
    }
    
    .header {
      text-align: center;
      border-bottom: 2px dashed #000;
      padding-bottom: 12px;
      margin-bottom: 15px;
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
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: bold;
      display: inline-block;
      margin: 8px 0;
      color: white;
    }
    
    .type-badge.renewal {
      background: #10b981;
    }
    
    .type-badge.new {
      background: #3b82f6;
    }
    
    .payment-method-badge {
      background: #6366f1;
      color: white;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: bold;
      display: inline-block;
      margin: 8px 0;
    }
    
    .staff-badge {
      background: #f59e0b;
      color: white;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: bold;
      display: inline-block;
      margin: 8px 0;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      margin: 6px 0;
      font-size: 13px;
    }
    
    .info-row strong {
      font-weight: 600;
    }
    
    .details {
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      padding: 12px 0;
      margin: 12px 0;
    }
    
    .details h3 {
      font-size: 15px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    
    .detail-item {
      margin: 6px 0;
      font-size: 13px;
    }
    
    .detail-item strong {
      font-weight: 600;
      margin-left: 5px;
    }
    
    .member-number {
      font-size: 19px;
      font-weight: bold;
      color: #2563eb;
      text-align: center;
      margin: 12px 0;
      padding: 10px;
      background: #eff6ff;
      border-radius: 6px;
      border: 2px solid #2563eb;
    }
    
    .date-box {
      background: #f0f9ff;
      border: 2px solid #3b82f6;
      border-radius: 8px;
      padding: 10px;
      margin: 10px 0;
      font-family: 'Courier New', monospace;
    }
    
    .date-box p {
      margin: 4px 0;
      font-size: 12px;
    }
    
    .date-value {
      font-weight: bold;
      color: #1e40af;
    }
    
    .renewal-info {
      background: #d1fae5;
      border: 2px solid #10b981;
      border-radius: 8px;
      padding: 10px;
      margin: 10px 0;
    }
    
    .renewal-info p {
      margin: 4px 0;
      font-size: 12px;
    }
    
    .total {
      display: flex;
      justify-content: space-between;
      font-size: 17px;
      font-weight: bold;
      margin: 15px 0;
      padding: 12px 0;
      border-top: 3px solid #000;
    }
    
    .footer {
      text-align: center;
      margin-top: 15px;
      font-size: 12px;
      color: #555;
      border-top: 2px dashed #000;
      padding-top: 12px;
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
      <h1>X GYM</h1>
    </div>
    <p>إيصال استلام</p>
    <p>${type}</p>
    
    ${isRenewal
      ? '<div class="type-badge renewal">🔄 تجديد اشتراك</div>'
      : '<div class="type-badge new">✨ اشتراك جديد</div>'
    }

    <div class="payment-method-badge ${isMulti ? 'multi-payment' : ''}">${paymentMethodDisplay}</div>

    ${staffName ? `<div class="staff-badge">👷 ${staffName}</div>` : ''}
  </div>

  <div class="info-row">
    <strong>رقم الإيصال:</strong>
    <span>#${receiptNumber}</span>
  </div>
  <div class="info-row">
    <strong>التاريخ:</strong>
    <span>${formattedDate}</span>
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
      : '<p style="color: #3b82f6; font-weight: bold;">مرحباً بك معنا 🎉</p>'
    }
    <p style="font-size: 10px; margin-top: 8px;">
      مدة استرداد الأشتراك 24 ساعه
    </p>
  </div>
</body>
</html>
  `
}

// الدالة الرئيسية للطباعة (مع PDF)
export async function printReceipt(data: ReceiptData, options?: { pdfOnly?: boolean }): Promise<void> {
  const receiptHTML = generateReceiptHTML(data)

  try {
    // ✅ طباعة + تحويل PDF
    const result = await printAndSavePDF(receiptHTML, data.receiptNumber, {
      skipPrint: options?.pdfOnly || false,
      autoDownload: true
    })

    if (!result.success) {
      console.warn('⚠️ فشل تحويل الإيصال إلى PDF، استخدام الطباعة التقليدية...')
      // Fallback للطباعة التقليدية
      printReceiptTraditional(receiptHTML)
    }
  } catch (error) {
    console.error('❌ خطأ في طباعة الإيصال:', error)
    // Fallback للطباعة التقليدية
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
  options?: { pdfOnly?: boolean }
): Promise<void> {
  const dateObj = date instanceof Date ? date : new Date(date)

  // إضافة paymentMethod إلى details إذا تم تمريره
  const enrichedDetails = paymentMethod
    ? { ...details, paymentMethod }
    : details

  await printReceipt({
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
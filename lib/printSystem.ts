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
  receiptTerms?: string
  gymLogo?: string | null
  gymName?: string | null
  showAppLinks?: boolean
  androidAppUrl?: string | null
  iosAppUrl?: string | null
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
  const { receiptNumber, type, amount, details, date, receiptTerms, gymLogo, gymName } = data
  
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
  // التحقق إذا كان إيصال دفع باقي
  const isPayment = type === 'Payment'

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
  <meta name="viewport" content="width=device-width">
  <link href="/fonts/almarai.css" rel="stylesheet">
  <title>إيصال ${receiptNumber}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    @page {
      size: A4;
      margin: 8mm;
    }

    body {
      font-family: 'Almarai', Tahoma, 'Segoe UI', Arial, sans-serif;
      width: 100%;
      max-width: 700px;
      padding: 5mm;
      background: #ffffff;
      color: #000;
      font-size: 13px;
      line-height: 1.3;
      direction: rtl;
      unicode-bidi: bidi-override;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: geometricPrecision;
      margin: 0 auto;
      box-sizing: border-box;
    }

    .header {
      display: flex;
      align-items: center;
      border-bottom: 1px dashed #000;
      padding-bottom: 4px;
      margin-bottom: 4px;
      gap: 10px;
    }

    .header-logo {
      flex-shrink: 0;
    }

    .header-text {
      flex: 1;
      text-align: center;
    }

    .header-spacer {
      flex-shrink: 0;
    }

    .header h1 {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 1px;
    }

    .header p {
      font-size: 12px;
      margin: 1px 0;
      color: #333;
    }

    .payment-method-inline {
      font-size: 12px;
      font-weight: bold;
      margin: 2px 0;
      line-height: 1.3;
    }

    .staff-info {
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      padding: 3px;
      border-radius: 3px;
      font-size: 11px;
      margin: 3px 0;
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
      margin: 2px 0;
      padding: 1px 0;
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
      font-size: 12px;
      flex: 1;
      min-width: 0;
    }

    .details {
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
      padding: 4px 0;
      margin-top: 4px;
      margin-bottom: 4px;
    }

    .details h3 {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 3px;
    }

    .detail-item {
      margin: 2px 0;
      font-size: 12px;
      line-height: 1.3;
    }

    .detail-item strong {
      font-weight: 600;
      margin-left: 4px;
    }

    .member-number {
      font-size: 14px;
      font-weight: bold;
      color: ${THEME_COLORS.primary[600]};
      text-align: center;
      margin: 3px 0;
      padding: 4px;
      background: #ffffff;
      border-radius: 3px;
      border: 1px solid ${THEME_COLORS.primary[600]};
    }

    .date-box {
      background: #ffffff;
      border: 1px solid ${THEME_COLORS.primary[500]};
      border-radius: 3px;
      padding: 4px;
      margin: 3px 0;
      font-family: 'Courier New', monospace;
    }

    .date-box p {
      margin: 1px 0;
      font-size: 11px;
      line-height: 1.3;
    }

    .date-value {
      font-weight: bold;
      color: #1e40af;
    }

    .renewal-info {
      background: #ffffff;
      border: 1px solid #10b981;
      border-radius: 3px;
      padding: 4px;
      margin: 3px 0;
    }

    .renewal-info p {
      margin: 1px 0;
      font-size: 11px;
      line-height: 1.3;
    }

    .total {
      display: flex;
      justify-content: space-between;
      font-size: 16px;
      font-weight: bold;
      margin: 4px 0;
      padding: 4px 0;
      border-top: 2px solid #000;
    }

    .terms {
      background: #f9fafb;
      border: 1px solid #d1d5db;
      border-radius: 3px;
      padding: 5px 8px;
      margin: 5px 0;
    }

    .terms h4 {
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 2px;
      color: #1f2937;
    }

    .terms p {
      font-size: 10px;
      line-height: 1.5;
      color: #374151;
      white-space: pre-line;
    }

    .footer {
      text-align: center;
      margin-top: 5px;
      font-size: 11px;
      color: #555;
      border-top: 1px dashed #000;
      padding-top: 4px;
    }

    .footer p {
      margin: 1px 0;
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
    ${gymLogo ? `<div class="header-logo"><img src="${gymLogo}" alt="logo" style="width: 80px; height: 80px; object-fit: contain; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.5)) drop-shadow(0 2px 4px rgba(0,0,0,0.4));"/></div>` : ''}
    <div class="header-text">
      <h1>${gymName || 'Gym System'}</h1>
      <p>إيصال استلام</p>
      <p>${type}</p>
    </div>
    ${gymLogo ? `<div class="header-spacer" style="width: 80px;"></div>` : ''}
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

    ${details.phone ? `
      <div class="detail-item">
        <strong>الهاتف:</strong> ${details.phone}
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
    
    <div class="payment-method-inline">
      <strong>طريقة الدفع:</strong> ${paymentMethodDisplay}
    </div>
    
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
    
    ${isPayment && details.subscriptionPrice ? `
      <div class="detail-item">
        <strong>سعر الاشتراك الكامل:</strong> ${details.subscriptionPrice} جنيه
      </div>
    ` : ''}

    ${isPayment && details.previousRemaining !== undefined ? `
      <div class="detail-item">
        <strong>الباقي قبل الدفع:</strong> ${details.previousRemaining} جنيه
      </div>
    ` : ''}

    ${details.upgradeAmount ? `
      <div class="detail-item">
        <strong>سعر الترقية الكامل:</strong> ${details.upgradeAmount} جنيه
      </div>
    ` : ''}

    ${details.balanceDeducted && details.balanceDeducted > 0 ? `
      <div class="detail-item" style="color: #059669;">
        <strong>باقي مبلغ:</strong> ${details.balanceDeducted} جنيه
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

    ${(details.paidAmount !== undefined || (details.remainingAmount && details.remainingAmount > 0)) ? `
      <div class="total">
        <span>${isPayment ? 'المدفوع اليوم:' : 'سعر الاشتراك:'}</span>
        <span>${amount} جنيه</span>
      </div>
    ` : ''}
  </div>

  ${!(details.paidAmount !== undefined || (details.remainingAmount && details.remainingAmount > 0)) ? `
  <div class="total">
    <span>الإجمالي:</span>
    <span>${amount} جنيه</span>
  </div>
  ` : ''}

  <div class="footer">
    ${isRenewal
      ? '<p style="color: #10b981; font-weight: bold;">تم تجديد اشتراكك بنجاح 🎉</p>'
      : `<p style="color: ${THEME_COLORS.primary[500]}; font-weight: bold;">مرحباً بك معنا 🎉</p>`
    }
    <p style="font-size: 14px; margin-top: 6px; font-weight: bold; color: #dc2626;">
      الاشتراك لا يرد
    </p>
    ${data.showAppLinks ? `
    <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #ccc; text-align: center;">
      <p style="font-size: 11px; color: #555; margin-bottom: 8px; font-weight: bold;">📱 حمّل تطبيقنا</p>
      <div style="display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; align-items: flex-end;">
        <div style="text-align: center;">
          <img src="/adnroid.png" style="width: 80px; height: 80px; object-fit: contain;" alt="Android QR" />
          <p style="font-size: 9px; color: #3ddc84; margin-top: 3px; font-weight: bold;">🤖 Android</p>
        </div>
        <div style="text-align: center;">
          <img src="/ios.png" style="width: 80px; height: 80px; object-fit: contain;" alt="iOS QR" />
          <p style="font-size: 9px; color: #555; margin-top: 3px; font-weight: bold;">🍎 iOS</p>
        </div>
      </div>
    </div>
    ` : ''}
  </div>

  ${receiptTerms ? `
  <div class="terms">
    <h4>الشروط والأحكام:</h4>
    <p>${receiptTerms}</p>
  </div>
  ` : ''}
</body>
</html>
  `
}

// جلب شروط الإيصال + اللوجو من الإعدادات
async function fetchReceiptSettings(): Promise<{ receiptTerms: string; gymLogo: string | null; gymName: string | null; showAppLinks: boolean; androidAppUrl: string | null; iosAppUrl: string | null }> {
  const defaultTerms = 'الساده الاعضاء حرصا منا على تقديم خدمه افضل وحفاظا على سير النظام العام للمكان بشكل مرضى يرجى الالتزام بالتعليمات الاتيه :\n\n١- الاشتراك لا يرد الا خلال ٢٤ ساعه بعد خصم قيمه الحصه\n٢- لا يجوز التمرين بخلاف الزى الرياضى\n٣- ممنوع اصطحاب الاطفال او الماكولات داخل الجيم\n٤- الاداره غير مسئوله عن المتعلقات الشخصيه'
  try {
    const res = await fetch('/api/settings/services')
    if (res.ok) {
      const data = await res.json()
      return {
        receiptTerms: data.receiptTerms || defaultTerms,
        gymLogo: data.gymLogo || null,
        gymName: data.gymName || null,
        showAppLinks: data.showAppLinksOnReceipts || false,
        androidAppUrl: data.androidAppUrl || null,
        iosAppUrl: data.iosAppUrl || null,
      }
    }
  } catch (e) {
  }
  return { receiptTerms: defaultTerms, gymLogo: null, gymName: null, showAppLinks: false, androidAppUrl: null, iosAppUrl: null }
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
  // جلب الشروط واللوجو والاسم لو مش موجودين
  if (!data.receiptTerms || data.gymLogo === undefined || data.gymName === undefined || data.showAppLinks === undefined) {
    const settings = await fetchReceiptSettings()
    if (!data.receiptTerms) data.receiptTerms = settings.receiptTerms
    if (data.gymLogo === undefined) data.gymLogo = settings.gymLogo
    if (data.gymName === undefined) data.gymName = settings.gymName
    if (data.showAppLinks === undefined) data.showAppLinks = settings.showAppLinks
    if (data.androidAppUrl === undefined) data.androidAppUrl = settings.androidAppUrl
    if (data.iosAppUrl === undefined) data.iosAppUrl = settings.iosAppUrl
  }
  const receiptHTML = generateReceiptHTML(data)

  // ✅ حالة 1: طباعة فقط (بدون PDF)
  if (options?.printOnly) {
    printReceiptTraditional(receiptHTML)
    return
  }

  // ✅ حالة 2: PDF فقط (بدون طباعة)
  if (options?.pdfOnly) {
    try {
      const result = await printAndSaveArabicPDF(receiptHTML, data.receiptNumber, {
        skipPrint: true,
        autoDownload: true
      })
      // ✅ إرجاع مسار الملف الحقيقي (filePath) وليس blob URL
      return { filePath: result.filePath || undefined }
    } catch (error) {
      console.error('❌ خطأ في تحويل PDF:', error)
      // سيتم معالجة الخطأ في المكون المستدعي
      throw new Error('فشل تحويل الإيصال إلى PDF')
    }
  }

  // ✅ حالة 3: تخطي الاثنين (للاستخدام الداخلي)
  if (options?.skipBoth) {
    return
  }

  // ✅ حالة 4 (الافتراضي): طباعة + PDF معاً
  try {
    const result = await printAndSaveArabicPDF(receiptHTML, data.receiptNumber, {
      skipPrint: false,  // طباعة
      autoDownload: true // + PDF
    })

    if (!result.success) {
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
  const printWindow = window.open('', '_blank', 'width=800,height=900,scrollbars=yes')

  if (!printWindow) {
    // سيتم معالجة الخطأ في المكون المستدعي
    throw new Error('يرجى السماح بالنوافذ المنبثقة لطباعة الإيصال')
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
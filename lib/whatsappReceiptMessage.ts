// lib/whatsappReceiptMessage.ts
// صياغة الرسالة الموحدة للإيصال على الواتساب
// نفس الصيغة المستخدمة في صفحة الإيصالات (components/ReceiptWhatsApp.tsx)
// عشان أي مكان في النظام يبعت إيصال يطلع بنفس الشكل بالظبط.

import { normalizePaymentMethod, isMultiPayment, getPaymentMethodLabel } from './paymentHelpers'

export interface PrepareReceiptMessageInput {
  receiptNumber: number
  type: string
  amount: number
  date: string | Date
  paymentMethod: string
  staffName?: string
  /** الـ itemDetails بعد JSON.parse — أو object مباشرة */
  details: any
  /** fallback لرقم العضو لو مش موجود في details */
  memberPhoneFallback?: string
}

export interface PrepareReceiptMessageOptions {
  receiptTerms?: string
  websiteUrl?: string
  showWebsite?: boolean
  androidAppUrl?: string
  iosAppUrl?: string
  showAppLinks?: boolean
}

const DEFAULT_TERMS = 'الساده الاعضاء حرصا منا على تقديم خدمه افضل وحفاظا على سير النظام العام للمكان بشكل مرضى يرجى الالتزام بالتعليمات الاتيه :\n\n١- الاشتراك لا يرد الا خلال ٢٤ ساعه بعد خصم قيمه الحصه\n٢- لا يجوز التمرين بخلاف الزى الرياضى\n٣- ممنوع اصطحاب الاطفال او الماكولات داخل الجيم\n٤- الاداره غير مسئوله عن المتعلقات الشخصيه'

function getReceiptTypeName(type: string): string {
  const typeMap: Record<string, string> = {
    // Membership
    'Member': 'اشتراك عضوية',
    'عضوية': 'اشتراك عضوية',
    'تجديد عضويه': 'تجديد عضوية',
    'membershipRenewal': 'تجديد عضوية',
    'ترقية باكدج': 'ترقية باكدج',
    'newMember': 'اشتراك عضوية',
    'Payment': 'دفع متبقي',
    // PT
    'PT': 'تدريب شخصي',
    'اشتراك برايفت': 'تدريب شخصي',
    'تجديد برايفت': 'تجديد تدريب شخصي',
    'newPT': 'تدريب شخصي',
    'ptRenewal': 'تجديد تدريب شخصي',
    'ptDayUse': 'تدريب شخصي يومي',
    'دفع باقي برايفت': 'دفع متبقي تدريب شخصي',
    // Nutrition
    'newNutrition': 'تغذية',
    'nutritionRenewal': 'تجديد تغذية',
    'nutritionDayUse': 'تغذية يومي',
    'دفع باقي تغذية': 'دفع متبقي تغذية',
    // Physiotherapy
    'newPhysiotherapy': 'علاج طبيعي',
    'physiotherapyRenewal': 'تجديد علاج طبيعي',
    'physiotherapyDayUse': 'علاج طبيعي يومي',
    'دفع باقي علاج طبيعي': 'دفع متبقي علاج طبيعي',
    // Group Class
    'newGroupClass': 'حصص جماعية',
    'groupClassRenewal': 'تجديد حصص جماعية',
    'groupClassDayUse': 'حصص جماعية يومي',
    'دفع باقي جروب كلاسيس': 'دفع متبقي حصص جماعية',
    // More
    'moreSubscription': 'اشتراك مزيد',
    'moreRenewal': 'تجديد مزيد',
    'دفع باقي مزيد': 'دفع متبقي مزيد',
    // Other
    'DayUse': 'استخدام يومي',
    'يوم استخدام': 'استخدام يومي',
    'Expense': 'مصروف',
    'inBody': 'InBody',
    'تأجير لوجر': 'تأجير لوجر',
    'lockerRental': 'تأجير لوجر',
  }
  return typeMap[type] || type
}

export function prepareReceiptMessage(
  data: PrepareReceiptMessageInput,
  options: PrepareReceiptMessageOptions = {}
): string {
  const details = data.details || {}
  const date = new Date(data.date)
  const formattedDate = date.toLocaleDateString('ar-EG')
  const formattedTime = date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })

  const memberPhone = data.memberPhoneFallback || ''
  const receiptTerms = options.receiptTerms ?? DEFAULT_TERMS

  // الترويسة
  let message = `━━━━━━━━━━━━━━━━━━━━\n`
  message += `🧾 *ايصال رقم #${data.receiptNumber}*\n`
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`

  const typeName = getReceiptTypeName(data.type)
  message += `📋 *النوع:* ${typeName}\n\n`

  // تفاصيل العميل/العضو
  if (details.memberNumber) {
    message += `🆔 *رقم العضو:* ${details.memberNumber}\n`
  }
  if (details.memberName || details.clientName || details.name) {
    message += `👤 *الاسم:* ${details.memberName || details.clientName || details.name}\n`
  }
  if (details.phone || details.memberPhone || details.clientPhone || memberPhone) {
    message += `📱 *الهاتف:* ${details.phone || details.memberPhone || details.clientPhone || memberPhone}\n`
  }
  message += `\n`

  // تفاصيل الاشتراك - عضوية
  const membershipTypes = ['Member', 'عضوية', 'تجديد عضويه', 'membershipRenewal', 'ترقية باكدج', 'newMember']
  if (membershipTypes.includes(data.type) && details.subscriptionDays) {
    message += `━━━━━━━━━━━━━━━━━━━━\n`
    message += `🎫 *تفاصيل الاشتراك*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n`
    if (details.startDate) {
      message += `📅 من: ${new Date(details.startDate).toLocaleDateString('ar-EG')}\n`
    }
    if (details.expiryDate) {
      message += `📅 الى: ${new Date(details.expiryDate).toLocaleDateString('ar-EG')}\n`
    }
    message += `⏰ المدة: ${details.subscriptionDays} يوم\n`

    const extras: string[] = []
    if (details.freePTSessions > 0) extras.push(`${details.freePTSessions} جلسة PT`)
    if (details.inBodyScans > 0) extras.push(`${details.inBodyScans} InBody`)
    if (details.invitations > 0) extras.push(`${details.invitations} دعوة`)
    if (extras.length > 0) {
      message += `🎁 *هدايا:* ${extras.join(' + ')}\n`
    }
    message += `\n`
  }

  // تفاصيل التدريب الشخصي
  const ptTypes = ['PT', 'اشتراك برايفت', 'تجديد برايفت', 'newPT', 'ptRenewal', 'ptDayUse', 'دفع باقي برايفت']
  if (ptTypes.includes(data.type) || data.type.includes('برايفت')) {
    message += `━━━━━━━━━━━━━━━━━━━━\n`
    message += `💪 *تفاصيل التدريب*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n`
    if (details.ptNumber) {
      message += `🔢 رقم PT: ${details.ptNumber}\n`
    }
    if (details.sessions || details.sessionsPurchased) {
      message += `🎯 عدد الجلسات: ${details.sessions || details.sessionsPurchased}\n`
    }
    if (details.pricePerSession) {
      message += `💵 سعر الجلسة: ${details.pricePerSession} ج.م\n`
    }
    if (details.coachName) {
      message += `🏋️ الكوتش: ${details.coachName}\n`
    }
    if (details.startDate && details.expiryDate) {
      message += `📅 من: ${new Date(details.startDate).toLocaleDateString('ar-EG')}\n`
      message += `📅 الى: ${new Date(details.expiryDate).toLocaleDateString('ar-EG')}\n`
    }
    if (details.oldRemainingAmount && details.oldRemainingAmount > 0) {
      message += `↩️ المبلغ المتبقي المرتجع: ${details.oldRemainingAmount} ج.م\n`
    }
    message += `\n`
  }

  // تفاصيل التغذية
  const nutritionTypes = ['newNutrition', 'nutritionRenewal', 'nutritionDayUse']
  if (nutritionTypes.includes(data.type)) {
    message += `━━━━━━━━━━━━━━━━━━━━\n`
    message += `🥗 *تفاصيل التغذية*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n`
    if (details.sessions || details.sessionsPurchased) {
      message += `🎯 عدد الجلسات: ${details.sessions || details.sessionsPurchased}\n`
    }
    if (details.nutritionistName || details.specialistName) {
      message += `👨‍⚕️ الاخصائي: ${details.nutritionistName || details.specialistName}\n`
    }
    if (details.pricePerSession) {
      message += `💵 سعر الجلسة: ${details.pricePerSession} ج.م\n`
    }
    if (details.startDate && details.expiryDate) {
      message += `📅 من: ${new Date(details.startDate).toLocaleDateString('ar-EG')}\n`
      message += `📅 الى: ${new Date(details.expiryDate).toLocaleDateString('ar-EG')}\n`
    }
    message += `\n`
  }

  // تفاصيل العلاج الطبيعي
  const physioTypes = ['newPhysiotherapy', 'physiotherapyRenewal', 'physiotherapyDayUse']
  if (physioTypes.includes(data.type)) {
    message += `━━━━━━━━━━━━━━━━━━━━\n`
    message += `🏥 *تفاصيل العلاج الطبيعي*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n`
    if (details.sessions || details.sessionsPurchased) {
      message += `🎯 عدد الجلسات: ${details.sessions || details.sessionsPurchased}\n`
    }
    if (details.therapistName || details.specialistName) {
      message += `👨‍⚕️ الاخصائي: ${details.therapistName || details.specialistName}\n`
    }
    if (details.pricePerSession) {
      message += `💵 سعر الجلسة: ${details.pricePerSession} ج.م\n`
    }
    if (details.startDate && details.expiryDate) {
      message += `📅 من: ${new Date(details.startDate).toLocaleDateString('ar-EG')}\n`
      message += `📅 الى: ${new Date(details.expiryDate).toLocaleDateString('ar-EG')}\n`
    }
    message += `\n`
  }

  // تفاصيل الحصص الجماعية
  const groupClassTypes = ['newGroupClass', 'groupClassRenewal', 'groupClassDayUse']
  if (groupClassTypes.includes(data.type)) {
    message += `━━━━━━━━━━━━━━━━━━━━\n`
    message += `👥 *تفاصيل الحصص الجماعية*\n`
    message += `━━━━━━━━━━━━━━━━━━━━\n`
    if (details.sessions || details.sessionsPurchased) {
      message += `🎯 عدد الجلسات: ${details.sessions || details.sessionsPurchased}\n`
    }
    if (details.instructorName || details.specialistName) {
      message += `🏋️ المدرب: ${details.instructorName || details.specialistName}\n`
    }
    if (details.pricePerSession) {
      message += `💵 سعر الجلسة: ${details.pricePerSession} ج.م\n`
    }
    if (details.startDate && details.expiryDate) {
      message += `📅 من: ${new Date(details.startDate).toLocaleDateString('ar-EG')}\n`
      message += `📅 الى: ${new Date(details.expiryDate).toLocaleDateString('ar-EG')}\n`
    }
    message += `\n`
  }

  // المبالغ المالية
  message += `━━━━━━━━━━━━━━━━━━━━\n`
  message += `💰 *التفاصيل المالية*\n`
  message += `━━━━━━━━━━━━━━━━━━━━\n`

  if (details.upgradeAmount > 0) {
    message += `⬆️ سعر الترقية الكامل: ${details.upgradeAmount} ج.م\n`
  }
  if (details.balanceDeducted > 0) {
    message += `🔄 باقي مبلغ: ${details.balanceDeducted} ج.م\n`
  }
  if (details.subscriptionPrice > 0) {
    message += `🏷️ سعر الاشتراك: ${details.subscriptionPrice} ج.م\n`
  }
  if (details.totalPrice > 0 && (ptTypes.includes(data.type) || data.type.includes('برايفت'))) {
    message += `💵 الاجمالي: ${details.totalPrice} ج.م\n`
  }

  message += `✅ *المدفوع:* ${data.amount} ج.م\n`

  if (details.remainingAmount > 0) {
    message += `⚠️ *المتبقي:* ${details.remainingAmount} ج.م\n`
  }

  // طريقة الدفع
  const isMulti = isMultiPayment(data.paymentMethod)
  if (isMulti) {
    const normalized = normalizePaymentMethod(data.paymentMethod, data.amount)
    message += `💳 *طريقة الدفع:* متعددة\n`
    normalized.methods.forEach((m: any) => {
      message += `  • ${getPaymentMethodLabel(m.method, 'ar')}: ${m.amount.toFixed(2)} ج.م\n`
    })
  } else {
    const paymentName = getPaymentMethodLabel(data.paymentMethod, 'ar')
    message += `💳 *طريقة الدفع:* ${paymentName}\n`
  }
  message += `\n`

  // التاريخ والموظف
  message += `━━━━━━━━━━━━━━━━━━━━\n`
  message += `📅 *التاريخ:* ${formattedDate}\n`
  message += `⏰ *الوقت:* ${formattedTime}\n`
  if (details.staffName || data.staffName) {
    message += `👨‍💼 *الموظف:* ${details.staffName || data.staffName}\n`
  }
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`

  // الشكر
  message += `🙏 شكرا لثقتكم بنا\n`
  message += `✨ نتمنى لكم تجربة رائعة\n\n`

  // الشروط والأحكام
  message += `━━━━━━━━━━━━━━━━━━━━\n`
  message += `📜 *شروط وأحكام*\n`
  message += `━━━━━━━━━━━━━━━━━━━━\n`
  message += `${receiptTerms}\n\n`

  // الموقع الإلكتروني
  if (options.showWebsite && options.websiteUrl) {
    message += `🌐 *الموقع الإلكتروني:*\n`
    message += `${options.websiteUrl}\n`
  }

  // روابط التطبيق
  if (options.showAppLinks && (options.androidAppUrl || options.iosAppUrl)) {
    message += `\n📱 *حمّل تطبيقنا:*\n`
    if (options.androidAppUrl) {
      message += `🤖 Android:\n${options.androidAppUrl}\n`
    }
    if (options.iosAppUrl) {
      message += `🍎 iOS:\n${options.iosAppUrl}\n`
    }
  }

  return message
}

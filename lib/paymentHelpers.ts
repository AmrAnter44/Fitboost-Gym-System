// lib/paymentHelpers.ts
// دوال مساعدة للتعامل مع نظام الدفع المتعدد (Multi-Payment Methods)

export interface PaymentMethod {
  method: 'cash' | 'visa' | 'instapay' | 'wallet' | 'points'
  amount: number
  pointsUsed?: number  // عدد النقاط المستخدمة (فقط عند method = 'points')
}

export interface PaymentData {
  methods: PaymentMethod[]
}

/**
 * التحقق من نوع البيانات (قديمة أم جديدة)
 * البيانات القديمة: "cash" (string بسيط)
 * البيانات الجديدة: {"methods":[{method:"cash",amount:1000}]} (JSON)
 */
export function isMultiPayment(paymentMethod: string): boolean {
  try {
    const parsed = JSON.parse(paymentMethod)
    return parsed.methods && Array.isArray(parsed.methods)
  } catch {
    return false
  }
}

/**
 * تحويل البيانات القديمة/الجديدة لصيغة موحدة
 * @param paymentMethod - البيانات المخزنة في قاعدة البيانات
 * @param totalAmount - المبلغ الإجمالي (للبيانات القديمة فقط)
 * @returns PaymentData بصيغة موحدة
 */
export function normalizePaymentMethod(
  paymentMethod: string,
  totalAmount: number
): PaymentData {
  if (isMultiPayment(paymentMethod)) {
    return JSON.parse(paymentMethod)
  }

  // تحويل البيانات القديمة (string بسيط) للصيغة الجديدة
  const method = (paymentMethod || 'cash') as PaymentMethod['method']
  return {
    methods: [{ method, amount: totalAmount }]
  }
}

/**
 * حساب المبلغ الكلي من وسائل الدفع
 * @param paymentMethod - البيانات المخزنة في قاعدة البيانات
 * @returns المبلغ الإجمالي
 */
export function getTotalPaymentAmount(paymentMethod: string): number {
  const normalized = normalizePaymentMethod(paymentMethod, 0)
  return normalized.methods.reduce((sum, m) => sum + m.amount, 0)
}

/**
 * التحقق من صحة توزيع المبالغ على وسائل الدفع
 * @param methods - وسائل الدفع المراد التحقق منها
 * @param expectedTotal - المبلغ المتوقع (المطلوب)
 * @returns نتيجة التحقق مع رسالة الخطأ إن وجدت
 */
export function validatePaymentDistribution(
  methods: PaymentMethod[],
  expectedTotal: number
): { valid: boolean; message?: string } {
  // حساب المجموع
  const total = methods.reduce((sum, m) => sum + m.amount, 0)

  // التحقق من التطابق (مع هامش خطأ صغير للأرقام العشرية)
  if (Math.abs(total - expectedTotal) > 0.01) {
    return {
      valid: false,
      message: `المبلغ الكلي ${total} لا يساوي المطلوب ${expectedTotal}`
    }
  }

  // التحقق من أن جميع المبالغ موجبة
  const hasInvalidAmount = methods.some(m => m.amount <= 0)
  if (hasInvalidAmount) {
    return {
      valid: false,
      message: 'جميع المبالغ يجب أن تكون أكبر من صفر'
    }
  }

  // التحقق من عدم وجود وسائل مكررة
  const methodNames = methods.map(m => m.method)
  const uniqueMethodNames = new Set(methodNames)
  if (methodNames.length !== uniqueMethodNames.size) {
    return {
      valid: false,
      message: 'لا يمكن استخدام نفس وسيلة الدفع أكثر من مرة'
    }
  }

  return { valid: true }
}

/**
 * تحويل وسائل الدفع للتخزين في قاعدة البيانات
 * @param methods - وسائل الدفع
 * @returns JSON string للتخزين
 */
export function serializePaymentMethods(methods: PaymentMethod[]): string {
  return JSON.stringify({ methods })
}

/**
 * استخراج وسائل الدفع من JSON المخزن
 * @param paymentMethod - البيانات المخزنة
 * @returns مصفوفة وسائل الدفع
 */
export function deserializePaymentMethods(paymentMethod: string): PaymentMethod[] {
  const normalized = normalizePaymentMethod(paymentMethod, 0)
  return normalized.methods
}

/**
 * التحقق من استخدام وسيلة دفع معينة
 * @param paymentMethod - البيانات المخزنة
 * @param method - الوسيلة المراد البحث عنها
 * @returns true إذا كانت الوسيلة مستخدمة
 */
export function hasPaymentMethod(
  paymentMethod: string,
  method: PaymentMethod['method']
): boolean {
  const methods = deserializePaymentMethods(paymentMethod)
  return methods.some(m => m.method === method)
}

/**
 * الحصول على المبلغ لوسيلة دفع محددة
 * @param paymentMethod - البيانات المخزنة
 * @param method - الوسيلة المطلوبة
 * @returns المبلغ (0 إذا لم تكن موجودة)
 */
export function getPaymentMethodAmount(
  paymentMethod: string,
  method: PaymentMethod['method']
): number {
  const methods = deserializePaymentMethods(paymentMethod)
  const found = methods.find(m => m.method === method)
  return found ? found.amount : 0
}

/**
 * الحصول على اسم وسيلة الدفع مع الإيموجي
 * @param method - وسيلة الدفع
 * @param locale - اللغة (ar أو en)
 * @returns اسم الوسيلة مع الإيموجي
 */
export function getPaymentMethodLabel(method: string, locale: string = 'ar'): string {
  const labelsAr: Record<string, string> = {
    'cash': 'كاش 💵',
    'visa': 'فيزا 💳',
    'instapay': 'إنستاباي 📱',
    'wallet': 'محفظة 💰',
    'points': 'نقاط 🏆'
  }

  const labelsEn: Record<string, string> = {
    'cash': 'Cash 💵',
    'visa': 'Visa 💳',
    'instapay': 'InstaPay 📱',
    'wallet': 'Wallet 💰',
    'points': 'Points 🏆'
  }

  const labels = locale === 'ar' ? labelsAr : labelsEn
  return labels[method] || method
}

/**
 * حساب عدد النقاط المطلوبة للدفع بمبلغ معين
 * @param amount - المبلغ المراد دفعه بالنقاط
 * @param pointsValueInEGP - قيمة النقطة الواحدة بالجنيه المصري
 * @returns عدد النقاط المطلوبة
 */
export function calculatePointsRequired(amount: number, pointsValueInEGP: number): number {
  if (pointsValueInEGP <= 0) return 0
  return Math.ceil(amount / pointsValueInEGP)
}

/**
 * حساب قيمة النقاط بالجنيه المصري
 * @param points - عدد النقاط
 * @param pointsValueInEGP - قيمة النقطة الواحدة بالجنيه المصري
 * @returns القيمة بالجنيه
 */
export function calculatePointsValue(points: number, pointsValueInEGP: number): number {
  return points * pointsValueInEGP
}

/**
 * استخراج عدد النقاط المستخدمة من وسائل الدفع
 * @param methods - وسائل الدفع
 * @returns عدد النقاط المستخدمة (0 إذا لم تُستخدم النقاط)
 */
export function getPointsUsedFromPayment(methods: PaymentMethod[]): number {
  const pointsMethod = methods.find(m => m.method === 'points')
  return pointsMethod?.pointsUsed || 0
}

/**
 * حساب المبلغ الفعلي المدفوع (بدون قيمة النقاط المستخدمة)
 * يُستخدم لحساب نقاط المكافأة - حيث لا نعطي نقاط على النقاط المستخدمة
 * @param paymentMethod - وسيلة الدفع (string أو array)
 * @param totalAmount - المبلغ الإجمالي
 * @returns المبلغ الفعلي المدفوع (نقدي/فيزا/إلخ - بدون النقاط)
 */
export function getActualAmountPaid(
  paymentMethod: string | PaymentMethod[],
  totalAmount: number
): number {
  let methods: PaymentMethod[] = []

  if (typeof paymentMethod === 'string') {
    methods = deserializePaymentMethods(paymentMethod)
  } else if (Array.isArray(paymentMethod)) {
    methods = paymentMethod
  } else {
    return totalAmount // لا توجد نقاط، المبلغ كامل
  }

  // حساب قيمة النقاط المستخدمة (المبلغ المدفوع بالنقاط)
  const pointsMethod = methods.find(m => m.method === 'points')
  const pointsAmount = pointsMethod?.amount || 0

  // المبلغ الفعلي = المبلغ الكلي - قيمة النقاط المستخدمة
  return totalAmount - pointsAmount
}

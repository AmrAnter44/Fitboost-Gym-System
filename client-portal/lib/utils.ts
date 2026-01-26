/**
 * Utility functions for the client portal
 */

/**
 * Calculate remaining days until expiry
 */
export function calculateRemainingDays(expiryDate: Date | null): number {
  if (!expiryDate) return 0;

  const today = new Date();
  const expiry = new Date(expiryDate);

  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Get membership status based on expiry date
 */
export type MembershipStatus = 'active' | 'expired' | 'expiring_soon';

export function getMembershipStatus(
  expiryDate: Date | null,
  isActive: boolean,
  expiringThresholdDays: number = 7
): MembershipStatus {
  if (!expiryDate || !isActive) {
    return 'expired';
  }

  const remainingDays = calculateRemainingDays(expiryDate);

  if (remainingDays <= 0) {
    return 'expired';
  }

  if (remainingDays <= expiringThresholdDays) {
    return 'expiring_soon';
  }

  return 'active';
}

/**
 * Format date to Arabic locale
 */
export function formatDateArabic(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format date and time to Arabic locale
 */
export function formatDateTimeArabic(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format currency (Egyptian Pound)
 */
export function formatCurrency(amount: number): string {
  return `${amount.toFixed(2)} جنيه`;
}

/**
 * Validate Egyptian phone number
 */
export function isValidEgyptianPhone(phone: string): boolean {
  // Remove spaces and special characters
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // Egyptian phone numbers: +201xxxxxxxxx or 01xxxxxxxxx (11 digits)
  const pattern = /^(\+20|0)?1[0-2|5]{1}[0-9]{8}$/;

  return pattern.test(cleaned);
}

/**
 * Sanitize phone number for comparison
 */
export function sanitizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, '').replace(/^\+20/, '0');
}

/**
 * Parse JSON safely
 */
export function safeParseJSON<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Get service type label in Arabic
 */
export function getServiceTypeLabel(serviceType: string): string {
  const labels: Record<string, string> = {
    massage: 'مساج',
    sauna: 'ساونا',
    jacuzzi: 'جاكوزي',
  };

  return labels[serviceType] || serviceType;
}

/**
 * Get booking status label in Arabic
 */
export function getBookingStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'قيد الانتظار',
    confirmed: 'مؤكد',
    completed: 'مكتمل',
    cancelled: 'ملغى',
  };

  return labels[status] || status;
}

/**
 * Get payment method label in Arabic
 */
export function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: 'نقدي',
    card: 'بطاقة',
    bank_transfer: 'تحويل بنكي',
    installment: 'تقسيط',
  };

  return labels[method] || method;
}

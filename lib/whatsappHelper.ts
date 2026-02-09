/**
 * WhatsApp Helper
 * Handles opening WhatsApp links in both browser and Electron environments
 */

/**
 * Opens a WhatsApp link
 * - In Electron: Uses shell.openExternal for proper external app handling
 * - In Browser: Uses window.open as normal
 *
 * @param url - The WhatsApp URL (wa.me link)
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function openWhatsApp(url: string): Promise<boolean> {
  try {
    // Check if running in Electron
    if (typeof window !== 'undefined' && (window as any).electron?.openExternal) {
      console.log('🖥️ Running in Electron, using shell.openExternal');
      const result = await (window as any).electron.openExternal(url);
      return result.success !== false;
    } else {
      // Running in regular browser
      console.log('🌐 Running in browser, using window.open');
      window.open(url, '_blank');
      return true;
    }
  } catch (error) {
    console.error('❌ Error opening WhatsApp:', error);
    return false;
  }
}

/**
 * Creates a WhatsApp message URL
 * @param phone - Phone number (with or without country code)
 * @param message - Message text
 * @param addCountryCode - Whether to add +2 prefix (default: true)
 * @returns WhatsApp URL
 */
export function createWhatsAppUrl(
  phone: string,
  message: string = '',
  addCountryCode: boolean = true
): string {
  // Clean phone number (remove non-digits)
  let cleanPhone = phone.replace(/\D/g, '');

  // Add country code if needed
  if (addCountryCode && !cleanPhone.startsWith('2')) {
    // Remove leading 0 if present
    if (cleanPhone.startsWith('0')) {
      cleanPhone = cleanPhone.substring(1);
    }
    cleanPhone = '2' + cleanPhone;
  }

  // Build URL
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}${message ? `?text=${encodedMessage}` : ''}`;
}

/**
 * Opens WhatsApp with a message
 * @param phone - Phone number
 * @param message - Message text
 * @param addCountryCode - Whether to add +2 prefix (default: true)
 * @returns Promise<boolean> - true if successful
 */
export async function sendWhatsAppMessage(
  phone: string,
  message: string = '',
  addCountryCode: boolean = true
): Promise<boolean> {
  const url = createWhatsAppUrl(phone, message, addCountryCode);
  return await openWhatsApp(url);
}

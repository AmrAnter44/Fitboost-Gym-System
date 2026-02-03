/**
 * Helper function to append website section to WhatsApp messages
 * Uses the system settings to determine if website should be shown
 */

let cachedSettings: { websiteUrl: string; showWebsite: boolean } | null = null
let fetchPromise: Promise<void> | null = null

async function fetchWebsiteSettings() {
  if (fetchPromise) {
    await fetchPromise
    return
  }

  fetchPromise = (async () => {
    try {
      const response = await fetch('/api/settings/services')
      if (response.ok) {
        const data = await response.json()
        cachedSettings = {
          websiteUrl: data.websiteUrl || 'https://www.xgym.website',
          showWebsite: data.showWebsiteOnReceipts || false
        }
      } else {
        cachedSettings = {
          websiteUrl: 'https://www.xgym.website',
          showWebsite: false
        }
      }
    } catch (error) {
      console.error('Error fetching website settings:', error)
      cachedSettings = {
        websiteUrl: 'https://www.xgym.website',
        showWebsite: false
      }
    }
  })()

  await fetchPromise
  fetchPromise = null
}

/**
 * Appends website section to a message if enabled in settings
 * @param message The base message
 * @returns The message with website section appended (if enabled)
 */
export async function appendWebsiteToMessage(message: string): Promise<string> {
  if (!cachedSettings) {
    await fetchWebsiteSettings()
  }

  if (!cachedSettings || !cachedSettings.showWebsite || !cachedSettings.websiteUrl) {
    return message
  }

  return `${message}\n\n🌐 *الموقع الإلكتروني:*\n${cachedSettings.websiteUrl}`
}

/**
 * Clears the cached settings (useful for testing or when settings change)
 */
export function clearWebsiteCache() {
  cachedSettings = null
  fetchPromise = null
}

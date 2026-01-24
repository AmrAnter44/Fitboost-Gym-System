/**
 * Helper functions for followup system
 * Handles phone number normalization and renewal detection
 */

export interface Member {
  id: string
  name: string
  phone: string
  isActive: boolean
  expiryDate: Date | string | null
  createdAt: Date | string
}

export interface Receipt {
  id: string
  type: string
  itemDetails: string
  createdAt: Date | string
}

/**
 * Normalize phone number by removing formatting characters
 * and country/area codes for accurate matching
 *
 * @param phone - Phone number to normalize
 * @returns Normalized phone number (last 8-10 digits)
 */
export function normalizePhone(phone: string): string {
  if (!phone) return ''

  return phone
    .replace(/[\s\-\(\)\+]/g, '') // Remove spaces, dashes, parentheses, plus
    .replace(/^2/, '')             // Remove country code (Egypt)
    .replace(/^0/, '')             // Remove leading zero
}

/**
 * Check if a visitor has recently renewed their membership
 * by looking at both active members and recent renewal receipts
 *
 * @param phone - Phone number to check
 * @param members - Array of all members
 * @param receipts - Array of all receipts
 * @returns true if member has active membership or recent renewal
 */
export function hasRecentRenewal(
  phone: string,
  members: Member[],
  receipts: Receipt[]
): boolean {
  const normalizedPhone = normalizePhone(phone)

  // Check 1: Active membership
  const activeMember = members.find(m =>
    normalizePhone(m.phone) === normalizedPhone && m.isActive
  )
  if (activeMember) return true

  // Check 2: Recent renewal receipt (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const recentReceipt = receipts.find(r => {
    if (r.type !== 'تجديد عضويه') return false
    if (new Date(r.createdAt) <= thirtyDaysAgo) return false

    try {
      const details = JSON.parse(r.itemDetails)
      return normalizePhone(details.phone || '') === normalizedPhone
    } catch {
      return false
    }
  })

  return !!recentReceipt
}

/**
 * Check if a phone number belongs to an active member
 *
 * @param phone - Phone number to check
 * @param members - Array of all members
 * @returns true if phone belongs to active member
 */
export function isActiveMember(phone: string, members: Member[]): boolean {
  const normalizedPhone = normalizePhone(phone)
  return members.some(m =>
    normalizePhone(m.phone) === normalizedPhone && m.isActive
  )
}

/**
 * Check if an expired member has renewed
 *
 * @param phone - Phone number to check
 * @param members - Array of all members
 * @returns true if member was expired but is now active
 */
export function hasExpiredMemberRenewed(
  phone: string,
  members: Member[]
): boolean {
  return isActiveMember(phone, members)
}

/**
 * Calculate days until expiry
 *
 * @param expiryDate - Expiry date
 * @returns Number of days remaining (negative if expired)
 */
export function calculateDaysRemaining(expiryDate: Date | string | null): number | null {
  if (!expiryDate) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)

  const diffTime = expiry.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return diffDays
}

/**
 * Get priority level based on days remaining and other factors
 *
 * @param daysRemaining - Days until expiry
 * @param isExpired - Whether membership is expired
 * @param contactCount - Number of contact attempts
 * @returns Priority level ('high', 'medium', 'low')
 */
export function calculatePriority(
  daysRemaining: number | null,
  isExpired: boolean,
  contactCount: number
): 'high' | 'medium' | 'low' {
  // Expired members with no contact = high priority
  if (isExpired && contactCount === 0) return 'high'

  // Expired members with some contact = medium priority
  if (isExpired) return 'medium'

  // Expiring within 7 days = high priority
  if (daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0) {
    return 'high'
  }

  // Expiring within 14 days = medium priority
  if (daysRemaining !== null && daysRemaining <= 14 && daysRemaining > 0) {
    return 'medium'
  }

  // Everything else = low priority
  return 'low'
}

/**
 * Format stage name to Arabic
 *
 * @param stage - Stage identifier
 * @returns Arabic stage name
 */
export function getStageLabel(stage: string): string {
  const labels: Record<string, string> = {
    'new': 'جديد',
    'contacted': 'تم التواصل',
    'interested': 'مهتم',
    'negotiating': 'تفاوض',
    'converted': 'تم التحويل',
    'lost': 'ضائع'
  }
  return labels[stage] || stage
}

/**
 * Format priority level to Arabic
 *
 * @param priority - Priority identifier
 * @returns Arabic priority name
 */
export function getPriorityLabel(priority: string | null): string {
  if (!priority) return '-'
  const labels: Record<string, string> = {
    'high': 'عالية',
    'medium': 'متوسطة',
    'low': 'منخفضة'
  }
  return labels[priority] || priority
}

/**
 * Get color class for priority badge
 *
 * @param priority - Priority level
 * @returns Tailwind CSS classes for badge
 */
export function getPriorityColor(priority: string | null): string {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-800 border-red-500'
    case 'medium':
      return 'bg-orange-100 text-orange-800 border-orange-500'
    case 'low':
      return 'bg-gray-100 text-gray-800 border-gray-300'
    default:
      return 'bg-gray-100 text-gray-600 border-gray-300'
  }
}

/**
 * Get color class for stage badge
 *
 * @param stage - Stage identifier
 * @returns Tailwind CSS classes for badge
 */
export function getStageColor(stage: string): string {
  switch (stage) {
    case 'new':
      return 'bg-gray-100 text-gray-800'
    case 'contacted':
      return 'bg-blue-100 text-blue-800'
    case 'interested':
      return 'bg-green-100 text-green-800'
    case 'negotiating':
      return 'bg-yellow-100 text-yellow-800'
    case 'converted':
      return 'bg-purple-100 text-purple-800'
    case 'lost':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-600'
  }
}

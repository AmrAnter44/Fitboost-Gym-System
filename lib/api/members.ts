// API functions for members

export async function fetchMembers() {
  const response = await fetch('/api/members')

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED')
  }

  if (response.status === 403) {
    throw new Error('FORBIDDEN')
  }

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'فشل جلب بيانات الأعضاء')
  }

  const data = await response.json()

  if (!Array.isArray(data)) {
    console.error('البيانات المستلمة ليست array:', data)
    return []
  }

  // ✅ تحويل كل الأرقام لـ integers
  const cleanedMembers = data.map(member => ({
    ...member,
    memberNumber: parseInt(member.memberNumber?.toString() || '0'),
    inBodyScans: parseInt(member.inBodyScans?.toString() || '0'),
    invitations: parseInt(member.invitations?.toString() || '0'),
    remainingFreezeDays: parseInt(member.remainingFreezeDays?.toString() || '0'),
    subscriptionPrice: parseInt(member.subscriptionPrice?.toString() || '0'),
    remainingAmount: parseInt(member.remainingAmount?.toString() || '0')
  }))

  return cleanedMembers
}

export async function fetchOffers() {
  const response = await fetch('/api/offers')

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'فشل جلب العروض')
  }

  const data = await response.json()
  return Array.isArray(data) ? data : []
}

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
    memberNumber: member.memberNumber != null ? String(member.memberNumber) : null,
    inBodyScans: parseInt(member.inBodyScans?.toString() || '0'),
    invitations: parseInt(member.invitations?.toString() || '0'),
    remainingFreezeDays: parseInt(member.remainingFreezeDays?.toString() || '0'),
    subscriptionPrice: parseInt(member.subscriptionPrice?.toString() || '0'),
    remainingAmount: parseInt(member.remainingAmount?.toString() || '0')
  }))

  // ✅ ترتيب نهائي: الأحدث أولاً
  // الأساس: memberNumber desc (الرقم الأعلى = الأحدث في الإضافة)
  // Other members (no memberNumber) → في الآخر
  cleanedMembers.sort((a: any, b: any) => {
    const aHasNum = a.memberNumber != null && a.memberNumber !== ''
    const bHasNum = b.memberNumber != null && b.memberNumber !== ''
    if (aHasNum && !bHasNum) return -1
    if (!aHasNum && bHasNum) return 1

    if (aHasNum && bHasNum) {
      const aNum = parseInt(a.memberNumber, 10) || 0
      const bNum = parseInt(b.memberNumber, 10) || 0
      if (aNum !== bNum) return bNum - aNum
    }

    // tiebreakers
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
    if (bTime !== aTime) return bTime - aTime

    return String(b.id || '').localeCompare(String(a.id || ''))
  })

  return cleanedMembers
}

export interface MembersPage {
  members: any[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// 🚀 Paginated chunk fetch — بيستعمله صفحة /members لتحميل الأعضاء على دفعات
//   - أول chunk بيظهر فوراً → الـ skeleton يختفي بسرعة
//   - الباقي بيتحمّل في الـ background بدون ما يبوظ تجربة المستخدم
export async function fetchMembersPage(page: number, pageSize: number = 200): Promise<MembersPage> {
  const response = await fetch(`/api/members?page=${page}&pageSize=${pageSize}`)

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || 'فشل جلب بيانات الأعضاء')
  }

  const data = await response.json()

  // backward-compat لو السيرفر رجّع array بدل object
  const rawMembers: any[] = Array.isArray(data) ? data : (data?.members || [])

  const cleaned = rawMembers.map(member => ({
    ...member,
    memberNumber: member.memberNumber != null ? String(member.memberNumber) : null,
    inBodyScans: parseInt(member.inBodyScans?.toString() || '0'),
    invitations: parseInt(member.invitations?.toString() || '0'),
    remainingFreezeDays: parseInt(member.remainingFreezeDays?.toString() || '0'),
    subscriptionPrice: parseInt(member.subscriptionPrice?.toString() || '0'),
    remainingAmount: parseInt(member.remainingAmount?.toString() || '0')
  }))

  return {
    members: cleaned,
    total: Array.isArray(data) ? cleaned.length : (data?.total ?? cleaned.length),
    page,
    pageSize,
    hasMore: Array.isArray(data) ? false : !!data?.hasMore,
  }
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

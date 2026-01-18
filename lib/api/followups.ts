export async function fetchFollowUpsData() {
  const response = await fetch('/api/visitors/followups')

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'فشل جلب بيانات المتابعات')
  }

  const data = await response.json()
  return Array.isArray(data) ? data : []
}

export async function fetchVisitorsData() {
  const response = await fetch('/api/visitors')

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'فشل جلب بيانات الزوار')
  }

  const data = await response.json()
  return data.visitors || []
}

export async function fetchMembersData() {
  const response = await fetch('/api/members')

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'فشل جلب بيانات الأعضاء')
  }

  const data = await response.json()
  return Array.isArray(data) ? data : []
}

export async function fetchDayUseData() {
  const response = await fetch('/api/dayuse')

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'فشل جلب بيانات الاستخدام اليومي')
  }

  const data = await response.json()
  return Array.isArray(data) ? data : []
}

export async function fetchInvitationsData() {
  const response = await fetch('/api/invitations')

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'فشل جلب بيانات الدعوات')
  }

  const data = await response.json()
  return Array.isArray(data) ? data : []
}

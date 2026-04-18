import { handleAuthError } from '../authErrorHandler'

/** Safe JSON parse — returns fallback message if response body isn't JSON */
async function safeErrorMsg(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json()
    return data?.error || fallback
  } catch {
    return fallback
  }
}

/** Common auth check for all fetch functions */
async function checkAuth(response: Response) {
  if (response.status === 401) {
    await handleAuthError(response.clone())
    throw new Error('UNAUTHORIZED')
  }
  if (response.status === 403) throw new Error('FORBIDDEN')
}

export async function fetchFollowUpsData() {
  const response = await fetch('/api/visitors/followups')
  await checkAuth(response)

  if (!response.ok) {
    throw new Error(await safeErrorMsg(response, 'فشل جلب بيانات المتابعات'))
  }

  const data = await response.json()
  return Array.isArray(data) ? data : []
}

export async function fetchVisitorsData() {
  const response = await fetch('/api/visitors')
  await checkAuth(response)

  if (!response.ok) {
    throw new Error(await safeErrorMsg(response, 'فشل جلب بيانات الزوار'))
  }

  const data = await response.json()
  return data.visitors || []
}

export async function fetchMembersData() {
  const response = await fetch('/api/members')
  await checkAuth(response)

  if (!response.ok) {
    throw new Error(await safeErrorMsg(response, 'فشل جلب بيانات الأعضاء'))
  }

  const data = await response.json()
  return Array.isArray(data) ? data : []
}

export async function fetchDayUseData() {
  const response = await fetch('/api/dayuse')
  await checkAuth(response)

  if (!response.ok) {
    throw new Error(await safeErrorMsg(response, 'فشل جلب بيانات الاستخدام اليومي'))
  }

  const data = await response.json()
  return Array.isArray(data) ? data : []
}

export async function fetchInvitationsData() {
  const response = await fetch('/api/invitations')
  await checkAuth(response)

  if (!response.ok) {
    throw new Error(await safeErrorMsg(response, 'فشل جلب بيانات الدعوات'))
  }

  const data = await response.json()
  return Array.isArray(data) ? data : []
}

export async function deleteFollowUp(id: string) {
  const response = await fetch(`/api/visitors/followups?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  await checkAuth(response)

  if (!response.ok) {
    throw new Error(await safeErrorMsg(response, 'فشل حذف المتابعة'))
  }

  return response.json()
}

export async function deleteVisitor(id: string) {
  const response = await fetch(`/api/visitors?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  await checkAuth(response)

  if (!response.ok) {
    throw new Error(await safeErrorMsg(response, 'فشل حذف الزائر'))
  }

  return response.json()
}

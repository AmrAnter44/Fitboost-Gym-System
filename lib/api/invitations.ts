import { handleAuthError } from '../authErrorHandler'

export async function fetchInvitations() {
  const response = await fetch('/api/invitations')

  // Auto-clear cookies on 401
  if (response.status === 401) {
    await handleAuthError(response.clone())
    throw new Error('UNAUTHORIZED')
  }

  if (response.status === 403) throw new Error('FORBIDDEN')

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'فشل جلب بيانات الدعوات')
  }

  const data = await response.json()
  return Array.isArray(data) ? data : []
}

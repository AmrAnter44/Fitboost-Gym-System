// API functions for visitors

export async function fetchVisitors() {
  const response = await fetch('/api/visitors')

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED')
  }

  if (response.status === 403) {
    throw new Error('FORBIDDEN')
  }

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'فشل جلب بيانات الزوار')
  }

  const data = await response.json()
  return Array.isArray(data) ? data : []
}

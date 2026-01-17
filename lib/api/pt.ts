// API functions for PT (Personal Training)

export async function fetchPTSessions() {
  const response = await fetch('/api/pt')

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED')
  }

  if (response.status === 403) {
    throw new Error('FORBIDDEN')
  }

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'فشل جلب جلسات PT')
  }

  const data = await response.json()

  if (!Array.isArray(data)) {
    console.error('البيانات المستلمة ليست array:', data)
    return []
  }

  return data
}

export async function fetchCoaches() {
  const response = await fetch('/api/staff')

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'فشل جلب بيانات المدربين')
  }

  const data = await response.json()

  if (!Array.isArray(data)) {
    return []
  }

  // فلترة المدربين فقط
  return data.filter((staff: any) => staff.position === 'trainer' && staff.isActive)
}

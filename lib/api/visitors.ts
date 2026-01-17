// API functions for visitors

interface FetchVisitorsParams {
  searchTerm?: string
  statusFilter?: string
  sourceFilter?: string
}

export async function fetchVisitors(params?: FetchVisitorsParams) {
  const searchParams = new URLSearchParams()
  if (params?.searchTerm) searchParams.append('search', params.searchTerm)
  if (params?.statusFilter && params.statusFilter !== 'all') searchParams.append('status', params.statusFilter)
  if (params?.sourceFilter && params.sourceFilter !== 'all') searchParams.append('source', params.sourceFilter)

  const response = await fetch(`/api/visitors?${searchParams}`)

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
  return data
}

export async function fetchFollowUps() {
  const response = await fetch('/api/visitors/followups')

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'فشل جلب المتابعات')
  }

  const data = await response.json()
  return Array.isArray(data) ? data : []
}

// Common API helper for converting pages to useQuery
// This file contains reusable patterns for all pages

export interface ApiResponse<T> {
  data: T
  error?: string
}

export async function fetchWithAuth<T>(url: string, errorMessage: string = 'فشل جلب البيانات'): Promise<T> {
  const response = await fetch(url)

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED')
  }

  if (response.status === 403) {
    throw new Error('FORBIDDEN')
  }

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || errorMessage)
  }

  const data = await response.json()

  if (!Array.isArray(data) && typeof data !== 'object') {
    console.error('Invalid data format:', data)
    return [] as T
  }

  return data
}

// lib/api/spaBookings.ts - API functions for SPA bookings
import { SpaBooking, SpaServiceType, SpaBookingStatus } from '../../types/spa'

interface FetchSpaBookingsFilters {
  status?: SpaBookingStatus | ''
  serviceType?: SpaServiceType | ''
  startDate?: string
  endDate?: string
  search?: string
}

export async function fetchSpaBookings(filters?: FetchSpaBookingsFilters): Promise<SpaBooking[]> {
  const params = new URLSearchParams()

  if (filters?.status) params.append('status', filters.status)
  if (filters?.serviceType) params.append('serviceType', filters.serviceType)
  if (filters?.startDate) params.append('startDate', filters.startDate)
  if (filters?.endDate) params.append('endDate', filters.endDate)
  if (filters?.search) params.append('search', filters.search)

  const response = await fetch(`/api/spa-bookings?${params.toString()}`)

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED')
  }

  if (response.status === 403) {
    throw new Error('FORBIDDEN')
  }

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'فشل جلب حجوزات SPA')
  }

  const data = await response.json()
  return Array.isArray(data) ? data : []
}

export async function fetchSpaBookingById(id: string): Promise<SpaBooking> {
  const response = await fetch(`/api/spa-bookings/${id}`)

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED')
  }

  if (response.status === 403) {
    throw new Error('FORBIDDEN')
  }

  if (response.status === 404) {
    throw new Error('الحجز غير موجود')
  }

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'فشل جلب الحجز')
  }

  return response.json()
}

interface CreateSpaBookingData {
  memberId: string
  serviceType: SpaServiceType
  bookingDate: string
  bookingTime: string
  duration: number
  notes?: string
}

export async function createSpaBooking(data: CreateSpaBookingData): Promise<SpaBooking> {
  const response = await fetch('/api/spa-bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED')
  }

  if (response.status === 403) {
    throw new Error('FORBIDDEN')
  }

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'فشل إنشاء الحجز')
  }

  return response.json()
}

interface UpdateSpaBookingData {
  status?: SpaBookingStatus
  bookingDate?: string
  bookingTime?: string
  duration?: number
  notes?: string
  serviceType?: SpaServiceType
}

export async function updateSpaBooking(
  id: string,
  data: UpdateSpaBookingData
): Promise<SpaBooking> {
  const response = await fetch(`/api/spa-bookings/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED')
  }

  if (response.status === 403) {
    throw new Error('FORBIDDEN')
  }

  if (response.status === 404) {
    throw new Error('الحجز غير موجود')
  }

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'فشل تحديث الحجز')
  }

  return response.json()
}

export async function cancelSpaBooking(id: string): Promise<void> {
  const response = await fetch(`/api/spa-bookings/${id}`, {
    method: 'DELETE'
  })

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED')
  }

  if (response.status === 403) {
    throw new Error('FORBIDDEN')
  }

  if (response.status === 404) {
    throw new Error('الحجز غير موجود')
  }

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'فشل إلغاء الحجز')
  }
}

interface TimeSlot {
  time: string
  available: boolean
  bookings: number
  capacity: number
  remaining: number
}

export async function fetchAvailability(
  date: string,
  serviceType: SpaServiceType
): Promise<TimeSlot[]> {
  const params = new URLSearchParams({ date, serviceType })
  const response = await fetch(`/api/spa-bookings/availability?${params.toString()}`)

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED')
  }

  if (response.status === 403) {
    throw new Error('FORBIDDEN')
  }

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'فشل جلب الأوقات المتاحة')
  }

  const data = await response.json()
  return Array.isArray(data) ? data : []
}

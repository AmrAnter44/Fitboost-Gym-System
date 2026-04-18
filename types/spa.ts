// 💆 SPA Booking Types

export type SpaServiceType = 'massage' | 'sauna' | 'jacuzzi'
export type SpaBookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'
export type SpaDuration = 30 | 60 | 90

export interface SpaBooking {
  id: string
  memberId: string
  memberName: string
  memberPhone: string | null
  serviceType: SpaServiceType
  bookingDate: Date
  bookingTime: string
  duration: SpaDuration
  status: SpaBookingStatus
  notes: string | null
  createdBy: string
  createdByUserId: string | null
  createdAt: Date
  updatedAt: Date
  member?: {
    id: string
    name: string
    phone: string | null
  }
}

export interface SpaTimeSlot {
  time: string
  available: boolean
  bookings: number
}

export interface SpaDay {
  date: Date
  dayName: string
  isToday: boolean
  isPast: boolean
  slots: SpaTimeSlot[]
}

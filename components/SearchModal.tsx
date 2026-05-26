'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { InvitationModal, SimpleServiceModal } from './ServiceDeductionModals'
import { useLanguage } from '@/contexts/LanguageContext'
import { useSearch } from '../contexts/SearchContext'
import { useServiceSettings } from '../contexts/ServiceSettingsContext'
import { LoadingScreen } from './Spinner'

interface SearchResult {
  type: 'member' | 'pt'
  data: any
}

type SearchMode = 'id' | 'name'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

const StatusIcon = ({ name, className = 'w-4 h-4' }: { name: string; className?: string }) => {
  switch (name) {
    case 'active':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'warning':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" />
        </svg>
      )
    case 'expired':
    case 'alarm':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      )
    case 'banned':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      )
    case 'frozen':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m9-9H3m15.364-6.364L5.636 18.364m12.728 0L5.636 5.636" />
        </svg>
      )
    case 'future':
    case 'notStarted':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'search':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      )
    case 'user':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      )
    case 'target':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
      )
    case 'spinner':
      return (
        <svg className={`${className} animate-spin`} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-4.992 4.992l3.181-3.183a8.25 8.25 0 00-13.803 3.7M4.031 9.865v-4.992m0 0H8.99M3 12a9 9 0 0015.357 6.364l-1.06-1.06" />
        </svg>
      )
    case 'note':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
        </svg>
      )
    case 'gift':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      )
    case 'eye':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    case 'arrowRight':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
        </svg>
      )
    case 'arrowLeft':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 15.75L3 12m0 0l3.75-3.75M3 12h18" />
        </svg>
      )
    case 'invite':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
        </svg>
      )
    case 'dumbbell':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
        </svg>
      )
    case 'scale':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52" />
        </svg>
      )
    case 'leaf':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3" />
        </svg>
      )
    case 'heart':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
      )
    case 'users':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      )
    case 'star':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      )
    case 'tag':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
        </svg>
      )
    case 'birthday':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12" />
        </svg>
      )
    default:
      return null
  }
}

export default function SearchModal() {
  const router = useRouter()
  const { isOpen, searchValue, closeSearch } = useSearch()
  const { t, direction, locale } = useLanguage()
  const { settings } = useServiceSettings()

  const getPositionLabel = (position: string | null | undefined): string => {
    if (!position) return '-'
    const POSITION_MAP: { [key: string]: string } = {
      'مدرب': 'trainer',
      'ريسبشن': 'receptionist',
      'بار': 'barista',
      'HK': 'housekeeping',
      'نظافة': 'housekeeping',
      'مدير': 'manager',
      'محاسب': 'accountant',
      'صيانة': 'maintenance',
      'أمن': 'security',
      'other': 'other',
    }
    const key = POSITION_MAP[position] || 'other'
    return t(`positions.${key}` as any)
  }

  const getPackageName = (startDate: string | undefined, expiryDate: string | undefined): string => {
    if (!startDate || !expiryDate) return '-'

    const start = new Date(startDate)
    const expiry = new Date(expiryDate)
    const diffTime = expiry.getTime() - start.getTime()
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays <= 0) return '-'

    const months = Math.round(diffDays / 30)

    if (locale === 'ar') {
      if (diffDays >= 330 && diffDays <= 395) return 'سنة'
      else if (diffDays >= 165 && diffDays <= 195) return '6 شهور'
      else if (diffDays >= 85 && diffDays <= 95) return '3 شهور'
      else if (diffDays >= 55 && diffDays <= 65) return 'شهرين'
      else if (diffDays >= 25 && diffDays <= 35) return 'شهر'
      else if (diffDays >= 10 && diffDays <= 17) return 'أسبوعين'
      else if (diffDays >= 5 && diffDays <= 9) return 'أسبوع'
      else if (diffDays === 1) return 'يوم'
      else if (months > 0) return `${months} ${months === 1 ? 'شهر' : months === 2 ? 'شهرين' : 'شهور'}`
      else return `${diffDays} ${diffDays === 1 ? 'يوم' : diffDays === 2 ? 'يومين' : 'أيام'}`
    } else {
      if (diffDays >= 330 && diffDays <= 395) return 'Year'
      else if (diffDays >= 165 && diffDays <= 195) return '6 Months'
      else if (diffDays >= 85 && diffDays <= 95) return '3 Months'
      else if (diffDays >= 55 && diffDays <= 65) return '2 Months'
      else if (diffDays >= 25 && diffDays <= 35) return 'Month'
      else if (diffDays >= 10 && diffDays <= 17) return '2 Weeks'
      else if (diffDays >= 5 && diffDays <= 9) return 'Week'
      else if (diffDays === 1) return 'Day'
      else if (months > 0) return `${months} ${months === 1 ? 'Month' : 'Months'}`
      else return `${diffDays} ${diffDays === 1 ? 'Day' : 'Days'}`
    }
  }

  const [searchMode, setSearchMode] = useState<SearchMode>('id')
  const [memberId, setMemberId] = useState('')
  const [searchName, setSearchName] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [lastSearchTime, setLastSearchTime] = useState<Date | null>(null)
  const [attendanceMessage, setAttendanceMessage] = useState<{type: 'success' | 'error', text: string, staff?: any} | null>(null)
  const memberIdRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  const [invitationModal, setInvitationModal] = useState<{isOpen: boolean, memberId: string, memberName: string, memberSalesStaffId?: string | null}>({ isOpen: false, memberId: '', memberName: '' })
  const [serviceModal, setServiceModal] = useState<{isOpen: boolean, type: 'freePT' | 'inBody' | 'nutrition' | 'physio' | 'groupClass', memberId: string, memberName: string}>({ isOpen: false, type: 'freePT', memberId: '', memberName: '' })

  // Recent scans — كل سكان ناجح يفضل ظاهر دقيقة عشان لو 2 عملو سكان ورا بعض،
  // الريسبشن يقدر يشوف اللي قبل بعد ما الـ result الحالي يتبدّل
  interface RecentScan {
    key: string
    member: any
    scannedAt: number
    status: 'active' | 'expired' | 'warning' | 'future' | 'banned' | 'frozen' | 'notStarted'
  }
  const RECENT_SCAN_TTL_MS = 60 * 1000 // دقيقة
  const RECENT_SCAN_MAX = 6
  const [recentScans, setRecentScans] = useState<RecentScan[]>([])
  const [nowTick, setNowTick] = useState(0) // عشان "منذ X ثانية" يتحدث

  // كل 5 ثواني: نتخلّص من السكانات اللي عدّت TTL + نحدّث الـ relative time
  useEffect(() => {
    if (!isOpen) return
    const interval = setInterval(() => {
      setNowTick(t => t + 1)
      setRecentScans(prev => prev.filter(s => Date.now() - s.scannedAt < RECENT_SCAN_TTL_MS))
    }, 5000)
    return () => clearInterval(interval)
  }, [isOpen])

  // helper: ضيف عضو للـ recent scans (أو حدّث الموجود بتاعه)
  const pushRecentScan = useCallback((member: any, status: RecentScan['status']) => {
    if (!member?.id) return
    setRecentScans(prev => {
      const filtered = prev.filter(s => s.member?.id !== member.id)
      const next: RecentScan = {
        key: `${member.id}-${Date.now()}`,
        member,
        scannedAt: Date.now(),
        status,
      }
      return [next, ...filtered].slice(0, RECENT_SCAN_MAX)
    })
  }, [])

  // Reset when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Reset search state when opening
      setSearched(false)
      setResults([])
      // FIX: Don't clear memberId if searchValue is present (prevents race condition)
      if (!searchValue) {
        setMemberId('')
      }

      // Auto-focus
      setTimeout(() => {
        if (searchMode === 'id') {
          memberIdRef.current?.focus()
        } else {
          nameRef.current?.focus()
        }
      }, 100)
    } else {
      // Reset on close too
      setSearched(false)
      setResults([])
      setMemberId('')
    }
  }, [isOpen, searchMode, searchValue])

  // Close modal on ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        closeSearch()
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen, closeSearch])

  const playSuccessSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      const times = [0, 0.15, 0.3]
      const frequencies = [523.25, 659.25, 783.99]

      times.forEach((time, index) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequencies[index], ctx.currentTime + time)
        gainNode.gain.setValueAtTime(0.8, ctx.currentTime + time)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.3)
        oscillator.start(ctx.currentTime + time)
        oscillator.stop(ctx.currentTime + time + 0.3)
      })
    } catch (error) {
      console.error('Error playing sound:', error)
    }
  }

  const playAlarmSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      const alarmPattern = [
        { freq: 2000, time: 0 },
        { freq: 600, time: 0.15 },
        { freq: 2000, time: 0.3 },
        { freq: 600, time: 0.45 },
        { freq: 2000, time: 0.6 },
        { freq: 600, time: 0.75 },
      ]

      alarmPattern.forEach(({ freq, time }) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        oscillator.type = 'square'
        oscillator.frequency.setValueAtTime(freq, ctx.currentTime + time)
        gainNode.gain.setValueAtTime(0.9, ctx.currentTime + time)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.15)
        oscillator.start(ctx.currentTime + time)
        oscillator.stop(ctx.currentTime + time + 0.15)
      })
    } catch (error) {
      console.error('Error playing alarm sound:', error)
    }
  }

  const playWarningSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      const times = [0, 0.2]
      const frequencies = [440, 370]

      times.forEach((time, index) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        oscillator.type = 'triangle'
        oscillator.frequency.setValueAtTime(frequencies[index], ctx.currentTime + time)
        gainNode.gain.setValueAtTime(0.7, ctx.currentTime + time)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.25)
        oscillator.start(ctx.currentTime + time)
        oscillator.stop(ctx.currentTime + time + 0.25)
      })
    } catch (error) {
      console.error('Error playing warning sound:', error)
    }
  }

  const playFreezeSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      const freezePattern = [
        { freq: 1046.50, time: 0 },
        { freq: 987.77, time: 0.15 },
        { freq: 880.00, time: 0.3 },
        { freq: 783.99, time: 0.45 },
      ]

      freezePattern.forEach(({ freq, time }) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(freq, ctx.currentTime + time)
        gainNode.gain.setValueAtTime(0.6, ctx.currentTime + time)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.2)
        oscillator.start(ctx.currentTime + time)
        oscillator.stop(ctx.currentTime + time + 0.2)
      })
    } catch (error) {
      console.error('Error playing freeze sound:', error)
    }
  }

  const playBannedHornSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      // زمارة طويلة مزعجة تخينة - صوت منخفض ثقيل (7 ثواني)
      const hornPattern = [
        { freq: 90, time: 0, dur: 0.7 },
        { freq: 65, time: 0.8, dur: 0.7 },
        { freq: 90, time: 1.6, dur: 0.7 },
        { freq: 65, time: 2.4, dur: 0.7 },
        { freq: 90, time: 3.2, dur: 0.7 },
        { freq: 65, time: 4.0, dur: 0.7 },
        { freq: 90, time: 4.8, dur: 0.7 },
        { freq: 50, time: 5.6, dur: 1.2 }, // نهاية طويلة تخينة جداً
      ]
      hornPattern.forEach(({ freq, time, dur }) => {
        // أول oscillator - sawtooth
        const osc1 = ctx.createOscillator()
        const gain1 = ctx.createGain()
        osc1.connect(gain1)
        gain1.connect(ctx.destination)
        osc1.type = 'sawtooth'
        osc1.frequency.setValueAtTime(freq, ctx.currentTime + time)
        gain1.gain.setValueAtTime(1.0, ctx.currentTime + time)
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + dur)
        osc1.start(ctx.currentTime + time)
        osc1.stop(ctx.currentTime + time + dur)

        // تاني oscillator - square لصوت أتخن
        const osc2 = ctx.createOscillator()
        const gain2 = ctx.createGain()
        osc2.connect(gain2)
        gain2.connect(ctx.destination)
        osc2.type = 'square'
        osc2.frequency.setValueAtTime(freq * 0.5, ctx.currentTime + time) // octave lower
        gain2.gain.setValueAtTime(0.5, ctx.currentTime + time)
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + dur)
        osc2.start(ctx.currentTime + time)
        osc2.stop(ctx.currentTime + time + dur)
      })
    } catch (error) {
      console.error('Error playing banned horn sound:', error)
    }
  }

  const checkMemberStatusAndPlaySound = (member: any) => {
    const isBanned = member.isBanned
    const isActive = member.isActive
    const isFrozen = member.isFrozen
    const expiryDate = member.expiryDate ? new Date(member.expiryDate) : null
    const startDate = member.startDate ? new Date(member.startDate) : null
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // ليس عضوية - لا يوجد تاريخ بداية ولا انتهاء
    if (!startDate && !expiryDate && !isActive && member.memberNumber === null) {
      playWarningSound()
      return 'non-member'
    }

    if (isBanned) {
      playBannedHornSound()
      return 'banned'
    }

    if (isFrozen) {
      playFreezeSound()
      return 'frozen'
    }

    // يبدأ بعد X يوم
    if (startDate && startDate > today) {
      playWarningSound()
      return 'future'
    }

    // منتهي أو غير نشط
    if (!isActive || (expiryDate && expiryDate < today)) {
      playAlarmSound()
      return 'expired'
    } else if (expiryDate) {
      const diffTime = expiryDate.getTime() - today.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays <= 7) {
        playWarningSound()
        return 'warning'
      } else {
        playSuccessSound()
        return 'active'
      }
    } else {
      playSuccessSound()
      return 'active'
    }
  }

  const handleMemberCheckIn = async (memberId: string) => {
    try {
      const response = await fetch('/api/member-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, method: 'scan' }),
      })

      const data = await response.json()

      if (response.ok && !data.alreadyCheckedIn) {
      } else if (data.alreadyCheckedIn) {
        playWarningSound()
        setAttendanceMessage({
          type: 'error',
          text: data.error || 'تم تسجيل الحضور مسبقاً اليوم '
        })
        setTimeout(() => setAttendanceMessage(null), 4000)
      } else if (response.status === 403) {
        // عضو محظور
        playBannedHornSound()
        setAttendanceMessage({
          type: 'error',
          text: data.error || 'هذا العضو محظور '
        })
        setTimeout(() => setAttendanceMessage(null), 5000)
      } else if (!response.ok) {
        // أخطاء أخرى (منتهي، مجمد، إلخ)
        playAlarmSound()
        setAttendanceMessage({
          type: 'error',
          text: data.error || 'حدث خطأ'
        })
        setTimeout(() => setAttendanceMessage(null), 4000)
      }
    } catch (error) {
      console.error('Error checking in member:', error)
    }
  }

  const handleSearchById = useCallback(async (silent: boolean = false) => {
    if (!memberId.trim()) {
      if (!silent) playAlarmSound()
      return
    }

    const inputValue = memberId.trim()

    if (/^\d{9,}$/.test(inputValue)) {
      const numericCode = parseInt(inputValue, 10)

      if (numericCode < 100000000) {
        if (!silent) playAlarmSound()
        setAttendanceMessage({
          type: 'error',
          text: ' رقم الموظف يجب أن يكون 9 أرقام (مثال: 100000022)'
        })
        setMemberId('')
        setTimeout(() => setAttendanceMessage(null), 4000)
        return
      }

      const staffNumber = numericCode - 100000000
      const staffCode = `s${staffNumber.toString().padStart(3, '0')}`

      setLoading(true)
      setAttendanceMessage(null)

      try {
        const response = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ staffCode }),
        })

        const data = await response.json()

        if (response.ok) {
          if (!silent) playSuccessSound()
          setAttendanceMessage({
            type: 'success',
            text: data.message,
            staff: data.staff
          })
          setTimeout(() => setAttendanceMessage(null), 5000)
        } else {
          if (!silent) playAlarmSound()
          setAttendanceMessage({
            type: 'error',
            text: data.error || 'فشل تسجيل الحضور'
          })
          setTimeout(() => setAttendanceMessage(null), 5000)
        }
      } catch (error) {
        console.error('Attendance error:', error)
        if (!silent) playAlarmSound()
        setAttendanceMessage({
          type: 'error',
          text: 'حدث خطأ في تسجيل الحضور'
        })
        setTimeout(() => setAttendanceMessage(null), 5000)
      } finally {
        setLoading(false)
        setMemberId('')
        setTimeout(() => {
          memberIdRef.current?.focus()
          memberIdRef.current?.select()
        }, 500)
      }

      return
    }

    setLoading(true)
    setSearched(true)
    setAttendanceMessage(null)
    const foundResults: SearchResult[] = []

    try {
      const membersRes = await fetch('/api/members')
      const members = await membersRes.json()

      // مطابقة صارمة (string-exact) — "0122" مش = "122"
      // لأن الأصفار في الأول جزء من رقم العضوية ومش بنتجاهلها
      const filteredMembers = members.filter((m: any) => {
        if (m.memberNumber == null) return false
        return m.memberNumber.toString() === inputValue
      })

      filteredMembers.forEach((member: any) => {
        foundResults.push({ type: 'member', data: member })
      })

      setResults(foundResults)
      setLastSearchTime(new Date())

      if (foundResults.length > 0) {
        const member = foundResults[0].data
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const startDate = member.startDate ? new Date(member.startDate) : null
        const expiryDate = member.expiryDate ? new Date(member.expiryDate) : null
        const hasStarted = !startDate || startDate <= today
        const notExpired = !expiryDate || expiryDate >= today

        if (member.isActive && !member.isBanned && hasStarted && notExpired) {
          handleMemberCheckIn(member.id)
        }

        // ضيفه للـ recent scans عشان يفضل ظاهر دقيقة
        let scanStatus: RecentScan['status'] = 'active'
        if (member.isBanned) scanStatus = 'banned'
        else if (member.isFrozen) scanStatus = 'frozen'
        else if (!hasStarted) scanStatus = 'notStarted'
        else if (!notExpired || !member.isActive) scanStatus = 'expired'
        else if (expiryDate) {
          const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          if (diffDays <= 7) scanStatus = 'warning'
        }
        pushRecentScan(member, scanStatus)

        if (!silent) checkMemberStatusAndPlaySound(member)
      } else {
        if (!silent) playAlarmSound()
      }

      setMemberId('')
      setTimeout(() => {
        memberIdRef.current?.focus()
        memberIdRef.current?.select()
      }, 500)

    } catch (error) {
      console.error('Search error:', error)
      if (!silent) playAlarmSound()
    } finally {
      setLoading(false)
    }
  }, [memberId, playAlarmSound, playSuccessSound, handleMemberCheckIn, checkMemberStatusAndPlaySound, pushRecentScan])

  // Handle search value from barcode (placed after handleSearchById to avoid reference error)
  useEffect(() => {
    if (isOpen && searchValue && !searched) {
      setMemberId(searchValue)

      // Increased delay for Electron
      const delay = (window as any).electron?.isElectron ? 300 : 150

      setTimeout(() => {
        handleSearchById(true)
      }, delay)
    }
  }, [isOpen, searchValue, searched, handleSearchById])

  const handleSearchByName = async (silent: boolean = false) => {
    const query = searchName.trim()
    if (!query) {
      if (!silent) playAlarmSound()
      setAttendanceMessage({
        type: 'error',
        text: 'يرجى إدخال الاسم أو رقم الهاتف للبحث'
      })
      setTimeout(() => setAttendanceMessage(null), 3000)
      return
    }

    setLoading(true)
    setSearched(true)
    setAttendanceMessage(null)
    const foundResults: SearchResult[] = []

    try {
      const membersRes = await fetch('/api/members')
      const members = await membersRes.json()

      const ptRes = await fetch('/api/pt')
      const ptSessions = await ptRes.json()

      // البحث الموحّد: نطابق الاسم أو رقم التليفون لنفس القيمة
      const queryLower = query.toLowerCase()
      const filteredMembers = members.filter((m: any) =>
        m.name.toLowerCase().includes(queryLower) || (m.phone || '').includes(query)
      )

      filteredMembers.forEach((member: any) => {
        foundResults.push({ type: 'member', data: member })
      })

      const filteredPT = ptSessions.filter((pt: any) =>
        pt.clientName.toLowerCase().includes(queryLower) || (pt.phone || '').includes(query)
      )

      filteredPT.forEach((pt: any) => {
        foundResults.push({ type: 'pt', data: pt })
      })

      setResults(foundResults)
      setLastSearchTime(new Date())

      if (foundResults.length > 0) {
        if (foundResults[0].type === 'member') {
          const member = foundResults[0].data
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const startDate = member.startDate ? new Date(member.startDate) : null
          const expiryDate = member.expiryDate ? new Date(member.expiryDate) : null
          const hasStarted = !startDate || startDate <= today
          const notExpired = !expiryDate || expiryDate >= today

          if (member.isActive && !member.isBanned && hasStarted && notExpired) {
            handleMemberCheckIn(member.id)
          }
        }

        if (!silent) {
          if (foundResults[0].type === 'member') {
            checkMemberStatusAndPlaySound(foundResults[0].data)
          } else {
            playSuccessSound()
          }
        }
      } else {
        if (!silent) playAlarmSound()
      }

    } catch (error) {
      console.error('Search error:', error)
      if (!silent) playAlarmSound()
    } finally {
      setLoading(false)
    }
  }

  const refreshResults = async () => {
    if (results.length === 0) return

    setLoading(true)
    try {
      if (results[0].type === 'member') {
        const memberId = results[0].data.id
        const membersRes = await fetch('/api/members')
        const members = await membersRes.json()
        const updatedMember = members.find((m: any) => m.id === memberId)

        if (updatedMember) {
          setResults([{ type: 'member', data: updatedMember }])
        }
      }
    } catch (error) {
      console.error('Error refreshing results:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleIdKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearchById()
    }
  }

  const handleNameKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearchByName()
    }
  }

  const calculateRemainingDays = (expiryDate: string | null | undefined): number | null => {
    if (!expiryDate) return null

    const expiry = new Date(expiryDate)
    const today = new Date()
    const diffTime = expiry.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    return diffDays
  }

  const handleViewMemberDetails = (memberId: string) => {
    closeSearch()
    router.push(`/members/${memberId}`)
  }

  const handleViewPTDetails = (ptId: string) => {
    closeSearch()
    router.push(`/pt/${ptId}`)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[9998] animate-backdrop-in"
        onClick={closeSearch}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-[9999] overflow-auto"
        dir={direction}
        data-search-modal
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-modal-title"
      >
        <div className="min-h-screen p-1 sm:p-2">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-w-3xl mx-auto my-2 animate-modal-in">
            {/* Header */}
            <div className="bg-primary-600 dark:bg-primary-700 text-primary-contrast p-2 sm:p-3 rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
              <h1 id="search-modal-title" className="text-base sm:text-lg font-bold flex items-center gap-2">
                <StatusIcon name="search" className="w-5 h-5" />
                <span>{t('search.title')}</span>
              </h1>
              <button
                type="button"
                onClick={closeSearch}
                aria-label="Close (ESC)"
                title="Close (ESC)"
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors duration-200"
              >
                <svg className="w-5 h-5" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Recent scans strip — السكانات اللي حصلت في آخر دقيقة */}
            {(() => {
              const visibleScans = recentScans.filter(s => Date.now() - s.scannedAt < RECENT_SCAN_TTL_MS)
              if (visibleScans.length === 0) return null
              return (
              <div className="bg-blue-50/60 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 p-2 sm:p-3" dir={direction}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-blue-800 dark:text-blue-200">
                    <svg className="w-4 h-4" {...stroke}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586" />
                    </svg>
                    <span>{direction === 'rtl' ? `آخر السكانات (${visibleScans.length})` : `Recent scans (${visibleScans.length})`}</span>
                    <span className="text-[10px] text-blue-600/70 dark:text-blue-300/70 font-normal">
                      {direction === 'rtl' ? '— كل سكان يفضل ظاهر دقيقة' : '— each visible for 1 min'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRecentScans([])}
                    className="text-[10px] text-blue-600 dark:text-blue-300 hover:text-red-500 px-2 py-0.5 rounded transition-colors duration-200 flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" {...stroke}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>{direction === 'rtl' ? 'مسح الكل' : 'Clear all'}</span>
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {visibleScans.map((scan) => {
                    const ageSec = Math.floor((Date.now() - scan.scannedAt) / 1000)
                    const remainSec = Math.max(0, 60 - ageSec)
                    const m = scan.member
                    const statusStyle = {
                      active: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', ring: 'ring-emerald-200 dark:ring-emerald-800', text: 'text-emerald-700 dark:text-emerald-300', iconName: 'active' },
                      warning: { bg: 'bg-amber-50 dark:bg-amber-900/30', ring: 'ring-amber-200 dark:ring-amber-800', text: 'text-amber-700 dark:text-amber-300', iconName: 'warning' },
                      expired: { bg: 'bg-red-50 dark:bg-red-900/30', ring: 'ring-red-200 dark:ring-red-800', text: 'text-red-700 dark:text-red-300', iconName: 'expired' },
                      banned: { bg: 'bg-gray-900 dark:bg-black', ring: 'ring-gray-700', text: 'text-red-200', iconName: 'banned' },
                      frozen: { bg: 'bg-blue-50 dark:bg-blue-900/30', ring: 'ring-blue-200 dark:ring-blue-800', text: 'text-blue-700 dark:text-blue-300', iconName: 'frozen' },
                      future: { bg: 'bg-purple-50 dark:bg-purple-900/30', ring: 'ring-purple-200 dark:ring-purple-800', text: 'text-purple-700 dark:text-purple-300', iconName: 'future' },
                      notStarted: { bg: 'bg-purple-50 dark:bg-purple-900/30', ring: 'ring-purple-200 dark:ring-purple-800', text: 'text-purple-700 dark:text-purple-300', iconName: 'notStarted' },
                    }[scan.status] || { bg: 'bg-gray-50 dark:bg-gray-700', ring: 'ring-gray-200 dark:ring-gray-600', text: 'text-gray-700 dark:text-gray-300', iconName: 'active' }
                    return (
                      <div
                        key={scan.key}
                        className={`flex-shrink-0 w-44 sm:w-52 ${statusStyle.bg} ring-1 ${statusStyle.ring} rounded-lg p-2 relative`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-white dark:ring-gray-700 bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                            {m?.profileImage ? (
                              <img src={m.profileImage} alt={m.name} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                <StatusIcon name="user" className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-xs font-bold truncate ${statusStyle.text} flex items-center gap-1`} title={m?.name}>
                              <StatusIcon name={statusStyle.iconName} className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">{m?.name || '—'}</span>
                            </div>
                            <div className={`text-[10px] font-mono truncate ${statusStyle.text} opacity-80`}>
                              #{m?.memberNumber ?? '—'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
                          <span title={new Date(scan.scannedAt).toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US')}>
                            {direction === 'rtl' ? `قبل ${ageSec}ث` : `${ageSec}s ago`}
                          </span>
                          <span className="font-mono">{remainSec}s</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRecentScans(prev => prev.filter(s => s.key !== scan.key))}
                          aria-label={direction === 'rtl' ? 'إزالة' : 'Remove'}
                          title={direction === 'rtl' ? 'إزالة' : 'Remove'}
                          className="absolute top-0.5 end-0.5 text-gray-400 hover:text-red-500 p-0.5 rounded transition-colors duration-200"
                        >
                          <svg className="w-3 h-3" {...stroke}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
              )
            })()}

            {/* Content - استخدام نفس JSX من صفحة البحث */}
            <div className="p-2 sm:p-3">
              {/* Search Mode Selector and Input */}
              {searchMode === 'id' && (
                <div className="bg-gray-50 dark:bg-gray-700 p-2 sm:p-3 rounded-lg mb-2 border border-primary-200">
                  <div className="mb-2">
                    {attendanceMessage && (
                      <div className={`mb-2 p-2 sm:p-3 rounded-lg ring-1 animate-slideDown ${
                        attendanceMessage.type === 'success'
                          ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-500'
                          : 'bg-gradient-to-r from-red-50 to-red-100 border-red-500'
                      }`}>
                        <div className="flex items-start gap-2">
                          <div className={`shrink-0 ${attendanceMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                            {attendanceMessage.type === 'success' ? (
                              <svg className="w-7 h-7 sm:w-8 sm:h-8" {...stroke}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            ) : (
                              <svg className="w-7 h-7 sm:w-8 sm:h-8" {...stroke}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1">
                            <h3 className={`text-sm sm:text-base font-bold mb-0.5 ${
                              attendanceMessage.type === 'success' ? 'text-green-800' : 'text-red-800'
                            }`}>
                              {attendanceMessage.type === 'success' ? t('search.registeredSuccessfully') : t('search.registrationError')}
                            </h3>
                            <p className={`text-xs sm:text-sm font-bold ${
                              attendanceMessage.type === 'success' ? 'text-green-700' : 'text-red-700'
                            }`}>
                              {attendanceMessage.text}
                            </p>
                            {attendanceMessage.staff && (
                              <div className="mt-2 bg-white dark:bg-gray-800/50 rounded-lg p-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <p className="text-xs text-gray-600 dark:text-gray-300">{t('nav.employee')}</p>
                                    <p className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-100">{attendanceMessage.staff.name}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-600 dark:text-gray-300">{t('nav.position')}</p>
                                    <p className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-100">{getPositionLabel(attendanceMessage.staff.position)}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <div className="flex flex-col gap-1.5 shrink-0 w-12 sm:w-14">
                        <button
                          onClick={() => {
                            setSearchMode('id')
                            setSearched(false)
                            setResults([])
                          }}
                          aria-pressed={searchMode === 'id'}
                          aria-label={t('search.searchByIdOrAttendance')}
                          className={`flex items-center justify-center px-1 py-2 sm:py-3 rounded-lg transition-colors duration-200 ${
                            searchMode === 'id'
                              ? 'bg-primary-600 text-primary-contrast shadow-sm'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                          title={t('search.searchByIdOrAttendance')}
                        >
                          <svg className="w-5 h-5 sm:w-6 sm:h-6" {...stroke}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5v15m3-15v15m3-15v15m3-15v15m3-15v15m3-15v15m3-15v15" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setSearchMode('name' as const)
                            setSearched(false)
                            setResults([])
                          }}
                          aria-pressed={(searchMode as SearchMode) === 'name'}
                          aria-label={t('search.searchByNamePhone')}
                          className={`flex items-center justify-center px-1 py-2 sm:py-3 rounded-lg transition-colors duration-200 ${
                            (searchMode as SearchMode) === 'name'
                              ? 'bg-green-600 text-white shadow-sm'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                          title={t('search.searchByNamePhone')}
                        >
                          <svg className="w-5 h-5 sm:w-6 sm:h-6" {...stroke}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                        </button>
                      </div>

                      <div className="flex gap-2 flex-1 min-w-0">
                        <input
                          ref={memberIdRef}
                          type="text"
                          value={memberId}
                          onChange={(e) => setMemberId(e.target.value)}
                          onKeyPress={handleIdKeyPress}
                          className="flex-1 min-w-0 px-3 py-2 rounded-lg ring-1 ring-green-300 dark:ring-green-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 text-base sm:text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors duration-200"
                          placeholder={t('search.idPlaceholder')}
                          data-search-input
                          autoFocus
                        />
                        <button
                          onClick={() => handleSearchById()}
                          disabled={loading || !memberId.trim()}
                          aria-label={t('search.search')}
                          className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 min-h-[44px] bg-green-600 hover:bg-green-700 text-white text-sm sm:text-base font-bold rounded-lg disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
                        >
                          {loading ? (
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" {...stroke}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-4.992 4.992l3.181-3.183a8.25 8.25 0 00-13.803 3.7M4.031 9.865v-4.992m0 0H8.99M3 12a9 9 0 0015.357 6.364l-1.06-1.06" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" {...stroke}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                            </svg>
                          )}
                          <span>{t('search.search')}</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1.5">
                       {t('search.pressEnter')}
                    </p>
                  </div>
                </div>
              )}

              {(searchMode as SearchMode) === 'name' && (
                <div className="bg-gray-50 dark:bg-gray-700 p-2 sm:p-3 rounded-lg mb-2 border border-green-200">
                  <div className="mb-2">
                    {attendanceMessage && (
                      <div className="mb-2 p-2 rounded-lg ring-1 bg-red-50 dark:bg-red-900/30 border-red-500 dark:border-red-700 animate-slideDown">
                        <p className="text-xs sm:text-sm font-bold text-red-700 dark:text-red-300">
                          {attendanceMessage.text}
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <div className="flex flex-col gap-1.5 shrink-0 w-12 sm:w-14">
                        <button
                          onClick={() => {
                            setSearchMode('id')
                            setSearched(false)
                            setResults([])
                          }}
                          aria-pressed={searchMode === 'id'}
                          aria-label={t('search.searchByIdOrAttendance')}
                          className={`flex items-center justify-center px-1 py-2 sm:py-3 rounded-lg transition-colors duration-200 ${
                            searchMode === 'id'
                              ? 'bg-primary-600 text-primary-contrast shadow-sm'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                          title={t('search.searchByIdOrAttendance')}
                        >
                          <svg className="w-5 h-5 sm:w-6 sm:h-6" {...stroke}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5v15m3-15v15m3-15v15m3-15v15m3-15v15m3-15v15m3-15v15" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setSearchMode('name' as const)
                            setSearched(false)
                            setResults([])
                          }}
                          aria-pressed={(searchMode as SearchMode) === 'name'}
                          aria-label={t('search.searchByNamePhone')}
                          className={`flex items-center justify-center px-1 py-2 sm:py-3 rounded-lg transition-colors duration-200 ${
                            (searchMode as SearchMode) === 'name'
                              ? 'bg-green-600 text-white shadow-sm'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                          title={t('search.searchByNamePhone')}
                        >
                          <svg className="w-5 h-5 sm:w-6 sm:h-6" {...stroke}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                        </button>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="mb-2">
                          <label className="block text-xs font-medium mb-0.5 text-gray-700 dark:text-gray-200">
                            {direction === 'rtl' ? 'الاسم أو رقم الهاتف' : 'Name or Phone'}
                          </label>
                          <input
                            ref={nameRef}
                            type="text"
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            onKeyPress={handleNameKeyPress}
                            className="w-full px-3 py-2 rounded-lg ring-1 ring-green-300 dark:ring-green-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors duration-200"
                            placeholder={direction === 'rtl' ? 'اكتب الاسم أو رقم الهاتف...' : 'Type name or phone number...'}
                            data-search-input
                          />
                        </div>

                        <button
                          onClick={() => handleSearchByName()}
                          disabled={loading || !searchName.trim()}
                          aria-label={t('search.search')}
                          className="inline-flex w-full items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] bg-green-600 hover:bg-green-700 text-white text-sm sm:text-base font-bold rounded-lg disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
                        >
                          {loading ? (
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" {...stroke}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-4.992 4.992l3.181-3.183a8.25 8.25 0 00-13.803 3.7M4.031 9.865v-4.992m0 0H8.99M3 12a9 9 0 0015.357 6.364l-1.06-1.06" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" {...stroke}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                            </svg>
                          )}
                          <span>{t('search.search')}</span>
                        </button>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1.5">
                       {direction === 'rtl' ? 'هتلاقى نتائج تطابق الاسم أو رقم الهاتف للقيمة دي' : 'Searches both name and phone for this value'}
                    </p>
                  </div>
                </div>
              )}

              {lastSearchTime && (
                <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded text-center text-xs text-gray-600 dark:text-gray-300 mb-3">
                  {t('search.lastSearch')} {lastSearchTime.toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                </div>
              )}

              {/* Results - نفس الكود من صفحة البحث */}
              {searched && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-green-200 dark:border-green-700 animate-fadeIn">
                  {loading ? (
                    <LoadingScreen message={t('search.searching')} />
                  ) : results.length === 0 ? (
                    <div className="text-center py-6 sm:py-8 bg-red-50 dark:bg-red-900/30 animate-pulse">
                      
                      <p className="text-base sm:text-lg font-bold text-red-600 dark:text-red-400 mb-1 px-3">{t('search.noResults')}</p>
                      <p className="text-sm text-red-500 dark:text-red-300 px-3">
                        {searchMode === 'id'
                          ? `${t('search.searchingFor')} "${memberId}"`
                          : `${t('search.searchingFor')} "${searchName}"`
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="p-2 sm:p-3 max-h-[60vh] overflow-y-auto">
                      <div className="mb-2 text-center">
                        <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-bold border border-green-200 dark:border-green-700">
                           {t('search.foundResults')} {results.length} {results.length === 1 ? t('search.result') : t('search.results')}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {results.map((result, index) => (
                          <div key={index} className="border border-primary-200 dark:border-primary-700 rounded-lg p-2 sm:p-3 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition">
                            {result.type === 'member' && (
                              <div>
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-1.5 mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden ring-1 ring-primary-300 bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                                      {result.data.profileImage ? (
                                        <img
                                          src={result.data.profileImage}
                                          alt={result.data.name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                                          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                          </svg>
                                        </div>
                                      )}
                                    </div>

                                    <div>
                                      <span className="bg-primary-500 text-primary-contrast px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-bold">
                                         {t('search.member')}
                                      </span>
                                      <h3 className="text-sm sm:text-base md:text-lg font-bold mt-0.5 sm:mt-1 text-gray-800 dark:text-gray-100">{result.data.name}</h3>
                                    </div>
                                  </div>
                                  {result.data.memberNumber !== null && (
                                    <span className="text-lg sm:text-xl md:text-2xl font-bold text-primary-600">
                                      #{result.data.memberNumber}
                                    </span>
                                  )}
                                  {result.data.memberNumber === null && (
                                    <span className="text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                                       {locale === 'ar' ? 'ليس عضوية' : 'Non-Member'}
                                    </span>
                                  )}
                                </div>

                                {(() => {
                                  if (!result.data.birthDate) return null
                                  const today = new Date()
                                  const birth = new Date(result.data.birthDate)
                                  if (birth.getDate() === today.getDate() && birth.getMonth() === today.getMonth()) {
                                    return (
                                      <div className="mb-2 bg-gradient-to-r from-pink-100 via-yellow-100 to-pink-100 dark:from-pink-900/40 dark:via-yellow-900/40 dark:to-pink-900/40 ring-1 ring-pink-400 dark:ring-pink-600 rounded-xl p-3 text-center animate-pulse">
                                        <p className="text-lg sm:text-xl font-bold text-pink-600 dark:text-pink-300">
                                           {locale === 'ar' ? `عيد ميلاد سعيد يا ${result.data.name.split(' ')[0]}!` : `Happy Birthday ${result.data.name.split(' ')[0]}!`} 
                                        </p>
                                      </div>
                                    )
                                  }
                                  return null
                                })()}

                                {result.data.remainingAmount > 0 && (
                                  <div className="mb-2 bg-red-50 dark:bg-red-900/30 ring-1 ring-red-400 dark:ring-red-600 rounded-xl p-2 sm:p-3 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      
                                      <div>
                                        <p className="text-xs text-red-700 dark:text-red-300 font-semibold">
                                          {locale === 'ar' ? 'مبلغ متبقي على العضو' : 'Outstanding Balance'}
                                        </p>
                                        <p className="text-base sm:text-lg font-bold text-red-700 dark:text-red-200">
                                          {result.data.remainingAmount} {t('members.egp')}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 mb-1.5 sm:mb-2">
                                  <div className="bg-gray-50 dark:bg-gray-700 p-1.5 sm:p-2 rounded">
                                    <p className="text-xs text-gray-600 dark:text-gray-300">{t('common.phone')}</p>
                                    <p className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-100">{result.data.phone}</p>
                                  </div>
                                  <div className="bg-gray-50 dark:bg-gray-700 p-1.5 sm:p-2 rounded">
                                    <p className="text-xs text-gray-600 dark:text-gray-300">{t('search.price')}</p>
                                    <p className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-100">{result.data.subscriptionPrice} {t('members.egp')}</p>
                                  </div>
                                  <div className="bg-gray-50 dark:bg-gray-700 p-1.5 sm:p-2 rounded">
                                    <p className="text-xs text-gray-600 dark:text-gray-300">{locale === 'ar' ? 'الباقة' : 'Package'}</p>
                                    <p className="text-xs sm:text-sm font-bold text-primary-600 dark:text-primary-400">{getPackageName(result.data.startDate, result.data.expiryDate)}</p>
                                  </div>
                                  <div className="bg-gray-50 dark:bg-gray-700 p-1.5 sm:p-2 rounded">
                                    <p className="text-xs text-gray-600 dark:text-gray-300">{t('search.status')}</p>
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${
                                      (() => {
                                        const today = new Date()
                                        today.setHours(0, 0, 0, 0)
                                        const startDate = result.data.startDate ? new Date(result.data.startDate) : null
                                        const expiryDate = result.data.expiryDate ? new Date(result.data.expiryDate) : null
                                        if (!startDate && !expiryDate && !result.data.isActive && result.data.memberNumber === null) return 'bg-gray-500 text-white'
                                        if (result.data.isBanned) return 'bg-gray-900 text-white'
                                        if (result.data.isFrozen) return 'bg-primary-500 text-primary-contrast'
                                        if (startDate && startDate > today) return 'bg-blue-500 text-white'
                                        const hasStarted = !startDate || startDate <= today
                                        const notExpired = !expiryDate || expiryDate >= today
                                        if (result.data.isActive && hasStarted && notExpired) return 'bg-green-500 text-white'
                                        return 'bg-red-500 text-white animate-pulse'
                                      })()
                                    }`}>
                                      {(() => {
                                        const today = new Date()
                                        today.setHours(0, 0, 0, 0)
                                        const startDate = result.data.startDate ? new Date(result.data.startDate) : null
                                        const expiryDate = result.data.expiryDate ? new Date(result.data.expiryDate) : null
                                        if (!startDate && !expiryDate && !result.data.isActive && result.data.memberNumber === null) return ` ${locale === 'ar' ? 'ليس عضوية' : 'Non-Member'}`
                                        if (result.data.isBanned) return ` ${locale === 'ar' ? 'محظور' : 'Banned'}`
                                        if (result.data.isFrozen) return ` ${locale === 'ar' ? 'مجمد' : 'Frozen'}`
                                        if (startDate && startDate > today) {
                                          const diffDays = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                                          return ` ${locale === 'ar' ? `يبدأ بعد ${diffDays} يوم` : `Starts in ${diffDays} days`}`
                                        }
                                        const hasStarted = !startDate || startDate <= today
                                        const notExpired = !expiryDate || expiryDate >= today
                                        if (result.data.isActive && hasStarted && notExpired) return ` ${t('search.active')}`
                                        return ` ${t('search.expired')}`
                                      })()}
                                    </span>
                                  </div>
                                </div>

                                {(result.data.startDate || result.data.expiryDate) && (
                                  <div className="mb-2 sm:mb-3 bg-gradient-to-r from-primary-50 to-yellow-50 dark:from-primary-900/30 dark:to-yellow-900/30 ring-1 ring-primary-300 dark:ring-primary-700 rounded p-2 sm:p-3 dark:border-gray-600 dark:bg-gray-700 dark:text-primary-contrast">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {result.data.startDate && (
                                        <div>
                                          <p className="text-xs text-gray-600 dark:text-gray-300">{t('common.startDate')}</p>
                                          <p className="text-sm sm:text-base md:text-lg font-bold text-gray-800 dark:text-gray-100 dark:text-gray-100">
                                            {new Date(result.data.startDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                                          </p>
                                        </div>
                                      )}
                                      {result.data.expiryDate && (
                                        <div>
                                          <p className="text-xs text-gray-600 dark:text-gray-300">{t('search.expiryDate')}</p>
                                          <p className="text-sm sm:text-base md:text-lg font-bold text-gray-800 dark:text-gray-100 dark:text-gray-100">
                                            {new Date(result.data.expiryDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                    {(() => {
                                      const today = new Date()
                                      today.setHours(0, 0, 0, 0)
                                      const startDate = result.data.startDate ? new Date(result.data.startDate) : null

                                      // يبدأ بعد X يوم
                                      if (startDate && startDate > today) {
                                        const futureDays = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                                        return (
                                          <div className={`mt-2 pt-2 border-t-2 border-blue-300 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
                                            <p className="text-blue-600 font-bold text-sm sm:text-base md:text-lg">
                                               {locale === 'ar' ? `يبدأ بعد ${futureDays} يوم` : `Starts in ${futureDays} days`}
                                            </p>
                                          </div>
                                        )
                                      }

                                      const days = calculateRemainingDays(result.data.expiryDate)
                                      if (days === null) return null

                                      if (days < 0) {
                                        return (
                                          <div className={`mt-2 pt-2 border-t-2 border-red-300 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
                                            <p className="text-red-600 font-bold text-sm sm:text-base md:text-lg animate-pulse">
                                               {t('search.expiredSince')} {Math.abs(days)} {t('search.day')}
                                            </p>
                                          </div>
                                        )
                                      } else if (days <= 7) {
                                        return (
                                          <div className={`mt-2 pt-2 border-t-2 border-orange-300 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
                                            <p className="text-orange-600 font-bold text-sm sm:text-base md:text-lg">
                                               {t('search.daysRemaining')} {days} {t('search.daysOnly')}
                                            </p>
                                          </div>
                                        )
                                      } else {
                                        return (
                                          <div className={`mt-2 pt-2 border-t-2 border-green-300 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
                                            <p className="text-green-600 font-bold text-sm sm:text-base md:text-lg">
                                               {t('search.daysRemaining')} {days} {t('search.day')}
                                            </p>
                                          </div>
                                        )
                                      }
                                    })()}
                                  </div>
                                )}

                                {result.data.notes && (
                                  <div className="mb-2 sm:mb-3 bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-400 dark:ring-primary-700 rounded p-2 sm:p-3">
                                    <div className="flex items-start gap-1 mb-1">
                                      
                                      <p className="text-xs font-bold text-primary-800 dark:text-primary-300">{t('search.notes')}</p>
                                    </div>
                                    <p className="text-xs sm:text-sm md:text-base text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                                      {result.data.notes}
                                    </p>
                                  </div>
                                )}

                                {(() => {
                                  const today = new Date()
                                  today.setHours(0, 0, 0, 0)
                                  const startDate = result.data.startDate ? new Date(result.data.startDate) : null
                                  const hasStarted = !startDate || startDate <= today
                                  return result.data.isActive && hasStarted && (result.data.invitations > 0 || result.data.freePTSessions > 0 || (settings.inBodyEnabled && result.data.inBodyScans > 0) || (settings.nutritionEnabled && result.data.freeNutritionSessions > 0) || (settings.physiotherapyEnabled && result.data.freePhysioSessions > 0) || (settings.groupClassEnabled && result.data.freeGroupClassSessions > 0))
                                })() && (
                                  <div className="mb-3 sm:mb-4 bg-gradient-to-r from-primary-50 to-pink-50 dark:from-primary-900/30 dark:to-pink-900/30 ring-1 ring-primary-400 dark:ring-primary-700 rounded-xl p-4 dark:border-gray-600 dark:bg-gray-700 dark:text-primary-contrast">
                                    <div className="flex items-center gap-2 mb-3">
                                      
                                      <p className="text-sm sm:text-base font-bold text-primary-800 dark:text-primary-300">{t('search.freeServicesRemaining')}</p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                      {result.data.invitations > 0 && (
                                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 ring-1 ring-primary-200">
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                              
                                              <div>
                                                <p className="text-xs text-gray-600 dark:text-gray-300">{t('search.invitations')}</p>
                                                <p className="text-xl font-bold text-primary-600">{result.data.invitations}</p>
                                              </div>
                                            </div>
                                            <button
                                              onClick={() => setInvitationModal({ isOpen: true, memberId: result.data.id, memberName: result.data.name, memberSalesStaffId: result.data.salesStaffId })}
                                              className="bg-primary-600 text-primary-contrast px-3 py-1.5 rounded-lg hover:bg-primary-700 text-xs font-bold"
                                            >
                                              {t('search.use')}
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {result.data.freePTSessions > 0 && (
                                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 ring-1 ring-green-200">
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                              
                                              <div>
                                                <p className="text-xs text-gray-600 dark:text-gray-300">{t('search.freePT')}</p>
                                                <p className="text-xl font-bold text-green-600">{result.data.freePTSessions}</p>
                                              </div>
                                            </div>
                                            <button
                                              onClick={() => setServiceModal({ isOpen: true, type: 'freePT', memberId: result.data.id, memberName: result.data.name })}
                                              className="bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 text-xs font-bold"
                                            >
                                              {t('search.deduct')}
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {settings.inBodyEnabled && result.data.inBodyScans > 0 && (
                                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 ring-1 ring-primary-200">
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                              
                                              <div>
                                                <p className="text-xs text-gray-600 dark:text-gray-300">InBody</p>
                                                <p className="text-xl font-bold text-primary-600">{result.data.inBodyScans}</p>
                                              </div>
                                            </div>
                                            <button
                                              onClick={() => setServiceModal({ isOpen: true, type: 'inBody', memberId: result.data.id, memberName: result.data.name })}
                                              className="bg-primary-600 text-primary-contrast px-3 py-1.5 rounded-lg hover:bg-primary-700 text-xs font-bold"
                                            >
                                              {t('search.deduct')}
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {settings.nutritionEnabled && result.data.freeNutritionSessions > 0 && (
                                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 ring-1 ring-orange-200">
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                              
                                              <div>
                                                <p className="text-xs text-gray-600 dark:text-gray-300">{t('search.nutrition')}</p>
                                                <p className="text-xl font-bold text-orange-600">{result.data.freeNutritionSessions}</p>
                                              </div>
                                            </div>
                                            <button
                                              onClick={() => setServiceModal({ isOpen: true, type: 'nutrition', memberId: result.data.id, memberName: result.data.name })}
                                              className="bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 text-xs font-bold"
                                            >
                                              {t('search.deduct')}
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {settings.physiotherapyEnabled && result.data.freePhysioSessions > 0 && (
                                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 ring-1 ring-teal-200">
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                              
                                              <div>
                                                <p className="text-xs text-gray-600 dark:text-gray-300">{t('search.physiotherapy')}</p>
                                                <p className="text-xl font-bold text-teal-600">{result.data.freePhysioSessions}</p>
                                              </div>
                                            </div>
                                            <button
                                              onClick={() => setServiceModal({ isOpen: true, type: 'physio', memberId: result.data.id, memberName: result.data.name })}
                                              className="bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 text-xs font-bold"
                                            >
                                              {t('search.deduct')}
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {settings.groupClassEnabled && result.data.freeGroupClassSessions > 0 && (
                                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 ring-1 ring-primary-200">
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                              
                                              <div>
                                                <p className="text-xs text-gray-600 dark:text-gray-300">{t('search.groupClass')}</p>
                                                <p className="text-xl font-bold text-primary-600">{result.data.freeGroupClassSessions}</p>
                                              </div>
                                            </div>
                                            <button
                                              onClick={() => setServiceModal({ isOpen: true, type: 'groupClass', memberId: result.data.id, memberName: result.data.name })}
                                              className="bg-primary-600 text-primary-contrast px-3 py-1.5 rounded-lg hover:bg-primary-700 text-xs font-bold"
                                            >
                                              {t('search.deduct')}
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* نظام النقاط */}
                                {settings.pointsEnabled && result.data.points > 0 && (
                                  <div className="mb-3 sm:mb-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 ring-1 ring-amber-400 dark:ring-amber-700 rounded-xl p-4 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        
                                        <div>
                                          <p className="text-xs text-gray-600 dark:text-gray-300">{t('search.pointsBalance')}</p>
                                          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{result.data.points}</p>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-xs text-gray-600 dark:text-gray-300">{t('search.valueInEGP')}</p>
                                        <p className="text-lg font-bold text-green-600 dark:text-green-400">{(result.data.points * settings.pointsValueInEGP).toFixed(2)} {locale === 'ar' ? 'ج.م' : 'EGP'}</p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                <div className="grid grid-cols-1 gap-2">
                                  <button
                                    onClick={() => handleViewMemberDetails(result.data.id)}
                                    className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-primary-contrast py-2 sm:py-3 px-3 sm:px-4 rounded hover:from-primary-700 hover:to-primary-800 transition-colors duration-200 shadow hover:shadow-lg font-bold text-xs sm:text-sm md:text-base flex items-center justify-center gap-1 sm:gap-2"
                                  >
                                    <span></span>
                                    <span>{t('search.viewFullDetails')}</span>
                                    <span>{direction === 'rtl' ? '' : ''}</span>
                                  </button>
                                </div>
                              </div>
                            )}

                            {result.type === 'pt' && (
                              <div>
                                <div className="flex justify-between items-start mb-3">
                                  <div>
                                    <span className="bg-green-500 text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded text-xs sm:text-sm md:text-base font-bold">
                                       PT
                                    </span>
                                    <h3 className="text-lg sm:text-xl md:text-2xl font-bold mt-1.5 sm:mt-2 text-gray-800 dark:text-gray-100">{result.data.clientName}</h3>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2 sm:mb-3">
                                  <div className="bg-gray-50 dark:bg-gray-700 p-2 sm:p-3 rounded">
                                    <p className="text-xs text-gray-600 dark:text-gray-300">{t('common.phone')}</p>
                                    <p className="text-xs sm:text-sm md:text-base font-bold text-gray-800 dark:text-gray-100">{result.data.phone}</p>
                                  </div>
                                  <div className="bg-gray-50 dark:bg-gray-700 p-2 sm:p-3 rounded">
                                    <p className="text-xs text-gray-600 dark:text-gray-300">{t('search.coach')}</p>
                                    <p className="text-xs sm:text-sm md:text-base font-bold text-gray-800 dark:text-gray-100">{result.data.coachName}</p>
                                  </div>
                                  <div className="bg-gray-50 dark:bg-gray-700 p-2 sm:p-3 rounded">
                                    <p className="text-xs text-gray-600 dark:text-gray-300">{t('search.sessionsRemaining')}</p>
                                    <p className="text-xs sm:text-sm md:text-base font-bold text-green-600 dark:text-green-400">{result.data.sessionsRemaining}</p>
                                  </div>
                                  <div className="bg-gray-50 dark:bg-gray-700 p-2 sm:p-3 rounded">
                                    <p className="text-xs text-gray-600 dark:text-gray-300">{t('search.sessionPrice')}</p>
                                    <p className="text-xs sm:text-sm md:text-base font-bold text-gray-800 dark:text-gray-100">{result.data.pricePerSession} {t('members.egp')}</p>
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleViewPTDetails(result.data.id)}
                                  className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-2 sm:py-3 px-3 sm:px-4 rounded hover:from-green-700 hover:to-green-800 transition-colors duration-200 shadow hover:shadow-lg font-bold text-xs sm:text-sm md:text-base flex items-center justify-center gap-1 sm:gap-2"
                                >
                                  <span></span>
                                  <span>{t('search.viewFullDetails')}</span>
                                  <span>{direction === 'rtl' ? '' : ''}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <InvitationModal
        isOpen={invitationModal.isOpen}
        memberId={invitationModal.memberId}
        memberName={invitationModal.memberName}
        memberSalesStaffId={invitationModal.memberSalesStaffId}
        onClose={() => setInvitationModal({ isOpen: false, memberId: '', memberName: '' })}
        onSuccess={() => refreshResults()}
      />

      <SimpleServiceModal
        isOpen={serviceModal.isOpen}
        serviceType={serviceModal.type}
        memberId={serviceModal.memberId}
        memberName={serviceModal.memberName}
        onClose={() => setServiceModal({ isOpen: false, type: 'freePT', memberId: '', memberName: '' })}
        onSuccess={() => refreshResults()}
      />

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-50px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </>
  )
}

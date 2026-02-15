'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { InvitationModal, SimpleServiceModal } from './ServiceDeductionModals'
import { useLanguage } from '@/contexts/LanguageContext'
import { useSearch } from '../contexts/SearchContext'
import { useServiceSettings } from '../contexts/ServiceSettingsContext'

interface SearchResult {
  type: 'member' | 'pt'
  data: any
}

type SearchMode = 'id' | 'name'

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
  const [searchPhone, setSearchPhone] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [lastSearchTime, setLastSearchTime] = useState<Date | null>(null)
  const [attendanceMessage, setAttendanceMessage] = useState<{type: 'success' | 'error', text: string, staff?: any} | null>(null)
  const memberIdRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  const [invitationModal, setInvitationModal] = useState<{isOpen: boolean, memberId: string, memberName: string}>({ isOpen: false, memberId: '', memberName: '' })
  const [serviceModal, setServiceModal] = useState<{isOpen: boolean, type: 'freePT' | 'inBody' | 'nutrition' | 'physio' | 'groupClass', memberId: string, memberName: string}>({ isOpen: false, type: 'freePT', memberId: '', memberName: '' })

  // Reset when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      console.log('🔓 SearchModal opened')
      // Reset search state when opening
      setSearched(false)
      setResults([])
      // ✅ FIX: Don't clear memberId if searchValue is present (prevents race condition)
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

  const checkMemberStatusAndPlaySound = (member: any) => {
    const isActive = member.isActive
    const isFrozen = member.isFrozen
    const expiryDate = member.expiryDate ? new Date(member.expiryDate) : null
    const today = new Date()

    if (isFrozen) {
      playFreezeSound()
      return 'frozen'
    }

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
        console.log('✅ تم تسجيل دخول العضو:', data.message)
      } else if (data.alreadyCheckedIn) {
        console.log('ℹ️ العضو مسجل دخول بالفعل')
        playWarningSound()
        setAttendanceMessage({
          type: 'error',
          text: data.error || 'تم تسجيل الحضور مسبقاً اليوم ✅'
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
          text: '❌ رقم الموظف يجب أن يكون 9 أرقام (مثال: 100000022)'
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

      const filteredMembers = members.filter((m: any) =>
        m.memberNumber !== null && m.memberNumber.toString() === inputValue
      )

      filteredMembers.forEach((member: any) => {
        foundResults.push({ type: 'member', data: member })
      })

      setResults(foundResults)
      setLastSearchTime(new Date())

      if (foundResults.length > 0) {
        const member = foundResults[0].data

        if (member.isActive) {
          handleMemberCheckIn(member.id)
        }

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
  }, [memberId, playAlarmSound, playSuccessSound, handleMemberCheckIn, checkMemberStatusAndPlaySound])

  // Handle search value from barcode (placed after handleSearchById to avoid reference error)
  useEffect(() => {
    if (isOpen && searchValue && !searched) {
      console.log('🔍 SearchModal: Received barcode value:', searchValue)
      setMemberId(searchValue)

      // Increased delay for Electron
      const delay = (window as any).electron?.isElectron ? 300 : 150

      setTimeout(() => {
        console.log('🔍 SearchModal: Starting auto-search...')
        handleSearchById(true)
      }, delay)
    }
  }, [isOpen, searchValue, searched, handleSearchById])

  const handleSearchByName = async (silent: boolean = false) => {
    if (!searchName.trim() && !searchPhone.trim()) {
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

      const filteredMembers = members.filter((m: any) => {
        const nameMatch = searchName.trim()
          ? m.name.toLowerCase().includes(searchName.trim().toLowerCase())
          : true
        const phoneMatch = searchPhone.trim()
          ? m.phone.includes(searchPhone.trim())
          : true
        return nameMatch && phoneMatch
      })

      filteredMembers.forEach((member: any) => {
        foundResults.push({ type: 'member', data: member })
      })

      const filteredPT = ptSessions.filter((pt: any) => {
        const nameMatch = searchName.trim()
          ? pt.clientName.toLowerCase().includes(searchName.trim().toLowerCase())
          : true
        const phoneMatch = searchPhone.trim()
          ? pt.phone.includes(searchPhone.trim())
          : true
        return nameMatch && phoneMatch
      })

      filteredPT.forEach((pt: any) => {
        foundResults.push({ type: 'pt', data: pt })
      })

      setResults(foundResults)
      setLastSearchTime(new Date())

      if (foundResults.length > 0) {
        if (foundResults[0].type === 'member' && foundResults[0].data.isActive) {
          handleMemberCheckIn(foundResults[0].data.id)
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
        className="fixed inset-0 bg-black/50 z-[9998] animate-fadeIn"
        onClick={closeSearch}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[9999] overflow-auto" dir={direction} data-search-modal>
        <div className="min-h-screen p-1 sm:p-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl mx-auto my-2 animate-slideDown">
            {/* Header */}
            <div className="bg-primary-600 text-white p-2 sm:p-3 rounded-t-xl flex items-center justify-between sticky top-0 z-10">
              <h1 className="text-base sm:text-lg font-bold flex items-center gap-1">
                <span className="text-sm">🔍</span>
                <span>{t('search.title')}</span>
              </h1>
              <button
                onClick={closeSearch}
                className="p-1.5 hover:bg-white/20 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Close (ESC)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content - استخدام نفس JSX من صفحة البحث */}
            <div className="p-2 sm:p-3">
              {/* Search Mode Selector and Input */}
              {searchMode === 'id' && (
                <div className="bg-gray-50 dark:bg-gray-700 p-2 sm:p-3 rounded-lg mb-2 border border-primary-200">
                  <div className="mb-2">
                    {attendanceMessage && (
                      <div className={`mb-2 p-2 sm:p-3 rounded-lg border-2 animate-slideDown ${
                        attendanceMessage.type === 'success'
                          ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-500'
                          : 'bg-gradient-to-r from-red-50 to-red-100 border-red-500'
                      }`}>
                        <div className="flex items-start gap-2">
                          <div className="text-2xl sm:text-3xl">
                            {attendanceMessage.type === 'success' ? '✅' : '🚨'}
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
                      <div className="flex flex-col gap-1.5" style={{width: '18%'}}>
                        <button
                          onClick={() => {
                            setSearchMode('id')
                            setSearched(false)
                            setResults([])
                          }}
                          className={`px-1 py-2 sm:py-3 rounded-lg font-bold text-lg sm:text-xl transition-all ${
                            searchMode === 'id'
                              ? 'bg-primary-600 text-white shadow-lg'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                          title={t('search.searchByIdOrAttendance')}
                        >
                          🎯
                        </button>
                        <button
                          onClick={() => {
                            setSearchMode('name' as const)
                            setSearched(false)
                            setResults([])
                          }}
                          className={`px-1 py-2 sm:py-3 rounded-lg font-bold text-lg sm:text-xl transition-all ${
                            (searchMode as SearchMode) === 'name'
                              ? 'bg-green-600 text-white shadow-lg'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                          title={t('search.searchByNamePhone')}
                        >
                          👤
                        </button>
                      </div>

                      <div className="flex gap-2 flex-1">
                        <input
                          ref={memberIdRef}
                          type="text"
                          value={memberId}
                          onChange={(e) => setMemberId(e.target.value)}
                          onKeyPress={handleIdKeyPress}
                          className="flex-1 px-3 py-2 border-2 border-green-300 dark:border-green-600 dark:bg-gray-700 dark:text-white rounded-lg text-base sm:text-lg font-bold text-center focus:border-green-600 focus:ring-1 focus:ring-green-200 dark:focus:ring-green-700 transition"
                          placeholder={t('search.idPlaceholder')}
                          data-search-input
                          autoFocus
                        />
                        <button
                          onClick={() => handleSearchById()}
                          disabled={loading || !memberId.trim()}
                          className="px-3 sm:px-4 py-2 bg-green-600 text-white text-sm sm:text-base font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition whitespace-nowrap"
                        >
                          {loading ? '⏳' : '🔍'} {t('search.search')}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1.5">
                      💡 {t('search.pressEnter')}
                    </p>
                  </div>
                </div>
              )}

              {(searchMode as SearchMode) === 'name' && (
                <div className="bg-gray-50 dark:bg-gray-700 p-2 sm:p-3 rounded-lg mb-2 border border-green-200">
                  <div className="mb-2">
                    {attendanceMessage && (
                      <div className="mb-2 p-2 rounded-lg border-2 bg-red-50 dark:bg-red-900/30 border-red-500 dark:border-red-700 animate-slideDown">
                        <p className="text-xs sm:text-sm font-bold text-red-700 dark:text-red-300">
                          {attendanceMessage.text}
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <div className="flex flex-col gap-1.5" style={{width: '18%'}}>
                        <button
                          onClick={() => {
                            setSearchMode('id')
                            setSearched(false)
                            setResults([])
                          }}
                          className={`px-1 py-2 sm:py-3 rounded-lg font-bold text-lg sm:text-xl transition-all ${
                            searchMode === 'id'
                              ? 'bg-primary-600 text-white shadow-lg'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                          title={t('search.searchByIdOrAttendance')}
                        >
                          🎯
                        </button>
                        <button
                          onClick={() => {
                            setSearchMode('name' as const)
                            setSearched(false)
                            setResults([])
                          }}
                          className={`px-1 py-2 sm:py-3 rounded-lg font-bold text-lg sm:text-xl transition-all ${
                            (searchMode as SearchMode) === 'name'
                              ? 'bg-green-600 text-white shadow-lg'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                          title={t('search.searchByNamePhone')}
                        >
                          👤
                        </button>
                      </div>

                      <div className="flex-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                          <div>
                            <label className="block text-xs font-medium mb-0.5 text-gray-700 dark:text-gray-200">{t('search.name')}</label>
                            <input
                              ref={nameRef}
                              type="text"
                              value={searchName}
                              onChange={(e) => setSearchName(e.target.value)}
                              onKeyPress={handleNameKeyPress}
                              className="w-full px-2 py-1.5 border-2 border-green-300 dark:border-green-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:border-green-600 focus:ring-1 focus:ring-green-200 dark:focus:ring-green-700 transition"
                              placeholder={t('search.namePlaceholder')}
                              data-search-input
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium mb-0.5 text-gray-700 dark:text-gray-200">{t('search.phoneNumber')}</label>
                            <input
                              type="tel"
                              value={searchPhone}
                              onChange={(e) => setSearchPhone(e.target.value)}
                              onKeyPress={handleNameKeyPress}
                              className="w-full px-2 py-1.5 border-2 border-green-300 dark:border-green-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:border-green-600 focus:ring-1 focus:ring-green-200 dark:focus:ring-green-700 transition"
                              placeholder={t('search.phonePlaceholder')}
                              data-search-input
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => handleSearchByName()}
                          disabled={loading || (!searchName.trim() && !searchPhone.trim())}
                          className="w-full px-3 py-2 bg-green-600 text-white text-sm sm:text-base font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition"
                        >
                          🔍 {t('search.search')}
                        </button>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1.5">
                      💡 {t('search.searchTip')}
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
                    <div className="text-center py-6 sm:py-8">
                      <div className="inline-block animate-spin text-3xl sm:text-4xl mb-2">⏳</div>
                      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 font-bold">{t('search.searching')}</p>
                    </div>
                  ) : results.length === 0 ? (
                    <div className="text-center py-6 sm:py-8 bg-red-50 dark:bg-red-900/30 animate-pulse">
                      <div className="text-4xl sm:text-5xl mb-2 sm:mb-3 animate-bounce">🚨</div>
                      <p className="text-base sm:text-lg font-bold text-red-600 dark:text-red-400 mb-1 px-3">{t('search.noResults')}</p>
                      <p className="text-sm text-red-500 dark:text-red-300 px-3">
                        {searchMode === 'id'
                          ? `${t('search.searchingFor')} "${memberId}"`
                          : `${t('search.searchingFor')} "${searchName || searchPhone}"`
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="p-2 sm:p-3 max-h-[60vh] overflow-y-auto">
                      <div className="mb-2 text-center">
                        <span className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-bold border border-green-200 dark:border-green-700">
                          ✅ {t('search.foundResults')} {results.length} {results.length === 1 ? t('search.result') : t('search.results')}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {results.map((result, index) => (
                          <div key={index} className="border border-primary-200 dark:border-primary-700 rounded-lg p-2 sm:p-3 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition">
                            {result.type === 'member' && (
                              <div>
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-1.5 mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-primary-300 bg-gray-100 dark:bg-gray-700 flex-shrink-0">
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
                                      <span className="bg-primary-500 text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-bold">
                                        👤 {t('search.member')}
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
                                      Other
                                    </span>
                                  )}
                                </div>

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
                                      result.data.isFrozen
                                        ? 'bg-primary-500 text-white'
                                        : result.data.isActive && (!result.data.expiryDate || new Date(result.data.expiryDate) >= new Date())
                                        ? 'bg-green-500 text-white'
                                        : 'bg-red-500 text-white animate-pulse'
                                    }`}>
                                      {result.data.isFrozen
                                        ? `❄️ ${locale === 'ar' ? 'مجمد' : 'Frozen'}`
                                        : result.data.isActive && (!result.data.expiryDate || new Date(result.data.expiryDate) >= new Date())
                                          ? `✅ ${t('search.active')}`
                                          : `🚨 ${t('search.expired')}`
                                      }
                                    </span>
                                  </div>
                                </div>

                                {(result.data.startDate || result.data.expiryDate) && (
                                  <div className="mb-2 sm:mb-3 bg-gradient-to-r from-primary-50 to-yellow-50 dark:from-primary-900/30 dark:to-yellow-900/30 border-2 border-primary-300 dark:border-primary-700 rounded p-2 sm:p-3">
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
                                      const days = calculateRemainingDays(result.data.expiryDate)
                                      if (days === null) return null

                                      if (days < 0) {
                                        return (
                                          <div className={`mt-2 pt-2 border-t-2 border-red-300 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
                                            <p className="text-red-600 font-bold text-sm sm:text-base md:text-lg animate-pulse">
                                              🚨 {t('search.expiredSince')} {Math.abs(days)} {t('search.day')}
                                            </p>
                                          </div>
                                        )
                                      } else if (days <= 7) {
                                        return (
                                          <div className={`mt-2 pt-2 border-t-2 border-orange-300 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
                                            <p className="text-orange-600 font-bold text-sm sm:text-base md:text-lg">
                                              ⚠️ {t('search.daysRemaining')} {days} {t('search.daysOnly')}
                                            </p>
                                          </div>
                                        )
                                      } else {
                                        return (
                                          <div className={`mt-2 pt-2 border-t-2 border-green-300 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
                                            <p className="text-green-600 font-bold text-sm sm:text-base md:text-lg">
                                              ✅ {t('search.daysRemaining')} {days} {t('search.day')}
                                            </p>
                                          </div>
                                        )
                                      }
                                    })()}
                                  </div>
                                )}

                                {result.data.notes && (
                                  <div className="mb-2 sm:mb-3 bg-primary-50 dark:bg-primary-900/30 border-2 border-primary-400 dark:border-primary-700 rounded p-2 sm:p-3">
                                    <div className="flex items-start gap-1 mb-1">
                                      <span className="text-base sm:text-lg">📝</span>
                                      <p className="text-xs font-bold text-primary-800 dark:text-primary-300">{t('search.notes')}</p>
                                    </div>
                                    <p className="text-xs sm:text-sm md:text-base text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                                      {result.data.notes}
                                    </p>
                                  </div>
                                )}

                                {result.data.isActive && (result.data.invitations > 0 || result.data.freePTSessions > 0 || (settings.inBodyEnabled && result.data.inBodyScans > 0) || (settings.nutritionEnabled && result.data.freeNutritionSessions > 0) || (settings.physiotherapyEnabled && result.data.freePhysioSessions > 0) || (settings.groupClassEnabled && result.data.freeGroupClassSessions > 0)) && (
                                  <div className="mb-3 sm:mb-4 bg-gradient-to-r from-primary-50 to-pink-50 dark:from-primary-900/30 dark:to-pink-900/30 border-2 border-primary-400 dark:border-primary-700 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                      <span className="text-2xl">🎁</span>
                                      <p className="text-sm sm:text-base font-bold text-primary-800 dark:text-primary-300">{t('search.freeServicesRemaining')}</p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                      {result.data.invitations > 0 && (
                                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border-2 border-primary-200">
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xl">🎟️</span>
                                              <div>
                                                <p className="text-xs text-gray-600 dark:text-gray-300">{t('search.invitations')}</p>
                                                <p className="text-xl font-bold text-primary-600">{result.data.invitations}</p>
                                              </div>
                                            </div>
                                            <button
                                              onClick={() => setInvitationModal({ isOpen: true, memberId: result.data.id, memberName: result.data.name })}
                                              className="bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 text-xs font-bold"
                                            >
                                              {t('search.use')}
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {result.data.freePTSessions > 0 && (
                                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border-2 border-green-200">
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xl">💪</span>
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
                                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border-2 border-primary-200">
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xl">⚖️</span>
                                              <div>
                                                <p className="text-xs text-gray-600 dark:text-gray-300">InBody</p>
                                                <p className="text-xl font-bold text-primary-600">{result.data.inBodyScans}</p>
                                              </div>
                                            </div>
                                            <button
                                              onClick={() => setServiceModal({ isOpen: true, type: 'inBody', memberId: result.data.id, memberName: result.data.name })}
                                              className="bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 text-xs font-bold"
                                            >
                                              {t('search.deduct')}
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {settings.nutritionEnabled && result.data.freeNutritionSessions > 0 && (
                                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border-2 border-orange-200">
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xl">🥗</span>
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
                                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border-2 border-teal-200">
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xl">🏥</span>
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
                                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border-2 border-primary-200">
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xl">👥</span>
                                              <div>
                                                <p className="text-xs text-gray-600 dark:text-gray-300">{t('search.groupClass')}</p>
                                                <p className="text-xl font-bold text-primary-600">{result.data.freeGroupClassSessions}</p>
                                              </div>
                                            </div>
                                            <button
                                              onClick={() => setServiceModal({ isOpen: true, type: 'groupClass', memberId: result.data.id, memberName: result.data.name })}
                                              className="bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 text-xs font-bold"
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
                                  <div className="mb-3 sm:mb-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 border-2 border-amber-400 dark:border-amber-700 rounded-xl p-4">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <span className="text-3xl">⭐</span>
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
                                    className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white py-2 sm:py-3 px-3 sm:px-4 rounded hover:from-primary-700 hover:to-primary-800 transition-all shadow hover:shadow-lg font-bold text-xs sm:text-sm md:text-base flex items-center justify-center gap-1 sm:gap-2"
                                  >
                                    <span>👁️</span>
                                    <span>{t('search.viewFullDetails')}</span>
                                    <span>{direction === 'rtl' ? '➡️' : '⬅️'}</span>
                                  </button>
                                </div>
                              </div>
                            )}

                            {result.type === 'pt' && (
                              <div>
                                <div className="flex justify-between items-start mb-3">
                                  <div>
                                    <span className="bg-green-500 text-white px-2 sm:px-3 py-1 sm:py-1.5 rounded text-xs sm:text-sm md:text-base font-bold">
                                      💪 PT
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
                                  className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-2 sm:py-3 px-3 sm:px-4 rounded hover:from-green-700 hover:to-green-800 transition-all shadow hover:shadow-lg font-bold text-xs sm:text-sm md:text-base flex items-center justify-center gap-1 sm:gap-2"
                                >
                                  <span>👁️</span>
                                  <span>{t('search.viewFullDetails')}</span>
                                  <span>{direction === 'rtl' ? '➡️' : '⬅️'}</span>
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

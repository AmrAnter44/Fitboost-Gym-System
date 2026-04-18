'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '../../../contexts/LanguageContext'

interface AssignedMember {
  id: string
  memberNumber: number | null
  name: string
  phone: string | null
  profileImage: string | null
  isActive: boolean
  startDate: string | null
  expiryDate: string | null
  freePTSessions: number
}

export default function CoachMyMembers() {
  const router = useRouter()
  const { t, locale } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<AssignedMember[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [deductPopup, setDeductPopup] = useState<{
    show: boolean
    member: AssignedMember | null
    step: 'confirm' | 'loading' | 'success' | 'error'
    message: string
  }>({ show: false, member: null, step: 'confirm', message: '' })

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (!res.ok) { router.push('/login'); return }
      const data = await res.json()
      if (data.user.role !== 'COACH') { router.push('/'); return }
      fetchMembers()
    } catch {
      router.push('/login')
    }
  }

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/coach/my-members')
      if (res.ok) {
        const data = await res.json()
        setMembers(data)
      }
    } catch (error) {
      console.error('Error fetching assigned members:', error)
    } finally {
      setLoading(false)
    }
  }

  const openDeductPopup = (member: AssignedMember) => {
    setDeductPopup({ show: true, member, step: 'confirm', message: '' })
  }

  const closeDeductPopup = () => {
    setDeductPopup({ show: false, member: null, step: 'confirm', message: '' })
  }

  const confirmDeduct = async () => {
    if (!deductPopup.member) return
    setDeductPopup(prev => ({ ...prev, step: 'loading', message: '' }))
    try {
      const res = await fetch('/api/coach/deduct-pt-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: deductPopup.member.id })
      })
      const data = await res.json()
      if (!res.ok) {
        setDeductPopup(prev => ({
          ...prev,
          step: 'error',
          message: data.error || (locale === 'ar' ? 'فشل تسجيل الجلسة' : 'Failed to register session')
        }))
        return
      }
      // Update local state - decrement freePTSessions
      setMembers(prev => prev.map(m =>
        m.id === deductPopup.member!.id
          ? { ...m, freePTSessions: data.remainingFree }
          : m
      ))
      setDeductPopup(prev => ({
        ...prev,
        step: 'success',
        message: locale === 'ar' ? 'تم تسجيل جلسة PT مجانية بنجاح' : 'Free PT session registered successfully'
      }))
      // Auto-close after 2 seconds
      setTimeout(() => closeDeductPopup(), 2000)
    } catch (error) {
      setDeductPopup(prev => ({
        ...prev,
        step: 'error',
        message: locale === 'ar' ? 'حدث خطأ في الاتصال' : 'Connection error'
      }))
    }
  }

  const filtered = members.filter(m => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return m.name.toLowerCase().includes(term) ||
      (m.memberNumber && String(m.memberNumber).includes(term)) ||
      (m.phone && m.phone.includes(term))
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 p-4 sm:p-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/coach"
                className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <span className={`text-lg ${locale === 'ar' ? 'rotate-0' : 'rotate-180'}`}>➡️</span>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  👥 {locale === 'ar' ? 'أعضائي' : 'My Members'}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {locale === 'ar' ? `${members.length} عضو معين لك` : `${members.length} members assigned to you`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder={locale === 'ar' ? '🔍 بحث بالاسم أو الرقم أو الموبايل...' : '🔍 Search by name, number, or phone...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:border-primary-500 focus:outline-none transition-colors"
          />
        </div>

        {/* Members Grid */}
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center">
            <span className="text-5xl block mb-4">👥</span>
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              {searchTerm
                ? (locale === 'ar' ? 'لا توجد نتائج' : 'No results found')
                : (locale === 'ar' ? 'لا يوجد أعضاء معينين لك' : 'No members assigned to you')
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((member) => {
              const isActive = member.isActive && member.expiryDate && new Date(member.expiryDate) >= new Date()
              const isExpired = member.expiryDate && new Date(member.expiryDate) < new Date()
              const isOther = !member.memberNumber

              return (
                <div
                  key={member.id}
                  className={`rounded-2xl shadow-lg overflow-hidden border-2 transition-all hover:shadow-xl ${
                    isOther
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700'
                      : isActive
                        ? 'bg-white dark:bg-gray-800 border-green-300 dark:border-green-700'
                        : isExpired
                          ? 'bg-white dark:bg-gray-800 border-red-300 dark:border-red-700'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600'
                  }`}
                >
                  {/* Card Header */}
                  <div className={`p-4 flex items-center gap-4 ${
                    isOther
                      ? 'bg-amber-100 dark:bg-amber-900/30'
                      : isActive
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : isExpired
                          ? 'bg-red-50 dark:bg-red-900/20'
                          : 'bg-gray-50 dark:bg-gray-700/30'
                  }`}>
                    {/* Profile Image */}
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-600 flex-shrink-0 flex items-center justify-center">
                      {member.profileImage ? (
                        <img src={member.profileImage} alt={member.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl text-gray-400 dark:text-gray-300">👤</span>
                      )}
                    </div>

                    {/* Name & Number */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-800 dark:text-gray-100 truncate text-lg">{member.name}</h3>
                      {member.memberNumber ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">#{member.memberNumber}</p>
                      ) : (
                        <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">{locale === 'ar' ? 'بدون رقم عضوية' : 'No member #'}</p>
                      )}
                      {/* Status Badge */}
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                        isActive
                          ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200'
                          : isExpired
                            ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'
                            : 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                      }`}>
                        {isActive
                          ? (locale === 'ar' ? 'نشط' : 'Active')
                          : isExpired
                            ? (locale === 'ar' ? 'منتهي' : 'Expired')
                            : (locale === 'ar' ? 'غير نشط' : 'Inactive')
                        }
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-3">
                    {/* Free PT Sessions */}
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-purple-700 dark:text-purple-300">
                          💪 {locale === 'ar' ? 'حصص PT مجانية' : 'Free PT Sessions'}
                        </span>
                        <span className={`text-lg font-black ${
                          member.freePTSessions > 0
                            ? 'text-purple-600 dark:text-purple-400'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}>
                          {member.freePTSessions}
                        </span>
                      </div>
                      <button
                        onClick={() => openDeductPopup(member)}
                        disabled={member.freePTSessions <= 0 || !isActive}
                        className={`w-full py-2 rounded-lg text-sm font-bold transition-all ${
                          member.freePTSessions > 0 && isActive
                            ? 'bg-purple-500 hover:bg-purple-600 text-white shadow-md hover:shadow-lg active:scale-95'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {locale === 'ar' ? '➖ خصم حصة PT' : '➖ Deduct PT Session'}
                      </button>
                    </div>

                    {/* Phone + WhatsApp */}
                    {member.phone && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-50 dark:bg-gray-700/50 rounded-xl px-4 py-3">
                          <p className="text-sm text-gray-600 dark:text-gray-300">
                            📱 {member.phone}
                          </p>
                        </div>
                        <a
                          href={`https://wa.me/${member.phone.replace(/^0/, '20')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-12 h-12 rounded-xl bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all active:scale-95 flex-shrink-0"
                        >
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        </a>
                      </div>
                    )}

                    {/* Expiry Date */}
                    {member.expiryDate && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                        📅 {locale === 'ar' ? 'ينتهي:' : 'Expires:'} {new Date(member.expiryDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Deduct PT Session Popup */}
      {deductPopup.show && deductPopup.member && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            {deductPopup.step === 'confirm' && (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <span className="text-3xl">💪</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                    {locale === 'ar' ? 'تأكيد خصم حصة PT' : 'Confirm PT Session Deduction'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {locale === 'ar'
                      ? `هل أنت متأكد من خصم حصة PT مجانية للعضو:`
                      : `Are you sure you want to deduct a free PT session for:`}
                  </p>
                  <p className="font-bold text-gray-800 dark:text-gray-100 mt-2">
                    {deductPopup.member.name}
                  </p>
                  <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                    {locale === 'ar' ? 'المتبقي حالياً:' : 'Currently remaining:'} {deductPopup.member.freePTSessions}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={closeDeductPopup}
                    className="flex-1 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    onClick={confirmDeduct}
                    className="flex-1 py-3 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-bold shadow-lg transition-all active:scale-95"
                  >
                    {locale === 'ar' ? 'تأكيد الخصم' : 'Confirm'}
                  </button>
                </div>
              </>
            )}

            {deductPopup.step === 'loading' && (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500 border-t-transparent mx-auto mb-4" />
                <p className="text-gray-700 dark:text-gray-300 font-bold">
                  {locale === 'ar' ? 'جاري تسجيل الجلسة...' : 'Registering session...'}
                </p>
              </div>
            )}

            {deductPopup.step === 'success' && (
              <div className="text-center py-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <span className="text-4xl">✅</span>
                </div>
                <h3 className="text-xl font-bold text-green-600 dark:text-green-400 mb-2">
                  {locale === 'ar' ? 'تم بنجاح' : 'Success'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {deductPopup.message}
                </p>
              </div>
            )}

            {deductPopup.step === 'error' && (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <span className="text-4xl">❌</span>
                  </div>
                  <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
                    {locale === 'ar' ? 'حدث خطأ' : 'Error'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {deductPopup.message}
                  </p>
                </div>
                <button
                  onClick={closeDeductPopup}
                  className="w-full py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  {locale === 'ar' ? 'إغلاق' : 'Close'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

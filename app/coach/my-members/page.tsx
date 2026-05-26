'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '../../../contexts/LanguageContext'
import { LoadingScreen } from '../../../components/Spinner'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface AssignedMember {
  id: string
  memberNumber: string | null
  name: string
  phone: string | null
  profileImage: string | null
  isActive: boolean
  startDate: string | null
  expiryDate: string | null
  freePTSessions: number
  subscriptionPrice: number
  remainingAmount: number | null
}

export default function CoachMyMembers() {
  const router = useRouter()
  const { t, locale, direction } = useLanguage()
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
    return <LoadingScreen fullScreen />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6" dir={direction}>
      <div className="max-w-6xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6 mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/coach"
              className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 text-gray-700 dark:text-gray-200"
              aria-label={locale === 'ar' ? 'رجوع' : 'Back'}
            >
              <svg {...stroke} className={`w-5 h-5 ${direction === 'rtl' ? 'rotate-180' : ''}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </Link>
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                <svg {...stroke} className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {locale === 'ar' ? 'أعضاء محتملين' : 'Potential Members'}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {locale === 'ar' ? `${members.length} عضو معين لك` : `${members.length} members assigned to you`}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 relative">
          <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-gray-400">
            <svg {...stroke} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder={locale === 'ar' ? 'بحث بالاسم أو الرقم أو الموبايل...' : 'Search by name, number, or phone...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full ps-10 pe-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-12 flex flex-col items-center justify-center text-center">
            <svg {...stroke} className="w-12 h-12 text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
            <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">
              {searchTerm
                ? (locale === 'ar' ? 'لا توجد نتائج' : 'No results found')
                : (locale === 'ar' ? 'لا يوجد أعضاء معينين لك' : 'No members assigned to you')
              }
            </h3>
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
                  className={`rounded-xl shadow-sm overflow-hidden ring-1 transition-colors duration-200 ${
                    isOther
                      ? 'bg-amber-50/60 dark:bg-amber-900/10 ring-amber-200 dark:ring-amber-900/50'
                      : isActive
                        ? 'bg-white dark:bg-gray-800 ring-green-200 dark:ring-green-900/50'
                        : isExpired
                          ? 'bg-white dark:bg-gray-800 ring-red-200 dark:ring-red-900/50'
                          : 'bg-white dark:bg-gray-800 ring-gray-200 dark:ring-gray-700'
                  }`}
                >
                  <div className={`p-4 flex items-center gap-4 ${
                    isOther
                      ? 'bg-amber-100/50 dark:bg-amber-900/20'
                      : isActive
                        ? 'bg-green-50 dark:bg-green-900/10'
                        : isExpired
                          ? 'bg-red-50 dark:bg-red-900/10'
                          : 'bg-gray-50 dark:bg-gray-900/40'
                  }`}>
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-600 flex-shrink-0 flex items-center justify-center">
                      {member.profileImage ? (
                        <img src={member.profileImage} alt={member.name} className="w-full h-full object-cover" />
                      ) : (
                        <svg {...stroke} className="w-7 h-7 text-gray-400 dark:text-gray-300">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate text-base">{member.name}</h3>
                      {member.memberNumber ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">#{member.memberNumber}</p>
                      ) : (
                        <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">{locale === 'ar' ? 'بدون رقم عضوية' : 'No member #'}</p>
                      )}
                      <span className={`inline-flex items-center px-2.5 py-0.5 mt-1 rounded-full text-xs font-bold ${
                        isActive
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                          : isExpired
                            ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
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

                  <div className="p-4 space-y-3">
                    {member.remainingAmount !== null && member.remainingAmount > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-300 dark:ring-amber-900/60 rounded-lg px-3 py-2.5 flex items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1.5 min-w-0">
                          <svg {...stroke} className="w-4 h-4 shrink-0">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4" />
                          </svg>
                          <span className="truncate">{locale === 'ar' ? 'باقي عليه' : 'Owes'}</span>
                        </span>
                        <span className="text-base font-black text-amber-700 dark:text-amber-300 whitespace-nowrap shrink-0">
                          {Math.round(member.remainingAmount)} <span className="text-xs font-bold opacity-80">{locale === 'ar' ? 'ج.م' : 'EGP'}</span>
                        </span>
                      </div>
                    )}
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                          <svg {...stroke} className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5 9 8.25l3 3 3.75-3.75M3.75 13.5V21h16.5V8.25" />
                          </svg>
                          {locale === 'ar' ? 'حصص PT مجانية' : 'Free PT Sessions'}
                        </span>
                        <span className={`text-lg font-black ${
                          member.freePTSessions > 0
                            ? 'text-purple-700 dark:text-purple-400'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}>
                          {member.freePTSessions}
                        </span>
                      </div>
                      <button
                        onClick={() => openDeductPopup(member)}
                        disabled={member.freePTSessions <= 0 || !isActive}
                        className={`w-full py-2 rounded-lg text-sm font-bold transition-colors duration-200 inline-flex items-center justify-center gap-1.5 ${
                          member.freePTSessions > 0 && isActive
                            ? 'bg-purple-500 hover:bg-purple-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <svg {...stroke} className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                        </svg>
                        {locale === 'ar' ? 'خصم حصة PT' : 'Deduct PT Session'}
                      </button>
                    </div>

                    {member.phone && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2 flex items-center gap-2">
                          <svg {...stroke} className="w-4 h-4 text-gray-500 dark:text-gray-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                          </svg>
                          <p className="text-sm text-gray-700 dark:text-gray-300" dir="ltr">{member.phone}</p>
                        </div>
                        <a
                          href={`https://wa.me/${member.phone.replace(/^0/, '20')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-10 h-10 rounded-lg bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-colors duration-200 flex-shrink-0"
                          aria-label="WhatsApp"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        </a>
                      </div>
                    )}

                    {(member.startDate || member.expiryDate || member.subscriptionPrice) && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2 space-y-1.5">
                        <p className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-1.5">
                          <svg {...stroke} className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                          </svg>
                          {locale === 'ar' ? 'بيانات الاشتراك' : 'Subscription Info'}
                        </p>
                        {member.startDate && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-600 dark:text-gray-300">
                              {locale === 'ar' ? 'البدء:' : 'Start:'}
                            </span>
                            <span className="font-bold text-gray-800 dark:text-gray-100">
                              {new Date(member.startDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
                            </span>
                          </div>
                        )}
                        {member.expiryDate && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-600 dark:text-gray-300">
                              {locale === 'ar' ? 'النهاية:' : 'End:'}
                            </span>
                            <span className={`font-bold ${isExpired ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'}`}>
                              {new Date(member.expiryDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
                            </span>
                          </div>
                        )}
                        {member.subscriptionPrice > 0 && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-600 dark:text-gray-300">
                              {locale === 'ar' ? 'الباكدج:' : 'Package:'}
                            </span>
                            <span className="font-bold text-green-700 dark:text-green-400">
                              {Math.round(member.subscriptionPrice)} {locale === 'ar' ? 'ج' : 'EGP'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {deductPopup.show && deductPopup.member && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="deduct-title">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 ring-1 ring-gray-200 dark:ring-gray-700">
            {deductPopup.step === 'confirm' && (
              <>
                <div className="text-center mb-6">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 flex items-center justify-center">
                    <svg {...stroke} className="w-7 h-7">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5 9 8.25l3 3 3.75-3.75M3.75 13.5V21h16.5V8.25" />
                    </svg>
                  </div>
                  <h3 id="deduct-title" className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
                    {locale === 'ar' ? 'تأكيد خصم حصة PT' : 'Confirm PT Session Deduction'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {locale === 'ar'
                      ? `هل أنت متأكد من خصم حصة PT مجانية للعضو:`
                      : `Are you sure you want to deduct a free PT session for:`}
                  </p>
                  <p className="font-bold text-gray-900 dark:text-gray-100 mt-2">
                    {deductPopup.member.name}
                  </p>
                  <p className="text-sm text-purple-700 dark:text-purple-400 mt-1">
                    {locale === 'ar' ? 'المتبقي حالياً:' : 'Currently remaining:'} {deductPopup.member.freePTSessions}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={closeDeductPopup}
                    className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2.5 rounded-lg font-bold transition-colors duration-200"
                  >
                    {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    onClick={confirmDeduct}
                    autoFocus
                    className="flex-1 bg-purple-500 hover:bg-purple-600 text-white px-4 py-2.5 rounded-lg font-bold transition-colors duration-200"
                  >
                    {locale === 'ar' ? 'تأكيد الخصم' : 'Confirm'}
                  </button>
                </div>
              </>
            )}

            {deductPopup.step === 'loading' && (
              <div className="text-center py-6">
                <svg {...stroke} className="animate-spin w-12 h-12 mx-auto mb-4 text-purple-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356M2.985 19.644v-4.992h4.992m-4.992 0a8.25 8.25 0 0 0 13.803 3.7l3.181-3.182m-13.803-3.7a8.25 8.25 0 0 1 13.803-3.7L21 7.5" />
                </svg>
                <p className="text-gray-700 dark:text-gray-300 font-bold">
                  {locale === 'ar' ? 'جاري تسجيل الجلسة...' : 'Registering session...'}
                </p>
              </div>
            )}

            {deductPopup.step === 'success' && (
              <div className="text-center py-6">
                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center justify-center">
                  <svg {...stroke} className="w-7 h-7">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-green-700 dark:text-green-400 mb-2">
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
                  <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 flex items-center justify-center">
                    <svg {...stroke} className="w-7 h-7">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">
                    {locale === 'ar' ? 'حدث خطأ' : 'Error'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {deductPopup.message}
                  </p>
                </div>
                <button
                  onClick={closeDeductPopup}
                  className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2.5 rounded-lg font-bold transition-colors duration-200"
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

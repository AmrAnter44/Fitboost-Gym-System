'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '../../../contexts/LanguageContext'
import { LoadingScreen } from '../../../components/Spinner'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface PTSessionLite {
  id: string
  sessionDate: string
  notes: string | null
  isFreeSession: boolean
  attended: boolean
}

interface ActivePTInfo {
  ptNumber: number
  sessionsPurchased: number
  sessionsRemaining: number
  startDate: string | null
  expiryDate: string | null
}

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
  //  حقول جديدة
  coachConversionNote: string | null
  coachConversionNoteAt: string | null
  ptSessions: PTSessionLite[]
  hasPaidPT: boolean
  activePT: ActivePTInfo | null
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
    notes: string //  نوت التمرين بتاع الكوتش
  }>({ show: false, member: null, step: 'confirm', message: '', notes: '' })
  //  تكبير صورة العميل عند الضغط عليها
  const [enlargedImage, setEnlargedImage] = useState<{ url: string; name: string } | null>(null)
  //  مودال تسجيل سبب عدم اشتراك العضو في PT (بعد ما خلصت حصصه المجانية)
  const [conversionPopup, setConversionPopup] = useState<{
    show: boolean
    member: AssignedMember | null
    note: string
    saving: boolean
    error: string
  }>({ show: false, member: null, note: '', saving: false, error: '' })
  //  مودال عرض سجل الجلسات
  const [historyPopup, setHistoryPopup] = useState<AssignedMember | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  //  Esc يقفل مودال الصورة
  useEffect(() => {
    if (!enlargedImage) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setEnlargedImage(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enlargedImage])

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
    setDeductPopup({ show: true, member, step: 'confirm', message: '', notes: '' })
  }

  const closeDeductPopup = () => {
    setDeductPopup({ show: false, member: null, step: 'confirm', message: '', notes: '' })
  }

  const confirmDeduct = async () => {
    if (!deductPopup.member) return
    setDeductPopup(prev => ({ ...prev, step: 'loading', message: '' }))
    try {
      const res = await fetch('/api/coach/deduct-pt-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: deductPopup.member.id,
          //  نوت التمرين — لو الكوتش كتب، نبعتها؛ لو فاضي، الـ API بيستخدم default
          notes: deductPopup.notes.trim() || undefined,
        })
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
      //  بعد نجاح الخصم، نـ refetch عشان نجيب الجلسة الجديدة في الـ history
      fetchMembers()
      setDeductPopup(prev => ({
        ...prev,
        step: 'success',
        message: locale === 'ar' ? 'تم تسجيل الحصة مع الملاحظات' : 'Session registered with notes'
      }))
      setTimeout(() => closeDeductPopup(), 1800)
    } catch (error) {
      setDeductPopup(prev => ({
        ...prev,
        step: 'error',
        message: locale === 'ar' ? 'حدث خطأ في الاتصال' : 'Connection error'
      }))
    }
  }

  //  حفظ سبب عدم الاشتراك في PT
  const saveConversionNote = async () => {
    if (!conversionPopup.member || !conversionPopup.note.trim()) return
    setConversionPopup(prev => ({ ...prev, saving: true, error: '' }))
    try {
      const res = await fetch('/api/coach/conversion-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: conversionPopup.member.id,
          note: conversionPopup.note.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setConversionPopup(prev => ({ ...prev, saving: false, error: data.error || 'فشل الحفظ' }))
        return
      }
      //  تحديث الـ state محلياً
      setMembers(prev => prev.map(m =>
        m.id === conversionPopup.member!.id
          ? { ...m, coachConversionNote: data.coachConversionNote, coachConversionNoteAt: data.coachConversionNoteAt }
          : m
      ))
      setConversionPopup({ show: false, member: null, note: '', saving: false, error: '' })
    } catch {
      setConversionPopup(prev => ({ ...prev, saving: false, error: locale === 'ar' ? 'خطأ في الاتصال' : 'Connection error' }))
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
                    {/*  صورة العميل — قابلة للضغط للتكبير */}
                    {member.profileImage ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          setEnlargedImage({ url: member.profileImage!, name: member.name })
                        }}
                        className="relative w-14 h-14 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-600 flex-shrink-0 cursor-zoom-in hover:ring-2 hover:ring-primary-400 hover:scale-105 transition-all shadow-md"
                        title={locale === 'ar' ? 'اضغط للتكبير' : 'Click to enlarge'}
                        aria-label={locale === 'ar' ? 'تكبير الصورة' : 'Enlarge photo'}
                      >
                        <img src={member.profileImage} alt={member.name} className="w-full h-full object-cover pointer-events-none" />
                        {/*  Icon زووم صغير في الكورنر */}
                        <span className="absolute bottom-0 end-0 bg-primary-600 text-white rounded-full p-0.5 shadow-md">
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zm-7-3v6m-3-3h6" />
                          </svg>
                        </span>
                      </button>
                    ) : (
                      <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-600 flex-shrink-0 flex items-center justify-center">
                        <svg {...stroke} className="w-7 h-7 text-gray-400 dark:text-gray-300">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                        </svg>
                      </div>
                    )}

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
                        {locale === 'ar' ? 'خصم حصة PT + كومنت' : 'Deduct PT + Add Note'}
                      </button>

                      {/*  زرار عرض سجل التمارين — يظهر لو فيه جلسات سابقة */}
                      {member.ptSessions.length > 0 && (
                        <button
                          onClick={() => setHistoryPopup(member)}
                          className="w-full mt-2 py-1.5 rounded-lg text-xs font-bold bg-white/60 dark:bg-gray-800/60 ring-1 ring-purple-200 dark:ring-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors inline-flex items-center justify-center gap-1.5"
                        >
                          <svg {...stroke} className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                          </svg>
                          {locale === 'ar' ? `سجل الجلسات (${member.ptSessions.length})` : `Session log (${member.ptSessions.length})`}
                        </button>
                      )}
                    </div>

                    {/*  بعد ما خلصت حصصه المجانية — إما اشترك في PT أو لازم نسجل سبب عدم الاشتراك */}
                    {member.freePTSessions === 0 && (
                      member.hasPaidPT ? (
                        //  اشترك في PT — green badge
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-300 dark:ring-emerald-800 rounded-lg px-3 py-2.5">
                          <div className="flex items-center gap-2 mb-1">
                            <svg {...stroke} className="w-5 h-5 text-emerald-600 dark:text-emerald-400">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                              {locale === 'ar' ? 'اشترك في PT ✅' : 'Subscribed to PT ✅'}
                            </span>
                          </div>
                          {member.activePT && (
                            <p className="text-xs text-emerald-700 dark:text-emerald-400">
                              {locale === 'ar' ? 'الحصص المتبقية:' : 'Remaining sessions:'} {member.activePT.sessionsRemaining} / {member.activePT.sessionsPurchased}
                              {' '}· PT #{member.activePT.ptNumber}
                            </p>
                          )}
                        </div>
                      ) : member.coachConversionNote ? (
                        //  مسجّل سبب عدم الاشتراك بالفعل — show + edit
                        <button
                          type="button"
                          onClick={() => setConversionPopup({ show: true, member, note: member.coachConversionNote || '', saving: false, error: '' })}
                          className="w-full text-start bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-300 dark:ring-amber-800 rounded-lg px-3 py-2.5 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                              <svg {...stroke} className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                              </svg>
                              {locale === 'ar' ? 'سبب عدم الاشتراك' : 'Reason not subscribed'}
                            </span>
                            {member.coachConversionNoteAt && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400">
                                {new Date(member.coachConversionNoteAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-amber-800 dark:text-amber-200 line-clamp-2">{member.coachConversionNote}</p>
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">{locale === 'ar' ? 'اضغط للتعديل' : 'Tap to edit'}</p>
                        </button>
                      ) : (
                        //  محتاج يسجل سبب عدم الاشتراك
                        <button
                          type="button"
                          onClick={() => setConversionPopup({ show: true, member, note: '', saving: false, error: '' })}
                          className="w-full bg-red-50 dark:bg-red-900/20 ring-1 ring-red-300 dark:ring-red-800 rounded-lg px-3 py-2.5 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center gap-2"
                        >
                          <svg {...stroke} className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                          </svg>
                          <div className="flex-1 text-start">
                            <p className="text-sm font-bold text-red-700 dark:text-red-300">
                              {locale === 'ar' ? 'ما اشتركش في PT' : 'Did not subscribe to PT'}
                            </p>
                            <p className="text-xs text-red-600 dark:text-red-400">
                              {locale === 'ar' ? 'سجل السبب' : 'Record the reason'}
                            </p>
                          </div>
                        </button>
                      )
                    )}

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

                {/*  textarea لكومنت التمرين — اختياري */}
                <div className="mb-5">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {locale === 'ar' ? 'كومنت التمرينة (اختياري)' : 'Workout Note (optional)'}
                  </label>
                  <textarea
                    value={deductPopup.notes}
                    onChange={(e) => setDeductPopup(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    placeholder={locale === 'ar' ? 'مثلاً: شدر + باي + سبلت — أداء جيد' : 'e.g., Chest + Bi + split — good form'}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors duration-200 text-sm resize-none"
                  />
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                    {locale === 'ar' ? '📅 التاريخ بيتسجل تلقائياً — سيظهر في سجل العضو' : '📅 Date auto-recorded — visible in member log'}
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

      {/*  مودال تسجيل سبب عدم الاشتراك في PT */}
      {conversionPopup.show && conversionPopup.member && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 ring-1 ring-gray-200 dark:ring-gray-700">
            <div className="text-center mb-5">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                <svg {...stroke} className="w-7 h-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                {locale === 'ar' ? 'سبب عدم الاشتراك في PT' : 'Reason for not subscribing to PT'}
              </h3>
              <p className="font-bold text-gray-700 dark:text-gray-300">{conversionPopup.member.name}</p>
            </div>

            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              {locale === 'ar' ? 'اكتب السبب' : 'Write the reason'}
            </label>
            <textarea
              value={conversionPopup.note}
              onChange={(e) => setConversionPopup(prev => ({ ...prev, note: e.target.value }))}
              rows={4}
              placeholder={locale === 'ar' ? 'مثلاً: السعر مرتفع · معتقدش انه محتاج · المواعيد مش مناسبة' : 'e.g., Price too high · Not interested · Schedule conflict'}
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors duration-200 text-sm resize-none"
            />
            {conversionPopup.error && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{conversionPopup.error}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setConversionPopup({ show: false, member: null, note: '', saving: false, error: '' })}
                disabled={conversionPopup.saving}
                className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2.5 rounded-lg font-bold transition-colors disabled:opacity-60"
              >
                {locale === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={saveConversionNote}
                disabled={!conversionPopup.note.trim() || conversionPopup.saving}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-lg font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {conversionPopup.saving
                  ? (locale === 'ar' ? 'جاري الحفظ...' : 'Saving...')
                  : (locale === 'ar' ? 'حفظ' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/*  مودال عرض سجل الجلسات */}
      {historyPopup && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={() => setHistoryPopup(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 ring-1 ring-gray-200 dark:ring-gray-700 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 flex items-center justify-center">
                  <svg {...stroke} className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {locale === 'ar' ? 'سجل الجلسات' : 'Sessions Log'}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{historyPopup.name}</p>
                </div>
              </div>
              <button
                onClick={() => setHistoryPopup(null)}
                className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 flex items-center justify-center transition-colors"
                aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {historyPopup.ptSessions.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                {locale === 'ar' ? 'لا توجد جلسات مسجلة' : 'No sessions yet'}
              </p>
            ) : (
              <div className="space-y-3">
                {historyPopup.ptSessions.map((s) => (
                  <div
                    key={s.id}
                    className={`rounded-lg p-3 ring-1 ${
                      s.isFreeSession
                        ? 'bg-purple-50 dark:bg-purple-900/20 ring-purple-200 dark:ring-purple-800'
                        : 'bg-blue-50 dark:bg-blue-900/20 ring-blue-200 dark:ring-blue-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        s.isFreeSession
                          ? 'bg-purple-200 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200'
                          : 'bg-blue-200 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200'
                      }`}>
                        {s.isFreeSession
                          ? (locale === 'ar' ? '🆓 مجانية' : '🆓 Free')
                          : (locale === 'ar' ? '💰 مدفوعة' : '💰 Paid')}
                      </span>
                      <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                        {new Date(s.sessionDate).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', {
                          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {s.notes ? (
                      <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{s.notes}</p>
                    ) : (
                      <p className="text-xs text-gray-400 italic">{locale === 'ar' ? 'بدون ملاحظات' : 'No notes'}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/*  مودال تكبير صورة العميل */}
      {enlargedImage && (
        <div
          className="fixed inset-0 z-[10001] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4"
          onClick={() => setEnlargedImage(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setEnlargedImage(null)}
            className="absolute top-4 end-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
            aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="max-w-2xl w-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={enlargedImage.url}
              alt={enlargedImage.name}
              className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl"
            />
            <div className="mt-4 px-5 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white text-lg font-bold">
              {enlargedImage.name}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

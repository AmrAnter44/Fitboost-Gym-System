'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../contexts/LanguageContext'
import { useDebounce } from '../hooks/useDebounce'

type MemberHit = {
  kind: 'member'
  id: string
  name: string
  phone: string
  memberNumber: string | null
  expiryDate: string | null
  isActive: boolean
  startDate: string | null
}

type VisitorHit = {
  kind: 'visitor'
  id: string
  name: string
  phone: string
  source: string | null
  status: string | null
}

type DayUseHit = {
  kind: 'dayuse'
  id: string
  name: string
  phone: string
  createdAt: string | null
  type: string | null
}

type Hit = MemberHit | VisitorHit | DayUseHit

const normalize = (s: string) => s.trim().toLowerCase()

function isMemberActiveNow(m: { isActive: boolean; startDate: string | null; expiryDate: string | null }): boolean {
  if (!m.isActive) return false
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const start = m.startDate ? new Date(m.startDate) : null
  if (start) start.setHours(0, 0, 0, 0)
  const expiry = m.expiryDate ? new Date(m.expiryDate) : null
  if (expiry) expiry.setHours(0, 0, 0, 0)
  const started = !start || start <= today
  const notExpired = expiry !== null && expiry >= today
  return started && notExpired
}

function daysLeft(exp: string | null): number | null {
  if (!exp) return null
  const d = new Date(exp); d.setHours(0, 0, 0, 0)
  const t = new Date(); t.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24))
}

export default function DashboardSmartSearch() {
  const router = useRouter()
  const { locale } = useLanguage()
  const ar = locale === 'ar'

  const [query, setQuery] = useState('')
  const debounced = useDebounce(query, 250)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const boxRef = useRef<HTMLDivElement | null>(null)

  const [members, setMembers] = useState<MemberHit[]>([])
  const [visitors, setVisitors] = useState<VisitorHit[]>([])
  const [dayUses, setDayUses] = useState<DayUseHit[]>([])
  const [loading, setLoading] = useState(false)

  //  جلب كل المصادر مرة واحدة (cached client-side)
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [mRes, vRes, dRes] = await Promise.allSettled([
          fetch('/api/members', { credentials: 'include' }),
          fetch('/api/visitors', { credentials: 'include' }),
          fetch('/api/dayuse', { credentials: 'include' }),
        ])
        if (cancelled) return
        if (mRes.status === 'fulfilled' && mRes.value.ok) {
          const data = await mRes.value.json()
          const arr: any[] = Array.isArray(data) ? data : (data?.members || data?.data || [])
          setMembers(arr.map((m: any) => ({
            kind: 'member' as const,
            id: String(m.id),
            name: m.name || '',
            phone: m.phone || '',
            memberNumber: m.memberNumber != null ? String(m.memberNumber) : null,
            expiryDate: m.expiryDate || null,
            isActive: !!m.isActive,
            startDate: m.startDate || null,
          })))
        }
        if (vRes.status === 'fulfilled' && vRes.value.ok) {
          const data = await vRes.value.json()
          const arr: any[] = Array.isArray(data) ? data : (data?.visitors || data?.data || [])
          setVisitors(arr.map((v: any) => ({
            kind: 'visitor' as const,
            id: String(v.id),
            name: v.name || '',
            phone: v.phone || '',
            source: v.source || null,
            status: v.status || null,
          })))
        }
        if (dRes.status === 'fulfilled' && dRes.value.ok) {
          const data = await dRes.value.json()
          const arr: any[] = Array.isArray(data) ? data : (data?.dayUses || data?.data || [])
          setDayUses(arr.map((d: any) => ({
            kind: 'dayuse' as const,
            id: String(d.id),
            name: d.name || d.clientName || '',
            phone: d.phone || '',
            createdAt: d.createdAt || d.date || null,
            type: d.type || null,
          })))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  //  الفلتر الذكي — Member أولاً، Visitor تاني، DayUse تالت
  const results = useMemo<Hit[]>(() => {
    const q = debounced.trim()
    if (!q) return []
    const isNumeric = /^\d+$/.test(q)
    const qNorm = normalize(q)

    const matchName = (n: string) => normalize(n).includes(qNorm)
    const matchPhone = (p: string) => p.includes(q)
    const matchMemberNum = (mn: string | null) => {
      if (!isNumeric || !mn) return false
      if (mn === q) return true
      const a = parseInt(mn, 10); const b = parseInt(q, 10)
      return !Number.isNaN(a) && !Number.isNaN(b) && a === b
    }

    const memberHits = members.filter(m =>
      matchMemberNum(m.memberNumber) || matchName(m.name) || (isNumeric && matchPhone(m.phone))
    )
    const visitorHits = visitors.filter(v =>
      matchName(v.name) || (isNumeric && matchPhone(v.phone))
    )
    const dayUseHits = dayUses.filter(d =>
      matchName(d.name) || (isNumeric && matchPhone(d.phone))
    )

    return [
      ...memberHits.slice(0, 8),
      ...visitorHits.slice(0, 5),
      ...dayUseHits.slice(0, 5),
    ]
  }, [debounced, members, visitors, dayUses])

  //  لو مفيش نتائج والـ query بيشبه تليفون، اعرض "إضافة جديد"
  const showAddNew = useMemo(() => {
    if (!debounced.trim() || results.length > 0) return false
    return /^\d{6,}$/.test(debounced.trim()) || debounced.trim().length >= 3
  }, [debounced, results.length])

  //  قفل القائمة لما يضغط برّه
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!boxRef.current) return
      if (!boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => { setActiveIdx(0) }, [debounced])

  function go(href: string) {
    setOpen(false)
    setQuery('')
    router.push(href)
  }

  function handleHitPrimary(hit: Hit) {
    if (hit.kind === 'member') {
      // expired → renew action; active → view
      const active = isMemberActiveNow(hit)
      go(`/members/${hit.id}${active ? '' : '?action=renew'}`)
    } else if (hit.kind === 'visitor') {
      go(`/followups?visitor=${encodeURIComponent(hit.id)}`)
    } else {
      go(`/dayuse`)
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return
    const total = results.length + (showAddNew ? 1 : 0)
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, total - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (showAddNew && activeIdx === results.length) {
        const qNumeric = /^\d+$/.test(debounced.trim())
        go(`/members?action=new${qNumeric ? `&prefillPhone=${encodeURIComponent(debounced.trim())}` : `&prefillName=${encodeURIComponent(debounced.trim())}`}`)
      } else if (results[activeIdx]) {
        handleHitPrimary(results[activeIdx])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={boxRef} className="relative mb-6">
      {/* الـ Input */}
      <div className="relative">
        <span className={`absolute inset-y-0 ${ar ? 'right-4' : 'left-4'} flex items-center text-primary-500 dark:text-primary-400 pointer-events-none`}>
          <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          className={`w-full ${ar ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-3.5 rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 focus:ring-4 focus:ring-primary-500/10 shadow-sm text-base font-medium transition-all`}
          placeholder={ar ? '🔍 بحث ذكي — رقم، اسم، أو تليفون...' : '🔍 Smart search — number, name, or phone...'}
          dir={ar ? 'rtl' : 'ltr'}
          aria-label={ar ? 'بحث ذكي' : 'Smart search'}
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setOpen(false) }}
            aria-label={ar ? 'مسح' : 'Clear'}
            className={`absolute inset-y-0 ${ar ? 'left-4' : 'right-4'} flex items-center text-gray-400 hover:text-red-500 transition-colors`}
          >
            <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/*  Dropdown النتائج */}
      {open && debounced.trim() && (
        <div className="absolute top-full inset-x-0 mt-2 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 max-h-[70vh] overflow-y-auto z-50">
          {loading && results.length === 0 && (
            <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {ar ? 'جارٍ التحميل...' : 'Loading...'}
            </div>
          )}

          {!loading && results.length === 0 && !showAddNew && (
            <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
              {ar ? 'لا يوجد نتائج' : 'No results'}
            </div>
          )}

          {results.length > 0 && (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700/50" role="listbox">
              {results.map((hit, idx) => (
                <li
                  key={`${hit.kind}-${hit.id}`}
                  role="option"
                  aria-selected={activeIdx === idx}
                  className={`p-3 flex items-center gap-3 cursor-pointer transition-colors ${
                    activeIdx === idx ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                  onMouseEnter={() => setActiveIdx(idx)}
                >
                  {/* Avatar/Icon by kind */}
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    hit.kind === 'member'
                      ? isMemberActiveNow(hit) ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      : hit.kind === 'visitor' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                  }`}>
                    {hit.kind === 'member' ? (
                      <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
                    ) : hit.kind === 'visitor' ? (
                      <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" /></svg>
                    ) : (
                      <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25" /></svg>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1" onClick={() => handleHitPrimary(hit)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 dark:text-gray-100 truncate">{hit.name || (ar ? 'بدون اسم' : 'No name')}</span>
                      {hit.kind === 'member' && hit.memberNumber && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">#{hit.memberNumber}</span>
                      )}
                      {hit.kind === 'member' && (() => {
                        const active = isMemberActiveNow(hit)
                        const dl = daysLeft(hit.expiryDate)
                        if (active) {
                          return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">{ar ? `نشط · ${dl} يوم` : `Active · ${dl}d`}</span>
                        }
                        return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">{ar ? 'منتهي' : 'Expired'}</span>
                      })()}
                      {hit.kind === 'visitor' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">{ar ? 'زائر' : 'Visitor'}</span>
                      )}
                      {hit.kind === 'dayuse' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">{ar ? 'استخدام يومي' : 'Day Use'}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate" dir="ltr">
                      {hit.phone || '—'}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {hit.kind === 'member' && !isMemberActiveNow(hit) && (
                      <Link
                        href={`/members/${hit.id}?action=renew`}
                        onClick={() => { setOpen(false); setQuery('') }}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-primary-contrast transition-colors"
                      >
                        {ar ? 'تجديد' : 'Renew'}
                      </Link>
                    )}
                    {hit.kind === 'member' && isMemberActiveNow(hit) && (
                      <Link
                        href={`/members/${hit.id}`}
                        onClick={() => { setOpen(false); setQuery('') }}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
                      >
                        {ar ? 'عرض' : 'View'}
                      </Link>
                    )}
                    {hit.kind === 'visitor' && (
                      <Link
                        href={`/members?action=new&prefillName=${encodeURIComponent(hit.name)}&prefillPhone=${encodeURIComponent(hit.phone)}`}
                        onClick={() => { setOpen(false); setQuery('') }}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                      >
                        {ar ? 'اشتراك' : 'Subscribe'}
                      </Link>
                    )}
                    {hit.kind === 'dayuse' && (
                      <Link
                        href={`/members?action=new&prefillName=${encodeURIComponent(hit.name)}&prefillPhone=${encodeURIComponent(hit.phone)}`}
                        onClick={() => { setOpen(false); setQuery('') }}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                      >
                        {ar ? 'اشتراك' : 'Subscribe'}
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {showAddNew && (
            <Link
              href={`/members?action=new${/^\d+$/.test(debounced.trim()) ? `&prefillPhone=${encodeURIComponent(debounced.trim())}` : `&prefillName=${encodeURIComponent(debounced.trim())}`}`}
              onClick={() => { setOpen(false); setQuery('') }}
              onMouseEnter={() => setActiveIdx(results.length)}
              className={`flex items-center gap-3 p-4 border-t border-gray-100 dark:border-gray-700/50 transition-colors ${
                activeIdx === results.length ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-emerald-50/60 dark:hover:bg-emerald-900/10'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <svg fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-emerald-700 dark:text-emerald-300">{ar ? 'اشتراك جديد' : 'Quick Subscribe'}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate" dir="ltr">{debounced.trim()}</div>
              </div>
              <span className="text-xs text-emerald-700 dark:text-emerald-300 font-bold shrink-0">{ar ? 'إضافة ←' : 'Add →'}</span>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

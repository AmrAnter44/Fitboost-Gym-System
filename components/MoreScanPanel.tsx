'use client'

import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { formatDateYMD } from '../lib/dateFormatter'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

type Status = 'attended' | 'already' | 'no-sessions' | 'expired' | 'not-started' | 'blocked' | 'not-found'

interface ScanCard {
  found: boolean
  status: Status
  clientName?: string
  coachName?: string
  moreNumber?: number
  phone?: string
  expiryDate?: string
  sessionsPurchased?: number
  sessionsRemaining?: number
  errorMsg?: string
}

//  لوحة سكان المزيد — تُستخدم في صفحة /more/scan وفي المودال العائم
export default function MoreScanPanel({ autoFocus = true }: { autoFocus?: boolean }) {
  const { locale } = useLanguage()
  const ar = locale === 'ar'
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [cards, setCards] = useState<(ScanCard & { id: number })[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<AudioContext | null>(null)
  const CARD_TTL_MS = 40000

  useEffect(() => { if (autoFocus) inputRef.current?.focus() }, [autoFocus])

  const beep = (kind: 'ok' | 'warn' | 'err') => {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext
      if (!AC) return
      if (!audioRef.current) audioRef.current = new AC()
      const ctx = audioRef.current
      if (ctx.state === 'suspended') ctx.resume()
      const play = (freq: number, start: number, dur: number, type: OscillatorType = 'sine') => {
        const o = ctx.createOscillator(); const g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.type = type; o.frequency.value = freq
        const t0 = ctx.currentTime + start
        g.gain.setValueAtTime(0.0001, t0)
        g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.01)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
        o.start(t0); o.stop(t0 + dur + 0.02)
      }
      if (kind === 'ok') { play(880, 0, 0.28); play(1320, 0.26, 0.4) }
      else if (kind === 'warn') { play(620, 0, 0.55, 'triangle') }
      else { play(240, 0, 0.4, 'sawtooth'); play(200, 0.42, 0.45, 'sawtooth') }
    } catch { /* ignore */ }
  }

  const pushCard = (c: ScanCard) => {
    const id = Date.now() + Math.random()
    const kind: 'ok' | 'warn' | 'err' = !c.found ? 'err'
      : c.status === 'attended' ? 'ok'
      : (c.status === 'already' || c.status === 'not-started') ? 'warn' : 'err'
    beep(kind)
    setCards(prev => [{ ...c, id }, ...prev])
    setTimeout(() => setCards(prev => prev.filter(x => x.id !== id)), CARD_TTL_MS)
  }

  const submit = async (value: string) => {
    const p = value.replace(/\D/g, '')
    if (!p) return
    setBusy(true)
    try {
      const res = await fetch('/api/more/scan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: p }),
      })
      const data = await res.json()
      if (data.found) pushCard({ ...data })
      else pushCard({ found: false, status: 'not-found', errorMsg: data.error || (ar ? 'مش موجود' : 'Not found') })
    } catch {
      pushCard({ found: false, status: 'not-found', errorMsg: ar ? 'حدث خطأ في الاتصال' : 'Connection error' })
    } finally {
      setBusy(false); setPhone('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const tone = (s: Status): 'green' | 'amber' | 'red' =>
    s === 'attended' ? 'green' : (s === 'already' || s === 'not-started') ? 'amber' : 'red'
  const statusText = (s: Status): string => {
    if (ar) return ({
      attended: 'تم تسجيل الحضور وخصم حصة ✅', already: 'مسجّل حضوره النهاردة بالفعل — مفيش خصم',
      'no-sessions': 'خلصت الحصص — لازم يجدد', expired: 'الاشتراك منتهي — لازم يجدد',
      'not-started': 'الاشتراك لسه ما بدأش', blocked: 'الاشتراك موقوف', 'not-found': 'مفيش اشتراك بالرقم ده',
    } as Record<Status, string>)[s]
    return ({
      attended: 'Checked in — 1 session deducted ✅', already: 'Already attended today — no deduction',
      'no-sessions': 'No sessions left', expired: 'Expired', 'not-started': 'Not started yet',
      blocked: 'Blocked', 'not-found': 'No subscription for this phone',
    } as Record<Status, string>)[s]
  }

  return (
    <div dir={ar ? 'rtl' : 'ltr'}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
        {/*  تنبيه: الاسكان بيخصم مرة واحدة */}
        <div className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-800 rounded-lg px-3 py-1.5">
          <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {ar ? 'الاسكان بيخصم حصة مرة واحدة في اليوم' : 'Scan deducts one session per day'}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); submit(phone) }}>
          <input
            ref={inputRef} type="text" inputMode="numeric" value={phone}
            onChange={(e) => setPhone(e.target.value)} disabled={busy}
            placeholder={ar ? 'امسح الباركود هنا...' : 'Scan barcode here...'}
            className="w-full h-14 px-4 rounded-lg border-2 border-primary-300 dark:border-primary-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-lg text-center font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            dir="ltr"
          />
          <button type="submit" disabled={busy || !phone}
            className="mt-3 w-full h-12 bg-primary-600 hover:bg-primary-700 text-primary-contrast font-bold rounded-lg transition-colors disabled:opacity-60">
            {busy ? (ar ? 'جاري...' : 'Working...') : (ar ? 'تسجيل الحضور' : 'Record attendance')}
          </button>
        </form>
      </div>

      <div className="mt-4 space-y-3 max-h-[55vh] overflow-y-auto">
        {cards.map((card) => card.found ? (() => {
          const t = tone(card.status)
          const badgeBg = t === 'green' ? 'bg-emerald-500' : t === 'amber' ? 'bg-amber-500' : 'bg-red-500'
          const accent = t === 'green' ? 'border-emerald-500' : t === 'amber' ? 'border-amber-500' : 'border-red-500'
          return (
            <div key={card.id} className={`rounded-2xl p-5 bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 border-s-4 ${accent} shadow-sm animate-modal-in`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-2xl font-black flex-shrink-0">
                  {(card.clientName || '?').charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xl font-black text-gray-900 dark:text-gray-100 truncate">{card.clientName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">#{card.moreNumber} · {card.coachName}</p>
                </div>
              </div>
              <div className={`inline-flex items-center gap-1.5 ${badgeBg} text-white text-sm font-bold px-3 py-1.5 rounded-lg mb-3`}>
                {statusText(card.status)}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{ar ? 'الحصص المتبقية' : 'Sessions left'}</p>
                  <p className={`text-2xl font-black ${(card.sessionsRemaining ?? 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {card.sessionsRemaining} <span className="text-sm text-gray-400">/ {card.sessionsPurchased}</span>
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{ar ? 'تاريخ الانتهاء' : 'Expiry'}</p>
                  <p className="text-base font-bold text-gray-800 dark:text-gray-100 font-mono">{card.expiryDate ? formatDateYMD(card.expiryDate) : '-'}</p>
                </div>
              </div>
            </div>
          )
        })() : (
          <div key={card.id} className="rounded-xl p-4 ring-1 bg-red-50 dark:bg-red-900/20 ring-red-200 dark:ring-red-800 flex items-center gap-2 animate-modal-in">
            <svg className="w-7 h-7 text-red-600 dark:text-red-400 flex-shrink-0" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>
            <p className="font-black text-lg text-red-800 dark:text-red-200">{card.errorMsg}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

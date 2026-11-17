'use client'

// ⬇️ كارت داون جريد في بروفايل العضو — بيظهر بس لما الشروط تتحقق
//  (عليه باقي + عدّى ميعاده) — حتى لو الاشتراك منتهي
import { useEffect, useState } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useToast } from '@/contexts/ToastContext'

interface Opt { id: string; name: string; price: number; duration: number; icon?: string }
interface Info { eligible: boolean; paid: number; remaining: number; calls: number; options: Opt[]; suggested: Opt | null; remainingDueDate: string | null }

export default function MemberDowngradeCard({ memberId, startDate, expiryDate, refreshKey, onDone }: { memberId: string; startDate?: string | null; expiryDate?: string | null; refreshKey?: unknown; onDone: () => void }) {
  const { tr, locale } = useLanguage()
  const toast = useToast()
  const [info, setInfo] = useState<Info | null>(null)
  const [open, setOpen] = useState(false)
  const [offerId, setOfferId] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`/api/members/downgrade?memberId=${encodeURIComponent(memberId)}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive) setInfo(d) })
      .catch(() => alive && setInfo(null))
    return () => { alive = false }
  }, [memberId, refreshKey])

  if (!info?.eligible || !info.suggested) return null

  const money = (n: number) => `${Math.round(n).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US')} ${tr('ج.م', 'EGP')}`
  const chosen = info.options.find(o => o.id === offerId) || info.suggested
  //  نفس حساب السيرفر: مايطوّلش الاشتراك عن انتهائه القديم
  const newExpiry = startDate ? (() => {
    const d = new Date(startDate); d.setDate(d.getDate() + chosen.duration)
    return expiryDate && new Date(expiryDate) < d ? new Date(expiryDate) : d
  })() : null
  const expiresNow = !!newExpiry && newExpiry < new Date(new Date().setHours(0, 0, 0, 0))

  const submit = async () => {
    setBusy(true)
    try {
      const r = await fetch('/api/members/downgrade', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, offerId: chosen.id }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) return toast.error(d.error || tr('فشل الداون جريد', 'Downgrade failed'))
      toast.success(tr(`اتعمل داون جريد لـ ${d.newPackage} — إيصال #${d.receiptNumber}`, `Downgraded to ${d.newPackage} — receipt #${d.receiptNumber}`))
      setOpen(false); onDone()
    } finally { setBusy(false) }
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 border-s-4 border-rose-500">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-600 dark:text-white font-semibold truncate">{tr('داون جريد', 'Downgrade')}</p>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2 min-h-[2rem]">
          {tr(`عليه ${money(info.remaining)} وعدّى ميعاده`, `Owes ${money(info.remaining)}, overdue`)}
        </p>
        <button onClick={() => { setOfferId(info.suggested!.id); setOpen(true) }}
          className="w-full bg-rose-600 text-white text-xs py-1.5 rounded hover:bg-rose-700 font-bold">
          {tr('داون جريد', 'Downgrade')}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{tr('داون جريد للباقة', 'Downgrade package')}</h3>

            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                [tr('دفع', 'Paid'), money(info.paid), 'text-emerald-600 dark:text-emerald-400'],
                [tr('عليه', 'Owes'), money(info.remaining), 'text-red-600 dark:text-red-400'],
                [tr('كولات', 'Calls'), String(info.calls), 'text-gray-900 dark:text-white'],
              ].map(([l, v, c]) => (
                <div key={l} className="rounded-lg bg-gray-50 dark:bg-gray-900/40 py-2">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">{l}</p>
                  <p className={`text-sm font-bold ${c}`}>{v}</p>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{tr('الباقة الجديدة', 'New package')}</label>
              <select value={chosen.id} onChange={e => setOfferId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                {info.options.map((o, i) => (
                  <option key={o.id} value={o.id}>
                    {o.name} — {money(o.price)} · {o.duration} {tr('يوم', 'days')}{i === 0 ? tr(' (الأقرب)', ' (closest)') : ''}
                  </option>
                ))}
              </select>
            </div>

            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 list-disc ps-5">
              <li>{tr(`الباقي (${money(info.remaining)}) هيتشال من عليه`, `The remaining ${money(info.remaining)} is waived`)}</li>
              {newExpiry && (
                <li className={expiresNow ? 'text-red-600 dark:text-red-400 font-bold' : ''}>
                  {tr('الاشتراك هينتهي', 'Subscription ends')} {newExpiry.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB')}
                  {expiresNow && tr(' — منتهي', ' — expired')}
                </li>
              )}
              <li>{tr('المميزات (حصص/دعوات/فريز) هتتقل لحدود الباقة الجديدة', 'Perks are capped to the new package')}</li>
              <li>{tr('هيتعمل إيصال بصفر للسجل', 'A zero-amount receipt is recorded')}</li>
            </ul>

            <div className="flex gap-2">
              <button onClick={submit} disabled={busy} className="flex-1 min-h-[44px] rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold disabled:opacity-60">
                {busy ? tr('جارٍ التنفيذ...', 'Working...') : tr('تأكيد الداون جريد', 'Confirm downgrade')}
              </button>
              <button onClick={() => setOpen(false)} disabled={busy} className="px-4 min-h-[44px] rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold">
                {tr('إلغاء', 'Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

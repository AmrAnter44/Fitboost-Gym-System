'use client'

/**
 * «تفعيل بحساب FitBoost» — ربط جهاز جديد بحساب Control super admin:
 * إيميل + باسورد ← كود التحقق (Ente Auth) ← اختيار الجيم والفرع ← تفعيل.
 * مستخدم في الإعدادات ← الترخيص، وفي صفحة الدخول لما الجهاز يكون لسه مش مربوط.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

type Gym = { id: string; name: string; branches: { id: string; name: string }[] }
export type FitboostActivateLicense = {
  gymId: string
  gymName: string
  branchId: string
  branchName: string
  systemLicense: string
  linked: true
}
export type FitboostActivateDone = { license: FitboostActivateLicense; user?: { role?: string } }

type Props = {
  initialEmail?: string
  initialPassword?: string
  /** true → بعد التفعيل السيستم يدخّلك FitBoost Admin على طول (صفحة الدخول) */
  login?: boolean
  /** يبعت الإيميل والباسورد أوتوماتيك أول ما يتفتح (لو الاتنين موجودين) */
  autoStart?: boolean
  onDone: (r: FitboostActivateDone) => void
  onCancel?: () => void
}

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm'
const btnCls =
  'w-full inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold py-2.5 rounded-lg transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed text-sm'

export default function FitboostActivate({ initialEmail = '', initialPassword = '', login, autoStart, onDone, onCancel }: Props) {
  const { tr } = useLanguage()
  const [step, setStep] = useState<'creds' | 'code' | 'pick'>('creds')
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState(initialPassword)
  const [code, setCode] = useState('')
  const [ticket, setTicket] = useState('')
  const [gyms, setGyms] = useState<Gym[]>([])
  const [gymId, setGymId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const started = useRef(false)

  const call = async (payload: Record<string, unknown>) => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/license/admin-activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.code === 'BAD_TICKET') {
          setStep('creds')
          setTicket('')
          setCode('')
        } else if (data.code === 'BAD_CODE') {
          setCode('')
        }
        setError(data.error || tr('فشل التفعيل', 'Activation failed'))
        return null
      }
      return data
    } catch {
      setError(tr('مفيش اتصال — حاول تاني', 'Connection error — try again'))
      return null
    } finally {
      setBusy(false)
    }
  }

  const sendCreds = async () => {
    if (!email.includes('@') || !password) return
    const d = await call({ email, password })
    if (d?.step === 'code') { setCode(''); setStep('code') }
  }

  const sendCode = async () => {
    if (code.length !== 6) return
    const d = await call({ email, password, code })
    if (d?.step === 'pick') {
      setTicket(d.ticket)
      setGyms(d.gyms || [])
      setGymId('')
      setBranchId('')
      setQ('')
      setStep('pick')
    }
  }

  const activate = async () => {
    if (!ticket || !gymId || !branchId) return
    const d = await call({ ticket, gymId, branchId, login: !!login })
    if (d?.success) {
      setPassword('')
      onDone({ license: d.license, user: d.user })
    }
  }

  useEffect(() => {
    if (autoStart && !started.current && initialEmail.includes('@') && initialPassword) {
      started.current = true
      sendCreds()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const gym = gyms.find((g) => g.id === gymId)
  const norm = (s: string) => s.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
  const filteredGyms = useMemo(() => {
    const n = norm(q.trim())
    if (!n) return gyms
    return gyms.filter((g) => norm(g.name).includes(n) || g.branches.some((b) => norm(b.name).includes(n)))
  }, [gyms, q])

  const pickGym = (g: Gym) => {
    setGymId(g.id)
    setBranchId(g.branches.length === 1 ? g.branches[0].id : '')
  }

  return (
    <div className="space-y-3" dir="rtl">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 ring-1 ring-red-200 dark:ring-red-900/50 text-red-700 dark:text-red-300 p-2.5 rounded-lg text-sm" role="alert">
          {error}
        </div>
      )}

      {step === 'creds' && (
        <form onSubmit={(e) => { e.preventDefault(); sendCreds() }} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={tr('إيميل حساب FitBoost (Control)', 'FitBoost (Control) account email')}
            dir="ltr"
            autoComplete="username"
            className={inputCls}
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={tr('الباسورد', 'Password')}
            dir="ltr"
            autoComplete="current-password"
            className={inputCls}
            required
          />
          <button type="submit" disabled={busy || !email.includes('@') || !password} className={btnCls}>
            {busy ? tr('جاري التحقق...', 'Checking...') : tr('متابعة', 'Continue')}
          </button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={(e) => { e.preventDefault(); sendCode() }} className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {tr('كود التحقق (من تطبيق الـ Authenticator)', 'Verification code (from your Authenticator app)')}
          </label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            dir="ltr"
            maxLength={6}
            placeholder="••••••"
            className={`${inputCls} text-center font-mono text-xl tracking-[0.5em] py-2.5`}
          />
          <button type="submit" disabled={busy || code.length !== 6} className={btnCls}>
            {busy ? tr('جاري التحقق...', 'Checking...') : tr('تأكيد', 'Verify')}
          </button>
          <button type="button" onClick={() => { setStep('creds'); setCode(''); setError('') }} className="text-xs text-gray-500 hover:text-primary-600">
            {tr('رجوع', 'Back')}
          </button>
        </form>
      )}

      {step === 'pick' && (
        <div className="space-y-3">
          {!gym ? (
            <>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{tr('اختار الجيم', 'Choose the gym')}</p>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tr('دوّر على الجيم أو الفرع...', 'Search gym or branch...')}
                autoFocus
                className={inputCls}
              />
              <div className="max-h-60 overflow-y-auto rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                {filteredGyms.length === 0 ? (
                  <p className="p-3 text-sm text-gray-500">{tr('مفيش نتايج', 'No results')}</p>
                ) : (
                  filteredGyms.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => pickGym(g)}
                      className="w-full text-start px-3 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-primary-50 dark:hover:bg-gray-700 flex justify-between gap-2"
                    >
                      <span className="font-medium truncate">{g.name}</span>
                      <span className="text-xs text-gray-500 shrink-0">{g.branches.length} {tr('فرع', 'branches')}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{gym.name}</p>
                <button type="button" onClick={() => { setGymId(''); setBranchId('') }} className="text-xs text-primary-600 hover:underline shrink-0">
                  {tr('غيّر الجيم', 'Change gym')}
                </button>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">{tr('اختار الفرع', 'Choose the branch')}</p>
              <div className="max-h-48 overflow-y-auto rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                {gym.branches.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBranchId(b.id)}
                    className={`w-full text-start px-3 py-2 text-sm flex items-center justify-between ${
                      branchId === b.id
                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-bold'
                        : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="truncate">{b.name}</span>
                    {branchId === b.id && <span aria-hidden="true">✓</span>}
                  </button>
                ))}
              </div>
              <button type="button" onClick={activate} disabled={busy || !branchId} className={btnCls}>
                {busy ? tr('جاري التفعيل...', 'Activating...') : tr('تفعيل', 'Activate')}
              </button>
            </>
          )}
          <p className="text-[11px] text-gray-500">{tr('الاختيار متاح ١٠ دقايق — بعدها هتبدأ من الأول.', 'You have 10 minutes to choose — after that, start over.')}</p>
        </div>
      )}

      {onCancel && (
        <button type="button" onClick={onCancel} className="text-xs text-gray-500 hover:text-primary-600">
          {tr('إلغاء', 'Cancel')}
        </button>
      )}
    </div>
  )
}

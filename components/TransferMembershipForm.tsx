'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { useServiceSettings } from '../contexts/ServiceSettingsContext'
import { usePermissions } from '../hooks/usePermissions'
import { calculateRemainingDays, formatDateYMD } from '../lib/dateFormatter'
import Paymentmethodselector from './Paymentmethodselector'
import ImageUpload from './ImageUpload'
import type { PaymentMethod } from '../lib/paymentHelpers'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface Member {
  id: string
  memberNumber: string | null
  name: string
  phone: string
  expiryDate?: string | Date
  startDate?: string | Date
  isActive?: boolean
  isBanned?: boolean
  points?: number
}

interface RecipientLookup {
  id: string
  memberNumber: string | null
  name: string
  phone: string
  expiryDate?: string | null
  isActive: boolean
  isBanned: boolean
}

interface TransferReceipt {
  id?: string
  receiptNumber: number
  amount: number
  paymentMethod: string
  staffName?: string
  itemDetails: any
  createdAt: string
}

interface TransferResult {
  success: boolean
  transferredDays: number
  recipient: {
    id: string
    name: string
    memberNumber: string | null
    phone: string
    isNew: boolean
  }
  receipt: TransferReceipt
}

interface Props {
  member: Member
  onClose: () => void
  onSuccess: (res: TransferResult) => void
}

export default function TransferMembershipForm({ member, onClose, onSuccess }: Props) {
  const { locale, direction, t } = useLanguage()
  const { settings } = useServiceSettings()
  const { user } = usePermissions()

  const remainingDays = calculateRemainingDays(member.expiryDate as any) ?? 0

  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [transferFee, setTransferFee] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<string | PaymentMethod[]>('cash')

  const [recipientNumber, setRecipientNumber] = useState('')
  const [recipientLoading, setRecipientLoading] = useState(false)
  const [recipient, setRecipient] = useState<RecipientLookup | null>(null)
  const [recipientErr, setRecipientErr] = useState('')

  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [profileImage, setProfileImage] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (mode !== 'existing') return
    const num = recipientNumber.trim()
    if (!num) {
      setRecipient(null)
      setRecipientErr('')
      return
    }
    const ctl = new AbortController()
    setRecipientLoading(true)
    setRecipientErr('')
    fetch(`/api/members?memberNumber=${encodeURIComponent(num)}`, { signal: ctl.signal })
      .then(r => r.ok ? r.json() : [])
      .then((arr: any[]) => {
        const found = Array.isArray(arr) ? arr[0] : null
        if (!found) {
          setRecipient(null)
          setRecipientErr(locale === 'ar' ? 'رقم العضوية غير موجود' : 'Member number not found')
          return
        }
        if (found.id === member.id) {
          setRecipient(null)
          setRecipientErr(locale === 'ar' ? 'لا يمكن نقل العضوية لنفس العضو' : 'Cannot transfer to the same member')
          return
        }
        setRecipient({
          id: found.id,
          memberNumber: found.memberNumber,
          name: found.name,
          phone: found.phone,
          expiryDate: found.expiryDate,
          isActive: !!found.isActive,
          isBanned: !!found.isBanned,
        })
      })
      .catch(err => {
        if (err.name === 'AbortError') return
        setRecipient(null)
        setRecipientErr(locale === 'ar' ? 'خطأ في البحث' : 'Lookup failed')
      })
      .finally(() => setRecipientLoading(false))

    return () => ctl.abort()
  }, [recipientNumber, mode, member.id, locale])

  const recipientExpiryAfter = (() => {
    if (mode !== 'existing' || !recipient) return null
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const cur = recipient.expiryDate ? new Date(recipient.expiryDate) : null
    if (cur) cur.setHours(0, 0, 0, 0)
    const base = cur && cur > today ? cur : today
    const after = new Date(base)
    after.setDate(after.getDate() + remainingDays)
    return after
  })()

  const newRecipientExpiry = (() => {
    if (mode !== 'new') return null
    return member.expiryDate ? new Date(member.expiryDate as any) : null
  })()

  const validate = (): string | null => {
    if (remainingDays <= 0) return locale === 'ar' ? 'لا توجد أيام متبقية للنقل' : 'No remaining days to transfer'
    const fee = parseFloat(transferFee || '0')
    if (isNaN(fee) || fee < 0) return locale === 'ar' ? 'سعر النقل غير صالح' : 'Invalid transfer fee'

    if (mode === 'existing') {
      if (!recipient) return locale === 'ar' ? 'اختر العضو المستلم' : 'Choose recipient member'
      if (recipient.isBanned) return locale === 'ar' ? 'العضو المستلم محظور' : 'Recipient is banned'
    } else {
      if (!newName.trim()) return locale === 'ar' ? 'اسم العضو الجديد مطلوب' : 'Name is required'
      if (!/^(010|011|012|015)[0-9]{8}$/.test(newPhone.trim())) {
        return locale === 'ar' ? 'رقم الهاتف غير صحيح' : 'Invalid phone number'
      }
    }
    return null
  }

  const handleSubmit = async () => {
    setError('')
    const err = validate()
    if (err) { setError(err); return }

    setLoading(true)
    try {
      const fee = parseFloat(transferFee || '0')
      const body: any = {
        fromMemberId: member.id,
        mode,
        transferFee: fee,
        paymentMethod,
        staffName: user?.name || '',
      }
      if (mode === 'existing') {
        body.toMemberId = recipient!.id
      } else {
        body.newMember = {
          name: newName.trim(),
          phone: newPhone.trim(),
          profileImage,
        }
      }
      const res = await fetch('/api/members/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed')
      onSuccess(data)
    } catch (e: any) {
      setError(e?.message || (locale === 'ar' ? 'فشل نقل العضوية' : 'Transfer failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-membership-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg ring-1 ring-gray-200 dark:ring-gray-700 max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8" dir={direction}>
        <div className="flex justify-between items-center mb-5">
          <h2 id="transfer-membership-title" className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <svg className="w-7 h-7 text-orange-500" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span>{locale === 'ar' ? 'نقل عضوية' : 'Transfer Membership'}</span>
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-300 rounded-lg p-1 transition-colors duration-200 disabled:opacity-50"
            aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
          >
            <svg className="w-6 h-6" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/50 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-orange-200 dark:ring-orange-900/50 p-4 mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-orange-700 dark:text-orange-300 font-bold mb-1">
                {locale === 'ar' ? 'العضو المصدر' : 'Source Member'}
              </p>
              <p className="font-bold text-lg text-gray-900 dark:text-gray-100">
                {member.name} {member.memberNumber ? <span className="text-orange-600 dark:text-orange-400">#{member.memberNumber}</span> : null}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">{member.phone}</p>
            </div>
            <div className="text-center bg-gray-50 dark:bg-gray-900/40 rounded-xl px-5 py-3 ring-1 ring-orange-200 dark:ring-orange-900/50">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {locale === 'ar' ? 'الأيام المتبقية' : 'Remaining Days'}
              </p>
              <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{remainingDays}</p>
              {member.expiryDate && (
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                  {locale === 'ar' ? 'ينتهي' : 'Expires'} {formatDateYMD(member.expiryDate as any)}
                </p>
              )}
            </div>
          </div>
          {remainingDays <= 0 && (
            <p className="mt-3 text-sm text-red-700 dark:text-red-300 font-bold flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <span>{locale === 'ar' ? 'الاشتراك منتهي — لا توجد أيام للنقل' : 'Subscription expired — nothing to transfer'}</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            type="button"
            onClick={() => setMode('existing')}
            className={`p-4 rounded-xl ring-1 text-center transition-colors duration-200 ${
              mode === 'existing'
                ? 'ring-green-500 bg-green-50 dark:bg-green-900/20 shadow-sm'
                : 'ring-gray-200 dark:ring-gray-700 bg-white dark:bg-gray-800 hover:ring-green-300 dark:hover:ring-green-700'
            }`}
          >
            <svg className="w-7 h-7 mx-auto mb-1 text-green-600 dark:text-green-400" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            <p className="font-bold text-sm text-gray-900 dark:text-gray-100">
              {locale === 'ar' ? 'عضو داخل الجيم' : 'Existing Member'}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              {locale === 'ar' ? 'نقل لرقم عضوية موجود' : 'Transfer to existing member ID'}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setMode('new')}
            className={`p-4 rounded-xl ring-1 text-center transition-colors duration-200 ${
              mode === 'new'
                ? 'ring-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-sm'
                : 'ring-gray-200 dark:ring-gray-700 bg-white dark:bg-gray-800 hover:ring-purple-300 dark:hover:ring-purple-700'
            }`}
          >
            <svg className="w-7 h-7 mx-auto mb-1 text-purple-600 dark:text-purple-400" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
            <p className="font-bold text-sm text-gray-900 dark:text-gray-100">
              {locale === 'ar' ? 'عضو خارج الجيم' : 'New Person'}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              {locale === 'ar' ? 'إنشاء عضو جديد بالأيام' : 'Create a new member'}
            </p>
          </button>
        </div>

        {mode === 'existing' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 mb-5">
            <label htmlFor="recipient-number" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
              {locale === 'ar' ? 'رقم العضوية المستلم' : 'Recipient Member Number'} *
            </label>
            <input
              id="recipient-number"
              type="text"
              value={recipientNumber}
              onChange={(e) => setRecipientNumber(e.target.value)}
              placeholder={locale === 'ar' ? 'مثل: 1234' : 'e.g. 1234'}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            />
            {recipientLoading && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <svg className="animate-spin w-3 h-3" {...stroke}>
                  <circle className="opacity-25" cx="12" cy="12" r="10" />
                  <path className="opacity-75" d="M4 12a8 8 0 018-8" strokeLinecap="round" />
                </svg>
                <span>{locale === 'ar' ? 'جاري البحث...' : 'Searching...'}</span>
              </p>
            )}
            {recipientErr && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <span>{recipientErr}</span>
              </p>
            )}
            {recipient && (
              <div className="mt-3 bg-white dark:bg-gray-800 ring-1 ring-green-300 dark:ring-green-900/50 rounded-lg p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-gray-900 dark:text-gray-100">
                      {recipient.name} <span className="text-green-700 dark:text-green-300">#{recipient.memberNumber || '—'}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{recipient.phone}</p>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {recipient.expiryDate ? (
                      <>
                        {locale === 'ar' ? 'ينتهي حالياً:' : 'Current expiry:'}{' '}
                        <span className="font-mono">{formatDateYMD(recipient.expiryDate as any)}</span>
                      </>
                    ) : (locale === 'ar' ? 'بدون اشتراك حالي' : 'No active subscription')}
                  </div>
                </div>
                {recipientExpiryAfter && (
                  <p className="mt-2 text-sm text-green-700 dark:text-green-300 font-bold flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" {...stroke}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>
                      {locale === 'ar' ? 'بعد النقل سينتهي في:' : 'After transfer expires:'}{' '}
                      <span className="font-mono">{formatDateYMD(recipientExpiryAfter)}</span>{' '}
                      <span className="text-xs opacity-80">(+{remainingDays} {locale === 'ar' ? 'يوم' : 'days'})</span>
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {mode === 'new' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 mb-5 space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-900/50 rounded-lg p-3 text-xs text-blue-800 dark:text-blue-200">
              {locale === 'ar'
                ? <>العضوية <span className="font-mono font-bold">#{member.memberNumber || '—'}</span> هتفضل نفسها — هنحدّث بس <b>الاسم والتليفون والصورة</b> للمالك الجديد. الاشتراك وكل بياناته بتفضل زي ما هي.</>
                : <>Membership <span className="font-mono font-bold">#{member.memberNumber || '—'}</span> stays the same — only <b>name, phone, and photo</b> are updated for the new owner. The subscription and all data stay attached.</>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="new-owner-name" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {locale === 'ar' ? 'اسم المالك الجديد' : 'New Owner Name'} *
                </label>
                <input
                  id="new-owner-name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                />
              </div>
              <div>
                <label htmlFor="new-owner-phone" className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {locale === 'ar' ? 'موبايل المالك الجديد' : 'New Owner Phone'} *
                </label>
                <input
                  id="new-owner-phone"
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="010xxxxxxxx"
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 font-mono"
                />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 ring-1 ring-purple-200 dark:ring-purple-900/50 rounded-lg p-3">
              <p className="text-xs font-bold text-purple-700 dark:text-purple-300 mb-2 flex items-center gap-1.5">
                <svg className="w-4 h-4" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
                <span>{locale === 'ar' ? 'صورة المالك الجديد (اختياري)' : 'New Owner Photo (optional)'}</span>
              </p>
              <ImageUpload
                currentImage={profileImage}
                onImageChange={(url) => setProfileImage(url)}
              />
            </div>

            {newRecipientExpiry && (
              <p className="text-sm text-purple-700 dark:text-purple-300 font-bold flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  {locale === 'ar'
                    ? `الاشتراك يفضل ${remainingDays} يوم — ينتهي في`
                    : `Subscription keeps ${remainingDays} days — expires on`}{' '}
                  <span className="font-mono">{formatDateYMD(newRecipientExpiry)}</span>
                </span>
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <label htmlFor="transfer-fee" className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
              <svg className="w-4 h-4" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
              <span>{locale === 'ar' ? 'سعر نقل العضوية' : 'Transfer Fee'} *</span>
            </label>
            <input
              id="transfer-fee"
              type="number"
              min="0"
              value={transferFee}
              onChange={(e) => setTransferFee(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-green-200 dark:ring-green-900/50 p-4 mb-5">
          <Paymentmethodselector
            value={paymentMethod}
            onChange={setPaymentMethod}
            allowMultiple={true}
            totalAmount={parseFloat(transferFee || '0') || 0}
            memberPoints={member.points || 0}
            pointsValueInEGP={settings.pointsValueInEGP}
            pointsEnabled={settings.pointsEnabled}
            required
          />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-primary-200 dark:ring-primary-900/50 p-3 mb-5">
          <p className="text-xs text-primary-700 dark:text-primary-300 mb-1 flex items-center gap-1.5">
            <svg className="w-4 h-4" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <span>{locale === 'ar' ? 'الموظف' : 'Staff'}</span>
          </p>
          <p className="font-bold text-primary-900 dark:text-primary-100">{user?.name || '—'}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading || remainingDays <= 0}
            className="flex-1 bg-primary-500 hover:bg-primary-600 text-primary-contrast py-2.5 rounded-lg font-bold transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading
              ? (locale === 'ar' ? 'جاري النقل...' : 'Transferring...')
              : (locale === 'ar' ? 'تأكيد النقل' : 'Confirm Transfer')}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg font-bold transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {t('common.cancel') || (locale === 'ar' ? 'إلغاء' : 'Cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

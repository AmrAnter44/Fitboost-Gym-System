'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { useServiceSettings } from '../contexts/ServiceSettingsContext'
import { usePermissions } from '../hooks/usePermissions'
import { calculateRemainingDays, formatDateYMD } from '../lib/dateFormatter'
import Paymentmethodselector from './Paymentmethodselector'
import ImageUpload from './ImageUpload'
import type { PaymentMethod } from '../lib/paymentHelpers'

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

  // existing recipient
  const [recipientNumber, setRecipientNumber] = useState('')
  const [recipientLoading, setRecipientLoading] = useState(false)
  const [recipient, setRecipient] = useState<RecipientLookup | null>(null)
  const [recipientErr, setRecipientErr] = useState('')

  // new owner (تغيير ملكية على نفس الـ record — اسم/تليفون/صورة بس)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [profileImage, setProfileImage] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // البحث عن العضو بالرقم
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

  // في mode='new' (تغيير ملكية على نفس الـ record) الاشتراك بيفضل زي ما هو،
  // فالـ expiry هو نفسه expiryDate بتاع العضو الحالي
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
        // mode='new' = تغيير ملكية على نفس الـ record (اسم/تليفون/صورة فقط)
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
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose() }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8" dir={direction}>
        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <span>🔁</span>
            <span>{locale === 'ar' ? 'نقل عضوية' : 'Transfer Membership'}</span>
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-300 text-3xl leading-none disabled:opacity-50"
          >
            ×
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Source member summary */}
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-2 border-orange-200 dark:border-orange-700 rounded-xl p-4 mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-orange-700 dark:text-orange-300 font-bold mb-1">
                {locale === 'ar' ? 'العضو المصدر' : 'Source Member'}
              </p>
              <p className="font-bold text-lg text-gray-900 dark:text-gray-100">
                {member.name} {member.memberNumber ? <span className="text-orange-600">#{member.memberNumber}</span> : null}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300 font-mono">{member.phone}</p>
            </div>
            <div className="text-center bg-white dark:bg-gray-700 rounded-xl px-5 py-3 border border-orange-300 dark:border-orange-600">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {locale === 'ar' ? 'الأيام المتبقية' : 'Remaining Days'}
              </p>
              <p className="text-3xl font-bold text-orange-600">{remainingDays}</p>
              {member.expiryDate && (
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                  {locale === 'ar' ? 'ينتهي' : 'Expires'} {formatDateYMD(member.expiryDate as any)}
                </p>
              )}
            </div>
          </div>
          {remainingDays <= 0 && (
            <p className="mt-3 text-sm text-red-700 dark:text-red-300 font-bold">
              ⚠️ {locale === 'ar' ? 'الاشتراك منتهي — لا توجد أيام للنقل' : 'Subscription expired — nothing to transfer'}
            </p>
          )}
        </div>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            type="button"
            onClick={() => setMode('existing')}
            className={`p-4 rounded-xl border-2 text-center transition-all ${
              mode === 'existing'
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20 shadow'
                : 'border-gray-300 dark:border-gray-600 hover:border-green-300'
            }`}
          >
            <div className="text-2xl mb-1">🏋️</div>
            <p className="font-bold text-sm text-gray-800 dark:text-gray-100">
              {locale === 'ar' ? 'عضو داخل الجيم' : 'Existing Member'}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              {locale === 'ar' ? 'نقل لرقم عضوية موجود' : 'Transfer to existing member ID'}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setMode('new')}
            className={`p-4 rounded-xl border-2 text-center transition-all ${
              mode === 'new'
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow'
                : 'border-gray-300 dark:border-gray-600 hover:border-purple-300'
            }`}
          >
            <div className="text-2xl mb-1">🆕</div>
            <p className="font-bold text-sm text-gray-800 dark:text-gray-100">
              {locale === 'ar' ? 'عضو خارج الجيم' : 'New Person'}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              {locale === 'ar' ? 'إنشاء عضو جديد بالأيام' : 'Create a new member'}
            </p>
          </button>
        </div>

        {/* Existing recipient */}
        {mode === 'existing' && (
          <div className="bg-gray-50 dark:bg-gray-700/50 border-2 border-gray-200 dark:border-gray-600 rounded-xl p-4 mb-5">
            <label className="block text-sm font-bold text-gray-800 dark:text-gray-100 mb-2">
              {locale === 'ar' ? 'رقم العضوية المستلم' : 'Recipient Member Number'} *
            </label>
            <input
              type="text"
              value={recipientNumber}
              onChange={(e) => setRecipientNumber(e.target.value)}
              placeholder={locale === 'ar' ? 'مثل: 1234' : 'e.g. 1234'}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-green-500"
            />
            {recipientLoading && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">⏳ {locale === 'ar' ? 'جاري البحث...' : 'Searching...'}</p>
            )}
            {recipientErr && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">⚠️ {recipientErr}</p>
            )}
            {recipient && (
              <div className="mt-3 bg-white dark:bg-gray-800 border-2 border-green-300 dark:border-green-700 rounded-lg p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-gray-900 dark:text-gray-100">
                      {recipient.name} <span className="text-green-700 dark:text-green-300">#{recipient.memberNumber || '—'}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{recipient.phone}</p>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    {recipient.expiryDate ? (
                      <>
                        {locale === 'ar' ? 'ينتهي حالياً:' : 'Current expiry:'}{' '}
                        <span className="font-mono">{formatDateYMD(recipient.expiryDate as any)}</span>
                      </>
                    ) : (locale === 'ar' ? 'بدون اشتراك حالي' : 'No active subscription')}
                  </div>
                </div>
                {recipientExpiryAfter && (
                  <p className="mt-2 text-sm text-green-700 dark:text-green-300 font-bold">
                    ✅ {locale === 'ar' ? 'بعد النقل سينتهي في:' : 'After transfer expires:'}{' '}
                    <span className="font-mono">{formatDateYMD(recipientExpiryAfter)}</span>{' '}
                    <span className="text-xs opacity-80">(+{remainingDays} {locale === 'ar' ? 'يوم' : 'days'})</span>
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* New owner — تغيير ملكية على نفس الـ record */}
        {mode === 'new' && (
          <div className="bg-gray-50 dark:bg-gray-700/50 border-2 border-gray-200 dark:border-gray-600 rounded-xl p-4 mb-5 space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 text-xs text-blue-800 dark:text-blue-200">
              {locale === 'ar'
                ? <>العضوية <span className="font-mono font-bold">#{member.memberNumber || '—'}</span> هتفضل نفسها — هنحدّث بس <b>الاسم والتليفون والصورة</b> للمالك الجديد. الاشتراك وكل بياناته بتفضل زي ما هي.</>
                : <>Membership <span className="font-mono font-bold">#{member.memberNumber || '—'}</span> stays the same — only <b>name, phone, and photo</b> are updated for the new owner. The subscription and all data stay attached.</>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-800 dark:text-gray-100 mb-1">
                  {locale === 'ar' ? 'اسم المالك الجديد' : 'New Owner Name'} *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-800 dark:text-gray-100 mb-1">
                  {locale === 'ar' ? 'موبايل المالك الجديد' : 'New Owner Phone'} *
                </label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="010xxxxxxxx"
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border-2 border-purple-200 dark:border-purple-700 rounded-lg p-3">
              <p className="text-xs font-bold text-purple-700 dark:text-purple-300 mb-2">
                📸 {locale === 'ar' ? 'صورة المالك الجديد (اختياري)' : 'New Owner Photo (optional)'}
              </p>
              <ImageUpload
                currentImage={profileImage}
                onImageChange={(url) => setProfileImage(url)}
              />
            </div>

            {newRecipientExpiry && (
              <p className="text-sm text-purple-700 dark:text-purple-300 font-bold">
                ✅ {locale === 'ar'
                  ? `الاشتراك يفضل ${remainingDays} يوم — ينتهي في`
                  : `Subscription keeps ${remainingDays} days — expires on`}{' '}
                <span className="font-mono">{formatDateYMD(newRecipientExpiry)}</span>
              </p>
            )}
          </div>
        )}

        {/* Transfer fee + payment */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block text-sm font-bold text-gray-800 dark:text-gray-100 mb-1">
              💰 {locale === 'ar' ? 'سعر نقل العضوية' : 'Transfer Fee'} *
            </label>
            <input
              type="number"
              min="0"
              value={transferFee}
              onChange={(e) => setTransferFee(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-700 rounded-xl p-4 mb-5">
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

        {/* Staff */}
        <div className="bg-primary-50 dark:bg-gray-700 border-2 border-primary-200 dark:border-gray-600 rounded-lg p-3 mb-5">
          <p className="text-xs text-primary-700 dark:text-primary-300 mb-1">
            👨‍💼 {locale === 'ar' ? 'الموظف' : 'Staff'}
          </p>
          <p className="font-bold text-primary-900 dark:text-primary-100">{user?.name || '—'}</p>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading || remainingDays <= 0}
            className={`flex-1 py-3 rounded-xl font-bold text-white transition-all ${
              loading || remainingDays <= 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 shadow-lg'
            }`}
          >
            {loading
              ? (locale === 'ar' ? '⏳ جاري النقل...' : '⏳ Transferring...')
              : (locale === 'ar' ? '🔁 تأكيد النقل' : '🔁 Confirm Transfer')}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-xl font-bold hover:bg-gray-400 dark:hover:bg-gray-600"
          >
            {t('common.cancel') || (locale === 'ar' ? 'إلغاء' : 'Cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

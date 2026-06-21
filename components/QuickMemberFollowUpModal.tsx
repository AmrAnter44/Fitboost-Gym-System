// components/QuickMemberFollowUpModal.tsx
//  مودال سريع لإضافة متابعة على عضو من البروفايل أو صفحة الأعضاء
'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../contexts/ToastContext'

interface QuickMemberFollowUpModalProps {
  isOpen: boolean
  onClose: () => void
  member: {
    id: string
    name: string
    phone: string
    isActive: boolean
    expiryDate?: string | null
  }
  onSuccess?: () => void
}

export default function QuickMemberFollowUpModal({ isOpen, onClose, member, onSuccess }: QuickMemberFollowUpModalProps) {
  const { locale, direction } = useLanguage()
  const { user } = usePermissions()
  const toast = useToast()

  const [notes, setNotes] = useState('')
  const [result, setResult] = useState('')
  const [contacted, setContacted] = useState(true)
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [nextFollowUpDate, setNextFollowUpDate] = useState('')
  const [submitting, setSubmitting] = useState(false)

  //  حدد التصنيف تلقائياً من حالة العضو
  const memberStatus = (() => {
    if (!member.expiryDate) return 'active'
    const expiry = new Date(member.expiryDate); expiry.setHours(0, 0, 0, 0)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return 'expired'
    if (diff <= 7) return 'expiring'
    return 'active'
  })()

  //  reset لما المودال يقفل
  useEffect(() => {
    if (!isOpen) {
      setNotes(''); setResult(''); setContacted(true); setPriority('medium'); setNextFollowUpDate('')
    }
  }, [isOpen])

  //  Esc يقفل
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  //  prefix بيتحدد حسب حالة العضو
  // expired / expiring → الـ source بيبقى expired-member / expiring-member
  // active → الـ source = active-member (يدخل في فلتر "زوار/أعضاء" العادي)
  const visitorIdPrefix = memberStatus === 'expired' ? 'expired-'
    : memberStatus === 'expiring' ? 'expiring-'
    : 'member-'
  const source = memberStatus === 'expired' ? 'expired-member'
    : memberStatus === 'expiring' ? 'expiring-member'
    : 'active-member'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!notes.trim()) {
      toast.error(locale === 'ar' ? 'اكتب ملاحظات المتابعة' : 'Please add notes')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/visitors/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId: `${visitorIdPrefix}${member.id}`,
          notes: notes.trim(),
          result: result || undefined,
          contacted,
          priority,
          nextFollowUpDate: nextFollowUpDate || undefined,
          salesName: user?.name || '',
          stage: contacted ? 'contacted' : 'new',
          visitorData: {
            name: member.name,
            phone: member.phone,
            source,
          },
        }),
      })

      if (response.ok) {
        toast.success(locale === 'ar' ? '✅ تم إضافة المتابعة' : '✅ Follow-up added')
        onSuccess?.()
        onClose()
      } else {
        const data = await response.json().catch(() => ({}))
        toast.error(data?.error || (locale === 'ar' ? 'فشل إضافة المتابعة' : 'Failed to add follow-up'))
      }
    } catch (err) {
      console.error('Error adding follow-up:', err)
      toast.error(locale === 'ar' ? 'حدث خطأ في الاتصال' : 'Connection error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto ring-1 ring-gray-200 dark:ring-gray-700" dir={direction}>
        {/* Header */}
        <div className={`p-4 border-b border-gray-200 dark:border-gray-700 ${
          memberStatus === 'expired' ? 'bg-gradient-to-r from-red-500 to-red-600'
          : memberStatus === 'expiring' ? 'bg-gradient-to-r from-amber-500 to-amber-600'
          : 'bg-gradient-to-r from-primary-500 to-primary-600'
        } text-white rounded-t-2xl`}>
          <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold inline-flex items-center gap-2">
                📞 {locale === 'ar' ? 'متابعة سريعة' : 'Quick Follow-up'}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/30">
                  {memberStatus === 'expired' ? (locale === 'ar' ? 'منتهي' : 'Expired')
                    : memberStatus === 'expiring' ? (locale === 'ar' ? 'قارب على الانتهاء' : 'Expiring')
                    : (locale === 'ar' ? 'نشط' : 'Active')}
                </span>
              </h3>
              <p className="text-sm opacity-95 mt-1 font-bold truncate">{member.name}</p>
              <p className="text-xs opacity-85 font-mono mt-0.5" dir="ltr">{member.phone}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Notes */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1.5">
              📝 {locale === 'ar' ? 'ملاحظات المتابعة' : 'Follow-up notes'} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              autoFocus
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              placeholder={locale === 'ar' ? 'مثلاً: اتكلمت معاه — قال هيجدد الأسبوع الجاي' : 'e.g. Talked to him — said he\'ll renew next week'}
            />
          </div>

          {/* Result */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1.5">
              🎯 {locale === 'ar' ? 'النتيجة' : 'Result'}
            </label>
            <select
              value={result}
              onChange={(e) => setResult(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            >
              <option value="">{locale === 'ar' ? '— اختر النتيجة —' : '— Select result —'}</option>
              <option value="interested">{locale === 'ar' ? '😊 مهتم' : '😊 Interested'}</option>
              <option value="not-interested">{locale === 'ar' ? '😕 غير مهتم' : '😕 Not interested'}</option>
              <option value="no-answer">{locale === 'ar' ? '📵 مفيش رد' : '📵 No answer'}</option>
              <option value="busy">{locale === 'ar' ? '⏰ مشغول' : '⏰ Busy'}</option>
              <option value="will-renew">{locale === 'ar' ? '🔄 هيجدد' : '🔄 Will renew'}</option>
              <option value="callback-later">{locale === 'ar' ? '📞 يتصل بيه بعدين' : '📞 Callback later'}</option>
            </select>
          </div>

          {/* Priority + Next Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1.5">
                ⚡ {locale === 'ar' ? 'الأولوية' : 'Priority'}
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(['low', 'medium', 'high'] as const).map(p => {
                  const active = priority === p
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`px-2 py-2 rounded-lg text-xs font-bold transition-colors ${
                        active
                          ? p === 'high' ? 'bg-red-600 text-white' : p === 'medium' ? 'bg-amber-500 text-white' : 'bg-gray-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {locale === 'ar' ? (p === 'high' ? 'عالية' : p === 'medium' ? 'متوسطة' : 'منخفضة') : (p === 'high' ? 'High' : p === 'medium' ? 'Med' : 'Low')}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-1.5">
                📅 {locale === 'ar' ? 'متابعة قادمة' : 'Next follow-up'}
              </label>
              <input
                type="date"
                value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* Contacted toggle */}
          <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 ring-1 ring-gray-200 dark:ring-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">
            <input
              type="checkbox"
              checked={contacted}
              onChange={(e) => setContacted(e.target.checked)}
              className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
            />
            <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
              ✅ {locale === 'ar' ? 'تم التواصل معه' : 'Contacted'}
            </span>
          </label>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold disabled:opacity-50"
            >
              {locale === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={submitting || !notes.trim()}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 12a8 8 0 018-8" /></svg>
                  {locale === 'ar' ? 'جاري...' : 'Saving...'}
                </>
              ) : (
                <>📝 {locale === 'ar' ? 'حفظ المتابعة' : 'Save follow-up'}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

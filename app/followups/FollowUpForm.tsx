'use client'

import React, { useState, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { usePermissions } from '@/hooks/usePermissions'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

const IconNote = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
  </svg>
)
const IconClose = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
  </svg>
)
const IconPhone = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
  </svg>
)
const IconUser = (p: { className?: string }) => (
  <svg {...stroke} className={p.className} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
  </svg>
)

interface FollowUpFormProps {
  visitors: any[]
  expiredMembers: any[]
  expiringMembers: any[]
  dayUseRecords: any[]
  invitations: any[]
  initialVisitorId?: string
  initialDate?: string
  onSubmit: (formData: {
    visitorId: string
    salesName: string
    notes: string
    result: string
    nextFollowUpDate: string
    contacted: boolean
    assignedTo?: string
    priority?: string
    stage?: string
  }) => Promise<void>
  onClose: () => void
}

export default function FollowUpForm({
  visitors,
  expiredMembers,
  expiringMembers,
  dayUseRecords,
  invitations,
  initialVisitorId = '',
  initialDate = '',
  onSubmit,
  onClose
}: FollowUpFormProps) {
  const { t, direction } = useLanguage()
  const { user } = usePermissions()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    visitorId: initialVisitorId,
    salesName: user?.name || '',
    notes: '',
    result: '',
    nextFollowUpDate: initialDate,
    contacted: true,
    assignedTo: '',
    priority: 'medium',
    stage: 'new'
  })

  // المتابعة دائماً تُسند للمستخدم المسجل دخول حالياً
  useEffect(() => {
    if (user?.name) {
      setFormData(prev => ({
        ...prev,
        salesName: user.name,
        ...(user.staffId ? { assignedTo: user.staffId } : {})
      }))
    }
  }, [user])

  // تحديث visitorId لما يتغير من الخارج
  useEffect(() => {
    if (initialVisitorId) {
      setFormData(prev => ({ ...prev, visitorId: initialVisitorId }))
    }
  }, [initialVisitorId])

  // البحث عن بيانات الزائر/العضو المختار
  const getSelectedVisitorInfo = () => {
    if (!formData.visitorId) return null

    // البحث في الزوار
    const visitor = visitors.find(v => v.id === formData.visitorId)
    if (visitor) return { name: visitor.name, phone: visitor.phone, type: t('followups.form.types.visitor') }

    // البحث في الأعضاء المنتهيين (ID = expired-xxx)
    const expMember = expiredMembers.find((m: any) => m.id === formData.visitorId)
    if (expMember) {
      // إزالة "(عضو منتهي)" من الاسم إذا كان موجود
      const cleanName = expMember.name.replace(' (عضو منتهي)', '').trim()
      return { name: cleanName, phone: expMember.phone, type: t('followups.form.types.expiredMember') }
    }

    // البحث في الأعضاء القريبين من الانتهاء (ID = expiring-xxx)
    const expiringMember = expiringMembers.find((m: any) => m.id === formData.visitorId)
    if (expiringMember) {
      // إزالة "(باقي X يوم)" من الاسم
      const cleanName = expiringMember.name.replace(/\s*\(باقي \d+ يوم\)/, '').trim()
      return { name: cleanName, phone: expiringMember.phone, type: t('followups.form.types.expiringMember') }
    }

    // البحث في Day Use
    const dayUse = dayUseRecords.find(r => `dayuse-${r.id}` === formData.visitorId)
    if (dayUse) return { name: dayUse.name, phone: dayUse.phone, type: t('followups.form.types.dayUse') }

    // البحث في Invitations
    const invitation = invitations.find(inv => `invitation-${inv.id}` === formData.visitorId)
    if (invitation) return { name: invitation.guestName, phone: invitation.guestPhone, type: t('followups.form.types.invitation') }

    return null
  }

  const selectedInfo = getSelectedVisitorInfo()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Guard: لو اليوزر لسه مش محمّل، نمنع الإرسال
    // عشان نتجنب إرسال متابعة بدون salesName/assignedTo
    if (!user) {
      return
    }
    setLoading(true)
    try {
      await onSubmit(formData)
      // Reset form (مع الحفاظ على اسم السيلز)
      setFormData({
        visitorId: '',
        salesName: user?.name || '',
        notes: '',
        result: '',
        nextFollowUpDate: '',
        contacted: true,
        assignedTo: user?.staffId || '',
        priority: 'medium',
        stage: 'new'
      })
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-sm'
  const labelCls = 'block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5'

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="followup-form-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in"
        onClick={(e) => e.stopPropagation()}
        dir={direction}
      >
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-4 rounded-t-2xl flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
          <h2 id="followup-form-title" className="text-lg font-bold flex items-center gap-2">
            <IconNote className="w-5 h-5 text-primary-700 dark:text-primary-400" />
            <span>{t('followups.form.title')}</span>
          </h2>
          <button
            onClick={onClose}
            type="button"
            aria-label={t('common.close') || 'Close'}
            className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg w-8 h-8 flex items-center justify-center transition-colors duration-200"
          >
            <IconClose className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {selectedInfo ? (
            <div className="bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-900/50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary-500 text-primary-contrast rounded-full w-12 h-12 flex items-center justify-center text-xl font-bold">
                  {selectedInfo.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100">{selectedInfo.name}</h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                      {selectedInfo.type}
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mt-1 flex items-center gap-1">
                    <IconPhone className="w-4 h-4" />
                    <span>{selectedInfo.phone}</span>
                  </p>
                </div>
              </div>
              <input type="hidden" name="visitorId" value={formData.visitorId} />
            </div>
          ) : (
            <div className="bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/50 rounded-lg p-4 text-center">
              <p className="text-red-700 dark:text-red-400 font-bold">{t('followups.form.noMemberSelected')}</p>
              <p className="text-red-600 dark:text-red-400 text-sm mt-1">{t('followups.form.pleaseSelectMember')}</p>
            </div>
          )}

          {formData.salesName && (
            <div className="bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-900/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm">
                <IconUser className="w-4 h-4 text-green-700 dark:text-green-400" />
                <span className="text-green-700 dark:text-green-400 font-bold">{t('followups.form.salesName')}:</span>
                <span className="text-green-900 dark:text-green-300 font-bold">{formData.salesName}</span>
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>
              {t('followups.form.notes')} <span className="text-gray-500 dark:text-gray-400 text-xs font-normal">({t('followups.form.optional')})</span>
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className={inputCls}
              rows={3}
              placeholder={t('followups.form.notesPlaceholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('followups.form.result')}</label>
              <select
                value={formData.result}
                onChange={(e) => setFormData({ ...formData, result: e.target.value })}
                className={inputCls}
              >
                <option value="">{t('followups.form.selectResult')}</option>
                <option value="interested">{t('followups.form.interested')}</option>
                <option value="not-interested">{t('followups.form.notInterested')}</option>
                <option value="postponed">{t('followups.form.postponed')}</option>
                <option value="subscribed">{t('followups.form.subscribed')}</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>{t('followups.form.nextFollowUpDate')}</label>
              <input
                type="date"
                value={formData.nextFollowUpDate}
                onChange={(e) => setFormData({ ...formData, nextFollowUpDate: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !user}
            className="w-full bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? t('followups.form.saving') : t('followups.form.save')}
          </button>
        </form>
      </div>
    </div>
  )
}

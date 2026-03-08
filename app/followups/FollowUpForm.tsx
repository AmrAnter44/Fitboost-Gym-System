'use client'

import React, { useState, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { usePermissions } from '@/hooks/usePermissions'

interface FollowUpFormProps {
  visitors: any[]
  expiredMembers: any[]
  expiringMembers: any[]
  dayUseRecords: any[]
  invitations: any[]
  initialVisitorId?: string
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
  onSubmit,
  onClose
}: FollowUpFormProps) {
  const { t, direction } = useLanguage()
  const { user } = usePermissions()
  const [loading, setLoading] = useState(false)
  const [staff, setStaff] = useState<any[]>([])
  const [formData, setFormData] = useState({
    visitorId: initialVisitorId,
    salesName: user?.name || '',
    notes: '',
    result: '',
    nextFollowUpDate: '',
    contacted: false,
    assignedTo: '', // فارغ - بدون إسناد تلقائي
    priority: 'medium',
    stage: 'new'
  })

  // جلب الموظفين النشطين
  useEffect(() => {
    fetch('/api/staff')
      .then(res => res.json())
      .then(data => {
        const activeStaff = data.filter((s: any) => s.isActive)
        setStaff(activeStaff)
      })
      .catch(err => console.error('Error fetching staff:', err))
  }, [])

  // ✅ تعبئة اسم السيلز تلقائياً من المستخدم المسجل
  useEffect(() => {
    if (user?.name) {
      setFormData(prev => ({ ...prev, salesName: user.name }))
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
        contacted: false,
        assignedTo: '', // فارغ - بدون إسناد تلقائي
        priority: 'medium',
        stage: 'new'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        dir={direction}
      >
        <div className="sticky top-0 bg-primary-600 dark:bg-primary-700 text-white p-4 rounded-t-lg flex justify-between items-center">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span>📝</span>
            <span>{t('followups.form.title')}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* عرض معلومات الزائر/العضو المختار */}
          {selectedInfo ? (
            <div className="bg-gradient-to-r from-primary-50 to-primary-50 dark:from-primary-900/30 dark:to-primary-900/30 border-2 border-primary-200 dark:border-primary-700 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary-600 dark:bg-primary-700 text-white rounded-full w-12 h-12 flex items-center justify-center text-xl font-bold">
                  {selectedInfo.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{selectedInfo.name}</h3>
                    <span className="text-xs px-2 py-1 bg-primary-600 dark:bg-primary-700 text-white rounded-full">
                      {selectedInfo.type}
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">📱 {selectedInfo.phone}</p>
                </div>
              </div>
              {/* Hidden input to store visitorId */}
              <input type="hidden" name="visitorId" value={formData.visitorId} />
            </div>
          ) : (
            <div className="bg-red-50 dark:bg-red-900/30 border-2 border-red-200 dark:border-red-700 rounded-lg p-4 text-center">
              <p className="text-red-600 dark:text-red-400 font-medium">{t('followups.form.noMemberSelected')}</p>
              <p className="text-red-500 dark:text-red-400 text-sm mt-1">{t('followups.form.pleaseSelectMember')}</p>
            </div>
          )}

          {/* ✅ اسم السيلز يتم تعبئته تلقائياً من المستخدم المسجل */}
          {user?.name && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-300 dark:border-green-700 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="text-green-700 dark:text-green-400 font-bold text-sm">👤 {t('followups.form.salesName')}:</span>
                <span className="text-green-900 dark:text-green-300 font-bold">{user.name}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-100">
              {t('followups.form.notes')} {t('followups.form.required')}
            </label>
            <textarea
              required
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm dark:bg-gray-700 dark:text-white"
              rows={3}
              placeholder={t('followups.form.notesPlaceholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-100">{t('followups.form.result')}</label>
              <select
                value={formData.result}
                onChange={(e) => setFormData({ ...formData, result: e.target.value })}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm dark:bg-gray-700 dark:text-white"
              >
                <option value="">{t('followups.form.selectResult')}</option>
                <option value="interested">{t('followups.form.interested')}</option>
                <option value="not-interested">{t('followups.form.notInterested')}</option>
                <option value="postponed">{t('followups.form.postponed')}</option>
                <option value="subscribed">{t('followups.form.subscribed')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-100">{t('followups.form.nextFollowUpDate')}</label>
              <input
                type="date"
                value={formData.nextFollowUpDate}
                onChange={(e) => setFormData({ ...formData, nextFollowUpDate: e.target.value })}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          {/* الموظف المسؤول - مخفي */}
          {false && (
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-100">
                الموظف المسؤول
              </label>
              <select
                value={formData.assignedTo}
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm dark:bg-gray-700 dark:text-white"
              >
                <option value="">غير محدد</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.position ? ` - ${s.position}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-100">
              الأولوية
            </label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm dark:bg-gray-700 dark:text-white"
            >
              <option value="low">🟢 عادي</option>
              <option value="medium">🟡 متوسط</option>
              <option value="high">🔴 عاجل</option>
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <input
              type="checkbox"
              checked={formData.contacted}
              onChange={(e) => setFormData({ ...formData, contacted: e.target.checked })}
              className="rounded w-4 h-4"
            />
            <span className="text-sm font-medium dark:text-gray-100">{t('followups.form.contactedCheckbox')}</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white py-2.5 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 font-semibold"
          >
            {loading ? t('followups.form.saving') : t('followups.form.save')}
          </button>
        </form>
      </div>
    </div>
  )
}

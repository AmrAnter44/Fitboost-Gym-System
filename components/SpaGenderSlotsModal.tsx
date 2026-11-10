'use client'

import { useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'

//  🚻 مواعيد الاسبا للرجالة والسيدات (جيم مكس) — كل سطر: خدمة + جنس + أيام + من/إلى.
//  العضو في الأبليكيشن بيشوف ويحجز مواعيد جنسه بس. الخدمة اللي مالهاش ولا سطر → مفيش قيد.

export type SpaGenderSlot = {
  service: 'all' | 'massage' | 'sauna' | 'jacuzzi'
  gender: 'male' | 'female'
  days: number[]
  from: string
  to: string
}

const DAYS_AR = ['أحد', 'اتنين', 'تلات', 'أربع', 'خميس', 'جمعة', 'سبت']
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type Props = {
  initial: SpaGenderSlot[]
  onClose: () => void
  onSaved: () => void
}

export default function SpaGenderSlotsModal({ initial, onClose, onSaved }: Props) {
  const { locale, direction, tr } = useLanguage()
  const toast = useToast()
  const ar = locale === 'ar'
  const [slots, setSlots] = useState<SpaGenderSlot[]>(initial.length ? initial : [])
  const [saving, setSaving] = useState(false)

  const services: Array<{ v: SpaGenderSlot['service']; label: string }> = [
    { v: 'all', label: tr('كل الخدمات', 'All services') },
    { v: 'sauna', label: tr('ساونا', 'Sauna') },
    { v: 'jacuzzi', label: tr('جاكوزي', 'Jacuzzi') },
    { v: 'massage', label: tr('مساج', 'Massage') },
  ]

  const update = (i: number, patch: Partial<SpaGenderSlot>) =>
    setSlots(prev => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  const toggleDay = (i: number, d: number) =>
    setSlots(prev => prev.map((s, idx) => idx !== i ? s : {
      ...s, days: s.days.includes(d) ? s.days.filter(x => x !== d) : [...s.days, d].sort(),
    }))
  const add = (gender: SpaGenderSlot['gender']) =>
    setSlots(prev => [...prev, { service: 'all', gender, days: [0, 1, 2, 3, 4, 5, 6], from: gender === 'female' ? '10:00' : '16:00', to: gender === 'female' ? '14:00' : '22:00' }])

  const save = async () => {
    for (const s of slots) {
      if (s.days.length === 0) { toast.error(tr('كل ميعاد لازم يكون فيه يوم واحد على الأقل', 'Each slot needs at least one day')); return }
      if (!s.from || !s.to || s.to <= s.from) { toast.error(tr('ميعاد «إلى» لازم يكون بعد «من»', '"To" must be after "From"')); return }
    }
    setSaving(true)
    try {
      const res = await fetch('/api/spa-bookings/hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genderSlots: slots }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(tr('تم حفظ مواعيد الرجالة والسيدات', 'Men/women slots saved'))
      onSaved()
    } catch (e: any) {
      toast.error(e?.message || tr('فشل الحفظ', 'Save failed'))
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div dir={direction} onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{tr('مواعيد الرجالة والسيدات', 'Men / women slots')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {tr('العضو في الأبليكيشن بيشوف ويحجز مواعيد جنسه بس. الخدمة اللي مالهاش مواعيد هنا مفتوحة للكل في ساعات التشغيل.',
              'Members see and book only their own slots in the app. Services with no slots here stay open to everyone.')}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {slots.length === 0 && (
            <p className="text-sm text-center text-gray-500 dark:text-gray-400 py-6">{tr('مفيش مواعيد — الاسبا مفتوح للكل', 'No slots — SPA open to everyone')}</p>
          )}
          {slots.map((s, i) => (
            <div key={i} className={`rounded-xl p-3 ring-1 ${s.gender === 'female'
              ? 'bg-pink-50/60 dark:bg-pink-900/10 ring-pink-200 dark:ring-pink-900/50'
              : 'bg-blue-50/60 dark:bg-blue-900/10 ring-blue-200 dark:ring-blue-900/50'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <select value={s.gender} onChange={e => update(i, { gender: e.target.value as SpaGenderSlot['gender'] })} className={inputCls}>
                  <option value="female">{tr('سيدات', 'Women')}</option>
                  <option value="male">{tr('رجالة', 'Men')}</option>
                </select>
                <select value={s.service} onChange={e => update(i, { service: e.target.value as SpaGenderSlot['service'] })} className={inputCls}>
                  {services.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
                <span className="text-xs text-gray-500 dark:text-gray-400">{tr('من', 'From')}</span>
                <input type="time" value={s.from} onChange={e => update(i, { from: e.target.value })} className={inputCls} dir="ltr" />
                <span className="text-xs text-gray-500 dark:text-gray-400">{tr('إلى', 'To')}</span>
                <input type="time" value={s.to} onChange={e => update(i, { to: e.target.value })} className={inputCls} dir="ltr" />
                <button type="button" onClick={() => setSlots(prev => prev.filter((_, idx) => idx !== i))}
                  className="ms-auto px-2 py-1 rounded-lg text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30">
                  {tr('حذف', 'Remove')}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(ar ? DAYS_AR : DAYS_EN).map((d, di) => (
                  <button key={di} type="button" onClick={() => toggleDay(i, di)}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${s.days.includes(di)
                      ? (s.gender === 'female' ? 'bg-pink-600 text-white' : 'bg-blue-600 text-white')
                      : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 ring-1 ring-gray-200 dark:ring-gray-600'}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={() => add('female')}
              className="px-3 py-1.5 rounded-lg text-sm font-bold ring-1 ring-pink-300 dark:ring-pink-800 text-pink-700 dark:text-pink-300 hover:bg-pink-50 dark:hover:bg-pink-900/20">
              + {tr('ميعاد سيدات', 'Women slot')}
            </button>
            <button type="button" onClick={() => add('male')}
              className="px-3 py-1.5 rounded-lg text-sm font-bold ring-1 ring-blue-300 dark:ring-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20">
              + {tr('ميعاد رجالة', 'Men slot')}
            </button>
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-gray-100 dark:border-gray-700">
          <button type="button" onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-primary-500 hover:bg-primary-600 text-primary-contrast disabled:opacity-60">
            {saving ? tr('جاري الحفظ...', 'Saving...') : tr('حفظ', 'Save')}
          </button>
          <button type="button" onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
            {tr('إلغاء', 'Cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

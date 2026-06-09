'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

const iconSend = (
  <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
  </svg>
)
const iconExchange = (
  <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 16V4M7 4 3 8M7 4l4 4M17 8v12M17 20l4-4M17 20l-4-4"/>
  </svg>
)
const iconShuffle = (
  <svg {...stroke} className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>
  </svg>
)
const iconUser = (
  <svg {...stroke} className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 14a4 4 0 1 0-8 0m12 7a8 8 0 1 0-16 0"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
)
const iconBan = (
  <svg {...stroke} className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <path d="M5 5l14 14"/>
  </svg>
)
const iconWarning = (
  <svg {...stroke} className="w-4 h-4 shrink-0" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <path d="M12 9v4M12 17h.01"/>
  </svg>
)
const iconCheck = (
  <svg {...stroke} className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 13l4 4L19 7"/>
  </svg>
)
const iconCheckLg = (
  <svg {...stroke} className="w-10 h-10" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <path d="M8 12l3 3 5-6"/>
  </svg>
)
const iconBriefcase = (
  <svg {...stroke} className="w-10 h-10" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/>
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
  </svg>
)

interface SalesStaff {
  staffId: string
  name: string
  staffCode: string
  position: string | null
  salesTarget: number | null
  collectedThisMonth?: number
  members?: { id: string }[]
}

export default function SalesMgmtPanel() {
  const { locale } = useLanguage()
  const toast = useToast()
  const ar = locale === 'ar'

  const [staff, setStaff] = useState<SalesStaff[]>([])
  const [loading, setLoading] = useState(true)

  // Unassigned state
  const [unassigned, setUnassigned] = useState({ membersCount: 0, followUpsCount: 0, dayUseCount: 0, invitationCount: 0 })
  const [assignMode, setAssignMode] = useState<'distribute' | 'single'>('distribute')
  const [assignStaffId, setAssignStaffId] = useState('')
  const [assignTypes, setAssignTypes] = useState<string[]>(['members', 'followups'])
  const [assigning, setAssigning] = useState(false)
  const [confirmAssign, setConfirmAssign] = useState(false)

  // Transfer state
  const [fromStaffId, setFromStaffId] = useState('')
  const [toStaffId, setToStaffId] = useState('') // 'unassigned' = إلغاء التعيين
  const [transferTypes, setTransferTypes] = useState<string[]>(['members'])
  const [transferring, setTransferring] = useState(false)
  const [confirmTransfer, setConfirmTransfer] = useState(false)

  const fetchStaff = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/followups/sales')
      if (!res.ok) throw new Error()
      const data = await res.json()
      const rawStaff = data?.staff ?? data ?? []
      // فلتر: السيلز فقط
      const salesOnly: SalesStaff[] = (rawStaff || []).filter((s: any) =>
        s.position && s.position.split(',').map((p: string) => p.trim()).includes('sales')
      )
      setStaff(salesOnly)
      if (data?.unassigned) setUnassigned(data.unassigned)
    } catch {
      toast.error(ar ? 'فشل تحميل بيانات السيلز' : 'Failed to load sales data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchStaff() }, [])

  const handleTransfer = async () => {
    if (!fromStaffId || !toStaffId || transferTypes.length === 0) return
    if (toStaffId !== 'unassigned' && fromStaffId === toStaffId) return
    setTransferring(true)
    try {
      const body = {
        fromStaffId,
        toStaffId: toStaffId === 'unassigned' ? null : toStaffId,
        types: transferTypes
      }

      const res = await fetch('/api/members/transfer-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const parts: string[] = []
      if (data.transferredMembers) parts.push(`${data.transferredMembers} ${ar ? 'عضو' : 'members'}`)
      if (data.transferredFollowUps) parts.push(`${data.transferredFollowUps} ${ar ? 'متابعة' : 'follow-ups'}`)
      if (data.transferredDayUse) parts.push(`${data.transferredDayUse} ${ar ? 'داي يوز' : 'day use'}`)
      if (data.transferredInvitations) parts.push(`${data.transferredInvitations} ${ar ? 'انفيتيشن' : 'invitations'}`)

      if (parts.length === 0) {
        toast.success(ar ? 'لا يوجد بيانات للنقل' : 'Nothing to transfer')
      } else {
        toast.success(ar ? `تم نقل ${parts.join(' و ')}` : `Transferred ${parts.join(' and ')}`)
      }

      setConfirmTransfer(false)
      setFromStaffId('')
      setToStaffId('')
      setTransferTypes(['members'])
      fetchStaff()
      // يخبر CollectionDashboard إنه يعيد جلب التارجت/المحصّل
      window.dispatchEvent(new Event('sales-data-changed'))
    } catch (e: any) {
      toast.error(e.message || (ar ? 'فشل النقل' : 'Transfer failed'))
    } finally {
      setTransferring(false)
    }
  }

  const handleAssignUnassigned = async () => {
    if (assignTypes.length === 0) return
    if (assignMode === 'single' && !assignStaffId) return
    setAssigning(true)
    try {
      const res = await fetch('/api/followups/assign-unassigned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: assignMode, staffId: assignStaffId || undefined, types: assignTypes })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const parts = []
      if (data.assignedMembers) parts.push(`${data.assignedMembers} ${ar ? 'عضو' : 'members'}`)
      if (data.assignedFollowUps) parts.push(`${data.assignedFollowUps} ${ar ? 'متابعة' : 'follow-ups'}`)
      if (data.assignedDayUse) parts.push(`${data.assignedDayUse} ${ar ? 'داي يوز' : 'day use'}`)
      if (data.assignedInvitations) parts.push(`${data.assignedInvitations} ${ar ? 'انفيتيشن' : 'invitation'}`)
      toast.success(ar ? `تم تعيين ${parts.join(' و ')}` : `Assigned ${parts.join(' and ')}`)
      setConfirmAssign(false)
      setAssignStaffId('')
      fetchStaff()
      // إعادة احتساب التارجت/المحصّل في CollectionDashboard
      window.dispatchEvent(new Event('sales-data-changed'))
    } catch (e: any) {
      toast.error(e.message || (ar ? 'فشل التوزيع' : 'Assignment failed'))
    } finally {
      setAssigning(false)
    }
  }

  const fromStaff = staff.find(s => s.staffId === fromStaffId)
  const toStaff = staff.find(s => s.staffId === toStaffId)

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="skeleton-shimmer h-24 rounded-xl" />
        ))}
      </div>
    )
  }

  if (staff.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-gray-400 dark:text-gray-500">
          {iconBriefcase}
        </div>
        <p className="mt-3 text-gray-600 dark:text-gray-300 font-bold">{ar ? 'لا يوجد موظفو سيلز' : 'No sales staff found'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* ── قسم توزيع الغير مُسنَّدين ── */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center">
            {iconSend}
          </span>
          <span>{ar ? 'توزيع الغير مُسنَّدين' : 'Assign Unassigned'}</span>
        </h2>

        {/* بطاقات الإحصاء */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{unassigned.membersCount}</p>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-1">{ar ? 'عضو بدون سيلز' : 'Unassigned Members'}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 text-center">
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{unassigned.followUpsCount}</p>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-1">{ar ? 'متابعة بدون موظف' : 'Unassigned Follow-ups'}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{unassigned.dayUseCount}</p>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-1">{ar ? 'داي يوز بدون سيلز' : 'Unassigned Day Use'}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{unassigned.invitationCount}</p>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-1">{ar ? 'انفيتيشن بدون سيلز' : 'Unassigned Invitations'}</p>
          </div>
        </div>

        {(unassigned.membersCount > 0 || unassigned.followUpsCount > 0 || unassigned.dayUseCount > 0 || unassigned.invitationCount > 0) ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-4">

            {/* ما يتم توزيعه */}
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{ar ? 'وزّع:' : 'Assign:'}</p>
              <div className="flex gap-3 flex-wrap">
                {[
                  { key: 'members', label: ar ? `الأعضاء (${unassigned.membersCount})` : `Members (${unassigned.membersCount})`, disabled: unassigned.membersCount === 0 },
                  { key: 'followups', label: ar ? `المتابعات (${unassigned.followUpsCount})` : `Follow-ups (${unassigned.followUpsCount})`, disabled: unassigned.followUpsCount === 0 },
                  { key: 'dayuse', label: ar ? `الزوار/داي يوز (${unassigned.dayUseCount})` : `Visitors/Day Use (${unassigned.dayUseCount})`, disabled: unassigned.dayUseCount === 0 },
                  { key: 'invitations', label: ar ? `الانفيتيشن (${unassigned.invitationCount})` : `Invitations (${unassigned.invitationCount})`, disabled: unassigned.invitationCount === 0 },
                ].map(opt => (
                  <label key={opt.key} className={`flex items-center gap-2 ${opt.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      checked={assignTypes.includes(opt.key)}
                      disabled={opt.disabled}
                      onChange={e => setAssignTypes(prev =>
                        e.target.checked ? [...prev, opt.key] : prev.filter(t => t !== opt.key)
                      )}
                      className="w-4 h-4 accent-primary-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* طريقة التوزيع */}
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{ar ? 'طريقة التوزيع:' : 'Distribution Mode:'}</p>
              <div className="flex gap-3 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value="distribute" checked={assignMode === 'distribute'}
                    onChange={() => { setAssignMode('distribute'); setAssignStaffId(''); setConfirmAssign(false) }}
                    className="accent-primary-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                     {ar ? 'توزيع تلقائي بالتساوي بين السيلز' : 'Auto round-robin'}
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value="single" checked={assignMode === 'single'}
                    onChange={() => { setAssignMode('single'); setConfirmAssign(false) }}
                    className="accent-primary-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                     {ar ? 'تعيين لموظف محدد' : 'Assign to one staff'}
                  </span>
                </label>
              </div>
            </div>

            {/* اختيار موظف */}
            {assignMode === 'single' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {ar ? 'اختر موظف السيلز' : 'Select Sales Staff'}
                </label>
                <select
                  value={assignStaffId}
                  onChange={e => { setAssignStaffId(e.target.value); setConfirmAssign(false) }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  <option value="">{ar ? '— اختر موظف —' : '— Select staff —'}</option>
                  {staff.map(s => (
                    <option key={s.staffId} value={s.staffId}>{s.name} — #{s.staffCode}</option>
                  ))}
                </select>
              </div>
            )}

            {/* زرار التوزيع */}
            {!confirmAssign ? (
              <button
                onClick={() => setConfirmAssign(true)}
                disabled={assignTypes.length === 0 || (assignMode === 'single' && !assignStaffId)}
                className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed text-primary-contrast rounded-lg font-medium transition-colors"
              >
                 {ar ? 'توزيع الآن' : 'Assign Now'}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-200">
                   {(() => {
                    const confirmParts: string[] = []
                    if (assignTypes.includes('members') && unassigned.membersCount > 0) confirmParts.push(ar ? `${unassigned.membersCount} عضو` : `${unassigned.membersCount} members`)
                    if (assignTypes.includes('followups') && unassigned.followUpsCount > 0) confirmParts.push(ar ? `${unassigned.followUpsCount} متابعة` : `${unassigned.followUpsCount} follow-ups`)
                    if (assignTypes.includes('dayuse') && unassigned.dayUseCount > 0) confirmParts.push(ar ? `${unassigned.dayUseCount} زائر/داي يوز` : `${unassigned.dayUseCount} day use`)
                    if (assignTypes.includes('invitations') && unassigned.invitationCount > 0) confirmParts.push(ar ? `${unassigned.invitationCount} انفيتيشن` : `${unassigned.invitationCount} invitation`)
                    const who = assignMode === 'distribute'
                      ? (ar ? 'بالتساوي على كل السيلز' : 'evenly across all sales staff')
                      : (ar ? `لـ "${staff.find(s => s.staffId === assignStaffId)?.name}"` : `to "${staff.find(s => s.staffId === assignStaffId)?.name}"`)
                    return ar
                      ? `سيتم تعيين ${confirmParts.join(' و ')} ${who}`
                      : `Will assign ${confirmParts.join(' & ')} ${who}`
                  })()}
                </div>
                <div className="flex gap-3">
                  <button onClick={handleAssignUnassigned} disabled={assigning}
                    className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
                    {assigning ? (ar ? 'جاري التوزيع...' : 'Assigning...') : (ar ? ' تأكيد' : ' Confirm')}
                  </button>
                  <button onClick={() => setConfirmAssign(false)} disabled={assigning}
                    className="flex-1 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors">
                    {ar ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-400 dark:text-gray-500">
            
            <p className="text-sm">{ar ? 'كل الأعضاء والمتابعات والزوار مُسنَّدين' : 'All members, follow-ups & visitors are assigned'}</p>
          </div>
        )}
      </div>

      {/* ── قسم نقل البيانات بين السيلز ── */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
           {ar ? 'نقل البيانات بين موظفي السيلز' : 'Transfer Data Between Sales Staff'}
        </h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {ar ? 'من موظف' : 'From Staff'}
              </label>
              <select
                value={fromStaffId}
                onChange={e => { setFromStaffId(e.target.value); setConfirmTransfer(false) }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                <option value="">{ar ? '— اختر موظف —' : '— Select staff —'}</option>
                {staff.map(s => (
                  <option key={s.staffId} value={s.staffId} disabled={s.staffId === toStaffId}>
                    {s.name} ({ar ? 'أعضاء:' : 'members:'} {(s as any).members?.length ?? 0})
                  </option>
                ))}
              </select>

              {/* 💼 بطاقة كبيرة بيظهر فيها اسم الموظف المختار */}
              {fromStaff && (
                <div className="mt-3 flex items-center gap-3 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/40 dark:to-blue-800/30 ring-2 ring-blue-300 dark:ring-blue-700 rounded-xl px-4 py-3 shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0">
                    {iconUser}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base text-blue-900 dark:text-blue-100 truncate">
                      {fromStaff.name}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                      <span className="font-mono">#{fromStaff.staffCode}</span>
                      <span className="mx-2">•</span>
                      <span>{(fromStaff as any).members?.length ?? 0} {ar ? 'عضو مرتبط' : 'members'}</span>
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-200 dark:bg-blue-900/50 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {ar ? 'من' : 'FROM'}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {ar ? 'إلى موظف' : 'To Staff'}
              </label>
              <select
                value={toStaffId}
                onChange={e => { setToStaffId(e.target.value); setConfirmTransfer(false) }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                <option value="">{ar ? '— اختر موظف —' : '— Select staff —'}</option>
                <option value="unassigned"> {ar ? 'إلغاء التعيين (بدون موظف)' : 'Unassign (no staff)'}</option>
                {staff.map(s => (
                  <option key={s.staffId} value={s.staffId} disabled={s.staffId === fromStaffId}>
                    {s.name} ({ar ? 'أعضاء:' : 'members:'} {(s as any).members?.length ?? 0})
                  </option>
                ))}
              </select>

              {/* 💼 بطاقة كبيرة بيظهر فيها اسم الموظف المختار أو "بدون موظف" */}
              {toStaffId === 'unassigned' && (
                <div className="mt-3 flex items-center gap-3 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/40 dark:to-red-800/30 ring-2 ring-red-300 dark:ring-red-700 rounded-xl px-4 py-3 shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0">
                    {iconBan}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-base text-red-900 dark:text-red-100">
                      {ar ? 'إلغاء التعيين' : 'Unassigned'}
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                      {ar ? 'البيانات ها تبقى بدون موظف مسؤول' : 'Items will have no owner'}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-red-700 dark:text-red-300 bg-red-200 dark:bg-red-900/50 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {ar ? 'إلى' : 'TO'}
                  </span>
                </div>
              )}
              {toStaff && toStaffId !== 'unassigned' && (
                <div className="mt-3 flex items-center gap-3 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/40 dark:to-emerald-800/30 ring-2 ring-emerald-300 dark:ring-emerald-700 rounded-xl px-4 py-3 shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    {iconUser}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base text-emerald-900 dark:text-emerald-100 truncate">
                      {toStaff.name}
                    </p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                      <span className="font-mono">#{toStaff.staffCode}</span>
                      <span className="mx-2">•</span>
                      <span>{(toStaff as any).members?.length ?? 0} {ar ? 'عضو مرتبط' : 'members'}</span>
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-200 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {ar ? 'إلى' : 'TO'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* اختيار أنواع البيانات للنقل */}
          {fromStaffId && toStaffId && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{ar ? 'انقل:' : 'Transfer:'}</p>
              <div className="flex gap-3 flex-wrap">
                {[
                  { key: 'members', label: ar ? 'الأعضاء' : 'Members' },
                  { key: 'followups', label: ar ? 'المتابعات' : 'Follow-ups' },
                  { key: 'dayuse', label: ar ? 'الزوار/داي يوز' : 'Visitors/Day Use' },
                  { key: 'invitations', label: ar ? 'الانفيتيشن' : 'Invitations' },
                ].map(opt => (
                  <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={transferTypes.includes(opt.key)}
                      onChange={e => {
                        setTransferTypes(prev =>
                          e.target.checked ? [...prev, opt.key] : prev.filter(t => t !== opt.key)
                        )
                        setConfirmTransfer(false)
                      }}
                      className="w-4 h-4 accent-primary-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* معاينة النقل */}
          {fromStaffId && toStaffId && transferTypes.length > 0 && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-4">
              <p className="text-sm text-orange-800 dark:text-orange-200 font-medium">
                 {(() => {
                  const typeLabels = transferTypes.map(t => {
                    if (t === 'members') return ar ? 'الأعضاء' : 'members'
                    if (t === 'followups') return ar ? 'المتابعات' : 'follow-ups'
                    if (t === 'dayuse') return ar ? 'الزوار/داي يوز' : 'day use'
                    if (t === 'invitations') return ar ? 'الانفيتيشن' : 'invitations'
                    return t
                  }).join(ar ? ' و ' : ' & ')

                  const dest = toStaffId === 'unassigned'
                    ? (ar ? 'إلى "بدون موظف"' : 'to "unassigned"')
                    : (ar ? `إلى "${toStaff?.name}"` : `to "${toStaff?.name}"`)

                  return ar
                    ? `هيتم نقل ${typeLabels} الخاصين بـ "${fromStaff?.name}" ${dest}`
                    : `Will transfer ${typeLabels} from "${fromStaff?.name}" ${dest}`
                })()}
              </p>
            </div>
          )}

          {!confirmTransfer ? (
            <button
              onClick={() => setConfirmTransfer(true)}
              disabled={!fromStaffId || !toStaffId || transferTypes.length === 0 || (toStaffId !== 'unassigned' && fromStaffId === toStaffId)}
              className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
               {ar ? 'نقل البيانات' : 'Transfer Data'}
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={handleTransfer}
                disabled={transferring}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
              >
                {transferring ? (ar ? 'جاري النقل...' : 'Transferring...') : (ar ? ' تأكيد النقل' : ' Confirm Transfer')}
              </button>
              <button
                onClick={() => setConfirmTransfer(false)}
                disabled={transferring}
                className="flex-1 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
              >
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

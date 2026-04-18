'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'

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
  const [toStaffId, setToStaffId] = useState('')  // 'unassigned' = إلغاء التعيين
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
          <div key={i} className="animate-pulse h-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        ))}
      </div>
    )
  }

  if (staff.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <div className="text-4xl mb-3">💼</div>
        <p>{ar ? 'لا يوجد موظفو سيلز' : 'No sales staff found'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* ── قسم توزيع الغير مُسنَّدين ── */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
          📤 {ar ? 'توزيع الغير مُسنَّدين' : 'Assign Unassigned'}
        </h2>

        {/* بطاقات الإحصاء */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-300">{unassigned.membersCount}</p>
            <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">{ar ? 'عضو بدون سيلز' : 'Unassigned Members'}</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">{unassigned.followUpsCount}</p>
            <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">{ar ? 'متابعة بدون موظف' : 'Unassigned Follow-ups'}</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{unassigned.dayUseCount}</p>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">{ar ? 'داي يوز بدون سيلز' : 'Unassigned Day Use'}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-green-700 dark:text-green-300">{unassigned.invitationCount}</p>
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">{ar ? 'انفيتيشن بدون سيلز' : 'Unassigned Invitations'}</p>
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
                    🔀 {ar ? 'توزيع تلقائي بالتساوي بين السيلز' : 'Auto round-robin'}
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" value="single" checked={assignMode === 'single'}
                    onChange={() => { setAssignMode('single'); setConfirmAssign(false) }}
                    className="accent-primary-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    👤 {ar ? 'تعيين لموظف محدد' : 'Assign to one staff'}
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
                className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                📤 {ar ? 'توزيع الآن' : 'Assign Now'}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ {(() => {
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
                    {assigning ? (ar ? 'جاري التوزيع...' : 'Assigning...') : (ar ? '✅ تأكيد' : '✅ Confirm')}
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
            <p className="text-2xl mb-2">✅</p>
            <p className="text-sm">{ar ? 'كل الأعضاء والمتابعات والزوار مُسنَّدين' : 'All members, follow-ups & visitors are assigned'}</p>
          </div>
        )}
      </div>

      {/* ── قسم نقل البيانات بين السيلز ── */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
          🔄 {ar ? 'نقل البيانات بين موظفي السيلز' : 'Transfer Data Between Sales Staff'}
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
                <option value="unassigned">🚫 {ar ? 'إلغاء التعيين (بدون موظف)' : 'Unassign (no staff)'}</option>
                {staff.map(s => (
                  <option key={s.staffId} value={s.staffId} disabled={s.staffId === fromStaffId}>
                    {s.name} ({ar ? 'أعضاء:' : 'members:'} {(s as any).members?.length ?? 0})
                  </option>
                ))}
              </select>
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
                ⚠️ {(() => {
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
              🔄 {ar ? 'نقل البيانات' : 'Transfer Data'}
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={handleTransfer}
                disabled={transferring}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
              >
                {transferring ? (ar ? 'جاري النقل...' : 'Transferring...') : (ar ? '✅ تأكيد النقل' : '✅ Confirm Transfer')}
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

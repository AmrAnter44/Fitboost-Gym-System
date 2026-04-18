'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'
import { usePermissions } from '../hooks/usePermissions'

interface CommissionTier { target: number; rate: number }

interface SalesStaffData {
  staffId: string
  name: string
  staffCode: string
  position: string | null
  salesCommissionType: 'fixed' | 'tiered' | null
  salesCommissionRate: number | null
  salesCommissionTiers: string | null   // JSON
  collectedThisMonth: number
  leadsCount: number
  leads: Array<{
    id: string; visitorName: string; visitorPhone: string
    stage: string; priority: string; contacted: boolean
    result: string | null; nextFollowUpDate: string | null; createdAt: string
  }>
  membersCount: number
  members: Array<{
    id: string; name: string; phone: string; memberNumber: number | null
    isActive: boolean; expiryDate: string | null; collectedThisMonth: number
  }>
}

// حساب العمولة
function calcCommission(collected: number, type: string | null, rate: number | null, tiersJson: string | null): number {
  if (!type) return 0
  if (type === 'fixed' && rate != null) return (collected * rate) / 100
  if (type === 'tiered' && tiersJson) {
    try {
      const tiers: CommissionTier[] = JSON.parse(tiersJson)
      const sorted = [...tiers].sort((a, b) => a.target - b.target)
      let commRate = 0
      for (const tier of sorted) {
        if (collected >= tier.target) commRate = tier.rate
      }
      return (collected * commRate) / 100
    } catch { return 0 }
  }
  return 0
}

const STAGE_LABELS: Record<string, { ar: string; en: string; color: string }> = {
  new: { ar: 'جديد', en: 'New', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  contacted: { ar: 'تم التواصل', en: 'Contacted', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  interested: { ar: 'مهتم', en: 'Interested', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  negotiating: { ar: 'في المفاوضة', en: 'Negotiating', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  converted: { ar: 'اشترك', en: 'Converted', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  lost: { ar: 'خسرناه', en: 'Lost', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
}

export default function CollectionDashboard() {
  const { locale } = useLanguage()
  const toast = useToast()
  const { user } = usePermissions()
  const ar = locale === 'ar'

  const [data, setData] = useState<SalesStaffData[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null)

  // Commission editing
  const [editingCommission, setEditingCommission] = useState<string | null>(null) // staffId
  const [commForm, setCommForm] = useState<{
    type: 'fixed' | 'tiered' | ''
    rate: string
    tiers: CommissionTier[]
  }>({ type: '', rate: '', tiers: [] })
  const [savingComm, setSavingComm] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/followups/sales')
      if (res.ok) {
        const json = await res.json()
        setData(json?.staff ?? [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const openCommEditor = (staff: SalesStaffData) => {
    setEditingCommission(staff.staffId)
    let tiers: CommissionTier[] = []
    if (staff.salesCommissionTiers) {
      try { tiers = JSON.parse(staff.salesCommissionTiers) } catch {}
    }
    setCommForm({
      type: (staff.salesCommissionType as any) || '',
      rate: staff.salesCommissionRate?.toString() || '',
      tiers: tiers.length > 0 ? tiers : [{ target: 0, rate: 0 }]
    })
  }

  const saveCommission = async (staffId: string) => {
    try {
      setSavingComm(true)
      const body: any = { id: staffId }
      if (commForm.type === 'fixed') {
        body.salesCommissionType = 'fixed'
        body.salesCommissionRate = parseFloat(commForm.rate) || 0
        body.salesCommissionTiers = null
      } else if (commForm.type === 'tiered') {
        body.salesCommissionType = 'tiered'
        body.salesCommissionRate = null
        body.salesCommissionTiers = JSON.stringify(commForm.tiers.filter(t => t.target > 0))
      } else {
        body.salesCommissionType = null
        body.salesCommissionRate = null
        body.salesCommissionTiers = null
      }
      const res = await fetch('/api/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (res.ok) {
        setData(prev => prev.map(s => s.staffId === staffId ? {
          ...s,
          salesCommissionType: body.salesCommissionType,
          salesCommissionRate: body.salesCommissionRate,
          salesCommissionTiers: body.salesCommissionTiers,
        } : s))
        setEditingCommission(null)
        toast.success(ar ? 'تم حفظ إعدادات العمولة' : 'Commission saved')
      }
    } catch { toast.error(ar ? 'فشل الحفظ' : 'Failed') }
    finally { setSavingComm(false) }
  }

  const now = new Date()
  const monthName = now.toLocaleString(ar ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' })

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse h-40 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        ))}
      </div>
    )
  }

  // لو سيلز → يشوف بياناته بس
  const isSales = user?.isSales
  const myData = isSales && user?.staffId ? data.find(s => s.staffId === user.staffId) : null
  const displayData = isSales ? (myData ? [myData] : []) : data

  const totalCollected = displayData.reduce((s, d) => s + d.collectedThisMonth, 0)
  const totalCommission = displayData.reduce((s, d) => s + calcCommission(d.collectedThisMonth, d.salesCommissionType, d.salesCommissionRate, d.salesCommissionTiers), 0)

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4 text-center">
          <p className="text-sm text-green-600 dark:text-green-400 mb-1">{ar ? 'المحصّل' : 'Collected'} ({monthName})</p>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300">{totalCollected.toLocaleString()} {ar ? 'ج' : 'EGP'}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4 text-center">
          <p className="text-sm text-purple-600 dark:text-purple-400 mb-1">{ar ? 'العمولة المستحقة' : 'Commission Earned'}</p>
          <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{Math.round(totalCommission).toLocaleString()} {ar ? 'ج' : 'EGP'}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 text-center">
          <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">{ar ? 'الليدز النشطة' : 'Active Leads'}</p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{displayData.reduce((s, d) => s + d.leadsCount, 0)}</p>
        </div>
      </div>

      {/* Per-staff cards */}
      {displayData.map(staff => {
        const isExpanded = expandedStaff === staff.staffId
        const commission = calcCommission(staff.collectedThisMonth, staff.salesCommissionType, staff.salesCommissionRate, staff.salesCommissionTiers)
        const isEditingComm = editingCommission === staff.staffId

        return (
          <div key={staff.staffId} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-5 space-y-4">
              {/* Header row */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold text-lg">
                    {staff.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-100">{staff.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">#{staff.staffCode}</p>
                  </div>
                </div>

              </div>

              {/* Collected amount */}
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {ar ? 'المحصّل:' : 'Collected:'} <strong className="text-gray-900 dark:text-gray-100">{staff.collectedThisMonth.toLocaleString()} {ar ? 'ج' : 'EGP'}</strong>
              </div>

              {/* Commission summary */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex gap-3 text-sm flex-wrap">
                  <span className="text-purple-700 dark:text-purple-300 font-semibold">
                    💰 {ar ? 'العمولة:' : 'Commission:'} {Math.round(commission).toLocaleString()} {ar ? 'ج' : 'EGP'}
                    {staff.salesCommissionType === 'fixed' && staff.salesCommissionRate != null && (
                      <span className="text-gray-500 dark:text-gray-400 font-normal"> ({staff.salesCommissionRate}%)</span>
                    )}
                    {staff.salesCommissionType === 'tiered' && (
                      <span className="text-gray-500 dark:text-gray-400 font-normal"> ({ar ? 'شرائح' : 'tiered'})</span>
                    )}
                    {!staff.salesCommissionType && (
                      <span className="text-gray-400 font-normal"> — {ar ? 'غير محددة' : 'not set'}</span>
                    )}
                  </span>
                  <span className="text-blue-600 dark:text-blue-400">👥 {staff.leadsCount} {ar ? 'ليد' : 'leads'}</span>
                  <span className="text-emerald-600 dark:text-emerald-400">🏅 {staff.membersCount} {ar ? 'عضو' : 'members'}</span>
                </div>
                <div className="flex gap-2">
                  {!isSales && (
                    <button onClick={() => isEditingComm ? setEditingCommission(null) : openCommEditor(staff)}
                      className="text-xs px-3 py-1 border border-purple-300 dark:border-purple-600 text-purple-600 dark:text-purple-400 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20">
                      ⚙️ {ar ? 'إعداد العمولة' : 'Commission Setup'}
                    </button>
                  )}
                  {(staff.leadsCount > 0 || staff.membersCount > 0) && (
                    <button onClick={() => setExpandedStaff(isExpanded ? null : staff.staffId)}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline">
                      {isExpanded ? (ar ? 'إخفاء ▲' : 'Hide ▲') : (ar ? 'تفاصيل ▼' : 'Details ▼')}
                    </button>
                  )}
                </div>
              </div>

              {/* Commission editor (admin only) */}
              {isEditingComm && !isSales && (
                <div className="border border-purple-200 dark:border-purple-700 rounded-lg p-4 bg-purple-50 dark:bg-purple-900/10 space-y-3">
                  <p className="font-semibold text-purple-800 dark:text-purple-200 text-sm">⚙️ {ar ? 'إعداد نظام العمولة' : 'Commission Setup'}</p>

                  {/* Type selector */}
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { val: '', label: ar ? 'بدون عمولة' : 'No commission' },
                      { val: 'fixed', label: ar ? 'نسبة ثابتة' : 'Fixed %' },
                      { val: 'tiered', label: ar ? 'شرائح بالتارجت' : 'Target tiers' },
                    ].map(opt => (
                      <button key={opt.val}
                        onClick={() => setCommForm(prev => ({ ...prev, type: opt.val as any }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          commForm.type === opt.val
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-purple-400'
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Fixed rate input */}
                  {commForm.type === 'fixed' && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{ar ? 'النسبة %' : 'Rate %'}</label>
                      <input type="number" min="0" max="100" step="0.1"
                        value={commForm.rate}
                        onChange={e => setCommForm(prev => ({ ...prev, rate: e.target.value }))}
                        className="w-24 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                        placeholder="5"
                      />
                      <span className="text-sm text-gray-500">%</span>
                      {commForm.rate && staff.collectedThisMonth > 0 && (
                        <span className="text-xs text-purple-600 dark:text-purple-400">
                          = {Math.round(staff.collectedThisMonth * parseFloat(commForm.rate) / 100).toLocaleString()} {ar ? 'ج' : 'EGP'}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Tiered inputs */}
                  {commForm.type === 'tiered' && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400">{ar ? 'لو وصل التارجت → ياخد النسبة دي' : 'If collected ≥ target → gets this rate'}</p>
                      {commForm.tiers.map((tier, idx) => (
                        <div key={idx} className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-500 whitespace-nowrap">{ar ? 'تارجت' : 'Target'}</span>
                          <input type="number" min="0" step="100"
                            value={tier.target || ''}
                            onChange={e => setCommForm(prev => {
                              const t = [...prev.tiers]; t[idx] = { ...t[idx], target: parseFloat(e.target.value) || 0 }; return { ...prev, tiers: t }
                            })}
                            className="w-28 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                            placeholder="5000"
                          />
                          <span className="text-xs text-gray-500">→</span>
                          <input type="number" min="0" max="100" step="0.1"
                            value={tier.rate || ''}
                            onChange={e => setCommForm(prev => {
                              const t = [...prev.tiers]; t[idx] = { ...t[idx], rate: parseFloat(e.target.value) || 0 }; return { ...prev, tiers: t }
                            })}
                            className="w-20 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                            placeholder="3"
                          />
                          <span className="text-xs text-gray-500">%</span>
                          {commForm.tiers.length > 1 && (
                            <button onClick={() => setCommForm(prev => ({ ...prev, tiers: prev.tiers.filter((_, i) => i !== idx) }))}
                              className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
                          )}
                        </div>
                      ))}
                      <button onClick={() => setCommForm(prev => ({ ...prev, tiers: [...prev.tiers, { target: 0, rate: 0 }] }))}
                        className="text-xs text-purple-600 dark:text-purple-400 hover:underline">
                        + {ar ? 'إضافة شريحة' : 'Add tier'}
                      </button>
                      {staff.collectedThisMonth > 0 && (
                        <p className="text-xs text-purple-700 dark:text-purple-300 font-semibold">
                          {ar ? 'العمولة الحالية:' : 'Current commission:'} {Math.round(calcCommission(staff.collectedThisMonth, 'tiered', null, JSON.stringify(commForm.tiers))).toLocaleString()} {ar ? 'ج' : 'EGP'}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Save/Cancel */}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => saveCommission(staff.staffId)} disabled={savingComm}
                      className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50">
                      {savingComm ? '...' : (ar ? 'حفظ' : 'Save')}
                    </button>
                    <button onClick={() => setEditingCommission(null)}
                      className="px-4 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-500">
                      {ar ? 'إلغاء' : 'Cancel'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div className="border-t border-gray-200 dark:border-gray-700 p-5 bg-gray-50 dark:bg-gray-800/50 grid md:grid-cols-2 gap-6">
                {staff.leadsCount > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">👥 {ar ? 'الليدز النشطة' : 'Active Leads'}</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {staff.leads.map(lead => {
                        const stage = STAGE_LABELS[lead.stage] || STAGE_LABELS.new
                        return (
                          <div key={lead.id} className="bg-white dark:bg-gray-700 rounded-lg p-3 flex items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{lead.visitorName}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{lead.visitorPhone}</p>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stage.color}`}>
                              {ar ? stage.ar : stage.en}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {staff.membersCount > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">🏅 {ar ? 'الأعضاء المحوّلون' : 'Converted Members'}</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {staff.members.map(member => (
                        <div key={member.id} className="bg-white dark:bg-gray-700 rounded-lg p-3 flex items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-sm text-gray-900 dark:text-gray-100">
                              {member.memberNumber ? `#${member.memberNumber} ` : ''}{member.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{member.phone}</p>
                          </div>
                          <div className="text-right">
                            {member.collectedThisMonth > 0 && (
                              <p className="text-xs font-bold text-green-600 dark:text-green-400">
                                +{member.collectedThisMonth.toLocaleString()} {ar ? 'ج' : 'EGP'}
                              </p>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full ${member.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                              {member.isActive ? (ar ? 'نشط' : 'Active') : (ar ? 'منتهي' : 'Expired')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {displayData.length === 0 && (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <p className="text-4xl mb-3">👥</p>
          <p>{ar ? 'لا يوجد بيانات' : 'No data found'}</p>
        </div>
      )}
    </div>
  )
}

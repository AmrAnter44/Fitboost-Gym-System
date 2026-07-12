'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '../../../contexts/LanguageContext'
import { LoadingScreen } from '../../../components/Spinner'
import { useRouter } from 'next/navigation'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

const PAGE_SIZE = 50

interface AuditLog {
  id: string
  userId?: string
  userEmail?: string
  userName?: string
  userRole?: string
  action: string
  resource: string
  resourceId?: string
  resourceLabel?: string | null
  details?: string
  ipAddress?: string
  userAgent?: string
  status: string
  errorMessage?: string
  createdAt: string
}

interface ActiveSession {
  id: string
  userId: string
  userEmail: string
  userName: string
  userRole: string
  loginAt: string
  lastActivityAt: string
  ipAddress?: string
  userAgent?: string
  isActive: boolean
}

const ActionIcon = ({ action, className = 'w-5 h-5' }: { action: string; className?: string }) => {
  const path = (() => {
    switch (action) {
      case 'LOGIN':
        return 'M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9'
      case 'LOGOUT':
        return 'M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75'
      case 'LOGIN_FAILED':
      case 'ACCESS_DENIED':
        return 'M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636'
      case 'CREATE':
        return 'M12 4.5v15m7.5-7.5h-15'
      case 'UPDATE':
        return 'M16.862 4.487 18.549 2.799a2.122 2.122 0 1 1 3 3L19.862 7.487m-3-3L8.078 13.27a2 2 0 0 0-.5.831l-1.111 4.222 4.222-1.111a2 2 0 0 0 .832-.5l8.781-8.781m-3-3 3 3'
      case 'DELETE':
        return 'm14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0'
      case 'VIEW':
        return 'M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z'
      case 'PERMISSION_CHANGE':
        return 'M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z'
      case 'RATE_LIMIT_HIT':
        return 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z'
      default:
        return 'M16.862 4.487 18.549 2.799a2.122 2.122 0 1 1 3 3L19.862 7.487m-3-3L8.078 13.27a2 2 0 0 0-.5.831l-1.111 4.222 4.222-1.111a2 2 0 0 0 .832-.5l8.781-8.781m-3-3 3 3'
    }
  })()
  return (
    <svg {...stroke} className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  )
}

const actionTranslations: Record<string, string> = {
  LOGIN: 'تسجيل دخول',
  LOGOUT: 'تسجيل خروج',
  LOGIN_FAILED: 'فشل تسجيل الدخول',
  CREATE: 'إنشاء',
  UPDATE: 'تعديل',
  DELETE: 'حذف',
  VIEW: 'عرض',
  ACCESS_DENIED: 'رفض الوصول',
  PERMISSION_CHANGE: 'تغيير صلاحيات',
  PASSWORD_CHANGE: 'تغيير كلمة مرور',
  USER_ACTIVATE: 'تفعيل مستخدم',
  USER_DEACTIVATE: 'إيقاف مستخدم',
  EXPORT: 'تصدير بيانات',
  RATE_LIMIT_HIT: 'تجاوز الحد المسموح'
}

const resourceTranslations: Record<string, string> = {
  Member: 'عضو',
  Receipt: 'إيصال',
  User: 'مستخدم',
  Staff: 'موظف',
  PT: 'حصص مخصصة',
  Visitor: 'زائر',
  FollowUp: 'متابعة',
  Expense: 'مصروف',
  DayUse: 'يوم استخدام',
  SpaBooking: 'حجز SPA',
  Offer: 'عرض',
  Permission: 'صلاحيات',
  Auth: 'الدخول والخروج',
  System: 'النظام',
  StaffDeduction: 'خصم موظف',
  GroupClass: 'جروب كلاس',
  Nutrition: 'تغذية',
  Physiotherapy: 'علاج طبيعي',
  More: 'اشتراك More',
  Invitation: 'دعوة'
}

// أسماء العمليات الفرعية المخزنة في details.operation
const operationTranslations: Record<string, string> = {
  Renew: 'تجديد اشتراك',
  Freeze: 'تجميد اشتراك',
  Unfreeze: 'فك تجميد',
  Upgrade: 'ترقية باقة',
  PayRemaining: 'دفع مبلغ متبقي',
  Transfer: 'نقل اشتراك',
  TransferIdentity: 'نقل عضوية',
  Update: 'تعديل بيانات',
  UseSession: 'استخدام حصة',
  'apply-package-features': 'تطبيق مميزات الباقة'
}

// مسميات عربية لمفاتيح التفاصيل المخزنة
const detailKeyTranslations: Record<string, string> = {
  operation: 'العملية',
  memberName: 'اسم العضو',
  memberNumber: 'رقم العضوية',
  subscriptionPrice: 'سعر الاشتراك',
  paidAmount: 'المدفوع',
  remainingAmount: 'المتبقي',
  amount: 'المبلغ',
  totalAmount: 'الإجمالي',
  receiptNumber: 'رقم الإيصال',
  paymentMethod: 'طريقة الدفع',
  packageName: 'الباقة',
  packageType: 'نوع الباقة',
  sessions: 'عدد الحصص',
  price: 'السعر',
  reason: 'السبب',
  days: 'عدد الأيام',
  name: 'الاسم',
  email: 'البريد الإلكتروني',
  phone: 'رقم التليفون',
  resourceName: 'الاسم',
  targetUser: 'المستخدم المستهدف',
  changes: 'التغييرات',
  endpoint: 'المسار',
  attemptedEmail: 'البريد المُستخدم',
  serviceType: 'نوع الخدمة',
  description: 'الوصف',
  category: 'التصنيف',
  notes: 'ملاحظات',
  startDate: 'تاريخ البداية',
  endDate: 'تاريخ النهاية',
  oldExpiry: 'الانتهاء القديم',
  newExpiry: 'الانتهاء الجديد',
  discount: 'الخصم',
  quantity: 'الكمية',
  role: 'الدور',
  isActive: 'مفعّل'
}

const paymentMethodTranslations: Record<string, string> = {
  cash: 'كاش',
  card: 'فيزا',
  instapay: 'إنستاباي',
  wallet: 'محفظة'
}

// مفاتيح لا تُعرض في التفاصيل (مكررة أو تقنية)
const HIDDEN_DETAIL_KEYS = new Set(['timestamp', 'deletedAt', 'changedAt', 'deniedAt'])

const statusTranslations: Record<string, string> = {
  success: 'نجح',
  failure: 'فشل',
  warning: 'تحذير'
}

function parseDetailsJson(log: AuditLog): Record<string, any> | null {
  if (!log.details) return null
  try {
    const parsed = JSON.parse(log.details)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

// الجملة الرئيسية المفهومة للسجل
function buildSentence(log: AuditLog, details: Record<string, any> | null): string {
  const resourceName = resourceTranslations[log.resource] || log.resource
  const target = log.resourceLabel || null
  const operation = details?.operation ? operationTranslations[details.operation] || details.operation : null

  switch (log.action) {
    case 'LOGIN':
      return 'سجّل الدخول للنظام'
    case 'LOGOUT':
      return 'سجّل الخروج من النظام'
    case 'LOGIN_FAILED':
      return `محاولة دخول فاشلة${details?.attemptedEmail ? ` بالبريد "${details.attemptedEmail}"` : ''}`
    case 'CREATE':
      return `أضاف ${resourceName}${target ? `: ${target}` : ' جديد'}`
    case 'UPDATE':
      if (operation) return `${operation}${target ? ` — ${target}` : ''}`
      return `عدّل بيانات ${resourceName}${target ? `: ${target}` : ''}`
    case 'DELETE':
      return `حذف ${resourceName}${target ? `: ${target}` : ''}`
    case 'PERMISSION_CHANGE':
      return `غيّر صلاحيات${target ? `: ${target}` : ' مستخدم'}`
    case 'PASSWORD_CHANGE':
      return `غيّر كلمة مرور${target ? `: ${target}` : ''}`
    case 'USER_ACTIVATE':
      return `فعّل حساب${target ? `: ${target}` : ' مستخدم'}`
    case 'USER_DEACTIVATE':
      return `أوقف حساب${target ? `: ${target}` : ' مستخدم'}`
    case 'ACCESS_DENIED':
      return `محاولة وصول مرفوضة — ${resourceName}`
    case 'EXPORT':
      return `صدّر بيانات ${resourceName}`
    case 'VIEW':
      return `عرض ${resourceName}${target ? `: ${target}` : ''}`
    case 'RATE_LIMIT_HIT':
      return `تجاوز الحد المسموح من المحاولات${details?.endpoint ? ` (${details.endpoint})` : ''}`
    default:
      return `${actionTranslations[log.action] || log.action} — ${resourceName}${target ? `: ${target}` : ''}`
  }
}

// عرض قيمة تفصيلية بشكل مقروء
function formatDetailValue(key: string, value: any): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا'
  if (key === 'paymentMethod' && typeof value === 'string') {
    return paymentMethodTranslations[value.toLowerCase()] || value
  }
  if (key === 'operation' && typeof value === 'string') {
    return operationTranslations[value] || value
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value)
    if (!isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    }
  }
  if (typeof value === 'object') {
    // شكل {from, to} أو {old, new} → سهم تغيير
    if ('from' in value || 'to' in value) return `${value.from ?? '—'} ← ${value.to ?? '—'}`
    if ('old' in value || 'new' in value) return `${value.old ?? '—'} ← ${value.new ?? '—'}`
    return JSON.stringify(value)
  }
  return String(value)
}

const MONEY_KEYS = new Set(['subscriptionPrice', 'paidAmount', 'remainingAmount', 'amount', 'totalAmount', 'price', 'discount'])

export default function AuditPage() {
  const { direction } = useLanguage()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'logs' | 'sessions'>('logs')
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Filters
  const [actionFilter, setActionFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [resourceFilter, setResourceFilter] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const buildParams = useCallback((offset: number) => {
    const params = new URLSearchParams()
    params.append('limit', String(PAGE_SIZE))
    params.append('offset', String(offset))
    if (actionFilter) params.append('action', actionFilter)
    if (statusFilter) params.append('status', statusFilter)
    if (resourceFilter) params.append('resource', resourceFilter)
    if (userSearch) params.append('user', userSearch)
    if (startDate) params.append('startDate', `${startDate}T00:00:00`)
    if (endDate) params.append('endDate', `${endDate}T23:59:59`)
    return params
  }, [actionFilter, statusFilter, resourceFilter, userSearch, startDate, endDate])

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const response = await fetch(`/api/admin/audit-logs?${buildParams(0)}`)
      if (!response.ok) {
        if (response.status === 403) {
          router.push('/')
          return
        }
        throw new Error('Failed to fetch logs')
      }
      const data = await response.json()
      setLogs(data.logs || [])
      setTotal(data.total || 0)
    } catch (err) {
      setError('فشل جلب سجلات التدقيق')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [buildParams, router])

  const loadMore = async () => {
    try {
      setLoadingMore(true)
      const response = await fetch(`/api/admin/audit-logs?${buildParams(logs.length)}`)
      if (response.ok) {
        const data = await response.json()
        setLogs(prev => [...prev, ...(data.logs || [])])
        setTotal(data.total || 0)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingMore(false)
    }
  }

  const fetchSessions = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/active-sessions')
      if (!response.ok) {
        if (response.status === 403) {
          router.push('/')
          return
        }
        throw new Error('Failed to fetch sessions')
      }

      const data = await response.json()
      setSessions(data || [])
    } catch (err) {
      setError('فشل جلب الجلسات النشطة')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs()
    } else {
      fetchSessions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, fetchLogs])

  const formatTime = (dateString: string) =>
    new Intl.DateTimeFormat('ar-EG', { timeStyle: 'short' }).format(new Date(dateString))

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('ar-EG', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date)
  }

  const dayLabel = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)
    if (date.toDateString() === today.toDateString()) return 'اليوم'
    if (date.toDateString() === yesterday.toDateString()) return 'أمس'
    return new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date)
  }

  const getTimeSince = (dateString: string) => {
    const now = new Date()
    const then = new Date(dateString)
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)

    if (seconds < 60) return `منذ ${seconds} ثانية`
    if (seconds < 3600) return `منذ ${Math.floor(seconds / 60)} دقيقة`
    if (seconds < 86400) return `منذ ${Math.floor(seconds / 3600)} ساعة`
    return `منذ ${Math.floor(seconds / 86400)} يوم`
  }

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'OWNER':
      case 'ADMIN':
        return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
      case 'MANAGER':
        return 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
      case 'STAFF':
        return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
      case 'COACH':
        return 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
    }
  }

  const roleTranslations: Record<string, string> = {
    OWNER: 'مالك',
    ADMIN: 'مدير',
    MANAGER: 'مشرف',
    STAFF: 'موظف',
    COACH: 'كوتش'
  }

  // تجميع السجلات باليوم
  const groupedLogs: Array<{ day: string; items: AuditLog[] }> = []
  for (const log of logs) {
    const day = new Date(log.createdAt).toDateString()
    const last = groupedLogs[groupedLogs.length - 1]
    if (last && last.day === day) last.items.push(log)
    else groupedLogs.push({ day, items: [log] })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6" dir={direction}>
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        {/*  زرار رجوع — يرجع للصفحة اللي جه منها */}
        <button
          type="button"
          onClick={() => router.back()}
          className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center flex-shrink-0 transition-colors duration-200"
          aria-label={direction === 'rtl' ? 'رجوع' : 'Back'}
          title={direction === 'rtl' ? 'رجوع' : 'Back'}
        >
          <svg {...stroke} className={`w-5 h-5 ${direction === 'rtl' ? 'rotate-180' : ''}`} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
          <svg {...stroke} className="w-6 h-6" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            سجلات التدقيق والأمان
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            تتبع جميع العمليات والمستخدمين النشطين في النظام
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 mb-6">
        <div className="flex border-b border-gray-200 dark:border-gray-700" role="tablist">
          <button
            onClick={() => setActiveTab('logs')}
            role="tab"
            aria-selected={activeTab === 'logs'}
            className={`inline-flex items-center gap-2 px-6 py-4 font-bold text-sm transition-colors duration-200 ${
              activeTab === 'logs'
                ? 'border-b-2 border-primary-500 text-primary-700 dark:text-primary-400'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            <svg {...stroke} className="w-4 h-4" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            سجلات التدقيق
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            role="tab"
            aria-selected={activeTab === 'sessions'}
            className={`inline-flex items-center gap-2 px-6 py-4 font-bold text-sm transition-colors duration-200 ${
              activeTab === 'sessions'
                ? 'border-b-2 border-primary-500 text-primary-700 dark:text-primary-400'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            <span className="relative inline-flex w-2.5 h-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
              <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-green-500" />
            </span>
            المتصلين حالياً
          </button>
        </div>
      </div>

      {/* Audit Logs Tab */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-6">
            <h3 className="text-base font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <svg {...stroke} className="w-5 h-5 text-primary-600 dark:text-primary-400" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              فلاتر البحث
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">البحث عن مستخدم</label>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="اسم أو بريد إلكتروني..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">نوع العملية</label>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                >
                  <option value="">الكل</option>
                  <option value="CREATE">إنشاء</option>
                  <option value="UPDATE">تعديل</option>
                  <option value="DELETE">حذف</option>
                  <option value="LOGIN">تسجيل دخول</option>
                  <option value="LOGOUT">تسجيل خروج</option>
                  <option value="LOGIN_FAILED">فشل تسجيل دخول</option>
                  <option value="PERMISSION_CHANGE">تغيير صلاحيات</option>
                  <option value="ACCESS_DENIED">رفض وصول</option>
                  <option value="EXPORT">تصدير</option>
                  <option value="VIEW">عرض</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">القسم</label>
                <select
                  value={resourceFilter}
                  onChange={(e) => setResourceFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                >
                  <option value="">الكل</option>
                  <option value="Member">الأعضاء</option>
                  <option value="Receipt">الإيصالات</option>
                  <option value="Expense">المصروفات</option>
                  <option value="PT">الحصص المخصصة</option>
                  <option value="More">اشتراكات More</option>
                  <option value="GroupClass">جروب كلاس</option>
                  <option value="Nutrition">التغذية</option>
                  <option value="Physiotherapy">العلاج الطبيعي</option>
                  <option value="DayUse">يوم استخدام</option>
                  <option value="Visitor">الزوار</option>
                  <option value="FollowUp">المتابعات</option>
                  <option value="Staff">الموظفين</option>
                  <option value="User">المستخدمين</option>
                  <option value="Permission">الصلاحيات</option>
                  <option value="Offer">العروض</option>
                  <option value="Auth">الدخول والخروج</option>
                  <option value="System">النظام</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">الحالة</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                >
                  <option value="">الكل</option>
                  <option value="success">نجح</option>
                  <option value="failure">فشل</option>
                  <option value="warning">تحذير</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">من تاريخ</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">إلى تاريخ</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                />
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between flex-wrap gap-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                إجمالي السجلات: <span className="font-bold text-gray-900 dark:text-gray-100">{total}</span>
              </span>
              {(actionFilter || statusFilter || resourceFilter || userSearch || startDate || endDate) && (
                <button
                  onClick={() => {
                    setActionFilter('')
                    setStatusFilter('')
                    setResourceFilter('')
                    setUserSearch('')
                    setStartDate('')
                    setEndDate('')
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-bold transition-colors duration-200"
                >
                  <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                  مسح الفلاتر
                </button>
              )}
            </div>
          </div>

          {/* Logs List */}
          {loading ? (
            <LoadingScreen />
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/50 rounded-lg p-4 text-red-800 dark:text-red-300" role="alert">
              {error}
            </div>
          ) : logs.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-12 text-center text-gray-500 dark:text-gray-400">
              لا توجد سجلات
            </div>
          ) : (
            <div className="space-y-6">
              {groupedLogs.map(group => (
                <div key={group.day}>
                  {/* عنوان اليوم */}
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">{dayLabel(group.items[0].createdAt)}</h3>
                    <span className="text-xs text-gray-400 dark:text-gray-500">({group.items.length})</span>
                    <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
                  </div>

                  <div className="space-y-2">
                    {group.items.map(log => {
                      const details = parseDetailsJson(log)
                      const sentence = buildSentence(log, details)
                      const isExpanded = expandedId === log.id
                      const detailEntries = details
                        ? Object.entries(details).filter(([key]) => !HIDDEN_DETAIL_KEYS.has(key))
                        : []

                      return (
                        <div
                          key={log.id}
                          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 transition-colors duration-200"
                        >
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : log.id)}
                            className="w-full text-start p-4 flex items-center gap-3"
                          >
                            {/* Action Icon */}
                            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                              log.status === 'success' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' :
                              log.status === 'failure' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' :
                              'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                            }`}>
                              <ActionIcon action={log.action} className="w-5 h-5" />
                            </div>

                            <div className="flex-1 min-w-0">
                              {/* الجملة الرئيسية */}
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{sentence}</p>
                              {/* السطر الثاني: المستخدم + الوقت + الحالة */}
                              <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-500 dark:text-gray-400">
                                <span className="font-medium text-gray-700 dark:text-gray-300">{log.userName || log.userEmail || 'غير معروف'}</span>
                                {log.userRole && (
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${getRoleBadge(log.userRole)}`}>
                                    {roleTranslations[log.userRole] || log.userRole}
                                  </span>
                                )}
                                <span>•</span>
                                <span>{formatTime(log.createdAt)}</span>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px]">
                                  {resourceTranslations[log.resource] || log.resource}
                                </span>
                                {log.status !== 'success' && (
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                    log.status === 'failure'
                                      ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                                      : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                                  }`}>
                                    {statusTranslations[log.status] || log.status}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* سهم التوسيع */}
                            {(detailEntries.length > 0 || log.errorMessage || log.ipAddress) && (
                              <svg {...stroke} className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                              </svg>
                            )}
                          </button>

                          {/* التفاصيل الموسعة */}
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-700/60">
                              {log.errorMessage && (
                                <div className="bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/50 rounded-lg p-3 mb-3 mt-3">
                                  <p className="text-sm text-red-700 dark:text-red-300 font-medium">{log.errorMessage}</p>
                                </div>
                              )}

                              {detailEntries.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 mt-3 text-xs">
                                  {detailEntries.map(([key, value]) => (
                                    <div key={key} className="flex items-center justify-between gap-3 py-1 border-b border-gray-100 dark:border-gray-700/40">
                                      <span className="text-gray-500 dark:text-gray-400">{detailKeyTranslations[key] || key}</span>
                                      <span className="font-semibold text-gray-900 dark:text-gray-100 text-end break-all">
                                        {formatDetailValue(key, value)}{MONEY_KEYS.has(key) && typeof value === 'number' ? ' ج.م' : ''}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="flex items-center gap-4 text-[11px] text-gray-400 dark:text-gray-500 mt-3">
                                <span>{formatDate(log.createdAt)}</span>
                                {log.ipAddress && (
                                  <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{log.ipAddress}</code>
                                )}
                                {log.resourceId && (
                                  <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded" title="المعرّف الداخلي">{log.resourceId}</code>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* عرض المزيد */}
              {logs.length < total && (
                <div className="text-center">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-6 py-2.5 rounded-lg bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors duration-200"
                  >
                    {loadingMore ? 'جاري التحميل...' : `عرض المزيد (${total - logs.length} متبقي)`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Active Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="space-y-6">
          {loading ? (
            <LoadingScreen />
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/50 rounded-lg p-4 text-red-800 dark:text-red-300" role="alert">
              {error}
            </div>
          ) : sessions.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-12 text-center text-gray-500 dark:text-gray-400">
              لا توجد جلسات نشطة
            </div>
          ) : (
            <div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 mb-4">
                <div className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100">
                  <span className="relative inline-flex w-3 h-3">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex w-3 h-3 rounded-full bg-green-500" />
                  </span>
                  <span>{sessions.length} مستخدم متصل حالياً</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sessions.map((session) => (
                  <div key={session.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 transition-colors duration-200">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="min-w-0">
                        <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 truncate">{session.userName}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{session.userEmail}</p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${getRoleBadge(session.userRole)}`}>
                        {session.userRole}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <svg {...stroke} className="w-4 h-4 text-gray-400" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                        </svg>
                        <span>تسجيل الدخول:</span>
                        <span>{formatDate(session.loginAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg {...stroke} className="w-4 h-4 text-gray-400" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                        </svg>
                        <span>آخر نشاط:</span>
                        <span className="text-green-600 dark:text-green-400 font-bold">
                          {getTimeSince(session.lastActivityAt)}
                        </span>
                      </div>
                      {session.ipAddress && (
                        <div className="flex items-center gap-2">
                          <svg {...stroke} className="w-4 h-4 text-gray-400" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                          </svg>
                          <span>IP:</span>
                          <span className="font-mono text-xs">{session.ipAddress}</span>
                        </div>
                      )}
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
}

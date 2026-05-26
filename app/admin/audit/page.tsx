'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../../../contexts/LanguageContext'
import { LoadingScreen } from '../../../components/Spinner'
import { useRouter } from 'next/navigation'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface AuditLog {
  id: string
  userId?: string
  userEmail?: string
  userName?: string
  userRole?: string
  action: string
  resource: string
  resourceId?: string
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

export default function AuditPage() {
  const { t, locale, direction } = useLanguage()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'logs' | 'sessions'>('logs')
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [sessions, setSessions] = useState<ActiveSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [actionFilter, setActionFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [resourceFilter, setResourceFilter] = useState('')
  const [userSearch, setUserSearch] = useState('')

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (actionFilter) params.append('action', actionFilter)
      if (statusFilter) params.append('status', statusFilter)
      if (resourceFilter) params.append('resource', resourceFilter)
      if (userSearch) params.append('user', userSearch)

      const response = await fetch(`/api/admin/audit-logs?${params}`)
      if (!response.ok) {
        if (response.status === 403) {
          router.push('/')
          return
        }
        throw new Error('Failed to fetch logs')
      }

      const data = await response.json()
      setLogs(data.logs || [])
    } catch (err) {
      setError('فشل جلب سجلات التدقيق')
      console.error(err)
    } finally {
      setLoading(false)
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
  }, [activeTab, actionFilter, statusFilter, resourceFilter, userSearch])

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
    RATE_LIMIT_HIT: 'تجاوز الحد المسموح'
  }

  const resourceTranslations: Record<string, string> = {
    Member: 'عضو',
    Receipt: 'إيصال',
    User: 'مستخدم',
    Staff: 'موظف',
    PT: 'جلسة PT',
    Visitor: 'زائر',
    FollowUp: 'متابعة',
    Expense: 'مصروف',
    DayUse: 'استخدام يومي',
    SpaBooking: 'حجز SPA',
    Offer: 'عرض',
    Permission: 'صلاحية'
  }

  const parseDetails = (log: AuditLog) => {
    if (!log.details) return null

    try {
      const details = JSON.parse(log.details)

      if (log.action === 'CREATE') {
        if (log.resource === 'Member') {
          return `أضاف عضو جديد: ${details.name || 'غير محدد'}`
        }
        if (log.resource === 'Receipt') {
          return `أنشأ إيصال رقم: ${details.receiptNumber || log.resourceId || 'غير محدد'} - المبلغ: ${details.amount || '0'} جنيه`
        }
        if (log.resource === 'User') {
          return `أضاف مستخدم جديد: ${details.email || details.name || 'غير محدد'}`
        }
        if (log.resource === 'Staff') {
          return `أضاف موظف جديد: ${details.name || 'غير محدد'}`
        }
        if (log.resource === 'SpaBooking') {
          return `أنشأ حجز SPA لـ: ${details.memberName || 'غير محدد'} - ${details.serviceType || 'خدمة'}`
        }
      }

      if (log.action === 'DELETE') {
        if (log.resource === 'Receipt') {
          return `حذف إيصال رقم: ${details.receiptNumber || log.resourceId || 'غير محدد'}`
        }
        if (log.resource === 'Member') {
          return `حذف عضو: ${details.name || log.resourceId || 'غير محدد'}`
        }
        if (log.resource === 'User') {
          return `حذف مستخدم: ${details.email || details.name || log.resourceId || 'غير محدد'}`
        }
      }

      if (log.action === 'UPDATE') {
        if (log.resource === 'Member') {
          return `عدّل بيانات عضو: ${details.name || log.resourceId || 'غير محدد'}`
        }
        if (log.resource === 'Receipt') {
          return `عدّل إيصال رقم: ${details.receiptNumber || log.resourceId || 'غير محدد'}`
        }
        if (log.resource === 'Permission') {
          return `غيّر صلاحيات: ${details.userEmail || details.userName || 'مستخدم'}`
        }
      }

      return `${actionTranslations[log.action] || log.action} ${resourceTranslations[log.resource] || log.resource}${log.resourceId ? ` #${log.resourceId}` : ''}`
    } catch (e) {
      return null
    }
  }

  const statusTranslations: Record<string, string> = {
    success: 'نجح',
    failure: 'فشل',
    warning: 'تحذير'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('ar-EG', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date)
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6" dir={direction}>
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  <option value="LOGIN">تسجيل دخول</option>
                  <option value="LOGOUT">تسجيل خروج</option>
                  <option value="LOGIN_FAILED">فشل تسجيل دخول</option>
                  <option value="CREATE">إنشاء</option>
                  <option value="UPDATE">تعديل</option>
                  <option value="DELETE">حذف</option>
                  <option value="VIEW">عرض</option>
                  <option value="ACCESS_DENIED">رفض وصول</option>
                  <option value="PERMISSION_CHANGE">تغيير صلاحيات</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">نوع المورد</label>
                <select
                  value={resourceFilter}
                  onChange={(e) => setResourceFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                >
                  <option value="">الكل</option>
                  <option value="Member">أعضاء</option>
                  <option value="Receipt">إيصالات</option>
                  <option value="User">مستخدمين</option>
                  <option value="Staff">موظفين</option>
                  <option value="PT">جلسات PT</option>
                  <option value="Visitor">زوار</option>
                  <option value="FollowUp">متابعات</option>
                  <option value="SpaBooking">حجوزات SPA</option>
                  <option value="Expense">مصروفات</option>
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
            </div>

            {(actionFilter || statusFilter || resourceFilter || userSearch) && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setActionFilter('')
                    setStatusFilter('')
                    setResourceFilter('')
                    setUserSearch('')
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-bold transition-colors duration-200"
                >
                  <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                  مسح الفلاتر
                </button>
              </div>
            )}
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
            <div className="space-y-3">
              {logs.map((log) => {
                const detailsText = parseDetails(log)
                const resourceName = resourceTranslations[log.resource] || log.resource

                return (
                  <div key={log.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 transition-colors duration-200">
                    <div className="flex items-start gap-4">
                      {/* Action Icon */}
                      <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                        log.status === 'success' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' :
                        log.status === 'failure' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' :
                        'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                      }`}>
                        <ActionIcon action={log.action} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Header: User + Role */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="font-bold text-gray-900 dark:text-gray-100">
                            {log.userName || log.userEmail || 'مستخدم غير معروف'}
                          </span>
                          <span className="text-gray-400 dark:text-gray-500">•</span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getRoleBadge(log.userRole)}`}>
                            {log.userRole || 'مستخدم'}
                          </span>
                        </div>

                        {/* Main Action Description */}
                        <div className="mb-3">
                          {detailsText ? (
                            <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                              {detailsText}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              <span className="font-bold">{actionTranslations[log.action] || log.action}</span>
                              <span className="mx-2 text-gray-400">←</span>
                              <span>{resourceName}</span>
                              {log.resourceId && <span className="text-gray-500 dark:text-gray-400"> #{log.resourceId}</span>}
                            </p>
                          )}
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            log.status === 'success' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                            log.status === 'failure' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' :
                            'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                          }`}>
                            {log.status === 'success' && (
                              <svg {...stroke} className="w-3.5 h-3.5" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            )}
                            {log.status === 'failure' && (
                              <svg {...stroke} className="w-3.5 h-3.5" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                              </svg>
                            )}
                            {log.status === 'warning' && (
                              <svg {...stroke} className="w-3.5 h-3.5" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                              </svg>
                            )}
                            <span>{statusTranslations[log.status] || log.status}</span>
                          </span>
                        </div>

                        {/* Error Message */}
                        {log.errorMessage && (
                          <div className="bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/50 rounded-lg p-3 mb-3">
                            <div className="flex items-start gap-2">
                              <svg {...stroke} className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                              </svg>
                              <p className="text-sm text-red-700 dark:text-red-300 font-medium">{log.errorMessage}</p>
                            </div>
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
                          <span className="inline-flex items-center gap-1">
                            <svg {...stroke} className="w-3.5 h-3.5" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                            {formatDate(log.createdAt)}
                          </span>
                          {log.ipAddress && (
                            <span className="inline-flex items-center gap-1">
                              <svg {...stroke} className="w-3.5 h-3.5" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                              </svg>
                              <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{log.ipAddress}</code>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
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

'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../../../contexts/LanguageContext'
import { useRouter } from 'next/navigation'

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

  // Fetch audit logs
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

  // Fetch active sessions
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

  // Action translations and icons
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

  const actionIcons: Record<string, string> = {
    LOGIN: '🔐',
    LOGOUT: '👋',
    LOGIN_FAILED: '❌',
    CREATE: '➕',
    UPDATE: '✏️',
    DELETE: '🗑️',
    VIEW: '👁️',
    ACCESS_DENIED: '🚫',
    PERMISSION_CHANGE: '🔑',
    RATE_LIMIT_HIT: '⚠️'
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

  // Parse details to extract meaningful information
  const parseDetails = (log: AuditLog) => {
    if (!log.details) return null

    try {
      const details = JSON.parse(log.details)

      // For CREATE actions
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

      // For DELETE actions
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

      // For UPDATE actions
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

      // Generic fallback
      return `${actionTranslations[log.action] || log.action} ${resourceTranslations[log.resource] || log.resource}${log.resourceId ? ` #${log.resourceId}` : ''}`
    } catch (e) {
      return null
    }
  }

  // Status translations and colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800'
      case 'failure': return 'bg-red-100 text-red-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const statusTranslations: Record<string, string> = {
    success: 'نجح',
    failure: 'فشل',
    warning: 'تحذير'
  }

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('ar-EG', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date)
  }

  // Calculate time since
  const getTimeSince = (dateString: string) => {
    const now = new Date()
    const then = new Date(dateString)
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)

    if (seconds < 60) return `منذ ${seconds} ثانية`
    if (seconds < 3600) return `منذ ${Math.floor(seconds / 60)} دقيقة`
    if (seconds < 86400) return `منذ ${Math.floor(seconds / 3600)} ساعة`
    return `منذ ${Math.floor(seconds / 86400)} يوم`
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir={direction}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🔒 سجلات التدقيق والأمان
        </h1>
        <p className="text-gray-600">
          تتبع جميع العمليات والمستخدمين النشطين في النظام
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-6 py-4 font-medium transition ${
              activeTab === 'logs'
                ? 'border-b-2 border-primary-600 text-primary-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📋 سجلات التدقيق
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-6 py-4 font-medium transition ${
              activeTab === 'sessions'
                ? 'border-b-2 border-primary-600 text-primary-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🟢 المتصلين حالياً
          </button>
        </div>
      </div>

      {/* Audit Logs Tab */}
      {activeTab === 'logs' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              🔍 فلاتر البحث
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* User Search */}
              <div>
                <label className="block text-sm font-medium mb-2">البحث عن مستخدم</label>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="اسم أو بريد إلكتروني..."
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Action Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">نوع العملية</label>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">الكل</option>
                  <option value="LOGIN">🔐 تسجيل دخول</option>
                  <option value="LOGOUT">👋 تسجيل خروج</option>
                  <option value="LOGIN_FAILED">❌ فشل تسجيل دخول</option>
                  <option value="CREATE">➕ إنشاء</option>
                  <option value="UPDATE">✏️ تعديل</option>
                  <option value="DELETE">🗑️ حذف</option>
                  <option value="VIEW">👁️ عرض</option>
                  <option value="ACCESS_DENIED">🚫 رفض وصول</option>
                  <option value="PERMISSION_CHANGE">🔑 تغيير صلاحيات</option>
                </select>
              </div>

              {/* Resource Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">نوع المورد</label>
                <select
                  value={resourceFilter}
                  onChange={(e) => setResourceFilter(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">الكل</option>
                  <option value="Member">👤 أعضاء</option>
                  <option value="Receipt">🧾 إيصالات</option>
                  <option value="User">👨‍💼 مستخدمين</option>
                  <option value="Staff">👨‍💻 موظفين</option>
                  <option value="PT">🏋️ جلسات PT</option>
                  <option value="Visitor">👋 زوار</option>
                  <option value="FollowUp">📞 متابعات</option>
                  <option value="SpaBooking">💆 حجوزات SPA</option>
                  <option value="Expense">💸 مصروفات</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">الحالة</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">الكل</option>
                  <option value="success">✓ نجح</option>
                  <option value="failure">✗ فشل</option>
                  <option value="warning">⚠ تحذير</option>
                </select>
              </div>
            </div>

            {/* Clear Filters Button */}
            {(actionFilter || statusFilter || resourceFilter || userSearch) && (
              <div className="mt-4 pt-4 border-t">
                <button
                  onClick={() => {
                    setActionFilter('')
                    setStatusFilter('')
                    setResourceFilter('')
                    setUserSearch('')
                  }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition"
                >
                  ✖️ مسح الفلاتر
                </button>
              </div>
            )}
          </div>

          {/* Logs List */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
              {error}
            </div>
          ) : logs.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
              لا توجد سجلات
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => {
                const detailsText = parseDetails(log)
                const actionIcon = actionIcons[log.action] || '📝'
                const resourceName = resourceTranslations[log.resource] || log.resource

                return (
                  <div key={log.id} className="bg-white rounded-lg shadow-sm p-5 hover:shadow-md transition border border-gray-100">
                    <div className="flex items-start gap-4">
                      {/* Action Icon */}
                      <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                        log.status === 'success' ? 'bg-green-100' :
                        log.status === 'failure' ? 'bg-red-100' :
                        'bg-yellow-100'
                      }`}>
                        {actionIcon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Header: User + Action */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="font-bold text-gray-900">
                            {log.userName || log.userEmail || 'مستخدم غير معروف'}
                          </span>
                          <span className="text-gray-500">•</span>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            log.userRole === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                            log.userRole === 'MANAGER' ? 'bg-primary-100 text-primary-800' :
                            log.userRole === 'STAFF' ? 'bg-gray-100 text-gray-800' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {log.userRole || 'مستخدم'}
                          </span>
                        </div>

                        {/* Main Action Description */}
                        <div className="mb-3">
                          {detailsText ? (
                            <p className="text-base text-gray-800 font-medium">
                              {detailsText}
                            </p>
                          ) : (
                            <p className="text-base text-gray-800">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(log.status)}`}>
                                {actionTranslations[log.action] || log.action}
                              </span>
                              <span className="mx-2">←</span>
                              <span className="font-medium">{resourceName}</span>
                              {log.resourceId && <span className="text-gray-500"> #{log.resourceId}</span>}
                            </p>
                          )}
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${
                            log.status === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                            log.status === 'failure' ? 'bg-red-50 text-red-700 border border-red-200' :
                            'bg-yellow-50 text-yellow-700 border border-yellow-200'
                          }`}>
                            {log.status === 'success' && '✓'}
                            {log.status === 'failure' && '✗'}
                            {log.status === 'warning' && '⚠'}
                            <span>{statusTranslations[log.status] || log.status}</span>
                          </span>
                        </div>

                        {/* Error Message (if any) */}
                        {log.errorMessage && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                            <div className="flex items-start gap-2">
                              <span className="text-red-600 text-sm">⚠️</span>
                              <p className="text-sm text-red-700 font-medium">{log.errorMessage}</p>
                            </div>
                          </div>
                        )}

                        {/* Footer: Metadata */}
                        <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
                          <span className="flex items-center gap-1">
                            🕐 {formatDate(log.createdAt)}
                          </span>
                          {log.ipAddress && (
                            <span className="flex items-center gap-1">
                              🌐 <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{log.ipAddress}</code>
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
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
              {error}
            </div>
          ) : sessions.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
              لا توجد جلسات نشطة
            </div>
          ) : (
            <div>
              <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
                <div className="flex items-center gap-2 text-lg font-medium">
                  <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                  <span>{sessions.length} مستخدم متصل حالياً</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sessions.map((session) => (
                  <div key={session.id} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">{session.userName}</h3>
                        <p className="text-sm text-gray-600">{session.userEmail}</p>
                      </div>
                      <span className="px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-xs font-medium">
                        {session.userRole}
                      </span>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <span>🔐 تسجيل الدخول:</span>
                        <span>{formatDate(session.loginAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>⏱️ آخر نشاط:</span>
                        <span className="text-green-600 font-medium">
                          {getTimeSince(session.lastActivityAt)}
                        </span>
                      </div>
                      {session.ipAddress && (
                        <div className="flex items-center gap-2">
                          <span>🌐 IP:</span>
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

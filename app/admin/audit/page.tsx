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

  // Fetch audit logs
  const fetchLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (actionFilter) params.append('action', actionFilter)
      if (statusFilter) params.append('status', statusFilter)

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
  }, [activeTab, actionFilter, statusFilter])

  // Action translations
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
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📋 سجلات التدقيق
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`px-6 py-4 font-medium transition ${
              activeTab === 'sessions'
                ? 'border-b-2 border-blue-600 text-blue-600'
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
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">نوع العملية</label>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">الكل</option>
                  <option value="LOGIN">تسجيل دخول</option>
                  <option value="LOGOUT">تسجيل خروج</option>
                  <option value="LOGIN_FAILED">فشل تسجيل دخول</option>
                  <option value="DELETE">حذف</option>
                  <option value="ACCESS_DENIED">رفض وصول</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">الحالة</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">الكل</option>
                  <option value="success">نجح</option>
                  <option value="failure">فشل</option>
                  <option value="warning">تحذير</option>
                </select>
              </div>
            </div>
          </div>

          {/* Logs List */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
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
              {logs.map((log) => (
                <div key={log.id} className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(log.status)}`}>
                          {actionTranslations[log.action] || log.action}
                        </span>
                        <span className="text-sm text-gray-600">
                          {log.resource}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          log.status === 'success' ? 'bg-green-100 text-green-800' :
                          log.status === 'failure' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {statusTranslations[log.status] || log.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-700 mb-2">
                        <span className="font-medium">{log.userName || log.userEmail || 'مستخدم غير معروف'}</span>
                        {log.userRole && <span className="text-gray-500"> • {log.userRole}</span>}
                      </div>
                      {log.errorMessage && (
                        <div className="text-sm text-red-600 mb-2">
                          ⚠️ {log.errorMessage}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 flex items-center gap-4">
                        <span>🕐 {formatDate(log.createdAt)}</span>
                        {log.ipAddress && <span>🌐 {log.ipAddress}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Sessions Tab */}
      {activeTab === 'sessions' && (
        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
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
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
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

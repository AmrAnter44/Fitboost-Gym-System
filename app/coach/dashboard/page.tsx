'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '../../../hooks/usePermissions'
import PermissionDenied from '../../../components/PermissionDenied'
import { formatDateYMD } from '../../../lib/dateFormatter'
import dynamic from 'next/dynamic'
import { useToast } from '../../../contexts/ToastContext'

const QRScanner = dynamic(() => import('../../../components/QRScanner'), {
  ssr: false,
  loading: () => <div className="text-center py-4">جاري تحميل الكاميرا...</div>
})

interface PTSession {
  id: string
  ptNumber: number
  clientName: string
  coachName: string
  sessionDate: string
  notes?: string
  attended: boolean
  attendedAt?: string
  attendedBy?: string
  qrCode?: string
  qrCodeUsed: boolean
  pt: {
    phone: string
    sessionsRemaining: number
  }
}

interface User {
  id: string
  name: string
  email: string
  role: string
}

export default function CoachDashboardPage() {
  const router = useRouter()
  const { hasPermission, loading: permissionsLoading, user } = usePermissions()
  const toast = useToast()

  const [sessions, setSessions] = useState<PTSession[]>([])
  const [filteredSessions, setFilteredSessions] = useState<PTSession[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'attended'>('pending')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [showQRInput, setShowQRInput] = useState(false)
  const [qrCodeInput, setQrCodeInput] = useState('')
  const [showQRScanner, setShowQRScanner] = useState(false)

  useEffect(() => {
    if (!permissionsLoading && user) {
      fetchMySessions()
    }
  }, [permissionsLoading, user])

  useEffect(() => {
    applyFilters()
  }, [sessions, filterStatus, searchTerm, selectedDate])

  const fetchMySessions = async () => {
    try {
      setLoading(true)

      // جلب الجلسات - API يفلتر تلقائياً حسب الكوتش
      const response = await fetch('/api/pt/sessions')
      if (!response.ok) throw new Error('Failed to fetch sessions')

      const sessions = await response.json()

      setSessions(sessions)
    } catch (error) {
      console.error('Error fetching sessions:', error)
      toast.error('فشل تحميل الجلسات')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = [...sessions]

    // فلتر الحالة
    if (filterStatus === 'attended') {
      filtered = filtered.filter(s => s.attended)
    } else if (filterStatus === 'pending') {
      filtered = filtered.filter(s => !s.attended)
    }

    // فلتر البحث
    if (searchTerm) {
      filtered = filtered.filter(s =>
        s.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.ptNumber.toString().includes(searchTerm) ||
        (s.pt.phone && s.pt.phone.includes(searchTerm))
      )
    }

    // فلتر التاريخ
    if (selectedDate) {
      filtered = filtered.filter(s => {
        const sessionDate = new Date(s.sessionDate).toISOString().split('T')[0]
        return sessionDate === selectedDate
      })
    }

    // ترتيب حسب التاريخ (الأحدث أولاً)
    filtered.sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime())

    setFilteredSessions(filtered)
  }


  const handleQRCodeAttendance = async (qrCode?: string) => {
    const codeToUse = qrCode || qrCodeInput.trim()

    if (!codeToUse) {
      toast.warning('يرجى إدخال QR Code')
      return
    }

    try {
      const response = await fetch('/api/pt/sessions/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCode: codeToUse })
      })

      const result = await response.json()

      if (response.ok) {
        toast.success(`تم تسجيل حضور ${result.session.clientName} بنجاح!`)
        setQrCodeInput('')
        setShowQRInput(false)
        setShowQRScanner(false)
        fetchMySessions()
      } else {
        toast.error(result.error || 'QR Code غير صحيح')
      }
    } catch (error) {
      console.error('Error with QR code:', error)
      toast.error('حدث خطأ في تسجيل الحضور')
    }
  }

  const handleQRScan = (decodedText: string) => {
    console.log('QR Code scanned:', decodedText)
    handleQRCodeAttendance(decodedText)
  }

  const getSessionStatus = (session: PTSession) => {
    const now = new Date()
    const sessionDate = new Date(session.sessionDate)

    if (session.attended) {
      return { label: 'حضر', color: 'bg-green-100 text-green-800', icon: '✅' }
    }

    if (sessionDate > now) {
      return { label: 'قادمة', color: 'bg-blue-100 text-blue-800', icon: '🕐' }
    }

    return { label: 'لم يحضر', color: 'bg-red-100 text-red-800', icon: '❌' }
  }

  const stats = {
    total: sessions.length,
    attended: sessions.filter(s => s.attended).length,
    pending: sessions.filter(s => !s.attended).length,
    today: sessions.filter(s => {
      const sessionDate = new Date(s.sessionDate).toDateString()
      const today = new Date().toDateString()
      return sessionDate === today
    }).length
  }

  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-xl">جاري التحميل...</p>
        </div>
      </div>
    )
  }

  if (!hasPermission('canRegisterPTAttendance')) {
    return <PermissionDenied message="ليس لديك صلاحية تسجيل حضور PT. هذه الصفحة مخصصة للكوتشات فقط." />
  }

  return (
    <div className="container mx-auto p-3 sm:p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2 sm:gap-3">
          <span className="text-2xl sm:text-3xl">💪</span>
          <span>لوحة الكوتش - {user?.name}</span>
        </h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">حصصك التدريبية</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-5 shadow-lg">
          <p className="text-sm opacity-90 mb-1">إجمالي الحصص</p>
          <p className="text-4xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-5 shadow-lg">
          <p className="text-sm opacity-90 mb-1">تم الحضور</p>
          <p className="text-4xl font-bold">{stats.attended}</p>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-xl p-5 shadow-lg">
          <p className="text-sm opacity-90 mb-1">لم يحضر</p>
          <p className="text-4xl font-bold">{stats.pending}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-5 shadow-lg">
          <p className="text-sm opacity-90 mb-1">اليوم</p>
          <p className="text-4xl font-bold">{stats.today}</p>
        </div>
      </div>

      {/* QR Code Scanner Section */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl shadow-lg p-4 sm:p-6 mb-6">
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl sm:text-4xl">📱</span>
            <div>
              <h2 className="text-lg sm:text-xl font-bold">تسجيل حضور بـ QR Code</h2>
              <p className="text-xs sm:text-sm opacity-90">امسح أو أدخل الكود الخاص بالعميل</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowQRScanner(true)}
              className="bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2 w-full"
            >
              <span>📷</span>
              <span className="text-sm sm:text-base">مسح QR</span>
            </button>
            <button
              onClick={() => setShowQRInput(!showQRInput)}
              className="bg-white text-purple-600 px-4 py-3 rounded-lg hover:bg-gray-100 font-medium text-sm sm:text-base w-full"
            >
              {showQRInput ? 'إخفاء' : 'إدخال يدوي'}
            </button>
          </div>
        </div>

        {showQRInput && (
          <div className="bg-white rounded-lg p-4 mt-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={qrCodeInput}
                onChange={(e) => setQrCodeInput(e.target.value)}
                placeholder="أدخل رقم PT أو Barcode..."
                className="flex-1 px-4 py-3 border-2 border-purple-300 rounded-lg focus:outline-none focus:border-purple-500 font-mono text-gray-800"
                autoFocus
              />
              <button
                onClick={() => handleQRCodeAttendance()}
                disabled={!qrCodeInput.trim()}
                className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold"
              >
                ✅ تسجيل
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              💡 نصيحة: الصق الرقم من رسالة WhatsApp أو امسح Barcode
            </p>
            {qrCodeInput && (
              <div className="mt-3 bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-1">الكود المدخل ({qrCodeInput.length}):</p>
                <p className="font-mono text-sm text-purple-700 break-all">
                  {qrCodeInput}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">🔍 البحث</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث بالاسم، رقم PT، أو الهاتف..."
              className="w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">📅 التاريخ</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">📊 الحالة</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:border-blue-500"
            >
              <option value="all">الكل</option>
              <option value="pending">لم يحضر</option>
              <option value="attended">حضر</option>
            </select>
          </div>
        </div>

        {(searchTerm || selectedDate || filterStatus !== 'all') && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                setSearchTerm('')
                setSelectedDate('')
                setFilterStatus('all')
              }}
              className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-lg"
            >
              ✖️ مسح الفلاتر
            </button>
            <p className="text-sm text-gray-600 py-1">
              عرض {filteredSessions.length} من {sessions.length} حصة
            </p>
          </div>
        )}
      </div>

      {/* Sessions Table/Cards */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-xl">جاري التحميل...</p>
        </div>
      ) : (
        <>
          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {filteredSessions.map((session) => {
              const status = getSessionStatus(session)
              return (
                <div key={session.id} className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="font-bold text-blue-600 text-lg">#{session.ptNumber}</span>
                      <h3 className="font-bold text-lg mt-1">{session.clientName}</h3>
                      <p className="text-sm text-gray-600 font-mono">{session.pt.phone}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
                      <span>{status.icon}</span>
                      <span>{status.label}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div>
                      <p className="text-gray-500 text-xs">التاريخ</p>
                      <p className="font-medium">{formatDateYMD(session.sessionDate)}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(session.sessionDate).toLocaleTimeString('ar-EG', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">الحصص المتبقية</p>
                      <p className="font-bold text-2xl text-green-600">{session.pt.sessionsRemaining}</p>
                    </div>
                  </div>

                  {session.notes && (
                    <div className="mb-3">
                      <p className="text-gray-500 text-xs">ملاحظات</p>
                      <p className="text-sm">{session.notes}</p>
                    </div>
                  )}

                  {session.attended ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 font-medium flex items-center gap-1">
                          <span>✅</span>
                          <span>حضر</span>
                        </span>
                        {session.attendedBy && (
                          <span className="text-xs text-gray-600">• بواسطة: {session.attendedBy}</span>
                        )}
                      </div>
                      {session.attendedAt && (
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(session.attendedAt).toLocaleString('ar-EG')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
                      <span className="text-gray-500 text-sm">استخدم QR Code للتسجيل</span>
                    </div>
                  )}
                </div>
              )
            })}

            {filteredSessions.length === 0 && (
              <div className="text-center py-12 text-gray-500 bg-white rounded-lg">
                {searchTerm || selectedDate || filterStatus !== 'all' ? (
                  <>
                    <div className="text-5xl mb-3">🔍</div>
                    <p>لا توجد نتائج تطابق البحث</p>
                  </>
                ) : (
                  <>
                    <div className="text-5xl mb-3">💪</div>
                    <p>لا توجد حصص مسجلة لك حتى الآن</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-right">رقم PT</th>
                    <th className="px-4 py-3 text-right">العميل</th>
                    <th className="px-4 py-3 text-right">الهاتف</th>
                    <th className="px-4 py-3 text-right">التاريخ والوقت</th>
                    <th className="px-4 py-3 text-right">الحالة</th>
                    <th className="px-4 py-3 text-right">الحصص المتبقية</th>
                    <th className="px-4 py-3 text-right">ملاحظات</th>
                    <th className="px-4 py-3 text-right">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map((session) => {
                    const status = getSessionStatus(session)
                    return (
                      <tr key={session.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="font-bold text-blue-600">#{session.ptNumber}</span>
                        </td>
                        <td className="px-4 py-3 font-medium">{session.clientName}</td>
                        <td className="px-4 py-3 font-mono text-sm">{session.pt.phone}</td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{formatDateYMD(session.sessionDate)}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(session.sessionDate).toLocaleTimeString('ar-EG', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                            <span>{status.icon}</span>
                            <span>{status.label}</span>
                          </span>
                          {session.attended && session.attendedAt && (
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(session.attendedAt).toLocaleString('ar-EG')}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold text-lg">{session.pt.sessionsRemaining}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {session.notes || '-'}
                        </td>
                        <td className="px-4 py-3">
                          {session.attended ? (
                            <div className="text-sm">
                              <span className="text-green-600 font-medium flex items-center gap-1">
                                <span>✅</span>
                                <span>حضر</span>
                              </span>
                              {session.attendedBy && (
                                <p className="text-xs text-gray-500 mt-1">بواسطة: {session.attendedBy}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">استخدم QR Code للتسجيل</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {filteredSessions.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                {searchTerm || selectedDate || filterStatus !== 'all' ? (
                  <>
                    <div className="text-5xl mb-3">🔍</div>
                    <p>لا توجد نتائج تطابق البحث</p>
                  </>
                ) : (
                  <>
                    <div className="text-5xl mb-3">💪</div>
                    <p>لا توجد حصص مسجلة لك حتى الآن</p>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border-r-4 border-blue-500 p-4 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>💡 كيفية تسجيل الحضور:</strong>
        </p>
        <ol className="text-sm text-blue-800 mt-2 mr-6 list-decimal space-y-1">
          <li>اطلب من العميل إظهار QR Code الخاص باشتراكه</li>
          <li>استخدم زر "مسح QR" لمسح الكود باستخدام الكاميرا</li>
          <li>أو اطلب من العميل إدخال الكود يدوياً في حقل "الإدخال اليدوي"</li>
          <li>سيتم تسجيل الحضور تلقائياً وخصم حصة من اشتراكه</li>
        </ol>
      </div>

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <QRScanner
          onScan={handleQRScan}
          onError={(error) => {
            toast.error(error)
          }}
          isScanning={showQRScanner}
          onClose={() => setShowQRScanner(false)}
        />
      )}
    </div>
  )
}

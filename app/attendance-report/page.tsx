'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '../../hooks/usePermissions'
import { useLanguage } from '../../contexts/LanguageContext'
import PermissionDenied from '../../components/PermissionDenied'
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal'

interface Staff {
  id: string
  staffCode: string
  name: string
  position?: string
}

interface Attendance {
  id: string
  staffId: string
  staff: Staff
  checkIn: string
  checkOut: string | null
  duration: number | null
  notes: string | null
  createdAt: string
}

export default function AttendanceReportPage() {
  const router = useRouter()
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const { t, direction } = useLanguage()

  const getPositionLabel = (position: string | null | undefined): string => {
    if (!position) return '-'
    const POSITION_MAP: { [key: string]: string } = {
      'مدرب': 'trainer',
      'ريسبشن': 'receptionist',
      'بار': 'barista',
      'HK': 'housekeeping',
      'نظافة': 'housekeeping',
      'مدير': 'manager',
      'محاسب': 'accountant',
      'صيانة': 'maintenance',
      'أمن': 'security',
      'other': 'other',
    }
    const key = POSITION_MAP[position] || 'other'
    return t(`positions.${key}` as any)
  }

  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedStaff, setSelectedStaff] = useState<string>('')

  // تحديد الشهر والسنة
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth()) // 0-11
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())

  // Delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [attendanceToDelete, setAttendanceToDelete] = useState<Attendance | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchAttendance = async () => {
    setLoading(true)
    try {
      let url = '/api/attendance?'
      const params = []

      if (dateFrom) params.push(`dateFrom=${dateFrom}`)
      if (dateTo) params.push(`dateTo=${dateTo}`)
      if (selectedStaff) params.push(`staffId=${selectedStaff}`)

      url += params.join('&')

      const response = await fetch(url)
      const data = await response.json()

      // ✅ التحقق من أن البيانات array
      if (response.ok && Array.isArray(data)) {
        setAttendance(data)
      } else {
        console.error('Invalid attendance data:', data)
        setAttendance([])
      }
    } catch (error) {
      console.error('Error:', error)
      setAttendance([])
    } finally {
      setLoading(false)
    }
  }

  const fetchStaff = async () => {
    try {
      const response = await fetch('/api/staff')
      const data = await response.json()

      // ✅ التحقق من أن البيانات array
      if (response.ok && Array.isArray(data)) {
        setStaff(data.filter((s: any) => s.isActive))
      } else {
        console.error('Invalid staff data:', data)
        setStaff([])
      }
    } catch (error) {
      console.error('Error:', error)
      setStaff([])
    }
  }

  // دالة لتحديث التواريخ بناءً على الشهر والسنة
  const updateDatesFromMonth = (month: number, year: number) => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    const formatDate = (date: Date) => {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }

    setDateFrom(formatDate(firstDay))
    setDateTo(formatDate(lastDay))
  }

  useEffect(() => {
    fetchStaff()
    // تهيئة التواريخ للشهر الحالي عند التحميل
    updateDatesFromMonth(selectedMonth, selectedYear)
  }, [])

  useEffect(() => {
    fetchAttendance()
  }, [dateFrom, dateTo, selectedStaff])

  // تحديث التواريخ عند تغيير الشهر أو السنة
  const handleMonthChange = (month: number) => {
    setSelectedMonth(month)
    updateDatesFromMonth(month, selectedYear)
  }

  const handleYearChange = (year: number) => {
    setSelectedYear(year)
    updateDatesFromMonth(selectedMonth, year)
  }

  // أسماء الشهور
  const monthsAr = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ]

  const monthsEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const months = direction === 'rtl' ? monthsAr : monthsEn

  // إنشاء قائمة السنوات (من 2020 حتى السنة الحالية + 1)
  const years = Array.from(
    { length: currentDate.getFullYear() - 2019 + 1 },
    (_, i) => 2020 + i
  ).reverse() // ترتيب عكسي لعرض الأحدث أولاً

  const deleteAttendance = (record: Attendance) => {
    setAttendanceToDelete(record)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!attendanceToDelete) return

    setDeleteLoading(true)
    try {
      await fetch(`/api/attendance?id=${attendanceToDelete.id}`, { method: 'DELETE' })
      fetchAttendance()
      setShowDeleteModal(false)
      setAttendanceToDelete(null)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setDeleteLoading(false)
    }
  }

  // تنسيق مدة العمل
  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '-'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0
      ? t('attendanceReport.hoursAndMinutes', { hours: hours.toString(), minutes: mins.toString() })
      : t('attendanceReport.minutes', { minutes: mins.toString() })
  }

  // إحصائيات بسيطة
  const totalDays = attendance.length
  const uniqueStaff = new Set(attendance.map((a) => a.staffId)).size
  const today = new Date().toDateString()
  const todayCount = attendance.filter((a) => {
    const date = new Date(a.checkIn).toDateString()
    return date === today
  }).length

  // حساب إجمالي ساعات العمل
  const totalWorkMinutes = attendance.reduce((sum, att) => {
    return sum + (att.duration || 0)
  }, 0)
  const totalWorkHours = Math.floor(totalWorkMinutes / 60)
  const totalWorkDays = Math.floor(totalWorkHours / 8) // افتراض 8 ساعات = يوم عمل

  // إحصائيات حسب الموظف
  const staffStats = attendance.reduce(
    (acc, att) => {
      const staffId = att.staffId
      if (!acc[staffId]) {
        acc[staffId] = {
          staffCode: att.staff.staffCode,
          name: att.staff.name,
          position: att.staff.position,
          totalDays: 0,
        }
      }

      acc[staffId].totalDays += 1

      return acc
    },
    {} as Record<
      string,
      { staffCode: string; name: string; position?: string; totalDays: number }
    >
  )

  // ✅ التحقق من الصلاحيات
  if (permissionsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl">{t('attendanceReport.loading')}</div>
      </div>
    )
  }

  if (!hasPermission('canViewReports')) {
    return <PermissionDenied message={t('attendanceReport.noPermission')} />
  }

  return (
    <div className="container mx-auto p-6" dir={direction}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">📊 {t('attendanceReport.title')}</h1>
          <p className="text-gray-600">{t('attendanceReport.subtitle')}</p>
        </div>
        <button
          onClick={() => router.push('/staff')}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          {direction === 'rtl' ? '←' : '→'} {t('attendanceReport.backToStaff')}
        </button>
      </div>

      {/* اختيار الشهر والسنة */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl shadow-lg p-6 mb-6 border-2 border-blue-200">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span>📅</span>
          <span>{direction === 'rtl' ? 'اختر الشهر' : 'Select Month'}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold mb-2">
              {direction === 'rtl' ? 'الشهر' : 'Month'}
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(Number(e.target.value))}
              className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:border-blue-500 transition font-bold text-lg bg-white"
            >
              {months.map((month, index) => (
                <option key={index} value={index}>
                  {month}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">
              {direction === 'rtl' ? 'السنة' : 'Year'}
            </label>
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg focus:border-blue-500 transition font-bold text-lg bg-white"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* عرض الفترة المختارة */}
        <div className="mt-4 p-3 bg-blue-100 rounded-lg border-2 border-blue-300">
          <p className="text-sm text-blue-800 text-center">
            <span className="font-bold">{direction === 'rtl' ? 'الفترة المختارة:' : 'Selected Period:'}</span>
            {' '}
            {dateFrom} {direction === 'rtl' ? 'إلى' : 'to'} {dateTo}
          </p>
        </div>
      </div>

      {/* فلاتر البحث */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-gray-200">
        <h3 className="text-xl font-bold mb-4">🔍 {t('attendanceReport.searchFilters')}</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-bold mb-2">{t('attendanceReport.dateFrom')}</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">{t('attendanceReport.dateTo')}</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2">{t('attendanceReport.staff')}</label>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 transition"
            >
              <option value="">{t('attendanceReport.all')}</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.staffCode} - {s.name} {s.position && `(${s.position})`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm mb-1">{t('attendanceReport.totalAttendanceDays')}</p>
              <p className="text-4xl font-bold">{totalDays}</p>
            </div>
            <div className="text-5xl opacity-20">📊</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm mb-1">{t('attendanceReport.todayAttendance')}</p>
              <p className="text-4xl font-bold">{todayCount}</p>
            </div>
            <div className="text-5xl opacity-20">📅</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm mb-1">{t('attendanceReport.staffCount')}</p>
              <p className="text-4xl font-bold">{uniqueStaff}</p>
            </div>
            <div className="text-5xl opacity-20">👥</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm mb-1">{t('attendanceReport.totalWorkHours')}</p>
              <p className="text-4xl font-bold">{totalWorkHours}</p>
              <p className="text-orange-100 text-xs mt-1">({t('attendanceReport.workDays', { days: totalWorkDays.toString() })})</p>
            </div>
            <div className="text-5xl opacity-20">⏰</div>
          </div>
        </div>
      </div>

      {/* إحصائيات الموظفين */}
      {Object.keys(staffStats).length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h3 className="text-xl font-bold mb-4">📋 {t('attendanceReport.staffStatistics')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(staffStats)
              .sort((a, b) => b[1].totalDays - a[1].totalDays)
              .map(([staffId, stats]) => (
                <div
                  key={staffId}
                  className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border-2 border-gray-200"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-lg">{stats.name}</p>
                      <p className="text-xs text-gray-500">
                        #{stats.staffCode} {stats.position && `• ${stats.position}`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="bg-blue-100 rounded-lg p-2 text-center">
                      <p className="text-xs text-blue-600 mb-1">{t('attendanceReport.attendanceDays')}</p>
                      <p className="text-2xl font-bold text-blue-600">{stats.totalDays}</p>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* سجلات الحضور بتصميم Cards */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600">
          <h3 className="text-xl font-bold text-white">📋 {t('attendanceReport.attendanceRecords')}</h3>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">{t('attendanceReport.loading')}</div>
        ) : attendance.length > 0 ? (
          <div className="p-6 space-y-4">
            {attendance.map((att) => {
              const checkInTime = new Date(att.checkIn)
              const checkOutTime = att.checkOut ? new Date(att.checkOut) : null
              const currentTime = new Date()

              // التحقق إذا كان السجل من اليوم الحالي
              const isToday = checkInTime.toDateString() === currentTime.toDateString()
              const isActuallyInside = att.checkOut === null && isToday

              // حساب الساعات الفعلية
              let actualMinutes = att.duration || 0
              if (!att.checkOut) {
                // إذا كان السجل من اليوم الحالي، احسب حتى الآن
                if (isToday) {
                  actualMinutes = Math.floor((currentTime.getTime() - checkInTime.getTime()) / (1000 * 60))
                } else {
                  // إذا كان سجل قديم، لا تحسب (سيظهر 0)
                  actualMinutes = 0
                }
              }

              const hours = Math.floor(actualMinutes / 60)
              const minutes = actualMinutes % 60

              return (
                <div
                  key={att.id}
                  className={`border-2 rounded-xl p-6 transition hover:shadow-lg ${
                    isActuallyInside
                      ? 'bg-green-50 border-green-300'
                      : att.checkOut === null
                      ? 'bg-red-50 border-red-300'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  {/* Header: التاريخ والاسم */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-lg">
                          #{att.staff.staffCode}
                        </span>
                        <div>
                          <h3 className="text-xl font-bold text-gray-800">{att.staff.name}</h3>
                          <p className="text-sm text-gray-600">{getPositionLabel(att.staff.position)}</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500">
                        📅 {checkInTime.toLocaleDateString('ar-EG', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={() => deleteAttendance(att)}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
                    >
                      <span>🗑️</span>
                      <span className="text-sm font-semibold">{t('attendanceReport.delete')}</span>
                    </button>
                  </div>

                  {/* الأوقات والساعات */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* وقت الدخول */}
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">🕐</span>
                        <p className="text-xs font-bold text-blue-700">{t('attendanceReport.checkInTime')}</p>
                      </div>
                      <p className="text-2xl font-bold text-blue-800">
                        {checkInTime.toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        {checkInTime.toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { weekday: 'short' })}
                      </p>
                    </div>

                    {/* وقت الخروج */}
                    <div
                      className={`border-2 rounded-lg p-4 ${
                        checkOutTime
                          ? 'bg-orange-50 border-orange-200'
                          : 'bg-yellow-50 border-yellow-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">🕐</span>
                        <p className="text-xs font-bold text-orange-700">{t('attendanceReport.checkOutTime')}</p>
                      </div>
                      {checkOutTime ? (
                        <>
                          <p className="text-2xl font-bold text-orange-800">
                            {checkOutTime.toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </p>
                          <p className="text-xs text-orange-600 mt-1">
                            {checkOutTime.toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { weekday: 'short' })}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-lg font-bold text-yellow-800">{t('attendanceReport.notCheckedOut')}</p>
                          <p className="text-xs text-yellow-600 mt-1">{t('attendanceReport.working')}</p>
                        </>
                      )}
                    </div>

                    {/* ساعات العمل */}
                    <div
                      className={`border-2 rounded-lg p-4 ${
                        att.checkOut
                          ? 'bg-purple-50 border-purple-200'
                          : 'bg-green-50 border-green-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">⏱️</span>
                        <p className="text-xs font-bold text-purple-700">{t('attendanceReport.workHours')}</p>
                      </div>

                      {hours === 0 && minutes === 0 ? (
                        <p className="text-lg font-bold text-gray-600">
                          {att.checkOut === null && !isToday ? t('attendanceReport.notCalculated') : t('attendanceReport.justStarted')}
                        </p>
                      ) : (
                        <div className="flex gap-2 justify-center">
                          {hours > 0 && (
                            <div className="bg-white border-2 border-purple-300 rounded-lg px-3 py-2 flex-1 text-center">
                              <div className="text-2xl font-bold text-purple-800">{hours}</div>
                              <div className="text-xs text-purple-600">ساعة</div>
                            </div>
                          )}
                          {minutes > 0 && (
                            <div className="bg-white border-2 border-blue-300 rounded-lg px-3 py-2 flex-1 text-center">
                              <div className="text-2xl font-bold text-blue-800">{minutes}</div>
                              <div className="text-xs text-blue-600">دقيقة</div>
                            </div>
                          )}
                        </div>
                      )}

                      <p
                        className={`text-xs mt-2 font-semibold text-center ${
                          att.checkOut ? 'text-purple-600' : 'text-green-600'
                        }`}
                      >
                        {att.checkOut ? `✅ ${t('attendanceReport.finished')}` : `⏳ ${t('attendanceReport.workingNow')}`}
                      </p>
                    </div>

                    {/* الحالة */}
                    <div className="flex items-center justify-center">
                      {isActuallyInside ? (
                        <div className="bg-green-500 text-white rounded-xl p-4 text-center shadow-lg animate-pulse w-full">
                          <div className="text-4xl mb-2">🟢</div>
                          <p className="font-bold text-lg">{t('attendanceReport.inside')}</p>
                          <p className="text-xs text-green-100">{t('attendanceReport.presentNow')}</p>
                        </div>
                      ) : att.checkOut === null ? (
                        <div className="bg-red-500 text-white rounded-xl p-4 text-center w-full border-2 border-red-700">
                          <div className="text-4xl mb-2">⚠️</div>
                          <p className="font-bold text-lg">{t('attendanceReport.missingCheckout')}</p>
                          <p className="text-xs text-red-100">{t('attendanceReport.oldRecord')}</p>
                        </div>
                      ) : (
                        <div className="bg-gray-500 text-white rounded-xl p-4 text-center w-full">
                          <div className="text-4xl mb-2">🔴</div>
                          <p className="font-bold text-lg">{t('attendanceReport.outside')}</p>
                          <p className="text-xs text-gray-100">{t('attendanceReport.leftWork')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-xl">{t('attendanceReport.noRecords')}</p>
            <p className="text-sm mt-2">{t('attendanceReport.tryChangingFilters')}</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setAttendanceToDelete(null)
        }}
        onConfirm={confirmDelete}
        title={t('attendanceReport.deleteRecordTitle')}
        message={t('attendanceReport.deleteRecordMessage')}
        itemName={attendanceToDelete ? `${attendanceToDelete.staff.name} - ${new Date(attendanceToDelete.checkIn).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}` : ''}
        loading={deleteLoading}
      />
    </div>
  )
}

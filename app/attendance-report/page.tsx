'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '../../hooks/usePermissions'
import { useLanguage } from '../../contexts/LanguageContext'
import PermissionDenied from '../../components/PermissionDenied'
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal'
import { LoadingScreen } from '../../components/Spinner'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

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
  const { hasPermission, isAdmin, loading: permissionsLoading } = usePermissions()
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

  // Manual entry / edit modal
  const [showManualModal, setShowManualModal] = useState(false)
  const [manualEditId, setManualEditId] = useState<string | null>(null)
  const [manualForm, setManualForm] = useState({
    staffId: '',
    date: '',
    checkInTime: '',
    checkOutTime: '',
    notes: '',
  })
  const [manualSaving, setManualSaving] = useState(false)

  const todayYMD = () => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const openManualAdd = () => {
    setManualEditId(null)
    setManualForm({ staffId: '', date: todayYMD(), checkInTime: '', checkOutTime: '', notes: '' })
    setShowManualModal(true)
  }

  const openManualEdit = (att: Attendance) => {
    const inD = new Date(att.checkIn)
    const outD = att.checkOut ? new Date(att.checkOut) : null
    const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const fmtTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    setManualEditId(att.id)
    setManualForm({
      staffId: att.staffId,
      date: fmtDate(inD),
      checkInTime: fmtTime(inD),
      checkOutTime: outD ? fmtTime(outD) : '',
      notes: att.notes || '',
    })
    setShowManualModal(true)
  }

  const closeManualModal = () => {
    if (manualSaving) return
    setShowManualModal(false)
    setManualEditId(null)
  }

  const submitManualForm = async () => {
    if (!manualForm.staffId || !manualForm.date || !manualForm.checkInTime) {
      alert(direction === 'rtl' ? 'الموظف والتاريخ ووقت الحضور مطلوبين' : 'Staff, date, and check-in time are required')
      return
    }
    const checkInISO = new Date(`${manualForm.date}T${manualForm.checkInTime}:00`).toISOString()
    let checkOutISO: string | null = null
    if (manualForm.checkOutTime) {
      // لو وقت الانصراف قبل الحضور بالعدد (نص الليل مثلاً) — نخليه نفس التاريخ، ولو طلع <= الحضور هيرجّع خطأ من السيرفر
      checkOutISO = new Date(`${manualForm.date}T${manualForm.checkOutTime}:00`).toISOString()
    }

    setManualSaving(true)
    try {
      const url = '/api/attendance'
      const method = manualEditId ? 'PUT' : 'POST'
      const body: any = manualEditId
        ? { id: manualEditId, checkIn: checkInISO, checkOut: checkOutISO, notes: manualForm.notes }
        : { staffId: manualForm.staffId, checkIn: checkInISO, checkOut: checkOutISO, notes: manualForm.notes }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) {
        alert(data.error || (direction === 'rtl' ? 'فشل الحفظ' : 'Save failed'))
        return
      }

      setShowManualModal(false)
      setManualEditId(null)
      fetchAttendance()
    } catch (e) {
      console.error(e)
      alert(direction === 'rtl' ? 'حدث خطأ في الاتصال' : 'Connection error')
    } finally {
      setManualSaving(false)
    }
  }

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

      // التحقق من أن البيانات array
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
    // التحقق من صلاحية عرض الموظفين
    if (!hasPermission('canViewStaff')) {
      setStaff([])
      return
    }

    try {
      const response = await fetch('/api/staff')
      const data = await response.json()

      // التحقق من أن البيانات array
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

  if (permissionsLoading) {
    return <LoadingScreen fullScreen message={t('attendanceReport.loading')} />
  }

  if (!hasPermission('canViewReports')) {
    return <PermissionDenied message={t('attendanceReport.noPermission')} />
  }

  return (
    <div className="container mx-auto p-6" dir={direction}>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
            <svg {...stroke} className="w-6 h-6" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{t('attendanceReport.title')}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('attendanceReport.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <button
              onClick={openManualAdd}
              className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 text-sm"
            >
              <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>{direction === 'rtl' ? 'إدخال حضور يدوي' : 'Add Manual Attendance'}</span>
            </button>
          )}
          <button
            onClick={() => router.push('/staff')}
            className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 text-sm"
          >
            <svg {...stroke} className={`w-4 h-4 ${direction === 'rtl' ? 'rotate-180' : ''}`} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            <span>{t('attendanceReport.backToStaff')}</span>
          </button>
        </div>
      </div>

      {/* Month/Year picker */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 mb-6">
        <h3 className="text-base font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
          <svg {...stroke} className="w-5 h-5 text-primary-600 dark:text-primary-400" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
          <span>{direction === 'rtl' ? 'اختر الشهر' : 'Select Month'}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{direction === 'rtl' ? 'الشهر' : 'Month'}</label>
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 font-bold"
            >
              {months.map((month, index) => (
                <option key={index} value={index}>{month}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{direction === 'rtl' ? 'السنة' : 'Year'}</label>
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 font-bold"
            >
              {years.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg">
          <p className="text-sm text-gray-700 dark:text-gray-300 text-center">
            <span className="font-bold">{direction === 'rtl' ? 'الفترة المختارة:' : 'Selected Period:'}</span>
            
            {dateFrom} {direction === 'rtl' ? 'إلى' : 'to'} {dateTo}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 mb-6">
        <h3 className="text-base font-bold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <svg {...stroke} className="w-5 h-5 text-primary-600 dark:text-primary-400" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <span>{t('attendanceReport.searchFilters')}</span>
        </h3>

        <div className="max-w-md">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">{t('attendanceReport.staff')}</label>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          {
            label: t('attendanceReport.totalAttendanceDays'),
            value: totalDays,
            tone: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
            icon: (<path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />)
          },
          {
            label: t('attendanceReport.todayAttendance'),
            value: todayCount,
            tone: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
            icon: (<path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />)
          },
          {
            label: t('attendanceReport.staffCount'),
            value: uniqueStaff,
            tone: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
            icon: (<path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />)
          },
          {
            label: t('attendanceReport.totalWorkHours'),
            value: totalWorkHours,
            sub: t('attendanceReport.workDays', { days: totalWorkDays.toString() }),
            tone: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
            icon: (<path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />)
          },
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
            <div className={`w-10 h-10 rounded-lg ${s.tone} flex items-center justify-center mb-2`}>
              <svg {...stroke} className="w-5 h-5" aria-hidden="true">{s.icon}</svg>
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{s.label}</div>
            <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{s.value}</div>
            {s.sub && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">({s.sub})</div>}
          </div>
        ))}
      </div>

      {/* Staff statistics */}
      {Object.keys(staffStats).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 mb-6">
          <h3 className="text-base font-bold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <svg {...stroke} className="w-5 h-5 text-primary-600 dark:text-primary-400" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
            </svg>
            <span>{t('attendanceReport.staffStatistics')}</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(staffStats)
              .sort((a, b) => b[1].totalDays - a[1].totalDays)
              .map(([staffId, stats]) => (
                <div
                  key={staffId}
                  className="bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg p-4"
                >
                  <div className="mb-2">
                    <p className="font-bold text-gray-900 dark:text-gray-100">{stats.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      #{stats.staffCode} {stats.position && `• ${stats.position}`}
                    </p>
                  </div>
                  <div className="mt-3 bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-200 dark:ring-primary-900/50 rounded-lg p-2 text-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary-700 dark:text-primary-400">{t('attendanceReport.attendanceDays')}</p>
                    <p className="text-2xl font-bold text-primary-700 dark:text-primary-300">{stats.totalDays}</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Attendance records */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <svg {...stroke} className="w-5 h-5 text-primary-600 dark:text-primary-400" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
            </svg>
            <span>{t('attendanceReport.attendanceRecords')}</span>
          </h3>
        </div>

        {loading ? (
          <LoadingScreen message={t('attendanceReport.loading')} />
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
                  className={`rounded-xl p-5 ring-1 transition-colors duration-200 ${
                    isActuallyInside
                      ? 'bg-green-50 dark:bg-green-900/20 ring-green-200 dark:ring-green-900/50'
                      : att.checkOut === null
                      ? 'bg-red-50 dark:bg-red-900/20 ring-red-200 dark:ring-red-900/50'
                      : 'bg-gray-50 dark:bg-gray-900/40 ring-gray-200 dark:ring-gray-700'
                  }`}
                >
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4 gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                          #{att.staff.staffCode}
                        </span>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{att.staff.name}</h3>
                          <p className="text-xs text-gray-600 dark:text-gray-400">{getPositionLabel(att.staff.position)}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
                        <svg {...stroke} className="w-3.5 h-3.5" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                        </svg>
                        {checkInTime.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isAdmin && (
                        <button
                          onClick={() => openManualEdit(att)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors duration-200"
                          aria-label={direction === 'rtl' ? 'تعديل' : 'Edit'}
                          title={direction === 'rtl' ? 'تعديل' : 'Edit'}
                        >
                          <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487 18.549 2.799a2.122 2.122 0 1 1 3 3L19.862 7.487m-3-3L8.078 13.27a2 2 0 0 0-.5.831l-1.111 4.222 4.222-1.111a2 2 0 0 0 .832-.5l8.781-8.781m-3-3 3 3" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => deleteAttendance(att)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors duration-200"
                        aria-label={t('attendanceReport.delete')}
                        title={t('attendanceReport.delete')}
                      >
                        <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Times */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg p-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">{t('attendanceReport.checkInTime')}</div>
                      <p className="text-xl font-bold text-primary-700 dark:text-primary-300">
                        {checkInTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {checkInTime.toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { weekday: 'short' })}
                      </p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg p-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">{t('attendanceReport.checkOutTime')}</div>
                      {checkOutTime ? (
                        <>
                          <p className="text-xl font-bold text-orange-700 dark:text-orange-300">
                            {checkOutTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {checkOutTime.toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', { weekday: 'short' })}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{t('attendanceReport.notCheckedOut')}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('attendanceReport.working')}</p>
                        </>
                      )}
                    </div>

                    <div className="bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg p-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">{t('attendanceReport.workHours')}</div>
                      {hours === 0 && minutes === 0 ? (
                        <p className="text-sm font-bold text-gray-600 dark:text-gray-300">
                          {att.checkOut === null && !isToday ? t('attendanceReport.notCalculated') : t('attendanceReport.justStarted')}
                        </p>
                      ) : (
                        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                          {hours > 0 && `${hours} س`}{hours > 0 && minutes > 0 ? ' ' : ''}{minutes > 0 && `${minutes} د`}
                        </p>
                      )}
                      <p className={`text-xs mt-1 font-semibold ${att.checkOut ? 'text-gray-500 dark:text-gray-400' : 'text-green-600 dark:text-green-400'}`}>
                        {att.checkOut ? t('attendanceReport.finished') : t('attendanceReport.workingNow')}
                      </p>
                    </div>

                    <div className="flex items-center justify-center">
                      {isActuallyInside ? (
                        <div className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 ring-1 ring-green-200 dark:ring-green-900/50 rounded-lg p-4 text-center w-full">
                          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-200 dark:bg-green-900/60 mx-auto mb-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                          </div>
                          <p className="font-bold">{t('attendanceReport.inside')}</p>
                          <p className="text-xs">{t('attendanceReport.presentNow')}</p>
                        </div>
                      ) : att.checkOut === null ? (
                        <div className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-900/50 rounded-lg p-4 text-center w-full">
                          <svg {...stroke} className="w-7 h-7 mx-auto mb-1" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                          </svg>
                          <p className="font-bold">{t('attendanceReport.missingCheckout')}</p>
                          <p className="text-xs">{t('attendanceReport.oldRecord')}</p>
                        </div>
                      ) : (
                        <div className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 ring-1 ring-gray-200 dark:ring-gray-600 rounded-lg p-4 text-center w-full">
                          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 mx-auto mb-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                          </div>
                          <p className="font-bold">{t('attendanceReport.outside')}</p>
                          <p className="text-xs">{t('attendanceReport.leftWork')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg {...stroke} className="w-12 h-12 text-gray-400" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 0 1-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 0 0 1.183 1.981l6.478 3.488m8.839 2.51-4.66-2.51m0 0-1.023-.55a2.25 2.25 0 0 0-2.134 0l-1.022.55m0 0-4.661 2.51m16.5 1.615a2.25 2.25 0 0 1-1.183 1.981l-6.478 3.488a2.25 2.25 0 0 1-2.134 0L3.432 19.67A2.25 2.25 0 0 1 2.25 17.69V6.31a2.25 2.25 0 0 1 1.183-1.981l6.478-3.488a2.25 2.25 0 0 1 2.134 0l6.478 3.488a2.25 2.25 0 0 1 1.183 1.981v11.38Z" />
            </svg>
            <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">{t('attendanceReport.noRecords')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('attendanceReport.tryChangingFilters')}</p>
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

      {/* Manual Add / Edit Modal */}
      {showManualModal && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="manual-modal-title"
          onClick={(e) => { if (e.target === e.currentTarget) closeManualModal() }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in max-w-lg w-full p-6" dir={direction}>
            <div className="flex items-center justify-between mb-5">
              <h3 id="manual-modal-title" className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <svg {...stroke} className="w-5 h-5 text-primary-600 dark:text-primary-400" aria-hidden="true">
                  {manualEditId ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487 18.549 2.799a2.122 2.122 0 1 1 3 3L19.862 7.487m-3-3L8.078 13.27a2 2 0 0 0-.5.831l-1.111 4.222 4.222-1.111a2 2 0 0 0 .832-.5l8.781-8.781m-3-3 3 3" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  )}
                </svg>
                <span>
                  {direction === 'rtl'
                    ? (manualEditId ? 'تعديل سجل حضور' : 'إدخال حضور يدوي')
                    : (manualEditId ? 'Edit Attendance' : 'Add Manual Attendance')}
                </span>
              </h3>
              <button
                onClick={closeManualModal}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                aria-label={direction === 'rtl' ? 'إلغاء' : 'Cancel'}
              >
                <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {direction === 'rtl' ? 'الموظف' : 'Staff'} <span className="text-red-600">*</span>
                </label>
                <select
                  value={manualForm.staffId}
                  onChange={(e) => setManualForm({ ...manualForm, staffId: e.target.value })}
                  disabled={!!manualEditId}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 disabled:opacity-60"
                >
                  <option value="">{direction === 'rtl' ? '— اختر الموظف —' : '— Select staff —'}</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>#{s.staffCode} - {s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {direction === 'rtl' ? 'التاريخ' : 'Date'} <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  value={manualForm.date}
                  onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {direction === 'rtl' ? 'وقت الحضور' : 'Check-in'} <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="time"
                    value={manualForm.checkInTime}
                    onChange={(e) => setManualForm({ ...manualForm, checkInTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {direction === 'rtl' ? 'وقت الانصراف' : 'Check-out'}
                  </label>
                  <input
                    type="time"
                    value={manualForm.checkOutTime}
                    onChange={(e) => setManualForm({ ...manualForm, checkOutTime: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 font-mono"
                    placeholder={direction === 'rtl' ? 'اختياري' : 'optional'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {direction === 'rtl' ? 'ملاحظات' : 'Notes'}
                </label>
                <textarea
                  value={manualForm.notes}
                  onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 resize-none"
                  placeholder={direction === 'rtl' ? 'مثال: تأخّر بسبب الترافيك' : 'e.g., late due to traffic'}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={submitManualForm}
                disabled={manualSaving}
                autoFocus
                className="flex-1 inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
              >
                {manualSaving ? (
                  <svg {...stroke} className="w-4 h-4 animate-spin" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356M3.181 14.652a8.25 8.25 0 0 0 13.803 3.7l3.181-3.182m-9.348-4.992H3.825V4.356m0 0L7.006 7.538m12.992 8.924v-4.992" />
                  </svg>
                ) : (
                  <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
                <span>
                  {manualSaving
                    ? (direction === 'rtl' ? 'جاري الحفظ' : 'Saving')
                    : (manualEditId
                        ? (direction === 'rtl' ? 'حفظ التعديلات' : 'Save Changes')
                        : (direction === 'rtl' ? 'تسجيل الحضور' : 'Add Record'))}
                </span>
              </button>
              <button
                onClick={closeManualModal}
                disabled={manualSaving}
                className="px-6 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 py-2.5 rounded-lg font-bold transition-colors duration-200 text-sm disabled:opacity-60"
              >
                {direction === 'rtl' ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

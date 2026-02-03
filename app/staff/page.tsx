'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionDenied from '../../components/PermissionDenied'
import StaffBarcodeWhatsApp from '../../components/StaffBarcodeWhatsApp'
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast } from '../../contexts/ToastContext'
import { useServiceSettings } from '../../contexts/ServiceSettingsContext'
import { fetchStaff } from '../../lib/api/staff'

interface Staff {
  id: string
  staffCode: string  // ✅ الرقم مع s في البداية (مثل s001, s022)
  name: string
  phone?: string
  position?: string
  salary?: number
  notes?: string
  isActive: boolean
  createdAt: string
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

// Map Arabic position values to translation keys
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
  'أخصائي تغذية': 'nutritionist',
  'أخصائي علاج طبيعي': 'physiotherapist',
  'other': 'other',
}

export default function StaffPage() {
  const router = useRouter()
  const { t, direction } = useLanguage()
  const toast = useToast()
  const { settings } = useServiceSettings()

  // Dynamic positions based on service settings
  const POSITIONS = [
    { value: 'مدرب', label: `💪 ${t('positions.trainer')}`, icon: '💪' },
    { value: 'ريسبشن', label: `👔 ${t('positions.receptionist')}`, icon: '👔' },
    { value: 'بار', label: `☕ ${t('positions.barista')}`, icon: '☕' },
    { value: 'HK', label: `🧹 ${t('positions.housekeeping')}`, icon: '🧹' },
    { value: 'مدير', label: `👨‍💼 ${t('positions.manager')}`, icon: '👨‍💼' },
    { value: 'محاسب', label: `💼 ${t('positions.accountant')}`, icon: '💼' },
    { value: 'صيانة', label: `🔧 ${t('positions.maintenance')}`, icon: '🔧' },
    { value: 'أمن', label: `🛡️ ${t('positions.security')}`, icon: '🛡️' },
    ...(settings.nutritionEnabled ? [{ value: 'أخصائي تغذية', label: `🥗 ${t('positions.nutritionist')}`, icon: '🥗' }] : []),
    ...(settings.physiotherapyEnabled ? [{ value: 'أخصائي علاج طبيعي', label: `🏥 ${t('positions.physiotherapist')}`, icon: '🏥' }] : []),
    { value: 'other', label: `📝 ${t('positions.other')}`, icon: '📝' },
  ]

  // Helper function to translate position
  const getPositionLabel = (position: string | null): string => {
    if (!position) return '-'
    const key = POSITION_MAP[position] || 'other'
    return t(`positions.${key}` as any)
  }
  const { hasPermission, loading: permissionsLoading } = usePermissions()

  const {
    data: staff = [],
    isLoading: loading,
    error: staffError,
    refetch: refetchStaff
  } = useQuery({
    queryKey: ['staff'],
    queryFn: fetchStaff,
    enabled: !permissionsLoading && hasPermission('canViewStaff'),
    retry: 1,
    staleTime: 2 * 60 * 1000,
  })

  const [todayAttendance, setTodayAttendance] = useState<Attendance[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showOtherPosition, setShowOtherPosition] = useState(false)

  // Delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  
  // ✅ حالة Scanner
  const [scannerInput, setScannerInput] = useState('')
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null)
  const [scanMessage, setScanMessage] = useState('')
  const scannerRef = useRef<HTMLInputElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  const [formData, setFormData] = useState({
    staffCode: '',  // ✅ الرقم البسيط
    name: '',
    phone: '',
    position: '',
    customPosition: '',
    salary: 0,
    notes: '',
  })

  // ✅ توليد رقم عشوائي من 9 أرقام للموظف
  const [randomStaffCode, setRandomStaffCode] = useState('')

  useEffect(() => {
    // ✅ توليد رقم عشوائي فقط عند فتح النموذج لإضافة موظف جديد
    if (showForm && !editingStaff) {
      const randomNum = Math.floor(Math.random() * 999) + 1
      const nineDigitCode = (100000000 + randomNum).toString()
      setRandomStaffCode(nineDigitCode)
      setFormData(prev => ({ ...prev, staffCode: nineDigitCode }))
    }
  }, [showForm, editingStaff])

  // Error handling for staff query
  useEffect(() => {
    if (staffError) {
      const errorMessage = (staffError as Error).message
      if (errorMessage === 'UNAUTHORIZED') {
        toast.error('يجب تسجيل الدخول أولاً')
        setTimeout(() => router.push('/login'), 2000)
      } else if (errorMessage === 'FORBIDDEN') {
        toast.error('ليس لديك صلاحية عرض الموظفين')
      } else {
        toast.error(errorMessage || 'حدث خطأ أثناء جلب بيانات الموظفين')
      }
    }
  }, [staffError, toast, router])

  const fetchTodayAttendance = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]  // YYYY-MM-DD
      const response = await fetch(`/api/attendance?dateFrom=${today}&dateTo=${today}`)
      const data = await response.json()
      setTodayAttendance(data)
    } catch (error) {
      console.error('Error fetching attendance:', error)
    }
  }

  useEffect(() => {
    fetchTodayAttendance()

    const interval = setInterval(fetchTodayAttendance, 60000)
    return () => clearInterval(interval)
  }, [])

  // ✅ دوال الصوت
  const playSuccessSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      const times = [0, 0.15, 0.3]
      const frequencies = [523.25, 659.25, 783.99]
      
      times.forEach((time, index) => {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequencies[index], ctx.currentTime + time)
        gainNode.gain.setValueAtTime(0.7, ctx.currentTime + time)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + time + 0.3)
        oscillator.start(ctx.currentTime + time)
        oscillator.stop(ctx.currentTime + time + 0.3)
      })
    } catch (error) {
      console.error('Error playing sound:', error)
    }
  }

  const playErrorSound = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioContextRef.current
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      oscillator.type = 'square'
      oscillator.frequency.setValueAtTime(200, ctx.currentTime)
      gainNode.gain.setValueAtTime(0.5, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.3)
    } catch (error) {
      console.error('Error playing sound:', error)
    }
  }

  // ✅ معالجة السكان بالرقم
const handleScan = async (staffCode: string) => {
  try {
    // 🟢 تنظيف الكود فقط (إزالة المسافات)
    let cleanCode = staffCode.trim();

    // ✅ لو الكود رقم من 9 خانات (100000000+)، فهو موظف
    if (/^\d+$/.test(cleanCode)) {
      const numericCode = parseInt(cleanCode, 10);
      if (numericCode >= 100000000) {
        // موظف: مثلاً 100000022 -> s022
        const staffNumber = numericCode - 100000000;
        cleanCode = `s${staffNumber.toString().padStart(3, '0')}`;
      } else {
        // عضو: نستخدم الرقم كما هو
        cleanCode = cleanCode;
      }
    }

    const response = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffCode: cleanCode }),
    });

    const data = await response.json();

    if (response.ok) {
      playSuccessSound();
      // ترجمة الرسالة حسب نوع العملية
      const translatedMessage = data.action === 'check-in'
        ? t('staff.scanner.checkInSuccess')
        : t('staff.scanner.checkOutSuccess');
      setScanMessage(translatedMessage);
      setLastScanTime(new Date());
      fetchTodayAttendance();
      setTimeout(() => setScanMessage(''), 5000);
    } else {
      playErrorSound();
      setScanMessage(`❌ ${data.error || t('staff.scanner.errorRegister')}`);
      setTimeout(() => setScanMessage(''), 5000);
    }
  } catch (error) {
    console.error('Scan error:', error);
    playErrorSound();
    setScanMessage(t('staff.scanner.errorOccurred'));
    setTimeout(() => setScanMessage(''), 5000);
  }
};


  // ✅ معالجة إدخال Scanner
  const handleScannerInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && scannerInput.trim()) {
      handleScan(scannerInput.trim())
      setScannerInput('')
    }
  }

  // ✅ التحقق من حضور الموظف اليوم
  const isStaffPresent = (staffId: string) => {
    return todayAttendance.some((att) => att.staffId === staffId)
  }

  // ✅ التحقق إذا كان الموظف داخل حالياً (لم يسجل انصراف)
  const isStaffCurrentlyInside = (staffId: string) => {
    return todayAttendance.some((att) => att.staffId === staffId && att.checkOut === null)
  }

  // ✅ الحصول على معلومات حضور الموظف
  const getStaffAttendanceInfo = (staffId: string) => {
    return todayAttendance.find((att) => att.staffId === staffId)
  }

  // ✅ تنسيق مدة العمل
  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '-'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours} س ${mins} د` : `${mins} د`
  }

  const resetForm = () => {
    setFormData({
      staffCode: '',
      name: '',
      phone: '',
      position: '',
      customPosition: '',
      salary: 0,
      notes: '',
    })
    setShowOtherPosition(false)
    setEditingStaff(null)
    setShowForm(false)
  }

  const handleEdit = (staffMember: Staff) => {
    const isStandardPosition = POSITIONS.some(
      (pos) => pos.value === staffMember.position && pos.value !== 'other'
    )

    // ✅ تحويل staffCode من s022 إلى 100000022
    let displayCode = staffMember.staffCode
    if (staffMember.staffCode.startsWith('s') || staffMember.staffCode.startsWith('S')) {
      const numericPart = parseInt(staffMember.staffCode.substring(1), 10)
      displayCode = (100000000 + numericPart).toString()
    }

    setFormData({
      staffCode: displayCode,
      name: staffMember.name,
      phone: staffMember.phone || '',
      position: isStandardPosition ? staffMember.position || '' : 'other',
      customPosition: isStandardPosition ? '' : staffMember.position || '',
      salary: staffMember.salary || 0,
      notes: staffMember.notes || '',
    })
    setShowOtherPosition(!isStandardPosition)
    setEditingStaff(staffMember)
    setShowForm(true)
  }

  const handlePositionChange = (value: string) => {
    setFormData({ ...formData, position: value, customPosition: '' })
    setShowOtherPosition(value === 'other')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const finalPosition =
      formData.position === 'other' ? formData.customPosition : formData.position

    if (!finalPosition) {
      toast.warning(t('staff.messages.selectPosition'))
      setSubmitting(false)
      return
    }

    if (!formData.staffCode) {
      toast.warning(t('staff.messages.enterNumber'))
      setSubmitting(false)
      return
    }

    // ✅ التحقق من أن الرقم 9 أرقام
    const numericCode = formData.staffCode.replace(/[sS]/g, '')
    if (!/^\d{9}$/.test(numericCode)) {
      toast.warning(t('staff.messages.invalidNumber'))
      setSubmitting(false)
      return
    }

    try {
      const url = '/api/staff'
      const method = editingStaff ? 'PUT' : 'POST'

      // ✅ نحول الرقم من 9 خانات إلى s + رقم بسيط
      // مثال: 100000022 -> s022
      const staffNumber = parseInt(numericCode, 10) - 100000000
      const staffCodeWithS = `s${staffNumber.toString().padStart(3, '0')}`

      const body = editingStaff
        ? { id: editingStaff.id, ...formData, position: finalPosition, staffCode: staffCodeWithS }
        : { ...formData, position: finalPosition, staffCode: staffCodeWithS }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(editingStaff ? t('staff.messages.updated') : t('staff.messages.added'))
        refetchStaff()
        resetForm()
      } else {
        toast.error(data.error || t('staff.messages.failed'))
      }
    } catch (error) {
      console.error(error)
      toast.error(t('staff.messages.error'))
    } finally {
      setSubmitting(false)
    }
  }



  const toggleActive = async (staffMember: Staff) => {
    try {
      await fetch('/api/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: staffMember.id,
          isActive: !staffMember.isActive,
        }),
      })
      refetchStaff()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleDelete = (staffMember: Staff) => {
    setStaffToDelete(staffMember)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!staffToDelete) return

    setDeleteLoading(true)
    try {
      const response = await fetch(`/api/staff?id=${staffToDelete.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(t('staff.messages.deleted'))
        refetchStaff()
        setShowDeleteModal(false)
        setStaffToDelete(null)
      } else {
        toast.error(data.error || t('staff.messages.deleteFailed'))
      }
    } catch (error) {
      console.error('Error deleting staff:', error)
      toast.error(t('staff.messages.deleteError'))
    } finally {
      setDeleteLoading(false)
    }
  }

  const getPositionIcon = (position: string): string => {
    const pos = POSITIONS.find((p) => p.value === position)
    return pos ? pos.icon : '👤'
  }

  const getPositionColor = (position: string): string => {
    const colors: { [key: string]: string } = {
      مدرب: 'bg-green-100 text-green-800',
      ريسبشن: 'bg-primary-100 text-primary-800',
      بار: 'bg-orange-100 text-orange-800',
      HK: 'bg-purple-100 text-purple-800',
      مدير: 'bg-red-100 text-red-800',
      محاسب: 'bg-indigo-100 text-indigo-800',
      صيانة: 'bg-yellow-100 text-yellow-800',
      أمن: 'bg-gray-100 text-gray-800',
      'أخصائي تغذية': 'bg-lime-100 text-lime-800',
      'أخصائي علاج طبيعي': 'bg-blue-100 text-blue-800',
    }
    return colors[position] || 'bg-gray-100 text-gray-800'
  }

  const getStaffByPosition = () => {
    const counts: { [key: string]: number } = {}
    ;(staff || []).forEach((s) => {
      if (s.position && s.isActive) {
        counts[s.position] = (counts[s.position] || 0) + 1
      }
    })
    return counts
  }

  const staffByPosition = getStaffByPosition()
  const presentStaff = todayAttendance.filter((att) => att.checkOut === null).length  // الموجودين الآن (لم ينصرفوا)
  const totalCheckedIn = todayAttendance.length  // إجمالي من سجلوا حضور اليوم

  // ✅ التحقق من الصلاحيات
  if (permissionsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl">{t('staff.loading')}</div>
      </div>
    )
  }

  if (!hasPermission('canViewStaff')) {
    return <PermissionDenied message="ليس لديك صلاحية عرض الموظفين" />
  }

  return (
    <div className="container mx-auto px-4 py-6 md:px-6" dir={direction}>
      {/* ✅ قسم Scanner للحضور والانصراف */}
      <div className="bg-gradient-to-r from-primary-600 to-purple-600 rounded-2xl shadow-2xl p-4 sm:p-8 mb-8 text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
              <span className="text-4xl sm:text-5xl">🔢</span>
              <span>{t('staff.scanner.title')}</span>
            </h2>
            <p className="text-primary-100 text-sm sm:text-base">{t('staff.scanner.subtitle')}</p>
          </div>
          {lastScanTime && (
            <div className="bg-white/20 backdrop-blur px-4 sm:px-6 py-2 sm:py-3 rounded-xl w-full sm:w-auto">
              <p className="text-xs sm:text-sm">{t('staff.scanner.lastScan')}</p>
              <p className="text-lg sm:text-xl font-bold">{lastScanTime.toLocaleTimeString('ar-EG')}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-4 sm:p-6">
          <input
            ref={scannerRef}
            type="text"
            value={scannerInput}
            onChange={(e) => setScannerInput(e.target.value)}
            onKeyPress={handleScannerInput}
            className="w-full px-4 sm:px-6 py-4 sm:py-6 border-4 border-primary-400 rounded-xl text-2xl sm:text-4xl font-bold text-center focus:border-primary-600 focus:ring-4 focus:ring-primary-200 transition text-gray-800"
            placeholder={t('staff.scanner.placeholder')}
            autoFocus
          />
          <p className="text-center text-gray-600 mt-3 text-xs sm:text-sm">
            {t('staff.scanner.hint')}
          </p>
        </div>

        {scanMessage && (
          <div
            className={`mt-4 p-4 sm:p-6 rounded-xl text-center font-bold text-lg sm:text-2xl animate-pulse ${
              scanMessage.includes('✅')
                ? 'bg-green-500'
                : 'bg-red-500'
            }`}
          >
            {scanMessage}
          </div>
        )}
      </div>

      {/* ✅ قسم حضور اليوم */}
      <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 mb-8 border-4 border-green-200">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
            <h3 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <span>📊</span>
              <span>{t('staff.attendance.title')}</span>
            </h3>
            <Link
              href="/attendance-report"
              className="w-full sm:w-auto bg-gradient-to-r from-primary-600 to-purple-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:from-primary-700 hover:to-purple-700 transition transform hover:scale-105 shadow-lg flex items-center justify-center gap-2 text-sm font-bold"
            >
              <span>📋</span>
              <span>{t('nav.staffAttendance')}</span>
            </Link>
          </div>
          <div className="flex gap-2 sm:gap-4 w-full lg:w-auto">
            <div className="flex-1 lg:flex-none bg-green-100 px-3 sm:px-6 py-2 sm:py-3 rounded-xl text-center">
              <p className="text-xs sm:text-sm text-green-700">{t('staff.attendance.presentNow')}</p>
              <p className="text-2xl sm:text-3xl font-bold text-green-800">{presentStaff}</p>
            </div>
            <div className="flex-1 lg:flex-none bg-primary-100 px-3 sm:px-6 py-2 sm:py-3 rounded-xl text-center">
              <p className="text-xs sm:text-sm text-primary-700">{t('staff.attendance.totalPresent')}</p>
              <p className="text-2xl sm:text-3xl font-bold text-primary-800">{totalCheckedIn}</p>
            </div>
          </div>
        </div>

        {todayAttendance.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-primary-100 to-purple-100">
                <tr>
                  <th className="px-4 py-3 text-right font-bold">{t('staff.attendance.number')}</th>
                  <th className="px-4 py-3 text-right font-bold">{t('staff.attendance.name')}</th>
                  <th className="px-4 py-3 text-right font-bold">{t('staff.attendance.position')}</th>
                  <th className="px-4 py-3 text-center font-bold">
                    <div className="flex items-center justify-center gap-2">
                      <span>🕐</span>
                      <span>وقت الدخول</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center font-bold">
                    <div className="flex items-center justify-center gap-2">
                      <span>🕐</span>
                      <span>وقت الخروج</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center font-bold">
                    <div className="flex items-center justify-center gap-2">
                      <span>⏱️</span>
                      <span>ساعات العمل</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center font-bold">{t('staff.attendance.status')}</th>
                </tr>
              </thead>
              <tbody>
                {todayAttendance.map((att) => {
                  const checkInTime = new Date(att.checkIn)
                  const checkOutTime = att.checkOut ? new Date(att.checkOut) : null
                  const currentTime = new Date()

                  // حساب الساعات الفعلية
                  let actualMinutes = att.duration || 0
                  if (!att.checkOut) {
                    // إذا لم يسجل الخروج بعد، احسب حتى الآن
                    actualMinutes = Math.floor((currentTime.getTime() - checkInTime.getTime()) / (1000 * 60))
                  }

                  const hours = Math.floor(actualMinutes / 60)
                  const minutes = actualMinutes % 60

                  return (
                    <tr key={att.id} className={`border-t hover:bg-gray-50 transition ${att.checkOut === null ? 'bg-green-50 border-r-4 border-green-500' : 'bg-white'}`}>
                      <td className="px-4 py-4">
                        <span className="bg-primary-500 text-white px-3 py-1 rounded-lg font-bold text-sm">
                          #{att.staff.staffCode}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-bold text-gray-800">{att.staff.name}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${getPositionColor(
                            att.staff.position || ''
                          )}`}
                        >
                          {getPositionIcon(att.staff.position || '')} {getPositionLabel(att.staff.position)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="bg-primary-50 px-4 py-2 rounded-lg inline-block border-2 border-primary-200">
                          <div className="text-lg font-bold text-primary-800">
                            {checkInTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </div>
                          <div className="text-xs text-primary-600">
                            {checkInTime.toLocaleDateString('ar-EG', { weekday: 'short' })}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {checkOutTime ? (
                          <div className="bg-orange-50 px-4 py-2 rounded-lg inline-block border-2 border-orange-200">
                            <div className="text-lg font-bold text-orange-800">
                              {checkOutTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </div>
                            <div className="text-xs text-orange-600">
                              {checkOutTime.toLocaleDateString('ar-EG', { weekday: 'short' })}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-yellow-50 px-4 py-2 rounded-lg inline-block border-2 border-yellow-300">
                            <div className="text-sm font-bold text-yellow-800">
                              لم ينصرف بعد
                            </div>
                            <div className="text-xs text-yellow-600">
                              جاري العمل...
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className={`px-4 py-3 rounded-lg inline-block border-2 ${att.checkOut ? 'bg-purple-50 border-purple-200' : 'bg-green-50 border-green-300'}`}>
                          {hours === 0 && minutes === 0 ? (
                            <div className="text-lg font-bold text-gray-600">بدأ للتو</div>
                          ) : (
                            <div className="flex gap-2 justify-center mb-2">
                              {hours > 0 && (
                                <div className="bg-white border-2 border-purple-300 rounded px-3 py-1">
                                  <div className="text-xl font-bold text-purple-800">{hours}</div>
                                  <div className="text-xs text-purple-600">ساعة</div>
                                </div>
                              )}
                              {minutes > 0 && (
                                <div className="bg-white border-2 border-primary-300 rounded px-3 py-1">
                                  <div className="text-xl font-bold text-primary-800">{minutes}</div>
                                  <div className="text-xs text-primary-600">دقيقة</div>
                                </div>
                              )}
                            </div>
                          )}
                          <div className={`text-xs ${att.checkOut ? 'text-purple-600' : 'text-green-600'} font-semibold`}>
                            {att.checkOut ? '✅ انتهى' : '⏳ يعمل الآن'}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {att.checkOut === null ? (
                          <span className="px-4 py-2 rounded-full text-sm font-bold bg-green-500 text-white shadow-lg animate-pulse">
                            🟢 {t('staff.attendance.inside')}
                          </span>
                        ) : (
                          <span className="px-4 py-2 rounded-full text-sm font-bold bg-gray-500 text-white">
                            🔴 {t('staff.attendance.outside')}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <div className="text-6xl mb-4">😴</div>
            <p className="text-xl">{t('staff.attendance.noAttendance')}</p>
          </div>
        )}
      </div>

      {/* باقي الصفحة - إدارة الموظفين */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">👥 {t('staff.title')}</h1>

        </div>
        <button
          onClick={() => {
            resetForm()
            setShowForm(!showForm)
          }}
          className="w-full sm:w-auto bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition transform hover:scale-105"
        >
          {showForm ? t('staff.hideForm') : `➕ ${t('staff.addNewStaff')}`}
        </button>
      </div>

      {/* نموذج الإضافة/التعديل */}
      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-lg mb-6 border-2 border-primary-100">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            {editingStaff ? (
              <>
                <span>✏️</span>
                <span>{t('staff.editStaff')}</span>
              </>
            ) : (
              <>
                <span>➕</span>
                <span>{t('staff.addStaff')}</span>
              </>
            )}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ✅ رقم الموظف */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">
                  {t('staff.form.staffNumberRequired')}
                </label>
                <input
                  type="text"
                  required
                  value={formData.staffCode}
                  onChange={(e) => setFormData({ ...formData, staffCode: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition text-2xl font-bold"
                  placeholder={randomStaffCode || "100000022"}
                  minLength={9}
                  maxLength={9}
                  pattern="\d{9}"
                  disabled={!!editingStaff}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {editingStaff
                    ? t('staff.form.staffNumberLocked')
                    : t('staff.form.staffNumberHint')}
                </p>
              </div>

              {/* الاسم */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">
                  {t('staff.form.nameRequired')}
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition"
                  placeholder={t('staff.form.namePlaceholder')}
                />
              </div>

              {/* رقم الهاتف */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">{t('staff.form.phone')}</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition"
                  placeholder={t('staff.form.phonePlaceholder')}
                />
              </div>

              {/* الوظيفة */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">
                  {t('staff.form.positionRequired')}
                </label>
                <select
                  required={!showOtherPosition}
                  value={formData.position}
                  onChange={(e) => handlePositionChange(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition text-lg"
                >
                  <option value="">{t('staff.form.selectPosition')}</option>
                  {POSITIONS.map((pos) => (
                    <option key={pos.value} value={pos.value}>
                      {pos.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* حقل الوظيفة المخصصة */}
              {showOtherPosition && (
                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
                  <label className="block text-sm font-bold mb-2 text-gray-700">
                    {t('staff.form.customPositionRequired')}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customPosition}
                    onChange={(e) =>
                      setFormData({ ...formData, customPosition: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 border-yellow-400 rounded-lg focus:border-yellow-500 focus:ring-2 focus:ring-yellow-200 transition"
                    placeholder={t('staff.form.customPositionPlaceholder')}
                  />
                </div>
              )}

              {/* المرتب */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700">
                  {t('staff.form.salary')}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.salary}
                  onChange={(e) =>
                    setFormData({ ...formData, salary: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition"
                  placeholder={t('staff.form.salaryPlaceholder')}
                />
              </div>
            </div>

            {/* ملاحظات */}
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-700">{t('staff.form.notes')}</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 transition resize-none"
                rows={3}
                placeholder={t('staff.form.notesPlaceholder')}
              />
            </div>

            {/* أزرار التحكم */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 text-white py-4 rounded-lg hover:from-primary-700 hover:to-primary-800 disabled:from-gray-400 disabled:to-gray-500 font-bold text-lg shadow-lg transform transition hover:scale-105 active:scale-95"
              >
                {submitting ? `⏳ ${t('staff.form.saving')}` : editingStaff ? `✅ ${t('staff.form.update')}` : `➕ ${t('staff.form.addStaff')}`}
              </button>
              {editingStaff && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-8 bg-gradient-to-r from-gray-200 to-gray-300 text-gray-700 py-4 rounded-lg hover:from-gray-300 hover:to-gray-400 font-bold shadow-lg transform transition hover:scale-105 active:scale-95"
                >
                  {t('staff.form.cancel')}
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* الإحصائيات */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-lg p-4 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 text-xs sm:text-sm mb-1">{t('staff.stats.totalStaff')}</p>
              <p className="text-2xl sm:text-4xl font-bold">{staff.length}</p>
            </div>
            <div className="text-3xl sm:text-5xl opacity-20">👥</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-4 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-xs sm:text-sm mb-1">{t('staff.stats.activeStaff')}</p>
              <p className="text-2xl sm:text-4xl font-bold">{staff.filter((s) => s.isActive).length}</p>
            </div>
            <div className="text-3xl sm:text-5xl opacity-20">✅</div>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg p-4 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-xs sm:text-sm mb-1">{t('staff.stats.totalSalaries')}</p>
              <p className="text-xl sm:text-3xl font-bold">
                {staff.reduce((sum, s) => sum + (s.salary || 0), 0).toFixed(0)} ج.م
              </p>
            </div>
            <div className="text-3xl sm:text-5xl opacity-20">💰</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg p-4 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-xs sm:text-sm mb-1">{t('staff.stats.coaches')}</p>
              <p className="text-2xl sm:text-4xl font-bold">{staffByPosition['مدرب'] || 0}</p>
            </div>
            <div className="text-3xl sm:text-5xl opacity-20">💪</div>
          </div>
        </div>

        <Link
          href="/expenses"
          className="col-span-2 sm:col-span-3 lg:col-span-1 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg p-4 sm:p-6 shadow-lg hover:shadow-2xl transition-all hover:scale-105 active:scale-95"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-xs sm:text-sm mb-1">{t('staff.loans.title')}</p>
              <p className="text-lg sm:text-xl font-bold">{t('staff.loans.viewInExpenses')}</p>
            </div>
            <div className="text-3xl sm:text-5xl opacity-20">💸</div>
          </div>
        </Link>
      </div>

      {/* جدول الموظفين */}
      {loading ? (
        <div className="text-center py-12">{t('staff.loading')}</div>
      ) : (
        <>
          {/* Cards للموبايل */}
          <div className="lg:hidden space-y-4">
            {staff.map((staffMember) => (
              <div
                key={staffMember.id}
                className={`bg-white rounded-lg shadow-md border-r-4 border-orange-500 overflow-hidden ${
                  !staffMember.isActive ? 'opacity-60' : ''
                } ${isStaffCurrentlyInside(staffMember.id) ? 'bg-green-50' : ''}`}
              >
                {/* Actions في الأعلى */}
                <div className="bg-gray-50 px-4 py-2 flex justify-between items-center border-b">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(staffMember)}
                      className="w-8 h-8 flex items-center justify-center bg-primary-100 hover:bg-primary-200 text-primary-600 rounded-lg transition-all hover:scale-110 active:scale-95"
                      title={t('staff.table.edit')}
                    >
                      ✏️
                    </button>
                    {hasPermission('canDeleteStaff') && (
                      <button
                        onClick={() => handleDelete(staffMember)}
                        className="w-8 h-8 flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-all hover:scale-110 active:scale-95"
                        title={t('staff.table.delete')}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                  {staffMember.phone && (
                    <StaffBarcodeWhatsApp
                      staffCode={staffMember.staffCode}
                      staffName={staffMember.name}
                      staffPhone={staffMember.phone}
                    />
                  )}
                </div>

                {/* محتوى الكارت */}
                <div className="p-4 space-y-3">
                  {/* الرقم والاسم */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-primary-500 text-white px-3 py-1 rounded-lg font-bold text-sm">
                          #{staffMember.staffCode}
                        </span>
                        {isStaffCurrentlyInside(staffMember.id) && (
                          <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                            🟢 {t('staff.attendance.inside')}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-gray-800">{staffMember.name}</h3>
                    </div>
                  </div>

                  {/* الوظيفة */}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm">💼</span>
                    <span
                      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${getPositionColor(
                        staffMember.position || ''
                      )}`}
                    >
                      <span>{getPositionIcon(staffMember.position || '')}</span>
                      <span>{getPositionLabel(staffMember.position)}</span>
                    </span>
                  </div>

                  {/* الهاتف */}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm">📱</span>
                    <span className="text-gray-700">{staffMember.phone || '-'}</span>
                  </div>

                  {/* المرتب */}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm">💰</span>
                    <span className="font-bold text-green-600">
                      {staffMember.salary ? `${staffMember.salary} ج.م` : '-'}
                    </span>
                  </div>

                  {/* الحالة */}
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm">📊</span>
                    <button
                      onClick={() => toggleActive(staffMember)}
                      className={`px-3 py-1 rounded-full text-sm font-semibold transition ${
                        staffMember.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {staffMember.isActive ? `✅ ${t('staff.table.active')}` : `❌ ${t('staff.table.inactive')}`}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {staff.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">😕</div>
                <p className="text-xl">{t('staff.empty.title')}</p>
                <p className="text-sm mt-2">{t('staff.empty.subtitle')}</p>
              </div>
            )}
          </div>

          {/* الجدول للشاشات الكبيرة */}
          <div className="hidden lg:block bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-100 to-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-right">{t('staff.table.number')}</th>
                    <th className="px-4 py-3 text-right">{t('staff.table.name')}</th>
                    <th className="px-4 py-3 text-right">{t('staff.table.phone')}</th>
                    <th className="px-4 py-3 text-right">{t('staff.table.position')}</th>
                    <th className="px-4 py-3 text-right">{t('staff.table.salary')}</th>
                    <th className="px-4 py-3 text-right">{t('staff.table.status')}</th>
                    <th className="px-4 py-3 text-right">{t('staff.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((staffMember) => (
                    <tr
                      key={staffMember.id}
                      className={`border-t hover:bg-gray-50 transition ${
                        !staffMember.isActive ? 'opacity-60' : ''
                      } ${isStaffCurrentlyInside(staffMember.id) ? 'bg-green-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <span className="bg-primary-500 text-white px-4 py-2 rounded-lg font-bold text-xl">
                          #{staffMember.staffCode}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{staffMember.name}</span>
                          {isStaffCurrentlyInside(staffMember.id) && (
                            <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                              🟢 {t('staff.attendance.inside')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{staffMember.phone || '-'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${getPositionColor(
                            staffMember.position || ''
                          )}`}
                        >
                          <span>{getPositionIcon(staffMember.position || '')}</span>
                          <span>{getPositionLabel(staffMember.position)}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-green-600">
                        {staffMember.salary ? `${staffMember.salary} ج.م` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleActive(staffMember)}
                          className={`px-3 py-1 rounded-full text-sm font-semibold transition transform hover:scale-105 ${
                            staffMember.isActive
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-red-100 text-red-800 hover:bg-red-200'
                          }`}
                        >
                          {staffMember.isActive ? `✅ ${t('staff.table.active')}` : `❌ ${t('staff.table.inactive')}`}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 items-center">
                          <button
                            onClick={() => handleEdit(staffMember)}
                            className="w-9 h-9 flex items-center justify-center bg-primary-100 hover:bg-primary-200 text-primary-600 rounded-lg transition-all hover:scale-110 active:scale-95"
                            title={t('staff.table.edit')}
                          >
                            ✏️
                          </button>

                          {hasPermission('canDeleteStaff') && (
                            <button
                              onClick={() => handleDelete(staffMember)}
                              className="w-9 h-9 flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-all hover:scale-110 active:scale-95"
                              title={t('staff.table.delete')}
                            >
                              🗑️
                            </button>
                          )}

                          {staffMember.phone && (
                            <StaffBarcodeWhatsApp
                              staffCode={staffMember.staffCode}
                              staffName={staffMember.name}
                              staffPhone={staffMember.phone}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {staff.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-6xl mb-4">😕</div>
                <p className="text-xl">{t('staff.empty.title')}</p>
                <p className="text-sm mt-2">{t('staff.empty.subtitle')}</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false)
          setStaffToDelete(null)
        }}
        onConfirm={confirmDelete}
        title={t('staff.deleteModal.title')}
        message={t('staff.deleteModal.message')}
        itemName={staffToDelete ? `${staffToDelete.name} (#${staffToDelete.staffCode})` : ''}
        loading={deleteLoading}
      />
    </div>
  )
}
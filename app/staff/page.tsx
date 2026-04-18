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

interface StaffDeduction {
  id: string
  staffId: string
  amount: number
  reason: string
  notes?: string
  isApplied: boolean
  appliedAt?: string
  createdAt: string
  updatedAt: string
}

interface Expense {
  id: string
  type: string
  amount: number
  description: string
  notes?: string
  staffId?: string
  isPaid: boolean
  createdAt: string
  updatedAt: string
}

interface Attendance {
  id: string
  staffId: string
  checkIn: string
  checkOut: string | null
  duration: number | null
  notes: string | null
  createdAt: string
  staff: {
    id: string
    staffCode: string
    name: string
    position?: string
  }
}

interface Staff {
  id: string
  staffCode: string  // ✅ الرقم مع s في البداية (مثل s001, s022)
  name: string
  phone?: string
  position?: string
  salary?: number
  notes?: string
  workingHours?: number
  monthlyVacationDays?: number
  shiftStartTime?: string
  shiftEndTime?: string
  isActive: boolean
  createdAt: string
  expenses?: Expense[]
  attendance?: Attendance[]
  deductions?: StaffDeduction[]
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
  'sales': 'sales',
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
    { value: 'sales', label: `💰 ${t('positions.sales')}`, icon: '💰' },
    ...(settings.nutritionEnabled ? [{ value: 'أخصائي تغذية', label: `🥗 ${t('positions.nutritionist')}`, icon: '🥗' }] : []),
    ...(settings.physiotherapyEnabled ? [{ value: 'أخصائي علاج طبيعي', label: `🏥 ${t('positions.physiotherapist')}`, icon: '🏥' }] : []),
    { value: 'other', label: `📝 ${t('positions.other')}`, icon: '📝' },
  ]

  // ✅ تحويل staffCode من s022 إلى 100000022 (9 أرقام)
  const toNineDigitCode = (code: string): string => {
    if (!code) return '000000000'
    if (code.startsWith('s') || code.startsWith('S')) {
      const numericPart = parseInt(code.substring(1), 10)
      if (isNaN(numericPart)) return '000000000'
      return (100000000 + numericPart).toString()
    }
    // لو الكود رقم بالفعل، نرجعه كما هو
    if (/^\d{9}$/.test(code)) return code
    return code
  }

  // Helper function to translate position
  const getPositionLabel = (position: string | null): string => {
    if (!position) return '-'
    const key = POSITION_MAP[position] || 'other'
    return t(`positions.${key}` as any)
  }
  const { hasPermission, isAdmin, loading: permissionsLoading } = usePermissions()

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
    workingHours: 0,
    monthlyVacationDays: 0,
    shiftStartTime: '',
    shiftEndTime: '',
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
      workingHours: 0,
      monthlyVacationDays: 0,
      shiftStartTime: '',
      shiftEndTime: '',
    })
    setShowOtherPosition(false)
    setEditingStaff(null)
    setShowForm(false)
  }

  const handleEdit = (staffMember: Staff) => {
    const displayCode = toNineDigitCode(staffMember.staffCode)

    setFormData({
      staffCode: displayCode,
      name: staffMember.name,
      phone: staffMember.phone || '',
      position: staffMember.position || '', // الآن قد يحتوي على عدة وظائف مفصولة بفواصل
      customPosition: '',
      salary: staffMember.salary || 0,
      notes: staffMember.notes || '',
      workingHours: staffMember.workingHours || 0,
      monthlyVacationDays: staffMember.monthlyVacationDays || 0,
      shiftStartTime: staffMember.shiftStartTime || '',
      shiftEndTime: staffMember.shiftEndTime || '',
    })
    setShowOtherPosition(false)
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

      const { salary: _salary, ...formDataWithoutSalary } = formData
      const safeFormData = isAdmin ? formData : formDataWithoutSalary
      const body = editingStaff
        ? { id: editingStaff.id, ...safeFormData, position: finalPosition, staffCode: staffCodeWithS }
        : { ...safeFormData, position: finalPosition, staffCode: staffCodeWithS }

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
      مدرب: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-700',
      ريسبشن: 'bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-200 border border-primary-200 dark:border-primary-700',
      بار: 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200 border border-orange-200 dark:border-orange-700',
      HK: 'bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-200 border border-primary-200 dark:border-primary-700',
      مدير: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-700',
      محاسب: 'bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-200 border border-primary-200 dark:border-primary-700',
      صيانة: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700',
      أمن: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600',
      sales: 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-700',
      'أخصائي تغذية': 'bg-lime-100 dark:bg-lime-900/50 text-lime-800 dark:text-lime-200 border border-lime-200 dark:border-lime-700',
      'أخصائي علاج طبيعي': 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700',
    }
    return colors[position] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600'
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
      <div className="bg-gradient-to-r from-primary-600 to-primary-600 dark:from-primary-700 dark:to-primary-700 rounded-2xl shadow-2xl p-4 sm:p-8 mb-8 text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
              <span className="text-4xl sm:text-5xl">🔢</span>
              <span>{t('staff.scanner.title')}</span>
            </h2>
            <p className="text-primary-100 dark:text-primary-200 text-sm sm:text-base">{t('staff.scanner.subtitle')}</p>
          </div>
          {lastScanTime && (
            <div className="bg-white/90 dark:bg-gray-800/30 backdrop-blur px-4 sm:px-6 py-2 sm:py-3 rounded-xl w-full sm:w-auto border border-white/20 dark:border-gray-700/50">
              <p className="text-xs sm:text-sm text-gray-100 dark:text-gray-200">{t('staff.scanner.lastScan')}</p>
              <p className="text-lg sm:text-xl font-bold text-white dark:text-gray-100">{lastScanTime.toLocaleTimeString('ar-EG')}</p>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
          <input
            ref={scannerRef}
            type="text"
            value={scannerInput}
            onChange={(e) => setScannerInput(e.target.value)}
            onKeyPress={handleScannerInput}
            className="w-full px-4 sm:px-6 py-4 sm:py-6 border-4 border-primary-400 dark:border-primary-500 rounded-xl text-2xl sm:text-4xl font-bold text-center focus:border-primary-600 dark:focus:border-primary-400 focus:ring-4 focus:ring-primary-200 dark:focus:ring-primary-900/50 transition text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-700"
            placeholder={t('staff.scanner.placeholder')}
            autoFocus
          />
          <p className="text-center text-gray-600 dark:text-gray-300 mt-3 text-xs sm:text-sm">
            {t('staff.scanner.hint')}
          </p>
        </div>

        {scanMessage && (
          <div
            className={`mt-4 p-4 sm:p-6 rounded-xl text-center font-bold text-lg sm:text-2xl animate-pulse border-2 ${
              scanMessage.includes('✅')
                ? 'bg-green-500 dark:bg-green-600 border-green-400 dark:border-green-500 text-white'
                : 'bg-red-500 dark:bg-red-600 border-red-400 dark:border-red-500 text-white'
            }`}
          >
            {scanMessage}
          </div>
        )}
      </div>

      {/* ✅ قسم حضور اليوم */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-6 mb-8 border-4 border-green-200 dark:border-green-700">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
            <h3 className="text-xl sm:text-2xl font-bold flex items-center gap-2 dark:text-white">
              <span>📊</span>
              <span>{t('staff.attendance.title')}</span>
            </h3>
            <Link
              href="/attendance-report"
              className="w-full sm:w-auto bg-gradient-to-r from-primary-600 to-primary-600 dark:from-primary-700 dark:to-primary-700 text-white px-4 sm:px-6 py-2 rounded-lg hover:from-primary-700 hover:to-primary-700 dark:hover:from-primary-600 dark:hover:to-primary-600 transition transform hover:scale-105 shadow-lg flex items-center justify-center gap-2 text-sm font-bold"
            >
              <span>📋</span>
              <span>{t('nav.staffAttendance')}</span>
            </Link>
          </div>
          <div className="flex gap-2 sm:gap-4 w-full lg:w-auto">
            <div className="flex-1 lg:flex-none bg-green-100 dark:bg-green-900/50 px-3 sm:px-6 py-2 sm:py-3 rounded-xl text-center border border-green-200 dark:border-green-700">
              <p className="text-xs sm:text-sm text-green-700 dark:text-green-300">{t('staff.attendance.presentNow')}</p>
              <p className="text-2xl sm:text-3xl font-bold text-green-800 dark:text-green-200">{presentStaff}</p>
            </div>
            <div className="flex-1 lg:flex-none bg-primary-100 dark:bg-primary-900/50 px-3 sm:px-6 py-2 sm:py-3 rounded-xl text-center border border-primary-200 dark:border-primary-700">
              <p className="text-xs sm:text-sm text-primary-700 dark:text-primary-300">{t('staff.attendance.totalPresent')}</p>
              <p className="text-2xl sm:text-3xl font-bold text-primary-800 dark:text-primary-200">{totalCheckedIn}</p>
            </div>
          </div>
        </div>

        {todayAttendance.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-primary-100 to-primary-100 dark:from-primary-900/50 dark:to-primary-900/50 border-b-2 border-primary-200 dark:border-primary-700">
                <tr>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-bold text-gray-800 dark:text-gray-200 text-xs sm:text-sm">{t('staff.attendance.number')}</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right font-bold text-gray-800 dark:text-gray-200 text-xs sm:text-sm">{t('staff.attendance.name')}</th>
                  <th className="hidden md:table-cell px-2 sm:px-4 py-2 sm:py-3 text-right font-bold text-gray-800 dark:text-gray-200 text-xs sm:text-sm">{t('staff.attendance.position')}</th>
                  <th className="px-4 py-3 text-center font-bold text-gray-800 dark:text-gray-200">
                    <div className="flex items-center justify-center gap-2">
                      <span>🕐</span>
                      <span>وقت الدخول</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center font-bold text-gray-800 dark:text-gray-200">
                    <div className="flex items-center justify-center gap-2">
                      <span>🕐</span>
                      <span>وقت الخروج</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center font-bold text-gray-800 dark:text-gray-200">
                    <div className="flex items-center justify-center gap-2">
                      <span>⏱️</span>
                      <span>ساعات العمل</span>
                    </div>
                  </th>
                  <th className="hidden sm:table-cell px-2 sm:px-4 py-2 sm:py-3 text-center font-bold text-gray-800 dark:text-gray-200 text-xs sm:text-sm">{t('staff.attendance.status')}</th>
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
                    <tr key={att.id} className={`border-t border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition ${att.checkOut === null ? 'bg-green-50 dark:bg-green-900/30 border-r-4 border-green-500 dark:border-green-600' : 'bg-white dark:bg-gray-800'}`}>
                      <td className="px-2 sm:px-4 py-2 sm:py-4">
                        <span className="bg-primary-500 dark:bg-primary-600 text-white px-2 sm:px-3 py-1 rounded-lg font-bold text-xs sm:text-sm">
                          #{toNineDigitCode(att.staff.staffCode)}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-4 font-bold text-gray-800 dark:text-gray-100 text-xs sm:text-sm">{att.staff.name}</td>
                      <td className="hidden md:table-cell px-2 sm:px-4 py-2 sm:py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 sm:px-3 py-1 rounded-full text-xs font-semibold ${getPositionColor(
                            att.staff.position || ''
                          )}`}
                        >
                          {getPositionIcon(att.staff.position || '')} {getPositionLabel(att.staff.position)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="bg-primary-50 dark:bg-primary-900/50 px-4 py-2 rounded-lg inline-block border-2 border-primary-200 dark:border-primary-700">
                          <div className="text-lg font-bold text-primary-800 dark:text-primary-200">
                            {checkInTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </div>
                          <div className="text-xs text-primary-600 dark:text-primary-300">
                            {checkInTime.toLocaleDateString('ar-EG', { weekday: 'short' })}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {checkOutTime ? (
                          <div className="bg-orange-50 dark:bg-orange-900/50 px-4 py-2 rounded-lg inline-block border-2 border-orange-200 dark:border-orange-700">
                            <div className="text-lg font-bold text-orange-800 dark:text-orange-200">
                              {checkOutTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </div>
                            <div className="text-xs text-orange-600 dark:text-orange-300">
                              {checkOutTime.toLocaleDateString('ar-EG', { weekday: 'short' })}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-yellow-50 dark:bg-yellow-900/50 px-4 py-2 rounded-lg inline-block border-2 border-yellow-300 dark:border-yellow-700">
                            <div className="text-sm font-bold text-yellow-800 dark:text-yellow-200">
                              لم ينصرف بعد
                            </div>
                            <div className="text-xs text-yellow-600 dark:text-yellow-300">
                              جاري العمل...
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className={`px-4 py-3 rounded-lg inline-block border-2 ${att.checkOut ? 'bg-primary-50 dark:bg-primary-900/50 border-primary-200 dark:border-primary-700' : 'bg-green-50 dark:bg-green-900/50 border-green-300 dark:border-green-700'}`}>
                          {hours === 0 && minutes === 0 ? (
                            <div className="text-lg font-bold text-gray-600 dark:text-gray-300">بدأ للتو</div>
                          ) : (
                            <div className="flex gap-2 justify-center mb-2">
                              {hours > 0 && (
                                <div className="bg-white dark:bg-gray-700 border-2 border-primary-300 dark:border-primary-600 rounded px-3 py-1">
                                  <div className="text-xl font-bold text-primary-800 dark:text-primary-200">{hours}</div>
                                  <div className="text-xs text-primary-600 dark:text-primary-300">ساعة</div>
                                </div>
                              )}
                              {minutes > 0 && (
                                <div className="bg-white dark:bg-gray-700 border-2 border-primary-300 dark:border-primary-600 rounded px-3 py-1">
                                  <div className="text-xl font-bold text-primary-800 dark:text-primary-200">{minutes}</div>
                                  <div className="text-xs text-primary-600 dark:text-primary-300">دقيقة</div>
                                </div>
                              )}
                            </div>
                          )}
                          <div className={`text-xs ${att.checkOut ? 'text-primary-600 dark:text-primary-300' : 'text-green-600 dark:text-green-300'} font-semibold`}>
                            {att.checkOut ? '✅ انتهى' : '⏳ يعمل الآن'}
                          </div>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-2 sm:px-4 py-2 sm:py-4 text-center">
                        {att.checkOut === null ? (
                          <span className="px-2 sm:px-4 py-1 sm:py-2 rounded-full text-xs sm:text-sm font-bold bg-green-500 dark:bg-green-600 text-white shadow-lg animate-pulse">
                            🟢 {t('staff.attendance.inside')}
                          </span>
                        ) : (
                          <span className="px-2 sm:px-4 py-1 sm:py-2 rounded-full text-xs sm:text-sm font-bold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
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
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <div className="text-6xl mb-4">😴</div>
            <p className="text-xl">{t('staff.attendance.noAttendance')}</p>
          </div>
        )}
      </div>

      {/* باقي الصفحة - إدارة الموظفين */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-gray-900 dark:text-white">👥 {t('staff.title')}</h1>

        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          {hasPermission('canViewDeductions') && (
            <Link
              href="/staff-deductions"
              className="flex-1 sm:flex-none text-center bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 px-5 py-2 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition font-medium shadow-sm"
            >
              📉 {t('nav.staffDeductions')}
            </Link>
          )}
          <Link
            href="/staff-hr-assistant"
            className="flex-1 sm:flex-none text-center bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-700 dark:to-indigo-700 text-white px-5 py-2 rounded-lg hover:from-purple-700 hover:to-indigo-700 dark:hover:from-purple-600 dark:hover:to-indigo-600 transition transform hover:scale-105 shadow-lg font-medium"
          >
            {t('staff.hrAssistant.title')}
          </Link>
          <button
            onClick={() => {
              resetForm()
              setShowForm(true)
            }}
            className="flex-1 sm:flex-none bg-primary-600 dark:bg-primary-700 text-white px-6 py-2 rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600 transition transform hover:scale-105 shadow-md"
          >
            ➕ {t('staff.addNewStaff')}
          </button>
        </div>
      </div>

      {/* نموذج الإضافة/التعديل - Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) resetForm() }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto" dir={direction} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
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
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 text-3xl leading-none"
              >
                ×
              </button>
            </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* ✅ رقم الموظف */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">
                  {t('staff.form.staffNumberRequired')}
                </label>
                <input
                  type="text"
                  required
                  value={formData.staffCode}
                  onChange={(e) => setFormData({ ...formData, staffCode: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 dark:focus:border-primary-400 focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900/50 transition text-2xl font-bold bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                  placeholder={randomStaffCode || "100000022"}
                  minLength={9}
                  maxLength={9}
                  pattern="\d{9}"
                  disabled={!!editingStaff}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {editingStaff
                    ? t('staff.form.staffNumberLocked')
                    : t('staff.form.staffNumberHint')}
                </p>
              </div>

              {/* الاسم */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">
                  {t('staff.form.nameRequired')}
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 dark:focus:border-primary-400 focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900/50 transition bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder={t('staff.form.namePlaceholder')}
                />
              </div>

              {/* رقم الهاتف */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">{t('staff.form.phone')}</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 dark:focus:border-primary-400 focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900/50 transition bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder={t('staff.form.phonePlaceholder')}
                />
              </div>

              {/* المرتب - للأدمن فقط */}
              {isAdmin && (
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">
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
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 dark:focus:border-primary-400 focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900/50 transition bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder={t('staff.form.salaryPlaceholder')}
                />
              </div>
              )}
            </div>

              {/* الوظيفة - اختيار متعدد */}
              <div>
                <label className="block text-sm font-bold mb-3 text-gray-700 dark:text-gray-200">
                  {t('staff.form.positionRequired')} (يمكن اختيار أكثر من وظيفة)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  {POSITIONS.map((pos) => {
                    const selectedPositions = formData.position ? formData.position.split(',') : []
                    const isSelected = selectedPositions.includes(pos.value)

                    return (
                      <label
                        key={pos.value}
                        className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-all text-sm ${
                          isSelected
                            ? 'bg-primary-100 dark:bg-primary-900/40 border-2 border-primary-500'
                            : 'bg-white dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            const positions = formData.position ? formData.position.split(',').filter(p => p) : []
                            if (positions.includes(pos.value)) {
                              const newPositions = positions.filter(p => p !== pos.value)
                              setFormData({ ...formData, position: newPositions.join(',') })
                            } else {
                              setFormData({ ...formData, position: [...positions, pos.value].join(',') })
                            }
                          }}
                          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                        <span className={`font-medium ${isSelected ? 'text-primary-900 dark:text-primary-100' : 'text-gray-700 dark:text-gray-200'}`}>
                          {pos.label}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* حقل الوظيفة المخصصة */}
              {showOtherPosition && (
                <div className="bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-300 dark:border-yellow-700 rounded-lg p-4">
                  <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">
                    {t('staff.form.customPositionRequired')}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customPosition}
                    onChange={(e) =>
                      setFormData({ ...formData, customPosition: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg focus:border-yellow-500 dark:focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200 dark:focus:ring-yellow-900/50 transition bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder={t('staff.form.customPositionPlaceholder')}
                  />
                </div>
              )}

            {/* ساعات العمل + أيام الإجازة */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">{t('staff.form.workingHours')}</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={formData.workingHours}
                  onChange={(e) => setFormData({ ...formData, workingHours: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 dark:focus:border-primary-400 focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900/50 transition bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder={t('staff.form.workingHoursPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">{t('staff.form.monthlyVacationDays')}</label>
                <input
                  type="number"
                  min="0"
                  max="31"
                  value={formData.monthlyVacationDays}
                  onChange={(e) => setFormData({ ...formData, monthlyVacationDays: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 dark:focus:border-primary-400 focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900/50 transition bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder={t('staff.form.monthlyVacationDaysPlaceholder')}
                />
              </div>
            </div>

            {/* ساعة بداية ونهاية الشيفت */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">{t('staff.form.shiftStartTime')}</label>
                <input
                  type="time"
                  value={formData.shiftStartTime}
                  onChange={(e) => setFormData({ ...formData, shiftStartTime: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 dark:focus:border-primary-400 focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900/50 transition bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">{t('staff.form.shiftEndTime')}</label>
                <input
                  type="time"
                  value={formData.shiftEndTime}
                  onChange={(e) => setFormData({ ...formData, shiftEndTime: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 dark:focus:border-primary-400 focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900/50 transition bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* ملاحظات */}
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">{t('staff.form.notes')}</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-primary-500 dark:focus:border-primary-400 focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900/50 transition resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows={3}
                placeholder={t('staff.form.notesPlaceholder')}
              />
            </div>

            {/* أزرار التحكم */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 dark:from-primary-700 dark:to-primary-800 text-white py-3 rounded-lg hover:from-primary-700 hover:to-primary-800 dark:hover:from-primary-600 dark:hover:to-primary-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed font-bold text-lg shadow-lg transform transition hover:scale-105 active:scale-95 disabled:hover:scale-100"
              >
                {submitting ? `⏳ ${t('staff.form.saving')}` : editingStaff ? `✅ ${t('staff.form.update')}` : `➕ ${t('staff.form.addStaff')}`}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-8 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:from-gray-300 hover:to-gray-400 dark:hover:from-gray-600 dark:hover:to-gray-500 font-bold shadow-lg transform transition hover:scale-105 active:scale-95"
              >
                {t('staff.form.cancel')}
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {/* الإحصائيات */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-700 dark:to-primary-800 text-white rounded-lg p-4 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 dark:text-primary-200 text-xs sm:text-sm mb-1">{t('staff.stats.totalStaff')}</p>
              <p className="text-2xl sm:text-4xl font-bold">{staff.length}</p>
            </div>
            <div className="text-3xl sm:text-5xl opacity-20">👥</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 dark:from-green-700 dark:to-green-800 text-white rounded-lg p-4 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 dark:text-green-200 text-xs sm:text-sm mb-1">{t('staff.stats.activeStaff')}</p>
              <p className="text-2xl sm:text-4xl font-bold">{staff.filter((s) => s.isActive).length}</p>
            </div>
            <div className="text-3xl sm:text-5xl opacity-20">✅</div>
          </div>
        </div>

        {isAdmin && (
        <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-700 dark:to-primary-800 text-white rounded-lg p-4 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-primary-100 dark:text-primary-200 text-xs sm:text-sm mb-1">{t('staff.stats.totalSalaries')}</p>
              <p className="text-xl sm:text-3xl font-bold">
                {staff.filter(s => s.isActive).reduce((sum, s) => sum + (s.salary || 0), 0).toFixed(0)} ج.م
              </p>
            </div>
            <div className="text-3xl sm:text-5xl opacity-20">💰</div>
          </div>
        </div>
        )}

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 dark:from-orange-700 dark:to-orange-800 text-white rounded-lg p-4 sm:p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 dark:text-orange-200 text-xs sm:text-sm mb-1">{t('staff.stats.coaches')}</p>
              <p className="text-2xl sm:text-4xl font-bold">{staffByPosition['مدرب'] || 0}</p>
            </div>
            <div className="text-3xl sm:text-5xl opacity-20">💪</div>
          </div>
        </div>

        <Link
          href="/expenses"
          className="col-span-2 sm:col-span-3 lg:col-span-1 bg-gradient-to-br from-red-500 to-red-600 dark:from-red-700 dark:to-red-800 text-white rounded-lg p-4 sm:p-6 shadow-lg hover:shadow-2xl transition-all hover:scale-105 active:scale-95"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 dark:text-red-200 text-xs sm:text-sm mb-1">{t('staff.loans.title')}</p>
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
          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" dir={direction}>
            {staff.map((staffMember) => (
              <div
                key={staffMember.id}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border-2 hover:shadow-lg dark:hover:shadow-2xl transition ${
                  !staffMember.isActive ? 'opacity-60 border-gray-300 dark:border-gray-600' : isStaffCurrentlyInside(staffMember.id) ? 'border-green-400 dark:border-green-600' : 'border-gray-200 dark:border-gray-600'
                }`}
              >
                {/* Header */}
                <div className={`p-3 ${!staffMember.isActive ? 'bg-gray-500 dark:bg-gray-600' : isStaffCurrentlyInside(staffMember.id) ? 'bg-gradient-to-r from-green-600 to-emerald-700 dark:from-green-700 dark:to-emerald-800' : 'bg-gradient-to-r from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-white/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-lg text-white/80">👤</span>
                      </div>
                      <div>
                        <div className="font-bold text-white text-base">{staffMember.name}</div>
                        <div className="text-white/80 text-xs">
                          #{toNineDigitCode(staffMember.staffCode)} {staffMember.phone ? `• ${staffMember.phone}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isStaffCurrentlyInside(staffMember.id) && (
                        <span className="bg-green-400 dark:bg-green-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse font-bold">
                          🟢 {t('staff.attendance.inside')}
                        </span>
                      )}
                      <button
                        onClick={() => toggleActive(staffMember)}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          staffMember.isActive ? 'bg-green-500 dark:bg-green-600 text-white' : 'bg-red-500 dark:bg-red-600 text-white'
                        }`}
                      >
                        {staffMember.isActive ? t('staff.table.active') : t('staff.table.inactive')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-3 space-y-2.5">
                  {/* Positions */}
                  <div className="flex flex-wrap gap-1.5">
                    {staffMember.position ? staffMember.position.split(',').filter(p => p).map((pos, idx) => (
                      <span
                        key={idx}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${getPositionColor(pos)}`}
                      >
                        <span>{getPositionIcon(pos)}</span>
                        <span>{getPositionLabel(pos)}</span>
                      </span>
                    )) : <span className="text-gray-400 dark:text-gray-500 text-sm">-</span>}
                  </div>

                  {/* Info Grid */}
                  <div className={`grid ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                    {isAdmin && (
                      <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-2 text-center">
                        <div className="text-[10px] text-green-700 dark:text-green-300 font-semibold">{t('staff.table.salary')}</div>
                        <div className="text-sm font-bold text-green-600 dark:text-green-400">
                          {staffMember.salary ? `${staffMember.salary} ${t('common.egp')}` : '-'}
                        </div>
                      </div>
                    )}
                    {staffMember.deductions && staffMember.deductions.length > 0 ? (
                      <div className={`border rounded-lg p-2 text-center ${
                        staffMember.deductions.filter(d => !d.isApplied).length > 0
                          ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700'
                          : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                      }`}>
                        <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">{t('staff.table.deductions')}</div>
                        <div className="flex items-center justify-center gap-1 mt-0.5">
                          {staffMember.deductions.filter(d => !d.isApplied).length > 0 && (
                            <span className="bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 px-1.5 py-0.5 rounded text-xs font-bold">
                              {staffMember.deductions.filter(d => !d.isApplied).length} {t('staff.table.pending')}
                            </span>
                          )}
                          {staffMember.deductions.filter(d => d.isApplied).length > 0 && (
                            <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded text-xs font-bold">
                              {staffMember.deductions.filter(d => d.isApplied).length} {t('staff.table.applied')}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : !isAdmin ? (
                      <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-2 text-center">
                        <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">{t('staff.table.deductions')}</div>
                        <div className="text-sm font-bold text-gray-400 dark:text-gray-500">-</div>
                      </div>
                    ) : null}
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => handleEdit(staffMember)}
                      className="bg-orange-600 text-white py-2 rounded-lg text-sm hover:bg-orange-700 dark:hover:bg-orange-800 font-bold flex items-center justify-center gap-1 transition-all hover:scale-105 active:scale-95"
                    >
                      <span>✏️</span>
                      <span>{t('staff.table.edit')}</span>
                    </button>
                    {hasPermission('canDeleteStaff') ? (
                      <button
                        onClick={() => handleDelete(staffMember)}
                        className="bg-red-600 text-white py-2 rounded-lg text-sm hover:bg-red-700 dark:hover:bg-red-800 font-bold flex items-center justify-center gap-1 transition-all hover:scale-105 active:scale-95"
                      >
                        <span>🗑️</span>
                        <span>{t('staff.table.delete')}</span>
                      </button>
                    ) : staffMember.phone ? (
                      <StaffBarcodeWhatsApp
                        staffCode={staffMember.staffCode}
                        staffName={staffMember.name}
                        staffPhone={staffMember.phone}
                      />
                    ) : <div />}
                    {hasPermission('canDeleteStaff') && staffMember.phone && (
                      <div className="col-span-2">
                        <StaffBarcodeWhatsApp
                          staffCode={staffMember.staffCode}
                          staffName={staffMember.name}
                          staffPhone={staffMember.phone}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {staff.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <div className="text-6xl mb-4">😕</div>
              <p className="text-xl">{t('staff.empty.title')}</p>
              <p className="text-sm mt-2">{t('staff.empty.subtitle')}</p>
            </div>
          )}
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
        itemName={staffToDelete ? `${staffToDelete.name} (#${toNineDigitCode(staffToDelete.staffCode)})` : ''}
        loading={deleteLoading}
      />
    </div>
  )
}
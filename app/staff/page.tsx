'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import dynamicImport from 'next/dynamic'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionDenied from '../../components/PermissionDenied'
import { LoadingScreen } from '../../components/Spinner'
import StaffBarcodeWhatsApp from '../../components/StaffBarcodeWhatsApp'
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal'
import PayrollSettingsModal from '../../components/PayrollSettingsModal'
//  Camera modal للسيلفي وقت السكان (anti buddy-punching)
const CameraModal = dynamicImport(() => import('../../components/CameraModal'), { ssr: false })
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast } from '../../contexts/ToastContext'
import { useServiceSettings } from '../../contexts/ServiceSettingsContext'
import { fetchStaff } from '../../lib/api/staff'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

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
  staffCode: string // الرقم مع s في البداية (مثل s001, s022)
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
  const { t, direction, locale } = useLanguage()
  const toast = useToast()
  const { settings } = useServiceSettings()

  // Dynamic positions based on service settings
  const POSITIONS = [
    { value: 'مدرب', label: t('positions.trainer') },
    { value: 'ريسبشن', label: t('positions.receptionist') },
    { value: 'بار', label: t('positions.barista') },
    { value: 'HK', label: t('positions.housekeeping') },
    { value: 'مدير', label: t('positions.manager') },
    { value: 'محاسب', label: t('positions.accountant') },
    { value: 'صيانة', label: t('positions.maintenance') },
    { value: 'أمن', label: t('positions.security') },
    { value: 'sales', label: t('positions.sales') },
    ...(settings.nutritionEnabled ? [{ value: 'أخصائي تغذية', label: t('positions.nutritionist') }] : []),
    ...(settings.physiotherapyEnabled ? [{ value: 'أخصائي علاج طبيعي', label: t('positions.physiotherapist') }] : []),
    { value: 'other', label: t('positions.other') },
  ]

  // تحويل staffCode من s022 إلى 100000022 (9 أرقام)
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
  const [showPayrollSettings, setShowPayrollSettings] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showOtherPosition, setShowOtherPosition] = useState(false)

  // Delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  
  // حالة Scanner
  const [scannerInput, setScannerInput] = useState('')
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null)
  const [scanMessage, setScanMessage] = useState('')
  const scannerRef = useRef<HTMLInputElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  //  Selfie capture state — للحماية ضد buddy-punching
  const [showSelfieCamera, setShowSelfieCamera] = useState(false)
  const [pendingAttendanceId, setPendingAttendanceId] = useState<string | null>(null)
  const [pendingStaffName, setPendingStaffName] = useState<string>('')

  const [formData, setFormData] = useState({
    staffCode: '', // الرقم البسيط
    name: '',
    phone: '',
    position: '',
    customPosition: '',
    salary: 0,
    notes: '',
    workingHours: 0,
    weeklyOffDays: [] as string[], // e.g. ['Friday', 'Saturday']
    shiftIsVariable: false,
    shiftStartTime: '',
    shiftEndTime: '',
    // Per-day times when shift is variable: { Sunday: {start, end}, Monday: {...}, ... }
    dailyShiftTimes: {} as Record<string, { start: string; end: string }>,
    coachTarget: 0, //  التارجت الشهري للكوتش (بالجنيه)
  })

  // توليد رقم عشوائي من 9 أرقام للموظف
  const [randomStaffCode, setRandomStaffCode] = useState('')

  //  إعدادات الكومشن — لتحديد إظهار التارجت (يظهر بس لو revenue + useSeparateCoachTarget مفعّل)
  const [commissionConfig, setCommissionConfig] = useState<{ method: 'revenue' | 'sessions'; useSeparateCoachTarget: boolean }>({
    method: 'revenue',
    useSeparateCoachTarget: false
  })
  useEffect(() => {
    fetch('/api/settings/commission')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setCommissionConfig({
            method: data.defaultCommissionMethod || 'revenue',
            useSeparateCoachTarget: !!data.useSeparateCoachTarget,
          })
        }
      })
      .catch(() => {})
  }, [])

  // المؤشر النهائي لإظهار قسم تارجت الكوتش
  const showCoachTargetSection = commissionConfig.useSeparateCoachTarget && commissionConfig.method === 'revenue'

  useEffect(() => {
    // توليد رقم عشوائي فقط عند فتح النموذج لإضافة موظف جديد
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
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
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

  // دوال الصوت
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

  // معالجة السكان بالرقم
const handleScan = async (staffCode: string) => {
  try {
    // تنظيف الكود فقط (إزالة المسافات)
    let cleanCode = staffCode.trim();

    // لو الكود رقم من 9 خانات (100000000+)، فهو موظف
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

      //  السيلفي بتشتغل بس عند تسجيل الدخول (check-in) — مش عند الخروج
      // الأونر طلب: الموظف يتصور بس لما يجي، مش لما يطلع
      if (settings.requireSelfieOnCheckIn && data.action === 'check-in' && data.attendance?.id) {
        setPendingAttendanceId(data.attendance.id);
        setPendingStaffName(data.staffName || '');
        setShowSelfieCamera(true);
      }
    } else {
      playErrorSound();
      setScanMessage(` ${data.error || t('staff.scanner.errorRegister')}`);
      setTimeout(() => setScanMessage(''), 5000);
    }
  } catch (error) {
    console.error('Scan error:', error);
    playErrorSound();
    setScanMessage(t('staff.scanner.errorOccurred'));
    setTimeout(() => setScanMessage(''), 5000);
  }
};

//  رفع السيلفي بعد التقاطها
const handleSelfieCapture = async (file: File) => {
  if (!pendingAttendanceId) return;
  try {
    // تحويل الـ File لـ base64
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    await fetch('/api/attendance/upload-selfie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendanceId: pendingAttendanceId, image: base64 }),
    });
  } catch (error) {
    console.error('Selfie upload error:', error);
    // الـ scan نجح بالفعل، فمفيش error message للمستخدم — نسيب الـ silent fail
  } finally {
    setPendingAttendanceId(null);
    setPendingStaffName('');
    setShowSelfieCamera(false);
  }
};


  // معالجة إدخال Scanner
  const handleScannerInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && scannerInput.trim()) {
      handleScan(scannerInput.trim())
      setScannerInput('')
    }
  }

  // التحقق من حضور الموظف اليوم
  const isStaffPresent = (staffId: string) => {
    return todayAttendance.some((att) => att.staffId === staffId)
  }

  // التحقق إذا كان الموظف داخل حالياً (لم يسجل انصراف)
  const isStaffCurrentlyInside = (staffId: string) => {
    return todayAttendance.some((att) => att.staffId === staffId && att.checkOut === null)
  }

  // الحصول على معلومات حضور الموظف
  const getStaffAttendanceInfo = (staffId: string) => {
    return todayAttendance.find((att) => att.staffId === staffId)
  }

  // تنسيق مدة العمل
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
      weeklyOffDays: [],
      shiftIsVariable: false,
      shiftStartTime: '',
      shiftEndTime: '',
      dailyShiftTimes: {},
      coachTarget: 0,
    })
    setShowOtherPosition(false)
    setEditingStaff(null)
    setShowForm(false)
  }

  const handleEdit = async (staffMember: Staff) => {
    const displayCode = toNineDigitCode(staffMember.staffCode)

    // Derive weekly off days + variable flag + per-day times from existing rotations
    let weeklyOffDays: string[] = []
    let shiftIsVariable = false
    let shiftStartTime = staffMember.shiftStartTime || ''
    let shiftEndTime = staffMember.shiftEndTime || ''
    let dailyShiftTimes: Record<string, { start: string; end: string }> = {}
    try {
      const res = await fetch(`/api/rotations?staffId=${staffMember.id}`)
      if (res.ok) {
        const rotations: Array<{ dayOfWeek: string; startTime: string; endTime: string; isVariable: boolean }> = await res.json()
        const ALL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const workingDays = new Set(rotations.map(r => r.dayOfWeek))
        weeklyOffDays = ALL_DAYS.filter(d => !workingDays.has(d))
        if (rotations.length > 0) {
          shiftIsVariable = rotations[0].isVariable
          if (!shiftIsVariable) {
            shiftStartTime = rotations[0].startTime
            shiftEndTime = rotations[0].endTime
          }
          // Pre-fill per-day times from existing rotations
          rotations.forEach(r => {
            dailyShiftTimes[r.dayOfWeek] = { start: r.startTime, end: r.endTime }
          })
        }
      }
    } catch {}

    setFormData({
      staffCode: displayCode,
      name: staffMember.name,
      phone: staffMember.phone || '',
      position: staffMember.position || '', // الآن قد يحتوي على عدة وظائف مفصولة بفواصل
      customPosition: '',
      salary: staffMember.salary || 0,
      notes: staffMember.notes || '',
      workingHours: staffMember.workingHours || 0,
      weeklyOffDays,
      shiftIsVariable,
      shiftStartTime,
      shiftEndTime,
      dailyShiftTimes,
      coachTarget: (staffMember as any).coachTarget || 0,
    })
    setShowOtherPosition(false)
    setEditingStaff(staffMember)
    setShowForm(true)
  }

  const handlePositionChange = (value: string) => {
    setFormData({ ...formData, position: value, customPosition: '' })
    setShowOtherPosition(value === 'other')
  }

  // Build the rotations array from form state — used by both handleSubmit and
  // the explicit "Update schedule" button.
  const buildRotationsForBulk = (
    weeklyOffDays: string[],
    shiftIsVariable: boolean,
    fallbackStart: string,
    fallbackEnd: string,
    dailyShiftTimes: Record<string, { start: string; end: string }>
  ) => {
    const ALL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const workingDays = ALL_DAYS.filter(d => !weeklyOffDays.includes(d))
    return workingDays.map(d => {
      const perDay = dailyShiftTimes[d]
      const start = shiftIsVariable
        ? (perDay?.start || fallbackStart || '09:00')
        : (fallbackStart || '09:00')
      const end = shiftIsVariable
        ? (perDay?.end || fallbackEnd || '17:00')
        : (fallbackEnd || '17:00')
      return { dayOfWeek: d, startTime: start, endTime: end, isVariable: shiftIsVariable }
    })
  }

  const syncRotationsToCalendar = async (
    staffId: string,
    weeklyOffDays: string[],
    shiftIsVariable: boolean,
    fallbackStart: string,
    fallbackEnd: string,
    dailyShiftTimes: Record<string, { start: string; end: string }>
  ) => {
    const rotations = buildRotationsForBulk(weeklyOffDays, shiftIsVariable, fallbackStart, fallbackEnd, dailyShiftTimes)
    return fetch('/api/rotations/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffId, rotations }),
    })
  }

  // Explicit button handler — pushes the schedule to the calendar without saving
  // the full staff form. Useful when the user just adjusted per-day times.
  const [syncingSchedule, setSyncingSchedule] = useState(false)
  const handleSyncSchedule = async () => {
    if (!editingStaff?.id) {
      toast.warning(locale === 'ar' ? 'احفظ الموظف أولاً' : 'Save the staff member first')
      return
    }
    setSyncingSchedule(true)
    try {
      const res = await syncRotationsToCalendar(
        editingStaff.id,
        formData.weeklyOffDays,
        formData.shiftIsVariable,
        formData.shiftStartTime,
        formData.shiftEndTime,
        formData.dailyShiftTimes
      )
      if (res.ok) {
        toast.success(locale === 'ar' ? 'تم تحديث جدول العمل في الكاليندر' : 'Schedule updated in calendar')
      } else {
        toast.error(locale === 'ar' ? 'فشل التحديث' : 'Update failed')
      }
    } catch {
      toast.error(locale === 'ar' ? 'فشل التحديث' : 'Update failed')
    } finally {
      setSyncingSchedule(false)
    }
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

    // التحقق من أن الرقم 9 أرقام
    const numericCode = formData.staffCode.replace(/[sS]/g, '')
    if (!/^\d{9}$/.test(numericCode)) {
      toast.warning(t('staff.messages.invalidNumber'))
      setSubmitting(false)
      return
    }

    try {
      const url = '/api/staff'
      const method = editingStaff ? 'PUT' : 'POST'

      // نحول الرقم من 9 خانات إلى s + رقم بسيط
      // مثال: 100000022 -> s022
      const staffNumber = parseInt(numericCode, 10) - 100000000
      const staffCodeWithS = `s${staffNumber.toString().padStart(3, '0')}`

      const { salary: _salary, weeklyOffDays, shiftIsVariable, dailyShiftTimes, ...formDataRest } = formData
      const safeFormDataBase = isAdmin ? { ...formDataRest, salary: formData.salary } : formDataRest
      const body = editingStaff
        ? { id: editingStaff.id, ...safeFormDataBase, position: finalPosition, staffCode: staffCodeWithS }
        : { ...safeFormDataBase, position: finalPosition, staffCode: staffCodeWithS }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (response.ok) {
        // Auto-create/replace Rotation records based on weekly off days + per-day times (if variable)
        const savedStaffId = editingStaff ? editingStaff.id : data?.id
        if (savedStaffId && isAdmin) {
          try {
            await syncRotationsToCalendar(savedStaffId, weeklyOffDays, shiftIsVariable, formData.shiftStartTime, formData.shiftEndTime, dailyShiftTimes)
          } catch (err) {
            console.error('Failed to sync rotations:', err)
          }
        }
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

  const getPositionColor = (position: string): string => {
    const colors: { [key: string]: string } = {
      مدرب: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
      ريسبشن: 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300',
      بار: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
      HK: 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300',
      مدير: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
      محاسب: 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300',
      صيانة: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
      أمن: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
      sales: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
      'أخصائي تغذية': 'bg-lime-100 dark:bg-lime-900/40 text-lime-700 dark:text-lime-300',
      'أخصائي علاج طبيعي': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    }
    return colors[position] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
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
  const presentStaff = todayAttendance.filter((att) => att.checkOut === null).length // الموجودين الآن (لم ينصرفوا)
  const totalCheckedIn = todayAttendance.length // إجمالي من سجلوا حضور اليوم

  // التحقق من الصلاحيات
  if (permissionsLoading) {
    return (
      <LoadingScreen fullScreen message={t('staff.loading')} />
    )
  }

  if (!hasPermission('canViewStaff')) {
    return <PermissionDenied message="ليس لديك صلاحية عرض الموظفين" />
  }

  return (
    <div className="container mx-auto px-4 py-6 md:px-6" dir={direction}>
      {/* Scanner Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
              <svg {...stroke} className="w-6 h-6" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5ZM13.5 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5Z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('staff.scanner.title')}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('staff.scanner.subtitle')}</p>
            </div>
          </div>
          {lastScanTime && (
            <div className="bg-gray-50 dark:bg-gray-900/40 ring-1 ring-gray-200 dark:ring-gray-700 px-4 py-2 rounded-lg">
              <p className="text-xs text-gray-600 dark:text-gray-400">{t('staff.scanner.lastScan')}</p>
              <p className="text-base font-bold text-gray-900 dark:text-gray-100">{lastScanTime.toLocaleTimeString('ar-EG')}</p>
            </div>
          )}
        </div>

        <div>
          <input
            ref={scannerRef}
            type="text"
            value={scannerInput}
            onChange={(e) => setScannerInput(e.target.value)}
            onKeyPress={handleScannerInput}
            className="w-full px-4 py-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-2xl sm:text-3xl font-bold text-center"
            placeholder={t('staff.scanner.placeholder')}
            autoFocus
            aria-label={t('staff.scanner.placeholder')}
          />
          <p className="text-center text-gray-600 dark:text-gray-400 mt-2 text-xs">
            {t('staff.scanner.hint')}
          </p>
        </div>

        {scanMessage && (
          <div
            className={`mt-4 p-4 rounded-lg text-center font-bold text-base flex items-center justify-center gap-2 ring-1 ${
              scanMessage.includes('')
                ? 'bg-red-50 dark:bg-red-900/20 ring-red-200 dark:ring-red-900/50 text-red-700 dark:text-red-300'
                : 'bg-green-50 dark:bg-green-900/20 ring-green-200 dark:ring-green-900/50 text-green-700 dark:text-green-300'
            }`}
            role="status"
            aria-live="polite"
          >
            <svg {...stroke} className="w-5 h-5 flex-shrink-0" aria-hidden="true">
              {scanMessage.includes('') ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              )}
            </svg>
            <span>{scanMessage.replace(/[]/g, '').trim()}</span>
          </div>
        )}
      </div>

      {/* Today's attendance */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5 mb-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
            <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <svg {...stroke} className="w-5 h-5 text-primary-600 dark:text-primary-400" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
              <span>{t('staff.attendance.title')}</span>
            </h3>
            <Link
              href="/attendance-report"
              className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2 rounded-lg font-bold transition-colors duration-200 text-sm"
            >
              <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
              </svg>
              <span>{t('nav.staffAttendance')}</span>
            </Link>
          </div>
          <div className="flex gap-3 w-full lg:w-auto">
            <div className="flex-1 lg:flex-none bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-900/50 px-4 py-2 rounded-lg text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-green-700 dark:text-green-400">{t('staff.attendance.presentNow')}</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{presentStaff}</p>
            </div>
            <div className="flex-1 lg:flex-none bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-900/50 px-4 py-2 rounded-lg text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-primary-700 dark:text-primary-400">{t('staff.attendance.totalPresent')}</p>
              <p className="text-2xl font-bold text-primary-700 dark:text-primary-300">{totalCheckedIn}</p>
            </div>
          </div>
        </div>

        {todayAttendance.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40 text-gray-700 dark:text-gray-300 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-start font-bold">{t('staff.attendance.number')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('staff.attendance.name')}</th>
                  <th className="hidden md:table-cell px-4 py-3 text-start font-bold">{t('staff.attendance.position')}</th>
                  <th className="px-4 py-3 text-center font-bold">وقت الدخول</th>
                  <th className="px-4 py-3 text-center font-bold">وقت الخروج</th>
                  <th className="px-4 py-3 text-center font-bold">ساعات العمل</th>
                  <th className="hidden sm:table-cell px-4 py-3 text-center font-bold">{t('staff.attendance.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                {todayAttendance.map((att) => {
                  const checkInTime = new Date(att.checkIn)
                  const checkOutTime = att.checkOut ? new Date(att.checkOut) : null
                  const currentTime = new Date()

                  let actualMinutes = att.duration || 0
                  if (!att.checkOut) {
                    actualMinutes = Math.floor((currentTime.getTime() - checkInTime.getTime()) / (1000 * 60))
                  }

                  const hours = Math.floor(actualMinutes / 60)
                  const minutes = actualMinutes % 60

                  return (
                    <tr key={att.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                          #{toNineDigitCode(att.staff.staffCode)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100">{att.staff.name}</td>
                      <td className="hidden md:table-cell px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getPositionColor(att.staff.position || '')}`}>
                          {getPositionLabel(att.staff.position)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-block bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-200 dark:ring-primary-900/50 px-3 py-1.5 rounded-lg">
                          <div className="text-sm font-bold text-primary-700 dark:text-primary-300">
                            {checkInTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </div>
                          <div className="text-[10px] text-primary-600 dark:text-primary-400">
                            {checkInTime.toLocaleDateString('ar-EG', { weekday: 'short' })}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {checkOutTime ? (
                          <div className="inline-block bg-orange-50 dark:bg-orange-900/30 ring-1 ring-orange-200 dark:ring-orange-900/50 px-3 py-1.5 rounded-lg">
                            <div className="text-sm font-bold text-orange-700 dark:text-orange-300">
                              {checkOutTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </div>
                            <div className="text-[10px] text-orange-600 dark:text-orange-400">
                              {checkOutTime.toLocaleDateString('ar-EG', { weekday: 'short' })}
                            </div>
                          </div>
                        ) : (
                          <div className="inline-block bg-amber-50 dark:bg-amber-900/30 ring-1 ring-amber-200 dark:ring-amber-900/50 px-3 py-1.5 rounded-lg">
                            <div className="text-xs font-bold text-amber-700 dark:text-amber-300">لم ينصرف بعد</div>
                            <div className="text-[10px] text-amber-600 dark:text-amber-400">جاري العمل</div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {hours === 0 && minutes === 0 ? (
                          <span className="text-sm text-gray-600 dark:text-gray-400">بدأ للتو</span>
                        ) : (
                          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                            {hours > 0 && `${hours} س`}{hours > 0 && minutes > 0 ? ' ' : ''}{minutes > 0 && `${minutes} د`}
                          </span>
                        )}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-center">
                        {att.checkOut === null ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            {t('staff.attendance.inside')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            <span className="w-2 h-2 rounded-full bg-gray-400" />
                            {t('staff.attendance.outside')}
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
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg {...stroke} className="w-12 h-12 text-gray-400" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">{t('staff.attendance.noAttendance')}</h3>
          </div>
        )}
      </div>

      {/* Staff management header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
            <svg {...stroke} className="w-6 h-6" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">{t('staff.title')}</h1>
        </div>
        <div className="flex gap-2 w-full sm:w-auto flex-wrap">
          {hasPermission('canViewDeductions') && (
            <Link
              href="/staff-deductions"
              className="inline-flex items-center gap-2 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/50 px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 text-sm"
            >
              <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6 9 12.75l4.286-4.286a11.948 11.948 0 0 1 4.306 6.43l.776 2.898m0 0 3.182-5.511m-3.182 5.51-5.511-3.181" />
              </svg>
              <span>{t('nav.staffDeductions')}</span>
            </Link>
          )}
          {hasPermission('canViewBonuses') && (
            <Link
              href="/staff-bonuses"
              className="inline-flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-900/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 text-sm"
            >
              <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
              </svg>
              <span>{t('nav.staffBonuses')}</span>
            </Link>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowPayrollSettings(true)}
              className="inline-flex items-center gap-2 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-900/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 text-sm"
            >
              <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              <span>{locale === 'ar' ? 'إعدادات الرواتب' : 'Payroll Settings'}</span>
            </button>
          )}
          {isAdmin && (
            <Link
              href="/staff/schedule"
              className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-900/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 text-sm"
            >
              <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
              <span>{locale === 'ar' ? 'الجدول والإجازات' : 'Schedule & Leaves'}</span>
            </Link>
          )}
          <Link
            href="/staff-hr-assistant"
            className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 text-sm"
          >
            <svg {...stroke} className="w-4 h-4" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
            </svg>
            <span>{t('staff.hrAssistant.title')}</span>
          </Link>
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 text-sm"
          >
            <svg {...stroke} className="w-4 h-4" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>{t('staff.addNewStaff')}</span>
          </button>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[10000] flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="staff-form-title" onClick={(e) => { if (e.target === e.currentTarget) resetForm() }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in max-w-3xl w-full p-6 my-4 sm:my-8 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] overflow-y-auto" dir={direction} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 id="staff-form-title" className="text-xl font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <svg {...stroke} className="w-5 h-5 text-primary-600 dark:text-primary-400" aria-hidden="true">
                  {editingStaff ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487 18.549 2.799a2.122 2.122 0 1 1 3 3L19.862 7.487m-3-3L8.078 13.27a2 2 0 0 0-.5.831l-1.111 4.222 4.222-1.111a2 2 0 0 0 .832-.5l8.781-8.781m-3-3 3 3" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  )}
                </svg>
                <span>{editingStaff ? t('staff.editStaff') : t('staff.addStaff')}</span>
              </h2>
              <button
                onClick={resetForm}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                aria-label={t('staff.form.cancel')}
              >
                <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* رقم الموظف */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">
                  {t('staff.form.staffNumberRequired')}
                </label>
                <input
                  type="text"
                  required
                  value={formData.staffCode}
                  onChange={(e) => setFormData({ ...formData, staffCode: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-xl font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                  placeholder={randomStaffCode || "100000022"}
                  minLength={9}
                  maxLength={9}
                  pattern="\d{9}"
                  disabled={!!editingStaff && !isAdmin}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {editingStaff
                    ? isAdmin
                      ? (direction === 'rtl' ? ' تقدر تغيّر الرقم — مسموح للأدمن والأونر فقط' : ' You can change the number — admin/owner only')
                      : t('staff.form.staffNumberLocked')
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
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
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
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
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
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  placeholder={t('staff.form.salaryPlaceholder')}
                />
              </div>
              )}

              {/*  التارجت الشهري للكوتش — يظهر بس لو الـ position فيها "مدرب" + الميزة مفعّلة + الطريقة revenue */}
              {showCoachTargetSection && (formData.position?.split(',') || []).map(p => p.trim()).includes('مدرب') && (
                <div>
                  <label className="block text-sm font-bold mb-2 text-purple-700 dark:text-purple-300 inline-flex items-center gap-1.5">
                    🎯 التارجت الشهري للكوتش (ج.م)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formData.coachTarget}
                    onChange={(e) =>
                      setFormData({ ...formData, coachTarget: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-lg border-2 border-purple-200 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-900/10 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors duration-200 font-bold"
                    placeholder="مثلاً: 15000"
                  />
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                    💡 إجمالي الإيراد المطلوب شهرياً من الـ subscriptions اللي بيعها المدرب
                  </p>
                </div>
              )}
            </div>

              {/* Positions - multi-select */}
              <div>
                <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-300">
                  {t('staff.form.positionRequired')} (يمكن اختيار أكثر من وظيفة)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 bg-gray-50 dark:bg-gray-900/40">
                  {POSITIONS.map((pos) => {
                    const selectedPositions = formData.position ? formData.position.split(',') : []
                    const isSelected = selectedPositions.includes(pos.value)

                    return (
                      <label
                        key={pos.value}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors duration-200 text-sm ring-1 ${
                          isSelected
                            ? 'bg-primary-100 dark:bg-primary-900/40 ring-primary-300 dark:ring-primary-700'
                            : 'bg-white dark:bg-gray-700 ring-gray-200 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/80'
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
                          className="w-4 h-4 rounded accent-primary-500"
                        />
                        <span className={`font-medium ${isSelected ? 'text-primary-900 dark:text-primary-100' : 'text-gray-700 dark:text-gray-200'}`}>
                          {pos.label}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Custom position */}
              {showOtherPosition && (
                <div className="bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-900/50 rounded-lg p-4">
                  <label className="block text-sm font-bold mb-1.5 text-gray-700 dark:text-gray-300">
                    {t('staff.form.customPositionRequired')}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.customPosition}
                    onChange={(e) =>
                      setFormData({ ...formData, customPosition: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                    placeholder={t('staff.form.customPositionPlaceholder')}
                  />
                </div>
              )}

            {/* ساعات العمل */}
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">{t('staff.form.workingHours')}</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={formData.workingHours}
                onChange={(e) => setFormData({ ...formData, workingHours: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                placeholder={t('staff.form.workingHoursPlaceholder')}
              />
            </div>

            {/* أيام الراحة الأسبوعية */}
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">
                {locale === 'ar' ? 'أيام الراحة الأسبوعية' : 'Weekly Off Days'}
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {[
                  { key: 'Sunday', ar: 'الأحد', en: 'Sun' },
                  { key: 'Monday', ar: 'الإثنين', en: 'Mon' },
                  { key: 'Tuesday', ar: 'الثلاثاء', en: 'Tue' },
                  { key: 'Wednesday', ar: 'الأربعاء', en: 'Wed' },
                  { key: 'Thursday', ar: 'الخميس', en: 'Thu' },
                  { key: 'Friday', ar: 'الجمعة', en: 'Fri' },
                  { key: 'Saturday', ar: 'السبت', en: 'Sat' },
                ].map(day => {
                  const isOff = formData.weeklyOffDays.includes(day.key)
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          weeklyOffDays: isOff
                            ? formData.weeklyOffDays.filter(d => d !== day.key)
                            : [...formData.weeklyOffDays, day.key],
                        })
                      }}
                      className={`min-h-[44px] px-2 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
                        isOff
                          ? 'bg-primary-500 text-primary-contrast ring-2 ring-primary-500'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {locale === 'ar' ? day.ar : day.en}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                {locale === 'ar'
                  ? 'اختر الأيام اللي الموظف بياخدها راحة كل أسبوع'
                  : 'Select the days this staff member takes off each week'}
              </p>
            </div>

            {/* الشيفت + خيار متغير */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-200">
                  {locale === 'ar' ? 'وقت الشيفت' : 'Shift Time'}
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.shiftIsVariable}
                    onChange={(e) => setFormData({ ...formData, shiftIsVariable: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                    {locale === 'ar' ? 'متغير' : 'Variable'}
                  </span>
                </label>
              </div>
              {!formData.shiftIsVariable ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-1 text-gray-600 dark:text-gray-400">{t('staff.form.shiftStartTime')}</label>
                    <input
                      type="time"
                      value={formData.shiftStartTime}
                      onChange={(e) => setFormData({ ...formData, shiftStartTime: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1 text-gray-600 dark:text-gray-400">{t('staff.form.shiftEndTime')}</label>
                    <input
                      type="time"
                      value={formData.shiftEndTime}
                      onChange={(e) => setFormData({ ...formData, shiftEndTime: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-900/40 space-y-3">
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    {locale === 'ar'
                      ? 'الشيفت متغير — حدّد وقت لكل يوم عمل في الأسبوع. الأيام الفاضية بتـ default على 09:00 → 17:00.'
                      : 'Variable shift — set a time per working weekday. Empty days default to 09:00 → 17:00.'}
                  </p>
                  <div>
                    <label className="block text-xs font-bold mb-1 text-amber-800 dark:text-amber-200">
                      {locale === 'ar' ? 'عدد الساعات في الشيفت' : 'Hours per shift'}
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      value={formData.workingHours}
                      onChange={(e) => setFormData({ ...formData, workingHours: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-colors duration-200"
                      placeholder="8"
                    />
                  </div>

                  {/* Per-day time inputs (only for non-off days) */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-200">
                      {locale === 'ar' ? 'الأوقات لكل يوم' : 'Times per day'}
                    </p>
                    {[
                      { key: 'Sunday', ar: 'الأحد', en: 'Sunday' },
                      { key: 'Monday', ar: 'الإثنين', en: 'Monday' },
                      { key: 'Tuesday', ar: 'الثلاثاء', en: 'Tuesday' },
                      { key: 'Wednesday', ar: 'الأربعاء', en: 'Wednesday' },
                      { key: 'Thursday', ar: 'الخميس', en: 'Thursday' },
                      { key: 'Friday', ar: 'الجمعة', en: 'Friday' },
                      { key: 'Saturday', ar: 'السبت', en: 'Saturday' },
                    ].map(day => {
                      const isOff = formData.weeklyOffDays.includes(day.key)
                      const current = formData.dailyShiftTimes[day.key] || { start: '', end: '' }
                      if (isOff) {
                        return (
                          <div key={day.key} className="flex items-center gap-2 opacity-50">
                            <span className="text-xs font-bold w-20 text-gray-600 dark:text-gray-400">{locale === 'ar' ? day.ar : day.en}</span>
                            <span className="text-xs text-gray-500 italic">{locale === 'ar' ? 'يوم راحة' : 'Off day'}</span>
                          </div>
                        )
                      }
                      return (
                        <div key={day.key} className="flex items-center gap-2">
                          <span className="text-xs font-bold w-20 text-amber-800 dark:text-amber-200">{locale === 'ar' ? day.ar : day.en}</span>
                          <input
                            type="time"
                            value={current.start}
                            onChange={(e) => setFormData({
                              ...formData,
                              dailyShiftTimes: { ...formData.dailyShiftTimes, [day.key]: { start: e.target.value, end: current.end } }
                            })}
                            className="flex-1 px-2 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                          <span className="text-gray-500 text-xs">→</span>
                          <input
                            type="time"
                            value={current.end}
                            onChange={(e) => setFormData({
                              ...formData,
                              dailyShiftTimes: { ...formData.dailyShiftTimes, [day.key]: { start: current.start, end: e.target.value } }
                            })}
                            className="flex-1 px-2 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Explicit "Update schedule in calendar" button — visible when editing an existing staff */}
              {editingStaff && (
                <button
                  type="button"
                  onClick={handleSyncSchedule}
                  disabled={syncingSchedule}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold px-4 py-2.5 rounded-lg disabled:opacity-60 transition-colors"
                >
                  <svg {...stroke} className={`w-4 h-4 ${syncingSchedule ? 'animate-spin' : ''}`} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>{syncingSchedule ? (locale === 'ar' ? 'جاري التحديث…' : 'Updating…') : (locale === 'ar' ? 'تحديث جدول العمل في الكاليندر' : 'Update Work Schedule in Calendar')}</span>
                </button>
              )}
            </div>

            {/* ملاحظات */}
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-700 dark:text-gray-200">{t('staff.form.notes')}</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-3 ring-1 ring-gray-300 dark:ring-gray-600 rounded-lg focus:border-primary-500 dark:focus:border-primary-400 focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900/50 transition resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows={3}
                placeholder={t('staff.form.notesPlaceholder')}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
              >
                {submitting ? (
                  <svg {...stroke} className="w-4 h-4 animate-spin" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
                <span>{submitting ? t('staff.form.saving') : editingStaff ? t('staff.form.update') : t('staff.form.addStaff')}</span>
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 py-2.5 rounded-lg font-bold transition-colors duration-200 text-sm"
              >
                {t('staff.form.cancel')}
              </button>
            </div>
          </form>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
        {[
          {
            label: t('staff.stats.totalStaff'),
            value: staff.length,
            tone: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400',
            icon: (<path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />)
          },
          {
            label: t('staff.stats.activeStaff'),
            value: staff.filter((s) => s.isActive).length,
            tone: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
            icon: (<path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />)
          },
          ...(isAdmin ? [{
            label: t('staff.stats.totalSalaries'),
            value: `${staff.filter(s => s.isActive).reduce((sum, s) => sum + (s.salary || 0), 0).toFixed(0)} ج.م`,
            tone: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
            icon: (<path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4M9 9V6m6 12v-3" />)
          }] : []),
          {
            label: t('staff.stats.coaches'),
            value: staffByPosition['مدرب'] || 0,
            tone: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
            icon: (<path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3 2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75 2.25-1.313M12 21.75V19.5m0 2.25-2.25-1.313m0-16.875L12 2.25l2.25 1.313" />)
          }
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4">
            <div className={`w-10 h-10 rounded-lg ${stat.tone} flex items-center justify-center mb-2`}>
              <svg {...stroke} className="w-5 h-5" aria-hidden="true">{stat.icon}</svg>
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{stat.label}</div>
            <div className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</div>
          </div>
        ))}

        <Link
          href="/expenses"
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 hover:ring-red-300 dark:hover:ring-red-700 transition-colors duration-200 group"
        >
          <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 flex items-center justify-center mb-2">
            <svg {...stroke} className="w-5 h-5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{t('staff.loans.title')}</div>
          <div className="mt-1 text-sm font-bold text-gray-900 dark:text-gray-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">{t('staff.loans.viewInExpenses')}</div>
        </Link>
      </div>

      {/* Staff cards */}
      {loading ? (
        <LoadingScreen message={t('staff.loading')} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" dir={direction}>
            {staff.map((staffMember) => (
              <div
                key={staffMember.id}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 overflow-hidden transition-colors duration-200 ${
                  !staffMember.isActive ? 'opacity-60 ring-gray-200 dark:ring-gray-700' : isStaffCurrentlyInside(staffMember.id) ? 'ring-green-300 dark:ring-green-800' : 'ring-gray-200 dark:ring-gray-700'
                }`}
              >
                {/* Header */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                        <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 dark:text-gray-100 text-base">{staffMember.name}</div>
                        <div className="text-gray-600 dark:text-gray-400 text-xs">
                          #{toNineDigitCode(staffMember.staffCode)} {staffMember.phone ? `• ${staffMember.phone}` : ''}
                        </div>
                        {staffMember.createdAt && (
                          <div className="text-gray-500 dark:text-gray-500 text-[11px] mt-0.5 inline-flex items-center gap-1">
                            <svg {...stroke} className="w-3 h-3 flex-shrink-0" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                            {locale === 'ar' ? 'أُنشئ الحساب' : 'Account created'}: {new Date(staffMember.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isStaffCurrentlyInside(staffMember.id) && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          {t('staff.attendance.inside')}
                        </span>
                      )}
                      <button
                        onClick={() => toggleActive(staffMember)}
                        aria-label={staffMember.isActive ? t('staff.table.active') : t('staff.table.inactive')}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold transition-colors duration-200 ${
                          staffMember.isActive
                            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                            : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
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
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getPositionColor(pos)}`}
                      >
                        {getPositionLabel(pos)}
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

                  {/* Notes */}
                  {staffMember.notes && staffMember.notes.trim() && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-900/50 rounded-lg p-2">
                      <div className="text-[10px] text-amber-700 dark:text-amber-300 font-bold mb-0.5 uppercase tracking-wider">
                        {t('staff.form.notes')}
                      </div>
                      <div className="text-xs text-amber-900 dark:text-amber-100 whitespace-pre-wrap break-words">
                        {staffMember.notes}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => handleEdit(staffMember)}
                      className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast py-2 rounded-lg text-sm font-bold transition-colors duration-200"
                    >
                      <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487 18.549 2.799a2.122 2.122 0 1 1 3 3L19.862 7.487m-3-3L8.078 13.27a2 2 0 0 0-.5.831l-1.111 4.222 4.222-1.111a2 2 0 0 0 .832-.5l8.781-8.781m-3-3 3 3" />
                      </svg>
                      <span>{t('staff.table.edit')}</span>
                    </button>
                    {hasPermission('canDeleteStaff') ? (
                      <button
                        onClick={() => handleDelete(staffMember)}
                        className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-bold transition-colors duration-200"
                      >
                        <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165" />
                        </svg>
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
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 flex flex-col items-center justify-center py-12 text-center">
              <svg {...stroke} className="w-12 h-12 text-gray-400" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
              <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">{t('staff.empty.title')}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('staff.empty.subtitle')}</p>
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

      {/*  مودال السيلفي وقت السكان (auto-capture) — يظهر بس لو requireSelfieOnCheckIn مفعّل */}
      <CameraModal
        isOpen={showSelfieCamera}
        autoCapture
        autoCaptureSeconds={2}
        title={locale === 'ar' ? `📸 ${pendingStaffName || 'سيلفي السكان'}` : `📸 ${pendingStaffName || 'Check-in selfie'}`}
        onClose={() => {
          //  لو قفل بدون تصوير، السجل اتعمل بدون selfieImage (مش هيخسر السكان)
          setShowSelfieCamera(false)
          setPendingAttendanceId(null)
          setPendingStaffName('')
        }}
        onCapture={handleSelfieCapture}
      />

      {/* إعدادات الرواتب — منقولة من صفحة الإعدادات */}
      {showPayrollSettings && (
        <PayrollSettingsModal onClose={() => setShowPayrollSettings(false)} />
      )}
    </div>
  )
}
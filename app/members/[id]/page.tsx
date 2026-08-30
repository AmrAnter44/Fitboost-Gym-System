// app/members/[id]/page.tsx - إصلاح الأرقام العشرية
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { ReceiptToPrint } from '../../../components/ReceiptToPrint'
import PaymentMethodSelector from '../../../components/Paymentmethodselector'
import Link from 'next/link'
import RenewalForm from '../../../components/RenewalForm'
import UpgradeForm from '../../../components/UpgradeForm'
import TransferMembershipForm from '../../../components/TransferMembershipForm'
import QuickMemberFollowUpModal from '../../../components/QuickMemberFollowUpModal'
import ImageUpload from '../../../components/ImageUpload'
import { LoadingScreen } from '../../../components/Spinner'
import { formatDateYMD, calculateRemainingDays } from '../../../lib/dateFormatter'
import { prepareReceiptMessage } from '../../../lib/whatsappReceiptMessage'
import { usePermissions } from '../../../hooks/usePermissions'
import PermissionDenied from '../../../components/PermissionDenied'
import type { PaymentMethod } from '../../../lib/paymentHelpers'
import { useLanguage } from '../../../contexts/LanguageContext'
import { useToast } from '../../../contexts/ToastContext'
import { useServiceSettings } from '../../../contexts/ServiceSettingsContext'
import FreeSessionModal from '../../../components/FreeSessionModal'
import CoachSelector from '../../../components/CoachSelector'
import SalesStaffSelector from '../../../components/SalesStaffSelector'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

//  📜 أيقونات سجل الرحلة (SVG بستايل السيستم بدل الإيموجي) — لون + مسار لكل نوع حدث
function timelineVisual(ev: { type: string; date: string }): { d: string; color: string } {
 const passed = new Date(ev.date).getTime() < Date.now()
 switch (ev.type) {
 case 'visitor': // زائر (users)
 return { d: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', color: 'text-purple-500' }
 case 'member': // اتحوّل لعضو (check-circle)
 return { d: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-green-500' }
 case 'start': // بداية الاشتراك (arrow-right-circle)
 return { d: 'M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-primary-500' }
 case 'expiry': // نهاية الاشتراك — منتهي (تحذير أحمر) / قادم (ساعة كهرمانية)
 return passed
 ? { d: 'M12 9v2m0 4h.01M5.062 19h13.876c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', color: 'text-red-500' }
 : { d: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-amber-500' }
 case 'transfer_in': // استلم عضوية منقولة (download)
 return { d: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4', color: 'text-cyan-500' }
 case 'transfer_out': // نقل عضويته (upload)
 return { d: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12', color: 'text-orange-500' }
 case 'transfer_identity': // تغيّرت الملكية (refresh)
 return { d: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', color: 'text-indigo-500' }
 case 'dayuse': // يوم استخدام (ticket)
 return { d: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 010 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 010-4V7a2 2 0 00-2-2H5z', color: 'text-teal-500' }
 case 'freeze': // تجميد (snowflake)
 return { d: 'M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9', color: 'text-sky-500' }
 case 'receipt': // إيصال (banknote)
 return { d: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z', color: 'text-emerald-500' }
 default:
 return { d: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-gray-400' }
 }
}

interface Member {
 id: string
 memberNumber: string | null
 name: string
 phone: string
 backupPhone?: string
 email?: string
 nationalId?: string
 birthDate?: string
 source?: string
 inBodyScans: number
 invitations: number
 freePTSessions: number
 freeNutritionSessions: number
 freePhysioSessions: number
 freeGroupClassSessions: number
 freePoolSessions: number
 freePadelSessions: number
 freeAssessmentSessions: number
 freeMoreSessions: number
 freePTSessionsUsed?: number
 transferredFrom?: { id: string; name: string; memberNumber: string | null; profileImage: string | null } | null
 transferredFromAt?: string | null
 remainingFreezeDays: number
 subscriptionPrice: number
 remainingAmount: number
 points?: number
 notes?: string
 isActive: boolean
 isFrozen: boolean
 isBanned: boolean
 freezeRequests?: { startDate: string; endDate: string }[]
 profileImage?: string
 idCardFront?: string
 idCardBack?: string
 startDate?: string
 expiryDate?: string
 createdAt: string
 coachId?: string
 coach?: {
 id: string
 name: string
 staffCode: string
 }
 salesStaffId?: string
 salesStaff?: {
 id: string
 name: string
 staffCode: string
 }
}

interface Receipt {
 receiptNumber: number
 amount: number
 paymentMethod: string
 createdAt: string
 itemDetails: {
 memberNumber?: string
 memberName?: string
 subscriptionPrice?: number
 paidAmount?: number
 remainingAmount?: number
 freePTSessions?: number
 inBodyScans?: number
 invitations?: number
 startDate?: string
 expiryDate?: string
 subscriptionDays?: number
 [key: string]: any
 }
}

// دالة حساب اسم الباقة بناءً على عدد أيام الاشتراك
const getPackageName = (startDate: string | undefined, expiryDate: string | undefined, locale: string = 'ar'): string => {
 if (!startDate || !expiryDate) return '-'

 const start = new Date(startDate)
 const expiry = new Date(expiryDate)
 const diffTime = expiry.getTime() - start.getTime()
 const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

 if (diffDays <= 0) return '-'

 // حساب عدد الشهور
 const months = Math.round(diffDays / 30)

 if (locale === 'ar') {
 if (diffDays >= 330 && diffDays <= 395) {
 return 'سنة'
 } else if (diffDays >= 165 && diffDays <= 195) {
 return '6 شهور'
 } else if (diffDays >= 85 && diffDays <= 95) {
 return '3 شهور'
 } else if (diffDays >= 55 && diffDays <= 65) {
 return 'شهرين'
 } else if (diffDays >= 25 && diffDays <= 35) {
 return 'شهر'
 } else if (diffDays >= 10 && diffDays <= 17) {
 return 'أسبوعين'
 } else if (diffDays >= 5 && diffDays <= 9) {
 return 'أسبوع'
 } else if (diffDays === 1) {
 return 'يوم'
 } else if (months > 0) {
 return `${months} ${months === 1 ? 'شهر' : months === 2 ? 'شهرين' : 'شهور'}`
 } else {
 return `${diffDays} ${diffDays === 1 ? 'يوم' : diffDays === 2 ? 'يومين' : 'أيام'}`
 }
 } else {
 // English
 if (diffDays >= 330 && diffDays <= 395) {
 return 'Year'
 } else if (diffDays >= 165 && diffDays <= 195) {
 return '6 Months'
 } else if (diffDays >= 85 && diffDays <= 95) {
 return '3 Months'
 } else if (diffDays >= 55 && diffDays <= 65) {
 return '2 Months'
 } else if (diffDays >= 25 && diffDays <= 35) {
 return 'Month'
 } else if (diffDays >= 10 && diffDays <= 17) {
 return '2 Weeks'
 } else if (diffDays >= 5 && diffDays <= 9) {
 return 'Week'
 } else if (diffDays === 1) {
 return 'Day'
 } else if (months > 0) {
 return `${months} ${months === 1 ? 'Month' : 'Months'}`
 } else {
 return `${diffDays} ${diffDays === 1 ? 'Day' : 'Days'}`
 }
 }
}

export default function MemberDetailPage() {
 const params = useParams()
 const router = useRouter()
 const searchParams = useSearchParams()
 const memberId = params.id as string
 // رجوع للصفحة اللي جاي منها فعلاً (PT مفلتر، الحضور… إلخ) مع fallback لصفحة الأعضاء
 const goBack = () => {
 if (typeof window !== 'undefined' && window.history.length > 1) router.back()
 else router.push('/members')
 }
 const { hasPermission, user: currentUser, loading: permissionsLoading } = usePermissions()
 const canOverrideInvitationSales = currentUser?.role === 'OWNER' || currentUser?.role === 'ADMIN'
 const { t, direction, locale } = useLanguage()
 const toast = useToast()
 const { settings } = useServiceSettings()
 const queryClient = useQueryClient()

 const [member, setMember] = useState<Member | null>(null)
 const [loading, setLoading] = useState(true)
 // Auto-open renewal modal لو URL فيه ?action=renew
 const autoOpenRenewal = searchParams?.get('action') === 'renew'
 const [showReceipt, setShowReceipt] = useState(false)
 const [receiptData, setReceiptData] = useState<any>(null)
 const [showRenewalForm, setShowRenewalForm] = useState(false)
 //  متابعة سريعة على العضو
 const [showQuickFollowUp, setShowQuickFollowUp] = useState(false)
 const [followUpHistory, setFollowUpHistory] = useState<any[]>([])
 const [followUpHistoryLoading, setFollowUpHistoryLoading] = useState(false)
 //  مفتوحة افتراضياً عشان اليوزر يشوف سجل المتابعات على طول
 const [showUpgradeForm, setShowUpgradeForm] = useState(false)
 const [showTransferForm, setShowTransferForm] = useState(false)
 const [lastReceiptNumber, setLastReceiptNumber] = useState<number | null>(null)
 const [ptSubscription, setPtSubscription] = useState<any>(null)
 //  🥋 مودال تعديل تفاصيل الـ PT (الكوتش + الحصص + السعر + الانتهاء)
 const [showPTEdit, setShowPTEdit] = useState(false)
 const [ptEditForm, setPtEditForm] = useState({ coachName: '', sessionsPurchased: 0, sessionsRemaining: 0, remainingAmount: 0, expiryDate: '' })
 const [ptEditSaving, setPtEditSaving] = useState(false)
 const [ptCoaches, setPtCoaches] = useState<any[]>([]) //  قايمة كباتن الـ PT (كل الكباتن — زي صفحة الـ PT)
 const openPTEdit = () => {
   if (!ptSubscription) return
   //  نجيب كل كباتن الـ PT من نفس مصدر صفحة الـ PT (مش /api/coaches الضيقة)
   fetch('/api/coaches/with-stats').then(r => r.ok ? r.json() : []).then(d => setPtCoaches(Array.isArray(d) ? d : [])).catch(() => {})
   setPtEditForm({
     coachName: ptSubscription.coachName || '',
     sessionsPurchased: ptSubscription.sessionsPurchased || 0,
     sessionsRemaining: ptSubscription.sessionsRemaining || 0,
     remainingAmount: ptSubscription.remainingAmount || 0,
     expiryDate: ptSubscription.expiryDate ? formatDateYMD(ptSubscription.expiryDate) : '',
   })
   setShowPTEdit(true)
 }
 const savePTEdit = async () => {
   if (!ptSubscription?.ptNumber) return
   setPtEditSaving(true)
   try {
     const res = await fetch('/api/pt', {
       method: 'PUT', headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         ptNumber: ptSubscription.ptNumber,
         coachName: ptEditForm.coachName,
         sessionsPurchased: ptEditForm.sessionsPurchased,
         sessionsRemaining: ptEditForm.sessionsRemaining,
         remainingAmount: ptEditForm.remainingAmount,
         expiryDate: ptEditForm.expiryDate || undefined,
       }),
     })
     if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || 'فشل تعديل الـ PT'); return }
     toast.success(locale === 'ar' ? 'اتعدّل الـ PT' : 'PT updated')
     setShowPTEdit(false)
     fetchPTSubscription()
   } finally { setPtEditSaving(false) }
 }
 const [showIdCardModal, setShowIdCardModal] = useState(false)
 const [missingImageUpload, setMissingImageUpload] = useState<
 | { field: 'profileImage' | 'idCardFront' | 'idCardBack'; label: string }
 | null
 >(null)
 const [missingImageUploading, setMissingImageUploading] = useState(false)
 const [zoomedImage, setZoomedImage] = useState<string | null>(null) //  تكبير صورة العضو (لايتبوكس)
 const [nutritionSubscriptions, setNutritionSubscriptions] = useState<any[]>([])
 const [physioSubscriptions, setPhysioSubscriptions] = useState<any[]>([])
 const [groupClassSubscriptions, setGroupClassSubscriptions] = useState<any[]>([])

 // إجمالي الجلسات المدفوعة
 const [paidSessionCounts, setPaidSessionCounts] = useState({
 pt: 0,
 nutrition: 0,
 physio: 0,
 groupClass: 0
 })

 // سجل الإيصالات
 const [showReceiptsModal, setShowReceiptsModal] = useState(false)
 const [memberReceipts, setMemberReceipts] = useState<any[]>([])
 const [receiptsLoading, setReceiptsLoading] = useState(false)
 const [lastReceipt, setLastReceipt] = useState<any>(null)

 // سجل التجميد (الفريز)
 const [freezeHistory, setFreezeHistory] = useState<any[]>([])
 const [freezeHistoryLoading, setFreezeHistoryLoading] = useState(false)

 // سجل التجديدات
 const [renewalHistory, setRenewalHistory] = useState<any[]>([])
 const [renewalHistoryLoading, setRenewalHistoryLoading] = useState(false)

 // سجل الدعوات (مين دخل بالدعوة وكام مرة)
 const [invitationHistory, setInvitationHistory] = useState<any[]>([])
 const [invitationHistoryLoading, setInvitationHistoryLoading] = useState(false)

 // بوب أب السجلات (تبات: تجديدات / تجميد / متابعات / دعوات)
 const [showHistoryModal, setShowHistoryModal] = useState(false)
 const [historyTab, setHistoryTab] = useState<'renewals' | 'freeze' | 'followups' | 'invitations'>('renewals')

 // النقاط
 const [showPointsHistory, setShowPointsHistory] = useState(false)
 const [pointsHistory, setPointsHistory] = useState<any[]>([])
 const [pointsLoading, setPointsLoading] = useState(false)
 const [showAddPointsModal, setShowAddPointsModal] = useState(false)
 const [addPointsData, setAddPointsData] = useState({
 points: '',
 reason: ''
 })

 // التقييمات

 const [confirmModal, setConfirmModal] = useState<{
 show: boolean
 title: string
 message: string
 onConfirm: () => void
 } | null>(null)

 const [paymentData, setPaymentData] = useState<{
 amount: number
 paymentMethod: string | PaymentMethod[]
 notes: string
 }>({
 amount: 0,
 paymentMethod: 'cash',
 notes: ''
 })

 const [freezeData, setFreezeData] = useState({
 days: 0,
 reason: ''
 })
 //  🥋 تجميد الـ PT مع العضوية (لو العضو مشترك PT وخاصية فريز الـ PT مفعّلة)
 const [freezePTToo, setFreezePTToo] = useState(false)

 //  باك فريز — تجميد بأثر رجعي لفترة غياب الميمبر (من آخر حضور لغاية النهاردة)
 const [backFreezeData, setBackFreezeData] = useState<{ days: number; lastCheckIn: string | null; loading: boolean }>({
 days: 0,
 lastCheckIn: null,
 loading: false,
 })

 const [invitationData, setInvitationData] = useState({
 guestName: '',
 guestPhone: '',
 notes: '',
 salesStaffId: ''
 })
 const [invitationSalesStaff, setInvitationSalesStaff] = useState<{ id: string; name: string; leadsCount: number }[]>([])

 const [editBasicInfoData, setEditBasicInfoData] = useState({
 name: '',
 phone: '',
 memberNumber: '',
 profileImage: null as string | null,
 idCardFront: null as string | null,
 idCardBack: null as string | null,
 subscriptionPrice: 0,
 inBodyScans: 0,
 invitations: 0,
 freePTSessions: 0,
 freeNutritionSessions: 0,
 freePhysioSessions: 0,
 freeGroupClassSessions: 0,
 freePoolSessions: 0,
 freePadelSessions: 0,
 freeAssessmentSessions: 0,
 freeMoreSessions: 0,
 remainingFreezeDays: 0,
 remainingAmount: 0,
 remainingDueDate: '',
 coachId: null as string | null,
 salesStaffId: null as string | null,
 notes: '',
 startDate: '',
 expiryDate: '',
 gender: '' as string,
 allowedCheckInStart: '' as string,
 allowedCheckInEnd: '' as string
 })

 const [addRemainingAmountData, setAddRemainingAmountData] = useState({
 amount: 0,
 notes: ''
 })

 const [activeModal, setActiveModal] = useState<string | null>(null)

 // 📜 سجل رحلة العضو (Timeline)
 const [showTimeline, setShowTimeline] = useState(false)
 const [timelineEvents, setTimelineEvents] = useState<any[]>([])
 const [timelineLoading, setTimelineLoading] = useState(false)
 const openTimeline = async () => {
 setShowTimeline(true)
 if (timelineEvents.length > 0) return // متحمّل قبل كده
 setTimelineLoading(true)
 try {
 const res = await fetch(`/api/member-timeline?memberId=${memberId}`)
 const data = await res.json()
 setTimelineEvents(Array.isArray(data.events) ? data.events : [])
 } catch (e) {
 console.error('Error loading timeline:', e)
 toast.error(locale === 'ar' ? 'فشل تحميل سجل الرحلة' : 'Failed to load timeline')
 } finally {
 setTimelineLoading(false)
 }
 }

 // Free Session Modals
 const [freeSessionModal, setFreeSessionModal] = useState<{
 isOpen: boolean
 serviceType: 'PT' | 'Nutrition' | 'Physiotherapy' | 'GroupClass' | null
 }>({
 isOpen: false,
 serviceType: null
 })

 // Barcode WhatsApp Popup
 const [barcodePopup, setBarcodePopup] = useState<{
 show: boolean
 step: 'generating' | 'ready' | 'sending' | 'success' | 'error'
 image: string
 error: string
 }>({ show: false, step: 'generating', image: '', error: '' })

 // Fitness Test
 const [fitnessTestExists, setFitnessTestExists] = useState(false)
 const [fitnessTestData, setFitnessTestData] = useState<any>(null)
 const [coaches, setCoaches] = useState<any[]>([])
 const [selectedCoachId, setSelectedCoachId] = useState<string>('')

 const [fitnessTestForm, setFitnessTestForm] = useState({
 testDate: formatDateYMD(new Date()),
 medicalQuestions: {
 firstTimeGym: false,
 inDietPlan: false,
 hernia: false,
 familyHeartHistory: false,
 heartProblem: false,
 backPain: false,
 surgery: false,
 breathingProblems: false,
 bloodPressure: false,
 kneeProblem: false,
 diabetes: false,
 smoker: false,
 highCholesterol: false,
 } as any,
 flexibility: {
 shoulder: 'FAIR',
 hip: 'FAIR',
 elbow: 'FAIR',
 wrist: 'FAIR',
 spine: 'FAIR',
 scapula: 'FAIR',
 knee: 'FAIR',
 ankle: 'FAIR',
 } as any,
 exercises: {
 pushup: { sets: 0, reps: 0 },
 situp: { sets: 0, reps: 0 },
 pullup: { sets: 0, reps: 0 },
 squat: { sets: 0, reps: 0 },
 plank: { sets: 0, reps: 0 },
 legpress: { sets: 0, reps: 0 },
 chestpress: { sets: 0, reps: 0 },
 } as any,
 })

 // سجل الحضور
 const [attendanceHistory, setAttendanceHistory] = useState<any[]>([])
 const [attendanceLoading, setAttendanceLoading] = useState(false)
 const [attendanceStartDate, setAttendanceStartDate] = useState(() => {
 const date = new Date()
 date.setDate(date.getDate() - 30) // آخر 30 يوم
 return date.toISOString().split('T')[0]
 })
 const [attendanceEndDate, setAttendanceEndDate] = useState(() => {
 return new Date().toISOString().split('T')[0]
 })

 const fetchMember = async () => {
 try {
 const response = await fetch(`/api/members/${memberId}`)

 if (!response.ok) {
 toast.error(t('memberDetails.memberNotFound'))
 return
 }

 const foundMember = await response.json()

 if (foundMember) {
 // تحويل كل الأرقام لـ integers (مع إبقاء memberNumber كـ string عشان نحافظ على الأصفار في الأول لو موجودة في الـ DB)
 const memberWithDefaults = {
 ...foundMember,
 memberNumber: foundMember.memberNumber ?? null,
 freePTSessions: parseInt(foundMember.freePTSessions?.toString() || '0'),
 inBodyScans: parseInt(foundMember.inBodyScans?.toString() || '0'),
 invitations: parseInt(foundMember.invitations?.toString() || '0'),
 subscriptionPrice: parseInt(foundMember.subscriptionPrice?.toString() || '0'),
 remainingAmount: parseInt(foundMember.remainingAmount?.toString() || '0'),
 freePoolSessions: parseInt(foundMember.freePoolSessions?.toString() || '0'),
 freePadelSessions: parseInt(foundMember.freePadelSessions?.toString() || '0'),
 freeAssessmentSessions: parseInt(foundMember.freeAssessmentSessions?.toString() || '0')
 }

 setMember(memberWithDefaults)

 // جلب آخر إيصال للعضو
 fetchLastReceipt(memberId)
 //  جلب سجل المتابعات على طول عشان يظهر في القسم
 fetchFollowUpHistory()
 //  جلب سجل التجميد على طول عشان يظهر في القسم
 fetchFreezeHistory()
 //  جلب سجل التجديدات على طول عشان يظهر في القسم
 fetchRenewalHistory()
 //  جلب سجل الدعوات
 fetchInvitationHistory()
 } else {
 toast.error(t('memberDetails.memberNotFound'))
 }
 } catch (error) {
 console.error('Error:', error)
 toast.error(t('memberDetails.errorLoadingData'))
 } finally {
 setLoading(false)
 }
 }

 // رفع صورة ناقصة (شخصية أو بطاقة) — يعمل لأي مستخدم مسجل دخول طالما الحقل فاضي
 const uploadMissingImage = async (
 field: 'profileImage' | 'idCardFront' | 'idCardBack',
 imageUrl: string | null
 ) => {
 if (!imageUrl || !member?.id) return
 setMissingImageUploading(true)
 try {
 const response = await fetch(`/api/members/${member.id}/upload-image`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ field, imageUrl })
 })
 const data = await response.json()
 if (!response.ok) {
 toast.error(data?.error || (locale === 'ar' ? 'فشل رفع الصورة' : 'Failed to upload image'))
 return
 }
 toast.success(locale === 'ar' ? 'تم رفع الصورة بنجاح' : 'Image uploaded successfully')
 setMissingImageUpload(null)
 await fetchMember()
 } catch (error) {
 console.error('Error uploading missing image:', error)
 toast.error(locale === 'ar' ? 'فشل رفع الصورة' : 'Failed to upload image')
 } finally {
 setMissingImageUploading(false)
 }
 }

 const fetchAttendanceHistory = async () => {
 setAttendanceLoading(true)
 try {
 const response = await fetch(
 `/api/member-checkin/history?memberId=${memberId}&startDate=${attendanceStartDate}&endDate=${attendanceEndDate}`
 )
 const data = await response.json()

 if (data.success) {
 setAttendanceHistory(data.checkIns || [])
 } else {
 console.error('Error fetching attendance history')
 setAttendanceHistory([])
 }
 } catch (error) {
 console.error('Error fetching attendance history:', error)
 setAttendanceHistory([])
 } finally {
 setAttendanceLoading(false)
 }
 }

 const fetchLastReceipt = async (memberId: string) => {
 try {
 const response = await fetch(`/api/receipts?memberId=${memberId}`)
 if (response.ok) {
 const receipts = await response.json()
 if (receipts && receipts.length > 0) {
 // أول إيصال في القائمة هو الأحدث (orderBy createdAt desc)
 setLastReceiptNumber(receipts[0].receiptNumber)
 setLastReceipt(receipts[0])
 }
 }
 } catch (error) {
 console.error('Error fetching last receipt:', error)
 }
 }

 const fetchMemberReceipts = async (memberOverride?: any) => {
 setReceiptsLoading(true)
 try {
 const m = memberOverride || member
 if (!m) {
 setMemberReceipts([])
 setReceiptsLoading(false)
 return
 }

 // السيرفر بيرجّع إيصالات العضو ده بس (FK + الداتا القديمة) بدل كل الإيصالات
 const params = new URLSearchParams({ memberId: m.id })
 if (m.memberNumber) params.set('memberNumber', String(m.memberNumber))
 const response = await fetch(`/api/receipts?${params}`)
 const allReceipts = await response.json()

 // شامل: كل إيصال متعلق بالعضو ده — سواء memberId/memberNumber في الـ FK
 // أو في تفاصيل الـ itemDetails (للداتا القديمة)
 const filtered = allReceipts.filter((receipt: any) => {
 // الـ FK المباشر (إيصالات العضوية)
 if (receipt.memberId === m.id) return true

 //  إيصالات الـ PT ويوم الاستخدام — السيرفر رجّعها مربوطة بالعضو ده بالفعل (بالهاتف/الـ id)
 if (receipt.ptNumber !== null && receipt.ptNumber !== undefined) return true
 if (receipt.dayUseId) return true

 // قديم: البحث في itemDetails بـ memberNumber (تطابق دقيق)
 try {
 const itemDetails = typeof receipt.itemDetails === 'string'
 ? JSON.parse(receipt.itemDetails)
 : receipt.itemDetails
 if (itemDetails && m.memberNumber && itemDetails.memberNumber === m.memberNumber) {
 return true
 }
 } catch { /* ignore */ }

 return false
 })

 setMemberReceipts(filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
 } catch (error) {
 console.error('Error fetching member receipts:', error)
 setMemberReceipts([])
 } finally {
 setReceiptsLoading(false)
 }
 }

 const handleShowReceipts = () => {
 fetchMemberReceipts()
 setShowReceiptsModal(true)
 }

 const fetchFollowUpHistory = async () => {
 setFollowUpHistoryLoading(true)
 try {
 const response = await fetch(`/api/members/${memberId}/followup-history`)
 if (response.ok) {
 const data = await response.json()
 setFollowUpHistory(data)
 }
 } catch (error) {
 console.error('Error fetching follow-up history:', error)
 setFollowUpHistory([])
 } finally {
 setFollowUpHistoryLoading(false)
 }
 }

 const fetchPointsHistory = async () => {
 setPointsLoading(true)
 try {
 const response = await fetch(`/api/members/${memberId}/points-history`)
 if (response.ok) {
 const data = await response.json()
 setPointsHistory(data)
 }
 } catch (error) {
 console.error('Error fetching points history:', error)
 setPointsHistory([])
 } finally {
 setPointsLoading(false)
 }
 }

 const handleShowPointsHistory = () => {
 fetchPointsHistory()
 setShowPointsHistory(true)
 }

 const fetchFreezeHistory = async () => {
 setFreezeHistoryLoading(true)
 try {
 const response = await fetch(`/api/members/${memberId}/freeze-history`)
 if (response.ok) {
 const data = await response.json()
 setFreezeHistory(data)
 }
 } catch (error) {
 console.error('Error fetching freeze history:', error)
 setFreezeHistory([])
 } finally {
 setFreezeHistoryLoading(false)
 }
 }

 const fetchInvitationHistory = async () => {
 setInvitationHistoryLoading(true)
 try {
 const response = await fetch(`/api/invitations?memberId=${memberId}`)
 if (response.ok) {
 const data = await response.json()
 setInvitationHistory(Array.isArray(data) ? data : (data.invitations || []))
 }
 } catch (error) {
 console.error('Error fetching invitation history:', error)
 setInvitationHistory([])
 } finally {
 setInvitationHistoryLoading(false)
 }
 }

 const fetchRenewalHistory = async () => {
 setRenewalHistoryLoading(true)
 try {
 const response = await fetch(`/api/members/${memberId}/renewal-history`)
 if (response.ok) {
 const data = await response.json()
 setRenewalHistory(data)
 }
 } catch (error) {
 console.error('Error fetching renewal history:', error)
 setRenewalHistory([])
 } finally {
 setRenewalHistoryLoading(false)
 }
 }

 const handleAddPoints = async () => {
 if (!member || !addPointsData.points || !addPointsData.reason.trim()) {
 toast.warning(t('memberDetails.enterPointsAndReason'))
 return
 }

 const pointsValue = parseInt(addPointsData.points)
 if (isNaN(pointsValue) || pointsValue === 0) {
 toast.warning(t('memberDetails.enterValidPointsNumber'))
 return
 }

 setLoading(true)
 try {
 const response = await fetch(`/api/members/${member.id}/add-points`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 points: pointsValue,
 reason: addPointsData.reason.trim()
 })
 })

 const result = await response.json()

 if (response.ok) {
 toast.success(t('memberDetails.pointsUpdatedSuccessfully', {
 action: pointsValue > 0 ? t('memberDetails.added') : t('memberDetails.deducted'),
 count: Math.abs(pointsValue).toString()
 }))
 setAddPointsData({ points: '', reason: '' })
 setShowAddPointsModal(false)
 fetchMember()
 if (showPointsHistory) {
 fetchPointsHistory()
 }
 } else {
 toast.error(result.error || t('memberDetails.pointsUpdateFailed'))
 }
 } catch (error) {
 console.error('Error adding points:', error)
 toast.error(t('memberDetails.pointsUpdateError'))
 } finally {
 setLoading(false)
 }
 }


 const fetchFitnessTest = async () => {
 try {
 const response = await fetch(`/api/members/${memberId}/fitness-test`)
 if (response.ok) {
 const data = await response.json()
 setFitnessTestExists(true)
 setFitnessTestData(data)
 } else {
 setFitnessTestExists(false)
 setFitnessTestData(null)
 }
 } catch (error) {
 console.error('Error fetching fitness test:', error)
 setFitnessTestExists(false)
 setFitnessTestData(null)
 }
 }

 const fetchCoaches = async () => {
 try {
 const response = await fetch('/api/coaches')
 if (response.ok) {
 const coaches = await response.json()
 setCoaches(coaches)
 } else {
 console.error('Failed to fetch coaches:', response.status)
 setCoaches([])
 }
 } catch (error) {
 console.error('Error fetching coaches:', error)
 setCoaches([])
 }
 }

 const fetchPTSubscription = async () => {
 if (!member) return

 try {
 //  endpoint خفيف مستقل عن صلاحية canViewPT — بيرجّع اشتراك PT النشط للعضو مباشرة
 const response = await fetch(`/api/members/${memberId}/pt-status`)
 if (response.ok) {
 const activePT = await response.json()
 setPtSubscription(activePT || null)
 } else {
 setPtSubscription(null)
 }
 } catch (error) {
 console.error('Error fetching PT subscription:', error)
 setPtSubscription(null)
 }
 }

 const fetchServiceSubscriptions = async () => {
 if (!member) return

 try {
 // جلب عدد الجلسات المدفوعة مباشرة من الـ API الجديد (server-side filtering)
 const res = await fetch(`/api/members/paid-sessions?memberId=${member.id}`)
 if (res.ok) {
 const counts = await res.json()
 setPaidSessionCounts({
 pt: counts.pt || 0,
 nutrition: counts.nutrition || 0,
 physio: counts.physio || 0,
 groupClass: counts.groupClass || 0
 })
 }
 } catch (error) {
 console.error('Error fetching paid session counts:', error)
 }
 }

 useEffect(() => {
 fetchMember()
 fetchAttendanceHistory()
 // fetchFitnessTest() // Disabled - fitness test feature removed
 }, [memberId])

 useEffect(() => {
 if (member) {
 fetchPTSubscription()
 fetchServiceSubscriptions()
 // لو URL فيه ?action=renew، افتح modal التجديد تلقائياً (مرة واحدة بعد ما العضو يتحمّل)
 if (autoOpenRenewal && !showRenewalForm) {
 setShowRenewalForm(true)
 // نظّف الـ query string عشان ما يفتحش الـ modal تاني عند refresh
 try {
 const url = new URL(window.location.href)
 url.searchParams.delete('action')
 window.history.replaceState({}, '', url.toString())
 } catch { /* ignore */ }
 }
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [member])

 useEffect(() => {
 if (activeModal !== 'invitation') return
 fetch('/api/followups/sales')
 .then(r => r.ok ? r.json() : null)
 .then((data: any) => {
 if (!data?.staff) return
 const list = data.staff
 .filter((s: any) => s.position?.split(',').map((p: string) => p.trim()).includes('sales'))
 .map((s: any) => ({ id: s.staffId, name: s.name, leadsCount: s.leadsCount ?? 0 }))
 setInvitationSalesStaff(list)
 // الافتراضي = السيلز المرتبط بالعضو نفسه (لو موجود).
 // لو العضو مفيهوش سيلز، ساعتها بس نـfallback للأقل ليدز.
 if (list.length > 0) {
 const memberSalesId = (member as any)?.salesStaffId
 const memberSalesInList = memberSalesId ? list.find((s: any) => s.id === memberSalesId) : null
 if (memberSalesInList) {
 setInvitationData(prev => ({ ...prev, salesStaffId: memberSalesId }))
 } else {
 const least = [...list].sort((a: any, b: any) => a.leadsCount - b.leadsCount)[0]
 setInvitationData(prev => ({ ...prev, salesStaffId: least.id }))
 }
 }
 })
 .catch(() => {})
 }, [activeModal, member])

 const handlePayment = async () => {
 if (!member || paymentData.amount <= 0) {
 toast.warning(t('memberDetails.paymentModal.enterValidAmount'))
 return
 }

 if (paymentData.amount > member.remainingAmount) {
 toast.warning(t('memberDetails.paymentModal.amountExceedsRemaining'))
 return
 }

 setLoading(true)

 try {
 // تحويل لـ integer
 const cleanAmount = parseInt(paymentData.amount.toString())

 // endpoint موحّد: تحديث الباقي + إنشاء الإيصال في request واحد
 // (يسمح للموظفين بقبول الدفع بدون permissions canEditMembers/canEditReceipts)
 const response = await fetch('/api/members/pay-remaining', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 memberId: member.id,
 amount: cleanAmount,
 paymentMethod: paymentData.paymentMethod,
 notes: paymentData.notes,
 }),
 })

 const data = await response.json()

 if (response.ok && data.success) {
 if (data.receipt) {
 setReceiptData({
 receiptNumber: data.receipt.receiptNumber,
 type: 'Payment',
 amount: data.receipt.amount,
 details: JSON.parse(data.receipt.itemDetails),
 date: new Date(data.receipt.createdAt),
 paymentMethod: paymentData.paymentMethod,
 })
 setShowReceipt(true)
 setLastReceiptNumber(data.receipt.receiptNumber)
 queryClient.invalidateQueries({ queryKey: ['receipts'] })
 }

 toast.success(t('memberDetails.paymentModal.paymentSuccess'))
 setPaymentData({ amount: 0, paymentMethod: 'cash', notes: '' })
 setActiveModal(null)
 fetchMember()
 } else {
 toast.error(data.error || t('memberDetails.paymentModal.paymentFailed'))
 }
 } catch (error) {
 console.error(error)
 toast.error(t('memberDetails.error'))
 } finally {
 setLoading(false)
 }
 }

 const handleUseInBody = async () => {
 if (!member || (member.inBodyScans ?? 0) <= 0) {
 toast.warning(t('memberDetails.noInBodyRemaining'))
 return
 }

 setConfirmModal({
 show: true,
 title: `${t('memberDetails.useInBody')}`,
 message: t('memberDetails.confirmUseInBody'),
 onConfirm: async () => {
 setConfirmModal(null)
 setLoading(true)
 try {
 const response = await fetch('/api/members', {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 id: member.id,
 inBodyScans: (member.inBodyScans ?? 0) - 1
 })
 })

 if (response.ok) {
 toast.success(t('memberDetails.inBodyUsed'))
 fetchMember()
 }
 } catch (error) {
 toast.error(t('memberDetails.error'))
 } finally {
 setLoading(false)
 }
 }
 })
 }

 const handleUsePool = async () => {
 if (!member || (member.freePoolSessions ?? 0) <= 0) {
 toast.warning(t('memberDetails.noPoolSessionsRemaining'))
 return
 }

 setConfirmModal({
 show: true,
 title: `${t('memberDetails.usePoolSession')}`,
 message: t('memberDetails.confirmUsePoolSession'),
 onConfirm: async () => {
 setConfirmModal(null)
 setLoading(true)
 try {
 const response = await fetch('/api/members', {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 id: member.id,
 freePoolSessions: (member.freePoolSessions ?? 0) - 1
 })
 })

 if (response.ok) {
 toast.success(t('memberDetails.poolSessionUsed'))
 fetchMember()
 }
 } catch (error) {
 toast.error(t('memberDetails.error'))
 } finally {
 setLoading(false)
 }
 }
 })
 }

 const handleUsePadel = async () => {
 if (!member || (member.freePadelSessions ?? 0) <= 0) {
 toast.warning(t('memberDetails.noPadelSessionsRemaining'))
 return
 }

 setConfirmModal({
 show: true,
 title: `${t('memberDetails.usePadelSession')}`,
 message: t('memberDetails.confirmUsePadelSession'),
 onConfirm: async () => {
 setConfirmModal(null)
 setLoading(true)
 try {
 const response = await fetch('/api/members', {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 id: member.id,
 freePadelSessions: (member.freePadelSessions ?? 0) - 1
 })
 })

 if (response.ok) {
 toast.success(t('memberDetails.padelSessionUsed'))
 fetchMember()
 }
 } catch (error) {
 toast.error(t('memberDetails.error'))
 } finally {
 setLoading(false)
 }
 }
 })
 }

 const handleUseAssessment = async () => {
 if (!member || (member.freeAssessmentSessions ?? 0) <= 0) {
 toast.warning(t('memberDetails.noAssessmentSessionsRemaining'))
 return
 }

 setConfirmModal({
 show: true,
 title: `${t('memberDetails.useAssessmentSession')}`,
 message: t('memberDetails.confirmUseAssessmentSession'),
 onConfirm: async () => {
 setConfirmModal(null)
 setLoading(true)
 try {
 const response = await fetch('/api/members', {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 id: member.id,
 freeAssessmentSessions: (member.freeAssessmentSessions ?? 0) - 1
 })
 })

 if (response.ok) {
 toast.success(t('memberDetails.assessmentSessionUsed'))
 fetchMember()
 }
 } catch (error) {
 toast.error(t('memberDetails.error'))
 } finally {
 setLoading(false)
 }
 }
 })
 }

 const handleUseInvitation = async () => {
 if (!member || (member.invitations ?? 0) <= 0) {
 toast.warning(t('memberDetails.noInvitationsRemaining'))
 return
 }

 setActiveModal('invitation')
 }

 const handleSubmitInvitation = async () => {
 if (!member) return

 if (!invitationData.guestName.trim() || !invitationData.guestPhone.trim()) {
 toast.warning(t('memberDetails.invitationModal.enterGuestInfo'))
 return
 }

 setLoading(true)

 try {
 const response = await fetch('/api/invitations', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 memberId: member.id,
 guestName: invitationData.guestName.trim(),
 guestPhone: invitationData.guestPhone.trim(),
 notes: invitationData.notes.trim() || undefined,
 salesStaffId: invitationData.salesStaffId || undefined
 })
 })

 const result = await response.json()

 if (response.ok) {
 toast.success(t('memberDetails.invitationModal.invitationSuccess'))

 setInvitationData({ guestName: '', guestPhone: '', notes: '', salesStaffId: '' })
 setActiveModal(null)

 fetchMember()
 fetchInvitationHistory()
 } else {
 toast.error(result.error || t('memberDetails.invitationModal.invitationFailed'))
 }
 } catch (error) {
 console.error(error)
 toast.error(t('memberDetails.connectionError'))
 } finally {
 setLoading(false)
 }
 }

 const handleUseFreePT = async () => {
 if (!member || (member.freePTSessions ?? 0) <= 0) {
 toast.warning(t('memberDetails.noFreePTRemaining'))
 return
 }

 setFreeSessionModal({
 isOpen: true,
 serviceType: 'PT'
 })
 }

 const handleUseFreeNutrition = async () => {
 if (!member || (member.freeNutritionSessions ?? 0) <= 0) {
 toast.warning('لا توجد جلسات تغذية متبقية')
 return
 }

 setFreeSessionModal({
 isOpen: true,
 serviceType: 'Nutrition'
 })
 }

 const handleUseFreePhysio = async () => {
 if (!member || (member.freePhysioSessions ?? 0) <= 0) {
 toast.warning('لا توجد جلسات علاج طبيعي متبقية')
 return
 }

 setFreeSessionModal({
 isOpen: true,
 serviceType: 'Physiotherapy'
 })
 }

 const handleUseFreeGroupClass = async () => {
 if (!member || (member.freeGroupClassSessions ?? 0) <= 0) {
 toast.warning('لا توجد جلسات جروب كلاسيس متبقية')
 return
 }

 setFreeSessionModal({
 isOpen: true,
 serviceType: 'GroupClass'
 })
 }

 // ===== Handler Functions للجلسات المدفوعة =====

 const handleUsePaidPT = async () => {
 if (!member || paidSessionCounts.pt <= 0) {
 toast.warning(t('memberDetails.noPaidPTRemaining'))
 return
 }

 setConfirmModal({
 show: true,
 title: t('memberDetails.usePaidPT'),
 message: t('memberDetails.confirmUsePaidPT'),
 onConfirm: async () => {
 setConfirmModal(null)
 setLoading(true)
 try {
 const response = await fetch('/api/members/deduct-paid-service', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 memberId: member.id,
 serviceType: 'paidPT'
 })
 })

 const result = await response.json()

 if (response.ok) {
 toast.success(t('memberDetails.paidPTUsed', { remaining: result.remainingSessions }))
 fetchPTSubscription()
 fetchServiceSubscriptions()
 // تحديث cache الـ PT في جميع الصفحات
 queryClient.invalidateQueries({ queryKey: ['pt-sessions'] })
 } else {
 toast.error(result.error || t('memberDetails.paidSessionDeductionFailed'))
 }
 } catch (error) {
 toast.error(t('memberDetails.connectionError'))
 } finally {
 setLoading(false)
 }
 }
 })
 }

 const handleUsePaidNutrition = async () => {
 if (!member || paidSessionCounts.nutrition <= 0) {
 toast.warning(t('memberDetails.noPaidNutritionRemaining'))
 return
 }

 setConfirmModal({
 show: true,
 title: t('memberDetails.usePaidNutrition'),
 message: t('memberDetails.confirmUsePaidNutrition'),
 onConfirm: async () => {
 setConfirmModal(null)
 setLoading(true)
 try {
 const response = await fetch('/api/members/deduct-paid-service', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 memberId: member.id,
 serviceType: 'paidNutrition'
 })
 })

 const result = await response.json()

 if (response.ok) {
 toast.success(t('memberDetails.paidNutritionUsed', { remaining: result.remainingSessions }))
 fetchServiceSubscriptions()
 // تحديث cache الـ Nutrition في جميع الصفحات
 queryClient.invalidateQueries({ queryKey: ['nutrition-sessions'] })
 } else {
 toast.error(result.error || t('memberDetails.paidSessionDeductionFailed'))
 }
 } catch (error) {
 toast.error(t('memberDetails.connectionError'))
 } finally {
 setLoading(false)
 }
 }
 })
 }

 const handleUsePaidPhysio = async () => {
 if (!member || paidSessionCounts.physio <= 0) {
 toast.warning(t('memberDetails.noPaidPhysioRemaining'))
 return
 }

 setConfirmModal({
 show: true,
 title: t('memberDetails.usePaidPhysio'),
 message: t('memberDetails.confirmUsePaidPhysio'),
 onConfirm: async () => {
 setConfirmModal(null)
 setLoading(true)
 try {
 const response = await fetch('/api/members/deduct-paid-service', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 memberId: member.id,
 serviceType: 'paidPhysio'
 })
 })

 const result = await response.json()

 if (response.ok) {
 toast.success(t('memberDetails.paidPhysioUsed', { remaining: result.remainingSessions }))
 fetchServiceSubscriptions()
 // تحديث cache الـ Physiotherapy في جميع الصفحات
 queryClient.invalidateQueries({ queryKey: ['physiotherapy-sessions'] })
 } else {
 toast.error(result.error || t('memberDetails.paidSessionDeductionFailed'))
 }
 } catch (error) {
 toast.error(t('memberDetails.connectionError'))
 } finally {
 setLoading(false)
 }
 }
 })
 }

 const handleUsePaidGroupClass = async () => {
 if (!member || paidSessionCounts.groupClass <= 0) {
 toast.warning(t('memberDetails.noPaidGroupClassRemaining'))
 return
 }

 setConfirmModal({
 show: true,
 title: t('memberDetails.usePaidGroupClass'),
 message: t('memberDetails.confirmUsePaidGroupClass'),
 onConfirm: async () => {
 setConfirmModal(null)
 setLoading(true)
 try {
 const response = await fetch('/api/members/deduct-paid-service', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 memberId: member.id,
 serviceType: 'paidGroupClass'
 })
 })

 const result = await response.json()

 if (response.ok) {
 toast.success(t('memberDetails.paidGroupClassUsed', { remaining: result.remainingSessions }))
 fetchServiceSubscriptions()
 // تحديث cache الـ Group Classes في جميع الصفحات
 queryClient.invalidateQueries({ queryKey: ['groupClass-sessions'] })
 } else {
 toast.error(result.error || t('memberDetails.paidSessionDeductionFailed'))
 }
 } catch (error) {
 toast.error(t('memberDetails.connectionError'))
 } finally {
 setLoading(false)
 }
 }
 })
 }

 //  حفظ محدود: الاسم ورقم الموبايل بس (صلاحية canEditMemberBasic)
 const handleEditNamePhone = async () => {
 if (!member || !editBasicInfoData.name.trim() || !editBasicInfoData.phone.trim()) {
 toast.warning(t('memberDetails.editModal.enterNameAndPhone'))
 return
 }
 setLoading(true)
 try {
 const response = await fetch('/api/members', {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 id: member.id,
 name: editBasicInfoData.name.trim(),
 phone: editBasicInfoData.phone.trim(),
 }),
 })
 if (response.ok) {
 toast.success(t('memberDetails.editModal.updateSuccess'))
 setActiveModal(null)
 fetchMember()
 queryClient.invalidateQueries({ queryKey: ['members'] })
 } else {
 const err = await response.json().catch(() => ({}))
 toast.error(err.error || 'فشل التعديل')
 }
 } catch (error) {
 console.error(error)
 toast.error('حدث خطأ في الاتصال')
 } finally {
 setLoading(false)
 }
 }

 const handleEditBasicInfo = async () => {
 if (!member || !editBasicInfoData.name.trim() || !editBasicInfoData.phone.trim()) {
 toast.warning(t('memberDetails.editModal.enterNameAndPhone'))
 return
 }

 setLoading(true)

 try {
 const response = await fetch('/api/members', {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 id: member.id,
 name: editBasicInfoData.name.trim(),
 phone: editBasicInfoData.phone.trim(),
 memberNumber: editBasicInfoData.memberNumber.trim() || null,
 profileImage: editBasicInfoData.profileImage,
 idCardFront: editBasicInfoData.idCardFront,
 idCardBack: editBasicInfoData.idCardBack,
 subscriptionPrice: parseInt(editBasicInfoData.subscriptionPrice.toString()),
 inBodyScans: parseInt(editBasicInfoData.inBodyScans.toString()),
 invitations: parseInt(editBasicInfoData.invitations.toString()),
 freePTSessions: parseInt(editBasicInfoData.freePTSessions.toString()),
 freeNutritionSessions: parseInt(editBasicInfoData.freeNutritionSessions.toString()),
 freePhysioSessions: parseInt(editBasicInfoData.freePhysioSessions.toString()),
 freeGroupClassSessions: parseInt(editBasicInfoData.freeGroupClassSessions.toString()),
 freePoolSessions: parseInt(editBasicInfoData.freePoolSessions.toString()),
 freePadelSessions: parseInt(editBasicInfoData.freePadelSessions.toString()),
 freeAssessmentSessions: parseInt(editBasicInfoData.freeAssessmentSessions.toString()),
 freeMoreSessions: parseInt(editBasicInfoData.freeMoreSessions.toString()),
 remainingFreezeDays: parseInt(editBasicInfoData.remainingFreezeDays.toString()),
 remainingAmount: parseInt(editBasicInfoData.remainingAmount.toString()),
 remainingDueDate: editBasicInfoData.remainingDueDate || null,
 coachId: editBasicInfoData.coachId,
 salesStaffId: editBasicInfoData.salesStaffId || null,
 notes: editBasicInfoData.notes.trim() || null,
 gender: editBasicInfoData.gender || null,
 startDate: editBasicInfoData.startDate || null,
 expiryDate: editBasicInfoData.expiryDate || null,
 allowedCheckInStart: editBasicInfoData.allowedCheckInStart || null,
 allowedCheckInEnd: editBasicInfoData.allowedCheckInEnd || null
 })
 })

 if (response.ok) {
 toast.success(t('memberDetails.editModal.updateSuccess'))

 // لو الـ salesStaffId اتغيّر، نخبر CollectionDashboard إنه يعيد احتساب التارجت
 const oldSalesId = (member as any).salesStaffId || null
 const newSalesId = editBasicInfoData.salesStaffId || null
 if (oldSalesId !== newSalesId) {
 window.dispatchEvent(new Event('sales-data-changed'))
 }

 setEditBasicInfoData({
 name: '',
 phone: '',
 memberNumber: '',
 profileImage: null,
 idCardFront: null,
 idCardBack: null,
 subscriptionPrice: 0,
 inBodyScans: 0,
 invitations: 0,
 freePTSessions: 0,
 freeNutritionSessions: 0,
 freePhysioSessions: 0,
 freeGroupClassSessions: 0,
 freePoolSessions: 0,
 freePadelSessions: 0,
 freeAssessmentSessions: 0,
 freeMoreSessions: 0,
 remainingFreezeDays: 0,
 remainingAmount: 0,
 remainingDueDate: '',
 coachId: null,
 notes: '',
 startDate: '',
 expiryDate: '',
 salesStaffId: null,
 gender: '',
 allowedCheckInStart: '',
 allowedCheckInEnd: ''
 })
 setActiveModal(null)
 fetchMember()
 //  حدّث كاش الـ PT عشان صفحة الـ PT تعرض بيانات الميمبر الجديدة (رقم/اسم/تليفون) فوراً
 queryClient.invalidateQueries({ queryKey: ['pt-sessions'] })
 } else {
 const result = await response.json()
 toast.error(result.error || t('memberDetails.editModal.updateFailed'))
 }
 } catch (error) {
 console.error(error)
 toast.error(t('memberDetails.connectionError'))
 } finally {
 setLoading(false)
 }
 }

 const handleAddRemainingAmount = async () => {
 if (!member || addRemainingAmountData.amount <= 0) {
 toast.warning(t('memberDetails.addRemainingAmountModal.enterValidAmount'))
 return
 }

 setLoading(true)

 try {
 const cleanAmount = parseInt(addRemainingAmountData.amount.toString())
 const newRemaining = member.remainingAmount + cleanAmount

 const response = await fetch('/api/members', {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 id: member.id,
 remainingAmount: newRemaining
 })
 })

 if (response.ok) {
 toast.success(t('memberDetails.addRemainingAmountModal.amountAdded', { amount: cleanAmount.toString() }))

 setAddRemainingAmountData({ amount: 0, notes: '' })
 setActiveModal(null)
 fetchMember()
 } else {
 const result = await response.json()
 toast.error(result.error || t('memberDetails.addRemainingAmountModal.updateFailed'))
 }
 } catch (error) {
 console.error(error)
 toast.error(t('memberDetails.connectionError'))
 } finally {
 setLoading(false)
 }
 }

 const handleFreeze = async () => {
 if (!member || !member.expiryDate || freezeData.days <= 0) {
 toast.warning(t('memberDetails.freezeModal.enterValidDays'))
 return
 }

 // التحقق من رصيد الفريز الكافي
 if (freezeData.days > member.remainingFreezeDays) {
 toast.error(`رصيد الفريز غير كافٍ. المتاح: ${member.remainingFreezeDays} يوم`)
 return
 }

 setLoading(true)
 try {
 const response = await fetch('/api/members/freeze', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 memberId: member.id,
 freezeDays: freezeData.days
 })
 })

 const result = await response.json()

 if (response.ok) {
 //  🥋 تجميد الـ PT كمان لو المستخدم اختار كده والعضو مشترك PT
 let ptMsg = ''
 if (freezePTToo && ptSubscription?.ptNumber) {
 try {
 const ptRes = await fetch('/api/pt/freeze', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ ptNumber: ptSubscription.ptNumber, freezeDays: freezeData.days })
 })
 if (ptRes.ok) ptMsg = ' + الـ PT'
 else { const e = await ptRes.json().catch(() => ({})); toast.error(e.error || 'فشل تجميد الـ PT') }
 } catch { toast.error('فشل تجميد الـ PT') }
 }
 toast.success(`تم تجميد الاشتراك${ptMsg} لمدة ${freezeData.days} يوم بنجاح`)

 setFreezeData({ days: 0, reason: '' })
 setFreezePTToo(false)
 setActiveModal(null)
 fetchMember()
 fetchPTSubscription()
 } else {
 toast.error(result.error || 'فشل التجميد')
 }
 } catch (error) {
 toast.error(t('memberDetails.error'))
 } finally {
 setLoading(false)
 }
 }

 //  فتح مودال الباك فريز — بيجيب آخر حضور ويحسب أيام الغياب تلقائي
 const openBackFreeze = async () => {
 if (!member) return
 setBackFreezeData({ days: 0, lastCheckIn: null, loading: true })
 setActiveModal('backFreeze')
 try {
 const res = await fetch(`/api/member-checkin?memberId=${member.id}`)
 if (res.ok) {
 const data = await res.json()
 const last = data?.checkIn?.checkInTime || null
 let days = 0
 if (last) {
 const lastDate = new Date(last); lastDate.setHours(0, 0, 0, 0)
 const today = new Date(); today.setHours(0, 0, 0, 0)
 days = Math.max(0, Math.round((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)))
 }
 setBackFreezeData({ days, lastCheckIn: last, loading: false })
 } else {
 setBackFreezeData({ days: 0, lastCheckIn: null, loading: false })
 }
 } catch {
 setBackFreezeData({ days: 0, lastCheckIn: null, loading: false })
 }
 }

 const handleBackFreeze = async () => {
 if (!member || !member.expiryDate || backFreezeData.days <= 0) {
 toast.warning(locale === 'ar' ? 'عدد أيام الغياب لازم يكون أكبر من صفر' : 'Absence days must be greater than zero')
 return
 }
 if (backFreezeData.days > member.remainingFreezeDays) {
 toast.error(`رصيد الفريز غير كافٍ. المتاح: ${member.remainingFreezeDays} يوم`)
 return
 }
 setLoading(true)
 try {
 const response = await fetch('/api/members/freeze', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 memberId: member.id,
 freezeDays: backFreezeData.days,
 isBack: true,
 backStartDate: backFreezeData.lastCheckIn || undefined,
 })
 })
 const result = await response.json()
 if (response.ok) {
 toast.success(result.message || (locale === 'ar' ? 'تم عمل باك فريز بنجاح' : 'Back freeze done'))
 setActiveModal(null)
 fetchMember()
 fetchFreezeHistory()
 } else {
 toast.error(result.error || (locale === 'ar' ? 'فشل الباك فريز' : 'Back freeze failed'))
 }
 } catch {
 toast.error(t('memberDetails.error'))
 } finally {
 setLoading(false)
 }
 }

 const handleUnfreeze = () => {
 if (!member) return
 setActiveModal('unfreeze')
 }

 const confirmUnfreeze = async () => {
 if (!member) return

 setLoading(true)
 try {
 const response = await fetch('/api/members/freeze', {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ memberId: member.id })
 })

 const result = await response.json()

 if (response.ok) {
 toast.success(result.message || (locale === 'ar' ? 'تم فك الفريز بنجاح' : 'Unfreeze successful'))
 setActiveModal(null)
 fetchMember()
 } else {
 toast.error(result.error || (locale === 'ar' ? 'فشل فك الفريز' : 'Unfreeze failed'))
 }
 } catch {
 toast.error(locale === 'ar' ? 'حدث خطأ في الاتصال' : 'Connection error')
 } finally {
 setLoading(false)
 }
 }

 const handleDelete = async () => {
 if (!member) return

 setConfirmModal({
 show: true,
 title: `${t('memberDetails.deleteModal.title')}`,
 message: t('memberDetails.deleteModal.confirmMessage', { name: member.name, number: member.memberNumber?.toString() || 'Other' }),
 onConfirm: async () => {
 setConfirmModal(null)
 setLoading(true)
 try {
 const response = await fetch(`/api/members?id=${member.id}`, {
 method: 'DELETE'
 })

 if (response.ok) {
 toast.success(t('memberDetails.deleteModal.deleteSuccess'))
 queryClient.invalidateQueries({ queryKey: ['members'] })
 setTimeout(() => {
 router.push('/members')
 }, 1500)
 } else {
 toast.error(t('memberDetails.deleteModal.deleteFailed'))
 }
 } catch (error) {
 console.error(error)
 toast.error(t('memberDetails.deleteModal.deleteError'))
 } finally {
 setLoading(false)
 }
 }
 })
 }

 const [banReason, setBanReason] = useState('')

 const handleBan = () => {
 if (!member) return
 setBanReason('')
 setActiveModal('ban')
 }

 const handleConfirmBan = async () => {
 if (!member) return
 if (!banReason.trim()) return
 setActiveModal(null)
 setLoading(true)
 try {
 const res = await fetch('/api/banned-members', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 name: member.name,
 phone: member.phone || null,
 nationalId: (member as any).nationalId || null,
 reason: banReason.trim(),
 notes: member.memberNumber !== null ? `#${member.memberNumber}` : 'Other'
 })
 })
 if (res.ok) {
 toast.success(locale === 'ar' ? 'تم إضافة العضو لقائمة المحظورين' : 'Member added to banned list')
 } else {
 const err = await res.json()
 toast.error(err.error || (locale === 'ar' ? 'فشل الحظر' : 'Ban failed'))
 }
 } catch {
 toast.error(locale === 'ar' ? 'خطأ في الاتصال' : 'Connection error')
 } finally {
 setLoading(false)
 }
 }

 const handleOpenFitnessTest = async () => {

 if (fitnessTestExists) {
 setActiveModal('view-fitness-test')
 } else {
 // Auto-select coach if current user is coach
 try {
 const userStr = localStorage.getItem('user')

 if (userStr) {
 const user = JSON.parse(userStr)

 if (user.role === 'COACH' && user.staffId) {
 router.push(`/fitness-tests/new?memberId=${memberId}&coachId=${user.staffId}`)
 return
 }
 }
 } catch (error) {
 console.error('Error parsing user from localStorage:', error)
 }

 // Default: show coach selection modal
 await fetchCoaches()
 setActiveModal('fitness-test-coach-select')
 }
 }

 const handleSubmitFitnessTest = async () => {
 setLoading(true)
 try {
 const response = await fetch(`/api/members/${memberId}/fitness-test`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 coachId: selectedCoachId,
 testDate: fitnessTestForm.testDate,
 medicalQuestions: fitnessTestForm.medicalQuestions,
 flexibility: fitnessTestForm.flexibility,
 exercises: fitnessTestForm.exercises,
 }),
 })

 if (response.ok) {
 toast.success(t('memberDetails.fitnessTest.saveSuccess'))
 setActiveModal(null)
 fetchFitnessTest()
 } else {
 const result = await response.json()
 toast.error(result.error || t('memberDetails.fitnessTest.saveFailed'))
 }
 } catch (error) {
 console.error('Error:', error)
 toast.error(t('memberDetails.fitnessTest.saveError'))
 } finally {
 setLoading(false)
 }
 }

 if (loading && !member) {
 return <LoadingScreen fullScreen message={t('memberDetails.loading')} />
 }

 if (!member) {
 return (
 <div className="container mx-auto p-6 text-center" dir={direction}>
 <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
 <p className="text-xl mb-4">{t('memberDetails.memberNotFound')}</p>
 <button
 onClick={goBack}
 className="bg-primary-600 text-primary-contrast px-6 py-2 rounded-lg hover:bg-primary-700"
 >
 {t('memberDetails.back')}
 </button>
 </div>
 )
 }

 // التحقق من حالة العضو (هل بدأ الاشتراك ولم ينتهي؟)
 // تطبيع التواريخ لـ local midnight لتجنب مشاكل timezone
 const today = new Date()
 today.setHours(0, 0, 0, 0)
 const startDate = member.startDate ? (() => { const d = new Date(member.startDate); d.setHours(0, 0, 0, 0); return d })() : null
 const expiryDate = member.expiryDate ? (() => { const d = new Date(member.expiryDate); d.setHours(0, 0, 0, 0); return d })() : null
 const hasStarted = !startDate || startDate <= today
 const notExpired = !expiryDate || expiryDate >= today
 const isMemberActiveNow = member.isActive && hasStarted && notExpired
 const isNotStartedYet = member.isActive && startDate && startDate > today
 const daysUntilStart = isNotStartedYet ? Math.ceil((startDate!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0
 const daysRemaining = calculateRemainingDays(member.expiryDate)

 return (
 <div className="container mx-auto p-6" dir={direction}>
 <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
 <div>
 <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
 <svg className="w-7 h-7 text-primary-500" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
 <span>{t('memberDetails.title')}</span>
 </h1>
 <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('memberDetails.subtitle')}</p>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={openTimeline}
 className="inline-flex items-center gap-2 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-200 px-4 py-2.5 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-900/70 transition-colors duration-200 font-bold"
 title={locale === 'ar' ? 'سجل رحلة العضو بالكامل' : 'Full member journey'}
 >
 <svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
 {locale === 'ar' ? 'سجل الرحلة' : 'Journey'}
 </button>
 <button
 onClick={goBack}
 className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white px-4 py-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 font-bold"
 >
 <svg className={`w-4 h-4 ${direction === 'rtl' ? 'rotate-180' : ''}`} {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
 {t('memberDetails.back')}
 </button>
 </div>
 </div>


 {/* بانر الحظر */}
 {member?.isBanned && (
 <div className="bg-red-600 dark:bg-red-800 text-white rounded-xl shadow-sm ring-1 ring-red-400 dark:ring-red-900/50 p-5 mb-6">
 <div className="flex items-center gap-4 flex-wrap">
 <svg className="w-10 h-10 flex-shrink-0" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
 <div className="flex-1 min-w-0">
 <h2 className="text-xl font-bold">{locale === 'ar' ? 'هذا العضو محظور' : 'This Member is Banned'}</h2>
 </div>
 <div className="text-sm bg-red-700 dark:bg-red-900 px-3 py-1.5 rounded-lg font-bold ring-1 ring-red-500">
 {locale === 'ar' ? 'لا يمكن الاشتراك' : 'Cannot Subscribe'}
 </div>
 </div>
 </div>
 )}

 <div className="bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-700 dark:to-primary-800 text-primary-contrast rounded-2xl shadow-2xl p-6 mb-6">
 {/* الـ Header: صورة + اسم + رقم + أزرار سريعة */}
 <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-6">
 {/* صورة العضو — أصغر شوية وعلى الجانب */}
 <div className="relative w-32 h-32 md:w-36 md:h-36 rounded-full overflow-hidden ring-4 ring-white dark:ring-gray-700 shadow-2xl bg-white dark:bg-gray-800 shrink-0">
 {member.profileImage ? (
 <img
 src={member.profileImage}
 alt={member.name}
 onClick={() => setZoomedImage(member.profileImage!)}
 className="w-full h-full object-cover cursor-zoom-in hover:opacity-90 transition"
 title={locale === 'ar' ? 'اضغط للتكبير' : 'Click to enlarge'}
 />
 ) : (
 <>
 <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-400 bg-gray-100 dark:bg-gray-700">
 <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
 </svg>
 </div>
 <button
 type="button"
 onClick={() => setMissingImageUpload({ field: 'profileImage', label: locale === 'ar' ? 'الصورة الشخصية' : 'Profile Image' })}
 className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40 hover:bg-black/55 text-white font-bold transition group"
 title={locale === 'ar' ? 'إضافة صورة شخصية' : 'Add Profile Image'}
 >
 
 <span className="text-xs font-semibold">
 {locale === 'ar' ? 'إضافة صورة' : 'Add Photo'}
 </span>
 </button>
 </>
 )}
 </div>

 {/* الاسم + الرقم + الأزرار */}
 <div className="flex-1 min-w-0 w-full">
 <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-3">
 <div className="text-center md:text-start">
 <p className="text-sm opacity-90 mb-1">{t('memberDetails.membershipNumber')}</p>
 <p className="text-4xl md:text-5xl font-bold">
 {member.memberNumber !== null ? `#${member.memberNumber}` : <span className="bg-white/20 px-3 py-1 rounded-full text-2xl">Other</span>}
 </p>
 <p className="text-2xl md:text-3xl font-bold mt-2 truncate">{member.name}</p>
 </div>

 {/* Action Buttons */}
 <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 shrink-0">
 {/* Barcode + WhatsApp */}
 <button
 onClick={async () => {
 setBarcodePopup({ show: true, step: 'generating', image: '', error: '' })
 try {
 const res = await fetch('/api/barcode', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ text: (member.memberNumber ?? 'Other').toString() }),
 })
 const data = await res.json()

 if (!data.barcode) {
 setBarcodePopup(p => ({ ...p, step: 'error', error: 'فشل إنشاء صورة الباركود' }))
 return
 }

 const isValid = await new Promise<boolean>((resolve) => {
 const img = new Image()
 img.onload = () => resolve(img.width > 0 && img.height > 0)
 img.onerror = () => resolve(false)
 img.src = data.barcode
 })

 if (!isValid) {
 setBarcodePopup(p => ({ ...p, step: 'error', error: 'الصورة غير صالحة' }))
 return
 }

 setBarcodePopup({ show: true, step: 'ready', image: data.barcode, error: '' })
 } catch (error) {
 console.error('Error:', error)
 setBarcodePopup(p => ({ ...p, step: 'error', error: 'حدث خطأ أثناء إنشاء الباركود' }))
 }
 }}
 className="bg-white/20 hover:bg-white/30 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors duration-200 backdrop-blur-sm border border-white/20"
 title={locale === 'ar' ? 'إرسال الباركود على واتساب' : 'Send Barcode via WhatsApp'}
 >
 <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
 <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
 </svg>
 <span className="font-semibold text-sm">
 {locale === 'ar' ? 'إرسال الباركود' : 'Send Barcode'}
 </span>
 </button>

 {/* ID Card Images */}
 <button
 onClick={() => setShowIdCardModal(true)}
 className="bg-white/20 hover:bg-white/30 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors duration-200 backdrop-blur-sm border border-white/20"
 title={t('memberDetails.viewIdCardImages')}
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
 </svg>
 <span className="font-semibold text-sm">
 {locale === 'ar' ? 'صور البطاقة' : 'ID Card'}
 </span>
 </button>

 {/* Edit Member */}
 {hasPermission('canEditMembers') && (
 <button
 onClick={() => {
 setEditBasicInfoData({
 name: member.name,
 phone: member.phone,
 memberNumber: member.memberNumber != null ? String(member.memberNumber) : '',
 profileImage: member.profileImage || null,
 subscriptionPrice: member.subscriptionPrice,
 inBodyScans: member.inBodyScans ?? 0,
 invitations: member.invitations ?? 0,
 freePTSessions: member.freePTSessions ?? 0,
 freeNutritionSessions: member.freeNutritionSessions ?? 0,
 freePhysioSessions: member.freePhysioSessions ?? 0,
 freeGroupClassSessions: member.freeGroupClassSessions ?? 0,
 freePoolSessions: member.freePoolSessions ?? 0,
 freePadelSessions: member.freePadelSessions ?? 0,
 freeAssessmentSessions: member.freeAssessmentSessions ?? 0,
 freeMoreSessions: member.freeMoreSessions ?? 0,
 remainingFreezeDays: member.remainingFreezeDays ?? 0,
 remainingAmount: member.remainingAmount ?? 0,
 remainingDueDate: (member as any).remainingDueDate ? formatDateYMD((member as any).remainingDueDate) : '',
 coachId: member.coachId || null,
 salesStaffId: (member as any).salesStaffId || null,
 notes: member.notes || '',
 startDate: member.startDate ? formatDateYMD(member.startDate) : '',
 expiryDate: member.expiryDate ? formatDateYMD(member.expiryDate) : '',
 idCardFront: member.idCardFront || null,
 idCardBack: member.idCardBack || null,
 gender: (member as any).gender || '',
 allowedCheckInStart: (member as any).allowedCheckInStart || '',
 allowedCheckInEnd: (member as any).allowedCheckInEnd || ''
 })
 setActiveModal('edit-basic-info')
 }}
 disabled={loading}
 className="bg-white/20 hover:bg-white/30 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors duration-200 backdrop-blur-sm border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
 title={t('memberDetails.editModal.title')}
 >
 <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
 <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
 </svg>
 <span className="font-semibold text-sm">
 {locale === 'ar' ? 'تعديل البيانات' : 'Edit Info'}
 </span>
 </button>
 )}

 {/* تعديل محدود: الاسم/الموبايل بس — لصاحب canEditMemberBasic اللي معهوش التعديل الكامل */}
 {!hasPermission('canEditMembers') && hasPermission('canEditMemberBasic') && (
 <button
 onClick={() => {
 setEditBasicInfoData(prev => ({ ...prev, name: member.name, phone: member.phone }))
 setActiveModal('edit-name-phone')
 }}
 disabled={loading}
 className="bg-white/20 hover:bg-white/30 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors duration-200 backdrop-blur-sm border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
 title={locale === 'ar' ? 'تعديل الاسم/الموبايل' : 'Edit name/phone'}
 >
 <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
 <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
 </svg>
 <span className="font-semibold text-sm">
 {locale === 'ar' ? 'تعديل الاسم/الموبايل' : 'Edit name/phone'}
 </span>
 </button>
 )}
 </div>{/* end Action Buttons */}
 </div>{/* end info+buttons row */}
 </div>{/* end right side container */}
 </div>{/* end profile+info header */}

 {/* معلومات إضافية */}
 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
 {/* رقم التليفون — دايماً ظاهر */}
 <div className="bg-white/10 rounded-lg p-3">
 <p className="text-xs opacity-80 mb-1">{t('memberDetails.phoneNumber')}</p>
 <p className="text-base font-mono font-semibold" dir="ltr">{member.phone}</p>
 </div>
 {member.backupPhone && (
 <div className="bg-white/10 rounded-lg p-3">
 <p className="text-xs opacity-80 mb-1">{t('memberDetails.backupPhone')}</p>
 <p className="text-base font-mono" dir="ltr">{member.backupPhone}</p>
 </div>
 )}
 {member.email && (
 <div className="bg-white/10 rounded-lg p-3">
 <p className="text-xs opacity-80 mb-1">{locale === 'ar' ? 'البريد' : 'Email'}</p>
 <p className="text-base font-mono break-all">{member.email}</p>
 </div>
 )}
 {member.nationalId && (
 <div className="bg-white/10 rounded-lg p-3">
 <p className="text-xs opacity-80 mb-1">{t('memberDetails.nationalId')}</p>
 <p className="text-base font-mono">{member.nationalId}</p>
 </div>
 )}
 {member.birthDate && (
 <div className="bg-white/10 rounded-lg p-3">
 <p className="text-xs opacity-80 mb-1">{t('memberDetails.birthDate')}</p>
 <p className="text-base font-mono">
 {new Date(member.birthDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
 year: 'numeric',
 month: 'short',
 day: 'numeric'
 })}
 </p>
 </div>
 )}
 {member.source && (
 <div className="bg-white/10 rounded-lg p-3">
 <p className="text-xs opacity-80 mb-1">{t('memberDetails.memberSource')}</p>
 <p className="text-base font-semibold">
 {(() => {
 const sourcesAr: { [key: string]: string } = {
 'facebook': 'فيسبوك',
 'instagram': 'انستجرام',
 'tiktok': 'تيك توك',
 'google_maps': 'خرائط جوجل',
 'friend_referral': 'إحالة من صديق'
 }
 const sourcesEn: { [key: string]: string } = {
 'facebook': 'Facebook',
 'instagram': 'Instagram',
 'tiktok': 'TikTok',
 'google_maps': 'Google Maps',
 'friend_referral': 'Friend Referral'
 }
 const sources = locale === 'ar' ? sourcesAr : sourcesEn
 return sources[member.source!] || member.source
 })()}
 </p>
 </div>
 )}
 {member.coach && (
 <div className="bg-white/10 rounded-lg p-3">
 <p className="text-xs opacity-80 mb-1">{locale === 'ar' ? 'المدرب' : 'Coach'}</p>
 <p className="text-base font-bold">{member.coach.name}</p>
 <p className="text-xs opacity-75">#{member.coach.staffCode}</p>
 </div>
 )}
 {(member as any).salesStaff && (
 <div className="bg-white/10 rounded-lg p-3">
 <p className="text-xs opacity-80 mb-1">{locale === 'ar' ? 'موظف السيلز' : 'Sales Staff'}</p>
 <p className="text-base font-bold">{(member as any).salesStaff.name}</p>
 <p className="text-xs opacity-75">#{(member as any).salesStaff.staffCode}</p>
 </div>
 )}
 {/* 👥 العضو اللي جاب العضو ده — لما المصدر = friend_referral */}
 {(member as any).referrerMemberNumber && (
 <div className="bg-white/10 rounded-lg p-3">
 <p className="text-xs opacity-80 mb-1">👥 {locale === 'ar' ? 'تم إحالته بواسطة' : 'Referred By'}</p>
 {(member as any).referrerInfo ? (
 <Link href={`/members/${(member as any).referrerInfo.id}`} className="hover:opacity-80 transition-opacity">
 <p className="text-base font-bold underline decoration-dotted">{(member as any).referrerInfo.name}</p>
 <p className="text-xs opacity-75">#{(member as any).referrerMemberNumber}</p>
 </Link>
 ) : (
 <>
 <p className="text-base font-bold">#{(member as any).referrerMemberNumber}</p>
 <p className="text-xs opacity-60">{locale === 'ar' ? 'العضو غير موجود الآن' : 'Member no longer exists'}</p>
 </>
 )}
 </div>
 )}
 {/* 🤝 الأصدقاء اللي العضو ده جابهم — count + collapsible list */}
 {((member as any).referredMembersCount ?? 0) > 0 && (
 <details className="bg-white/10 rounded-lg p-3 group">
 <summary className="cursor-pointer list-none flex items-center justify-between">
 <div>
 <p className="text-xs opacity-80 mb-1">🤝 {locale === 'ar' ? 'الأصدقاء اللي جابهم' : 'Friends Brought'}</p>
 <p className="text-base font-bold">
 {(member as any).referredMembersCount}{' '}
 <span className="text-xs font-normal opacity-75">
 {locale === 'ar'
 ? ((member as any).referredMembersCount === 1 ? 'صديق' : 'أصدقاء')
 : ((member as any).referredMembersCount === 1 ? 'friend' : 'friends')}
 </span>
 </p>
 </div>
 <svg className="w-4 h-4 opacity-60 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
 </svg>
 </summary>
 <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto">
 {((member as any).referredMembers || []).map((r: any) => (
 <Link
 key={r.id}
 href={`/members/${r.id}`}
 className="flex items-center justify-between gap-2 bg-white/10 hover:bg-white/20 rounded px-2.5 py-1.5 transition-colors"
 >
 <div className="flex items-center gap-2 min-w-0">
 <span className={`w-2 h-2 rounded-full flex-shrink-0 ${r.isActive ? 'bg-green-400' : 'bg-red-400'}`} />
 <span className="text-sm font-bold truncate">{r.name}</span>
 {r.memberNumber && <span className="text-[10px] opacity-70 font-mono flex-shrink-0">#{r.memberNumber}</span>}
 </div>
 <span className="text-[10px] opacity-60 font-mono flex-shrink-0">
 {new Date(r.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { day: '2-digit', month: 'short', year: '2-digit' })}
 </span>
 </Link>
 ))}
 </div>
 </details>
 )}

 {/* 🎟️ أيام الاستخدام / InBody المرتبطة بالعضو */}
 {((member as any).dayUses?.length > 0) && (
 <details className="bg-white/10 rounded-lg p-3 group">
 <summary className="cursor-pointer list-none flex items-center justify-between">
 <div>
 <p className="text-xs opacity-80 mb-1">🎟️ {locale === 'ar' ? 'أيام الاستخدام / InBody' : 'Day Use / InBody'}</p>
 <p className="text-base font-bold">
 {(member as any).dayUses.length}{' '}
 <span className="text-xs font-normal opacity-75">{locale === 'ar' ? 'عملية' : 'records'}</span>
 </p>
 </div>
 <svg className="w-4 h-4 opacity-60 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
 </svg>
 </summary>
 <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto">
 {(member as any).dayUses.map((d: any) => {
 const label = d.serviceType === 'DayUse' ? (locale === 'ar' ? 'يوم استخدام' : 'Day Use')
 : d.serviceType === 'InBody' ? 'InBody'
 : d.serviceType === 'LockerRental' ? (locale === 'ar' ? 'تأجير لوجر' : 'Locker') : d.serviceType
 return (
 <div key={d.id} className="flex items-center justify-between gap-2 bg-white/10 rounded px-2.5 py-1.5">
 <span className="text-sm font-bold truncate">{label}</span>
 <span className="text-xs opacity-80 flex-shrink-0">{d.price} {locale === 'ar' ? 'ج.م' : 'EGP'}</span>
 <span className="text-[10px] opacity-60 font-mono flex-shrink-0">
 {new Date(d.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { day: '2-digit', month: 'short', year: '2-digit' })}
 </span>
 </div>
 )
 })}
 </div>
 </details>
 )}
 </div>

 <div className="mt-6 pt-6 border-t border-white dark:border-gray-400 border-opacity-20">
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-white">
 <div className="bg-white dark:bg-gray-800 bg-opacity-20 rounded-lg p-4">
 <p className="text-sm opacity-90">{t('memberDetails.status')}</p>
 <p className="text-lg font-bold">
 {member.isBanned
 ? `${locale === 'ar' ? 'محظور' : 'Banned'}`
 : member.isFrozen
 ? `${locale === 'ar' ? 'مجمد' : 'Frozen'}`
 : isNotStartedYet
 ? `${locale === 'ar' ? `يبدأ بعد ${daysUntilStart} يوم` : `Starts in ${daysUntilStart}d`}`
 : isMemberActiveNow
 ? `${t('memberDetails.active')}`
 : `${t('memberDetails.expired')}`
 }
 </p>
 </div>
 <div className="bg-white dark:bg-gray-800 bg-opacity-20 rounded-lg p-4">
 <p className="text-sm opacity-90">{t('common.startDate')}</p>
 <p className="text-lg font-mono">
 {formatDateYMD(member.startDate)}
 </p>
 </div>
 <div className="bg-white dark:bg-gray-800 bg-opacity-20 rounded-lg p-4">
 <p className="text-sm opacity-90">{t('memberDetails.expiryDate')}</p>
 <p className="text-lg font-mono">
 {formatDateYMD(member.expiryDate)}
 </p>
 {daysRemaining !== null && daysRemaining > 0 && (
 <p className="text-xs opacity-75 mt-1">{t('memberDetails.daysRemaining', { days: daysRemaining.toString() })}</p>
 )}
 </div>
 <div className="bg-white dark:bg-gray-800 bg-opacity-20 rounded-lg p-4">
 <p className="text-sm opacity-90">{t('memberDetails.subscriptionPrice')}</p>
 <p className="text-2xl font-bold">{member.subscriptionPrice} {t('memberDetails.egp')}</p>
 </div>
 {settings.remainingEnabled && member.remainingAmount > 0 && (
 <div className="bg-orange-400/30 ring-1 ring-orange-300 rounded-lg p-4">
 <p className="text-sm opacity-90">{locale === 'ar' ? 'باقي على العضو' : 'Remaining Balance'}</p>
 <p className="text-2xl font-bold text-orange-100">{member.remainingAmount} {t('memberDetails.egp')}</p>
 </div>
 )}
 <div className="bg-white dark:bg-gray-800 bg-opacity-20 rounded-lg p-4">
 <p className="text-sm opacity-90">{locale === 'ar' ? 'الباقة' : 'Package'}</p>
 <p className="text-2xl font-bold">{getPackageName(member.startDate, member.expiryDate, locale)}</p>
 </div>
 <div
 className="bg-white dark:bg-gray-800 bg-opacity-20 rounded-lg p-4 cursor-pointer hover:bg-opacity-30 transition-colors duration-200 "
 onClick={lastReceipt ? handleShowReceipts : undefined}
 title={lastReceipt ? (locale === 'ar' ? 'اضغط لعرض سجل الإيصالات' : 'Click to view receipts history') : ''}
 >
 <p className="text-sm opacity-90 flex items-center gap-1">
 {t('memberDetails.lastReceipt')}
 {lastReceipt && (
 <span className="text-xs opacity-75">({locale === 'ar' ? 'اضغط للعرض' : 'Click'})</span>
 )}
 </p>
 {lastReceipt ? (
 <div>
 <p className="text-2xl font-bold text-green-300">#{lastReceiptNumber}</p>
 <p className="text-xs opacity-75 mt-1">
 {lastReceipt.amount} {t('memberDetails.egp')} • {new Date(lastReceipt.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
 </p>
 </div>
 ) : (
 <p className="text-2xl font-bold text-green-300">---</p>
 )}
 </div>
 </div>
 </div>

 {/* 📤 كارت نقل العضوية — لينك للعضو الناقل + تفاصيل النقل (بدل النص الوحش في الملاحظات) */}
 {member.transferredFrom && (() => {
 const m = member.notes?.match(/استلام نقل عضوية من[^\]]*?—\s*(\d+)\s*يوم/)
 const days = m ? parseInt(m[1]) : null
 return (
 <div className="mt-6 pt-6 border-t border-white dark:border-gray-400 border-opacity-20">
 <div className="bg-white dark:bg-gray-800 bg-opacity-20 rounded-lg p-4">
 <div className="flex items-center gap-2 mb-2">
 <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
 <p className="text-sm opacity-90 font-semibold">{locale === 'ar' ? 'نقل العضوية' : 'Membership Transfer'}</p>
 </div>
 <Link href={`/members/${member.transferredFrom.id}`} className="group inline-flex items-center flex-wrap gap-2 cursor-pointer" title={locale === 'ar' ? 'فتح بروفايل العضو الناقل' : 'Open transferring member profile'}>
 <span className="opacity-90">{locale === 'ar' ? 'استلمت العضوية من' : 'From'}:</span>
 <span className="font-bold text-lg decoration-2 underline-offset-4 group-hover:underline group-hover:opacity-100 transition-all">{member.transferredFrom.name}</span>
 {member.transferredFrom.memberNumber && <span className="opacity-80 group-hover:opacity-100">#{member.transferredFrom.memberNumber}</span>}
 </Link>
 <div className="text-xs opacity-80 mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
 {days != null && <span>{locale === 'ar' ? `الأيام المنقولة: ${days} يوم` : `Days transferred: ${days}`}</span>}
 {member.transferredFromAt && <span>{locale === 'ar' ? 'بتاريخ' : 'On'}: {new Date(member.transferredFromAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
 </div>
 </div>
 </div>
 )
 })()}

 {/* عرض الملاحظات — بعد تنظيفها من سطور النقل التلقائية (شكلها وحش) */}
 {(() => {
 const cleanNotes = (member.notes || '').split('\n').filter(l => !l.includes('نقل عضوية')).join('\n').trim()
 if (!cleanNotes) return null
 return (
 <div className="mt-6 pt-6 border-t border-white dark:border-gray-400 border-opacity-20">
 <div className="bg-white dark:bg-gray-800 bg-opacity-20 rounded-lg p-4">
 <div className="flex items-center gap-2 mb-2">

 <p className="text-sm opacity-90 font-semibold">{t('memberDetails.notes')}</p>
 </div>
 <p className="text-base leading-relaxed whitespace-pre-wrap">{cleanNotes}</p>
 </div>
 </div>
 )
 })()}
 </div>

 {/* المكافآت والخصائص */}
 <div className="mb-6">
 <h3 className="text-base font-bold text-gray-700 dark:text-white mb-3 flex items-center gap-2">
 
 {locale === 'ar' ? 'المكافآت والخصائص' : 'Rewards & Features'}
 </h3>
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
 {settings.pointsEnabled && (
 <div className={`bg-white dark:bg-gray-800 rounded-xl shadow p-4 border-s-4 border-primary-500`}>
 <div className="flex items-center justify-between mb-2">
 <p className="text-xs text-gray-600 dark:text-white font-semibold">{t('memberDetails.points')}</p>
 
 </div>
 <p className="text-3xl font-bold text-primary-600 dark:text-primary-400 mb-3">{member.points ?? 0}</p>
 <div className="flex gap-1">
 <button
 onClick={handleShowPointsHistory}
 className="flex-1 bg-primary-600 hover:bg-primary-700 text-primary-contrast text-xs py-1.5 rounded transition-colors"
 title={t('memberDetails.viewPointsHistory')}
 >
 
 </button>
 <button
 onClick={() => setShowAddPointsModal(true)}
 className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-xs py-1.5 rounded transition-colors"
 title={t('memberDetails.addRemovePoints')}
 >
 
 </button>
 </div>
 </div>
 )}

 <div className={`bg-white dark:bg-gray-800 rounded-xl shadow p-4 border-s-4 border-primary-500`}>
 <div className="flex items-center justify-between mb-2">
 <p className="text-xs text-gray-600 dark:text-white font-semibold">{t('memberDetails.invitations')}</p>

 </div>
 <p className="text-3xl font-bold text-primary-600 mb-1">{member.invitations ?? 0}</p>
 {(() => {
 const remaining = member.invitations ?? 0
 //  إجمالي الدعوات من الباقة (الأصح). لو مفيش باقة، نرجع لعدد المستخدَم + المتبقّي.
 const pkgInv = Number((member as any).offerBenefits?.invitations) || 0
 const totalInv = pkgInv > 0 ? Math.max(pkgInv, remaining) : (invitationHistory.length + remaining)
 const usedInv = Math.max(0, totalInv - remaining)
 return (
 <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
 {locale === 'ar' ? 'استخدم' : 'Used'} {usedInv} {locale === 'ar' ? 'من' : 'of'} {totalInv}
 </p>
 )
 })()}
 <button
 onClick={handleUseInvitation}
 disabled={(member.invitations ?? 0) <= 0 || loading}
 className="w-full bg-primary-600 text-primary-contrast text-xs py-1.5 rounded hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
 >
 {t('memberDetails.useInvitation')}
 </button>
 </div>

 {/* حصص الدخول المتبقية — تظهر بس لو الباقة محدودة الدخلات (remainingCheckIns != null) */}
 {(member as any).remainingCheckIns !== null && (member as any).remainingCheckIns !== undefined && (() => {
 const remainingCI = Number((member as any).remainingCheckIns) || 0
 const totalCI = Number((member as any).offerBenefits?.maxCheckIns) || 0
 const usedCI = totalCI > 0 ? Math.max(0, totalCI - remainingCI) : 0
 return (
 <div className={`bg-white dark:bg-gray-800 rounded-xl shadow p-4 border-s-4 border-orange-500`}>
 <div className="flex items-center justify-between mb-2">
 <p className="text-xs text-gray-600 dark:text-white font-semibold">{locale === 'ar' ? 'حصص الدخول المتبقية' : 'Remaining Check-ins'}</p>
 </div>
 <p className={`text-3xl font-bold mb-3 ${remainingCI <= 0 ? 'text-red-600' : 'text-orange-600'}`}>
 {remainingCI}{totalCI > 0 && <span className="text-lg text-gray-400 dark:text-gray-500"> / {totalCI}</span>}
 </p>
 <p className="text-[11px] text-gray-500 dark:text-gray-400">
 {totalCI > 0
 ? (locale === 'ar' ? `استخدم ${usedCI} من ${totalCI} دخلة` : `Used ${usedCI} of ${totalCI} entries`)
 : (locale === 'ar' ? 'دخلة متبقية في الباقة' : 'entries left in package')}
 </p>
 </div>
 )
 })()}
 </div>
 </div>

 {/* الجلسات المجانية */}
 <div className="mb-6">
 <h3 className="text-base font-bold text-gray-700 dark:text-white mb-3 flex items-center gap-2">
 
 {locale === 'ar' ? 'الجلسات المجانية' : 'Free Sessions'}
 </h3>
 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
 {settings.inBodyEnabled && (
 <div className={`bg-white dark:bg-gray-800 rounded-xl shadow p-4 border-s-4 border-green-500`}>
 <div className="flex items-center justify-between mb-2">
 <p className="text-xs text-gray-600 dark:text-white font-semibold">{t('memberDetails.inBody')}</p>
 
 </div>
 <p className="text-3xl font-bold text-green-600 mb-1">{member.inBodyScans ?? 0}</p>
 {(() => {
 const total = Number((member as any).offerBenefits?.inBodyScans) || 0
 const remaining = member.inBodyScans ?? 0
 //  نعرض السطر بس لو الرقم منطقي (الباقة بتمنح انبودي والمتبقي مش أكبر من الممنوح)
 if (total <= 0 || remaining > total) return null
 const used = total - remaining
 return (
 <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
 {locale === 'ar' ? 'استخدم' : 'Used'} {used} {locale === 'ar' ? 'من' : 'of'} {total}
 </p>
 )
 })()}
 <button
 onClick={handleUseInBody}
 disabled={(member.inBodyScans ?? 0) <= 0 || loading}
 className="w-full bg-green-600 text-white text-xs py-1.5 rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
 >
 {t('memberDetails.useSession')}
 </button>
 </div>
 )}

 <div className={`bg-white dark:bg-gray-800 rounded-xl shadow p-4 border-s-4 border-orange-500`}>
 <div className="flex items-center justify-between mb-2">
 <p className="text-xs text-gray-600 dark:text-white font-semibold">{t('memberDetails.freePTSessions')}</p>
 
 </div>
 <p className="text-3xl font-bold text-orange-600 mb-1">{member.freePTSessions ?? 0}</p>
 <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">
 {locale === 'ar' ? 'استخدم' : 'Used'} {member.freePTSessionsUsed ?? 0} {locale === 'ar' ? 'من' : 'of'} {(member.freePTSessionsUsed ?? 0) + (member.freePTSessions ?? 0)}
 </p>
 {paidSessionCounts.pt > 0 && (
 <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold mb-2">
 + {paidSessionCounts.pt} {locale === 'ar' ? 'مدفوعة' : 'paid'}
 </p>
 )}
 <div className="flex gap-1 mt-2">
 <button
 onClick={handleUseFreePT}
 disabled={(member.freePTSessions ?? 0) <= 0 || loading}
 className="flex-1 bg-orange-600 text-white text-xs py-1.5 rounded hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
 >
 {locale === 'ar' ? 'مجاني' : 'Free'}
 </button>
 {paidSessionCounts.pt > 0 && (
 <button
 onClick={handleUsePaidPT}
 disabled={loading}
 className="flex-1 bg-orange-400 text-white text-xs py-1.5 rounded hover:bg-orange-500"
 >
 {locale === 'ar' ? 'مدفوع' : 'Paid'}
 </button>
 )}
 </div>
 </div>

 {settings.nutritionEnabled && (
 <div className={`bg-white dark:bg-gray-800 rounded-xl shadow p-4 border-s-4 border-lime-500`}>
 <div className="flex items-center justify-between mb-2">
 <p className="text-xs text-gray-600 dark:text-white font-semibold">{t('memberDetails.nutritionSessions')}</p>
 
 </div>
 <p className="text-3xl font-bold text-lime-600 dark:text-lime-400 mb-1">{member.freeNutritionSessions ?? 0}</p>
 {paidSessionCounts.nutrition > 0 && (
 <p className="text-xs text-lime-600 dark:text-lime-400 font-semibold mb-2">
 + {paidSessionCounts.nutrition} {locale === 'ar' ? 'مدفوعة' : 'paid'}
 </p>
 )}
 <div className="flex gap-1 mt-2">
 <button
 onClick={handleUseFreeNutrition}
 disabled={(member.freeNutritionSessions ?? 0) <= 0 || loading}
 className="flex-1 bg-lime-600 text-white text-xs py-1.5 rounded hover:bg-lime-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
 >
 {locale === 'ar' ? 'مجاني' : 'Free'}
 </button>
 {paidSessionCounts.nutrition > 0 && (
 <button
 onClick={handleUsePaidNutrition}
 disabled={loading}
 className="flex-1 bg-lime-400 text-white text-xs py-1.5 rounded hover:bg-lime-500"
 >
 {locale === 'ar' ? 'مدفوع' : 'Paid'}
 </button>
 )}
 </div>
 </div>
 )}

 {settings.physiotherapyEnabled && (
 <div className={`bg-white dark:bg-gray-800 rounded-xl shadow p-4 border-s-4 border-blue-500`}>
 <div className="flex items-center justify-between mb-2">
 <p className="text-xs text-gray-600 dark:text-white font-semibold">{t('memberDetails.physioSessions')}</p>
 
 </div>
 <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">{member.freePhysioSessions ?? 0}</p>
 {paidSessionCounts.physio > 0 && (
 <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-2">
 + {paidSessionCounts.physio} {locale === 'ar' ? 'مدفوعة' : 'paid'}
 </p>
 )}
 <div className="flex gap-1 mt-2">
 <button
 onClick={handleUseFreePhysio}
 disabled={(member.freePhysioSessions ?? 0) <= 0 || loading}
 className="flex-1 bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
 >
 {locale === 'ar' ? 'مجاني' : 'Free'}
 </button>
 {paidSessionCounts.physio > 0 && (
 <button
 onClick={handleUsePaidPhysio}
 disabled={loading}
 className="flex-1 bg-blue-400 text-white text-xs py-1.5 rounded hover:bg-blue-500"
 >
 {locale === 'ar' ? 'مدفوع' : 'Paid'}
 </button>
 )}
 </div>
 </div>
 )}

 {settings.groupClassEnabled && (
 <div className={`bg-white dark:bg-gray-800 rounded-xl shadow p-4 border-s-4 border-fuchsia-500`}>
 <div className="flex items-center justify-between mb-2">
 <p className="text-xs text-gray-600 dark:text-white font-semibold">{t('memberDetails.groupClassSessions')}</p>
 
 </div>
 <p className="text-3xl font-bold text-fuchsia-600 dark:text-fuchsia-400 mb-1">{member.freeGroupClassSessions ?? 0}</p>
 {paidSessionCounts.groupClass > 0 && (
 <p className="text-xs text-fuchsia-600 dark:text-fuchsia-400 font-semibold mb-2">
 + {paidSessionCounts.groupClass} {locale === 'ar' ? 'مدفوعة' : 'paid'}
 </p>
 )}
 <div className="flex gap-1 mt-2">
 <button
 onClick={handleUseFreeGroupClass}
 disabled={(member.freeGroupClassSessions ?? 0) <= 0 || loading}
 className="flex-1 bg-fuchsia-600 text-white text-xs py-1.5 rounded hover:bg-fuchsia-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
 >
 {locale === 'ar' ? 'مجاني' : 'Free'}
 </button>
 {paidSessionCounts.groupClass > 0 && (
 <button
 onClick={handleUsePaidGroupClass}
 disabled={loading}
 className="flex-1 bg-fuchsia-400 text-white text-xs py-1.5 rounded hover:bg-fuchsia-500"
 >
 {locale === 'ar' ? 'مدفوع' : 'Paid'}
 </button>
 )}
 </div>
 </div>
 )}

 {settings.poolEnabled && (
 <div className={`bg-white dark:bg-gray-800 rounded-xl shadow p-4 border-s-4 border-teal-500`}>
 <div className="flex items-center justify-between mb-2">
 <p className="text-xs text-gray-600 dark:text-white font-semibold">{t('memberDetails.poolSessions')}</p>
 
 </div>
 <p className="text-3xl font-bold text-teal-600 dark:text-teal-400 mb-3">{member.freePoolSessions ?? 0}</p>
 <button
 onClick={handleUsePool}
 disabled={(member.freePoolSessions ?? 0) <= 0 || loading}
 className="w-full bg-teal-600 text-white text-xs py-1.5 rounded hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
 >
 {t('memberDetails.useSession')}
 </button>
 </div>
 )}

 {settings.padelEnabled && (
 <div className={`bg-white dark:bg-gray-800 rounded-xl shadow p-4 border-s-4 border-amber-500`}>
 <div className="flex items-center justify-between mb-2">
 <p className="text-xs text-gray-600 dark:text-white font-semibold">{t('memberDetails.padelSessions')}</p>
 
 </div>
 <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mb-3">{member.freePadelSessions ?? 0}</p>
 <button
 onClick={handleUsePadel}
 disabled={(member.freePadelSessions ?? 0) <= 0 || loading}
 className="w-full bg-amber-600 text-white text-xs py-1.5 rounded hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
 >
 {t('memberDetails.useSession')}
 </button>
 </div>
 )}

 {settings.assessmentEnabled && (
 <div className={`bg-white dark:bg-gray-800 rounded-xl shadow p-4 border-s-4 border-indigo-500`}>
 <div className="flex items-center justify-between mb-2">
 <p className="text-xs text-gray-600 dark:text-white font-semibold">{t('memberDetails.assessmentSessions')}</p>
 
 </div>
 <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-3">{member.freeAssessmentSessions ?? 0}</p>
 <button
 onClick={handleUseAssessment}
 disabled={(member.freeAssessmentSessions ?? 0) <= 0 || loading}
 className="w-full bg-indigo-600 text-white text-xs py-1.5 rounded hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
 >
 {t('memberDetails.useSession')}
 </button>
 </div>
 )}

 <div className={`bg-white dark:bg-gray-800 rounded-xl shadow p-4 border-s-4 ${member.isFrozen ? 'border-orange-500' : 'border-cyan-500'}`}>
 <div className="flex items-center justify-between mb-2">
 <p className="text-xs text-gray-600 dark:text-white font-semibold">{t('memberDetails.freezeDays')}</p>
 <span className="text-2xl">{member.isFrozen ? '' : ''}</span>
 </div>
 <p className="text-3xl font-bold text-cyan-600 mb-1">{member.remainingFreezeDays ?? 0}</p>
 {(() => {
 const remaining = member.remainingFreezeDays ?? 0
 //  إجمالي الفريز من الباقة (الأصح). لو مفيش باقة، نرجع لمجموع سجل الفريز + المتبقي.
 const pkgFreeze = Number((member as any).offerBenefits?.freezeDays) || 0
 const historyUsed = freezeHistory.reduce((s: number, f: any) => s + (Number(f?.days) || 0), 0)
 const totalFreeze = pkgFreeze > 0 ? Math.max(pkgFreeze, remaining) : (historyUsed + remaining)
 const usedFreezeDays = Math.max(0, totalFreeze - remaining)
 return (
 <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
 {locale === 'ar' ? 'خد' : 'Used'} {usedFreezeDays} {locale === 'ar' ? 'يوم من' : 'days of'} {totalFreeze}
 </p>
 )
 })()}
 {member.isFrozen ? (
 <button
 onClick={handleUnfreeze}
 disabled={loading}
 className="w-full bg-orange-600 text-white text-xs py-1.5 rounded hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold"
 >
 {loading ? (locale === 'ar' ? '...' : '...') : (locale === 'ar' ? 'فك التجميد' : 'Unfreeze')}
 </button>
 ) : (
 <div className="grid grid-cols-2 gap-1.5">
 <button
 onClick={() => setActiveModal('freeze')}
 disabled={!member.expiryDate || loading || (member.remainingFreezeDays ?? 0) <= 0}
 className="bg-cyan-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-cyan-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
 >
 {locale === 'ar' ? 'تجميد' : 'Freeze'}
 </button>
 <button
 onClick={openBackFreeze}
 disabled={!member.expiryDate || loading || (member.remainingFreezeDays ?? 0) <= 0}
 title={locale === 'ar' ? 'تجميد بأثر رجعي لفترة غياب الميمبر' : 'Retroactive freeze for absence'}
 className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-700 text-xs font-bold py-2 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
 >
 {locale === 'ar' ? 'باك فريز' : 'Back Freeze'}
 </button>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* PT Subscription Card */}
 {ptSubscription && (
 <div className="bg-gradient-to-br from-teal-500 to-cyan-600 text-white rounded-xl shadow-2xl p-6 mb-6 ring-1 ring-teal-300">
 <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
 <div className="bg-white/90 dark:bg-gray-800/20 p-3 rounded-full w-fit">
 <svg className="w-8 h-8 text-teal-700 dark:text-teal-300" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l2-2m12 12l-2 2M4 8l4 4m8 4l4-4M8 16l4-4 4 4M4 16l4-4M16 8l4 4"/></svg>
 </div>
 <div className="flex-1">
 <h3 className="text-2xl font-bold">اشتراك التدريب الشخصي (PT)</h3>
 <p className="text-sm opacity-90">معلومات مبسطة عن اشتراك PT</p>
 </div>
 <div className="bg-green-500 px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 w-fit">
 
 <span>نشط</span>
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-4">
 <div className="bg-white/10 dark:bg-gray-800/20 rounded-lg p-3 md:p-4 backdrop-blur-sm hover:bg-white/20 dark:hover:bg-gray-700/40 transition">
 <p className="text-xs opacity-80 mb-1">رقم PT</p>
 <p className="text-xl md:text-2xl font-bold">#{ptSubscription.ptNumber}</p>
 </div>

 <div className="bg-white/10 dark:bg-gray-800/20 rounded-lg p-3 md:p-4 backdrop-blur-sm hover:bg-white/20 dark:hover:bg-gray-700/40 transition">
 <p className="text-xs opacity-80 mb-1">الكوتش</p>
 <p className="text-base md:text-lg font-bold truncate">{ptSubscription.coachName}</p>
 </div>

 <div className="bg-white/10 dark:bg-gray-800/20 rounded-lg p-3 md:p-4 backdrop-blur-sm hover:bg-white/20 dark:hover:bg-gray-700/40 transition">
 <p className="text-xs opacity-80 mb-1">الجلسات المتبقية</p>
 <p className="text-xl md:text-2xl font-bold text-yellow-300">
 {ptSubscription.sessionsRemaining} / {ptSubscription.sessionsPurchased}
 </p>
 </div>

 <div className="bg-white/10 dark:bg-gray-800/20 rounded-lg p-3 md:p-4 backdrop-blur-sm hover:bg-white/20 dark:hover:bg-gray-700/40 transition">
 <p className="text-xs opacity-80 mb-1">المبلغ المتبقي</p>
 <p className="text-xl md:text-2xl font-bold text-yellow-300">
 {ptSubscription.remainingAmount} ج.م
 </p>
 </div>
 </div>

 {ptSubscription.expiryDate && (
 <div className="mt-4 bg-white/10 dark:bg-gray-800/20 rounded-lg p-3 backdrop-blur-sm hover:bg-white/20 dark:hover:bg-gray-700/40 transition">
 <div className="flex items-center justify-between flex-wrap gap-2">
 <span className="text-sm opacity-90">تاريخ الانتهاء</span>
 <span className="font-bold">{new Date(ptSubscription.expiryDate).toLocaleDateString('ar-EG')}</span>
 </div>
 </div>
 )}

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
 {hasPermission('canEditPT') && (
 <button
 onClick={openPTEdit}
 className="bg-white/20 dark:bg-gray-800/30 text-white py-3 rounded-lg hover:bg-white/30 dark:hover:bg-gray-700/50 font-bold flex items-center justify-center gap-2 transition-colors duration-200 active:scale-95 ring-1 ring-white/40"
 >
 <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"/></svg>
 <span>{locale === 'ar' ? 'تعديل الـ PT / الكوتش' : 'Edit PT / Coach'}</span>
 </button>
 )}
 <button
 onClick={() => router.push('/pt')}
 className="bg-white dark:bg-gray-700 text-teal-600 dark:text-teal-400 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 font-bold flex items-center justify-center gap-2 transition-colors duration-200 active:scale-95"
 >
 <span>عرض تفاصيل PT الكاملة</span>
 </button>
 </div>
 </div>
 )}


 {/* Payment & Edit Section */}
 <div className={`grid grid-cols-1 ${settings.remainingEnabled && member.remainingAmount > 0 ? 'md:grid-cols-2' : ''} gap-6 mb-6`}>
 {/* Payment Card - Only show if there's remaining amount and remainingEnabled */}
 {settings.remainingEnabled && member.remainingAmount > 0 && (
 <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
 <div className="flex items-center gap-3 mb-4">
 <div className="bg-green-100 p-3 rounded-full">
 
 </div>
 <div>
 <h3 className="text-xl font-bold">{t('memberDetails.paymentModal.title')}</h3>
 <p className="text-sm text-gray-600 dark:text-white">{t('memberDetails.paymentModal.remainingLabel', { amount: member.remainingAmount.toString() })}</p>
 </div>
 </div>
 <button
 onClick={() => setActiveModal('payment')}
 disabled={loading}
 className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold"
 >
 {t('memberDetails.paymentModal.payButton')}
 </button>
 </div>
 )}
 </div>

 {/* إجراءات العضوية */}
 <div className="mb-6">
 <h3 className="text-base font-bold text-gray-700 dark:text-white mb-3 flex items-center gap-2">
 
 {locale === 'ar' ? 'إجراءات العضوية' : 'Membership Actions'}
 </h3>
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
 {/*  متابعة سريعة — تشتغل على أي عضو (نشط/منتهي/قارب على الانتهاء) */}
 {hasPermission('canCreateFollowUp') && (
 <div className={`bg-white dark:bg-gray-800 rounded-xl shadow p-4 border-s-4 border-purple-500`}>
 <div className="flex items-center justify-between mb-2">
 <p className="text-xs text-gray-600 dark:text-white font-semibold truncate">
 {locale === 'ar' ? 'متابعة سريعة' : 'Quick Follow-up'}
 </p>
 </div>
 <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2 min-h-[2rem]">
 {locale === 'ar' ? 'سجّل متابعة فورية على العضو ده' : 'Add a quick follow-up for this member'}
 </p>
 <button
 onClick={() => setShowQuickFollowUp(true)}
 disabled={loading}
 className="w-full bg-purple-600 text-white text-xs py-1.5 rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold"
 >
 {locale === 'ar' ? '+ إضافة متابعة' : '+ Add Follow-up'}
 </button>
 </div>
 )}

 {/* Renewal */}
 {hasPermission('canCreateMembers') && (
 <div className={`bg-white dark:bg-gray-800 rounded-xl shadow p-4 border-s-4 border-green-500`}>
 <div className="flex items-center justify-between mb-2">
 <p className="text-xs text-gray-600 dark:text-white font-semibold truncate">{t('renewall.title')}</p>
 
 </div>
 <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2 min-h-[2rem]">{t('renewall.subtitle')}</p>
 {member?.isBanned ? (
 <div className="w-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs py-1.5 rounded text-center font-bold">
 {locale === 'ar' ? 'محظور' : 'Banned'}
 </div>
 ) : (
 <button
 onClick={() => setShowRenewalForm(true)}
 disabled={loading}
 className="w-full bg-green-600 text-white text-xs py-1.5 rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold"
 >
 {locale === 'ar' ? 'تجديد' : 'Renew'}
 </button>
 )}
 </div>
 )}

 {/* Upgrade */}
 {hasPermission('canCreateMembers') && member?.startDate && (
 <div className={`bg-white dark:bg-gray-800 rounded-xl shadow p-4 border-s-4 border-orange-500`}>
 <div className="flex items-center justify-between mb-2">
 <p className="text-xs text-gray-600 dark:text-white font-semibold truncate">{t('upgrade.upgradePackage')}</p>
 
 </div>
 <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2 min-h-[2rem]">{t('upgrade.upgradeDescription')}</p>
 {member?.expiryDate && new Date(member.expiryDate) < new Date() && (
 <p className="text-[10px] text-red-600 dark:text-red-400 font-medium mb-2">
 {locale === 'ar' ? 'منتهي — سعر كامل' : 'Expired — full price'}
 </p>
 )}
 {member?.isBanned ? (
 <div className="w-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs py-1.5 rounded text-center font-bold">
 {locale === 'ar' ? 'محظور' : 'Banned'}
 </div>
 ) : (
 <button
 onClick={() => setShowUpgradeForm(true)}
 disabled={loading}
 className="w-full bg-orange-600 text-white text-xs py-1.5 rounded hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold"
 >
 {locale === 'ar' ? 'ترقية' : 'Upgrade'}
 </button>
 )}
 </div>
 )}

 {/* Transfer membership */}
 {hasPermission('canCreateMembers') && (
 <div className={`bg-white dark:bg-gray-800 rounded-xl shadow p-4 border-s-4 border-purple-500`}>
 <div className="flex items-center justify-between mb-2">
 <p className="text-xs text-gray-600 dark:text-white font-semibold truncate">
 {locale === 'ar' ? 'نقل عضوية' : 'Transfer'}
 </p>
 
 </div>
 {(() => {
 const remaining = calculateRemainingDays(member?.expiryDate as any) ?? 0
 return (
 <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2 min-h-[2rem]">
 {remaining > 0
 ? (locale === 'ar' ? `${remaining} يوم متبقي — نقل لعضو تاني` : `${remaining} days left — transfer to another ID`)
 : (locale === 'ar' ? 'الاشتراك منتهي — لا يوجد أيام للنقل' : 'Expired — no days to transfer')}
 </p>
 )
 })()}
 {member?.isBanned ? (
 <div className="w-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs py-1.5 rounded text-center font-bold">
 {locale === 'ar' ? 'محظور' : 'Banned'}
 </div>
 ) : (() => {
 const remaining = calculateRemainingDays(member?.expiryDate as any) ?? 0
 const disabled = loading || remaining <= 0
 return (
 <button
 onClick={() => setShowTransferForm(true)}
 disabled={disabled}
 className="w-full bg-purple-600 text-white text-xs py-1.5 rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold"
 >
 {locale === 'ar' ? 'نقل' : 'Transfer'}
 </button>
 )
 })()}
 </div>
 )}

 {/* Ban */}
 {hasPermission('canManageBannedMembers') && (
 <div className={`bg-white dark:bg-gray-800 rounded-xl shadow p-4 border-s-4 border-gray-700`}>
 <div className="flex items-center justify-between mb-2">
 <p className="text-xs text-gray-600 dark:text-white font-semibold truncate">{locale === 'ar' ? 'حظر العضو' : 'Ban Member'}</p>
 
 </div>
 <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2 min-h-[2rem]">{locale === 'ar' ? 'إضافة لقائمة المحظورين' : 'Add to banned list'}</p>
 <button
 onClick={handleBan}
 disabled={loading}
 className="w-full bg-gray-700 hover:bg-gray-800 text-white text-xs py-1.5 rounded disabled:opacity-50 disabled:cursor-not-allowed font-bold"
 >
 {locale === 'ar' ? 'حظر' : 'Ban'}
 </button>
 </div>
 )}

 {/* Delete */}
 <div className={`bg-white dark:bg-gray-800 rounded-xl shadow p-4 border-s-4 border-red-500`}>
 <div className="flex items-center justify-between mb-2">
 <p className="text-xs text-gray-600 dark:text-white font-semibold truncate">{t('memberDetails.deleteModal.title')}</p>
 
 </div>
 <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2 min-h-[2rem]">{t('memberDetails.deleteModal.subtitle')}</p>
 <button
 onClick={handleDelete}
 disabled={loading}
 className="w-full bg-red-600 text-white text-xs py-1.5 rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold"
 >
 {locale === 'ar' ? 'حذف' : 'Delete'}
 </button>
 </div>
 </div>
 </div>

 {/* Confirmation Modal */}
 {confirmModal && confirmModal.show && (
 <div
 className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in flex items-center justify-center p-4"
 style={{ zIndex: 9999 }}
 >
 <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6" dir={direction}>
 <div className="text-center mb-6">
 <h3 className="text-2xl font-bold mb-3">{confirmModal.title}</h3>
 <p className="text-gray-600 dark:text-white text-lg">{confirmModal.message}</p>
 </div>

 <div className="flex gap-3">
 <button
 type="button"
 onClick={() => {
 confirmModal.onConfirm()
 }}
 className="flex-1 bg-primary-600 text-primary-contrast py-3 rounded-lg hover:bg-primary-700 font-bold"
 >
 {t('memberDetails.confirmModal.yes')}
 </button>
 <button
 type="button"
 onClick={() => setConfirmModal(null)}
 className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold"
 >
  {t('memberDetails.confirmModal.cancel')}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Modal: دفع المبلغ */}
 {activeModal === 'payment' && (
 <div 
 className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in flex items-center justify-center p-4"
 style={{ zIndex: 9999 }}
 onClick={(e) => {
 if (e.target === e.currentTarget) setActiveModal(null)
 }}
 >
 <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
 <div className="flex justify-between items-center mb-6">
 <h3 className="text-2xl font-bold">{t('memberDetails.paymentModal.title')}</h3>
 <button
 onClick={() => setActiveModal(null)}
 className="text-gray-400 dark:text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:text-white text-3xl leading-none"
 type="button"
 >
 ×
 </button>
 </div>

 <div className={`bg-yellow-50 border-s-4 border-yellow-500 p-4 rounded-lg mb-6 dark:bg-yellow-900/20 dark:border-yellow-700`}>
 <p className="font-bold text-yellow-800">
 {t('memberDetails.paymentModal.remainingLabel', { amount: member.remainingAmount.toString() })}
 </p>
 </div>

 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium mb-2 dark:text-white">
 {t('memberDetails.paymentModal.amountPaid')} <span className="text-red-600">*</span>
 </label>
 <input
 type="number"
 value={paymentData.amount || ''}
 onChange={(e) => setPaymentData({ ...paymentData, amount: parseInt(e.target.value) || 0 })}
 max={member.remainingAmount}
 className="w-full px-4 py-3 border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white text-xl focus:outline-none focus:border-primary-500"
 placeholder="0"
 autoFocus
 />
 </div>

 <div className="bg-gradient-to-br from-green-50 to-primary-50 dark:from-green-900/30 dark:to-primary-900/30 ring-1 ring-green-200 dark:ring-green-700/60 rounded-xl p-5 dark:border-gray-600 dark:bg-gray-700 dark:text-primary-contrast">
 <PaymentMethodSelector
 value={paymentData.paymentMethod}
 onChange={(method) => setPaymentData({ ...paymentData, paymentMethod: method })}
 required
 memberPoints={member.points || 0}
 pointsValueInEGP={settings.pointsValueInEGP}
 pointsEnabled={settings.pointsEnabled}
 />
 </div>

 <div>
 <label className="block text-sm font-medium mb-2 dark:text-white">{t('memberDetails.paymentModal.notes')}</label>
 <textarea
 value={paymentData.notes}
 onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
 className="w-full px-4 py-3 border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:border-primary-500"
 rows={3}
 placeholder={t('memberDetails.paymentModal.notesPlaceholder')}
 />
 </div>

 <div className="bg-green-50 dark:bg-green-900/30 ring-1 ring-green-300 dark:ring-green-700/60 rounded-lg p-4">
 <div className="flex justify-between text-lg">
 <span>{t('memberDetails.paymentModal.remainingAfterPayment')}:</span>
 <span className="font-bold text-green-600">
 {member.remainingAmount - paymentData.amount} {t('memberDetails.egp')}
 </span>
 </div>
 </div>

 <div className="flex gap-3">
 <button
 type="button"
 onClick={handlePayment}
 disabled={loading || paymentData.amount <= 0}
 className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-bold"
 >
 {loading ? t('memberDetails.paymentModal.processing') : `${t('memberDetails.paymentModal.confirmPayment')}`}
 </button>
 <button
 type="button"
 onClick={() => setActiveModal(null)}
 className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
 >
 {t('memberDetails.confirmModal.cancel')}
 </button>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Modal: تعديل البيانات الأساسية */}
 {/* مودال محدود: تعديل الاسم/الموبايل بس (canEditMemberBasic) */}
 {activeModal === 'edit-name-phone' && (
 <div
 className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in flex items-center justify-center p-4 overflow-y-auto"
 style={{ zIndex: 9999 }}
 onClick={(e) => { if (e.target === e.currentTarget) setActiveModal(null) }}
 >
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full p-5 my-4" onClick={(e) => e.stopPropagation()} dir={direction}>
 <div className="flex justify-between items-center mb-4 pb-2 border-b dark:border-gray-700">
 <h3 className="text-base font-bold dark:text-gray-100">{locale === 'ar' ? 'تعديل الاسم / الموبايل' : 'Edit name / phone'}</h3>
 <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="close">
 <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
 </button>
 </div>
 <div className="space-y-3">
 <div>
 <label className="block text-sm font-bold mb-1.5 dark:text-gray-100">{locale === 'ar' ? 'الاسم' : 'Name'}</label>
 <input
 type="text"
 value={editBasicInfoData.name}
 onChange={(e) => setEditBasicInfoData(prev => ({ ...prev, name: e.target.value }))}
 className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
 placeholder={locale === 'ar' ? 'اسم العضو' : 'Member name'}
 />
 </div>
 <div>
 <label className="block text-sm font-bold mb-1.5 dark:text-gray-100">{locale === 'ar' ? 'رقم الموبايل' : 'Phone'}</label>
 <input
 type="tel"
 value={editBasicInfoData.phone}
 onChange={(e) => setEditBasicInfoData(prev => ({ ...prev, phone: e.target.value }))}
 className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
 placeholder="010xxxxxxxx"
 />
 </div>
 </div>
 <div className="flex gap-2 mt-5">
 <button
 onClick={handleEditNamePhone}
 disabled={loading}
 className="flex-1 bg-primary-500 hover:bg-primary-600 text-primary-contrast py-2.5 rounded-lg font-bold transition-colors disabled:opacity-60"
 >
 {loading ? (locale === 'ar' ? 'جاري الحفظ...' : 'Saving...') : (locale === 'ar' ? 'حفظ' : 'Save')}
 </button>
 <button
 onClick={() => setActiveModal(null)}
 disabled={loading}
 className="px-5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-60"
 >
 {locale === 'ar' ? 'إلغاء' : 'Cancel'}
 </button>
 </div>
 </div>
 </div>
 )}

 {activeModal === 'edit-basic-info' && (
 <div
 className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in flex items-center justify-center p-4 overflow-y-auto"
 style={{ zIndex: 9999 }}
 onClick={(e) => {
 if (e.target === e.currentTarget) setActiveModal(null)
 }}
 >
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full p-4 my-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir={direction}>
 <div className="flex justify-between items-center mb-3 pb-2 border-b">
 <h3 className="text-base font-bold">{t('memberDetails.editModal.title')} {member.memberNumber !== null ? `#${member.memberNumber}` : 'Other'}</h3>
 <button
 onClick={() => setActiveModal(null)}
 className="text-gray-400 dark:text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:text-white text-2xl leading-none"
 type="button"
 >
 ×
 </button>
 </div>

 {/* تعديل الصورة */}
 <div className="mb-4">
 <ImageUpload
 currentImage={editBasicInfoData.profileImage}
 onImageChange={(imageUrl) => setEditBasicInfoData({ ...editBasicInfoData, profileImage: imageUrl })}
 disabled={loading}
 />
 </div>

 {/* تعديل صور البطاقة */}
 <div className="mb-4 grid grid-cols-2 gap-3">
 <div>
 <label className="block text-xs font-medium mb-1 text-center">وجه البطاقة</label>
 <ImageUpload
 currentImage={editBasicInfoData.idCardFront}
 onImageChange={(imageUrl) => setEditBasicInfoData({ ...editBasicInfoData, idCardFront: imageUrl })}
 disabled={loading}
 variant="idCard"
 />
 </div>
 <div>
 <label className="block text-xs font-medium mb-1 text-center">خلف البطاقة</label>
 <ImageUpload
 currentImage={editBasicInfoData.idCardBack}
 onImageChange={(imageUrl) => setEditBasicInfoData({ ...editBasicInfoData, idCardBack: imageUrl })}
 disabled={loading}
 variant="idCard"
 />
 </div>
 </div>

 <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
 <div>
 <label className="block text-xs font-medium mb-1">
 {t('memberDetails.editModal.fields.name')} *
 </label>
 <input
 type="text"
 value={editBasicInfoData.name}
 onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, name: e.target.value })}
 className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
 placeholder={t('memberDetails.editModal.fields.namePlaceholder')}
 />
 </div>

 <div>
 <label className="block text-xs font-medium mb-1">
 {t('memberDetails.editModal.fields.phone')} *
 </label>
 <input
 type="tel"
 value={editBasicInfoData.phone}
 onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, phone: e.target.value })}
 className="w-full px-2 py-1.5 border rounded text-sm font-mono dark:border-gray-600 dark:bg-gray-700 dark:text-white"
 placeholder={t('memberDetails.editModal.fields.phonePlaceholder')}
 dir="ltr"
 />
 </div>

 <div>
 <label className="block text-xs font-medium mb-1">
 {locale === 'ar' ? 'رقم العضوية' : 'Member Number'}
 </label>
 <input
 type="text"
 value={editBasicInfoData.memberNumber}
 onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, memberNumber: e.target.value })}
 className="w-full px-2 py-1.5 border rounded text-sm font-mono dark:border-gray-600 dark:bg-gray-700 dark:text-white"
 placeholder={locale === 'ar' ? 'مثال: 1313 أو اتركه فارغاً' : 'e.g., 1313 or leave empty'}
 dir="ltr"
 />
 </div>

 <div>
 <label className="block text-xs font-medium mb-1">
 {t('memberDetails.editModal.fields.subscriptionPrice')}
 </label>
 <input
 type="number"
 value={editBasicInfoData.subscriptionPrice || ''}
 onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, subscriptionPrice: parseInt(e.target.value) || 0 })}
 className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
 placeholder="0"
 min="0"
 />
 </div>

 <div>
 <label className="block text-xs font-medium mb-1">
 {t('memberDetails.editModal.fields.startDate')}
 </label>
 <input
 type="date"
 value={editBasicInfoData.startDate}
 onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, startDate: e.target.value })}
 className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
 />
 </div>

 {/* 🚻 الجنس — للجيم المكس فقط */}
 {settings.mixedGymEnabled && (
 <div>
 <label className="block text-xs font-medium mb-1">
 {direction === 'rtl' ? 'الجنس' : 'Gender'}
 </label>
 <select
 value={editBasicInfoData.gender}
 onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, gender: e.target.value })}
 className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
 >
 <option value="">{direction === 'rtl' ? '— غير محدد —' : '— Not set —'}</option>
 <option value="male">{direction === 'rtl' ? 'رجالي' : 'Male'}</option>
 <option value="female">{direction === 'rtl' ? 'سيدات' : 'Female'}</option>
 <option value="unknown">{direction === 'rtl' ? 'غير معروف' : 'Unknown'}</option>
 </select>
 </div>
 )}

 <div>
 <label className="block text-xs font-medium mb-1">
 {t('memberDetails.editModal.fields.expiryDate')}
 </label>
 <input
 type="date"
 value={editBasicInfoData.expiryDate}
 onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, expiryDate: e.target.value })}
 className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
 />
 </div>

 {/* Benefits Section */}
 <div className="col-span-2 md:col-span-3 border-t pt-3 mt-1">
 <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-white">البينفيتس والجلسات المجانية</h4>
 <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
 <div>
 <label className="block text-xs font-medium mb-1">
 {t('memberDetails.editModal.fields.inBodyScans')}
 </label>
 <input
 type="number"
 value={editBasicInfoData.inBodyScans || ''}
 onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, inBodyScans: parseInt(e.target.value) || 0 })}
 className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
 placeholder="0"
 min="0"
 />
 </div>

 <div>
 <label className="block text-xs font-medium mb-1">
 {t('memberDetails.editModal.fields.invitations')}
 </label>
 <input
 type="number"
 value={editBasicInfoData.invitations || ''}
 onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, invitations: parseInt(e.target.value) || 0 })}
 className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
 placeholder="0"
 min="0"
 />
 </div>

 <div>
 <label className="block text-xs font-medium mb-1">
 {t('memberDetails.editModal.fields.freePTSessions')}
 </label>
 <input
 type="number"
 value={editBasicInfoData.freePTSessions || ''}
 onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, freePTSessions: parseInt(e.target.value) || 0 })}
 className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
 placeholder="0"
 min="0"
 />
 </div>

 {settings.nutritionEnabled && (
 <div>
 <label className="block text-xs font-medium mb-1">
 جلسات تغذية مجانية
 </label>
 <input
 type="number"
 value={editBasicInfoData.freeNutritionSessions || ''}
 onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, freeNutritionSessions: parseInt(e.target.value) || 0 })}
 className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
 placeholder="0"
 min="0"
 />
 </div>
 )}

 <div>
 <label className="block text-xs font-medium mb-1">
 جلسات علاج طبيعي مجانية
 </label>
 <input
 type="number"
 value={editBasicInfoData.freePhysioSessions || ''}
 onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, freePhysioSessions: parseInt(e.target.value) || 0 })}
 className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
 placeholder="0"
 min="0"
 />
 </div>

 {settings.groupClassEnabled && (
 <div>
 <label className="block text-xs font-medium mb-1">
 جلسات كلاسات جماعية مجانية
 </label>
 <input
 type="number"
 value={editBasicInfoData.freeGroupClassSessions || ''}
 onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, freeGroupClassSessions: parseInt(e.target.value) || 0 })}
 className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
 placeholder="0"
 min="0"
 />
 </div>
 )}

 {settings.poolEnabled && (
 <div>
 <label className="block text-xs font-medium mb-1">
 جلسات حمام سباحة مجانية
 </label>
 <input
 type="number"
 value={editBasicInfoData.freePoolSessions || ''}
 onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, freePoolSessions: parseInt(e.target.value) || 0 })}
 className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
 placeholder="0"
 min="0"
 />
 </div>
 )}

 {settings.padelEnabled && (
 <div>
 <label className="block text-xs font-medium mb-1">
 جلسات بادل مجانية
 </label>
 <input
 type="number"
 value={editBasicInfoData.freePadelSessions || ''}
 onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, freePadelSessions: parseInt(e.target.value) || 0 })}
 className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
 placeholder="0"
 min="0"
 />
 </div>
 )}

 {settings.assessmentEnabled && (
 <div>
 <label className="block text-xs font-medium mb-1">
 جلسات تقييم مجانية
 </label>
 <input
 type="number"
 value={editBasicInfoData.freeAssessmentSessions || ''}
 onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, freeAssessmentSessions: parseInt(e.target.value) || 0 })}
 className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
 placeholder="0"
 min="0"
 />
 </div>
 )}

 <div>
 <label className="block text-xs font-medium mb-1">
 جلسات إضافية مجانية
 </label>
 <input
 type="number"
 value={editBasicInfoData.freeMoreSessions || ''}
 onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, freeMoreSessions: parseInt(e.target.value) || 0 })}
 className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
 placeholder="0"
 min="0"
 />
 </div>

 <div>
 <label className="block text-xs font-medium mb-1">
 أيام الفريز
 </label>
 <input
 type="number"
 value={editBasicInfoData.remainingFreezeDays || ''}
 onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, remainingFreezeDays: parseInt(e.target.value) || 0 })}
 className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
 placeholder="0"
 min="0"
 />
 </div>

 <div>
 <label className="block text-xs font-medium mb-1 text-orange-600 dark:text-orange-400">
 الباقي على العضو
 </label>
 <input
 type="number"
 value={editBasicInfoData.remainingAmount === 0 ? '' : editBasicInfoData.remainingAmount}
 onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, remainingAmount: parseInt(e.target.value) || 0 })}
 className="w-full px-2 py-1.5 ring-1 ring-orange-300 dark:ring-orange-600/60 rounded text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:border-orange-500"
 placeholder="0 (لا يوجد باقي)"
 min="0"
 />
 </div>

 {editBasicInfoData.remainingAmount > 0 && (
 <div>
 <label className="block text-xs font-medium mb-1 text-orange-600 dark:text-orange-400">
 موعد سداد الباقي
 </label>
 <input
 type="date"
 value={editBasicInfoData.remainingDueDate}
 onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, remainingDueDate: e.target.value })}
 className="w-full px-2 py-1.5 ring-1 ring-orange-300 dark:ring-orange-600/60 rounded text-sm dark:bg-gray-700 dark:text-white focus:outline-none focus:border-orange-500"
 />
 </div>
 )}
 </div>
 </div>

 {/* Coach Selector — يظهر دايماً بغض النظر عن إعداد PT Commission */}
 <div className="col-span-2 md:col-span-3 border-t pt-3 mt-1">
 <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-white">🏋️ الكوتش المسؤول</h4>
 <CoachSelector
 value={editBasicInfoData.coachId}
 onChange={(coachId) => setEditBasicInfoData({ ...editBasicInfoData, coachId })}
 required={false}
 />
 </div>

 {/* Sales Staff Selector */}
 <div className="col-span-2 md:col-span-3 border-t pt-3 mt-1">
 <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-white">{locale === 'ar' ? 'موظف السيلز' : 'Sales Staff'}</h4>
 <SalesStaffSelector
 value={editBasicInfoData.salesStaffId}
 onChange={(salesStaffId) => setEditBasicInfoData({ ...editBasicInfoData, salesStaffId })}
 requireConfirmIfChanging
 />
 </div>

 {/* ساعات الدخول المسموح بها */}
 <div className="col-span-2 md:col-span-3 border-t pt-3 mt-1">
 <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-white">
 {locale === 'ar' ? 'ساعات الدخول المسموح بها (اختياري)' : 'Allowed Check-in Hours (Optional)'}
 </h4>
 <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
 {locale === 'ar'
 ? 'لو حددت وقت، العضو مش هيقدر يعمل سكان خارج الفترة دي. سيبها فاضية عشان يدخل أي وقت.'
 : 'If set, member cannot check in outside these hours. Leave empty for no restriction.'}
 </p>
 <div className="grid grid-cols-2 gap-2">
 <div>
 <label className="block text-xs font-medium mb-1">
 {locale === 'ar' ? 'من' : 'From'}
 </label>
 <input
 type="time"
 value={editBasicInfoData.allowedCheckInStart}
 onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, allowedCheckInStart: e.target.value })}
 className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
 />
 </div>
 <div>
 <label className="block text-xs font-medium mb-1">
 {locale === 'ar' ? 'إلى' : 'To'}
 </label>
 <input
 type="time"
 value={editBasicInfoData.allowedCheckInEnd}
 onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, allowedCheckInEnd: e.target.value })}
 className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
 />
 </div>
 </div>
 {(editBasicInfoData.allowedCheckInStart || editBasicInfoData.allowedCheckInEnd) && (
 <button
 type="button"
 onClick={() => setEditBasicInfoData({
 ...editBasicInfoData,
 allowedCheckInStart: '',
 allowedCheckInEnd: ''
 })}
 className="mt-2 text-xs text-red-600 hover:underline"
 >
 {locale === 'ar' ? 'إلغاء التحديد' : 'Clear'}
 </button>
 )}
 </div>

 <div className="col-span-2 md:col-span-3">
 <label className="block text-xs font-medium mb-1">
 {t('memberDetails.editModal.fields.additionalNotes')}
 </label>
 <textarea
 value={editBasicInfoData.notes}
 onChange={(e) => setEditBasicInfoData({ ...editBasicInfoData, notes: e.target.value })}
 className="w-full px-2 py-1.5 border rounded text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
 placeholder={t('memberDetails.editModal.fields.notesPlaceholder')}
 rows={2}
 />
 </div>
 </div>

 <div className="flex gap-2 mt-4 pt-3 border-t">
 <button
 type="button"
 onClick={handleEditBasicInfo}
 disabled={loading || !editBasicInfoData.name.trim() || !editBasicInfoData.phone.trim()}
 className="flex-1 bg-primary-600 text-primary-contrast py-2 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 font-bold text-sm"
 >
 {loading ? t('memberDetails.editModal.buttons.saving') : `${t('memberDetails.editModal.buttons.save')}`}
 </button>
 <button
 type="button"
 onClick={() => setActiveModal(null)}
 className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold text-sm"
 >
 {t('memberDetails.editModal.buttons.cancel')}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Modal: إدخال تفاصيل الضيف (الدعوة) */}
 {activeModal === 'invitation' && (
 <div
 className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in flex items-center justify-center p-4"
 style={{ zIndex: 9999 }}
 onClick={(e) => {
 if (e.target === e.currentTarget) {
 setActiveModal(null)
 setInvitationData({ guestName: '', guestPhone: '', notes: '', salesStaffId: '' })
 }
 }}
 >
 <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()} dir={direction}>
 {/* Header — ثابت */}
 <div className="flex justify-between items-center px-5 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
 <div className="min-w-0">
 <h3 className="text-lg font-bold flex items-center gap-2">
 
 <span>{t('memberDetails.invitationModal.title')}</span>
 </h3>
 <p className="text-xs text-primary-700 dark:text-primary-300 mt-0.5 truncate">
 <strong>{member.name}</strong> (#{member.memberNumber ? member.memberNumber : '—'}) — {t('memberDetails.invitationModal.invitationsRemaining', { count: (member.invitations ?? 0).toString() })}
 </p>
 </div>
 <button
 onClick={() => {
 setActiveModal(null)
 setInvitationData({ guestName: '', guestPhone: '', notes: '', salesStaffId: '' })
 }}
 className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-3xl leading-none shrink-0 mr-2"
 type="button"
 >
 ×
 </button>
 </div>

 {/* Body — scrollable */}
 <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">
 {t('memberDetails.invitationModal.guestName')} <span className="text-red-600 dark:text-red-400">{t('memberDetails.invitationModal.required')}</span>
 </label>
 <input
 type="text"
 value={invitationData.guestName}
 onChange={(e) => setInvitationData({ ...invitationData, guestName: e.target.value })}
 className="w-full px-4 py-3 ring-1 ring-gray-300 dark:ring-gray-600/60 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:border-primary-500 dark:focus:border-primary-400"
 placeholder={t('memberDetails.invitationModal.guestNamePlaceholder')}
 autoFocus
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">
 {t('memberDetails.invitationModal.guestPhone')} <span className="text-red-600 dark:text-red-400">{t('memberDetails.invitationModal.required')}</span>
 </label>
 <input
 type="tel"
 value={invitationData.guestPhone}
 onChange={(e) => setInvitationData({ ...invitationData, guestPhone: e.target.value })}
 className="w-full px-4 py-3 ring-1 ring-gray-300 dark:ring-gray-600/60 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 font-mono"
 placeholder={t('memberDetails.invitationModal.guestPhonePlaceholder')}
 dir="ltr"
 />
 </div>

 {invitationSalesStaff.length > 0 && (() => {
 const memberSalesId = (member as any)?.salesStaffId
 const lockToMemberSales = !!memberSalesId && !canOverrideInvitationSales
 const memberSalesName = memberSalesId
 ? invitationSalesStaff.find(s => s.id === memberSalesId)?.name || '—'
 : null
 return (
 <div>
 <label className="block text-sm font-bold text-gray-700 dark:text-white mb-2">
 موظف السيلز المسؤول
 </label>
 {lockToMemberSales && (
 <div className="mb-2 bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 rounded-lg px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
 محجوز للسيلز المسؤول عن العضو: <strong>{memberSalesName}</strong>
 </div>
 )}
 <select
 value={lockToMemberSales ? memberSalesId : invitationData.salesStaffId}
 onChange={(e) => setInvitationData({ ...invitationData, salesStaffId: e.target.value })}
 disabled={lockToMemberSales}
 className={`w-full px-4 py-3 border rounded-lg focus:outline-none ${
 lockToMemberSales
 ? 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed'
 : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-primary-500 dark:focus:border-primary-400'
 }`}
 >
 <option value="">— بدون تعيين (تلقائي) —</option>
 {invitationSalesStaff.map(s => {
 const isLeast = s.id === [...invitationSalesStaff].sort((a, b) => a.leadsCount - b.leadsCount)[0]?.id
 return (
 <option key={s.id} value={s.id}>
 {s.name} ({s.leadsCount} ليد){isLeast ? ' مقترح' : ''}
 </option>
 )
 })}
 </select>
 </div>
 )
 })()}

 <div>
 <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">{t('memberDetails.invitationModal.notes')}</label>
 <textarea
 value={invitationData.notes}
 onChange={(e) => setInvitationData({ ...invitationData, notes: e.target.value })}
 className="w-full px-4 py-3 ring-1 ring-gray-300 dark:ring-gray-600/60 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:border-primary-500 dark:focus:border-primary-400"
 rows={3}
 placeholder={t('memberDetails.invitationModal.notesPlaceholder')}
 />
 </div>

 <div className="bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg px-3 py-2 text-xs text-green-800 dark:text-green-200">
 <p className="font-semibold mb-0.5">{t('memberDetails.invitationModal.actionsSummary')}</p>
 <p>{t('memberDetails.invitationModal.action1')}</p>
 <p>{t('memberDetails.invitationModal.action2')}</p>
 <p>{t('memberDetails.invitationModal.action3')}</p>
 </div>
 </div>

 {/* Footer — sticky buttons */}
 <div className="flex gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700 shrink-0">
 <button
 type="button"
 onClick={handleSubmitInvitation}
 disabled={loading || !invitationData.guestName.trim() || !invitationData.guestPhone.trim()}
 className="flex-1 bg-primary-600 text-primary-contrast py-2.5 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 font-bold text-sm"
 >
 {loading ? t('memberDetails.invitationModal.saving') : `${t('memberDetails.invitationModal.registerInvitation')}`}
 </button>
 <button
 type="button"
 onClick={() => {
 setActiveModal(null)
 setInvitationData({ guestName: '', guestPhone: '', notes: '', salesStaffId: '' })
 }}
 className="px-4 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white py-2.5 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold text-sm"
 >
 {t('memberDetails.invitationModal.cancel')}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Freeze Modal */}
 {activeModal === 'freeze' && member && (
 <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in flex items-center justify-center z-50 p-4">
 <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6" dir={direction}>
 <div className="flex justify-between items-center mb-6">
 <h3 className="text-2xl font-bold dark:text-white">{t('memberDetails.freezeModal.title')}</h3>
 <button
 onClick={() => setActiveModal(null)}
 className="text-gray-400 dark:text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:text-white text-3xl"
 >
 ×
 </button>
 </div>

 <div className={`bg-cyan-50 dark:bg-cyan-900/20 border-s-4 border-cyan-500 dark:border-cyan-700 p-4 rounded-lg mb-4`}>
 <p className="text-sm text-cyan-800 dark:text-cyan-300 mb-2">
 {t('memberDetails.freezeModal.availableFreezeDays')}: <strong className="text-xl">{member.remainingFreezeDays} {t('common.day')}</strong>
 </p>
 <p className="text-xs text-cyan-600 dark:text-cyan-400">{t('memberDetails.freezeModal.canUseInBatches')}</p>
 </div>

 <div className={`bg-primary-50 dark:bg-primary-900/20 border-s-4 border-primary-500 dark:border-primary-700 p-4 rounded-lg mb-6`}>
 <p className="text-sm text-primary-800 dark:text-primary-300 mb-2">
 {t('memberDetails.freezeModal.currentExpiryDate')}: <strong>{formatDateYMD(member.expiryDate)}</strong>
 </p>
 {daysRemaining !== null && (
 <p className="text-sm text-primary-800 dark:text-primary-300">
 {t('memberDetails.freezeModal.remainingDays')}: <strong>{daysRemaining > 0 ? daysRemaining : 0} {t('common.day')}</strong>
 </p>
 )}
 </div>

 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium mb-2 dark:text-white">
 {t('memberDetails.freezeModal.freezeDays')} <span className="text-red-600">*</span>
 </label>
 <input
 type="number"
 value={freezeData.days}
 onChange={(e) => setFreezeData({ ...freezeData, days: parseInt(e.target.value) || 0 })}
 min="1"
 max={member.remainingFreezeDays}
 className="w-full px-4 py-3 border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white text-xl"
 placeholder="0"
 />
 <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1">
 {t('memberDetails.freezeModal.canFreezeUpTo')} {member.remainingFreezeDays} {t('common.day')}
 </p>
 </div>

 {/* 🥋 خيار تجميد الـ PT كمان — يظهر لو العضو مشترك PT وخاصية فريز الـ PT مفعّلة */}
 {ptSubscription?.ptNumber && settings.ptFreezeEnabled && (
 <label className="flex items-center gap-3 p-3 rounded-lg bg-teal-50 dark:bg-teal-900/20 ring-1 ring-teal-200 dark:ring-teal-800 cursor-pointer">
 <input
 type="checkbox"
 checked={freezePTToo}
 onChange={(e) => setFreezePTToo(e.target.checked)}
 className="w-5 h-5 accent-teal-600"
 />
 <div>
 <p className="text-sm font-bold text-teal-800 dark:text-teal-300">
 {locale === 'ar' ? 'جمّد اشتراك الـ PT كمان' : 'Freeze the PT subscription too'}
 </p>
 <p className="text-xs text-teal-600 dark:text-teal-400">
 {locale === 'ar' ? `PT #${ptSubscription.ptNumber} — نفس عدد الأيام` : `PT #${ptSubscription.ptNumber} — same number of days`}
 </p>
 </div>
 </label>
 )}

 {freezeData.days > 0 && member.expiryDate && (
 <div className="bg-green-50 dark:bg-green-900/30 ring-1 ring-green-300 dark:ring-green-700/60 rounded-lg p-4">
 <p className="text-sm text-green-800 dark:text-green-300 mb-2">
 {t('memberDetails.freezeModal.newExpiryDate')}:
 </p>
 <p className="text-xl font-bold text-green-600 dark:text-green-400">
 {formatDateYMD(new Date(new Date(member.expiryDate).getTime() + freezeData.days * 24 * 60 * 60 * 1000))}
 </p>
 <div className="mt-3 pt-3 border-t border-green-300 dark:border-green-700">
 <p className="text-xs text-green-700 dark:text-green-400">
 {t('memberDetails.freezeModal.willFreeze')} {freezeData.days} {t('common.day')}
 </p>
 <p className="text-xs text-green-700 dark:text-green-400">
 {t('memberDetails.freezeModal.remainingBalance')}: {member.remainingFreezeDays - freezeData.days} {t('common.day')}
 </p>
 </div>
 </div>
 )}

 <div className="flex gap-3">
 <button
 onClick={handleFreeze}
 disabled={loading || freezeData.days <= 0 || freezeData.days > member.remainingFreezeDays}
 className="flex-1 bg-primary-600 text-primary-contrast py-3 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 font-bold"
 >
 {loading ? t('common.processing') : `${t('memberDetails.freezeModal.confirmFreeze')}`}
 </button>
 <button
 onClick={() => setActiveModal(null)}
 className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
 >
 {t('common.cancel')}
 </button>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Back Freeze Modal — تجميد بأثر رجعي لفترة الغياب */}
 {activeModal === 'backFreeze' && member && (
 <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setActiveModal(null) }}>
 <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6" dir={direction}>
 <div className="flex justify-between items-center mb-5">
 <div>
 <h3 className="text-2xl font-bold dark:text-white">{locale === 'ar' ? 'باك فريز' : 'Back Freeze'}</h3>
 <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{locale === 'ar' ? 'تجميد بأثر رجعي لفترة غياب الميمبر' : 'Retroactive freeze for the absence period'}</p>
 </div>
 <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-3xl">×</button>
 </div>

 {backFreezeData.loading ? (
 <div className="text-center py-10 text-gray-500 dark:text-gray-400">
 <div className="w-8 h-8 ring-1 ring-indigo-200 border-t-indigo-500 rounded-full animate-spin mx-auto mb-2" />
 {locale === 'ar' ? 'بنحسب فترة الغياب...' : 'Computing absence...'}
 </div>
 ) : (
 <div className="space-y-4">
 {/* آخر حضور */}
 <div className="bg-indigo-50 dark:bg-indigo-900/20 border-s-4 border-indigo-500 dark:border-indigo-700 p-4 rounded-lg">
 <p className="text-sm text-indigo-800 dark:text-indigo-300">
 {locale === 'ar' ? 'آخر حضور مسجّل' : 'Last check-in'}: <strong>{backFreezeData.lastCheckIn ? formatDateYMD(backFreezeData.lastCheckIn) : (locale === 'ar' ? 'مفيش حضور مسجّل' : 'No check-in recorded')}</strong>
 </p>
 <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
 {locale === 'ar' ? 'أيام الغياب اتحسبت من آخر حضور لغاية النهاردة — الفترة دي مفيهاش أي حضور.' : 'Absence computed from last check-in to today.'}
 </p>
 </div>

 {/* رصيد الفريز */}
 <div className="bg-cyan-50 dark:bg-cyan-900/20 border-s-4 border-cyan-500 dark:border-cyan-700 p-3 rounded-lg">
 <p className="text-sm text-cyan-800 dark:text-cyan-300">
 {locale === 'ar' ? 'رصيد الفريز المتاح' : 'Available freeze days'}: <strong className="text-lg">{member.remainingFreezeDays ?? 0}</strong>
 </p>
 </div>

 <div>
 <label className="block text-sm font-medium mb-2 dark:text-white">
 {locale === 'ar' ? 'عدد أيام الغياب' : 'Absence days'} <span className="text-red-600">*</span>
 </label>
 <input
 type="number"
 value={backFreezeData.days}
 onChange={(e) => setBackFreezeData({ ...backFreezeData, days: parseInt(e.target.value) || 0 })}
 min="1"
 max={member.remainingFreezeDays ?? 0}
 className="w-full px-4 py-3 border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white text-xl"
 placeholder="0"
 />
 <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
 {locale === 'ar' ? `الحد الأقصى ${member.remainingFreezeDays ?? 0} يوم (رصيد الفريز)` : `Max ${member.remainingFreezeDays ?? 0} days`}
 </p>
 </div>

 {backFreezeData.days > 0 && member.expiryDate && (
 <div className="bg-green-50 dark:bg-green-900/30 ring-1 ring-green-300 dark:ring-green-700/60 rounded-lg p-4">
 <p className="text-sm text-green-800 dark:text-green-300 mb-1">{locale === 'ar' ? 'تاريخ الانتهاء بعد الباك فريز' : 'New expiry after back freeze'}:</p>
 <p className="text-xl font-bold text-green-600 dark:text-green-400">
 {formatDateYMD(new Date(new Date(member.expiryDate).getTime() + backFreezeData.days * 24 * 60 * 60 * 1000))}
 </p>
 <p className="text-xs text-green-700 dark:text-green-400 mt-2">
 {locale === 'ar' ? `هيتمد ${backFreezeData.days} يوم · الرصيد بعدها: ${(member.remainingFreezeDays ?? 0) - backFreezeData.days} يوم` : `+${backFreezeData.days} days · balance after: ${(member.remainingFreezeDays ?? 0) - backFreezeData.days}`}
 </p>
 </div>
 )}

 <div className="flex gap-3 pt-1">
 <button
 onClick={handleBackFreeze}
 disabled={loading || backFreezeData.days <= 0 || backFreezeData.days > (member.remainingFreezeDays ?? 0)}
 className="flex-1 bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 font-bold"
 >
 {loading ? t('common.processing') : (locale === 'ar' ? 'تأكيد الباك فريز' : 'Confirm Back Freeze')}
 </button>
 <button onClick={() => setActiveModal(null)} className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
 {t('common.cancel')}
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 )}

 {/* Unfreeze Modal */}
 {activeModal === 'unfreeze' && member && (
 <div
 className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in flex items-center justify-center z-50 p-4"
 onClick={(e) => { if (e.target === e.currentTarget) setActiveModal(null) }}
 >
 <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6" dir={direction}>
 <div className="flex items-center gap-3 mb-5">
 <div className="bg-cyan-100 dark:bg-cyan-900/40 p-3 rounded-full">
 
 </div>
 <div>
 <h3 className="text-xl font-bold text-gray-800 dark:text-white">
 {locale === 'ar' ? 'فك تجميد الاشتراك' : 'Unfreeze Subscription'}
 </h3>
 <p className="text-sm text-gray-500 dark:text-gray-400">
 {member.name} {member.memberNumber !== null ? `- #${member.memberNumber}` : ''}
 </p>
 </div>
 </div>

 <div className={`bg-cyan-50 dark:bg-cyan-900/20 border-s-4 border-cyan-500 dark:border-cyan-700 p-4 rounded-lg mb-4`}>
 <p className="text-sm text-cyan-800 dark:text-cyan-300 leading-relaxed">
 {locale === 'ar'
 ? 'هل أنت متأكد من فك التجميد؟ الأيام اللي ما اتستخدمتش هترجع لرصيد الفريز تلقائياً.'
 : 'Are you sure you want to unfreeze? Unused days will be returned to the freeze balance automatically.'}
 </p>
 </div>

 {member.freezeRequests?.[0]?.endDate && (
 <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-3 mb-5 text-sm">
 {member.freezeRequests?.[0]?.startDate && (
 <p className="text-gray-600 dark:text-white mb-1">
 {locale === 'ar' ? 'التجميد يبدأ' : 'Freeze starts'}:{' '}
 <strong className="text-gray-800 dark:text-white">
 {new Date(member.freezeRequests[0].startDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
 </strong>
 </p>
 )}
 <p className="text-gray-600 dark:text-white">
 {locale === 'ar' ? 'التجميد ينتهي' : 'Freeze ends'}:{' '}
 <strong className="text-gray-800 dark:text-white">
 {new Date(member.freezeRequests[0].endDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
 </strong>
 </p>
 <p className="text-gray-600 dark:text-white mt-1">
 {locale === 'ar' ? 'رصيد الفريز الحالي' : 'Current freeze balance'}:{' '}
 <strong className="text-gray-800 dark:text-white">
 {member.remainingFreezeDays ?? 0} {t('common.day')}
 </strong>
 </p>
 </div>
 )}

 <div className="flex gap-3">
 <button
 onClick={confirmUnfreeze}
 disabled={loading}
 className="flex-1 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors"
 >
 {loading
 ? (locale === 'ar' ? 'جاري التنفيذ...' : 'Processing...')
 : `${locale === 'ar' ? 'تأكيد فك التجميد' : 'Confirm Unfreeze'}`}
 </button>
 <button
 onClick={() => setActiveModal(null)}
 disabled={loading}
 className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white py-3 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-40"
 >
 {t('common.cancel')}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Ban Modal */}
 {activeModal === 'ban' && member && (
 <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in flex items-center justify-center z-50 p-4" dir={direction}>
 <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
 <div className="flex items-center gap-3 mb-5">
 <div className="bg-gray-800 p-3 rounded-full">
 
 </div>
 <div>
 <h3 className="text-xl font-bold text-gray-800 dark:text-white">
 {locale === 'ar' ? 'حظر العضو' : 'Ban Member'}
 </h3>
 <p className="text-sm text-gray-500 dark:text-gray-400">{member.name} - {member.memberNumber !== null ? `#${member.memberNumber}` : 'Other'}</p>
 </div>
 </div>

 <div className="mb-5">
 <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">
 {locale === 'ar' ? 'سبب الحظر' : 'Ban Reason'} <span className="text-red-500">*</span>
 </label>
 <textarea
 value={banReason}
 onChange={e => setBanReason(e.target.value)}
 autoFocus
 rows={3}
 className="w-full px-4 py-3 border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:border-red-500 resize-none text-sm"
 placeholder={locale === 'ar' ? 'أدخل سبب الحظر...' : 'Enter ban reason...'}
 />
 </div>

 <div className="flex gap-3">
 <button
 onClick={handleConfirmBan}
 disabled={!banReason.trim() || loading}
 className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors"
 >
 {locale === 'ar' ? 'تأكيد الحظر' : 'Confirm Ban'}
 </button>
 <button
 onClick={() => setActiveModal(null)}
 className="px-6 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white rounded-xl font-medium transition-colors"
 >
 {locale === 'ar' ? 'إلغاء' : 'Cancel'}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Fitness Test Modals */}
 {activeModal === 'fitness-test-coach-select' && (
 <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in flex items-center justify-center z-50 p-4">
 <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
 <h3 className="text-2xl font-bold mb-4 text-center">اختيار المدرب</h3>
 <select
 value={selectedCoachId}
 onChange={(e) => setSelectedCoachId(e.target.value)}
 className="w-full px-4 py-3 border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white mb-4 text-lg"
 >
 <option value="">-- اختر المدرب --</option>
 {coaches.map(coach => (
 <option key={coach.id} value={coach.id}>{coach.name}</option>
 ))}
 </select>
 <div className="flex gap-3">
 <button
 onClick={async () => {
 if (selectedCoachId) {
 setLoading(true)
 try {
 const response = await fetch('/api/fitness-test-requests', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 memberId: memberId,
 coachId: selectedCoachId,
 }),
 })

 if (response.ok) {
 toast.success('تم إرسال الطلب للمدرب بنجاح!')
 setActiveModal(null)
 setSelectedCoachId('')
 } else {
 const result = await response.json()
 toast.error(result.error || 'فشل إرسال الطلب')
 }
 } catch (error) {
 console.error('Error:', error)
 toast.error('حدث خطأ في إرسال الطلب')
 } finally {
 setLoading(false)
 }
 }
 }}
 disabled={!selectedCoachId || loading}
 className="flex-1 bg-teal-600 text-white py-3 rounded-lg disabled:bg-gray-400"
 >
 {loading ? 'جاري الإرسال...' : 'إرسال الطلب'}
 </button>
 <button
 onClick={() => setActiveModal(null)}
 className="px-6 bg-gray-200 dark:bg-gray-700 py-3 rounded-lg"
 >
 إلغاء
 </button>
 </div>
 </div>
 </div>
 )}

 {activeModal === 'fitness-test-form' && (
 <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in flex items-center justify-center z-50 p-4">
 <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
 <div className="sticky top-0 bg-white dark:bg-gray-800 pb-4 border-b mb-6 z-10">
 <h3 className="text-2xl font-bold text-center">نموذج تقييم اللياقة</h3>
 </div>

 <div className="bg-primary-50 p-4 rounded-lg mb-6">
 <h4 className="font-bold mb-3 text-lg">معلومات العضو</h4>
 <div className="grid grid-cols-3 gap-4">
 <div>
 <p className="text-gray-600 dark:text-white text-sm">رقم العضوية</p>
 <p className="font-bold text-lg">{member?.memberNumber !== null ? `#${member?.memberNumber}` : 'Other'}</p>
 </div>
 <div>
 <p className="text-gray-600 dark:text-white text-sm">الاسم</p>
 <p className="font-bold text-lg">{member?.name}</p>
 </div>
 <div>
 <p className="text-gray-600 dark:text-white text-sm">الهاتف</p>
 <p className="font-bold text-lg">{member?.phone}</p>
 </div>
 </div>
 </div>

 <div className="mb-6">
 <label className="block font-bold mb-2 text-lg">تاريخ الاختبار</label>
 <input
 type="date"
 value={fitnessTestForm.testDate}
 onChange={(e) => setFitnessTestForm({...fitnessTestForm, testDate: e.target.value})}
 className="w-full px-4 py-3 border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white text-lg"
 />
 </div>

 <div className="bg-yellow-50 p-4 rounded-lg mb-6 dark:bg-yellow-900/20">
 <h4 className="font-bold mb-4 text-lg">الأسئلة الطبية</h4>
 <div className="space-y-3">
 {[
 { key: 'firstTimeGym', label: 'هل هذه أول مرة في النادي؟' },
 { key: 'inDietPlan', label: 'هل أنت على نظام غذائي؟' },
 { key: 'hernia', label: 'هل تعاني من فتق أو أي حالة قد تتفاقم بسبب رفع الأثقال؟' },
 { key: 'familyHeartHistory', label: 'هل يوجد تاريخ عائلي لأمراض القلب؟' },
 { key: 'heartProblem', label: 'هل لديك أي مشاكل في القلب؟' },
 { key: 'backPain', label: 'هل تعاني من آلام في الظهر؟' },
 { key: 'surgery', label: 'هل أجريت أي عملية جراحية؟' },
 { key: 'breathingProblems', label: 'هل لديك تاريخ من مشاكل التنفس أو الرئة؟' },
 { key: 'bloodPressure', label: 'هل تعاني من ضغط الدم؟' },
 { key: 'kneeProblem', label: 'هل لديك مشاكل في الركبة؟' },
 { key: 'diabetes', label: 'هل تعاني من السكري؟' },
 { key: 'smoker', label: 'هل أنت مدخن؟' },
 { key: 'highCholesterol', label: 'هل لديك مستوى عالي من الكوليسترول؟' },
 ].map((q) => (
 <label key={q.key} className="flex items-center gap-3 cursor-pointer hover:bg-yellow-100 p-2 rounded">
 <input
 type="checkbox"
 checked={fitnessTestForm.medicalQuestions[q.key as any]}
 onChange={(e) => setFitnessTestForm({
 ...fitnessTestForm,
 medicalQuestions: {
 ...fitnessTestForm.medicalQuestions,
 [q.key]: e.target.checked
 }
 })}
 className="w-5 h-5"
 />
 <span className="text-base">{q.label}</span>
 </label>
 ))}
 </div>
 </div>

 <div className="bg-orange-50 p-4 rounded-lg mb-6 dark:bg-orange-900/20">
 <div className="flex items-center justify-between">
 <span className="font-bold text-lg">حصص PT المجانية للعضو</span>
 <span className="text-4xl font-bold text-orange-600">
 {member?.freePTSessions || 0}
 </span>
 </div>
 </div>

 <div className="bg-primary-50 p-4 rounded-lg mb-6">
 <h4 className="font-bold mb-4 text-lg">اختبار المرونة</h4>
 <div className="grid grid-cols-2 gap-4">
 {[
 { key: 'shoulder', label: 'الكتف (Shoulder)' },
 { key: 'hip', label: 'الورك (Hip)' },
 { key: 'elbow', label: 'الكوع (Elbow)' },
 { key: 'wrist', label: 'المعصم (Wrist)' },
 { key: 'spine', label: 'العمود الفقري (Spine)' },
 { key: 'scapula', label: 'لوح الكتف (Scapula)' },
 { key: 'knee', label: 'الركبة (Knee)' },
 { key: 'ankle', label: 'الكاحل (Ankle)' },
 ].map((part) => (
 <div key={part.key}>
 <label className="block font-medium mb-2">{part.label}</label>
 <select
 value={fitnessTestForm.flexibility[part.key as any]}
 onChange={(e) => setFitnessTestForm({
 ...fitnessTestForm,
 flexibility: {...fitnessTestForm.flexibility, [part.key]: e.target.value}
 })}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
 >
 <option value="FAIR">Fair</option>
 <option value="GOOD">Good</option>
 <option value="EXCELLENT">Excellent</option>
 </select>
 </div>
 ))}
 </div>
 </div>

 <div className="bg-green-50 p-4 rounded-lg mb-6 dark:bg-green-900/20">
 <h4 className="font-bold mb-4 text-lg">اختبار التمارين</h4>
 <div className="space-y-4">
 {[
 { key: 'pushup', label: 'الضغط (Push up)' },
 { key: 'situp', label: 'البطن (Sit-up)' },
 { key: 'pullup', label: 'العقلة (Pull up)' },
 { key: 'squat', label: 'القرفصاء (Squat)' },
 { key: 'plank', label: 'البلانك (Plank)' },
 { key: 'legpress', label: 'ضغط الأرجل (Leg press)' },
 { key: 'chestpress', label: 'ضغط الصدر (Chest press)' },
 ].map((ex) => (
 <div key={ex.key} className="flex items-center gap-4">
 <div className="w-48 font-medium">{ex.label}</div>
 <input
 type="number"
 placeholder="Sets"
 value={fitnessTestForm.exercises[ex.key as any].sets}
 onChange={(e) => setFitnessTestForm({
 ...fitnessTestForm,
 exercises: {
 ...fitnessTestForm.exercises,
 [ex.key]: {...fitnessTestForm.exercises[ex.key as any], sets: parseInt(e.target.value) || 0}
 }
 })}
 className="w-24 px-3 py-2 border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
 min="0"
 />
 <span>×</span>
 <input
 type="number"
 placeholder="Reps"
 value={fitnessTestForm.exercises[ex.key as any].reps}
 onChange={(e) => setFitnessTestForm({
 ...fitnessTestForm,
 exercises: {
 ...fitnessTestForm.exercises,
 [ex.key]: {...fitnessTestForm.exercises[ex.key as any], reps: parseInt(e.target.value) || 0}
 }
 })}
 className="w-24 px-3 py-2 border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-700 dark:text-white"
 min="0"
 />
 </div>
 ))}
 </div>
 </div>

 <div className="sticky bottom-0 bg-white dark:bg-gray-800 pt-4 border-t flex gap-3">
 <button
 onClick={handleSubmitFitnessTest}
 disabled={loading}
 className="flex-1 bg-teal-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-teal-700 disabled:bg-gray-400"
 >
 {loading ? 'جاري الحفظ...' : 'حفظ الاختبار'}
 </button>
 <button
 onClick={() => setActiveModal(null)}
 className="px-8 bg-gray-200 dark:bg-gray-700 py-4 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-600"
 >
 إلغاء
 </button>
 </div>
 </div>
 </div>
 )}

 {activeModal === 'view-fitness-test' && fitnessTestData && (
 <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in flex items-center justify-center z-50 p-4">
 <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
 <div className="sticky top-0 bg-white dark:bg-gray-800 pb-4 border-b mb-6">
 <h3 className="text-2xl font-bold text-center">عرض اختبار اللياقة</h3>
 <p className="text-center text-gray-600 dark:text-white mt-2">تم إنشاؤه بواسطة: {fitnessTestData.coachName}</p>
 </div>

 <div className="space-y-6">
 <div className="bg-primary-50 p-4 rounded-lg">
 <h4 className="font-bold mb-3">معلومات العضو</h4>
 <div className="grid grid-cols-3 gap-4 text-sm">
 <div>
 <p className="text-gray-600 dark:text-white">رقم العضوية</p>
 <p className="font-bold">{fitnessTestData.memberNumber ? `#${fitnessTestData.memberNumber}` : 'Other'}</p>
 </div>
 <div>
 <p className="text-gray-600 dark:text-white">الاسم</p>
 <p className="font-bold">{fitnessTestData.memberName}</p>
 </div>
 <div>
 <p className="text-gray-600 dark:text-white">تاريخ الاختبار</p>
 <p className="font-bold">{new Date(fitnessTestData.testDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}</p>
 </div>
 </div>
 </div>

 <div className="bg-orange-50 p-4 rounded-lg dark:bg-orange-900/20">
 <div className="flex items-center justify-between">
 <span className="font-bold">حصص PT المجانية</span>
 <span className="text-3xl font-bold text-orange-600">{fitnessTestData.freePTSessions}</span>
 </div>
 </div>

 <div className="bg-yellow-50 p-4 rounded-lg dark:bg-yellow-900/20">
 <h4 className="font-bold mb-3">الحالة الطبية</h4>
 <div className="grid grid-cols-2 gap-2 text-sm">
 {Object.entries(fitnessTestData.medicalQuestions).map(([key, value]) => (
 <div key={key} className="flex items-center gap-2">
 <span>{value ? '' : ''}</span>
 <span className="text-gray-700 dark:text-white">{key}</span>
 </div>
 ))}
 </div>
 </div>

 <div className="bg-primary-50 p-4 rounded-lg">
 <h4 className="font-bold mb-3">تقييم المرونة</h4>
 <div className="grid grid-cols-4 gap-3 text-sm">
 {Object.entries(fitnessTestData.flexibility).map(([key, value]) => (
 <div key={key} className="bg-white dark:bg-gray-800 p-2 rounded">
 <p className="text-gray-600 dark:text-white text-xs">{key}</p>
 <p className="font-bold">{String(value)}</p>
 </div>
 ))}
 </div>
 </div>

 <div className="bg-green-50 p-4 rounded-lg dark:bg-green-900/20">
 <h4 className="font-bold mb-3">نتائج التمارين</h4>
 <div className="space-y-2 text-sm">
 {Object.entries(fitnessTestData.exercises).map(([key, value]: [string, any]) => (
 <div key={key} className="flex justify-between bg-white dark:bg-gray-800 p-2 rounded">
 <span className="font-medium">{key}</span>
 <span className="font-bold text-green-600">{value.sets} × {value.reps}</span>
 </div>
 ))}
 </div>
 </div>
 </div>

 <div className="sticky bottom-0 bg-white dark:bg-gray-800 pt-4 border-t mt-6">
 <button
 onClick={() => setActiveModal(null)}
 className="w-full bg-gray-600 text-white py-3 rounded-lg font-bold hover:bg-gray-700"
 >
 إغلاق
 </button>
 </div>
 </div>
 </div>
 )}

 {/* سجل الحضور */}
 <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 ring-1 ring-primary-100" dir={direction}>
 <div className="flex items-center justify-between mb-6">
 <div className="flex items-center gap-3">
 <div className="bg-gradient-to-br from-primary-500 to-primary-600 p-3 rounded-lg">
 
 </div>
 <div>
 <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t('memberDetails.attendanceLog.title')}</h2>
 <p className="text-sm text-gray-500 dark:text-gray-400">{t('memberDetails.attendanceLog.subtitle')}</p>
 </div>
 </div>
 </div>

 {/* Filters */}
 <div className="bg-gradient-to-br from-gray-50 to-primary-50 dark:from-gray-800 dark:to-primary-900/30 p-5 rounded-xl mb-6 border border-primary-200 dark:border-primary-700">
 <h3 className="text-sm font-bold text-gray-700 dark:text-white mb-3">{t('memberDetails.attendanceLog.filterByPeriod')}</h3>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div>
 <label className="block text-sm font-semibold text-gray-700 dark:text-white mb-2">{t('memberDetails.attendanceLog.dateFrom')}</label>
 <input
 type="date"
 value={attendanceStartDate}
 onChange={(e) => setAttendanceStartDate(e.target.value)}
 className="w-full px-4 py-2 ring-1 ring-gray-300 dark:ring-gray-600/60 rounded-lg focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 transition dark:bg-gray-700 dark:text-white"
 />
 </div>
 <div>
 <label className="block text-sm font-semibold text-gray-700 dark:text-white mb-2">{t('memberDetails.attendanceLog.dateTo')}</label>
 <input
 type="date"
 value={attendanceEndDate}
 onChange={(e) => setAttendanceEndDate(e.target.value)}
 className="w-full px-4 py-2 ring-1 ring-gray-300 dark:ring-gray-600/60 rounded-lg focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 transition dark:bg-gray-700 dark:text-white"
 />
 </div>
 <div className="flex items-end">
 <button
 onClick={fetchAttendanceHistory}
 disabled={attendanceLoading}
 className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-primary-contrast px-6 py-2 rounded-lg hover:from-primary-700 hover:to-primary-800 disabled:bg-gray-400 font-semibold shadow-md transition-colors duration-200 "
 >
 {attendanceLoading ? `${t('memberDetails.attendanceLog.loading')}` : `${t('memberDetails.attendanceLog.applyFilter')}`}
 </button>
 </div>
 </div>
 </div>

 {/* Content */}
 {attendanceLoading ? (
 <div className="text-center py-12">
 <svg className="w-10 h-10 mx-auto mb-4 text-gray-400" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
 <p className="text-gray-600 dark:text-white">{t('memberDetails.attendanceLog.loadingData')}</p>
 </div>
 ) : attendanceHistory.length === 0 ? (
 <div className="text-center py-12">
 <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
 <p className="text-xl text-gray-600 dark:text-white">{t('memberDetails.attendanceLog.noRecordsForPeriod')}</p>
 </div>
 ) : (
 <>
 {/* إحصائيات سريعة */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
 <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-900/40 p-4 rounded-lg ring-1 ring-primary-200 dark:ring-primary-700/60">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-primary-600 dark:text-primary-300 text-sm font-semibold mb-1">{t('memberDetails.attendanceLog.totalVisits')}</p>
 <p className="text-3xl font-bold text-primary-700 dark:text-primary-400">{attendanceHistory.length}</p>
 </div>
 <svg className="w-10 h-10 mx-auto text-gray-400 opacity-60" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
 </div>
 </div>

 <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/40 p-4 rounded-lg ring-1 ring-green-200 dark:ring-green-700/60">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-green-600 dark:text-green-300 text-sm font-semibold mb-1">{t('memberDetails.attendanceLog.lastVisit')}</p>
 <p className="text-lg font-bold text-green-700 dark:text-green-400">
 {new Date(attendanceHistory[0].checkInTime).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', {
 month: 'short',
 day: 'numeric'
 })}
 </p>
 </div>
 <svg className="w-10 h-10 mx-auto text-gray-400 opacity-60" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
 </div>
 </div>
 </div>

 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="bg-gradient-to-r from-primary-500 to-primary-600">
 <tr>
 <th className={`px-6 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} text-white font-bold`}>#</th>
 <th className={`px-6 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} text-white font-bold`}>{t('memberDetails.attendanceLog.date')}</th>
 <th className={`px-6 py-4 ${direction === 'rtl' ? 'text-right' : 'text-left'} text-white font-bold`}>{t('memberDetails.attendanceLog.checkInTime')}</th>
 </tr>
 </thead>
 <tbody>
 {attendanceHistory.map((checkIn, index) => {
 const checkInTime = new Date(checkIn.checkInTime)

 return (
 <tr key={checkIn.id} className="border-t hover:bg-primary-50 transition-colors">
 <td className="px-6 py-4 font-bold text-gray-700 dark:text-white">
 {index + 1}
 </td>
 <td className="px-6 py-4">
 <span className="font-semibold text-gray-700 dark:text-white">
 {checkInTime.toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US', {
 year: 'numeric',
 month: 'short',
 day: 'numeric'
 })}
 </span>
 </td>
 <td className="px-6 py-4">
 <span className="bg-primary-100 text-primary-700 px-3 py-1 rounded-lg font-bold text-sm">
 {checkInTime.toLocaleTimeString(direction === 'rtl' ? 'ar-EG' : 'en-US', {
 hour: '2-digit',
 minute: '2-digit'
 })}
 </span>
 </td>
 </tr>
 )
 })}
 </tbody>
 </table>
 </div>
 </>
 )}
 </div>

 {/* زرار السجلات — يفتح بوب أب بتبات */}
 <div className="mb-6">
 <button
 onClick={() => { setHistoryTab('renewals'); setShowHistoryModal(true) }}
 className="group w-full flex items-center gap-3 sm:gap-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-5 text-start hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md transition"
 >
 {/* أيقونة */}
 <span className="shrink-0 w-11 h-11 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 flex items-center justify-center ring-1 ring-primary-100 dark:ring-primary-800">
 <svg className="w-6 h-6" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
 </span>

 {/* العنوان + شرائح العدادات */}
 <div className="flex-1 min-w-0">
 <div className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
 {locale === 'ar' ? 'السجلات' : 'History'}
 </div>
 <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
 {([
 { label: locale === 'ar' ? 'تجديدات' : 'Renewals', count: renewalHistory.length, cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
 { label: locale === 'ar' ? 'تجميد' : 'Freeze', count: freezeHistory.length, cls: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' },
 { label: locale === 'ar' ? 'متابعات' : 'Follow-ups', count: followUpHistory.length, cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
 { label: locale === 'ar' ? 'دعوات' : 'Invitations', count: invitationHistory.length, cls: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
 ]).map((c) => (
 <span key={c.label} className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${c.cls}`}>
 <span>{c.label}</span>
 <span className="opacity-70">{c.count}</span>
 </span>
 ))}
 </div>
 </div>

 {/* عرض */}
 <span className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary-600 group-hover:bg-primary-700 text-white text-sm font-semibold transition">
 <span className="hidden sm:inline">{locale === 'ar' ? 'عرض' : 'View'}</span>
 <svg className="w-4 h-4 rtl:rotate-180" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
 </span>
 </button>
 </div>

 {/* بوب أب السجلات (تبات) */}
 {showHistoryModal && (
 <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in flex items-center justify-center z-50 p-4" dir={direction}>
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
 {/* Header */}
 <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
 <div>
 <h2 className="text-xl font-bold text-gray-900 dark:text-white">{locale === 'ar' ? 'السجلات' : 'History'}</h2>
 <p className="text-sm text-gray-500 dark:text-gray-400">{member?.name} - {member?.memberNumber != null ? `#${member.memberNumber}` : (locale === 'ar' ? 'بدون عضوية' : 'Non-Member')}</p>
 </div>
 <button
 onClick={() => setShowHistoryModal(false)}
 className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
 >
 <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
 </button>
 </div>

 {/* Tabs — شريط مقسّم متناسق */}
 <div className="px-4 pt-3 pb-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
 <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-900/50 rounded-xl">
 {([
 { key: 'renewals', label: locale === 'ar' ? 'التجديدات' : 'Renewals', count: renewalHistory.length },
 { key: 'freeze', label: locale === 'ar' ? 'التجميد' : 'Freeze', count: freezeHistory.length },
 { key: 'followups', label: locale === 'ar' ? 'المتابعات' : 'Follow-ups', count: followUpHistory.length },
 { key: 'invitations', label: locale === 'ar' ? 'الدعوات' : 'Invitations', count: invitationHistory.length },
 ] as const).map((tab) => (
 <button
 key={tab.key}
 onClick={() => setHistoryTab(tab.key)}
 className={`flex-1 min-w-0 px-2 sm:px-3 py-2 text-xs sm:text-sm font-bold rounded-lg transition inline-flex items-center justify-center gap-1.5 ${
 historyTab === tab.key
 ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-300 shadow-sm ring-1 ring-black/5 dark:ring-white/10'
 : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
 }`}
 >
 <span className="truncate">{tab.label}</span>
 {tab.count > 0 && (
 <span className={`shrink-0 text-[10px] leading-none font-bold px-1.5 py-1 rounded-full ${historyTab === tab.key ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`}>
 {tab.count}
 </span>
 )}
 </button>
 ))}
 </div>
 </div>

 {/* Content */}
 <div className="flex-1 overflow-y-auto p-6">
 {historyTab === 'renewals' && (
 renewalHistoryLoading ? (
 <div className="text-center py-8 text-gray-500">
 <div className="w-8 h-8 ring-1 ring-emerald-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-2" />
 {locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}
 </div>
 ) : renewalHistory.length === 0 ? (
 <div className="text-center py-8 text-gray-500 dark:text-gray-400">
 <p>{locale === 'ar' ? 'لا يوجد سجل تجديدات لهذا العضو' : 'No renewal history for this member'}</p>
 </div>
 ) : (
 <div className="space-y-3">
 {renewalHistory.map((entry: any) => (
 <div
 key={entry.id}
 className="bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 ring-1 ring-emerald-200 dark:ring-emerald-700/60 rounded-lg p-4"
 >
 <div className="flex items-start justify-between gap-3">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-2 flex-wrap">
 <span className="font-bold text-gray-800 dark:text-white font-mono" dir="ltr">
 {new Date(entry.startDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
 {' → '}
 {new Date(entry.expiryDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
 </span>
 <span className={`${entry.isRenewal ? 'bg-emerald-500 dark:bg-emerald-600' : 'bg-blue-500 dark:bg-blue-600'} text-white text-[11px] px-2 py-0.5 rounded-full font-bold`}>
 {entry.isRenewal ? (locale === 'ar' ? 'تجديد' : 'Renewal') : (locale === 'ar' ? 'اشتراك جديد' : 'New')}
 </span>
 </div>
 <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500 dark:text-gray-400">
 {entry.subscriptionPrice != null && (
 <span>{locale === 'ar' ? 'السعر' : 'Price'}: <strong className="text-gray-700 dark:text-gray-200">{entry.subscriptionPrice}</strong></span>
 )}
 {entry.receiptNumber != null && (
 <span>{locale === 'ar' ? 'إيصال' : 'Receipt'} #{entry.receiptNumber}</span>
 )}
 {entry.staffName && (
 <span>{locale === 'ar' ? 'بواسطة' : 'By'}: {entry.staffName}</span>
 )}
 </div>
 <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
 {new Date(entry.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
 </p>
 </div>
 {entry.subscriptionDays != null && (
 <div className="text-center shrink-0">
 <div className="bg-emerald-600 dark:bg-emerald-700 text-white px-4 py-2 rounded-lg shadow-md">
 <p className="text-2xl font-bold">{entry.subscriptionDays}</p>
 <p className="text-xs opacity-90">{t('common.day')}</p>
 </div>
 </div>
 )}
 </div>
 </div>
 ))}
 </div>
 )
 )}
 {historyTab === 'freeze' && (
 freezeHistoryLoading ? (
 <div className="text-center py-8 text-gray-500">
 <div className="w-8 h-8 ring-1 ring-cyan-200 border-t-cyan-500 rounded-full animate-spin mx-auto mb-2" />
 {locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}
 </div>
 ) : freezeHistory.length === 0 ? (
 <div className="text-center py-8 text-gray-500 dark:text-gray-400">
 <p>{locale === 'ar' ? 'لا يوجد سجل تجميد لهذا العضو' : 'No freeze history for this member'}</p>
 </div>
 ) : (
 <div className="space-y-3">
 {freezeHistory.map((entry: any) => {
 const statusColor = entry.status === 'approved'
 ? 'bg-green-500 dark:bg-green-600'
 : entry.status === 'rejected'
 ? 'bg-red-500 dark:bg-red-600'
 : 'bg-amber-500 dark:bg-amber-600'
 const statusLabel = entry.status === 'approved'
 ? (locale === 'ar' ? 'مقبول' : 'Approved')
 : entry.status === 'rejected'
 ? (locale === 'ar' ? 'مرفوض' : 'Rejected')
 : (locale === 'ar' ? 'قيد الانتظار' : 'Pending')
 return (
 <div
 key={entry.id}
 className={`bg-gradient-to-r rounded-lg p-4 ring-1 ${
 entry.isBack
 ? 'from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20 ring-indigo-200 dark:ring-indigo-700/60'
 : 'from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 ring-cyan-200 dark:ring-cyan-700/60'
 }`}
 >
 <div className="flex items-start justify-between gap-3">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-2 flex-wrap">
 <span className="font-bold text-gray-800 dark:text-white font-mono" dir="ltr">
 {new Date(entry.startDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
 {' → '}
 {new Date(entry.endDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
 </span>
 {entry.isBack && (
 <span className="bg-indigo-600 text-white text-[11px] px-2 py-0.5 rounded-full font-bold">
 {locale === 'ar' ? 'باك فريز' : 'Back'}
 </span>
 )}
 <span className={`${statusColor} text-white text-[11px] px-2 py-0.5 rounded-full font-bold`}>{statusLabel}</span>
 </div>
 {entry.reason && (
 <p className="text-sm text-gray-600 dark:text-white mb-1">{entry.reason}</p>
 )}
 {entry.approvedBy && (
 <p className="text-xs text-gray-500 dark:text-gray-400">
 {locale === 'ar' ? 'بواسطة' : 'By'}: {entry.approvedBy}
 </p>
 )}
 <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
 {new Date(entry.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
 </p>
 </div>
 <div className="text-center shrink-0">
 <div className={`${entry.isBack ? 'bg-indigo-600 dark:bg-indigo-700' : 'bg-cyan-600 dark:bg-cyan-700'} text-white px-4 py-2 rounded-lg shadow-md`}>
 <p className="text-2xl font-bold">{entry.days}</p>
 <p className="text-xs opacity-90">{t('common.day')}</p>
 </div>
 </div>
 </div>
 </div>
 )
 })}
 </div>
 )
 )}
 {historyTab === 'followups' && (
 followUpHistoryLoading ? (
 <div className="text-center py-8 text-gray-500">
 <div className="w-8 h-8 ring-1 ring-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-2" />
 {locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}
 </div>
 ) : followUpHistory.length === 0 ? (
 <div className="text-center py-8 text-gray-500 dark:text-gray-400">
 <p className="text-3xl mb-2"></p>
 <p>{locale === 'ar' ? 'لا يوجد سجل متابعات لهذا العضو' : 'No follow-up history for this member'}</p>
 </div>
 ) : (
 <div className="space-y-3">
 {followUpHistory.map((fu: any) => {
 const RESULT_COLORS: Record<string, string> = {
 interested: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
 'not-interested': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
 'no-answer': 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300',
 postponed: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
 subscribed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
 }
 const resultColor = fu.result ? (RESULT_COLORS[fu.result] || 'bg-gray-100 text-gray-600') : 'bg-gray-100 text-gray-500'
 return (
 <div key={fu.id} className={`rounded-lg p-4 border ${fu.archived ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30' : 'border-primary-200 dark:border-primary-700 bg-primary-50/30 dark:bg-primary-900/10'}`}>
 <div className="flex items-start justify-between gap-2 flex-wrap">
 <div className="flex-1">
 <div className="flex items-center gap-2 flex-wrap mb-1">
 <span className="text-xs text-gray-500 dark:text-gray-400">
 {new Date(fu.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
 </span>
 {fu.salesName && (
 <span className="text-xs text-gray-600 dark:text-gray-400">· {fu.salesName}</span>
 )}
 {fu.assignedStaff && (
 <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full">
 {fu.assignedStaff.name}
 </span>
 )}
 {fu.archived && (
 <span className="text-xs bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400 px-2 py-0.5 rounded-full">
 {fu.archivedReason === 'converted' ? (locale === 'ar' ? 'اشترك' : 'Converted') : (locale === 'ar' ? 'مؤرشف' : 'Archived')}
 </span>
 )}
 </div>
 {fu.notes && <p className="text-sm text-gray-700 dark:text-white">{fu.notes}</p>}
 </div>
 {fu.result && (
 <span className={`text-xs px-2 py-1 rounded-full font-medium ${resultColor}`}>
 {fu.result === 'interested' ? (locale === 'ar' ? 'مهتم' : 'Interested')
 : fu.result === 'not-interested' ? (locale === 'ar' ? 'غير مهتم' : 'Not Interested')
 : fu.result === 'no-answer' ? (locale === 'ar' ? 'لم يرد' : 'No Answer')
 : fu.result === 'postponed' ? (locale === 'ar' ? 'مؤجل' : 'Postponed')
 : fu.result === 'subscribed' ? (locale === 'ar' ? 'اشترك' : 'Subscribed')
 : fu.result}
 </span>
 )}
 </div>
 </div>
 )
 })}
 </div>
 )
 )}

 {historyTab === 'invitations' && (
 invitationHistoryLoading ? (
 <div className="text-center py-8 text-gray-500">
 <div className="w-8 h-8 ring-1 ring-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-2" />
 {locale === 'ar' ? 'جاري التحميل...' : 'Loading...'}
 </div>
 ) : invitationHistory.length === 0 ? (
 <div className="text-center py-8 text-gray-500 dark:text-gray-400">
 <p className="text-3xl mb-2">🎟️</p>
 <p>{locale === 'ar' ? 'لا يوجد سجل دعوات لهذا العضو' : 'No invitation history for this member'}</p>
 </div>
 ) : (
 <div className="space-y-3">
 <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
 {locale === 'ar'
 ? `إجمالي الدعوات: ${invitationHistory.length} مرة`
 : `Total invitations: ${invitationHistory.length}`}
 </div>
 {invitationHistory.map((inv: any) => (
 <div key={inv.id} className="rounded-lg p-4 border border-purple-200 dark:border-purple-700 bg-purple-50/40 dark:bg-purple-900/10">
 <div className="flex items-start justify-between gap-2 flex-wrap">
 <div className="flex-1">
 <div className="flex items-center gap-2 flex-wrap mb-1">
 <span className="text-sm font-bold text-gray-800 dark:text-white">
 {inv.guestName || (locale === 'ar' ? 'ضيف' : 'Guest')}
 </span>
 {inv.guestPhone && (
 <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-0.5 rounded-full" dir="ltr">
 {inv.guestPhone}
 </span>
 )}
 </div>
 {inv.notes && <p className="text-sm text-gray-700 dark:text-white">{inv.notes}</p>}
 </div>
 <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
 {new Date(inv.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
 {' · '}
 {new Date(inv.createdAt).toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
 </span>
 </div>
 </div>
 ))}
 </div>
 )
 )}
 </div>
 {/* Footer */}
 <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
 <button
 onClick={() => setShowHistoryModal(false)}
 className="w-full bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-bold"
 >
 {t('common.close')}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* نموذج التجديد */}
 {/*  Quick Follow-up Modal */}
 {member && (
 <QuickMemberFollowUpModal
 isOpen={showQuickFollowUp}
 onClose={() => setShowQuickFollowUp(false)}
 onSuccess={() => fetchFollowUpHistory()} //  refresh السجل بعد إضافة متابعة جديدة
 member={{
 id: member.id,
 name: member.name,
 phone: member.phone,
 isActive: !!member.isActive,
 expiryDate: member.expiryDate || null,
 }}
 />
 )}

 {showRenewalForm && (
 <RenewalForm
 member={member}
 onSuccess={(receipt?: Receipt) => {
 if (receipt) {
 setReceiptData({
 receiptNumber: receipt.receiptNumber,
 type: t('renewall.membershipRenewal'),
 amount: receipt.amount,
 details: receipt.itemDetails,
 date: new Date(receipt.createdAt),
 paymentMethod: receipt.paymentMethod || 'cash'
 })
 setShowReceipt(true)
 setLastReceiptNumber(receipt.receiptNumber)
 queryClient.invalidateQueries({ queryKey: ['receipts'] })
 }

 fetchMember()
 setShowRenewalForm(false)
 toast.success(t('renewall.renewalSuccessMessage'))
 }}
 onClose={() => setShowRenewalForm(false)}
 />
 )}

 {/* نموذج الترقية */}
 {showUpgradeForm && member && (
 <UpgradeForm
 member={member}
 onSuccess={() => {
 setShowUpgradeForm(false)
 fetchMember()
 toast.success(t('upgrade.upgradeSuccess'))
 }}
 onClose={() => setShowUpgradeForm(false)}
 />
 )}

 {/* نموذج نقل العضوية */}
 {showTransferForm && member && (
 <TransferMembershipForm
 member={member as any}
 onClose={() => setShowTransferForm(false)}
 onSuccess={(res) => {
 if (res?.receipt) {
 setReceiptData({
 receiptNumber: res.receipt.receiptNumber,
 type: 'membershipTransfer',
 amount: res.receipt.amount,
 details: res.receipt.itemDetails,
 date: new Date(res.receipt.createdAt),
 paymentMethod: res.receipt.paymentMethod || 'cash'
 })
 setShowReceipt(true)
 setLastReceiptNumber(res.receipt.receiptNumber)
 queryClient.invalidateQueries({ queryKey: ['receipts'] })
 queryClient.invalidateQueries({ queryKey: ['members'] })
 }
 setShowTransferForm(false)
 fetchMember()
 const isIdentityChange = (res.recipient as any)?.identityUpdated
 toast.success(
 isIdentityChange
 ? (locale === 'ar'
 ? `تم تغيير ملكية العضوية إلى ${res.recipient.name}`
 : `Membership ownership transferred to ${res.recipient.name}`)
 : (locale === 'ar'
 ? `تم نقل ${res.transferredDays} يوم إلى ${res.recipient.name}`
 : `Transferred ${res.transferredDays} days to ${res.recipient.name}`)
 )
 }}
 />
 )}

 {/* الإيصال */}
 {showReceipt && receiptData && (
 <ReceiptToPrint
 receiptNumber={receiptData.receiptNumber}
 type={receiptData.type}
 amount={receiptData.amount}
 details={receiptData.details}
 date={receiptData.date}
 paymentMethod={receiptData.paymentMethod}
 onClose={() => setShowReceipt(false)}
 />
 )}

 {/* Member Receipts Modal */}
 {showReceiptsModal && (
 <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in flex items-center justify-center z-50 p-4" dir={direction}>
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
 {/* Header */}
 <div className="bg-gradient-to-r from-orange-600 to-yellow-600 text-white p-6 rounded-t-lg">
 <h2 className="text-2xl font-bold flex items-center gap-2">
 
 <span>{locale === 'ar' ? 'سجل الإيصالات' : 'Receipts History'}</span>
 </h2>
 <p className="text-orange-100 mt-1">{member?.name} - {member?.memberNumber != null ? `#${member.memberNumber}` : (locale === 'ar' ? 'بدون عضوية' : 'Non-Member')}</p>
 </div>

 {/* Content */}
 <div className="flex-1 overflow-y-auto p-6">
 {receiptsLoading ? (
 <LoadingScreen />
 ) : memberReceipts.length === 0 ? (
 <div className="text-center py-12">
 <p className="text-gray-500 dark:text-gray-400 text-xl">
 {locale === 'ar' ? 'لا توجد إيصالات' : 'No receipts found'}
 </p>
 </div>
 ) : (
 <div className="space-y-3">
 {memberReceipts.map((receipt) => {
 let itemDetails: any = {}
 let rawDetailsText: string | null = null
 try {
 itemDetails = receipt.itemDetails ? JSON.parse(receipt.itemDetails) : {}
 } catch {
 //  إيصالات يوم الاستخدام القديمة بتخزّن itemDetails كنص عادي (مثلاً "InBody - أحمد") مش JSON
 itemDetails = {}
 rawDetailsText = typeof receipt.itemDetails === 'string' ? receipt.itemDetails : null
 }
 //  شارة نوع الإيصال (عضوية / PT / يوم استخدام / تغذية...)
 const typeInfo = (() => {
 const tp = String(receipt.type || '').toLowerCase()
 const has = (s: string) => tp.includes(s)
 if (has('transfer')) return { label: locale === 'ar' ? 'نقل عضوية' : 'Transfer', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' }
 if (has('pt')) return { label: 'PT', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' }
 if (has('dayuse') || has('day_use')) return { label: locale === 'ar' ? 'يوم استخدام' : 'Day Use', cls: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300' }
 if (has('nutrition')) return { label: locale === 'ar' ? 'تغذية' : 'Nutrition', cls: 'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300' }
 if (has('physio')) return { label: locale === 'ar' ? 'علاج طبيعي' : 'Physio', cls: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' }
 if (has('groupclass') || has('group_class')) return { label: locale === 'ar' ? 'كلاسات' : 'Classes', cls: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300' }
 if (has('more')) return { label: locale === 'ar' ? 'مور' : 'More', cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' }
 if (has('inbody')) return { label: 'InBody', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' }
 return { label: locale === 'ar' ? 'عضوية' : 'Membership', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' }
 })()
 const paymentMethodLabel = receipt.paymentMethod === 'cash' ? (locale === 'ar' ? 'كاش ' : 'Cash ')
 : receipt.paymentMethod === 'visa' ? (locale === 'ar' ? 'فيزا ' : 'Visa ')
 : receipt.paymentMethod === 'instapay' ? (locale === 'ar' ? 'إنستاباي ' : 'Instapay ')
 : (locale === 'ar' ? 'محفظة ' : 'Wallet ')

 const sendReceiptOnWhatsApp = () => {
 if (!member?.phone) {
 toast.error(locale === 'ar' ? 'العضو ليس لديه رقم تليفون' : 'Member has no phone number')
 return
 }
 // نستخدم نفس صياغة الإيصال المستخدمة في صفحة الإيصالات بظبط
 const message = prepareReceiptMessage(
 {
 receiptNumber: receipt.receiptNumber,
 type: receipt.type,
 amount: receipt.amount,
 date: receipt.createdAt,
 paymentMethod: receipt.paymentMethod,
 staffName: receipt.staffName,
 details: itemDetails,
 memberPhoneFallback: member.phone,
 },
 {
 websiteUrl: settings?.websiteUrl,
 showWebsite: settings?.showWebsiteOnReceipts,
 }
 )
 const cancelledNote = receipt.isCancelled
 ? `\n\n*${locale === 'ar' ? 'هذا الإيصال ملغي' : 'This receipt is cancelled'}*\n`
 : ''
 const finalMessage = message + cancelledNote
 const phone = member.phone.replace(/^0/, '20')
 const url = `https://wa.me/${phone}?text=${encodeURIComponent(finalMessage)}`
 window.open(url, '_blank')
 }

 return (
 <div
 key={receipt.id}
 className="bg-gradient-to-r from-gray-50 to-white dark:from-gray-700 dark:to-gray-750 ring-1 ring-gray-200 dark:ring-gray-600/60 rounded-lg p-4 hover:shadow-md transition"
 >
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
 <div className="flex-1">
 <div className="flex items-center gap-3 mb-2">
 <span className="bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-3 py-1 rounded-full text-sm font-bold">
 #{receipt.receiptNumber}
 </span>
 <span className={`px-3 py-1 rounded-full text-xs font-bold ${typeInfo.cls}`}>
 {typeInfo.label}
 </span>
 <span className={`px-3 py-1 rounded-full text-xs font-bold ${
 receipt.isCancelled
 ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
 : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
 }`}>
 {receipt.isCancelled
 ? (locale === 'ar' ? 'ملغي' : 'Cancelled')
 : (locale === 'ar' ? 'نشط' : 'Active')
 }
 </span>
 </div>
 <div className="grid grid-cols-2 gap-2 text-sm">
 <div className="col-span-2">
 <span className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'البند:' : 'Item:'}</span>
 <span className="font-semibold dark:text-white mr-2">{rawDetailsText || itemDetails.packageType || itemDetails.serviceType || itemDetails.description || typeInfo.label}</span>
 </div>
 <div>
 <span className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'المبلغ:' : 'Amount:'}</span>
 <span className="font-bold text-green-600 dark:text-green-400 mr-2">{receipt.amount} {t('memberDetails.egp')}</span>
 </div>
 <div>
 <span className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'الطريقة:' : 'Method:'}</span>
 <span className="font-semibold dark:text-white mr-2">{paymentMethodLabel}</span>
 </div>
 {itemDetails.packageType && (
 <div>
 <span className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'الباقة:' : 'Package:'}</span>
 <span className="font-semibold dark:text-white mr-2">{itemDetails.packageType}</span>
 </div>
 )}
 <div>
 <span className="text-gray-500 dark:text-gray-400">{locale === 'ar' ? 'التاريخ:' : 'Date:'}</span>
 <span className="font-mono text-xs dark:text-white mr-2">
 {new Date(receipt.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
 year: 'numeric',
 month: 'short',
 day: 'numeric',
 hour: '2-digit',
 minute: '2-digit'
 })}
 </span>
 </div>
 </div>
 {itemDetails.startDate && itemDetails.expiryDate && (
 <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
 <div className="text-xs text-gray-600 dark:text-white">
 <span className="font-semibold">{locale === 'ar' ? 'الفترة:' : 'Period:'}</span>
 <span className="font-mono mr-2">
 {new Date(itemDetails.startDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
 </span>
 <span className="mx-1">→</span>
 <span className="font-mono">
 {new Date(itemDetails.expiryDate).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
 </span>
 </div>
 </div>
 )}
 {/* زر إرسال على واتساب */}
 {member?.phone && (
 <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600 flex justify-end">
 <button
 onClick={sendReceiptOnWhatsApp}
 className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-2 transition-colors duration-200 active:scale-95"
 title={locale === 'ar' ? 'إرسال الإيصال على واتساب' : 'Send receipt via WhatsApp'}
 >
 <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
 <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
 </svg>
 <span>{locale === 'ar' ? 'إرسال على واتساب' : 'Send on WhatsApp'}</span>
 </button>
 </div>
 )}
 </div>
 </div>
 </div>
 )
 })}
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="p-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center">
 <div className="text-sm text-gray-600 dark:text-white">
 {locale === 'ar' ? 'إجمالي الإيصالات:' : 'Total Receipts:'} <span className="font-bold">{memberReceipts.length}</span>
 </div>
 <button
 onClick={() => {
 setShowReceiptsModal(false)
 setMemberReceipts([])
 }}
 className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700"
 >
 {t('common.close')}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Points History Modal */}
 {showPointsHistory && (
 <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in flex items-center justify-center z-50 p-4" dir={direction}>
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
 {/* Header */}
 <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white p-6 rounded-t-lg">
 <h2 className="text-2xl font-bold flex items-center gap-2">
 
 <span>{t('memberDetails.pointsHistory')}</span>
 </h2>
 <p className="text-yellow-100 mt-1">{member?.name} - {member?.memberNumber != null ? `#${member.memberNumber}` : (locale === 'ar' ? 'بدون عضوية' : 'Non-Member')}</p>
 <p className="text-yellow-100 text-sm mt-1">
 {t('memberDetails.totalPoints')}: <span className="font-bold text-white">{member?.points ?? 0}</span>
 </p>
 </div>

 {/* Content */}
 <div className="flex-1 overflow-y-auto p-6">
 {pointsLoading ? (
 <LoadingScreen />
 ) : pointsHistory.length === 0 ? (
 <div className="text-center py-12">
 <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
 <p className="text-gray-500 dark:text-gray-400 text-xl">{t('memberDetails.noPointsHistory')}</p>
 <p className="text-gray-400 dark:text-gray-500 dark:text-gray-400 text-sm mt-2">{t('memberDetails.pointsWillAppear')}</p>
 </div>
 ) : (
 <div className="space-y-3">
 {pointsHistory.map((entry: any) => (
 <div
 key={entry.id}
 className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 ring-1 ring-yellow-200 dark:ring-yellow-700/60 rounded-lg p-4 hover:shadow-md transition"
 >
 <div className="flex items-center justify-between">
 <div className="flex-1">
 <div className="flex items-center gap-2 mb-2">
 <span className="text-2xl">
 {entry.action === 'check-in' ? '' : entry.action === 'manual' ? '' : ''}
 </span>
 <span className="font-bold text-gray-800 dark:text-white">
 {entry.action === 'check-in'
 ? t('memberDetails.checkInPoints')
 : entry.action === 'manual'
 ? t('memberDetails.manualEdit')
 : t('memberDetails.invitationPoints')}
 </span>
 </div>
 {entry.description && (
 <p className="text-sm text-gray-600 dark:text-white mb-2">{entry.description}</p>
 )}
 <p className="text-xs text-gray-500 dark:text-gray-400">
 {new Date(entry.createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
 year: 'numeric',
 month: 'long',
 day: 'numeric',
 hour: '2-digit',
 minute: '2-digit'
 })}
 </p>
 </div>
 <div className={direction === 'rtl' ? 'text-right' : 'text-left'}>
 <div className={`${entry.points >= 0 ? 'bg-green-500 dark:bg-green-600' : 'bg-red-500 dark:bg-red-600'} text-white px-4 py-2 rounded-lg shadow-md`}>
 <p className="text-2xl font-bold">{entry.points >= 0 ? '+' : ''}{entry.points}</p>
 <p className="text-xs opacity-90">{t('memberDetails.points')}</p>
 </div>
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="p-6 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
 <button
 onClick={() => {
 setShowPointsHistory(false)
 setPointsHistory([])
 }}
 className="w-full bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-bold"
 >
 {t('common.close')}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Add Points Modal */}
 {showAddPointsModal && (
 <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in flex items-center justify-center z-50 p-4" dir={direction}>
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md">
 {/* Header */}
 <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white p-6 rounded-t-lg">
 <h2 className="text-2xl font-bold flex items-center gap-2">
 
 <span>{t('memberDetails.addRemovePoints')}</span>
 </h2>
 <p className="text-yellow-100 mt-1">{member?.name} - {member?.memberNumber != null ? `#${member.memberNumber}` : (locale === 'ar' ? 'بدون عضوية' : 'Non-Member')}</p>
 <p className="text-yellow-100 text-sm mt-1">
 {t('memberDetails.currentBalance')}: <span className="font-bold text-white">{member?.points ?? 0}</span> {t('memberDetails.point')}
 </p>
 </div>

 {/* Content */}
 <div className="p-6 space-y-4">
 <div>
 <label className="block text-gray-700 dark:text-white font-bold mb-2">
 {t('memberDetails.pointsAmount')} <span className="text-red-500">*</span>
 </label>
 <input
 type="number"
 value={addPointsData.points}
 onChange={(e) => setAddPointsData({ ...addPointsData, points: e.target.value })}
 placeholder={t('memberDetails.enterPointsPlaceholder')}
 className="w-full px-3 py-2 ring-1 ring-gray-300 dark:ring-gray-600/60 rounded-lg focus:border-yellow-500 focus:outline-none dark:bg-gray-700 dark:text-white"
 />
 <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
 {t('memberDetails.pointsExample')}
 </p>
 </div>

 <div>
 <label className="block text-gray-700 dark:text-white font-bold mb-2">
 {t('memberDetails.reason')} <span className="text-red-500">*</span>
 </label>
 <textarea
 value={addPointsData.reason}
 onChange={(e) => setAddPointsData({ ...addPointsData, reason: e.target.value })}
 placeholder={t('memberDetails.enterReasonPlaceholder')}
 rows={3}
 className="w-full px-3 py-2 ring-1 ring-gray-300 dark:ring-gray-600/60 rounded-lg focus:border-yellow-500 focus:outline-none dark:bg-gray-700 dark:text-white resize-none"
 />
 </div>

 {addPointsData.points && !isNaN(parseInt(addPointsData.points)) && parseInt(addPointsData.points) !== 0 && (
 <div className={`p-3 rounded-lg ${parseInt(addPointsData.points) > 0 ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
 <p className={`text-sm font-semibold ${parseInt(addPointsData.points) > 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
 {parseInt(addPointsData.points) > 0 ? '' : ''}
 {t('memberDetails.balanceAfterUpdate')}: {(member?.points ?? 0) + parseInt(addPointsData.points)} {t('memberDetails.point')}
 </p>
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="p-6 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 flex gap-3">
 <button
 onClick={() => {
 setShowAddPointsModal(false)
 setAddPointsData({ points: '', reason: '' })
 }}
 className="flex-1 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-bold transition-colors"
 >
 {t('memberDetails.cancel')}
 </button>
 <button
 onClick={handleAddPoints}
 disabled={loading || !addPointsData.points || !addPointsData.reason.trim()}
 className="flex-1 bg-amber-500 text-white px-6 py-3 rounded-lg hover:bg-amber-600 font-bold disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-200"
 >
 {loading ? t('memberDetails.saving') : t('memberDetails.save')}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Modal عرض صور البطاقة الشخصية */}
 {showIdCardModal && (
 <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in flex items-center justify-center z-50 p-4">
 <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
 {/* Header */}
 <div className="sticky top-0 bg-gradient-to-r from-primary-500 to-primary-600 text-primary-contrast p-6 rounded-t-2xl">
 <div className="flex items-center justify-between">
 <h2 className="text-2xl font-bold flex items-center gap-3">
 
 <span>{t('memberDetails.idCardModal.title')}</span>
 </h2>
 <button
 onClick={() => setShowIdCardModal(false)}
 className="text-white hover:bg-white/20 rounded-lg p-2 transition"
 >
 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>
 </div>

 {/* Content */}
 <div className="p-6">
 {(
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 {/* الوجه الأمامي */}
 <div className="bg-gradient-to-br from-primary-50 to-primary-100 ring-1 ring-primary-300 rounded-xl p-4 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
 <div className="flex items-center gap-2 mb-4">
 
 <h3 className="text-xl font-bold text-primary-900">{t('memberDetails.idCardModal.frontSide')}</h3>
 </div>

 {member?.idCardFront ? (
 <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden ring-1 ring-primary-200 shadow-lg">
 <img
 src={member.idCardFront}
 alt="Front Side"
 className="w-full h-auto object-contain cursor-pointer hover:opacity-90 transition"
 onClick={() => window.open(member.idCardFront, '_blank')}
 />
 </div>
 ) : (
 <div className="bg-white dark:bg-gray-800 rounded-lg p-12 ring-1 ring-primary-300 text-center">
 <svg className="w-20 h-20 mx-auto mb-3 text-gray-400 dark:text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
 </svg>
 <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 mb-3">{t('memberDetails.idCardModal.noFrontImage')}</p>
 <button
 type="button"
 onClick={() => setMissingImageUpload({ field: 'idCardFront', label: locale === 'ar' ? 'وجه البطاقة' : 'ID Card Front' })}
 className="bg-primary-600 hover:bg-primary-700 text-primary-contrast font-semibold text-sm px-4 py-2 rounded-full shadow-md transition"
 >
 {locale === 'ar' ? 'إضافة صورة' : 'Add Image'}
 </button>
 </div>
 )}
 </div>

 {/* الوجه الخلفي */}
 <div className="bg-gradient-to-br from-primary-50 to-primary-100 ring-1 ring-primary-300 rounded-xl p-4 dark:border-gray-600 dark:bg-gray-700 dark:text-white">
 <div className="flex items-center gap-2 mb-4">
 
 <h3 className="text-xl font-bold text-primary-900">{t('memberDetails.idCardModal.backSide')}</h3>
 </div>

 {member?.idCardBack ? (
 <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden ring-1 ring-primary-200 shadow-lg">
 <img
 src={member.idCardBack}
 alt="Back Side"
 className="w-full h-auto object-contain cursor-pointer hover:opacity-90 transition"
 onClick={() => window.open(member.idCardBack, '_blank')}
 />
 </div>
 ) : (
 <div className="bg-white dark:bg-gray-800 rounded-lg p-12 ring-1 ring-primary-300 text-center">
 <svg className="w-20 h-20 mx-auto mb-3 text-gray-400 dark:text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
 </svg>
 <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 mb-3">{t('memberDetails.idCardModal.noBackImage')}</p>
 <button
 type="button"
 onClick={() => setMissingImageUpload({ field: 'idCardBack', label: locale === 'ar' ? 'خلف البطاقة' : 'ID Card Back' })}
 className="bg-primary-600 hover:bg-primary-700 text-primary-contrast font-semibold text-sm px-4 py-2 rounded-full shadow-md transition"
 >
 {locale === 'ar' ? 'إضافة صورة' : 'Add Image'}
 </button>
 </div>
 )}
 </div>
 </div>
 )}

 {/* Note */}
 <div className={`mt-6 bg-blue-50 border-s-4 border-blue-500 p-4 rounded dark:bg-blue-900/20 dark:border-blue-700`}>
 <p className="text-sm text-blue-900">
 {t('memberDetails.idCardModal.clickToOpen')}
 </p>
 </div>
 </div>

 {/* Footer */}
 <div className="p-4 bg-gray-50 dark:bg-gray-700 dark:bg-gray-700 border-t flex justify-end rounded-b-2xl">
 <button
 onClick={() => setShowIdCardModal(false)}
 className="bg-primary-600 text-primary-contrast px-6 py-2 rounded-lg hover:bg-primary-700 transition"
 >
 {t('memberDetails.idCardModal.close')}
 </button>
 </div>
 </div>
 </div>
 )}

 {/* رفع صورة ناقصة (متاح لأي مستخدم مسجل دخول) */}
 {missingImageUpload && (
 <div
 className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
 style={{ zIndex: 10000 }}
 onClick={(e) => {
 if (e.target === e.currentTarget && !missingImageUploading) setMissingImageUpload(null)
 }}
 >
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full p-5" dir={direction}>
 <div className="flex justify-between items-center mb-4 pb-2 border-b dark:border-gray-700">
 <h3 className="text-base font-bold dark:text-white">
 {locale === 'ar' ? 'إضافة' : 'Add'} {missingImageUpload.label}
 </h3>
 <button
 type="button"
 onClick={() => !missingImageUploading && setMissingImageUpload(null)}
 disabled={missingImageUploading}
 className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none disabled:opacity-50"
 >
 ×
 </button>
 </div>
 <ImageUpload
 currentImage={null}
 onImageChange={(imageUrl) => uploadMissingImage(missingImageUpload.field, imageUrl)}
 disabled={missingImageUploading}
 variant={missingImageUpload.field === 'profileImage' ? 'profile' : 'idCard'}
 />
 {missingImageUploading && (
 <p className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
 {locale === 'ar' ? 'جاري الحفظ...' : 'Saving...'}
 </p>
 )}
 </div>
 </div>
 )}

 {/* Free Session Modal */}
 {member && freeSessionModal.isOpen && freeSessionModal.serviceType && (
 <FreeSessionModal
 isOpen={freeSessionModal.isOpen}
 serviceType={freeSessionModal.serviceType}
 memberName={member.name}
 memberId={member.id}
 remainingSessions={
 freeSessionModal.serviceType === 'PT' ? member.freePTSessions :
 freeSessionModal.serviceType === 'Nutrition' ? member.freeNutritionSessions :
 freeSessionModal.serviceType === 'Physiotherapy' ? member.freePhysioSessions :
 member.freeGroupClassSessions
 }
 onClose={() => setFreeSessionModal({ isOpen: false, serviceType: null })}
 onSuccess={() => {
 fetchMember()
 }}
 />
 )}

 {/* Barcode WhatsApp Popup */}
 {barcodePopup.show && member && (
 <div
 className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in flex items-center justify-center p-4"
 style={{ zIndex: 10001 }}
 >
 <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6" dir="rtl">

 {/* === حالة التوليد === */}
 {barcodePopup.step === 'generating' && (
 <div className="text-center py-8">
 <div className="w-16 h-16 ring-1 ring-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
 <h3 className="text-lg font-bold mb-1">جاري إنشاء صورة الباركود...</h3>
 <p className="text-sm text-gray-500">يرجى الانتظار</p>
 </div>
 )}

 {/* === الصورة جاهزة - تأكيد الإرسال === */}
 {barcodePopup.step === 'ready' && barcodePopup.image && (
 <>
 <div className="flex items-center gap-2 mb-4">
 <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold shrink-0"><svg className="w-4 h-4" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg></div>
 <h3 className="text-lg font-bold text-green-700 dark:text-green-400">الصورة جاهزة للإرسال</h3>
 </div>

 <div className="bg-gray-50 dark:bg-gray-700 ring-1 ring-green-300 dark:ring-green-600/60 rounded-xl p-4 mb-4 flex justify-center">
 <img
 src={barcodePopup.image}
 alt="Barcode Preview"
 className="max-w-full h-auto"
 style={{ maxHeight: '180px' }}
 />
 </div>

 <p className="text-sm text-gray-600 dark:text-white text-center mb-4">
 سيتم إرسال الباركود إلى <span className="font-bold">{member.phone}</span>
 </p>

 <div className="space-y-2">
 <button
 onClick={async () => {
 setBarcodePopup(p => ({ ...p, step: 'sending' }))
 try {
 const baseMessage = `Membership Barcode #${member.memberNumber ?? 'Other'} for member ${member.name}`
 const websiteSection = settings?.showWebsiteOnReceipts && settings?.websiteUrl
 ? `\n\n*الموقع الإلكتروني:*\n${settings.websiteUrl}`
 : ''
 const caption = baseMessage + websiteSection

 const sendResult = await fetch('/api/whatsapp/send-image', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 phone: member.phone,
 imageBase64: barcodePopup.image,
 caption
 })
 })
 const sendData = await sendResult.json()

 if (sendData.success) {
 setBarcodePopup(p => ({ ...p, step: 'success' }))
 setTimeout(() => {
 setBarcodePopup({ show: false, step: 'generating', image: '', error: '' })
 }, 2000)
 } else {
 const errorMessage = sendData.error || 'فشل إرسال الصورة'
 const msg = errorMessage.includes('not ready') || errorMessage.includes('not initialized')
 ? 'الواتساب غير متصل. افتح الإعدادات → الواتساب لمسح QR code'
 : errorMessage
 setBarcodePopup(p => ({ ...p, step: 'error', error: msg }))
 }
 } catch (err) {
 setBarcodePopup(p => ({ ...p, step: 'error', error: 'حدث خطأ أثناء الإرسال' }))
 }
 }}
 className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-bold flex items-center justify-center gap-2 text-lg"
 >
 
 <span>إرسال الباركود فقط</span>
 </button>

 {/* إرسال الباركود + آخر إيصال في رسالة واحدة */}
 {lastReceipt && (
 <button
 onClick={async () => {
 setBarcodePopup(p => ({ ...p, step: 'sending' }))
 try {
 let receiptDetails: any = {}
 try {
 receiptDetails = typeof lastReceipt.itemDetails === 'string'
 ? JSON.parse(lastReceipt.itemDetails)
 : lastReceipt.itemDetails || {}
 } catch { /* ignore */ }

 // نفس صياغة الإيصال المستخدمة في صفحة الإيصالات
 const caption = prepareReceiptMessage(
 {
 receiptNumber: lastReceipt.receiptNumber,
 type: lastReceipt.type,
 amount: lastReceipt.amount,
 date: lastReceipt.createdAt,
 paymentMethod: lastReceipt.paymentMethod,
 staffName: lastReceipt.staffName,
 details: receiptDetails,
 memberPhoneFallback: member.phone,
 },
 {
 websiteUrl: settings?.websiteUrl,
 showWebsite: settings?.showWebsiteOnReceipts,
 }
 )

 const sendResult = await fetch('/api/whatsapp/send-image', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 phone: member.phone,
 imageBase64: barcodePopup.image,
 caption
 })
 })
 const sendData = await sendResult.json()

 if (sendData.success) {
 setBarcodePopup(p => ({ ...p, step: 'success' }))
 setTimeout(() => {
 setBarcodePopup({ show: false, step: 'generating', image: '', error: '' })
 }, 2000)
 } else {
 const errorMessage = sendData.error || 'فشل إرسال الصورة'
 const msg = errorMessage.includes('not ready') || errorMessage.includes('not initialized')
 ? 'الواتساب غير متصل. افتح الإعدادات → الواتساب لمسح QR code'
 : errorMessage
 setBarcodePopup(p => ({ ...p, step: 'error', error: msg }))
 }
 } catch (err) {
 setBarcodePopup(p => ({ ...p, step: 'error', error: 'حدث خطأ أثناء الإرسال' }))
 }
 }}
 className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-lg hover:from-green-700 hover:to-emerald-700 font-bold flex items-center justify-center gap-2 text-base shadow-md"
 >
 
 <span>إرسال الباركود + آخر إيصال</span>
 </button>
 )}

 <button
 onClick={() => setBarcodePopup({ show: false, step: 'generating', image: '', error: '' })}
 className="w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold"
 >
 إلغاء
 </button>
 </div>
 </>
 )}

 {/* === جاري الإرسال === */}
 {barcodePopup.step === 'sending' && (
 <div className="text-center py-8">
 <div className="w-16 h-16 ring-1 ring-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4" />
 <h3 className="text-lg font-bold mb-1">جاري الإرسال عبر واتساب...</h3>
 <p className="text-sm text-gray-500">يرجى الانتظار</p>
 {barcodePopup.image && (
 <div className="mt-4 opacity-50">
 <img src={barcodePopup.image} alt="Sending..." className="max-h-24 mx-auto rounded" />
 </div>
 )}
 </div>
 )}

 {/* === تم الإرسال بنجاح === */}
 {barcodePopup.step === 'success' && (
 <div className="text-center py-6">
 <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
 <h3 className="text-xl font-bold text-green-700 dark:text-green-400 mb-2">تم الإرسال بنجاح!</h3>
 <p className="text-sm text-gray-500 mb-1">تم إنشاء الصورة وإرسالها عبر واتساب</p>
 {barcodePopup.image && (
 <div className="mt-3 mb-4">
 <img src={barcodePopup.image} alt="Sent" className="max-h-24 mx-auto rounded ring-1 ring-green-300" />
 </div>
 )}
 <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 mb-4">
 
 <span className="text-sm font-medium">الصورة جاهزة</span>
 <span className="mx-1">—</span>
 
 <span className="text-sm font-medium">تم الإرسال</span>
 </div>
 <button
 onClick={() => setBarcodePopup({ show: false, step: 'generating', image: '', error: '' })}
 className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-bold"
 >
 تم
 </button>
 </div>
 )}

 {/* === خطأ === */}
 {barcodePopup.step === 'error' && (
 <div className="text-center py-6">
 <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
 <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-3">فشل العملية</h3>
 {barcodePopup.error && (
 <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
 <p className="text-sm text-red-700 dark:text-red-300">{barcodePopup.error}</p>
 </div>
 )}
 <button
 onClick={() => setBarcodePopup({ show: false, step: 'generating', image: '', error: '' })}
 className="w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold"
 >
 إغلاق
 </button>
 </div>
 )}
 </div>
 </div>
 )}

 {/* لايتبوكس تكبير صورة العضو — يقفل بالضغط أو Escape */}
 {zoomedImage && (
 <div
 className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-backdrop-in cursor-zoom-out"
 onClick={() => setZoomedImage(null)}
 role="dialog"
 aria-modal="true"
 >
 <img
 src={zoomedImage}
 alt={member?.name || ''}
 className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
 onClick={(e) => e.stopPropagation()}
 />
 <button
 type="button"
 onClick={() => setZoomedImage(null)}
 aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
 className="absolute top-4 end-4 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
 >
 <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
 </button>
 </div>
 )}

 {/* 📜 سجل رحلة العضو (Timeline) */}
 {showTimeline && (
 <div
 className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in flex items-center justify-center z-50 p-4"
 dir={direction}
 onClick={(e) => { if (e.target === e.currentTarget) setShowTimeline(false) }}
 >
 <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
 <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
 <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
 <svg className="w-5 h-5 text-primary-500" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
 {locale === 'ar' ? 'سجل رحلة العضو' : 'Member Journey'}
 </h3>
 <button
 type="button"
 onClick={() => setShowTimeline(false)}
 aria-label={locale === 'ar' ? 'إغلاق' : 'Close'}
 className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 flex items-center justify-center transition-colors"
 >
 <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
 </button>
 </div>
 <div className="p-4 overflow-y-auto">
 {timelineLoading ? (
 <div className="py-12 text-center text-gray-500 dark:text-gray-400">
 {locale === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}
 </div>
 ) : timelineEvents.length === 0 ? (
 <div className="py-12 text-center text-gray-500 dark:text-gray-400">
 {locale === 'ar' ? 'لا توجد أحداث' : 'No events'}
 </div>
 ) : (
 <ol className="relative border-s-2 border-gray-200 dark:border-gray-600 ms-3 space-y-5">
 {timelineEvents.map((ev, i) => (
 <li key={i} className="ms-5">
 <span className="absolute -start-[15px] flex items-center justify-center w-7 h-7 rounded-full bg-white dark:bg-gray-800 ring-2 ring-gray-200 dark:ring-gray-600 shadow-sm">
 {(() => {
 const v = timelineVisual(ev)
 return <svg className={`w-4 h-4 ${v.color}`} {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d={v.d} /></svg>
 })()}
 </span>
 <div className="flex items-center justify-between gap-2 flex-wrap">
 <p className="font-bold text-gray-900 dark:text-white text-sm">
 {ev.memberId && ev.memberId !== memberId ? (
 <Link href={`/members/${ev.memberId}`} className="hover:underline text-primary-600 dark:text-primary-400">
 {ev.title}
 </Link>
 ) : ev.title}
 </p>
 <time className="text-xs text-gray-400 font-mono">
 {new Date(ev.date).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
 </time>
 </div>
 {ev.detail && (
 <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ev.detail}</p>
 )}
 </li>
 ))}
 </ol>
 )}
 </div>
 </div>
 </div>
 )}

 {/* 🥋 مودال تعديل الـ PT / الكوتش */}
 {showPTEdit && ptSubscription && (
 <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" dir={direction} onClick={(e) => { if (e.target === e.currentTarget) setShowPTEdit(false) }}>
 <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[85vh] overflow-y-auto">
 <div className="flex justify-between items-center mb-5">
 <h3 className="text-xl font-bold dark:text-white">{locale === 'ar' ? `تعديل PT #${ptSubscription.ptNumber}` : `Edit PT #${ptSubscription.ptNumber}`}</h3>
 <button onClick={() => setShowPTEdit(false)} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 flex items-center justify-center">
 <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
 </button>
 </div>
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-bold mb-1.5 dark:text-gray-200">{locale === 'ar' ? 'الكوتش' : 'Coach'}</label>
 <select value={ptEditForm.coachName} onChange={(e) => setPtEditForm({ ...ptEditForm, coachName: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm">
 <option value="">{locale === 'ar' ? '— اختر الكوتش —' : '— Select coach —'}</option>
 {ptEditForm.coachName && !ptCoaches.some((c: any) => c.name === ptEditForm.coachName) && (
 <option value={ptEditForm.coachName}>{ptEditForm.coachName}</option>
 )}
 {ptCoaches.map((c: any) => (
 <option key={c.id} value={c.name}>{c.name}</option>
 ))}
 </select>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-sm font-bold mb-1.5 dark:text-gray-200">{locale === 'ar' ? 'الحصص المشتراة' : 'Purchased'}</label>
 <input type="number" min="0" value={ptEditForm.sessionsPurchased} onChange={(e) => setPtEditForm({ ...ptEditForm, sessionsPurchased: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm" />
 </div>
 <div>
 <label className="block text-sm font-bold mb-1.5 dark:text-gray-200">{locale === 'ar' ? 'الحصص المتبقية' : 'Remaining'}</label>
 <input type="number" min="0" value={ptEditForm.sessionsRemaining} onChange={(e) => setPtEditForm({ ...ptEditForm, sessionsRemaining: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm" />
 </div>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="block text-sm font-bold mb-1.5 dark:text-gray-200">{locale === 'ar' ? 'المبلغ المتبقي' : 'Remaining amount'}</label>
 <input type="number" min="0" value={ptEditForm.remainingAmount} onChange={(e) => setPtEditForm({ ...ptEditForm, remainingAmount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm" />
 </div>
 <div>
 <label className="block text-sm font-bold mb-1.5 dark:text-gray-200">{locale === 'ar' ? 'تاريخ الانتهاء' : 'Expiry'}</label>
 <input type="date" value={ptEditForm.expiryDate} onChange={(e) => setPtEditForm({ ...ptEditForm, expiryDate: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm" />
 </div>
 </div>
 <button onClick={savePTEdit} disabled={ptEditSaving} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-lg disabled:opacity-50 transition-colors">
 {ptEditSaving ? (locale === 'ar' ? 'جارٍ الحفظ…' : 'Saving…') : (locale === 'ar' ? 'حفظ' : 'Save')}
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 )
}
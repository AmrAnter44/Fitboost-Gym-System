'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { usePermissions } from '../../hooks/usePermissions'
import PermissionDenied from '../../components/PermissionDenied'
import FollowUpForm from './FollowUpForm'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast } from '../../contexts/ToastContext'

interface Visitor {
  id: string
  name: string
  phone: string
  source: string
  status: string
}

interface FollowUp {
  id: string
  notes: string
  contacted: boolean
  nextFollowUpDate?: string
  result?: string
  salesName?: string
  createdAt: string
  visitor: Visitor
}

interface Member {
  id: string
  phone: string
  name: string
  expiryDate?: string
  isActive: boolean
}

export default function FollowUpsPage() {
  const { hasPermission, loading: permissionsLoading } = usePermissions()
  const { t, direction } = useLanguage()
  const toast = useToast()

  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [allMembers, setAllMembers] = useState<Member[]>([]) // كل الأعضاء (نشطين ومنتهيين)
  const [dayUseRecords, setDayUseRecords] = useState<any[]>([])
  const [invitations, setInvitations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [selectedVisitorForHistory, setSelectedVisitorForHistory] = useState<Visitor | null>(null)
  const [selectedVisitorId, setSelectedVisitorId] = useState<string>('')

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [resultFilter, setResultFilter] = useState('all')
  const [contactedFilter, setContactedFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all') // ✅ فلتر المصدر
  const [expiringDays, setExpiringDays] = useState(30) // عدد الأيام للأعضاء اللي قرب اشتراكهم ينتهي

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // ✅ حساب الأعضاء المنتهيين
  const expiredMembers = useMemo(() => {
    const today = new Date()
    return allMembers
      .filter(m => {
        if (!m.expiryDate) return false
        const expiryDate = new Date(m.expiryDate)
        return expiryDate < today && m.isActive === false
      })
      .map(m => ({
        id: `expired-${m.id}`,
        name: `${m.name} (عضو منتهي)`,
        phone: m.phone,
        source: 'expired-member',
        status: 'expired'
      }))
  }, [allMembers])

  // ✅ حساب الأعضاء اللي اشتراكهم قرب ينتهي (حسب عدد الأيام المحدد)
  const expiringMembers = useMemo(() => {
    const today = new Date()
    const futureDate = new Date()
    futureDate.setDate(today.getDate() + expiringDays)

    return allMembers
      .filter(m => {
        if (!m.expiryDate || !m.isActive) return false
        const expiryDate = new Date(m.expiryDate)
        // الأعضاء النشطين اللي اشتراكهم هينتهي في خلال الأيام المحددة
        return expiryDate > today && expiryDate <= futureDate
      })
      .map(m => {
        const expiryDate = new Date(m.expiryDate!)
        const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        return {
          id: `expiring-${m.id}`,
          name: `${m.name} (باقي ${daysLeft} يوم)`,
          phone: m.phone,
          source: 'expiring-member',
          status: 'expiring',
          daysLeft
        }
      })
  }, [allMembers, expiringDays])

  // ✅ دمج المتابعات الحقيقية مع الأعضاء المنتهيين + الأعضاء القريبين من الانتهاء + Day Use + Invitations
  const allFollowUps = useMemo(() => {
    // 1. الأعضاء المنتهيين
    const expiredFollowUps: FollowUp[] = expiredMembers.map(member => ({
      id: member.id,
      notes: 'عضو منتهي - يحتاج تجديد اشتراك',
      contacted: false,
      nextFollowUpDate: new Date().toISOString(),
      result: undefined,
      salesName: 'نظام',
      createdAt: new Date().toISOString(),
      visitor: member
    }))

    // 2. الأعضاء اللي اشتراكهم قرب ينتهي
    const expiringFollowUps: FollowUp[] = expiringMembers.map((member: any) => ({
      id: member.id,
      notes: `اشتراك قرب ينتهي - باقي ${member.daysLeft} يوم فقط`,
      contacted: false,
      nextFollowUpDate: new Date().toISOString(),
      result: undefined,
      salesName: 'نظام',
      createdAt: new Date().toISOString(),
      visitor: member
    }))

    // 3. Day Use (استخدام InBody يوم واحد)
    const dayUseFollowUps: FollowUp[] = dayUseRecords.map(record => ({
      id: `dayuse-${record.id}`,
      notes: `استخدام ${record.serviceType} - فرصة للاشتراك`,
      contacted: false,
      nextFollowUpDate: new Date().toISOString(),
      result: undefined,
      salesName: record.staffName || 'نظام',
      createdAt: record.createdAt,
      visitor: {
        id: `dayuse-${record.id}`,
        name: record.name,
        phone: record.phone,
        source: 'invitation', // 🎁 استخدام يوم
        status: 'pending'
      }
    }))

    // 4. Invitations (دعوات من أعضاء)
    const invitationFollowUps: FollowUp[] = invitations.map(inv => ({
      id: `invitation-${inv.id}`,
      notes: `دعوة من عضو - ${inv.member?.name || 'عضو'}`,
      contacted: false,
      nextFollowUpDate: new Date().toISOString(),
      result: undefined,
      salesName: 'نظام',
      createdAt: inv.createdAt,
      visitor: {
        id: `invitation-${inv.id}`,
        name: inv.guestName,
        phone: inv.guestPhone,
        source: 'member-invitation', // 👥 دعوة من عضو
        status: 'pending'
      }
    }))

    return [...followUps, ...expiredFollowUps, ...expiringFollowUps, ...dayUseFollowUps, ...invitationFollowUps]
  }, [followUps, expiredMembers, expiringMembers, dayUseRecords, invitations])

  const fetchFollowUps = async () => {
    try {
      const response = await fetch('/api/visitors/followups')
      const data = await response.json()
      setFollowUps(data || [])
      console.log('📝 عدد المتابعات:', (data || []).length)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchVisitors = async () => {
    try {
      const response = await fetch('/api/visitors')
      const data = await response.json()
      setVisitors(data.visitors || [])
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const fetchMembers = async () => {
    try {
      const response = await fetch('/api/members')
      const data = await response.json()

      // حفظ كل الأعضاء
      setAllMembers(data || [])

      // حفظ الأعضاء النشطين فقط (isActive = true)
      const activeMembers = (data || []).filter((m: Member) => m.isActive === true)
      setMembers(activeMembers)

      // حساب الأعضاء المنتهيين
      const today = new Date()
      const expired = (data || []).filter((m: Member) => {
        if (!m.expiryDate) return false
        const expiryDate = new Date(m.expiryDate)
        return expiryDate < today && m.isActive === false
      })

      console.log('📊 إجمالي الأعضاء:', data?.length || 0)
      console.log('✅ عدد الأعضاء النشطين:', activeMembers.length)
      console.log('❌ عدد الأعضاء المنتهيين:', expired.length)
    } catch (error) {
      console.error('Error fetching members:', error)
    }
  }

  const fetchDayUse = async () => {
    try {
      const response = await fetch('/api/dayuse')
      const data = await response.json()
      setDayUseRecords(data || [])
      console.log('🎯 عدد استخدامات InBody:', (data || []).length)
    } catch (error) {
      console.error('Error fetching day use:', error)
    }
  }

  const fetchInvitations = async () => {
    try {
      const response = await fetch('/api/invitations')
      const data = await response.json()
      setInvitations(data || [])
      console.log('🎁 عدد الدعوات:', (data || []).length)
    } catch (error) {
      console.error('Error fetching invitations:', error)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchFollowUps(),
        fetchVisitors(),
        fetchMembers(),
        fetchDayUse(),
        fetchInvitations()
      ])
    }
    loadData()
  }, [])

  const handleSubmit = async (formData: {
    visitorId: string
    salesName: string
    notes: string
    result: string
    nextFollowUpDate: string
    contacted: boolean
  }) => {
    try {
      // ✅ البحث عن بيانات الزائر/العضو للإرسال إلى الـ API
      let visitorData = null

      // البحث في الزوار
      const visitor = visitors.find(v => v.id === formData.visitorId)
      if (visitor) {
        visitorData = { name: visitor.name, phone: visitor.phone, source: visitor.source }
      }

      // البحث في الأعضاء المنتهيين
      const expMember = expiredMembers.find((m: any) => m.id === formData.visitorId)
      if (expMember) {
        const cleanName = expMember.name.replace(' (عضو منتهي)', '').trim()
        visitorData = { name: cleanName, phone: expMember.phone, source: 'expired-member' }
      }

      // البحث في الأعضاء القريبين من الانتهاء
      const expiringMember = expiringMembers.find((m: any) => m.id === formData.visitorId)
      if (expiringMember) {
        const cleanName = expiringMember.name.replace(/\s*\(باقي \d+ يوم\)/, '').trim()
        visitorData = { name: cleanName, phone: expiringMember.phone, source: 'expiring-member' }
      }

      // البحث في Day Use
      const dayUse = dayUseRecords.find(r => `dayuse-${r.id}` === formData.visitorId)
      if (dayUse) {
        visitorData = { name: dayUse.name, phone: dayUse.phone, source: 'invitation' }
      }

      // البحث في Invitations
      const invitation = invitations.find(inv => `invitation-${inv.id}` === formData.visitorId)
      if (invitation) {
        visitorData = { name: invitation.guestName, phone: invitation.guestPhone, source: 'member-invitation' }
      }

      const response = await fetch('/api/visitors/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, visitorData }),
      })

      if (response.ok) {
        toast.success('تم إضافة المتابعة بنجاح!')
        await fetchFollowUps()
        setShowForm(false)
        setSelectedVisitorId('')
      } else {
        const data = await response.json()
        toast.error(data.error || 'فشل إضافة المتابعة')
      }
    } catch (error) {
      console.error(error)
      toast.error('حدث خطأ')
    }
  }

  const openQuickFollowUp = (visitor: Visitor) => {
    setSelectedVisitorId(visitor.id)
    setShowForm(true)
    // لا نحتاج scroll - هيظهر كـ modal
  }

  // تنظيف رقم التليفون
  const normalizePhone = (phone: string) => {
    if (!phone) return ''
    let normalized = phone.replace(/[\s\-\(\)\+]/g, '').trim()
    if (normalized.startsWith('2')) normalized = normalized.substring(1)
    if (normalized.startsWith('0')) normalized = normalized.substring(1)
    return normalized
  }

  const openHistoryModal = (visitor: Visitor) => {
    setSelectedVisitorForHistory(visitor)
    setShowHistoryModal(true)
  }

  // Memoize history to avoid recalculation on every render
  const visitorHistory = useMemo(() => {
    if (!selectedVisitorForHistory) return []
    const normalizedPhone = normalizePhone(selectedVisitorForHistory.phone)
    return followUps.filter(fu => {
      const fuPhone = normalizePhone(fu.visitor.phone)
      return fuPhone === normalizedPhone
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [selectedVisitorForHistory, followUps])

  // التحقق من أن الزائر أصبح عضو
  const isVisitorAMember = (phone: string) => {
    const normalizedVisitorPhone = normalizePhone(phone)
    const matchedMember = members.find(member => {
      const normalizedMemberPhone = normalizePhone(member.phone)
      return normalizedMemberPhone === normalizedVisitorPhone
    })
    return !!matchedMember
  }

  // التحقق من أن العضو المنتهي جدد اشتراكه (أصبح نشط)
  const hasExpiredMemberRenewed = (phone: string) => {
    const normalizedVisitorPhone = normalizePhone(phone)
    // البحث في الأعضاء النشطين (members)
    const matchedMember = members.find(member => {
      const normalizedMemberPhone = normalizePhone(member.phone)
      return normalizedMemberPhone === normalizedVisitorPhone
    })
    return !!matchedMember
  }

  // حساب أولوية المتابعة
  const getFollowUpPriority = (followUp: FollowUp) => {
    if (!followUp.nextFollowUpDate) return 'none'

    const nextDate = new Date(followUp.nextFollowUpDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    nextDate.setHours(0, 0, 0, 0)

    if (nextDate < today) return 'overdue'
    if (nextDate.getTime() === today.getTime()) return 'today'
    return 'upcoming'
  }

  // فلترة النتائج
  const filteredFollowUps = useMemo(() => {
    return allFollowUps
      .filter(fu => {
        const matchesSearch =
          fu.visitor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          fu.visitor.phone.includes(searchTerm) ||
          fu.notes.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (fu.salesName && fu.salesName.toLowerCase().includes(searchTerm.toLowerCase()))

        const matchesResult = resultFilter === 'all' || fu.result === resultFilter
        const matchesContacted = contactedFilter === 'all' ||
          (contactedFilter === 'contacted' && fu.contacted) ||
          (contactedFilter === 'not-contacted' && !fu.contacted)

        const priority = getFollowUpPriority(fu)
        const matchesPriority = priorityFilter === 'all' || priority === priorityFilter

        // ✅ فلترة حسب المصدر
        let matchesSource = true
        if (sourceFilter !== 'all') {
          if (sourceFilter === 'expired-member') {
            matchesSource = fu.visitor.source === 'expired-member'
          } else if (sourceFilter === 'expiring-member') {
            matchesSource = fu.visitor.source === 'expiring-member'
          } else if (sourceFilter === 'member-invitation') {
            matchesSource = fu.visitor.source === 'member-invitation'
          } else if (sourceFilter === 'dayuse') {
            matchesSource = fu.visitor.source === 'invitation'
          } else if (sourceFilter === 'visitors') {
            // زوار عاديين (walk-in, social-media, etc.)
            matchesSource = !['expired-member', 'expiring-member', 'member-invitation', 'invitation'].includes(fu.visitor.source)
          }
        }

        // ✅ فلتر جديد: إخفاء المشتركين والمجددين
        const isMember = isVisitorAMember(fu.visitor.phone)
        const isExpired = fu.visitor.source === 'expired-member'
        const isExpiring = fu.visitor.source === 'expiring-member'
        const hasRenewed = isExpired && hasExpiredMemberRenewed(fu.visitor.phone)

        // إخفاء الحالات التالية:
        // 1. زائر عادي أصبح عضو نشط
        if (isMember && !isExpired && !isExpiring) {
          return false
        }

        // 2. عضو منتهي جدد اشتراكه
        if (hasRenewed) {
          return false
        }

        // 3. عضو قريب من الانتهاء لكن جدد مبكراً
        if (isExpiring && isMember) {
          return false
        }

        return matchesSearch && matchesResult && matchesContacted && matchesPriority && matchesSource
      })
      .sort((a, b) => {
        // ✅ ترتيب جديد حسب الأولوية
        const aPriority = getFollowUpPriority(a)
        const bPriority = getFollowUpPriority(b)

        // ترتيب: overdue > today > upcoming > none
        const priorityOrder: {[key: string]: number} = { overdue: 0, today: 1, upcoming: 2, none: 3 }
        return priorityOrder[aPriority] - priorityOrder[bPriority]
      })
  }, [allFollowUps, searchTerm, resultFilter, contactedFilter, priorityFilter, sourceFilter, members])

  // إعادة تعيين الصفحة للأولى عند تغيير الفلاتر
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, resultFilter, contactedFilter, priorityFilter, sourceFilter])

  // حساب الصفحات
  const totalPages = Math.ceil(filteredFollowUps.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentFollowUps = filteredFollowUps.slice(startIndex, endIndex)

  const goToPage = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const getResultBadge = (result?: string) => {
    const badges = {
      interested: 'bg-green-100 text-green-800',
      'not-interested': 'bg-red-100 text-red-800',
      postponed: 'bg-yellow-100 text-yellow-800',
      subscribed: 'bg-blue-100 text-blue-800',
    }
    const labels: Record<string, string> = {
      interested: t('followups.results.interested'),
      'not-interested': t('followups.results.notInterested'),
      postponed: t('followups.results.postponed'),
      subscribed: t('followups.results.subscribed'),
    }
    if (!result) return <span className="text-gray-400">-</span>
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[result as keyof typeof badges] || 'bg-gray-100 text-gray-800'}`}>
        {labels[result] || result}
      </span>
    )
  }

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      'walk-in': t('followups.sources.walkIn'),
      'invitation': t('followups.sources.invitation'),
      'member-invitation': t('followups.sources.memberInvitation'),
      'expired-member': t('followups.sources.expiredMember'),
      'expiring-member': t('followups.sources.expiringMember'),
      'facebook': t('followups.sources.facebook'),
      'instagram': t('followups.sources.instagram'),
      'friend': t('followups.sources.friend'),
      'other': t('followups.sources.other'),
    }
    return labels[source] || source
  }

  const getPriorityBadge = (followUp: FollowUp) => {
    const priority = getFollowUpPriority(followUp)

    if (priority === 'overdue') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
          🔥 {t('followups.priority.overdue')}
        </span>
      )
    }
    if (priority === 'today') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800">
          ⚡ {t('followups.priority.today')}
        </span>
      )
    }
    if (priority === 'upcoming') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          📅 {t('followups.priority.upcoming')}
        </span>
      )
    }
    return null
  }

  // Stats
  const stats = {
    total: allFollowUps.length,
    today: allFollowUps.filter(fu => getFollowUpPriority(fu) === 'today').length,
    overdue: allFollowUps.filter(fu => getFollowUpPriority(fu) === 'overdue').length,
    contactedToday: followUps.filter(fu => {
      const today = new Date().toDateString()
      return fu.contacted && new Date(fu.createdAt).toDateString() === today
    }).length,
    expiredMembers: expiredMembers.length,
    expiringMembers: expiringMembers.length,
    dayUse: dayUseRecords.length,
    invitations: invitations.length,
    visitors: visitors.length,
    convertedToMembers: followUps.filter(fu => isVisitorAMember(fu.visitor.phone)).length,

    // ✅ إحصائية جديدة: عدد المتابعات المخفية (اللي اشتركوا)
    subscribedAndHidden: allFollowUps.filter(fu => {
      const isMember = isVisitorAMember(fu.visitor.phone)
      const isExpired = fu.visitor.source === 'expired-member'
      const isExpiring = fu.visitor.source === 'expiring-member'
      const hasRenewed = isExpired && hasExpiredMemberRenewed(fu.visitor.phone)

      // نفس شروط الإخفاء
      return (isMember && !isExpired && !isExpiring) || hasRenewed || (isExpiring && isMember)
    }).length
  }

  // التحقق من الصلاحيات
  if (permissionsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl">{t('followups.loading')}</div>
      </div>
    )
  }

  if (!hasPermission('canViewFollowUps')) {
    return <PermissionDenied message={t('followups.permissionDenied')} />
  }

  return (
    <div className="container mx-auto px-4 py-6 md:px-6" dir={direction}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <span>📝</span>
              <span>{t('followups.title')}</span>
            </h1>
            <p className="text-gray-600 mt-2">{t('followups.subtitle')}</p>
          </div>
          <button
            onClick={() => {
              setShowForm(!showForm)
              setSelectedVisitorId('')
            }}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold shadow-lg"
          >
            {showForm ? `❌ ${t('followups.close')}` : `➕ ${t('followups.addNew')}`}
          </button>
        </div>

        {/* Filter for Expiring Days */}
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-bold text-yellow-900 mb-2">
                ⏰ {t('followups.filters.expiringDays')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={expiringDays}
                  onChange={(e) => setExpiringDays(Number(e.target.value))}
                  className="px-4 py-2 border-2 border-yellow-400 rounded-lg font-bold text-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 w-24"
                />
                <span className="text-lg font-bold text-yellow-900">{t('followups.days')}</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs text-yellow-800 mb-1">{t('followups.stats.membersCount')}</p>
              <p className="text-4xl font-bold text-yellow-900">{stats.expiringMembers}</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-4 shadow-lg">
            <p className="text-xs opacity-90 mb-1">{t('followups.stats.total')}</p>
            <p className="text-3xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-xl p-4 shadow-lg">
            <p className="text-xs opacity-90 mb-1">🔥 {t('followups.stats.overdue')}</p>
            <p className="text-3xl font-bold">{stats.overdue}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-4 shadow-lg">
            <p className="text-xs opacity-90 mb-1">⚡ {t('followups.stats.today')}</p>
            <p className="text-3xl font-bold">{stats.today}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-4 shadow-lg">
            <p className="text-xs opacity-90 mb-1">❌ {t('followups.stats.expiredMembers')}</p>
            <p className="text-3xl font-bold">{stats.expiredMembers}</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white rounded-xl p-4 shadow-lg">
            <p className="text-xs opacity-90 mb-1">⏰ {t('followups.stats.expiringMembers')}</p>
            <p className="text-3xl font-bold">{stats.expiringMembers}</p>
          </div>
          <div className="bg-gradient-to-br from-pink-500 to-pink-600 text-white rounded-xl p-4 shadow-lg">
            <p className="text-xs opacity-90 mb-1">🎁 {t('followups.stats.dayUse')}</p>
            <p className="text-3xl font-bold">{stats.dayUse}</p>
          </div>
          <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white rounded-xl p-4 shadow-lg">
            <p className="text-xs opacity-90 mb-1">👥 {t('followups.stats.invitations')}</p>
            <p className="text-3xl font-bold">{stats.invitations}</p>
          </div>
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-xl p-4 shadow-lg">
            <p className="text-xs opacity-90 mb-1">👤 {t('followups.stats.visitors')}</p>
            <p className="text-3xl font-bold">{stats.visitors}</p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-4 shadow-lg">
            <p className="text-xs opacity-90 mb-1">✅ {t('followups.stats.contactedToday')}</p>
            <p className="text-3xl font-bold">{stats.contactedToday}</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-xl p-4 shadow-lg">
            <p className="text-xs opacity-90 mb-1">🎉 {t('followups.stats.subscribedAndHidden')}</p>
            <p className="text-3xl font-bold">{stats.subscribedAndHidden}</p>
          </div>
        </div>
      </div>

      {/* Add Follow-Up Form - Modal Popup (Lightweight) */}
      {showForm && (
        <FollowUpForm
          visitors={visitors}
          expiredMembers={expiredMembers}
          expiringMembers={expiringMembers}
          dayUseRecords={dayUseRecords}
          invitations={invitations}
          initialVisitorId={selectedVisitorId}
          onSubmit={handleSubmit}
          onClose={() => {
            setShowForm(false)
            setSelectedVisitorId('')
          }}
        />
      )}

      {/* History Modal - سجل المتابعات (Lightweight) */}
      {showHistoryModal && selectedVisitorForHistory && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowHistoryModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-purple-600 text-white p-4 rounded-t-lg flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <span>📋</span>
                  <span>{t('followups.history.title')}</span>
                </h2>
                <p className="text-xs opacity-90 mt-0.5">
                  {selectedVisitorForHistory.name} - {selectedVisitorForHistory.phone}
                </p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-4">
              {visitorHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📭</div>
                  <p className="text-sm">{t('followups.history.noHistory')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                    <p className="text-sm font-bold text-purple-900">
                      {t('followups.history.total')}: <span className="text-2xl">{visitorHistory.length}</span>
                    </p>
                  </div>

                  {visitorHistory.map((fu, index) => (
                    <div
                      key={fu.id}
                      className={`border rounded-lg p-3 ${
                        fu.contacted ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl font-bold text-gray-400">#{visitorHistory.length - index}</span>
                            <span className="text-xs text-gray-500">
                              {new Date(fu.createdAt).toLocaleDateString('ar-EG')}
                            </span>
                            {fu.contacted ? (
                              <span className="text-green-700 font-bold text-xs">✅ {t('followups.history.contacted')}</span>
                            ) : (
                              <span className="text-orange-600 font-bold text-xs">⏳ {t('followups.history.notContacted')}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {fu.result && getResultBadge(fu.result)}
                          {fu.salesName && (
                            <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-xs">
                              {fu.salesName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="bg-white p-2 rounded border border-gray-200 mb-2">
                        <p className="text-sm text-gray-800">{fu.notes}</p>
                      </div>

                      {fu.nextFollowUpDate && (
                        <div className="text-xs text-gray-600">
                          📅 {t('followups.history.nextFollowUp')}: <span className="font-bold">{new Date(fu.nextFollowUpDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">🔍 {t('followups.filters.search')}</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('followups.filters.searchPlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">📂 {t('followups.filters.source')}</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t('followups.filters.all')}</option>
              <option value="expired-member">❌ {t('followups.sources.expiredMembers')}</option>
              <option value="expiring-member">⏰ {t('followups.sources.expiringMembers')}</option>
              <option value="member-invitation">👥 {t('followups.sources.memberInvitations')}</option>
              <option value="dayuse">🎁 {t('followups.sources.dayUse')}</option>
              <option value="visitors">👤 {t('followups.sources.visitors')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">📊 {t('followups.filters.priority')}</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t('followups.filters.all')}</option>
              <option value="overdue">🔥 {t('followups.priority.overdue')}</option>
              <option value="today">⚡ {t('followups.priority.today')}</option>
              <option value="upcoming">📅 {t('followups.priority.upcoming')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">📈 {t('followups.filters.result')}</label>
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t('followups.filters.all')}</option>
              <option value="interested">✅ {t('followups.results.interested')}</option>
              <option value="not-interested">❌ {t('followups.results.notInterested')}</option>
              <option value="postponed">⏸️ {t('followups.results.postponed')}</option>
              <option value="subscribed">🎉 {t('followups.results.subscribed')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">📞 {t('followups.filters.contacted')}</label>
            <select
              value={contactedFilter}
              onChange={(e) => setContactedFilter(e.target.value)}
              className="w-full px-3 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t('followups.filters.all')}</option>
              <option value="contacted">✅ {t('followups.filters.contactedYes')}</option>
              <option value="not-contacted">❌ {t('followups.filters.contactedNo')}</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Buttons */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setSourceFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              sourceFilter === 'all'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('followups.filters.all')} ({allFollowUps.length})
          </button>
          <button
            onClick={() => setSourceFilter('expired-member')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              sourceFilter === 'expired-member'
                ? 'bg-red-600 text-white shadow-lg'
                : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            ❌ {t('followups.sources.expiredMembers')} ({stats.expiredMembers})
          </button>
          <button
            onClick={() => setSourceFilter('expiring-member')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              sourceFilter === 'expiring-member'
                ? 'bg-yellow-600 text-white shadow-lg'
                : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
            }`}
          >
            ⏰ {t('followups.sources.expiringMembers')} ({stats.expiringMembers})
          </button>
          <button
            onClick={() => setSourceFilter('member-invitation')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              sourceFilter === 'member-invitation'
                ? 'bg-cyan-600 text-white shadow-lg'
                : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
            }`}
          >
            👥 {t('followups.sources.memberInvitations')} ({stats.invitations})
          </button>
          <button
            onClick={() => setSourceFilter('dayuse')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              sourceFilter === 'dayuse'
                ? 'bg-pink-600 text-white shadow-lg'
                : 'bg-pink-50 text-pink-700 hover:bg-pink-100'
            }`}
          >
            🎁 {t('followups.sources.dayUse')} ({stats.dayUse})
          </button>
          <button
            onClick={() => setSourceFilter('visitors')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
              sourceFilter === 'visitors'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            👤 {t('followups.sources.visitors')} ({stats.visitors})
          </button>
        </div>
      </div>

      {/* Follow-Ups Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">⏳</div>
          <p className="text-xl">{t('followups.loading')}</p>
        </div>
      ) : (
        <>
          {/* Mobile Cards View */}
          <div className="md:hidden space-y-4 mb-6">
            {currentFollowUps.map((followUp) => {
              const isExpired = followUp.visitor.source === 'expired-member'
              const isExpiring = followUp.visitor.source === 'expiring-member'

              return (
                <div
                  key={followUp.id}
                  className={`bg-white rounded-lg shadow-md p-4 ${
                    isExpired
                      ? 'border-r-4 border-red-500'
                      : isExpiring
                      ? 'border-r-4 border-yellow-500'
                      : 'border-r-4 border-blue-500'
                  }`}
                >
                  {/* Action Buttons at Top */}
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      {getPriorityBadge(followUp)}
                    </div>
                    <div className="flex gap-2">
                      {isExpired && (
                        <button
                          onClick={() => openQuickFollowUp(followUp.visitor)}
                          className="text-red-600 hover:text-red-800 text-xs font-medium px-2 py-1 rounded bg-red-50 hover:bg-red-100"
                        >
                          ➕
                        </button>
                      )}
                      {!isExpired && (
                        <button
                          onClick={() => openQuickFollowUp(followUp.visitor)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium px-2 py-1 rounded bg-blue-50 hover:bg-blue-100"
                        >
                          ➕
                        </button>
                      )}
                      <button
                        onClick={() => openHistoryModal(followUp.visitor)}
                        className="text-purple-600 hover:text-purple-800 text-xs font-medium px-2 py-1 rounded bg-purple-50 hover:bg-purple-100"
                      >
                        📋
                      </button>
                    </div>
                  </div>

                  {/* Follow-up Info */}
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 text-sm min-w-[70px]">👤 {t('followups.table.name')}:</span>
                      <span className={`font-bold ${
                        isExpired ? 'text-red-700' : 'text-gray-900'
                      }`}>
                        {followUp.visitor.name}
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 text-sm min-w-[70px]">📱 {t('followups.table.phone')}:</span>
                      <a
                        href={`https://wa.me/2${followUp.visitor.phone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-medium text-sm ${
                          isExpired
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                        }`}
                      >
                        <span>💬</span>
                        <span>{followUp.visitor.phone}</span>
                      </a>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 text-sm min-w-[70px]">📂 {t('followups.table.source')}:</span>
                      <span className={`${
                        followUp.visitor.source === 'invitation'
                          ? 'bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium'
                          : followUp.visitor.source === 'member-invitation'
                          ? 'bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium'
                          : followUp.visitor.source === 'expired-member'
                          ? 'bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-bold'
                          : followUp.visitor.source === 'expiring-member'
                          ? 'bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-bold'
                          : 'text-gray-600 text-sm'
                      }`}>
                        {getSourceLabel(followUp.visitor.source)}
                      </span>
                    </div>

                    {followUp.salesName && (
                      <div className="flex items-start gap-2">
                        <span className="text-gray-500 text-sm min-w-[70px]">🧑‍💼 {t('followups.table.sales')}:</span>
                        <span className="text-orange-600 font-semibold text-sm">{followUp.salesName}</span>
                      </div>
                    )}

                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 text-sm min-w-[70px]">📝 {t('followups.table.notes')}:</span>
                      <p className="text-sm text-gray-700 flex-1">{followUp.notes}</p>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 text-sm min-w-[70px]">📊 {t('followups.table.result')}:</span>
                      {getResultBadge(followUp.result)}
                    </div>

                    {followUp.nextFollowUpDate && (
                      <div className="flex items-start gap-2">
                        <span className="text-gray-500 text-sm min-w-[70px]">📅 {t('followups.table.nextFollowUp')}:</span>
                        <span className="text-sm font-medium">
                          {new Date(followUp.nextFollowUpDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                        </span>
                      </div>
                    )}

                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 text-sm min-w-[70px]">📅 {t('followups.table.date')}:</span>
                      <span className="text-xs text-gray-500">
                        {new Date(followUp.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 text-sm min-w-[70px]">📞 {t('followups.table.contacted')}:</span>
                      {followUp.contacted ? (
                        <span className="text-green-600 text-sm">✅ {t('followups.labels.contactedYes')}</span>
                      ) : (
                        <span className="text-orange-600 text-sm">⏳ {t('followups.labels.contactedNo')}</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {filteredFollowUps.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                {searchTerm || resultFilter !== 'all' || contactedFilter !== 'all' || priorityFilter !== 'all' ? (
                  <>
                    <div className="text-5xl mb-3">🔍</div>
                    <p>{t('followups.messages.noResults')}</p>
                  </>
                ) : (
                  <>
                    <div className="text-5xl mb-3">📝</div>
                    <p>{t('followups.messages.noFollowups')}</p>
                    <button
                      onClick={() => setShowForm(true)}
                      className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                    >
                      ➕ {t('followups.messages.addFirst')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <tr>
                  <th className={`px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('followups.table.priority')}</th>
                  <th className={`px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('followups.table.visitor')}</th>
                  <th className={`px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('followups.table.phone')}</th>
                  <th className={`px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('followups.table.source')}</th>
                  <th className={`px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('followups.table.sales')}</th>
                  <th className={`px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('followups.table.notes')}</th>
                  <th className={`px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('followups.table.result')}</th>
                  <th className={`px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('followups.table.nextFollowUp')}</th>
                  <th className={`px-4 py-3 text-${direction === 'rtl' ? 'right' : 'left'}`}>{t('followups.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {currentFollowUps.map((followUp) => {
                  const isExpired = followUp.visitor.source === 'expired-member'
                  const isExpiring = followUp.visitor.source === 'expiring-member'

                  return (
                  <tr
                    key={followUp.id}
                    className={`border-t transition-colors ${
                      isExpired
                        ? 'bg-red-50 hover:bg-red-100'
                        : isExpiring
                        ? 'bg-yellow-50 hover:bg-yellow-100'
                        : 'hover:bg-blue-50'
                    }`}
                  >
                    <td className="px-4 py-3">
                      {getPriorityBadge(followUp)}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className={`font-semibold ${
                          isExpired ? 'text-red-700' : 'text-gray-900'
                        }`}>
                          {followUp.visitor.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {followUp.contacted ? (
                            <span className="text-green-600">✅ {t('followups.labels.contactedYes')}</span>
                          ) : (
                            <span className="text-orange-600">⏳ {t('followups.labels.contactedNo')}</span>
                          )}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`https://wa.me/2${followUp.visitor.phone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg font-medium text-sm transition-colors ${
                          isExpired
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                        }`}
                      >
                        <span>💬</span>
                        <span>{followUp.visitor.phone}</span>
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`${
                        followUp.visitor.source === 'invitation'
                          ? 'bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium'
                          : followUp.visitor.source === 'member-invitation'
                          ? 'bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium'
                          : followUp.visitor.source === 'expired-member'
                          ? 'bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-bold'
                          : followUp.visitor.source === 'expiring-member'
                          ? 'bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-bold'
                          : 'text-gray-600'
                      }`}>
                        {getSourceLabel(followUp.visitor.source)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {followUp.salesName ? (
                        <span className="text-orange-600 font-semibold flex items-center gap-1">
                          <span>👤</span>
                          <span>{followUp.salesName}</span>
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-gray-700 max-w-xs" title={followUp.notes}>
                          {followUp.notes.length > 50 ? followUp.notes.substring(0, 50) + '...' : followUp.notes}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(followUp.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getResultBadge(followUp.result)}
                    </td>
                    <td className="px-4 py-3">
                      {followUp.nextFollowUpDate ? (
                        <span className="text-sm font-medium">
                          {new Date(followUp.nextFollowUpDate).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        {isExpired && (
                          <button
                            onClick={() => openQuickFollowUp(followUp.visitor)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium px-3 py-1 rounded bg-red-50 hover:bg-red-100"
                            title={t('followups.actions.addFollowupRenewal')}
                          >
                            ➕ {t('followups.actions.followup')}
                          </button>
                        )}
                        {!isExpired && (
                          <button
                            onClick={() => openQuickFollowUp(followUp.visitor)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium px-3 py-1 rounded bg-blue-50 hover:bg-blue-100"
                            title={t('followups.actions.addFollowupNew')}
                          >
                            ➕ {t('followups.actions.followup')}
                          </button>
                        )}

                        {/* زر سجل المتابعات */}
                        <button
                          onClick={() => openHistoryModal(followUp.visitor)}
                          className="text-purple-600 hover:text-purple-800 text-sm font-medium px-3 py-1 rounded bg-purple-50 hover:bg-purple-100"
                          title={t('followups.actions.viewHistory')}
                        >
                          📋 {t('followups.actions.history')}
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                )}
              </tbody>
            </table>
          </div>

            {filteredFollowUps.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                {searchTerm || resultFilter !== 'all' || contactedFilter !== 'all' || priorityFilter !== 'all' ? (
                  <>
                    <div className="text-5xl mb-3">🔍</div>
                    <p>{t('followups.messages.noResults')}</p>
                  </>
                ) : (
                  <>
                    <div className="text-5xl mb-3">📝</div>
                    <p>{t('followups.messages.noFollowups')}</p>
                    <button
                      onClick={() => setShowForm(true)}
                      className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                    >
                      ➕ {t('followups.messages.addFirst')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {filteredFollowUps.length > 0 && (
            <div className="mt-6 bg-white rounded-lg shadow-md p-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                {/* معلومات الصفحة */}
                <div className="text-sm text-gray-600">
                  {t('followups.pagination.showing')} {startIndex + 1} {t('followups.pagination.to')} {Math.min(endIndex, filteredFollowUps.length)} {t('followups.pagination.of')} {filteredFollowUps.length} {t('followups.pagination.followups')}
                </div>

                {/* عدد العناصر في الصفحة */}
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">{t('followups.pagination.itemsPerPage')}:</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                {/* أزرار التنقل */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => goToPage(1)}
                      disabled={currentPage === 1}
                      className="px-3 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      {t('followups.pagination.first')}
                    </button>
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      {t('followups.pagination.previous')}
                    </button>

                    {/* أرقام الصفحات */}
                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }

                        return (
                          <button
                            key={pageNum}
                            onClick={() => goToPage(pageNum)}
                            className={`px-3 py-2 rounded-lg font-medium ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            {pageNum}
                          </button>
                        )
                      })}
                    </div>

                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      {t('followups.pagination.next')}
                    </button>
                    <button
                      onClick={() => goToPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      {t('followups.pagination.last')}
                    </button>
                  </div>
                )}
              </div>

              {/* معلومات إضافية */}
              <div className="mt-4 text-center text-sm text-gray-500">
                {t('followups.pagination.page')} {currentPage} {t('followups.pagination.of')} {totalPages}
              </div>
            </div>
          )}
        </>
      )}

      {/* Success Rate */}
      <div className="mt-6 bg-gradient-to-br from-green-500 to-green-600 border-r-4 border-green-700 p-6 rounded-xl shadow-lg">
        <h3 className="font-bold text-white mb-4 flex items-center gap-2 text-xl">
          <span>🎯</span>
          <span>{t('followups.successRate.title')}</span>
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/90 backdrop-blur p-5 rounded-lg shadow-md">
            <p className="text-sm text-gray-600 font-medium mb-1">{t('followups.successRate.totalFollowups')}</p>
            <p className="text-4xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white/90 backdrop-blur p-5 rounded-lg shadow-md">
            <p className="text-sm text-gray-600 font-medium mb-1">{t('followups.successRate.convertedToMembers')}</p>
            <p className="text-4xl font-bold text-green-600">{stats.convertedToMembers}</p>
          </div>
          <div className="bg-white/90 backdrop-blur p-5 rounded-lg shadow-md">
            <p className="text-sm text-gray-600 font-medium mb-1">{t('followups.successRate.conversionRate')}</p>
            <p className="text-4xl font-bold text-blue-600">
              {stats.total > 0 ? ((stats.convertedToMembers / stats.total) * 100).toFixed(1) : '0'}%
            </p>
          </div>
        </div>
        <p className="text-sm text-white mt-4 bg-green-700/30 p-3 rounded-lg">
          💡 <strong>{t('followups.successRate.noteLabel')}:</strong> {t('followups.successRate.noteText')}
        </p>
      </div>

      {/* Quick Tips */}
      <div className="mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-r-4 border-blue-500 p-5 rounded-lg">
        <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
          <span>💡</span>
          <span>{t('followups.tips.title')}</span>
        </h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• 🔥 <strong>{t('followups.tips.overdue.title')}:</strong> {t('followups.tips.overdue.text')}</li>
          <li>• ⚡ <strong>{t('followups.tips.today.title')}:</strong> {t('followups.tips.today.text')}</li>
          <li>• 💬 <strong>{t('followups.tips.whatsapp.title')}:</strong> {t('followups.tips.whatsapp.text')}</li>
          <li>• ⏰ <strong>{t('followups.tips.yellow.title')}:</strong> {t('followups.tips.yellow.text')}</li>
          <li>• ❌ <strong>{t('followups.tips.red.title')}:</strong> {t('followups.tips.red.text')}</li>
          <li>• ✅ <strong>{t('followups.tips.green.title')}:</strong> {t('followups.tips.green.text')}</li>
        </ul>
      </div>
    </div>
  )
}

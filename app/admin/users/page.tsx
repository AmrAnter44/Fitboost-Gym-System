// app/admin/users/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '../../../contexts/LanguageContext'
import { useToast } from '../../../contexts/ToastContext'
import { LoadingScreen } from '../../../components/Spinner'
import { Permissions, PERMISSION_GROUPS, PERMISSION_LABELS, PERMISSION_ICONS } from '../../../types/permissions'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface User {
  id: string
  name: string
  email: string
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'COACH'
  isActive: boolean
  isSales: boolean
  createdAt: string
  permissions?: Permissions
  staff?: {
    id: string
    name: string
    staffCode: number
    position?: string
  }
}

interface Staff {
  id: string
  staffCode: number
  name: string
  position?: string
  isActive: boolean
}

export default function AdminUsersPage() {
  const router = useRouter()
  const { direction, t } = useLanguage()
  const toast = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  
  // State للـ Modal إضافة مستخدم
  const [showAddModal, setShowAddModal] = useState(false)
  const [newUserData, setNewUserData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'STAFF' as 'ADMIN' | 'OWNER' | 'MANAGER' | 'STAFF' | 'COACH',
    staffId: '',
    isSales: false
  })
  const [showNewUserPassword, setShowNewUserPassword] = useState(false)
  const [showNewUserConfirmPassword, setShowNewUserConfirmPassword] = useState(false)
  const [newUserPermissions, setNewUserPermissions] = useState<Partial<Permissions>>({})
  
  // State للـ Modal تعديل الصلاحيات
  const [showPermissionsModal, setShowPermissionsModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [permissions, setPermissions] = useState<Partial<Permissions>>({})
  const [editingUserIsSales, setEditingUserIsSales] = useState(false)
  const [editingStaffId, setEditingStaffId] = useState<string>('')
  // Search query للـ permissions في الـ edit modal
  const [permSearch, setPermSearch] = useState('')
  // Search query للـ permissions في الـ add modal
  const [newPermSearch, setNewPermSearch] = useState('')
  
  // State للـ Modal التأكيد
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{
    title: string
    message: string
    onConfirm: () => void
  } | null>(null)

  // State للـ Modal تغيير كلمة المرور
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false)
  const [changingPasswordUser, setChangingPasswordUser] = useState<User | null>(null)
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    ownerPassword: ''
  })

  useEffect(() => {
    fetchUsers()
    fetchStaff()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      } else if (response.status === 403) {
        toast.error(t('adminUsers.toast.noAccess'))
        setTimeout(() => router.push('/'), 2000)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error(t('adminUsers.toast.fetchFailed'))
    } finally {
      setLoading(false)
    }
  }

  const fetchStaff = async () => {
    try {
      const response = await fetch('/api/staff')
      if (response.ok) {
        const data = await response.json()
        setStaff(data.filter((s: Staff) => s.isActive))
      }
    } catch (error) {
      console.error('Error fetching staff:', error)
    }
  }

  // Filter permissions by search query. Empty query → all groups.
  // Returns groups with only the matching permissions (groups with 0 matches are skipped).
  const filterPermissionGroups = (query: string) => {
    const q = query.trim().toLowerCase()
    if (!q) return Object.entries(PERMISSION_GROUPS).map(([k, g]) => [k, g, g.permissions] as const)
    return Object.entries(PERMISSION_GROUPS)
      .map(([k, g]) => {
        const matching = g.permissions.filter(p => {
          const label = (PERMISSION_LABELS[p] || '').toLowerCase()
          return label.includes(q) || p.toLowerCase().includes(q)
        })
        return [k, g, matching] as const
      })
      .filter(([, , matching]) => matching.length > 0)
  }

  // Selection count per group (e.g. "3/8 محدد")
  const groupSelectionCount = (
    perms: Partial<Permissions>,
    groupPermissions: Array<keyof Permissions>
  ) => {
    let n = 0
    for (const p of groupPermissions) if (perms[p]) n++
    return n
  }

  // View-gate filter: within a group, if there's a "canView*" permission and it's
  // not granted, hide the Create/Edit/Delete ones — they're useless without view.
  // The "view" permission stays visible as the gateway.
  const applyViewGate = (
    perms: Partial<Permissions>,
    groupPermissions: Array<keyof Permissions>
  ): Array<keyof Permissions> => {
    const viewPerm = groupPermissions.find(p => String(p).startsWith('canView'))
    if (!viewPerm) return groupPermissions // no gate → show all
    if (perms[viewPerm]) return groupPermissions // view granted → show all
    return [viewPerm] // view denied → only show the gate itself
  }

  // When user toggles OFF a "canView*" permission, automatically drop the
  // related Create/Edit/Delete bits so they don't linger silently in DB.
  const toggleWithViewCascade = (
    current: Partial<Permissions>,
    permission: keyof Permissions,
    nextValue: boolean,
    groupPermissions: Array<keyof Permissions>
  ): Partial<Permissions> => {
    const updated = { ...current, [permission]: nextValue }
    if (!nextValue && String(permission).startsWith('canView')) {
      // Strip every other permission in the same group
      for (const p of groupPermissions) {
        if (p !== permission) delete updated[p]
      }
    }
    return updated
  }

  const handleAddUser = async () => {
    if (!newUserData.name || !newUserData.email || !newUserData.password) {
      toast.warning(t('adminUsers.toast.fillAllFields'))
      return
    }

    if (newUserData.password !== newUserData.confirmPassword) {
      toast.error('كلمتا المرور غير متطابقتين')
      return
    }

    if (newUserData.role === 'COACH' && !newUserData.staffId) {
      toast.warning(t('adminUsers.toast.coachNeedsStaff'))
      return
    }

    if (newUserData.isSales && !newUserData.staffId) {
      toast.warning('اكونت السيلز لازم يتربط بموظف سيلز')
      return
    }

    setLoading(true)
    try {
      const { confirmPassword, ...userPayload } = newUserData
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...userPayload,
          permissions: newUserPermissions
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(t('adminUsers.toast.addSuccess'))
        setShowAddModal(false)
        setNewUserData({ name: '', email: '', password: '', confirmPassword: '', role: 'STAFF', staffId: '', isSales: false })
        setShowNewUserPassword(false)
        setShowNewUserConfirmPassword(false)
        setNewUserPermissions({})
        fetchUsers()
      } else {
        toast.error(data.error || t('adminUsers.toast.addFailed'))
      }
    } catch (error) {
      toast.error(t('adminUsers.toast.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleOpenPermissions = (user: User) => {
    setEditingUser(user)
    setPermissions(user.permissions || {})
    setEditingUserIsSales(user.isSales)
    setEditingStaffId(user.staff?.id || '')
    setPermSearch('')
    setShowPermissionsModal(true)
  }

  const handleSavePermissions = async () => {
    if (!editingUser) return

    setLoading(true)
    try {
      // حفظ isSales و staffId لو اتغيروا
      const isSalesChanged = editingUserIsSales !== editingUser.isSales
      const staffChanged = editingStaffId !== (editingUser.staff?.id || '')
      if (isSalesChanged || staffChanged) {
        await fetch(`/api/admin/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isSales: editingUserIsSales,
            staffId: editingStaffId || null
          })
        })
      }

      const response = await fetch(`/api/admin/users/${editingUser.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(permissions)
      })

      if (response.ok) {
        toast.success(t('adminUsers.toast.permissionsUpdated'))
        setShowPermissionsModal(false)
        fetchUsers()
      } else {
        toast.error(t('adminUsers.toast.permissionsFailed'))
      }
    } catch (error) {
      toast.error(t('adminUsers.toast.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (user: User) => {
    setConfirmAction({
      title: user.isActive ? t('adminUsers.confirmModal.suspendTitle') : t('adminUsers.confirmModal.activateTitle'),
      message: user.isActive ? t('adminUsers.confirmModal.suspendMessage', { name: user.name }) : t('adminUsers.confirmModal.activateMessage', { name: user.name }),
      onConfirm: async () => {
        setShowConfirmModal(false)
        setLoading(true)
        
        try {
          const response = await fetch(`/api/admin/users/${user.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: !user.isActive })
          })

          if (response.ok) {
            toast.success(user.isActive ? t('adminUsers.toast.userSuspended') : t('adminUsers.toast.userActivated'))
            fetchUsers()
          } else {
            toast.error(t('adminUsers.toast.toggleFailed'))
          }
        } catch (error) {
          toast.error(t('adminUsers.toast.error'))
        } finally {
          setLoading(false)
        }
      }
    })
    setShowConfirmModal(true)
  }

  const handleDeleteUser = (user: User) => {
    setConfirmAction({
      title: t('adminUsers.confirmModal.deleteTitle'),
      message: t('adminUsers.confirmModal.deleteMessage', { name: user.name }),
      onConfirm: async () => {
        setShowConfirmModal(false)
        setLoading(true)
        
        try {
          const response = await fetch(`/api/admin/users/${user.id}`, {
            method: 'DELETE'
          })

          if (response.ok) {
            toast.success(t('adminUsers.toast.deleteSuccess'))
            fetchUsers()
          } else {
            toast.error(t('adminUsers.toast.deleteFailed'))
          }
        } catch (error) {
          toast.error(t('adminUsers.toast.error'))
        } finally {
          setLoading(false)
        }
      }
    })
    setShowConfirmModal(true)
  }

  const handleResetPassword = (user: User) => {
    setChangingPasswordUser(user)
    setPasswordData({ newPassword: '', ownerPassword: '' })
    setShowChangePasswordModal(true)
  }

  const handleChangePassword = async () => {
    if (!changingPasswordUser) return

    if (!passwordData.newPassword || passwordData.newPassword.length < 6) {
      toast.error(t('adminUsers.toast.passwordMinLength'))
      return
    }

    if (!passwordData.ownerPassword) {
      toast.error(t('adminUsers.toast.enterOwnerPassword'))
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${changingPasswordUser.id}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPassword: passwordData.newPassword,
          ownerPassword: passwordData.ownerPassword
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(data.message || t('adminUsers.toast.passwordChanged'))
        setShowChangePasswordModal(false)
        setPasswordData({ newPassword: '', ownerPassword: '' })
      } else {
        toast.error(data.error || t('adminUsers.toast.passwordChangeFailed'))
      }
    } catch (error) {
      console.error('Error changing password:', error)
      toast.error(t('adminUsers.toast.passwordChangeError'))
    }
  }

  const getRoleBadge = (role: string) => {
    const badges = {
      'OWNER': 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
      'ADMIN': 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
      'MANAGER': 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300',
      'STAFF': 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
      'COACH': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
    }
    return badges[role as keyof typeof badges] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
  }

  const getRoleLabel = (role: string) => {
    const keys: Record<string, string> = { 'OWNER': 'owner', 'ADMIN': 'admin', 'MANAGER': 'manager', 'STAFF': 'staff', 'COACH': 'coach' }
    const key = keys[role]
    return key ? t(`adminUsers.roles.${key}`) : role
  }

  const stats = {
    total: users.length,
    active: users.filter(u => u.isActive).length,
    admins: users.filter(u => u.role === 'ADMIN' || u.role === 'OWNER').length,
    managers: users.filter(u => u.role === 'MANAGER').length,
    staff: users.filter(u => u.role === 'STAFF').length,
    coaches: users.filter(u => u.role === 'COACH').length
  }

  if (loading && users.length === 0) {
    return <LoadingScreen message={t('adminUsers.loading')} />
  }

  return (
    <div className="container mx-auto p-6" dir={direction}>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
            <svg {...stroke} className="w-6 h-6" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('adminUsers.title')}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('adminUsers.subtitle')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/audit"
            className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2.5 rounded-lg font-bold transition-colors duration-200 text-sm"
          >
            <svg {...stroke} className="w-4 h-4" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487 18.549 2.799a2.122 2.122 0 1 1 3 3L19.862 7.487m-3-3L8.078 13.27a2 2 0 0 0-.5.831l-1.111 4.222 4.222-1.111a2 2 0 0 0 .832-.5l8.781-8.781m-3-3 3 3" />
            </svg>
            <span>{t('adminUsers.auditLog')}</span>
          </Link>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 text-sm"
          >
            <svg {...stroke} className="w-4 h-4" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>{t('adminUsers.addUser')}</span>
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4 mb-6">
        {[
          { label: t('adminUsers.stats.total'), value: stats.total, tone: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' },
          { label: t('adminUsers.stats.active'), value: stats.active, tone: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
          { label: t('adminUsers.stats.admins'), value: stats.admins, tone: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
          { label: t('adminUsers.stats.managers'), value: stats.managers, tone: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
          { label: t('adminUsers.stats.staff'), value: stats.staff, tone: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' },
          { label: t('adminUsers.stats.coaches'), value: stats.coaches, tone: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4">
            <div className={`w-10 h-10 rounded-lg ${stat.tone} flex items-center justify-center mb-2`}>
              <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{stat.label}</div>
            <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Users Cards */}
      <div className="space-y-3 sm:space-y-4">
        {users.map((user) => {
          const avatarTone: Record<string, string> = {
            'OWNER': 'bg-amber-500',
            'ADMIN': 'bg-red-500',
            'MANAGER': 'bg-primary-500',
            'STAFF': 'bg-green-500',
            'COACH': 'bg-blue-500',
          }
          const avatar = avatarTone[user.role] || 'bg-gray-500'

          return (
            <div
              key={user.id}
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-4 sm:p-5 transition-colors duration-200 ${!user.isActive ? 'opacity-70' : ''}`}
            >
              {/* Header: Action Buttons + Status */}
              <div className="flex justify-between items-start gap-2 mb-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getRoleBadge(user.role)}`}>
                    {getRoleLabel(user.role)}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    user.isActive
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                      : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                  }`}>
                    {user.isActive ? (
                      <svg {...stroke} className="w-3.5 h-3.5" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    ) : (
                      <svg {...stroke} className="w-3.5 h-3.5" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    )}
                    {user.isActive ? t('adminUsers.status.active') : t('adminUsers.status.suspended')}
                  </span>
                </div>
                <div className="flex gap-1.5 sm:gap-2">
                  <button
                    onClick={() => handleOpenPermissions(user)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors duration-200"
                    title={t('adminUsers.actions.permissions')}
                    aria-label={t('adminUsers.actions.permissions')}
                  >
                    <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleToggleActive(user)}
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-200 ${
                      user.isActive
                        ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 hover:bg-orange-100 dark:hover:bg-orange-900/50'
                        : 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50'
                    }`}
                    title={user.isActive ? t('adminUsers.actions.suspend') : t('adminUsers.actions.activate')}
                    aria-label={user.isActive ? t('adminUsers.actions.suspend') : t('adminUsers.actions.activate')}
                  >
                    {user.isActive ? (
                      <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                      </svg>
                    ) : (
                      <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => handleResetPassword(user)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors duration-200"
                    title={t('adminUsers.actions.changePassword')}
                    aria-label={t('adminUsers.actions.changePassword')}
                  >
                    <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors duration-200"
                    title={t('adminUsers.actions.deleteUser')}
                    aria-label={t('adminUsers.actions.deleteUser')}
                  >
                    <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* User Info Section */}
              <div className="bg-gray-50 dark:bg-gray-900/40 p-3 sm:p-4 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700">
                <div className="flex flex-col gap-2.5">
                  {/* Name with Avatar */}
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-full ${avatar} flex items-center justify-center text-white font-bold text-lg`}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">{t('adminUsers.labels.name')}</div>
                      <span className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100">{user.name}</span>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center flex-shrink-0">
                      <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">{t('adminUsers.labels.email')}</div>
                      <span className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-200 truncate block" dir="ltr">{user.email}</span>
                    </div>
                  </div>

                  {/* Staff Link + Date */}
                  <div className="flex flex-wrap gap-2">
                    {user.staff && (
                      <span className="inline-flex items-center gap-1 text-xs bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 px-2.5 py-0.5 rounded-full font-bold">
                        <svg {...stroke} className="w-3.5 h-3.5" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                        </svg>
                        {user.staff.name} #{user.staff.staffCode}
                      </span>
                    )}
                    {user.isSales && (
                      <span className="inline-flex items-center gap-1 text-xs bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-2.5 py-0.5 rounded-full font-bold">
                        <svg {...stroke} className="w-3.5 h-3.5" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                        </svg>
                        سيلز
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-0.5 rounded-full font-bold">
                      <svg {...stroke} className="w-3.5 h-3.5" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                      </svg>
                      {new Date(user.createdAt).toLocaleDateString('ar-EG')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {users.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700">
            <svg {...stroke} className="w-12 h-12 text-gray-400" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
            <h3 className="text-gray-600 dark:text-gray-300 font-bold mt-3">{t('adminUsers.empty.title')}</h3>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast font-bold px-4 py-2.5 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 text-sm"
            >
              <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {t('adminUsers.empty.addFirst')}
            </button>
          </div>
        )}
      </div>

      {/* Modal: إضافة مستخدم */}
      {showAddModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="add-user-title">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in max-w-7xl w-full p-4 my-8">
            <div className="flex items-center justify-between mb-4">
              <h2 id="add-user-title" className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('adminUsers.addModal.title')}</h2>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setNewUserPermissions({})
                }}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                aria-label={t('adminUsers.addModal.cancel')}
              >
                <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('adminUsers.addModal.name')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={newUserData.name}
                  onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-sm"
                  placeholder={t('adminUsers.addModal.namePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('adminUsers.addModal.email')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-sm"
                  placeholder={t('adminUsers.addModal.emailPlaceholder')}
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('adminUsers.addModal.password')} <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewUserPassword ? 'text' : 'password'}
                    value={newUserData.password}
                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                    className="w-full px-3 py-2 ps-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-sm"
                    placeholder={t('adminUsers.addModal.passwordPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewUserPassword(v => !v)}
                    className="absolute inset-y-0 start-0 px-3 flex items-center text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors duration-200"
                    aria-label={showNewUserPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showNewUserPassword ? (
                      <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  تأكيد كلمة المرور <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewUserConfirmPassword ? 'text' : 'password'}
                    value={newUserData.confirmPassword}
                    onChange={(e) => setNewUserData({ ...newUserData, confirmPassword: e.target.value })}
                    className={`w-full px-3 py-2 ps-10 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-sm ${
                      newUserData.confirmPassword && newUserData.password !== newUserData.confirmPassword
                        ? 'border-red-400 dark:border-red-600'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="أعد إدخال كلمة المرور"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewUserConfirmPassword(v => !v)}
                    className="absolute inset-y-0 start-0 px-3 flex items-center text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors duration-200"
                    aria-label={showNewUserConfirmPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showNewUserConfirmPassword ? (
                      <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                </div>
                {newUserData.confirmPassword && newUserData.password !== newUserData.confirmPassword && (
                  <p className="text-red-600 dark:text-red-400 text-xs mt-1 flex items-center gap-1">
                    <svg {...stroke} className="w-3.5 h-3.5" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    كلمتا المرور غير متطابقتين
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('adminUsers.addModal.role')} <span className="text-red-600">*</span>
                </label>
                <select
                  value={newUserData.role}
                  onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value as any, staffId: '' })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-sm"
                >
                  <option value="STAFF">{t('adminUsers.roles.staff')}</option>
                  <option value="MANAGER">{t('adminUsers.roles.manager')}</option>
                  <option value="ADMIN">{t('adminUsers.roles.admin')}</option>
                  <option value="COACH">{t('adminUsers.roles.coach')}</option>
                </select>
              </div>

              {newUserData.role === 'COACH' && (
                <div className="lg:col-span-4">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    {t('adminUsers.addModal.staff')} <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={newUserData.staffId}
                    onChange={(e) => {
                      const selectedStaff = staff.find(s => s.id === e.target.value)
                      setNewUserData({
                        ...newUserData,
                        staffId: e.target.value,
                        name: selectedStaff?.name || '',
                        email: selectedStaff ? `coach${selectedStaff.staffCode}@gym.com` : ''
                      })
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-sm"
                  >
                    <option value="">{t('adminUsers.addModal.selectStaff')}</option>
                    {staff
                      .filter(s => !users.find(u => u.staff?.id === s.id))
                      .filter(s => s.position === 'مدرب')
                      .map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} - #{s.staffCode} {s.position ? `(${s.position})` : ''}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Sales */}
              {newUserData.role !== 'COACH' && newUserData.role !== 'ADMIN' && newUserData.role !== 'OWNER' && (
                <div className="lg:col-span-4">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newUserData.isSales}
                      onChange={(e) => setNewUserData({ ...newUserData, isSales: e.target.checked, staffId: '' })}
                      className="w-4 h-4 rounded accent-orange-500"
                    />
                    <span>اكونت سيلز — اختار موظف السيلز المرتبط بيه</span>
                  </label>
                  {newUserData.isSales && (
                    <select
                      value={newUserData.staffId}
                      onChange={(e) => {
                        const selectedStaff = staff.find(s => s.id === e.target.value)
                        setNewUserData({
                          ...newUserData,
                          staffId: e.target.value,
                          name: selectedStaff?.name || newUserData.name,
                          email: selectedStaff ? `sales${selectedStaff.staffCode}@gym.com` : newUserData.email
                        })
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-orange-300 dark:border-orange-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-colors duration-200 text-sm"
                    >
                      <option value="">— اختر موظف السيلز —</option>
                      {staff
                        .filter(s => !users.find(u => u.staff?.id === s.id))
                        .filter(s => s.position?.split(',').map(p => p.trim()).includes('sales'))
                        .map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} - #{s.staffCode}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              )}

              {/* Permissions */}
              <div className="lg:col-span-4 border-t border-gray-200 dark:border-gray-700 pt-3 mt-2">
                <h3 className="text-base font-bold mb-2 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <svg {...stroke} className="w-5 h-5 text-primary-600 dark:text-primary-400" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  <span>{t('adminUsers.addModal.permissions')}</span>
                </h3>

                {/* Admin/Owner: show only a notice — صلاحياتهم معروفة، الـ checkboxes هتشوش */}
                {(newUserData.role === 'ADMIN' || newUserData.role === 'OWNER') ? (
                  <div className="bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-900/50 p-3 rounded-lg flex items-start gap-2">
                    <svg {...stroke} className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                    </svg>
                    <div>
                      <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                        {newUserData.role === 'OWNER' ? t('adminUsers.roles.owner') : t('adminUsers.roles.admin')}
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                        {t('adminUsers.addModal.adminFullAccess')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Search */}
                    <div className="relative mb-2">
                      <svg {...stroke} className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-2.5 text-gray-400 pointer-events-none">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                      </svg>
                      <input
                        type="text"
                        value={newPermSearch}
                        onChange={e => setNewPermSearch(e.target.value)}
                        placeholder={direction === 'rtl' ? 'بحث في الصلاحيات...' : 'Search permissions...'}
                        className="w-full ps-9 pe-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      {newPermSearch && (
                        <button onClick={() => setNewPermSearch('')} className="absolute top-1/2 -translate-y-1/2 end-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                          <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
                        </button>
                      )}
                    </div>

                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {filterPermissionGroups(newPermSearch).map(([groupKey, group, matchingPerms]) => {
                        // Apply view-gate: hide actions when view isn't granted yet
                        const visiblePerms = applyViewGate(newUserPermissions, matchingPerms as Array<keyof Permissions>)
                        const selectedCount = groupSelectionCount(newUserPermissions, matchingPerms as Array<keyof Permissions>)
                        const allSelected = selectedCount === matchingPerms.length
                        const isGated = visiblePerms.length < matchingPerms.length
                        return (
                          <div key={groupKey} className="rounded-lg p-2 ring-1 ring-gray-200 dark:ring-gray-700 bg-gray-50 dark:bg-gray-900/40">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-bold text-xs text-gray-700 dark:text-gray-300">
                                {group.label} <span className="text-gray-500">({selectedCount}/{matchingPerms.length})</span>
                                {isGated && (
                                  <span className="ms-1 text-[9px] text-gray-400">{direction === 'rtl' ? '· فعّل العرض لإظهار الباقي' : '· enable view to unlock'}</span>
                                )}
                              </h4>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = { ...newUserPermissions }
                                  // Bulk uses the full matching list (not gated)
                                  for (const p of matchingPerms) updated[p as keyof Permissions] = !allSelected
                                  setNewUserPermissions(updated)
                                }}
                                className="text-[10px] font-bold text-primary-600 dark:text-primary-400 hover:underline"
                              >
                                {allSelected ? (direction === 'rtl' ? 'إلغاء الكل' : 'Clear all') : (direction === 'rtl' ? 'تحديد الكل' : 'Select all')}
                              </button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
                              {visiblePerms.map((permission) => (
                                <label key={permission} className="flex items-center gap-1 cursor-pointer hover:bg-white dark:hover:bg-gray-700/50 p-1 rounded transition-colors duration-200">
                                  <input
                                    type="checkbox"
                                    checked={newUserPermissions[permission] || false}
                                    onChange={(e) => setNewUserPermissions(
                                      toggleWithViewCascade(newUserPermissions, permission, e.target.checked, matchingPerms as Array<keyof Permissions>)
                                    )}
                                    className="w-3 h-3 rounded accent-primary-500"
                                  />
                                  <span className="text-xs text-gray-700 dark:text-gray-300">
                                    {PERMISSION_ICONS[permission]} {PERMISSION_LABELS[permission]}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                      {filterPermissionGroups(newPermSearch).length === 0 && (
                        <p className="text-xs text-center text-gray-500 dark:text-gray-400 py-4">
                          {direction === 'rtl' ? 'مفيش صلاحيات مطابقة' : 'No matching permissions'}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="lg:col-span-4 flex gap-2">
                <button
                  onClick={handleAddUser}
                  disabled={loading}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast py-2.5 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed font-bold text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                >
                  {loading ? (
                    <>
                      <svg {...stroke} className="w-4 h-4 animate-spin" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>{t('adminUsers.addModal.adding')}</span>
                    </>
                  ) : (
                    <>
                      <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      <span>{t('adminUsers.addModal.add')}</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-6 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-bold text-sm transition-colors duration-200"
                >
                  {t('adminUsers.addModal.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Permissions */}
      {showPermissionsModal && editingUser && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in" role="dialog" aria-modal="true" aria-labelledby="perm-modal-title">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                  <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                </div>
                <div>
                  <h2 id="perm-modal-title" className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('adminUsers.permissionsModal.title', { name: editingUser.name })}</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{editingUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                aria-label={t('adminUsers.permissionsModal.cancel')}
              >
                <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {(editingUser.role === 'ADMIN' || editingUser.role === 'OWNER') && (
              <div className="bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-900/50 p-4 rounded-lg mb-6 flex items-start gap-3">
                <svg {...stroke} className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                </svg>
                <div>
                  <p className="font-bold text-amber-800 dark:text-amber-300">
                    {editingUser.role === 'OWNER' ? t('adminUsers.roles.owner') : t('adminUsers.roles.admin')}
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                    {t('adminUsers.permissionsModal.adminFullAccess')}
                  </p>
                  <p className="text-xs text-amber-700/80 dark:text-amber-500 mt-2 italic">
                    {direction === 'rtl' ? 'الصلاحيات للأدوار دي معروفة بشكل افتراضي — مفيش داعي لتحديدها.' : 'Permissions for this role are pre-defined — no need to set them.'}
                  </p>
                </div>
              </div>
            )}

            {/* Sales tag */}
            {editingUser.role !== 'OWNER' && editingUser.role !== 'ADMIN' && (
              <div className="bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-200 dark:ring-orange-900/50 rounded-xl px-4 py-3 mb-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center flex-shrink-0">
                      <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-orange-800 dark:text-orange-200 text-sm">اكونت سيلز</p>
                      <p className="text-xs text-orange-700 dark:text-orange-400">الاكونت ده هيشوف متابعاته بس في صفحة المتابعات</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingUserIsSales(!editingUserIsSales)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${
                      editingUserIsSales ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                    role="switch"
                    aria-checked={editingUserIsSales}
                    aria-label="سيلز"
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      editingUserIsSales ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-bold text-orange-800 dark:text-orange-200 mb-1">
                    الموظف المرتبط بالاكونت ده
                  </label>
                  <select
                    value={editingStaffId}
                    onChange={(e) => setEditingStaffId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-orange-300 dark:border-orange-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-colors duration-200 text-sm"
                  >
                    <option value="">— بدون موظف —</option>
                    {staff
                      .filter(s =>
                        s.position?.split(',').map(p => p.trim()).includes('sales') &&
                        !users.find(u => u.staff?.id === s.id && u.id !== editingUser.id)
                      )
                      .map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} - #{s.staffCode}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            )}

            {/* Hide the permissions UI entirely for OWNER/ADMIN — they always have full access */}
            {editingUser.role !== 'ADMIN' && editingUser.role !== 'OWNER' && (
              <>
                {/* Search + bulk actions header */}
                <div className="flex flex-col sm:flex-row gap-2 mb-3">
                  <div className="relative flex-1">
                    <svg {...stroke} className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-gray-400 pointer-events-none">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                    <input
                      type="text"
                      value={permSearch}
                      onChange={e => setPermSearch(e.target.value)}
                      placeholder={direction === 'rtl' ? 'بحث في الصلاحيات...' : 'Search permissions...'}
                      className="w-full ps-10 pe-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    {permSearch && (
                      <button onClick={() => setPermSearch('')} className="absolute top-1/2 -translate-y-1/2 end-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                        <svg {...stroke} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const all: Partial<Permissions> = {}
                        for (const [, group] of Object.entries(PERMISSION_GROUPS)) for (const p of group.permissions) all[p] = true
                        setPermissions(all)
                      }}
                      className="px-3 py-2 text-xs font-bold rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                    >
                      {direction === 'rtl' ? 'تحديد الكل' : 'Select all'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPermissions({})}
                      className="px-3 py-2 text-xs font-bold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
                    >
                      {direction === 'rtl' ? 'إلغاء الكل' : 'Clear all'}
                    </button>
                  </div>
                </div>

                {/* Summary chip — total selected */}
                <div className="mb-3 text-xs text-gray-600 dark:text-gray-400">
                  {direction === 'rtl' ? 'محدد:' : 'Selected:'}{' '}
                  <span className="font-bold text-primary-600 dark:text-primary-400">
                    {Object.values(permissions).filter(Boolean).length}
                  </span>
                  {' / '}
                  {Object.entries(PERMISSION_GROUPS).reduce((sum, [, g]) => sum + g.permissions.length, 0)}
                </div>

                <div className="space-y-4">
                  {filterPermissionGroups(permSearch).map(([groupKey, group, matchingPerms]) => {
                    const visiblePerms = applyViewGate(permissions, matchingPerms as Array<keyof Permissions>)
                    const selectedCount = groupSelectionCount(permissions, matchingPerms as Array<keyof Permissions>)
                    const allSelected = selectedCount === matchingPerms.length
                    const isGated = visiblePerms.length < matchingPerms.length
                    return (
                      <div key={groupKey} className="rounded-lg p-4 ring-1 ring-gray-200 dark:ring-gray-700 bg-gray-50 dark:bg-gray-900/40">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-bold text-sm text-gray-700 dark:text-gray-300">
                            {group.label} <span className="text-gray-500">({selectedCount}/{matchingPerms.length})</span>
                            {isGated && (
                              <span className="ms-2 text-xs text-gray-400 font-normal">
                                {direction === 'rtl' ? '· فعّل العرض لإظهار باقي الصلاحيات' : '· enable view to unlock the rest'}
                              </span>
                            )}
                          </h3>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = { ...permissions }
                              for (const p of matchingPerms) updated[p as keyof Permissions] = !allSelected
                              setPermissions(updated)
                            }}
                            className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline"
                          >
                            {allSelected
                              ? (direction === 'rtl' ? 'إلغاء المجموعة' : 'Clear group')
                              : (direction === 'rtl' ? 'تحديد المجموعة' : 'Select group')}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {visiblePerms.map((permission) => (
                            <label key={permission} className="flex items-center gap-2 cursor-pointer hover:bg-white dark:hover:bg-gray-700/50 p-2 rounded-lg transition-colors duration-200">
                              <input
                                type="checkbox"
                                checked={permissions[permission] || false}
                                onChange={(e) => setPermissions(
                                  toggleWithViewCascade(permissions, permission, e.target.checked, matchingPerms as Array<keyof Permissions>)
                                )}
                                className="w-4 h-4 rounded accent-primary-500"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {PERMISSION_ICONS[permission]} {PERMISSION_LABELS[permission]}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                  {filterPermissionGroups(permSearch).length === 0 && (
                    <p className="text-sm text-center text-gray-500 dark:text-gray-400 py-8">
                      {direction === 'rtl' ? 'مفيش صلاحيات مطابقة' : 'No matching permissions'}
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSavePermissions}
                disabled={loading || editingUser.role === 'ADMIN' || editingUser.role === 'OWNER'}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast py-2.5 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              >
                {loading ? (
                  <>
                    <svg {...stroke} className="w-4 h-4 animate-spin" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>{t('adminUsers.permissionsModal.saving')}</span>
                  </>
                ) : (
                  <>
                    <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    <span>{t('adminUsers.permissionsModal.save')}</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="px-6 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-bold transition-colors duration-200"
              >
                {t('adminUsers.permissionsModal.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm */}
      {showConfirmModal && confirmAction && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
                <svg {...stroke} className="w-8 h-8" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <h2 id="confirm-modal-title" className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">{confirmAction.title}</h2>
              <p className="text-gray-600 dark:text-gray-400">{confirmAction.message}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={confirmAction.onConfirm}
                autoFocus
                className="flex-1 inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast py-2.5 rounded-lg font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              >
                <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                <span>{t('adminUsers.confirmModal.confirm')}</span>
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-6 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-bold transition-colors duration-200"
              >
                {t('adminUsers.confirmModal.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Change Password */}
      {showChangePasswordModal && changingPasswordUser && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-backdrop-in" role="dialog" aria-modal="true" aria-labelledby="change-pw-title">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                  <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                  </svg>
                </div>
                <h2 id="change-pw-title" className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {t('adminUsers.changePasswordModal.title')}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowChangePasswordModal(false)
                  setPasswordData({ newPassword: '', ownerPassword: '' })
                }}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                aria-label={t('adminUsers.changePasswordModal.cancel')}
              >
                <svg {...stroke} className="w-5 h-5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6 p-4 bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-900/50 rounded-lg">
              <p className="text-sm text-primary-800 dark:text-primary-300">
                <strong>{t('adminUsers.changePasswordModal.user')}:</strong> {changingPasswordUser.name} ({changingPasswordUser.email})
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('adminUsers.changePasswordModal.newPassword')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  placeholder={t('adminUsers.changePasswordModal.newPasswordPlaceholder')}
                  minLength={6}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('adminUsers.changePasswordModal.minLength')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('adminUsers.changePasswordModal.ownerPassword')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="password"
                  value={passwordData.ownerPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, ownerPassword: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
                  placeholder={t('adminUsers.changePasswordModal.ownerPasswordPlaceholder')}
                />
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                  <svg {...stroke} className="w-3.5 h-3.5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  {t('adminUsers.changePasswordModal.ownerRequired')}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleChangePassword}
                disabled={loading}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-primary-contrast py-2.5 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed font-bold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              >
                {loading ? (
                  <>
                    <svg {...stroke} className="w-4 h-4 animate-spin" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>{t('adminUsers.changePasswordModal.changing')}</span>
                  </>
                ) : (
                  <>
                    <svg {...stroke} className="w-4 h-4" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    <span>{t('adminUsers.changePasswordModal.change')}</span>
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowChangePasswordModal(false)
                  setPasswordData({ newPassword: '', ownerPassword: '' })
                }}
                className="px-6 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-bold transition-colors duration-200"
              >
                {t('adminUsers.changePasswordModal.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
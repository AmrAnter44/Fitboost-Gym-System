// app/admin/users/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useLanguage } from '../../../contexts/LanguageContext'
import { useToast } from '../../../contexts/ToastContext'
import { Permissions, PERMISSION_GROUPS, PERMISSION_LABELS, PERMISSION_ICONS } from '../../../types/permissions'

interface User {
  id: string
  name: string
  email: string
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'COACH'
  isActive: boolean
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
    role: 'STAFF' as 'ADMIN' | 'OWNER' | 'MANAGER' | 'STAFF' | 'COACH',
    staffId: ''
  })
  const [newUserPermissions, setNewUserPermissions] = useState<Partial<Permissions>>({})
  
  // State للـ Modal تعديل الصلاحيات
  const [showPermissionsModal, setShowPermissionsModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [permissions, setPermissions] = useState<Partial<Permissions>>({})
  
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

  const handleAddUser = async () => {
    if (!newUserData.name || !newUserData.email || !newUserData.password) {
      toast.warning(t('adminUsers.toast.fillAllFields'))
      return
    }

    if (newUserData.role === 'COACH' && !newUserData.staffId) {
      toast.warning(t('adminUsers.toast.coachNeedsStaff'))
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newUserData,
          permissions: newUserPermissions  // ✅ إرسال الصلاحيات مع البيانات
        })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success(t('adminUsers.toast.addSuccess'))
        setShowAddModal(false)
        setNewUserData({ name: '', email: '', password: '', role: 'STAFF', staffId: '' })
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
    setShowPermissionsModal(true)
  }

  const handleSavePermissions = async () => {
    if (!editingUser) return

    setLoading(true)
    try {
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
      title: user.isActive ? `⏸️ ${t('adminUsers.confirmModal.suspendTitle')}` : `✅ ${t('adminUsers.confirmModal.activateTitle')}`,
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
      title: `⚠️ ${t('adminUsers.confirmModal.deleteTitle')}`,
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
      'ADMIN': 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 border-red-300 dark:border-red-700',
      'MANAGER': 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-400 border-primary-300 dark:border-primary-700',
      'STAFF': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-300 dark:border-green-700',
      'COACH': 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-400 border-primary-300 dark:border-primary-700'
    }
    return badges[role as keyof typeof badges] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100'
  }

  const getRoleLabel = (role: string) => {
    const icons: Record<string, string> = { 'OWNER': '👨‍💼', 'ADMIN': '👑', 'MANAGER': '📊', 'STAFF': '👷', 'COACH': '🏋️' }
    const keys: Record<string, string> = { 'OWNER': 'owner', 'ADMIN': 'admin', 'MANAGER': 'manager', 'STAFF': 'staff', 'COACH': 'coach' }
    const key = keys[role]
    return key ? `${icons[role]} ${t(`adminUsers.roles.${key}`)}` : role
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
    return (
      <div className="container mx-auto p-6 text-center" dir={direction}>
        <div className="text-6xl mb-4">⏳</div>
        <p className="text-xl">{t('adminUsers.loading')}</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6" dir={direction}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">👥 {t('adminUsers.title')}</h1>
          <p className="text-gray-600 dark:text-gray-300">{t('adminUsers.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/audit"
            className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 px-5 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors"
          >
            <span>📝</span>
            <span>{t('adminUsers.auditLog')}</span>
          </Link>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 font-bold flex items-center gap-2"
          >
            <span>➕</span>
            <span>{t('adminUsers.addUser')}</span>
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4 mb-6">
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white p-5 rounded-xl shadow-lg">
          <div className="text-3xl font-bold">{stats.total}</div>
          <div className="text-sm opacity-90">{t('adminUsers.stats.total')}</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-5 rounded-xl shadow-lg">
          <div className="text-3xl font-bold">{stats.active}</div>
          <div className="text-sm opacity-90">{t('adminUsers.stats.active')}</div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white p-5 rounded-xl shadow-lg">
          <div className="text-3xl font-bold">{stats.admins}</div>
          <div className="text-sm opacity-90">{t('adminUsers.stats.admins')}</div>
        </div>

        <div className="bg-gradient-to-br from-primary-400 to-primary-500 text-white p-5 rounded-xl shadow-lg">
          <div className="text-3xl font-bold">{stats.managers}</div>
          <div className="text-sm opacity-90">{t('adminUsers.stats.managers')}</div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-5 rounded-xl shadow-lg">
          <div className="text-3xl font-bold">{stats.staff}</div>
          <div className="text-sm opacity-90">{t('adminUsers.stats.staff')}</div>
        </div>

        <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white p-5 rounded-xl shadow-lg">
          <div className="text-3xl font-bold">{stats.coaches}</div>
          <div className="text-sm opacity-90">{t('adminUsers.stats.coaches')}</div>
        </div>
      </div>

      {/* Users Cards */}
      <div className="space-y-3 sm:space-y-4">
        {users.map((user) => {
          const roleColors: Record<string, { border: string; gradient: string; avatar: string }> = {
            'OWNER': { border: 'border-amber-400', gradient: 'from-amber-50/50 dark:from-amber-900/10', avatar: 'from-amber-500 to-yellow-500' },
            'ADMIN': { border: 'border-red-400', gradient: 'from-red-50/30 dark:from-red-900/10', avatar: 'from-red-500 to-rose-500' },
            'MANAGER': { border: 'border-primary-400', gradient: 'from-primary-50/30 dark:from-primary-900/10', avatar: 'from-primary-500 to-primary-600' },
            'STAFF': { border: 'border-green-400', gradient: 'from-green-50/30 dark:from-green-900/10', avatar: 'from-green-500 to-emerald-500' },
            'COACH': { border: 'border-blue-400', gradient: 'from-blue-50/30 dark:from-blue-900/10', avatar: 'from-blue-500 to-indigo-500' },
          }
          const colors = roleColors[user.role] || roleColors['STAFF']

          return (
            <div
              key={user.id}
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 sm:p-5 border-2 ${colors.border} bg-gradient-to-br ${colors.gradient} to-white dark:to-gray-800 hover:shadow-2xl transition-all duration-300 hover:scale-[1.01] ${!user.isActive ? 'opacity-70' : ''}`}
            >
              {/* Header: Action Buttons + Status */}
              <div className="flex justify-between items-start gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold border-2 ${getRoleBadge(user.role)}`}>
                    {getRoleLabel(user.role)}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    user.isActive
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                  }`}>
                    {user.isActive ? `✅ ${t('adminUsers.status.active')}` : `❌ ${t('adminUsers.status.suspended')}`}
                  </span>
                </div>
                <div className="flex gap-1.5 sm:gap-2">
                  <button
                    onClick={() => handleOpenPermissions(user)}
                    className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 rounded bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-all"
                    title={t('adminUsers.actions.permissions')}
                  >
                    🔒
                  </button>
                  <button
                    onClick={() => handleToggleActive(user)}
                    className={`text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 rounded transition-all ${
                      user.isActive
                        ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 hover:bg-orange-100 dark:hover:bg-orange-900/50'
                        : 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50'
                    }`}
                    title={user.isActive ? t('adminUsers.actions.suspend') : t('adminUsers.actions.activate')}
                  >
                    {user.isActive ? '⏸️' : '▶️'}
                  </button>
                  <button
                    onClick={() => handleResetPassword(user)}
                    className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 rounded bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-all"
                    title={t('adminUsers.actions.changePassword')}
                  >
                    🔑
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user)}
                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 rounded bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 transition-all"
                    title={t('adminUsers.actions.deleteUser')}
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* User Info Section */}
              <div className="bg-gradient-to-r from-primary-50 via-white to-primary-50 dark:from-primary-900/20 dark:via-gray-800 dark:to-primary-900/20 p-3 sm:p-4 rounded-xl border-2 border-primary-200 dark:border-primary-700 shadow-sm">
                <div className="flex flex-col gap-2.5">
                  {/* Name with Avatar */}
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${colors.avatar} flex items-center justify-center text-white font-bold text-lg shadow-md`}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{t('adminUsers.labels.name')}</div>
                      <span className="font-bold text-base sm:text-lg text-gray-900 dark:text-gray-100">{user.name}</span>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex items-center gap-2">
                    <div className="bg-gray-500 p-1.5 rounded-lg">
                      <span className="text-white text-base">📧</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{t('adminUsers.labels.email')}</div>
                      <span className="font-semibold text-sm sm:text-base text-gray-800 dark:text-gray-200" dir="ltr">{user.email}</span>
                    </div>
                  </div>

                  {/* Staff Link + Date */}
                  <div className="flex flex-wrap gap-2">
                    {user.staff && (
                      <span className="text-xs bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 px-2.5 py-1 rounded-full font-semibold shadow-sm">
                        👷 {user.staff.name} #{user.staff.staffCode}
                      </span>
                    )}
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-full font-medium">
                      📅 {new Date(user.createdAt).toLocaleDateString('ar-EG')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {users.length === 0 && (
          <div className="text-center py-20 text-gray-500 dark:text-gray-400">
            <div className="text-6xl mb-4">👥</div>
            <p className="text-xl font-medium">{t('adminUsers.empty.title')}</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
            >
              {t('adminUsers.empty.addFirst')}
            </button>
          </div>
        )}
      </div>

      {/* Modal: إضافة مستخدم */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-7xl w-full p-4 my-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">➕ {t('adminUsers.addModal.title')}</h2>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setNewUserPermissions({})
                }}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100 text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-900 dark:text-gray-100">
                  {t('adminUsers.addModal.name')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={newUserData.name}
                  onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  placeholder={t('adminUsers.addModal.namePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-gray-900 dark:text-gray-100">
                  {t('adminUsers.addModal.email')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  placeholder={t('adminUsers.addModal.emailPlaceholder')}
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-gray-900 dark:text-gray-100">
                  {t('adminUsers.addModal.password')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="password"
                  value={newUserData.password}
                  onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  placeholder={t('adminUsers.addModal.passwordPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-gray-900 dark:text-gray-100">
                  {t('adminUsers.addModal.role')} <span className="text-red-600">*</span>
                </label>
                <select
                  value={newUserData.role}
                  onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value as any, staffId: '' })}
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                >
                  <option value="STAFF">👷 {t('adminUsers.roles.staff')}</option>
                  <option value="MANAGER">📊 {t('adminUsers.roles.manager')}</option>
                  <option value="ADMIN">👑 {t('adminUsers.roles.admin')}</option>
                  <option value="COACH">🏋️ {t('adminUsers.roles.coach')}</option>
                </select>
              </div>

              {newUserData.role === 'COACH' && (
                <div className="lg:col-span-4">
                  <label className="block text-xs font-medium mb-1 text-gray-900 dark:text-gray-100">
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
                    className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
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

              {/* قسم الصلاحيات */}
              <div className="lg:col-span-4 border-t-2 border-gray-200 dark:border-gray-700 pt-3 mt-2">
                <h3 className="text-lg font-bold mb-2 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                  <span>🔒</span>
                  <span>{t('adminUsers.addModal.permissions')}</span>
                </h3>

                {(newUserData.role === 'ADMIN' || newUserData.role === 'OWNER') && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/30 border-r-4 border-yellow-500 dark:border-yellow-700 p-2 rounded mb-2">
                    <p className="text-xs text-yellow-800 dark:text-yellow-300">
                      <strong>👑 {newUserData.role === 'OWNER' ? t('adminUsers.roles.owner') : t('adminUsers.roles.admin')}:</strong> {t('adminUsers.addModal.adminFullAccess')}
                    </p>
                  </div>
                )}

                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {Object.entries(PERMISSION_GROUPS).map(([groupKey, group], index) => {
                    const colors = [
                      'border-primary-200 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300',
                      'border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300',
                      'border-primary-200 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300',
                      'border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
                      'border-pink-200 dark:border-pink-700 bg-pink-50 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300',
                      'border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
                      'border-primary-200 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300',
                      'border-teal-200 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300',
                      'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                    ]
                    const colorClass = colors[index % colors.length]

                    return (
                      <div key={groupKey} className={`border-2 rounded-lg p-2 ${colorClass}`}>
                        <h4 className="font-bold mb-1 flex items-center gap-1 text-xs">
                          <span>{group.label}</span>
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
                          {group.permissions.map((permission) => (
                            <label key={permission} className="flex items-center gap-1 cursor-pointer hover:bg-white dark:hover:bg-gray-700/50 p-1 rounded transition">
                              <input
                                type="checkbox"
                                checked={newUserPermissions[permission] || false}
                                onChange={(e) => setNewUserPermissions({ ...newUserPermissions, [permission]: e.target.checked })}
                                disabled={newUserData.role === 'ADMIN' || newUserData.role === 'OWNER'}
                                className="w-3 h-3"
                              />
                              <span className="text-xs">
                                {PERMISSION_ICONS[permission]} {PERMISSION_LABELS[permission]}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="lg:col-span-4 flex gap-2">
                <button
                  onClick={handleAddUser}
                  disabled={loading}
                  className="flex-1 bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 font-bold text-sm"
                >
                  {loading ? t('adminUsers.addModal.adding') : `✅ ${t('adminUsers.addModal.add')}`}
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold text-sm"
                >
                  {t('adminUsers.addModal.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: تعديل الصلاحيات */}
      {showPermissionsModal && editingUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">🔒 {t('adminUsers.permissionsModal.title', { name: editingUser.name })}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">{editingUser.email}</p>
              </div>
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100 text-3xl leading-none"
              >
                ×
              </button>
            </div>

            {(editingUser.role === 'ADMIN' || editingUser.role === 'OWNER') && (
              <div className="bg-yellow-50 dark:bg-yellow-900/30 border-r-4 border-yellow-500 dark:border-yellow-700 p-4 rounded mb-6">
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  <strong>👑 {editingUser.role === 'OWNER' ? t('adminUsers.roles.owner') : t('adminUsers.roles.admin')}:</strong> {t('adminUsers.permissionsModal.adminFullAccess')}
                </p>
              </div>
            )}

            <div className="space-y-4">
              {Object.entries(PERMISSION_GROUPS).map(([groupKey, group], index) => {
                const colors = [
                  'border-primary-200 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300',
                  'border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300',
                  'border-primary-200 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300',
                  'border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
                  'border-pink-200 dark:border-pink-700 bg-pink-50 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300',
                  'border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
                  'border-primary-200 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300',
                  'border-teal-200 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300',
                  'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                ]
                const colorClass = colors[index % colors.length]

                return (
                  <div key={groupKey} className={`border-2 rounded-lg p-4 ${colorClass}`}>
                    <h3 className="font-bold mb-3 flex items-center gap-2">
                      <span>{group.label}</span>
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {group.permissions.map((permission) => (
                        <label key={permission} className="flex items-center gap-2 cursor-pointer hover:bg-white dark:hover:bg-gray-700/50 p-2 rounded transition">
                          <input
                            type="checkbox"
                            checked={permissions[permission] || false}
                            onChange={(e) => setPermissions({ ...permissions, [permission]: e.target.checked })}
                            disabled={editingUser.role === 'ADMIN' || editingUser.role === 'OWNER'}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">
                            {PERMISSION_ICONS[permission]} {PERMISSION_LABELS[permission]}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSavePermissions}
                disabled={loading || editingUser.role === 'ADMIN' || editingUser.role === 'OWNER'}
                className="flex-1 bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 font-bold"
              >
                {loading ? t('adminUsers.permissionsModal.saving') : `✅ ${t('adminUsers.permissionsModal.save')}`}
              </button>
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold"
              >
                {t('adminUsers.permissionsModal.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: التأكيد */}
      {showConfirmModal && confirmAction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">{confirmAction.title}</h2>
              <p className="text-gray-600 dark:text-gray-300">{confirmAction.message}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={confirmAction.onConfirm}
                className="flex-1 bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 font-bold"
              >
                ✅ {t('adminUsers.confirmModal.confirm')}
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold"
              >
                {t('adminUsers.confirmModal.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: تغيير كلمة المرور */}
      {showChangePasswordModal && changingPasswordUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                🔑 {t('adminUsers.changePasswordModal.title')}
              </h2>
              <button
                onClick={() => {
                  setShowChangePasswordModal(false)
                  setPasswordData({ newPassword: '', ownerPassword: '' })
                }}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100 text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>{t('adminUsers.changePasswordModal.user')}:</strong> {changingPasswordUser.name} ({changingPasswordUser.email})
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
                  {t('adminUsers.changePasswordModal.newPassword')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder={t('adminUsers.changePasswordModal.newPasswordPlaceholder')}
                  minLength={6}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('adminUsers.changePasswordModal.minLength')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
                  {t('adminUsers.changePasswordModal.ownerPassword')} <span className="text-red-600">*</span>
                </label>
                <input
                  type="password"
                  value={passwordData.ownerPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, ownerPassword: e.target.value })}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder={t('adminUsers.changePasswordModal.ownerPasswordPlaceholder')}
                />
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  🔒 {t('adminUsers.changePasswordModal.ownerRequired')}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleChangePassword}
                disabled={loading}
                className="flex-1 bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 font-bold"
              >
                {loading ? t('adminUsers.changePasswordModal.changing') : `✅ ${t('adminUsers.changePasswordModal.change')}`}
              </button>
              <button
                onClick={() => {
                  setShowChangePasswordModal(false)
                  setPasswordData({ newPassword: '', ownerPassword: '' })
                }}
                className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold"
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
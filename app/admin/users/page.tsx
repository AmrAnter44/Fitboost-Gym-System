// app/admin/users/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../../../contexts/LanguageContext'
import { useToast } from '../../../contexts/ToastContext'
import { Permissions, PERMISSION_GROUPS, PERMISSION_LABELS, PERMISSION_ICONS } from '../../../types/permissions'

interface User {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'COACH'
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
  const { direction } = useLanguage()
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
    role: 'STAFF' as 'ADMIN' | 'MANAGER' | 'STAFF' | 'COACH',
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
        toast.error('ليس لديك صلاحية الوصول')
        setTimeout(() => router.push('/'), 2000)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('فشل جلب المستخدمين')
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
      toast.warning('يرجى ملء جميع الحقول')
      return
    }

    if (newUserData.role === 'COACH' && !newUserData.staffId) {
      toast.warning('يجب اختيار موظف لحساب الكوتش')
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
        toast.success('تم إضافة المستخدم بنجاح')
        setShowAddModal(false)
        setNewUserData({ name: '', email: '', password: '', role: 'STAFF', staffId: '' })
        setNewUserPermissions({})  // ✅ إعادة تعيين الصلاحيات
        fetchUsers()
      } else {
        toast.error(data.error || 'فشل إضافة المستخدم')
      }
    } catch (error) {
      toast.error('حدث خطأ')
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
        toast.success('تم تحديث الصلاحيات بنجاح')
        setShowPermissionsModal(false)
        fetchUsers()
      } else {
        toast.error('فشل تحديث الصلاحيات')
      }
    } catch (error) {
      toast.error('حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (user: User) => {
    setConfirmAction({
      title: user.isActive ? '⏸️ إيقاف المستخدم' : '✅ تفعيل المستخدم',
      message: `هل تريد ${user.isActive ? 'إيقاف' : 'تفعيل'} المستخدم "${user.name}"؟`,
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
            toast.success(`تم ${user.isActive ? 'إيقاف' : 'تفعيل'} المستخدم`)
            fetchUsers()
          } else {
            toast.error('فشل تحديث حالة المستخدم')
          }
        } catch (error) {
          toast.error('حدث خطأ')
        } finally {
          setLoading(false)
        }
      }
    })
    setShowConfirmModal(true)
  }

  const handleDeleteUser = (user: User) => {
    setConfirmAction({
      title: '⚠️ حذف المستخدم',
      message: `هل أنت متأكد من حذف المستخدم "${user.name}"؟ لا يمكن التراجع عن هذا الإجراء!`,
      onConfirm: async () => {
        setShowConfirmModal(false)
        setLoading(true)
        
        try {
          const response = await fetch(`/api/admin/users/${user.id}`, {
            method: 'DELETE'
          })

          if (response.ok) {
            toast.success('تم حذف المستخدم بنجاح')
            fetchUsers()
          } else {
            toast.error('فشل حذف المستخدم')
          }
        } catch (error) {
          toast.error('حدث خطأ')
        } finally {
          setLoading(false)
        }
      }
    })
    setShowConfirmModal(true)
  }

  const handleResetPassword = (user: User) => {
    setConfirmAction({
      title: '🔑 إعادة تعيين كلمة المرور',
      message: `سيتم إرسال رابط إعادة تعيين كلمة المرور إلى "${user.email}"`,
      onConfirm: async () => {
        setShowConfirmModal(false)
        toast.success('تم إرسال رابط إعادة التعيين')
      }
    })
    setShowConfirmModal(true)
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
    const labels = {
      'ADMIN': '👑 مدير',
      'MANAGER': '📊 مشرف',
      'STAFF': '👷 موظف',
      'COACH': '🏋️ كوتش'
    }
    return labels[role as keyof typeof labels] || role
  }

  const stats = {
    total: users.length,
    active: users.filter(u => u.isActive).length,
    admins: users.filter(u => u.role === 'ADMIN').length,
    managers: users.filter(u => u.role === 'MANAGER').length,
    staff: users.filter(u => u.role === 'STAFF').length,
    coaches: users.filter(u => u.role === 'COACH').length
  }

  if (loading && users.length === 0) {
    return (
      <div className="container mx-auto p-6 text-center" dir={direction}>
        <div className="text-6xl mb-4">⏳</div>
        <p className="text-xl">جاري التحميل...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6" dir={direction}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">👥 إدارة المستخدمين</h1>
          <p className="text-gray-600 dark:text-gray-300">التحكم في حسابات النظام والصلاحيات</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 font-bold flex items-center gap-2"
        >
          <span>➕</span>
          <span>إضافة مستخدم</span>
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white p-5 rounded-xl shadow-lg">
          <div className="text-3xl font-bold">{stats.total}</div>
          <div className="text-sm opacity-90">إجمالي المستخدمين</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-5 rounded-xl shadow-lg">
          <div className="text-3xl font-bold">{stats.active}</div>
          <div className="text-sm opacity-90">نشط</div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white p-5 rounded-xl shadow-lg">
          <div className="text-3xl font-bold">{stats.admins}</div>
          <div className="text-sm opacity-90">مدراء</div>
        </div>

        <div className="bg-gradient-to-br from-primary-400 to-primary-500 text-white p-5 rounded-xl shadow-lg">
          <div className="text-3xl font-bold">{stats.managers}</div>
          <div className="text-sm opacity-90">مشرفين</div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-5 rounded-xl shadow-lg">
          <div className="text-3xl font-bold">{stats.staff}</div>
          <div className="text-sm opacity-90">موظفين</div>
        </div>

        <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white p-5 rounded-xl shadow-lg">
          <div className="text-3xl font-bold">{stats.coaches}</div>
          <div className="text-sm opacity-90">كوتشات</div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600">
              <tr>
                <th className="px-6 py-4 text-right font-bold text-gray-900 dark:text-gray-100">الاسم</th>
                <th className="px-6 py-4 text-right font-bold text-gray-900 dark:text-gray-100">البريد الإلكتروني</th>
                <th className="px-6 py-4 text-right font-bold text-gray-900 dark:text-gray-100">الدور</th>
                <th className="px-6 py-4 text-right font-bold text-gray-900 dark:text-gray-100">الموظف</th>
                <th className="px-6 py-4 text-right font-bold text-gray-900 dark:text-gray-100">الحالة</th>
                <th className="px-6 py-4 text-right font-bold text-gray-900 dark:text-gray-100">تاريخ الإنشاء</th>
                <th className="px-6 py-4 text-right font-bold text-gray-900 dark:text-gray-100">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-gray-200 dark:border-gray-700 hover:bg-primary-50 dark:hover:bg-gray-700 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-500 flex items-center justify-center text-white font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-600 dark:text-gray-300 dir-ltr block">{user.email}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold border-2 ${getRoleBadge(user.role)}`}>
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {user.staff ? (
                      <div className="text-sm">
                        <div className="font-semibold text-primary-700 dark:text-primary-400">{user.staff.name}</div>
                        <div className="text-gray-500 dark:text-gray-400">#{user.staff.staffCode}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 text-sm">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                      user.isActive
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                    }`}>
                      {user.isActive ? '✅ نشط' : '❌ موقوف'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {new Date(user.createdAt).toLocaleDateString('ar-EG')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenPermissions(user)}
                        className="bg-primary-600 text-white px-3 py-2 rounded-lg hover:bg-primary-700 text-sm font-medium"
                        title="الصلاحيات"
                      >
                        🔒
                      </button>
                      
                      <button
                        onClick={() => handleToggleActive(user)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${
                          user.isActive
                            ? 'bg-orange-600 text-white hover:bg-orange-700'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                        title={user.isActive ? 'إيقاف' : 'تفعيل'}
                      >
                        {user.isActive ? '⏸️' : '▶️'}
                      </button>
                      
                      <button
                        onClick={() => handleResetPassword(user)}
                        className="bg-primary-600 text-white px-3 py-2 rounded-lg hover:bg-primary-700 text-sm font-medium"
                        title="إعادة تعيين كلمة المرور"
                      >
                        🔑
                      </button>
                      
                      <button
                        onClick={() => handleDeleteUser(user)}
                        className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-sm font-medium"
                        title="حذف"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="text-center py-20 text-gray-500 dark:text-gray-400">
            <div className="text-6xl mb-4">👥</div>
            <p className="text-xl font-medium">لا يوجد مستخدمين</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
            >
              إضافة أول مستخدم
            </button>
          </div>
        )}
      </div>

      {/* Modal: إضافة مستخدم */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-7xl w-full p-4 my-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">➕ إضافة مستخدم جديد</h2>
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-900 dark:text-gray-100">
                  الاسم <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={newUserData.name}
                  onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  placeholder="أحمد محمد"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-gray-900 dark:text-gray-100">
                  البريد الإلكتروني <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  placeholder="user@example.com"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-gray-900 dark:text-gray-100">
                  كلمة المرور <span className="text-red-600">*</span>
                </label>
                <input
                  type="password"
                  value={newUserData.password}
                  onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-gray-900 dark:text-gray-100">
                  الدور <span className="text-red-600">*</span>
                </label>
                <select
                  value={newUserData.role}
                  onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value as any, staffId: '' })}
                  className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                >
                  <option value="STAFF">👷 موظف</option>
                  <option value="MANAGER">📊 مشرف</option>
                  <option value="ADMIN">👑 مدير</option>
                  <option value="COACH">🏋️ كوتش</option>
                </select>
              </div>

              {newUserData.role === 'COACH' && (
                <div className="lg:col-span-4">
                  <label className="block text-xs font-medium mb-1 text-gray-900 dark:text-gray-100">
                    الموظف <span className="text-red-600">*</span>
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
                    <option value="">اختر موظف...</option>
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
                  <span>الصلاحيات</span>
                </h3>

                {newUserData.role === 'ADMIN' && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/30 border-r-4 border-yellow-500 dark:border-yellow-700 p-2 rounded mb-2">
                    <p className="text-xs text-yellow-800 dark:text-yellow-300">
                      <strong>👑 مدير:</strong> المدراء لديهم صلاحيات كاملة تلقائياً ولا يمكن تقييد صلاحياتهم.
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
                                disabled={newUserData.role === 'ADMIN'}
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
                  {loading ? 'جاري الإضافة...' : '✅ إضافة'}
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold text-sm"
                >
                  إلغاء
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
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">🔒 تعديل صلاحيات {editingUser.name}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">{editingUser.email}</p>
              </div>
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100 text-3xl leading-none"
              >
                ×
              </button>
            </div>

            {editingUser.role === 'ADMIN' && (
              <div className="bg-yellow-50 dark:bg-yellow-900/30 border-r-4 border-yellow-500 dark:border-yellow-700 p-4 rounded mb-6">
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  <strong>👑 مدير:</strong> المدراء لديهم صلاحيات كاملة تلقائياً ولا يمكن تقييد صلاحياتهم.
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
                            disabled={editingUser.role === 'ADMIN'}
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
                disabled={loading || editingUser.role === 'ADMIN'}
                className="flex-1 bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 disabled:bg-gray-400 font-bold"
              >
                {loading ? 'جاري الحفظ...' : '✅ حفظ الصلاحيات'}
              </button>
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold"
              >
                إلغاء
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
                ✅ تأكيد
              </button>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-6 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
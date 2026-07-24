// hooks/usePermissions.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import type { Permissions as PermissionsType } from '../types/permissions'

export interface User {
  userId?: string
  id?: string
  name: string
  email: string
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'COACH'
  staffId?: string | null
  isSales?: boolean
  profileImage?: string | null
}

// استخدام نفس interface الـ Permissions من types/permissions.ts
export type Permissions = PermissionsType

export interface AuthState {
  user: User | null
  permissions: Permissions | null
  loading: boolean
  isAdmin: boolean
}

// كان كل كومبوننت (Sidebar/Breadcrumb/TabBar/...) بيعمل fetch مستقل لـ /api/auth/me —
// 6-8 طلبات متطابقة متزامنة لكل صفحة. React Query بمفتاح واحد بيوحّدهم في طلب واحد مشترك.
async function fetchAuthState(): Promise<Omit<AuthState, 'loading'>> {
  try {
    const response = await fetch('/api/auth/me')

    if (response.ok) {
      const data = await response.json()

      // ✅ لو سيلز → نضيف صلاحيات المتابعات تلقائياً
      let perms = data.user.permissions || null
      if (data.user.isSales) {
        perms = {
          ...perms,
          canViewFollowUps: true,
          canCreateFollowUp: true,
          canEditFollowUp: true,
          canDeleteFollowUp: true,
          canViewMembers: true,
          canViewVisitors: true,
          canCreateVisitor: true,
          canEditVisitor: true,
          canViewDayUse: true,
          canViewStaff: true,
        }
      }

      return {
        user: data.user,
        permissions: perms,
        isAdmin: data.user.role === 'OWNER' || data.user.role === 'ADMIN'
      }
    }

    return { user: null, permissions: null, isAdmin: false }
  } catch (error) {
    console.error('Error fetching permissions:', error)
    return { user: null, permissions: null, isAdmin: false }
  }
}

export function usePermissions() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['auth-me'],
    queryFn: fetchAuthState,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const authState: AuthState = {
    user: data?.user ?? null,
    permissions: data?.permissions ?? null,
    isAdmin: data?.isAdmin ?? false,
    loading: isLoading,
  }

  // ✅ التحقق من صلاحية واحدة
  const hasPermission = (permission: keyof Permissions): boolean => {
    const result = authState.isAdmin || (authState.permissions?.[permission] ?? false)
    return result
  }

  // ✅ التحقق من صلاحيات متعددة (يجب توفر واحدة على الأقل)
  const hasAnyPermission = (permissions: Array<keyof Permissions>): boolean => {
    if (authState.isAdmin) return true
    return permissions.some(perm => hasPermission(perm))
  }

  // ✅ التحقق من صلاحيات متعددة (يجب توفر الكل)
  const hasAllPermissions = (permissions: Array<keyof Permissions>): boolean => {
    if (authState.isAdmin) return true
    return permissions.every(perm => hasPermission(perm))
  }

  return {
    ...authState,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refreshPermissions: refetch
  }
}

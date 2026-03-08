// hooks/usePermissions.ts
'use client'

import { useState, useEffect } from 'react'
import type { Permissions as PermissionsType } from '../types/permissions'

export interface User {
  userId?: string
  id?: string
  name: string
  email: string
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'COACH'
  staffId?: string | null
}

// استخدام نفس interface الـ Permissions من types/permissions.ts
export type Permissions = PermissionsType

export interface AuthState {
  user: User | null
  permissions: Permissions | null
  loading: boolean
  isAdmin: boolean
}

export function usePermissions() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    permissions: null,
    loading: true,
    isAdmin: false
  })

  useEffect(() => {
    fetchUserPermissions()
  }, [])

  const fetchUserPermissions = async () => {
    try {
      const response = await fetch('/api/auth/me')
      
      if (response.ok) {
        const data = await response.json()
        setAuthState({
          user: data.user,
          permissions: data.user.permissions || null,
          loading: false,
          isAdmin: data.user.role === 'OWNER' || data.user.role === 'ADMIN'
        })
      } else {
        setAuthState({
          user: null,
          permissions: null,
          loading: false,
          isAdmin: false
        })
      }
    } catch (error) {
      console.error('Error fetching permissions:', error)
      setAuthState({
        user: null,
        permissions: null,
        loading: false,
        isAdmin: false
      })
    }
  }

  // ✅ التحقق من صلاحية واحدة
  const hasPermission = (permission: keyof Permissions): boolean => {
    if (authState.isAdmin) return true
    if (!authState.permissions) return false
    return authState.permissions[permission]
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
    refreshPermissions: fetchUserPermissions
  }
}
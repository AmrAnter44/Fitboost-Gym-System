'use client'

import { createContext, useContext, useState, useRef, ReactNode, useCallback, useEffect } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastMessage {
  id: string
  message: string
  type: ToastType
  duration?: number
}

export interface Notification {
  id: string
  message: string
  type: ToastType
  timestamp: number
  read: boolean
}

const NOTIFICATIONS_KEY = 'xgym_notifications'
const MAX_NOTIFICATIONS = 50

function loadNotifications(): Notification[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveNotifications(notifications: Notification[]) {
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications))
  } catch {
    // ignore storage errors
  }
}

interface ToastContextType {
  toasts: ToastMessage[]
  addToast: (message: string, type?: ToastType, duration?: number) => void
  removeToast: (id: string) => void
  success: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
  warning: (message: string, duration?: number) => void
  info: (message: string, duration?: number) => void
  // Persistent notifications
  notifications: Notification[]
  unreadCount: number
  markAllRead: () => void
  clearNotifications: () => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer))
      timersRef.current.clear()
    }
  }, [])

  // Load notifications from localStorage on mount
  useEffect(() => {
    setNotifications(loadNotifications())
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
    // Clean up timer reference
    timersRef.current.delete(id)
  }, [])

  const addToast = useCallback((message: string, type: ToastType = 'info', duration: number = 4000) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: ToastMessage = { id, message, type, duration }

    setToasts((prev) => [...prev, newToast])

    // Also save to persistent notifications
    const newNotification: Notification = {
      id,
      message,
      type,
      timestamp: Date.now(),
      read: false,
    }
    setNotifications((prev) => {
      const updated = [newNotification, ...prev].slice(0, MAX_NOTIFICATIONS)
      saveNotifications(updated)
      return updated
    })

    // Auto remove toast after duration (with cleanup tracking)
    if (duration > 0) {
      const timer = setTimeout(() => {
        removeToast(id)
      }, duration)
      timersRef.current.set(id, timer)
    }
  }, [removeToast])

  const success = useCallback((message: string, duration?: number) => {
    addToast(message, 'success', duration)
  }, [addToast])

  const error = useCallback((message: string, duration?: number) => {
    addToast(message, 'error', duration)
  }, [addToast])

  const warning = useCallback((message: string, duration?: number) => {
    addToast(message, 'warning', duration)
  }, [addToast])

  const info = useCallback((message: string, duration?: number) => {
    addToast(message, 'info', duration)
  }, [addToast])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }))
      saveNotifications(updated)
      return updated
    })
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
    saveNotifications([])
  }, [])

  return (
    <ToastContext.Provider value={{
      toasts, addToast, removeToast, success, error, warning, info,
      notifications, unreadCount, markAllRead, clearNotifications,
    }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

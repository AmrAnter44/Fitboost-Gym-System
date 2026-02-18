'use client'

import { useState, useRef, useEffect } from 'react'
import { useToast } from '../contexts/ToastContext'
import type { Notification, ToastType } from '../contexts/ToastContext'
import { useLanguage } from '../contexts/LanguageContext'

function typeIcon(type: ToastType) {
  switch (type) {
    case 'success': return '✅'
    case 'error':   return '❌'
    case 'warning': return '⚠️'
    default:        return 'ℹ️'
  }
}

function typeBg(type: ToastType) {
  switch (type) {
    case 'success': return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
    case 'error':   return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
    case 'warning': return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700'
    default:        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
  }
}

function formatTime(timestamp: number, locale: string): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (locale === 'ar') {
    if (minutes < 1) return 'الآن'
    if (minutes < 60) return `منذ ${minutes} د`
    if (hours < 24) return `منذ ${hours} س`
    return `منذ ${days} ي`
  } else {
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }
}

export default function NotificationsCenter() {
  const { notifications, unreadCount, markAllRead, clearNotifications } = useToast()
  const { locale } = useLanguage()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Mark all read when opening
  const handleOpen = () => {
    setOpen((prev) => {
      if (!prev && unreadCount > 0) markAllRead()
      return !prev
    })
  }

  const isRtl = locale === 'ar'

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        className="w-9 h-9 bg-white/10 dark:bg-gray-700 backdrop-blur-sm rounded-full hover:bg-white/20 dark:hover:bg-gray-600 transition-all hover:scale-110 active:scale-95 flex items-center justify-center flex-shrink-0 border border-white/20 dark:border-gray-600 shadow-lg relative"
        title={isRtl ? 'الإشعارات' : 'Notifications'}
      >
        <span className="text-base">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-primary-700 dark:border-gray-900 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div
          dir={isRtl ? 'rtl' : 'ltr'}
          className={`absolute top-12 ${isRtl ? 'left-0' : 'right-0'} w-80 sm:w-96 bg-white/95 dark:bg-gray-800/95 backdrop-blur-lg rounded-xl shadow-2xl border-2 border-gray-200/80 dark:border-gray-600 z-50 overflow-hidden`}
        >
          {/* Header */}
          <div className="bg-primary-700 dark:bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔔</span>
              <span className="font-bold text-sm">
                {isRtl ? 'الإشعارات' : 'Notifications'}
              </span>
              {notifications.length > 0 && (
                <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  {notifications.length}
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <button
                onClick={clearNotifications}
                className="text-xs text-white/70 hover:text-white transition-colors font-medium"
              >
                {isRtl ? 'مسح الكل' : 'Clear all'}
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
            {notifications.length === 0 ? (
              <div className="py-10 flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
                <span className="text-3xl">🔕</span>
                <span className="text-sm">
                  {isRtl ? 'لا توجد إشعارات' : 'No notifications yet'}
                </span>
              </div>
            ) : (
              notifications.map((n: Notification) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 flex items-start gap-3 border-r-4 ${typeBg(n.type)} ${n.read ? 'opacity-70' : ''}`}
                >
                  <span className="text-base flex-shrink-0 mt-0.5">{typeIcon(n.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 dark:text-gray-100 leading-snug break-words">
                      {n.message}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {formatTime(n.timestamp, locale)}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useRef, useEffect } from 'react'
import { useToast } from '../contexts/ToastContext'
import type { Notification, ToastType } from '../contexts/ToastContext'
import { useLanguage } from '../contexts/LanguageContext'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

function TypeIcon({ type, className = 'w-5 h-5' }: { type: ToastType; className?: string }) {
  switch (type) {
    case 'success':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'error':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'warning':
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )
    default:
      return (
        <svg className={className} {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
  }
}

function typeColors(type: ToastType): { bg: string; iconText: string } {
  switch (type) {
    case 'success':
      return {
        bg: 'bg-green-50 dark:bg-green-900/20',
        iconText: 'text-green-600 dark:text-green-400',
      }
    case 'error':
      return {
        bg: 'bg-red-50 dark:bg-red-900/20',
        iconText: 'text-red-600 dark:text-red-400',
      }
    case 'warning':
      return {
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        iconText: 'text-amber-600 dark:text-amber-400',
      }
    default:
      return {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        iconText: 'text-blue-600 dark:text-blue-400',
      }
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

  const handleOpen = () => {
    setOpen((prev) => !prev)
  }

  useEffect(() => {
    if (open && unreadCount > 0) {
      markAllRead()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const isRtl = locale === 'ar'

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        aria-label={isRtl ? 'الإشعارات' : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={isRtl ? 'الإشعارات' : 'Notifications'}
        className="w-9 h-9 bg-white/10 dark:bg-gray-700 backdrop-blur-sm rounded-full hover:bg-white/20 dark:hover:bg-gray-600 transition-[transform,background-color] duration-200 hover:scale-110 active:scale-95 flex items-center justify-center flex-shrink-0 ring-1 ring-white/20 dark:ring-gray-600 shadow-sm relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <svg className="w-5 h-5" {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span
            aria-label={isRtl ? `${unreadCount} غير مقروء` : `${unreadCount} unread`}
            className="absolute -top-1 -end-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 ring-2 ring-primary-700 dark:ring-gray-900 animate-pulse"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="notifications-title"
          dir={isRtl ? 'rtl' : 'ltr'}
          className={`absolute top-12 ${isRtl ? 'start-0' : 'end-0'} w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-xl shadow-xl ring-1 ring-gray-200 dark:ring-gray-700 z-50 overflow-hidden`}
        >
          {/* Header */}
          <div className="bg-primary-500 dark:bg-gray-900 text-primary-contrast dark:text-gray-100 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span id="notifications-title" className="font-bold text-sm">
                {isRtl ? 'الإشعارات' : 'Notifications'}
              </span>
              {notifications.length > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-gray-900/10 dark:bg-white/10 text-gray-900 dark:text-gray-100">
                  {notifications.length}
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <button
                onClick={clearNotifications}
                className="text-xs text-gray-900/80 dark:text-gray-100/80 hover:text-gray-900 dark:hover:text-gray-100 transition-colors duration-200 font-medium underline-offset-2 hover:underline"
              >
                {isRtl ? 'مسح الكل' : 'Clear all'}
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700/60">
            {notifications.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-3 text-center">
                <svg className="w-12 h-12 text-gray-400" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M3 3l18 18" />
                </svg>
                <span className="text-sm text-gray-600 dark:text-gray-300 font-bold">
                  {isRtl ? 'لا توجد إشعارات' : 'No notifications yet'}
                </span>
              </div>
            ) : (
              notifications.map((n: Notification) => {
                const colors = typeColors(n.type)
                return (
                  <div
                    key={n.id}
                    className={`px-4 py-3 flex items-start gap-3 ${colors.bg} ${n.read ? 'opacity-70' : ''}`}
                  >
                    <span className={`flex-shrink-0 mt-0.5 ${colors.iconText}`}>
                      <TypeIcon type={n.type} className="w-5 h-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-gray-100 leading-snug break-words">
                        {n.message}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {formatTime(n.timestamp, locale)}
                      </p>
                    </div>
                    {!n.read && (
                      <span aria-hidden="true" className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

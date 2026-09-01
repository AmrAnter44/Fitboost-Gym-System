'use client'

import { useRef, useEffect, CSSProperties } from 'react'
import { List, useDynamicRowHeight, DynamicRowHeight } from 'react-window'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface Visitor {
  id: string
  name: string
  phone: string
  notes?: string
  source: string
  interestedIn?: string
  status: string
  createdAt: string
}

interface VisitorCardRowProps {
  visitors: Visitor[]
  onFollowUp: (visitor: Visitor) => void
  onHistory: (visitor: Visitor) => void
  onDelete: (visitor: Visitor) => void
  onUpdateStatus: (id: string, status: string) => void
  t: (key: string, params?: Record<string, string>) => string
  direction: string
  dynamicRowHeight: DynamicRowHeight
}

const VisitorCardRow = ({
  index,
  style,
  ariaAttributes,
  visitors,
  onFollowUp,
  onHistory,
  onDelete,
  onUpdateStatus,
  t,
  direction,
  dynamicRowHeight,
}: { index: number; style: CSSProperties; ariaAttributes: any } & VisitorCardRowProps) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) {
      return dynamicRowHeight.observeRowElements([ref.current])
    }
  }, [dynamicRowHeight])

  const visitor = visitors[index]
  if (!visitor) return null

  const sourceLabels: Record<string, string> = {
    'walk-in': t('visitors.sources.walkIn'),
    'call-in': t('visitors.sources.callIn'),
    'suggestion': t('visitors.sources.suggestion'),
    'facebook': t('visitors.sources.facebook'),
    'instagram': t('visitors.sources.instagram'),
    'tiktok': t('visitors.sources.tiktok'),
    'chatgpt': t('visitors.sources.chatgpt'),
    'google_maps': direction === 'rtl' ? 'جوجل ماب / Google Maps' : 'Google Maps',
    'website': t('visitors.sources.website'),
    'friend_referral': t('visitors.sources.friendReferral'),
    'friend': t('visitors.sources.friend'),
    'other': t('visitors.sources.other'),
  }
  const sourceLabel = sourceLabels[visitor.source] || visitor.source

  return (
    <div ref={ref} style={{ ...style, paddingBottom: 20 }} {...ariaAttributes}>
      <div
        data-react-window-index={index}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden"
      >
        {/* Actions في الأعلى */}
        <div className="bg-gray-50 dark:bg-gray-900/40 px-4 py-2 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-2 flex-wrap">
            {visitor.status === 'subscribed' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                <svg className="w-3.5 h-3.5" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                مشترك
              </span>
            ) : (
              <button
                onClick={() => onFollowUp(visitor)}
                className="inline-flex items-center gap-1 text-primary-700 dark:text-primary-300 hover:text-primary-800 dark:hover:text-primary-200 text-xs font-bold px-2.5 py-1 rounded-md bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors duration-200"
              >
                <svg className="w-3.5 h-3.5" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {t('visitors.actions.followUp')}
              </button>
            )}
            <button
              onClick={() => onHistory(visitor)}
              className="inline-flex items-center gap-1 text-primary-700 dark:text-primary-300 hover:text-primary-800 dark:hover:text-primary-200 text-xs font-bold px-2.5 py-1 rounded-md bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors duration-200"
            >
              <svg className="w-3.5 h-3.5" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              {t('visitors.actions.history')}
            </button>
          </div>
          <button
            onClick={() => onDelete(visitor)}
            aria-label={t('visitors.actions.delete')}
            className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xs font-bold px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors duration-200"
          >
            <svg className="w-3.5 h-3.5" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
            </svg>
            {t('visitors.actions.delete')}
          </button>
        </div>

        {/* محتوى الكارت */}
        <div className="p-4 space-y-3">
          {/* الاسم */}
          <div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">{visitor.name}</h3>
          </div>

          {/* رقم الهاتف */}
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <a
              href={`https://wa.me/20${visitor.phone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 rounded-lg font-bold text-xs sm:text-sm bg-green-500 hover:bg-green-600 text-white transition-colors duration-200"
            >
              <svg className="w-3.5 h-3.5" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="font-mono">{visitor.phone}</span>
            </a>
          </div>

          {/* المصدر */}
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="text-gray-700 dark:text-gray-300 text-sm">{sourceLabel}</span>
          </div>

          {/* مهتم بـ */}
          {visitor.interestedIn && (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span className="text-gray-700 dark:text-gray-300 text-sm">{visitor.interestedIn}</span>
            </div>
          )}

          {/* الحالة */}
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <select
              value={visitor.status}
              onChange={(e) => onUpdateStatus(visitor.id, e.target.value)}
              aria-label={t('visitors.table.status' as any) || 'status'}
              className="text-xs px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 flex-1 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200"
            >
              <option value="pending">{t('visitors.status.pending')}</option>
              <option value="contacted">{t('visitors.status.contacted')}</option>
              <option value="subscribed">{t('visitors.status.subscribed')}</option>
              <option value="rejected">{t('visitors.status.rejected')}</option>
            </select>
          </div>

          {/* تاريخ الزيارة */}
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-gray-700 dark:text-gray-300 text-sm">
              {new Date(visitor.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
            </span>
          </div>

          {/* الملاحظات */}
          {visitor.notes && (
            <div className="bg-gray-50 dark:bg-gray-900/40 p-3 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700">
              <p className="text-sm text-gray-700 dark:text-gray-300 flex gap-2">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-500 dark:text-gray-400" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>
                  <span className="font-bold">{t('visitors.table.notes')}:</span> {visitor.notes}
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface VirtualVisitorListProps {
  visitors: Visitor[]
  onFollowUp: (visitor: Visitor) => void
  onHistory: (visitor: Visitor) => void
  onDelete: (visitor: Visitor) => void
  onUpdateStatus: (id: string, status: string) => void
  t: (key: string, params?: Record<string, string>) => string
  direction: string
}

export default function VirtualVisitorList({
  visitors,
  onFollowUp,
  onHistory,
  onDelete,
  onUpdateStatus,
  t,
  direction,
}: VirtualVisitorListProps) {
  const dynamicRowHeight = useDynamicRowHeight({ defaultRowHeight: 300 })

  return (
    <List
      rowComponent={VisitorCardRow}
      rowProps={{
        visitors,
        onFollowUp,
        onHistory,
        onDelete,
        onUpdateStatus,
        t,
        direction,
        dynamicRowHeight,
      } as any}
      rowCount={visitors.length}
      rowHeight={dynamicRowHeight}
      style={{ height: 'calc(100vh - 280px)', minHeight: 400 }}
      overscanCount={3}
      className="hide-scrollbar md:scrollbar-thin"
    />
  )
}

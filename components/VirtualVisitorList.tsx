'use client'

import { useRef, useEffect, CSSProperties } from 'react'
import { List, useDynamicRowHeight, DynamicRowHeight } from 'react-window'

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
    'facebook': t('visitors.sources.facebook'),
    'instagram': t('visitors.sources.instagram'),
    'friend': t('visitors.sources.friend'),
    'other': t('visitors.sources.other'),
  }
  const sourceLabel = sourceLabels[visitor.source] || visitor.source

  return (
    <div style={{ ...style, paddingBottom: 16 }} {...ariaAttributes}>
      <div
        ref={ref}
        data-react-window-index={index}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-md border-r-4 border-green-500 overflow-hidden"
      >
        {/* Actions في الأعلى */}
        <div className="bg-gray-50 dark:bg-gray-700 px-4 py-2 flex justify-between items-center border-b dark:border-gray-600">
          <div className="flex gap-2 flex-wrap">
            {visitor.status === 'subscribed' ? (
              <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-3 py-1 rounded text-xs font-bold">
                ✅ مشترك
              </span>
            ) : (
              <button
                onClick={() => onFollowUp(visitor)}
                className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 text-xs font-medium px-2 py-1 rounded bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50"
              >
                ➕ {t('visitors.actions.followUp')}
              </button>
            )}
            <button
              onClick={() => onHistory(visitor)}
              className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 text-xs font-medium px-2 py-1 rounded bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50"
            >
              📋 {t('visitors.actions.history')}
            </button>
          </div>
          <button
            onClick={() => onDelete(visitor)}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-xs font-bold px-2 py-1 rounded bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50"
          >
            🗑️ {t('visitors.actions.delete')}
          </button>
        </div>

        {/* محتوى الكارت */}
        <div className="p-4 space-y-3">
          {/* الاسم */}
          <div>
            <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100">{visitor.name}</h3>
          </div>

          {/* رقم الهاتف */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400 text-sm">📱</span>
            <a
              href={`https://wa.me/20${visitor.phone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 rounded-lg font-medium text-xs sm:text-sm bg-green-500 hover:bg-green-600 text-white transition-colors"
            >
              <span>💬</span>
              <span className="font-mono">{visitor.phone}</span>
            </a>
          </div>

          {/* المصدر */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400 text-sm">📂</span>
            <span className="text-gray-700 dark:text-gray-200 text-sm">{sourceLabel}</span>
          </div>

          {/* مهتم بـ */}
          {visitor.interestedIn && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500 dark:text-gray-400 text-sm">💡</span>
              <span className="text-gray-700 dark:text-gray-200 text-sm">{visitor.interestedIn}</span>
            </div>
          )}

          {/* الحالة */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400 text-sm">📊</span>
            <select
              value={visitor.status}
              onChange={(e) => onUpdateStatus(visitor.id, e.target.value)}
              className="text-xs px-2 py-1 rounded border dark:border-gray-600 dark:bg-gray-700 dark:text-white flex-1"
            >
              <option value="pending">{t('visitors.status.pending')}</option>
              <option value="contacted">{t('visitors.status.contacted')}</option>
              <option value="subscribed">{t('visitors.status.subscribed')}</option>
              <option value="rejected">{t('visitors.status.rejected')}</option>
            </select>
          </div>

          {/* تاريخ الزيارة */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400 text-sm">📅</span>
            <span className="text-gray-700 dark:text-gray-200 text-sm">
              {new Date(visitor.createdAt).toLocaleDateString(direction === 'rtl' ? 'ar-EG' : 'en-US')}
            </span>
          </div>

          {/* الملاحظات */}
          {visitor.notes && (
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                <span className="font-semibold">📝 {t('visitors.table.notes')}:</span> {visitor.notes}
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
    />
  )
}

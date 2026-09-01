'use client'

import { useRef, useEffect, CSSProperties, useCallback } from 'react'
import { List, useDynamicRowHeight, DynamicRowHeight } from 'react-window'
import { useQueryClient } from '@tanstack/react-query'
import { formatDateYMD, calculateRemainingDays } from '@/lib/dateFormatter'
import { getPackageName } from '@/lib/memberUtils'
import LazyAvatar from './LazyAvatar'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface Member {
  id: string
  memberNumber: string | null
  name: string
  phone: string
  profileImage?: string | null
  subscriptionPrice: number
  remainingAmount: number
  isActive: boolean
  isFrozen: boolean
  isBanned: boolean
  remainingCheckIns?: number | null
  freezeUntil?: string
  startDate?: string
  expiryDate?: string
  salesStaff?: { id: string; name: string } | null
  coach?: { id: string; name: string } | null
  noCoachWanted?: boolean
  pendingRenewalStartDate?: string | null
  pendingRenewalExpiryDate?: string | null
}

interface MemberCardRowProps {
  members: Member[]
  lastReceipts: Record<string, any>
  onViewDetails: (id: string) => void
  onShowReceipts: (id: string, memberNumber: string) => void
  onPrefetch: (id: string) => void
  t: (key: string, params?: Record<string, string>) => string
  locale: string
  direction: string
  dynamicRowHeight: DynamicRowHeight
}

// RowComponent must be defined at module level (not inline) to keep hook rules
const MemberCardRow = ({
  index,
  style,
  ariaAttributes,
  members,
  lastReceipts,
  onViewDetails,
  onShowReceipts,
  onPrefetch,
  t,
  locale,
  direction,
  dynamicRowHeight,
}: { index: number; style: CSSProperties; ariaAttributes: any } & MemberCardRowProps) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) {
      return dynamicRowHeight.observeRowElements([ref.current])
    }
  }, [dynamicRowHeight])

  const member = members[index]
  if (!member) return null

  const todayCheck = new Date(); todayCheck.setHours(0, 0, 0, 0)
  const expiryDateNorm = member.expiryDate ? (() => { const d = new Date(member.expiryDate); d.setHours(0, 0, 0, 0); return d })() : null
  const startDate = member.startDate ? (() => { const d = new Date(member.startDate); d.setHours(0, 0, 0, 0); return d })() : null
  const isExpired = expiryDateNorm ? expiryDateNorm < todayCheck : false
  const daysRemaining = calculateRemainingDays(member.expiryDate)
  const isExpiringSoon = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7
  const isBanned = member.isBanned
  const isNotStartedYet = !!(member.isActive && startDate && startDate > todayCheck)
  const daysUntilStart = isNotStartedYet ? Math.ceil((startDate!.getTime() - todayCheck.getTime()) / (1000 * 60 * 60 * 24)) : 0

  const ringColor = isBanned
    ? 'ring-gray-800 dark:ring-gray-700'
    : member.isFrozen
      ? 'ring-blue-300 dark:ring-blue-700'
      : isNotStartedYet
        ? 'ring-purple-300 dark:ring-purple-700'
        : isExpiringSoon
          ? 'ring-orange-300 dark:ring-orange-700'
          : member.isActive && !isExpired
            ? 'ring-green-300 dark:ring-green-700'
            : 'ring-red-300 dark:ring-red-700'

  const statusBadge = isBanned
    ? 'bg-gray-800 text-white dark:bg-gray-900 dark:text-gray-100'
    : member.isFrozen
      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
      : isNotStartedYet
        ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
        : isExpiringSoon
          ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
          : member.isActive && !isExpired
            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
            : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'

  const StatusIcon = () => {
    if (isBanned) {
      return (
        <svg className="w-3.5 h-3.5" {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      )
    }
    if (member.isFrozen) {
      return (
        <svg className="w-3.5 h-3.5" {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18M5.636 5.636l12.728 12.728M5.636 18.364L18.364 5.636" />
        </svg>
      )
    }
    if (isNotStartedYet) {
      return (
        <svg className="w-3.5 h-3.5" {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
    if (isExpiringSoon) {
      return (
        <svg className="w-3.5 h-3.5" {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )
    }
    if (member.isActive && !isExpired) {
      return (
        <svg className="w-3.5 h-3.5" {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
    return (
      <svg className="w-3.5 h-3.5" {...stroke}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    )
  }

  const statusLabel = isBanned
    ? (locale === 'ar' ? 'محظور' : 'Banned')
    : member.isFrozen
      ? (locale === 'ar' ? 'مجمد' : 'Frozen')
      : isNotStartedYet
        ? (locale === 'ar' ? `يبدأ بعد ${daysUntilStart} يوم` : `Starts in ${daysUntilStart}d`)
        : isExpiringSoon
          ? (locale === 'ar' ? 'ينتهي قريباً' : 'Expiring Soon')
          : member.isActive && !isExpired
            ? t('members.active')
            : t('members.expired')

  return (
    <div ref={ref} style={{ ...style, paddingBottom: 20 }} {...ariaAttributes}>
      <div
        data-react-window-index={index}
        onMouseEnter={() => onPrefetch(member.id)}
        onClick={() => onViewDetails(member.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onViewDetails(member.id)
          }
        }}
        className={`rounded-xl shadow-sm overflow-hidden ring-1 ${ringColor} hover:shadow-md transition-[box-shadow,background-color] duration-200 cursor-pointer ${
          isBanned ? 'bg-white/80 dark:bg-gray-800/80 opacity-75' : 'bg-white dark:bg-gray-800'
        }`}
        dir={direction}
      >
        {/* Header: صورة + اسم + رقم + حالة */}
        <div className="p-3 flex items-center gap-3">
          <div className="w-14 h-14 rounded-full overflow-hidden ring-1 ring-gray-200 dark:ring-gray-600 bg-gray-100 dark:bg-gray-700 flex-shrink-0">
            <LazyAvatar
              src={member.profileImage}
              alt={member.name}
              fallback={
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <svg className="w-7 h-7" {...stroke}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              }
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate text-base">{member.name}</h3>
              {isBanned && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-900 text-white flex-shrink-0" aria-label={locale === 'ar' ? 'محظور' : 'Banned'}>
                  <svg className="w-3 h-3" {...stroke}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {member.memberNumber !== null ? (
                <span className="text-primary-700 dark:text-primary-400 font-bold text-sm">#{member.memberNumber}</span>
              ) : (
                <span className="text-gray-500 dark:text-gray-400 text-xs">{locale === 'ar' ? 'بدون عضوية' : 'Non-Member'}</span>
              )}
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <a
                href={`https://wa.me/+20${member.phone.startsWith('0') ? member.phone.substring(1) : member.phone}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-sm font-medium font-mono transition-colors duration-200"
              >
                {member.phone}
              </a>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-3 pb-3 space-y-2">
          {/* Status + Package */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${statusBadge}`}>
              <StatusIcon />
              {statusLabel}
              {member.isFrozen && member.freezeUntil && (
                <span className="text-[10px] font-normal ms-1">
                  {locale === 'ar' ? 'لحد' : 'until'} {new Date(member.freezeUntil).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </span>
            {/* بادج باقة الدخلات — علامة مميزة للأعضاء اللي عندهم باقة بعدد دخلات */}
            {member.remainingCheckIns !== null && member.remainingCheckIns !== undefined && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 ring-1 ring-purple-300 dark:ring-purple-700">
                🎟️ {member.remainingCheckIns} {locale === 'ar' ? 'دخلة' : 'entries'}
              </span>
            )}
            {/*  🔁 تجديد مجدول — العضو جدّد واشتراكه القديم لسه شغّال */}
            {member.pendingRenewalStartDate && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 ring-1 ring-blue-300 dark:ring-blue-700"
                title={locale === 'ar' ? `يبدأ ${formatDateYMD(member.pendingRenewalStartDate)}` : `Starts ${formatDateYMD(member.pendingRenewalStartDate)}`}
              >
                🔁 {locale === 'ar' ? 'تجديد مجدول' : 'Scheduled renewal'}
              </span>
            )}
            </div>
            <span className="text-primary-700 dark:text-primary-400 font-bold text-xs">
              {getPackageName(member.startDate, member.expiryDate, locale)}
            </span>
          </div>

          {/* Price + Dates row */}
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40 rounded-lg px-3 py-2">
            <div>
              <span className="font-bold text-gray-800 dark:text-gray-200">{member.subscriptionPrice}</span> {t('members.egp')}
            </div>
            <div className="flex items-center gap-1 font-mono">
              <span>{formatDateYMD(member.startDate)}</span>
              <span className="text-gray-400" aria-hidden="true">→</span>
              <span className={isNotStartedYet ? 'text-purple-600 dark:text-purple-400 font-bold' : isExpired ? 'text-red-600 dark:text-red-400 font-bold' : isExpiringSoon ? 'text-orange-600 dark:text-orange-400 font-bold' : ''}>
                {member.expiryDate ? formatDateYMD(member.expiryDate) : '-'}
              </span>
            </div>
          </div>

          {/* Sales / Coach tags */}
          {(member.salesStaff?.name || member.coach?.name || member.noCoachWanted) && (
            <div className="flex flex-wrap gap-1.5">
              {/*  مش عايز كابتن — يظهر لو مفيش كوتش متعيّن */}
              {!member.coach?.name && member.noCoachWanted && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-800">
                  <svg className="w-3 h-3" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 1 1-12.728 0M12 3v9" /></svg>
                  {locale === 'ar' ? 'مش عايز كابتن' : 'No coach wanted'}
                </span>
              )}
              {member.salesStaff?.name && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300">
                  <svg className="w-3 h-3" {...stroke}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {member.salesStaff.name}
                </span>
              )}
              {member.coach?.name && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                  <svg className="w-3 h-3" {...stroke}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                  </svg>
                  {member.coach.name}
                </span>
              )}
            </div>
          )}

          {/* Days remaining */}
          {member.expiryDate && !isNotStartedYet && daysRemaining !== null && daysRemaining > 0 && (
            <p className={`text-xs text-center inline-flex items-center justify-center gap-1 w-full ${isExpiringSoon ? 'text-orange-600 dark:text-orange-400 font-bold' : 'text-gray-600 dark:text-gray-400'}`}>
              {isExpiringSoon && (
                <svg className="w-3.5 h-3.5" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              {t('members.daysRemaining', { days: daysRemaining.toString() })}
            </p>
          )}
          {member.expiryDate && !isNotStartedYet && isExpired && daysRemaining !== null && (
            <p className="text-xs text-center text-red-600 dark:text-red-400 font-bold inline-flex items-center justify-center gap-1 w-full">
              <svg className="w-3.5 h-3.5" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              {t('members.expiredSince', { days: Math.abs(daysRemaining).toString() })}
            </p>
          )}

          {/* Last Receipt - compact */}
          {lastReceipts[member.id] && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onShowReceipts(member.id, member.memberNumber) }}
              className="w-full flex items-center justify-between bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-200 dark:ring-orange-700 rounded-lg px-3 py-2 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors duration-200"
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" {...stroke}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-xs font-bold text-orange-700 dark:text-orange-300">
                  #{lastReceipts[member.id].receiptNumber} - {lastReceipts[member.id].amount} {t('members.egp')}
                </span>
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                {new Date(lastReceipts[member.id].createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
              </span>
            </button>
          )}

        </div>
      </div>
    </div>
  )
}

interface VirtualMemberListProps {
  members: Member[]
  lastReceipts: Record<string, any>
  onViewDetails: (id: string) => void
  onShowReceipts: (id: string, memberNumber: string) => void
  t: (key: string, params?: Record<string, string>) => string
  locale: string
  direction: string
}

export default function VirtualMemberList({
  members,
  lastReceipts,
  onViewDetails,
  onShowReceipts,
  t,
  locale,
  direction,
}: VirtualMemberListProps) {
  const dynamicRowHeight = useDynamicRowHeight({ defaultRowHeight: 250 })
  const queryClient = useQueryClient()

  const onPrefetch = useCallback((id: string) => {
    queryClient.prefetchQuery({
      queryKey: ['member', id],
      queryFn: () => fetch(`/api/members/${id}`).then(r => r.json()),
      staleTime: 30 * 1000,
    })
  }, [queryClient])

  return (
    <List
      rowComponent={MemberCardRow}
      rowProps={{
        members,
        lastReceipts,
        onViewDetails,
        onShowReceipts,
        onPrefetch,
        t,
        locale,
        direction,
        dynamicRowHeight,
      } as any}
      rowCount={members.length}
      rowHeight={dynamicRowHeight}
      style={{ height: 'calc(100vh - 280px)', minHeight: 400 }}
      overscanCount={3}
      className="hide-scrollbar md:scrollbar-thin"
    />
  )
}

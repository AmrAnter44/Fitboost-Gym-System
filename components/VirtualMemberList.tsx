'use client'

import { useRef, useEffect, CSSProperties, useCallback } from 'react'
import { List, useDynamicRowHeight, DynamicRowHeight } from 'react-window'
import { useQueryClient } from '@tanstack/react-query'
import { formatDateYMD, calculateRemainingDays } from '@/lib/dateFormatter'
import { getPackageName } from '@/lib/memberUtils'

interface Member {
  id: string
  memberNumber: number | null
  name: string
  phone: string
  profileImage?: string | null
  subscriptionPrice: number
  remainingAmount: number
  isActive: boolean
  isFrozen: boolean
  isBanned: boolean
  freezeUntil?: string
  startDate?: string
  expiryDate?: string
}

interface MemberCardRowProps {
  members: Member[]
  lastReceipts: Record<string, any>
  onViewDetails: (id: string) => void
  onShowReceipts: (id: string, memberNumber: number) => void
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

  const isExpired = member.expiryDate ? new Date(member.expiryDate) < new Date() : false
  const daysRemaining = calculateRemainingDays(member.expiryDate)
  const isExpiringSoon = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7
  const isBanned = member.isBanned
  // التحقق من اشتراك لم يبدأ بعد
  const startDate = member.startDate ? new Date(member.startDate) : null
  const todayCheck = new Date(); todayCheck.setHours(0, 0, 0, 0)
  const isNotStartedYet = member.isActive && startDate && startDate > todayCheck
  const daysUntilStart = isNotStartedYet ? Math.ceil((startDate!.getTime() - todayCheck.getTime()) / (1000 * 60 * 60 * 24)) : 0

  const borderColor = isBanned
    ? 'border-gray-800'
    : member.isFrozen
      ? 'border-blue-400 dark:border-blue-600'
      : isNotStartedYet
        ? 'border-purple-400 dark:border-purple-600'
        : isExpiringSoon
          ? 'border-orange-400'
          : member.isActive && !isExpired
            ? 'border-green-400'
            : 'border-red-400'

  return (
    <div style={{ ...style, paddingBottom: 12 }} {...ariaAttributes}>
      <div
        ref={ref}
        data-react-window-index={index}
        onMouseEnter={() => onPrefetch(member.id)}
        onClick={() => onViewDetails(member.id)}
        className={`rounded-xl shadow-md overflow-hidden border-2 ${borderColor} hover:shadow-lg transition cursor-pointer ${
          isBanned ? 'bg-white/80 dark:bg-gray-800/80 opacity-75' : 'bg-white dark:bg-gray-800'
        }`}
        dir={direction}
      >
        {/* Header: صورة + اسم + رقم + حالة */}
        <div className="p-3 flex items-center gap-3">
          <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 flex-shrink-0">
            {member.profileImage ? (
              <img src={member.profileImage} alt={member.name} loading="lazy" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900 dark:text-white truncate text-base">{member.name}</h3>
              {isBanned && <span className="bg-gray-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">🚫</span>}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {member.memberNumber !== null ? (
                <span className="text-primary-600 font-bold text-sm">#{member.memberNumber}</span>
              ) : (
                <span className="text-gray-500 text-xs">{locale === 'ar' ? 'بدون عضوية' : 'Non-Member'}</span>
              )}
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <a
                href={`https://wa.me/+20${member.phone.startsWith('0') ? member.phone.substring(1) : member.phone}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-green-600 hover:text-green-700 text-sm font-medium font-mono"
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
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 shadow-sm ${
              isBanned
                ? 'bg-gradient-to-r from-gray-800 to-gray-900 text-white border border-gray-700'
                : member.isFrozen
                  ? 'bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/40 dark:to-cyan-900/40 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                  : isNotStartedYet
                    ? 'bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700'
                    : isExpiringSoon
                      ? 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 border border-orange-300'
                      : member.isActive && !isExpired
                        ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-300'
                        : 'bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border border-red-300'
            }`}>
              {isBanned
                ? <><span>🚫</span> {locale === 'ar' ? 'محظور' : 'Banned'}</>
                : member.isFrozen
                  ? <><span>❄️</span> {locale === 'ar' ? 'مجمد' : 'Frozen'}{member.freezeUntil ? <span className="text-[10px] font-normal ms-1">{locale === 'ar' ? 'لحد' : 'until'} {new Date(member.freezeUntil).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })}</span> : null}</>
                  : isNotStartedYet
                    ? <><span>🕐</span> {locale === 'ar' ? `يبدأ بعد ${daysUntilStart} يوم` : `Starts in ${daysUntilStart}d`}</>
                    : isExpiringSoon
                      ? <><span>🟡</span> {locale === 'ar' ? 'ينتهي قريباً' : 'Expiring Soon'}</>
                      : member.isActive && !isExpired
                        ? <><span>🟢</span> {t('members.active')}</>
                        : <><span>🔴</span> {t('members.expired')}</>
              }
            </span>
            <span className="text-primary-600 font-bold text-xs">
              {getPackageName(member.startDate, member.expiryDate, locale)}
            </span>
          </div>

          {/* Price + Dates row */}
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
            <div>
              <span className="font-bold text-gray-800 dark:text-gray-200">{member.subscriptionPrice}</span> {t('members.egp')}
            </div>
            <div className="flex items-center gap-1 font-mono">
              <span>{formatDateYMD(member.startDate)}</span>
              <span className="text-gray-400">→</span>
              <span className={isNotStartedYet ? 'text-purple-600 font-bold' : isExpired ? 'text-red-600 font-bold' : isExpiringSoon ? 'text-orange-600 font-bold' : ''}>
                {member.expiryDate ? formatDateYMD(member.expiryDate) : '-'}
              </span>
            </div>
          </div>

          {/* Days remaining */}
          {member.expiryDate && !isNotStartedYet && daysRemaining !== null && daysRemaining > 0 && (
            <p className={`text-xs text-center ${isExpiringSoon ? 'text-orange-600 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
              {isExpiringSoon && '⚠️ '}{t('members.daysRemaining', { days: daysRemaining.toString() })}
            </p>
          )}
          {member.expiryDate && !isNotStartedYet && isExpired && daysRemaining !== null && (
            <p className="text-xs text-center text-red-600 font-bold">
              ❌ {t('members.expiredSince', { days: Math.abs(daysRemaining).toString() })}
            </p>
          )}

          {/* Last Receipt - compact */}
          {lastReceipts[member.id] && (
            <div
              onClick={(e) => { e.stopPropagation(); onShowReceipts(member.id, member.memberNumber) }}
              className="flex items-center justify-between bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg px-3 py-2 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">🧾</span>
                <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                  #{lastReceipts[member.id].receiptNumber} - {lastReceipts[member.id].amount} {t('members.egp')}
                </span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {new Date(lastReceipts[member.id].createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
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
  onShowReceipts: (id: string, memberNumber: number) => void
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
      staleTime: 30 * 1000, // 30 seconds
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
    />
  )
}

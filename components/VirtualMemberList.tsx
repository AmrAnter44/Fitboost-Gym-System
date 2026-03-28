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

  return (
    <div style={{ ...style, paddingBottom: 12 }} {...ariaAttributes}>
      <div
        ref={ref}
        data-react-window-index={index}
        onMouseEnter={() => onPrefetch(member.id)}
        className={`rounded-xl shadow-md overflow-hidden border-2 hover:shadow-lg dark:hover:shadow-2xl transition ${
          isBanned
            ? 'bg-red-50 dark:bg-red-900/20 border-red-400 dark:border-red-600'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600'
        }`}
        dir={direction}
      >
        {/* Header with Image and Member Number */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 dark:from-primary-700 dark:to-primary-800 p-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-16 h-16 rounded-full overflow-hidden border-3 border-white shadow-lg bg-gray-100 dark:bg-gray-700 flex-shrink-0">
              {member.profileImage ? (
                <img src={member.profileImage} alt={member.name} loading="lazy" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xl font-bold text-white mb-1">
                {member.memberNumber !== null ? `#${member.memberNumber}` : <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm flex items-center gap-1 w-fit">🏷️ Non-Member</span>}
              </div>
              <div className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                member.isBanned
                  ? 'bg-gray-900 text-white'
                  : member.isFrozen
                    ? 'bg-primary-400 dark:bg-primary-500 text-white'
                    : isNotStartedYet
                      ? 'bg-purple-500 dark:bg-purple-600 text-white'
                      : member.isActive && !isExpired
                        ? 'bg-green-500 dark:bg-green-600 text-white'
                        : 'bg-red-500 dark:bg-red-600 text-white'
              }`}>
                {member.isBanned
                  ? `🚫 ${locale === 'ar' ? 'محظور' : 'Banned'}`
                  : member.isFrozen
                    ? `❄️ ${locale === 'ar' ? 'مجمد' : 'Frozen'}${member.freezeUntil ? ` ${locale === 'ar' ? 'لحد' : 'until'} ${new Date(member.freezeUntil).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' })}` : ''}`
                    : isNotStartedYet
                      ? `🕐 ${locale === 'ar' ? `يبدأ بعد ${daysUntilStart} يوم` : `Starts in ${daysUntilStart}d`}`
                      : member.isActive && !isExpired
                        ? `✓ ${t('members.active')}`
                        : `✕ ${t('members.expired')}`
                }
              </div>
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-3 space-y-2.5">
          {/* Name */}
          <div className="pb-2.5 border-b-2 border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">👤</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">{t('members.name')}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-gray-800 dark:text-gray-100">{member.name}</span>
              {isBanned && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-600">
                  🚫 {locale === 'ar' ? 'محظور' : 'Banned'}
                </span>
              )}
            </div>
          </div>

          {/* Phone */}
          <div className="pb-2.5 border-b-2 border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">📱</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">{t('members.phone')}</span>
            </div>
            <a
              href={`https://wa.me/+20${member.phone.startsWith('0') ? member.phone.substring(1) : member.phone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-base font-mono text-green-600 hover:text-green-700 hover:underline direction-ltr text-right block font-medium"
            >
              {member.phone}
            </a>
          </div>

          {/* Price and Package Info */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-green-50 dark:bg-green-900/30 border-2 border-green-200 dark:border-green-700 rounded-lg p-2.5">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-sm">💰</span>
                <span className="text-xs text-green-700 dark:text-green-300 font-semibold">{t('members.price')}</span>
              </div>
              <div className="text-base font-bold text-green-600 dark:text-green-400">{member.subscriptionPrice} {t('members.egp')}</div>
            </div>

            <div className="bg-primary-50 dark:bg-primary-900/30 border-2 border-primary-200 dark:border-primary-700 rounded-lg p-2.5">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-sm">📦</span>
                <span className="text-xs text-primary-700 dark:text-primary-300 font-semibold">{locale === 'ar' ? 'الباقة' : 'Package'}</span>
              </div>
              <div className="text-base font-bold text-primary-600 dark:text-primary-400">{getPackageName(member.startDate, member.expiryDate, locale)}</div>
            </div>
          </div>

          {/* Dates */}
          <div className="space-y-1.5 pt-1">
            <div className="bg-primary-50 dark:bg-primary-900/30 border-2 border-primary-200 dark:border-primary-700 rounded-lg p-2.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">📅</span>
                <span className="text-xs text-primary-700 dark:text-primary-300 font-semibold">{t('members.startDate')}</span>
              </div>
              <div className="text-sm font-mono text-gray-700 dark:text-gray-200">{formatDateYMD(member.startDate)}</div>
            </div>

            {member.expiryDate && (
              <div className={`border-2 rounded-lg p-2.5 ${
                isNotStartedYet ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700' : isExpired ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700' : isExpiringSoon ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700' : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{isNotStartedYet ? '🕐' : isExpired ? '❌' : isExpiringSoon ? '⚠️' : '📅'}</span>
                  <span className={`text-xs font-semibold ${
                    isNotStartedYet ? 'text-purple-700 dark:text-purple-400' : isExpired ? 'text-red-700 dark:text-red-400' : isExpiringSoon ? 'text-orange-700 dark:text-orange-400' : 'text-gray-700 dark:text-gray-200'
                  }`}>{t('members.expiryDate')}</span>
                </div>
                <div className={`text-sm font-mono font-bold ${
                  isNotStartedYet ? 'text-purple-600 dark:text-purple-400' : isExpired ? 'text-red-600 dark:text-red-400' : isExpiringSoon ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-gray-200'
                }`}>
                  {formatDateYMD(member.expiryDate)}
                </div>
                {!isNotStartedYet && daysRemaining !== null && daysRemaining > 0 && (
                  <div className={`text-xs mt-1 font-semibold ${isExpiringSoon ? 'text-orange-700 dark:text-orange-400' : 'text-gray-600 dark:text-gray-300'}`}>
                    {isExpiringSoon && '⚠️ '} {t('members.daysRemaining', { days: daysRemaining.toString() })}
                  </div>
                )}
                {!isNotStartedYet && isExpired && daysRemaining !== null && (
                  <div className="text-xs mt-1 font-semibold text-red-700 dark:text-red-400">
                    ❌ {t('members.expiredSince', { days: Math.abs(daysRemaining).toString() })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Last Receipt Box */}
          {lastReceipts[member.id] && (
            <div
              onClick={() => onShowReceipts(member.id, member.memberNumber)}
              className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-orange-200 dark:border-orange-700 rounded-lg p-2.5 cursor-pointer hover:shadow-md dark:hover:shadow-lg transition dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">🧾</span>
                <span className="text-xs text-orange-700 dark:text-orange-300 font-semibold">{locale === 'ar' ? 'آخر إيصال' : 'Last Receipt'}</span>
              </div>
              <div className="text-sm font-bold text-orange-600 dark:text-orange-400">
                #{lastReceipts[member.id].receiptNumber} - {lastReceipts[member.id].amount} {t('members.egp')}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                {new Date(lastReceipts[member.id].createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
                  year: 'numeric', month: 'short', day: 'numeric'
                })}
              </div>
              <div className="text-xs text-primary-600 dark:text-primary-400 mt-1 font-semibold">
                {locale === 'ar' ? '⬅️ اضغط لعرض السجل' : 'Click to view history ➡️'}
              </div>
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={() => onViewDetails(member.id)}
            className="w-full bg-primary-600 text-white py-2.5 rounded-lg text-sm hover:bg-primary-700 transition shadow-md hover:shadow-lg font-bold mt-1.5"
          >
            👁️ {t('members.viewDetails')}
          </button>
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
  const dynamicRowHeight = useDynamicRowHeight({ defaultRowHeight: 450 })
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

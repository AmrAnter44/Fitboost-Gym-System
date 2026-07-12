'use client'

import { usePathname } from 'next/navigation'
import { useTabs, MAIN_TAB_ID } from '../contexts/TabsContext'
import { useLanguage } from '../contexts/LanguageContext'
import { usePermissions } from '../hooks/usePermissions'
import { getTabLabel } from '../lib/tabRouteLabels'
import SystemStats from './SystemStats'

export default function TabBar() {
  const { tabs, activeTabId, isEmbedded, isReady, canAddTab, openTab, closeTab, activateTab } = useTabs()
  const { t } = useLanguage()
  const { user, loading } = usePermissions()
  const pathname = usePathname()

  if (isEmbedded || !isReady) return null
  if (!loading && !user) return null

  return (
    <div
      role="tablist"
      className="flex items-end gap-1 px-2 pt-1.5 h-10 flex-shrink-0 bg-gray-200 dark:bg-gray-950 border-b border-gray-300 dark:border-gray-800 select-none"
    >
      {tabs.map(tab => {
        const isActive = tab.id === activeTabId
        const label = getTabLabel(tab.id === MAIN_TAB_ID ? pathname : tab.currentPath, t)
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => activateTab(tab.id)}
            className={`group flex items-center gap-1.5 min-w-0 max-w-[180px] ps-3 pe-1.5 h-8 rounded-t-lg cursor-pointer text-xs font-medium transition-colors duration-150 ${
              isActive
                ? 'bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/70 dark:hover:bg-gray-800/70'
            }`}
          >
            <span className="truncate">{label}</span>
            {tab.id !== MAIN_TAB_ID ? (
              <button
                aria-label={t('tabs.closeTab')}
                title={t('tabs.closeTab')}
                onClick={e => {
                  e.stopPropagation()
                  closeTab(tab.id)
                }}
                className="p-0.5 rounded hover:bg-gray-300 dark:hover:bg-gray-700 flex-shrink-0"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : (
              <span className="w-1 flex-shrink-0" />
            )}
          </div>
        )
      })}

      <button
        aria-label={t('tabs.newTab')}
        title={canAddTab ? t('tabs.newTab') : t('tabs.maxTabs')}
        disabled={!canAddTab}
        onClick={() => openTab('/')}
        className="p-1.5 mb-1 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 flex-shrink-0"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* مراقب موارد الجهاز — في الطرف المقابل للتابات */}
      <SystemStats />
    </div>
  )
}

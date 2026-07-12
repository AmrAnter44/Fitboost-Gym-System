'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { safeStorage } from '../lib/safeStorage'

export const MAX_TABS = 3
export const MAIN_TAB_ID = 'main'
const STORAGE_KEY = 'gymTabs'

export interface Tab {
  id: string
  /** src ثابت للـ iframe — لا يتغير بعد الإنشاء حتى لا يُعاد تحميل التبويب */
  url: string
  /** آخر مسار مرصود داخل الـ iframe (يُستخدم للعنوان والحفظ) */
  currentPath: string
}

interface TabsContextType {
  tabs: Tab[]
  activeTabId: string
  isEmbedded: boolean
  isReady: boolean
  canAddTab: boolean
  /** id التاب القادم — الـ iframe الاحتياطي المحمّل مسبقًا بيستخدمه كـ key حتى يتبنّاه openTab بدون إعادة تحميل */
  nextTabId: string | null
  openTab: (path?: string) => void
  closeTab: (id: string) => void
  activateTab: (id: string) => void
  setTabPath: (id: string, path: string) => void
}

const TabsContext = createContext<TabsContextType | null>(null)

const MAIN_TAB: Tab = { id: MAIN_TAB_ID, url: '/', currentPath: '/' }

// مسار نسبي فقط (يرفض javascript: و //evil.com والمسارات المطلقة)
const SAFE_PATH_RE = /^\/(?!\/)/

function generateTabId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `tab-${Math.random().toString(36).slice(2)}`
}

function restoreTabs(): { tabs: Tab[]; activeTabId: string } {
  const fallback = { tabs: [MAIN_TAB], activeTabId: MAIN_TAB_ID }
  try {
    const raw = safeStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback

    const parsed = JSON.parse(raw)
    if (parsed?.v !== 1 || !Array.isArray(parsed.tabs)) return fallback

    const restored: Tab[] = parsed.tabs
      .filter((t: any) => t && typeof t.id === 'string' && typeof t.url === 'string' && SAFE_PATH_RE.test(t.url))
      .slice(0, MAX_TABS - 1)
      .map((t: any) => ({ id: t.id, url: t.url, currentPath: t.url }))

    const tabs = [MAIN_TAB, ...restored]
    const activeTabId = tabs.some(t => t.id === parsed.activeTabId) ? parsed.activeTabId : MAIN_TAB_ID
    return { tabs, activeTabId }
  } catch {
    return fallback
  }
}

export function TabsProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<Tab[]>([MAIN_TAB])
  const [activeTabId, setActiveTabId] = useState<string>(MAIN_TAB_ID)
  const [isEmbedded, setIsEmbedded] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [nextTabId, setNextTabId] = useState<string | null>(null)

  useEffect(() => {
    // داخل iframe: لا تابات متداخلة ولا كتابة على gymTabs (النافذة العلوية فقط)
    if (window.self !== window.top) {
      setIsEmbedded(true)
      setIsReady(true)
      return
    }
    const restored = restoreTabs()
    setTabs(restored.tabs)
    setActiveTabId(restored.activeTabId)
    setNextTabId(generateTabId())
    setIsReady(true)
  }, [])

  useEffect(() => {
    if (!isReady || isEmbedded) return
    const payload = {
      v: 1,
      tabs: tabs
        .filter(t => t.id !== MAIN_TAB_ID)
        .map(t => ({ id: t.id, url: t.currentPath })),
      activeTabId,
    }
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [tabs, activeTabId, isReady, isEmbedded])

  const canAddTab = tabs.length < MAX_TABS

  const openTab = (path: string = '/') => {
    if (isEmbedded || tabs.length >= MAX_TABS) return
    const safePath = SAFE_PATH_RE.test(path) ? path : '/'
    // التاب الاحتياطي محمّل مسبقًا على '/' — نتبنّاه لو المسار مطابق (نفس الـ key → بدون إعادة تحميل)
    const useSpare = safePath === '/' && nextTabId !== null
    const id = useSpare && nextTabId ? nextTabId : generateTabId()
    setTabs([...tabs, { id, url: safePath, currentPath: safePath }])
    setActiveTabId(id)
    if (useSpare) setNextTabId(generateTabId())
  }

  const closeTab = (id: string) => {
    if (id === MAIN_TAB_ID) return
    const index = tabs.findIndex(t => t.id === id)
    if (index === -1) return
    const next = tabs.filter(t => t.id !== id)
    setTabs(next)
    if (activeTabId === id) setActiveTabId(next[Math.max(0, index - 1)].id)
  }

  const activateTab = (id: string) => {
    if (tabs.some(t => t.id === id)) setActiveTabId(id)
  }

  const setTabPath = (id: string, path: string) => {
    if (!SAFE_PATH_RE.test(path)) return
    setTabs(prev => {
      const tab = prev.find(t => t.id === id)
      if (!tab || tab.currentPath === path) return prev
      return prev.map(t => (t.id === id ? { ...t, currentPath: path } : t))
    })
  }

  return (
    <TabsContext.Provider
      value={{ tabs, activeTabId, isEmbedded, isReady, canAddTab, nextTabId, openTab, closeTab, activateTab, setTabPath }}
    >
      {children}
    </TabsContext.Provider>
  )
}

export function useTabs(): TabsContextType {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('useTabs must be used within TabsProvider')
  }
  return context
}

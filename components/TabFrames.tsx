'use client'

import { useEffect, useRef, useState } from 'react'
import { useTabs, MAIN_TAB_ID, Tab } from '../contexts/TabsContext'
import { useLanguage } from '../contexts/LanguageContext'
import { usePermissions } from '../hooks/usePermissions'
import { getTabLabel } from '../lib/tabRouteLabels'

// مهلة قبل التحميل في الخلفية (تاب احتياطي + تابات مسترجعة مخفية)
// حتى لا تزاحم إقلاع التطبيق الرئيسي
const WARMUP_DELAY_MS = 2500

export default function TabFrames() {
  const { tabs, activeTabId, isEmbedded, isReady, canAddTab, nextTabId, setTabPath } = useTabs()
  const { t } = useLanguage()
  const { user } = usePermissions()

  const frameRefs = useRef<Map<string, HTMLIFrameElement>>(new Map())
  // refs محدثة كل render حتى يبقى interval المزامنة واحدًا طوال العمر
  const tabsRef = useRef<Tab[]>(tabs)
  tabsRef.current = tabs
  const setTabPathRef = useRef(setTabPath)
  setTabPathRef.current = setTabPath

  // التحميل في الخلفية يبدأ بعد استقرار التطبيق الرئيسي
  const [warmedUp, setWarmedUp] = useState(false)
  useEffect(() => {
    if (!user || isEmbedded) return
    const timer = setTimeout(() => setWarmedUp(true), WARMUP_DELAY_MS)
    return () => clearTimeout(timer)
  }, [user, isEmbedded])

  // الفريمات اللي خلصت تحميل (للـ spinner)، واللي اتفعّلت قبل كده (بمجرد التحميل لا يُلغى)
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set())
  const activatedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    activatedRef.current.add(activeTabId)
  }, [activeTabId])

  const syncTab = (tab: Tab) => {
    if (tab.id === MAIN_TAB_ID) return
    const frame = frameRefs.current.get(tab.id)
    try {
      const path = frame?.contentWindow?.location?.pathname
      if (path && path !== tab.currentPath) setTabPathRef.current(tab.id, path)
    } catch {
      // أثناء تبديل المستند قد يكون contentWindow غير قابل للقراءة مؤقتًا
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      tabsRef.current.forEach(syncTab)
    }, 750)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (activeTabId === MAIN_TAB_ID) return
    try {
      frameRefs.current.get(activeTabId)?.contentWindow?.focus()
    } catch {
      // تجاهل — الفريم قد لا يكون جاهزًا بعد
    }
  }, [activeTabId])

  if (isEmbedded || !isReady || !user) return null

  // قائمة الفريمات بترتيب إنشاء ثابت (append-only) — تحريك iframe في الـ DOM يعيد تحميله،
  // لذلك الاحتياطي دائمًا آخر عنصر، وعند تبنّيه يحتفظ بنفس الـ key ونفس الموضع
  const frames: Array<{ id: string; url: string; isSpare: boolean }> = tabs
    .filter(tab => tab.id !== MAIN_TAB_ID)
    .map(tab => ({ id: tab.id, url: tab.url, isSpare: false }))
  if (warmedUp && canAddTab && nextTabId) {
    frames.push({ id: nextTabId, url: '/', isSpare: true })
  }

  const activeIsLoadingFrame =
    activeTabId !== MAIN_TAB_ID && !loadedIds.has(activeTabId)

  return (
    <div className="absolute inset-0 z-[100] pointer-events-none">
      {frames.map(frame => {
        const isActive = !frame.isSpare && frame.id === activeTabId
        // التابات المخفية تتحمل في الخلفية بعد الـ warmup فقط؛ النشط يتحمل فورًا
        const shouldLoad =
          frame.isSpare || isActive || warmedUp || activatedRef.current.has(frame.id)
        return (
          <iframe
            key={frame.id}
            src={shouldLoad ? frame.url : undefined}
            title={frame.isSpare ? 'preload' : getTabLabel(
              tabsRef.current.find(tab => tab.id === frame.id)?.currentPath ?? frame.url, t)}
            aria-hidden={isActive ? undefined : true}
            tabIndex={isActive ? undefined : -1}
            onLoad={e => {
              // iframe بدون src يطلق load لـ about:blank — ليس تحميلًا حقيقيًا
              try {
                if (e.currentTarget.contentWindow?.location.href === 'about:blank') return
              } catch { /* عابر أثناء تبديل المستند */ }
              setLoadedIds(prev => (prev.has(frame.id) ? prev : new Set(prev).add(frame.id)))
              const current = tabsRef.current.find(item => item.id === frame.id)
              if (current) syncTab(current)
            }}
            ref={el => {
              if (el) frameRefs.current.set(frame.id, el)
              else frameRefs.current.delete(frame.id)
            }}
            className={`absolute inset-0 w-full h-full border-0 bg-gray-50 dark:bg-gray-900 ${
              isActive ? 'pointer-events-auto' : 'invisible'
            }`}
          />
        )
      })}

      {/* مؤشر تحميل فوق التاب النشط لحين اكتمال أول تحميل */}
      {activeIsLoadingFrame && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <svg
            className="w-8 h-8 animate-spin text-primary-600 dark:text-primary-400"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}
    </div>
  )
}

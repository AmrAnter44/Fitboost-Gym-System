'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

const SESSION_COLORS = [
  { bg: 'bg-blue-600', active: 'bg-blue-700', ring: 'ring-blue-400', dot: 'bg-blue-400' },
  { bg: 'bg-green-600', active: 'bg-green-700', ring: 'ring-green-400', dot: 'bg-green-400' },
  { bg: 'bg-purple-600', active: 'bg-purple-700', ring: 'ring-purple-400', dot: 'bg-purple-400' },
  { bg: 'bg-orange-600', active: 'bg-orange-700', ring: 'ring-orange-400', dot: 'bg-orange-400' },
  { bg: 'bg-pink-600', active: 'bg-pink-700', ring: 'ring-pink-400', dot: 'bg-pink-400' },
  { bg: 'bg-teal-600', active: 'bg-teal-700', ring: 'ring-teal-400', dot: 'bg-teal-400' },
]

const MAX_SESSIONS = 6

export default function WhatsAppWebPage() {
  const { t } = useLanguage()
  const isRTL = t('common.language') === 'ar'
  const [activeTab, setActiveTab] = useState(0)
  const [sessionCount, setSessionCount] = useState(6)
  const [labels, setLabels] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('wa-web-labels')
        if (saved) return JSON.parse(saved)
      } catch {}
    }
    return ['1', '2', '3', '4', '5', '6']
  })
  const [editingLabel, setEditingLabel] = useState<number | null>(null)
  const [editLabelValue, setEditLabelValue] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const webviewsCreated = useRef<Set<number>>(new Set())
  // Browser mode: track popup windows
  const popupRefs = useRef<(Window | null)[]>([])
  const [popupOpen, setPopupOpen] = useState<boolean[]>(Array(MAX_SESSIONS).fill(false))

  // Check if running in Electron
  const isElectron = typeof window !== 'undefined' && !!(window as any).electron?.isElectron

  // Load session count from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('wa-web-count')
      if (saved) setSessionCount(parseInt(saved))
    } catch {}
  }, [])

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('wa-web-labels', JSON.stringify(labels))
  }, [labels])

  useEffect(() => {
    localStorage.setItem('wa-web-count', String(sessionCount))
  }, [sessionCount])

  // Electron: Create/manage webviews
  useEffect(() => {
    if (!isElectron || !containerRef.current) return

    const container = containerRef.current

    for (let i = 0; i < sessionCount; i++) {
      if (!webviewsCreated.current.has(i)) {
        const webview = document.createElement('webview') as any
        webview.id = `wa-webview-${i}`
        webview.setAttribute('src', 'https://web.whatsapp.com')
        webview.setAttribute('partition', `persist:whatsapp-${i}`)
        webview.setAttribute('useragent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        webview.setAttribute('allowpopups', 'true')
        webview.style.cssText = 'width:100%;height:100%;border:none;position:absolute;inset:0;'
        webview.style.display = i === activeTab ? 'flex' : 'none'

        webview.addEventListener('dom-ready', () => {
          webview.insertCSS(`
            ::-webkit-scrollbar { width: 6px; }
            ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); border-radius: 3px; }
          `).catch(() => {})
        })

        container.appendChild(webview)
        webviewsCreated.current.add(i)
      }
    }
  }, [isElectron, sessionCount])

  // Electron: Toggle visibility based on active tab
  useEffect(() => {
    if (!isElectron || !containerRef.current) return
    for (let i = 0; i < MAX_SESSIONS; i++) {
      const wv = document.getElementById(`wa-webview-${i}`)
      if (wv) {
        wv.style.display = (i === activeTab && i < sessionCount) ? 'flex' : 'none'
      }
    }
  }, [isElectron, activeTab, sessionCount])

  // Browser: Check popup status periodically
  useEffect(() => {
    if (isElectron) return
    const interval = setInterval(() => {
      const newStatus = popupRefs.current.map(w => !!(w && !w.closed))
      setPopupOpen(prev => {
        const changed = prev.some((v, i) => v !== newStatus[i])
        return changed ? newStatus : prev
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [isElectron])

  const handleLabelSave = useCallback((idx: number) => {
    const newLabels = [...labels]
    newLabels[idx] = editLabelValue.trim() || `${idx + 1}`
    setLabels(newLabels)
    setEditingLabel(null)
  }, [labels, editLabelValue])

  const handleReload = useCallback((idx: number) => {
    if (isElectron) {
      const wv = document.getElementById(`wa-webview-${idx}`) as any
      if (wv?.reload) wv.reload()
    } else {
      const popup = popupRefs.current[idx]
      if (popup && !popup.closed) {
        popup.location.href = 'https://web.whatsapp.com'
      }
    }
  }, [isElectron])

  const handleTabClick = useCallback((idx: number) => {
    setActiveTab(idx)
    // Browser mode: open in new tab (works on mobile + desktop)
    if (!isElectron) {
      const existing = popupRefs.current[idx]
      if (existing && !existing.closed) {
        existing.focus()
      } else {
        // Use _blank for mobile compatibility, named window for desktop
        const popup = window.open(
          'https://web.whatsapp.com',
          `whatsapp-web-${idx}`
        )
        popupRefs.current[idx] = popup
        setPopupOpen(prev => {
          const next = [...prev]
          next[idx] = true
          return next
        })
      }
    }
  }, [isElectron])

  // Tab bar (shared between both modes)
  const tabBar = (
    <div className="flex items-center gap-1 px-2 sm:px-3 py-2 bg-[#202c33] shadow-md z-10 flex-shrink-0">
      {/* WhatsApp logo */}
      <div className="flex items-center px-1 sm:px-2 py-1 flex-shrink-0">
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-green-400 fill-current">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </div>

      {/* Session tabs - scrollable on mobile */}
      <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-hide">
        {Array.from({ length: sessionCount }).map((_, idx) => (
          <button
            key={idx}
            onClick={() => handleTabClick(idx)}
            onDoubleClick={() => {
              setEditingLabel(idx)
              setEditLabelValue(labels[idx] || `${idx + 1}`)
            }}
            className={`
              relative flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex-shrink-0
              ${activeTab === idx
                ? `${SESSION_COLORS[idx].active} text-white ring-2 ${SESSION_COLORS[idx].ring} shadow-lg`
                : `${SESSION_COLORS[idx].bg} text-white/80 hover:text-white hover:shadow-md`
              }
            `}
          >
            {editingLabel === idx ? (
              <input
                type="text"
                value={editLabelValue}
                onChange={(e) => setEditLabelValue(e.target.value)}
                onBlur={() => handleLabelSave(idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleLabelSave(idx)
                  if (e.key === 'Escape') setEditingLabel(null)
                }}
                className="bg-white/20 text-white text-xs sm:text-sm rounded px-1.5 py-0.5 w-16 sm:w-24 outline-none placeholder-white/50"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <span className={`w-2 h-2 rounded-full ${
                  !isElectron && popupOpen[idx] ? 'bg-green-400 animate-pulse' : SESSION_COLORS[idx].dot
                }`} />
                {labels[idx] || `${idx + 1}`}
              </>
            )}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        <select
          value={sessionCount}
          onChange={(e) => {
            const count = parseInt(e.target.value)
            setSessionCount(count)
            if (activeTab >= count) setActiveTab(count - 1)
          }}
          className="bg-white/10 text-white text-[10px] sm:text-xs rounded-lg px-1.5 sm:px-2 py-1.5 border border-white/20 outline-none cursor-pointer"
        >
          {[2, 3, 4, 5, 6].map(n => (
            <option key={n} value={n} className="text-gray-900">{n}</option>
          ))}
        </select>

        <button
          onClick={() => handleReload(activeTab)}
          className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition"
          title={isRTL ? 'إعادة تحميل' : 'Reload'}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>
  )

  // Electron mode: webviews embedded
  if (isElectron) {
    return (
      <div className="flex flex-col h-screen" dir={isRTL ? 'rtl' : 'ltr'}>
        {tabBar}
        <div ref={containerRef} className="flex-1 relative bg-[#111b21]" />
      </div>
    )
  }

  // Browser mode: popups + instruction panel
  return (
    <div className="flex flex-col h-screen" dir={isRTL ? 'rtl' : 'ltr'}>
      {tabBar}
      <div className="flex-1 bg-[#111b21] flex items-center justify-center overflow-y-auto">
        <div className="text-center p-4 sm:p-8 max-w-lg w-full">
          <svg viewBox="0 0 24 24" className="w-12 sm:w-16 h-12 sm:h-16 text-green-500 fill-current mx-auto mb-4 sm:mb-6">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">
            {isRTL ? 'اضغط على أي رقم لفتح واتساب ويب' : 'Tap any number to open WhatsApp Web'}
          </h2>
          <p className="text-gray-400 text-xs sm:text-sm mb-4 sm:mb-6">
            {isRTL
              ? 'كل رقم هيفتح واتساب ويب في تاب جديد. امسح QR Code من الموبايل.'
              : 'Each number opens WhatsApp Web in a new tab. Scan QR from your phone.'}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            {Array.from({ length: sessionCount }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => handleTabClick(idx)}
                className={`flex items-center justify-center gap-2 px-3 sm:px-5 py-3 sm:py-4 rounded-xl text-white font-semibold transition-all active:scale-95 ${SESSION_COLORS[idx].bg} hover:shadow-lg`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${popupOpen[idx] ? 'bg-green-400 animate-pulse' : 'bg-white/40'}`} />
                <span className="text-sm sm:text-base">{labels[idx] || `${idx + 1}`}</span>
                {popupOpen[idx] && (
                  <span className="text-[10px] sm:text-xs bg-white/20 px-1.5 py-0.5 rounded">
                    {isRTL ? 'مفتوح' : 'open'}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

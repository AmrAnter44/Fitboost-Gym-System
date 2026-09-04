'use client'

import { useState, useEffect } from 'react'
import { usePermissions } from '../hooks/usePermissions'
import { useLanguage } from '../contexts/LanguageContext'
import { useServiceSettings } from '../contexts/ServiceSettingsContext'
import MoreScanPanel from './MoreScanPanel'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

//  زرار سكان مزيد عائم — فوق زرار السرش — بيفتح مودال زي السرش
export default function FloatingScanButton() {
  const { user, loading, hasPermission } = usePermissions()
  const { locale } = useLanguage()
  const { settings } = useServiceSettings()
  const ar = locale === 'ar'
  const [open, setOpen] = useState(false)

  //  قفل سكرول الصفحة ورا المودال
  useEffect(() => {
    if (open) { document.body.style.overflow = 'hidden' }
    return () => { document.body.style.overflow = 'unset' }
  }, [open])

  //  Esc يقفل
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (loading || !user) return null
  if (settings.moreEnabled === false) return null
  if (!hasPermission('canRegisterMoreAttendance')) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={ar ? 'سكان مزيد' : 'More Scan'}
        title={ar ? 'سكان مزيد — بيخصم مرة واحدة' : 'More Scan — deducts once'}
        className="fixed bottom-24 end-6 z-50 hidden sm:flex w-14 h-14 bg-gradient-to-br from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white rounded-full shadow-lg ring-1 ring-teal-700/20 transition-[transform,box-shadow] duration-200 hover:scale-110 active:scale-95 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 group"
      >
        <svg className="w-6 h-6 group-hover:scale-110 transition-transform" {...stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875v14.25M6.75 4.875v14.25M10.5 4.875v14.25M14.25 4.875v14.25M17.25 4.875v14.25M20.25 4.875v14.25" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-16 overflow-y-auto"
          onClick={() => setOpen(false)}
        >
          <div dir={ar ? 'rtl' : 'ltr'} className="w-full max-w-lg animate-modal-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3 text-white">
              <h2 className="text-xl font-black flex items-center gap-2">
                <svg className="w-6 h-6" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875v14.25M6.75 4.875v14.25M10.5 4.875v14.25M14.25 4.875v14.25M17.25 4.875v14.25M20.25 4.875v14.25" /></svg>
                {ar ? 'سكان مزيد' : 'More Scan'}
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label={ar ? 'إغلاق' : 'Close'}
                className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <MoreScanPanel autoFocus />
          </div>
        </div>
      )}
    </>
  )
}

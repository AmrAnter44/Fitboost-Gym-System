'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

interface SignaturePadProps {
  onConfirm: (signatureDataUrl: string) => void
  onCancel: () => void
  title?: string
  subtitle?: string
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

export default function SignaturePad({ onConfirm, onCancel, title, subtitle }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  const getCanvasPoint = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    if ('touches' in e) {
      const touch = e.touches[0]
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      }
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      }
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = 600
    canvas.height = 250

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.setLineDash([5, 5])
    ctx.strokeStyle = '#d1d5db'
    ctx.beginPath()
    ctx.moveTo(30, 200)
    ctx.lineTo(570, 200)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.strokeStyle = '#1a1a1a'
  }, [])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', onKey)
    }
  }, [onCancel])

  const startDrawing = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    const point = getCanvasPoint(e)
    if (!point) return

    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return

    ctx.beginPath()
    ctx.moveTo(point.x, point.y)
    setIsDrawing(true)
    setHasDrawn(true)
  }, [getCanvasPoint])

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    if (!isDrawing) return
    const point = getCanvasPoint(e)
    if (!point) return

    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return

    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2.5
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
  }, [isDrawing, getCanvasPoint])

  const stopDrawing = useCallback(() => {
    setIsDrawing(false)
  }, [])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.setLineDash([5, 5])
    ctx.strokeStyle = '#d1d5db'
    ctx.beginPath()
    ctx.moveTo(30, 200)
    ctx.lineTo(570, 200)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.strokeStyle = '#1a1a1a'

    setHasDrawn(false)
  }, [])

  const handleConfirm = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !hasDrawn) return
    const dataUrl = canvas.toDataURL('image/png')
    onConfirm(dataUrl)
  }, [hasDrawn, onConfirm])

  return (
    <div
      className="fixed inset-0 z-[10000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-backdrop-in"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="signature-pad-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full ring-1 ring-gray-200 dark:ring-gray-700 animate-modal-in overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-primary-600 dark:bg-primary-700 text-primary-contrast p-5">
          <h2 id="signature-pad-title" className="text-xl font-bold flex items-center gap-2">
            <svg className="w-6 h-6" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
            <span>{title || 'إمضاء العميل'}</span>
          </h2>
          {subtitle && <p className="text-sm opacity-90 mt-1">{subtitle}</p>}
        </div>

        <div className="p-5 space-y-4">
          <div className="ring-1 ring-gray-300 dark:ring-gray-600 rounded-xl overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              className="w-full touch-none cursor-crosshair"
              style={{ height: '200px' }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>

          <p className="text-xs text-gray-600 dark:text-gray-400 text-center flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" {...stroke}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
            <span>امضي بصباعك أو الماوس في المربع اللي فوق</span>
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!hasDrawn}
              autoFocus
              className="flex-1 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
            >
              <svg className="w-5 h-5" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>تأكيد</span>
            </button>
            <button
              type="button"
              onClick={clearCanvas}
              aria-label="مسح"
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold transition-colors duration-200 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
            >
              <svg className="w-5 h-5" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m-4.992 4.992l3.181-3.183a8.25 8.25 0 00-13.803 3.7M4.031 9.865v-4.992m0 0H8.99M3 12a9 9 0 0015.357 6.364l-1.06-1.06" />
              </svg>
              <span>مسح</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              aria-label="إلغاء"
              className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
            >
              <svg className="w-5 h-5" {...stroke}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

interface SignaturePadProps {
  onConfirm: (signatureDataUrl: string) => void
  onCancel: () => void
  title?: string
  subtitle?: string
}

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

    // Set canvas size
    canvas.width = 600
    canvas.height = 250

    // Style
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Draw guideline
    ctx.setLineDash([5, 5])
    ctx.strokeStyle = '#d1d5db'
    ctx.beginPath()
    ctx.moveTo(30, 200)
    ctx.lineTo(570, 200)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.strokeStyle = '#1a1a1a'
  }, [])

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

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Redraw guideline
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-5 rounded-t-2xl">
          <h2 className="text-xl font-bold flex items-center gap-2">
            ✍️ {title || 'إمضاء العميل'}
          </h2>
          {subtitle && <p className="text-sm opacity-90 mt-1">{subtitle}</p>}
        </div>

        <div className="p-5 space-y-4">
          {/* Canvas */}
          <div className="border-2 border-gray-300 dark:border-gray-600 rounded-xl overflow-hidden bg-white">
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

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            ✍️ امضي بصباعك أو الماوس في المربع اللي فوق
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={!hasDrawn}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-bold text-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              ✅ تأكيد
            </button>
            <button
              onClick={clearCanvas}
              className="px-4 py-3 bg-yellow-500 text-white rounded-lg font-bold hover:bg-yellow-600 transition-all"
            >
              🔄 مسح
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-3 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-500 transition-all"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect } from 'react'

export function PreventInputScroll() {
  useEffect(() => {
    const preventNumberInputScroll = (e: WheelEvent) => {
      const target = e.target as HTMLElement
      
      if (
        target.tagName === 'INPUT' &&
        (target as HTMLInputElement).type === 'number' &&
        document.activeElement === target
      ) {
        e.preventDefault()
      }
    }

    document.addEventListener('wheel', preventNumberInputScroll, { passive: false })
    return () => document.removeEventListener('wheel', preventNumberInputScroll)
  }, [])

  return null
}
'use client'

import { useState, useCallback } from 'react'

interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
}

export function useConfirm() {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions>({
    title: '',
    message: '',
    confirmText: 'تأكيد',
    cancelText: 'إلغاء',
    type: 'warning'
  })
  const [resolveCallback, setResolveCallback] = useState<((value: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setOptions({
        confirmText: 'تأكيد',
        cancelText: 'إلغاء',
        type: 'warning',
        ...opts
      })
      setIsOpen(true)
      setResolveCallback(() => resolve)
    })
  }, [])

  const handleConfirm = useCallback(() => {
    if (resolveCallback) {
      resolveCallback(true)
    }
    setIsOpen(false)
  }, [resolveCallback])

  const handleCancel = useCallback(() => {
    if (resolveCallback) {
      resolveCallback(false)
    }
    setIsOpen(false)
  }, [resolveCallback])

  return {
    confirm,
    isOpen,
    options,
    handleConfirm,
    handleCancel
  }
}

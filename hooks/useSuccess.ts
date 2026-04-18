'use client'

import { useState, useCallback } from 'react'

interface SuccessOptions {
  title: string
  message: string
  buttonText?: string
  type?: 'success' | 'error' | 'info'
}

export function useSuccess() {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<SuccessOptions>({
    title: '',
    message: '',
    buttonText: 'حسناً',
    type: 'success'
  })

  const show = useCallback((opts: SuccessOptions): Promise<void> => {
    return new Promise((resolve) => {
      setOptions({
        buttonText: 'حسناً',
        type: 'success',
        ...opts
      })
      setIsOpen(true)
      setTimeout(() => {
        resolve()
      }, 100)
    })
  }, [])

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  return {
    show,
    isOpen,
    options,
    handleClose
  }
}

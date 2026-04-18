'use client'

import { useToast } from '../contexts/ToastContext'
import Toast from './Toast'

export default function ToastContainer() {
  const { toasts, removeToast } = useToast()

  return (
    <>
      {toasts.map((toast, index) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
          duration={toast.duration}
          index={index}
        />
      ))}
    </>
  )
}

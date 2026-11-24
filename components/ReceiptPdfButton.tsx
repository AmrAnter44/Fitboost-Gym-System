'use client'

import { useState } from 'react'
import { printReceiptFromData } from '../lib/printSystem'
import { useToast } from '../contexts/ToastContext'
import { useLanguage } from '../contexts/LanguageContext'

interface ReceiptPdfButtonProps {
  receiptNumber: number
  type: string
  amount: number
  details: any
  date: Date | string
  paymentMethod?: string
  memberId?: string | null
  className: string
}

export default function ReceiptPdfButton({ receiptNumber, type, amount, details, date, paymentMethod, memberId, className }: ReceiptPdfButtonProps) {
  const toast = useToast()
  const { locale } = useLanguage()
  const ar = locale === 'ar'
  const [busy, setBusy] = useState(false)

  const handleDownload = async () => {
    if (busy) return
    setBusy(true)
    try {
      const pdfDetails = { ...(typeof details === 'string' ? JSON.parse(details) : details) }
      //  نفس بيانات العضو الحالية اللي بتظهر وقت الطباعة
      if (memberId) {
        try {
          const res = await fetch(`/api/members/${memberId}`)
          if (res.ok) {
            const member = await res.json()
            if (member?.nationalId) pdfDetails.nationalId = member.nationalId
            if (member?.birthDate) pdfDetails.birthDate = member.birthDate
            if (member?.notes) pdfDetails.notes = member.notes
          }
        } catch { /* نكمّل بالبيانات المخزّنة */ }
      }
      const result = await printReceiptFromData(receiptNumber, type, amount, pdfDetails, date, paymentMethod, { savePdf: true })
      const filePath = result && typeof result === 'object' ? result.filePath : undefined
      toast.success(filePath
        ? (ar ? `اتحفظ الإيصال في: ${filePath}` : `Receipt saved to: ${filePath}`)
        : (ar ? 'تم تحميل الإيصال PDF' : 'Receipt PDF downloaded'))
    } catch (error) {
      console.error('Error downloading receipt PDF:', error)
      toast.error(ar ? 'فشل تحميل الإيصال PDF' : 'Failed to download receipt PDF')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button type="button" data-receipt-pdf onClick={handleDownload} disabled={busy} className={`${className} disabled:opacity-60 disabled:cursor-wait`}>
      {busy ? (ar ? 'جاري التحميل...' : 'Downloading...') : (ar ? 'تحميل PDF' : 'Download PDF')}
    </button>
  )
}

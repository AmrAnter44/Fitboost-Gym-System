'use client'

//  خانة الرقم القومي: 14 رقم بس، ولو زرار «جواز سفر» مفتوح بتقبل أي طول (حروف وأرقام) للأجانب
import { useEffect, useState } from 'react'

export const NATIONAL_ID_RE = /^\d{14}$/
export const PASSPORT_RE = /^[A-Za-z0-9]{3,30}$/

const toLatinDigits = (v: string) => v.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
const looksLikePassport = (v: string) => !!v && !/^\d{0,14}$/.test(v)

interface NationalIdInputProps {
  value: string
  onChange: (value: string) => void
  onPassportChange?: (passport: boolean) => void
  label: React.ReactNode
  ar: boolean
  labelClassName: string
  inputClassName: string
  nationalPlaceholder?: string
}

export default function NationalIdInput({ value, onChange, onPassportChange, label, ar, labelClassName, inputClassName, nationalPlaceholder }: NationalIdInputProps) {
  const [passport, setPassport] = useState(() => looksLikePassport(value))

  //  لو القيمة اتحملت بعدين وهي رقم جواز، نفتح وضع الجواز لوحده
  useEffect(() => {
    if (!passport && looksLikePassport(value)) setPassport(true)
  }, [value, passport])

  useEffect(() => { onPassportChange?.(passport) }, [passport, onPassportChange])

  const toggle = () => {
    const next = !passport
    setPassport(next)
    if (!next) onChange(toLatinDigits(value).replace(/\D/g, '').slice(0, 14))
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label className={labelClassName}>{passport ? (ar ? 'رقم جواز السفر' : 'Passport number') : label}</label>
        <button
          type="button"
          data-passport-toggle
          aria-pressed={passport}
          onClick={toggle}
          className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold ring-1 transition-colors duration-200 ${
            passport
              ? 'bg-primary-500 text-primary-contrast ring-primary-500'
              : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
          }`}
        >
          {ar ? 'جواز سفر' : 'Passport'}
        </button>
      </div>
      <input
        type="text"
        inputMode={passport ? 'text' : 'numeric'}
        value={value}
        onChange={(e) => {
          const raw = toLatinDigits(e.target.value)
          onChange(passport ? raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 30) : raw.replace(/\D/g, '').slice(0, 14))
        }}
        maxLength={passport ? 30 : 14}
        className={inputClassName}
        placeholder={passport ? (ar ? 'أي عدد حروف وأرقام' : 'Letters and digits') : nationalPlaceholder}
        dir="ltr"
      />
    </div>
  )
}

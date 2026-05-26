'use client'

import { useLanguage } from '../contexts/LanguageContext'

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface SpinnerProps {
  size?: SpinnerSize
  className?: string
  label?: string
}

const sizeMap: Record<SpinnerSize, string> = {
  xs: 'w-3 h-3 border-[1.5px]',
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-[3px]',
  xl: 'w-12 h-12 border-4',
}

/**
 * Atomic spinner — brand-primary ring with transparent top arc.
 * Use for inline loading inside buttons, cards, anywhere small.
 */
export function Spinner({ size = 'md', className = '', label }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      className={`inline-flex items-center justify-center ${className}`}
    >
      <span
        className={`${sizeMap[size]} rounded-full border-current border-t-transparent animate-spin`}
        aria-hidden="true"
      />
      {label && <span className="sr-only">{label}</span>}
    </span>
  )
}

interface LoadingScreenProps {
  message?: string
  fullScreen?: boolean
  variant?: 'spinner' | 'dots'
}

/**
 * Full-page centered loading screen used while a route/page is fetching.
 * Renders a brand-colored ring spinner with optional caption beneath.
 */
export function LoadingScreen({ message, fullScreen = false, variant = 'spinner' }: LoadingScreenProps) {
  const { t, locale } = useLanguage()
  const fallback = locale === 'ar' ? 'جارٍ التحميل…' : 'Loading…'
  const caption = message || t('common.loading') || fallback

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`flex flex-col items-center justify-center gap-4 ${
        fullScreen ? 'fixed inset-0 z-[9999] bg-white/85 dark:bg-gray-900/85 backdrop-blur-sm' : 'min-h-[40vh] py-12'
      }`}
    >
      {variant === 'spinner' ? (
        <div className="relative">
          <div className="w-14 h-14 rounded-full border-4 border-gray-200 dark:border-gray-700" aria-hidden="true" />
          <div className="absolute inset-0 w-14 h-14 rounded-full border-4 border-transparent border-t-primary-500 border-r-primary-500 animate-spin" aria-hidden="true" />
        </div>
      ) : (
        <div className="flex items-end gap-1.5 h-8" aria-hidden="true">
          <span className="w-2.5 h-2.5 rounded-full bg-primary-500 animate-loader-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2.5 h-2.5 rounded-full bg-primary-500 animate-loader-bounce" style={{ animationDelay: '120ms' }} />
          <span className="w-2.5 h-2.5 rounded-full bg-primary-500 animate-loader-bounce" style={{ animationDelay: '240ms' }} />
        </div>
      )}
      {caption && (
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{caption}</p>
      )}
    </div>
  )
}

interface InlineLoaderProps {
  text?: string
  size?: SpinnerSize
  className?: string
}

/**
 * Small spinner + text for inline use (e.g. inside a button while submitting).
 */
export function InlineLoader({ text, size = 'sm', className = '' }: InlineLoaderProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Spinner size={size} />
      {text && <span>{text}</span>}
    </span>
  )
}

/**
 * Default export = `LoadingScreen` (most common use).
 */
export default LoadingScreen

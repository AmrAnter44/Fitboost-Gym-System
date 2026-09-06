'use client'

import { usePermissions } from '../../../hooks/usePermissions'
import { useLanguage } from '../../../contexts/LanguageContext'
import PermissionDenied from '../../../components/PermissionDenied'
import { LoadingScreen } from '../../../components/Spinner'
import MoreScanPanel from '../../../components/MoreScanPanel'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

export default function MoreScanPage() {
  const { hasPermission, loading } = usePermissions()
  const { locale } = useLanguage()
  const ar = locale === 'ar'

  if (loading) return <LoadingScreen fullScreen message={ar ? 'جاري التحميل...' : 'Loading...'} />
  if (!hasPermission('canRegisterMoreAttendance')) return <PermissionDenied message={ar ? 'ليس لديك صلاحية تسجيل حضور المزيد' : 'No permission'} />

  return (
    <div className="container mx-auto px-4 py-6 md:px-6 max-w-lg" dir={ar ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <svg className="w-7 h-7 text-primary-500" {...stroke}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875v14.25M6.75 4.875v14.25M10.5 4.875v14.25M14.25 4.875v14.25M17.25 4.875v14.25M20.25 4.875v14.25" /></svg>
          <span>{ar ? 'سكان مزيد' : 'More Scan'}</span>
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{ar ? 'امسح الباركود أو اكتب رقم التليفون' : 'Scan the barcode or type the phone'}</p>
      </div>
      <MoreScanPanel />
    </div>
  )
}

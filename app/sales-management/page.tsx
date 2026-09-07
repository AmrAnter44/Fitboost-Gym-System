'use client'

//  صفحة إدارة السيلز (بالرابط المباشر) — بتستخدم نفس لوحة التوزيع المشتركة اللي في تاب
//  «إدارة السيلز» جوّه المتابعات. اتشالت من السايد بار، بس الرابط لسه شغّال.
import { usePermissions } from '../../hooks/usePermissions'
import { useLanguage } from '../../contexts/LanguageContext'
import PermissionDenied from '../../components/PermissionDenied'
import { LoadingScreen } from '../../components/Spinner'
import SalesDistributionPanel from '../../components/SalesDistributionPanel'

export default function SalesManagementPage() {
  const { user, loading: permLoading, isAdmin, permissions } = usePermissions()
  const { locale } = useLanguage()
  const ar = locale === 'ar'

  const canAccess = isAdmin || user?.role === 'MANAGER' || permissions?.canManageSales === true || permissions?.canEditMembers === true

  if (permLoading) return <LoadingScreen fullScreen message={ar ? 'جاري التحميل...' : 'Loading...'} />
  if (!canAccess) {
    return <PermissionDenied message={ar ? 'ليس لديك صلاحية الوصول لإدارة السيلز' : 'You do not have access to Sales Management'} />
  }

  return (
    <div className="container mx-auto px-4 py-6 md:px-6" dir={ar ? 'rtl' : 'ltr'}>
      <SalesDistributionPanel showHeader />
    </div>
  )
}

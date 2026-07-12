// Map first route segment → translation key (used for tab titles in the tab bar)
// Mirrors SEGMENT_KEYS in components/Breadcrumb.tsx with additional top-level routes
export const TAB_SEGMENT_KEYS: Record<string, string> = {
  '':                  'nav.home',
  'members':           'nav.members',
  'pt':                'nav.pt',
  'coach':             'nav.coach',
  'nutrition':         'nav.nutrition',
  'physiotherapy':     'nav.physiotherapy',
  'group-classes':     'nav.groupClasses',
  'dayuse':            'nav.dayUse',
  'invitations':       'nav.invitations',
  'staff':             'nav.staff',
  'receipts':          'nav.receipts',
  'expenses':          'nav.expenses',
  'visitors':          'nav.visitors',
  'followups':         'nav.followups',
  'spa-bookings':      'nav.spaBookings',
  'closing':           'nav.closing',
  'reports':           'nav.reports',
  'more':              'nav.more',
  'offers':            'nav.offers',
  'search':            'nav.search',
  'whatsapp-web':      'nav.whatsappInbox',
  'attendance-report': 'nav.staffAttendance',
  'member-attendance': 'nav.memberAttendance',
  'settings':          'nav.settings',
  'admin':             'auth.manageUsers',
  'login':             'auth.login',
}

export function getTabLabel(pathname: string, t: (key: string) => string): string {
  const seg = pathname.split('/').filter(Boolean)[0] ?? ''
  const key = TAB_SEGMENT_KEYS[seg]
  return key ? t(key) : (seg || t('nav.home'))
}

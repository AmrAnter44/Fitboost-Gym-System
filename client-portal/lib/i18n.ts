export type Language = 'ar' | 'en';

export const translations = {
  ar: {
    // Navigation
    dashboard: 'لوحة التحكم',
    logout: 'تسجيل الخروج',

    // Dashboard
    membershipStatus: 'حالة الاشتراك',
    active: 'نشط',
    expired: 'منتهي',
    expiringSoon: 'ينتهي قريباً',
    frozen: 'الاشتراك مجمد حالياً',
    startDate: 'تاريخ البداية',
    endDate: 'تاريخ الانتهاء',
    daysRemaining: 'يوم متبقي',
    egp: 'جنيه',
    perMonth: '/ شهر',

    // Services
    availableServices: 'الخدمات المتاحة',
    ptSessions: 'جلسات PT',
    invitations: 'دعوات',
    inBody: 'InBody',
    freezeDays: 'أيام تجميد',
    clickToFreeze: 'اضغط للتجميد',

    // Quick Links
    attendance: 'الحضور',
    receipts: 'الإيصالات',
    spa: 'السبا',

    // Info
    tip: 'نصيحة',
    contactManagement: 'لتجديد أو ترقية الاشتراك، يرجى التواصل مع الإدارة',

    // Attendance Page
    attendanceHistory: 'سجل الحضور',
    attendanceSubtitle: 'تاريخ حضورك للجيم',
    thisWeek: 'هذا الأسبوع',
    thisMonth: 'هذا الشهر',
    total: 'الإجمالي',
    latestAttendance: 'آخر الحضور',
    noAttendance: 'لا توجد سجلات حضور حتى الآن',
    loadMore: 'تحميل المزيد',
    keepGoingStrong: 'رائع!',
    attendanceHelps: 'الانتظام في الحضور يساعدك على تحقيق أهدافك',

    // Receipts Page
    receiptsTitle: 'الإيصالات',
    receiptsSubtitle: 'سجل المدفوعات',
    receiptCount: 'عدد الإيصالات',
    totalPaid: 'إجمالي المدفوعات',
    allReceipts: 'كل الإيصالات',
    noReceipts: 'لا توجد إيصالات حتى الآن',
    receipt: 'إيصال',
    requestCopy: 'يمكنك طلب نسخة مطبوعة من أي إيصال من الإدارة',

    // Spa Page
    spaBookings: 'حجوزات السبا',
    spaSubtitle: 'جلسات الاسترخاء',
    upcoming: 'القادمة',
    all: 'الكل',
    confirmed: 'مؤكد',
    pending: 'قيد الانتظار',
    bookings: 'الحجوزات',
    noBookings: 'لا توجد حجوزات',
    contactForBooking: 'تواصل مع الإدارة لحجز جلسة سبا',
    toBook: 'للحجز',

    // Freeze Page
    freezeSubscription: 'تجميد الاشتراك',
    freezeSubtitle: 'طلب تجميد مؤقت',
    currentStatus: 'الحالة الحالية',
    availableFreezeDays: 'يوم متاح للتجميد',
    currentlyFrozen: 'مجمد حالياً',
    subscriptionPaused: 'الاشتراك متوقف',
    subscriptionActive: 'الاشتراك ساري',
    requestNewFreeze: 'طلب تجميد جديد',
    frozenInfo: 'اشتراكك مجمد حالياً',
    frozenDetails: 'تم تمديد تاريخ انتهاء الاشتراك. للإلغاء، تواصل مع الإدارة',
    noFreezeDaysLeft: 'لا توجد أيام تجميد متبقية',
    newFreezeRequest: 'طلب تجميد جديد',
    startDateLabel: 'تاريخ البداية',
    daysLabel: 'عدد الأيام',
    reasonLabel: 'السبب (اختياري)',
    reasonPlaceholder: 'اكتب سبب التجميد (اختياري)',
    submitRequest: 'إرسال الطلب',
    submitting: 'جاري الإرسال...',
    freezeHistory: 'سجل التجميد',
    noFreezeHistory: 'لا يوجد سجل تجميد',
    reason: 'السبب',
    requestDate: 'تاريخ الطلب',
    applied: 'مُطبق',
    rejected: 'مرفوض',

    // Common
    loading: 'جاري التحميل...',
    back: 'رجوع',
    days: 'يوم',
    minutes: 'دقيقة',

    // Login
    memberNumber: 'رقم العضوية',
    phoneNumber: 'رقم الهاتف',
    login: 'تسجيل الدخول',
    welcome: 'مرحباً',
  },
  en: {
    // Navigation
    dashboard: 'Dashboard',
    logout: 'Logout',

    // Dashboard
    membershipStatus: 'Membership Status',
    active: 'Active',
    expired: 'Expired',
    expiringSoon: 'Expiring Soon',
    frozen: 'Subscription is currently frozen',
    startDate: 'Start Date',
    endDate: 'End Date',
    daysRemaining: 'Days Remaining',
    egp: 'EGP',
    perMonth: '/ month',

    // Services
    availableServices: 'Available Services',
    ptSessions: 'PT Sessions',
    invitations: 'Invitations',
    inBody: 'InBody',
    freezeDays: 'Freeze Days',
    clickToFreeze: 'Click to Freeze',

    // Quick Links
    attendance: 'Attendance',
    receipts: 'Receipts',
    spa: 'Spa',

    // Info
    tip: 'Tip',
    contactManagement: 'To renew or upgrade your subscription, please contact management',

    // Attendance Page
    attendanceHistory: 'Attendance History',
    attendanceSubtitle: 'Your gym attendance record',
    thisWeek: 'This Week',
    thisMonth: 'This Month',
    total: 'Total',
    latestAttendance: 'Latest Attendance',
    noAttendance: 'No attendance records yet',
    loadMore: 'Load More',
    keepGoingStrong: 'Great Job!',
    attendanceHelps: 'Regular attendance helps you achieve your goals',

    // Receipts Page
    receiptsTitle: 'Receipts',
    receiptsSubtitle: 'Payment History',
    receiptCount: 'Receipt Count',
    totalPaid: 'Total Paid',
    allReceipts: 'All Receipts',
    noReceipts: 'No receipts yet',
    receipt: 'Receipt',
    requestCopy: 'You can request a printed copy of any receipt from management',

    // Spa Page
    spaBookings: 'Spa Bookings',
    spaSubtitle: 'Relaxation Sessions',
    upcoming: 'Upcoming',
    all: 'All',
    confirmed: 'Confirmed',
    pending: 'Pending',
    bookings: 'Bookings',
    noBookings: 'No bookings',
    contactForBooking: 'Contact management to book a spa session',
    toBook: 'To Book',

    // Freeze Page
    freezeSubscription: 'Freeze Subscription',
    freezeSubtitle: 'Request Temporary Freeze',
    currentStatus: 'Current Status',
    availableFreezeDays: 'Available Freeze Days',
    currentlyFrozen: 'Currently Frozen',
    subscriptionPaused: 'Subscription Paused',
    subscriptionActive: 'Subscription Active',
    requestNewFreeze: 'Request New Freeze',
    frozenInfo: 'Your subscription is currently frozen',
    frozenDetails: 'Expiry date has been extended. To cancel, contact management',
    noFreezeDaysLeft: 'No freeze days remaining',
    newFreezeRequest: 'New Freeze Request',
    startDateLabel: 'Start Date',
    daysLabel: 'Number of Days',
    reasonLabel: 'Reason (Optional)',
    reasonPlaceholder: 'Write freeze reason (optional)',
    submitRequest: 'Submit Request',
    submitting: 'Submitting...',
    freezeHistory: 'Freeze History',
    noFreezeHistory: 'No freeze history',
    reason: 'Reason',
    requestDate: 'Request Date',
    applied: 'Applied',
    rejected: 'Rejected',

    // Common
    loading: 'Loading...',
    back: 'Back',
    days: 'days',
    minutes: 'min',

    // Login
    memberNumber: 'Member Number',
    phoneNumber: 'Phone Number',
    login: 'Login',
    welcome: 'Welcome',
  },
};

export type TranslationKey = keyof typeof translations.ar;

export function getTranslation(lang: Language, key: TranslationKey): string {
  return translations[lang][key] || key;
}

// types/permissions.ts - أنواع نظام الصلاحيات

/**
 * الأدوار المتاحة في النظام
 */
export type UserRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'COACH'

/**
 * صلاحيات المستخدم
 */
export interface Permissions {
  // صلاحيات الأعضاء
  canViewMembers: boolean
  canCreateMembers: boolean
  canEditMembers: boolean
  canDeleteMembers: boolean

  // صلاحيات التدريب الشخصي
  canViewPT: boolean
  canCreatePT: boolean
  canEditPT: boolean
  canDeletePT: boolean
  canRegisterPTAttendance: boolean // للكوتشات فقط

  // صلاحيات الكلاسات الجماعية
  canViewGroupClass: boolean
  canCreateGroupClass: boolean
  canEditGroupClass: boolean
  canDeleteGroupClass: boolean
  canRegisterClassAttendance: boolean

  // صلاحيات التغذية
  canViewNutrition: boolean
  canCreateNutrition: boolean
  canEditNutrition: boolean
  canDeleteNutrition: boolean
  canRegisterNutritionAttendance: boolean

  // صلاحيات العلاج الطبيعي
  canViewPhysiotherapy: boolean
  canCreatePhysiotherapy: boolean
  canEditPhysiotherapy: boolean
  canDeletePhysiotherapy: boolean
  canRegisterPhysioAttendance: boolean

  // صلاحيات الموظفين
  canViewStaff: boolean
  canCreateStaff: boolean
  canEditStaff: boolean
  canDeleteStaff: boolean

  // صلاحيات الإيصالات
  canViewReceipts: boolean
  canEditReceipts: boolean
  canDeleteReceipts: boolean

  // صلاحيات المصروفات
  canViewExpenses: boolean
  canCreateExpense: boolean
  canEditExpense: boolean
  canDeleteExpense: boolean

  // صلاحيات الزوار
  canViewVisitors: boolean
  canCreateVisitor: boolean
  canEditVisitor: boolean
  canDeleteVisitor: boolean

  // صلاحيات المتابعات
  canViewFollowUps: boolean
  canCreateFollowUp: boolean
  canEditFollowUp: boolean
  canDeleteFollowUp: boolean

  // صلاحيات يوم الاستخدام
  canViewDayUse: boolean
  canCreateDayUse: boolean
  canEditDayUse: boolean
  canDeleteDayUse: boolean

  // صلاحيات التقارير والماليات
  canViewReports: boolean
  canViewFinancials: boolean
  canViewAttendance: boolean
  canAccessClosing: boolean

  // صلاحيات الإعدادات والإدارة
  canAccessSettings: boolean
  canAccessAdmin: boolean

  // صلاحيات اختبار اللياقة
  canCreateFitnessTest: boolean
  canViewFitnessTests: boolean

  // صلاحيات SPA
  canViewSpaBookings: boolean
  canCreateSpaBooking: boolean
  canEditSpaBooking: boolean
  canCancelSpaBooking: boolean
  canViewSpaReports: boolean

  // صلاحيات خصومات الموظفين
  canViewDeductions: boolean
  canCreateDeduction: boolean
  canEditDeduction: boolean
  canDeleteDeduction: boolean

  // صلاحيات المحظورين
  canManageBannedMembers: boolean
}

/**
 * بيانات المستخدم الأساسية
 */
export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  isActive: boolean
  createdAt: string
  permissions?: Permissions
}

/**
 * payload الـ JWT
 */
export interface JWTPayload {
  userId: string
  email: string
  role: UserRole
  permissions?: Permissions
  iat?: number
  exp?: number
}

/**
 * حالة المصادقة
 */
export interface AuthState {
  user: User | null
  permissions: Permissions | null
  loading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
}

/**
 * استجابة API للمصادقة
 */
export interface AuthResponse {
  success: boolean
  user: User
  message?: string
}

/**
 * خطأ الصلاحيات
 */
export interface PermissionError {
  error: string
  requiredPermission?: keyof Permissions
  userRole?: UserRole
}

/**
 * إعدادات الصلاحيات الافتراضية حسب الدور
 */
export const DEFAULT_PERMISSIONS: Record<UserRole, Permissions> = {
  OWNER: {
    canViewMembers: true,
    canCreateMembers: true,
    canEditMembers: true,
    canDeleteMembers: true,
    canViewPT: true,
    canCreatePT: true,
    canEditPT: true,
    canDeletePT: true,
    canRegisterPTAttendance: true,
    canViewGroupClass: true,
    canCreateGroupClass: true,
    canEditGroupClass: true,
    canDeleteGroupClass: true,
    canRegisterClassAttendance: true,
    canViewNutrition: true,
    canCreateNutrition: true,
    canEditNutrition: true,
    canDeleteNutrition: true,
    canRegisterNutritionAttendance: true,
    canViewPhysiotherapy: true,
    canCreatePhysiotherapy: true,
    canEditPhysiotherapy: true,
    canDeletePhysiotherapy: true,
    canRegisterPhysioAttendance: true,
    canViewStaff: true,
    canCreateStaff: true,
    canEditStaff: true,
    canDeleteStaff: true,
    canViewReceipts: true,
    canEditReceipts: true,
    canDeleteReceipts: true,
    canViewExpenses: true,
    canCreateExpense: true,
    canEditExpense: true,
    canDeleteExpense: true,
    canViewVisitors: true,
    canCreateVisitor: true,
    canEditVisitor: true,
    canDeleteVisitor: true,
    canViewFollowUps: true,
    canCreateFollowUp: true,
    canEditFollowUp: true,
    canDeleteFollowUp: true,
    canViewDayUse: true,
    canCreateDayUse: true,
    canEditDayUse: true,
    canDeleteDayUse: true,
    canViewReports: true,
    canViewFinancials: true,
    canViewAttendance: true,
    canAccessClosing: true,
    canAccessSettings: true,
    canAccessAdmin: true,
    canCreateFitnessTest: true,
    canViewFitnessTests: true,
    canViewSpaBookings: true,
    canCreateSpaBooking: true,
    canEditSpaBooking: true,
    canCancelSpaBooking: true,
    canViewSpaReports: true,
    canViewDeductions: true,
    canCreateDeduction: true,
    canEditDeduction: true,
    canDeleteDeduction: true,
    canManageBannedMembers: true,
  },
  ADMIN: {
    canViewMembers: true,
    canCreateMembers: true,
    canEditMembers: true,
    canDeleteMembers: true,
    canViewPT: true,
    canCreatePT: true,
    canEditPT: true,
    canDeletePT: true,
    canRegisterPTAttendance: true,
    canViewGroupClass: true,
    canCreateGroupClass: true,
    canEditGroupClass: true,
    canDeleteGroupClass: true,
    canRegisterClassAttendance: true,
    canViewNutrition: true,
    canCreateNutrition: true,
    canEditNutrition: true,
    canDeleteNutrition: true,
    canRegisterNutritionAttendance: true,
    canViewPhysiotherapy: true,
    canCreatePhysiotherapy: true,
    canEditPhysiotherapy: true,
    canDeletePhysiotherapy: true,
    canRegisterPhysioAttendance: true,
    canViewStaff: true,
    canCreateStaff: true,
    canEditStaff: true,
    canDeleteStaff: true,
    canViewReceipts: true,
    canEditReceipts: true,
    canDeleteReceipts: true,
    canViewExpenses: true,
    canCreateExpense: true,
    canEditExpense: true,
    canDeleteExpense: true,
    canViewVisitors: true,
    canCreateVisitor: true,
    canEditVisitor: true,
    canDeleteVisitor: true,
    canViewFollowUps: true,
    canCreateFollowUp: true,
    canEditFollowUp: true,
    canDeleteFollowUp: true,
    canViewDayUse: true,
    canCreateDayUse: true,
    canEditDayUse: true,
    canDeleteDayUse: true,
    canViewReports: true,
    canViewFinancials: true,
    canViewAttendance: true,
    canAccessClosing: true,
    canAccessSettings: true,
    canAccessAdmin: true,
    canCreateFitnessTest: true,
    canViewFitnessTests: true,
    canViewSpaBookings: true,
    canCreateSpaBooking: true,
    canEditSpaBooking: true,
    canCancelSpaBooking: true,
    canViewSpaReports: true,
    canViewDeductions: true,
    canCreateDeduction: true,
    canEditDeduction: true,
    canDeleteDeduction: true,
    canManageBannedMembers: true,
  },
  MANAGER: {
    canViewMembers: true,
    canCreateMembers: true,
    canEditMembers: true,
    canDeleteMembers: false,
    canViewPT: true,
    canCreatePT: true,
    canEditPT: true,
    canDeletePT: false,
    canRegisterPTAttendance: true,
    canViewGroupClass: true,
    canCreateGroupClass: true,
    canEditGroupClass: true,
    canDeleteGroupClass: false,
    canRegisterClassAttendance: true,
    canViewNutrition: true,
    canCreateNutrition: true,
    canEditNutrition: true,
    canDeleteNutrition: false,
    canRegisterNutritionAttendance: true,
    canViewPhysiotherapy: true,
    canCreatePhysiotherapy: true,
    canEditPhysiotherapy: true,
    canDeletePhysiotherapy: false,
    canRegisterPhysioAttendance: true,
    canViewStaff: true,
    canCreateStaff: false,
    canEditStaff: false,
    canDeleteStaff: false,
    canViewReceipts: true,
    canEditReceipts: true,
    canDeleteReceipts: false,
    canViewExpenses: true,
    canCreateExpense: true,
    canEditExpense: true,
    canDeleteExpense: false,
    canViewVisitors: true,
    canCreateVisitor: true,
    canEditVisitor: true,
    canDeleteVisitor: false,
    canViewFollowUps: true,
    canCreateFollowUp: true,
    canEditFollowUp: true,
    canDeleteFollowUp: false,
    canViewDayUse: true,
    canCreateDayUse: true,
    canEditDayUse: true,
    canDeleteDayUse: false,
    canViewReports: true,
    canViewFinancials: true,
    canViewAttendance: true,
    canAccessClosing: true,
    canAccessSettings: false,
    canAccessAdmin: false,
    canCreateFitnessTest: false,
    canViewFitnessTests: true,
    canViewSpaBookings: true,
    canCreateSpaBooking: true,
    canEditSpaBooking: true,
    canCancelSpaBooking: true,
    canViewSpaReports: true,
    canViewDeductions: true,
    canCreateDeduction: true,
    canEditDeduction: true,
    canDeleteDeduction: false,
    canManageBannedMembers: true,
  },
  STAFF: {
    canViewMembers: true,
    canCreateMembers: false,
    canEditMembers: false,
    canDeleteMembers: false,
    canViewPT: true,
    canCreatePT: false,
    canEditPT: false,
    canDeletePT: false,
    canRegisterPTAttendance: false,
    canViewGroupClass: true,
    canCreateGroupClass: false,
    canEditGroupClass: false,
    canDeleteGroupClass: false,
    canRegisterClassAttendance: true,
    canViewNutrition: true,
    canCreateNutrition: false,
    canEditNutrition: false,
    canDeleteNutrition: false,
    canRegisterNutritionAttendance: true,
    canViewPhysiotherapy: true,
    canCreatePhysiotherapy: false,
    canEditPhysiotherapy: false,
    canDeletePhysiotherapy: false,
    canRegisterPhysioAttendance: true,
    canViewStaff: false,
    canCreateStaff: false,
    canEditStaff: false,
    canDeleteStaff: false,
    canViewReceipts: true,
    canEditReceipts: false,
    canDeleteReceipts: false,
    canViewExpenses: false,
    canCreateExpense: false,
    canEditExpense: false,
    canDeleteExpense: false,
    canViewVisitors: true,
    canCreateVisitor: true,
    canEditVisitor: false,
    canDeleteVisitor: false,
    canViewFollowUps: false,
    canCreateFollowUp: false,
    canEditFollowUp: false,
    canDeleteFollowUp: false,
    canViewDayUse: true,
    canCreateDayUse: true,
    canEditDayUse: false,
    canDeleteDayUse: false,
    canViewReports: false,
    canViewFinancials: false,
    canViewAttendance: false,
    canAccessClosing: false,
    canAccessSettings: false,
    canAccessAdmin: false,
    canCreateFitnessTest: false,
    canViewFitnessTests: false,
    canViewSpaBookings: true,
    canCreateSpaBooking: true,
    canEditSpaBooking: false,
    canCancelSpaBooking: false,
    canViewSpaReports: false,
    canViewDeductions: false,
    canCreateDeduction: false,
    canEditDeduction: false,
    canDeleteDeduction: false,
    canManageBannedMembers: false,
  },
  COACH: {
    // الكوتش يرى فقط حصصه الخاصة
    canViewMembers: false,
    canCreateMembers: false,
    canEditMembers: false,
    canDeleteMembers: false,
    canViewPT: true, // يرى حصصه فقط
    canCreatePT: false,
    canEditPT: false,
    canDeletePT: false,
    canRegisterPTAttendance: true, // الصلاحية الأساسية للكوتش
    canViewGroupClass: true, // يرى كلاساته فقط
    canCreateGroupClass: false,
    canEditGroupClass: false,
    canDeleteGroupClass: false,
    canRegisterClassAttendance: true, // يسجل حضور كلاساته
    canViewNutrition: true, // يرى عملاءه فقط
    canCreateNutrition: false,
    canEditNutrition: false,
    canDeleteNutrition: false,
    canRegisterNutritionAttendance: true,
    canViewPhysiotherapy: true, // يرى عملاءه فقط
    canCreatePhysiotherapy: false,
    canEditPhysiotherapy: false,
    canDeletePhysiotherapy: false,
    canRegisterPhysioAttendance: true,
    canViewStaff: false,
    canCreateStaff: false,
    canEditStaff: false,
    canDeleteStaff: false,
    canViewReceipts: false,
    canEditReceipts: false,
    canDeleteReceipts: false,
    canViewExpenses: false,
    canCreateExpense: false,
    canEditExpense: false,
    canDeleteExpense: false,
    canViewVisitors: false,
    canCreateVisitor: false,
    canEditVisitor: false,
    canDeleteVisitor: false,
    canViewFollowUps: false,
    canCreateFollowUp: false,
    canEditFollowUp: false,
    canDeleteFollowUp: false,
    canViewDayUse: false,
    canCreateDayUse: false,
    canEditDayUse: false,
    canDeleteDayUse: false,
    canViewReports: false,
    canViewFinancials: false,
    canViewAttendance: false,
    canAccessClosing: false,
    canAccessSettings: false,
    canAccessAdmin: false,
    canCreateFitnessTest: true,
    canViewFitnessTests: true,
    canViewSpaBookings: false,
    canCreateSpaBooking: false,
    canEditSpaBooking: false,
    canCancelSpaBooking: false,
    canViewSpaReports: false,
    canViewDeductions: false,
    canCreateDeduction: false,
    canEditDeduction: false,
    canDeleteDeduction: false,
    canManageBannedMembers: false,
  },
}

/**
 * أسماء الصلاحيات بالعربية
 */
export const PERMISSION_LABELS: Record<keyof Permissions, string> = {
  canViewMembers: 'عرض الأعضاء',
  canCreateMembers: 'إضافة عضو',
  canEditMembers: 'تعديل عضو',
  canDeleteMembers: 'حذف عضو',
  canViewPT: 'عرض التدريب الشخصي',
  canCreatePT: 'إنشاء جلسة PT',
  canEditPT: 'تعديل جلسة PT',
  canDeletePT: 'حذف جلسة PT',
  canRegisterPTAttendance: 'تسجيل حضور PT',
  canViewGroupClass: 'عرض الكلاسات الجماعية',
  canCreateGroupClass: 'إنشاء كلاس جماعي',
  canEditGroupClass: 'تعديل كلاس جماعي',
  canDeleteGroupClass: 'حذف كلاس جماعي',
  canRegisterClassAttendance: 'تسجيل حضور كلاس جماعي',
  canViewNutrition: 'عرض التغذية',
  canCreateNutrition: 'إنشاء جلسة تغذية',
  canEditNutrition: 'تعديل جلسة تغذية',
  canDeleteNutrition: 'حذف جلسة تغذية',
  canRegisterNutritionAttendance: 'تسجيل حضور تغذية',
  canViewPhysiotherapy: 'عرض العلاج الطبيعي',
  canCreatePhysiotherapy: 'إنشاء جلسة علاج طبيعي',
  canEditPhysiotherapy: 'تعديل جلسة علاج طبيعي',
  canDeletePhysiotherapy: 'حذف جلسة علاج طبيعي',
  canRegisterPhysioAttendance: 'تسجيل حضور علاج طبيعي',
  canViewStaff: 'عرض الموظفين',
  canCreateStaff: 'إضافة موظف',
  canEditStaff: 'تعديل موظف',
  canDeleteStaff: 'حذف موظف',
  canViewReceipts: 'عرض الإيصالات',
  canEditReceipts: 'تعديل إيصال',
  canDeleteReceipts: 'حذف إيصال',
  canViewExpenses: 'عرض المصروفات',
  canCreateExpense: 'إضافة مصروف',
  canEditExpense: 'تعديل مصروف',
  canDeleteExpense: 'حذف مصروف',
  canViewVisitors: 'عرض الزوار',
  canCreateVisitor: 'إضافة زائر',
  canEditVisitor: 'تعديل زائر',
  canDeleteVisitor: 'حذف زائر',
  canViewFollowUps: 'عرض المتابعات',
  canCreateFollowUp: 'إضافة متابعة',
  canEditFollowUp: 'تعديل متابعة',
  canDeleteFollowUp: 'حذف متابعة',
  canViewDayUse: 'عرض يوم الاستخدام',
  canCreateDayUse: 'إضافة يوم استخدام',
  canEditDayUse: 'تعديل يوم استخدام',
  canDeleteDayUse: 'حذف يوم استخدام',
  canViewReports: 'عرض التقارير',
  canViewFinancials: 'عرض الماليات',
  canViewAttendance: 'عرض الحضور',
  canAccessClosing: 'الوصول للتقفيل',
  canAccessSettings: 'الوصول للإعدادات',
  canAccessAdmin: 'الوصول للوحة الإدارة',
  canCreateFitnessTest: 'إنشاء اختبار لياقة',
  canViewFitnessTests: 'عرض اختبارات اللياقة',
  canViewSpaBookings: 'عرض حجوزات SPA',
  canCreateSpaBooking: 'إنشاء حجز SPA',
  canEditSpaBooking: 'تعديل حجز SPA',
  canCancelSpaBooking: 'إلغاء حجز SPA',
  canViewSpaReports: 'عرض تقارير SPA',
  canViewDeductions: 'عرض الخصومات',
  canCreateDeduction: 'إضافة خصم',
  canEditDeduction: 'تعديل خصم',
  canDeleteDeduction: 'حذف خصم',
  canManageBannedMembers: 'إدارة المحظورين',
}

/**
 * تجميع الصلاحيات حسب الفئة
 */
export const PERMISSION_GROUPS = {
  members: {
    label: '👥 الأعضاء',
    permissions: [
      'canViewMembers',
      'canCreateMembers',
      'canEditMembers',
      'canDeleteMembers',
    ] as Array<keyof Permissions>,
  },
  pt: {
    label: '💪 التدريب الشخصي',
    permissions: [
      'canViewPT',
      'canCreatePT',
      'canEditPT',
      'canDeletePT',
      'canRegisterPTAttendance',
    ] as Array<keyof Permissions>,
  },
  groupClass: {
    label: '👥 الكلاسات الجماعية',
    permissions: [
      'canViewGroupClass',
      'canCreateGroupClass',
      'canEditGroupClass',
      'canDeleteGroupClass',
      'canRegisterClassAttendance',
    ] as Array<keyof Permissions>,
  },
  nutrition: {
    label: '🥗 التغذية',
    permissions: [
      'canViewNutrition',
      'canCreateNutrition',
      'canEditNutrition',
      'canDeleteNutrition',
      'canRegisterNutritionAttendance',
    ] as Array<keyof Permissions>,
  },
  physiotherapy: {
    label: '🏥 العلاج الطبيعي',
    permissions: [
      'canViewPhysiotherapy',
      'canCreatePhysiotherapy',
      'canEditPhysiotherapy',
      'canDeletePhysiotherapy',
      'canRegisterPhysioAttendance',
    ] as Array<keyof Permissions>,
  },
  staff: {
    label: '👷 الموظفين',
    permissions: [
      'canViewStaff',
      'canCreateStaff',
      'canEditStaff',
      'canDeleteStaff',
    ] as Array<keyof Permissions>,
  },
  receipts: {
    label: '🧾 الإيصالات',
    permissions: [
      'canViewReceipts',
      'canEditReceipts',
      'canDeleteReceipts',
    ] as Array<keyof Permissions>,
  },
  expenses: {
    label: '💸 المصروفات',
    permissions: [
      'canViewExpenses',
      'canCreateExpense',
      'canEditExpense',
      'canDeleteExpense',
    ] as Array<keyof Permissions>,
  },
  visitors: {
    label: '🚶 الزوار',
    permissions: [
      'canViewVisitors',
      'canCreateVisitor',
      'canEditVisitor',
      'canDeleteVisitor',
    ] as Array<keyof Permissions>,
  },
  followups: {
    label: '📝 المتابعات',
    permissions: [
      'canViewFollowUps',
      'canCreateFollowUp',
      'canEditFollowUp',
      'canDeleteFollowUp',
    ] as Array<keyof Permissions>,
  },
  dayuse: {
    label: '📅 يوم الاستخدام',
    permissions: [
      'canViewDayUse',
      'canCreateDayUse',
      'canEditDayUse',
      'canDeleteDayUse',
    ] as Array<keyof Permissions>,
  },
  reports: {
    label: '📊 التقارير والماليات',
    permissions: [
      'canViewReports',
      'canViewFinancials',
      'canViewAttendance',
      'canAccessClosing',
    ] as Array<keyof Permissions>,
  },
  settings: {
    label: '⚙️ الإعدادات والإدارة',
    permissions: [
      'canAccessSettings',
      'canAccessAdmin',
    ] as Array<keyof Permissions>,
  },
  fitnessTests: {
    label: '📋 اختبارات اللياقة',
    permissions: [
      'canCreateFitnessTest',
      'canViewFitnessTests',
    ] as Array<keyof Permissions>,
  },
  spa: {
    label: '💆 SPA Bookings',
    permissions: [
      'canViewSpaBookings',
      'canCreateSpaBooking',
      'canEditSpaBooking',
      'canCancelSpaBooking',
      'canViewSpaReports',
    ] as Array<keyof Permissions>,
  },
  deductions: {
    label: '📉 خصومات الموظفين',
    permissions: [
      'canViewDeductions',
      'canCreateDeduction',
      'canEditDeduction',
      'canDeleteDeduction',
    ] as Array<keyof Permissions>,
  },
  bannedMembers: {
    label: '🚫 المحظورون',
    permissions: [
      'canManageBannedMembers',
    ] as Array<keyof Permissions>,
  },
}

/**
 * أيقونات الصلاحيات
 */
export const PERMISSION_ICONS: Record<keyof Permissions, string> = {
  canViewMembers: '👁️',
  canCreateMembers: '➕',
  canEditMembers: '✏️',
  canDeleteMembers: '🗑️',
  canViewPT: '👁️',
  canCreatePT: '➕',
  canEditPT: '✏️',
  canDeletePT: '🗑️',
  canRegisterPTAttendance: '✅',
  canViewGroupClass: '👁️',
  canCreateGroupClass: '➕',
  canEditGroupClass: '✏️',
  canDeleteGroupClass: '🗑️',
  canRegisterClassAttendance: '✅',
  canViewNutrition: '👁️',
  canCreateNutrition: '➕',
  canEditNutrition: '✏️',
  canDeleteNutrition: '🗑️',
  canRegisterNutritionAttendance: '✅',
  canViewPhysiotherapy: '👁️',
  canCreatePhysiotherapy: '➕',
  canEditPhysiotherapy: '✏️',
  canDeletePhysiotherapy: '🗑️',
  canRegisterPhysioAttendance: '✅',
  canViewStaff: '👁️',
  canCreateStaff: '➕',
  canEditStaff: '✏️',
  canDeleteStaff: '🗑️',
  canViewReceipts: '👁️',
  canEditReceipts: '✏️',
  canDeleteReceipts: '🗑️',
  canViewExpenses: '👁️',
  canCreateExpense: '➕',
  canEditExpense: '✏️',
  canDeleteExpense: '🗑️',
  canViewVisitors: '👁️',
  canCreateVisitor: '➕',
  canEditVisitor: '✏️',
  canDeleteVisitor: '🗑️',
  canViewFollowUps: '👁️',
  canCreateFollowUp: '➕',
  canEditFollowUp: '✏️',
  canDeleteFollowUp: '🗑️',
  canViewDayUse: '👁️',
  canCreateDayUse: '➕',
  canEditDayUse: '✏️',
  canDeleteDayUse: '🗑️',
  canViewReports: '📊',
  canViewFinancials: '💰',
  canViewAttendance: '📋',
  canAccessClosing: '🔒',
  canAccessSettings: '⚙️',
  canAccessAdmin: '👨‍💼',
  canCreateFitnessTest: '➕',
  canViewFitnessTests: '👁️',
  canViewSpaBookings: '👁️',
  canCreateSpaBooking: '➕',
  canEditSpaBooking: '✏️',
  canCancelSpaBooking: '❌',
  canViewSpaReports: '📊',
  canViewDeductions: '👁️',
  canCreateDeduction: '➕',
  canEditDeduction: '✏️',
  canDeleteDeduction: '🗑️',
  canManageBannedMembers: '🚫',
}

/**
 * دالة للحصول على الصلاحيات الافتراضية حسب الدور
 */
export function getDefaultPermissions(role: UserRole): Permissions {
  return DEFAULT_PERMISSIONS[role]
}

/**
 * دالة للتحقق من صلاحية واحدة
 */
export function hasPermission(
  permissions: Permissions | null | undefined,
  permission: keyof Permissions,
  role?: UserRole
): boolean {
  // Owner والـ Admin لهم كل الصلاحيات
  if (role === 'OWNER' || role === 'ADMIN') return true

  // إذا لم تكن هناك صلاحيات
  if (!permissions) return false

  return permissions[permission]
}

/**
 * دالة للتحقق من صلاحيات متعددة (واحدة على الأقل)
 */
export function hasAnyPermission(
  permissions: Permissions | null | undefined,
  permissionList: Array<keyof Permissions>,
  role?: UserRole
): boolean {
  // Owner والـ Admin لهم كل الصلاحيات
  if (role === 'OWNER' || role === 'ADMIN') return true

  // إذا لم تكن هناك صلاحيات
  if (!permissions) return false

  return permissionList.some(perm => permissions[perm])
}

/**
 * دالة للتحقق من صلاحيات متعددة (الكل مطلوب)
 */
export function hasAllPermissions(
  permissions: Permissions | null | undefined,
  permissionList: Array<keyof Permissions>,
  role?: UserRole
): boolean {
  // Owner والـ Admin لهم كل الصلاحيات
  if (role === 'OWNER' || role === 'ADMIN') return true

  // إذا لم تكن هناك صلاحيات
  if (!permissions) return false

  return permissionList.every(perm => permissions[perm])
}
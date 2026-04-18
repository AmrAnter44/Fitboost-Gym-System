// app/api/admin/users/[id]/permissions/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '../../../../../../lib/prisma'
import { requireAdmin } from '../../../../../../lib/auth'

// ✅ الحقول المسموحة في جدول Permission
const VALID_PERMISSION_FIELDS = [
  'canViewMembers', 'canCreateMembers', 'canEditMembers', 'canDeleteMembers',
  'canViewPT', 'canCreatePT', 'canEditPT', 'canDeletePT', 'canRegisterPTAttendance',
  'canViewNutrition', 'canCreateNutrition', 'canEditNutrition', 'canDeleteNutrition', 'canRegisterNutritionAttendance',
  'canViewPhysiotherapy', 'canCreatePhysiotherapy', 'canEditPhysiotherapy', 'canDeletePhysiotherapy', 'canRegisterPhysioAttendance',
  'canViewGroupClass', 'canCreateGroupClass', 'canEditGroupClass', 'canDeleteGroupClass', 'canRegisterClassAttendance',
  'canViewMore', 'canRegisterMoreAttendance', 'canDeleteMore', 'canAccessMoreCommission',
  'canViewStaff', 'canCreateStaff', 'canEditStaff', 'canDeleteStaff',
  'canViewReceipts', 'canEditReceipts', 'canDeleteReceipts',
  'canViewExpenses', 'canCreateExpense', 'canEditExpense', 'canDeleteExpense',
  'canViewVisitors', 'canCreateVisitor', 'canEditVisitor', 'canDeleteVisitor',
  'canViewFollowUps', 'canCreateFollowUp', 'canEditFollowUp', 'canDeleteFollowUp',
  'canViewDayUse', 'canCreateDayUse', 'canEditDayUse', 'canDeleteDayUse',
  'canViewReports', 'canViewFinancials', 'canViewAttendance', 'canAccessClosing', 'canAccessSettings', 'canAccessAdmin',
  'canViewSpaBookings', 'canCreateSpaBooking', 'canEditSpaBooking', 'canCancelSpaBooking', 'canViewSpaReports',
  'canViewWhatsAppInbox', 'canSendWhatsApp', 'canManageWhatsApp',
  'canViewDeductions', 'canCreateDeduction', 'canEditDeduction', 'canDeleteDeduction',
  'canManageBannedMembers',
]

function filterPermissions(perms: Record<string, any>): Record<string, boolean> {
  const filtered: Record<string, boolean> = {}
  for (const key of Object.keys(perms)) {
    if (VALID_PERMISSION_FIELDS.includes(key) && typeof perms[key] === 'boolean') {
      filtered[key] = perms[key]
    }
  }
  return filtered
}

// PUT - تحديث صلاحيات مستخدم

export const dynamic = 'force-dynamic'

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request)

    const body = await request.json()

    // ✅ تصفية الحقول المسموحة فقط
    const filteredBody = filterPermissions(body)

    // التحقق من وجود المستخدم
    const user = await prisma.user.findUnique({
      where: { id: params.id }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    // لا يمكن تعديل صلاحيات Admin أو Owner
    if (user.role === 'ADMIN' || user.role === 'OWNER') {
      return NextResponse.json(
        { error: 'لا يمكن تعديل صلاحيات المدير أو المالك' },
        { status: 400 }
      )
    }

    // تحديث أو إنشاء الصلاحيات
    const permission = await prisma.permission.upsert({
      where: { userId: params.id },
      update: filteredBody,
      create: {
        userId: params.id,
        ...filteredBody
      }
    })

    return NextResponse.json(permission)
    
  } catch (error: any) {
    console.error('Error updating permissions:', error)
    
    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية' },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { error: 'فشل تحديث الصلاحيات' },
      { status: 500 }
    )
  }
}

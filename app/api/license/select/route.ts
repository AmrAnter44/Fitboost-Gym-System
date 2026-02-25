import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

export const dynamic = 'force-dynamic'

// POST - حفظ اختيار الصالة والفرع
export async function POST(request: Request) {
  try {
    // ✅ التحقق من أن المستخدم هو OWNER
    const user = await requirePermission(request, 'canAccessSettings')

    if (user.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'هذه العملية متاحة فقط لمالك النظام (OWNER)' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      gymId,
      gymName,
      branchId,
      branchName,
      systemLicense,
      licenseMessage
    } = body

    // التحقق من البيانات المطلوبة
    if (!gymId || !gymName || !branchId || !branchName) {
      return NextResponse.json(
        { error: 'جميع البيانات مطلوبة (gymId, gymName, branchId, branchName)' },
        { status: 400 }
      )
    }

    // حذف السجل القديم (إن وجد)
    await prisma.supabaseLicense.deleteMany({})

    // إنشاء سجل جديد
    const license = await prisma.supabaseLicense.create({
      data: {
        gymId,
        gymName,
        branchId,
        branchName,
        systemLicense: String(systemLicense),
        licenseMessage: licenseMessage || null,
        lastChecked: new Date()
      }
    })

    // ✅ تسجيل في Audit Log
    createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      action: 'UPDATE',
      resource: 'License',
      resourceId: license.id,
      details: {
        operation: 'SelectGymAndBranch',
        gymId,
        gymName,
        branchId,
        branchName,
        systemLicense: String(systemLicense)
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
      status: 'success'
    })

    return NextResponse.json({
      success: true,
      license,
      message: 'تم حفظ الترخيص بنجاح'
    })

  } catch (error: any) {
    console.error('❌ خطأ في حفظ الترخيص:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'فشل في حفظ الترخيص' },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)

    // فقط OWNER يمكنه الوصول
    if (user.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { gymId, gymName, branchId, branchName, systemLicense } = body

    if (!gymId || !branchId) {
      return NextResponse.json(
        { error: 'بيانات ناقصة' },
        { status: 400 }
      )
    }

    // حذف السجل القديم
    await prisma.supabaseLicense.deleteMany({})

    // إنشاء سجل جديد
    const license = await prisma.supabaseLicense.create({
      data: {
        gymId,
        gymName,
        branchId,
        branchName,
        systemLicense: systemLicense?.toString() || 'false',
        lastChecked: new Date()
      }
    })

    // تسجيل في audit log
    await createAuditLog({
      userId: user.userId,
      action: 'UPDATE',
      resource: 'System',
      resourceId: license.id,
      details: {
        action: 'license_selected',
        gymName,
        branchName,
        gymId,
        branchId
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request)
    })

    return NextResponse.json({ license })
  } catch (error) {
    console.error('Select license error:', error)
    return NextResponse.json(
      { error: 'خطأ في الخادم' },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

// GET - جلب بيانات عضو واحد (متاح للكوتش بدون صلاحيات خاصة)

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    // 🔒 Validate input: member ID format
    const memberId = params.id
    if (!memberId || typeof memberId !== 'string' || memberId.length > 50) {
      return NextResponse.json(
        { error: 'معرف العضو غير صحيح' },
        { status: 400 }
      )
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        receipts: true,
        coach: {
          select: {
            id: true,
            name: true,
            staffCode: true
          }
        },
        salesStaff: {
          select: {
            id: true,
            name: true,
            staffCode: true
          }
        },
        freezeRequests: {
          where: { status: 'approved' },
          orderBy: { endDate: 'desc' },
          take: 1,
          select: { endDate: true }
        }
      }
    })

    if (!member) {
      return NextResponse.json(
        { error: 'لم يتم العثور على العضو' },
        { status: 404 }
      )
    }

    // 🔒 Ownership check: COACHes can only access their own members
    const isPrivilegedRole = user.role === 'OWNER' || user.role === 'ADMIN' || user.role === 'MANAGER'
    const hasViewPermission = user.permissions?.canViewMembers === true

    if (!isPrivilegedRole && !hasViewPermission) {
      if (user.role === 'COACH') {
        if (!user.staffId || member.coachId !== user.staffId) {
          return NextResponse.json(
            { error: 'ليس لديك صلاحية عرض هذا العضو' },
            { status: 403 }
          )
        }
      } else {
        return NextResponse.json(
          { error: 'ليس لديك صلاحية عرض هذا العضو' },
          { status: 403 }
        )
      }
    }

    return NextResponse.json(member, { status: 200 })
  } catch (error: any) {
    console.error('❌ Error fetching member:', error)
    return NextResponse.json(
      { error: 'فشل جلب بيانات العضو' },
      { status: 500 }
    )
  }
}

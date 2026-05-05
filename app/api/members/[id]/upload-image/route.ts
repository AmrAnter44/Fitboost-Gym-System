import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyAuth } from '../../../../../lib/auth'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../../lib/auditLog'

export const dynamic = 'force-dynamic'

const ALLOWED_FIELDS = ['profileImage', 'idCardFront', 'idCardBack'] as const
type ImageField = typeof ALLOWED_FIELDS[number]

// POST - رفع صورة لعضو (صورة شخصية / وجه أو خلف البطاقة)
// مسموح لأي مستخدم مسجل دخول، بشرط أن الحقل المستهدف فاضي.
// التعديل/الاستبدال يحتاج صلاحية canEditMembers.
export async function POST(
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

    const memberId = params.id
    if (!memberId || typeof memberId !== 'string' || memberId.length > 50) {
      return NextResponse.json(
        { error: 'معرف العضو غير صحيح' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { field, imageUrl } = body as { field?: string; imageUrl?: string }

    if (!field || !ALLOWED_FIELDS.includes(field as ImageField)) {
      return NextResponse.json(
        { error: 'نوع الصورة غير صحيح' },
        { status: 400 }
      )
    }

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json(
        { error: 'الصورة مطلوبة' },
        { status: 400 }
      )
    }

    const existing = await prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, memberNumber: true, name: true, profileImage: true, idCardFront: true, idCardBack: true }
    })

    if (!existing) {
      return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })
    }

    const currentValue = existing[field as ImageField]
    const isReplacing = !!currentValue
    const hasEditPermission =
      user.role === 'OWNER' ||
      user.role === 'ADMIN' ||
      !!user.permissions?.canEditMembers

    if (isReplacing && !hasEditPermission) {
      return NextResponse.json(
        { error: 'الصورة موجودة بالفعل، التعديل يحتاج صلاحية تعديل الأعضاء' },
        { status: 403 }
      )
    }

    const updated = await prisma.member.update({
      where: { id: memberId },
      data: { [field as ImageField]: imageUrl }
    })

    createAuditLog({
      userId: user.userId,
      userEmail: user.email,
      userName: user.name,
      userRole: user.role,
      action: 'UPDATE',
      resource: 'Member',
      resourceId: memberId,
      details: {
        memberNumber: existing.memberNumber,
        name: existing.name,
        field,
        addedImage: !isReplacing,
        replacedImage: isReplacing
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
      status: 'success'
    })

    return NextResponse.json({
      success: true,
      member: {
        id: updated.id,
        profileImage: updated.profileImage,
        idCardFront: updated.idCardFront,
        idCardBack: updated.idCardBack
      }
    })
  } catch (error) {
    console.error('POST upload-image Error:', error)
    return NextResponse.json(
      { error: 'فشل رفع الصورة' },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { requireAnyPermission } from '../../../../../lib/auth'
import { apiCache } from '../../../../../lib/cache'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../../lib/auditLog'
import { PHOTO_UPLOAD_WINDOW_MS, getPhotoUploadUntil, setPhotoUploadUntil } from '../../../../../lib/memberPhotoUpload'

export const dynamic = 'force-dynamic'

//  📷 السماح للعضو يرفع صورته من الأبليكيشن مرة واحدة (10 دقايق)

const handle = async (request: Request, params: Promise<{ id: string }>, open: boolean) => {
  try {
    const user = await requireAnyPermission(request, ['canEditMembers', 'canCreateMembers'])
    const { id } = await params
    const member = await prisma.member.findUnique({ where: { id }, select: { id: true, name: true, memberNumber: true } })
    if (!member) return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })

    const until = open ? Date.now() + PHOTO_UPLOAD_WINDOW_MS : null
    await setPhotoUploadUntil(prisma, id, until)
    apiCache.delete(`profile:${id}`)

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'Member', resourceId: id,
      details: { operation: open ? 'AllowAppPhotoUpload' : 'CancelAppPhotoUpload', memberNumber: member.memberNumber, name: member.name },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json({ success: true, photoUploadUntil: until ? new Date(until).toISOString() : null })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    if (String(error?.message || '').includes('Forbidden')) return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    console.error('app-photo-upload error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

// GET — السماح شغّال لحد إمتى؟
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAnyPermission(request, ['canViewMembers', 'canEditMembers', 'canCreateMembers'])
    const { id } = await params
    const until = await getPhotoUploadUntil(prisma, id)
    return NextResponse.json({ photoUploadUntil: until && until > Date.now() ? new Date(until).toISOString() : null })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    return NextResponse.json({ photoUploadUntil: null })
  }
}

// POST — افتح السماح 10 دقايق
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(request, params, true)
}

// DELETE — اقفل السماح
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(request, params, false)
}

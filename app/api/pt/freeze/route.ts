// app/api/pt/freeze/route.ts
// تجميد / فك تجميد اشتراك PT — gated بـ SystemSettings.ptFreezeEnabled
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requireAnyPermission } from '../../../../lib/auth'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

export const dynamic = 'force-dynamic'

async function ensurePTFreezeEnabled() {
  const settings = await prisma.systemSettings.findUnique({
    where: { id: 'singleton' },
    select: { ptFreezeEnabled: true } as any
  })
  return !!(settings as any)?.ptFreezeEnabled
}

// POST = تجميد لعدد أيام
export async function POST(request: Request) {
  try {
    const user = await requireAnyPermission(request, ['canEditMembers', 'canCreateMembers'])

    const enabled = await ensurePTFreezeEnabled()
    if (!enabled) {
      return NextResponse.json(
        { error: 'فيتشر فريز PT غير مفعّل في الإعدادات' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { ptNumber, freezeDays } = body

    const ptNum = parseInt(String(ptNumber), 10)
    const days = parseInt(String(freezeDays), 10)
    if (!ptNum || isNaN(ptNum)) {
      return NextResponse.json({ error: 'رقم PT مطلوب' }, { status: 400 })
    }
    if (!days || days <= 0) {
      return NextResponse.json({ error: 'عدد أيام الفريز يجب أن يكون أكبر من صفر' }, { status: 400 })
    }

    const pt = await prisma.pT.findUnique({ where: { ptNumber: ptNum } })
    if (!pt) {
      return NextResponse.json({ error: 'اشتراك PT غير موجود' }, { status: 404 })
    }
    if (!pt.expiryDate) {
      return NextResponse.json({ error: 'الاشتراك لا يحتوي على تاريخ انتهاء' }, { status: 400 })
    }
    if ((pt as any).isFrozen) {
      return NextResponse.json({ error: 'الاشتراك مجمّد بالفعل' }, { status: 400 })
    }

    const currentExpiry = new Date(pt.expiryDate)
    const newExpiry = new Date(currentExpiry)
    newExpiry.setDate(newExpiry.getDate() + days)

    const freezeUntil = new Date()
    freezeUntil.setHours(0, 0, 0, 0)
    freezeUntil.setDate(freezeUntil.getDate() + days)

    const updated = await prisma.pT.update({
      where: { ptNumber: ptNum },
      data: {
        expiryDate: newExpiry,
        isFrozen: true,
        freezeUntil,
      } as any
    })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'PT', resourceId: String(ptNum),
      details: {
        operation: 'Freeze',
        ptNumber: ptNum,
        clientName: pt.clientName,
        freezeDays: days,
        oldExpiryDate: currentExpiry.toISOString().slice(0, 10),
        newExpiryDate: newExpiry.toISOString().slice(0, 10),
      },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json({
      success: true,
      message: `تم تجميد اشتراك PT لمدة ${days} يوم`,
      pt: updated,
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (error?.message?.includes('Forbidden')) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    console.error('PT freeze error:', error)
    return NextResponse.json({ error: 'فشل تجميد الاشتراك' }, { status: 500 })
  }
}

// DELETE = فك تجميد فوري
export async function DELETE(request: Request) {
  try {
    const user = await requireAnyPermission(request, ['canEditMembers', 'canCreateMembers'])

    const { searchParams } = new URL(request.url)
    const ptNum = parseInt(searchParams.get('ptNumber') || '', 10)
    if (!ptNum || isNaN(ptNum)) {
      return NextResponse.json({ error: 'رقم PT مطلوب' }, { status: 400 })
    }

    const pt = await prisma.pT.findUnique({ where: { ptNumber: ptNum } })
    if (!pt) {
      return NextResponse.json({ error: 'اشتراك PT غير موجود' }, { status: 404 })
    }

    const updated = await prisma.pT.update({
      where: { ptNumber: ptNum },
      data: { isFrozen: false, freezeUntil: null } as any
    })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'PT', resourceId: String(ptNum),
      details: { operation: 'Unfreeze', ptNumber: ptNum, clientName: pt.clientName },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json({ success: true, pt: updated })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (error?.message?.includes('Forbidden')) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    console.error('PT unfreeze error:', error)
    return NextResponse.json({ error: 'فشل فك التجميد' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'

export const dynamic = 'force-dynamic'

// GET - جلب قائمة المحظورين
export async function GET(request: Request) {
  try {
    await requirePermission(request, 'canManageBannedMembers')

    const banned = await prisma.bannedMember.findMany({
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(banned)
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    }
    return NextResponse.json({ error: 'فشل جلب القائمة' }, { status: 500 })
  }
}

// POST - إضافة محظور
export async function POST(request: Request) {
  try {
    const user = await requirePermission(request, 'canManageBannedMembers')

    const body = await request.json()
    const { name, phone, nationalId, reason, notes } = body

    if (!phone && !nationalId) {
      return NextResponse.json(
        { error: 'يجب إدخال رقم الهاتف أو الرقم القومي على الأقل' },
        { status: 400 }
      )
    }

    const ph = phone?.trim() || null
    const ni = nationalId?.trim() || null

    const banned = await prisma.bannedMember.create({
      data: {
        name: name?.trim() || null,
        phone: ph,
        nationalId: ni,
        reason: reason?.trim() || null,
        notes: notes?.trim() || null,
        bannedBy: user.name || user.email
      }
    })

    // تحديث حقل isBanned في جدول Member للأعضاء المطابقين
    const orConditions: any[] = []
    if (ph) orConditions.push({ phone: ph })
    if (ni) orConditions.push({ nationalId: ni })
    if (orConditions.length > 0) {
      await prisma.member.updateMany({
        where: { OR: orConditions },
        data: { isBanned: true }
      })
    }

    return NextResponse.json(banned, { status: 201 })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    }
    return NextResponse.json({ error: 'فشل إضافة المحظور' }, { status: 500 })
  }
}

// DELETE - حذف محظور
export async function DELETE(request: Request) {
  try {
    await requirePermission(request, 'canManageBannedMembers')

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'المعرف مطلوب' }, { status: 400 })
    }

    // جلب بيانات المحظور قبل الحذف لتحديث isBanned في Member
    const bannedEntry = await prisma.bannedMember.findUnique({ where: { id } })

    await prisma.bannedMember.delete({ where: { id } })

    // إلغاء تحديد isBanned في Member إذا لم يعد هناك حظر آخر بنفس الهاتف أو الرقم القومي
    if (bannedEntry) {
      const ph = bannedEntry.phone?.trim() || null
      const ni = bannedEntry.nationalId?.trim() || null
      const orConditions: any[] = []
      if (ph) orConditions.push({ phone: ph })
      if (ni) orConditions.push({ nationalId: ni })
      if (orConditions.length > 0) {
        // التحقق من عدم وجود حظر آخر بنفس البيانات
        const remaining = await prisma.bannedMember.findFirst({
          where: { OR: orConditions }
        })
        if (!remaining) {
          await prisma.member.updateMany({
            where: { OR: orConditions },
            data: { isBanned: false }
          })
        }
      }
    }

    return NextResponse.json({ message: 'تم حذف المحظور بنجاح' })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    }
    return NextResponse.json({ error: 'فشل الحذف' }, { status: 500 })
  }
}

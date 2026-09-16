// 🚪 تعديل / حذف بوابة — الأونر بس
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner, gateErrorResponse } from '@/lib/gates/api'
import { encryptPassword } from '@/lib/gates/secrets'
import { invalidateGatesCache } from '@/lib/gates/sync'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireOwner(request)
    const body = await request.json()

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = String(body.name).trim()
    if (body.host !== undefined) data.host = String(body.host).trim()
    if (body.port !== undefined) data.port = Number(body.port) || 80
    if (body.useHttps !== undefined) data.useHttps = !!body.useHttps
    if (body.username !== undefined) data.username = String(body.username).trim() || 'admin'
    if (body.doorNo !== undefined) data.doorNo = Number(body.doorNo) || 1
    if (body.planTemplateNo !== undefined) data.planTemplateNo = String(body.planTemplateNo)
    if (body.capacity !== undefined) data.capacity = Number(body.capacity) || 1500
    if (body.isEnabled !== undefined) data.isEnabled = !!body.isEnabled

    //  الباسورد بيتحدّث بس لو المستخدم كتب واحد جديد — الواجهة بتبعت فاضي
    //  لما مايكونش عايز يغيّره
    if (body.password) data.passwordEnc = encryptPassword(String(body.password))

    const gate = await prisma.gate.update({
      where: { id: params.id },
      data,
      select: {
        id: true, name: true, host: true, port: true, useHttps: true, username: true,
        doorNo: true, planTemplateNo: true, capacity: true, isEnabled: true,
        lastSeenAt: true, lastError: true, createdAt: true,
      },
    })

    invalidateGatesCache()
    return NextResponse.json({ success: true, gate })
  } catch (e) {
    return gateErrorResponse(e)
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireOwner(request)

    //  بنشيل سجلات المزامنة كمان — المستخدمين بيفضلوا على الجهاز نفسه.
    //  ده مقصود: حذف البوابة من السيستم مش المفروض يمسح أوشاش الناس.
    await prisma.gateMemberSync.deleteMany({ where: { gateId: params.id } })
    await prisma.gate.delete({ where: { id: params.id } })

    invalidateGatesCache()
    return NextResponse.json({
      success: true,
      note: 'البوابة اتشالت من السيستم. المستخدمين المسجّلين على الجهاز نفسه مااتمسحوش.',
    })
  } catch (e) {
    return gateErrorResponse(e)
  }
}

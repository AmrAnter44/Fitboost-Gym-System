// 📷 تصوير وش العضو بكاميرا البوابة نفسها
//
//  الريسبشن بيدوس «صوّر من البوابة» في فورم العضو → الجهاز بيستنى حد يبص
//  للكاميرا (لحد ٣٠ ثانية) → بنحفظ الصورة في فولدر صور الأعضاء زي أي رفع
//  عادي ونرجّع اللينك. الفورم بيحطه كصورة العضو، ولما يتحفظ بتترفع للبوابات
//  (lib/prisma.ts → syncMember مع forceFace).
//
//  صورة الجهاز نفسه أحسن صورة ممكنة للتعرّف: نفس الكاميرا ونفس الإضاءة.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, gateErrorResponse } from '@/lib/gates/api'
import { toConnection, type GateRow } from '@/lib/gates/sync'
import { captureFace } from '@/lib/hikvision/client'
import { prepareFaceJpeg, saveMemberJpeg } from '@/lib/gates/memberFace'

export const dynamic = 'force-dynamic'
//  الجهاز بيستنى الوش لحد ٣٠ ثانية
export const maxDuration = 60

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireUser(request)

    const gate = await prisma.gate.findUnique({ where: { id: params.id } })
    if (!gate) return NextResponse.json({ success: false, error: 'البوابة مش موجودة' }, { status: 404 })

    const raw = await captureFace(toConnection(gate as GateRow), 30_000)
    //  صورة الجهاز غالبًا صغيرة أصلاً — التجهيز ضمان لحد 200KB
    const jpeg = await prepareFaceJpeg(raw).catch(() => raw)
    const imageUrl = await saveMemberJpeg(jpeg)

    await prisma.gate
      .update({ where: { id: gate.id }, data: { lastSeenAt: new Date(), lastError: null } })
      .catch(() => {})

    return NextResponse.json({
      success: true,
      imageUrl,
      dataUrl: `data:image/jpeg;base64,${jpeg.toString('base64')}`,
      bytes: jpeg.length,
    })
  } catch (e) {
    return gateErrorResponse(e)
  }
}

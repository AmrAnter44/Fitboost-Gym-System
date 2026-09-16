// 🚪 مزامنة كل الأعضاء مع الأجهزة — الأونر بس
//
//  المزامنة بتاخد وقت (~ثانية لكل ١٠٠٠ عضو محلياً، أكتر مع جهاز حقيقي)،
//  فبنستنّاها ونرجّع تقرير كامل بدل ما نسيبها في الخلفية والمستخدم مايعرفش
//  حصل إيه.
import { NextResponse } from 'next/server'
import { requireOwner, gateErrorResponse } from '@/lib/gates/api'
import { reconcileAll } from '@/lib/gates/sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: Request) {
  try {
    await requireOwner(request)
    const body = await request.json().catch(() => ({}))

    //  dryRun بيحسب القرار من غير ما يلمس أي جهاز — مفيد للمراجعة قبل التشغيل
    const reports = await reconcileAll({ dryRun: !!body.dryRun })

    return NextResponse.json({ success: true, dryRun: !!body.dryRun, reports })
  } catch (e) {
    return gateErrorResponse(e)
  }
}

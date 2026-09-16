// 🚪 استقبال أحداث البوابة من الجهاز (HTTP Listening)
//
//  ⚠️ المسار ده **مفتوح** — الجهاز مابيعرفش يبعت كوكي ولا هيدر مخصص، فلازم
//  يكون في `CSRF_EXEMPT_PATHS` في middleware.ts والمصادقة بسر في المسار.
//
//  ⚠️ **صيغة الحدث لسه مش مؤكدة.** الموديل DS-K1T342MFWX-E1 بيبعت
//  multipart أو JSON حسب الفيرموير والإعدادات. عشان كده المستقبِل ده
//  **متسامح عن قصد**: بيقبل أي محتوى، بيخزّن الخام في `rawPayload`، وبيحاول
//  يطلّع رقم العضوية بكذا طريقة. أول حدث حقيقي بيوصل بيتخزّن كامل فنقدر
//  نكمّل الاستخراج على أساس الواقع.
//
//  القاعدة: **مانرميش حاجة أبداً**. حدث مش مفهوم بيتسجّل بـ reason='unparsed'
//  وبيبان في التقرير — أحسن بكتير من إنه يختفي ومحدش يعرف إن في مشكلة.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { matchesEventSecret } from '@/lib/gates/secrets'
import { evaluateEligibility } from '@/lib/gates/eligibility'
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const MAX_RAW = 8000 // مانخزّنش صور كاملة لو الجهاز بعت لقطة

/**
 * محاولة استخراج رقم العضوية من أي صيغة.
 * Hikvision بيسمّيه employeeNoString أو employeeNo حسب الفيرموير.
 */
function extractEmployeeNo(raw: string): string | null {
  const patterns = [
    /"employeeNoString"\s*:\s*"([^"]+)"/i,
    /"employeeNo"\s*:\s*"?([^",}\s]+)"?/i,
    /<employeeNoString>([^<]+)</i,
    /<employeeNo>([^<]+)</i,
    /"cardNo"\s*:\s*"?([^",}\s]+)"?/i,
  ]
  for (const p of patterns) {
    const m = p.exec(raw)
    //  الجهاز بيبعت "0" أو فاضي للأحداث اللي مش مرتبطة بمستخدم
    if (m?.[1] && m[1] !== '0' && m[1].trim() !== '') return m[1].trim()
  }
  return null
}

/** وقت الحدث من الجهاز لو موجود — وإلا دلوقتي. */
function extractEventTime(raw: string): Date {
  const m = /"dateTime"\s*:\s*"([^"]+)"/i.exec(raw) || /<dateTime>([^<]+)</i.exec(raw)
  if (m?.[1]) {
    const d = new Date(m[1])
    if (!isNaN(d.getTime())) return d
  }
  return new Date()
}

/** هل الجهاز قال إنه سمح بالدخول؟ */
function extractDeviceVerdict(raw: string): boolean | null {
  if (/"currentVerifyMode"|"AccessControllerEvent"/i.test(raw)) {
    //  minorEventType بيفرّق بين النجاح والفشل — الأرقام بتختلف بين الموديلات
    //  فبنعتمد على النص لو موجود
    if (/faceVerifyFail|authenticateFail|verifyFail|invalidPeriod|deny/i.test(raw)) return false
    if (/faceVerifyPass|authenticatePass|verifySuccess|legalCard/i.test(raw)) return true
  }
  return null
}

export async function POST(request: Request, { params }: { params: { secret: string } }) {
  //  السر غلط → 404 مش 401، عشان مانأكّدش لحد بيجرّب إن المسار موجود أصلاً
  if (!params.secret || !matchesEventSecret(params.secret)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  //  جهاز بايظ ممكن يغرق السيستم بالأحداث
  const rl = checkRateLimit(getClientIdentifier(request), {
    id: 'gate-event',
    limit: 600,
    windowMs: 60_000,
  })
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  let raw = ''
  try {
    raw = (await request.text()).slice(0, MAX_RAW)
  } catch {
    raw = ''
  }

  try {
    const employeeNo = extractEmployeeNo(raw)
    const eventTime = extractEventTime(raw)
    const deviceSaidAllowed = extractDeviceVerdict(raw)

    //  بوابة واحدة؟ ننسب الحدث ليها. أكتر من واحدة ومفيش تمييز في الحمولة
    //  → بنسيب gateId فاضي بدل ما ننسبه غلط.
    const gates = await prisma.gate.findMany({ where: { isEnabled: true }, select: { id: true } })
    const gateId = gates.length === 1 ? gates[0].id : null

    if (!employeeNo) {
      //  أحداث كتير مش مرتبطة بدخول (فتح باب، عبث، حرارة) — بنسجّلها
      //  عشان نقدر نشوف الصيغة، ومابنعملهاش حضور
      await prisma.gateEvent.create({
        data: { gateId, eventTime, allowed: false, reason: 'unparsed', rawPayload: raw || null },
      })
      return NextResponse.json({ success: true, recorded: 'unparsed' })
    }

    const member = await prisma.member.findFirst({
      where: { memberNumber: employeeNo },
      select: {
        id: true, name: true, memberNumber: true,
        isBanned: true, isActive: true, isFrozen: true,
        expiryDate: true, remainingCheckIns: true,
        allowedCheckInStart: true, allowedCheckInEnd: true,
      },
    })

    if (!member) {
      await prisma.gateEvent.create({
        data: { gateId, employeeNo, eventTime, allowed: false, reason: 'unknownMember', rawPayload: raw || null },
      })
      return NextResponse.json({ success: true, recorded: 'unknownMember' })
    }

    const verdict = evaluateEligibility(member, eventTime)
    //  حكم الجهاز له الأولوية لو قاله صراحة — هو اللي فتح الباب فعلاً.
    //  حكمنا بيفضل مهم عشان السبب المعروض للريسبشن.
    const allowed = deviceSaidAllowed ?? verdict.allowed
    //  if صريح بدل ternary — تضييق النوع المميّز بيشتغل هنا بشكل مؤكد
    let reason = 'ok'
    if (!verdict.allowed) reason = verdict.reason

    await prisma.gateEvent.create({
      data: {
        gateId,
        memberId: member.id,
        employeeNo,
        eventTime,
        allowed,
        reason,
        rawPayload: raw || null,
      },
    })

    //  حضور بيتسجّل للمسموح بس، ومرة واحدة في اليوم — نفس قاعدة
    //  `app/api/member-checkin/route.ts:132-151` عشان العضو اللي بيدخل
    //  ويخرج عشر مرات مايبقاش عشر حضور
    if (allowed) {
      const dayStart = new Date(eventTime); dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(eventTime); dayEnd.setHours(23, 59, 59, 999)

      const already = await prisma.memberCheckIn.findFirst({
        where: { memberId: member.id, checkInTime: { gte: dayStart, lte: dayEnd } },
        select: { id: true },
      })
      if (!already) {
        await prisma.memberCheckIn.create({
          data: { memberId: member.id, checkInTime: eventTime, checkInMethod: 'face' },
        })
      }
    }

    return NextResponse.json({ success: true, recorded: allowed ? 'allowed' : 'denied' })
  } catch (e) {
    //  آخر خط دفاع: لو أي حاجة وقعت، نحاول على الأقل نحفظ الخام.
    //  ضياع الحدث أسوأ من تسجيله ناقص.
    console.error('[gates/event]', e)
    try {
      await prisma.gateEvent.create({
        data: { allowed: false, reason: 'error', rawPayload: raw || null },
      })
    } catch { /* الداتابيز نفسها واقعة — مفيش حاجة تتعمل */ }
    return NextResponse.json({ success: true, recorded: 'error' })
  }
}

//  بعض الأجهزة بتعمل GET أول ما تظبّط الـ HTTP Listening للتأكد إن العنوان شغّال
export async function GET(_request: Request, { params }: { params: { secret: string } }) {
  if (!params.secret || !matchesEventSecret(params.secret)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true, message: 'FitBoost gate listener ready' })
}

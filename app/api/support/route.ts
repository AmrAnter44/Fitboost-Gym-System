import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../lib/auth'
import { gw, getDeviceToken, gatewayUrl, GatewayError } from '../../../lib/gateway'

export const dynamic = 'force-dynamic'

/**
 * 💬 الدعم الفني — شات بين موظفي الجيم وفريق FitBoost (Control)
 *   GET  ?after=<ISO>  → الرسايل الجديدة (من غير after: آخر 100)
 *   POST { body?, image?: { base64, mime } } → يبعت رسالة
 * لأي حد عامل لوجين. بيعدّي من الـ gateway بتوكن الجهاز — مفيش أي مفتاح بيوصل للمتصفح.
 * اسم المرسل بيتاخد من الجلسة على السيرفر (مش من الكلاينت).
 */

const NOT_LINKED = 'الجهاز مش مربوط بـ FitBoost — كلّم الدعم واتساب'
const MAX_BODY = 4000
const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

function fail(error: string, status: number, code?: string) {
  return NextResponse.json({ ok: false, error, code }, { status })
}

function mapGatewayError(e: unknown) {
  if (e instanceof GatewayError) {
    if (e.code === 'NO_GATEWAY' || e.code === 'NO_TOKEN' || e.status === 401) return fail(NOT_LINKED, 409, 'NOT_LINKED')
    if (e.status === 0) {
      return fail(
        e.message === 'timeout' ? 'سحابة FitBoost مردتش في الوقت — جرّب تاني' : 'مفيش اتصال بالنت — اتأكد من النت وجرّب تاني',
        503,
        'OFFLINE'
      )
    }
    if (e.status === 403) return fail('الجهاز ده مش مسموح له يستخدم الدعم — كلّم الدعم واتساب', 403, 'FORBIDDEN')
    if (e.status === 413) return fail('الصورة كبيرة — الحد الأقصى ٣ ميجا', 413, 'TOO_LARGE')
    if (e.status === 429) return fail('رسايل كتير ورا بعض — استنى شوية وجرّب تاني', 429, 'RATE_LIMIT')
    if (e.status === 400) return fail(e.message && e.message.length < 200 ? e.message : 'الرسالة مش صحيحة', 400, 'BAD_REQUEST')
    if (e.status === 404) return fail('خدمة الدعم مش متاحة دلوقتي — كلّم الدعم واتساب', 502, 'UNAVAILABLE')
    return fail('حصلت مشكلة في سحابة FitBoost — جرّب تاني بعد شوية', 502, 'GATEWAY')
  }
  console.error('[support] error:', e instanceof Error ? e.message : 'unknown')
  return fail('خطأ في الخادم', 500)
}

async function ensureLinkedOrFail() {
  if (!gatewayUrl()) return fail(NOT_LINKED, 409, 'NOT_LINKED')
  const token = await getDeviceToken().catch(() => null)
  if (!token) return fail(NOT_LINKED, 409, 'NOT_LINKED')
  return null
}

export async function GET(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return fail('Unauthorized', 401)
  try {
    const notLinked = await ensureLinkedOrFail()
    if (notLinked) return notLinked

    const after = new URL(request.url).searchParams.get('after')
    let qs = ''
    if (after) {
      const t = Date.parse(after)
      if (Number.isNaN(t)) return fail('after غير صحيح', 400)
      qs = `?after=${encodeURIComponent(new Date(t).toISOString())}`
    }
    const data = await gw<{ ok: boolean; messages?: unknown[]; conversationStatus?: string | null }>(`support${qs}`, {
      method: 'GET',
      timeoutMs: 15_000,
    })
    return NextResponse.json({
      ok: true,
      messages: Array.isArray(data?.messages) ? data.messages : [],
      conversationStatus: data?.conversationStatus ?? null,
    })
  } catch (e) {
    return mapGatewayError(e)
  }
}

export async function POST(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return fail('Unauthorized', 401)
  try {
    let input: any
    try {
      input = await request.json()
    } catch {
      return fail('الطلب مش صحيح', 400)
    }

    const body = typeof input?.body === 'string' ? input.body.trim() : ''
    if (body.length > MAX_BODY) return fail(`الرسالة طويلة — الحد الأقصى ${MAX_BODY} حرف`, 400)

    let image: { base64: string; mime: string } | undefined
    if (input?.image != null) {
      const mime = String(input.image?.mime || '').toLowerCase()
      let base64 = typeof input.image?.base64 === 'string' ? input.image.base64 : ''
      // لو جاي data URL نشيل الـ prefix
      const m = /^data:([^;]+);base64,/.exec(base64)
      if (m) base64 = base64.slice(m[0].length)
      base64 = base64.replace(/\s/g, '')
      if (!ALLOWED_MIME.has(mime)) return fail('نوع الصورة مش مدعوم — استخدم JPG أو PNG أو WEBP', 400)
      if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return fail('الصورة مش صحيحة', 400)
      const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
      const bytes = Math.floor((base64.length * 3) / 4) - padding
      if (bytes <= 0) return fail('الصورة مش صحيحة', 400)
      if (bytes > MAX_IMAGE_BYTES) return fail('الصورة كبيرة — الحد الأقصى ٣ ميجا', 413)
      image = { base64, mime }
    }

    if (!body && !image) return fail('اكتب رسالة أو ابعت صورة', 400)

    const notLinked = await ensureLinkedOrFail()
    if (notLinked) return notLinked

    const senderName = (user.name || user.email || 'موظف').toString().trim().slice(0, 80) || 'موظف'
    const data = await gw<{ ok: boolean; message?: unknown }>('support', {
      method: 'POST',
      body: { ...(body ? { body } : {}), senderName, ...(image ? { image } : {}) },
      timeoutMs: image ? 45_000 : 15_000,
    })
    return NextResponse.json({ ok: true, message: data?.message ?? null })
  } catch (e) {
    return mapGatewayError(e)
  }
}

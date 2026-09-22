import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

//  فحص حالة الإنترنت من السيرفر (جهاز الاستضافة) — مش من المتصفح، عشان:
//  1) الـ CSP بتمنع المتصفح من الاتصال بمواقع خارجية للفحص.
//  2) النت اللي بيهمّنا فعلاً هو نت جهاز السيرفر (الرخصة/الباك أب/الواتساب).
//  بنستخدم AbortController فمفيش تعليق لما النت يقطع.
const CHECK_URLS = [
  'https://www.gstatic.com/generate_204',
  'https://cloudflare.com/cdn-cgi/trace',
]
const TIMEOUT_MS = 4000

export async function GET() {
  for (const url of CHECK_URLS) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const start = Date.now()
    try {
      await fetch(url, { cache: 'no-store', signal: controller.signal, redirect: 'manual' })
      clearTimeout(timer)
      //  نجاح الطلب (أي رد) معناه فيه نت — بنرجّع زمن الاستجابة عشان نعرف السرعة
      return NextResponse.json({ online: true, latencyMs: Date.now() - start })
    } catch {
      clearTimeout(timer)
      //  نجرّب العنوان اللي بعده
    }
  }
  return NextResponse.json({ online: false, latencyMs: null })
}

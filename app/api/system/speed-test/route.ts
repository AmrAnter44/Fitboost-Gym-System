import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

//  قياس سرعة تحميل النت من السيرفر (جهاز الاستضافة) — بننزّل ملف بحجم معروف من
//  Cloudflare speed test ونحسب الـ Mbps. بيتعمل عند الطلب بس (لما المستخدم يدوس القياس)،
//  مش في الـ polling، عشان مياكلش داتا. AbortController فمفيش تعليق لو النت وقع.
const DOWNLOAD_BYTES = 3_000_000 //  ~3 ميجابايت
const SPEED_URL = `https://speed.cloudflare.com/__down?bytes=${DOWNLOAD_BYTES}`
const TIMEOUT_MS = 15000

export async function GET() {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const start = Date.now()
  try {
    const res = await fetch(SPEED_URL, { cache: 'no-store', signal: controller.signal })
    if (!res.ok || !res.body) {
      clearTimeout(timer)
      return NextResponse.json({ ok: false }, { status: 200 })
    }
    //  نقرا كل البايتات فعليًا عشان القياس يكون صح
    const buf = await res.arrayBuffer()
    const ms = Date.now() - start
    clearTimeout(timer)
    const bytes = buf.byteLength
    const seconds = ms / 1000
    const mbps = seconds > 0 ? (bytes * 8) / (seconds * 1_000_000) : 0
    return NextResponse.json({
      ok: true,
      mbps: Math.round(mbps * 10) / 10, //  رقم عشري واحد
      bytes,
      ms,
    })
  } catch {
    clearTimeout(timer)
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}

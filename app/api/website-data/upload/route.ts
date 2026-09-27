import { NextResponse } from 'next/server'
import { resolveLicensedBranch } from '../../../../lib/websiteData'
import { gw, gatewayErrorResponse } from '../../../../lib/gateway'

export const dynamic = 'force-dynamic'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

// رفع صورة (صورة الكوتش) على نفس الـ bucket اللي الويبسايت بيقرا منه
export async function POST(request: Request) {
  try {
    const ctx = await resolveLicensedBranch(request)
    if (ctx instanceof NextResponse) return ctx

    const form = await request.formData()
    const file = form.get('image') as File | null
    if (!file) return NextResponse.json({ error: 'لم يتم رفع صورة' }, { status: 400 })

    const ext = ALLOWED[(file.type || '').toLowerCase()]
    if (!ext) return NextResponse.json({ error: 'نوع الملف غير مدعوم. استخدم JPG أو PNG أو WebP' }, { status: 400 })
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'الحد الأقصى لحجم الصورة 5MB' }, { status: 400 })

    // رابط رفع موقّع من Control — الصورة بتترفع مباشرة على Storage من غير مفتاح
    const { path, signedUrl } = await gw<{ path: string; signedUrl: string }>('website-media', {
      body: { ext },
    })
    const buffer = Buffer.from(await file.arrayBuffer())
    const up = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type, 'cache-control': 'max-age=3600' },
      body: buffer,
    })
    if (!up.ok) {
      const msg = await up.text().catch(() => '')
      console.error('[website-data/upload] error:', up.status, msg)
      return NextResponse.json({ error: 'فشل رفع الصورة' }, { status: 502 })
    }

    return NextResponse.json({ path })
  } catch (error: any) {
    console.error('[website-data/upload] error:', error?.message)
    return gatewayErrorResponse(error)
  }
}

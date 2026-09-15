import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { supabaseAdmin } from '../../../../lib/supabase'
import { resolveLicensedBranch, WEBSITE_MEDIA_BUCKET } from '../../../../lib/websiteData'

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

    const path = `coaches/${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error } = await supabaseAdmin.storage
      .from(WEBSITE_MEDIA_BUCKET)
      .upload(path, buffer, { contentType: file.type, cacheControl: '3600', upsert: false })

    if (error) {
      console.error('[website-data/upload] error:', error)
      return NextResponse.json({ error: 'فشل رفع الصورة: ' + error.message }, { status: 502 })
    }

    return NextResponse.json({ path })
  } catch (error: any) {
    console.error('[website-data/upload] error:', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}

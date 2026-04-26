import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiCache } from '@/lib/cache'
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const MAX_IMAGE_BYTES = 2 * 1024 * 1024 // 2 MB ceiling على base64
const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/**
 * تحقق إن base64 يمثل صورة حقيقية بفحص الـ data URL prefix.
 * بدون الفحص ده، attacker يقدر يخزّن أي payload عشوائي في profileImage.
 */
function validateImageDataURL(input: string): { ok: boolean; reason?: string } {
  if (typeof input !== 'string') return { ok: false, reason: 'invalid type' }
  if (input.length === 0) return { ok: false, reason: 'empty' }
  if (input.length > MAX_IMAGE_BYTES * 2) return { ok: false, reason: 'too large' } // base64 ≈ 1.33× binary
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(input)
  if (!match) return { ok: false, reason: 'not a valid base64 data URL' }
  const mime = match[1].toLowerCase()
  if (!ALLOWED_IMAGE_MIMES.has(mime)) return { ok: false, reason: 'mime not allowed' }
  return { ok: true }
}

async function verifyMemberPhone(memberId: string, phoneNumber: unknown): Promise<boolean> {
  if (!phoneNumber || typeof phoneNumber !== 'string') return false
  const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10)
  if (cleanPhone.length < 7) return false
  const member = await prisma.member.findFirst({
    where: { id: memberId, phone: { contains: cleanPhone } },
    select: { id: true }
  })
  return !!member
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  // Rate limit: 5 requests/minute per IP (كان 10 — قلّلنا لتشديد الحماية)
  const rl = checkRateLimit(getClientIdentifier(request), {
    id: 'profile-image',
    limit: 5,
    windowMs: 60_000,
  })
  if (!rl.success) {
    return NextResponse.json(
      { error: rl.error || 'طلبات كثيرة جداً، حاول بعد قليل' },
      { status: 429 }
    )
  }

  try {
    const { memberId } = await params
    const body = await request.json()
    const { imageBase64, phoneNumber } = body

    // 🔒 لازم يثبت معرفته برقم هاتف العضو
    const verified = await verifyMemberPhone(memberId, phoneNumber)
    if (!verified) {
      return NextResponse.json(
        { error: 'يجب إدخال رقم هاتفك لتأكيد التعديل' },
        { status: 401 }
      )
    }

    // null = حذف الصورة
    if (imageBase64 !== null) {
      const v = validateImageDataURL(imageBase64)
      if (!v.ok) {
        return NextResponse.json(
          { error: 'صورة غير صالحة' },
          { status: 400 }
        )
      }
    }

    // Verify member exists
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true },
    })

    if (!member) {
      return NextResponse.json(
        { error: 'العضو غير موجود' },
        { status: 404 }
      )
    }

    await prisma.member.update({
      where: { id: memberId },
      data: { profileImage: imageBase64 },
    })

    apiCache.delete(`profile:${memberId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update profile image error:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    )
  }
}

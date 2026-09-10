// app/api/whatsapp/my-session/route.ts
//  رقم الواتساب الافتراضي للأكونت — كل مستخدم يختار رقمه ويتحفظ في الداتابيز (User.whatsappSessionIndex)
//  GET: يرجّع رقم المستخدم المحفوظ + الأرقام المتاحة. POST: يحفظ الرقم الافتراضي.
import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'
import { WHATSAPP_SIDECAR } from '@/lib/servicePorts'

export const dynamic = 'force-dynamic'

async function getSessions(): Promise<{ sessionIndex: number; phoneNumber?: string; isReady: boolean; label?: string }[]> {
  try {
    const res = await fetch(`${WHATSAPP_SIDECAR}/status/all`, { cache: 'no-store' })
    const sessions = await res.json()
    return Array.isArray(sessions) ? sessions : []
  } catch {
    return []
  }
}

//  يقرأ رقم المستخدم المحفوظ (raw SQL — آمن حتى لو الـ Prisma client لسه outdated)
async function readMySession(userId: string): Promise<number | null> {
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT whatsappSessionIndex AS v FROM User WHERE id = ? LIMIT 1`, userId
    )
    const v = rows?.[0]?.v
    return v === null || v === undefined ? null : Number(v)
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    const [mySessionIndex, sessions] = await Promise.all([readMySession(user.userId), getSessions()])
    return NextResponse.json({ mySessionIndex, sessions })
  } catch {
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    const body = await request.json()
    //  null / undefined = رجوع للتلقائي (أول رقم متصل)
    let sessionIndex: number | null = null
    if (body.sessionIndex !== null && body.sessionIndex !== undefined && body.sessionIndex !== '') {
      const n = parseInt(String(body.sessionIndex))
      if (!Number.isNaN(n) && n >= 0) sessionIndex = n
    }
    //  raw SQL update — آمن مع أي حالة للـ Prisma client
    await prisma.$executeRawUnsafe(
      `UPDATE User SET whatsappSessionIndex = ? WHERE id = ?`, sessionIndex, user.userId
    )
    return NextResponse.json({ success: true, mySessionIndex: sessionIndex })
  } catch (e) {
    console.error('my-session POST error:', e)
    return NextResponse.json({ error: 'فشل حفظ الرقم الافتراضي' }, { status: 500 })
  }
}

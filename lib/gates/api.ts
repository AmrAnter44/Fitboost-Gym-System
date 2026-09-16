// lib/gates/api.ts
//  مساعدات مشتركة لمسارات البوابات: المصادقة وتحويل الأخطاء لردود مفهومة.

import { NextResponse } from 'next/server'
import { verifyAuth } from '../auth'
import { HikvisionError } from '../hikvision/client'

/** الأونر بس — إعدادات الأجهزة (إضافة/تعديل/حذف/مزامنة). */
export async function requireOwner(request: Request) {
  const user = await verifyAuth(request)
  if (!user) throw new Error('Unauthorized')
  if (user.role !== 'OWNER') throw new Error('Forbidden')
  return user
}

/** أي مستخدم مسجّل دخول — فتح الباب متاح للريسبشن كمان. */
export async function requireUser(request: Request) {
  const user = await verifyAuth(request)
  if (!user) throw new Error('Unauthorized')
  return user
}

/**
 * تحويل الخطأ لرد HTTP.
 *
 * أخطاء الجهاز بتترجم لرسالة عربية فيها **الحل** مش السبب بس — الموظف في
 * الريسبشن مش هيفيده يقرا ECONNREFUSED.
 */
export function gateErrorResponse(e: unknown): NextResponse {
  const msg = e instanceof Error ? e.message : String(e)

  if (msg === 'Unauthorized') {
    return NextResponse.json({ success: false, error: 'مش مسجّل دخول' }, { status: 401 })
  }
  if (msg.startsWith('Forbidden')) {
    return NextResponse.json({ success: false, error: 'مالكش صلاحية للعملية دي' }, { status: 403 })
  }

  if (e instanceof HikvisionError) {
    const help: Record<string, string> = {
      auth: 'اسم المستخدم أو كلمة السر بتاعت الجهاز غلط — راجعهم من الإعدادات.',
      offline: 'مقدرتش أوصل للجهاز. اتأكد إنه متوصّل بالشبكة وإن الـ IP صح.',
      timeout: 'الجهاز أخد وقت طويل من غير رد. اتأكد إنه شغّال وعلى نفس الشبكة.',
      device: 'الجهاز رفض العملية.',
      unknown: 'حصل خطأ مع الجهاز.',
    }
    return NextResponse.json(
      { success: false, error: help[e.code] ?? help.unknown, detail: e.message, code: e.code },
      { status: e.code === 'auth' ? 502 : 502 }
    )
  }

  console.error('[gates]', msg)
  return NextResponse.json({ success: false, error: msg || 'حصل خطأ' }, { status: 500 })
}

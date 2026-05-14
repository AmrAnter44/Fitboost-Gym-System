// app/api/admin/apply-package-features/route.ts
// 📦 تطبيق مميزات الباقة (حصص + فريز + دعوات + InBody) على الأعضاء بناءً على offerId المخزّن
// متاح للـ OWNER فقط — يُستخدم بعد استيراد أعضاء يدوياً من شيت Excel.
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'
import { logError } from '../../../../lib/errorLogger'

export const dynamic = 'force-dynamic'

type Mode = 'fresh' | 'force'

export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (user.role !== 'OWNER') {
      return NextResponse.json({ error: 'هذه الميزة متاحة للأونر فقط' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const mode: Mode = body.mode === 'force' ? 'force' : 'fresh'
    const memberId: string | undefined = body.memberId

    // جلب الأعضاء اللي عندهم offerId
    const members = await prisma.member.findMany({
      where: {
        offerId: { not: null },
        ...(memberId ? { id: memberId } : {}),
      },
      select: {
        id: true,
        memberNumber: true,
        name: true,
        offerId: true,
        freePTSessions: true,
        freeNutritionSessions: true,
        freePhysioSessions: true,
        freeGroupClassSessions: true,
        freeMoreSessions: true,
        freePoolSessions: true,
        freePadelSessions: true,
        freeAssessmentSessions: true,
        inBodyScans: true,
        invitations: true,
        remainingFreezeDays: true,
      },
    })

    if (members.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        updated: 0,
        skipped: 0,
        missingOffer: 0,
        results: [],
        message: 'مفيش أعضاء عليهم باقة محفوظة',
      })
    }

    // جلب الباقات اللي محتاجينها مرة واحدة
    const offerIds = Array.from(new Set(members.map(m => m.offerId).filter((v): v is string => !!v)))
    const offers = await prisma.offer.findMany({
      where: { id: { in: offerIds } },
    })
    const offerMap = new Map(offers.map(o => [o.id, o]))

    let updated = 0
    let skipped = 0
    let missingOffer = 0
    const results: Array<{ memberId: string; memberNumber: string | null; name: string; status: 'updated' | 'skipped' | 'missing-offer'; reason?: string }> = []

    for (const m of members) {
      if (!m.offerId) continue
      const offer = offerMap.get(m.offerId)
      if (!offer) {
        missingOffer++
        results.push({ memberId: m.id, memberNumber: m.memberNumber, name: m.name, status: 'missing-offer', reason: 'الباقة المحفوظة على العضو محذوفة من النظام' })
        continue
      }

      // 🔢 تحضير الحقول حسب الـ mode
      // fresh: استبدل بس لو القيمة الحالية = 0 (يعني الباقة لسه ما اتطبقتش)
      // force: استبدل بأي حال (الأونر مسؤول)
      const pickValue = (current: number, fromOffer: number) => {
        if (mode === 'force') return fromOffer
        return current === 0 ? fromOffer : current
      }

      const newData = {
        freePTSessions: pickValue(m.freePTSessions, offer.freePTSessions),
        freeNutritionSessions: pickValue(m.freeNutritionSessions, offer.freeNutritionSessions),
        freePhysioSessions: pickValue(m.freePhysioSessions, offer.freePhysioSessions),
        freeGroupClassSessions: pickValue(m.freeGroupClassSessions, offer.freeGroupClassSessions),
        freeMoreSessions: pickValue(m.freeMoreSessions, offer.freeMoreSessions),
        freePoolSessions: pickValue(m.freePoolSessions, offer.freePoolSessions),
        freePadelSessions: pickValue(m.freePadelSessions, offer.freePadelSessions),
        freeAssessmentSessions: pickValue(m.freeAssessmentSessions, offer.freeAssessmentSessions),
        inBodyScans: pickValue(m.inBodyScans, offer.inBodyScans),
        invitations: pickValue(m.invitations, offer.invitations),
        remainingFreezeDays: pickValue(m.remainingFreezeDays, offer.freezeDays),
      }

      const hasChange =
        newData.freePTSessions !== m.freePTSessions ||
        newData.freeNutritionSessions !== m.freeNutritionSessions ||
        newData.freePhysioSessions !== m.freePhysioSessions ||
        newData.freeGroupClassSessions !== m.freeGroupClassSessions ||
        newData.freeMoreSessions !== m.freeMoreSessions ||
        newData.freePoolSessions !== m.freePoolSessions ||
        newData.freePadelSessions !== m.freePadelSessions ||
        newData.freeAssessmentSessions !== m.freeAssessmentSessions ||
        newData.inBodyScans !== m.inBodyScans ||
        newData.invitations !== m.invitations ||
        newData.remainingFreezeDays !== m.remainingFreezeDays

      if (!hasChange) {
        skipped++
        results.push({ memberId: m.id, memberNumber: m.memberNumber, name: m.name, status: 'skipped', reason: mode === 'fresh' ? 'فيه قيم متطبقة بالفعل' : 'القيم متطابقة' })
        continue
      }

      await prisma.member.update({
        where: { id: m.id },
        data: newData,
      })
      updated++
      results.push({ memberId: m.id, memberNumber: m.memberNumber, name: m.name, status: 'updated' })
    }

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'Member',
      details: {
        operation: 'apply-package-features',
        mode,
        memberIdFilter: memberId || null,
        processed: members.length,
        updated,
        skipped,
        missingOffer,
      },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json({
      success: true,
      processed: members.length,
      updated,
      skipped,
      missingOffer,
      results,
    })
  } catch (error: any) {
    console.error('❌ خطأ في تطبيق مميزات الباقات:', error)
    logError({ error, endpoint: '/api/admin/apply-package-features', method: 'POST', statusCode: 500 })
    return NextResponse.json({ error: 'فشل تطبيق مميزات الباقات' }, { status: 500 })
  }
}

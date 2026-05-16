// app/api/admin/apply-package-features/route.ts
// 📦 تطبيق مميزات الباقة (حصص + فريز + دعوات + InBody) على الأعضاء
// المطابقة بتعتمد على مدة الاشتراك (expiryDate - startDate) ± 3 أيام، مش على offerId المخزّن
// متاح للـ OWNER فقط — يُستخدم بعد استيراد أعضاء يدوياً من شيت Excel.
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'
import { logError } from '../../../../lib/errorLogger'

export const dynamic = 'force-dynamic'

type Mode = 'fresh' | 'force'
const DURATION_TOLERANCE = 3
const CHUNK_SIZE = 500
const MS_PER_DAY = 1000 * 60 * 60 * 24

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

    // جلب الأعضاء اللي عندهم تواريخ اشتراك صالحة (هي اللي بنحسب منها المدة)
    const members = await prisma.member.findMany({
      where: {
        startDate: { not: null },
        expiryDate: { not: null },
        ...(memberId ? { id: memberId } : {}),
      },
      select: {
        id: true,
        memberNumber: true,
        name: true,
        offerId: true,
        startDate: true,
        expiryDate: true,
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
        noDurationMatch: 0,
        results: [],
        message: 'مفيش أعضاء عندهم تواريخ اشتراك',
      })
    }

    // جلب كل الباقات النشطة عشان نطابقها بالمدة
    const offers = await prisma.offer.findMany({ where: { isActive: true } })

    const matchOfferByDuration = (memberDays: number) => {
      let best: typeof offers[number] | null = null
      let bestDiff = Infinity
      for (const o of offers) {
        const diff = Math.abs(o.duration - memberDays)
        if (diff <= DURATION_TOLERANCE && diff < bestDiff) {
          best = o
          bestDiff = diff
        }
      }
      return best
    }

    // fresh: استبدل بس لو القيمة الحالية = 0 (يعني الباقة لسه ما اتطبقتش)
    // force: استبدل بأي حال (الأونر مسؤول)
    const pickValue = (current: number, fromOffer: number) => {
      if (mode === 'force') return fromOffer
      return current === 0 ? fromOffer : current
    }

    let updated = 0
    let skipped = 0
    let noDurationMatch = 0
    const results: Array<{
      memberId: string
      memberNumber: string | null
      name: string
      status: 'updated' | 'skipped' | 'no-duration-match'
      reason?: string
    }> = []
    const updateOps: Prisma.PrismaPromise<any>[] = []

    for (const m of members) {
      if (!m.startDate || !m.expiryDate) continue
      const memberDays = Math.ceil(
        (new Date(m.expiryDate).getTime() - new Date(m.startDate).getTime()) / MS_PER_DAY
      )
      const offer = matchOfferByDuration(memberDays)
      if (!offer) {
        noDurationMatch++
        results.push({
          memberId: m.id,
          memberNumber: m.memberNumber,
          name: m.name,
          status: 'no-duration-match',
          reason: `مفيش باقة بنفس المدة (${memberDays} يوم ± ${DURATION_TOLERANCE})`,
        })
        continue
      }

      const newData: Prisma.MemberUpdateInput = {
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

      const featuresChanged =
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

      const offerIdChanged = m.offerId !== offer.id
      if (offerIdChanged) {
        newData.offerId = offer.id
      }

      if (!featuresChanged && !offerIdChanged) {
        skipped++
        results.push({
          memberId: m.id,
          memberNumber: m.memberNumber,
          name: m.name,
          status: 'skipped',
          reason: mode === 'fresh' ? 'فيه قيم متطبقة بالفعل' : 'القيم متطابقة',
        })
        continue
      }

      updateOps.push(prisma.member.update({ where: { id: m.id }, data: newData }))
      updated++
      results.push({ memberId: m.id, memberNumber: m.memberNumber, name: m.name, status: 'updated' })
    }

    // تنفيذ الـ updates في transactions على شكل chunks (أسرع بكتير من writes منفصلة على SQLite)
    for (let i = 0; i < updateOps.length; i += CHUNK_SIZE) {
      await prisma.$transaction(updateOps.slice(i, i + CHUNK_SIZE))
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
        noDurationMatch,
      },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json({
      success: true,
      processed: members.length,
      updated,
      skipped,
      noDurationMatch,
      results,
    })
  } catch (error: any) {
    console.error('❌ خطأ في تطبيق مميزات الباقات:', error)
    logError({ error, endpoint: '/api/admin/apply-package-features', method: 'POST', statusCode: 500 })
    return NextResponse.json({ error: 'فشل تطبيق مميزات الباقات' }, { status: 500 })
  }
}

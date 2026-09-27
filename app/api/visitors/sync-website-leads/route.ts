import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'
import { gw } from '../../../../lib/gateway'

export const dynamic = 'force-dynamic'

// Pulls website leads from Supabase that haven't been imported into this gym's
// local DB yet, and creates Visitor records (with source = "website") + an
// initial FollowUp so they show up in the followups pipeline.
//
// Triggered automatically by the followups page on load, and can be called
// manually too.
export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    }

    // 1. Resolve this gym's id from the saved license
    const license = await prisma.supabaseLicense.findFirst({
      orderBy: { lastChecked: 'desc' }
    })
    if (!license?.gymId) {
      return NextResponse.json({
        imported: 0,
        found: 0,
        message: 'لم يتم اختيار جيم في الرخصة'
      })
    }

    // 2. Fetch leads for this gym (last 30 days, capped) — via Control, scoped to this
    //    device's gym/branch. Multi-branch rule: this branch sees its own leads + gym-wide
    //    leads (branch_id NULL — the visitor didn't pick a branch).
    let leads: { id: string; name: string | null; phone: string | null; interested_in: string | null; branch_id: string | null; created_at: string }[] = []
    let totalForGym = 0
    try {
      const res = await gw<{ leads: typeof leads; totalForGym: number }>('website-leads', { timeoutMs: 15000 })
      leads = res.leads || []
      totalForGym = res.totalForGym || 0
    } catch (error: any) {
      console.error('[sync-website-leads] gateway error:', error?.message)
      return NextResponse.json(
        { error: 'تعذر الاتصال بسحابة فيت بوست: ' + (error?.message || ''), gymId: license.gymId },
        { status: 502 }
      )
    }

    const found = leads?.length || 0

    const totalAcrossGyms = 0 // مبقاش متاح للأجهزة (بيانات جيمات تانية)

    if (!leads || leads.length === 0) {
      let message = 'مفيش leads جديدة على Supabase'
      if (totalForGym > 0 && license.branchId) {
        message = `جيمك عنده ${totalForGym} lead بس كلهم مخصصين لفرع تاني (مش فرعك)`
      } else if (totalAcrossGyms > 0 && totalForGym === 0) {
        message = `فيه ${totalAcrossGyms} lead على Supabase بس مش مربوطة بجيمك (gymId مش متطابق)`
      }
      return NextResponse.json({
        imported: 0,
        found: 0,
        totalAcrossGyms,
        totalForGym,
        gymId: license.gymId,
        branchId: license.branchId,
        gymName: license.gymName,
        branchName: license.branchName,
        message
      })
    }

    // 3. Skip leads already imported
    const existingImports = await prisma.websiteLeadImport.findMany({
      where: { remoteId: { in: leads.map(l => l.id) } },
      select: { remoteId: true }
    })
    const importedSet = new Set(existingImports.map(i => i.remoteId))
    const newLeads = leads.filter(l => !importedSet.has(l.id))

    if (newLeads.length === 0) {
      return NextResponse.json({
        imported: 0,
        found,
        alreadyImported: existingImports.length,
        gymId: license.gymId,
        message: 'كل الـ leads متجابة قبل كده'
      })
    }

    // 4. For each new lead: upsert visitor by phone, then mark as imported.
    let importedCount = 0
    let skippedExistingVisitor = 0
    const errors: string[] = []

    for (const lead of newLeads) {
      try {
        const phone = (lead.phone || '').trim()
        if (!phone) continue

        // ✅ كل lead في transaction واحد عشان visitor + followup + import marker
        //    يتسجلوا مع بعض. لو الـ followup فشل، الزائر يترجع والـ marker ما يتسجلش
        //    عشان السينك الجاي يحاول تاني (بدل ما الـ lead يضيع silently).
        // ✅ بنستخدم upsert على الزائر عشان نتجنب race condition (طلبين سينك متوازيين).
        // ✅ بنتأكد إن مفيش followup نشط قبل ما نخلق واحد جديد، عشان ما نكررش.
        await prisma.$transaction(async (tx) => {
          const before = await tx.visitor.findUnique({ where: { phone }, select: { id: true } })

          const visitor = await tx.visitor.upsert({
            where: { phone },
            update: {},
            create: {
              name: (lead.name || '').trim() || 'زائر من الموقع',
              phone,
              source: 'website',
              interestedIn: (lead.interested_in || null),
              status: 'pending',
              notes: lead.interested_in ? `مهتم بـ: ${lead.interested_in}` : null
            }
          })

          if (before) {
            skippedExistingVisitor++
          }

          const activeFollowUp = await tx.followUp.findFirst({
            where: { visitorId: visitor.id, archived: false },
            select: { id: true }
          })

          if (!activeFollowUp) {
            await tx.followUp.create({
              data: {
                visitorId: visitor.id,
                notes: [
                  'وصل من الموقع الإلكتروني',
                  lead.interested_in ? `مهتم بـ: ${lead.interested_in}` : null,
                  `وصل في: ${new Date(lead.created_at).toLocaleString('ar-EG')}`
                ].filter(Boolean).join('\n'),
                stage: 'new'
              }
            })
          }

          await tx.websiteLeadImport.create({
            data: { remoteId: lead.id, visitorId: visitor.id }
          })
        })

        importedCount++
      } catch (perLeadErr: any) {
        const msg = perLeadErr?.message || String(perLeadErr)
        console.error('[sync-website-leads] lead import error:', lead.id, msg)
        errors.push(`${lead.id}: ${msg}`)
      }
    }

    return NextResponse.json({
      imported: importedCount,
      found,
      alreadyImported: existingImports.length,
      skippedExistingVisitor,
      gymId: license.gymId,
      gymName: license.gymName,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    }
    console.error('[sync-website-leads] fatal:', error)
    return NextResponse.json(
      { error: 'خطأ في الخادم: ' + (error?.message || 'unknown') },
      { status: 500 }
    )
  }
}

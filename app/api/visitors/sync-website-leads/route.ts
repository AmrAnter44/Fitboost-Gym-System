import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'
import { supabaseAdmin } from '../../../../lib/supabase'

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

    // 2. Fetch leads for this gym (last 30 days, capped) — server bypasses RLS.
    //    Multi-branch rule: this branch sees its own leads + gym-wide leads
    //    (where branch_id is NULL — meaning the visitor didn't pick a branch).
    const since = new Date()
    since.setDate(since.getDate() - 30)
    let query = supabaseAdmin
      .from('website_leads')
      .select('id, name, phone, interested_in, branch_id, created_at')
      .eq('gym_id', license.gymId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(200)

    if (license.branchId) {
      query = query.or(`branch_id.is.null,branch_id.eq.${license.branchId}`)
    }
    const { data: leads, error } = await query

    if (error) {
      console.error('[sync-website-leads] Supabase fetch error:', error)
      return NextResponse.json(
        { error: 'تعذر الاتصال بـ Supabase: ' + error.message, gymId: license.gymId },
        { status: 502 }
      )
    }

    const found = leads?.length || 0

    // Diagnostic: count total leads in Supabase regardless of gym_id/branch_id.
    // Helps detect "lead exists but went to a different branch" cases.
    let totalAcrossGyms = 0
    let totalForGym = 0
    try {
      const r1 = await supabaseAdmin
        .from('website_leads')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since.toISOString())
      totalAcrossGyms = r1.count || 0
      const r2 = await supabaseAdmin
        .from('website_leads')
        .select('id', { count: 'exact', head: true })
        .eq('gym_id', license.gymId)
        .gte('created_at', since.toISOString())
      totalForGym = r2.count || 0
    } catch {
      // diagnostic only — never fail the sync because of it
    }

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

        let visitor = await prisma.visitor.findUnique({ where: { phone } })

        if (!visitor) {
          visitor = await prisma.visitor.create({
            data: {
              name: (lead.name || '').trim() || 'زائر من الموقع',
              phone,
              source: 'website',
              interestedIn: (lead.interested_in || null),
              status: 'pending',
              notes: lead.interested_in ? `مهتم بـ: ${lead.interested_in}` : null
            }
          })
        } else {
          skippedExistingVisitor++
        }

        await prisma.followUp.create({
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

        await prisma.websiteLeadImport.create({
          data: { remoteId: lead.id, visitorId: visitor.id }
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

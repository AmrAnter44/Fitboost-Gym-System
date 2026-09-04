import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

//  تطبيع رقم الموبايل — نشيل المسافات والشرطات ونسيب الأرقام و + بس
function normalizePhone(v: any): string {
  return String(v ?? '').replace(/[\s\-()]/g, '').trim()
}

//  قراءة الشيت (Excel أو CSV) → صفوف [عمود1, عمود2]
async function parseSheet(file: File): Promise<string[][]> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const fname = (file.name || '').toLowerCase()

  if (fname.endsWith('.csv')) {
    const { parse } = await import('csv-parse/sync')
    const text = buffer.toString('utf-8')
    const records = parse(text, { skip_empty_lines: true, relax_column_count: true, bom: true, trim: true }) as string[][]
    return records.map(r => [String(r?.[0] ?? '').trim(), String(r?.[1] ?? '').trim()])
  }

  //  Excel (.xlsx)
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer as any)
  const ws = wb.worksheets[0]
  if (!ws) return []
  const rows: string[][] = []
  const cellText = (cell: any): string => {
    const v = cell?.value
    if (v == null) return ''
    if (typeof v === 'object') {
      if ('text' in v) return String((v as any).text).trim()
      if ('result' in v) return String((v as any).result).trim()
      if ('richText' in v) return (v as any).richText.map((t: any) => t.text).join('').trim()
      return ''
    }
    return String(v).trim()
  }
  ws.eachRow((row: any) => {
    rows.push([cellText(row.getCell(1)), cellText(row.getCell(2))])
  })
  return rows
}

//  استخراج {الاسم, الرقم} + تخطّي صف العنوان لو موجود
function extractItems(rows: string[][]): { name: string; phone: string }[] {
  const items: { name: string; phone: string }[] = []
  rows.forEach((r, idx) => {
    const name = (r[0] || '').trim()
    const phone = normalizePhone(r[1])
    //  صف العنوان: أول صف لو العمود التاني مفيهوش أرقام (اسم عمود زي "الرقم")
    if (idx === 0 && phone && !/\d/.test(phone)) return
    items.push({ name, phone })
  })
  return items
}

//  إدخال على دفعات — SQLite عنده حد أقصى لعدد المتغيرات في الاستعلام الواحد،
//  فالشيتات الكبيرة (1000+) لازم تتقسّم عشان متتقصّش.
async function insertInChunks<T>(
  rows: T[],
  insertFn: (batch: T[]) => Promise<{ count: number }>,
  chunkSize = 100
): Promise<number> {
  let total = 0
  for (let i = 0; i < rows.length; i += chunkSize) {
    const batch = rows.slice(i, i + chunkSize)
    const res = await insertFn(batch)
    total += res.count
  }
  return total
}

export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    //  للأونر بس
    if (user.role !== 'OWNER') {
      return NextResponse.json({ error: 'هذه العملية للمالك فقط' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const mode = String(formData.get('mode') || 'validate')
    const destination = String(formData.get('destination') || '')

    if (!file) {
      return NextResponse.json({ error: 'لم يتم رفع أي ملف' }, { status: 400 })
    }
    const fname = (file.name || '').toLowerCase()
    if (!fname.endsWith('.csv') && !fname.endsWith('.xlsx')) {
      return NextResponse.json({ error: 'الملف لازم يكون Excel (.xlsx) أو CSV (.csv)' }, { status: 400 })
    }

    let rows: string[][]
    try {
      rows = await parseSheet(file)
    } catch (e) {
      return NextResponse.json({ error: 'فشلت قراءة الملف — تأكد إنه شيت صالح' }, { status: 400 })
    }

    const items = extractItems(rows)
    const validItems = items.filter(i => i.name && i.phone && /\d/.test(i.phone))
    const invalidCount = items.length - validItems.length

    //  ✅ وضع التحقق — نرجّع ملخص بس
    if (mode === 'validate') {
      return NextResponse.json({
        ok: validItems.length > 0,
        total: items.length,
        valid: validItems.length,
        invalid: invalidCount,
        preview: validItems.slice(0, 5),
        message: validItems.length > 0
          ? `الشيت صالح — ${validItems.length} صف جاهز للاستيراد${invalidCount > 0 ? ` (${invalidCount} صف ناقص هيتخطّى)` : ''}`
          : 'الشيت مفيهوش صفوف صالحة (محتاج عمود أسماء وعمود أرقام)',
      })
    }

    //  🚀 وضع الاستيراد
    if (validItems.length === 0) {
      return NextResponse.json({ error: 'مفيش صفوف صالحة للاستيراد' }, { status: 400 })
    }

    if (destination === 'visitors') {
      //  منع تكرار الأرقام (مع أرقام الأعضاء + الزوار الحاليين)
      const phones = Array.from(new Set(validItems.map(i => i.phone)))
      const [existingVisitors, existingMembers] = await Promise.all([
        prisma.visitor.findMany({ where: { phone: { in: phones } }, select: { phone: true } }),
        prisma.member.findMany({ where: { phone: { in: phones } }, select: { phone: true } }),
      ])
      const taken = new Set([...existingVisitors.map(v => v.phone), ...existingMembers.map(m => m.phone)])
      const seen = new Set<string>()
      const toInsert = validItems.filter(i => {
        if (taken.has(i.phone) || seen.has(i.phone)) return false
        seen.add(i.phone)
        return true
      })
      let inserted = 0
      if (toInsert.length) {
        inserted = await insertInChunks(
          toInsert.map(i => ({ name: i.name, phone: i.phone, source: 'import' })),
          batch => prisma.visitor.createMany({ data: batch })
        )
      }
      return NextResponse.json({ success: true, destination, inserted, skipped: validItems.length - inserted })
    }

    if (destination === 'dayuse') {
      const serviceType = String(formData.get('serviceType') || '').trim() || 'يوم استخدام'
      const price = parseFloat(String(formData.get('price') || '0')) || 0
      const staffName = (user.name || 'استيراد').trim()
      const inserted = await insertInChunks(
        validItems.map(i => ({ name: i.name, phone: i.phone, serviceType, price, staffName })),
        batch => prisma.dayUseInBody.createMany({ data: batch })
      )
      return NextResponse.json({ success: true, destination, inserted, skipped: validItems.length - inserted })
    }

    if (destination === 'invitations') {
      //  عضو وهمي "فيت بوست" تتنسب له الدعوات (بدون خصم رصيد)
      let dummy = await prisma.member.findFirst({ where: { name: 'فيت بوست' }, select: { id: true } })
      if (!dummy) {
        dummy = await prisma.member.create({
          data: { name: 'فيت بوست', phone: '00000000000', subscriptionPrice: 0, isActive: false },
          select: { id: true },
        })
      }
      const inserted = await insertInChunks(
        validItems.map(i => ({ guestName: i.name, guestPhone: i.phone, memberId: dummy!.id })),
        batch => prisma.invitation.createMany({ data: batch })
      )
      return NextResponse.json({ success: true, destination, inserted, skipped: validItems.length - inserted })
    }

    return NextResponse.json({ error: 'وجهة غير معروفة' }, { status: 400 })
  } catch (error: any) {
    console.error('Import sheet error:', error)
    return NextResponse.json({ error: 'فشل استيراد الشيت' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'


export async function GET() {
  try {
    // الحصول على آخر رقم إيصال من العداد
    let counter = await prisma.receiptCounter.findFirst()

    if (!counter) {
      // إنشاء عداد جديد إذا لم يكن موجوداً
      counter = await prisma.receiptCounter.create({
        data: { current: 1000 }
      })
    }

    // الرقم التالي هو current + 1
    const nextNumber = counter.current + 1

    return NextResponse.json({ nextNumber })
  } catch (error) {
    console.error('Error fetching next receipt number:', error)
    return NextResponse.json({ nextNumber: 1001 })
  }
}

export async function POST(req: Request) {
  try {
    const { startNumber } = await req.json()

    if (!startNumber || startNumber < 1) {
      return NextResponse.json({ error: 'رقم غير صالح' }, { status: 400 })
    }

    // الحصول على العداد الحالي أو إنشاء واحد جديد
    let counter = await prisma.receiptCounter.findFirst()

    if (!counter) {
      // إنشاء عداد جديد بالقيمة المحددة - 1 (لأن الرقم التالي سيكون startNumber)
      counter = await prisma.receiptCounter.create({
        data: { current: startNumber - 1 }
      })
    } else {
      // تحديث العداد الحالي
      counter = await prisma.receiptCounter.update({
        where: { id: counter.id },
        data: { current: startNumber - 1 }
      })
    }

    return NextResponse.json({
      message: `تم تحديث رقم الإيصال التالي إلى ${startNumber}`,
      nextNumber: startNumber
    })
  } catch (error) {
    console.error('Error updating receipt number:', error)
    return NextResponse.json({ error: 'فشل تحديث رقم الإيصال' }, { status: 500 })
  }
}

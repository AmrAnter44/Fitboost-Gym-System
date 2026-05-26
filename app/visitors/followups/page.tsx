
// import { NextResponse } from 'next/server'
// import { prisma } from '../../../lib/prisma'

// // GET - جلب متابعات زائر معين
// export async function GET(request: Request) {
//   try {
//     const { searchParams } = new URL(request.url)
//     const visitorId = searchParams.get('visitorId')

//     if (!visitorId) {
//       return NextResponse.json(
//         { error: 'معرف الزائر مطلوب' },
//         { status: 400 }
//       )
//     }

//     const followUps = await prisma.followUp.findMany({
//       where: { visitorId },
//       orderBy: { createdAt: 'desc' },
//       include: {
//         visitor: {
//           select: {
//             name: true,
//             phone: true,
//           },
//         },
//       },
//     })

//     return NextResponse.json(followUps)
//   } catch (error) {
//     console.error('GET FollowUp Error:', error)
//     return NextResponse.json({ error: 'فشل جلب المتابعات' }, { status: 500 })
//   }
// }

// // POST - إضافة متابعة جديدة
// export async function POST(request: Request) {
//   try {
//     const body = await request.json()
//     const { visitorId, notes, contacted, nextFollowUpDate, result, salesName } = body

//     if (!visitorId || !notes) {
//       return NextResponse.json(
//         { error: 'معرف الزائر والملاحظات مطلوبان' },
//         { status: 400 }
//       )
//     }

//     // التحقق من وجود الزائر
//     const visitor = await prisma.visitor.findUnique({
//       where: { id: visitorId },
//     })

//     if (!visitor) {
//       return NextResponse.json({ error: 'الزائر غير موجود' }, { status: 404 })
//     }

//     // إنشاء المتابعة
//     const followUp = await prisma.followUp.create({
//       data: {
//         visitorId,
//         notes: notes.trim(),
//         contacted: contacted || false,
//         nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null,
//         result: result?.trim(),
//         salesName: salesName?.trim(), // 🆕 إضافة اسم البائع
//       },
//     })

//     // تحديث حالة الزائر إذا لزم الأمر
//     if (result === 'subscribed') {
//       await prisma.visitor.update({
//         where: { id: visitorId },
//         data: { status: 'subscribed' },
//       })
//     } else if (result === 'not-interested') {
//       await prisma.visitor.update({
//         where: { id: visitorId },
//         data: { status: 'rejected' },
//       })
//     } else if (contacted) {
//       await prisma.visitor.update({
//         where: { id: visitorId },
//         data: { status: 'contacted' },
//       })
//     }

//     return NextResponse.json(followUp, { status: 201 })
//   } catch (error) {
//     console.error('POST FollowUp Error:', error)
//     return NextResponse.json({ error: 'فشل إضافة المتابعة' }, { status: 500 })
//   }
// }

// // PUT - تحديث متابعة
// export async function PUT(request: Request) {
//   try {
//     const body = await request.json()
//     const { id, notes, contacted, nextFollowUpDate, result, salesName } = body

//     if (!id) {
//       return NextResponse.json(
//         { error: 'معرف المتابعة مطلوب' },
//         { status: 400 }
//       )
//     }

//     const updateData: any = {}
//     if (notes !== undefined) updateData.notes = notes.trim()
//     if (contacted !== undefined) updateData.contacted = contacted
//     if (nextFollowUpDate !== undefined) {
//       updateData.nextFollowUpDate = nextFollowUpDate ? new Date(nextFollowUpDate) : null
//     }
//     if (result !== undefined) updateData.result = result?.trim()
//     if (salesName !== undefined) updateData.salesName = salesName?.trim() // 🆕

//     const followUp = await prisma.followUp.update({
//       where: { id },
//       data: updateData,
//     })

//     return NextResponse.json(followUp)
//   } catch (error) {
//     console.error('PUT FollowUp Error:', error)
//     return NextResponse.json({ error: 'فشل التحديث' }, { status: 500 })
//   }
// }

// // DELETE - حذف متابعة
// export async function DELETE(request: Request) {
//   try {
//     const { searchParams } = new URL(request.url)
//     const id = searchParams.get('id')

//     if (!id) {
//       return NextResponse.json(
//         { error: 'معرف المتابعة مطلوب' },
//         { status: 400 }
//       )
//     }

//     await prisma.followUp.delete({ where: { id } })

//     return NextResponse.json({ message: 'تم الحذف بنجاح' })
//   } catch (error) {
//     console.error('DELETE FollowUp Error:', error)
//     return NextResponse.json({ error: 'فشل الحذف' }, { status: 500 })
//   }
// }

'use client'

export default function FollowUpsPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">إدارة المتابعات</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">هذه الصفحة تعرض المتابعات الخاصة بالزوار.</p>
      </div>
    </div>
  )
}

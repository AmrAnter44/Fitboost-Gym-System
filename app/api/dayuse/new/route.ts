import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { requireValidLicense } from "../../../../lib/license";
import { processPaymentWithPoints } from "../../../../lib/paymentProcessor";

export const dynamic = 'force-dynamic'


export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { name, phone, serviceType, price, staffName, paymentMethod = "cash" } = data;

    // ✅ 1️⃣ احصل على رقم الإيصال التالي
    const counter = await prisma.receiptCounter.upsert({
      where: { id: 1 },
      update: { current: { increment: 1 } },
      create: { id: 1, current: 1001 },
    });

    const receiptNumber = counter.current;

    // ✅ 2️⃣ إنشاء DayUse جديد
    const newDayUse = await prisma.dayUseInBody.create({
      data: {
        name,
        phone,
        serviceType,
        price,
        staffName,
      },
    });

    // ✅ 3️⃣ إنشاء إيصال مرتبط بالـ DayUse
    // 🔒 License validation check
    await requireValidLicense();

    await prisma.receipt.create({
      data: {
        receiptNumber,
        type: "DayUse",
        amount: price,
        itemDetails: `${serviceType} - ${name}`,
        paymentMethod,
        dayUseId: newDayUse.id,
      },
    });

    // خصم النقاط إذا تم استخدامها في الدفع
    const pointsResult = await processPaymentWithPoints(
      null,  // لا يوجد memberId
      phone,
      null,  // لا يوجد memberNumber لـ DayUse
      paymentMethod,
      `دفع يوم استخدام - ${name}`,
      prisma
    );

    if (!pointsResult.success) {
      return NextResponse.json(
        { error: pointsResult.message || 'فشل خصم النقاط' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, newDayUse, receiptNumber });
  } catch (error) {
    console.error("❌ Error creating DayUse and receipt:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

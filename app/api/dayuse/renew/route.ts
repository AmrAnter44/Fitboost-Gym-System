import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import {
  type PaymentMethod,
  validatePaymentDistribution,
  serializePaymentMethods
} from "../../../../lib/paymentHelpers";
import { processPaymentWithPoints } from "../../../../lib/paymentProcessor";
import { getNextReceiptNumber, runReceiptTransaction, PaymentValidationError } from "../../../../lib/receiptHelpers";

export const dynamic = 'force-dynamic'

/**
 * POST /api/dayuse/renew
 * Creates a new receipt for an existing DayUse entry (renewal payment)
 * Does NOT create a new DayUse entry
 */
export async function POST(req: Request) {
  try {
    const { verifyAuth } = await import('@/lib/auth')
    if (!(await verifyAuth(req))) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    }
    const data = await req.json();
    const { entryId, price, staffName, paymentMethod = "cash", serviceType } = data;

    if (!entryId) {
      return NextResponse.json(
        { error: 'Entry ID is required for renewal' },
        { status: 400 }
      );
    }

    // Verify the DayUse entry exists
    const existingEntry = await prisma.dayUseInBody.findUnique({
      where: { id: entryId }
    });

    if (!existingEntry) {
      return NextResponse.json(
        { error: 'DayUse entry not found' },
        { status: 404 }
      );
    }

    // Determine Arabic type name
    const typeArabic =
      serviceType === "DayUse"
        ? "يوم استخدام"
        : serviceType === "InBody"
        ? "InBody"
        : serviceType === "LockerRental"
        ? "تأجير لوجر"
        : serviceType;

    // ✅ معالجة وسائل الدفع المتعددة
    let finalPaymentMethod: string
    if (Array.isArray(paymentMethod)) {
      const validation = validatePaymentDistribution(paymentMethod, price)
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.message || 'توزيع المبالغ غير صحيح' },
          { status: 400 }
        )
      }
      finalPaymentMethod = serializePaymentMethods(paymentMethod)
    } else {
      finalPaymentMethod = paymentMethod || 'cash'
    }

    // Create receipt only (no new DayUse entry)
    // رقم الإيصال + الإيصال + خصم النقاط في transaction واحدة (مع إعادة محاولة وقت
    // ضغط الداتابيز) — لو أي حاجة فشلت مفيش إيصال يتسجّل ولا رقم يضيع
    const receipt = await runReceiptTransaction(prisma, async (tx) => {
     const receiptNumber = await getNextReceiptNumber(tx);
     const r = await tx.receipt.create({
      data: {
        receiptNumber,
        type: `${typeArabic} - تجديد`,
        amount: price,
        itemDetails: JSON.stringify({
          name: existingEntry.name,
          phone: existingEntry.phone,
          serviceType: existingEntry.serviceType,
          isRenewal: true,
          originalEntryId: entryId
        }),
        paymentMethod: finalPaymentMethod,
        dayUseId: entryId,
      },
     });

     // خصم النقاط إذا تم استخدامها في الدفع
     const pointsResult = await processPaymentWithPoints(
      null,  // لا يوجد memberId
      existingEntry.phone,
      null,  // لا يوجد memberNumber لـ DayUse
      finalPaymentMethod,
      `دفع تجديد ${typeArabic} - ${existingEntry.name}`,
      tx
     );

     if (!pointsResult.success) {
      throw new PaymentValidationError(pointsResult.message || 'فشل خصم النقاط');
     }

     return r;
    });

    return NextResponse.json({
      success: true,
      id: entryId,
      receiptNumber: receipt.receiptNumber,
      receipt
    });
  } catch (error) {
    if (error instanceof PaymentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("❌ Error creating renewal receipt:", error);
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
}

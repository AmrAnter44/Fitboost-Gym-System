import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { requireValidLicense } from "../../../../lib/license";

/**
 * POST /api/dayuse/renew
 * Creates a new receipt for an existing DayUse entry (renewal payment)
 * Does NOT create a new DayUse entry
 */
export async function POST(req: Request) {
  try {
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

    // Get next receipt number
    const counter = await prisma.receiptCounter.upsert({
      where: { id: 1 },
      update: { current: { increment: 1 } },
      create: { id: 1, current: 1001 },
    });

    const receiptNumber = counter.current;

    // Determine Arabic type name
    const typeArabic =
      serviceType === "DayUse"
        ? "يوم استخدام"
        : serviceType === "InBody"
        ? "InBody"
        : serviceType === "LockerRental"
        ? "تأجير لوجر"
        : serviceType;

    // 🔒 License validation check
    await requireValidLicense();

    // Create receipt only (no new DayUse entry)
    const receipt = await prisma.receipt.create({
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
        paymentMethod,
        dayUseId: entryId,
      },
    });

    console.log('✅ تم إنشاء إيصال تجديد للـ DayUse:', receiptNumber);

    return NextResponse.json({
      success: true,
      id: entryId,
      receiptNumber,
      receipt
    });
  } catch (error) {
    console.error("❌ Error creating renewal receipt:", error);
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
}

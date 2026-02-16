import { NextResponse } from "next/server";
import {prisma} from "../../../lib/prisma";
import { requireValidLicense } from "../../../lib/license";
import { verifyAuth, requirePermission } from "../../../lib/auth";
import {
  type PaymentMethod,
  validatePaymentDistribution,
  serializePaymentMethods
} from "../../../lib/paymentHelpers";

export const dynamic = 'force-dynamic'

// ✅ GET كل العمليات
export async function GET(request: Request) {
  try {
    /**
     * جلب جميع عمليات Day Use
     * @permission canViewDayUse - صلاحية عرض عمليات الاستخدام اليومي
     */
    const user = await requirePermission(request, 'canViewDayUse')

    const dayUses = await prisma.dayUseInBody.findMany({
      orderBy: { id: "desc" },
      include: {
        Receipt: {
          select: {
            receiptNumber: true,
            amount: true
          }
        }
      }
    });
    return NextResponse.json(dayUses);
  } catch (error) {
    console.error("❌ خطأ أثناء جلب البيانات:", error);
    return NextResponse.json({ error: "فشل في جلب البيانات" }, { status: 500 });
  }
}

// ✅ POST لإضافة يوم استخدام أو InBody + إنشاء إيصال
export async function POST(request: Request) {
  try {
    /**
     * إضافة عملية Day Use جديدة
     * @permission canCreateDayUse - صلاحية إنشاء عمليات الاستخدام اليومي
     */
    const user = await requirePermission(request, 'canCreateDayUse')

    const body = await request.json();
    const { name, phone, serviceType, price, staffName, paymentMethod } = body;

    // ✅ التحقق من الحقول المطلوبة
    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'اسم العميل مطلوب' },
        { status: 400 }
      )
    }

    if (!phone || phone.trim() === '') {
      return NextResponse.json(
        { error: 'رقم الهاتف مطلوب' },
        { status: 400 }
      )
    }

    if (!serviceType || serviceType.trim() === '') {
      return NextResponse.json(
        { error: 'نوع الخدمة مطلوب' },
        { status: 400 }
      )
    }

    if (!price || price <= 0) {
      return NextResponse.json(
        { error: 'السعر مطلوب ويجب أن يكون أكبر من صفر' },
        { status: 400 }
      )
    }

    if (!staffName || staffName.trim() === '') {
      return NextResponse.json(
        { error: 'اسم الموظف مطلوب' },
        { status: 400 }
      )
    }

    // ✅ Atomic increment للعداد - thread-safe
    const counter = await prisma.receiptCounter.upsert({
      where: { id: 1 },
      update: { current: { increment: 1 } },
      create: { id: 1, current: 1001 },
    });
    const receiptNumber = counter.current;

    // ✅ تحديد الاسم بالعربي حسب نوع الخدمة
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

    // ✅ إنشاء DayUse و Receipt في transaction واحدة لضمان الذرية
    const result = await prisma.$transaction(async (tx) => {
      // إنشاء الإدخال
      const entry = await tx.dayUseInBody.create({
        data: {
          name,
          phone,
          serviceType,
          price,
          staffName,
        },
      });

      // إنشاء الإيصال وربطه بالـ DayUse
      const receipt = await tx.receipt.create({
        data: {
          receiptNumber,
          type: typeArabic,
          amount: price,
          paymentMethod: finalPaymentMethod,
          itemDetails: JSON.stringify({
            name,
            phone,
            serviceType: typeArabic,
            price,
            staffName,
          }),
          dayUseId: entry.id,
        },
      });

      return { entry, receipt };
    });

    const entry = result.entry;

    // ✅ إنشاء visitor تلقائياً من الدعوة (إذا لم يكن موجوداً)
    try {
      const existingVisitor = await prisma.visitor.findUnique({
        where: { phone },
      });

      if (!existingVisitor) {
        // إنشاء زائر جديد من الدعوة
        await prisma.visitor.create({
          data: {
            name: name.trim(),
            phone: phone.trim(),
            source: "invitation", // مصدر الزائر: دعوة
            interestedIn: serviceType === "DayUse" ? "يوم استخدام" :
                         serviceType === "InBody" ? "InBody" : "تأجير لوجر",
            notes: `دعوة ${typeArabic} - موظف: ${staffName}`,
            status: "pending",
          },
        });

        // إنشاء أول متابعة تلقائياً
        const newVisitor = await prisma.visitor.findUnique({
          where: { phone },
        });

        if (newVisitor) {
          await prisma.followUp.create({
            data: {
              visitorId: newVisitor.id,
              notes: `دعوة ${typeArabic} - في انتظار المتابعة من فريق المبيعات`,
              nextFollowUpDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // بعد 24 ساعة
            },
          });
        }
      }
    } catch (visitorError) {
      // في حالة فشل إنشاء الزائر، نستمر (لأن DayUse تم إنشاؤه بنجاح)
      console.error("⚠️ تحذير: فشل إنشاء الزائر من الدعوة:", visitorError);
    }

    return NextResponse.json(entry, { status: 201 });
  } catch (error: any) {
    console.error("❌ خطأ أثناء إنشاء DayUse أو الإيصال:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "رقم الإيصال مكرر، حاول مرة أخرى" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "فشل إضافة الإدخال" }, { status: 500 });
  }
}

// ✅ DELETE حذف إدخال حسب الـ ID
export async function DELETE(request: Request) {
  try {
    // ✅ التحقق من تسجيل الدخول
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "لم يتم إرسال ID" }, { status: 400 });
    }

    await prisma.dayUseInBody.delete({
      where: { id: id! },
    });

    return NextResponse.json({ message: "تم الحذف بنجاح" });
  } catch (error) {
    console.error("❌ خطأ أثناء الحذف:", error);
    return NextResponse.json({ error: "فشل في حذف الإدخال" }, { status: 500 });
  }
}


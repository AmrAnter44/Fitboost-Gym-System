import { NextResponse } from "next/server";
import {prisma} from "../../../lib/prisma";
import { verifyAuth, requirePermission } from "../../../lib/auth";
import {
  type PaymentMethod,
  validatePaymentDistribution,
  serializePaymentMethods
} from "../../../lib/paymentHelpers";
import { processPaymentWithPoints } from "../../../lib/paymentProcessor";
import { getNextReceiptNumber } from "../../../lib/receiptHelpers";

export const dynamic = 'force-dynamic'

// ✅ GET كل العمليات
export async function GET(request: Request) {
  try {
    /**
     * جلب جميع عمليات Day Use
     * @permission canViewDayUse - صلاحية عرض عمليات الاستخدام اليومي
     */
    const user = await requirePermission(request, 'canViewDayUse')

    // ملاحظة: فلتر السيلز شُيل من صفحة Day Use / Check-in
    // الفلترة حسب salesStaffId بتتم في صفحة المتابعات فقط
    const dayUses = await prisma.dayUseInBody.findMany({
      orderBy: { id: "desc" },
      include: {
        receipts: {
          select: {
            receiptNumber: true,
            amount: true
          }
        }
      }
    });

    // إرفاق بيانات موظف السيلز إن وُجد (DayUseInBody مفهوش relation FK مباشر)
    const salesStaffIds = Array.from(new Set(
      dayUses.map(d => (d as any).salesStaffId).filter((x: string | null): x is string => !!x)
    ))
    const salesStaffMap: Record<string, { id: string; name: string }> = {}
    if (salesStaffIds.length > 0) {
      const staffRows = await prisma.staff.findMany({
        where: { id: { in: salesStaffIds } },
        select: { id: true, name: true }
      })
      for (const s of staffRows) salesStaffMap[s.id] = s
    }

    const enriched = dayUses.map(d => ({
      ...d,
      salesStaff: (d as any).salesStaffId ? (salesStaffMap[(d as any).salesStaffId] || null) : null
    }))

    return NextResponse.json(enriched);
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
    const { name, phone, serviceType, price, staffName, paymentMethod, salesStaffId } = body;

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

    // ✅ تحديد الاسم بالعربي حسب نوع الخدمة
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

    // ✅ إنشاء DayUse و Receipt في transaction واحدة لضمان الذرية
    const result = await prisma.$transaction(async (tx) => {
      // ✅ الحصول على رقم الإيصال التالي (يضمن عدم التكرار)
      const receiptNumber = await getNextReceiptNumber(tx);

      // ✅ تحديد salesStaffId: لو اليوزر سيلز استخدم staffId بتاعه، وإلا استخدم القيمة من الـ body
      const effectiveSalesStaffId = (user.isSales && user.staffId) ? user.staffId : (salesStaffId || null)

      // إنشاء الإدخال
      const entry = await tx.dayUseInBody.create({
        data: {
          name,
          phone,
          serviceType,
          price,
          staffName,
          salesStaffId: effectiveSalesStaffId,
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
    const receipt = result.receipt;

    // ✅ خصم النقاط إذا تم استخدامها في الدفع
    const pointsResult = await processPaymentWithPoints(
      null,  // لا يوجد memberId
      phone,
      null,  // لا يوجد memberNumber لـ DayUse
      finalPaymentMethod,
      `دفع ${typeArabic} - ${name}`,
      prisma
    );

    if (!pointsResult.success) {
      console.error("⚠️ تحذير: فشل خصم النقاط:", pointsResult.message);
      // نستمر في العملية حتى لو فشل خصم النقاط
    }

    // ✅ إنشاء visitor + followup للـ DayUse في transaction واحد
    // عشان السطر القديم كان بيـ swallow الأخطاء بـ console.error بس، فلو الـ followup فشل
    // كان الـ DayUse يتسجل من غير متابعة → "متابعات مش بتتسجل"
    // ✅ اختيار موظف سيلز: إذا حُدد يدوياً استخدمه، وإلا اختر الأقل ليدز
    const getAutoAssignedStaff = async (): Promise<string | null> => {
      if (salesStaffId) return salesStaffId
      try {
        const salesStaffList = await prisma.staff.findMany({
          where: { isActive: true, position: { contains: 'sales' } },
          select: {
            id: true,
            _count: { select: { followUpAssignments: { where: { archived: false } } } }
          }
        })
        if (salesStaffList.length > 0) {
          const sorted = [...salesStaffList].sort((a, b) => a._count.followUpAssignments - b._count.followUpAssignments)
          return sorted[0].id
        }
      } catch {}
      return null
    }

    try {
      const assignedTo = await getAutoAssignedStaff()

      await prisma.$transaction(async (tx) => {
        // upsert الزائر بدل findUnique → create عشان نتجنّب race condition
        // (طلبين متوازيين كانوا ممكن يخلقوا اتنين فيخفقوا في unique constraint)
        const visitor = await tx.visitor.upsert({
          where: { phone },
          update: {},
          create: {
            name: name.trim(),
            phone: phone.trim(),
            source: "invitation",
            interestedIn: serviceType === "DayUse" ? "يوم استخدام" :
                         serviceType === "InBody" ? "InBody" : "تأجير لوجر",
            notes: `دعوة ${typeArabic} - موظف: ${staffName}`,
            status: "pending",
          },
        })

        // ✅ ما نخلقش followup جديد لو في واحد active موجود
        const activeFollowUp = await tx.followUp.findFirst({
          where: { visitorId: visitor.id, archived: false }
        })

        if (!activeFollowUp) {
          await tx.followUp.create({
            data: {
              visitorId: visitor.id,
              notes: `دعوة ${typeArabic} - في انتظار المتابعة من فريق المبيعات`,
              nextFollowUpDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
              assignedTo,
            },
          })
        }
      })
    } catch (visitorError) {
      // ❌ Visitor/followup creation failed — مش هنخفي الخطأ. الـ DayUse + Receipt
      // اتسجلوا بالفعل في الـ transaction اللي فوق، لكن المهم نـ log الخطأ بوضوح
      // والـ admin يقدر يستخدم زرار "توزيع غير المُسنَّدين" يصلح الموقف.
      console.error("⚠️ فشل إنشاء visitor+followup من DayUse:", visitorError);
    }


    return NextResponse.json({
      ...entry,
      receipt: {
        receiptNumber: receipt.receiptNumber,
        amount: receipt.amount,
        type: receipt.type,
        createdAt: receipt.createdAt
      }
    }, { status: 201 });
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


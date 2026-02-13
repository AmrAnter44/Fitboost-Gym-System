import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Get all paid services for a member
 * يجلب جميع الخدمات المدفوعة للعضو
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;

    // Get member info first to get phone and memberNumber
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: {
        phone: true,
        memberNumber: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'العضو غير موجود' },
        { status: 404 }
      );
    }

    // Get all paid services in parallel
    const [pt, nutrition, physiotherapy, groupClass] = await Promise.all([
      // PT - uses phone for matching
      prisma.pT.findMany({
        where: {
          phone: member.phone,
          sessionsRemaining: { gt: 0 },
        },
        select: {
          ptNumber: true,
          sessionsPurchased: true,
          sessionsRemaining: true,
          coachName: true,
          coachUserId: true,
          pricePerSession: true,
          startDate: true,
          expiryDate: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1, // Get most recent active subscription
      }),

      // Nutrition - uses memberNumber
      prisma.nutrition.findMany({
        where: {
          memberNumber: member.memberNumber,
          sessionsRemaining: { gt: 0 },
        },
        select: {
          nutritionNumber: true,
          sessionsPurchased: true,
          sessionsRemaining: true,
          nutritionistName: true,
          pricePerSession: true,
          startDate: true,
          expiryDate: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      }),

      // Physiotherapy - uses memberNumber
      prisma.physiotherapy.findMany({
        where: {
          memberNumber: member.memberNumber,
          sessionsRemaining: { gt: 0 },
        },
        select: {
          physioNumber: true,
          sessionsPurchased: true,
          sessionsRemaining: true,
          therapistName: true,
          pricePerSession: true,
          startDate: true,
          expiryDate: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      }),

      // Group Class - uses memberNumber
      prisma.groupClass.findMany({
        where: {
          memberNumber: member.memberNumber,
          sessionsRemaining: { gt: 0 },
        },
        select: {
          classNumber: true,
          sessionsPurchased: true,
          sessionsRemaining: true,
          instructorName: true,
          pricePerSession: true,
          startDate: true,
          expiryDate: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      }),
    ]);

    // Check coach/trainer online status
    const ptService = pt[0] || null;
    let coachOnline = false;

    if (ptService?.coachName) {
      console.log('🔍 Checking coach status for:', ptService.coachName);

      // Find Staff by name (since coachUserId is null)
      const staffRecord = await prisma.staff.findFirst({
        where: {
          name: {
            contains: ptService.coachName,
          },
          isActive: true,
        },
        select: {
          id: true,
          name: true,
        },
      });

      console.log('👤 Staff record:', staffRecord);

      if (staffRecord) {
        // Get coach's latest attendance record using Staff ID
        const latestAttendance = await prisma.attendance.findFirst({
          where: {
            staffId: staffRecord.id,
          },
          orderBy: {
            checkIn: 'desc',
          },
          select: {
            checkIn: true,
            checkOut: true,
          },
        });

        console.log('📊 Latest attendance:', latestAttendance);

        // Consider coach online if checked in within last 12 hours and no checkout
        if (latestAttendance) {
          const now = new Date();
          const checkInTime = new Date(latestAttendance.checkIn);
          const twelveHoursInMs = 12 * 60 * 60 * 1000;

          const timeDiff = now.getTime() - checkInTime.getTime();
          const checkedInRecently = timeDiff < twelveHoursInMs;
          const notCheckedOut = !latestAttendance.checkOut;

          console.log('⏰ Time since check-in (ms):', timeDiff);
          console.log('✅ Checked in recently:', checkedInRecently);
          console.log('🚪 Not checked out:', notCheckedOut);

          coachOnline = checkedInRecently && notCheckedOut;

          console.log('🎯 Coach online status:', coachOnline);
        } else {
          console.log('⚠️ No attendance records found');
        }
      } else {
        console.log('⚠️ No staff record found with name:', ptService.coachName);
      }
    } else {
      console.log('⚠️ No coachName found for PT service');
    }

    return NextResponse.json({
      services: {
        pt: ptService ? { ...ptService, coachOnline } : null,
        nutrition: nutrition[0] || null,
        physiotherapy: physiotherapy[0] || null,
        groupClass: groupClass[0] || null,
      },
    });
  } catch (error) {
    console.error('Get member services error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}

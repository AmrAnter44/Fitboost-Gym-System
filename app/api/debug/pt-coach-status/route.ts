import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Debug endpoint to check PT coach status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone parameter required' },
        { status: 400 }
      );
    }

    // Get PT record
    const ptRecord = await prisma.pT.findFirst({
      where: { phone },
      select: {
        ptNumber: true,
        coachName: true,
        coachUserId: true,
      },
    });

    if (!ptRecord) {
      return NextResponse.json({ error: 'No PT record found' }, { status: 404 });
    }

    // Get User record
    let userRecord = null;
    let staffId = null;
    if (ptRecord.coachUserId) {
      userRecord = await prisma.user.findUnique({
        where: { id: ptRecord.coachUserId },
        select: {
          id: true,
          name: true,
          email: true,
          staffId: true,
        },
      });
      staffId = userRecord?.staffId;
    }

    // Get Staff record
    let staffRecord = null;
    if (staffId) {
      staffRecord = await prisma.staff.findUnique({
        where: { id: staffId },
        select: {
          id: true,
          name: true,
          staffCode: true,
        },
      });
    }

    // Get Attendance records
    let attendanceRecords = [];
    if (staffId) {
      attendanceRecords = await prisma.attendance.findMany({
        where: { staffId },
        orderBy: { checkIn: 'desc' },
        take: 5,
        select: {
          id: true,
          checkIn: true,
          checkOut: true,
        },
      });
    }

    return NextResponse.json({
      pt: ptRecord,
      user: userRecord,
      staff: staffRecord,
      attendance: attendanceRecords,
      debug: {
        hasCoachUserId: !!ptRecord.coachUserId,
        hasStaffId: !!staffId,
        hasAttendanceRecords: attendanceRecords.length > 0,
      },
    });
  } catch (error) {
    console.error('Debug PT coach status error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم', details: String(error) },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get member to access memberNumber and phone for service receipt lookup
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { memberNumber: true, phone: true },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'العضو غير موجود' },
        { status: 404 }
      );
    }

    // Build query to include all receipts:
    // 1. Direct receipts (memberId matches)
    // 2. Service receipts linked via memberNumber (Nutrition, Physiotherapy, GroupClass)
    // 3. PT receipts linked via phone (PT doesn't have memberNumber)
    const orConditions: any[] = [
      { memberId },
      { pt: { phone: member.phone } },
    ];

    // Add service receipts if memberNumber exists
    if (member.memberNumber) {
      orConditions.push(
        { nutrition: { memberNumber: member.memberNumber } },
        { physiotherapy: { memberNumber: member.memberNumber } },
        { groupClass: { memberNumber: member.memberNumber } }
      );
    }

    const whereClause = {
      AND: [
        { isCancelled: false },
        { OR: orConditions },
      ],
    };

    const receipts = await prisma.receipt.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        receiptNumber: true,
        amount: true,
        paymentMethod: true,
        staffName: true,
        itemDetails: true,
        type: true,
        createdAt: true,
      },
    });

    const totalReceipts = await prisma.receipt.count({
      where: whereClause,
    });

    const totalPaidResult = await prisma.receipt.aggregate({
      where: whereClause,
      _sum: {
        amount: true,
      },
    });

    return NextResponse.json({
      receipts,
      stats: {
        total: totalReceipts,
        totalPaid: totalPaidResult._sum.amount || 0,
      },
      pagination: {
        limit,
        offset,
        hasMore: totalReceipts > offset + limit,
      },
    });
  } catch (error) {
    console.error('Get receipts error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const { memberId } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const receipts = await prisma.receipt.findMany({
      where: {
        memberId,
        isCancelled: false,
      },
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
      where: {
        memberId,
        isCancelled: false,
      },
    });

    const totalPaidResult = await prisma.receipt.aggregate({
      where: {
        memberId,
        isCancelled: false,
      },
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

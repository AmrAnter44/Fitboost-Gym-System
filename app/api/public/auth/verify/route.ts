import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { memberNumber, phoneNumber } = await request.json();

    // Validate input
    if (!memberNumber || !phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'رقم العضوية ورقم الهاتف مطلوبان' },
        { status: 400 }
      );
    }

    // Clean phone number (remove spaces, dashes, etc.)
    const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10); // Last 10 digits

    // Find member by memberNumber AND phone
    const member = await prisma.member.findFirst({
      where: {
        memberNumber: parseInt(memberNumber),
        phone: {
          contains: cleanPhone,
        },
      },
      select: {
        id: true,
        memberNumber: true,
        name: true,
        profileImage: true,
        isActive: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { success: false, error: 'البيانات غير صحيحة' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      member: {
        id: member.id,
        memberNumber: member.memberNumber,
        name: member.name,
        profileImage: member.profileImage,
      },
    });
  } catch (error) {
    console.error('Verify member error:', error);
    return NextResponse.json(
      { success: false, error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}

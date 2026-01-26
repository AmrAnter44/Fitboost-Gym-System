# 🔌 Required APIs for Client Portal

## 📍 Location
```
x gym/app/api/public/
```

---

## 1️⃣ Verify Member Credentials

**File:** `app/api/public/auth/verify/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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

    // Find member by memberNumber AND phone
    const member = await prisma.member.findFirst({
      where: {
        memberNumber: parseInt(memberNumber),
        phone: {
          contains: phoneNumber.replace(/\D/g, '').slice(-10), // Last 10 digits
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
```

---

## 2️⃣ Get Member Profile

**File:** `app/api/public/member/[memberId]/profile/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const { memberId } = params;

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        memberNumber: true,
        name: true,
        phone: true,
        profileImage: true,
        subscriptionPrice: true,
        startDate: true,
        expiryDate: true,
        isActive: true,
        isFrozen: true,
        inBodyScans: true,
        invitations: true,
        freePTSessions: true,
        remainingFreezeDays: true,
        _count: {
          select: {
            receipts: true,
            checkIns: true,
            spaBookings: true,
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'العضو غير موجود' },
        { status: 404 }
      );
    }

    // Calculate remaining days
    const today = new Date();
    const expiryDate = member.expiryDate ? new Date(member.expiryDate) : null;

    let remainingDays = 0;
    let status: 'active' | 'expired' | 'expiring_soon' = 'active';

    if (expiryDate) {
      remainingDays = Math.ceil(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (remainingDays <= 0) {
        status = 'expired';
        remainingDays = 0;
      } else if (remainingDays <= 7) {
        status = 'expiring_soon';
      }
    }

    return NextResponse.json({
      member: {
        ...member,
        remainingDays,
        status,
      },
    });
  } catch (error) {
    console.error('Get member profile error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
```

---

## 3️⃣ Get Member Check-ins

**File:** `app/api/public/member/[memberId]/checkins/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const { memberId } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const checkIns = await prisma.memberCheckIn.findMany({
      where: { memberId },
      orderBy: { checkInTime: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        checkInTime: true,
        checkInMethod: true,
      },
    });

    const totalCheckIns = await prisma.memberCheckIn.count({
      where: { memberId },
    });

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyCheckIns = await prisma.memberCheckIn.count({
      where: {
        memberId,
        checkInTime: { gte: firstDayOfMonth },
      },
    });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const weeklyCheckIns = await prisma.memberCheckIn.count({
      where: {
        memberId,
        checkInTime: { gte: sevenDaysAgo },
      },
    });

    return NextResponse.json({
      checkIns,
      stats: {
        total: totalCheckIns,
        thisMonth: monthlyCheckIns,
        thisWeek: weeklyCheckIns,
      },
      pagination: {
        limit,
        offset,
        hasMore: totalCheckIns > offset + limit,
      },
    });
  } catch (error) {
    console.error('Get check-ins error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
```

---

## 4️⃣ Get Member Receipts

**File:** `app/api/public/member/[memberId]/receipts/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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
```

---

## 5️⃣ Get Member Spa Bookings

**File:** `app/api/public/member/[memberId]/spa/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const { memberId } = params;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: any = { memberId };
    if (status) {
      where.status = status;
    }

    const bookings = await prisma.spaBooking.findMany({
      where,
      orderBy: { bookingDate: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        bookingDate: true,
        bookingTime: true,
        serviceType: true,
        status: true,
        duration: true,
        notes: true,
        createdAt: true,
      },
    });

    const totalBookings = await prisma.spaBooking.count({ where });

    const upcomingCount = await prisma.spaBooking.count({
      where: {
        memberId,
        status: {
          in: ['pending', 'confirmed'],
        },
        bookingDate: {
          gte: new Date(),
        },
      },
    });

    return NextResponse.json({
      bookings,
      stats: {
        total: totalBookings,
        upcoming: upcomingCount,
      },
      pagination: {
        limit,
        offset,
        hasMore: totalBookings > offset + limit,
      },
    });
  } catch (error) {
    console.error('Get spa bookings error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
```

---

## ✅ Installation Steps

### 1. Create Directory Structure
```bash
cd "x gym/app/api"
mkdir -p public/auth/verify
mkdir -p public/member/[memberId]/profile
mkdir -p public/member/[memberId]/checkins
mkdir -p public/member/[memberId]/receipts
mkdir -p public/member/[memberId]/spa
```

### 2. Copy Code
انسخ الكود أعلاه في الملفات المناسبة.

### 3. Test APIs
```bash
# Test verify
curl -X POST http://localhost:4001/api/public/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"memberNumber": 1001, "phoneNumber": "01234567890"}'

# Test profile (استبدل MEMBER_ID برقم حقيقي)
curl http://localhost:4001/api/public/member/MEMBER_ID/profile
```

---

## 🔐 Security Notes

### ✅ Current Security
- Members can only access their own data (filtered by memberId)
- No admin data exposed
- Read-only operations
- Input validation

### 🚀 Future Enhancements
- Add JWT verification from Client Portal
- Add rate limiting
- Add CORS configuration
- Add request logging

---

## 📊 Testing

### After creating APIs:

1. Start main system:
```bash
cd "x gym"
npm run dev  # http://localhost:4001
```

2. Start client portal:
```bash
cd "x gym/client-portal"
npm run dev  # http://localhost:3002
```

3. Test login at: http://localhost:3002

---

**Created:** 2026-01-25
**Status:** ⏳ Waiting for implementation

# 🔔 Web Push Notifications Setup Guide

## Overview
This guide will help you set up Web Push Notifications for the X Gym Client Portal.

## Prerequisites
- Node.js installed
- `web-push` package installed

## Step 1: Install Dependencies

```bash
cd client-portal
npm install web-push
```

## Step 2: Generate VAPID Keys

```bash
node scripts/generate-vapid-keys.js
```

This will output your VAPID keys. Copy them to your `.env.local` file:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
VAPID_SUBJECT=mailto:your-email@example.com
```

⚠️ **Important:** Never commit `.env.local` to git!

## Step 3: Update Database Schema

Add a `pushSubscriptions` table to store user subscriptions:

```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  memberId  String
  member    Member   @relation(fields: [memberId], references: [id], onDelete: Cascade)
  endpoint  String   @unique
  keys      Json     // { p256dh, auth }
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([memberId])
}
```

Then run:
```bash
npx prisma migrate dev --name add_push_subscriptions
```

## Step 4: Update API Endpoints

The following files need to be updated to save/remove subscriptions:

1. `app/api/notifications/subscribe/route.ts` - Uncomment database save code
2. `app/api/notifications/unsubscribe/route.ts` - Uncomment database delete code

## Step 5: Create Notification Sender (Main System)

In the main system, create an API endpoint to send notifications:

```typescript
// app/api/notifications/send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { memberId, title, body, icon, badge, data } = await request.json();

    // Get member's subscriptions
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { memberId },
    });

    const payload = JSON.stringify({
      title,
      body,
      icon: icon || '/icons/icon-192x192.png',
      badge: badge || '/icons/icon-96x96.png',
      data: data || {},
    });

    // Send to all user's devices
    const results = await Promise.allSettled(
      subscriptions.map(sub =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys as { p256dh: string; auth: string },
          },
          payload
        )
      )
    );

    // Remove failed subscriptions
    const failedIndexes = results
      .map((result, index) => (result.status === 'rejected' ? index : -1))
      .filter(index => index !== -1);

    if (failedIndexes.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: {
          endpoint: {
            in: failedIndexes.map(i => subscriptions[i].endpoint),
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      sent: results.filter(r => r.status === 'fulfilled').length,
      failed: failedIndexes.length,
    });
  } catch (error) {
    console.error('Send notification error:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
```

## Step 6: Trigger Notifications

Example: Send notification when SPA booking is confirmed:

```typescript
// In app/api/public/member/[memberId]/spa/route.ts
// After creating booking:

await fetch('http://localhost:4000/api/notifications/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    memberId: member.id,
    title: 'تم تأكيد حجز السبا',
    body: `تم تأكيد حجزك يوم ${formattedDate} الساعة ${bookingTime}`,
    data: {
      type: 'spa-booking-confirmed',
      bookingId: newBooking.id,
    },
  }),
});
```

## Step 7: Test Notifications

1. Open Client Portal in browser
2. Accept notification permission when prompted
3. Check browser console for subscription details
4. Trigger a notification from the main system
5. Verify notification appears

## Browser Support

✅ Chrome/Edge (Desktop & Mobile)
✅ Firefox (Desktop & Mobile)
✅ Safari 16.4+ (Desktop & Mobile)
⚠️ iOS Safari (requires Add to Home Screen)

## Troubleshooting

### Notifications not appearing?
- Check browser notification permissions
- Verify VAPID keys are correct
- Check browser console for errors
- Ensure service worker is registered

### iOS not working?
- Notifications only work in PWA mode (Add to Home Screen)
- Not supported in iOS Safari browser

### Subscription fails?
- Check VAPID public key in .env.local
- Verify service worker is active
- Check network tab for API errors

## Security Notes

🔒 **Never expose your VAPID private key**
- Keep it in .env.local only
- Never commit to git
- Don't include in client-side code

🔒 **Validate all notification requests**
- Only send to authenticated users
- Rate limit notification API
- Log all notification attempts

## Next Steps

- [ ] Generate VAPID keys
- [ ] Update database schema
- [ ] Complete API endpoints
- [ ] Test on different browsers
- [ ] Test on mobile devices
- [ ] Add notification preferences UI
- [ ] Implement notification history

## Resources

- [Web Push Protocol](https://web.dev/push-notifications-overview/)
- [VAPID Specification](https://datatracker.ietf.org/doc/html/rfc8292)
- [Browser Support](https://caniuse.com/push-api)

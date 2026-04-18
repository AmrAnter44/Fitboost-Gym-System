/**
 * Expo Push Notifications Helper
 * دالة مساعدة لإرسال Expo Push Notifications
 */

import { Expo, ExpoPushMessage } from 'expo-server-sdk';

const expo = new Expo();

export interface PushNotificationData {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
}

/**
 * Send push notification to single device
 * إرسال إشعار push لجهاز واحد
 */
export async function sendPushNotification(
  pushToken: string,
  notification: PushNotificationData
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if push token is valid
    if (!Expo.isExpoPushToken(pushToken)) {
      console.error('Invalid Expo push token:', pushToken);
      return { success: false, error: 'Invalid push token' };
    }

    // Construct message
    const message: ExpoPushMessage = {
      to: pushToken,
      sound: notification.sound || 'default',
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      badge: notification.badge,
    };

    // Send notification
    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
      }
    }

    // Check for errors in tickets
    for (const ticket of tickets) {
      if (ticket.status === 'error') {
        console.error('Push notification error:', ticket.message);
        return { success: false, error: ticket.message };
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send push notification to multiple devices
 * إرسال إشعار push لعدة أجهزة
 */
export async function sendPushNotificationToMany(
  pushTokens: string[],
  notification: PushNotificationData
): Promise<{ success: boolean; sentCount: number; failedCount: number }> {
  let sentCount = 0;
  let failedCount = 0;

  for (const token of pushTokens) {
    const result = await sendPushNotification(token, notification);
    if (result.success) {
      sentCount++;
    } else {
      failedCount++;
    }
  }

  return {
    success: sentCount > 0,
    sentCount,
    failedCount,
  };
}

/**
 * Notification templates for different events
 * قوالب الإشعارات للأحداث المختلفة
 */
export const NotificationTemplates = {
  paymentReceived: (amount: number, receiptNumber: number) => ({
    title: '💰 تم استلام الدفع',
    body: `تم تسجيل دفعة ${amount} جنيه - إيصال #${receiptNumber}`,
    data: {
      type: 'payment_received',
      amount,
      receiptNumber,
      screen: 'Receipts',
    },
    sound: 'default' as const,
    badge: 1,
  }),

  subscriptionExpiring: (days: number) => ({
    title: '⚠️ تنبيه اشتراك',
    body: `اشتراكك ينتهي خلال ${days} ${days === 1 ? 'يوم' : 'أيام'}`,
    data: {
      type: 'subscription_expiring',
      days,
      screen: 'Dashboard',
    },
    sound: 'default' as const,
    badge: 1,
  }),

  pointsEarned: (points: number, reason: string) => ({
    title: '🎉 نقاط جديدة!',
    body: `حصلت على ${points} نقطة - ${reason}`,
    data: {
      type: 'points_earned',
      points,
      reason,
      screen: 'Points',
    },
    sound: 'default' as const,
    badge: 1,
  }),
};

'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  requestNotificationPermission,
  subscribeToPushNotifications,
  getNotificationPermission,
} from '@/lib/notifications';

export default function NotificationPrompt() {
  const { t } = useLanguage();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    if (!('Notification' in window)) return;

    // Check if already granted or denied
    const permission = getNotificationPermission();
    if (permission !== 'default') return;

    // Check if user dismissed before
    const dismissed = localStorage.getItem('notification-prompt-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) return; // Don't show again for 7 days
    }

    // Show prompt after 30 seconds of usage
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 30000);

    return () => clearTimeout(timer);
  }, []);

  const handleEnable = async () => {
    setIsSubscribing(true);
    try {
      const permission = await requestNotificationPermission();

      if (permission === 'granted') {
        await subscribeToPushNotifications();
        setShowPrompt(false);
        localStorage.setItem('notification-enabled', 'true');
      } else {
        // Permission denied
        setShowPrompt(false);
        localStorage.setItem('notification-prompt-dismissed', Date.now().toString());
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('notification-prompt-dismissed', Date.now().toString());
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 animate-slideUp">
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl shadow-2xl p-5 relative max-w-md mx-auto">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-white/80 hover:text-white"
          disabled={isSubscribing}
        >
          ✕
        </button>

        <div className="flex items-center gap-4">
          <div className="text-5xl">🔔</div>
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">
              تفعيل الإشعارات
            </h3>
            <p className="text-sm text-white/90">
              احصل على تنبيهات فورية عن حجوزات السبا والتحديثات المهمة
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleEnable}
            disabled={isSubscribing}
            className="flex-1 bg-white text-green-600 font-bold py-3 rounded-xl hover:bg-gray-100 transition disabled:opacity-50"
          >
            {isSubscribing ? 'جاري التفعيل...' : 'تفعيل'}
          </button>
          <button
            onClick={handleDismiss}
            disabled={isSubscribing}
            className="px-4 py-3 bg-white/20 rounded-xl hover:bg-white/30 transition disabled:opacity-50"
          >
            لاحقاً
          </button>
        </div>

        <p className="text-xs text-white/70 mt-3 text-center">
          يمكنك إلغاء الإشعارات في أي وقت من الإعدادات
        </p>
      </div>
    </div>
  );
}

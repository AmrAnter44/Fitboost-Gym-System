'use client';

//  🚪 استطلاع أحداث البوابة — بيغذّي البوب-أب في صفحة التشيك
//
//  ليه استطلاع مش SSE؟ الحدث بيوصل السيرفر على ريكوست منفصل تمامًا (من
//  الجهاز)، فالـ SSE كان هيحتاج ناقل أحداث في الذاكرة بين الريكوستين —
//  وده بيتكسر لو اتشغّل أكتر من worker. الريسبشن واقف قدام الباب، فتأخير
//  تلات ثواني مالوش أي أثر عملي.

import { useEffect, useRef, useState } from 'react';

export interface GateEvent {
  id: string;
  at: string;
  allowed: boolean;
  reason: string | null;
  reasonText: string | null;
  employeeNo: string | null;
  member: {
    id: string;
    name: string;
    memberNumber: string | null;
    phone: string | null;
    expiryDate: string | null;
    profileImage: string | null;
  } | null;
}

const POLL_MS = 3000;

export function useGateEvents(enabled: boolean) {
  const [events, setEvents] = useState<GateEvent[]>([]);
  //  ساعة السيرفر مش ساعة المتصفح — فرق الساعتين كان هيضيّع أحداث أو يكرّرها
  const since = useRef<number | null>(null);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const qs = since.current ? `?since=${since.current}` : '';
        const res = await fetch(`/api/gates/recent${qs}`);
        const data = await res.json();
        if (alive && data.success) {
          since.current = data.now;
          //  الجهاز ممكن يبعت نفس الحدث مرتين — بنمنع التكرار بالـ id
          const fresh = (data.events as GateEvent[]).filter(e => !seen.current.has(e.id));
          fresh.forEach(e => seen.current.add(e.id));
          //  المجموعة مش بتكبر للأبد — بنقصّها لما تعدّي حد معقول
          if (seen.current.size > 500) {
            seen.current = new Set([...seen.current].slice(-200));
          }
          if (fresh.length) setEvents(prev => [...fresh, ...prev].slice(0, 10));
        }
      } catch { /* الشبكة وقعت — هنجرّب تاني بعد ٣ ثواني */ }
      if (alive) timer = setTimeout(tick, POLL_MS);
    };

    tick();
    return () => { alive = false; clearTimeout(timer); };
  }, [enabled]);

  const dismiss = (id: string) => setEvents(prev => prev.filter(e => e.id !== id));
  const clear = () => setEvents([]);

  return { events, dismiss, clear };
}

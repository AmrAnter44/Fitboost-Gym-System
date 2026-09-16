'use client';

//  🚪 بوب-أب المحاولة المرفوضة — بيظهر في صفحة التشيك لما البوابة ترفض حد
//
//  الهدف إن الريسبشن يعرف فورًا إن في حد واقف برّه واترفض وليه، من غير ما
//  يبص على أي تقرير.

import type { GateEvent } from '../../hooks/useGateEvents';

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const;

interface Props {
  event: GateEvent | null;
  onClose: () => void;
  onOpenMember?: (memberId: string) => void;
}

export default function GateDeniedModal({ event, onClose, onOpenMember }: Props) {
  if (!event) return null;

  const m = event.member;
  const expired = m?.expiryDate ? new Date(m.expiryDate) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-amber-500 text-white px-5 py-3 flex items-center gap-2">
          <svg {...stroke} className="w-6 h-6 flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          </svg>
          <span className="font-bold">البوابة رفضت الدخول</span>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            {m?.profileImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.profileImage} alt="" className="w-14 h-14 rounded-full object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                <svg {...stroke} className="w-7 h-7"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.1a7.5 7.5 0 0 1 15 0" /></svg>
              </div>
            )}
            <div className="min-w-0">
              {m ? (
                <>
                  <p className="font-bold text-gray-900 dark:text-gray-100 truncate">{m.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    رقم العضوية {m.memberNumber}
                    {m.phone && <span className="ms-2 font-mono" dir="ltr">{m.phone}</span>}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-bold text-gray-900 dark:text-gray-100">مستخدم غير معروف</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    الرقم على الجهاز: <span className="font-mono" dir="ltr">{event.employeeNo || '—'}</span>
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-200 dark:ring-amber-900/50 p-3 mb-2">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              {event.reasonText || 'مرفوض'}
            </p>
            {expired && (
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                انتهى في {expired.toLocaleDateString('ar-EG')}
              </p>
            )}
            {!m && (
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                الرقم ده متسجّل على الجهاز بس مش موجود في السيستم — غالبًا
                اتسجّل برقم غلط.
              </p>
            )}
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            {new Date(event.at).toLocaleString('ar-EG')}
          </p>

          <div className="flex gap-2">
            {m && onOpenMember && (
              <button
                onClick={() => { onOpenMember(m.id); onClose(); }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold"
              >
                افتح صفحة العضو
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg ring-1 ring-gray-300 dark:ring-gray-600 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              تمام
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24' } as const

interface ReceiptInfoProps {
  receiptNumber: number
  memberNumber?: string
  amount: number
}

export function ReceiptInfo({ receiptNumber, memberNumber, amount }: ReceiptInfoProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* رقم الإيصال */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">رقم الإيصال</div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">#{receiptNumber}</div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">مستقل عن رقم العضوية</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center">
              <svg {...stroke} className="w-6 h-6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12h6m-6 4h6M9 8h6M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-2.5-1.5L14 21l-2.5-1.5L9 21l-2.5-1.5L5 21Z"/>
              </svg>
            </div>
          </div>
        </div>

        {/* رقم العضوية */}
        {memberNumber && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">رقم العضوية</div>
                <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">#{memberNumber}</div>
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">خاص بالعضو</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center">
                <svg {...stroke} className="w-6 h-6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 14a4 4 0 1 0-8 0m12 7a8 8 0 1 0-16 0"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* المبلغ */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">المبلغ المدفوع</div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{amount} ج.م</div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">إجمالي المدفوع</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center">
              <svg {...stroke} className="w-6 h-6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8v8m0 0v2m0-10V6"/>
                <circle cx="12" cy="12" r="9"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4 ring-1 ring-gray-200 dark:ring-gray-700">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center shrink-0">
            <svg {...stroke} className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547Z"/>
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-1">نظام الترقيم</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>رقم الإيصال</strong> يتم توليده تلقائياً بشكل تسلسلي (1000، 1001، 1002...)
              وهو <strong>مستقل تماماً</strong> عن رقم العضوية. يمكنك تغيير رقم البداية من صفحة الإعدادات.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

interface ReceiptInfoProps {
  receiptNumber: number
  memberNumber?: number
  amount: number
}

export function ReceiptInfo({ receiptNumber, memberNumber, amount }: ReceiptInfoProps) {
  return (
    <div className="bg-gradient-to-br from-green-50 to-primary-50 border-2 border-green-200 rounded-xl p-6 shadow-lg">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* رقم الإيصال */}
        <div className="text-center">
          <div className="bg-white rounded-lg p-4 shadow-md">
            <div className="text-green-600 text-4xl mb-2">🧾</div>
            <div className="text-sm text-gray-600 mb-1">رقم الإيصال</div>
            <div className="text-3xl font-bold text-green-600">
              #{receiptNumber}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              مستقل عن رقم العضوية
            </div>
          </div>
        </div>

        {/* رقم العضوية */}
        {memberNumber && (
          <div className="text-center">
            <div className="bg-white rounded-lg p-4 shadow-md">
              <div className="text-primary-600 text-4xl mb-2">👤</div>
              <div className="text-sm text-gray-600 mb-1">رقم العضوية</div>
              <div className="text-3xl font-bold text-primary-600">
                #{memberNumber}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                خاص بالعضو
              </div>
            </div>
          </div>
        )}

        {/* المبلغ */}
        <div className="text-center">
          <div className="bg-white rounded-lg p-4 shadow-md">
            <div className="text-purple-600 text-4xl mb-2">💰</div>
            <div className="text-sm text-gray-600 mb-1">المبلغ المدفوع</div>
            <div className="text-3xl font-bold text-purple-600">
              {amount} ج.م
            </div>
            <div className="text-xs text-gray-500 mt-2">
              إجمالي المدفوع
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 bg-white rounded-lg p-4 border-r-4 border-primary-500">
        <div className="flex items-start gap-3">
          <div className="text-2xl">💡</div>
          <div className="flex-1">
            <h4 className="font-bold text-gray-800 mb-1">نظام الترقيم</h4>
            <p className="text-sm text-gray-600">
              <strong>رقم الإيصال</strong> يتم توليده تلقائياً بشكل تسلسلي (1000، 1001، 1002...)
              وهو <strong>مستقل تماماً</strong> عن رقم العضوية. يمكنك تغيير رقم البداية من صفحة الإعدادات ⚙️
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
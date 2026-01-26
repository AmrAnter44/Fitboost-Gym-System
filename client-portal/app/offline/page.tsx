export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700 p-4">
      <div className="text-center text-white max-w-md">
        <div className="mb-8">
          <svg
            className="w-32 h-32 mx-auto text-white/80"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
            />
          </svg>
        </div>

        <h1 className="text-4xl font-bold mb-4">لا يوجد اتصال بالإنترنت</h1>

        <p className="text-xl text-white/90 mb-8">
          يبدو أنك غير متصل بالإنترنت حالياً
        </p>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-8">
          <p className="text-white/80 mb-4">يرجى التحقق من:</p>
          <ul className="text-right space-y-2 text-white/70">
            <li>✓ اتصال الواي فاي</li>
            <li>✓ بيانات الجوال</li>
            <li>✓ وضع الطيران</li>
          </ul>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="w-full bg-white text-blue-900 font-bold py-4 px-8 rounded-xl hover:bg-blue-50 transition transform hover:scale-105 active:scale-95 shadow-2xl"
        >
          إعادة المحاولة 🔄
        </button>

        <p className="mt-6 text-white/60 text-sm">
          سيتم إعادة الاتصال تلقائياً عند توفر الإنترنت
        </p>
      </div>
    </div>
  )
}

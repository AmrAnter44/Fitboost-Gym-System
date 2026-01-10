'use client'

import { useToast } from '../../contexts/ToastContext'

export default function TestToastPage() {
  const toast = useToast()

  return (
    <div className="container mx-auto p-6" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">🧪 تجربة Toast</h1>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Success */}
            <button
              onClick={() => toast.success('تم بنجاح! ✨')}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-lg font-bold text-lg transition transform hover:scale-105"
            >
              ✅ نجاح
            </button>

            {/* Error */}
            <button
              onClick={() => toast.error('حدث خطأ! 🔴')}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-4 rounded-lg font-bold text-lg transition transform hover:scale-105"
            >
              ❌ خطأ
            </button>

            {/* Warning */}
            <button
              onClick={() => toast.warning('انتبه! ⚠️')}
              className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-4 rounded-lg font-bold text-lg transition transform hover:scale-105"
            >
              ⚠️ تحذير
            </button>

            {/* Info */}
            <button
              onClick={() => toast.info('معلومة مفيدة! 💡')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-lg font-bold text-lg transition transform hover:scale-105"
            >
              ℹ️ معلومات
            </button>

            {/* Multiple Lines */}
            <button
              onClick={() => toast.success('تم إضافة العضو بنجاح!\nرقم العضوية: 1001\nالاشتراك: شهر')}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-4 rounded-lg font-bold text-lg transition transform hover:scale-105 col-span-full"
            >
              📝 رسالة متعددة السطور
            </button>

            {/* Custom Duration */}
            <button
              onClick={() => toast.info('رسالة قصيرة (2 ثانية)', 2000)}
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-4 rounded-lg font-bold text-lg transition transform hover:scale-105"
            >
              ⏱️ قصيرة
            </button>

            <button
              onClick={() => toast.error('رسالة طويلة (8 ثواني)', 8000)}
              className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-4 rounded-lg font-bold text-lg transition transform hover:scale-105"
            >
              ⏰ طويلة
            </button>

            {/* Multiple Toasts */}
            <button
              onClick={() => {
                toast.success('الرسالة الأولى')
                setTimeout(() => toast.info('الرسالة الثانية'), 500)
                setTimeout(() => toast.warning('الرسالة الثالثة'), 1000)
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-lg font-bold text-lg transition transform hover:scale-105 col-span-full"
            >
              🔄 رسائل متعددة
            </button>
          </div>

          {/* Instructions */}
          <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200">
            <h3 className="text-xl font-bold mb-3 text-blue-900">📖 كيفية الاستخدام</h3>
            <div className="space-y-2 text-gray-700">
              <p>• انقر على أي زر لعرض Toast</p>
              <p>• ستظهر الرسائل من الجانب الأيمن</p>
              <p>• يمكن إغلاقها بالنقر على ×</p>
              <p>• تختفي تلقائياً بعد 4 ثواني</p>
              <p>• يتم تكديسها تلقائياً</p>
            </div>
          </div>

          {/* Code Example */}
          <div className="mt-6 p-6 bg-gray-900 rounded-xl text-white">
            <h3 className="text-lg font-bold mb-3 text-green-400">💻 مثال الكود</h3>
            <pre className="text-sm overflow-x-auto" dir="ltr">
              <code>{`import { useToast } from '../contexts/ToastContext'

const MyComponent = () => {
  const toast = useToast()

  const handleClick = () => {
    toast.success('تم بنجاح!')
    toast.error('حدث خطأ!')
    toast.warning('انتبه!')
    toast.info('معلومة!')
  }

  return <button onClick={handleClick}>اضغط</button>
}`}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

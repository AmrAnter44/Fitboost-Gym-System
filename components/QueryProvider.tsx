'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, ReactNode } from 'react'

export default function QueryProvider({ children }: { children: ReactNode }) {
  // إنشاء QueryClient في useState عشان ميتعملش re-create على كل render
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Cache للبيانات لمدة 5 دقائق
            staleTime: 5 * 60 * 1000,
            // الاحتفاظ بالبيانات في الـ cache لمدة 10 دقائق
            gcTime: 10 * 60 * 1000,
            // إعادة المحاولة مرة واحدة فقط في حالة الفشل
            retry: 1,
            // عدم إعادة التحميل عند focus على النافذة (يمكن تفعيله لاحقاً)
            refetchOnWindowFocus: false,
            // عدم إعادة التحميل عند reconnect (يمكن تفعيله لاحقاً)
            refetchOnReconnect: false,
          },
          mutations: {
            // إعادة المحاولة مرة واحدة في حالة فشل الـ mutation
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools - يظهر فقط في development */}
      <ReactQueryDevtools initialIsOpen={false} position="bottom" />
    </QueryClientProvider>
  )
}

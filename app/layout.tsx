import './globals.css'
import type { Metadata } from 'next'
import ClientLayout from '../components/ClientLayout'

export const metadata: Metadata = {
  title: 'نظام إدارة الصالة الرياضية - X GYM',
  description: 'نظام شامل لإدارة صالات الرياضة مع البحث السريع',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="icon" href="/icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-gray-50 min-h-screen">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
import './globals.css'
import type { Metadata } from 'next'
import ClientLayout from '../components/ClientLayout'

export const metadata: Metadata = {
  title: 'نظام إدارة الصالة الرياضية - Gym System',
  description: 'نظام شامل لإدارة صالات الرياضة مع البحث السريع',
  manifest: '/manifest.json',
  themeColor: '#2563eb',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Gym System',
    startupImage: [
      '/icon-512x512.png',
    ],
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    viewportFit: 'cover',
  },
  applicationName: 'Gym System',
  keywords: ['gym', 'fitness', 'management', 'صالة رياضية', 'إدارة', 'جيم'],
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

        {/* PWA Icons - iOS */}
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icon-192x192.png" />

        {/* iOS Splash Screens */}
        <link rel="apple-touch-startup-image" href="/icon-512x512.png" />

        {/* Meta tags for PWA */}
        <meta name="application-name" content="Gym System" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Gym System" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#2563eb" />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* PWA Display Mode */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover" />

        {/* Disable iOS auto-zoom on input focus */}
        <meta name="maximum-scale" content="5" />

        {/* Chrome Android */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#2563eb" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1e40af" media="(prefers-color-scheme: dark)" />

        {/* Local Cairo Font */}
        <link rel="stylesheet" href="/fonts/cairo.css" />
      </head>
      <body className="bg-gray-50 min-h-screen">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
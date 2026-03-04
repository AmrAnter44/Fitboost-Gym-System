// ==========================================
// Error Tracking Stats Endpoint
// ==========================================

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { requirePermission } from '@/lib/permissions'

export const dynamic = 'force-dynamic'

/**
 * GET /api/error-tracking/stats
 *
 * إحصائيات بسيطة عن الأخطاء المسجلة
 *
 * الصلاحية المطلوبة: canAccessAdmin
 *
 * Query Parameters:
 * - days: عدد الأيام للإحصائيات (default: 7)
 * - limit: حد الأخطاء الحرجة المعروضة (default: 10)
 */
export async function GET(request: Request) {
  try {
    // التحقق من المصادقة والصلاحيات
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await requirePermission(user, 'canAccessAdmin')

    // Parse query parameters
    const url = new URL(request.url)
    const daysParam = url.searchParams.get('days')
    const limitParam = url.searchParams.get('limit')

    const days = daysParam ? parseInt(daysParam) : 7
    const limit = limitParam ? parseInt(limitParam) : 10

    // Calculate date range
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Total errors
    const totalErrors = await prisma.errorLog.count({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
    })

    // Errors by type
    const errorsByType = await prisma.errorLog.groupBy({
      by: ['errorType'],
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    })

    // Errors by severity
    const errorsBySeverity = await prisma.errorLog.groupBy({
      by: ['severity'],
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    })

    // Errors by category
    const errorsByCategory = await prisma.errorLog.groupBy({
      by: ['errorCategory'],
      where: {
        createdAt: {
          gte: startDate,
        },
        errorCategory: {
          not: null,
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10,
    })

    // Critical errors (recent)
    const criticalErrors = await prisma.errorLog.findMany({
      where: {
        severity: 'CRITICAL',
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        id: true,
        message: true,
        sanitizedMessage: true,
        errorType: true,
        errorCategory: true,
        endpoint: true,
        statusCode: true,
        createdAt: true,
        isResolved: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    })

    // High severity errors (recent)
    const highSeverityErrors = await prisma.errorLog.findMany({
      where: {
        severity: 'HIGH',
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        id: true,
        message: true,
        sanitizedMessage: true,
        errorType: true,
        errorCategory: true,
        endpoint: true,
        statusCode: true,
        createdAt: true,
        isResolved: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    })

    // Top error endpoints
    const topErrorEndpoints = await prisma.errorLog.groupBy({
      by: ['endpoint'],
      where: {
        createdAt: {
          gte: startDate,
        },
        endpoint: {
          not: null,
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10,
    })

    // Unresolved errors count
    const unresolvedErrors = await prisma.errorLog.count({
      where: {
        isResolved: false,
        createdAt: {
          gte: startDate,
        },
      },
    })

    // Supabase sync status
    const unsyncedErrors = await prisma.errorLog.count({
      where: {
        syncedToSupabase: false,
      },
    })

    // Format response
    return NextResponse.json({
      summary: {
        totalErrors,
        unresolvedErrors,
        unsyncedToSupabase: unsyncedErrors,
        dateRange: {
          from: startDate.toISOString(),
          to: new Date().toISOString(),
          days,
        },
      },
      errorsByType: errorsByType.map((item) => ({
        type: item.errorType,
        count: item._count.id,
      })),
      errorsBySeverity: errorsBySeverity.map((item) => ({
        severity: item.severity,
        count: item._count.id,
      })),
      errorsByCategory: errorsByCategory.map((item) => ({
        category: item.errorCategory,
        count: item._count.id,
      })),
      topErrorEndpoints: topErrorEndpoints.map((item) => ({
        endpoint: item.endpoint,
        count: item._count.id,
      })),
      criticalErrors: criticalErrors.map((error) => ({
        id: error.id,
        message: error.sanitizedMessage || error.message,
        type: error.errorType,
        category: error.errorCategory,
        endpoint: error.endpoint,
        statusCode: error.statusCode,
        createdAt: error.createdAt,
        isResolved: error.isResolved,
      })),
      highSeverityErrors: highSeverityErrors.map((error) => ({
        id: error.id,
        message: error.sanitizedMessage || error.message,
        type: error.errorType,
        category: error.errorCategory,
        endpoint: error.endpoint,
        statusCode: error.statusCode,
        createdAt: error.createdAt,
        isResolved: error.isResolved,
      })),
    })
  } catch (error: any) {
    console.error('Error fetching error stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch error statistics' },
      { status: 500 }
    )
  }
}

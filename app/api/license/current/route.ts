import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)

    // فقط OWNER يمكنه الوصول
    if (user.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 403 }
      )
    }

    const license = await prisma.supabaseLicense.findFirst({
      orderBy: { lastChecked: 'desc' }
    })

    return NextResponse.json({ license })
  } catch (error) {
    console.error('Get current license error:', error)
    return NextResponse.json(
      { error: 'خطأ في الخادم' },
      { status: 500 }
    )
  }
}

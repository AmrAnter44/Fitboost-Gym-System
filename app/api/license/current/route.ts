import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'
import { ensureLinked, getLinkStatus, installShortId } from '../../../../lib/gateway'

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

    let license = await prisma.supabaseLicense.findFirst({
      orderBy: { lastChecked: 'desc' }
    })

    // الجهاز مش مربوط؟ نسأل Control دلوقتي (ممكن يكون اتوافق عليه)
    if (!(license as { gatewayToken?: string | null } | null)?.gatewayToken) {
      if (await ensureLinked(true)) {
        license = await prisma.supabaseLicense.findFirst({ orderBy: { lastChecked: 'desc' } })
      }
    }

    // التوكن مبيرجعش للمتصفح — بنقول بس هو موجود ولا لأ
    const { gatewayToken, ...safe } = (license || {}) as { gatewayToken?: string | null } & Record<string, unknown>
    return NextResponse.json({
      license: license ? { ...safe, linked: Boolean(gatewayToken) } : null,
      device: { id: installShortId(), status: gatewayToken ? 'linked' : getLinkStatus().status }
    })
  } catch (error) {
    console.error('Get current license error:', error)
    return NextResponse.json(
      { error: 'خطأ في الخادم' },
      { status: 500 }
    )
  }
}

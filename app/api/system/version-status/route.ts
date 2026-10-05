// ⬆️ النسخة الحالية مقابل آخر نسخة منشورة — للبار اللي فوق في السيستم
import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../lib/auth'
import { getVersionStatus } from '../../../../lib/versionStatus'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!(await verifyAuth(request))) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
  return NextResponse.json(await getVersionStatus())
}

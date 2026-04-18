import { NextResponse } from 'next/server'
import { validateLicense } from '../../../../lib/license'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const result = await validateLicense()
    return NextResponse.json(result)
  } catch (error) {
    console.error('License validation API error:', error)
    return NextResponse.json(
      {
        valid: false,
        message: 'خطأ في التحقق من الترخيص'
      },
      { status: 500 }
    )
  }
}

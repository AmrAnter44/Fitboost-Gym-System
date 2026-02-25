import { NextResponse } from 'next/server'
import { validateLicense } from '../../../../lib/license'

export const dynamic = 'force-dynamic'


/**
 * POST /api/license/validate
 * Forces a fresh license validation from GitHub
 * Used by the "Recheck" button on the lock screen
 */
export async function POST() {
  try {

    // Force fresh validation (no cache)
    const result = await validateLicense()

    return NextResponse.json({
      isValid: result.valid,
      message: result.message,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error in manual license validation:', error)

    return NextResponse.json({
      isValid: false,
      message: 'فشل فحص الرخصة',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { validateLicense } from '../../../../lib/license'

/**
 * POST /api/license/validate
 * Forces a fresh license validation from GitHub
 * Used by the "Recheck" button on the lock screen
 */
export async function POST() {
  try {
    console.log('🔄 Manual license validation requested')

    // Force fresh validation (no cache)
    const result = await validateLicense()

    return NextResponse.json({
      isValid: result.isValid,
      errorMessage: result.errorMessage,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error in manual license validation:', error)

    return NextResponse.json({
      isValid: false,
      errorMessage: 'فشل فحص الرخصة',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

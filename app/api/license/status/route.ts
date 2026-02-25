import { NextResponse } from 'next/server'
import { validateLicense } from '../../../../lib/license'

export const dynamic = 'force-dynamic'


/**
 * GET /api/license/status
 * Returns the current license status by validating from Supabase
 * Used by client-side polling in LicenseContext
 * This ensures the license is always checked against the server
 */
export async function GET() {
  const requestTimestamp = new Date().toISOString()
  console.log('🌐 [API /license/status] ===== NEW REQUEST =====')
  console.log('🌐 [API /license/status] Request timestamp:', requestTimestamp)

  try {
    // ✅ Validate from Supabase (not cache) to detect changes in real-time
    const status = await validateLicense()

    console.log('📊 [API /license/status] Result from validateLicense():', status)
    console.log('📊 [API /license/status] Returning to client: { isValid:', status.valid, '}')

    return NextResponse.json({
      isValid: status.valid,
      lastChecked: new Date()
    })
  } catch (error) {
    console.error('❌ [API /license/status] Caught error:', error)
    console.error('❌ [API /license/status] Returning isValid: true (failsafe)')

    // Return valid status on error to avoid false lockouts
    return NextResponse.json({
      isValid: true,
      lastChecked: null
    })
  }
}

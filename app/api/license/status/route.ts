import { NextResponse } from 'next/server'
import { getCachedLicenseStatus } from '../../../../lib/license'

/**
 * GET /api/license/status
 * Returns the current cached license status without triggering GitHub fetch
 * Used by client-side polling in LicenseContext
 */
export async function GET() {
  try {
    const status = await getCachedLicenseStatus()

    return NextResponse.json({
      isValid: status.isValid,
      lastChecked: status.lastChecked,
      signature: status.signature
    })
  } catch (error) {
    console.error('Error in license status API:', error)

    // Return valid status on error to avoid false lockouts
    return NextResponse.json({
      isValid: true,
      lastChecked: null,
      signature: null
    })
  }
}

import { prisma } from './prisma'
import { EXTERNAL_LINKS } from './config'

// Expected signature from GitHub
const EXPECTED_SIGNATURE = 'c78d317d35241b1dae62099a4f69b046d6x5435b'

// GitHub raw URL for license file (from centralized config)
const LICENSE_URL = EXTERNAL_LINKS.github.license

interface LicenseFile {
  enabled: boolean
  sig: string
}

/**
 * Validates license by fetching from GitHub and comparing signature
 * Always tries to fetch from GitHub first (no cache check)
 * Falls back to cached validation if GitHub is unreachable
 */
export async function validateLicense(): Promise<{ isValid: boolean; errorMessage?: string }> {
  try {
    // Skip GitHub validation for production domain (always valid)
    const isProductionDomain = process.env.NEXT_PUBLIC_DOMAIN === 'system.xgym.website' ||
                               process.env.NEXT_PUBLIC_APP_URL?.includes('system.xgym.website')

    if (isProductionDomain) {
      console.log('✅ Running on production domain - license is valid')

      // Still update cache
      const now = new Date()
      await prisma.licenseValidation.upsert({
        where: { id: 'singleton' },
        update: {
          isValid: true,
          lastCheckedAt: now,
          errorMessage: null,
          signature: EXPECTED_SIGNATURE
        },
        create: {
          id: 'singleton',
          isValid: true,
          lastCheckedAt: now,
          errorMessage: null,
          signature: EXPECTED_SIGNATURE
        }
      })

      return { isValid: true }
    }

    // Always try to fetch fresh license data from GitHub first
    console.log('🌐 Fetching license from GitHub:', LICENSE_URL)
    const response = await fetch(LICENSE_URL, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache'
      }
    })

    if (!response.ok) {
      throw new Error(`GitHub fetch failed: ${response.status} ${response.statusText}`)
    }

    const licenseData: LicenseFile = await response.json()
    console.log('📄 License data received:', licenseData)

    // Validate signature
    const isValid = licenseData.sig === EXPECTED_SIGNATURE
    const errorMessage = isValid ? null : 'رخصة التشغيل غير صالحة - التوقيع غير متطابق'

    console.log(isValid ? '✅ License is VALID' : '❌ License is INVALID')

    // Update cache in database
    const now = new Date()
    await prisma.licenseValidation.upsert({
      where: { id: 'singleton' },
      update: {
        isValid,
        lastCheckedAt: now,
        errorMessage,
        signature: licenseData.sig
      },
      create: {
        id: 'singleton',
        isValid,
        lastCheckedAt: now,
        errorMessage,
        signature: licenseData.sig
      }
    })

    return { isValid, errorMessage: errorMessage || undefined }

  } catch (error) {
    console.error('❌ License validation error:', error)

    // If fetch failed, try to use cached validation (offline support)
    const cached = await prisma.licenseValidation.findUnique({
      where: { id: 'singleton' }
    })

    if (cached) {
      console.log('⚠️ GitHub unreachable - using last cached validation from:', cached.lastCheckedAt)
      return {
        isValid: cached.isValid,
        errorMessage: cached.errorMessage || undefined
      }
    }

    // No cache exists and fetch failed - default to valid on first run
    console.log('⚠️ First run with no GitHub access - defaulting to VALID')
    const defaultValidation = { isValid: true, errorMessage: undefined }

    try {
      await prisma.licenseValidation.create({
        data: {
          id: 'singleton',
          isValid: true,
          lastCheckedAt: new Date(),
          errorMessage: 'Default validation - no GitHub access on first run'
        }
      })
    } catch (dbError) {
      console.error('Failed to create default cache:', dbError)
    }

    return defaultValidation
  }
}

/**
 * Gets cached license status from database (fast read, no GitHub call)
 * Used for client-side polling
 */
export async function getCachedLicenseStatus(): Promise<{
  isValid: boolean
  lastChecked: Date | null
  signature: string | null
}> {
  try {
    const cached = await prisma.licenseValidation.findUnique({
      where: { id: 'singleton' }
    })

    if (cached) {
      return {
        isValid: cached.isValid,
        lastChecked: cached.lastCheckedAt,
        signature: cached.signature
      }
    }

    // No cache - trigger validation
    const result = await validateLicense()
    return {
      isValid: result.isValid,
      lastChecked: new Date(),
      signature: null
    }
  } catch (error) {
    console.error('Error getting cached license status:', error)
    // Default to valid if can't read cache
    return {
      isValid: true,
      lastChecked: null,
      signature: null
    }
  }
}

/**
 * Server-side guard function for API routes
 * Throws error if license is invalid, blocking the request
 *
 * Usage in API routes:
 * await requireValidLicense()
 */
export async function requireValidLicense(): Promise<void> {
  const result = await validateLicense()

  if (!result.isValid) {
    const errorMsg = result.errorMessage || 'رخصة التشغيل غير صالحة'
    console.error('🚫 License check FAILED -', errorMsg)
    throw new Error(errorMsg)
  }

  console.log('✅ License check passed')
}

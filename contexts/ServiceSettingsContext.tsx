'use client'

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { applyPaletteToDOM } from '../lib/theme/generatePalette'

interface ServiceSettings {
  nutritionEnabled: boolean
  physiotherapyEnabled: boolean
  groupClassEnabled: boolean
  moreEnabled: boolean
  spaEnabled: boolean
  inBodyEnabled: boolean
  poolEnabled: boolean
  padelEnabled: boolean
  assessmentEnabled: boolean
  pointsEnabled: boolean
  pointsPerCheckIn: number
  pointsPerInvitation: number
  pointsPerReferral: number
  pointsPerEGPSpent: number
  pointsValueInEGP: number
  ptCommissionEnabled: boolean
  ptCommissionAmount: number
  moreCommissionEnabled: boolean
  moreCommissionAmount: number
  nutritionReferralEnabled: boolean
  nutritionReferralPercentage: number
  physioReferralEnabled: boolean
  physioReferralPercentage: number
  websiteUrl?: string
  showWebsiteOnReceipts?: boolean
  gymName?: string | null
  gymLogo?: string | null
  primaryColor?: string | null
  remainingEnabled: boolean
}

interface ServiceSettingsContextType {
  settings: ServiceSettings
  loading: boolean
  refetch: () => Promise<void>
}

const CACHE_KEY = 'serviceSettingsCache'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

const ServiceSettingsContext = createContext<ServiceSettingsContextType | undefined>(undefined)

function parseSettings(data: any): ServiceSettings {
  return {
    nutritionEnabled: data.nutritionEnabled,
    physiotherapyEnabled: data.physiotherapyEnabled,
    groupClassEnabled: data.groupClassEnabled,
    moreEnabled: data.moreEnabled ?? true,
    spaEnabled: data.spaEnabled,
    inBodyEnabled: data.inBodyEnabled,
    poolEnabled: data.poolEnabled ?? true,
    padelEnabled: data.padelEnabled ?? true,
    assessmentEnabled: data.assessmentEnabled ?? true,
    pointsEnabled: data.pointsEnabled,
    pointsPerCheckIn: data.pointsPerCheckIn,
    pointsPerInvitation: data.pointsPerInvitation,
    pointsPerReferral: data.pointsPerReferral || 0,
    pointsPerEGPSpent: data.pointsPerEGPSpent,
    pointsValueInEGP: data.pointsValueInEGP,
    ptCommissionEnabled: data.ptCommissionEnabled ?? true,
    ptCommissionAmount: data.ptCommissionAmount ?? 50,
    moreCommissionEnabled: data.moreCommissionEnabled ?? true,
    moreCommissionAmount: data.moreCommissionAmount ?? 50,
    nutritionReferralEnabled: data.nutritionReferralEnabled ?? false,
    nutritionReferralPercentage: data.nutritionReferralPercentage ?? 0,
    physioReferralEnabled: data.physioReferralEnabled ?? false,
    physioReferralPercentage: data.physioReferralPercentage ?? 0,
    websiteUrl: data.websiteUrl || '',
    showWebsiteOnReceipts: data.showWebsiteOnReceipts ?? false,
    gymName: data.gymName || null,
    gymLogo: data.gymLogo || null,
    primaryColor: data.primaryColor || null,
    remainingEnabled: data.remainingEnabled ?? false
  }
}

/** Read gymLogo from dedicated localStorage key (set by upload handler & blocking script) */
function getSavedGymLogo(): string | null {
  try {
    return localStorage.getItem('gymLogo') || null
  } catch {}
  return null
}

/** Load cached settings from localStorage (instant, no network) */
function loadCachedSettings(): ServiceSettings | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null
    const { data, ts } = JSON.parse(cached)
    // Return cached data even if stale — we'll revalidate in background
    if (data) {
      const parsed = parseSettings(data)
      // Recover gymLogo from dedicated localStorage key if missing in cache
      if (!parsed.gymLogo) {
        const savedLogo = getSavedGymLogo()
        if (savedLogo) parsed.gymLogo = savedLogo
      }
      return parsed
    }
  } catch {}
  return null
}

/** Save settings to localStorage cache */
function saveCacheSettings(data: any) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }))
  } catch {}
}

/** Check if cache is fresh (within TTL) */
function isCacheFresh(): boolean {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return false
    const { ts } = JSON.parse(cached)
    return Date.now() - ts < CACHE_TTL
  } catch {}
  return false
}

function getDefaultSettings(): ServiceSettings {
  return {
    nutritionEnabled: true,
    physiotherapyEnabled: true,
    groupClassEnabled: true,
    moreEnabled: true,
    spaEnabled: true,
    inBodyEnabled: true,
    poolEnabled: true,
    padelEnabled: true,
    assessmentEnabled: true,
    pointsEnabled: true,
    pointsPerCheckIn: 1,
    pointsPerInvitation: 2,
    pointsPerReferral: 0,
    pointsPerEGPSpent: 0.1,
    pointsValueInEGP: 0.1,
    ptCommissionEnabled: true,
    ptCommissionAmount: 50,
    moreCommissionEnabled: true,
    moreCommissionAmount: 50,
    nutritionReferralEnabled: false,
    nutritionReferralPercentage: 0,
    physioReferralEnabled: false,
    physioReferralPercentage: 0,
    websiteUrl: '',
    showWebsiteOnReceipts: false,
    remainingEnabled: false,
    gymName: null,
    // Use cached logo from blocking script or localStorage for instant display
    gymLogo: typeof window !== 'undefined'
      ? (window as any).__CACHED_GYM_LOGO || getSavedGymLogo() || null
      : null,
    primaryColor: typeof window !== 'undefined'
      ? localStorage.getItem('primaryColor') || null
      : null
  }
}

export function ServiceSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ServiceSettings>(() => {
    // Stale-while-revalidate: show cached data instantly
    if (typeof window !== 'undefined') {
      const cached = loadCachedSettings()
      if (cached) return cached
    }
    return getDefaultSettings()
  })
  const [loading, setLoading] = useState(() => {
    // If we have cached data, don't show loading
    if (typeof window !== 'undefined') return !loadCachedSettings()
    return true
  })

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings/services')
      if (response.ok) {
        const data = await response.json()
        const parsed = parseSettings(data)

        // Recover gymLogo from localStorage if API returned null but we have a saved value
        if (!parsed.gymLogo) {
          const savedLogo = getSavedGymLogo()
          if (savedLogo) parsed.gymLogo = savedLogo
        }

        setSettings(parsed)
        saveCacheSettings(data)

        // Cache logo URL in localStorage for blocking script
        if (parsed.gymLogo) {
          localStorage.setItem('gymLogo', parsed.gymLogo)
        } else {
          localStorage.removeItem('gymLogo')
        }
      } else if (response.status === 401) {
        // Not logged in yet — retry once after a delay (login redirect will cause full reload anyway)
        setTimeout(() => {
          fetch('/api/settings/services')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (data) {
                const parsed = parseSettings(data)
                if (!parsed.gymLogo) {
                  const savedLogo = getSavedGymLogo()
                  if (savedLogo) parsed.gymLogo = savedLogo
                }
                setSettings(parsed)
                saveCacheSettings(data)
                if (parsed.gymLogo) {
                  localStorage.setItem('gymLogo', parsed.gymLogo)
                }
              }
            })
            .catch(() => {})
        }, 3000)
      }
    } catch (error) {
      console.error('Error fetching service settings:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isCacheFresh()) {
      // Cache is fresh — mark loaded instantly, but still revalidate in background
      setLoading(false)
      fetchSettings()
    } else {
      // Cache is stale or missing — fetch from network
      fetchSettings()
    }
  }, [])

  // تطبيق اللون الأساسي فقط عند تغيير فعلي
  const prevColor = useRef<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('primaryColor') : null
  )
  useEffect(() => {
    if (settings.primaryColor && settings.primaryColor !== prevColor.current) {
      prevColor.current = settings.primaryColor
      applyPaletteToDOM(settings.primaryColor)
      localStorage.setItem('primaryColor', settings.primaryColor)
    } else if (!settings.primaryColor && prevColor.current) {
      prevColor.current = null
      localStorage.removeItem('primaryColor')
      const root = document.documentElement
      const shades = ['50','100','200','300','400','500','600','700','800','900','950']
      shades.forEach(s => {
        root.style.removeProperty(`--color-primary-${s}`)
        root.style.removeProperty(`--color-primary-${s}-rgb`)
      })
    }
  }, [settings.primaryColor])

  return (
    <ServiceSettingsContext.Provider value={{ settings, loading, refetch: fetchSettings }}>
      {children}
    </ServiceSettingsContext.Provider>
  )
}

export function useServiceSettings() {
  const context = useContext(ServiceSettingsContext)
  if (!context) {
    throw new Error('useServiceSettings must be used within ServiceSettingsProvider')
  }
  return context
}

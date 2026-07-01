/**
 * Country dial codes for the phone-number country selector.
 * Egypt is first → the default. Framework-free, no external dependency.
 */
export interface Country {
  code: string // ISO 3166-1 alpha-2
  nameAr: string
  nameEn: string
  dial: string // calling code without '+'
  flag: string
}

export const COUNTRIES: Country[] = [
  { code: 'EG', nameAr: 'مصر', nameEn: 'Egypt', dial: '20', flag: '🇪🇬' },
  { code: 'SA', nameAr: 'السعودية', nameEn: 'Saudi Arabia', dial: '966', flag: '🇸🇦' },
  { code: 'AE', nameAr: 'الإمارات', nameEn: 'UAE', dial: '971', flag: '🇦🇪' },
  { code: 'KW', nameAr: 'الكويت', nameEn: 'Kuwait', dial: '965', flag: '🇰🇼' },
  { code: 'QA', nameAr: 'قطر', nameEn: 'Qatar', dial: '974', flag: '🇶🇦' },
  { code: 'BH', nameAr: 'البحرين', nameEn: 'Bahrain', dial: '973', flag: '🇧🇭' },
  { code: 'OM', nameAr: 'عُمان', nameEn: 'Oman', dial: '968', flag: '🇴🇲' },
  { code: 'JO', nameAr: 'الأردن', nameEn: 'Jordan', dial: '962', flag: '🇯🇴' },
  { code: 'LB', nameAr: 'لبنان', nameEn: 'Lebanon', dial: '961', flag: '🇱🇧' },
  { code: 'IQ', nameAr: 'العراق', nameEn: 'Iraq', dial: '964', flag: '🇮🇶' },
  { code: 'SY', nameAr: 'سوريا', nameEn: 'Syria', dial: '963', flag: '🇸🇾' },
  { code: 'PS', nameAr: 'فلسطين', nameEn: 'Palestine', dial: '970', flag: '🇵🇸' },
  { code: 'LY', nameAr: 'ليبيا', nameEn: 'Libya', dial: '218', flag: '🇱🇾' },
  { code: 'SD', nameAr: 'السودان', nameEn: 'Sudan', dial: '249', flag: '🇸🇩' },
  { code: 'MA', nameAr: 'المغرب', nameEn: 'Morocco', dial: '212', flag: '🇲🇦' },
  { code: 'DZ', nameAr: 'الجزائر', nameEn: 'Algeria', dial: '213', flag: '🇩🇿' },
  { code: 'TN', nameAr: 'تونس', nameEn: 'Tunisia', dial: '216', flag: '🇹🇳' },
  { code: 'TR', nameAr: 'تركيا', nameEn: 'Turkey', dial: '90', flag: '🇹🇷' },
  { code: 'GB', nameAr: 'بريطانيا', nameEn: 'United Kingdom', dial: '44', flag: '🇬🇧' },
  { code: 'US', nameAr: 'أمريكا', nameEn: 'United States', dial: '1', flag: '🇺🇸' },
]

export const DEFAULT_COUNTRY: Country = COUNTRIES[0] // Egypt

/**
 * Composes the value to STORE from a national input + selected country.
 * - Egypt → store the input as-is (keeps legacy "01..." format, no migration).
 * - Other → store E.164 "+<dial><national without leading 0(s)>".
 */
export function composeStoredPhone(localInput: string, countryCode: string): string {
  const v = (localInput || '').trim()
  if (!v) return v
  const c = COUNTRIES.find(x => x.code === countryCode) ?? DEFAULT_COUNTRY
  if (c.code === 'EG') return v
  const national = v.replace(/\D/g, '').replace(/^0+/, '')
  if (!national) return ''
  return '+' + c.dial + national
}

/**
 * Best-effort: detect country + national part from a stored phone (edit mode).
 * Returns Egypt + the raw value when it isn't a recognizable "+<dial>" number.
 */
export function parseStoredPhone(stored: string): { countryCode: string; national: string } {
  const v = (stored || '').trim()
  if (v.startsWith('+')) {
    const digits = v.slice(1).replace(/\D/g, '')
    // longest dial match wins (e.g. '971' before '97')
    const match = [...COUNTRIES]
      .sort((a, b) => b.dial.length - a.dial.length)
      .find(c => digits.startsWith(c.dial))
    if (match) {
      return { countryCode: match.code, national: digits.slice(match.dial.length) }
    }
  }
  return { countryCode: DEFAULT_COUNTRY.code, national: v }
}

export const getPackageName = (
  startDate: string | undefined,
  expiryDate: string | undefined,
  locale: string = 'ar'
): string => {
  if (!startDate || !expiryDate) return '-'

  const start = new Date(startDate)
  const expiry = new Date(expiryDate)
  const diffTime = expiry.getTime() - start.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return '-'

  const months = Math.round(diffDays / 30)

  if (locale === 'ar') {
    if (diffDays >= 330 && diffDays <= 395) return 'سنة'
    else if (diffDays >= 165 && diffDays <= 195) return '6 شهور'
    else if (diffDays >= 85 && diffDays <= 95) return '3 شهور'
    else if (diffDays >= 55 && diffDays <= 65) return 'شهرين'
    else if (diffDays >= 25 && diffDays <= 35) return 'شهر'
    else if (diffDays >= 10 && diffDays <= 17) return 'أسبوعين'
    else if (diffDays >= 5 && diffDays <= 9) return 'أسبوع'
    else if (diffDays === 1) return 'يوم'
    else if (months > 0) return `${months} ${months === 1 ? 'شهر' : months === 2 ? 'شهرين' : 'شهور'}`
    else return `${diffDays} ${diffDays === 1 ? 'يوم' : diffDays === 2 ? 'يومين' : 'أيام'}`
  } else {
    if (diffDays >= 330 && diffDays <= 395) return 'Year'
    else if (diffDays >= 165 && diffDays <= 195) return '6 Months'
    else if (diffDays >= 85 && diffDays <= 95) return '3 Months'
    else if (diffDays >= 55 && diffDays <= 65) return '2 Months'
    else if (diffDays >= 25 && diffDays <= 35) return 'Month'
    else if (diffDays >= 10 && diffDays <= 17) return '2 Weeks'
    else if (diffDays >= 5 && diffDays <= 9) return 'Week'
    else if (diffDays === 1) return 'Day'
    else if (months > 0) return `${months} ${months === 1 ? 'Month' : 'Months'}`
    else return `${diffDays} ${diffDays === 1 ? 'Day' : 'Days'}`
  }
}

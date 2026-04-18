// API functions for receipts
export async function fetchReceipts() {
  const response = await fetch('/api/receipts')

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED')
  }

  if (response.status === 403) {
    throw new Error('FORBIDDEN')
  }

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'فشل جلب الإيصالات')
  }

  const data = await response.json()

  if (!Array.isArray(data)) {
    console.error('البيانات المستلمة ليست array:', data)
    return []
  }

  return data
}

export async function fetchNextReceiptNumber() {
  const response = await fetch('/api/receipts/next-number')

  if (!response.ok) {
    throw new Error('فشل جلب رقم الإيصال التالي')
  }

  const data = await response.json()
  return data.nextNumber
}

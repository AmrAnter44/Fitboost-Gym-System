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

// 🗓️ جلب الإيصالات في نطاق تاريخ — لصفحة التقارير بدل تحميل كل الإيصالات
export async function fetchReceiptsByDateRange(startDate: string, endDate: string) {
  const params = new URLSearchParams()
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  const response = await fetch(`/api/receipts?${params.toString()}`)

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || 'فشل جلب الإيصالات')
  }

  const data = await response.json()
  return Array.isArray(data) ? data : []
}

export interface ReceiptsPage {
  receipts: any[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
  todayCount?: number
  todayRevenue?: number
}

export interface ReceiptsServerQuery {
  page: number
  pageSize: number
  search?: string
  types?: string[]
  payment?: string
}

// 🚀 صفحة واحدة من السيرفر بالبحث والفلاتر — بديل تحميل كل الإيصالات وفلترتها محليًا
export async function fetchReceiptsServerPage(q: ReceiptsServerQuery): Promise<ReceiptsPage> {
  const params = new URLSearchParams()
  params.set('page', String(q.page))
  params.set('pageSize', String(q.pageSize))
  if (q.search) params.set('search', q.search)
  if (q.types && q.types.length > 0) params.set('types', q.types.join(','))
  if (q.payment) params.set('payment', q.payment)

  const response = await fetch(`/api/receipts?${params.toString()}`)

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || 'فشل جلب الإيصالات')
  }

  const data = await response.json()
  return {
    receipts: Array.isArray(data?.receipts) ? data.receipts : [],
    total: data?.total ?? 0,
    page: data?.page ?? q.page,
    pageSize: data?.pageSize ?? q.pageSize,
    hasMore: !!data?.hasMore,
    todayCount: data?.todayCount ?? 0,
    todayRevenue: data?.todayRevenue ?? 0,
  }
}

// 🚀 Paginated chunk fetch — تحميل الإيصالات على دفعات
export async function fetchReceiptsPage(page: number, pageSize: number = 300): Promise<ReceiptsPage> {
  const response = await fetch(`/api/receipts?page=${page}&pageSize=${pageSize}`)

  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (response.status === 403) throw new Error('FORBIDDEN')

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || 'فشل جلب الإيصالات')
  }

  const data = await response.json()

  // backward-compat: لو السيرفر رجّع array (مش paginated)
  if (Array.isArray(data)) {
    return { receipts: data, total: data.length, page, pageSize, hasMore: false }
  }

  return {
    receipts: Array.isArray(data?.receipts) ? data.receipts : [],
    total: data?.total ?? 0,
    page: data?.page ?? page,
    pageSize: data?.pageSize ?? pageSize,
    hasMore: !!data?.hasMore,
  }
}

export async function fetchNextReceiptNumber() {
  const response = await fetch('/api/receipts/next-number')

  if (!response.ok) {
    throw new Error('فشل جلب رقم الإيصال التالي')
  }

  const data = await response.json()
  return data.nextNumber
}

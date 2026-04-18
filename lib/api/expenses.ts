// API functions for expenses
import { fetchWithAuth } from './common'

export async function fetchExpenses() {
  return fetchWithAuth<any[]>('/api/expenses', 'فشل جلب المصروفات')
}

// API functions for staff
import { fetchWithAuth } from './common'

export async function fetchStaff() {
  return fetchWithAuth<any[]>('/api/staff', 'فشل جلب بيانات الموظفين')
}

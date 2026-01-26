/**
 * API Client for communicating with the main system
 * استدعاء APIs من النظام الأساسي (system.xgym.website)
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

export interface ApiResponse<T = any> {
  success?: boolean;
  error?: string;
  data?: T;
  [key: string]: any;
}

/**
 * Make API request to main system
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'حدث خطأ',
        ...data,
      };
    }

    return {
      success: true,
      ...data,
    };
  } catch (error) {
    console.error('API Request Error:', error);
    return {
      success: false,
      error: 'فشل الاتصال بالخادم',
    };
  }
}

/**
 * Verify member credentials (login)
 */
export async function verifyMemberCredentials(
  memberNumber: number,
  phoneNumber: string
): Promise<ApiResponse> {
  return apiRequest('/api/public/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ memberNumber, phoneNumber }),
  });
}

/**
 * Get member profile
 */
export async function getMemberProfile(memberId: string): Promise<ApiResponse> {
  return apiRequest(`/api/public/member/${memberId}/profile`);
}

/**
 * Get member check-ins
 */
export async function getMemberCheckIns(
  memberId: string,
  params?: { limit?: number; offset?: number }
): Promise<ApiResponse> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());

  const queryString = query.toString();
  const endpoint = `/api/public/member/${memberId}/checkins${queryString ? `?${queryString}` : ''}`;

  return apiRequest(endpoint);
}

/**
 * Get member receipts
 */
export async function getMemberReceipts(
  memberId: string,
  params?: { limit?: number; offset?: number }
): Promise<ApiResponse> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());

  const queryString = query.toString();
  const endpoint = `/api/public/member/${memberId}/receipts${queryString ? `?${queryString}` : ''}`;

  return apiRequest(endpoint);
}

/**
 * Get member spa bookings
 */
export async function getMemberSpaBookings(
  memberId: string,
  params?: { limit?: number; offset?: number; status?: string }
): Promise<ApiResponse> {
  const query = new URLSearchParams();
  if (params?.limit) query.set('limit', params.limit.toString());
  if (params?.offset) query.set('offset', params.offset.toString());
  if (params?.status) query.set('status', params.status);

  const queryString = query.toString();
  const endpoint = `/api/public/member/${memberId}/spa${queryString ? `?${queryString}` : ''}`;

  return apiRequest(endpoint);
}

/**
 * Get member freeze requests
 */
export async function getMemberFreezeRequests(memberId: string): Promise<ApiResponse> {
  return apiRequest(`/api/public/member/${memberId}/freeze`);
}

/**
 * Create new freeze request
 */
export async function createFreezeRequest(
  memberId: string,
  data: { startDate: string; days: number; reason: string | null }
): Promise<ApiResponse> {
  return apiRequest(`/api/public/member/${memberId}/freeze`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

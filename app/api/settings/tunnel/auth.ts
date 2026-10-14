import { verifyAuth } from '../../../../lib/auth'
import { requireInternalToken } from '../../../../lib/internalAuth'

export type TunnelCaller = { internal: boolean }

/**
 * مين يقدر يكلّم مسارات التونل:
 *  - Electron main (فحص التشغيل + التقارير) بالـ x-internal-token
 *  - الأونر/الأدمن من صفحة الإعدادات (كوكي الدخول)
 * بيرجّع null لو مش مسموح.
 */
export async function authorizeTunnelCaller(request: Request): Promise<{ caller: TunnelCaller } | { status: number; error: string }> {
  if (request.headers.get('x-internal-token')) {
    try {
      requireInternalToken(request)
      return { caller: { internal: true } }
    } catch {
      return { status: 401, error: 'Unauthorized' }
    }
  }
  const user = await verifyAuth(request)
  if (!user) return { status: 401, error: 'Unauthorized' }
  if (user.role !== 'OWNER' && user.role !== 'ADMIN') return { status: 403, error: 'Forbidden' }
  return { caller: { internal: false } }
}

/**
 * 📱 إشعارات أبلكيشن FB Team (Expo Push) — مهمة جديدة، رد الأجازة، خصم/مكافأة.
 * أي فشل هنا مايوقفش العملية الأصلية (fire-and-forget).
 */
import { prisma } from './prisma'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

type Msg = { title: string; body: string; path?: string }

async function sendToUsers(userIds: string[], msg: Msg) {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (ids.length === 0) return
  const rows = await prisma.staffPushToken.findMany({ where: { userId: { in: ids } } })
  if (rows.length === 0) return
  const messages = rows.map(r => ({
    to: r.token,
    title: msg.title,
    body: msg.body,
    sound: 'default',
    priority: 'high',
    channelId: 'default',
    data: { origin: r.origin, path: msg.path || '/me' },
  }))
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100)
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(chunk),
      signal: AbortSignal.timeout(10_000),
    })
    const j: any = await res.json().catch(() => null)
    // توكن اتلغى (الأبلكيشن اتمسح) → نشيله
    const dead: string[] = []
    ;(j?.data || []).forEach((t: any, k: number) => {
      if (t?.status === 'error' && t?.details?.error === 'DeviceNotRegistered') dead.push(chunk[k].to)
    })
    if (dead.length) await prisma.staffPushToken.deleteMany({ where: { token: { in: dead } } })
  }
}

async function usersOfStaff(staffIds: string[]): Promise<string[]> {
  const users = await prisma.user.findMany({ where: { staffId: { in: staffIds } }, select: { id: true } })
  return users.map(u => u.id)
}

function fire(p: Promise<unknown>) {
  p.catch(e => console.error('teamPush:', e?.message || e))
}

export function pushTaskAssigned(userIds: string[], title: string) {
  fire(sendToUsers(userIds, { title: '📋 مهمة جديدة', body: title, path: '/tasks' }))
}

export function pushLeaveDecision(staffId: string, status: string) {
  if (status !== 'approved' && status !== 'rejected') return
  fire(
    usersOfStaff([staffId]).then(ids =>
      sendToUsers(ids, {
        title: status === 'approved' ? '✅ الأجازة اتوافق عليها' : '❌ الأجازة اترفضت',
        body: status === 'approved' ? 'طلب الأجازة بتاعك اتقبل' : 'طلب الأجازة بتاعك اترفض — كلّم المدير',
        path: '/my-payslips',
      })
    )
  )
}

export function pushMoney(staffIds: string[], kind: 'bonus' | 'deduction', amount: number, reason: string) {
  const amt = Math.round(amount).toLocaleString('en-US')
  fire(
    usersOfStaff(staffIds).then(ids =>
      sendToUsers(ids, {
        title: kind === 'bonus' ? `🎉 مكافأة ${amt} ج.م` : `➖ خصم ${amt} ج.م`,
        body: reason,
        path: '/me/money',
      })
    )
  )
}

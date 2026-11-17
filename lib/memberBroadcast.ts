/**
 * 📣 إشعار جماعي لكل أعضاء الفرع اللي عندهم أبلكيشن الأعضاء (Expo push).
 * بيبعت على دفعات (100 في الطلب) بدل جهاز جهاز، والتوكنات الميتة بتتشال.
 */
import { Expo, ExpoPushMessage } from 'expo-server-sdk'
import { prisma } from './prisma'

const expo = new Expo()

//  🎯 فلاتر الجمهور: الأعضاء (ناشط / قرب يخلص / منتهي) والـ PT (ناشط / منتهي). فاضية = كل الأعضاء.
export const AUDIENCE_SEGMENTS = ['members-active', 'members-expiring', 'members-expired', 'pt-active', 'pt-expired'] as const
export type AudienceSegment = (typeof AUDIENCE_SEGMENTS)[number]
export const EXPIRING_DAYS = 7

export function parseSegments(v: unknown): AudienceSegment[] {
  const arr = Array.isArray(v) ? v : typeof v === 'string' && v ? v.split(',') : []
  return [...new Set(arr.filter((s): s is AudienceSegment => (AUDIENCE_SEGMENTS as readonly string[]).includes(String(s))))]
}

async function audienceWhere(segments: AudienceSegment[] = []) {
  if (!segments.length) return {}
  const now = new Date()
  const soon = new Date(now.getTime() + EXPIRING_DAYS * 86400_000)
  const or: any[] = []
  if (segments.includes('members-active')) or.push({ expiryDate: { gte: now } })
  if (segments.includes('members-expiring')) or.push({ expiryDate: { gte: now, lte: soon } })
  if (segments.includes('members-expired')) or.push({ expiryDate: { lt: now } })
  const ptActive = segments.includes('pt-active'), ptExpired = segments.includes('pt-expired')
  if (ptActive || ptExpired) {
    const activeWhere = { sessionsRemaining: { gt: 0 }, OR: [{ expiryDate: null }, { expiryDate: { gte: now } }] }
    const pts = await prisma.pT.findMany({
      where: ptActive && ptExpired ? {} : ptActive ? activeWhere : { NOT: activeWhere },
      select: { phone: true },
    })
    const phones = [...new Set(pts.map(p => p.phone).filter(Boolean))]
    if (phones.length) or.push({ phone: { in: phones } })
  }
  return or.length ? { OR: or } : { id: '__none__' }
}

async function audienceTokens(segments?: AudienceSegment[]) {
  const rows = await prisma.member.findMany({ where: { pushToken: { not: null }, ...(await audienceWhere(segments)) }, select: { pushToken: true } })
  return [...new Set(rows.map(r => r.pushToken as string).filter(t => t && Expo.isExpoPushToken(t)))]
}

/** عدد الأعضاء في الفلتر (كلهم — حتى اللي معندهمش الأبلكيشن) */
export async function countAudienceMembers(segments?: AudienceSegment[]): Promise<number> {
  return prisma.member.count({ where: await audienceWhere(segments) })
}

export async function countMemberDevices(segments?: AudienceSegment[]): Promise<number> {
  return (await audienceTokens(segments)).length
}

export async function broadcastToMembers(msg: { title: string; body: string; data?: Record<string, any> }, segments?: AudienceSegment[]) {
  const rows = (await audienceTokens(segments)).map(pushToken => ({ pushToken }))
  const tokens = [...new Set(rows.map(r => r.pushToken as string).filter(t => Expo.isExpoPushToken(t)))]
  const messages: ExpoPushMessage[] = tokens.map(to => ({
    to, title: msg.title, body: msg.body, data: msg.data || {}, sound: 'default', priority: 'high', channelId: 'default',
  }))
  let sent = 0
  const dead: string[] = []
  for (const chunk of expo.chunkPushNotifications(messages)) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk)
      tickets.forEach((t, i) => {
        if (t.status === 'ok') sent++
        else if ((t as any).details?.error === 'DeviceNotRegistered') dead.push(String(chunk[i].to))
      })
    } catch (e) {
      console.error('broadcast chunk:', e instanceof Error ? e.message : e)
    }
  }
  if (dead.length) {
    await prisma.member.updateMany({ where: { pushToken: { in: dead } }, data: { pushToken: null } }).catch(() => {})
  }
  return { total: tokens.length, sent }
}

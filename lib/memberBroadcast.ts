/**
 * 📣 إشعار جماعي لكل أعضاء الفرع اللي عندهم أبلكيشن الأعضاء (Expo push).
 * بيبعت على دفعات (100 في الطلب) بدل جهاز جهاز، والتوكنات الميتة بتتشال.
 */
import { Expo, ExpoPushMessage } from 'expo-server-sdk'
import { prisma } from './prisma'

const expo = new Expo()

export async function countMemberDevices(): Promise<number> {
  const rows = await prisma.member.findMany({ where: { pushToken: { not: null } }, select: { pushToken: true } })
  return new Set(rows.map(r => r.pushToken).filter(t => t && Expo.isExpoPushToken(t))).size
}

export async function broadcastToMembers(msg: { title: string; body: string; data?: Record<string, any> }) {
  const rows = await prisma.member.findMany({ where: { pushToken: { not: null } }, select: { pushToken: true } })
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

/**
 * 🎂 تهنئة عيد الميلاد على أبلكيشن الأعضاء (FB Gym App / Town Gym …)
 * - مرة واحدة في السنة لكل عضو (Member.birthdayGreetYear — الحجز ذرّي فمفيش تكرار
 *   حتى لو الفحص اتنادى مرتين في نفس الوقت).
 * - مستقلة عن نقاط عيد الميلاد: التهنئة بتتبعت حتى لو النقاط مقفولة،
 *   ولو النقاط اتضافت الرسالة بتقول كده.
 */
import { prisma } from './prisma'
import { sendPushNotification } from './pushNotifications'

type BirthdayMember = { id: string; name: string }

export async function sendBirthdayGreetings(
  members: BirthdayMember[],
  opts: { year: number; gymName?: string | null; pointsAwarded?: Set<string>; points?: number }
) {
  let sent = 0
  for (const m of members) {
    try {
      // حجز ذرّي: يتحدّث بس لو لسه ماتبعتلوش السنة دي
      const claimed = await prisma.member.updateMany({
        where: {
          id: m.id,
          pushToken: { not: null },
          OR: [{ birthdayGreetYear: null }, { birthdayGreetYear: { not: opts.year } }],
        },
        data: { birthdayGreetYear: opts.year },
      })
      if (claimed.count !== 1) continue

      const member = await prisma.member.findUnique({ where: { id: m.id }, select: { pushToken: true } })
      if (!member?.pushToken) continue

      const first = (m.name || '').trim().split(/\s+/)[0] || ''
      const gym = (opts.gymName || '').trim()
      const gotPoints = !!opts.points && opts.pointsAwarded?.has(m.id)
      const body = [
        gym ? `فريق ${gym} بيتمنالك سنة مليانة صحة وقوة 💪` : 'بنتمنالك سنة مليانة صحة وقوة 💪',
        gotPoints ? `🎁 هديتك ${opts.points} نقطة اتضافت لحسابك` : '',
      ].filter(Boolean).join('\n')

      const r = await sendPushNotification(member.pushToken, {
        title: first ? `🎂 كل سنة وإنت طيب يا ${first}!` : '🎂 كل سنة وإنت طيب!',
        body,
        data: { type: 'birthday' },
        sound: 'default',
      })
      if (r.success) sent++
    } catch (e) {
      console.error('birthday greeting:', e instanceof Error ? e.message : e)
    }
  }
  return sent
}

// 🌐 كل عناوين IPv4 المحلية — مش أول واحد بس
//
//  المسارات الموجودة (`network/local-ip` و `system/ip`) بترجّع **أول** IPv4
//  غير داخلي. على جهاز فيه VirtualBox أو VPN أو كارتين شبكة، ده بيطلع
//  عنوان مالوش لازمة (زي 192.168.56.1 بتاع VirtualBox) — والموظف بيكتبه في
//  إعدادات البوابة والأحداث ماتوصلش، من غير أي رسالة خطأ توضّح ليه.
//
//  هنا بنرجّع الكل مرتّبين، والواجهة بترشّح اللي على نفس شبكة الجهاز.
import { NextResponse } from 'next/server'
import os from 'os'
import { verifyAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

//  نطاقات الشبكات المحلية الحقيقية — بنقدّمها على غيرها
const isPrivate = (ip: string) =>
  /^192\.168\./.test(ip) || /^10\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)

//  واجهات وهمية بتتعمل من برامج تانية — بتتأخّر في الترتيب
const VIRTUAL = /^(vboxnet|vmnet|docker|br-|veth|utun|awdl|llw|bridge|tap|tun)/i

export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ success: false, addresses: [] }, { status: 401 })

    const nets = os.networkInterfaces()
    const found: { ip: string; virtual: boolean }[] = []

    for (const [name, addrs] of Object.entries(nets)) {
      for (const a of addrs ?? []) {
        if (a.family !== 'IPv4' || a.internal) continue
        found.push({ ip: a.address, virtual: VIRTUAL.test(name) })
      }
    }

    const addresses = found
      .sort((a, b) => {
        //  الحقيقي قبل الوهمي، والخاص قبل غيره
        if (a.virtual !== b.virtual) return a.virtual ? 1 : -1
        const pa = isPrivate(a.ip) ? 0 : 1
        const pb = isPrivate(b.ip) ? 0 : 1
        return pa - pb
      })
      .map(f => f.ip)

    return NextResponse.json({
      success: true,
      addresses,
      port: process.env.PORT || '4001',
    })
  } catch {
    return NextResponse.json({ success: false, addresses: [] }, { status: 500 })
  }
}

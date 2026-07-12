// app/api/system/stats/route.ts
import { NextResponse } from 'next/server'
import os from 'os'
import si from 'systeminformation'
import { verifyAuth } from '../../../../lib/auth'
import { ensureSamplerStarted } from '../../../../lib/systemStatsLogger'

export const dynamic = 'force-dynamic'

// كاش قصير: عدة أجهزة/تابات بتسأل في نفس الوقت — قراءة واحدة تكفيهم
let cache: { data: unknown; at: number } | null = null
const CACHE_TTL_MS = 2000

export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    // شريط التابات بيسأل الـ endpoint ده باستمرار — أنسب مكان لبدء سجل الأداء
    ensureSamplerStarted()

    if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
      return NextResponse.json(cache.data)
    }

    const [mem, load, temp, cpu, fs] = await Promise.all([
      si.mem(),
      si.currentLoad(),
      si.cpuTemperature().catch(() => ({ main: null as number | null })),
      si.cpu().catch(() => null),
      si.fsSize().catch(() => [] as Awaited<ReturnType<typeof si.fsSize>>),
    ])

    // القرص الرئيسي = الأكبر حجمًا (عادةً قرص النظام)
    const mainDisk = fs.filter(d => d.size > 0).sort((a, b) => b.size - a.size)[0] ?? null

    const usedMem = mem.total - mem.available
    const data = {
      mem: {
        total: mem.total,
        used: usedMem,
        percent: Math.round((usedMem / mem.total) * 100),
      },
      cpu: {
        load: Math.round(load.currentLoad),
        cores: cpu?.cores ?? os.cpus().length,
        model: cpu ? `${cpu.manufacturer} ${cpu.brand}`.trim() : os.cpus()[0]?.model ?? '',
      },
      // بعض الأجهزة (خاصة بدون صلاحيات admin على ويندوز) لا توفر قراءة الحرارة
      temp: typeof temp.main === 'number' && temp.main > 0 ? Math.round(temp.main) : null,
      disk: mainDisk
        ? { total: mainDisk.size, used: mainDisk.used, percent: Math.round(mainDisk.use) }
        : null,
      uptime: Math.round(os.uptime()),
      appMem: process.memoryUsage().rss,
    }

    cache = { data, at: Date.now() }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error reading system stats:', error)
    return NextResponse.json({ error: 'فشل قراءة بيانات الجهاز' }, { status: 500 })
  }
}

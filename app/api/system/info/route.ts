// app/api/system/info/route.ts
import { NextResponse } from 'next/server'
import fs from 'fs'
import os from 'os'
import path from 'path'
import si from 'systeminformation'
import { verifyAuth } from '../../../../lib/auth'
import { ensureSamplerStarted } from '../../../../lib/systemStatsLogger'

export const dynamic = 'force-dynamic'

// المعلومات الثابتة لا تتغير أثناء التشغيل — تُقرأ مرة واحدة لكل عملية
let staticInfo: Record<string, unknown> | null = null

function readAppVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'))
    return pkg.version ?? ''
  } catch {
    return ''
  }
}

export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    ensureSamplerStarted()

    if (!staticInfo) {
      const [osInfo, system, cpu, mem, graphics, net] = await Promise.all([
        si.osInfo(),
        si.system().catch(() => null),
        si.cpu(),
        si.mem(),
        si.graphics().catch(() => ({ controllers: [] as { model?: string }[] })),
        si.networkInterfaces('default').catch(() => null),
      ])

      const defaultNet = Array.isArray(net) ? net[0] : net

      staticInfo = {
        os: {
          platform: osInfo.platform,
          distro: osInfo.distro,
          release: osInfo.release,
          arch: osInfo.arch,
          hostname: osInfo.hostname,
        },
        device: system
          ? { manufacturer: system.manufacturer || '', model: system.model || '' }
          : null,
        cpu: {
          model: `${cpu.manufacturer} ${cpu.brand}`.trim(),
          cores: cpu.cores,
          physicalCores: cpu.physicalCores,
          speedMax: cpu.speedMax || cpu.speed || null, // GHz
        },
        memTotal: mem.total,
        gpu: (graphics.controllers ?? [])
          .map(c => c.model)
          .filter((m): m is string => !!m),
        network: defaultNet
          ? { iface: defaultNet.iface, ip4: defaultNet.ip4 || '', mac: defaultNet.mac || '' }
          : null,
        app: {
          version: readAppVersion(),
          node: process.version,
        },
      }
    }

    // الأقراص ديناميكية (المساحة المستخدمة بتتغير) — تُقرأ مع كل طلب
    const fsSize = await si.fsSize().catch(() => [])
    const disks = fsSize
      .filter(d => d.size > 0)
      .sort((a, b) => b.size - a.size)
      .slice(0, 5)
      .map(d => ({ mount: d.mount, size: d.size, used: d.used, percent: Math.round(d.use) }))

    return NextResponse.json({ ...staticInfo, disks, uptime: Math.round(os.uptime()) })
  } catch (error) {
    console.error('Error reading system info:', error)
    return NextResponse.json({ error: 'فشل قراءة معلومات الجهاز' }, { status: 500 })
  }
}

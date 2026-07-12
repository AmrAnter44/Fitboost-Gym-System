// lib/systemStatsLogger.ts
// سجل أداء الجهاز: عيّنة كل دقيقتين تُحفظ في logs/system-stats-log.json (نفس نمط errorLogger)

import fs from 'fs'
import path from 'path'
import si from 'systeminformation'

const LOG_DIR = path.join(process.cwd(), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'system-stats-log.json')
const SAMPLE_INTERVAL_MS = 2 * 60 * 1000
const FIRST_SAMPLE_DELAY_MS = 15 * 1000
const MAX_ENTRIES = 5040 // أسبوع كامل بمعدل قراءة كل دقيقتين

export interface StatsLogEntry {
  at: number          // epoch ms
  mem: number         // % الرامات المستخدمة
  cpu: number         // % حمل المعالج
  temp: number | null // °C أو null إن لم تتوفر القراءة
  app: number         // MB — رام عملية التطبيق
}

// globalThis: يمنع تكرار الـ sampler عند إعادة تحميل الموديولات في وضع التطوير
type SamplerGlobal = typeof globalThis & {
  __systemStatsEntries?: StatsLogEntry[]
  __systemStatsSamplerStarted?: boolean
}
const g = globalThis as SamplerGlobal

function loadEntries(): StatsLogEntry[] {
  try {
    const raw = fs.readFileSync(LOG_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e: any) => e && typeof e.at === 'number' && typeof e.mem === 'number' && typeof e.cpu === 'number'
    )
  } catch {
    return []
  }
}

function getEntries(): StatsLogEntry[] {
  if (!g.__systemStatsEntries) g.__systemStatsEntries = loadEntries()
  return g.__systemStatsEntries
}

function persist(entries: StatsLogEntry[]): void {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
    // كتابة ذرّية: ملف مؤقت ثم rename حتى لا يتلف السجل لو انقطع التشغيل
    const tmp = LOG_FILE + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(entries), 'utf8')
    fs.renameSync(tmp, LOG_FILE)
  } catch (error) {
    console.error('⚠️ Cannot persist system stats log:', error)
  }
}

async function sample(): Promise<void> {
  try {
    const [mem, load, temp] = await Promise.all([
      si.mem(),
      si.currentLoad(),
      si.cpuTemperature().catch(() => ({ main: null as number | null })),
    ])
    const entries = getEntries()
    entries.push({
      at: Date.now(),
      mem: Math.round(((mem.total - mem.available) / mem.total) * 100),
      cpu: Math.round(load.currentLoad),
      temp: typeof temp.main === 'number' && temp.main > 0 ? Math.round(temp.main) : null,
      app: Math.round(process.memoryUsage().rss / 1024 ** 2),
    })
    if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES)
    persist(entries)
  } catch (error) {
    console.error('⚠️ System stats sample failed:', error)
  }
}

export function ensureSamplerStarted(): void {
  if (g.__systemStatsSamplerStarted) return
  g.__systemStatsSamplerStarted = true
  // unref: لا يمنع إغلاق العملية
  const first = setTimeout(sample, FIRST_SAMPLE_DELAY_MS)
  first.unref?.()
  const interval = setInterval(sample, SAMPLE_INTERVAL_MS)
  interval.unref?.()
}

export function readLog(sinceMs: number): StatsLogEntry[] {
  return getEntries().filter(e => e.at >= sinceMs)
}

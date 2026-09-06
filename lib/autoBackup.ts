import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs'
import path from 'path'
import { prisma } from './prisma'
import { resolveDbPath, resolveDbName } from './dbPath'

const DAY_MS = 24 * 60 * 60 * 1000
const KEEP_BACKUPS = 14 // نحتفظ بآخر أسبوعين من النسخ اليومية
// البادئة بتتبع اسم الملف الحقيقي — لو كانت ثابتة، تنظيف النسخ
// القديمة مش هيلاقي حاجة على جيم اسم ملفه مختلف.
const PREFIX = `${resolveDbName()}.auto-`

/**
 * ياخد نسخة احتياطية يومية تلقائية للـ DB لو عدّى يوم على آخر نسخة.
 * بيتنادى من instrumentation.ts على فترات. رخيص جداً لو مش مستحق (بيخرج بدري).
 *
 * النسخة بتتعمل عبر VACUUM INTO = snapshot متسق حتى والـ DB بيتكتب فيه.
 */
export async function runDailyBackupIfDue(): Promise<{ backed: boolean; reason?: string; path?: string }> {
  try {
    const dbPath = resolveDbPath()
    if (!existsSync(dbPath)) return { backed: false, reason: 'no-db' }

    const dir = path.join(path.dirname(dbPath), 'backups')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    const existing = readdirSync(dir)
      .filter(f => f.startsWith(PREFIX) && f.endsWith('.bak'))
      .sort()

    // لو آخر نسخة أقل من يوم، مش مستحق
    const latest = existing[existing.length - 1]
    if (latest) {
      const age = Date.now() - statSync(path.join(dir, latest)).mtimeMs
      if (age < DAY_MS) return { backed: false, reason: 'not-due' }
    }

    const ts = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0]
    const dest = path.join(dir, `${PREFIX}${ts}.bak`)
    await prisma.$executeRawUnsafe(`VACUUM INTO '${dest.replace(/'/g, "''")}'`)

    // تنظيف النسخ القديمة (نحتفظ بآخر KEEP_BACKUPS)
    const all = readdirSync(dir)
      .filter(f => f.startsWith(PREFIX) && f.endsWith('.bak'))
      .sort()
    while (all.length > KEEP_BACKUPS) {
      const old = all.shift()
      if (old) {
        try { unlinkSync(path.join(dir, old)) } catch { /* ignore */ }
      }
    }

    return { backed: true, path: dest }
  } catch (e: any) {
    console.error('[autoBackup] error:', e?.message || String(e))
    return { backed: false, reason: 'error' }
  }
}

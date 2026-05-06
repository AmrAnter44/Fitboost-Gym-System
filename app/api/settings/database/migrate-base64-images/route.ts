// app/api/settings/database/migrate-base64-images/route.ts
//
// One-time migration: extracts base64 profile images stored inside Member.profileImage
// and writes them as real files in the uploads dir, replacing the column with a
// short URL/path. Then VACUUMs gym.db to reclaim the freed space.
//
// Idempotent: re-running finds no candidates and no-ops.
// Atomic per-row: writes the file FIRST, verifies it, only then updates the DB.

import { NextResponse } from 'next/server'
import { writeFile, copyFile, mkdir } from 'fs/promises'
import { existsSync, statSync } from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import { requireAdmin } from '../../../../../lib/auth'
import { prisma } from '../../../../../lib/prisma'
import { getMembersUploadsDir, MEMBERS_UPLOADS_URL_PREFIX } from '../../../../../lib/uploadsPath'
import { clearReadonlyOnWindows } from '../../../../../lib/dbFilePermissions'

export const dynamic = 'force-dynamic'

const ALLOWED_MIMES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

const DATA_URI_RE = /^data:(image\/[a-zA-Z0-9+.\-]+);base64,(.+)$/

interface Failure {
  id: string
  name: string
  reason: string
}

interface PreflightInfo {
  candidates: number
  currentDbSizeBytes: number
  currentDbSizeMb: number
  estimatedBase64Bytes: number
  estimatedBase64Mb: number
}

function dbPath(): string {
  return path.join(process.cwd(), 'prisma', 'gym.db')
}

function fileSizeBytes(filePath: string): number {
  try {
    return statSync(filePath).size
  } catch {
    return 0
  }
}

async function getPreflight(): Promise<PreflightInfo> {
  const rows = await prisma.$queryRaw<Array<{ count: number; total_bytes: number }>>`
    SELECT COUNT(*) AS count, COALESCE(SUM(LENGTH(profileImage)), 0) AS total_bytes
    FROM Member
    WHERE profileImage LIKE 'data:image%'
  `
  const row = rows[0] ?? { count: 0, total_bytes: 0 }
  const dbBytes = fileSizeBytes(dbPath())
  return {
    candidates: Number(row.count),
    currentDbSizeBytes: dbBytes,
    currentDbSizeMb: Number((dbBytes / (1024 * 1024)).toFixed(2)),
    estimatedBase64Bytes: Number(row.total_bytes),
    estimatedBase64Mb: Number((Number(row.total_bytes) / (1024 * 1024)).toFixed(2)),
  }
}

/**
 * 📋 GET: preflight info — how many base64 images are stuck in the DB and current size.
 */
export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const info = await getPreflight()
    return NextResponse.json({ success: true, ...info })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

/**
 * 🚀 POST: actually run the migration.
 */
export async function POST(request: Request) {
  try {
    await requireAdmin(request)

    // 1. Pre-flight
    const before = await getPreflight()
    if (before.candidates === 0) {
      return NextResponse.json({
        success: true,
        migrated: 0,
        failed: 0,
        failures: [],
        before: { mb: before.currentDbSizeMb },
        after: { mb: before.currentDbSizeMb },
        saved: { mb: 0, percent: 0 },
        message: 'مفيش صور قديمة للنقل — قاعدة البيانات نضيفة بالفعل',
      })
    }

    // 2. Backup before doing anything destructive
    const live = dbPath()
    if (!existsSync(live)) {
      return NextResponse.json({ success: false, error: 'gym.db غير موجود' }, { status: 404 })
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0]
    const backupName = `gym.db.pre-migrate-${timestamp}.bak`
    const backupPath = path.join(process.cwd(), 'prisma', backupName)
    await copyFile(live, backupPath)

    // 3. Ensure uploads dir exists
    const uploadsDir = getMembersUploadsDir()
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // 4. Fetch candidates
    const candidates = await prisma.$queryRaw<Array<{ id: string; name: string; profileImage: string }>>`
      SELECT id, name, profileImage
      FROM Member
      WHERE profileImage LIKE 'data:image%'
    `

    let filesWritten = 0
    let filesBytes = 0
    const failures: Failure[] = []
    const isElectron = process.env.UPLOADS_PATH !== undefined

    // 5. Migrate one-by-one (atomic per row)
    for (const member of candidates) {
      try {
        const match = DATA_URI_RE.exec(member.profileImage)
        if (!match) {
          failures.push({ id: member.id, name: member.name, reason: 'صيغة data URI غير صحيحة' })
          continue
        }

        const mime = match[1].toLowerCase()
        const base64Data = match[2]
        const ext = ALLOWED_MIMES[mime]
        if (!ext) {
          failures.push({ id: member.id, name: member.name, reason: `نوع غير مدعوم: ${mime}` })
          continue
        }

        const buffer = Buffer.from(base64Data, 'base64')
        if (buffer.length < 100) {
          failures.push({ id: member.id, name: member.name, reason: `حجم البيانات صغير جداً (${buffer.length} بايت)` })
          continue
        }

        const filename = `migrated_${member.id}${ext}`
        const filepath = path.join(uploadsDir, filename)

        // اكتب الملف الأول
        await writeFile(filepath, buffer)

        // تأكد إن الملف اتكتب فعلاً وحجمه صحيح
        const writtenSize = fileSizeBytes(filepath)
        if (writtenSize !== buffer.length) {
          failures.push({
            id: member.id,
            name: member.name,
            reason: `فشل تأكيد الكتابة: متوقع ${buffer.length} بايت، وُجد ${writtenSize}`,
          })
          continue
        }

        // الـ URL اللي يتخزن في الـ DB — في الـ Electron mode بنروح للـ serve endpoint،
        // وفي الـ web mode بنستخدم الـ static path المباشر.
        const newUrl = isElectron
          ? `/api/serve-image?path=${encodeURIComponent(filepath)}`
          : `${MEMBERS_UPLOADS_URL_PREFIX}${filename}`

        // بس بعد ما الكتابة نجحت — عدّل الـ DB
        await prisma.member.update({
          where: { id: member.id },
          data: { profileImage: newUrl },
        })

        filesWritten++
        filesBytes += buffer.length
      } catch (err) {
        failures.push({
          id: member.id,
          name: member.name,
          reason: (err as Error).message,
        })
      }
    }

    // 6. VACUUM to reclaim the space we just freed
    let vacuumError: string | null = null
    try {
      try { await prisma.$executeRaw`PRAGMA wal_checkpoint(FULL)` } catch { /* ignore */ }
      try { await prisma.$disconnect() } catch { /* ignore */ }

      clearReadonlyOnWindows(live)

      const db = new Database(live)
      try {
        db.exec('VACUUM')
      } finally {
        db.close()
      }
    } catch (err) {
      vacuumError = (err as Error).message
    }

    const afterBytes = fileSizeBytes(live)
    const afterMb = Number((afterBytes / (1024 * 1024)).toFixed(2))
    const savedBytes = before.currentDbSizeBytes - afterBytes
    const savedMb = Number((savedBytes / (1024 * 1024)).toFixed(2))
    const savedPercent = before.currentDbSizeBytes > 0
      ? Number(((savedBytes / before.currentDbSizeBytes) * 100).toFixed(1))
      : 0

    return NextResponse.json({
      success: true,
      migrated: filesWritten,
      failed: failures.length,
      failures,
      before: { mb: before.currentDbSizeMb, bytes: before.currentDbSizeBytes },
      after: { mb: afterMb, bytes: afterBytes },
      saved: { mb: savedMb, bytes: savedBytes, percent: savedPercent },
      filesWritten,
      filesSize: {
        bytes: filesBytes,
        mb: Number((filesBytes / (1024 * 1024)).toFixed(2)),
      },
      backup: {
        filename: backupName,
        path: backupPath,
      },
      vacuumError,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('migrate-base64-images error:', error)
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}

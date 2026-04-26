import { NextResponse } from 'next/server';
import { existsSync, statSync, readdirSync } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { requireAdmin } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';

export const dynamic = 'force-dynamic';

const LIVE_DB = 'gym.db';
const SAFE_NAME_RE = /^gym\.db[A-Za-z0-9._\-]*$/;

function prismaDirPath(): string {
  return path.join(process.cwd(), 'prisma');
}

function resolveTargetPath(target: string): string | null {
  if (!SAFE_NAME_RE.test(target)) return null;
  if (target.includes('/') || target.includes('\\') || target.includes('..')) return null;
  // استبعاد ملفات الـ WAL/SHM/journal — دي مش DB files
  if (target.endsWith('-shm') || target.endsWith('-wal') || target.endsWith('-journal')) return null;

  const dir = prismaDirPath();
  const resolved = path.resolve(dir, target);
  const dirResolved = path.resolve(dir);
  if (!resolved.startsWith(dirResolved + path.sep) && resolved !== path.join(dirResolved, target)) {
    return null;
  }
  return resolved;
}

function fileInfo(filePath: string, name: string) {
  const s = statSync(filePath);
  return {
    name,
    sizeBytes: s.size,
    sizeMB: Number((s.size / (1024 * 1024)).toFixed(2)),
    modified: s.mtime,
    isLive: name === LIVE_DB,
  };
}

/**
 * 📋 GET: list SQLite DB files in prisma/ (live + backups)
 */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const dir = prismaDirPath();
    if (!existsSync(dir)) return NextResponse.json({ files: [] });

    const entries = readdirSync(dir);
    const files = entries
      .filter((name) =>
        name.startsWith('gym.db') &&
        !name.endsWith('-shm') &&
        !name.endsWith('-wal') &&
        !name.endsWith('-journal')
      )
      .map((name) => fileInfo(path.join(dir, name), name))
      .sort((a, b) => {
        if (a.isLive) return -1;
        if (b.isLive) return 1;
        return b.modified.getTime() - a.modified.getTime();
      });

    const totalBytes = files.reduce((sum, f) => sum + f.sizeBytes, 0);
    return NextResponse.json({
      files,
      totalBytes,
      totalMB: Number((totalBytes / (1024 * 1024)).toFixed(2)),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'حدث خطأ أثناء قراءة قائمة الملفات' }, { status: 500 });
  }
}

/**
 * 🧹 POST: run VACUUM on target file (default: live gym.db).
 * Body: { target?: string, all?: boolean }
 * - target: specific filename in prisma/ (allowlist pattern)
 * - all: if true, vacuums every backup file (skips the live gym.db unless includeLive=true)
 */
export async function POST(request: Request) {
  try {
    await requireAdmin(request);

    const body = await request.json().catch(() => ({}));
    const all = body?.all === true;
    const includeLive = body?.includeLive === true;
    const target = typeof body?.target === 'string' ? body.target.trim() : LIVE_DB;

    const dir = prismaDirPath();

    if (all) {
      const entries = readdirSync(dir).filter(
        (name) =>
          name.startsWith('gym.db') &&
          !name.endsWith('-shm') &&
          !name.endsWith('-wal') &&
          !name.endsWith('-journal') &&
          (includeLive || name !== LIVE_DB)
      );

      const results: any[] = [];
      let totalSaved = 0;
      for (const name of entries) {
        const resolved = resolveTargetPath(name);
        if (!resolved || !existsSync(resolved)) continue;
        const r = await vacuumFile(resolved, name === LIVE_DB);
        results.push({ name, ...r });
        if (r.success) totalSaved += (r.before?.bytes ?? 0) - (r.after?.bytes ?? 0);
      }

      return NextResponse.json({
        success: true,
        mode: 'all',
        totalSavedBytes: totalSaved,
        totalSavedMB: Number((totalSaved / (1024 * 1024)).toFixed(2)),
        results,
      });
    }

    const resolved = resolveTargetPath(target);
    if (!resolved) {
      return NextResponse.json({ success: false, error: 'اسم ملف غير صالح' }, { status: 400 });
    }
    if (!existsSync(resolved)) {
      return NextResponse.json({ success: false, error: 'الملف غير موجود' }, { status: 404 });
    }

    const r = await vacuumFile(resolved, target === LIVE_DB);
    return NextResponse.json({ target, ...r });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const msg = error instanceof Error ? error.message : 'حدث خطأ أثناء التنظيف';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

async function vacuumFile(
  filePath: string,
  isLive: boolean
): Promise<{
  success: boolean;
  before?: { bytes: number; mb: number };
  after?: { bytes: number; mb: number };
  saved?: { bytes: number; mb: number; percent: number };
  integrity?: string;
  error?: string;
}> {
  const beforeBytes = statSync(filePath).size;

  try {
    if (isLive) {
      // checkpoint + disconnect prisma علشان VACUUM ياخد exclusive lock بدون contention
      try { await prisma.$executeRaw`PRAGMA wal_checkpoint(FULL)`; } catch { /* ignore */ }
      try { await prisma.$disconnect(); } catch { /* ignore */ }
    }

    const db = new Database(filePath);
    let integrity: string = 'unknown';
    try {
      const row = db.prepare('PRAGMA integrity_check').get() as { integrity_check?: string } | undefined;
      integrity = row?.integrity_check ?? 'unknown';
      if (integrity !== 'ok') {
        return {
          success: false,
          error: `فحص السلامة فشل: ${integrity} — تم تخطي VACUUM`,
          integrity,
          before: { bytes: beforeBytes, mb: Number((beforeBytes / (1024 * 1024)).toFixed(2)) },
        };
      }
      db.exec('VACUUM');
    } finally {
      db.close();
    }

    const afterBytes = statSync(filePath).size;
    const savedBytes = beforeBytes - afterBytes;
    const percent = beforeBytes > 0 ? (savedBytes / beforeBytes) * 100 : 0;

    return {
      success: true,
      integrity,
      before: { bytes: beforeBytes, mb: Number((beforeBytes / (1024 * 1024)).toFixed(2)) },
      after: { bytes: afterBytes, mb: Number((afterBytes / (1024 * 1024)).toFixed(2)) },
      saved: {
        bytes: savedBytes,
        mb: Number((savedBytes / (1024 * 1024)).toFixed(2)),
        percent: Number(percent.toFixed(1)),
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

import { NextResponse } from 'next/server';
import { existsSync, statSync } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { requireAdmin } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * 🔍 API للتحقق من صحة وسلامة الداتابيز
 * يستخدم better-sqlite3 مباشرة بدلاً من shell commands لتجنب injection
 */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const projectRoot = process.cwd();
    const dbPath = path.join(projectRoot, 'prisma', 'gym.db');

    if (!existsSync(dbPath)) {
      return NextResponse.json({
        valid: false,
        error: 'ملف الداتابيز غير موجود'
      }, { status: 404 });
    }

    const stats = statSync(dbPath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    let integrityCheck = false;
    let tables: string[] = [];
    let tablesCount = 0;

    try {
      const db = new Database(dbPath, { readonly: true });
      try {
        const integrityResult = db.prepare('PRAGMA integrity_check').get() as { integrity_check?: string } | undefined;
        integrityCheck = integrityResult?.integrity_check === 'ok';

        const tableRows = db.prepare(
          `SELECT name FROM sqlite_master
           WHERE type = 'table'
             AND name NOT LIKE 'sqlite_%'
             AND name NOT LIKE '_prisma_%'
           ORDER BY name`
        ).all() as { name: string }[];

        tables = tableRows.map(row => row.name);
        tablesCount = tables.length;
      } finally {
        db.close();
      }
    } catch (error) {
      console.error('Error checking database:', error);
    }

    let connectionValid = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      connectionValid = true;
    } catch (error) {
      connectionValid = false;
    }

    return NextResponse.json({
      valid: integrityCheck && connectionValid,
      details: {
        file: {
          exists: true,
          path: dbPath,
          size: `${sizeInMB} MB`,
          lastModified: stats.mtime
        },
        integrity: {
          valid: integrityCheck,
          message: integrityCheck ? 'الداتابيز سليمة' : 'توجد مشاكل في الداتابيز'
        },
        connection: {
          valid: connectionValid,
          message: connectionValid ? 'الاتصال ناجح' : 'فشل الاتصال بالداتابيز'
        },
        tables: {
          count: tablesCount,
          list: tables.slice(0, 10)
        }
      }
    });

  } catch (error) {
    console.error('Database validation error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 });
    }

    return NextResponse.json({
      valid: false,
      error: 'حدث خطأ أثناء فحص الداتابيز'
    }, { status: 500 });
  }
}

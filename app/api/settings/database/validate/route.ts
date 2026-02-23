import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, statSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

/**
 * 🔍 API للتحقق من صحة وسلامة الداتابيز
 */
export async function GET() {
  try {
    const projectRoot = process.cwd();
    const dbPath = path.join(projectRoot, 'prisma', 'gym.db');

    // فحص وجود الملف
    if (!existsSync(dbPath)) {
      return NextResponse.json({
        valid: false,
        error: 'ملف الداتابيز غير موجود'
      }, { status: 404 });
    }

    // معلومات الملف
    const stats = statSync(dbPath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    // فحص integrity
    let integrityCheck = false;
    try {
      const { stdout } = await execAsync(`sqlite3 "${dbPath}" "PRAGMA integrity_check;"`);
      integrityCheck = stdout.includes('ok');
    } catch (error) {
      integrityCheck = false;
    }

    // عد الجداول
    let tablesCount = 0;
    let tables: string[] = [];
    try {
      const { stdout } = await execAsync(
        `sqlite3 "${dbPath}" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%' ORDER BY name;"`
      );
      tables = stdout.split('\n').filter(t => t.trim());
      tablesCount = tables.length;
    } catch (error) {
      console.error('Error counting tables:', error);
    }

    // فحص Prisma schema
    let schemaValid = false;
    try {
      await execAsync('npx prisma validate', { cwd: projectRoot });
      schemaValid = true;
    } catch (error) {
      schemaValid = false;
    }

    // فحص الاتصال
    let connectionValid = false;
    try {
      await execAsync(
        `npx prisma db execute --stdin <<< "SELECT 1;"`,
        { cwd: projectRoot, shell: '/bin/bash' }
      );
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
        schema: {
          valid: schemaValid,
          message: schemaValid ? 'الـ schema صحيح' : 'توجد مشاكل في الـ schema'
        },
        connection: {
          valid: connectionValid,
          message: connectionValid ? 'الاتصال ناجح' : 'فشل الاتصال بالداتابيز'
        },
        tables: {
          count: tablesCount,
          list: tables.slice(0, 10) // أول 10 جداول فقط
        }
      }
    });

  } catch (error) {
    console.error('Database validation error:', error);
    return NextResponse.json({
      valid: false,
      error: 'حدث خطأ أثناء فحص الداتابيز',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

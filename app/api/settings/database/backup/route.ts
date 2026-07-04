import { NextResponse } from 'next/server';
import { existsSync, statSync, mkdirSync } from 'fs';
import path from 'path';
import { requireAdmin } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';
import { resolveDbPath } from '../../../../../lib/dbPath';

/**
 * 💾 API لإنشاء نسخة احتياطية من الداتابيز
 *
 * بيستخدم resolveDbPath عشان يلاقي الـ DB الحقيقي (userData في نسخة Electron،
 * مش process.cwd)، وبيعمل نسخة متسقة عبر `VACUUM INTO` (snapshot آمن حتى والـ
 * DB بيتكتب فيه — بدل نسخ ملف WAL على نص كتابة).
 */
export async function POST(request: Request) {
  try {
    await requireAdmin(request);

    const dbPath = resolveDbPath();

    // فحص وجود الداتابيز
    if (!existsSync(dbPath)) {
      return NextResponse.json({
        success: false,
        error: 'لا توجد داتابيز لنسخها'
      }, { status: 404 });
    }

    // مجلد النسخ جنب الـ DB
    const backupDir = path.join(path.dirname(dbPath), 'backups');
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }

    // اسم النسخة الاحتياطية
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
    const backupFilename = `gym.db.backup.manual-${timestamp}.bak`;
    const backupPath = path.join(backupDir, backupFilename);

    // نسخة متسقة عبر VACUUM INTO (يستخدم اتصال Prisma الحالي — مفيش موديول إضافي)
    await prisma.$executeRawUnsafe(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);

    // معلومات الملف
    const stats = statSync(backupPath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    return NextResponse.json({
      success: true,
      message: 'تم إنشاء النسخة الاحتياطية بنجاح',
      details: {
        filename: backupFilename,
        path: backupPath,
        size: `${sizeInMB} MB`,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Backup creation error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({
      success: false,
      error: 'حدث خطأ أثناء إنشاء النسخة الاحتياطية'
    }, { status: 500 });
  }
}

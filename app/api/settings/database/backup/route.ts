import { NextResponse } from 'next/server';
import { copyFile } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import path from 'path';
import { requireAdmin } from '../../../../../lib/auth';

/**
 * 💾 API لإنشاء نسخة احتياطية من الداتابيز
 */
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const projectRoot = process.cwd();
    const prismaDir = path.join(projectRoot, 'prisma');
    const dbPath = path.join(prismaDir, 'gym.db');

    // فحص وجود الداتابيز
    if (!existsSync(dbPath)) {
      return NextResponse.json({
        success: false,
        error: 'لا توجد داتابيز لنسخها'
      }, { status: 404 });
    }

    // إنشاء اسم للنسخة الاحتياطية
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
    const backupFilename = `gym.db.backup.manual-${timestamp}`;
    const backupPath = path.join(prismaDir, backupFilename);

    // نسخ الملف
    await copyFile(dbPath, backupPath);

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
    console.error('Backup creation error:', error);
    return NextResponse.json({
      success: false,
      error: 'حدث خطأ أثناء إنشاء النسخة الاحتياطية',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

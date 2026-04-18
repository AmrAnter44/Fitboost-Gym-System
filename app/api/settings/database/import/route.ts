import { NextRequest, NextResponse } from 'next/server';
import { writeFile, copyFile, unlink, access } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { requireAdmin } from '../../../../../lib/auth';

const execAsync = promisify(exec);

/**
 * 🔄 API لاستيراد داتابيز قديمة وتحديثها تلقائياً
 *
 * الخطوات:
 * 1. رفع الملف
 * 2. التحقق من صحته
 * 3. نسخ احتياطي للداتابيز الحالية
 * 4. استبدال الداتابيز
 * 5. تطبيق التحديثات (db push)
 * 6. فحص السلامة
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const formData = await request.formData();
    const file = formData.get('database') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'لم يتم اختيار ملف' },
        { status: 400 }
      );
    }

    // التحقق من امتداد الملف
    if (!file.name.endsWith('.db')) {
      return NextResponse.json(
        { error: 'يجب أن يكون الملف من نوع .db' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // التحقق من أن الملف SQLite
    const sqliteHeader = buffer.slice(0, 16).toString('utf-8');
    if (!sqliteHeader.startsWith('SQLite format 3')) {
      return NextResponse.json(
        { error: 'الملف ليس قاعدة بيانات SQLite صحيحة' },
        { status: 400 }
      );
    }

    const projectRoot = process.cwd();
    const prismaDir = path.join(projectRoot, 'prisma');
    const currentDbPath = path.join(prismaDir, 'gym.db');
    const tempDbPath = path.join(prismaDir, 'gym.db.temp');

    // مسار النسخة الاحتياطية
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
    const backupPath = path.join(prismaDir, `gym.db.backup.import-${timestamp}`);

    // الخطوة 1: حفظ الملف المرفوع مؤقتاً
    await writeFile(tempDbPath, buffer);

    // الخطوة 2: التحقق من سلامة الملف المرفوع
    try {
      const { stdout } = await execAsync(
        `sqlite3 "${tempDbPath}" "PRAGMA integrity_check;"`
      );

      if (!stdout.includes('ok')) {
        await unlink(tempDbPath);
        return NextResponse.json(
          { error: 'الداتابيز المرفوعة تالفة أو غير صحيحة' },
          { status: 400 }
        );
      }
    } catch (error) {
      await unlink(tempDbPath);
      return NextResponse.json(
        { error: 'فشل التحقق من سلامة الداتابيز' },
        { status: 400 }
      );
    }

    // الخطوة 3: نسخ احتياطي للداتابيز الحالية
    if (existsSync(currentDbPath)) {
      await copyFile(currentDbPath, backupPath);
    }

    // الخطوة 4: استبدال الداتابيز
    if (existsSync(currentDbPath)) {
      await unlink(currentDbPath);
    }

    // حذف ملفات WAL و SHM القديمة
    const walPath = `${currentDbPath}-wal`;
    const shmPath = `${currentDbPath}-shm`;
    if (existsSync(walPath)) await unlink(walPath);
    if (existsSync(shmPath)) await unlink(shmPath);

    // نقل الملف المؤقت ليصبح الداتابيز الرئيسية
    await copyFile(tempDbPath, currentDbPath);
    await unlink(tempDbPath);

    // الخطوة 5: إزالة extended attributes (macOS)
    if (process.platform === 'darwin') {
      try {
        await execAsync(`xattr -rc "${prismaDir}"`);
      } catch (error) {
        // تجاهل الخطأ إذا لم تكن هناك attributes
      }
    }

    // الخطوة 6: ضبط الصلاحيات
    try {
      await execAsync(`chmod 644 "${currentDbPath}"`);
    } catch (error) {
      // تجاهل أخطاء الصلاحيات
    }

    // الخطوة 7: توليد Prisma Client
    try {
      await execAsync('npx prisma generate', { cwd: projectRoot });
    } catch (error) {
      console.error('Error generating Prisma client:', error);
    }

    // الخطوة 8: تطبيق التحديثات على الـ schema (إضافة الجداول الجديدة)
    try {
      await execAsync('npx prisma db push --accept-data-loss', { cwd: projectRoot });
    } catch (error) {
      console.error('Error applying schema updates:', error);

      // إذا فشل db push، نحاول استرجاع النسخة الاحتياطية
      if (existsSync(backupPath)) {
        await copyFile(backupPath, currentDbPath);
        return NextResponse.json(
          {
            error: 'فشل تطبيق التحديثات على الداتابيز. تم استرجاع النسخة الاحتياطية.',
            details: error instanceof Error ? error.message : String(error)
          },
          { status: 500 }
        );
      }
    }

    // الخطوة 9: فحص نهائي
    let tablesCount = 0;
    try {
      const { stdout } = await execAsync(
        `sqlite3 "${currentDbPath}" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%';"`
      );
      tablesCount = parseInt(stdout.trim());
    } catch (error) {
      console.error('Error counting tables:', error);
    }

    return NextResponse.json({
      success: true,
      message: 'تم استيراد الداتابيز وتحديثها بنجاح',
      details: {
        backupCreated: path.basename(backupPath),
        tablesCount,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Database import error:', error);
    return NextResponse.json(
      {
        error: 'حدث خطأ أثناء استيراد الداتابيز',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

/**
 * GET: الحصول على معلومات عن النسخ الاحتياطية المتوفرة
 */
export async function GET() {
  try {
    const prismaDir = path.join(process.cwd(), 'prisma');
    const { stdout } = await execAsync(`ls -1 "${prismaDir}" | grep "gym.db.backup"`);

    const backups = stdout
      .split('\n')
      .filter(line => line.trim())
      .map(filename => {
        const filePath = path.join(prismaDir, filename);
        return {
          filename,
          path: filePath
        };
      });

    return NextResponse.json({
      backups,
      count: backups.length
    });
  } catch (error) {
    return NextResponse.json({
      backups: [],
      count: 0
    });
  }
}

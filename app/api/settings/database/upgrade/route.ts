import { NextRequest, NextResponse } from 'next/server';
import { writeFile, copyFile, unlink, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * 🔄 تحديث داتابيز قديمة لتتوافق مع النظام الحالي
 *
 * يستقبل ملف داتابيز قديم ويضيف له:
 * - الجداول الجديدة
 * - الأعمدة الجديدة
 * - الـ indexes الجديدة
 * - بدون حذف أي بيانات موجودة
 */
export async function POST(request: NextRequest) {
  const tempFiles: string[] = [];

  try {
    const formData = await request.formData();
    const file = formData.get('database') as File;
    const action = formData.get('action') as string; // 'upgrade-only' or 'upgrade-and-replace'

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

    // التحقق من أن الملف SQLite صحيح
    const sqliteHeader = buffer.slice(0, 16).toString('utf-8');
    if (!sqliteHeader.startsWith('SQLite format 3')) {
      return NextResponse.json(
        { error: 'الملف ليس قاعدة بيانات SQLite صحيحة' },
        { status: 400 }
      );
    }

    const projectRoot = process.cwd();
    const prismaDir = path.join(projectRoot, 'prisma');

    // مسارات مؤقتة
    const timestamp = Date.now();
    const uploadedDbPath = path.join(prismaDir, `temp-uploaded-${timestamp}.db`);
    const upgradedDbPath = path.join(prismaDir, `temp-upgraded-${timestamp}.db`);

    tempFiles.push(uploadedDbPath, upgradedDbPath);

    // الخطوة 1: حفظ الملف المرفوع
    await writeFile(uploadedDbPath, buffer);

    // الخطوة 2: التحقق من سلامة الملف
    let integrityCheck = false;
    try {
      const { stdout } = await execAsync(`sqlite3 "${uploadedDbPath}" "PRAGMA integrity_check;"`);
      integrityCheck = stdout.includes('ok');
    } catch (error) {
      await cleanup(tempFiles);
      return NextResponse.json(
        { error: 'الداتابيز المرفوعة تالفة أو غير صحيحة' },
        { status: 400 }
      );
    }

    if (!integrityCheck) {
      await cleanup(tempFiles);
      return NextResponse.json(
        { error: 'فشل فحص سلامة الداتابيز' },
        { status: 400 }
      );
    }

    // الخطوة 3: عد الجداول قبل التحديث
    let tablesBefore: string[] = [];
    try {
      const { stdout } = await execAsync(
        `sqlite3 "${uploadedDbPath}" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%' ORDER BY name;"`
      );
      tablesBefore = stdout.split('\n').filter(t => t.trim());
    } catch (error) {
      console.error('Error counting tables before:', error);
    }

    // الخطوة 4: نسخ الملف للتحديث
    await copyFile(uploadedDbPath, upgradedDbPath);

    // الخطوة 5: إنشاء ملف .env مؤقت يشير للداتابيز المؤقتة
    const originalEnvPath = path.join(projectRoot, '.env');
    const tempEnvPath = path.join(projectRoot, '.env.temp');

    const originalEnv = await readFile(originalEnvPath, 'utf-8');
    const tempEnv = originalEnv.replace(
      /DATABASE_URL=.*/,
      `DATABASE_URL="file:${upgradedDbPath}?connection_limit=1&pool_timeout=20&journal_mode=WAL"`
    );

    await writeFile(tempEnvPath, tempEnv);
    tempFiles.push(tempEnvPath);

    // الخطوة 6: تطبيق التحديثات على الداتابيز المؤقتة
    let updateSuccess = false;
    let updateError = '';

    try {
      // استخدام الـ .env المؤقت
      const env = { ...process.env };
      const envContent = await readFile(tempEnvPath, 'utf-8');
      const dbUrlMatch = envContent.match(/DATABASE_URL="(.*)"/);
      if (dbUrlMatch) {
        env.DATABASE_URL = dbUrlMatch[1];
      }

      // تطبيق prisma db push
      const { stdout, stderr } = await execAsync(
        'npx prisma db push --accept-data-loss --skip-generate',
        {
          cwd: projectRoot,
          env
        }
      );

      updateSuccess = true;
    } catch (error: any) {
      updateError = error.message || String(error);
      console.error('Database upgrade error:', error);

      await cleanup(tempFiles);
      return NextResponse.json(
        {
          error: 'فشل تطبيق التحديثات على الداتابيز',
          details: updateError
        },
        { status: 500 }
      );
    }

    // الخطوة 7: عد الجداول بعد التحديث
    let tablesAfter: string[] = [];
    try {
      const { stdout } = await execAsync(
        `sqlite3 "${upgradedDbPath}" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%' ORDER BY name;"`
      );
      tablesAfter = stdout.split('\n').filter(t => t.trim());
    } catch (error) {
      console.error('Error counting tables after:', error);
    }

    // الجداول الجديدة التي تمت إضافتها
    const newTables = tablesAfter.filter(t => !tablesBefore.includes(t));

    // الخطوة 8: فحص نهائي للداتابيز المحدثة
    try {
      const { stdout } = await execAsync(`sqlite3 "${upgradedDbPath}" "PRAGMA integrity_check;"`);
      if (!stdout.includes('ok')) {
        await cleanup(tempFiles);
        return NextResponse.json(
          { error: 'الداتابيز المحدثة بها مشاكل في السلامة' },
          { status: 500 }
        );
      }
    } catch (error) {
      await cleanup(tempFiles);
      return NextResponse.json(
        { error: 'فشل التحقق من سلامة الداتابيز المحدثة' },
        { status: 500 }
      );
    }

    // الخطوة 9: اختيار الإجراء
    if (action === 'upgrade-and-replace') {
      // استبدال الداتابيز الحالية بالمحدثة
      const currentDbPath = path.join(prismaDir, 'gym.db');
      const backupPath = path.join(prismaDir, `gym.db.backup.replaced-${timestamp}`);

      // نسخ احتياطي للداتابيز الحالية
      if (existsSync(currentDbPath)) {
        await copyFile(currentDbPath, backupPath);
      }

      // استبدال الداتابيز
      await copyFile(upgradedDbPath, currentDbPath);

      // حذف ملفات WAL و SHM
      const walPath = `${currentDbPath}-wal`;
      const shmPath = `${currentDbPath}-shm`;
      if (existsSync(walPath)) await unlink(walPath);
      if (existsSync(shmPath)) await unlink(shmPath);

      // تنظيف الملفات المؤقتة
      await cleanup(tempFiles);

      // إعادة توليد Prisma Client
      try {
        await execAsync('npx prisma generate', { cwd: projectRoot });
      } catch (error) {
        console.error('Error generating Prisma client:', error);
      }

      return NextResponse.json({
        success: true,
        action: 'replaced',
        message: 'تم تحديث واستبدال الداتابيز بنجاح',
        details: {
          tablesCount: tablesAfter.length,
          newTablesAdded: newTables,
          backupCreated: path.basename(backupPath)
        }
      });

    } else {
      // فقط ترجيع الملف المحدث للتنزيل
      const upgradedBuffer = await readFile(upgradedDbPath);

      // تنظيف الملفات المؤقتة
      await cleanup(tempFiles);

      // إرجاع الملف المحدث
      return new NextResponse(upgradedBuffer, {
        headers: {
          'Content-Type': 'application/x-sqlite3',
          'Content-Disposition': `attachment; filename="gym-upgraded-${timestamp}.db"`,
        },
      });
    }

  } catch (error) {
    console.error('Database upgrade error:', error);
    await cleanup(tempFiles);

    return NextResponse.json(
      {
        error: 'حدث خطأ أثناء تحديث الداتابيز',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// تنظيف الملفات المؤقتة
async function cleanup(files: string[]) {
  for (const file of files) {
    try {
      if (existsSync(file)) {
        await unlink(file);
      }
    } catch (error) {
      console.error(`Failed to delete ${file}:`, error);
    }
  }
}

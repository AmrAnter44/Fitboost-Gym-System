/**
 * API لتطبيق Migrations على قاعدة البيانات
 * يشتغل في Development و Production
 */

import { NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { requirePermission } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // التحقق من الصلاحيات
    await requirePermission(request, 'canAccessAdmin')


    // تحديد مسار قاعدة البيانات
    let dbPath = path.join(process.cwd(), 'prisma', 'gym.db')
    let isProduction = false

    // في Production (Electron)، قاعدة البيانات في AppData
    if (process.env.NODE_ENV === 'production' || !fs.existsSync(dbPath)) {
      const appData = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share")
      const productionDbPath = path.join(appData, 'gym-management', 'gym.db')

      if (fs.existsSync(productionDbPath)) {
        dbPath = productionDbPath
        isProduction = true
      }
    }

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json(
        { success: false, error: 'قاعدة البيانات غير موجودة' },
        { status: 404 }
      )
    }

    // التحقق من permissions
    try {
      // تجربة الكتابة على المجلد
      const dbDir = path.dirname(dbPath)
      fs.accessSync(dbDir, fs.constants.W_OK)

      // تجربة الكتابة على قاعدة البيانات نفسها
      fs.accessSync(dbPath, fs.constants.W_OK)
    } catch (permError) {
      console.error('❌ Permission error:', permError)

      // محاولة تصليح الـ permissions باستخدام fs بدلاً من shell (أكثر أماناً)
      try {
        fs.chmodSync(dbPath, 0o666)
        fs.chmodSync(path.dirname(dbPath), 0o777)
      } catch (fixError) {
        return NextResponse.json({
          success: false,
          error: 'قاعدة البيانات للقراءة فقط (readonly).\n\nالحلول:\n• أغلق Prisma Studio أو أي برامج تستخدم قاعدة البيانات\n• تأكد من أن التطبيق لديه صلاحيات الكتابة\n• في Mac: قد تحتاج منح صلاحيات Full Disk Access للتطبيق',
          dbPath,
          permissionError: true
        }, { status: 403 })
      }
    }

    // فتح قاعدة البيانات
    const db = new Database(dbPath)

    // قراءة ملفات الـ Migrations
    const migrationsDir = path.join(process.cwd(), 'migrations')

    if (!fs.existsSync(migrationsDir)) {
      db.close()
      return NextResponse.json({
        success: false,
        error: 'مجلد migrations غير موجود'
      }, { status: 404 })
    }

    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort() // ترتيب أبجدي (001, 002, 003...)

    if (migrationFiles.length === 0) {
      db.close()
      return NextResponse.json({
        success: true,
        message: 'لا توجد migrations للتطبيق',
        migrationsApplied: 0
      })
    }

    // التأكد من وجود جدول _migrations
    db.exec(`
      CREATE TABLE IF NOT EXISTS "_migrations" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "name" TEXT NOT NULL UNIQUE,
        "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // جلب الـ migrations المطبقة
    const appliedMigrations = db.prepare('SELECT name FROM _migrations').all() as { name: string }[]
    const appliedNames = new Set(appliedMigrations.map(m => m.name))


    // تطبيق الـ migrations الجديدة
    const migrationsToApply = migrationFiles.filter(file => !appliedNames.has(file))
    const results: any[] = []


    for (const migrationFile of migrationsToApply) {
      try {
        const migrationPath = path.join(migrationsDir, migrationFile)
        const sql = fs.readFileSync(migrationPath, 'utf-8')


        // تطبيق الـ migration — كل statement لوحده عشان لو واحد فشل (زي column already exists) الباقي يتطبق
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'))

        let stmtErrors: string[] = []
        for (const stmt of statements) {
          try {
            db.exec(stmt + ';')
          } catch (stmtErr: any) {
            // تجاهل أخطاء "column already exists" أو "duplicate column"
            const msg = stmtErr.message || ''
            if (msg.includes('duplicate column') || msg.includes('already exists')) {
            } else {
              stmtErrors.push(`${stmt.substring(0, 80)}: ${msg}`)
            }
          }
        }

        if (stmtErrors.length > 0) {
          throw new Error(`Some statements failed:\n${stmtErrors.join('\n')}`)
        }

        // حفظ سجل التطبيق
        db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migrationFile)

        results.push({
          name: migrationFile,
          status: 'success'
        })

      } catch (error: any) {
        console.error(`❌ Error in ${migrationFile}:`, error.message)

        // تحديد نوع الخطأ
        let errorMessage = error.message
        let isReadonlyError = false

        if (error.message && error.message.toLowerCase().includes('readonly')) {
          isReadonlyError = true
          errorMessage = `قاعدة البيانات للقراءة فقط (readonly).

الحلول:
• أغلق Prisma Studio أو أي برنامج يستخدم قاعدة البيانات
• تأكد من أن التطبيق لديه صلاحيات الكتابة
• في Mac: قد تحتاج منح Full Disk Access للتطبيق من System Settings`
        }

        results.push({
          name: migrationFile,
          status: 'error',
          error: errorMessage,
          isReadonlyError
        })

        // إيقاف التطبيق عند أول خطأ
        db.close()
        return NextResponse.json({
          success: false,
          message: `فشل تطبيق migration: ${migrationFile}`,
          error: errorMessage,
          isReadonlyError,
          dbPath,
          results
        }, { status: 500 })
      }
    }

    db.close()

    const message = migrationsToApply.length > 0
      ? `تم تطبيق ${migrationsToApply.length} migrations بنجاح! ✅${isProduction ? '\n\nيُنصح بإعادة تشغيل التطبيق.' : ''}`
      : 'جميع الـ migrations مطبقة مسبقاً ✅'

    return NextResponse.json({
      success: true,
      message,
      migrationsApplied: migrationsToApply.length,
      results,
      isProduction,
      totalMigrations: migrationFiles.length,
      previouslyApplied: appliedNames.size
    })

  } catch (error: any) {
    console.error('❌ خطأ في Migrations:', error)

    // التعامل مع أخطاء الصلاحيات
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية الوصول لهذه الميزة' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'حدث خطأ أثناء تطبيق Migrations'
    }, { status: 500 })
  }
}

// GET - عرض حالة الـ Migrations
export async function GET(request: Request) {
  try {
    await requirePermission(request, 'canAccessAdmin')

    // تحديد مسار قاعدة البيانات
    let dbPath = path.join(process.cwd(), 'prisma', 'gym.db')

    if (process.env.NODE_ENV === 'production' || !fs.existsSync(dbPath)) {
      const appData = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share")
      const productionDbPath = path.join(appData, 'gym-management', 'gym.db')

      if (fs.existsSync(productionDbPath)) {
        dbPath = productionDbPath
      }
    }

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ error: 'قاعدة البيانات غير موجودة' }, { status: 404 })
    }

    const db = new Database(dbPath)

    // التحقق من وجود جدول _migrations
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'
    `).get()

    if (!tableExists) {
      db.close()
      return NextResponse.json({
        appliedMigrations: [],
        pendingMigrations: [],
        message: 'لم يتم تطبيق أي migrations بعد'
      })
    }

    // جلب الـ migrations المطبقة
    const appliedMigrations = db.prepare('SELECT name, appliedAt FROM _migrations ORDER BY id').all()
    db.close()

    // قراءة ملفات الـ Migrations
    const migrationsDir = path.join(process.cwd(), 'migrations')
    const migrationFiles = fs.existsSync(migrationsDir)
      ? fs.readdirSync(migrationsDir).filter(file => file.endsWith('.sql')).sort()
      : []

    const appliedNames = new Set((appliedMigrations as any[]).map(m => m.name))
    const pendingMigrations = migrationFiles.filter(file => !appliedNames.has(file))

    return NextResponse.json({
      appliedMigrations,
      pendingMigrations,
      totalMigrations: migrationFiles.length,
      appliedCount: appliedMigrations.length,
      pendingCount: pendingMigrations.length
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * 🔄 Sync Database - All-in-One
 *
 * يعمل كل حاجة في زرار واحد:
 * 1. إصلاح الصلاحيات
 * 2. Prisma db push (sync schema)
 * 3. Prisma generate
 * 4. Apply migrations
 */

import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { requirePermission } from '../../../../lib/auth'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const execAsync = promisify(exec)

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const steps: any[] = []

  try {
    // التحقق من الصلاحيات
    await requirePermission(request, 'canAccessAdmin')

    console.log('🔄 بدء مزامنة قاعدة البيانات...')

    // تحديد مسار قاعدة البيانات
    let dbPath = path.join(process.cwd(), 'prisma', 'gym.db')
    let isProduction = false

    if (process.env.NODE_ENV === 'production' || !fs.existsSync(dbPath)) {
      const appData = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share")
      const productionDbPath = path.join(appData, 'gym-management', 'gym.db')

      if (fs.existsSync(productionDbPath)) {
        dbPath = productionDbPath
        isProduction = true
      }
    }

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({
        success: false,
        error: 'قاعدة البيانات غير موجودة'
      }, { status: 404 })
    }

    // ==========================================
    // Step 1: إصلاح الصلاحيات
    // ==========================================
    steps.push({ step: 'permissions', status: 'running', message: 'فحص الصلاحيات...' })

    try {
      const dbDir = path.dirname(dbPath)
      fs.accessSync(dbDir, fs.constants.W_OK)
      fs.accessSync(dbPath, fs.constants.W_OK)

      steps[steps.length - 1] = { step: 'permissions', status: 'success', message: 'الصلاحيات جيدة ✅' }
    } catch (permError) {
      // محاولة الإصلاح
      try {
        const { execSync } = require('child_process')
        if (process.platform !== 'win32') {
          execSync(`chmod 666 "${dbPath}"`)
          execSync(`chmod 777 "${path.dirname(dbPath)}"`)
        }
        steps[steps.length - 1] = { step: 'permissions', status: 'success', message: 'تم إصلاح الصلاحيات ✅' }
      } catch (fixError) {
        steps[steps.length - 1] = { step: 'permissions', status: 'error', message: 'فشل إصلاح الصلاحيات' }
        return NextResponse.json({
          success: false,
          error: 'قاعدة البيانات للقراءة فقط. أغلق Prisma Studio وأعد المحاولة.',
          steps
        }, { status: 403 })
      }
    }

    // ==========================================
    // Step 2: Prisma db push (sync schema)
    // ==========================================
    steps.push({ step: 'schema_sync', status: 'running', message: 'مزامنة Schema...' })

    try {
      const prismaBinary = path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js')
      const nodeCmd = process.execPath

      if (fs.existsSync(prismaBinary)) {
        const databaseUrl = `file:${dbPath}`
        const pushCmd = `"${nodeCmd}" "${prismaBinary}" db push --skip-generate`

        await execAsync(pushCmd, {
          timeout: 60000,
          env: { ...process.env, DATABASE_URL: databaseUrl },
          cwd: process.cwd()
        })

        steps[steps.length - 1] = { step: 'schema_sync', status: 'success', message: 'تم مزامنة Schema ✅' }
      } else {
        steps[steps.length - 1] = { step: 'schema_sync', status: 'skipped', message: 'Prisma غير موجود (تخطي)' }
      }
    } catch (error: any) {
      // إذا فشل prisma db push، نتخطاه ونكمل
      steps[steps.length - 1] = { step: 'schema_sync', status: 'skipped', message: 'تخطي Schema sync' }
    }

    // ==========================================
    // Step 3: Apply Migrations
    // ==========================================
    steps.push({ step: 'migrations', status: 'running', message: 'تطبيق Migrations...' })

    const db = new Database(dbPath)
    const migrationsDir = path.join(process.cwd(), 'migrations')

    if (!fs.existsSync(migrationsDir)) {
      steps[steps.length - 1] = { step: 'migrations', status: 'skipped', message: 'لا توجد migrations' }
    } else {
      // إنشاء جدول _migrations
      db.exec(`
        CREATE TABLE IF NOT EXISTS "_migrations" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "name" TEXT NOT NULL UNIQUE,
          "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `)

      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort()

      const appliedMigrations = db.prepare('SELECT name FROM _migrations').all() as { name: string }[]
      const appliedNames = new Set(appliedMigrations.map(m => m.name))

      const migrationsToApply = migrationFiles.filter(file => !appliedNames.has(file))

      if (migrationsToApply.length === 0) {
        steps[steps.length - 1] = { step: 'migrations', status: 'success', message: 'جميع Migrations مطبقة مسبقاً ✅' }
      } else {
        let appliedCount = 0

        for (const migrationFile of migrationsToApply) {
          try {
            const migrationPath = path.join(migrationsDir, migrationFile)
            const sql = fs.readFileSync(migrationPath, 'utf-8')

            db.exec(sql)
            db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migrationFile)
            appliedCount++
          } catch (error: any) {
            db.close()
            steps[steps.length - 1] = {
              step: 'migrations',
              status: 'error',
              message: `فشل تطبيق ${migrationFile}: ${error.message}`
            }
            return NextResponse.json({
              success: false,
              error: `فشل تطبيق migration: ${migrationFile}`,
              errorDetails: error.message,
              steps
            }, { status: 500 })
          }
        }

        steps[steps.length - 1] = {
          step: 'migrations',
          status: 'success',
          message: `تم تطبيق ${appliedCount} migrations ✅`
        }
      }
    }

    db.close()

    // ==========================================
    // Step 4: Prisma Generate
    // ==========================================
    steps.push({ step: 'generate', status: 'running', message: 'توليد Prisma Client...' })

    try {
      const prismaBinary = path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js')
      const nodeCmd = process.execPath

      if (fs.existsSync(prismaBinary)) {
        const genCmd = `"${nodeCmd}" "${prismaBinary}" generate`

        await execAsync(genCmd, {
          timeout: 60000,
          cwd: process.cwd()
        })

        steps[steps.length - 1] = { step: 'generate', status: 'success', message: 'تم توليد Prisma Client ✅' }
      } else {
        steps[steps.length - 1] = { step: 'generate', status: 'skipped', message: 'Prisma غير موجود (تخطي)' }
      }
    } catch (error: any) {
      steps[steps.length - 1] = { step: 'generate', status: 'warning', message: 'فشل توليد Client (غير ضروري)' }
    }

    // ==========================================
    // النتيجة النهائية
    // ==========================================
    const message = isProduction
      ? '✅ تم تحديث قاعدة البيانات بنجاح!\n\nيُنصح بإعادة تشغيل التطبيق.'
      : '✅ تم تحديث قاعدة البيانات بنجاح!'

    return NextResponse.json({
      success: true,
      message,
      steps,
      isProduction,
      dbPath
    })

  } catch (error: any) {
    console.error('❌ خطأ في المزامنة:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية الوصول' }, { status: 403 })
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'حدث خطأ غير متوقع',
      steps
    }, { status: 500 })
  }
}

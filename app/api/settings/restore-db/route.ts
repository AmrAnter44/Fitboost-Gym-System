import { NextResponse } from 'next/server'
import { requirePermission } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

export const dynamic = 'force-dynamic'

// استخراج مسار قاعدة البيانات من DATABASE_URL
function getDbPath(): string {
  const dbUrl = process.env.DATABASE_URL || ''
  const match = dbUrl.match(/file:([^?]+)/)
  if (match) {
    return match[1]
  }
  return path.join(process.cwd(), 'prisma', 'gym.db')
}

// رفع وتحديث قاعدة البيانات
export async function POST(request: Request) {
  try {
    await requirePermission(request, 'canAccessSettings')

    const formData = await request.formData()
    const file = formData.get('database') as File

    if (!file) {
      return NextResponse.json({ error: 'لم يتم رفع أي ملف' }, { status: 400 })
    }

    if (!file.name.endsWith('.db')) {
      return NextResponse.json({ error: 'يجب أن يكون الملف بامتداد .db' }, { status: 400 })
    }

    // قراءة بايتات الملف
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // التحقق من الـ SQLite magic bytes: "SQLite format 3\x00"
    const sqliteMagic = Buffer.from([
      0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66,
      0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00
    ])

    if (buffer.length < 16 || !buffer.subarray(0, 16).equals(sqliteMagic)) {
      return NextResponse.json(
        { error: 'الملف ليس قاعدة بيانات SQLite صالحة' },
        { status: 400 }
      )
    }

    const dbPath = getDbPath()
    const backupPath = `${dbPath}.backup.${Date.now()}`

    // نسخ احتياطي للـ database الحالية
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPath)
    }

    // قطع الاتصال بـ Prisma قبل استبدال الملف
    await prisma.$disconnect()

    // كتابة الـ database الجديدة مع ضمان إعادة اتصال Prisma
    try {
      fs.writeFileSync(dbPath, buffer)

      // حذف ملفات WAL و SHM القديمة إن وجدت
      const walPath = `${dbPath}-wal`
      const shmPath = `${dbPath}-shm`
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath)
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath)
    } catch (writeError) {
      // في حالة فشل الكتابة، استعد النسخة الاحتياطية وأعد اتصال Prisma
      console.error('Failed to write database file:', writeError)
      try {
        if (fs.existsSync(backupPath)) {
          fs.copyFileSync(backupPath, dbPath)
        }
      } catch (restoreError) {
        console.error('Failed to restore backup:', restoreError)
      }
      await prisma.$connect()
      throw new Error('فشل كتابة ملف قاعدة البيانات الجديدة')
    }

    // تشغيل Prisma migrate لتحديث الـ schema
    let migrateOutput = ''
    try {
      migrateOutput = execSync('npx prisma migrate deploy', {
        cwd: process.cwd(),
        env: { ...process.env },
        timeout: 60000,
        encoding: 'utf8',
        stdio: 'pipe'
      }) as string
    } catch (migrateError: any) {
      migrateOutput = migrateError.message
    }

    // استعادة اتصال Prisma
    await prisma.$connect()

    return NextResponse.json({
      success: true,
      message: 'تم رفع قاعدة البيانات وتحديث الـ schema بنجاح',
      fileSize: `${(buffer.length / 1024 / 1024).toFixed(2)} MB`,
      backupName: path.basename(backupPath),
      migrate: migrateOutput ? 'تم تطبيق الـ migrations' : 'لا توجد migrations جديدة'
    })
  } catch (error: any) {
    console.error('❌ خطأ في restore-db:', error)

    if (error.message === 'Unauthorized' || error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    }

    return NextResponse.json(
      { error: 'حدث خطأ: ' + error.message },
      { status: 500 }
    )
  }
}

// جلب معلومات قاعدة البيانات الحالية
export async function GET(request: Request) {
  try {
    await requirePermission(request, 'canAccessSettings')

    const dbPath = getDbPath()
    const stats = fs.existsSync(dbPath) ? fs.statSync(dbPath) : null

    // البحث عن النسخ الاحتياطية
    const dbDir = path.dirname(dbPath)
    const dbBasename = path.basename(dbPath)
    const allFiles = fs.existsSync(dbDir) ? fs.readdirSync(dbDir) : []
    const backups = allFiles
      .filter(f => f.startsWith(dbBasename + '.backup.'))
      .map(f => {
        const timestamp = parseInt(f.split('.backup.')[1])
        const filePath = path.join(dbDir, f)
        const fileStats = fs.statSync(filePath)
        return {
          name: f,
          size: `${(fileStats.size / 1024 / 1024).toFixed(2)} MB`,
          date: new Date(timestamp).toLocaleString('ar-EG')
        }
      })
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(0, 5) // آخر 5 نسخ فقط

    return NextResponse.json({
      dbPath,
      size: stats ? `${(stats.size / 1024 / 1024).toFixed(2)} MB` : 'غير موجود',
      lastModified: stats ? stats.mtime.toLocaleString('ar-EG') : null,
      backups
    })
  } catch (error: any) {
    console.error('❌ خطأ في restore-db GET:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }

    if (error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية الوصول للإعدادات' }, { status: 403 })
    }

    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

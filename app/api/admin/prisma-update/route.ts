// app/api/admin/prisma-update/route.ts
import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { requirePermission } from '../../../../lib/auth'
import path from 'path'
import fs from 'fs'

const execAsync = promisify(exec)

export const dynamic = 'force-dynamic'

// POST - تحديث Prisma (db push + generate)
export async function POST(request: Request) {
  try {
    // التحقق من صلاحية الأدمن
    await requirePermission(request, 'canAccessAdmin')

    console.log('🔄 بدء تحديث Prisma...')

    // تحديد مسار قاعدة البيانات (Development أو Production)
    let dbPath = path.join(process.cwd(), 'prisma', 'gym.db')
    let isProduction = false

    // في Production (Electron)، قاعدة البيانات في AppData
    if (process.env.NODE_ENV === 'production' || !fs.existsSync(dbPath)) {
      const appData = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share")
      const productionDbPath = path.join(appData, 'gym-management', 'gym.db')

      if (fs.existsSync(productionDbPath)) {
        dbPath = productionDbPath
        isProduction = true
        console.log('📦 Using production database:', productionDbPath)
      } else {
        console.log('📁 Using development database:', dbPath)
      }
    }

    // إنشاء DATABASE_URL المناسب
    const databaseUrl = `file:${dbPath}`
    console.log('🗄️ Database URL:', databaseUrl)

    const results = {
      dbPush: { success: false, output: '', error: '' },
      generate: { success: false, output: '', error: '' },
      databasePath: dbPath,
      isProduction
    }

    // تحديد مسار Prisma CLI
    const prismaBinary = path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js')
    const nodeCmd = process.execPath // node executable

    console.log('🔍 Prisma binary:', prismaBinary)
    console.log('🔍 Node:', nodeCmd)

    // التحقق من وجود Prisma
    if (!fs.existsSync(prismaBinary)) {
      return NextResponse.json({
        success: false,
        message: 'Prisma CLI غير موجود. تأكد من تثبيت prisma package.',
        error: `Prisma binary not found at: ${prismaBinary}`
      }, { status: 500 })
    }

    // 1. تطبيق التغييرات على قاعدة البيانات
    try {
      console.log('📦 تطبيق التغييرات على قاعدة البيانات...')

      // تشغيل prisma db push باستخدام node مباشرة
      const pushCmd = `"${nodeCmd}" "${prismaBinary}" db push --skip-generate`
      console.log('🔧 Command:', pushCmd)

      const { stdout: pushOutput, stderr: pushError } = await execAsync(
        pushCmd,
        {
          timeout: 60000, // 60 seconds timeout
          env: {
            ...process.env,
            DATABASE_URL: databaseUrl
          },
          cwd: process.cwd()
        }
      )

      results.dbPush.success = true
      results.dbPush.output = pushOutput
      results.dbPush.error = pushError

      console.log('✅ تم تطبيق التغييرات بنجاح')
    } catch (pushError: any) {
      console.error('❌ خطأ في db push:', pushError.message)
      results.dbPush.error = pushError.message

      return NextResponse.json({
        success: false,
        message: 'فشل تطبيق التغييرات على قاعدة البيانات',
        results
      }, { status: 500 })
    }

    // 2. توليد Prisma Client
    try {
      console.log('⚙️ توليد Prisma Client...')

      const genCmd = `"${nodeCmd}" "${prismaBinary}" generate`
      console.log('🔧 Command:', genCmd)

      const { stdout: genOutput, stderr: genError } = await execAsync(
        genCmd,
        {
          timeout: 60000,
          cwd: process.cwd()
        }
      )

      results.generate.success = true
      results.generate.output = genOutput
      results.generate.error = genError

      console.log('✅ تم توليد Prisma Client بنجاح')
    } catch (genError: any) {
      console.error('❌ خطأ في generate:', genError.message)
      results.generate.error = genError.message

      return NextResponse.json({
        success: false,
        message: 'فشل توليد Prisma Client',
        results
      }, { status: 500 })
    }

    console.log('✅ تم تحديث Prisma بنجاح!')

    const message = isProduction
      ? 'تم تحديث قاعدة البيانات في Production بنجاح! ✅\n\nيُنصح بإعادة تشغيل التطبيق.'
      : 'تم تحديث Prisma بنجاح! يُنصح بإعادة تشغيل السيرفر.'

    return NextResponse.json({
      success: true,
      message,
      results
    }, { status: 200 })

  } catch (error: any) {
    console.error('❌ خطأ في تحديث Prisma:', error)

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
      message: 'فشل تحديث Prisma',
      error: error.message
    }, { status: 500 })
  }
}

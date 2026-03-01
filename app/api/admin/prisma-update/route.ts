// app/api/admin/prisma-update/route.ts
import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { requirePermission } from '../../../../lib/auth'

const execAsync = promisify(exec)

export const dynamic = 'force-dynamic'

// POST - تحديث Prisma (db push + generate)
export async function POST(request: Request) {
  try {
    // التحقق من صلاحية الأدمن
    await requirePermission(request, 'canAccessAdmin')

    console.log('🔄 بدء تحديث Prisma...')

    const results = {
      dbPush: { success: false, output: '', error: '' },
      generate: { success: false, output: '', error: '' }
    }

    // 1. تطبيق التغييرات على قاعدة البيانات
    try {
      console.log('📦 تطبيق التغييرات على قاعدة البيانات...')
      const { stdout: pushOutput, stderr: pushError } = await execAsync(
        'npx prisma db push --accept-data-loss',
        { timeout: 60000 } // 60 seconds timeout
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
      const { stdout: genOutput, stderr: genError } = await execAsync(
        'npx prisma generate',
        { timeout: 60000 }
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

    return NextResponse.json({
      success: true,
      message: 'تم تحديث Prisma بنجاح! يُنصح بإعادة تشغيل السيرفر.',
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

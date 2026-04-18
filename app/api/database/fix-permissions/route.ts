/**
 * API لإصلاح صلاحيات قاعدة البيانات
 * Fix database permissions (readonly error)
 */

import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
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
      } else {
      }
    }

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({
        success: false,
        error: 'قاعدة البيانات غير موجودة في المسار المحدد'
      }, { status: 404 })
    }

    const dbDir = path.dirname(dbPath)
    const results: any = {
      dbPath,
      isProduction,
      platform: process.platform,
      fixes: []
    }

    // التحقق من الصلاحيات الحالية
    try {
      const stats = fs.statSync(dbPath)
      results.currentPermissions = {
        mode: stats.mode.toString(8),
        uid: stats.uid
      }
    } catch (error) {
      console.error('Cannot read database stats:', error)
    }

    // إصلاح الصلاحيات
    try {
      if (process.platform === 'win32') {
        // Windows

        try {
          execSync(`attrib -R "${dbPath}"`)
          results.fixes.push({
            action: 'Remove readonly flag from database',
            status: 'success'
          })
        } catch (error: any) {
          results.fixes.push({
            action: 'Remove readonly flag from database',
            status: 'error',
            error: error.message
          })
          console.error('⚠️ Could not remove readonly flag:', error.message)
        }

      } else {
        // Mac/Linux

        // قاعدة البيانات
        try {
          execSync(`chmod 666 "${dbPath}"`)
          results.fixes.push({
            action: 'Database file permissions (666)',
            status: 'success'
          })
        } catch (error: any) {
          results.fixes.push({
            action: 'Database file permissions',
            status: 'error',
            error: error.message
          })
        }

        // المجلد
        try {
          execSync(`chmod 777 "${dbDir}"`)
          results.fixes.push({
            action: 'Directory permissions (777)',
            status: 'success'
          })
        } catch (error: any) {
          results.fixes.push({
            action: 'Directory permissions',
            status: 'error',
            error: error.message
          })
        }

        // إضافة صلاحيات للـ journal files أيضاً
        const journalFiles = [
          `${dbPath}-journal`,
          `${dbPath}-wal`,
          `${dbPath}-shm`
        ]

        for (const journalFile of journalFiles) {
          if (fs.existsSync(journalFile)) {
            try {
              execSync(`chmod 666 "${journalFile}"`)
              results.fixes.push({
                action: `Journal file: ${path.basename(journalFile)}`,
                status: 'success'
              })
            } catch (error: any) {
              results.fixes.push({
                action: `Journal file: ${path.basename(journalFile)}`,
                status: 'error',
                error: error.message
              })
            }
          }
        }
      }

      // التحقق من النجاح
      const allSuccess = results.fixes.every((fix: any) => fix.status === 'success')
      const hasErrors = results.fixes.some((fix: any) => fix.status === 'error')

      if (allSuccess) {
        return NextResponse.json({
          success: true,
          message: 'تم إصلاح صلاحيات قاعدة البيانات بنجاح! ✅\n\nيمكنك الآن محاولة تطبيق التحديثات مرة أخرى.',
          results
        })
      } else if (hasErrors) {
        return NextResponse.json({
          success: false,
          message: 'تم إصلاح بعض الصلاحيات لكن حدثت بعض الأخطاء.\n\nقد تحتاج صلاحيات Admin لإكمال الإصلاح.',
          results
        }, { status: 207 }) // 207 Multi-Status
      } else {
        return NextResponse.json({
          success: true,
          message: 'تم محاولة إصلاح الصلاحيات.',
          results
        })
      }

    } catch (error: any) {
      console.error('❌ Error fixing permissions:', error)

      return NextResponse.json({
        success: false,
        error: 'فشل إصلاح الصلاحيات',
        message: error.message,
        results,
        manualFix: process.platform === 'win32'
          ? `attrib -R "${dbPath}"`
          : `chmod 666 "${dbPath}" && chmod 777 "${dbDir}"`
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('❌ خطأ في API:', error)

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
      error: error.message || 'حدث خطأ غير متوقع'
    }, { status: 500 })
  }
}

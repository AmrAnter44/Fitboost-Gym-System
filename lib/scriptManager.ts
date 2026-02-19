// نظام إدارة السكريبتات (Migrations/Setup Scripts)
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ✅ جدول لتتبع السكريبتات المنفذة
export interface ScriptExecution {
  id: string
  scriptName: string
  executedAt: Date
  success: boolean
  error?: string
}

/**
 * التحقق إذا كان السكريبت تم تنفيذه مسبقاً
 */
export async function isScriptExecuted(scriptName: string): Promise<boolean> {
  try {
    // التحقق من وجود جدول script_executions
    const result = await prisma.$queryRawUnsafe<any[]>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='script_executions'`
    )

    if (result.length === 0) {
      // الجدول غير موجود، إنشاؤه
      await createScriptExecutionsTable()
      return false
    }

    // التحقق إذا كان السكريبت منفذ
    const execution = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM script_executions WHERE scriptName = ? AND success = 1 LIMIT 1`,
      scriptName
    )

    return execution.length > 0
  } catch (error) {
    console.error('❌ خطأ في التحقق من السكريبت:', error)
    return false
  }
}

/**
 * تسجيل تنفيذ سكريبت
 */
export async function markScriptAsExecuted(
  scriptName: string,
  success: boolean,
  error?: string
): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO script_executions (id, scriptName, executedAt, success, error) VALUES (?, ?, ?, ?, ?)`,
      crypto.randomUUID(),
      scriptName,
      new Date().toISOString(),
      success ? 1 : 0,
      error || null
    )
  } catch (err) {
    console.error('❌ خطأ في تسجيل السكريبت:', err)
  }
}

/**
 * إنشاء جدول script_executions
 */
async function createScriptExecutionsTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS script_executions (
      id TEXT PRIMARY KEY,
      scriptName TEXT NOT NULL,
      executedAt TEXT NOT NULL,
      success INTEGER NOT NULL,
      error TEXT
    )
  `)
}

/**
 * تنفيذ سكريبت بشكل آمن (مع تسجيل)
 */
export async function runScript(
  scriptName: string,
  scriptFunction: () => Promise<void>
): Promise<{ success: boolean; error?: string }> {
  try {
    // التحقق إذا كان السكريبت تم تنفيذه مسبقاً
    const alreadyExecuted = await isScriptExecuted(scriptName)

    if (alreadyExecuted) {
      return { success: true }
    }


    // تنفيذ السكريبت
    await scriptFunction()

    // تسجيل النجاح
    await markScriptAsExecuted(scriptName, true)

    return { success: true }
  } catch (error) {
    const errorMessage = (error as Error).message

    // تسجيل الفشل
    await markScriptAsExecuted(scriptName, false, errorMessage)

    console.error(`❌ فشل تنفيذ السكريبت "${scriptName}":`, errorMessage)
    return { success: false, error: errorMessage }
  } finally {
    await prisma.$disconnect()
  }
}

/**
 * الحصول على قائمة السكريبتات المنفذة
 */
export async function getExecutedScripts(): Promise<ScriptExecution[]> {
  try {
    const result = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM script_executions ORDER BY executedAt DESC`
    )

    return result.map(row => ({
      id: row.id,
      scriptName: row.scriptName,
      executedAt: new Date(row.executedAt),
      success: row.success === 1,
      error: row.error
    }))
  } catch (error) {
    console.error('❌ خطأ في جلب السكريبتات:', error)
    return []
  }
}

/**
 * حذف سكريبت من السجل (لإعادة تنفيذه)
 */
export async function resetScript(scriptName: string): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM script_executions WHERE scriptName = ?`,
      scriptName
    )
  } catch (error) {
    console.error('❌ خطأ في إعادة تعيين السكريبت:', error)
  }
}

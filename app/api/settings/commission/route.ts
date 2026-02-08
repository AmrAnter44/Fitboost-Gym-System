import { NextResponse } from 'next/server'
import { requirePermission } from '../../../../lib/auth'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'commission-settings.json')

// دالة لقراءة الإعدادات
function readSettings() {
  try {
    // إنشاء المجلد إذا لم يكن موجوداً
    const dir = path.dirname(SETTINGS_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // قراءة الملف
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8')
      return JSON.parse(data)
    }

    // إعدادات افتراضية
    return {
      defaultCommissionMethod: 'revenue' // revenue أو sessions
    }
  } catch (error) {
    console.error('Error reading settings:', error)
    return {
      defaultCommissionMethod: 'revenue'
    }
  }
}

// دالة لكتابة الإعدادات
function writeSettings(settings: any) {
  try {
    const dir = path.dirname(SETTINGS_FILE)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8')
    return true
  } catch (error) {
    console.error('Error writing settings:', error)
    return false
  }
}

// GET - جلب الإعدادات (متاحة لجميع المستخدمين المسجلين)
export async function GET(request: Request) {
  try {
    // التحقق من تسجيل الدخول فقط (بدون صلاحيات محددة)
    const cookieStore = request.headers.get('cookie')
    const token = cookieStore?.split(';').find(c => c.trim().startsWith('auth-token='))?.split('=')[1]

    if (!token) {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    const settings = readSettings()
    console.log('📖 Commission settings fetched:', settings)

    return NextResponse.json(settings)
  } catch (error: any) {
    console.error('Error fetching settings:', error)

    return NextResponse.json(
      { error: 'فشل جلب الإعدادات' },
      { status: 500 }
    )
  }
}

// PUT - تحديث الإعدادات (للأدمن فقط)
export async function PUT(request: Request) {
  try {
    /**
     * تحديث إعدادات الكومشن
     * @permission canAccessSettings - صلاحية الوصول للإعدادات العامة
     */
    const user = await requirePermission(request, 'canAccessSettings')

    const body = await request.json()
    const { defaultCommissionMethod } = body

    // التحقق من صحة القيمة
    if (!['revenue', 'sessions'].includes(defaultCommissionMethod)) {
      return NextResponse.json(
        { error: 'طريقة حساب غير صحيحة' },
        { status: 400 }
      )
    }

    // قراءة الإعدادات الحالية
    const currentSettings = readSettings()

    // تحديث الطريقة
    currentSettings.defaultCommissionMethod = defaultCommissionMethod

    // حفظ الإعدادات
    const success = writeSettings(currentSettings)

    if (!success) {
      return NextResponse.json(
        { error: 'فشل حفظ الإعدادات' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      settings: currentSettings
    })
  } catch (error: any) {
    console.error('Error updating settings:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'فشل تحديث الإعدادات' },
      { status: 500 }
    )
  }
}

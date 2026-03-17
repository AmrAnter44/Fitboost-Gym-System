/**
 * API لإصلاح جدول WhatsApp Templates
 */

import { NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

export async function POST() {
  try {
    console.log('🔧 Starting WhatsApp Templates table fix...')

    // تحديد مسار قاعدة البيانات
    let dbPath = path.join(process.cwd(), 'prisma', 'gym.db')

    // في Production (Electron)، قاعدة البيانات في AppData
    if (process.env.NODE_ENV === 'production' || !fs.existsSync(dbPath)) {
      const os = require('os')
      const appData = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share")
      const productionDbPath = path.join(appData, 'gym-management', 'gym.db')

      if (fs.existsSync(productionDbPath)) {
        dbPath = productionDbPath
        console.log('📦 Using production database:', productionDbPath)
      }
    }

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json(
        { success: false, error: 'Database not found' },
        { status: 404 }
      )
    }

    // فتح قاعدة البيانات
    const db = new Database(dbPath)

    // التحقق من وجود الجدول
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='WhatsAppTemplate'
    `).get()

    if (tableExists) {
      db.close()
      return NextResponse.json({
        success: true,
        message: 'جدول WhatsApp Templates موجود بالفعل',
        alreadyExists: true
      })
    }

    // إنشاء جدول WhatsAppTemplate
    db.exec(`
      CREATE TABLE IF NOT EXISTS "WhatsAppTemplate" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "title" TEXT NOT NULL,
        "icon" TEXT NOT NULL DEFAULT '💬',
        "message" TEXT NOT NULL,
        "isCustom" INTEGER NOT NULL DEFAULT 1,
        "isDefault" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // إضافة القوالب الافتراضية
    const defaultTemplates = [
      {
        id: 'default-1',
        title: 'تواصل أول',
        icon: '👋',
        message: `مرحباً {name}! 🏋️\n\nشكراً لزيارتك لـ Gym System\n\nنحن سعداء باهتمامك بالانضمام إلينا!\n\n📞 للاستفسارات: {phone}\n📍 العنوان: {address}\n\n💪 ننتظرك!`,
        isCustom: 0,
        isDefault: 1
      },
      {
        id: 'default-2',
        title: 'متابعة ثانية',
        icon: '📞',
        message: `أهلاً {name}! 😊\n\nمر بعض الوقت منذ زيارتك الأخيرة\n\nهل لديك أي استفسارات؟\n\n🎁 لدينا عروض جديدة قد تناسبك!\n\n💪 نحن في انتظارك`,
        isCustom: 0,
        isDefault: 1
      },
      {
        id: 'default-3',
        title: 'عرض خاص',
        icon: '🎁',
        message: `{name} عزيزي! 🎉\n\n🔥 عرض خاص لفترة محدودة!\n\n✨ خصم {discount}% على جميع الاشتراكات\n\n⏰ العرض ساري حتى: {endDate}\n\n📞 للحجز: {phone}\n\n💪 لا تفوت الفرصة!`,
        isCustom: 0,
        isDefault: 1
      },
      {
        id: 'default-4',
        title: 'تذكير بالموعد',
        icon: '⏰',
        message: `مرحباً {name}! 🏋️\n\n📅 تذكير بموعد حصتك:\n🕐 الوقت: {time}\n📍 المكان: {location}\n\n💪 نراك قريباً!`,
        isCustom: 0,
        isDefault: 1
      }
    ]

    const insertStmt = db.prepare(`
      INSERT INTO WhatsAppTemplate (id, title, icon, message, isCustom, isDefault, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `)

    let insertedCount = 0
    for (const template of defaultTemplates) {
      try {
        insertStmt.run(
          template.id,
          template.title,
          template.icon,
          template.message,
          template.isCustom,
          template.isDefault
        )
        insertedCount++
      } catch (err) {
        console.error(`Error inserting template ${template.title}:`, err)
      }
    }

    // إغلاق الاتصال
    db.close()

    return NextResponse.json({
      success: true,
      message: `تم إنشاء جدول WhatsApp Templates بنجاح وإضافة ${insertedCount} قالب افتراضي`,
      templatesAdded: insertedCount
    })

  } catch (error) {
    console.error('Error fixing WhatsApp templates:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

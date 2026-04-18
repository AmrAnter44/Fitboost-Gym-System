/**
 * ✅ Fix WhatsApp Templates Table - Production Database
 *
 * هذا الـ script يضيف جدول WhatsAppTemplate إلى قاعدة البيانات في Production
 */

const sqlite3 = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

function fixWhatsAppTemplatesTable() {
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
    } else {
      console.log('⚠️ Production database not found at:', productionDbPath)
      console.log('📁 Using development database:', dbPath)
    }
  }

  if (!fs.existsSync(dbPath)) {
    console.error('❌ Database not found at:', dbPath)
    process.exit(1)
  }

  console.log('📂 Database path:', dbPath)

  try {
    // فتح قاعدة البيانات
    const db = sqlite3(dbPath)

    // التحقق من وجود الجدول
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='WhatsAppTemplate'
    `).get()

    if (tableExists) {
      console.log('✅ WhatsAppTemplate table already exists')
      db.close()
      return
    }

    console.log('🔨 Creating WhatsAppTemplate table...')

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

    console.log('✅ WhatsAppTemplate table created successfully')

    // إضافة القوالب الافتراضية
    console.log('📝 Inserting default templates...')

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

    for (const template of defaultTemplates) {
      insertStmt.run(
        template.id,
        template.title,
        template.icon,
        template.message,
        template.isCustom,
        template.isDefault
      )
      console.log(`  ✓ Added template: ${template.title}`)
    }

    console.log('✅ Default templates inserted successfully')

    // إغلاق الاتصال
    db.close()

    console.log('🎉 Database fix completed successfully!')
    console.log('')
    console.log('📌 Next steps:')
    console.log('   1. Restart the application')
    console.log('   2. WhatsApp templates should work now')
    console.log('')

  } catch (error) {
    console.error('❌ Error fixing database:', error)
    process.exit(1)
  }
}

// تشغيل الـ script
fixWhatsAppTemplatesTable()

/**
 * إصلاح صلاحيات قاعدة البيانات
 * Fix database permissions (readonly error)
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

function fixDatabasePermissions() {
  console.log('🔧 إصلاح صلاحيات قاعدة البيانات...\n')

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
      console.log('📦 Using production database:', productionDbPath)
    } else {
      console.log('📁 Using development database:', dbPath)
    }
  }

  if (!fs.existsSync(dbPath)) {
    console.error('❌ Database not found at:', dbPath)
    process.exit(1)
  }

  console.log('📂 Database path:', dbPath)
  console.log('')

  // التحقق من الصلاحيات الحالية
  try {
    const stats = fs.statSync(dbPath)
    console.log('📊 Current permissions:')
    console.log('   Mode:', stats.mode.toString(8))
    console.log('   Owner:', stats.uid)
    console.log('')
  } catch (error) {
    console.error('❌ Cannot read database stats:', error.message)
  }

  // إصلاح الصلاحيات
  try {
    const dbDir = path.dirname(dbPath)

    console.log('🔨 Fixing permissions...')

    // إعطاء صلاحيات الكتابة لقاعدة البيانات
    if (process.platform === 'win32') {
      // Windows
      console.log('💻 Windows detected')
      try {
        execSync(`attrib -R "${dbPath}"`, { stdio: 'inherit' })
        console.log('   ✅ Removed readonly flag from database')
      } catch (error) {
        console.error('   ⚠️ Could not remove readonly flag')
      }
    } else {
      // Mac/Linux
      console.log('🍎 Mac/Linux detected')

      // قاعدة البيانات
      execSync(`chmod 666 "${dbPath}"`, { stdio: 'inherit' })
      console.log('   ✅ Database: 666 (rw-rw-rw-)')

      // المجلد
      execSync(`chmod 777 "${dbDir}"`, { stdio: 'inherit' })
      console.log('   ✅ Directory: 777 (rwxrwxrwx)')

      // إضافة صلاحيات للـ journal files أيضاً
      const journalFiles = [
        `${dbPath}-journal`,
        `${dbPath}-wal`,
        `${dbPath}-shm`
      ]

      for (const journalFile of journalFiles) {
        if (fs.existsSync(journalFile)) {
          execSync(`chmod 666 "${journalFile}"`, { stdio: 'inherit' })
          console.log(`   ✅ ${path.basename(journalFile)}: 666`)
        }
      }
    }

    console.log('')
    console.log('✅ Permissions fixed successfully!')
    console.log('')
    console.log('📝 Next steps:')
    console.log('   1. Restart the application')
    console.log('   2. Try the migration again')
    console.log('')

  } catch (error) {
    console.error('')
    console.error('❌ Error fixing permissions:', error.message)
    console.error('')
    console.error('💡 Manual fix (Mac/Linux):')
    console.error(`   chmod 666 "${dbPath}"`)
    console.error(`   chmod 777 "${path.dirname(dbPath)}"`)
    console.error('')
    console.error('💡 Manual fix (Windows):')
    console.error(`   attrib -R "${dbPath}"`)
    console.error('')
    process.exit(1)
  }
}

// تشغيل الـ script
fixDatabasePermissions()

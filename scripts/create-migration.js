#!/usr/bin/env node
/**
 * إنشاء Migration جديد من schema.prisma
 * Create new migration from schema.prisma
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(query) {
  return new Promise(resolve => rl.question(query, resolve))
}

async function createMigration() {
  console.log('🔄 إنشاء Migration جديد من schema.prisma\n')

  // اسم الـ migration
  const name = await question('أدخل اسم الـ Migration (مثال: add_new_table): ')

  if (!name || !name.trim()) {
    console.error('❌ يجب إدخال اسم للـ migration')
    rl.close()
    process.exit(1)
  }

  const cleanName = name.trim().toLowerCase().replace(/\s+/g, '_')

  // البحث عن آخر migration number
  const migrationsDir = path.join(process.cwd(), 'migrations')

  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true })
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  let nextNumber = 1
  if (files.length > 0) {
    const lastFile = files[files.length - 1]
    const match = lastFile.match(/^(\d+)_/)
    if (match) {
      nextNumber = parseInt(match[1]) + 1
    }
  }

  const migrationNumber = String(nextNumber).padStart(3, '0')
  const fileName = `${migrationNumber}_${cleanName}.sql`
  const filePath = path.join(migrationsDir, fileName)

  console.log(`\n📝 إنشاء: ${fileName}\n`)

  try {
    // استخدام Prisma لتوليد SQL diff
    console.log('⚙️ توليد SQL من Prisma...')

    const sql = execSync(
      'npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script',
      { encoding: 'utf-8' }
    )

    // كتابة الملف
    const header = `-- Migration: ${cleanName.replace(/_/g, ' ')}
-- Created: ${new Date().toISOString().split('T')[0]}
-- Generated from: prisma/schema.prisma

`
    fs.writeFileSync(filePath, header + sql)

    console.log('✅ تم إنشاء الـ migration بنجاح!')
    console.log(`📁 الملف: migrations/${fileName}\n`)
    console.log('📋 الخطوات التالية:')
    console.log('   1. راجع الـ SQL في الملف')
    console.log('   2. عدّل حسب الحاجة')
    console.log('   3. commit الملف')
    console.log('   4. في Production: Settings → Database → تطبيق التحديثات\n')

  } catch (error) {
    console.error('❌ خطأ في توليد الـ migration:', error.message)
    console.log('\n💡 يمكنك إنشاء الملف يدوياً:')
    console.log(`   touch ${filePath}`)
    console.log('   ثم اكتب SQL يدوياً\n')
    rl.close()
    process.exit(1)
  }

  rl.close()
}

createMigration()

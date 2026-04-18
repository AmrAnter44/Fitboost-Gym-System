// scripts/create-admin.ts - إنشاء حساب أدمن (مع نظام التتبع)
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { runScript } from '../lib/scriptManager'

const prisma = new PrismaClient()

async function createAdminScript() {
  // Check if admin exists
  const existing = await prisma.user.findUnique({
    where: { email: 'admin@gym.com' }
  })

  if (existing) {
    console.log('✅ Admin already exists!')
    return
  }

  // Create admin
  const hashedPassword = await bcrypt.hash('admin123', 10)

  const admin = await prisma.user.create({
    data: {
      email: 'admin@gym.com',
      name: 'Admin',
      password: hashedPassword,
      role: 'ADMIN',
      isActive: true
    }
  })

  // Create permissions
  await prisma.permission.create({
    data: {
      userId: admin.id,
      canViewMembers: true,
      canCreateMembers: true,
      canEditMembers: true,
      canDeleteMembers: true,
      canViewPT: true,
      canCreatePT: true,
      canEditPT: true,
      canDeletePT: true,
      canViewStaff: true,
      canCreateStaff: true,
      canEditStaff: true,
      canDeleteStaff: true,
      canViewReceipts: true,
      canEditReceipts: true,
      canDeleteReceipts: true,
      canViewReports: true,
      canViewFinancials: true,
      canAccessSettings: true
    }
  })

  console.log('✅ Admin created successfully!')
  console.log('📧 Email: admin@gym.com')
  console.log('🔐 Password: admin123')
}

// ✅ تنفيذ السكريبت مع التتبع
runScript('create-admin', createAdminScript)
  .then(result => {
    if (result.success) {
      console.log('✅ السكريبت اكتمل بنجاح')
    } else {
      console.error('❌ فشل السكريبت:', result.error)
    }
    process.exit(result.success ? 0 : 1)
  })
  .catch(error => {
    console.error('❌ خطأ غير متوقع:', error)
    process.exit(1)
  })

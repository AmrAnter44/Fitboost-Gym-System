// scripts/create-admin.ts - إنشاء حساب أدمن أولي
// Usage: ADMIN_EMAIL=x@y.com ADMIN_PASSWORD='StrongPass!' node scripts/create-admin.ts
// - لا توجد كلمة مرور افتراضية (كان admin123 — تمت إزالتها)
// - يرفض كلمات المرور الضعيفة
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { runScript } from '../lib/scriptManager'

const prisma = new PrismaClient()

function validatePassword(password: string): string | null {
  if (!password || password.length < 12) return 'Password must be at least 12 characters'
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return 'Password must contain letters and numbers'
  if (!/[^a-zA-Z0-9]/.test(password)) return 'Password must contain at least one symbol'
  return null
}

async function createAdminScript() {
  const email = process.env.ADMIN_EMAIL?.trim()
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME?.trim() || 'Admin'

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD env variables are required')
  }
  const passErr = validatePassword(password)
  if (passErr) {
    throw new Error(passErr)
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`✅ Admin (${email}) already exists!`)
    return
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  const admin = await prisma.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
      role: 'ADMIN',
      isActive: true
    }
  })

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

  console.log(`✅ Admin created: ${email}`)
}

runScript('create-admin', createAdminScript)
  .then((result) => {
    if (result.success) {
      console.log('✅ السكريبت اكتمل بنجاح')
    } else {
      console.error('❌ فشل السكريبت:', result.error)
    }
    process.exit(result.success ? 0 : 1)
  })
  .catch((error) => {
    console.error('❌ خطأ غير متوقع:', error?.message || 'unknown')
    process.exit(1)
  })

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

async function resetPassword() {
  const hashedPassword = await bcrypt.hash('admin123', 10)
  
  await prisma.user.update({
    where: { email: 'admin@gym.com' },
    data: { password: hashedPassword }
  })
  
  console.log('✅ Password reset successfully!')
  console.log('Email: admin@gym.com')
  console.log('Password: admin123')
  
  await prisma.$disconnect()
}

resetPassword().catch(console.error)

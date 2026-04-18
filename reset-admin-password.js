const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

async function resetPassword() {
  const hashedPassword = await bcrypt.hash('admin123', 10)
  
  await prisma.user.update({
    where: { email: 'admin@gym.com' },
    data: { password: hashedPassword }
  })
  
  
  await prisma.$disconnect()
}

resetPassword().catch(console.error)

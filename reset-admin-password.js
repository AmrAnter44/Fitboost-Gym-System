/**
 * Reset admin password safely.
 * Usage: node reset-admin-password.js <email> <new-password>
 * - Both arguments required (no insecure defaults).
 * - Password must be at least 12 chars, with letters + numbers + symbols.
 */
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

function validate(password) {
  if (typeof password !== 'string' || password.length < 12) {
    return 'Password must be at least 12 characters'
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must contain letters and numbers'
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    return 'Password must contain at least one symbol'
  }
  return null
}

async function resetPassword() {
  const email = process.argv[2]
  const newPass = process.argv[3]

  if (!email || !newPass) {
    console.error('Usage: node reset-admin-password.js <email> <new-password>')
    process.exit(1)
  }

  const err = validate(newPass)
  if (err) {
    console.error(`❌ ${err}`)
    process.exit(1)
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (!existing) {
    console.error(`❌ User with email "${email}" not found`)
    process.exit(1)
  }

  const hashed = await bcrypt.hash(newPass, 12)
  await prisma.user.update({
    where: { email },
    data: { password: hashed }
  })

  console.log(`✅ Password reset for ${email}`)
  await prisma.$disconnect()
}

resetPassword().catch((e) => {
  console.error('❌ Error:', e.message)
  process.exit(1)
})

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkDuplicatePhones() {
  try {
    // جلب كل الأعضاء
    const members = await prisma.member.findMany({
      select: {
        id: true,
        memberNumber: true,
        name: true,
        phone: true
      },
      orderBy: { phone: 'asc' }
    })

    // البحث عن التكرارات
    const phoneCounts = {}
    const duplicates = []

    members.forEach(member => {
      if (!phoneCounts[member.phone]) {
        phoneCounts[member.phone] = []
      }
      phoneCounts[member.phone].push(member)
    })

    // عرض التكرارات
    let foundDuplicates = false
    Object.entries(phoneCounts).forEach(([phone, memberList]) => {
      if (memberList.length > 1) {
        foundDuplicates = true
        console.log(`\n⚠️  رقم تليفون مكرر: ${phone}`)
        memberList.forEach(m => {
          console.log(`   - العضو #${m.memberNumber}: ${m.name} (ID: ${m.id})`)
        })
        duplicates.push({ phone, members: memberList })
      }
    })

    if (!foundDuplicates) {
      console.log('✅ لا توجد أرقام تليفونات مكررة!')
    } else {
      console.log(`\n📊 إجمالي: ${duplicates.length} رقم تليفون مكرر`)
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkDuplicatePhones()

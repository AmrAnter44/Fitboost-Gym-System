import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'


export async function GET(request: Request) {
  try {
    // التحقق من المصادقة فقط (بدون صلاحيات محددة)
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // الحصول على بداية اليوم الحالي للتحقق من الحضور
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    // جلب جميع الموظفين مع بيانات المستخدم
    const allStaff = await prisma.staff.findMany({
      include: {
        user: {
          select: {
            role: true,
          },
        },
        // الحصول على سجل الحضور الحالي (متواجد اليوم وبدون تسجيل خروج)
        attendance: {
          where: {
            checkOut: null,
            checkIn: {
              gte: startOfToday
            }
          },
          take: 1,
          orderBy: { checkIn: 'desc' }
        },
        // عد جميع الأعضاء المسجلين بهذا الكوتش
        _count: {
          select: {
            members: true
          }
        }
      },
      orderBy: {
        name: 'asc',
      },
    })

    // فلترة الموظفين الذين position تحتوي على "مدرب" أو "coach" أو "تغذية" أو "علاج"
    const coaches = allStaff.filter(staff => {
      if (!staff.position) return false
      const position = staff.position.toLowerCase()
      return position.includes('مدرب') ||
             position.includes('coach') ||
             position.includes('كوتش') ||
             position.includes('تغذية') ||
             position.includes('nutrition') ||
             position.includes('علاج') ||
             position.includes('physiotherapy') ||
             position.includes('physio')
    })

    // تنسيق البيانات للإرجاع
    const formattedCoaches = coaches.map(coach => ({
      id: coach.id,
      name: coach.name,
      staffCode: coach.staffCode,
      position: coach.position,
      isActive: coach.isActive,
      memberCount: coach._count.members,
      isCheckedIn: coach.attendance.length > 0,
      lastCheckIn: coach.attendance.length > 0 ? coach.attendance[0].checkIn : null
    }))

    console.log('📋 Found coaches with stats:', formattedCoaches.length)
    return NextResponse.json(formattedCoaches)
  } catch (error) {
    console.error('Error fetching coaches with stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch coaches with statistics' },
      { status: 500 }
    )
  }
}

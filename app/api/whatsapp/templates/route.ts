import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

const DEFAULT_TEMPLATES = [
  {
    title: 'تواصل أول',
    icon: '👋',
    message: `مرحباً {name}! 🏋️\n\nشكراً لزيارتك لـ Gym System\nنتمنى نشوفك قريب معانا!\n\nلو عندك أي استفسار، أنا هنا 😊`,
    isCustom: false,
    isDefault: true
  },
  {
    title: 'متابعة عادية',
    icon: '📞',
    message: `السلام عليكم يا {name}! ☀️\n\nأنا {salesName} من Gym System\nحابب أطمن عليك وأعرف رأيك في الجيم؟\n\nمستني ردك 😊`,
    isCustom: false,
    isDefault: true
  },
  {
    title: 'عرض خاص',
    icon: '🎁',
    message: `يا {name}! 🔥\n\nعندنا عرض خاص ليك النهاردة!\nاشترك دلوقتي واستمتع بأفضل الأسعار 💪\n\nتعال كلمنا!`,
    isCustom: false,
    isDefault: true
  },
  {
    title: 'رد على مهتم',
    icon: '✅',
    message: `عظيم يا {name}! 🎯\n\nسعيد باهتمامك 💚\nتعال النهاردة وابدأ رحلتك معانا!\n\nمستنيك 🏋️‍♂️`,
    isCustom: false,
    isDefault: true
  }
]

// GET - جلب القوالب
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    // جلب القوالب من قاعدة البيانات
    const templates = await prisma.whatsAppTemplate.findMany({
      orderBy: [
        { isDefault: 'desc' }, // القوالب الافتراضية أولاً
        { createdAt: 'asc' }
      ]
    })

    // إذا لم توجد قوالب، أنشئ القوالب الافتراضية
    if (templates.length === 0) {
      await prisma.whatsAppTemplate.createMany({
        data: DEFAULT_TEMPLATES
      })

      const newTemplates = await prisma.whatsAppTemplate.findMany({
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'asc' }
        ]
      })

      return NextResponse.json({ templates: newTemplates })
    }

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json({ error: 'فشل جلب القوالب' }, { status: 500 })
  }
}

// POST - إضافة قالب جديد
export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const body = await request.json()
    const { title, icon, message } = body

    if (!title || !message) {
      return NextResponse.json({ error: 'العنوان والرسالة مطلوبان' }, { status: 400 })
    }

    const template = await prisma.whatsAppTemplate.create({
      data: {
        title,
        icon: icon || '💬',
        message,
        isCustom: true,
        isDefault: false
      }
    })

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json({ error: 'فشل إنشاء القالب' }, { status: 500 })
  }
}

// PUT - تحديث قالب
export async function PUT(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const body = await request.json()
    const { id, title, icon, message } = body

    if (!id || !title || !message) {
      return NextResponse.json({ error: 'البيانات غير مكتملة' }, { status: 400 })
    }

    const template = await prisma.whatsAppTemplate.update({
      where: { id },
      data: {
        title,
        icon: icon || '💬',
        message
      }
    })

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Error updating template:', error)
    return NextResponse.json({ error: 'فشل تحديث القالب' }, { status: 500 })
  }
}

// DELETE - حذف قالب
export async function DELETE(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'معرف القالب مطلوب' }, { status: 400 })
    }

    await prisma.whatsAppTemplate.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting template:', error)
    return NextResponse.json({ error: 'فشل حذف القالب' }, { status: 500 })
  }
}

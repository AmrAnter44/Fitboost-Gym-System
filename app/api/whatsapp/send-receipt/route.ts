import { NextResponse } from 'next/server'
import { sendWhatsAppMessage } from '../../../../lib/whatsapp'
import { verifyAuth } from '../../../../lib/auth'
import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // التحقق من المصادقة
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { receiptId, phone, message: customMessage } = await request.json()

    if (!phone) {
      return NextResponse.json({
        error: 'Phone number is required'
      }, { status: 400 })
    }

    // إذا كانت الرسالة موجودة، استخدمها مباشرة (للسرعة)
    if (customMessage) {
      const success = await sendWhatsAppMessage(phone, customMessage)

      if (success) {
        return NextResponse.json({
          success: true,
          message: 'Receipt sent via WhatsApp'
        })
      } else {
        return NextResponse.json({
          error: 'WhatsApp client is not ready. Please scan QR code in settings.'
        }, { status: 500 })
      }
    }

    // إذا لم تكن الرسالة موجودة، ابنها من الإيصال
    if (!receiptId) {
      return NextResponse.json({
        error: 'Receipt ID or message is required'
      }, { status: 400 })
    }

    // جلب بيانات الإيصال
    const receipt = await prisma.receipt.findUnique({
      where: { id: receiptId },
      include: {
        member: true,
        pt: true,
        nutrition: true,
        physiotherapy: true,
        groupClass: true
      }
    })

    if (!receipt) {
      return NextResponse.json({
        error: 'Receipt not found'
      }, { status: 404 })
    }

    // تجهيز رسالة الإيصال
    let itemDetails: any = {}
    try {
      itemDetails = JSON.parse(receipt.itemDetails)
    } catch {}

    const gymName = '💪 Fitboost Gym System'
    const date = new Date(receipt.createdAt).toLocaleDateString('ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    // تحديد نوع الخدمة
    let serviceType = ''
    let serviceDetails = ''

    switch (receipt.type) {
      case 'membership':
        serviceType = '📋 اشتراك عضوية'
        serviceDetails = `المدة: ${itemDetails.subscriptionDays || 'N/A'} يوم\nتاريخ البداية: ${itemDetails.startDate || 'N/A'}\nتاريخ الانتهاء: ${itemDetails.expiryDate || 'N/A'}`
        break
      case 'membership_renewal':
        serviceType = '🔄 تجديد اشتراك'
        serviceDetails = `المدة: ${itemDetails.subscriptionDays || 'N/A'} يوم\nتاريخ الانتهاء الجديد: ${itemDetails.expiryDate || 'N/A'}`
        break
      case 'pt_new':
      case 'pt_renew':
      case 'pt_remaining':
        serviceType = receipt.type === 'pt_new' ? '🏋️ اشتراك PT جديد' : receipt.type === 'pt_renew' ? '🔄 تجديد PT' : '💰 دفع متبقي PT'
        serviceDetails = `المدرب: ${itemDetails.coachName || 'N/A'}\nعدد الجلسات: ${itemDetails.sessionsPurchased || itemDetails.remainingSessions || 'N/A'}\nسعر الجلسة: ${itemDetails.pricePerSession || 'N/A'} جنيه`
        break
      case 'nutrition_new':
      case 'nutrition_renew':
      case 'nutrition_remaining':
        serviceType = receipt.type === 'nutrition_new' ? '🥗 اشتراك تغذية جديد' : receipt.type === 'nutrition_renew' ? '🔄 تجديد تغذية' : '💰 دفع متبقي تغذية'
        serviceDetails = `أخصائي التغذية: ${itemDetails.nutritionistName || 'N/A'}\nعدد الجلسات: ${itemDetails.sessionsPurchased || 'N/A'}`
        break
      case 'physio_new':
      case 'physio_renew':
      case 'physio_remaining':
        serviceType = receipt.type === 'physio_new' ? '🏥 اشتراك علاج طبيعي جديد' : receipt.type === 'physio_renew' ? '🔄 تجديد علاج طبيعي' : '💰 دفع متبقي علاج طبيعي'
        serviceDetails = `أخصائي العلاج: ${itemDetails.therapistName || 'N/A'}\nعدد الجلسات: ${itemDetails.sessionsPurchased || 'N/A'}`
        break
      case 'class_new':
      case 'class_renew':
      case 'class_remaining':
        serviceType = receipt.type === 'class_new' ? '🎯 اشتراك جروب كلاس جديد' : receipt.type === 'class_renew' ? '🔄 تجديد جروب كلاس' : '💰 دفع متبقي جروب كلاس'
        serviceDetails = `المدرب: ${itemDetails.instructorName || 'N/A'}\nعدد الجلسات: ${itemDetails.sessionsPurchased || 'N/A'}`
        break
      default:
        serviceType = `📝 ${receipt.type}`
        serviceDetails = 'تفاصيل الخدمة'
    }

    // بناء الرسالة
    const message = `
${gymName}
━━━━━━━━━━━━━━━━━━━━━

🧾 *إيصال رقم:* ${receipt.receiptNumber}
📅 *التاريخ:* ${date}

👤 *اسم العميل:* ${itemDetails.clientName || itemDetails.memberName || 'N/A'}
${itemDetails.phone ? `📱 *رقم الهاتف:* ${itemDetails.phone}` : ''}

━━━━━━━━━━━━━━━━━━━━━
🎫 *نوع الخدمة:*
${serviceType}

${serviceDetails}

━━━━━━━━━━━━━━━━━━━━━
💵 *تفاصيل الدفع:*
• المبلغ الإجمالي: *${itemDetails.totalAmount || receipt.amount} جنيه*
• المبلغ المدفوع: *${itemDetails.paidAmount || receipt.amount} جنيه*
${itemDetails.remainingAmount && itemDetails.remainingAmount > 0 ? `• المبلغ المتبقي: *${itemDetails.remainingAmount} جنيه*` : ''}
• طريقة الدفع: ${receipt.paymentMethod === 'cash' ? 'كاش 💵' : receipt.paymentMethod === 'visa' ? 'فيزا 💳' : receipt.paymentMethod === 'instapay' ? 'إنستاباي 📱' : receipt.paymentMethod}

${receipt.staffName ? `👨‍💼 *الموظف:* ${receipt.staffName}` : ''}

━━━━━━━━━━━━━━━━━━━━━
✅ *شكراً لثقتكم بنا!*
نتمنى لكم تجربة رائعة 💪
`.trim()

    // إرسال الرسالة
    const success = await sendWhatsAppMessage(phone, message)

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Receipt sent via WhatsApp'
      })
    } else {
      return NextResponse.json({
        error: 'Failed to send message. Make sure WhatsApp is connected.'
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error sending receipt via WhatsApp:', error)
    return NextResponse.json({
      error: 'Failed to send receipt via WhatsApp'
    }, { status: 500 })
  }
}

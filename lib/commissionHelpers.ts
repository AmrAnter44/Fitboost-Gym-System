// دالة حساب النسبة حسب المبلغ
export function calculateCommissionPercentage(amount: number): number {
  if (amount < 5000) return 25
  if (amount < 11000) return 30
  if (amount < 15000) return 35
  if (amount < 20000) return 40
  return 45
}

// دالة حساب العمولة
export function calculatePTCommission(amount: number): {
  percentage: number
  commission: number
} {
  const percentage = calculateCommissionPercentage(amount)
  const commission = (amount * percentage) / 100
  return { percentage, commission }
}

// دالة إنشاء سجل عمولة PT
export async function createPTCommission(
  prisma: any,
  staffId: string,
  amount: number,
  description: string,
  ptNumber?: number
) {
  const { percentage, commission } = calculatePTCommission(amount)

  try {
    const commissionRecord = await prisma.commission.create({
      data: {
        staffId,
        amount: commission,
        type: 'pt_payment',
        description: `${description} - المبلغ: ${amount} ج.م - النسبة: ${percentage}%`,
        notes: JSON.stringify({
          paymentAmount: amount,
          percentage,
          commission,
          ptNumber
        })
      }
    })

    console.log(`✅ تم إنشاء عمولة PT: ${commission} ج.م (${percentage}% من ${amount} ج.م)`)
    return commissionRecord
  } catch (error) {
    console.error('❌ خطأ في إنشاء سجل العمولة:', error)
    throw error
  }
}

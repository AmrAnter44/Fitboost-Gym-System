import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // جلب جميع المصروفات من آخر 6 شهور
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const expenses = await prisma.expense.findMany({
      where: {
        createdAt: {
          gte: sixMonthsAgo
        }
      },
      select: {
        amount: true,
        createdAt: true
      }
    })

    if (expenses.length === 0) {
      return NextResponse.json({ averageMonthly: 0 })
    }

    // تجميع المصروفات حسب الشهر
    const monthlyExpenses: { [key: string]: number } = {}

    expenses.forEach(expense => {
      const date = new Date(expense.createdAt)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      if (!monthlyExpenses[monthKey]) {
        monthlyExpenses[monthKey] = 0
      }
      monthlyExpenses[monthKey] += expense.amount
    })

    // حساب المتوسط
    const months = Object.keys(monthlyExpenses)
    const totalExpenses = Object.values(monthlyExpenses).reduce((sum, val) => sum + val, 0)
    const averageMonthly = months.length > 0 ? totalExpenses / months.length : 0

    return NextResponse.json({
      averageMonthly: Math.round(averageMonthly),
      monthsCount: months.length,
      totalExpenses: Math.round(totalExpenses)
    })
  } catch (error) {
    console.error('Error calculating average expenses:', error)
    return NextResponse.json({ error: 'فشل حساب متوسط المصروفات' }, { status: 500 })
  }
}

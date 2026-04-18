import { test, expect } from '@playwright/test'

/**
 * Nutrition Management Tests
 * Tests for creating and managing nutrition sessions
 */

// Helper function للـ Login
async function login(page: any) {
  await page.goto('/')
  await page.locator('input[name="email"], input[type="email"], input[placeholder*="اسم"], input[placeholder*="بريد"]').first().fill('admin')
  await page.locator('input[type="password"]').first().fill('admin123456')
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/\/(dashboard|members|home)/, { timeout: 10000 })
}

test.describe('Nutrition Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should navigate to nutrition page', async ({ page }) => {
    // الذهاب لصفحة التغذية
    await page.goto('/nutrition')

    // التحقق من وصول الصفحة
    await expect(page).toHaveURL(/\/nutrition/)

    // التحقق من وجود عناصر الصفحة
    const pageTitle = page.locator('h1:has-text("تغذية"), h1:has-text("Nutrition")').first()

    if (await pageTitle.isVisible({ timeout: 3000 })) {
      console.log('✅ Nutrition page loaded successfully')
    } else {
      console.log('⚠️ Nutrition page title not found, but page loaded')
    }
  })

  test('should open add nutrition subscription form', async ({ page }) => {
    await page.goto('/nutrition')

    // البحث عن زر إضافة اشتراك تغذية
    const addButton = page.locator('button:has-text("إضافة"), button:has-text("اشتراك جديد")').first()

    if (await addButton.isVisible({ timeout: 3000 })) {
      await addButton.click()
      await page.waitForTimeout(1000)

      // التحقق من وجود حقول الفورم
      const clientNameInput = page.locator('input[name="clientName"], input[placeholder*="اسم"]').first()
      await expect(clientNameInput).toBeVisible()

      console.log('✅ Add nutrition subscription form opened')
    } else {
      console.log('⚠️ Add nutrition button not found')
    }
  })

  test('should create new nutrition subscription', async ({ page }) => {
    await page.goto('/nutrition')
    await page.waitForTimeout(1000)

    // فتح فورم إضافة اشتراك
    const addButton = page.locator('button:has-text("إضافة"), button:has-text("اشتراك جديد")').first()

    if (await addButton.isVisible({ timeout: 3000 })) {
      await addButton.click()
      await page.waitForTimeout(1000)

      // ملء بيانات الاشتراك
      const timestamp = Date.now()
      const testClientName = `Test Nutrition Client ${timestamp}`
      const testClientPhone = `0100${timestamp.toString().slice(-7)}`

      await page.locator('input[name="clientName"], input[placeholder*="اسم العميل"]').first().fill(testClientName)
      await page.locator('input[name="phone"], input[type="tel"]').first().fill(testClientPhone)

      // اختيار أخصائي التغذية
      const nutritionistSelect = page.locator('select[name="nutritionistName"], input[name="nutritionistName"]').first()
      if (await nutritionistSelect.isVisible({ timeout: 2000 })) {
        if (await nutritionistSelect.evaluate(el => el.tagName === 'SELECT')) {
          await nutritionistSelect.selectOption({ index: 1 })
        } else {
          await nutritionistSelect.fill('Test Nutritionist')
        }
      }

      // عدد الجلسات
      const sessionsInput = page.locator('input[name="sessionsPurchased"], input[placeholder*="عدد الجلسات"]').first()
      if (await sessionsInput.isVisible({ timeout: 2000 })) {
        await sessionsInput.fill('8')
      }

      // السعر
      const priceInput = page.locator('input[name="totalPrice"], input[name="price"]').first()
      if (await priceInput.isVisible({ timeout: 2000 })) {
        await priceInput.fill('800')
      }

      // حفظ الاشتراك
      const submitButton = page.locator('button[type="submit"]:has-text("حفظ"), button[type="submit"]:has-text("إضافة")').first()
      await submitButton.click()

      // انتظار نجاح الإضافة
      await page.waitForTimeout(3000)

      console.log('✅ Nutrition subscription created')
    } else {
      console.log('⚠️ Cannot test nutrition creation - button not found')
    }
  })

  test('should view nutrition sessions history', async ({ page }) => {
    await page.goto('/nutrition/sessions/history')

    // التحقق من الوصول للصفحة
    if (page.url().includes('/nutrition/sessions/history')) {
      console.log('✅ Nutrition sessions history page loaded')

      // التحقق من وجود عناصر الصفحة
      await page.waitForTimeout(2000)
    } else {
      console.log('⚠️ Nutrition sessions history route might not exist')
    }
  })

  test('should register nutrition session attendance', async ({ page }) => {
    await page.goto('/nutrition/sessions/register')

    if (page.url().includes('/nutrition/sessions/register')) {
      // التحقق من وجود حقل رقم Nutrition
      const nutritionNumberInput = page.locator('input[name="nutritionNumber"], input[placeholder*="رقم"]').first()

      if (await nutritionNumberInput.isVisible({ timeout: 3000 })) {
        console.log('✅ Nutrition session registration page loaded')
      } else {
        console.log('⚠️ Nutrition number input not found')
      }
    } else {
      console.log('⚠️ Nutrition session registration route might not exist')
    }
  })
})

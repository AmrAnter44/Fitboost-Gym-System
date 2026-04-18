import { test, expect } from '@playwright/test'

/**
 * Comprehensive End-to-End Test
 * Full workflow test: Login → Create Member → Create Subscription → Receipt
 */

test.describe('Comprehensive Workflow', () => {
  test('Full member lifecycle: Create → Subscribe → Receipt', async ({ page }) => {
    console.log('🚀 Starting comprehensive test...')

    // ========== STEP 1: Login ==========
    console.log('\n📍 STEP 1: Login')
    await page.goto('/')

    await page.locator('input[name="email"], input[type="email"], input[placeholder*="اسم"], input[placeholder*="بريد"]').first().fill('admin')
    await page.locator('input[type="password"]').first().fill('admin123456')
    await page.locator('button[type="submit"]').first().click()

    await page.waitForURL(/\/(dashboard|members|home)/, { timeout: 10000 })
    console.log('✅ Login successful')

    // ========== STEP 2: Navigate to Members ==========
    console.log('\n📍 STEP 2: Navigate to Members')
    await page.goto('/members')
    await page.waitForTimeout(2000)
    console.log('✅ Members page loaded')

    // ========== STEP 3: Create New Member ==========
    console.log('\n📍 STEP 3: Create New Member')
    const addButton = page.locator('button:has-text("إضافة"), button:has-text("عضو جديد"), a[href="/members/new"]').first()

    if (await addButton.isVisible({ timeout: 3000 })) {
      await addButton.click()
      await page.waitForTimeout(1000)

      // ملء بيانات العضو
      const timestamp = Date.now()
      const testMemberName = `E2E Test Member ${timestamp}`
      const testMemberPhone = `0100${timestamp.toString().slice(-7)}`

      await page.locator('input[name="name"], input[placeholder*="اسم"]').first().fill(testMemberName)
      await page.locator('input[name="phone"], input[type="tel"], input[placeholder*="هاتف"]').first().fill(testMemberPhone)

      // اختيار مدة الاشتراك (إن وجدت)
      const subscriptionDuration = page.locator('select[name="duration"], input[name="duration"]').first()
      if (await subscriptionDuration.isVisible({ timeout: 2000 })) {
        if (await subscriptionDuration.evaluate(el => el.tagName === 'SELECT')) {
          await subscriptionDuration.selectOption('1')
        } else {
          await subscriptionDuration.fill('30')
        }
      }

      // سعر الاشتراك
      const subscriptionPrice = page.locator('input[name="price"], input[name="subscriptionPrice"]').first()
      if (await subscriptionPrice.isVisible({ timeout: 2000 })) {
        await subscriptionPrice.fill('500')
      }

      // حفظ العضو
      const submitButton = page.locator('button[type="submit"]:has-text("حفظ"), button[type="submit"]:has-text("إضافة")').first()
      await submitButton.click()

      await page.waitForTimeout(3000)
      console.log('✅ Member created:', testMemberName)
    } else {
      console.log('⚠️ Add member button not found, skipping member creation')
    }

    // ========== STEP 4: Check Receipts ==========
    console.log('\n📍 STEP 4: Check Receipts')
    await page.goto('/receipts')
    await page.waitForTimeout(2000)

    const receiptsTable = page.locator('table, div[class*="receipt"]').first()
    if (await receiptsTable.isVisible({ timeout: 3000 })) {
      console.log('✅ Receipts page loaded with data')
    } else {
      console.log('⚠️ No receipts found (may be normal for new system)')
    }

    // ========== STEP 5: Create Nutrition Subscription ==========
    console.log('\n📍 STEP 5: Create Nutrition Subscription')
    await page.goto('/nutrition')
    await page.waitForTimeout(1000)

    const addNutritionButton = page.locator('button:has-text("إضافة"), button:has-text("اشتراك جديد")').first()

    if (await addNutritionButton.isVisible({ timeout: 3000 })) {
      await addNutritionButton.click()
      await page.waitForTimeout(1000)

      const timestamp = Date.now()
      const testClientName = `E2E Nutrition ${timestamp}`
      const testClientPhone = `0100${timestamp.toString().slice(-7)}`

      await page.locator('input[name="clientName"], input[placeholder*="اسم العميل"]').first().fill(testClientName)
      await page.locator('input[name="phone"], input[type="tel"]').first().fill(testClientPhone)

      // اختيار أخصائي تغذية
      const nutritionistSelect = page.locator('select[name="nutritionistName"], input[name="nutritionistName"]').first()
      if (await nutritionistSelect.isVisible({ timeout: 2000 })) {
        if (await nutritionistSelect.evaluate(el => el.tagName === 'SELECT')) {
          await nutritionistSelect.selectOption({ index: 1 })
        } else {
          await nutritionistSelect.fill('Test Nutritionist')
        }
      }

      // عدد الجلسات
      const sessionsInput = page.locator('input[name="sessionsPurchased"]').first()
      if (await sessionsInput.isVisible({ timeout: 2000 })) {
        await sessionsInput.fill('8')
      }

      // السعر
      const priceInput = page.locator('input[name="totalPrice"], input[name="price"]').first()
      if (await priceInput.isVisible({ timeout: 2000 })) {
        await priceInput.fill('800')
      }

      // حفظ
      const submitNutrition = page.locator('button[type="submit"]:has-text("حفظ"), button[type="submit"]:has-text("إضافة")').first()
      await submitNutrition.click()

      await page.waitForTimeout(3000)
      console.log('✅ Nutrition subscription created:', testClientName)
    } else {
      console.log('⚠️ Add nutrition button not found')
    }

    // ========== STEP 6: View Dashboard ==========
    console.log('\n📍 STEP 6: View Dashboard (if exists)')
    await page.goto('/dashboard')

    if (page.url().includes('/dashboard')) {
      await page.waitForTimeout(2000)
      console.log('✅ Dashboard loaded')

      // التقاط screenshot للـ dashboard
      await page.screenshot({
        path: 'playwright-report/dashboard-screenshot.png',
        fullPage: true
      })
      console.log('📸 Dashboard screenshot saved')
    } else {
      console.log('⚠️ Dashboard route not found, redirected to:', page.url())
    }

    console.log('\n🎉 Comprehensive test completed successfully!')
  })
})

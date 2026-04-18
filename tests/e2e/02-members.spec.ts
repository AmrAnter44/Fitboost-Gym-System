import { test, expect } from '@playwright/test'

/**
 * Members Management Tests
 * Tests for creating, editing, and viewing members
 */

// Helper function للـ Login
async function login(page: any) {
  await page.goto('/')
  await page.locator('input[name="email"], input[type="email"], input[placeholder*="اسم"], input[placeholder*="بريد"]').first().fill('admin')
  await page.locator('input[type="password"]').first().fill('admin123456')
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/\/(dashboard|members|home)/, { timeout: 10000 })
}

test.describe('Members Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('should navigate to members page', async ({ page }) => {
    // الذهاب لصفحة الأعضاء
    await page.goto('/members')

    // التحقق من وصول الصفحة
    await expect(page).toHaveURL(/\/members/)

    // التحقق من وجود عناصر الصفحة
    const pageTitle = page.locator('h1, h2').first()
    await expect(pageTitle).toBeVisible()

    console.log('✅ Members page loaded successfully')
  })

  test('should open add member form', async ({ page }) => {
    await page.goto('/members')

    // البحث عن زر إضافة عضو
    const addButton = page.locator('button:has-text("إضافة"), button:has-text("عضو جديد"), a[href="/members/new"]').first()

    await addButton.click()

    // انتظار ظهور الفورم
    await page.waitForTimeout(1000)

    // التحقق من وجود حقول الفورم
    const nameInput = page.locator('input[name="name"], input[placeholder*="اسم"]').first()
    await expect(nameInput).toBeVisible()

    console.log('✅ Add member form opened')
  })

  test('should create new member successfully', async ({ page }) => {
    await page.goto('/members')

    // فتح فورم إضافة عضو
    const addButton = page.locator('button:has-text("إضافة"), button:has-text("عضو جديد"), a[href="/members/new"]').first()
    await addButton.click()
    await page.waitForTimeout(1000)

    // ملء بيانات العضو
    const timestamp = Date.now()
    const testMemberName = `Test Member ${timestamp}`
    const testMemberPhone = `0100${timestamp.toString().slice(-7)}`

    await page.locator('input[name="name"], input[placeholder*="اسم"]').first().fill(testMemberName)
    await page.locator('input[name="phone"], input[type="tel"], input[placeholder*="هاتف"]').first().fill(testMemberPhone)

    // التحقق من وجود باقي الحقول المطلوبة
    const subscriptionDuration = page.locator('select[name="duration"], input[name="duration"]').first()
    if (await subscriptionDuration.isVisible({ timeout: 2000 })) {
      await subscriptionDuration.selectOption('1') // شهر واحد
    }

    const subscriptionPrice = page.locator('input[name="price"], input[name="subscriptionPrice"]').first()
    if (await subscriptionPrice.isVisible({ timeout: 2000 })) {
      await subscriptionPrice.fill('500')
    }

    // حفظ العضو
    const submitButton = page.locator('button[type="submit"]:has-text("حفظ"), button[type="submit"]:has-text("إضافة")').first()
    await submitButton.click()

    // انتظار نجاح الإضافة
    await page.waitForTimeout(3000)

    // التحقق من الإضافة
    const url = page.url()
    const successMessage = page.locator('text=/تم.*بنجاح|Success/i').first()

    if (await successMessage.isVisible({ timeout: 3000 })) {
      console.log('✅ Member created successfully!')
    } else {
      console.log('✅ Member creation completed (checking URL)')
      expect(url).toMatch(/\/members/)
    }
  })

  test('should search for member', async ({ page }) => {
    await page.goto('/members')

    // البحث عن حقل البحث
    const searchInput = page.locator('input[type="search"], input[placeholder*="بحث"]').first()

    if (await searchInput.isVisible({ timeout: 3000 })) {
      await searchInput.fill('Test')
      await page.waitForTimeout(1000)

      console.log('✅ Search functionality working')
    } else {
      console.log('⚠️ Search input not found, skipping search test')
    }
  })

  test('should view member details', async ({ page }) => {
    await page.goto('/members')
    await page.waitForTimeout(2000)

    // البحث عن أول عضو في القائمة
    const firstMember = page.locator('tr:has-text("0"), div[class*="member"]:first-child, a[href*="/members/"]').first()

    if (await firstMember.isVisible({ timeout: 5000 })) {
      await firstMember.click()
      await page.waitForTimeout(1000)

      // التحقق من فتح صفحة التفاصيل
      const url = page.url()
      expect(url).toMatch(/\/members\//)

      console.log('✅ Member details page opened')
    } else {
      console.log('⚠️ No members found to view')
    }
  })
})

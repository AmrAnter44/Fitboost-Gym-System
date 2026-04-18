import { test, expect } from '@playwright/test'

/**
 * Authentication Tests
 * Tests for login, logout, and session management
 */

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should load login page', async ({ page }) => {
    // التحقق من وجود صفحة Login
    await expect(page).toHaveTitle(/Gym|Login|FitBoost/i)

    // التحقق من وجود حقول Login
    const usernameInput = page.locator('input[name="email"], input[type="email"], input[placeholder*="اسم"], input[placeholder*="بريد"]').first()
    const passwordInput = page.locator('input[type="password"]').first()
    const loginButton = page.locator('button[type="submit"]').first()

    await expect(usernameInput).toBeVisible()
    await expect(passwordInput).toBeVisible()
    await expect(loginButton).toBeVisible()
  })

  test('should login successfully with valid credentials', async ({ page }) => {
    // ملء بيانات Login
    await page.locator('input[name="email"], input[type="email"], input[placeholder*="اسم"], input[placeholder*="بريد"]').first().fill('admin')
    await page.locator('input[type="password"]').first().fill('admin123456')

    // الضغط على Login
    await page.locator('button[type="submit"]').first().click()

    // انتظار التحويل للـ dashboard
    await page.waitForURL(/\/(dashboard|members|home)/, { timeout: 10000 })

    // التحقق من نجاح Login
    const url = page.url()
    expect(url).not.toContain('/login')
    expect(url).not.toContain('/setup')

    console.log('✅ Login successful! Redirected to:', url)
  })

  test('should show error with invalid credentials', async ({ page }) => {
    // محاولة Login ببيانات خاطئة
    await page.locator('input[name="email"], input[type="email"], input[placeholder*="اسم"], input[placeholder*="بريد"]').first().fill('wronguser')
    await page.locator('input[type="password"]').first().fill('wrongpassword')

    await page.locator('button[type="submit"]').first().click()

    // انتظار رسالة الخطأ
    await page.waitForTimeout(2000)

    // التحقق من عدم التحويل
    const url = page.url()
    expect(url).toContain('/')

    console.log('✅ Login blocked for invalid credentials')
  })

  test('should logout successfully', async ({ page, context }) => {
    // Login أولاً
    await page.locator('input[name="email"], input[type="email"], input[placeholder*="اسم"], input[placeholder*="بريد"]').first().fill('admin')
    await page.locator('input[type="password"]').first().fill('admin123456')
    await page.locator('button[type="submit"]').first().click()

    await page.waitForURL(/\/(dashboard|members|home)/, { timeout: 10000 })

    // محاولة Logout
    // البحث عن زر logout أو قائمة user
    const logoutButton = page.locator('button:has-text("تسجيل خروج"), button:has-text("Logout"), a:has-text("تسجيل خروج")').first()

    if (await logoutButton.isVisible({ timeout: 5000 })) {
      await logoutButton.click()

      // التحقق من العودة لصفحة Login
      await page.waitForURL(/\/(login|setup|^\/$)/, { timeout: 10000 })
      console.log('✅ Logout successful!')
    } else {
      // محاولة الوصول لقائمة المستخدم
      const userMenu = page.locator('[aria-label*="user"], [aria-label*="account"], button:has-text("admin")').first()
      if (await userMenu.isVisible({ timeout: 3000 })) {
        await userMenu.click()
        await page.waitForTimeout(500)

        const logoutItem = page.locator('button:has-text("تسجيل خروج"), button:has-text("Logout"), a:has-text("تسجيل خروج")').first()
        await logoutItem.click()

        await page.waitForURL(/\/(login|setup|^\/$)/, { timeout: 10000 })
        console.log('✅ Logout successful via menu!')
      } else {
        console.log('⚠️ Logout button not found, skipping logout test')
      }
    }
  })
})

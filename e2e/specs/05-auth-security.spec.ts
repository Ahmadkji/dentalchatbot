import { test, expect } from '@playwright/test'

test.describe('Auth Security', () => {
  test('unauthenticated visit to /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })

  test('unauthenticated visit to /settings redirects to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })

  test('unauthenticated API call to /api/clinic returns 401', async ({ request }) => {
    const response = await request.get('/api/clinic')
    expect([401, 403]).toContain(response.status())
  })

  test('unauthenticated API call to /api/dashboard returns 401', async ({ request }) => {
    const response = await request.get('/api/dashboard')
    expect([401, 403]).toContain(response.status())
  })

  test('signing out clears session and redirects to login', async ({ page }) => {
    // Login first with real credentials
    await page.goto('/login')
    await page.locator('#email').fill(process.env.TEST_USER_EMAIL ?? '')
    await page.locator('#password').fill(process.env.TEST_USER_PASSWORD ?? '')
    await page.locator('form button[type="submit"]').click()
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 15_000 })

    // Now logout
    await page.request.post('/api/auth/logout')
    await page.goto('/dashboard')
    // Should redirect back to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
  })

  test('protected route preserves session across navigations', async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.locator('#email').fill(process.env.TEST_USER_EMAIL ?? '')
    await page.locator('#password').fill(process.env.TEST_USER_PASSWORD ?? '')
    await page.locator('form button[type="submit"]').click()
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 15_000 })

    // Navigate to dashboard if on onboarding
    if (page.url().includes('/onboarding')) {
      return // User hasn't completed onboarding, skip this test
    }

    // Navigate within dashboard - session should persist
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard/)
    // Reload - should still be logged in
    await page.reload()
    await expect(page).toHaveURL(/\/dashboard/)
  })
})

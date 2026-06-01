import { test, expect } from '@playwright/test'

test.describe('Auth - Signup', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    // Switch to signup mode
    await page.locator('button', { hasText: 'Create account' }).click()
  })

  test('signup form shows Create account heading and confirm password', async ({ page }) => {
    await expect(page.locator('h2', { hasText: 'Create account' })).toBeVisible()
    await expect(page.locator('#confirmPassword')).toBeVisible()
  })

  test('short password shows validation error', async ({ page }) => {
    await page.locator('#email').fill('test@example.com')
    await page.locator('#password').fill('short')
    await page.locator('#confirmPassword').fill('short')
    await page.locator('form button[type="submit"]').click()
    await expect(page.locator('text=Password must be at least 8 characters')).toBeVisible()
  })

  test('password mismatch shows error', async ({ page }) => {
    await page.locator('#email').fill('test@example.com')
    await page.locator('#password').fill('password123')
    await page.locator('#confirmPassword').fill('password456')
    await page.locator('form button[type="submit"]').click()
    await expect(page.locator('text=Passwords do not match')).toBeVisible()
  })

  test('empty fields show validation errors', async ({ page }) => {
    // Click submit with empty form
    await page.locator('form button[type="submit"]').click()
    // Should show email or password required error
    await expect(
      page.locator('text=Email address is required, text=Password is required').first()
    ).toBeVisible()
  })

  test('toggle between login and signup modes', async ({ page }) => {
    // Already in signup mode
    await expect(page.locator('#confirmPassword')).toBeVisible()
    // Switch back to signin
    await page.locator('button', { hasText: 'Sign in' }).click()
    await expect(page.locator('h2', { hasText: 'Welcome back' })).toBeVisible()
    await expect(page.locator('#confirmPassword')).toBeHidden()
  })

  test('URL param ?mode=signup pre-selects signup mode', async ({ page }) => {
    await page.goto('/login?mode=signup')
    await expect(page.locator('h2', { hasText: 'Create account' })).toBeVisible()
    await expect(page.locator('#confirmPassword')).toBeVisible()
  })

  test('password hint text is visible in signup mode', async ({ page }) => {
    await expect(page.locator('text=Passwords must be at least 8 characters')).toBeVisible()
  })
})

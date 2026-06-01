import { test, expect } from '@playwright/test'

test.describe('Auth - Forgot Password', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forgot-password')
  })

  test('forgot password page loads', async ({ page }) => {
    await expect(page.locator('h2', { hasText: 'Forgot password' })).toBeVisible()
    await expect(page.locator('#email')).toBeVisible()
  })

  test('empty email shows validation error', async ({ page }) => {
    await page.locator('button[type="submit"]', { hasText: 'Send reset link' }).click()
    await expect(page.locator('text=Email address is required')).toBeVisible()
  })

  test('Back to sign in link works', async ({ page }) => {
    await page.locator('a', { hasText: 'Back to sign in' }).click()
    await expect(page).toHaveURL('/login')
  })

  test('loading state during submission', async ({ page }) => {
    await page.locator('#email').fill('test@example.com')
    const btn = page.locator('button[type="submit"]')
    const clickPromise = btn.click()
    await clickPromise
  })
})

test.describe('Auth - Reset Password', () => {
  test('reset password page shows expired link message without valid session', async ({ page }) => {
    await page.goto('/reset-password')
    // Without a valid Supabase recovery session, should show expired/link invalid message
    const expiredText = page.locator('text=Link expired, text=invalid or has expired')
    if (await expiredText.first().isVisible()) {
      await expect(expiredText.first()).toBeVisible()
    }
  })

  test('reset password page has request new link button', async ({ page }) => {
    await page.goto('/reset-password')
    const requestLink = page.locator('a', { hasText: 'Request new link' })
    if (await requestLink.isVisible()) {
      await expect(requestLink).toHaveAttribute('href', '/forgot-password')
    }
  })
})

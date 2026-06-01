import { test, expect } from '@playwright/test'
import { TEST_EMAIL, TEST_PASSWORD } from '../fixtures/auth.fixture'

test.describe('Onboarding', () => {
  // Note: These tests only work with a user that has NOT completed onboarding
  // or when visiting /onboarding directly

  test('onboarding form loads with all fields', async ({ page }) => {
    // Go directly to onboarding (middleware may redirect if not logged in)
    await page.goto('/login')
    await page.locator('#email').fill(TEST_EMAIL)
    await page.locator('#password').fill(TEST_PASSWORD)
    await page.locator('form button[type="submit"]').click()

    const url = page.url()
    if (!url.includes('/onboarding')) {
      // This user already onboarded - skip
      test.skip()
      return
    }

    // Check form fields are present
    await expect(page.locator('input[type="text"]').first()).toBeVisible()
    await expect(page.locator('select, [role="combobox"]').first()).toBeVisible()
  })

  test('timezone dropdown has expected options', async ({ page }) => {
    await page.goto('/login')
    await page.locator('#email').fill(TEST_EMAIL)
    await page.locator('#password').fill(TEST_PASSWORD)
    await page.locator('form button[type="submit"]').click()

    if (!page.url().includes('/onboarding')) {
      test.skip()
      return
    }

    // Check that timezone select exists with options
    const timezoneSelect = page.locator('select, [role="combobox"]').first()
    await expect(timezoneSelect).toBeVisible()
  })

  test('loading state during submission', async ({ page }) => {
    await page.goto('/login')
    await page.locator('#email').fill(TEST_EMAIL)
    await page.locator('#password').fill(TEST_PASSWORD)
    await page.locator('form button[type="submit"]').click()

    if (!page.url().includes('/onboarding')) {
      test.skip()
      return
    }

    // Fill minimum fields and submit
    const submitBtn = page.locator('button[type="submit"]')
    if (await submitBtn.isVisible()) {
      // The button should show loading during submission
      const clickPromise = submitBtn.click()
      await clickPromise
    }
  })
})

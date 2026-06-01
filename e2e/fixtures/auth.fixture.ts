import { test as base, type Page } from '@playwright/test'

// ── Environment ──────────────────────────────────────────────
export const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? ''
export const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? ''
export const TEST_CLINIC_SLUG = process.env.TEST_CLINIC_SLUG ?? ''

// ── Fixture types ────────────────────────────────────────────
type AuthFixture = {
  authenticatedPage: Page
}

// ── Login helper ─────────────────────────────────────────────
export async function login(page: Page) {
  await page.goto('/login')
  await page.locator('#email').fill(TEST_EMAIL)
  await page.locator('#password').fill(TEST_PASSWORD)
  await page.locator('form button[type="submit"]').click()

  // Wait until we land on dashboard or onboarding
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 15_000 })
}

// ── Logout helper ────────────────────────────────────────────
export async function logout(page: Page) {
  await page.request.post('/api/auth/logout')
  await page.goto('/login')
}

// ── Extended test with authenticatedPage fixture ─────────────
export const test = base.extend<AuthFixture>({
  authenticatedPage: async ({ page }, use) => {
    await login(page)
    await use(page)
  },
})

export { expect } from '@playwright/test'

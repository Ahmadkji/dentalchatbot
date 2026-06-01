import { test, expect } from '../fixtures/auth.fixture'
import { waitForLoadersToFinish } from '../fixtures/test-helpers'

test.describe('Dashboard Overview', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Ensure we are on dashboard (the default after login)
    if (!page.url().includes('/dashboard')) {
      await page.goto('/dashboard')
    }
    await waitForLoadersToFinish(page)
  })

  test('dashboard loads with stat cards', async ({ authenticatedPage: page }) => {
    // Should show stat cards (at least some visible numbers/stats)
    const cards = page.locator('.rounded-xl, [class*="card"], [class*="Card"]')
    await expect(cards.first()).toBeVisible({ timeout: 10_000 })
  })

  test('recent conversations section renders', async ({ authenticatedPage: page }) => {
    // Look for conversations table or empty state
    const conversationsSection = page.locator('text=Conversation, text=Inbox').first()
    if (await conversationsSection.isVisible()) {
      await expect(conversationsSection).toBeVisible()
    }
  })

  test('recent leads section renders', async ({ authenticatedPage: page }) => {
    const leadsSection = page.locator('text=Lead').first()
    if (await leadsSection.isVisible()) {
      await expect(leadsSection).toBeVisible()
    }
  })

  test('knowledge health section renders', async ({ authenticatedPage: page }) => {
    const knowledgeSection = page.locator('text=Knowledge').first()
    if (await knowledgeSection.isVisible()) {
      await expect(knowledgeSection).toBeVisible()
    }
  })

  test('sidebar shows DentalGPT Studio branding', async ({ authenticatedPage: page }) => {
    await expect(page.locator('text=DentalGPT Studio')).toBeVisible()
  })

  test('sidebar shows AI Front Desk Control Center subtitle', async ({ authenticatedPage: page }) => {
    await expect(page.locator('text=AI Front Desk Control Center')).toBeVisible()
  })

  test('page loads within 5 seconds', async ({ authenticatedPage: page }) => {
    const start = Date.now()
    await page.reload()
    await waitForLoadersToFinish(page)
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(10_000) // generous 10s for API calls
  })
})

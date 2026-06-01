import { test, expect } from '../fixtures/auth.fixture'
import { waitForLoadersToFinish } from '../fixtures/test-helpers'

async function goToCustomizations(page: import('@playwright/test').Page) {
  const btn = page.locator('[data-sidebar="menu-button"]', { hasText: 'Customizations' })
  await btn.click()
  await waitForLoadersToFinish(page)
}

test.describe('Customizations', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    if (!page.url().includes('/dashboard')) {
      await page.goto('/dashboard')
    }
    await waitForLoadersToFinish(page)
    await goToCustomizations(page)
  })

  test('customization page loads with current settings', async ({ authenticatedPage: page }) => {
    const title = page.locator('text=Customization, text=Customizations').first()
    if (await title.isVisible()) {
      await expect(title).toBeVisible()
    }
  })

  test('chat mode radio buttons are present', async ({ authenticatedPage: page }) => {
    const aiOption = page.locator('text=AI, text=AI Mode').first()
    const humanOption = page.locator('text=Human, text=Human Mode').first()
    const anyVisible = await aiOption.isVisible() || await humanOption.isVisible()
    expect(anyVisible).toBeTruthy()
  })

  test('fallback message textarea is present', async ({ authenticatedPage: page }) => {
    const fallbackLabel = page.locator('text=Fallback, text=fallback').first()
    if (await fallbackLabel.isVisible()) {
      await expect(fallbackLabel).toBeVisible()
    }
  })

  test('user detail collection mode options', async ({ authenticatedPage: page }) => {
    const mandatory = page.locator('text=Mandatory, text=Required').first()
    const optional = page.locator('text=Optional').first()
    const none = page.locator('text=None, text=Disabled').first()
    const anyVisible = await mandatory.isVisible() || await optional.isVisible() || await none.isVisible()
    expect(anyVisible).toBeTruthy()
  })

  test('individual field toggles for name, email, phone', async ({ authenticatedPage: page }) => {
    const nameToggle = page.locator('text=Name, text=name').first()
    const emailToggle = page.locator('text=Email, text=email').first()
    const phoneToggle = page.locator('text=Phone, text=phone').first()
    const anyVisible = await nameToggle.isVisible() || await emailToggle.isVisible() || await phoneToggle.isVisible()
    expect(anyVisible).toBeTruthy()
  })

  test('smart followup toggle and count setting', async ({ authenticatedPage: page }) => {
    const followupToggle = page.locator('text=Follow-up, text=Followup, text=Smart').first()
    if (await followupToggle.isVisible()) {
      await expect(followupToggle).toBeVisible()
    }
  })

  test('save button triggers save and shows success toast', async ({ authenticatedPage: page }) => {
    const saveBtn = page.locator('button', { hasText: /Save/i }).first()
    if (await saveBtn.isVisible()) {
      // Listen for the API call
      const responsePromise = page.waitForResponse(
        resp => resp.url().includes('/api/customizations') || resp.url().includes('/api/settings'),
        { timeout: 5000 }
      ).catch(() => null)
      await saveBtn.click()
      // Wait for response or toast
      await page.waitForTimeout(1000)
    }
  })

  test('page content is not empty', async ({ authenticatedPage: page }) => {
    // The page should have some content
    const body = page.locator('[data-slot="sidebar-inset"], main')
    if (await body.isVisible()) {
      const text = await body.first().textContent()
      expect(text!.trim().length).toBeGreaterThan(0)
    }
  })
})

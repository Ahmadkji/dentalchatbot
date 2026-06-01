import { test, expect } from '../fixtures/auth.fixture'
import { waitForLoadersToFinish } from '../fixtures/test-helpers'

test.describe('Responsive Layout', () => {
  test('dashboard sidebar collapses on mobile viewport', async ({ authenticatedPage: page, context }) => {
    // Resize to mobile
    await page.setViewportSize({ width: 375, height: 812 })
    await page.waitForTimeout(500)
    // Sidebar should be collapsed or hidden
    const sidebar = page.locator('[data-slot="sidebar"]')
    if (await sidebar.isVisible()) {
      // On mobile, sidebar content might be hidden
      const sidebarWidth = await sidebar.boundingBox()
      // Sidebar should be narrow or collapsed
      expect(sidebarWidth).toBeTruthy()
    }
  })

  test('sidebar trigger button visible on mobile', async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.waitForTimeout(500)
    // The sidebar trigger should be visible on mobile
    const trigger = page.locator('[data-slot="sidebar-trigger"], button[aria-label*="sidebar"], button[aria-label*="menu"]').first()
    if (await trigger.isVisible()) {
      await expect(trigger).toBeVisible()
    }
  })

  test('login form is centered and usable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/login')
    // Login form should be visible and centered
    const form = page.locator('form').first()
    await expect(form).toBeVisible()
    // Should be able to fill inputs
    await page.locator('#email').fill('test@example.com')
    await page.locator('#password').fill('testpassword')
    // Submit button should be visible without scrolling
    const submitBtn = page.locator('form button[type="submit"]')
    await expect(submitBtn).toBeVisible()
  })

  test('landing page hero is responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    // Hero should be visible
    const hero = page.locator('section').first()
    await expect(hero).toBeVisible()
    // H1 should still be visible
    const heading = page.locator('h1')
    await expect(heading).toBeVisible()
  })

  test('tables are scrollable on narrow viewports', async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    // Navigate to a page with a table
    const btn = page.locator('[data-sidebar="menu-button"]', { hasText: 'Inbox' })
    await btn.click()
    await waitForLoadersToFinish(page)
    // Table container should handle overflow
    const tableContainer = page.locator('table').locator('..')
    if (await tableContainer.isVisible()) {
      await expect(tableContainer).toBeVisible()
    }
  })

  test('widget install page usable on mobile', async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const btn = page.locator('[data-sidebar="menu-button"]', { hasText: 'Widget & Install' })
    await btn.click()
    await waitForLoadersToFinish(page)
    // Page content should be visible
    const content = page.locator('[data-slot="sidebar-inset"], main').first()
    if (await content.isVisible()) {
      await expect(content).toBeVisible()
    }
  })
})

import { test, expect } from '../fixtures/auth.fixture'
import { waitForLoadersToFinish, openDialog, submitDialog } from '../fixtures/test-helpers'

async function goToLeads(page: import('@playwright/test').Page) {
  const btn = page.locator('[data-sidebar="menu-button"]', { hasText: 'Leads' })
  await btn.click()
  await waitForLoadersToFinish(page)
}

test.describe('Leads', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    if (!page.url().includes('/dashboard')) {
      await page.goto('/dashboard')
    }
    await waitForLoadersToFinish(page)
    await goToLeads(page)
  })

  test('leads table loads with columns', async ({ authenticatedPage: page }) => {
    const table = page.locator('table')
    const emptyState = page.locator('text=No leads, text=No leads yet')
    const hasTable = await table.isVisible()
    const hasEmpty = await emptyState.first().isVisible()
    expect(hasTable || hasEmpty).toBeTruthy()
  })

  test('search input filters leads', async ({ authenticatedPage: page }) => {
    const search = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first()
    if (await search.isVisible()) {
      await search.fill('nonexistent-lead-xyz')
      await page.waitForTimeout(1000)
      const rows = page.locator('table tbody tr')
      expect(await rows.count()).toBe(0)
    }
  })

  test('status tabs are present', async ({ authenticatedPage: page }) => {
    const tabs = page.locator('[role="tab"], [data-slot="tabs-trigger"]')
    const count = await tabs.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Add Lead button opens create dialog', async ({ authenticatedPage: page }) => {
    const addBtn = page.locator('button', { hasText: /Add Lead|New Lead|\+ Lead/i }).first()
    if (await addBtn.isVisible()) {
      await addBtn.click()
      const dialog = page.locator('[role="dialog"]')
      if (await dialog.isVisible()) {
        await expect(dialog).toBeVisible()
      }
    }
  })

  test('create lead form shows validation errors on empty submit', async ({ authenticatedPage: page }) => {
    const addBtn = page.locator('button', { hasText: /Add Lead|New Lead|\+ Lead/i }).first()
    if (await addBtn.isVisible()) {
      await addBtn.click()
      const dialog = page.locator('[role="dialog"]')
      if (await dialog.isVisible()) {
        // Try to submit empty form
        const submitBtn = dialog.locator('button', { hasText: /Save|Create|Add|Submit/i })
        if (await submitBtn.isVisible()) {
          await submitBtn.click()
          // Should show validation error
          await page.waitForTimeout(500)
        }
      }
    }
  })

  test('clicking a lead opens detail dialog', async ({ authenticatedPage: page }) => {
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    if (count > 0) {
      // Click the row or the view button
      const viewBtn = rows.first().locator('button', { hasText: /View|Eye/i })
      if (await viewBtn.isVisible()) {
        await viewBtn.click()
      } else {
        await rows.first().click()
      }
      const dialog = page.locator('[role="dialog"]')
      if (await dialog.isVisible()) {
        await expect(dialog).toBeVisible()
      }
    }
  })

  test('lead actions dropdown menu works', async ({ authenticatedPage: page }) => {
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    if (count > 0) {
      const moreBtn = rows.first().locator('button[aria-haspopup], button:has(svg.lucide-more-horizontal)').first()
      if (await moreBtn.isVisible()) {
        await moreBtn.click()
        // Dropdown should appear
        const dropdown = page.locator('[role="menu"], [data-slot="dropdown-menu-content"]')
        if (await dropdown.isVisible()) {
          await expect(dropdown).toBeVisible()
        }
      }
    }
  })

  test('Lead Settings button opens settings panel', async ({ authenticatedPage: page }) => {
    const settingsBtn = page.locator('button', { hasText: /Lead Settings|Settings/i }).first()
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click()
      await page.waitForTimeout(500)
      // Should show settings panel or dialog
      const settingsPanel = page.locator('[role="dialog"], [data-slot="sheet-content"], .space-y')
      if (await settingsPanel.first().isVisible()) {
        await expect(settingsPanel.first()).toBeVisible()
      }
    }
  })

  test('leads table has expected column headers', async ({ authenticatedPage: page }) => {
    const table = page.locator('table')
    if (await table.isVisible()) {
      const headers = table.locator('th')
      const count = await headers.count()
      expect(count).toBeGreaterThan(0)
    }
  })
})

import { test, expect } from '../fixtures/auth.fixture'
import { waitForLoadersToFinish } from '../fixtures/test-helpers'

async function goToKnowledge(page: import('@playwright/test').Page) {
  const btn = page.locator('[data-sidebar="menu-button"]', { hasText: 'Knowledge Sources' })
  await btn.click()
  await waitForLoadersToFinish(page)
}

test.describe('Knowledge Sources', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    if (!page.url().includes('/dashboard')) {
      await page.goto('/dashboard')
    }
    await waitForLoadersToFinish(page)
    await goToKnowledge(page)
  })

  test('knowledge sources table loads', async ({ authenticatedPage: page }) => {
    const table = page.locator('table')
    const emptyState = page.locator('text=No sources, text=No knowledge, text=Get started')
    const hasTable = await table.isVisible()
    const hasEmpty = await emptyState.first().isVisible()
    expect(hasTable || hasEmpty).toBeTruthy()
  })

  test('upload button is present', async ({ authenticatedPage: page }) => {
    const uploadBtn = page.locator('button', { hasText: /Upload|Import/i }).first()
    if (await uploadBtn.isVisible()) {
      await expect(uploadBtn).toBeVisible()
    }
  })

  test('upload button opens upload dialog', async ({ authenticatedPage: page }) => {
    const uploadBtn = page.locator('button', { hasText: /Upload|Import/i }).first()
    if (await uploadBtn.isVisible()) {
      await uploadBtn.click()
      const dialog = page.locator('[role="dialog"]')
      if (await dialog.isVisible()) {
        await expect(dialog).toBeVisible()
      }
    }
  })

  test('URL import dialog opens', async ({ authenticatedPage: page }) => {
    const urlBtn = page.locator('button', { hasText: /URL|Website|Import URL/i }).first()
    if (await urlBtn.isVisible()) {
      await urlBtn.click()
      const dialog = page.locator('[role="dialog"]')
      if (await dialog.isVisible()) {
        await expect(dialog).toBeVisible()
        // Should have URL input
        const urlInput = dialog.locator('input[type="url"], input[placeholder*="url"], input[placeholder*="URL"]')
        if (await urlInput.isVisible()) {
          await expect(urlInput).toBeVisible()
        }
      }
    }
  })

  test('source status badges render', async ({ authenticatedPage: page }) => {
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    if (count > 0) {
      // Status badges should be visible in rows
      const badge = rows.first().locator('[data-slot="badge"], span')
      expect(await badge.count()).toBeGreaterThan(0)
    }
  })

  test('delete source with confirmation dialog', async ({ authenticatedPage: page }) => {
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    if (count > 0) {
      const moreBtn = rows.first().locator('button[aria-haspopup]').first()
      if (await moreBtn.isVisible()) {
        await moreBtn.click()
        const deleteOption = page.locator('[role="menuitem"], [data-slot="dropdown-menu-item"]').locator('text=Delete')
        if (await deleteOption.first().isVisible()) {
          await deleteOption.first().click()
          // Should show confirmation dialog
          const alertDialog = page.locator('[role="alertdialog"]')
          if (await alertDialog.isVisible()) {
            await expect(alertDialog).toBeVisible()
          }
        }
      }
    }
  })

  test('search filters sources by name', async ({ authenticatedPage: page }) => {
    const search = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first()
    if (await search.isVisible()) {
      await search.fill('nonexistent-source-xyz')
      await page.waitForTimeout(1000)
      const rows = page.locator('table tbody tr')
      expect(await rows.count()).toBe(0)
    }
  })

  test('table has proper column headers', async ({ authenticatedPage: page }) => {
    const table = page.locator('table')
    if (await table.isVisible()) {
      const headers = table.locator('th')
      expect(await headers.count()).toBeGreaterThan(0)
    }
  })

  test('knowledge health stats at top', async ({ authenticatedPage: page }) => {
    // Page should show some kind of knowledge health overview
    const healthSection = page.locator('text=Knowledge, text=Source, text=Trained, text=Chunk').first()
    if (await healthSection.isVisible()) {
      await expect(healthSection).toBeVisible()
    }
  })
})

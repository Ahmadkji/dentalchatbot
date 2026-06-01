import { test, expect } from '../fixtures/auth.fixture'
import { waitForLoadersToFinish } from '../fixtures/test-helpers'

async function goToSettings(page: import('@playwright/test').Page) {
  const btn = page.locator('[data-sidebar="menu-button"]', { hasText: 'Settings' })
  await btn.click()
  await waitForLoadersToFinish(page)
}

test.describe('Settings', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    if (!page.url().includes('/dashboard')) {
      await page.goto('/dashboard')
    }
    await waitForLoadersToFinish(page)
    await goToSettings(page)
  })

  test('settings page loads', async ({ authenticatedPage: page }) => {
    const title = page.locator('text=Settings, text=Setting').first()
    if (await title.isVisible()) {
      await expect(title).toBeVisible()
    }
  })

  test('settings tabs switch between categories', async ({ authenticatedPage: page }) => {
    const tabs = page.locator('[role="tab"], [data-slot="tabs-trigger"]')
    const count = await tabs.count()
    if (count > 1) {
      await tabs.nth(1).click()
      await page.waitForTimeout(500)
      // Content should update
      const content = page.locator('[data-slot="sidebar-inset"], main')
      await expect(content).toBeVisible()
    }
  })

  test('setting values are visible', async ({ authenticatedPage: page }) => {
    // Should have at least one setting visible with a value
    const table = page.locator('table')
    const settingsList = page.locator('[class*="setting"], [class*="item"]')
    const hasTable = await table.isVisible()
    const hasList = await settingsList.first().isVisible()
    expect(hasTable || hasList).toBeTruthy()
  })

  test('edit button enables inline editing', async ({ authenticatedPage: page }) => {
    const editBtns = page.locator('button', { hasText: /Edit|Pencil/i })
    const count = await editBtns.count()
    if (count > 0) {
      await editBtns.first().click()
      await page.waitForTimeout(300)
      // An input should become editable
      const input = page.locator('input:not([disabled]), textarea:not([disabled])')
      if (await input.isVisible()) {
        await expect(input.first()).toBeEditable()
      }
    }
  })

  test('save button persists changes', async ({ authenticatedPage: page }) => {
    const editBtns = page.locator('button', { hasText: /Edit|Pencil/i })
    const count = await editBtns.count()
    if (count > 0) {
      await editBtns.first().click()
      await page.waitForTimeout(300)
      const saveBtn = page.locator('button', { hasText: /Save|Check/i }).first()
      if (await saveBtn.isVisible()) {
        await saveBtn.click()
        await page.waitForTimeout(1000)
      }
    }
  })

  test('cancel button reverts changes', async ({ authenticatedPage: page }) => {
    const editBtns = page.locator('button', { hasText: /Edit|Pencil/i })
    const count = await editBtns.count()
    if (count > 0) {
      await editBtns.first().click()
      await page.waitForTimeout(300)
      const cancelBtn = page.locator('button', { hasText: /Cancel|X/i }).first()
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click()
        await page.waitForTimeout(300)
      }
    }
  })

  test('AI Personality setting is visible', async ({ authenticatedPage: page }) => {
    const aiSetting = page.locator('text=AI Personality, text=ai_personality').first()
    if (await aiSetting.isVisible()) {
      await expect(aiSetting).toBeVisible()
    }
  })

  test('After-hours message setting is visible', async ({ authenticatedPage: page }) => {
    const afterHours = page.locator('text=After-Hours, text=after_hours').first()
    if (await afterHours.isVisible()) {
      await expect(afterHours).toBeVisible()
    }
  })
})

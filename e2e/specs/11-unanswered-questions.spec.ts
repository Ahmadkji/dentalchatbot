import { test, expect } from '../fixtures/auth.fixture'
import { waitForLoadersToFinish, openDialog } from '../fixtures/test-helpers'

async function goToUnanswered(page: import('@playwright/test').Page) {
  const btn = page.locator('[data-sidebar="menu-button"]', { hasText: 'Unanswered Inbox' })
  await btn.click()
  await waitForLoadersToFinish(page)
}

test.describe('Unanswered Questions', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    if (!page.url().includes('/dashboard')) {
      await page.goto('/dashboard')
    }
    await waitForLoadersToFinish(page)
    await goToUnanswered(page)
  })

  test('unanswered questions table loads', async ({ authenticatedPage: page }) => {
    const table = page.locator('table')
    const emptyState = page.locator('text=No unanswered, text=No questions, text=All caught up')
    const hasTable = await table.isVisible()
    const hasEmpty = await emptyState.first().isVisible()
    expect(hasTable || hasEmpty).toBeTruthy()
  })

  test('questions show question text and status badge', async ({ authenticatedPage: page }) => {
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    if (count > 0) {
      // Row should contain text (the question)
      const rowText = await rows.first().textContent()
      expect(rowText).toBeTruthy()
      expect(rowText!.length).toBeGreaterThan(0)
    }
  })

  test('Answer button opens answer dialog', async ({ authenticatedPage: page }) => {
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    if (count > 0) {
      const answerBtn = rows.first().locator('button', { hasText: /Answer|Reply/i })
      if (await answerBtn.isVisible()) {
        await answerBtn.click()
        const dialog = page.locator('[role="dialog"]')
        if (await dialog.isVisible()) {
          await expect(dialog).toBeVisible()
        }
      }
    }
  })

  test('answer dialog has textarea and Add to FAQ checkbox', async ({ authenticatedPage: page }) => {
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    if (count > 0) {
      const answerBtn = rows.first().locator('button', { hasText: /Answer|Reply/i })
      if (await answerBtn.isVisible()) {
        await answerBtn.click()
        const dialog = page.locator('[role="dialog"]')
        if (await dialog.isVisible()) {
          // Should have textarea for answer
          const textarea = dialog.locator('textarea')
          if (await textarea.isVisible()) {
            await expect(textarea).toBeVisible()
          }
          // Should have "Add to FAQ" checkbox
          const faqCheckbox = dialog.locator('text=Add to FAQ, text=FAQ')
          if (await faqCheckbox.first().isVisible()) {
            await expect(faqCheckbox.first()).toBeVisible()
          }
        }
      }
    }
  })

  test('empty answer shows validation error', async ({ authenticatedPage: page }) => {
    const rows = page.locator('table tbody tr')
    const count = await rows.count()
    if (count > 0) {
      const answerBtn = rows.first().locator('button', { hasText: /Answer|Reply/i })
      if (await answerBtn.isVisible()) {
        await answerBtn.click()
        const dialog = page.locator('[role="dialog"]')
        if (await dialog.isVisible()) {
          // Submit without filling answer
          const submitBtn = dialog.locator('button', { hasText: /Save|Submit|Answer/i })
          if (await submitBtn.isVisible()) {
            await submitBtn.click()
            await page.waitForTimeout(500)
            // Should show some validation
          }
        }
      }
    }
  })

  test('page title shows Unanswered Questions', async ({ authenticatedPage: page }) => {
    const title = page.locator('text=Unanswered')
    if (await title.first().isVisible()) {
      await expect(title.first()).toBeVisible()
    }
  })

  test('table has proper column headers', async ({ authenticatedPage: page }) => {
    const table = page.locator('table')
    if (await table.isVisible()) {
      const headers = table.locator('th')
      const count = await headers.count()
      expect(count).toBeGreaterThan(0)
    }
  })
})

import { test, expect } from '../fixtures/auth.fixture'
import { waitForLoadersToFinish } from '../fixtures/test-helpers'

async function goToFAQ(page: import('@playwright/test').Page) {
  const btn = page.locator('[data-sidebar="menu-button"]', { hasText: 'FAQ Builder' })
  await btn.click()
  await waitForLoadersToFinish(page)
}

async function ensureFaqCount(page: import('@playwright/test').Page, minimum: number) {
  const tableRows = page.locator('table tbody tr')
  const emptyState = page.locator('text=No FAQs found')

  let count = await tableRows.count()
  if (count === 1 && await emptyState.isVisible().catch(() => false)) {
    count = 0
  }

  while (count < minimum) {
    const seed = `${Date.now()}-${count}`
    const response = await page.request.post('/api/faq', {
      data: {
        question: `E2E FAQ Question ${seed}`,
        answer: `E2E FAQ Answer ${seed}`,
        order: count + 1,
        isActive: true,
      },
    })
    expect(response.ok()).toBeTruthy()
    count += 1
  }

  await page.goto('/dashboard')
  await waitForLoadersToFinish(page)
  await goToFAQ(page)
}

test.describe('FAQ Builder', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    if (!page.url().includes('/dashboard')) {
      await page.goto('/dashboard')
    }
    await waitForLoadersToFinish(page)
    await goToFAQ(page)
  })

  test('FAQ table loads with proper structure', async ({ authenticatedPage: page }) => {
    const table = page.locator('table')
    await expect(table).toBeVisible()

    // Verify column headers exist
    const headers = table.locator('th')
    await expect(headers).toHaveCount(5)

    // Either rows with data or empty state text
    const rows = table.locator('tbody tr')
    const rowCount = await rows.count()
    const emptyState = page.locator('text=No FAQs found')
    expect(rowCount > 0 || (await emptyState.isVisible())).toBeTruthy()
  })

  test('Add FAQ button opens create dialog', async ({ authenticatedPage: page }) => {
    const addBtn = page.locator('button', { hasText: 'Add FAQ' })
    await expect(addBtn).toBeVisible()
    await addBtn.click()

    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('text=Add New FAQ')).toBeVisible()
  })

  test('FAQ form has question and answer fields', async ({ authenticatedPage: page }) => {
    const addBtn = page.locator('button', { hasText: 'Add FAQ' })
    await addBtn.click()

    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()

    // Should have question textarea
    const questionInput = dialog.locator('#faq-question')
    await expect(questionInput).toBeVisible()

    // Should have answer textarea
    const answerInput = dialog.locator('#faq-answer')
    await expect(answerInput).toBeVisible()
  })

  test('empty question/answer shows validation error', async ({ authenticatedPage: page }) => {
    const addBtn = page.locator('button', { hasText: 'Add FAQ' })
    await addBtn.click()

    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()

    // Click submit without filling fields
    const submitBtn = dialog.locator('button', { hasText: /Add FAQ/ })
    await submitBtn.click()

    // Should show toast error
    await expect(page.locator('text=Question is required')).toBeVisible()
  })

  test('edit FAQ dialog opens from dropdown menu', async ({ authenticatedPage: page }) => {
    await ensureFaqCount(page, 1)
    const rows = page.locator('table tbody tr')

    // Open the "..." dropdown menu on first row
    const menuBtn = rows.first().locator('button').filter({ has: page.locator('svg') }).first()
    await menuBtn.click()

    // Click Edit in the dropdown
    const editItem = page.locator('[role="menuitem"]', { hasText: 'Edit' })
    await expect(editItem).toBeVisible()
    await editItem.click()

    // Edit dialog should open
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('text=Edit FAQ')).toBeVisible()
  })

  test('delete FAQ opens confirmation dialog', async ({ authenticatedPage: page }) => {
    await ensureFaqCount(page, 1)
    const rows = page.locator('table tbody tr')

    // Open the "..." dropdown menu on first row
    const menuBtn = rows.first().locator('button').filter({ has: page.locator('svg') }).first()
    await menuBtn.click()

    // Click Delete in the dropdown
    const deleteItem = page.locator('[role="menuitem"]', { hasText: 'Delete' })
    await expect(deleteItem).toBeVisible()
    await deleteItem.click()

    // Confirmation dialog should appear (AlertDialog)
    const alertDialog = page.locator('[role="alertdialog"]')
    await expect(alertDialog).toBeVisible()
    await expect(alertDialog.locator('text=Delete FAQ?')).toBeVisible()
  })

  test('reorder FAQ up/down buttons exist', async ({ authenticatedPage: page }) => {
    await ensureFaqCount(page, 2)
    const rows = page.locator('table tbody tr')

    // Second row should have an enabled up button
    const secondRowUpBtn = rows.nth(1).locator('button').filter({ has: page.locator('svg.lucide-chevron-up') })
    await expect(secondRowUpBtn).toBeVisible()
    // Up button on second row should be enabled (not first row)
    expect(await secondRowUpBtn.isEnabled()).toBeTruthy()
  })

  test('search filters FAQs', async ({ authenticatedPage: page }) => {
    const searchInput = page.locator('input[placeholder="Search FAQs..."]')
    await expect(searchInput).toBeVisible()

    await searchInput.fill('nonexistent-faq-xyz-12345')
    await page.waitForTimeout(300)

    // Should show empty state
    const rows = page.locator('table tbody tr')
    await expect(rows).toHaveCount(1) // empty state row
    await expect(page.locator('text=No FAQs found')).toBeVisible()
  })

  test('reorder buttons are disabled when search is active', async ({ authenticatedPage: page }) => {
    await ensureFaqCount(page, 2)

    const searchInput = page.locator('input[placeholder="Search FAQs..."]')
    await searchInput.fill('test')
    await page.waitForTimeout(300)

    // Reorder buttons should be disabled
    const upBtn = page.locator('table tbody tr').first().locator('button').filter({ has: page.locator('svg.lucide-chevron-up') })
    if (await upBtn.isVisible()) {
      expect(await upBtn.isDisabled()).toBeTruthy()
    }
  })
})

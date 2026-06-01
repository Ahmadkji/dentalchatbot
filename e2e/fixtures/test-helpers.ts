import type { Page, Locator } from '@playwright/test'

// ── Wait for a specific API call to complete ────────────────
export async function waitForApiCall(page: Page, urlPattern: string | RegExp) {
  return page.waitForResponse(
    (resp) => {
      const url = resp.url()
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern)
      }
      return urlPattern.test(url)
    },
    { timeout: 15_000 }
  )
}

// ── Navigate via sidebar label ───────────────────────────────
export async function navigateToSidebarItem(page: Page, label: string) {
  await page.locator('[data-sidebar="menu-button"]').getByText(label, { exact: true }).click()
  // Wait for the page content to update
  await page.waitForTimeout(500)
}

// ── Fill a dialog form (key = label, value = input) ──────────
export async function fillDialogFields(
  page: Page,
  fields: Record<string, string>
) {
  for (const [labelText, value] of Object.entries(fields)) {
    const dialog = page.locator('[role="dialog"]')
    const label = dialog.locator('label', { hasText: labelText })
    const input = dialog.locator(`#${await label.getAttribute('for') ?? ''}`)
    if (await input.count() > 0) {
      await input.fill(value)
    }
  }
}

// ── Wait for loading skeletons to disappear ──────────────────
export async function waitForLoadersToFinish(page: Page) {
  // Wait for skeleton elements to be gone
  const skeletons = page.locator('[data-slot="skeleton"]')
  if (await skeletons.count() > 0) {
    await skeletons.last().waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {})
  }
}

// ── Dismiss any toast notifications ──────────────────────────
export async function dismissToasts(page: Page) {
  const toasts = page.locator('[data-sonner-toaster] [data-sonner-toast]')
  const count = await toasts.count()
  for (let i = 0; i < count; i++) {
    await toasts.nth(i).locator('button').click().catch(() => {})
  }
}

// ── Check if table has rows ─────────────────────────────────
export async function tableHasRows(page: Page): Promise<boolean> {
  const rows = page.locator('table tbody tr')
  return (await rows.count()) > 0
}

// ── Get table row count ──────────────────────────────────────
export async function getTableRowCount(page: Page): Promise<number> {
  return page.locator('table tbody tr').count()
}

// ── Open dialog via button ───────────────────────────────────
export async function openDialog(page: Page, triggerText: string) {
  await page.locator('button', { hasText: triggerText }).first().click()
  await page.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5_000 })
}

// ── Confirm in alert dialog ──────────────────────────────────
export async function confirmAlertDialog(page: Page) {
  await page.locator('[role="alertdialog"] button', { hasText: /confirm|delete|continue|yes/i }).click()
  await page.locator('[role="alertdialog"]').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {})
}

// ── Submit a dialog form ─────────────────────────────────────
export async function submitDialog(page: Page, buttonText = /save|create|add|submit/i) {
  const dialog = page.locator('[role="dialog"]')
  await dialog.locator('button', { hasText: buttonText }).click()
}

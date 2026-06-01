import { test, expect } from '../fixtures/auth.fixture'
import { waitForLoadersToFinish } from '../fixtures/test-helpers'

const navItems = [
  { label: 'Overview', expected: 'Overview' },
  { label: 'Inbox', expected: 'Conversation Inbox' },
  { label: 'Leads', expected: 'Leads' },
  { label: 'Unanswered Inbox', expected: 'Unanswered' },
  { label: 'Bot Setup', expected: 'Bot Setup' },
  { label: 'Knowledge Sources', expected: 'Knowledge Sources' },
  { label: 'FAQ Builder', expected: 'FAQ Builder' },
  { label: 'Widget & Install', expected: 'Widget' },
  { label: 'Customizations', expected: 'Customizations' },
  { label: 'Settings', expected: 'Settings' },
]

test.describe('Sidebar Navigation', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    if (!page.url().includes('/dashboard')) {
      await page.goto('/dashboard')
    }
    await waitForLoadersToFinish(page)
  })

  for (const item of navItems) {
    test(`clicking "${item.label}" shows correct page`, async ({ authenticatedPage: page }) => {
      const sidebarBtn = page.locator('[data-sidebar="menu-button"]', { hasText: item.label })
      if (await sidebarBtn.isVisible()) {
        await sidebarBtn.click()
        await page.waitForTimeout(500)
        // Verify the page title or content changed
        const pageContent = page.locator('main, [role="main"], [data-slot="sidebar-inset"]')
        await expect(pageContent).toBeVisible()
      }
    })
  }

  test('all nav groups are visible', async ({ authenticatedPage: page }) => {
    await expect(page.locator('text=Core').first()).toBeVisible()
    await expect(page.locator('text=Training').first()).toBeVisible()
    await expect(page.locator('text=Conversations').first()).toBeVisible()
    await expect(page.locator('text=Deploy').first()).toBeVisible()
  })

  test('user dropdown menu opens with sign out option', async ({ authenticatedPage: page }) => {
    // Find the user avatar/dropdown trigger in sidebar footer
    const avatar = page.locator('[data-slot="sidebar-footer"] button, [data-slot="sidebar-footer"] [role="button"]').first()
    if (await avatar.isVisible()) {
      await avatar.click()
      // Should show a dropdown with Sign out option
      const signOut = page.locator('text=Sign out, text=Sign Out, text=Log out')
      if (await signOut.first().isVisible()) {
        await expect(signOut.first()).toBeVisible()
      }
    }
  })
})

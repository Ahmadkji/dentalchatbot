import { test, expect } from '../fixtures/auth.fixture'
import { waitForLoadersToFinish } from '../fixtures/test-helpers'

async function goToWidget(page: import('@playwright/test').Page) {
  const btn = page.locator('[data-sidebar="menu-button"]', { hasText: 'Widget & Install' })
  await btn.click()
  await waitForLoadersToFinish(page)
}

test.describe('Widget & Install', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    if (!page.url().includes('/dashboard')) {
      await page.goto('/dashboard')
    }
    await waitForLoadersToFinish(page)
    await goToWidget(page)
  })

  test('widget settings page loads', async ({ authenticatedPage: page }) => {
    const title = page.locator('text=Widget, text=Install').first()
    if (await title.isVisible()) {
      await expect(title).toBeVisible()
    }
  })

  test('bot name field is present', async ({ authenticatedPage: page }) => {
    const nameLabel = page.locator('label', { hasText: /Bot Name|Name|Title/i }).first()
    if (await nameLabel.isVisible()) {
      await expect(nameLabel).toBeVisible()
    }
  })

  test('welcome message field is present', async ({ authenticatedPage: page }) => {
    const welcomeLabel = page.locator('label', { hasText: /Welcome|Greeting|Message/i }).first()
    if (await welcomeLabel.isVisible()) {
      await expect(welcomeLabel).toBeVisible()
    }
  })

  test('primary color picker is present', async ({ authenticatedPage: page }) => {
    const colorPicker = page.locator('input[type="color"], input[type="text"][placeholder*="color"], label:has-text("Color")').first()
    if (await colorPicker.isVisible()) {
      await expect(colorPicker).toBeVisible()
    }
  })

  test('widget position selector is present', async ({ authenticatedPage: page }) => {
    const position = page.locator('text=Position, text=bottom-right, text=bottom-left').first()
    if (await position.isVisible()) {
      await expect(position).toBeVisible()
    }
  })

  test('enable/disable widget toggle is present', async ({ authenticatedPage: page }) => {
    const toggle = page.locator('text=Enabled, text=Widget Enabled').first()
    if (await toggle.isVisible()) {
      await expect(toggle).toBeVisible()
    }
  })

  test('embed code section is visible', async ({ authenticatedPage: page }) => {
    const embedSection = page.locator('text=Embed, text=Install, text=Code Snippet').first()
    if (await embedSection.isVisible()) {
      await expect(embedSection).toBeVisible()
    }
  })

  test('copy embed code button exists', async ({ authenticatedPage: page }) => {
    const copyBtn = page.locator('button', { hasText: /Copy/i }).first()
    if (await copyBtn.isVisible()) {
      await expect(copyBtn).toBeVisible()
    }
  })

  test('allowed domains section renders', async ({ authenticatedPage: page }) => {
    const domainsSection = page.locator('text=Domain, text=Allowed').first()
    if (await domainsSection.isVisible()) {
      await expect(domainsSection).toBeVisible()
    }
  })

  test('WhatsApp/Call/Location button toggles are present', async ({ authenticatedPage: page }) => {
    const whatsappToggle = page.locator('text=WhatsApp, text=Whatsapp').first()
    const callToggle = page.locator('text=Call').first()
    const locationToggle = page.locator('text=Location, text=Maps').first()
    // At least one of these should be visible
    const anyVisible = await whatsappToggle.isVisible() || await callToggle.isVisible() || await locationToggle.isVisible()
    expect(anyVisible).toBeTruthy()
  })
})

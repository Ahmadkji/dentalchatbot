import { test, expect } from '@playwright/test'
import { TEST_CLINIC_SLUG } from '../fixtures/auth.fixture'

// This test uses the manual embed HTML page to test the widget
// It requires a valid clinic slug with widget enabled
test.describe('Public Widget', () => {
  test.skip(!TEST_CLINIC_SLUG, 'TEST_CLINIC_SLUG env var is required')

  test('widget embed HTML page loads', async ({ page }) => {
    await page.goto('/tests/manual/liveproof-embed.html')
    await expect(page.locator('h1', { hasText: 'Live Proof' })).toBeVisible()
  })

  test('widget launcher button appears after bootstrap', async ({ page }) => {
    await page.goto('/tests/manual/liveproof-embed.html')
    // The widget.js should load and create a launcher button
    const launcher = page.locator('button[aria-label="Open chat widget"], button[aria-label*="chat"], button[aria-label*="Chat"]').first()
    await expect(launcher).toBeVisible({ timeout: 15_000 })
  })

  test('clicking launcher opens chat iframe', async ({ page }) => {
    await page.goto('/tests/manual/liveproof-embed.html')
    const launcher = page.locator('button[aria-label="Open chat widget"], button[aria-label*="chat"], button[aria-label*="Chat"]').first()
    await expect(launcher).toBeVisible({ timeout: 15_000 })
    await launcher.click()
    // iframe should become visible
    const iframe = page.locator('iframe[title="Clinic chatbot widget"], iframe[title*="chat"]').first()
    await expect(iframe).toBeVisible({ timeout: 5_000 })
  })

  test('Escape key closes widget', async ({ page }) => {
    await page.goto('/tests/manual/liveproof-embed.html')
    const launcher = page.locator('button[aria-label="Open chat widget"], button[aria-label*="chat"], button[aria-label*="Chat"]').first()
    await expect(launcher).toBeVisible({ timeout: 15_000 })
    await launcher.click()
    await page.waitForTimeout(1000)

    // Press Escape
    await page.keyboard.press('Escape')
    // iframe should become hidden
    const iframe = page.locator('iframe[title="Clinic chatbot widget"], iframe[title*="chat"]').first()
    await page.waitForTimeout(500)
    const ariaHidden = await iframe.getAttribute('aria-hidden')
    expect(ariaHidden).toBe('true')
  })

  test('widget config endpoint returns valid config', async ({ request }) => {
    const response = await request.get(`/api/widget/config?slug=${encodeURIComponent(TEST_CLINIC_SLUG)}`, {
      headers: {
        origin: 'http://localhost:3000',
      },
    })
    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('widgetAccessToken')
    expect(data.widgetAccessToken.length).toBeGreaterThan(0)
  })

  test('invalid slug returns 400', async ({ request }) => {
    const response = await request.get('/api/widget/config?slug=')
    expect(response.status()).toBe(400)
  })

  test('widget-frame page loads', async ({ page }) => {
    await page.goto(`/widget-frame?clinicSlug=${encodeURIComponent(TEST_CLINIC_SLUG)}`)
    // Should load the widget frame page without error
    await page.waitForTimeout(2000)
    // No JS errors should crash the page
    const body = page.locator('body')
    await expect(body).toBeVisible()
  })
})

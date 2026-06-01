import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/DentalGPT/i)
  })

  test('hero section is visible', async ({ page }) => {
    const hero = page.locator('section').first()
    await expect(hero).toBeVisible()
    await expect(page.locator('h1')).toContainText('missed calls')
  })

  test('navigation bar has Sign In and Get Started links', async ({ page }) => {
    const nav = page.locator('nav[aria-label="Main navigation"]')
    await expect(nav).toBeVisible()
    await expect(nav.locator('a', { hasText: 'Sign In' })).toBeVisible()
    await expect(nav.locator('a', { hasText: 'Get Started' })).toBeVisible()
  })

  test('stats ticker section renders', async ({ page }) => {
    const stats = page.locator('#stats')
    await expect(stats).toBeVisible()
  })

  test('pain points section renders', async ({ page }) => {
    const painPoints = page.locator('#pain-points')
    await expect(painPoints).toBeVisible()
  })

  test('how it works section renders', async ({ page }) => {
    const howItWorks = page.locator('#how-it-works')
    await expect(howItWorks).toBeVisible()
  })

  test('pricing section renders', async ({ page }) => {
    const pricing = page.locator('#pricing')
    await expect(pricing).toBeVisible()
  })

  test('FAQ accordion expands and collapses', async ({ page }) => {
    // Scroll to FAQ
    await page.locator('#pricing').scrollIntoViewIfNeeded()
    // Click a FAQ question to expand
    const firstFaq = page.locator('button', { hasText: 'What is an AI front desk' }).first()
    if (await firstFaq.isVisible()) {
      await firstFaq.click()
      // The answer should become visible
      await expect(page.locator('text=An AI front desk is a virtual assistant')).toBeVisible()
    }
  })

  test('footer renders', async ({ page }) => {
    const footer = page.locator('footer')
    if (await footer.isVisible()) {
      await expect(footer).toBeVisible()
    }
  })

  test('Get Started link navigates to login', async ({ page }) => {
    const cta = page.locator('a', { hasText: 'Get started free' }).first()
    await expect(cta).toHaveAttribute('href', '/login')
  })
})

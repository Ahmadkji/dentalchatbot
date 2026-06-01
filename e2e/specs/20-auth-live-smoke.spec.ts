import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || ''

test.skip(!supabaseUrl || !anonKey || !serviceRoleKey, 'Live Supabase config is required for the auth smoke test')

test.describe.configure({ timeout: 300_000 })

function createAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

async function retry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 1000): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

async function createTestUser(label: string) {
  const admin = createAdminClient()
  const timestamp = Date.now()
  const email = `${label}-${timestamp}@example.test`
  const password = `DentBot-${timestamp}!`

  const created = await retry(
    () =>
      admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      }),
    3,
    1500
  )

  if (created.error || !created.data.user) {
    throw created.error ?? new Error('Failed to create integration test user.')
  }

  return {
    id: created.data.user.id,
    email,
    password,
  }
}

async function cleanupUsers(users: Array<{ id: string }>) {
  const admin = createAdminClient()
  await Promise.all(users.map(async (user) => {
    await retry(async () => {
      const { error } = await admin.auth.admin.deleteUser(user.id)
      if (error) {
        throw error
      }
    }, 3, 1000).catch((error) => {
      console.warn('[auth-smoke] cleanup failed for user', user.id, error.message)
    })
  }))
}

test.describe('Auth - Live Smoke', () => {
  let user: Awaited<ReturnType<typeof createTestUser>> | null = null

  test.beforeAll(async () => {
    user = await createTestUser('auth-smoke')
  })

  test.afterAll(async () => {
    if (user) {
      await cleanupUsers([user])
    }
  })

  test('signs in through the app and signs out through the real route', async ({ page }) => {
    if (!user) throw new Error('Test user was not created')
    const admin = createAdminClient()
    const testIp = `203.0.113.${Math.floor(Math.random() * 200) + 1}`

    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    const origin = new URL(page.url()).origin
    const loginResponse = await page.request.post('/api/auth/login', {
      headers: {
        origin,
        'x-forwarded-for': testIp,
        'content-type': 'application/json',
      },
      timeout: 60_000,
      data: {
        mode: 'signin',
        email: user.email,
        password: user.password,
        next: '/dashboard',
      },
    })

    const loginText = await loginResponse.text()
    if (!loginResponse.ok()) {
      throw new Error(`Login failed (${loginResponse.status()}): ${loginText}`)
    }
    const loginBody = JSON.parse(loginText) as { ok?: boolean }
    expect(loginBody.ok).toBe(true)

    const sessionCountAfterLogin = await admin
      .from('user_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    expect(sessionCountAfterLogin.count ?? 0).toBe(1)

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/onboarding/)

    const logoutResponse = await page.request.post('/api/auth/logout', {
      headers: { origin, 'x-forwarded-for': testIp },
      timeout: 180_000,
    })
    const logoutText = await logoutResponse.text()
    if (!logoutResponse.ok()) {
      throw new Error(`Logout failed (${logoutResponse.status()}): ${logoutText}`)
    }
    const logoutBody = JSON.parse(logoutText) as { ok?: boolean }
    expect(logoutBody.ok).toBe(true)

    const sessionCountAfterLogout = await admin
      .from('user_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    expect(sessionCountAfterLogout.count ?? 0).toBe(0)

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/login/)
  })
})

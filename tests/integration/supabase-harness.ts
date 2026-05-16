import { createClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { TestUser } from './table-specs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || ''

export const hasLiveSupabaseConfig = Boolean(supabaseUrl && anonKey && serviceRoleKey)

export async function createTestUser(label: string): Promise<TestUser> {
  const admin = createSupabaseAdminClient()
  const timestamp = Date.now()
  const email = `${label}-${timestamp}@example.test`
  const password = `DentBot-${timestamp}!`

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (created.error || !created.data.user) {
    throw created.error ?? new Error('Failed to create integration test user.')
  }

  return {
    id: created.data.user.id,
    email,
    password,
  }
}

export async function cleanupUsers(users: TestUser[]) {
  const admin = createSupabaseAdminClient()
  await Promise.all(
    users.map(async (user) => {
      await admin.auth.admin.deleteUser(user.id)
    }),
  )
}

export async function createAuthenticatedClient(user: TestUser) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })

  const signedIn = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  })

  if (signedIn.error) {
    throw signedIn.error
  }

  return client
}

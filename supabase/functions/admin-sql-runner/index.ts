import postgres from 'npm:postgres@3.4.7'

const runnerSecret = Deno.env.get('ADMIN_SQL_RUNNER_SECRET')?.trim() ?? ''
const databaseUrl = Deno.env.get('SUPABASE_DB_URL')?.trim() ?? ''

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  })
}

function readSecret(request: Request) {
  const direct = request.headers.get('x-admin-sql-secret')?.trim()
  if (direct) return direct

  const authorization = request.headers.get('authorization')?.trim()
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim()
  }

  return null
}

function timingSafeEqualStrings(a: string, b: string) {
  const encoder = new TextEncoder()
  const aBytes = encoder.encode(a)
  const bBytes = encoder.encode(b)

  if (aBytes.length !== bBytes.length) return false

  let diff = 0
  for (let i = 0; i < aBytes.length; i += 1) {
    diff |= aBytes[i] ^ bBytes[i]
  }

  return diff === 0
}

function toSerializable(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString()
  if (Array.isArray(value)) return value.map((item) => toSerializable(item))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, toSerializable(entry)]),
    )
  }

  return value
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  if (!runnerSecret || !databaseUrl) {
    return json({ error: 'Admin SQL runner is not configured.' }, 503)
  }

  const incomingSecret = readSecret(request)
  if (!incomingSecret || !timingSafeEqualStrings(incomingSecret, runnerSecret)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const body = await request.json().catch(() => null)
  const query = typeof body?.query === 'string' ? body.query.trim() : ''
  const params = Array.isArray(body?.params) ? body.params : []

  if (!query) {
    return json({ error: 'query is required' }, 400)
  }

  const sql = postgres(databaseUrl, { prepare: false })

  try {
    const result = await sql.unsafe(query, params)
    return json({
      count: result.count ?? null,
      rows: result.map((row) => toSerializable(row)),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Query failed'
    console.error('[admin-sql-runner] Query failed', { error: message })
    return json({ error: message }, 500)
  } finally {
    await sql.end({ timeout: 5 })
  }
})

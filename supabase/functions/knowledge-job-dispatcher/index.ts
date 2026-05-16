declare const Deno: {
  env: {
    get(name: string): string | undefined
  }
  serve(handler: (request: Request) => Response | Promise<Response>): void
}

const runnerUrl = Deno.env.get('KNOWLEDGE_JOB_RUNNER_URL')?.trim() ?? ''
const runnerSecret = Deno.env.get('KNOWLEDGE_JOB_RUNNER_SECRET')?.trim() ?? ''
const dispatcherSecret = Deno.env.get('KNOWLEDGE_DISPATCHER_SECRET')?.trim() ?? ''

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
  const direct = request.headers.get('x-knowledge-dispatcher-secret')?.trim()
  if (direct) return direct

  const authorization = request.headers.get('authorization')?.trim()
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim()
  }

  return null
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  if (!dispatcherSecret || !runnerUrl || !runnerSecret) {
    return json({ error: 'Knowledge dispatcher is not configured.' }, 503)
  }

  const incomingSecret = readSecret(request)
  if (!incomingSecret || incomingSecret !== dispatcherSecret) {
    return json({ error: 'Unauthorized' }, 401)
  }

  try {
    const result = await fetch(runnerUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-knowledge-runner-secret': runnerSecret,
      },
      body: JSON.stringify({
        limit: 2,
        runner: 'supabase-edge-dispatcher',
      }),
    })

    const text = await result.text()
    return new Response(text, {
      status: result.status,
      headers: {
        'content-type': result.headers.get('content-type') ?? 'application/json',
        'cache-control': 'no-store',
      },
    })
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : 'Failed to dispatch knowledge jobs.',
      },
      500,
    )
  }
})

/* eslint-disable no-undef */
declare const Deno: {
  serve(handler: (request: Request) => Response | Promise<Response>): void
}
declare namespace Supabase {
  namespace ai {
    class Session {
      constructor(model: string)
      run(input: string, options?: { mean_pool?: boolean; normalize?: boolean }): Promise<number[]>
    }
  }
}

const session = new Supabase.ai.Session('gte-small')

Deno.serve(async (request) => {
  try {
    const body = await request.json()
    const inputs = Array.isArray(body?.inputs) ? body.inputs : []

    if (!inputs.length) {
      return Response.json({ error: 'inputs must be a non-empty array' }, { status: 400 })
    }

    const vectors: number[][] = []

    for (const input of inputs) {
      const value = typeof input === 'string' ? input.trim() : ''
      if (!value) {
        return Response.json({ error: 'all inputs must be non-empty strings' }, { status: 400 })
      }

      const vector = await session.run(value, { mean_pool: true, normalize: true })
      vectors.push(vector as number[])
    }

    return Response.json({
      model: 'gte-small',
      dimension: 384,
      vectors,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate embeddings'
    return Response.json({ error: message }, { status: 500 })
  }
})

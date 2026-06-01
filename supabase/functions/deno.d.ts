/**
 * Shared Deno + Supabase type declarations for edge functions.
 * Each function file uses these via ambient declarations.
 */
declare const Deno: {
  env: {
    get(name: string): string | undefined
  }
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

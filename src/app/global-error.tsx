'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <p className="text-sm font-semibold text-rose-300">Application error</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Something went wrong.</h1>
            <p className="mt-3 text-sm text-slate-300">
              We could not load this page. Try again, and if it keeps failing, refresh the browser.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="mt-5 inline-flex items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-slate-200"
            >
              Try again
            </button>
            {process.env.NODE_ENV === 'development' && (
              <p className="mt-4 break-words text-xs text-slate-400">{error.message}</p>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}

'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4 py-10">
      <div className="max-w-md rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-semibold text-amber-700">Dashboard error</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Failed to load this dashboard section.</h2>
        <p className="mt-3 text-sm text-slate-600">
          The page hit an unexpected error. Try again to reload the dashboard.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-5 inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          Retry
        </button>
      </div>
    </div>
  )
}

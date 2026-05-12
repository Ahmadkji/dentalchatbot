'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ResetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSession, setHasSession] = useState(true)

  useEffect(() => {
    let active = true

    async function verifySession() {
      try {
        const response = await fetch('/api/auth/reset-password', {
          method: 'HEAD',
        })
        if (active) {
          setHasSession(response.status !== 401)
        }
      } catch {
        if (active) {
          setHasSession(true)
        }
      }
    }

    void verifySession()

    return () => {
      active = false
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setPending(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(data.error ?? 'Failed to update password.')
        return
      }

      setSuccess(true)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  if (!hasSession && !success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50/60 via-white to-white p-4">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-72 h-72 bg-emerald-100/30 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-emerald-50/40 rounded-full blur-3xl" />
        </div>

        <div className="relative w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-6 md:p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Link expired</h2>
            <p className="text-gray-500 text-sm mb-6">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <Link
              href="/forgot-password"
              className="inline-flex items-center justify-center h-11 px-6 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg shadow-lg shadow-emerald-200 transition-all"
            >
              Request new link
            </Link>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50/60 via-white to-white p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-emerald-100/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-emerald-50/40 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-6 md:p-8">
          {!success ? (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                  <Lock className="w-6 h-6 text-emerald-600" />
                </div>
              </div>

              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Set new password</h2>
                <p className="text-gray-400 text-sm mt-1">
                  Your new password must be different from previous passwords.
                </p>
              </div>

              {error ? (
                <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">New password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="pl-10 pr-10 h-11 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg transition-all"
                      required
                      disabled={pending}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">Confirm password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="pl-10 h-11 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-lg transition-all"
                      required
                      disabled={pending}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={pending}
                  className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg shadow-lg shadow-emerald-200 hover:shadow-emerald-300 transition-all duration-200"
                >
                  {pending ? 'Updating...' : 'Reset password'}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Password updated!</h2>
              <p className="text-gray-500 text-sm mb-4">
                Your password has been successfully reset. Redirecting to sign in...
              </p>
              <Button
                className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg shadow-lg shadow-emerald-200"
                onClick={() => router.push('/login')}
              >
                Sign in
              </Button>
            </div>
          )}

          {!success ? (
            <div className="mt-6 pt-4 border-t border-gray-100">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

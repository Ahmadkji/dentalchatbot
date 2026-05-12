'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, CheckCircle2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface VerifyEmailFormProps {
  email: string
}

export function VerifyEmailForm({ email }: VerifyEmailFormProps) {
  const [pending, setPending] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleResend = async () => {
    if (!email.trim()) {
      setError('Email address is required.')
      return
    }

    setPending(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }

      setSuccess(true)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50/60 via-white to-white p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-emerald-100/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-emerald-50/40 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-6 md:p-8">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
              <Mail className="w-6 h-6 text-emerald-600" />
            </div>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Verify your email</h2>
            <p className="text-gray-500 text-sm mt-2">
              We sent a confirmation email to <span className="font-medium text-gray-700">{email}</span>.
            </p>
          </div>

          {error ? (
            <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {success ? (
            <div className="mb-4 p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Confirmation email sent. Please check your inbox.</span>
            </div>
          ) : null}

          <Button
            type="button"
            className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg shadow-lg shadow-emerald-200 hover:shadow-emerald-300 transition-all duration-200"
            onClick={handleResend}
            disabled={pending}
          >
            {pending ? 'Sending...' : 'Resend confirmation email'}
          </Button>

          <div className="mt-6 pt-4 border-t border-gray-100">
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

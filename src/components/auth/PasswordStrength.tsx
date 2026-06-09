'use client'

/**
 * Lightweight password-strength indicator for the signup form.
 *
 * Evaluates four rules (length, uppercase, number, special character)
 * and renders a colour-coded bar with a text label.
 *
 * No external dependencies — purposefully simpler than zxcvbn because
 * Supabase Auth enforces its own server-side strength check, making this
 * purely a UX hint, not a security gate.
 */

interface PasswordStrengthProps {
  password: string
}

type StrengthLevel = 0 | 1 | 2 | 3 | 4

function evaluateStrength(password: string): StrengthLevel {
  if (!password) return 0

  // Length >= 8 is a prerequisite — without it, the password cannot
  // be considered any strength. All other rules are additive.
  if (password.length < 8) return 1

  let score = 1 // Already passed length check

  if (/[A-Z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1

  return (Math.min(score, 4)) as StrengthLevel
}

const STRENGTH_CONFIG: Record<StrengthLevel, { label: string; color: string; width: string }> = {
  0: { label: '', color: '', width: 'w-0' },
  1: { label: 'Weak', color: 'bg-red-400', width: 'w-1/4' },
  2: { label: 'Fair', color: 'bg-amber-400', width: 'w-2/4' },
  3: { label: 'Good', color: 'bg-emerald-400', width: 'w-3/4' },
  4: { label: 'Strong', color: 'bg-emerald-600', width: 'w-full' },
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const level = evaluateStrength(password)

  if (level === 0) return null

  const config = STRENGTH_CONFIG[level]

  return (
    <div className="space-y-1">
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${config.color} ${config.width}`}
        />
      </div>
      <p className="text-xs text-gray-400">
        Password strength: <span className="font-medium text-gray-500">{config.label}</span>
      </p>
    </div>
  )
}

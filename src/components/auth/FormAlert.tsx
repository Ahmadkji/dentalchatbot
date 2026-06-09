import { AlertCircle, CheckCircle2 } from 'lucide-react'

/**
 * Shared inline alert for auth forms.
 *
 * Provides a single source of truth for error and success banners
 * across LoginForm, ForgotPasswordForm, ResetPasswordForm, and VerifyEmailForm.
 *
 * Uses `role="alert"` for screen-reader announcements.
 */

type FormAlertVariant = 'error' | 'success'

interface FormAlertProps {
  variant: FormAlertVariant
  children: React.ReactNode
}

const VARIANT_STYLES: Record<FormAlertVariant, string> = {
  error:
    'border-red-200 bg-red-50 text-red-700',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-700',
}

const VARIANT_ICONS: Record<FormAlertVariant, typeof AlertCircle> = {
  error: AlertCircle,
  success: CheckCircle2,
}

export function FormAlert({ variant, children }: FormAlertProps) {
  const Icon = VARIANT_ICONS[variant]

  return (
    <div
      role="alert"
      className={`mb-4 p-3 rounded-lg border text-sm flex items-start gap-2 ${VARIANT_STYLES[variant]}`}
    >
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Mail, Phone, User, Shield, X } from 'lucide-react'

type LeadCaptureField = 'name' | 'phone' | 'email'

export type LeadCaptureFormValues = {
  name: string
  phone: string
  email: string
}

type LeadCaptureFormInitialValues = {
  name?: string | null
  phone?: string | null
  email?: string | null
}

type LeadCaptureFormProps = {
  fields: LeadCaptureField[]
  initialValues?: LeadCaptureFormInitialValues
  title?: string
  description?: string
  submitLabel?: string
  onSubmit: (values: LeadCaptureFormValues) => Promise<void> | void
  onDismiss: () => void
  canDismiss?: boolean
  submitting?: boolean
  compact?: boolean
  primaryColor?: string
}

const DEFAULT_VALUES: LeadCaptureFormValues = {
  name: '',
  phone: '',
  email: '',
}

function normalizeInitialValues(initialValues?: LeadCaptureFormInitialValues): LeadCaptureFormValues {
  return {
    name: initialValues?.name ?? '',
    phone: initialValues?.phone ?? '',
    email: initialValues?.email ?? '',
  }
}

function BotAvatar({ size = 48, color = '#059669' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="34" r="22" fill="white" />
      <rect x="30" y="6" width="4" height="10" rx="2" fill="white" />
      <circle cx="32" cy="5" r="3.5" fill="#FCD34D" />
      <circle cx="24" cy="30" r="3" fill={color} />
      <circle cx="40" cy="30" r="3" fill={color} />
      <path d="M24 38Q32 46 40 38" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export function LeadCaptureForm({
  fields,
  initialValues,
  title = 'Share your contact details',
  description = 'We will use this only so the clinic can follow up with you.',
  submitLabel = 'Send details',
  onSubmit,
  onDismiss,
  canDismiss = true,
  submitting = false,
  compact = false,
  primaryColor = '#059669',
}: LeadCaptureFormProps) {
  const [values, setValues] = useState<LeadCaptureFormValues>({
    ...DEFAULT_VALUES,
    ...normalizeInitialValues(initialValues),
  })

  const visibleFields = fields.length > 0 ? fields : (['phone', 'email'] as LeadCaptureField[])

  const canSubmit = visibleFields.every((field) => {
    if (field === 'name') return values.name.trim().length > 0
    if (field === 'phone') return values.phone.trim().length > 0
    if (field === 'email') return values.email.trim().length > 0
    return false
  })

  if (compact) {
    return (
      <div className="rounded-2xl border bg-white shadow-sm p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="mt-0.5 text-xs text-slate-500">{description}</p>
          </div>
          {canDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-full border p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
              aria-label="Not now"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <form
          className="mt-3 grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!canSubmit) return
            await onSubmit(values)
          }}
        >
          {visibleFields.includes('name') && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={values.name}
                onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition-all focus:ring-2 focus:border-transparent placeholder:text-slate-400"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
          )}
          {visibleFields.includes('phone') && (
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="tel"
                value={values.phone}
                onChange={(event) => setValues((prev) => ({ ...prev, phone: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition-all focus:ring-2 focus:border-transparent placeholder:text-slate-400"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                placeholder="+1 555 123 4567"
                autoComplete="tel"
                required
              />
            </div>
          )}
          {visibleFields.includes('email') && (
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={values.email}
                onChange={(event) => setValues((prev) => ({ ...prev, email: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition-all focus:ring-2 focus:border-transparent placeholder:text-slate-400"
                style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
          )}
          <button
            type="submit"
            disabled={submitting || !canSubmit}
            className="inline-flex h-10 w-full items-center justify-center rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: primaryColor }}
          >
            {submitting ? 'Starting...' : submitLabel}
          </button>
          <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
            <Shield className="h-3 w-3" />
            Your information is private and secure
          </div>
        </form>
      </div>
    )
  }

  return (
    <form
      className="flex flex-col items-center justify-center h-full px-6 py-4"
      onSubmit={async (event) => {
        event.preventDefault()
        if (!canSubmit) return
        await onSubmit(values)
      }}
    >
      {/* Bot avatar */}
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center shadow-md mb-4"
        style={{ backgroundColor: primaryColor }}
      >
        <BotAvatar size={30} color={primaryColor} />
      </div>

      {/* Greeting */}
      <p className="text-sm text-slate-600 text-center leading-relaxed mb-5">
        Before we start chatting, please share a few details so we can help you best.
      </p>

      {/* Inputs — underline style, single column */}
      <div className="w-full max-w-xs flex flex-col gap-4">
        {visibleFields.includes('name') && (
          <div className="relative">
            <User className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={values.name}
              onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full border-0 border-b-2 border-slate-200 bg-transparent py-3 pl-7 pr-0 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-b-2"
              style={{ borderBottomColor: undefined, '--tw-border-opacity': 1 } as React.CSSProperties}
              onFocus={(e) => { e.currentTarget.style.borderBottomColor = primaryColor }}
              onBlur={(e) => { e.currentTarget.style.borderBottomColor = '' }}
              placeholder="Your name"
              autoComplete="name"
            />
          </div>
        )}

        {visibleFields.includes('phone') && (
          <div className="relative">
            <Phone className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="tel"
              value={values.phone}
              onChange={(event) => setValues((prev) => ({ ...prev, phone: event.target.value }))}
              className="w-full border-0 border-b-2 border-slate-200 bg-transparent py-3 pl-7 pr-0 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-b-2"
              onFocus={(e) => { e.currentTarget.style.borderBottomColor = primaryColor }}
              onBlur={(e) => { e.currentTarget.style.borderBottomColor = '' }}
              placeholder="Phone number"
              autoComplete="tel"
              required
            />
          </div>
        )}

        {visibleFields.includes('email') && (
          <div className="relative">
            <Mail className="absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              value={values.email}
              onChange={(event) => setValues((prev) => ({ ...prev, email: event.target.value }))}
              className="w-full border-0 border-b-2 border-slate-200 bg-transparent py-3 pl-7 pr-0 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-b-2"
              onFocus={(e) => { e.currentTarget.style.borderBottomColor = primaryColor }}
              onBlur={(e) => { e.currentTarget.style.borderBottomColor = '' }}
              placeholder="Email address"
              autoComplete="email"
              required
            />
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting || !canSubmit}
        className="mt-6 w-full max-w-xs h-10 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ backgroundColor: primaryColor }}
      >
        {submitting ? 'Starting...' : submitLabel}
      </button>

      {/* Privacy */}
      <div className="flex items-center justify-center gap-1 mt-3 text-[11px] text-slate-400">
        <Shield className="h-3 w-3" />
        Your information is private and secure
      </div>
    </form>
  )
}

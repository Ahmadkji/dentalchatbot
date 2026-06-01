'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { toast } from 'sonner'
import { AlertCircle, ArrowRight, Mail, User, Globe } from 'lucide-react'
import { COMMON_TIMEZONES, formatTimezoneLabel } from '@/lib/timezones'
import type { AccountProfileRow } from '@/lib/account-profile-types'

interface ProfileResponse extends AccountProfileRow {}

const emptyProfile: ProfileResponse = {
  id: '',
  email: '',
  full_name: null,
  timezone: 'UTC',
  onboarding_completed: false,
  default_clinic_id: null,
  created_at: undefined,
  updated_at: undefined,
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileResponse>(emptyProfile)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    full_name: '',
    timezone: 'UTC',
  })

  useEffect(() => {
    let active = true

    async function loadProfile() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/profile', { cache: 'no-store' })
        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load profile')
        }

        if (!active) return

        const nextProfile = data as ProfileResponse
        setProfile(nextProfile)
        setForm({
          full_name: nextProfile.full_name ?? '',
          timezone: nextProfile.timezone || 'UTC',
        })
      } catch (fetchError) {
        if (!active) return
        const message = fetchError instanceof Error ? fetchError.message : 'Failed to load profile'
        setError(message)
        toast.error(message)
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadProfile()

    return () => {
      active = false
    }
  }, [])

  const timezoneOptions = useMemo(() => COMMON_TIMEZONES.map((timezone) => ({ value: timezone, label: formatTimezoneLabel(timezone) })), [])

  const isComplete = Boolean(profile.onboarding_completed && profile.default_clinic_id)

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name,
          timezone: form.timezone,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile')
      }

      const nextProfile = data as ProfileResponse
      setProfile(nextProfile)
      setForm({
        full_name: nextProfile.full_name ?? '',
        timezone: nextProfile.timezone || 'UTC',
      })
      toast.success('Profile updated')
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to update profile'
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">My Profile</h2>
          <p className="text-sm text-muted-foreground">
            View and edit your personal account details. Clinic setup lives in Bot Setup.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
            <Link href="/dashboard/bot-setup">
              Clinic profile
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load profile</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
        <form onSubmit={handleSave} className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold tracking-tight">Account details</h3>
              <p className="text-xs text-muted-foreground">These details belong to your signed-in account.</p>
            </div>
            <Badge variant={isComplete ? 'default' : 'outline'} className={isComplete ? 'bg-emerald-600 text-white' : ''}>
              {isComplete ? 'Workspace ready' : 'Workspace incomplete'}
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="size-4" />
                Email
              </Label>
              {loading ? (
                <Skeleton className="h-11 w-full rounded-md" />
              ) : (
                <Input id="email" value={profile.email} disabled className="h-11 bg-slate-50" />
              )}
              <p className="text-xs text-muted-foreground">
                Your email is managed by sign-in and password reset.
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="full_name" className="flex items-center gap-2">
                <User className="size-4" />
                Full name
              </Label>
              {loading ? (
                <Skeleton className="h-11 w-full rounded-md" />
              ) : (
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
                  placeholder="Dr. Sarah Ahmed"
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  disabled={saving}
                  className="h-11"
                />
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label className="flex items-center gap-2">
                <Globe className="size-4" />
                Timezone
              </Label>
              {loading ? (
                <Skeleton className="h-11 w-full rounded-md" />
              ) : (
                <Select
                  value={form.timezone}
                  onValueChange={(value) => setForm((current) => ({ ...current, timezone: value }))}
                  disabled={saving}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select your timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {timezoneOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">
                Used for onboarding messages, dashboard timestamps, and reminders.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={loading || saving}>
              {saving ? 'Saving...' : 'Save profile'}
            </Button>
          </div>
        </form>

        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold tracking-tight">Status</h3>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Onboarding</span>
                {loading ? <Skeleton className="h-5 w-24" /> : (
                  <Badge variant={profile.onboarding_completed ? 'default' : 'outline'} className={profile.onboarding_completed ? 'bg-emerald-600 text-white' : ''}>
                    {profile.onboarding_completed ? 'Complete' : 'Incomplete'}
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Default workspace</span>
                {loading ? <Skeleton className="h-5 w-28" /> : (
                  <span className="text-sm font-medium">
                    {profile.default_clinic_id ? 'Connected' : 'Not linked'}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Last updated</span>
                {loading ? <Skeleton className="h-5 w-28" /> : (
                  <span className="text-sm font-medium">
                    {profile.updated_at ? new Date(profile.updated_at).toLocaleString() : '—'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <h3 className="text-sm font-semibold tracking-tight">Quick actions</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Use this link when you want to change the clinic workspace details.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Button asChild variant="outline" className="justify-start bg-white">
                <Link href="/dashboard/bot-setup">Open clinic profile</Link>
              </Button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

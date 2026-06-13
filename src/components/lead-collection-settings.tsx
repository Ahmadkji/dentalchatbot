'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'
import { parseEmailList } from '@/lib/email-list'
import { Settings, Mail, Trash2, Bell, ListChecks } from 'lucide-react'
import {
  LEAD_REQUIRED_FIELD_PRESETS,
  parseLeadRequiredFieldsSettingValue,
  serializeLeadRequiredFields,
  type LeadGateField,
} from '@/lib/leads/lead-gate-settings'

const defaultSettings: Record<string, string> = {
  collection_enabled: 'true',
  notifications_enabled: 'true',
  notification_emails: '',
  required_fields: serializeLeadRequiredFields(['name', 'email', 'phone']),
}

function getPresetLabel(fields: LeadGateField[]) {
  if (fields.length === 2 && fields.includes('email')) return 'Name + Email'
  if (fields.length === 2 && fields.includes('phone')) return 'Name + Phone'
  return 'Name + Email + Phone'
}

function getPresetDescription(fields: LeadGateField[]) {
  if (fields.length === 2 && fields.includes('email')) {
    return 'Best when you want a lighter pre-chat form and email follow-up.'
  }

  if (fields.length === 2 && fields.includes('phone')) {
    return 'Best when you want faster call or text follow-up.'
  }

  return 'Best when you want both phone and email before the visitor can chat.'
}

function getSelectedPresetValue(settings: Record<string, string>) {
  return serializeLeadRequiredFields(
    parseLeadRequiredFieldsSettingValue(settings.required_fields),
  )
}



export default function LeadCollectionSettings() {
  const [settings, setSettings] = useState<Record<string, string>>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const settingsRef = useRef(settings)

  // Track whether the first successful load has completed.
  // Used to keep existing data visible during background re-fetches
  // (tab focus, post-mutation refresh) instead of flashing skeletons.
  const hasLoadedRef = useRef(false)

  const fetchData = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true)
    try {
      const res = await fetch('/api/lead-settings')
      if (!res.ok) throw new Error('Failed to load lead settings')
      const data = await res.json()
      setSettings((prev) => {
        const merged = { ...prev, ...data.settings }
        settingsRef.current = merged
        return merged
      })
      hasLoadedRef.current = true
    } catch (error) {
      console.error('[LeadCollectionSettings] Failed to fetch lead settings', {
        error: error instanceof Error ? error.message : String(error),
      })
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [fetchData])

  // Re-fetch lead settings when user switches back to this tab/page.
  // Replicates SWR's revalidateOnFocus / TanStack Query's refetchOnWindowFocus.
  useRefetchOnFocus(fetchData)

  const saveSettings = useCallback(async (settingsToSave?: Record<string, string>) => {
    const data = settingsToSave || settingsRef.current
    setSaving(true)
    try {
      const res = await fetch('/api/lead-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: data }),
      })
      if (res.ok) {
        toast.success('Settings saved')
      } else {
        console.error('[LeadCollectionSettings] API returned non-OK', {
          status: res.status,
        })
        toast.error('Failed to save settings')
      }
    } catch (error) {
      console.error('[LeadCollectionSettings] Network error', {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setSaving(false)
    }
  }, [])

  const toggleSetting = useCallback(
    (key: string) => {
      const updated = {
        ...settingsRef.current,
        [key]: settingsRef.current[key] === 'true' ? 'false' : 'true',
      }
      setSettings(updated)
      settingsRef.current = updated
      void saveSettings(updated)
    },
    [saveSettings]
  )

  const addNotificationEmail = useCallback(() => {
    const email = newEmail.trim()
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }
    const current = parseEmailList(settingsRef.current.notification_emails)
    if (current.includes(email)) {
      toast.error('Email already added')
      return
    }
    const updated = {
      ...settingsRef.current,
      notification_emails: [...current, email].join(', '),
    }
    setSettings(updated)
    settingsRef.current = updated
    setNewEmail('')
    void saveSettings(updated)
  }, [newEmail, saveSettings])

  const removeNotificationEmail = useCallback(
    (email: string) => {
      const current = parseEmailList(settingsRef.current.notification_emails)
      const updated = {
        ...settingsRef.current,
        notification_emails: current.filter((e) => e !== email).join(', '),
      }
      setSettings(updated)
      settingsRef.current = updated
      void saveSettings(updated)
    },
    [saveSettings]
  )

  if (loading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-md border p-6 space-y-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-72" />
            <div className="space-y-2 mt-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const emails = parseEmailList(settings.notification_emails)
  const selectedPresetValue = getSelectedPresetValue(settings)

  return (
    <div className="space-y-6">
      {/* Page Description */}
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Lead Collection Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure how your chatbot collects visitor information and generates leads for your business.
        </p>
      </div>

      {/* Section 1: Enable Lead Collection */}
      <div className="rounded-md border">
        <div className="flex items-center gap-3 border-b px-4 py-3 bg-slate-50/80">
          <div className="flex size-8 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
            <Settings className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Lead Collection Options</h3>
            <p className="text-xs text-muted-foreground">Toggle to enable or disable lead collection functionality</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Label htmlFor="enable-lead-collection" className="text-xs font-medium">
              Enable Lead Collection
            </Label>
            <Switch
              id="enable-lead-collection"
              checked={settings.collection_enabled === 'true'}
              onCheckedChange={() => toggleSetting('collection_enabled')}
            />
          </div>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Allow the AI to collect visitor contact information when appropriate
          </p>
        </div>
      </div>

      {/* Lead intake summary */}
      <div className="rounded-md border">
        <div className="flex items-center gap-3 border-b px-4 py-3 bg-slate-50/80">
          <div className="flex size-8 items-center justify-center rounded-md bg-blue-100 text-blue-700">
            <ListChecks className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Lead Intake Fields</h3>
            <p className="text-xs text-muted-foreground">
              Choose which required fields the visitor must complete before the chat starts.
            </p>
          </div>
        </div>
        <div className="p-4">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="w-[220px]">Preset</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[140px] text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {LEAD_REQUIRED_FIELD_PRESETS.map((preset) => {
                const presetValue = serializeLeadRequiredFields(preset)
                const isSelected = selectedPresetValue === presetValue

                return (
                  <TableRow key={presetValue}>
                    <TableCell>
                      <div className="font-medium text-sm">{getPresetLabel(preset)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Required: {preset.join(', ')}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {getPresetDescription(preset)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        type="button"
                        size="sm"
                        variant={isSelected ? 'default' : 'outline'}
                        disabled={saving}
                        onClick={() => {
                          const updated = {
                            ...settingsRef.current,
                            required_fields: presetValue,
                          }
                          setSettings(updated)
                          settingsRef.current = updated
                          void saveSettings(updated)
                        }}
                      >
                        {isSelected ? 'Selected' : 'Use this'}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Name always stays required. You can require email only, phone only, or both before the visitor can chat.
          </p>
        </div>
      </div>

      {/* Section 7: Lead Capture Email Notifications - Table for emails */}
      <div className="rounded-md border">
        <div className="flex items-center gap-3 border-b px-4 py-3 bg-slate-50/80">
          <div className="flex size-8 items-center justify-center rounded-md bg-rose-100 text-rose-700">
            <Bell className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Lead Capture Email Notifications</h3>
            <p className="text-xs text-muted-foreground">Configure who gets notified when new leads or human handoffs are captured</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Label htmlFor="enable-notifications" className="text-xs font-medium">
              Enable Lead Notifications
            </Label>
            <Switch
              id="enable-notifications"
              checked={settings.notifications_enabled === 'true'}
              onCheckedChange={() => toggleSetting('notifications_enabled')}
            />
          </div>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-muted-foreground mb-3">
            Send email notifications when new leads are captured and when human handoff requests are created
          </p>
        </div>
        {settings.notifications_enabled === 'true' && (
          <>
            <div className="px-4 pb-2">
              <Label className="text-xs font-medium text-muted-foreground">Email Recipients</Label>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead>Email Address</TableHead>
                  <TableHead className="w-[100px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emails.length > 0 ? (
                  emails.map((email) => (
                    <TableRow key={email}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="size-3.5 text-muted-foreground" />
                          <span className="text-sm">{email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => removeNotificationEmail(email)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-sm text-muted-foreground py-6">
                      No email recipients configured. Add one below.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground mb-2">
                List of email addresses to notify when new leads are captured or the chatbot escalates to a human.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter email address for lead notifications"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addNotificationEmail()
                  }}
                  className="h-8 text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={addNotificationEmail}
                >
                  Add
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Save Button */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t py-3 px-1 flex justify-end">
        <Button
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={() => void saveSettings()}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}

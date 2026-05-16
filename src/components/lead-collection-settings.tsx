'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
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
import { Settings, Mail, Trash2, Info, Bell, Zap, FileText, ListChecks, UserCheck } from 'lucide-react'



const defaultSettings: Record<string, string> = {
  collection_enabled: 'true',
  collect_email: 'true',
  collect_name: 'true',
  collect_phone: 'true',
  trigger_mode: 'interest',
  trigger_message_count: '1',
  trigger_keywords: 'pricing, demo, consultation, quote, appointment, contact, schedule, buy, purchase',
  notifications_enabled: 'true',
  notification_emails: '',
  auto_escalation: 'false',
}

function parseEmails(emailsStr: string): string[] {
  return emailsStr
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e.length > 0)
}



export default function LeadCollectionSettings() {
  const [settings, setSettings] = useState<Record<string, string>>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [newEmail, setNewEmail] = useState('')
  const settingsRef = useRef(settings)

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    let cancelled = false

    const loadSettings = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/lead-settings')
        if (!cancelled && res.ok) {
          const data = await res.json()
          setSettings((prev) => ({ ...prev, ...data.settings }))
        }

        await fetch('/api/lead-settings/custom-fields')
      } catch {
        if (!cancelled) {
          toast.error('Failed to load settings')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSettings()

    return () => {
      cancelled = true
    }
  }, [])

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
        toast.error('Failed to save settings')
      }
    } catch {
      toast.error('Failed to save settings')
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

  const updateSetting = useCallback(
    (key: string, value: string) => {
      const updated = { ...settingsRef.current, [key]: value }
      setSettings(updated)
      settingsRef.current = updated
    },
    []
  )


  const addNotificationEmail = useCallback(() => {
    const email = newEmail.trim()
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }
    const current = parseEmails(settingsRef.current.notification_emails)
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
      const current = parseEmails(settingsRef.current.notification_emails)
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

  const emails = parseEmails(settings.notification_emails)

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

      {/* Section 2: Basic Contact Fields - Table */}
      <div className="rounded-md border">
        <div className="flex items-center gap-3 border-b px-4 py-3 bg-slate-50/80">
          <div className="flex size-8 items-center justify-center rounded-md bg-blue-100 text-blue-700">
            <ListChecks className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Basic Contact Fields</h3>
            <p className="text-xs text-muted-foreground">Choose which basic contact information fields to collect from visitors</p>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
              <TableHead className="w-[200px]">Field</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[120px] text-center">Enabled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Mail className="size-3.5 text-muted-foreground" />
                  <span className="font-medium text-sm">Email Address</span>
                </div>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                Always required for lead identification and follow-up
              </TableCell>
              <TableCell className="text-center">
                <Badge variant="secondary" className="text-[10px]">Always On</Badge>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                <span className="font-medium text-sm">Name</span>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                Collect visitor&apos;s full name for personalized communication
              </TableCell>
              <TableCell className="text-center">
                <Switch
                  checked={settings.collect_name === 'true'}
                  onCheckedChange={() => toggleSetting('collect_name')}
                />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                <span className="font-medium text-sm">Phone Number</span>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                Collect phone number for direct contact and appointment scheduling
              </TableCell>
              <TableCell className="text-center">
                <Switch
                  checked={settings.collect_phone === 'true'}
                  onCheckedChange={() => toggleSetting('collect_phone')}
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Section 3: When to Collect Leads */}
      <div className="rounded-md border">
        <div className="flex items-center gap-3 border-b px-4 py-3 bg-slate-50/80">
          <div className="flex size-8 items-center justify-center rounded-md bg-purple-100 text-purple-700">
            <Zap className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">When to Collect Leads</h3>
            <p className="text-xs text-muted-foreground">Choose the trigger for lead collection</p>
          </div>
        </div>
        <div className="p-4">
          <RadioGroup
            value={settings.trigger_mode}
            onValueChange={(v) => {
              const updated = { ...settingsRef.current, trigger_mode: v }
              setSettings(updated)
              settingsRef.current = updated
              void saveSettings(updated)
            }}
            className="space-y-3"
          >
            <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-slate-50/80 transition-colors">
              <RadioGroupItem value="interest" id="trigger-interest" className="mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="trigger-interest" className="text-sm font-medium cursor-pointer">
                    When user shows interest
                  </Label>
                  <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700">
                    Recommended
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  AI detects buying signals and collects info naturally
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-slate-50/80 transition-colors">
              <RadioGroupItem value="unable_to_answer" id="trigger-unable" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="trigger-unable" className="text-sm font-medium cursor-pointer">
                  When unable to answer
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Collect contact info when the bot cannot resolve the visitor&apos;s question
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-slate-50/80 transition-colors">
              <RadioGroupItem value="after_messages" id="trigger-after" className="mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="trigger-after" className="text-sm font-medium cursor-pointer">
                    After
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    max="99"
                    className="w-16 h-7 text-center text-sm"
                    value={settings.trigger_message_count}
                    onChange={(e) => {
                      const updated = { ...settingsRef.current, trigger_message_count: e.target.value }
                      setSettings(updated)
                      settingsRef.current = updated
                    }}
                    disabled={settings.trigger_mode !== 'after_messages'}
                  />
                  <Label className="text-sm font-medium">messages (static form)</Label>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Show a lead collection form after a set number of messages
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>
      </div>

      {/* Section 4: Custom Trigger Keywords */}
      <div className="rounded-md border">
        <div className="flex items-center gap-3 border-b px-4 py-3 bg-slate-50/80">
          <div className="flex size-8 items-center justify-center rounded-md bg-amber-100 text-amber-700">
            <FileText className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Custom Trigger Keywords</h3>
            <p className="text-xs text-muted-foreground">Define specific keywords that trigger lead collection</p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {settings.trigger_mode === 'after_messages' && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 text-xs">
              <Info className="size-4 shrink-0" />
              <span>Not used with &quot;After X messages&quot; - form shows automatically</span>
            </div>
          )}
          <Textarea
            placeholder="Enter keywords separated by commas..."
            value={settings.trigger_keywords}
            onChange={(e) => updateSetting('trigger_keywords', e.target.value)}
            onBlur={() => void saveSettings()}
            disabled={settings.trigger_mode === 'after_messages'}
            rows={3}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            When visitors mention these words, the AI will attempt to collect their contact information.
          </p>
        </div>
      </div>

      {/* Section 6: Auto-Escalation */}
      <div className="rounded-md border">
        <div className="flex items-center gap-3 border-b px-4 py-3 bg-slate-50/80">
          <div className="flex size-8 items-center justify-center rounded-md bg-orange-100 text-orange-700">
            <UserCheck className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Auto-Escalation</h3>
            <p className="text-xs text-muted-foreground">Automatically hand off conversations to a human agent when a lead is captured</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Label htmlFor="enable-auto-escalation" className="text-xs font-medium">
              Auto-escalate on lead capture
            </Label>
            <Switch
              id="enable-auto-escalation"
              checked={settings.auto_escalation === 'true'}
              onCheckedChange={() => toggleSetting('auto_escalation')}
            />
          </div>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-muted-foreground">
            When enabled, the conversation will automatically be escalated to a human agent after a lead submits their contact information.
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
            <p className="text-xs text-muted-foreground">Configure who gets notified when new leads are captured</p>
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
            Send email notifications when new leads are captured
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
                List of email addresses to notify when new leads are captured. If no emails are provided, notifications will be sent to default recipients.
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

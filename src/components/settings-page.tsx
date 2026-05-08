'use client'

import React, { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Check, X, Pencil } from 'lucide-react'

interface Setting {
  id: string
  key: string
  value: string
  category: string
  description: string | null
  updatedAt: string
}

// Map setting keys to human-readable labels
const settingLabels: Record<string, string> = {
  clinic_name: 'Clinic Name',
  clinic_hours: 'Working Hours',
  clinic_phone: 'Clinic Phone',
  appointment_buffer: 'Buffer Between Appointments (min)',
  max_advance_booking: 'Max Advance Booking (days)',
  cancellation_policy: 'Cancellation Policy',
  greeting_message: 'Greeting Message',
  closing_message: 'Closing Message',
  emergency_response: 'Emergency Response',
  ai_personality: 'AI Personality',
  bot_name: 'Bot Name',
  welcome_message: 'Welcome Message',
  working_hours: 'Working Hours',
  slot_duration: 'Slot Duration (min)',
  max_daily_appointments: 'Max Daily Appointments',
  auto_reply: 'Auto-Reply',
  after_hours_message: 'After-Hours Message',
  faq_enabled: 'FAQ Bot',
}

// Determine which settings are boolean type
const booleanSettings = new Set(['auto_reply', 'faq_enabled'])

function EditableCell({
  value,
  settingKey,
  onSave,
}: {
  value: string
  settingKey: string
  onSave: (val: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)

  useEffect(() => {
    setEditValue(value)
  }, [value])

  if (booleanSettings.has(settingKey)) {
    const checked = value === 'true' || value === '1'
    return (
      <div className="flex items-center gap-2">
        <Switch
          checked={checked}
          onCheckedChange={(checked) => {
            const newVal = String(checked)
            setEditValue(newVal)
            onSave(newVal)
          }}
        />
        <span className="text-xs text-muted-foreground">
          {checked ? 'Enabled' : 'Disabled'}
        </span>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSave(editValue)
              setEditing(false)
            }
            if (e.key === 'Escape') {
              setEditValue(value)
              setEditing(false)
            }
          }}
          onBlur={() => {
            onSave(editValue)
            setEditing(false)
          }}
          className="h-7 text-sm"
          autoFocus
        />
        <button
          onClick={() => {
            onSave(editValue)
            setEditing(false)
          }}
          className="p-0.5 text-emerald-600 hover:text-emerald-700"
        >
          <Check className="size-3.5" />
        </button>
        <button
          onClick={() => {
            setEditValue(value)
            setEditing(false)
          }}
          className="p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-1.5 cursor-pointer group"
      onClick={() => setEditing(true)}
    >
      <span className="text-sm truncate max-w-[280px]">{value || '—'}</span>
      <Pencil className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </div>
  )
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSettings() {
      setLoading(true)
      try {
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data = await res.json()
          if (data.settings && data.settings.length > 0) {
            setSettings(data.settings)
          }
        }
      } catch {
        // Will show empty state
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const updateSetting = async (settingId: string, settingKey: string, newValue: string) => {
    // Optimistic update
    setSettings((prev) =>
      prev.map((s) =>
        s.id === settingId
          ? { ...s, value: newValue, updatedAt: new Date().toISOString() }
          : s
      )
    )

    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: settingId, key: settingKey, value: newValue }),
      })
      if (res.ok) {
        toast.success('Setting updated')
      } else {
        toast.error('Failed to save setting')
      }
    } catch {
      toast.error('Failed to save setting')
    }
  }

  // Category display order
  const categoryOrder = ['general', 'scheduling', 'responses']
  const categories = [...new Set(settings.map((s) => s.category))].sort(
    (a, b) => {
      const ai = categoryOrder.indexOf(a)
      const bi = categoryOrder.indexOf(b)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    }
  )

  if (loading) {
    return (
      <div className="space-y-6">
        {['General', 'Scheduling', 'Responses'].map((cat) => (
          <section key={cat}>
            <Skeleton className="h-5 w-24 mb-3" />
            <div className="rounded-md border">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3 border-b last:border-0">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-32 ml-auto" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {categories.map((category) => {
        const categorySettings = settings.filter((s) => s.category === category)
        return (
          <section key={category}>
            <h2 className="text-sm font-medium text-muted-foreground mb-3 capitalize">{category}</h2>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Setting</TableHead>
                    <TableHead className="hidden md:table-cell">Description</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead className="hidden lg:table-cell w-[140px]">Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categorySettings.map((setting) => (
                    <TableRow key={setting.id}>
                      <TableCell className="font-medium text-sm">
                        {settingLabels[setting.key] || setting.key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                        {setting.description || '—'}
                      </TableCell>
                      <TableCell>
                        <EditableCell
                          value={setting.value}
                          settingKey={setting.key}
                          onSave={(val) => updateSetting(setting.id, setting.key, val)}
                        />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                        {setting.updatedAt
                          ? new Date(setting.updatedAt).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        )
      })}
    </div>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Check, Pencil, X } from 'lucide-react'

interface Setting {
  id: string
  key: string
  value: string
  category: string
  description: string | null
}

const labels: Record<string, string> = {
  ai_personality: 'AI Personality',
  after_hours_message: 'After-Hours Message',
  auto_reply: 'Auto Reply',
  faq_enabled: 'FAQ Mode',
  appointment_buffer: 'Appointment Buffer',
  max_advance_booking: 'Max Advance Booking',
  cancellation_policy: 'Cancellation Policy',
  slot_duration: 'Slot Duration',
  greeting_message: 'Greeting Message',
  closing_message: 'Closing Message',
  emergency_response: 'Emergency Response',
  parking_info: 'Parking Info',
  google_maps_url: 'Maps URL',
  lead_collection_enabled: 'Lead Collection',
  lead_collect_email: 'Collect Email',
  lead_collect_name: 'Collect Name',
  lead_collect_phone: 'Collect Phone',
  lead_trigger_mode: 'Trigger Mode',
  lead_trigger_message_count: 'Trigger Message Count',
  lead_trigger_keywords: 'Trigger Keywords',
  lead_notifications_enabled: 'Lead Notifications',
  lead_notification_emails: 'Notification Emails',
}

// Settings managed in other pages — hide from this view
const hiddenKeys = new Set([
  'clinic_name',
  'clinic_address',
  'clinic_phone',
  'clinic_hours',
  'whatsapp_number',
  'emergency_phone',
  'bot_name',
  'bot_welcome_message',
  'bot_primary_color',
  'bot_disabled_fields',
  'lead_collection_enabled',
  'lead_collect_email',
  'lead_collect_name',
  'lead_collect_phone',
  'lead_notification_emails',
  'lead_trigger_keywords',
  'lead_trigger_mode',
  'lead_trigger_message_count',
  'lead_notifications_enabled',
])

const longFields = new Set([
  'parking_info',
  'after_hours_message',
  'cancellation_policy',
  'greeting_message',
  'closing_message',
  'emergency_response',
  'lead_trigger_keywords',
])

const booleanKeys = new Set([
  'lead_collection_enabled',
  'lead_collect_email',
  'lead_collect_name',
  'lead_collect_phone',
  'lead_notifications_enabled',
  'auto_reply',
  'faq_enabled',
])

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('all')
  const [editing, setEditing] = useState<Setting | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [inlineKey, setInlineKey] = useState<string | null>(null)
  const [inlineValue, setInlineValue] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/settings')
        if (!res.ok) throw new Error('Failed to load settings')
        const data = await res.json()
        setSettings(data.settings || [])
      } catch {
        toast.error('Failed to load settings')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const filtered = useMemo(() => {
    const base = category === 'all' ? settings : settings.filter((setting) => setting.category === category)
    return base.filter((setting) => !hiddenKeys.has(setting.key))
  }, [category, settings])

  const categories = useMemo(() => {
    const visible = settings.filter((setting) => !hiddenKeys.has(setting.key))
    return Array.from(new Set(visible.map((setting) => setting.category))).sort()
  }, [settings])

  const patchSetting = useCallback(async (key: string, value: string) => {
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })
    if (!res.ok) throw new Error('Failed to update')
    return (await res.json()) as Setting
  }, [])

  const isBool = (s: Setting) => booleanKeys.has(s.key) || s.value === 'true' || s.value === 'false'

  const handleToggle = async (setting: Setting) => {
    const next = setting.value === 'true' ? 'false' : 'true'
    try {
      const updated = await patchSetting(setting.key, next)
      setSettings((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      toast.success(`${labels[setting.key] || setting.key} ${next === 'true' ? 'enabled' : 'disabled'}`)
    } catch {
      toast.error('Failed to update setting')
    }
  }

  const startInline = (setting: Setting) => {
    setInlineKey(setting.key)
    setInlineValue(setting.value)
  }

  const saveInline = async () => {
    if (!inlineKey) return
    try {
      const updated = await patchSetting(inlineKey, inlineValue)
      setSettings((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setInlineKey(null)
      toast.success('Setting updated')
    } catch {
      toast.error('Failed to update setting')
    }
  }

  const cancelInline = () => {
    setInlineKey(null)
    setInlineValue('')
  }

  const openEditor = (setting: Setting) => {
    setEditing(setting)
    setEditValue(setting.value)
  }

  const save = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const updated = await patchSetting(editing.key, editValue)
      setSettings((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setEditing(null)
      toast.success('Setting updated')
    } catch {
      toast.error('Failed to update setting')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure AI personality, response behavior, scheduling rules, and safety automation.
          Clinic details are managed in Bot Setup. Widget appearance is managed in Widget & Install.
        </p>
      </div>

      <Tabs value={category} onValueChange={setCategory}>
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="all">All</TabsTrigger>
          {categories.map((value) => (
            <TabsTrigger key={value} value={value} className="capitalize">
              {value}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="rounded-md border bg-white">
        <Table className="min-w-[600px] sm:min-w-[700px]">
          <TableHeader>
            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
              <TableHead className="w-[180px] sm:w-[230px]">Setting</TableHead>
              <TableHead className="w-[80px] text-center">Toggle</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="hidden sm:table-cell w-[130px]">Category</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-10 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                </TableRow>
              ))
            ) : filtered.length > 0 ? (
              filtered.map((setting) => {
                const bool = isBool(setting)
                const editingThis = inlineKey === setting.key
                const isLong = longFields.has(setting.key)

                return (
                  <TableRow key={setting.id} className={editingThis ? 'bg-emerald-50/40' : undefined}>
                    <TableCell>
                      <div className="font-medium">{labels[setting.key] || setting.key}</div>
                      <div className="text-xs text-muted-foreground leading-snug">{setting.description || setting.key}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      {bool ? (
                        <Switch
                          checked={setting.value === 'true'}
                          onCheckedChange={() => void handleToggle(setting)}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {bool ? (
                        <span className={`text-sm font-medium ${setting.value === 'true' ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                          {setting.value === 'true' ? 'Enabled' : 'Disabled'}
                        </span>
                      ) : editingThis ? (
                        <div className="flex items-center gap-1 max-w-xs">
                          <Input
                            className="h-7 text-sm"
                            value={inlineValue}
                            onChange={(e) => setInlineValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void saveInline()
                              if (e.key === 'Escape') cancelInline()
                            }}
                            autoFocus
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 shrink-0 text-emerald-600 hover:text-emerald-700"
                            onClick={() => void saveInline()}
                          >
                            <Check className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={cancelInline}
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      ) : isLong ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground line-clamp-1 flex-1 whitespace-pre-wrap">
                            {setting.value || '—'}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs text-emerald-600 hover:text-emerald-700 shrink-0"
                            onClick={() => openEditor(setting)}
                          >
                            <Pencil className="size-3" />
                            Edit
                          </Button>
                        </div>
                      ) : (
                        <span
                          className="text-sm text-muted-foreground cursor-pointer hover:text-foreground hover:underline underline-offset-2 decoration-dashed underline-muted-foreground/50 transition-colors"
                          onClick={() => startInline(setting)}
                          title="Click to edit"
                        >
                          {setting.value || '—'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className="capitalize">{setting.category}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No settings in this category
                </TableCell>
              </TableRow>
            )}
          </TableBody>
      </Table>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? labels[editing.key] || editing.key : 'Edit setting'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Value</Label>
            {editing && longFields.has(editing.key) ? (
              <Textarea rows={6} value={editValue} onChange={(event) => setEditValue(event.target.value)} />
            ) : (
              <Input value={editValue} onChange={(event) => setEditValue(event.target.value)} />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={save} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

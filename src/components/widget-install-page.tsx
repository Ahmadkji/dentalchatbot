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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Pencil, Plus, Trash2, ExternalLink, MessageCircle, X } from 'lucide-react'
import { toast } from 'sonner'

interface WidgetSettings {
  botName: string
  welcomeMessage: string
  tooltipText: string
  showTooltip: boolean
  inputPlaceholder: string
  primaryColor: string
  textOnPrimary: string
  widgetPosition: 'bottom-right' | 'bottom-left'
  widgetSize: 'compact' | 'comfortable' | 'large'
  autoOpenDelay: 'off' | '5s' | '10s'
  ctaText: string
  ctaLink: string
  embedCode: string
}

interface QuickPrompt {
  id: string
  label: string
  message: string
  actionType: 'message' | 'appointment' | 'link'
  actionValue: string | null
  sortOrder: number
  isActive: boolean
}

interface WidgetTemplate {
  id: string
  label: string
  primaryColor: string
  textOnPrimary: string
}

const longFields = new Set(['welcomeMessage', 'tooltipText', 'inputPlaceholder', 'ctaLink'])

const emptyPrompt = {
  label: '',
  message: '',
  actionType: 'message',
  actionValue: '',
  sortOrder: 99,
  isActive: true,
}

export default function WidgetInstallPage() {
  const [settings, setSettings] = useState<WidgetSettings | null>(null)
  const [prompts, setPrompts] = useState<QuickPrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<WidgetTemplate[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [promptDialogOpen, setPromptDialogOpen] = useState(false)
  const [editingField, setEditingField] = useState<keyof WidgetSettings | null>(null)
  const [fieldValue, setFieldValue] = useState<string | boolean>('')
  const [editingPrompt, setEditingPrompt] = useState<QuickPrompt | null>(null)
  const [promptForm, setPromptForm] = useState(emptyPrompt)
  const [clinicId, setClinicId] = useState<string>('')
  const [chatOpen, setChatOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [settingsRes, promptsRes] = await Promise.all([
        fetch('/api/widget-settings'),
        fetch('/api/widget-settings/quick-prompts'),
      ])

      if (!settingsRes.ok || !promptsRes.ok) throw new Error('Failed to fetch widget data')

      const settingsData = await settingsRes.json()
      const promptsData = await promptsRes.json()
      setSettings(settingsData)
      setPrompts(promptsData)

      // Fetch clinic ID for widget preview
      const clinicRes = await fetch('/api/clinic')
      if (clinicRes.ok) {
        const clinicData = await clinicRes.json()
        setClinicId(clinicData.id || '')
      }

      const templatesRes = await fetch('/api/widget-settings/templates')
      if (templatesRes.ok) {
        const templateData = await templatesRes.json()
        setTemplates(templateData.templates || [])
      }
    } catch {
      toast.error('Failed to load widget settings')
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

  const widgetPreviewUrl = useMemo(
    () => {
      const query = clinicId ? `?clinicId=${encodeURIComponent(clinicId)}` : ''
      return `/widget-frame${query}`
    },
    [clinicId]
  )

  const rows = useMemo(
    () => [
      { key: 'botName', label: 'Bot Name' },
      { key: 'welcomeMessage', label: 'Welcome Message' },
      { key: 'tooltipText', label: 'Tooltip Text' },
      { key: 'showTooltip', label: 'Show Tooltip' },
      { key: 'inputPlaceholder', label: 'Input Placeholder' },
      { key: 'primaryColor', label: 'Primary Color' },
      { key: 'textOnPrimary', label: 'Text on Primary' },
      { key: 'widgetPosition', label: 'Widget Position' },
      { key: 'widgetSize', label: 'Widget Size' },
      { key: 'autoOpenDelay', label: 'Auto-open' },
      { key: 'ctaText', label: 'CTA Text' },
      { key: 'ctaLink', label: 'CTA Link' },
    ] as Array<{ key: keyof WidgetSettings; label: string }>,
    []
  )

  const openSettingsEditor = (field: keyof WidgetSettings) => {
    if (!settings) return
    setEditingField(field)
    setFieldValue(settings[field] as string | boolean)
    setSettingsDialogOpen(true)
  }

  const saveSetting = async () => {
    if (!editingField) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/widget-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [editingField]: fieldValue }),
      })
      if (!res.ok) throw new Error('Failed to save')
      const updated = await res.json()
      setSettings((prev) => (prev ? { ...prev, ...updated } : prev))
      setSettingsDialogOpen(false)
      toast.success('Widget setting updated')
    } catch {
      toast.error('Failed to update widget setting')
    } finally {
      setSubmitting(false)
    }
  }

  const openPromptEditor = (prompt?: QuickPrompt) => {
    if (prompt) {
      setEditingPrompt(prompt)
      setPromptForm({
        label: prompt.label,
        message: prompt.message,
        actionType: prompt.actionType,
        actionValue: prompt.actionValue || '',
        sortOrder: prompt.sortOrder,
        isActive: prompt.isActive,
      })
    } else {
      setEditingPrompt(null)
      setPromptForm(emptyPrompt)
    }
    setPromptDialogOpen(true)
  }

  const savePrompt = async () => {
    if (!promptForm.label.trim() || !promptForm.message.trim()) {
      toast.error('Prompt label and message are required')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(
        editingPrompt ? `/api/widget-settings/quick-prompts/${editingPrompt.id}` : '/api/widget-settings/quick-prompts',
        {
          method: editingPrompt ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(promptForm),
        }
      )

      if (!res.ok) throw new Error('Failed to save prompt')
      toast.success(editingPrompt ? 'Quick prompt updated' : 'Quick prompt added')
      setPromptDialogOpen(false)
      setPromptForm(emptyPrompt)
      void fetchData()
    } catch {
      toast.error('Failed to save quick prompt')
    } finally {
      setSubmitting(false)
    }
  }

  const deletePrompt = async (id: string) => {
    try {
      const res = await fetch(`/api/widget-settings/quick-prompts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Quick prompt deleted')
      void fetchData()
    } catch {
      toast.error('Failed to delete quick prompt')
    }
  }

  const resetDentalPrompts = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/widget-settings/quick-prompts/reset-dental', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to reset prompts')
      toast.success('Loaded dental starter prompts')
      void fetchData()
    } catch {
      toast.error('Failed to load dental starter prompts')
    } finally {
      setSubmitting(false)
    }
  }

  const applyTemplate = async (templateId: string) => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/widget-settings/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      })
      if (!res.ok) throw new Error('Failed to apply template')
      toast.success('Widget template applied')
      void fetchData()
    } catch {
      toast.error('Failed to apply template')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Widget & Install</h2>
        <p className="text-sm text-muted-foreground">Customize your website chat widget, deploy embed code, and configure conversion-first quick prompts.</p>
      </div>

      <section className="space-y-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Live Widget Preview</p>
            <p className="text-xs text-muted-foreground">
              Click the chat bubble to preview how visitors will experience your widget.
            </p>
          </div>
          <a
            href={widgetPreviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/50"
          >
            Open Full View
            <ExternalLink className="size-3.5" />
          </a>
        </div>
        <div className="relative overflow-hidden rounded-xl border bg-slate-100 shadow-sm" style={{ height: 560 }}>
          {/* Mock Website Background */}
          <div className="absolute inset-0 overflow-hidden">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 border-b bg-white px-3 py-2">
              <div className="flex gap-1.5">
                <div className="size-2.5 rounded-full bg-red-400" />
                <div className="size-2.5 rounded-full bg-amber-400" />
                <div className="size-2.5 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 rounded-md bg-slate-100 px-3 py-1 text-[11px] text-slate-400 font-mono">
                brightsmileclinic.com
              </div>
            </div>
            {/* Mock website content */}
            <div className="overflow-y-auto p-6" style={{ height: 528 }}>
              <div className="mx-auto max-w-lg space-y-5">
                {/* Nav */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded bg-emerald-600" />
                    <span className="text-sm font-bold text-slate-800">BrightSmile Dental</span>
                  </div>
                  <div className="flex gap-3 text-[10px] text-slate-500">
                    <span>Services</span>
                    <span>About</span>
                    <span>Contact</span>
                  </div>
                </div>
                {/* Hero */}
                <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100 p-5 text-center">
                  <div className="mx-auto mb-2 size-10 rounded-full bg-emerald-200" />
                  <div className="mb-1 h-3 w-48 mx-auto rounded bg-emerald-200/70" />
                  <div className="mb-3 h-2 w-64 mx-auto rounded bg-emerald-100" />
                  <div className="mx-auto h-7 w-28 rounded-md bg-emerald-600" />
                </div>
                {/* Cards row */}
                <div className="grid grid-cols-3 gap-2">
                  {['Teeth Whitening', 'Root Canal', 'Braces'].map((s) => (
                    <div key={s} className="rounded-md border bg-white p-2.5">
                      <div className="mb-1.5 size-6 rounded bg-slate-100" />
                      <div className="h-2 w-full rounded bg-slate-200" />
                      <div className="mt-1 h-1.5 w-3/4 rounded bg-slate-100" />
                    </div>
                  ))}
                </div>
                {/* Text block */}
                <div className="space-y-2">
                  <div className="h-2 w-full rounded bg-slate-200" />
                  <div className="h-2 w-5/6 rounded bg-slate-200" />
                  <div className="h-2 w-4/6 rounded bg-slate-100" />
                </div>
                {/* CTA */}
                <div className="rounded-md border bg-white p-3 text-center">
                  <div className="h-2 w-40 mx-auto rounded bg-slate-200" />
                  <div className="mt-2 h-1.5 w-56 mx-auto rounded bg-slate-100" />
                  <div className="mt-3 mx-auto h-6 w-24 rounded-md bg-slate-200" />
                </div>
                {/* Footer */}
                <div className="flex justify-center gap-4 text-[9px] text-slate-400 pt-2">
                  <span>Privacy</span>
                  <span>Terms</span>
                  <span>Contact</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Widget Popup */}
          {chatOpen && (
            <div
              className="absolute bottom-16 right-4 z-20 flex flex-col overflow-hidden rounded-2xl shadow-2xl border bg-white"
              style={{ width: 376, height: 520 }}
            >
              <iframe
                title="Chat widget preview"
                src={widgetPreviewUrl}
                className="h-full w-full"
                loading="lazy"
              />
            </div>
          )}

          {/* Tooltip */}
          {!chatOpen && settings?.showTooltip && settings.tooltipText && (
            <div className="absolute bottom-[76px] right-20 z-10 max-w-[200px] rounded-lg bg-white px-3 py-2 text-xs text-slate-700 shadow-md border">
              {settings.tooltipText}
            </div>
          )}

          {/* Floating Chat Bubble */}
          <button
            type="button"
            onClick={() => setChatOpen((prev) => !prev)}
            className="absolute bottom-4 right-4 z-30 flex size-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
            style={{ backgroundColor: settings?.primaryColor || '#059669', color: settings?.textOnPrimary || '#FFFFFF' }}
          >
            {chatOpen ? (
              <X className="size-6" />
            ) : (
              <MessageCircle className="size-6" />
            )}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">Install Code</h3>
        </div>
        <Textarea readOnly rows={3} value={settings?.embedCode || ''} className="font-mono text-xs" />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Dental Widget Templates</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => applyTemplate(template.id)}
              className="rounded-lg border bg-white p-3 text-left hover:border-emerald-300"
            >
              <div className="mb-2 h-2 w-full rounded-full" style={{ backgroundColor: template.primaryColor }} />
              <p className="text-sm font-medium">{template.label}</p>
              <p className="text-xs text-muted-foreground">{template.primaryColor}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Widget Settings</h3>
        <div className="rounded-md border bg-white">
          <Table className="min-w-[520px] sm:min-w-[620px]">
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="w-[220px]">Field</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="w-[100px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading || !settings ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell><Skeleton className="ml-auto h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : (
                rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className={longFields.has(row.key) ? 'whitespace-pre-wrap text-sm text-muted-foreground' : 'text-sm text-muted-foreground'}>
                      {typeof settings[row.key] === 'boolean' ? (
                        <Badge variant="outline" className={settings[row.key] ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-600 border-gray-200'}>
                          {settings[row.key] ? 'On' : 'Off'}
                        </Badge>
                      ) : (
                        String(settings[row.key])
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-8" onClick={() => openSettingsEditor(row.key)}>
                        <Pencil className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Quick Prompts</h3>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={resetDentalPrompts} disabled={submitting}>
              Load Dental Starters
            </Button>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto" size="sm" onClick={() => openPromptEditor()}>
              <Plus className="mr-1 size-4" />
              Add Prompt
            </Button>
          </div>
        </div>
        <div className="rounded-md border bg-white">
          <Table className="min-w-[540px] sm:min-w-[700px]">
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead>Prompt</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="ml-auto h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : prompts.map((prompt) => (
                <TableRow key={prompt.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{prompt.label}</div>
                      <div className="text-xs text-muted-foreground">{prompt.message}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm capitalize">{prompt.actionType}</TableCell>
                  <TableCell className="text-sm">{prompt.sortOrder}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={prompt.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-600 border-gray-200'}>
                      {prompt.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openPromptEditor(prompt)}>
                          <Pencil className="mr-2 size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600 focus:text-red-700" onClick={() => deletePrompt(prompt.id)}>
                          <Trash2 className="mr-2 size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {rows.find((row) => row.key === editingField)?.label}</DialogTitle>
          </DialogHeader>
          {typeof fieldValue === 'boolean' ? (
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Enabled</Label>
                <p className="text-sm text-muted-foreground">Turn this widget behavior on or off.</p>
              </div>
              <Switch checked={fieldValue} onCheckedChange={(checked) => setFieldValue(checked)} />
            </div>
          ) : longFields.has(editingField || '') ? (
            <div className="space-y-2">
              <Label>Value</Label>
              <Textarea rows={5} value={String(fieldValue)} onChange={(event) => setFieldValue(event.target.value)} />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Value</Label>
              <Input value={String(fieldValue)} onChange={(event) => setFieldValue(event.target.value)} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={saveSetting} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={promptDialogOpen} onOpenChange={setPromptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPrompt ? 'Edit Quick Prompt' : 'Add Quick Prompt'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input value={promptForm.label} onChange={(event) => setPromptForm((prev) => ({ ...prev, label: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea rows={4} value={promptForm.message} onChange={(event) => setPromptForm((prev) => ({ ...prev, message: event.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Action Type</Label>
                <Input value={promptForm.actionType} onChange={(event) => setPromptForm((prev) => ({ ...prev, actionType: event.target.value as QuickPrompt['actionType'] }))} />
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input value={String(promptForm.sortOrder)} onChange={(event) => setPromptForm((prev) => ({ ...prev, sortOrder: Number(event.target.value) || 99 }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Action Value</Label>
              <Input value={promptForm.actionValue} onChange={(event) => setPromptForm((prev) => ({ ...prev, actionValue: event.target.value }))} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Active</Label>
                <p className="text-sm text-muted-foreground">Inactive prompts stay saved but won&apos;t show in the widget.</p>
              </div>
              <Switch checked={promptForm.isActive} onCheckedChange={(checked) => setPromptForm((prev) => ({ ...prev, isActive: checked }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromptDialogOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={savePrompt} disabled={submitting}>
              {submitting ? 'Saving...' : editingPrompt ? 'Save Changes' : 'Save Prompt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

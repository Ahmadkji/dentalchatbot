'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Bot,
  Check,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
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
  clinicId: string
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

const emptyPrompt: {
  label: string
  message: string
  actionType: QuickPrompt['actionType']
  actionValue: string
  sortOrder: number
  isActive: boolean
} = {
  label: '',
  message: '',
  actionType: 'message',
  actionValue: '',
  sortOrder: 99,
  isActive: true,
}

const actionTypeLabels: Record<QuickPrompt['actionType'], string> = {
  message: 'Send Message',
  appointment: 'Open Appointment Form',
  link: 'Open Link',
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
  const [promptForm, setPromptForm] = useState<typeof emptyPrompt>(emptyPrompt)
  const [copySuccess, setCopySuccess] = useState(false)
  const [previewVersion, setPreviewVersion] = useState(1)

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

      const templatesRes = await fetch('/api/widget-settings/templates')
      if (templatesRes.ok) {
        const templateData = await templatesRes.json()
        setTemplates(templateData.templates || [])
      }
      setPreviewVersion((prev) => prev + 1)
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

  const activePromptCount = prompts.filter((prompt) => prompt.isActive).length

  const previewUrl = settings?.clinicId
    ? `/widget-frame?clinicId=${encodeURIComponent(settings.clinicId)}&preview=${previewVersion}`
    : `/widget-frame?preview=${previewVersion}`

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
      setPreviewVersion((prev) => prev + 1)
      toast.success('Widget setting updated')
    } catch {
      toast.error('Failed to update widget setting')
    } finally {
      setSubmitting(false)
    }
  }

  const copyEmbedCode = async () => {
    if (!settings?.embedCode) return
    try {
      await navigator.clipboard.writeText(settings.embedCode)
      setCopySuccess(true)
      window.setTimeout(() => setCopySuccess(false), 1500)
      toast.success('Embed code copied')
    } catch {
      toast.error('Unable to copy. Please copy manually.')
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

    if (promptForm.actionType === 'link' && !promptForm.actionValue.trim()) {
      toast.error('Link action requires a URL in Action Value')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        ...promptForm,
        actionValue:
          promptForm.actionType === 'link' ? promptForm.actionValue.trim() : promptForm.actionValue || '',
      }

      const res = await fetch(
        editingPrompt
          ? `/api/widget-settings/quick-prompts/${editingPrompt.id}`
          : '/api/widget-settings/quick-prompts',
        {
          method: editingPrompt ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
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
      toast.error('Failed to apply widget template')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-cyan-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-700">
              <Sparkles className="size-3.5" />
              Conversion-Ready Widget Studio
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Widget & Install</h2>
            <p className="max-w-2xl text-sm text-slate-600">
              Customize your chatbot look and behavior, preview it live, and copy a production-ready
              install snippet in one place.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-emerald-200 bg-white text-emerald-700">
              {activePromptCount} active prompts
            </Badge>
            {settings?.primaryColor && (
              <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                Theme {settings.primaryColor}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader className="space-y-1">
              <CardTitle className="text-base">Install Code</CardTitle>
              <CardDescription>
                Copy this script and paste it before the closing <code>{'</body>'}</code> tag of your
                website.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                readOnly
                rows={4}
                value={settings?.embedCode || ''}
                className="font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => void copyEmbedCode()}
                  disabled={!settings?.embedCode}
                >
                  {copySuccess ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copySuccess ? 'Copied' : 'Copy Embed Code'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-1.5"
                  onClick={() => setPreviewVersion((prev) => prev + 1)}
                >
                  <ExternalLink className="size-4" />
                  Refresh Preview
                </Button>
              </div>
              <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-600">
                <p>1. Paste snippet in your website footer template.</p>
                <p>2. Publish your site and hard refresh once.</p>
                <p>3. Verify launcher appears bottom corner and opens chat correctly.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="space-y-1">
              <CardTitle className="text-base">Dental Widget Templates</CardTitle>
              <CardDescription>Start with a style preset, then fine tune details below.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => void applyTemplate(template.id)}
                    className="rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm"
                  >
                    <div
                      className="mb-2 h-2.5 w-full rounded-full"
                      style={{ backgroundColor: template.primaryColor }}
                    />
                    <p className="text-sm font-medium text-slate-800">{template.label}</p>
                    <p className="text-xs text-slate-500">{template.primaryColor}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="space-y-1">
              <CardTitle className="text-base">Widget Settings</CardTitle>
              <CardDescription>
                Update voice, colors, launcher behavior, and conversion CTA from a single table.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow className="bg-slate-50/90 hover:bg-slate-50/90">
                      <TableHead className="w-[220px]">Field</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead className="w-[90px] text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading || !settings ? (
                      Array.from({ length: 6 }).map((_, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Skeleton className="h-4 w-28" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="ml-auto h-8 w-8" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      rows.map((row) => (
                        <TableRow key={row.key}>
                          <TableCell className="font-medium text-slate-800">{row.label}</TableCell>
                          <TableCell
                            className={
                              longFields.has(row.key)
                                ? 'whitespace-pre-wrap text-sm text-slate-600'
                                : 'text-sm text-slate-600'
                            }
                          >
                            {typeof settings[row.key] === 'boolean' ? (
                              <Badge
                                variant="outline"
                                className={
                                  settings[row.key]
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-slate-200 bg-slate-100 text-slate-600'
                                }
                              >
                                {settings[row.key] ? 'On' : 'Off'}
                              </Badge>
                            ) : (
                              String(settings[row.key])
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8"
                              onClick={() => openSettingsEditor(row.key)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="space-y-1">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">Quick Prompts</CardTitle>
                  <CardDescription>
                    Add high-intent prompt chips that guide visitors into booking actions.
                  </CardDescription>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => void resetDentalPrompts()}
                    disabled={submitting}
                  >
                    Load Dental Starters
                  </Button>
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto"
                    size="sm"
                    onClick={() => openPromptEditor()}
                  >
                    <Plus className="mr-1 size-4" />
                    Add Prompt
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow className="bg-slate-50/90 hover:bg-slate-50/90">
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
                          <TableCell>
                            <Skeleton className="h-4 w-40" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-10" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-16" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="ml-auto h-8 w-8" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      prompts.map((prompt) => (
                        <TableRow key={prompt.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium text-slate-800">{prompt.label}</div>
                              <div className="text-xs text-slate-500">{prompt.message}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {actionTypeLabels[prompt.actionType]}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">{prompt.sortOrder}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                prompt.isActive
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-slate-200 bg-slate-100 text-slate-600'
                              }
                            >
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
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-700"
                                  onClick={() => void deletePrompt(prompt.id)}
                                >
                                  <Trash2 className="mr-2 size-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="xl:sticky xl:top-6 xl:h-fit">
          <Card className="overflow-hidden border-slate-200">
            <CardHeader className="border-b border-slate-100 bg-slate-50/70 pb-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Live Widget Preview</CardTitle>
                  <CardDescription>Real /widget-frame rendered with current settings.</CardDescription>
                </div>
                <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <Bot className="size-4" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(160deg,#f8fafc_0%,#ecfeff_100%)] p-2">
                {loading ? (
                  <Skeleton className="h-[620px] w-full rounded-xl" />
                ) : (
                  <iframe
                    key={previewVersion}
                    src={previewUrl}
                    title="Chat widget preview"
                    className="h-[620px] w-full rounded-xl border border-slate-200 bg-white"
                  />
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-600">
                <p className="mb-1 font-medium text-slate-700">Preview Tips</p>
                <p>1. Click prompt chips to test common visitor journeys.</p>
                <p>2. Test WhatsApp / appointment CTA actions before publishing.</p>
                <p>3. Use Refresh Preview after any setting or prompt update.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

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
              <Textarea
                rows={5}
                value={String(fieldValue)}
                onChange={(event) => setFieldValue(event.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Value</Label>
              <Input value={String(fieldValue)} onChange={(event) => setFieldValue(event.target.value)} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => void saveSetting()} disabled={submitting}>
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
              <Input
                value={promptForm.label}
                onChange={(event) => setPromptForm((prev) => ({ ...prev, label: event.target.value }))}
                placeholder="Book braces consult"
              />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                rows={4}
                value={promptForm.message}
                onChange={(event) => setPromptForm((prev) => ({ ...prev, message: event.target.value }))}
                placeholder="I want to schedule a braces consultation"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Action Type</Label>
                <Select
                  value={promptForm.actionType}
                  onValueChange={(value) =>
                    setPromptForm((prev) => ({
                      ...prev,
                      actionType: value as QuickPrompt['actionType'],
                      actionValue: value === 'message' || value === 'appointment' ? '' : prev.actionValue,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="message">Send Message</SelectItem>
                    <SelectItem value="appointment">Open Appointment Form</SelectItem>
                    <SelectItem value="link">Open Link</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input
                  value={String(promptForm.sortOrder)}
                  onChange={(event) =>
                    setPromptForm((prev) => ({ ...prev, sortOrder: Number(event.target.value) || 99 }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                Action Value{' '}
                <span className="text-xs text-muted-foreground">
                  ({promptForm.actionType === 'link' ? 'required for links' : 'optional'})
                </span>
              </Label>
              <Input
                value={promptForm.actionValue}
                onChange={(event) =>
                  setPromptForm((prev) => ({ ...prev, actionValue: event.target.value }))
                }
                placeholder={
                  promptForm.actionType === 'link'
                    ? 'https://wa.me/15550000000'
                    : 'Optional override value'
                }
              />
            </div>
            <div className="rounded-md border bg-slate-50/60 p-2.5 text-xs text-slate-600">
              <p className="font-medium text-slate-700">Action Preview</p>
              <p>{actionTypeLabels[promptForm.actionType]}</p>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Active</Label>
                <p className="text-sm text-muted-foreground">
                  Inactive prompts stay saved but won&apos;t show in the widget.
                </p>
              </div>
              <Switch
                checked={promptForm.isActive}
                onCheckedChange={(checked) => setPromptForm((prev) => ({ ...prev, isActive: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromptDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => void savePrompt()} disabled={submitting}>
              {submitting ? 'Saving...' : editingPrompt ? 'Save Changes' : 'Save Prompt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

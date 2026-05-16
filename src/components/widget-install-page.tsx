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
  primaryColor: string
  widgetPosition: 'bottom-right' | 'bottom-left'
  embedCode: string
  clinicId: string
  allowedDomains: string[]
  slug: string
}

type QuickPromptIntent =
  | 'book_appointment'
  | 'clinic_hours'
  | 'services_fees'
  | 'location'
  | 'talk_on_whatsapp'
  | 'emergency_help'

interface QuickPrompt {
  id: string
  label: string
  intent: string
  sortOrder: number
  isActive: boolean
}

interface WidgetTemplate {
  id: string
  label: string
  primaryColor: string
  textOnPrimary: string
}

const longFields = new Set(['welcomeMessage'])

const emptyPrompt: {
  label: string
  intent: QuickPromptIntent
  sortOrder: number
  isActive: boolean
} = {
  label: '',
  intent: 'book_appointment',
  sortOrder: 99,
  isActive: true,
}

const quickPromptIntentOptions: Array<{
  value: QuickPromptIntent
  label: string
  description: string
}> = [
  {
    value: 'book_appointment',
    label: 'Book Appointment',
    description: 'Opens the appointment form inside the widget.',
  },
  {
    value: 'clinic_hours',
    label: 'Clinic Hours',
    description: 'Sends a message asking about clinic hours.',
  },
  {
    value: 'services_fees',
    label: 'Services & Fees',
    description: 'Sends a message asking about services and pricing.',
  },
  {
    value: 'location',
    label: 'Location',
    description: 'Opens the clinic location link.',
  },
  {
    value: 'talk_on_whatsapp',
    label: 'Talk on WhatsApp',
    description: 'Opens the clinic WhatsApp link.',
  },
  {
    value: 'emergency_help',
    label: 'Emergency Help',
    description: 'Sends an emergency help message.',
  },
]

function getQuickPromptIntentMeta(intent?: string | null) {
  return (
    quickPromptIntentOptions.find((option) => option.value === intent) || {
      value: 'clinic_hours',
      label: intent || 'Custom Intent',
      description: 'Legacy or custom prompt intent.',
    }
  )
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
  const [domainsText, setDomainsText] = useState('')
  const [editingDomains, setEditingDomains] = useState(false)
  const [savingDomains, setSavingDomains] = useState(false)

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

      // Initialize domains textarea from settings
      if (settingsData.allowedDomains) {
        setDomainsText(settingsData.allowedDomains.join('\n'))
      }
      if (settingsData.slug) {
        // Update settings with slug if not already present
        settingsData.slug = settingsData.slug
      }

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
      { key: 'primaryColor', label: 'Primary Color' },
      { key: 'widgetPosition', label: 'Widget Position' },
    ] as Array<{ key: keyof WidgetSettings; label: string }>,
    []
  )

  const activePromptCount = prompts.filter((prompt) => prompt.isActive).length

  const previewUrl = settings?.clinicId
    ? `/widget-frame?clinicId=${encodeURIComponent(settings.clinicId)}&preview=${previewVersion}&mode=embedded`
    : `/widget-frame?preview=${previewVersion}&mode=embedded`

  const saveAllowedDomains = async () => {
    setSavingDomains(true)
    try {
      const domains = domainsText
        .split('\n')
        .map((d) => d.trim())
        .filter(Boolean)
      const res = await fetch('/api/widget-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedDomains: domains }),
      })
      if (!res.ok) throw new Error('Failed to save domains')
      const updated = await res.json()
      setSettings((prev) => (prev ? { ...prev, ...updated } : prev))
      setEditingDomains(false)
      toast.success('Allowed domains updated')
    } catch {
      toast.error('Failed to update allowed domains')
    } finally {
      setSavingDomains(false)
    }
  }

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
        intent: (prompt.intent as QuickPromptIntent) || 'book_appointment',
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
    if (!promptForm.label.trim()) {
      toast.error('Prompt label is required')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        label: promptForm.label.trim(),
        intent: promptForm.intent,
        sortOrder: promptForm.sortOrder,
        isActive: promptForm.isActive,
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
              <CardTitle className="text-base">Allowed Domains</CardTitle>
              <CardDescription>
                Only these websites can embed your widget. One domain per line, exact https:// origin format.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {editingDomains ? (
                <div className="space-y-3">
                  <Textarea
                    rows={5}
                    value={domainsText}
                    onChange={(e) => setDomainsText(e.target.value)}
                    placeholder="https://your-clinic-website.com"
                    className="font-mono text-xs"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => void saveAllowedDomains()}
                      disabled={savingDomains}
                    >
                      {savingDomains ? 'Saving...' : 'Save Domains'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingDomains(false)
                        setDomainsText(settings?.allowedDomains?.join('\n') || '')
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {settings?.allowedDomains && settings.allowedDomains.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {settings.allowedDomains.map((domain) => (
                        <Badge key={domain} variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 font-mono text-xs">
                          {domain}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No domains configured yet. Add at least one domain to enable the widget.</p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingDomains(true)}
                  >
                    <Pencil className="mr-1 size-3.5" />
                    Edit Domains
                  </Button>
                </div>
              )}
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800">
                <p className="font-medium text-amber-900">Important</p>
                <p>Your website CSP must allow <code className="bg-amber-100 px-1 rounded">script-src</code> and <code className="bg-amber-100 px-1 rounded">frame-src</code> pointing to this app domain.</p>
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
                              <div className="text-xs text-slate-500">
                                {getQuickPromptIntentMeta(prompt.intent).description}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">
                            {getQuickPromptIntentMeta(prompt.intent).label}
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
          ) : editingField === 'primaryColor' ? (
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(String(fieldValue)) ? String(fieldValue) : '#059669'}
                  onChange={(event) => setFieldValue(event.target.value)}
                  className="h-10 w-14 rounded-md border border-gray-200 p-1 cursor-pointer"
                />
                <Input
                  value={String(fieldValue)}
                  onChange={(event) => setFieldValue(event.target.value)}
                  placeholder="#059669"
                  className="flex-1 font-mono"
                />
              </div>
              {!/^#[0-9a-fA-F]{6}$/.test(String(fieldValue)) && String(fieldValue).length > 0 && (
                <p className="text-xs text-red-600">Must be a 6-digit hex color like #059669</p>
              )}
            </div>
          ) : editingField === 'widgetPosition' ? (
            <div className="space-y-2">
              <Label>Widget Position</Label>
              <Select
                value={String(fieldValue)}
                onValueChange={(value) => setFieldValue(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom-right">Bottom Right</SelectItem>
                  <SelectItem value="bottom-left">Bottom Left</SelectItem>
                </SelectContent>
              </Select>
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
              <Label>Intent</Label>
              <Select
                value={promptForm.intent}
                onValueChange={(value) =>
                  setPromptForm((prev) => ({
                    ...prev,
                    intent: value as QuickPromptIntent,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select prompt intent" />
                </SelectTrigger>
                <SelectContent>
                  {quickPromptIntentOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
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
            <div className="rounded-md border bg-slate-50/60 p-2.5 text-xs text-slate-600">
              <p className="font-medium text-slate-700">What this prompt does</p>
              <p>{getQuickPromptIntentMeta(promptForm.intent).description}</p>
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

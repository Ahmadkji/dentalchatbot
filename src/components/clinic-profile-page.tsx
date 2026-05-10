'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Pencil,
  Globe,
  Loader2,
  Sparkles,
  CheckCircle2,
  MapPin,
  Phone,
  ClockIcon,
  CreditCard,
  AlertCircle,
  ExternalLink,
  ArrowRight,
  Building2,
  MessageSquare,
  CalendarCheck,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

interface ClinicProfile {
  id: string
  name: string
  slug: string
  address: string
  city: string
  country: string
  primaryPhone: string
  whatsappNumber: string
  openingHours: string
  appointmentRules: string
  pricingNotes: string
  emergencyInstructions: string
  timezone: string
  isActive: boolean
}

interface DetectedDetail {
  field: string
  label: string
  value: string
  confidence: 'high' | 'medium' | 'low'
  targetField: string
}

const emptyProfile: ClinicProfile = {
  id: '',
  name: '',
  slug: '',
  address: '',
  city: '',
  country: '',
  primaryPhone: '',
  whatsappNumber: '',
  openingHours: '',
  appointmentRules: '',
  pricingNotes: '',
  emergencyInstructions: '',
  timezone: 'Asia/Karachi',
  isActive: true,
}

const longTextFields = new Set([
  'address',
  'openingHours',
  'appointmentRules',
  'pricingNotes',
  'emergencyInstructions',
])

const fieldIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  name: Building2,
  slug: Globe,
  address: MapPin,
  city: MapPin,
  country: Globe,
  primaryPhone: Phone,
  whatsappNumber: MessageSquare,
  openingHours: ClockIcon,
  appointmentRules: CalendarCheck,
  pricingNotes: CreditCard,
  emergencyInstructions: AlertCircle,
  timezone: ClockIcon,
  isActive: CheckCircle2,
}

const detailIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  phone: Phone,
  whatsapp: Phone,
  address: MapPin,
  opening_hours: ClockIcon,
  pricing: CreditCard,
  emergency: AlertCircle,
  name: Globe,
}

const confidenceColors: Record<string, string> = {
  high: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-50 text-slate-600 border-slate-200',
}

interface FieldSection {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  fields: Array<{ key: keyof ClinicProfile; label: string }>
}

const fieldSections: FieldSection[] = [
  {
    key: 'identity',
    label: 'Clinic Identity',
    icon: Building2,
    color: 'bg-blue-100 text-blue-700',
    fields: [
      { key: 'name', label: 'Clinic Name' },
      { key: 'slug', label: 'Slug' },
    ],
  },
  {
    key: 'location',
    label: 'Location & Contact',
    icon: MapPin,
    color: 'bg-emerald-100 text-emerald-700',
    fields: [
      { key: 'address', label: 'Address' },
      { key: 'city', label: 'City' },
      { key: 'country', label: 'Country' },
      { key: 'primaryPhone', label: 'Primary Phone' },
      { key: 'whatsappNumber', label: 'WhatsApp' },
    ],
  },
  {
    key: 'operations',
    label: 'Operations & Rules',
    icon: ClockIcon,
    color: 'bg-violet-100 text-violet-700',
    fields: [
      { key: 'openingHours', label: 'Opening Hours' },
      { key: 'appointmentRules', label: 'Appointment Rules' },
      { key: 'pricingNotes', label: 'Pricing Notes' },
      { key: 'emergencyInstructions', label: 'Emergency Instructions' },
    ],
  },
  {
    key: 'system',
    label: 'System',
    icon: Globe,
    color: 'bg-slate-100 text-slate-700',
    fields: [
      { key: 'timezone', label: 'Timezone' },
      { key: 'isActive', label: 'Active' },
    ],
  },
]

export default function ClinicProfilePage() {
  const [profile, setProfile] = useState<ClinicProfile>(emptyProfile)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingField, setEditingField] = useState<keyof ClinicProfile | null>(null)
  const [editValue, setEditValue] = useState<string | boolean>('')

  // Inline editing state
  const [inlineEditKey, setInlineEditKey] = useState<keyof ClinicProfile | null>(null)
  const [inlineEditValue, setInlineEditValue] = useState('')
  const [inlineSaving, setInlineSaving] = useState(false)

  // Expanded long-text rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Collapsed sections
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  // Copied field feedback
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Fetch from website states
  const [fetchDialogOpen, setFetchDialogOpen] = useState(false)
  const [fetchUrl, setFetchUrl] = useState('')
  const [fetching, setFetching] = useState(false)
  const [detectedDetails, setDetectedDetails] = useState<DetectedDetail[]>([])
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [selectedDetails, setSelectedDetails] = useState<Set<string>>(new Set())
  const [applying, setApplying] = useState(false)
  const [fetchedUrl, setFetchedUrl] = useState('')
  const [contentPreview, setContentPreview] = useState('')

  // Track which fields were auto-populated
  const [autoPopulatedFields, setAutoPopulatedFields] = useState<Set<string>>(new Set())

  // Track which fields are disabled (toggled off) by user
  const [disabledFields, setDisabledFields] = useState<Set<string>>(new Set())

  // Fields that can be toggled (exclude system/internal fields)
  const toggleableFields = useMemo(
    () => new Set([
      'name', 'address', 'city', 'country', 'primaryPhone',
      'whatsappNumber', 'openingHours', 'appointmentRules',
      'pricingNotes', 'emergencyInstructions',
    ]),
    []
  )

  useEffect(() => {
    async function fetchProfile() {
      setLoading(true)
      try {
        const [clinicRes, settingsRes] = await Promise.all([
          fetch('/api/clinic'),
          fetch('/api/settings'),
        ])

        if (!clinicRes.ok) throw new Error('Failed to fetch clinic')
        const data = await clinicRes.json()
        setProfile(data)

        // Load disabled fields from settings
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json()
          const settingsList = settingsData.settings || []
          const disabledSetting = settingsList.find(
            (s: { key: string; value: string }) => s.key === 'bot_disabled_fields'
          )
          if (disabledSetting?.value) {
            try {
              const parsed = JSON.parse(disabledSetting.value)
              if (Array.isArray(parsed)) {
                setDisabledFields(new Set(parsed))
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      } catch {
        toast.error('Failed to load clinic profile')
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [])

  const saveDisabledFields = useCallback(async (updatedDisabled: Set<string>) => {
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'bot_disabled_fields',
          value: JSON.stringify([...updatedDisabled]),
        }),
      })
    } catch {
      // silent fail for toggle persistence
    }
  }, [])

  const toggleField = useCallback((fieldKey: string) => {
    setDisabledFields((prev) => {
      const next = new Set(prev)
      if (next.has(fieldKey)) {
        next.delete(fieldKey)
      } else {
        next.add(fieldKey)
      }
      void saveDisabledFields(next)
      return next
    })
  }, [saveDisabledFields])

  // Computed: fill progress
  const fillProgress = useMemo(() => {
    const allFields = fieldSections.flatMap((s) => s.fields.map((f) => f.key))
    const filled = allFields.filter((key) => {
      if (key === 'isActive') return true
      const val = String(profile[key] ?? '').trim()
      return val.length > 0
    }).length
    return { filled, total: allFields.length }
  }, [profile])

  const toggleSection = (sectionKey: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(sectionKey)) next.delete(sectionKey)
      else next.add(sectionKey)
      return next
    })
  }

  const toggleRowExpand = (fieldKey: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(fieldKey)) next.delete(fieldKey)
      else next.add(fieldKey)
      return next
    })
  }

  const copyToClipboard = (fieldKey: string) => {
    const value = String(profile[fieldKey as keyof ClinicProfile] ?? '').trim()
    if (!value) return
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(fieldKey)
      setTimeout(() => setCopiedField(null), 1500)
    }).catch(() => {
      toast.error('Failed to copy')
    })
  }

  const startInlineEdit = (field: keyof ClinicProfile) => {
    if (field === 'isActive') {
      openEditor(field)
      return
    }
    setInlineEditKey(field)
    setInlineEditValue(String(profile[field] ?? ''))
  }

  const cancelInlineEdit = () => {
    setInlineEditKey(null)
    setInlineEditValue('')
  }

  const saveInlineEdit = async () => {
    if (!inlineEditKey) return
    setInlineSaving(true)
    try {
      const res = await fetch('/api/clinic', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [inlineEditKey]: inlineEditValue }),
      })
      if (!res.ok) throw new Error('Failed to save')
      const updated = await res.json()
      setProfile(updated)
      setInlineEditKey(null)
      setInlineEditValue('')
      setAutoPopulatedFields((prev) => {
        const next = new Set(prev)
        next.delete(inlineEditKey as string)
        return next
      })
      toast.success('Updated')
    } catch {
      toast.error('Failed to update')
    } finally {
      setInlineSaving(false)
    }
  }

  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void saveInlineEdit()
    } else if (e.key === 'Escape') {
      cancelInlineEdit()
    }
  }

  const openEditor = (field: keyof ClinicProfile) => {
    setEditingField(field)
    setEditValue(profile[field] as string | boolean)
    setEditOpen(true)
  }

  const handleSave = async () => {
    if (!editingField) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/clinic', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [editingField]: editValue }),
      })

      if (!res.ok) throw new Error('Failed to save')

      const updated = await res.json()
      setProfile(updated)
      setEditOpen(false)
      setEditingField(null)
      setAutoPopulatedFields((prev) => {
        const next = new Set(prev)
        next.delete(editingField as string)
        return next
      })
      toast.success('Clinic profile updated')
    } catch {
      toast.error('Failed to update clinic profile')
    } finally {
      setSubmitting(false)
    }
  }

  // --- Fetch from Website handlers ---

  const handleFetchFromWebsite = useCallback(async () => {
    if (!fetchUrl.trim()) {
      toast.error('Please enter a website URL')
      return
    }

    let normalized = fetchUrl.trim()
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${normalized}`
    }

    // Basic URL validation
    try {
      const parsed = new URL(normalized)
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        toast.error('Localhost URLs are not supported')
        return
      }
    } catch {
      toast.error('Please enter a valid website URL')
      return
    }

    setFetching(true)
    try {
      const res = await fetch('/api/clinic/fetch-from-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: fetchUrl.trim() }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to fetch website content')
      }

      const data = await res.json()

      if (!data.details || data.details.length === 0) {
        toast.info('No clinic details could be detected from this website. Try entering your clinic URL or contact page.')
        setFetching(false)
        return
      }

      setDetectedDetails(data.details)
      setFetchedUrl(data.url)
      setContentPreview(data.contentPreview || '')
      setSelectedDetails(new Set(data.details.map((d: DetectedDetail) => d.targetField)))
      setFetchDialogOpen(false)
      setPreviewDialogOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch website content')
    } finally {
      setFetching(false)
    }
  }, [fetchUrl])

  const toggleDetailSelection = (targetField: string) => {
    setSelectedDetails((prev) => {
      const next = new Set(prev)
      if (next.has(targetField)) {
        next.delete(targetField)
      } else {
        next.add(targetField)
      }
      return next
    })
  }

  const applySelectedDetails = useCallback(async () => {
    if (selectedDetails.size === 0) {
      toast.error('Please select at least one field to apply')
      return
    }

    setApplying(true)
    try {
      const updates: Record<string, string> = {}
      const newAutoPopulated = new Set<string>()

      for (const detail of detectedDetails) {
        if (selectedDetails.has(detail.targetField)) {
          updates[detail.targetField] = detail.value
          newAutoPopulated.add(detail.targetField)
        }
      }

      const res = await fetch('/api/clinic', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!res.ok) throw new Error('Failed to apply details')

      const updated = await res.json()
      setProfile(updated)
      setAutoPopulatedFields((prev) => new Set([...prev, ...newAutoPopulated]))
      setPreviewDialogOpen(false)
      setDetectedDetails([])
      setFetchUrl('')
      toast.success(`Applied ${selectedDetails.size} field${selectedDetails.size > 1 ? 's' : ''} from website`)
    } catch {
      toast.error('Failed to apply detected details')
    } finally {
      setApplying(false)
    }
  }, [selectedDetails, detectedDetails])

  const renderValue = (field: keyof ClinicProfile) => {
    if (field === 'isActive') {
      return (
        <Badge
          variant="outline"
          className={profile.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-600 border-gray-200'}
        >
          {profile.isActive ? 'Active' : 'Inactive'}
        </Badge>
      )
    }

    const value = String(profile[field] ?? '').trim()
    if (!value) {
      return <span className="text-muted-foreground/50 italic">Click to add...</span>
    }
    const isExpanded = expandedRows.has(field as string)
    const isLong = longTextFields.has(field) && value.length > 80

    if (isLong && !isExpanded) {
      return (
        <span className="cursor-pointer" onClick={() => toggleRowExpand(field as string)}>
          {value.substring(0, 80)}...
          <span className="text-emerald-600 text-xs ml-1">more</span>
        </span>
      )
    }
    if (isLong && isExpanded) {
      return (
        <span className="cursor-pointer" onClick={() => toggleRowExpand(field as string)}>
          {value}
          <span className="text-emerald-600 text-xs ml-1">less</span>
        </span>
      )
    }
    return value
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Bot Setup</h2>
          <p className="text-sm text-muted-foreground">
            Define clinic identity, rules, and operational context used by your AI agent responses.
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                onClick={() => setFetchDialogOpen(true)}
              >
                <Globe className="size-4" />
                Fetch from Website
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[260px]">
              <p className="text-xs">Auto-detect clinic name, address, phone, hours &amp; more from your website. All fields can be reviewed before applying.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Fill Progress */}
      <div className="rounded-md border px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Profile completeness</span>
          <span className="text-xs font-semibold text-emerald-700">{fillProgress.filled}/{fillProgress.total} fields</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${(fillProgress.filled / fillProgress.total) * 100}%` }}
          />
        </div>
      </div>

      {/* Grouped Sections */}
      <div className="space-y-3">
        {fieldSections.map((section) => {
          const SectionIcon = section.icon
          const isCollapsed = collapsedSections.has(section.key)
          return (
            <div key={section.key} className="rounded-md border">
              {/* Section Header */}
              <button
                className="flex items-center gap-3 w-full px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                onClick={() => toggleSection(section.key)}
              >
                <div className={`flex size-7 items-center justify-center rounded-md ${section.color}`}>
                  <SectionIcon className="size-3.5" />
                </div>
                <span className="text-sm font-semibold flex-1">{section.label}</span>
                <Badge variant="outline" className="text-[10px]">
                  {section.fields.filter((f) => {
                    if (f.key === 'isActive') return true
                    return String(profile[f.key] ?? '').trim().length > 0
                  }).length}/{section.fields.length}
                </Badge>
                {isCollapsed ? (
                  <ChevronRight className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" />
                )}
              </button>

              {/* Section Fields */}
              {!isCollapsed && (
                <div className="divide-y">
                  {section.fields.map((field) => {
                    const FieldIcon = fieldIcons[field.key as string] || CheckCircle2
                    const isDisabled = disabledFields.has(field.key as string)
                    const canToggle = toggleableFields.has(field.key as string)
                    const isEditing = inlineEditKey === field.key
                    const value = String(profile[field.key] ?? '').trim()
                    const isFilled = field.key === 'isActive' ? true : value.length > 0

                    return (
                      <div
                        key={field.key}
                        className={`flex items-center gap-3 px-4 py-3 transition-colors group ${
                          isDisabled
                            ? 'opacity-40 bg-muted/10'
                            : isEditing
                              ? 'bg-emerald-50/30'
                              : 'hover:bg-muted/20'
                        }`}
                      >
                        {/* Field Icon */}
                        <div className={`flex size-7 items-center justify-center rounded-md shrink-0 ${
                          isFilled ? 'bg-emerald-50 text-emerald-600' : 'bg-muted text-muted-foreground'
                        }`}>
                          <FieldIcon className="size-3.5" />
                        </div>

                        {/* Field Label */}
                        <div className="w-[140px] shrink-0">
                          <span className="text-sm font-medium">{field.label}</span>
                          {isDisabled && (
                            <Badge variant="outline" className="text-[9px] ml-1.5 bg-slate-50 text-slate-400 border-slate-200">
                              Off
                            </Badge>
                          )}
                        </div>

                        {/* Field Value / Inline Editor */}
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              {longTextFields.has(field.key as string) ? (
                                <Textarea
                                  autoFocus
                                  rows={3}
                                  value={inlineEditValue}
                                  onChange={(e) => setInlineEditValue(e.target.value)}
                                  onKeyDown={handleInlineKeyDown}
                                  className="text-sm"
                                />
                              ) : (
                                <Input
                                  autoFocus
                                  value={inlineEditValue}
                                  onChange={(e) => setInlineEditValue(e.target.value)}
                                  onKeyDown={handleInlineKeyDown}
                                  className="h-8 text-sm"
                                />
                              )}
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  size="sm"
                                  className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => void saveInlineEdit()}
                                  disabled={inlineSaving}
                                >
                                  {inlineSaving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={cancelInlineEdit}
                                >
                                  <X className="size-3" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`text-sm cursor-pointer rounded-md px-2 py-1 -mx-2 -my-1 transition-colors ${
                                isDisabled ? 'line-through decoration-muted-foreground/30 text-muted-foreground' : 'text-muted-foreground hover:bg-white hover:ring-1 hover:ring-emerald-200'
                              }`}
                              onClick={() => !isDisabled && startInlineEdit(field.key)}
                              title="Click to edit"
                            >
                              {renderValue(field.key)}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isFilled && !isDisabled && field.key !== 'isActive' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => copyToClipboard(field.key as string)}
                              title="Copy value"
                            >
                              {copiedField === field.key ? (
                                <Check className="size-3 text-emerald-600" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </Button>
                          )}
                          {!isEditing && field.key !== 'isActive' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => openEditor(field.key)}
                              disabled={isDisabled}
                              title="Edit in dialog"
                            >
                              <Pencil className="size-3" />
                            </Button>
                          )}
                        </div>

                        {/* Toggle */}
                        <div className="w-[50px] shrink-0 flex justify-end">
                          {canToggle ? (
                            <Switch
                              checked={!isDisabled}
                              onCheckedChange={() => toggleField(field.key as string)}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Edit Field Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {fieldSections.flatMap((s) => s.fields).find((f) => f.key === editingField)?.label || 'Field'}</DialogTitle>
          </DialogHeader>

          {editingField === 'isActive' ? (
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label>Clinic Active</Label>
                <p className="text-sm text-muted-foreground">Disable only if you want to pause chat and lead capture behavior.</p>
              </div>
              <Switch checked={Boolean(editValue)} onCheckedChange={(checked) => setEditValue(checked)} />
            </div>
          ) : longTextFields.has(editingField || '') ? (
            <div className="space-y-2">
              <Label>Value</Label>
              <Textarea
                rows={6}
                value={String(editValue)}
                onChange={(event) => setEditValue(event.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Value</Label>
              <Input value={String(editValue)} onChange={(event) => setEditValue(event.target.value)} />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSave} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fetch from Website Dialog */}
      <Dialog open={fetchDialogOpen} onOpenChange={setFetchDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Fetch Clinic Details from Website</DialogTitle>
            <DialogDescription>
              Enter your clinic website URL and we&apos;ll automatically detect and populate the relevant fields.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Website URL</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Globe className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    value={fetchUrl}
                    onChange={(e) => setFetchUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleFetchFromWebsite()
                    }}
                    placeholder="https://yourclinic.com"
                    className="pl-8"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                We recommend using your clinic&apos;s homepage or contact page for best results.
              </p>
            </div>

            <div className="rounded-md bg-muted/50 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">We can detect:</p>
              <div className="flex flex-wrap gap-1.5">
                {['Clinic Name', 'Phone', 'WhatsApp', 'Address', 'City', 'Opening Hours', 'Pricing', 'Emergency Info'].map((item) => (
                  <Badge key={item} variant="secondary" className="text-[10px]">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFetchDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
              onClick={() => void handleFetchFromWebsite()}
              disabled={fetching || !fetchUrl.trim()}
            >
              {fetching ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <Globe className="size-4" />
                  Fetch Details
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detection Preview Dialog */}
      <AlertDialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <AlertDialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Detected From Your Website</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <span>
                  We found the following details from <a href={fetchedUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline inline-flex items-center gap-1">{fetchedUrl} <ExternalLink className="size-3" /></a>. Select which fields to apply to your Bot Setup.
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px]">
                    {detectedDetails.length} field{detectedDetails.length !== 1 ? 's' : ''} detected
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {selectedDetails.size} selected
                  </Badge>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 py-2">
            {/* Select All / Deselect All */}
            <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">Toggle selection</span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSelectedDetails(new Set(detectedDetails.map((d) => d.targetField)))}
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSelectedDetails(new Set())}
                >
                  Deselect All
                </Button>
              </div>
            </div>

            {detectedDetails.map((detail) => {
              const Icon = detailIcons[detail.field] || CheckCircle2
              const isSelected = selectedDetails.has(detail.targetField)
              const currentProfileValue = String(profile[detail.targetField as keyof ClinicProfile] ?? '').trim()

              return (
                <div
                  key={detail.targetField}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-colors cursor-pointer ${
                    isSelected ? 'border-emerald-200 bg-emerald-50/30' : 'border-muted bg-muted/10 opacity-60'
                  }`}
                  onClick={() => toggleDetailSelection(detail.targetField)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleDetailSelection(detail.targetField)}
                    className="mt-0.5"
                  />
                  <Icon className="size-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{detail.label}</span>
                      <Badge variant="outline" className={`text-[10px] ${confidenceColors[detail.confidence]}`}>
                        {detail.confidence} confidence
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 break-words">{detail.value}</p>
                    {currentProfileValue && (
                      <p className="text-[11px] text-amber-600 mt-1">
                        Current value: &quot;{currentProfileValue.substring(0, 80)}{currentProfileValue.length > 80 ? '...' : ''}&quot;
                      </p>
                    )}
                  </div>
                </div>
              )
            })}

            {detectedDetails.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="size-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No details could be detected from this page.</p>
                <p className="text-xs mt-1">Try using your clinic&apos;s contact or about page.</p>
              </div>
            )}
          </div>

          {contentPreview && (
            <div className="space-y-2 border-t pt-3">
              <details className="group">
                <summary className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground">
                  View extracted page content
                </summary>
                <Textarea
                  readOnly
                  rows={4}
                  value={contentPreview}
                  className="mt-2 font-mono text-[11px] bg-muted/30"
                />
              </details>
            </div>
          )}

          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel onClick={() => { setPreviewDialogOpen(false); setDetectedDetails([]); }}>
              Cancel
            </AlertDialogCancel>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
              onClick={() => void applySelectedDetails()}
              disabled={applying || selectedDetails.size === 0}
            >
              {applying ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  Apply {selectedDetails.size} Field{selectedDetails.size !== 1 ? 's' : ''}
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

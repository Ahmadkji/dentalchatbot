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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Pencil, Plus, RefreshCcw } from 'lucide-react'

type PriceType = 'fixed' | 'starting_from' | 'range' | 'free' | 'quote_required'

interface ServiceRow {
  id: string
  name: string
  description: string | null
  category: string | null
  priceType: PriceType
  priceAmount: number | null
  priceMinAmount: number | null
  priceMaxAmount: number | null
  priceCurrency: string | null
  pricingNote: string | null
  pricingSummary: string | null
  price: string | null
  isPriceVisibleToChatbot: boolean
  requiresConsultation: boolean
  durationMinutes: number
  isActive: boolean
  sortOrder: number
  updatedAt: string
}

interface ServiceFormState {
  id: string | null
  name: string
  description: string
  category: string
  priceType: PriceType
  priceAmount: string
  priceMinAmount: string
  priceMaxAmount: string
  priceCurrency: string
  pricingNote: string
  isPriceVisibleToChatbot: boolean
  requiresConsultation: boolean
  durationMinutes: string
  sortOrder: string
  isActive: boolean
}

interface ClinicProfilePayload {
  defaultCurrency?: string
}

const priceTypeOptions: Array<{ value: PriceType; label: string; help: string }> = [
  { value: 'fixed', label: 'Fixed price', help: 'One exact price like USD 80.' },
  { value: 'starting_from', label: 'Starting from', help: 'A base price like starts from USD 150.' },
  { value: 'range', label: 'Range', help: 'A min and max price like USD 1,500 - USD 3,000.' },
  { value: 'free', label: 'Free', help: 'For free consultation or free checkups.' },
  { value: 'quote_required', label: 'Quote required', help: 'The chatbot asks the patient to request a quote or consultation.' },
]

const emptyForm: ServiceFormState = {
  id: null,
  name: '',
  description: '',
  category: '',
  priceType: 'fixed',
  priceAmount: '',
  priceMinAmount: '',
  priceMaxAmount: '',
  priceCurrency: '',
  pricingNote: '',
  isPriceVisibleToChatbot: false,
  requiresConsultation: false,
  durationMinutes: '30',
  sortOrder: '100',
  isActive: true,
}

function formatUpdatedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function buildPayload(form: ServiceFormState) {
  return {
    name: form.name,
    description: form.description || null,
    category: form.category || null,
    price_type: form.priceType,
    price_amount: form.priceType === 'fixed' || form.priceType === 'starting_from' ? form.priceAmount || null : null,
    price_min_amount: form.priceType === 'range' ? form.priceMinAmount || null : null,
    price_max_amount: form.priceType === 'range' ? form.priceMaxAmount || null : null,
    price_currency: form.priceCurrency || null,
    pricing_note: form.pricingNote || null,
    is_price_visible_to_chatbot: form.isPriceVisibleToChatbot,
    requires_consultation: form.requiresConsultation,
    duration_minutes: form.durationMinutes,
    sort_order: form.sortOrder,
    is_active: form.isActive,
  }
}

function mapServiceToForm(service: ServiceRow): ServiceFormState {
  return {
    id: service.id,
    name: service.name,
    description: service.description || '',
    category: service.category || '',
    priceType: service.priceType,
    priceAmount: service.priceAmount === null ? '' : String(service.priceAmount),
    priceMinAmount: service.priceMinAmount === null ? '' : String(service.priceMinAmount),
    priceMaxAmount: service.priceMaxAmount === null ? '' : String(service.priceMaxAmount),
    priceCurrency: service.priceCurrency || '',
    pricingNote: service.pricingNote || '',
    isPriceVisibleToChatbot: service.isPriceVisibleToChatbot,
    requiresConsultation: service.requiresConsultation,
    durationMinutes: String(service.durationMinutes),
    sortOrder: String(service.sortOrder),
    isActive: service.isActive,
  }
}

export default function ServicesPricingPage() {
  const [services, setServices] = useState<ServiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [currencySaving, setCurrencySaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<ServiceFormState>(emptyForm)
  const [defaultCurrency, setDefaultCurrency] = useState('USD')
  const [defaultCurrencyDraft, setDefaultCurrencyDraft] = useState('USD')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [servicesRes, clinicRes] = await Promise.all([
        fetch('/api/services?include_inactive=true'),
        fetch('/api/clinic'),
      ])

      if (!servicesRes.ok) throw new Error('Failed to load services')
      if (!clinicRes.ok) throw new Error('Failed to load clinic settings')

      const servicesData = await servicesRes.json()
      const clinicData = (await clinicRes.json()) as ClinicProfilePayload

      setServices(Array.isArray(servicesData.services) ? servicesData.services : [])
      const clinicCurrency = typeof clinicData.defaultCurrency === 'string' ? clinicData.defaultCurrency : 'USD'
      setDefaultCurrency(clinicCurrency)
      setDefaultCurrencyDraft(clinicCurrency)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load services and pricing')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadData])

  const filteredServices = useMemo(() => {
    if (statusFilter === 'active') return services.filter((service) => service.isActive)
    if (statusFilter === 'inactive') return services.filter((service) => !service.isActive)
    return services
  }, [services, statusFilter])

  const openCreateModal = () => {
    setForm({
      ...emptyForm,
      priceCurrency: defaultCurrency,
    })
    setModalOpen(true)
  }

  const openEditModal = (service: ServiceRow) => {
    setForm(mapServiceToForm(service))
    setModalOpen(true)
  }

  const saveDefaultCurrency = async () => {
    setCurrencySaving(true)
    try {
      const response = await fetch('/api/clinic', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultCurrency: defaultCurrencyDraft }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Failed to save clinic default currency')

      setDefaultCurrency(defaultCurrencyDraft.toUpperCase())
      setDefaultCurrencyDraft(defaultCurrencyDraft.toUpperCase())
      toast.success('Clinic default currency updated')
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save clinic default currency')
    } finally {
      setCurrencySaving(false)
    }
  }

  const saveService = async () => {
    setSubmitting(true)
    try {
      const response = await fetch(form.id ? `/api/services/${form.id}` : '/api/services', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(form)),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Failed to save service')

      toast.success(form.id ? 'Service updated' : 'Service created')
      setModalOpen(false)
      setForm(emptyForm)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save service')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleServiceStatus = async (service: ServiceRow) => {
    try {
      const response = await fetch(`/api/services/${service.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !service.isActive }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Failed to update service status')

      toast.success(service.isActive ? 'Service moved to inactive' : 'Service reactivated')
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update service status')
    }
  }

  const selectedPriceType = priceTypeOptions.find((option) => option.value === form.priceType)

  return (
    <div className="space-y-4">
      {/* ── Page header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Services & Pricing</h2>
          <p className="text-sm text-muted-foreground">
            Add clinic services, choose how each price works, and control whether the chatbot is allowed to share it.
          </p>
        </div>
        <div className="flex flex-shrink-0 flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
            <RefreshCcw className="mr-1.5 size-3.5" />
            Refresh
          </Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openCreateModal}>
            <Plus className="mr-1.5 size-3.5" />
            Add service
          </Button>
        </div>
      </div>
  
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        {/* ── Service list (table on lg+, cards on mobile) ── */}
        <div className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold tracking-tight">Service table</h3>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Hidden pricing keeps the service visible, but the bot will not reveal the price.
              </p>
            </div>
            <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'inactive') => setStatusFilter(value)}>
              <SelectTrigger className="w-[130px] sm:w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All services</SelectItem>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="inactive">Inactive only</SelectItem>
              </SelectContent>
            </Select>
          </div>
  
          {/* ── Loading skeleton ── */}
          {loading && (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="rounded-lg border p-3 sm:hidden">
                  <Skeleton className="mb-2 h-4 w-2/3" />
                  <Skeleton className="mb-1 h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ))}
              <div className="hidden sm:block">
                <div className="overflow-x-auto rounded-lg border">
                  <Table className="min-w-[980px]">
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                        <TableHead>Service</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Saved Pricing</TableHead>
                        <TableHead>Chatbot</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <TableRow key={idx}>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="ml-auto h-8 w-20" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
  
          {/* ── Empty state ── */}
          {!loading && filteredServices.length === 0 && (
            <div className="mt-4 rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">No services found for this filter yet.</p>
              <Button size="sm" className="mt-3 bg-emerald-600 hover:bg-emerald-700" onClick={openCreateModal}>
                <Plus className="mr-1.5 size-3.5" />
                Add your first service
              </Button>
            </div>
          )}
  
          {/* ── Mobile: card layout (< 640px) ── */}
          {!loading && filteredServices.length > 0 && (
            <div className="mt-4 space-y-3 sm:hidden">
              {filteredServices.map((service) => (
                <div key={service.id} className="rounded-lg border bg-white p-3 shadow-sm">
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{service.name}</p>
                      {service.category && (
                        <p className="text-xs text-muted-foreground">{service.category}</p>
                      )}
                    </div>
                    <Badge variant={service.isActive ? 'default' : 'secondary'} className={`flex-shrink-0 ${service.isActive ? 'bg-slate-900 text-white' : ''}`}>
                      {service.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
  
                  {/* Description */}
                  {service.description && (
                    <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{service.description}</p>
                  )}
  
                  {/* Info chips row */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-xs font-normal">
                      {service.pricingSummary || 'No pricing'}
                    </Badge>
                    <Badge variant="outline" className="text-xs font-normal">
                      {service.durationMinutes} min
                    </Badge>
                    <Badge
                      variant={service.isPriceVisibleToChatbot ? 'default' : 'outline'}
                      className={`text-xs font-normal ${service.isPriceVisibleToChatbot ? 'bg-emerald-600 text-white' : ''}`}
                    >
                      {service.isPriceVisibleToChatbot ? 'Chatbot: visible' : 'Chatbot: hidden'}
                    </Badge>
                  </div>
  
                  {/* Updated + actions */}
                  <div className="mt-3 flex items-center justify-between border-t pt-2.5">
                    <p className="text-[11px] text-muted-foreground">{formatUpdatedAt(service.updatedAt)}</p>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="h-8 px-2.5" onClick={() => openEditModal(service)}>
                        <Pencil className="mr-1 size-3" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5"
                        onClick={() => void toggleServiceStatus(service)}
                      >
                        {service.isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
  
          {/* ── Desktop: table layout (>= 640px) ── */}
          {!loading && filteredServices.length > 0 && (
            <div className="mt-4 hidden overflow-x-auto rounded-lg border sm:block">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                    <TableHead>Service</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Saved Pricing</TableHead>
                    <TableHead>Chatbot</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServices.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-slate-900">{service.name}</p>
                          <p className="max-w-[280px] text-xs text-muted-foreground line-clamp-2">
                            {service.description || 'No description added yet.'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{service.category || '\u2014'}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{service.pricingSummary || 'No pricing saved'}</p>
                          {service.pricingNote && (
                            <p className="max-w-[240px] text-xs text-muted-foreground line-clamp-2">{service.pricingNote}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant={service.isPriceVisibleToChatbot ? 'default' : 'outline'} className={`whitespace-nowrap ${service.isPriceVisibleToChatbot ? 'bg-emerald-600 text-white' : ''}`}>
                            {service.isPriceVisibleToChatbot ? 'Can share price' : 'Price hidden'}
                          </Badge>
                          <p className="max-w-[200px] text-xs text-muted-foreground line-clamp-2">
                            {service.price || 'Bot offers booking or lead capture.'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{service.durationMinutes} min</TableCell>
                      <TableCell>
                        <Badge variant={service.isActive ? 'default' : 'secondary'} className={`whitespace-nowrap ${service.isActive ? 'bg-slate-900 text-white' : ''}`}>
                          {service.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-xs text-muted-foreground lg:table-cell">{formatUpdatedAt(service.updatedAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" className="h-8" onClick={() => openEditModal(service)}>
                            <Pencil className="mr-1.5 size-3" />
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" className="hidden h-8 sm:inline-flex" onClick={() => void toggleServiceStatus(service)}>
                            {service.isActive ? 'Deactivate' : 'Reactivate'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
  
        {/* ── Sidebar ── */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm">
            <h3 className="text-sm font-semibold tracking-tight">Clinic default currency</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              This fills pricing automatically when a service does not need its own currency override.
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                value={defaultCurrencyDraft}
                onChange={(event) => setDefaultCurrencyDraft(event.target.value.toUpperCase())}
                maxLength={3}
                className="w-24 flex-shrink-0 sm:max-w-[120px]"
                placeholder="USD"
              />
              <Button size="sm" onClick={() => void saveDefaultCurrency()} disabled={currencySaving}>
                {currencySaving ? 'Saving...' : 'Save currency'}
              </Button>
            </div>
          </div>
  
          <div className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm">
            <h3 className="text-sm font-semibold tracking-tight">Pricing rules in this MVP</h3>
            <div className="mt-3 space-y-2 text-xs leading-relaxed text-slate-700 sm:text-sm sm:leading-normal">
              <p>1. Every service has one pricing setup.</p>
              <p>2. Pricing stays hidden from the chatbot unless the clinic explicitly turns it on.</p>
              <p>3. Hidden pricing still shows the service to patients, but the bot pushes consultation, booking, or lead capture instead.</p>
            </div>
          </div>
        </div>
      </div>
  
      {/* ── Service create/edit dialog ── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[85vh] sm:max-h-[90vh] sm:max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit service' : 'Add service'}</DialogTitle>
          </DialogHeader>
  
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="service-name">Service name</Label>
              <Input id="service-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
  
            <div className="space-y-2">
              <Label htmlFor="service-category">Category</Label>
              <Input id="service-category" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} placeholder="Cosmetic, General, Orthodontics" />
            </div>
  
            <div className="space-y-2">
              <Label htmlFor="service-duration">Duration (minutes)</Label>
              <Input id="service-duration" type="number" min={1} value={form.durationMinutes} onChange={(event) => setForm((current) => ({ ...current, durationMinutes: event.target.value }))} />
            </div>
  
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="service-description">Description</Label>
              <Textarea id="service-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} placeholder="What this service is, when it is used, and what the patient should know." />
            </div>
  
            <div className="space-y-2 sm:col-span-2">
              <Label>Pricing type</Label>
              <Select value={form.priceType} onValueChange={(value: PriceType) => setForm((current) => ({ ...current, priceType: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priceTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{selectedPriceType?.help}</p>
            </div>
  
            {(form.priceType === 'fixed' || form.priceType === 'starting_from') && (
              <div className="space-y-2">
                <Label htmlFor="service-price-amount">
                  {form.priceType === 'fixed' ? 'Price amount' : 'Starting amount'}
                </Label>
                <Input id="service-price-amount" type="number" min={0} value={form.priceAmount} onChange={(event) => setForm((current) => ({ ...current, priceAmount: event.target.value }))} />
              </div>
            )}
  
            {form.priceType === 'range' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="service-price-min">Minimum price</Label>
                  <Input id="service-price-min" type="number" min={0} value={form.priceMinAmount} onChange={(event) => setForm((current) => ({ ...current, priceMinAmount: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service-price-max">Maximum price</Label>
                  <Input id="service-price-max" type="number" min={0} value={form.priceMaxAmount} onChange={(event) => setForm((current) => ({ ...current, priceMaxAmount: event.target.value }))} />
                </div>
              </>
            )}
  
            <div className="space-y-2">
              <Label htmlFor="service-currency">Currency override</Label>
              <Input id="service-currency" value={form.priceCurrency} onChange={(event) => setForm((current) => ({ ...current, priceCurrency: event.target.value.toUpperCase() }))} maxLength={3} placeholder={defaultCurrency} />
              <p className="text-xs text-muted-foreground">Leave blank to use the clinic default: {defaultCurrency}</p>
            </div>
  
            <div className="space-y-2">
              <Label htmlFor="service-sort-order">Sort order</Label>
              <Input id="service-sort-order" type="number" min={1} value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} />
            </div>
  
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="service-pricing-note">Pricing note</Label>
              <Textarea id="service-pricing-note" value={form.pricingNote} onChange={(event) => setForm((current) => ({ ...current, pricingNote: event.target.value }))} rows={3} placeholder="Example: Final price may depend on x-rays, materials, or the severity of the case." />
            </div>
  
            <div className="rounded-lg border p-3 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Allow chatbot to share pricing</p>
                  <p className="text-xs text-muted-foreground">
                    Keep off to offer booking or a quote instead.
                  </p>
                </div>
                <Switch checked={form.isPriceVisibleToChatbot} onCheckedChange={(checked) => setForm((current) => ({ ...current, isPriceVisibleToChatbot: checked }))} />
              </div>
            </div>
  
            <div className="rounded-lg border p-3 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Requires consultation</p>
                  <p className="text-xs text-muted-foreground">
                    Bot reminds patients that confirmation depends on a consultation.
                  </p>
                </div>
                <Switch checked={form.requiresConsultation} onCheckedChange={(checked) => setForm((current) => ({ ...current, requiresConsultation: checked }))} />
              </div>
            </div>
  
            <div className="rounded-lg border p-3 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Service is active</p>
                  <p className="text-xs text-muted-foreground">
                    Inactive services stop appearing in the live clinic profile.
                  </p>
                </div>
                <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))} />
              </div>
            </div>
          </div>
  
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setModalOpen(false)} disabled={submitting}>Cancel</Button>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto" onClick={() => void saveService()} disabled={submitting}>
              {submitting ? 'Saving...' : form.id ? 'Save changes' : 'Create service'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

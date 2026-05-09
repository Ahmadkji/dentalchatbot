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
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Check, X, Pencil, Plus, Trash2, UserCog, Stethoscope } from 'lucide-react'
import { toast } from 'sonner'

interface Setting {
  id: string
  key: string
  value: string
  category: string
  description: string | null
  updatedAt: string
}

interface Doctor {
  id: string
  name: string
  specialization: string
  phone: string
  availableDays: string
  isActive: boolean
}

interface Service {
  id: string
  name: string
  description: string
  duration: string
  price: string | null
  department: string
  isActive: boolean
}

// Map setting keys to human-readable labels
const settingLabels: Record<string, string> = {
  clinic_name: 'Clinic Name',
  clinic_address: 'Clinic Address',
  clinic_phone: 'Clinic Phone',
  clinic_hours: 'Working Hours',
  whatsapp_number: 'WhatsApp Number',
  emergency_phone: 'Emergency Phone',
  parking_info: 'Parking Info',
  google_maps_url: 'Google Maps URL',
  ai_personality: 'AI Personality',
  bot_name: 'Bot Name',
  bot_welcome_message: 'Welcome Message',
  bot_primary_color: 'Primary Color',
  after_hours_message: 'After-Hours Message',
  auto_reply: 'Auto-Reply',
  faq_enabled: 'FAQ Bot',
  appointment_buffer: 'Buffer Between Appointments (min)',
  max_advance_booking: 'Max Advance Booking (days)',
  cancellation_policy: 'Cancellation Policy',
  slot_duration: 'Slot Duration (min)',
  greeting_message: 'Greeting Message',
  closing_message: 'Closing Message',
  emergency_response: 'Emergency Response',
}

// Determine which settings are boolean type
const booleanSettings = new Set(['auto_reply', 'faq_enabled'])

// Determine which settings are color type
const colorSettings = new Set(['bot_primary_color'])

// Determine which settings use textarea
const textareaSettings = new Set([
  'bot_welcome_message',
  'after_hours_message',
  'cancellation_policy',
  'greeting_message',
  'closing_message',
  'emergency_response',
  'parking_info',
  'clinic_address',
])

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

  if (colorSettings.has(settingKey)) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || '#059669'}
          onChange={(e) => {
            setEditValue(e.target.value)
            onSave(e.target.value)
          }}
          className="h-7 w-7 rounded cursor-pointer border"
        />
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave(editValue)
          }}
          onBlur={() => onSave(editValue)}
          className="h-7 text-sm w-24"
        />
      </div>
    )
  }

  if (editing) {
    const isTextarea = textareaSettings.has(settingKey)
    return (
      <div className="flex items-start gap-1">
        {isTextarea ? (
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.metaKey) {
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
            className="h-20 text-sm min-w-[200px]"
            autoFocus
          />
        ) : (
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
        )}
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

function DoctorsTab() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editDoctor, setEditDoctor] = useState<Doctor | null>(null)
  const [form, setForm] = useState({ name: '', specialization: '', phone: '', availableDays: 'Mon-Fri', isActive: true })

  const fetchDoctors = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/doctors')
      if (res.ok) {
        const data = await res.json()
        setDoctors(Array.isArray(data) ? data : (data.doctors || []))
      }
    } catch { toast.error('Failed to load doctors') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchDoctors() }, [])

  const openNew = () => {
    setEditDoctor(null)
    setForm({ name: '', specialization: '', phone: '', availableDays: 'Mon-Fri', isActive: true })
    setDialogOpen(true)
  }

  const openEdit = (d: Doctor) => {
    setEditDoctor(d)
    setForm({ name: d.name, specialization: d.specialization, phone: d.phone, availableDays: d.availableDays, isActive: d.isActive })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    try {
      if (editDoctor) {
        const res = await fetch(`/api/doctors/${editDoctor.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (res.ok) { toast.success('Doctor updated'); fetchDoctors(); setDialogOpen(false) }
      } else {
        const res = await fetch('/api/doctors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (res.ok) { toast.success('Doctor added'); fetchDoctors(); setDialogOpen(false) }
      }
    } catch { toast.error('Something went wrong') }
  }

  const toggleActive = async (d: Doctor) => {
    try {
      const res = await fetch(`/api/doctors/${d.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !d.isActive }),
      })
      if (res.ok) { fetchDoctors() }
    } catch { toast.error('Failed to update') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this doctor?')) return
    try {
      await fetch(`/api/doctors/${id}`, { method: 'DELETE' })
      toast.success('Doctor deleted')
      fetchDoctors()
    } catch { toast.error('Failed to delete') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCog className="size-4 text-emerald-600" />
          <h3 className="text-sm font-medium">Doctors</h3>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700" onClick={openNew}>
              <Plus className="size-3.5 mr-1" /> Add Doctor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editDoctor ? 'Edit Doctor' : 'New Doctor'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="Specialization" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
              <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input placeholder="Available days" value={form.availableDays} onChange={(e) => setForm({ ...form, availableDays: e.target.value })} />
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} /> Active</label>
              <Button onClick={handleSave} className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={!form.name || !form.specialization}>
                {editDoctor ? 'Update' : 'Add Doctor'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Specialization</TableHead>
              <TableHead className="hidden md:table-cell">Phone</TableHead>
              <TableHead className="hidden lg:table-cell">Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : doctors.length > 0 ? (
              doctors.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium text-sm">{d.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.specialization}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{d.phone || '—'}</TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{d.availableDays}</TableCell>
                  <TableCell>
                    <button onClick={() => toggleActive(d)}>
                      <Badge variant="outline" className={`text-[11px] ${d.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        {d.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(d)}>
                      <Pencil className="size-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDelete(d.id)}>
                      <Trash2 className="size-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">No doctors found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function ServicesTab() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editService, setEditService] = useState<Service | null>(null)
  const [form, setForm] = useState({ name: '', description: '', duration: '30 min', price: '', department: 'dental', isActive: true })

  const fetchServices = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/services')
      if (res.ok) {
        const data = await res.json()
        setServices(Array.isArray(data) ? data : (data.services || []))
      }
    } catch { toast.error('Failed to load services') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchServices() }, [])

  const openNew = () => {
    setEditService(null)
    setForm({ name: '', description: '', duration: '30 min', price: '', department: 'dental', isActive: true })
    setDialogOpen(true)
  }

  const openEdit = (s: Service) => {
    setEditService(s)
    setForm({ name: s.name, description: s.description, duration: s.duration, price: s.price || '', department: s.department, isActive: s.isActive })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    try {
      if (editService) {
        const res = await fetch(`/api/services/${editService.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (res.ok) { toast.success('Service updated'); fetchServices(); setDialogOpen(false) }
      } else {
        const res = await fetch('/api/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (res.ok) { toast.success('Service created'); fetchServices(); setDialogOpen(false) }
      }
    } catch { toast.error('Something went wrong') }
  }

  const toggleActive = async (s: Service) => {
    try {
      const res = await fetch(`/api/services/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !s.isActive }),
      })
      if (res.ok) { fetchServices() }
    } catch { toast.error('Failed to update') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this service?')) return
    try {
      await fetch(`/api/services/${id}`, { method: 'DELETE' })
      toast.success('Service deleted')
      fetchServices()
    } catch { toast.error('Failed to delete') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Stethoscope className="size-4 text-emerald-600" />
          <h3 className="text-sm font-medium">Services</h3>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700" onClick={openNew}>
              <Plus className="size-3.5 mr-1" /> Add Service
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editService ? 'Edit Service' : 'New Service'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Service name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Duration" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
                <Input placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <Input placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} /> Active</label>
              <Button onClick={handleSave} className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={!form.name || !form.description}>
                {editService ? 'Update' : 'Create Service'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Department</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : services.length > 0 ? (
              services.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium text-sm">{s.name}</div>
                      <div className="text-xs text-muted-foreground max-w-[180px] truncate">{s.description}</div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className="text-[10px]">{s.department}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{s.duration}</TableCell>
                  <TableCell className="text-sm font-medium">{s.price || '—'}</TableCell>
                  <TableCell>
                    <button onClick={() => toggleActive(s)}>
                      <Badge variant="outline" className={`text-[11px] ${s.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(s)}>
                      <Pencil className="size-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="size-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">No services found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
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

  const generalSettings = settings.filter((s) => s.category === 'general')
  const chatbotSettings = settings.filter((s) => s.category === 'chatbot')
  const schedulingSettings = settings.filter((s) => s.category === 'scheduling')
  const responseSettings = settings.filter((s) => s.category === 'responses')

  const renderSettingsTable = (categorySettings: Setting[]) => (
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
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-72 mb-4" />
        {['General', 'Chatbot', 'Scheduling', 'Responses'].map((cat) => (
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
    <Tabs defaultValue="general" className="space-y-4">
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="chatbot">Chatbot</TabsTrigger>
        <TabsTrigger value="doctors">Doctors</TabsTrigger>
        <TabsTrigger value="services">Services</TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="space-y-6">
        {generalSettings.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Clinic Information</h2>
            {renderSettingsTable(generalSettings)}
          </section>
        )}
        {schedulingSettings.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Scheduling</h2>
            {renderSettingsTable(schedulingSettings)}
          </section>
        )}
        {responseSettings.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Responses</h2>
            {renderSettingsTable(responseSettings)}
          </section>
        )}
      </TabsContent>

      <TabsContent value="chatbot" className="space-y-6">
        {chatbotSettings.length > 0 ? (
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Chatbot Configuration</h2>
            {renderSettingsTable(chatbotSettings)}
          </section>
        ) : (
          <div className="text-center text-muted-foreground py-12">
            No chatbot settings found. Check the database seed.
          </div>
        )}
      </TabsContent>

      <TabsContent value="doctors">
        <DoctorsTab />
      </TabsContent>

      <TabsContent value="services">
        <ServicesTab />
      </TabsContent>
    </Tabs>
  )
}

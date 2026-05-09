'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Search, Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface Service {
  id: string
  name: string
  description: string
  duration: string
  requiresAppointment: boolean
  preparationInstructions: string | null
  price: string | null
  department: string
  isActive: boolean
}

const departmentColors: Record<string, string> = {
  dental: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  general: 'bg-sky-50 text-sky-700 border-sky-200',
  cosmetic: 'bg-pink-50 text-pink-700 border-pink-200',
  physiotherapy: 'bg-amber-50 text-amber-700 border-amber-200',
}

function DepartmentBadge({ department }: { department: string }) {
  const colorClass = departmentColors[department] || 'bg-gray-50 text-gray-600 border-gray-200'
  return (
    <Badge variant="outline" className={`text-[11px] font-medium ${colorClass}`}>
      {department.charAt(0).toUpperCase() + department.slice(1)}
    </Badge>
  )
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="outline"
      className={`text-[11px] font-medium ${
        active
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-gray-50 text-gray-600 border-gray-200'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </Badge>
  )
}

const emptyForm = {
  name: '',
  description: '',
  duration: '30 min',
  requiresAppointment: true,
  preparationInstructions: '',
  price: '',
  department: 'dental',
  isActive: true,
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const fetchServices = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (departmentFilter && departmentFilter !== 'all') params.set('department', departmentFilter)
      const res = await fetch(`/api/services?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setServices(data.services || data || [])
      }
    } catch {
      toast.error('Failed to load services')
    } finally {
      setLoading(false)
    }
  }, [departmentFilter])

  useEffect(() => {
    fetchServices()
  }, [fetchServices])

  const filteredServices = services.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleAdd = async () => {
    if (!form.name.trim()) {
      toast.error('Service name is required')
      return
    }
    setSubmitting(true)
    try {
      const body = { ...form, price: form.price || null }
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success('Service added successfully')
        setAddDialogOpen(false)
        setForm(emptyForm)
        fetchServices()
      } else {
        toast.error('Failed to add service')
      }
    } catch {
      toast.error('Failed to add service')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async () => {
    if (!editingService) return
    if (!form.name.trim()) {
      toast.error('Service name is required')
      return
    }
    setSubmitting(true)
    try {
      const body = { ...form, price: form.price || null }
      const res = await fetch(`/api/services/${editingService.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success('Service updated successfully')
        setEditDialogOpen(false)
        setEditingService(null)
        setForm(emptyForm)
        fetchServices()
      } else {
        toast.error('Failed to update service')
      }
    } catch {
      toast.error('Failed to update service')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (service: Service) => {
    try {
      const res = await fetch(`/api/services/${service.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !service.isActive }),
      })
      if (res.ok) {
        toast.success(`Service ${service.isActive ? 'deactivated' : 'activated'}`)
        fetchServices()
      } else {
        toast.error('Failed to update service')
      }
    } catch {
      toast.error('Failed to update service')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/services/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Service deleted')
        fetchServices()
      } else {
        toast.error('Failed to delete service')
      }
    } catch {
      toast.error('Failed to delete service')
    }
  }

  const openEdit = (service: Service) => {
    setEditingService(service)
    setForm({
      name: service.name,
      description: service.description || '',
      duration: service.duration || '30 min',
      requiresAppointment: service.requiresAppointment,
      preparationInstructions: service.preparationInstructions || '',
      price: service.price || '',
      department: service.department,
      isActive: service.isActive,
    })
    setEditDialogOpen(true)
  }

  const renderForm = () => (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="svc-name">Name *</Label>
        <Input
          id="svc-name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Teeth Cleaning"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="svc-desc">Description</Label>
        <Textarea
          id="svc-desc"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Service description"
          rows={3}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="svc-duration">Duration</Label>
          <Input
            id="svc-duration"
            value={form.duration}
            onChange={(e) => setForm({ ...form, duration: e.target.value })}
            placeholder="30 min"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="svc-price">Price</Label>
          <Input
            id="svc-price"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            placeholder="$100"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="svc-dept">Department</Label>
          <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
            <SelectTrigger id="svc-dept">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dental">Dental</SelectItem>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="cosmetic">Cosmetic</SelectItem>
              <SelectItem value="physiotherapy">Physiotherapy</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch
            checked={form.requiresAppointment}
            onCheckedChange={(v) => setForm({ ...form, requiresAppointment: v })}
          />
          <Label>Appt Required</Label>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="svc-prep">Preparation Instructions</Label>
        <Textarea
          id="svc-prep"
          value={form.preparationInstructions}
          onChange={(e) => setForm({ ...form, preparationInstructions: e.target.value })}
          placeholder="Any preparation instructions for the patient"
          rows={2}
        />
      </div>
      <div className="flex items-center gap-3">
        <Switch
          checked={form.isActive}
          onCheckedChange={(v) => setForm({ ...form, isActive: v })}
        />
        <Label>Active</Label>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search services..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="h-8 w-[160px] text-sm">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            <SelectItem value="dental">Dental</SelectItem>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="cosmetic">Cosmetic</SelectItem>
            <SelectItem value="physiotherapy">Physiotherapy</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <Button
            size="sm"
            className="h-8 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => {
              setForm(emptyForm)
              setAddDialogOpen(true)
            }}
          >
            <Plus className="size-3.5 mr-1" />
            Add Service
          </Button>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Service</DialogTitle>
              <DialogDescription>Enter the service details below.</DialogDescription>
            </DialogHeader>
            {renderForm()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAdd}
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {submitting ? 'Adding...' : 'Add Service'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Services Table */}
      <div className="rounded-md border">
        <div className="max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="hidden md:table-cell">Duration</TableHead>
                <TableHead className="hidden md:table-cell">Price</TableHead>
                <TableHead className="hidden lg:table-cell">Appt Req.</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredServices.length > 0 ? (
                filteredServices.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell>
                      <DepartmentBadge department={service.department} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {service.duration}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {service.price || '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge
                        variant="outline"
                        className={`text-[11px] font-medium ${
                          service.requiresAppointment
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-gray-50 text-gray-600 border-gray-200'
                        }`}
                      >
                        {service.requiresAppointment ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <ActiveBadge active={service.isActive} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <MoreHorizontal className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(service)}>
                            <Pencil className="size-3.5 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(service)}>
                            {service.isActive ? 'Deactivate' : 'Activate'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(service.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No services found. Click &quot;Add Service&quot; to create one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
            <DialogDescription>Update the service details below.</DialogDescription>
          </DialogHeader>
          {renderForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

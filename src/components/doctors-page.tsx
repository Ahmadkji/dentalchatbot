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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Search, Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface Doctor {
  id: string
  name: string
  specialization: string
  phone: string
  availableDays: string
  isActive: boolean
}

const dayOptions = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
]

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

function parseAvailableDays(days: string): string[] {
  if (!days) return []
  // Try JSON parse first
  try {
    const parsed = JSON.parse(days)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // Not JSON, try comma-separated or "Mon-Fri" format
  }
  // Handle "Mon-Fri" style
  if (days.includes('-')) {
    const dayMap: Record<string, string> = {
      mon: 'mon', tue: 'tue', wed: 'wed', thu: 'thu', fri: 'fri', sat: 'sat', sun: 'sun',
      monday: 'mon', tuesday: 'tue', wednesday: 'wed', thursday: 'thu', friday: 'fri', saturday: 'sat', sunday: 'sun',
    }
    const parts = days.split('-').map((p) => p.trim().toLowerCase())
    if (parts.length === 2) {
      const startIdx = dayOptions.findIndex((d) => d.value === dayMap[parts[0]])
      const endIdx = dayOptions.findIndex((d) => d.value === dayMap[parts[1]])
      if (startIdx >= 0 && endIdx >= 0) {
        return dayOptions.slice(startIdx, endIdx + 1).map((d) => d.value)
      }
    }
  }
  // Handle comma-separated
  if (days.includes(',')) {
    return days.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean)
  }
  return []
}

function formatAvailableDays(days: string[]): string {
  return JSON.stringify(days)
}

const emptyForm = {
  name: '',
  specialization: '',
  phone: '',
  availableDays: ['mon', 'tue', 'wed', 'thu', 'fri'] as string[],
  isActive: true,
}

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const fetchDoctors = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/doctors')
      if (res.ok) {
        const data = await res.json()
        setDoctors(data.doctors || data || [])
      }
    } catch {
      toast.error('Failed to load doctors')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDoctors()
  }, [fetchDoctors])

  const filteredDoctors = doctors.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.specialization.toLowerCase().includes(search.toLowerCase())
  )

  const handleAdd = async () => {
    if (!form.name.trim()) {
      toast.error('Doctor name is required')
      return
    }
    setSubmitting(true)
    try {
      const body = {
        ...form,
        availableDays: formatAvailableDays(form.availableDays),
      }
      const res = await fetch('/api/doctors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success('Doctor added successfully')
        setAddDialogOpen(false)
        setForm(emptyForm)
        fetchDoctors()
      } else {
        toast.error('Failed to add doctor')
      }
    } catch {
      toast.error('Failed to add doctor')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = async () => {
    if (!editingDoctor) return
    if (!form.name.trim()) {
      toast.error('Doctor name is required')
      return
    }
    setSubmitting(true)
    try {
      const body = {
        ...form,
        availableDays: formatAvailableDays(form.availableDays),
      }
      const res = await fetch(`/api/doctors/${editingDoctor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success('Doctor updated successfully')
        setEditDialogOpen(false)
        setEditingDoctor(null)
        setForm(emptyForm)
        fetchDoctors()
      } else {
        toast.error('Failed to update doctor')
      }
    } catch {
      toast.error('Failed to update doctor')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (doctor: Doctor) => {
    try {
      const res = await fetch(`/api/doctors/${doctor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !doctor.isActive }),
      })
      if (res.ok) {
        toast.success(`Doctor ${doctor.isActive ? 'deactivated' : 'activated'}`)
        fetchDoctors()
      } else {
        toast.error('Failed to update doctor')
      }
    } catch {
      toast.error('Failed to update doctor')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/doctors/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Doctor deleted')
        fetchDoctors()
      } else {
        toast.error('Failed to delete doctor')
      }
    } catch {
      toast.error('Failed to delete doctor')
    }
  }

  const openEdit = (doctor: Doctor) => {
    setEditingDoctor(doctor)
    setForm({
      name: doctor.name,
      specialization: doctor.specialization || '',
      phone: doctor.phone || '',
      availableDays: parseAvailableDays(doctor.availableDays),
      isActive: doctor.isActive,
    })
    setEditDialogOpen(true)
  }

  const toggleDay = (day: string) => {
    setForm((prev) => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter((d) => d !== day)
        : [...prev.availableDays, day],
    }))
  }

  const renderForm = () => (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="doc-name">Name *</Label>
        <Input
          id="doc-name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Dr. John Smith"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="doc-spec">Specialization</Label>
        <Input
          id="doc-spec"
          value={form.specialization}
          onChange={(e) => setForm({ ...form, specialization: e.target.value })}
          placeholder="Orthodontics"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="doc-phone">Phone</Label>
        <Input
          id="doc-phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="(555) 123-4567"
        />
      </div>
      <div className="grid gap-2">
        <Label>Available Days</Label>
        <div className="flex flex-wrap gap-2">
          {dayOptions.map((day) => (
            <Button
              key={day.value}
              type="button"
              variant={form.availableDays.includes(day.value) ? 'default' : 'outline'}
              size="sm"
              className={`h-7 text-xs ${
                form.availableDays.includes(day.value)
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : ''
              }`}
              onClick={() => toggleDay(day.value)}
            >
              {day.label}
            </Button>
          ))}
        </div>
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

  const getDisplayDays = (doctor: Doctor) => {
    const days = parseAvailableDays(doctor.availableDays)
    if (days.length === 0) return doctor.availableDays || '—'
    return days
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full min-w-[180px] sm:max-w-sm sm:flex-1">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search doctors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <Button
            size="sm"
            className="h-8 w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto"
            onClick={() => {
              setForm(emptyForm)
              setAddDialogOpen(true)
            }}
          >
            <Plus className="size-3.5 mr-1" />
            Add Doctor
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Doctor</DialogTitle>
              <DialogDescription>Enter the doctor&apos;s information below.</DialogDescription>
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
                {submitting ? 'Adding...' : 'Add Doctor'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Doctors Table */}
      <div className="rounded-md border bg-white">
        <div className="max-h-[600px] overflow-y-auto">
          <Table className="min-w-[500px] sm:min-w-[600px]">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Specialization</TableHead>
                <TableHead className="hidden lg:table-cell">Phone</TableHead>
                <TableHead className="hidden md:table-cell">Available Days</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredDoctors.length > 0 ? (
                filteredDoctors.map((doctor) => {
                  const days = getDisplayDays(doctor)
                  return (
                    <TableRow key={doctor.id}>
                      <TableCell className="font-medium">{doctor.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {doctor.specialization || '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {doctor.phone || '—'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {Array.isArray(days) ? (
                          <div className="flex flex-wrap gap-1">
                            {days.map((day: string) => (
                              <Badge
                                key={day}
                                variant="outline"
                                className="text-[10px] font-medium bg-emerald-50 text-emerald-700 border-emerald-200 px-1.5 py-0"
                              >
                                {day.charAt(0).toUpperCase() + day.slice(1)}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">{days}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ActiveBadge active={doctor.isActive} />
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreHorizontal className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(doctor)}>
                              <Pencil className="size-3.5 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleActive(doctor)}>
                              {doctor.isActive ? 'Deactivate' : 'Activate'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(doctor.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="size-3.5 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No doctors found. Click &quot;Add Doctor&quot; to add one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Doctor</DialogTitle>
            <DialogDescription>Update the doctor&apos;s information below.</DialogDescription>
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

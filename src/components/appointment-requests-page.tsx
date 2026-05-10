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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  CheckCircle,
  XCircle,
  CalendarDays,
} from 'lucide-react'
import { toast } from 'sonner'

interface AppointmentRequest {
  id: string
  name: string
  phone: string
  preferredDate: string
  preferredTime: string
  reason: string
  preferredDoctor: string | null
  status: string
  source: string
  createdAt: string
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

function StatusBadge({ status }: { status: string }) {
  const colorClass = statusColors[status] || 'bg-gray-50 text-gray-600 border-gray-200'
  return (
    <Badge variant="outline" className={`text-[11px] font-medium ${colorClass}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}

const emptyForm = {
  name: '',
  phone: '',
  preferredDate: '',
  preferredTime: '',
  reason: '',
  preferredDoctor: '',
  source: 'website',
}

export default function AppointmentRequestsPage() {
  const [requests, setRequests] = useState<AppointmentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<AppointmentRequest | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/appointment-requests?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setRequests(data.appointmentRequests || data.requests || data || [])
      }
    } catch {
      toast.error('Failed to load appointment requests')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const filteredRequests = requests.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.phone || '').includes(search) ||
      (r.reason || '').toLowerCase().includes(search.toLowerCase())
    const matchesDate = !dateFilter || r.preferredDate === dateFilter
    return matchesSearch && matchesDate
  })

  const handleAdd = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    if (!form.phone.trim()) {
      toast.error('Phone is required')
      return
    }
    if (!form.preferredDate) {
      toast.error('Preferred date is required')
      return
    }
    if (!form.preferredTime) {
      toast.error('Preferred time is required')
      return
    }
    setSubmitting(true)
    try {
      const body = {
        ...form,
        preferredDoctor: form.preferredDoctor || null,
      }
      const res = await fetch('/api/appointment-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success('Appointment request added successfully')
        setAddDialogOpen(false)
        setForm(emptyForm)
        fetchRequests()
      } else {
        toast.error('Failed to add appointment request')
      }
    } catch {
      toast.error('Failed to add appointment request')
    } finally {
      setSubmitting(false)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/appointment-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        toast.success(`Request ${status}`)
        fetchRequests()
      } else {
        toast.error('Failed to update status')
      }
    } catch {
      toast.error('Failed to update status')
    }
  }

  const openDetail = (request: AppointmentRequest) => {
    setSelectedRequest(request)
    setDetailDialogOpen(true)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '—'
    return timeStr
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs px-3 h-6">All</TabsTrigger>
            <TabsTrigger value="pending" className="text-xs px-3 h-6">Pending</TabsTrigger>
            <TabsTrigger value="confirmed" className="text-xs px-3 h-6">Confirmed</TabsTrigger>
            <TabsTrigger value="cancelled" className="text-xs px-3 h-6">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full min-w-[180px] sm:max-w-sm sm:flex-1">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search requests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <CalendarDays className="size-3.5 text-muted-foreground" />
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-8 w-full text-sm sm:w-[150px]"
          />
          {dateFilter && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => setDateFilter('')}
            >
              Clear
            </Button>
          )}
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
            Add Request
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Appointment Request</DialogTitle>
              <DialogDescription>Enter the appointment request details below.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="ar-name">Name *</Label>
                <Input
                  id="ar-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ar-phone">Phone</Label>
                <Input
                  id="ar-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="ar-date">Preferred Date</Label>
                  <Input
                    id="ar-date"
                    type="date"
                    value={form.preferredDate}
                    onChange={(e) => setForm({ ...form, preferredDate: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ar-time">Preferred Time</Label>
                  <Input
                    id="ar-time"
                    type="time"
                    value={form.preferredTime}
                    onChange={(e) => setForm({ ...form, preferredTime: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ar-reason">Reason</Label>
                <Textarea
                  id="ar-reason"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Reason for appointment"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Preferred Doctor</Label>
                  <Input
                    value={form.preferredDoctor}
                    onChange={(e) => setForm({ ...form, preferredDoctor: e.target.value })}
                    placeholder="Any available"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Source</Label>
                  <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="chatbot">Chatbot</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="walk-in">Walk-in</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAdd}
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {submitting ? 'Adding...' : 'Add Request'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Appointment Requests Table */}
      <div className="rounded-md border bg-white">
        <div className="max-h-[600px] overflow-y-auto">
          <Table className="min-w-[560px] sm:min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden md:table-cell">Pref. Date</TableHead>
                <TableHead className="hidden lg:table-cell">Pref. Time</TableHead>
                <TableHead className="hidden lg:table-cell">Reason</TableHead>
                <TableHead className="hidden lg:table-cell">Pref. Doctor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Source</TableHead>
                <TableHead className="hidden lg:table-cell">Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredRequests.length > 0 ? (
                filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {request.phone || '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                      {formatDate(request.preferredDate)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                      {formatTime(request.preferredTime)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground max-w-[150px] truncate">
                      {request.reason || '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                      {request.preferredDoctor || '—'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={request.status} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                      {request.source
                        ? request.source.charAt(0).toUpperCase() + request.source.slice(1)
                        : '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                      {formatDate(request.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {request.status === 'pending' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              onClick={() => updateStatus(request.id, 'confirmed')}
                              title="Confirm"
                            >
                              <CheckCircle className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => updateStatus(request.id, 'cancelled')}
                              title="Cancel"
                            >
                              <XCircle className="size-3.5" />
                            </Button>
                          </>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreHorizontal className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetail(request)}>
                              <Eye className="size-3.5 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => updateStatus(request.id, 'pending')}>
                              <span className="size-2 rounded-full bg-amber-400 mr-2" />
                              Pending
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(request.id, 'confirmed')}>
                              <span className="size-2 rounded-full bg-emerald-400 mr-2" />
                              Confirmed
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(request.id, 'cancelled')}>
                              <span className="size-2 rounded-full bg-red-400 mr-2" />
                              Cancelled
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    No appointment requests found. Adjust filters or add a new request.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
            <DialogDescription>Full information for this appointment request.</DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Name</p>
                  <p className="text-sm font-medium">{selectedRequest.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Phone</p>
                  <p className="text-sm">{selectedRequest.phone || '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Preferred Date</p>
                  <p className="text-sm">{formatDate(selectedRequest.preferredDate)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Preferred Time</p>
                  <p className="text-sm">{formatTime(selectedRequest.preferredTime)}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Preferred Doctor</p>
                  <p className="text-sm">{selectedRequest.preferredDoctor || 'Any available'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Source</p>
                  <p className="text-sm">
                    {selectedRequest.source
                      ? selectedRequest.source.charAt(0).toUpperCase() + selectedRequest.source.slice(1)
                      : '—'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <StatusBadge status={selectedRequest.status} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Created</p>
                  <p className="text-sm">{formatDate(selectedRequest.createdAt)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Reason</p>
                <p className="text-sm whitespace-pre-wrap">
                  {selectedRequest.reason || 'No reason provided'}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            {selectedRequest && selectedRequest.status === 'pending' && (
              <div className="flex gap-2 w-full sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => {
                    updateStatus(selectedRequest.id, 'cancelled')
                    setDetailDialogOpen(false)
                  }}
                >
                  <XCircle className="size-3.5 mr-1" />
                  Cancel Request
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    updateStatus(selectedRequest.id, 'confirmed')
                    setDetailDialogOpen(false)
                  }}
                >
                  <CheckCircle className="size-3.5 mr-1" />
                  Confirm
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

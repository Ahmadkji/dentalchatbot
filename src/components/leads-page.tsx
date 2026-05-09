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
import { Search, Plus, MoreHorizontal, Eye, PhoneCall, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

interface Lead {
  id: string
  name: string
  phone: string
  question: string
  preferredContact: string
  source: string
  status: string
  createdAt: string
}

const statusColors: Record<string, string> = {
  new: 'bg-sky-50 text-sky-700 border-sky-200',
  contacted: 'bg-amber-50 text-amber-700 border-amber-200',
  qualified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  lost: 'bg-gray-50 text-gray-600 border-gray-200',
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
  question: '',
  preferredContact: 'phone',
  source: 'website',
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/leads?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setLeads(data.leads || data || [])
      }
    } catch {
      toast.error('Failed to load leads')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  const filteredLeads = leads.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    (l.phone || '').includes(search) ||
    (l.question || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleAdd = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    if (!form.phone.trim()) {
      toast.error('Phone is required')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        toast.success('Lead added successfully')
        setAddDialogOpen(false)
        setForm(emptyForm)
        fetchLeads()
      } else {
        toast.error('Failed to add lead')
      }
    } catch {
      toast.error('Failed to add lead')
    } finally {
      setSubmitting(false)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        toast.success(`Status updated to ${status}`)
        fetchLeads()
      } else {
        toast.error('Failed to update status')
      }
    } catch {
      toast.error('Failed to update status')
    }
  }

  const openDetail = (lead: Lead) => {
    setSelectedLead(lead)
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs px-3 h-6">All</TabsTrigger>
            <TabsTrigger value="new" className="text-xs px-3 h-6">New</TabsTrigger>
            <TabsTrigger value="contacted" className="text-xs px-3 h-6">Contacted</TabsTrigger>
            <TabsTrigger value="qualified" className="text-xs px-3 h-6">Qualified</TabsTrigger>
            <TabsTrigger value="lost" className="text-xs px-3 h-6">Lost</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-sm min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
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
            Add Lead
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Lead</DialogTitle>
              <DialogDescription>Enter the lead&apos;s information below.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="lead-name">Name *</Label>
                <Input
                  id="lead-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lead-phone">Phone</Label>
                <Input
                  id="lead-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lead-question">Question</Label>
                <Textarea
                  id="lead-question"
                  value={form.question}
                  onChange={(e) => setForm({ ...form, question: e.target.value })}
                  placeholder="What is the lead asking about?"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Preferred Contact</Label>
                  <Select
                    value={form.preferredContact}
                    onValueChange={(v) => setForm({ ...form, preferredContact: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                    </SelectContent>
                  </Select>
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
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="social">Social Media</SelectItem>
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
                {submitting ? 'Adding...' : 'Add Lead'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Leads Table */}
      <div className="rounded-md border">
        <div className="max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">Question</TableHead>
                <TableHead className="hidden lg:table-cell">Pref. Contact</TableHead>
                <TableHead className="hidden md:table-cell">Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredLeads.length > 0 ? (
                filteredLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {lead.phone || '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground max-w-[200px] truncate">
                      {lead.question || '—'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
                      {lead.preferredContact
                        ? lead.preferredContact.charAt(0).toUpperCase() + lead.preferredContact.slice(1)
                        : '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                      {lead.source
                        ? lead.source.charAt(0).toUpperCase() + lead.source.slice(1)
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={lead.status} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                      {formatDate(lead.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => openDetail(lead)}
                        >
                          <Eye className="size-3.5" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreHorizontal className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetail(lead)}>
                              <Eye className="size-3.5 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {lead.status === 'new' && (
                              <DropdownMenuItem onClick={() => updateStatus(lead.id, 'contacted')}>
                                <PhoneCall className="size-3.5 mr-2" />
                                Mark as Contacted
                              </DropdownMenuItem>
                            )}
                            {(lead.status === 'new' || lead.status === 'contacted') && (
                              <DropdownMenuItem onClick={() => updateStatus(lead.id, 'qualified')}>
                                <CheckCircle className="size-3.5 mr-2" />
                                Mark as Qualified
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => updateStatus(lead.id, 'new')}>
                              New
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(lead.id, 'contacted')}>
                              Contacted
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(lead.id, 'qualified')}>
                              Qualified
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(lead.id, 'lost')}>
                              Lost
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No leads found. Adjust filters or add a new lead.
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
            <DialogTitle>Lead Details</DialogTitle>
            <DialogDescription>Full information for this lead.</DialogDescription>
          </DialogHeader>
          {selectedLead && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Name</p>
                  <p className="text-sm font-medium">{selectedLead.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Phone</p>
                  <p className="text-sm">{selectedLead.phone || '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Preferred Contact</p>
                  <p className="text-sm">
                    {selectedLead.preferredContact
                      ? selectedLead.preferredContact.charAt(0).toUpperCase() +
                        selectedLead.preferredContact.slice(1)
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Source</p>
                  <p className="text-sm">
                    {selectedLead.source
                      ? selectedLead.source.charAt(0).toUpperCase() + selectedLead.source.slice(1)
                      : '—'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <StatusBadge status={selectedLead.status} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Created</p>
                  <p className="text-sm">{formatDate(selectedLead.createdAt)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Question</p>
                <p className="text-sm whitespace-pre-wrap">
                  {selectedLead.question || 'No question provided'}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            {selectedLead && (
              <div className="flex gap-2 w-full sm:justify-end">
                {selectedLead.status === 'new' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-amber-700 border-amber-200 hover:bg-amber-50"
                    onClick={() => {
                      updateStatus(selectedLead.id, 'contacted')
                      setDetailDialogOpen(false)
                    }}
                  >
                    <PhoneCall className="size-3.5 mr-1" />
                    Mark Contacted
                  </Button>
                )}
                {(selectedLead.status === 'new' || selectedLead.status === 'contacted') && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      updateStatus(selectedLead.id, 'qualified')
                      setDetailDialogOpen(false)
                    }}
                  >
                    <CheckCircle className="size-3.5 mr-1" />
                    Mark Qualified
                  </Button>
                )}
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

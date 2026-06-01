'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Search, MoreHorizontal, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { useRefetchOnFocus } from '@/hooks/use-refetch-on-focus'
import LeadCollectionSettings from './lead-collection-settings'

interface Lead {
  id: string
  conversationId: string | null
  name: string
  phone: string
  email?: string | null
  question: string
  service?: string | null
  preferredDate?: string | null
  preferredTime?: string | null
  message?: string | null
  internalNote?: string | null
  preferredContact: string
  source: string
  status: string
  closedReason?: string | null
  lastContactedAt?: string | null
  createdAt: string
  updatedAt: string
}

const statusColors: Record<string, string> = {
  new: 'bg-sky-50 text-sky-700 border-sky-200',
  contacted: 'bg-amber-50 text-amber-700 border-amber-200',
  booked: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed: 'bg-gray-50 text-gray-600 border-gray-200',
  spam: 'bg-red-50 text-red-700 border-red-200',
}

function StatusBadge({ status }: { status: string }) {
  const colorClass = statusColors[status] || 'bg-gray-50 text-gray-600 border-gray-200'
  return (
    <Badge variant="outline" className={`text-[11px] font-medium ${colorClass}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [activeTab, setActiveTab] = useState<'leads' | 'settings'>('leads')

  // Track whether the first successful load has completed.
  // Used to keep existing data visible during background re-fetches
  // (tab focus, post-mutation refresh) instead of flashing skeletons.
  const hasLoadedRef = useRef(false)

  const fetchLeads = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', '1')
      params.set('pageSize', '1000')
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/leads?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to load leads')
      const data = await res.json()
      const nextLeads = data.leads || data || []
      setLeads(nextLeads)
      setTotalCount(
        typeof data.totalCount === 'number'
          ? data.totalCount
          : Array.isArray(nextLeads)
            ? nextLeads.length
            : 0,
      )
      hasLoadedRef.current = true
    } catch (error) {
      console.error('[LeadsPage] Failed to fetch leads', {
        error: error instanceof Error ? error.message : String(error),
      })
      toast.error('Failed to load leads')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchLeads()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [fetchLeads])

  // Re-fetch leads when user switches back to this tab.
  // Disabled while the detail dialog is open to avoid disrupting the user's view.
  useRefetchOnFocus(fetchLeads, !detailDialogOpen)

  const filteredLeads = leads.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    (l.phone || '').includes(search) ||
    (l.question || '').toLowerCase().includes(search.toLowerCase())
  )

  const updateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update status')
      toast.success(`Status updated to ${status}`)
      fetchLeads()
    } catch (error) {
      console.error('[LeadsPage] Failed to update lead status', {
        leadId: id,
        status,
        error: error instanceof Error ? error.message : String(error),
      })
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
      {/* Page-level tab switcher */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'leads' | 'settings')}>
        <TabsList>
          <TabsTrigger value="leads" className="text-xs">Leads</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs">Collection Settings</TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === 'leads' ? (
      <>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs px-3 h-6">All</TabsTrigger>
            <TabsTrigger value="new" className="text-xs px-3 h-6">New</TabsTrigger>
            <TabsTrigger value="contacted" className="text-xs px-3 h-6">Contacted</TabsTrigger>
            <TabsTrigger value="booked" className="text-xs px-3 h-6">Booked</TabsTrigger>
            <TabsTrigger value="closed" className="text-xs px-3 h-6">Closed</TabsTrigger>
            <TabsTrigger value="spam" className="text-xs px-3 h-6">Spam</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full min-w-[180px] sm:max-w-sm sm:flex-1">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      {/* Leads Table */}
      {totalCount > leads.length ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Showing the first {leads.length} of {totalCount} leads. Search currently works across the loaded leads only.
        </div>
      ) : null}
      <div className="rounded-md border bg-white">
        <div className="max-h-[600px] overflow-y-auto">
          <Table className="min-w-[540px] sm:min-w-[700px]">
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">Question</TableHead>
                <TableHead className="hidden xl:table-cell">Service</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
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
                    <TableCell className="hidden xl:table-cell text-muted-foreground text-xs">
                      {lead.service || '—'}
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
                            <DropdownMenuItem onClick={() => updateStatus(lead.id, 'new')}>
                              Mark as New
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(lead.id, 'contacted')}>
                              Mark as Contacted
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(lead.id, 'booked')}>
                              Mark as Booked
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(lead.id, 'closed')}>
                              Mark as Closed
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(lead.id, 'spam')}>
                              Mark as Spam
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No leads found. Adjust filters or wait for new chat leads.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Lead Details</DialogTitle>
            <DialogDescription>Full information for this lead.</DialogDescription>
          </DialogHeader>
          {selectedLead && (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableBody>
                  <TableRow>
                    <TableHead className="w-[140px] bg-slate-50/80">Name</TableHead>
                    <TableCell className="font-medium">{selectedLead.name}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead className="bg-slate-50/80">Phone</TableHead>
                    <TableCell>{selectedLead.phone || '—'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead className="bg-slate-50/80">Email</TableHead>
                    <TableCell>{selectedLead.email || '—'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead className="bg-slate-50/80">Service</TableHead>
                    <TableCell>{selectedLead.service || '—'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead className="bg-slate-50/80">Preferred Date</TableHead>
                    <TableCell>{selectedLead.preferredDate || '—'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead className="bg-slate-50/80">Preferred Contact</TableHead>
                    <TableCell className="capitalize">{selectedLead.preferredContact || '—'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead className="bg-slate-50/80">Source</TableHead>
                    <TableCell className="uppercase text-xs">{selectedLead.source || '—'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead className="bg-slate-50/80">Status</TableHead>
                    <TableCell><StatusBadge status={selectedLead.status} /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead className="bg-slate-50/80">Created</TableHead>
                    <TableCell>{formatDate(selectedLead.createdAt)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableHead className="bg-slate-50/80">Question</TableHead>
                    <TableCell className="whitespace-pre-wrap">{selectedLead.question || 'No question provided'}</TableCell>
                  </TableRow>
                  {selectedLead.message && (
                    <TableRow>
                      <TableHead className="bg-slate-50/80">Message</TableHead>
                      <TableCell className="whitespace-pre-wrap">{selectedLead.message}</TableCell>
                    </TableRow>
                  )}
                  {selectedLead.internalNote && (
                    <TableRow>
                      <TableHead className="bg-slate-50/80">Internal Note</TableHead>
                      <TableCell className="whitespace-pre-wrap">{selectedLead.internalNote}</TableCell>
                    </TableRow>
                  )}
                  {selectedLead.closedReason && (
                    <TableRow>
                      <TableHead className="bg-slate-50/80">Closed Reason</TableHead>
                      <TableCell>{selectedLead.closedReason}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      ) : (
        <LeadCollectionSettings />
      )}
    </div>
  )
}

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
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Search, Eye, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'

interface Conversation {
  id: string
  patientName: string
  patientId?: string
  channel: string
  subject: string
  messageCount: number
  lastMessage: string
  status: string
  sourcePage?: string | null
  helpfulStatus?: 'helpful' | 'not_helpful' | 'unreviewed'
  needsImprovement?: boolean
  leadCaptured?: boolean
  appointmentRequested?: boolean
  whatsappClicks?: number
  locationClicks?: number
  directionsClicks?: number
  callClicks?: number
  createdAt: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    closed: 'bg-gray-50 text-gray-600 border-gray-200',
  }
  return (
    <Badge variant="outline" className={`text-[11px] font-medium ${variants[status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}

function ReviewBadge({ value }: { value?: Conversation['helpfulStatus'] }) {
  const status = value || 'unreviewed'
  const variants: Record<string, string> = {
    helpful: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    not_helpful: 'bg-red-50 text-red-700 border-red-200',
    unreviewed: 'bg-gray-50 text-gray-600 border-gray-200',
  }

  return (
    <Badge variant="outline" className={`text-[11px] font-medium ${variants[status] || variants.unreviewed}`}>
      {status.replace('_', ' ')}
    </Badge>
  )
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  const fetchConversations = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (search) params.set('search', search)
      const res = await fetch(`/api/conversations?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations || data || [])
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error)
      toast.error('Failed to load conversations')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchConversations()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [fetchConversations])

  const openConversation = async (conv: Conversation) => {
    setSelectedConv(conv)
    setSheetOpen(true)
    setMessagesLoading(true)
    try {
      const res = await fetch(`/api/conversations/${conv.id}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error)
      toast.error('Failed to load messages')
    } finally {
      setMessagesLoading(false)
    }
  }

  const updateStatus = async (convId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        toast.success(`Conversation ${newStatus === 'closed' ? 'closed' : 'reopened'}`)
        fetchConversations()
        if (selectedConv?.id === convId) {
          setSelectedConv({ ...selectedConv, status: newStatus })
        }
      } else {
        toast.error('Failed to update status')
      }
    } catch {
      toast.error('Failed to update status')
    }
  }

  const updateConversationMeta = async (convId: string, payload: Record<string, unknown>, successMessage: string) => {
    try {
      const res = await fetch(`/api/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to update')
      toast.success(successMessage)

      if (payload.helpfulStatus === 'not_helpful' && selectedConv?.id === convId && selectedConv.lastMessage) {
        await fetch('/api/unanswered-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: convId,
            question: selectedConv.lastMessage,
            sourcePage: selectedConv.sourcePage || '/',
          }),
        })
      }

      void fetchConversations()
      if (selectedConv?.id === convId) {
        setSelectedConv((prev) => (prev ? { ...prev, ...payload } : prev))
      }
    } catch {
      toast.error('Failed to update conversation')
    }
  }

  const filteredConversations = conversations.filter((conv) => {
    if (statusFilter !== 'all' && conv.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        conv.patientName?.toLowerCase().includes(q) ||
        conv.subject?.toLowerCase().includes(q) ||
        conv.channel?.toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="overflow-x-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="closed">Closed</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:ml-auto sm:w-64">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search inbox..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      {/* Conversations Table */}
      <div className="rounded-md border bg-white">
        <Table className="min-w-[520px] sm:min-w-[700px]">
          <TableHeader>
            <TableRow>
              <TableHead>Visitor</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead className="hidden md:table-cell">Subject</TableHead>
              <TableHead className="text-center">Messages</TableHead>
              <TableHead className="hidden lg:table-cell">Last Message</TableHead>
              <TableHead className="hidden xl:table-cell">Review</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredConversations.length > 0 ? (
              filteredConversations.map((conv) => (
                <TableRow
                  key={conv.id}
                  className="cursor-pointer"
                  onClick={() => openConversation(conv)}
                >
                  <TableCell className="font-medium">{conv.patientName}</TableCell>
                  <TableCell className="text-muted-foreground text-xs uppercase">
                    {conv.channel}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground max-w-[180px] truncate">
                    {conv.subject || '—'}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">{conv.messageCount}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground max-w-[200px] truncate text-xs">
                    {conv.lastMessage || '—'}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <ReviewBadge value={conv.helpfulStatus} />
                  </TableCell>
                  <TableCell><StatusBadge status={conv.status} /></TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                    {conv.createdAt ? new Date(conv.createdAt).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => openConversation(conv)}
                      >
                        <Eye className="size-3.5" />
                      </Button>
                      <Select
                        value={conv.status}
                        onValueChange={(val) => updateStatus(conv.id, val)}
                      >
                        <SelectTrigger className="h-7 w-7 p-0 border-0">
                          <MoreHorizontal className="size-3.5 text-muted-foreground" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No conversations found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
      </Table>
      </div>

      {/* Conversation Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="sm:max-w-lg w-full p-0 gap-0 flex flex-col">
          {/* Header - fixed at top */}
          <SheetHeader className="p-4 pb-3 border-b shrink-0">
            <SheetTitle className="text-base">
              {selectedConv?.patientName || 'Conversation'}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {selectedConv?.channel && (
                <span className="uppercase">{selectedConv.channel}</span>
              )}
              {selectedConv?.subject && ` — ${selectedConv.subject}`}
            </SheetDescription>
          </SheetHeader>

          {/* Scrollable body */}
          <ScrollArea className="flex-1 overflow-hidden">
            <div className="p-4 space-y-4">
              {/* Status row */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status:</span>
                {selectedConv && <StatusBadge status={selectedConv.status} />}
                {selectedConv && selectedConv.status !== 'closed' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs ml-auto"
                    onClick={() => updateStatus(selectedConv.id, 'closed')}
                  >
                    Close
                  </Button>
                )}
                {selectedConv && selectedConv.status === 'closed' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs ml-auto"
                    onClick={() => updateStatus(selectedConv.id, 'active')}
                  >
                    Reopen
                  </Button>
                )}
              </div>

              {/* Metadata grid */}
              {selectedConv && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground">Source Page</p>
                      <p className="truncate" title={selectedConv.sourcePage || undefined}>{selectedConv.sourcePage || '—'}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground">Review</p>
                      <ReviewBadge value={selectedConv.helpfulStatus} />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground">Lead Captured</p>
                      <p>{selectedConv.leadCaptured ? 'Yes' : 'No'}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground">Appointment Intent</p>
                      <p>{selectedConv.appointmentRequested ? 'Yes' : 'No'}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground">WhatsApp Clicks</p>
                      <p>{selectedConv.whatsappClicks || 0}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground">Location Clicks</p>
                      <p>{(selectedConv.locationClicks || 0) + (selectedConv.directionsClicks || 0)}</p>
                    </div>
                    <div className="col-span-2 sm:col-span-1 space-y-0.5">
                      <p className="text-muted-foreground">Call Clicks</p>
                      <p>{selectedConv.callClicks || 0}</p>
                    </div>
                  </div>

                  {/* Review actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateConversationMeta(selectedConv.id, { helpfulStatus: 'helpful', needsImprovement: false }, 'Marked as helpful')}>
                      Helpful
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateConversationMeta(selectedConv.id, { helpfulStatus: 'not_helpful', needsImprovement: true }, 'Marked for improvement')}>
                      Not Helpful
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateConversationMeta(selectedConv.id, { needsImprovement: !selectedConv.needsImprovement }, selectedConv.needsImprovement ? 'Marked resolved' : 'Added to improvement queue')}>
                      {selectedConv.needsImprovement ? 'Resolve' : 'Needs Improvement'}
                    </Button>
                  </div>
                </div>
              )}

              <Separator />

              {/* Messages */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-3">Messages</h4>
                {messagesLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                        <Skeleton className="h-12 w-3/4" />
                      </div>
                    ))}
                  </div>
                ) : messages.length > 0 ? (
                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                            msg.role === 'user'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-muted text-foreground'
                          }`
                        }
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <p
                            className={`mt-1 text-[10px] ${
                              msg.role === 'user' ? 'text-emerald-100' : 'text-muted-foreground'
                            }`
                          }
                          >
                            {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8 text-sm">No messages found</p>
                )}
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  )
}

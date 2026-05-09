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
    fetchConversations()
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="closed">Closed</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      {/* Conversations Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead className="hidden md:table-cell">Subject</TableHead>
              <TableHead className="text-center">Messages</TableHead>
              <TableHead className="hidden lg:table-cell">Last Message</TableHead>
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
                        <SelectTrigger className="h-7 w-7 p-0 border-0" size="sm">
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
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No conversations found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Conversation Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
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
          <div className="mt-4 flex items-center gap-2">
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
          <Separator className="my-3" />
          <ScrollArea className="h-[calc(100vh-220px)]">
            {messagesLoading ? (
              <div className="space-y-3 p-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-3/4" />
                ))}
              </div>
            ) : messages.length > 0 ? (
              <div className="space-y-3 p-2">
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
                      }`}
                    >
                      <p>{msg.content}</p>
                      <p
                        className={`mt-1 text-[10px] ${
                          msg.role === 'user' ? 'text-emerald-100' : 'text-muted-foreground'
                        }`}
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
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  )
}

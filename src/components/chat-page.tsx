'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Bot, Send, Plus, User, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

interface ChatConversation {
  id: string
  patientName: string
  lastMessage: string
  status: string
  createdAt: string
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchConversations = useCallback(async () => {
    setLoadingConvs(true)
    try {
      const res = await fetch('/api/conversations')
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations || data || [])
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error)
    } finally {
      setLoadingConvs(false)
    }
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  const fetchMessages = useCallback(async (convId: string) => {
    setLoadingMessages(true)
    try {
      const res = await fetch(`/api/conversations/${convId}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error)
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    if (activeConvId) {
      fetchMessages(activeConvId)
    } else {
      setMessages([])
    }
  }, [activeConvId, fetchMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const message = input.trim()
    if (!message || sending) return

    const tempId = `temp-${Date.now()}`
    const userMessage: ChatMessage = {
      id: tempId,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setSending(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          conversationId: activeConvId || undefined,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const assistantMessage: ChatMessage = {
          id: data.messageId || `resp-${Date.now()}`,
          role: 'assistant',
          content: data.response || data.message || 'I understand your question. Let me help you with that.',
          createdAt: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, assistantMessage])

        if (!activeConvId && data.conversationId) {
          setActiveConvId(data.conversationId)
          fetchConversations()
        }
      } else {
        toast.error('Failed to send message')
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
      }
    } catch {
      toast.error('Failed to send message')
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const startNewChat = () => {
    setActiveConvId(null)
    setMessages([])
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-0 border rounded-md overflow-hidden">
      {/* Left Panel - Conversations List */}
      <div className="w-72 border-r bg-white flex flex-col shrink-0 hidden md:flex">
        <div className="p-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-medium">Conversations</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={startNewChat}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {loadingConvs ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : conversations.length > 0 ? (
            <div className="p-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors ${
                    activeConvId === conv.id
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="font-medium truncate text-xs">{conv.patientName || 'Unknown'}</div>
                  <div className="text-muted-foreground text-xs truncate mt-0.5">
                    {conv.lastMessage || 'No messages'}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground text-xs py-6">No conversations yet</p>
          )}
        </ScrollArea>
      </div>

      {/* Right Panel - Chat */}
      <div className="flex-1 flex flex-col bg-gray-50/50">
        {/* Chat Header */}
        <div className="px-4 py-2.5 border-b bg-white flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-full bg-emerald-100">
            <Bot className="size-3.5 text-emerald-700" />
          </div>
          <div>
            <p className="text-sm font-medium">DentBot Assistant</p>
            <p className="text-[10px] text-muted-foreground">
              {activeConvId ? 'Active conversation' : 'New conversation'}
            </p>
          </div>
          <Badge variant="outline" className="ml-auto text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
            <Sparkles className="size-2.5 mr-0.5" />
            AI Powered
          </Badge>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          {loadingMessages ? (
            <div className="space-y-3 max-w-2xl mx-auto">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-3/4" />
              ))}
            </div>
          ) : messages.length > 0 ? (
            <div className="space-y-4 max-w-2xl mx-auto">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-2 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`flex size-7 items-center justify-center rounded-full shrink-0 mt-0.5 ${
                      msg.role === 'user' ? 'bg-emerald-600' : 'bg-white border'
                    }`}>
                      {msg.role === 'user' ? (
                        <User className="size-3.5 text-white" />
                      ) : (
                        <Bot className="size-3.5 text-emerald-600" />
                      )}
                    </div>
                    <div>
                      <div
                        className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white border shadow-sm text-foreground'
                        }`}
                      >
                        {msg.content}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 px-1">
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 mb-4">
                <Bot className="size-7 text-emerald-600" />
              </div>
              <h3 className="font-medium text-sm mb-1">DentBot AI Assistant</h3>
              <p className="text-muted-foreground text-xs max-w-sm">
                Ask me anything about dental procedures, appointment scheduling, patient care, or let me help manage your clinic workflow.
              </p>
              <div className="flex flex-wrap gap-2 mt-4 max-w-sm justify-center">
                {['Schedule an appointment', 'Patient checkup info', 'Opening hours', 'Dental cleaning FAQ'].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="text-xs border rounded-full px-3 py-1.5 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="p-3 border-t bg-white">
          <div className="flex gap-2 max-w-2xl mx-auto">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="h-9 text-sm"
              disabled={sending}
            />
            <Button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              size="sm"
              className="h-9 bg-emerald-600 hover:bg-emerald-700 px-3"
            >
              <Send className="size-3.5" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-1.5">
            DentBot may produce inaccurate information. Always verify clinical advice.
          </p>
        </div>
      </div>
    </div>
  )
}

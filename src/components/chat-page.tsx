'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Bot,
  Send,
  Plus,
  User,
  Sparkles,
  Phone,
  MessageCircle,
  Mail,
  ExternalLink,
  Navigation,
  MapPin,
  Clock,
  Calendar,
  HelpCircle,
  Stethoscope,
} from 'lucide-react'
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

interface ClinicSettings {
  clinic_name: string
  clinic_address: string
  clinic_phone: string
  clinic_hours: string
  whatsapp_number: string
  emergency_phone: string
  parking_info: string
  google_maps_url: string
  bot_name: string
  bot_welcome_message: string
  bot_primary_color: string
  after_hours_message: string
}

const DEFAULT_SETTINGS: ClinicSettings = {
  clinic_name: 'BrightSmile Dental Clinic',
  clinic_address: '123 Smile Avenue, Suite 200, Springfield, IL 62704',
  clinic_phone: '(555) 100-2000',
  clinic_hours: 'Mon-Fri: 8am-6pm, Sat: 9am-2pm',
  whatsapp_number: '15551002000',
  emergency_phone: '(555) 100-2001',
  parking_info: 'Free parking in building garage. Enter from Elm Street, validated for 2 hours.',
  google_maps_url: 'https://maps.google.com/?q=123+Smile+Avenue+Springfield+IL',
  bot_name: 'DentBot',
  bot_welcome_message: "Hello! Welcome to BrightSmile Dental Clinic. I'm DentBot, your AI dental assistant. How can I help you today?",
  bot_primary_color: '#059669',
  after_hours_message: "We're currently closed. Leave a message and we'll respond when we open.",
}

function isAfterHours(hours: string): boolean {
  const now = new Date()
  const day = now.getDay()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const currentTime = hour * 60 + minute

  // Sunday is always closed
  if (day === 0) return true

  // Saturday: 9am-2pm
  if (day === 6) {
    const open = 9 * 60
    const close = 14 * 60
    return currentTime < open || currentTime >= close
  }

  // Weekdays: 8am-6pm
  const open = 8 * 60
  const close = 18 * 60
  return currentTime < open || currentTime >= close
}

function WhatsAppButton({ number }: { number: string }) {
  const url = `https://wa.me/${number}?text=${encodeURIComponent('Hi, I would like to inquire about your dental services.')}`
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700 text-white text-xs gap-1.5">
        <Phone className="size-3" />
        Chat on WhatsApp
      </Button>
    </a>
  )
}

function LocationCard({ settings }: { settings: ClinicSettings }) {
  return (
    <Card className="border-emerald-200 bg-emerald-50/50">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <MapPin className="size-4 text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">{settings.clinic_name}</p>
            <p className="text-xs text-muted-foreground">{settings.clinic_address}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <a href={settings.google_maps_url} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1">
              <ExternalLink className="size-3" />
              Open in Google Maps
            </Button>
          </a>
          <a href={settings.google_maps_url} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1">
              <Navigation className="size-3" />
              Get Directions
            </Button>
          </a>
        </div>
        {settings.parking_info && (
          <p className="text-[11px] text-muted-foreground">🅿️ {settings.parking_info}</p>
        )}
      </CardContent>
    </Card>
  )
}

function AfterHoursCard({ settings }: { settings: ClinicSettings }) {
  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-amber-600" />
          <p className="text-sm font-medium">After Hours</p>
        </div>
        <p className="text-xs text-muted-foreground">{settings.clinic_hours}</p>
        {settings.emergency_phone && (
          <a href={`tel:${settings.emergency_phone}`}>
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 border-amber-300 text-amber-700">
              <Phone className="size-3" />
              Emergency: {settings.emergency_phone}
            </Button>
          </a>
        )}
      </CardContent>
    </Card>
  )
}

function StaffHandoff({ settings }: { settings: ClinicSettings }) {
  const whatsappUrl = `https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent('Hi, I would like to inquire about your dental services.')}`
  return (
    <Card className="border-emerald-200 bg-emerald-50/30">
      <CardContent className="p-3 space-y-2">
        <p className="text-xs font-medium text-emerald-700">Need to speak with our team?</p>
        <div className="flex flex-wrap gap-1.5">
          {settings.clinic_phone && (
            <a href={`tel:${settings.clinic_phone}`}>
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1">
                <Phone className="size-3" />
                Call Clinic
              </Button>
            </a>
          )}
          {settings.whatsapp_number && (
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 text-green-600 border-green-300">
                <MessageCircle className="size-3" />
                WhatsApp
              </Button>
            </a>
          )}
          <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => toast.info('Message sent! We\'ll respond during business hours.')}>
            <Mail className="size-3" />
            Leave Message
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function StructuredMessage({ content, settings }: { content: string; settings: ClinicSettings }) {
  const lower = content.toLowerCase()
  const showWhatsApp = lower.includes('whatsapp') || lower.includes('whats app')
  const showLocation = lower.includes('location') || lower.includes('address') || lower.includes('direction') || lower.includes('find us') || lower.includes('where') || lower.includes('located')
  const showAfterHours = lower.includes('closed') || lower.includes('after hours') || lower.includes('after-hours') || lower.includes('after hour')
  const showHandoff = lower.includes('call us') || lower.includes('contact us') || lower.includes('call our') || lower.includes('reach us') || lower.includes('speak with') || lower.includes('talk to') || lower.includes('our team') || lower.includes('our staff')

  return (
    <div className="space-y-2">
      <div className="whitespace-pre-wrap">{content}</div>
      <div className="space-y-2 mt-2">
        {showLocation && <LocationCard settings={settings} />}
        {showWhatsApp && <WhatsAppButton number={settings.whatsapp_number} />}
        {showAfterHours && <AfterHoursCard settings={settings} />}
        {showHandoff && <StaffHandoff settings={settings} />}
      </div>
    </div>
  )
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [settings, setSettings] = useState<ClinicSettings>(DEFAULT_SETTINGS)
  const [afterHours, setAfterHours] = useState(false)
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

  // Fetch clinic settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data = await res.json()
          const settingsList = data.settings || []
          const settingsMap: Record<string, string> = {}
          settingsList.forEach((s: { key: string; value: string }) => {
            settingsMap[s.key] = s.value
          })
          setSettings({
            clinic_name: settingsMap.clinic_name || DEFAULT_SETTINGS.clinic_name,
            clinic_address: settingsMap.clinic_address || DEFAULT_SETTINGS.clinic_address,
            clinic_phone: settingsMap.clinic_phone || DEFAULT_SETTINGS.clinic_phone,
            clinic_hours: settingsMap.clinic_hours || DEFAULT_SETTINGS.clinic_hours,
            whatsapp_number: settingsMap.whatsapp_number || DEFAULT_SETTINGS.whatsapp_number,
            emergency_phone: settingsMap.emergency_phone || DEFAULT_SETTINGS.emergency_phone,
            parking_info: settingsMap.parking_info || DEFAULT_SETTINGS.parking_info,
            google_maps_url: settingsMap.google_maps_url || DEFAULT_SETTINGS.google_maps_url,
            bot_name: settingsMap.bot_name || DEFAULT_SETTINGS.bot_name,
            bot_welcome_message: settingsMap.bot_welcome_message || DEFAULT_SETTINGS.bot_welcome_message,
            bot_primary_color: settingsMap.bot_primary_color || DEFAULT_SETTINGS.bot_primary_color,
            after_hours_message: settingsMap.after_hours_message || DEFAULT_SETTINGS.after_hours_message,
          })
          setAfterHours(isAfterHours(settingsMap.clinic_hours || DEFAULT_SETTINGS.clinic_hours))
        }
      } catch {
        // Use defaults
        setAfterHours(isAfterHours(DEFAULT_SETTINGS.clinic_hours))
      }
    }
    fetchSettings()
  }, [])

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

  const handleSend = async (messageText?: string) => {
    const message = (messageText || input).trim()
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

  const quickReplies = [
    { emoji: '📅', label: 'Book Appointment', message: "I'd like to book an appointment" },
    { emoji: '📍', label: 'Clinic Location', message: 'Where is the clinic located?' },
    { emoji: '🕐', label: 'Opening Hours', message: 'What are your opening hours?' },
    { emoji: '🦷', label: 'Our Services', message: 'What dental services do you offer?' },
    { emoji: '💬', label: 'Chat on WhatsApp', message: 'How can I contact you on WhatsApp?' },
    { emoji: '❓', label: 'FAQs', message: 'What are your frequently asked questions?' },
  ]

  const quickActionButtons = [
    { label: 'Book Appointment', icon: Calendar, message: "I'd like to book an appointment" },
    { label: 'Location', icon: MapPin, message: 'Where is the clinic located?' },
    { label: 'Hours', icon: Clock, message: 'What are your opening hours?' },
    { label: 'WhatsApp', icon: MessageCircle, message: 'How can I contact you on WhatsApp?' },
    { label: 'Services', icon: Stethoscope, message: 'What dental services do you offer?' },
  ]

  const botName = settings.bot_name || 'DentBot'

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-0 border rounded-md overflow-hidden">
      {/* Left Panel - Conversations List */}
      <div className="w-72 border-r bg-white flex flex-col shrink-0 hidden md:flex">
        <div className="p-3 border-b flex items-center justify-between">
          <h3 className="text-sm font-medium">Conversations</h3>
          <Button
            variant="default"
            size="sm"
            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 gap-1"
            onClick={startNewChat}
          >
            <Plus className="size-3" />
            New Chat
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
            <p className="text-sm font-medium">{botName} Assistant</p>
            <p className="text-[10px] text-muted-foreground">
              {activeConvId ? 'Active conversation' : 'New conversation'}
            </p>
          </div>
          <Badge variant="outline" className="ml-auto text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
            <Sparkles className="size-2.5 mr-0.5" />
            AI Powered
          </Badge>
        </div>

        {/* After-Hours Banner */}
        {afterHours && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
            <span className="text-sm">🟡</span>
            <p className="text-xs text-amber-700">{settings.after_hours_message}</p>
          </div>
        )}

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
                  <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
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
                        {msg.role === 'assistant' ? (
                          <StructuredMessage content={msg.content} settings={settings} />
                        ) : (
                          msg.content
                        )}
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
            /* Welcome Screen */
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="flex size-16 items-center justify-center rounded-full bg-emerald-50 mb-4">
                <Bot className="size-8 text-emerald-600" />
              </div>
              <h3 className="font-medium text-base mb-1">{botName} AI Assistant</h3>
              <p className="text-muted-foreground text-sm max-w-md mb-6">
                {settings.bot_welcome_message}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-w-lg">
                {quickReplies.map((qr) => (
                  <button
                    key={qr.label}
                    onClick={() => handleSend(qr.message)}
                    className="flex items-center gap-1.5 border rounded-lg px-3 py-2.5 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors text-left"
                  >
                    <span className="text-base">{qr.emoji}</span>
                    <span className="text-xs font-medium">{qr.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Quick Reply Buttons Bar */}
        <div className="px-4 py-1.5 border-t bg-white flex gap-1.5 overflow-x-auto">
          {quickActionButtons.map((btn) => (
            <button
              key={btn.label}
              onClick={() => handleSend(btn.message)}
              className="flex items-center gap-1 border rounded-full px-2.5 py-1 text-[11px] hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0"
            >
              <btn.icon className="size-3" />
              {btn.label}
            </button>
          ))}
        </div>

        {/* Input Area */}
        <div className="p-3 border-t bg-white">
          <div className="flex gap-2 max-w-2xl mx-auto">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${botName}...`}
              className="h-9 text-sm"
              disabled={sending}
            />
            <Button
              onClick={() => handleSend()}
              disabled={sending || !input.trim()}
              size="sm"
              className="h-9 bg-emerald-600 hover:bg-emerald-700 px-3"
            >
              <Send className="size-3.5" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-1.5">
            {botName} may produce inaccurate information. Always verify clinical advice.
          </p>
        </div>
      </div>
    </div>
  )
}

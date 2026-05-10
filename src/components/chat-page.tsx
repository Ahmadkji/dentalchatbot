'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  PanelLeft,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'

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
  input_placeholder?: string
  cta_text?: string
  cta_link?: string
}

interface QuickPrompt {
  id: string
  label: string
  message: string
  actionType: 'message' | 'appointment' | 'link'
  actionValue: string | null
  isActive: boolean
}

interface Service {
  id: string
  name: string
  description: string
  price: string | null
  isActive: boolean
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
  bot_name: 'BrightSmile AI',
  bot_welcome_message: "Hello! I'm BrightSmile AI, your website assistant for appointments, treatments, and clinic details. How can I help?",
  bot_primary_color: '#059669',
  after_hours_message: "We're currently closed. Leave a message and we'll respond when we open.",
  input_placeholder: 'Ask about treatments, pricing, timings, or appointments...',
  cta_text: 'Book Appointment',
  cta_link: '',
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

function WhatsAppButton({ number, onTrack }: { number: string; onTrack?: () => void }) {
  const url = `https://wa.me/${number}?text=${encodeURIComponent('Hi, I would like to inquire about your dental services.')}`
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={onTrack}>
      <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700 text-white text-xs gap-1.5">
        <Phone className="size-3" />
        Chat on WhatsApp
      </Button>
    </a>
  )
}

function LocationCard({ settings, onLocationClick, onDirectionsClick }: { settings: ClinicSettings; onLocationClick?: () => void; onDirectionsClick?: () => void }) {
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
          <a href={settings.google_maps_url} target="_blank" rel="noopener noreferrer" onClick={onLocationClick}>
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1">
              <ExternalLink className="size-3" />
              Open in Google Maps
            </Button>
          </a>
          <a href={settings.google_maps_url} target="_blank" rel="noopener noreferrer" onClick={onDirectionsClick}>
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

function StaffHandoff({ settings, onCallClick, onWhatsAppClick }: { settings: ClinicSettings; onCallClick?: () => void; onWhatsAppClick?: () => void }) {
  const whatsappUrl = `https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent('Hi, I would like to inquire about your dental services.')}`
  return (
    <Card className="border-emerald-200 bg-emerald-50/30">
      <CardContent className="p-3 space-y-2">
        <p className="text-xs font-medium text-emerald-700">Need to speak with our team?</p>
        <div className="flex flex-wrap gap-1.5">
          {settings.clinic_phone && (
            <a href={`tel:${settings.clinic_phone}`} onClick={onCallClick}>
              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1">
                <Phone className="size-3" />
                Call Clinic
              </Button>
            </a>
          )}
          {settings.whatsapp_number && (
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={onWhatsAppClick}>
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

function ServiceCards({
  services,
  onAsk,
  onBook,
}: {
  services: Service[]
  onAsk: (service: Service) => void
  onBook: (service: Service) => void
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {services.slice(0, 6).map((service) => (
        <Card key={service.id} className="border-slate-200 bg-white">
          <CardContent className="p-3 space-y-2">
            <p className="text-sm font-medium">{service.name}</p>
            <p className="text-xs text-muted-foreground line-clamp-2">{service.description}</p>
            {service.price && <p className="text-xs text-emerald-700 font-medium">Starting from {service.price}</p>}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => onAsk(service)}>
                Ask about this
              </Button>
              <Button size="sm" className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700" onClick={() => onBook(service)}>
                Book appointment
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function StructuredMessage({
  content,
  settings,
  services,
  onAskService,
  onBookService,
  onTrackWhatsApp,
  onTrackCall,
  onTrackLocation,
  onTrackDirections,
}: {
  content: string
  settings: ClinicSettings
  services: Service[]
  onAskService: (service: Service) => void
  onBookService: (service: Service) => void
  onTrackWhatsApp: () => void
  onTrackCall: () => void
  onTrackLocation: () => void
  onTrackDirections: () => void
}) {
  const lower = content.toLowerCase()
  const showWhatsApp = lower.includes('whatsapp') || lower.includes('whats app')
  const showLocation = lower.includes('location') || lower.includes('address') || lower.includes('direction') || lower.includes('find us') || lower.includes('where') || lower.includes('located')
  const showAfterHours = lower.includes('closed') || lower.includes('after hours') || lower.includes('after-hours') || lower.includes('after hour')
  const showHandoff = lower.includes('call us') || lower.includes('contact us') || lower.includes('call our') || lower.includes('reach us') || lower.includes('speak with') || lower.includes('talk to') || lower.includes('our team') || lower.includes('our staff')
  const showServiceCards = lower.includes('service') || lower.includes('treatment') || lower.includes('do you offer') || lower.includes('what do you offer')

  return (
    <div className="space-y-2">
      <div className="whitespace-pre-wrap">{content}</div>
      <div className="space-y-2 mt-2">
        {showLocation && <LocationCard settings={settings} onLocationClick={onTrackLocation} onDirectionsClick={onTrackDirections} />}
        {showWhatsApp && <WhatsAppButton number={settings.whatsapp_number} onTrack={onTrackWhatsApp} />}
        {showAfterHours && <AfterHoursCard settings={settings} />}
        {showHandoff && <StaffHandoff settings={settings} onCallClick={onTrackCall} onWhatsAppClick={onTrackWhatsApp} />}
        {showServiceCards && services.length > 0 && (
          <ServiceCards
            services={services}
            onAsk={onAskService}
            onBook={onBookService}
          />
        )}
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
  const [services, setServices] = useState<Service[]>([])
  const [quickPrompts, setQuickPrompts] = useState<QuickPrompt[]>([])
  const [afterHours, setAfterHours] = useState(false)
  const [appointmentOpen, setAppointmentOpen] = useState(false)
  const [appointmentSubmitting, setAppointmentSubmitting] = useState(false)
  const [appointmentForm, setAppointmentForm] = useState({
    name: '',
    phone: '',
    service: '',
    preferredDate: '',
    preferredTime: '',
    preferredDoctor: '',
    forSelfOrChild: '',
    hadBracesBefore: '',
    wantsConsultation: '',
    message: '',
  })
  const [mobileConvOpen, setMobileConvOpen] = useState(false)
  const isMobile = useIsMobile()
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
    const timer = window.setTimeout(() => {
      void fetchConversations()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [fetchConversations])

  useEffect(() => {
    async function fetchServices() {
      try {
        const res = await fetch('/api/services')
        if (!res.ok) return
        const data = await res.json()
        const allServices = Array.isArray(data) ? data : (data.services || [])
        setServices(allServices.filter((service: Service) => service.isActive !== false))
      } catch {
        setServices([])
      }
    }

    void fetchServices()
  }, [])

  // Fetch clinic settings
  useEffect(() => {
    async function fetchSettings() {
      try {
        const [settingsRes, clinicRes, widgetRes, promptsRes] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/clinic'),
          fetch('/api/widget-settings'),
          fetch('/api/widget-settings/quick-prompts'),
        ])

        const settingsMap: Record<string, string> = {}
        if (settingsRes.ok) {
          const data = await settingsRes.json()
          const settingsList = data.settings || []
          settingsList.forEach((s: { key: string; value: string }) => {
            settingsMap[s.key] = s.value
          })
        }

        let clinic: Partial<ClinicSettings> & {
          name?: string
          address?: string
          primaryPhone?: string
          whatsappNumber?: string
          openingHours?: string
          emergencyInstructions?: string
        } = {}

        if (clinicRes.ok) {
          clinic = await clinicRes.json()
        }

        let widgetSettings: Partial<ClinicSettings> & {
          botName?: string
          welcomeMessage?: string
          inputPlaceholder?: string
          ctaText?: string
          ctaLink?: string
        } = {}

        if (widgetRes.ok) {
          widgetSettings = await widgetRes.json()
        }

        if (promptsRes.ok) {
          const promptsData = await promptsRes.json()
          setQuickPrompts((Array.isArray(promptsData) ? promptsData : []).filter((prompt) => prompt.isActive))
        }

        const mergedSettings = {
          clinic_name: clinic.clinic_name || clinic.name || settingsMap.clinic_name || DEFAULT_SETTINGS.clinic_name,
          clinic_address: clinic.clinic_address || clinic.address || settingsMap.clinic_address || DEFAULT_SETTINGS.clinic_address,
          clinic_phone: clinic.clinic_phone || clinic.primaryPhone || settingsMap.clinic_phone || DEFAULT_SETTINGS.clinic_phone,
          clinic_hours: clinic.clinic_hours || clinic.openingHours || settingsMap.clinic_hours || DEFAULT_SETTINGS.clinic_hours,
          whatsapp_number: clinic.whatsapp_number || clinic.whatsappNumber || settingsMap.whatsapp_number || DEFAULT_SETTINGS.whatsapp_number,
          emergency_phone: settingsMap.emergency_phone || DEFAULT_SETTINGS.emergency_phone,
          parking_info: settingsMap.parking_info || DEFAULT_SETTINGS.parking_info,
          google_maps_url: settingsMap.google_maps_url || DEFAULT_SETTINGS.google_maps_url,
          bot_name: widgetSettings.botName || settingsMap.bot_name || DEFAULT_SETTINGS.bot_name,
          bot_welcome_message: widgetSettings.welcomeMessage || settingsMap.bot_welcome_message || DEFAULT_SETTINGS.bot_welcome_message,
          bot_primary_color: settingsMap.bot_primary_color || DEFAULT_SETTINGS.bot_primary_color,
          after_hours_message: settingsMap.after_hours_message || clinic.emergencyInstructions || DEFAULT_SETTINGS.after_hours_message,
          input_placeholder: widgetSettings.inputPlaceholder || DEFAULT_SETTINGS.input_placeholder,
          cta_text: widgetSettings.ctaText || DEFAULT_SETTINGS.cta_text,
          cta_link: widgetSettings.ctaLink || DEFAULT_SETTINGS.cta_link,
        }

        setSettings(mergedSettings)
        setAfterHours(isAfterHours(mergedSettings.clinic_hours))
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
      const timer = window.setTimeout(() => {
        void fetchMessages(activeConvId)
      }, 0)

      return () => window.clearTimeout(timer)
    } else {
      const timer = window.setTimeout(() => {
        setMessages([])
      }, 0)

      return () => window.clearTimeout(timer)
    }
  }, [activeConvId, fetchMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const trackEvent = useCallback(async (eventType: 'whatsapp_click' | 'call_click' | 'location_click' | 'directions_click' | 'appointment_request', service?: string) => {
    try {
      await fetch('/api/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConvId || null,
          eventType,
          source: 'playground',
          service: service || null,
        }),
      })
    } catch {
      // analytics events are non-blocking
    }
  }, [activeConvId])

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

  const quickReplies = quickPrompts.length > 0
    ? quickPrompts
    : [
        { id: 'default-1', label: 'Book Appointment', message: "I'd like to book an appointment", actionType: 'appointment', actionValue: null, isActive: true },
        { id: 'default-2', label: 'Tooth Pain', message: 'I have tooth pain. What should I do?', actionType: 'message', actionValue: null, isActive: true },
        { id: 'default-3', label: 'Braces', message: 'Tell me about braces and aligners.', actionType: 'message', actionValue: null, isActive: true },
        { id: 'default-4', label: 'Root Canal', message: 'Tell me about root canal treatment.', actionType: 'message', actionValue: null, isActive: true },
        { id: 'default-5', label: 'Teeth Cleaning', message: 'What is included in dental cleaning?', actionType: 'message', actionValue: null, isActive: true },
        { id: 'default-6', label: 'Clinic Location', message: 'Where is the clinic located?', actionType: 'message', actionValue: null, isActive: true },
        { id: 'default-7', label: 'WhatsApp Clinic', message: 'How can I contact you on WhatsApp?', actionType: 'link', actionValue: settings.cta_link || null, isActive: true },
        { id: 'default-8', label: 'Consultation Fee', message: 'What is the consultation fee?', actionType: 'message', actionValue: null, isActive: true },
      ]

  const quickActionButtons = quickReplies.slice(0, 5)

  const handlePromptAction = (prompt: QuickPrompt) => {
    if (prompt.actionType === 'appointment') {
      setAppointmentOpen(true)
      return
    }

    if (prompt.actionType === 'link' && prompt.actionValue) {
      void trackEvent('whatsapp_click')
      window.open(prompt.actionValue, '_blank', 'noopener,noreferrer')
      return
    }

    void handleSend(prompt.message)
  }

  const handleAppointmentSubmit = async () => {
    if (!appointmentForm.name.trim() || !appointmentForm.phone.trim() || !appointmentForm.preferredDate.trim() || !appointmentForm.preferredTime.trim()) {
      toast.error('Name, phone, preferred date, and preferred time are required')
      return
    }

    setAppointmentSubmitting(true)
    try {
      const reason = `${appointmentForm.service ? `${appointmentForm.service}. ` : ''}${appointmentForm.message}`.trim()
      const qualificationNotes = [
        appointmentForm.forSelfOrChild ? `For: ${appointmentForm.forSelfOrChild}` : null,
        appointmentForm.hadBracesBefore ? `Braces before: ${appointmentForm.hadBracesBefore}` : null,
        appointmentForm.wantsConsultation ? `Consultation intent: ${appointmentForm.wantsConsultation}` : null,
      ].filter(Boolean).join(' | ')

      const [leadRes, requestRes] = await Promise.all([
        fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: appointmentForm.name,
            phone: appointmentForm.phone,
            question: reason || 'Appointment request from chat widget',
            service: appointmentForm.service || null,
            preferredDate: appointmentForm.preferredDate,
            preferredTime: appointmentForm.preferredTime,
            message: appointmentForm.message || null,
            internalNote: qualificationNotes || null,
            preferredContact: 'phone',
            source: 'chatbot',
          }),
        }),
        fetch('/api/appointment-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: appointmentForm.name,
            phone: appointmentForm.phone,
            preferredDate: appointmentForm.preferredDate,
            preferredTime: appointmentForm.preferredTime,
            reason,
            preferredDoctor: appointmentForm.preferredDoctor || null,
            source: 'chatbot',
          }),
        }),
      ])

      if (!leadRes.ok || !requestRes.ok) throw new Error('Failed to create appointment request')

      const confirmationMessage = `I want to request an appointment. Name: ${appointmentForm.name}. Phone: ${appointmentForm.phone}. Service: ${appointmentForm.service || 'Not specified'}. Preferred date: ${appointmentForm.preferredDate}. Preferred time: ${appointmentForm.preferredTime}. Notes: ${appointmentForm.message || 'None'}.`

      setAppointmentOpen(false)
      setAppointmentForm({
        name: '',
        phone: '',
        service: '',
        preferredDate: '',
        preferredTime: '',
        preferredDoctor: '',
        forSelfOrChild: '',
        hadBracesBefore: '',
        wantsConsultation: '',
        message: '',
      })
      void trackEvent('appointment_request', appointmentForm.service || undefined)
      toast.success('Appointment request captured')
      void handleSend(confirmationMessage)
    } catch {
      toast.error('Failed to capture appointment request')
    } finally {
      setAppointmentSubmitting(false)
    }
  }

  const botName = settings.bot_name || 'BrightSmile AI'

  const askAboutService = (service: Service) => {
    void handleSend(`Tell me more about ${service.name}, including price and preparation instructions.`)
  }

  const bookForService = (service: Service) => {
    setAppointmentForm((prev) => ({ ...prev, service: service.name }))
    setAppointmentOpen(true)
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] sm:h-[calc(100vh-12rem)] gap-0 border rounded-md overflow-hidden">
      {/* Left Panel - Conversations List (Desktop) */}
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

      {/* Mobile Conversation Sheet */}
      <Sheet open={mobileConvOpen} onOpenChange={setMobileConvOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="p-3 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-sm">Conversations</SheetTitle>
              <Button
                variant="default"
                size="sm"
                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 gap-1"
                onClick={() => { startNewChat(); setMobileConvOpen(false) }}
              >
                <Plus className="size-3" />
                New Chat
              </Button>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
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
                    onClick={() => { setActiveConvId(conv.id); setMobileConvOpen(false) }}
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
          </div>
        </SheetContent>
      </Sheet>

      {/* Right Panel - Chat */}
      <div className="flex-1 flex flex-col bg-gray-50/50 min-w-0">
        {/* Chat Header */}
        <div className="px-3 sm:px-4 py-2.5 border-b bg-white flex items-center gap-2">
          {/* Mobile: conversation list toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 md:hidden"
            onClick={() => setMobileConvOpen(true)}
          >
            <PanelLeft className="size-4" />
          </Button>
          <div className="flex size-7 items-center justify-center rounded-full bg-emerald-100">
            <Bot className="size-3.5 text-emerald-700" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{botName} Assistant</p>
            <p className="text-[10px] text-muted-foreground">
              {activeConvId ? 'Active conversation' : 'New conversation'}
            </p>
          </div>
          {/* Mobile: New Chat button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 md:hidden"
            onClick={startNewChat}
          >
            <Plus className="size-4" />
          </Button>
          <Badge variant="outline" className="ml-auto text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 hidden sm:inline-flex">
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
                          <StructuredMessage
                            content={msg.content}
                            settings={settings}
                            services={services}
                            onAskService={askAboutService}
                            onBookService={bookForService}
                            onTrackWhatsApp={() => void trackEvent('whatsapp_click')}
                            onTrackCall={() => void trackEvent('call_click')}
                            onTrackLocation={() => void trackEvent('location_click')}
                            onTrackDirections={() => void trackEvent('directions_click')}
                          />
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
                    key={qr.id}
                    onClick={() => handlePromptAction(qr)}
                    className="flex items-center gap-1.5 border rounded-lg px-3 py-2.5 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors text-left"
                  >
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
              key={btn.id}
              onClick={() => handlePromptAction(btn)}
              className="flex items-center gap-1 border rounded-full px-2.5 py-1 text-[11px] hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0"
            >
              {btn.label}
            </button>
          ))}
          {settings.cta_text && settings.cta_link && (
            <a
              href={settings.cta_link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void trackEvent('whatsapp_click')}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] whitespace-nowrap shrink-0 text-white"
              style={{ backgroundColor: settings.bot_primary_color }}
            >
              {settings.cta_text}
            </a>
          )}
        </div>

          <div className="p-3 sm:p-4 border-t bg-white">
          <div className="flex gap-2 max-w-2xl mx-auto">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={settings.input_placeholder || `Message ${botName}...`}
              className="h-10 sm:h-9 text-sm"
              disabled={sending}
            />
            <Button
              onClick={() => handleSend()}
              disabled={sending || !input.trim()}
              size="sm"
              className="h-10 sm:h-9 bg-emerald-600 hover:bg-emerald-700 px-3"
            >
              <Send className="size-3.5" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-1.5">
            {botName} may produce inaccurate information. Always verify clinical advice.
          </p>
        </div>
      </div>

      <Dialog open={appointmentOpen} onOpenChange={setAppointmentOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Appointment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={appointmentForm.name} onChange={(e) => setAppointmentForm((prev) => ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Phone Number</Label>
              <Input value={appointmentForm.phone} onChange={(e) => setAppointmentForm((prev) => ({ ...prev, phone: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Service Needed</Label>
              <Input value={appointmentForm.service} onChange={(e) => setAppointmentForm((prev) => ({ ...prev, service: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Preferred Date</Label>
                <Input type="date" value={appointmentForm.preferredDate} onChange={(e) => setAppointmentForm((prev) => ({ ...prev, preferredDate: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Preferred Time</Label>
                <Input type="time" value={appointmentForm.preferredTime} onChange={(e) => setAppointmentForm((prev) => ({ ...prev, preferredTime: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Preferred Doctor (optional)</Label>
              <Input value={appointmentForm.preferredDoctor} onChange={(e) => setAppointmentForm((prev) => ({ ...prev, preferredDoctor: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 gap-3 rounded-md border bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-700">Quick qualification (non-medical)</p>
              <div className="grid gap-2">
                <Label>Is this for yourself or a child?</Label>
                <Input value={appointmentForm.forSelfOrChild} onChange={(e) => setAppointmentForm((prev) => ({ ...prev, forSelfOrChild: e.target.value }))} placeholder="Myself / Child" />
              </div>
              <div className="grid gap-2">
                <Label>Have you had braces before? (optional)</Label>
                <Input value={appointmentForm.hadBracesBefore} onChange={(e) => setAppointmentForm((prev) => ({ ...prev, hadBracesBefore: e.target.value }))} placeholder="Yes / No / Not sure" />
              </div>
              <div className="grid gap-2">
                <Label>Do you want a consultation appointment?</Label>
                <Input value={appointmentForm.wantsConsultation} onChange={(e) => setAppointmentForm((prev) => ({ ...prev, wantsConsultation: e.target.value }))} placeholder="Yes / No" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Message</Label>
              <Textarea rows={4} value={appointmentForm.message} onChange={(e) => setAppointmentForm((prev) => ({ ...prev, message: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAppointmentOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleAppointmentSubmit} disabled={appointmentSubmitting}>
              {appointmentSubmitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

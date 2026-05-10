'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Bot, SendHorizontal, Sparkles, User } from 'lucide-react'

interface QuickPrompt {
  id: string
  label: string
  message: string
  actionType: 'message' | 'appointment' | 'link'
  actionValue: string | null
  isActive: boolean
}

interface WidgetSettings {
  botName: string
  welcomeMessage: string
  inputPlaceholder: string
  primaryColor: string
  textOnPrimary: string
  ctaText: string
  ctaLink: string
}

interface ClinicContext {
  clinicName: string
  clinicPhone: string
  whatsappNumber: string
  googleMapsUrl: string
  clinicHours: string
  afterHoursMessage: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface Service {
  id: string
  name: string
  description: string
  price: string | null
  isActive: boolean
}

const defaultSettings: WidgetSettings = {
  botName: 'BrightSmile AI',
  welcomeMessage: 'Hi! Ask me about treatments, prices, clinic hours, or booking an appointment.',
  inputPlaceholder: 'Type your dental question...',
  primaryColor: '#059669',
  textOnPrimary: '#FFFFFF',
  ctaText: 'Request Appointment',
  ctaLink: '',
}

const defaultClinicContext: ClinicContext = {
  clinicName: 'BrightSmile Dental Clinic',
  clinicPhone: '(555) 100-2000',
  whatsappNumber: '15551002000',
  googleMapsUrl: 'https://maps.google.com/?q=123+Dental+Street+Health+City',
  clinicHours: 'Mon-Sat 9:00-18:00',
  afterHoursMessage: "The clinic is currently closed, but you can still leave an appointment request and our staff will contact you when we open.",
}

function isAfterHours(hours: string) {
  const now = new Date()
  const day = now.getDay()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const currentTime = hour * 60 + minute

  if (day === 0) return true
  if (day === 6) return currentTime < 9 * 60 || currentTime >= 14 * 60
  return currentTime < 8 * 60 || currentTime >= 18 * 60
}

export default function WidgetFramePage({ clinicId }: { clinicId: string | null }) {
  const [settings, setSettings] = useState<WidgetSettings>(defaultSettings)
  const [clinicContext, setClinicContext] = useState<ClinicContext>(defaultClinicContext)
  const [prompts, setPrompts] = useState<QuickPrompt[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
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
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function bootstrap() {
      const [settingsRes, promptsRes, clinicRes, botSettingsRes] = await Promise.all([
        fetch('/api/widget-settings'),
        fetch('/api/widget-settings/quick-prompts'),
        fetch('/api/clinic'),
        fetch('/api/settings'),
      ])

      if (settingsRes.ok) {
        const data = await settingsRes.json()
        setSettings({
          botName: data.botName || defaultSettings.botName,
          welcomeMessage: data.welcomeMessage || defaultSettings.welcomeMessage,
          inputPlaceholder: data.inputPlaceholder || defaultSettings.inputPlaceholder,
          primaryColor: data.primaryColor || defaultSettings.primaryColor,
          textOnPrimary: data.textOnPrimary || defaultSettings.textOnPrimary,
          ctaText: data.ctaText || defaultSettings.ctaText,
          ctaLink: data.ctaLink || defaultSettings.ctaLink,
        })
      }

      if (promptsRes.ok) {
        const data = await promptsRes.json()
        setPrompts((Array.isArray(data) ? data : []).filter((prompt) => prompt.isActive))
      }

      let mergedContext = { ...defaultClinicContext }

      if (clinicRes.ok) {
        const clinic = await clinicRes.json()
        mergedContext = {
          ...mergedContext,
          clinicName: clinic.name || mergedContext.clinicName,
          clinicPhone: clinic.primaryPhone || mergedContext.clinicPhone,
          whatsappNumber: (clinic.whatsappNumber || '').replace(/[^\d]/g, '') || mergedContext.whatsappNumber,
          clinicHours: clinic.openingHours || mergedContext.clinicHours,
        }
      }

      if (botSettingsRes.ok) {
        const payload = await botSettingsRes.json()
        const settingsRows = payload.settings || []
        const map: Record<string, string> = {}
        settingsRows.forEach((row: { key: string; value: string }) => {
          map[row.key] = row.value
        })
        mergedContext = {
          ...mergedContext,
          clinicPhone: map.clinic_phone || mergedContext.clinicPhone,
          whatsappNumber: (map.whatsapp_number || mergedContext.whatsappNumber).replace(/[^\d]/g, ''),
          googleMapsUrl: map.google_maps_url || mergedContext.googleMapsUrl,
          clinicHours: map.clinic_hours || mergedContext.clinicHours,
          afterHoursMessage: map.after_hours_message || mergedContext.afterHoursMessage,
        }
      }

      setClinicContext(mergedContext)
      setAfterHours(isAfterHours(mergedContext.clinicHours))
    }

    void bootstrap()
  }, [clinicId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    async function loadServices() {
      try {
        const res = await fetch('/api/services')
        if (!res.ok) return
        const data = await res.json()
        const list = Array.isArray(data) ? data : (data.services || [])
        setServices(list.filter((row: Service) => row.isActive !== false))
      } catch {
        setServices([])
      }
    }
    void loadServices()
  }, [])

  const trackEvent = async (eventType: 'whatsapp_click' | 'call_click' | 'location_click' | 'directions_click' | 'appointment_request', service?: string) => {
    try {
      await fetch('/api/analytics/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversationId || null,
          eventType,
          source: 'widget',
          service: service || null,
        }),
      })
    } catch {
      // non-blocking analytics
    }
  }

  const sendMessage = async (rawMessage?: string) => {
    const message = (rawMessage || input).trim()
    if (!message || sending) return

    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', content: message }])
    setInput('')
    setSending(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, conversationId: conversationId || undefined }),
      })

      if (!res.ok) throw new Error('Failed to chat')

      const data = await res.json()
      if (!conversationId && data.conversationId) {
        setConversationId(data.conversationId)
      }
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: data.response || data.message || '' }])
    } finally {
      setSending(false)
    }
  }

  const handlePrompt = (prompt: QuickPrompt) => {
    if (prompt.actionType === 'appointment') {
      setAppointmentOpen(true)
      return
    }

    if (prompt.actionType === 'link' && prompt.actionValue) {
      void trackEvent('whatsapp_click')
      window.open(prompt.actionValue, '_blank', 'noopener,noreferrer')
      return
    }

    void sendMessage(prompt.message)
  }

  const submitAppointment = async () => {
    if (!appointmentForm.name.trim() || !appointmentForm.phone.trim() || !appointmentForm.preferredDate.trim() || !appointmentForm.preferredTime.trim()) {
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

      await Promise.all([
        fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: appointmentForm.name,
            phone: appointmentForm.phone,
            question: reason || 'Appointment request from embedded widget',
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
      await sendMessage(`I want to request an appointment. Name: ${appointmentForm.name}. Phone: ${appointmentForm.phone}. Service: ${appointmentForm.service || 'Not specified'}. Preferred date: ${appointmentForm.preferredDate}. Preferred time: ${appointmentForm.preferredTime}. Notes: ${appointmentForm.message || 'None'}.`)
    } finally {
      setAppointmentSubmitting(false)
    }
  }

  const shouldShowServiceCards = (text: string) => {
    const lower = text.toLowerCase()
    return lower.includes('service') || lower.includes('treatment') || lower.includes('do you offer')
  }

  const shouldShowLocationActions = (text: string) => {
    const lower = text.toLowerCase()
    return lower.includes('location') || lower.includes('address') || lower.includes('direction') || lower.includes('map')
  }

  const shouldShowWhatsAppAction = (text: string) => {
    const lower = text.toLowerCase()
    return lower.includes('whatsapp') || lower.includes('contact') || lower.includes('staff')
  }

  const shouldShowCallAction = (text: string) => {
    const lower = text.toLowerCase()
    return lower.includes('urgent') || lower.includes('emergency') || lower.includes('call') || lower.includes('phone')
  }

  return (
    <div className="flex h-screen flex-col bg-[radial-gradient(circle_at_top,_#f8fafc_0%,_#ffffff_45%,_#f1f5f9_100%)]">
      <div className="relative overflow-hidden px-4 py-3.5" style={{ backgroundColor: settings.primaryColor, color: settings.textOnPrimary }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.35),_transparent_60%)]" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <Bot className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight">{settings.botName}</div>
              <div className="text-[11px] opacity-90">Dental website assistant</div>
            </div>
          </div>
          <div className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-emerald-300" />
            Live
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1 px-3 py-4">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-3.5 shadow-sm backdrop-blur-sm">
              <div className="mb-1 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                <Sparkles className="size-3" />
                Ask anything
              </div>
              <p className="text-sm leading-6 text-slate-700">{settings.welcomeMessage}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {prompts.map((prompt) => (
                <button
                  key={prompt.id}
                  type="button"
                  onClick={() => handlePrompt(prompt)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex items-end gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' && (
                  <div className="mb-1 flex size-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm">
                    <Bot className="size-3.5" />
                  </div>
                )}
                <div className={`space-y-2 ${message.role === 'user' ? 'max-w-[85%]' : 'max-w-[90%]'}`}>
                  <div
                    className={`rounded-2xl px-3 py-2.5 text-sm leading-6 shadow-sm ${
                      message.role === 'user' ? 'text-white' : 'border border-slate-200 bg-white text-slate-800'
                    }`}
                    style={message.role === 'user' ? { backgroundColor: settings.primaryColor } : undefined}
                  >
                    {message.content}
                  </div>
                  {message.role === 'assistant' && shouldShowServiceCards(message.content) && services.length > 0 && (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {services.slice(0, 6).map((service) => (
                        <div key={service.id} className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
                          <p className="text-xs font-medium">{service.name}</p>
                          <p className="line-clamp-2 text-[11px] text-muted-foreground">{service.description}</p>
                          {service.price && <p className="text-[11px] text-emerald-700">From {service.price}</p>}
                          <div className="mt-1.5 flex gap-1.5">
                            <button
                              type="button"
                              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-700"
                              onClick={() => void sendMessage(`Tell me more about ${service.name}`)}
                            >
                              Ask about this
                            </button>
                            <button
                              type="button"
                              className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-medium text-white"
                              onClick={() => {
                                setAppointmentForm((prev) => ({ ...prev, service: service.name }))
                                setAppointmentOpen(true)
                              }}
                            >
                              Book
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {message.role === 'assistant' && shouldShowLocationActions(message.content) && (
                    <div className="flex flex-wrap gap-1.5">
                      <a
                        href={clinicContext.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => void trackEvent('location_click')}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-700 shadow-sm"
                      >
                        Open in Google Maps
                      </a>
                      <a
                        href={clinicContext.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => void trackEvent('directions_click')}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-700 shadow-sm"
                      >
                        Get Directions
                      </a>
                    </div>
                  )}
                  {message.role === 'assistant' && shouldShowWhatsAppAction(message.content) && (
                    <a
                      href={settings.ctaLink || `https://wa.me/${clinicContext.whatsappNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => void trackEvent('whatsapp_click')}
                      className="inline-block rounded-full bg-green-600 px-2.5 py-1 text-[10px] font-medium text-white shadow-sm"
                    >
                      Open WhatsApp
                    </a>
                  )}
                  {message.role === 'assistant' && shouldShowCallAction(message.content) && (
                    <a
                      href={`tel:${clinicContext.clinicPhone}`}
                      onClick={() => void trackEvent('call_click')}
                      className="inline-block rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-700 shadow-sm"
                    >
                      Call Clinic
                    </a>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="mb-1 flex size-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm">
                    <User className="size-3.5" />
                  </div>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </ScrollArea>

      <div className="border-t border-slate-200/80 bg-white/95 p-3 backdrop-blur">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {prompts.slice(0, 4).map((prompt) => (
            <button
              key={prompt.id}
              type="button"
              onClick={() => handlePrompt(prompt)}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
            >
              {prompt.label}
            </button>
          ))}
          {settings.ctaText && settings.ctaLink && (
            <a
              href={settings.ctaLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void trackEvent('whatsapp_click')}
              className="rounded-full px-2.5 py-1 text-[11px] font-medium text-white shadow-sm"
              style={{ backgroundColor: settings.primaryColor }}
            >
              {settings.ctaText}
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void sendMessage()
              }
            }}
            placeholder={settings.inputPlaceholder}
            className="h-10 rounded-xl border-slate-200 bg-white shadow-sm"
          />
          <Button
            type="button"
            onClick={() => void sendMessage()}
            disabled={sending || !input.trim()}
            className="h-10 rounded-xl px-3 shadow-sm"
            style={{ backgroundColor: settings.primaryColor, color: settings.textOnPrimary }}
          >
            <SendHorizontal className="size-4" />
            <span className="ml-1 hidden sm:inline">Send</span>
          </Button>
        </div>
      </div>

      <Dialog open={appointmentOpen} onOpenChange={setAppointmentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Appointment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={appointmentForm.name} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Phone Number</Label>
              <Input value={appointmentForm.phone} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, phone: event.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Service Needed</Label>
              <Input value={appointmentForm.service} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, service: event.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Preferred Date</Label>
                <Input type="date" value={appointmentForm.preferredDate} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, preferredDate: event.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Preferred Time</Label>
                <Input type="time" value={appointmentForm.preferredTime} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, preferredTime: event.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Preferred Doctor (optional)</Label>
              <Input value={appointmentForm.preferredDoctor} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, preferredDoctor: event.target.value }))} />
            </div>
            <div className="grid gap-2 rounded-md border bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-700">Quick qualification (non-medical)</p>
              <div className="grid gap-2">
                <Label>For yourself or a child?</Label>
                <Input value={appointmentForm.forSelfOrChild} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, forSelfOrChild: event.target.value }))} placeholder="Myself / Child" />
              </div>
              <div className="grid gap-2">
                <Label>Have braces before? (optional)</Label>
                <Input value={appointmentForm.hadBracesBefore} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, hadBracesBefore: event.target.value }))} placeholder="Yes / No / Not sure" />
              </div>
              <div className="grid gap-2">
                <Label>Need consultation appointment?</Label>
                <Input value={appointmentForm.wantsConsultation} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, wantsConsultation: event.target.value }))} placeholder="Yes / No" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Message</Label>
              <Textarea rows={4} value={appointmentForm.message} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, message: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAppointmentOpen(false)}>Cancel</Button>
            <Button onClick={() => void submitAppointment()} disabled={appointmentSubmitting} style={{ backgroundColor: settings.primaryColor, color: settings.textOnPrimary }}>
              {appointmentSubmitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

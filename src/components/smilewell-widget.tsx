'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send,
  X,
  Calendar,
  Phone,
  User,
  Clock,
  Shield,
  Sparkles,
  MessageCircle,
  Smile,
  ChevronDown,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────
interface ChatMessage {
  id: string
  role: 'bot' | 'user'
  content: string
  timestamp: string
  showForm?: boolean
  showQuickActions?: boolean
}

// ─── AI Assistant Icon ────────────────────────────────────────
function BotIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Friendly AI face */}
      <circle cx="32" cy="34" r="22" fill="white" />
      {/* Antenna */}
      <rect x="30" y="6" width="4" height="10" rx="2" fill="white" />
      <circle cx="32" cy="5" r="3.5" fill="#FCD34D" />
      {/* Eyes */}
      <circle cx="24" cy="30" r="3" fill="#1E293B" />
      <circle cx="40" cy="30" r="3" fill="#1E293B" />
      {/* Happy mouth */}
      <path d="M24 38Q32 46 40 38" stroke="#1E293B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

// ─── Appointment Form ───────────────────────────────────────────
function AppointmentForm({ onSubmit }: { onSubmit: (data: Record<string, string>) => void }) {
  const [form, setForm] = useState({
    fullName: 'Jane Doe',
    phone: '(555) 123-4567',
    date: 'May 28, 2025',
    time: '10:00 AM',
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 mt-2 max-w-md mx-auto"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
          <Calendar className="w-5 h-5 text-black" />
        </div>
        <div>
          <h3 className="text-[#1a365d] font-bold text-base">Request Appointment</h3>
          <p className="text-gray-400 text-xs">We'll confirm your appointment shortly.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={form.fullName}
            onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all"
          />
        </div>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all"
          />
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={form.date}
            onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all"
          />
        </div>
        <div className="relative">
          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={form.time}
            onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all"
          />
        </div>
      </div>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onSubmit(form)}
        className="w-full py-3 bg-black hover:bg-gray-800 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all text-sm"
      >
        <Calendar className="w-4 h-4" />
        Request Appointment
      </motion.button>
      <div className="flex items-center gap-1.5 mt-3 justify-center">
        <Shield className="w-3 h-3 text-gray-400" />
        <span className="text-[11px] text-gray-400">Your information is secure and confidential.</span>
      </div>
    </motion.div>
  )
}

// ─── Initial Messages ───────────────────────────────────────────
const initialMessages: ChatMessage[] = [
  {
    id: '1',
    role: 'bot',
    content:
      "Hi there! 👋 I'm SmileWell Assistant. I'm here to help you book an appointment, explore our services, or answer any questions you may have. **How can I help you today?**",
    timestamp: '10:30 AM',
    showQuickActions: true,
  },
  {
    id: '2',
    role: 'user',
    content: "I'd like to book an appointment.",
    timestamp: '10:31 AM',
  },
  {
    id: '3',
    role: 'bot',
    content: "Great! Please share your details below and we'll help you schedule your appointment. 😊",
    timestamp: '10:31 AM',
    showForm: true,
  },
]

// ─── Widget Component ───────────────────────────────────────────
export default function SmileWellWidget({ embedded = false }: { embedded?: boolean }) {
  const [isOpen, setIsOpen] = useState(embedded)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping, scrollToBottom])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 400)
    }
  }, [isOpen])

  const getCurrentTime = () => {
    const now = new Date()
    let hours = now.getHours()
    const minutes = now.getMinutes().toString().padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12 || 12
    return `${hours}:${minutes} ${ampm}`
  }

  const sendMessage = async (text: string) => {
    if (!text.trim()) return
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: getCurrentTime(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInputValue('')
    setIsTyping(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim() }),
      })
      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'bot',
          content: data.reply || "I'm sorry, I couldn't process that.",
          timestamp: getCurrentTime(),
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'bot',
          content: "I'm sorry, something went wrong.",
          timestamp: getCurrentTime(),
        },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  const handleQuickAction = (label: string) => {
    if (label === 'Book Appointment') {
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'user', content: "I'd like to book an appointment.", timestamp: getCurrentTime() },
        {
          id: (Date.now() + 1).toString(),
          role: 'bot',
          content: "Great! Please share your details below and we'll help you schedule your appointment. 😊",
          timestamp: getCurrentTime(),
          showForm: true,
        },
      ])
    } else if (label === 'Services') {
      sendMessage('What services do you offer?')
    } else {
      inputRef.current?.focus()
    }
  }

  const handleFormSubmit = (formData: Record<string, string>) => {
    setMessages((prev) => [
      ...prev,
      {
        id: (Date.now() + 2).toString(),
        role: 'bot',
        content: `Perfect! Your appointment has been requested. 🎉\n\n**Name:** ${formData.fullName}\n**Phone:** ${formData.phone}\n**Date:** ${formData.date}\n**Time:** ${formData.time}\n\nWe'll send a confirmation shortly. Is there anything else I can help with?`,
        timestamp: getCurrentTime(),
      },
    ])
  }

  const renderContent = (content: string) => {
    const parts = content.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
      }
      return part.split('\n').map((line, j) => (
        <span key={`${i}-${j}`}>{j > 0 && <br />}{line}</span>
      ))
    })
  }

  return (
    <div className={embedded ? "flex flex-col h-full" : "fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"}>
      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
            style={{ transformOrigin: 'bottom right' }}
            className={embedded
                ? "w-full h-full bg-white flex flex-col overflow-hidden border border-gray-100"
                : "w-[380px] h-[520px] bg-white rounded-3xl shadow-2xl shadow-black/20 flex flex-col overflow-hidden border border-gray-100"
            }
          >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-black via-black to-gray-800 px-5 py-4 flex items-center gap-3 flex-shrink-0">
              <div className="absolute bottom-0 left-0 right-0">
                <svg viewBox="0 0 400 20" fill="none" className="w-full">
                  <path d="M0 20C50 8 100 2 200 10C300 18 350 5 400 20V20H0Z" fill="white" />
                </svg>
              </div>
              <Sparkles className="absolute top-3 right-16 w-4 h-4 text-yellow-200/60" />
              <Sparkles className="absolute bottom-8 left-8 w-3 h-3 text-yellow-200/40" />
              <div className="w-11 h-11 rounded-full bg-black flex items-center justify-center shadow-md flex-shrink-0">
                <BotIcon size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-white font-bold text-lg leading-tight">SmileWell Dental</h1>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <p className="text-white/80 text-xs flex items-center gap-1">
                    Online now <Smile className="w-3 h-3 inline" />
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                aria-label="Minimize chat"
              >
                <ChevronDown className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                aria-label="Close chat"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Chat Area */}
            <div
              className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#e5e7eb transparent' }}
            >
              <AnimatePresence>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div className="flex-shrink-0 mt-1">
                      {msg.role === 'bot' ? (
                        <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center shadow-sm">
                          <BotIcon size={16} />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center shadow-sm">
                          <User className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                    <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`px-4 py-2.5 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-black text-white rounded-2xl rounded-tr-sm'
                            : 'bg-gray-100 text-gray-700 rounded-2xl rounded-tl-sm'
                        }`}
                      >
                        {renderContent(msg.content)}
                      </div>
                      {msg.showQuickActions && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleQuickAction('Book Appointment')}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-white text-sm font-medium shadow-md bg-black hover:bg-gray-800"
                          >
                            <Calendar className="w-4 h-4" />
                            Book Appointment
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleQuickAction('Services')}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-white text-sm font-medium shadow-md bg-black hover:bg-gray-700"
                          >
                            <Smile className="w-4 h-4" />
                            Services
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleQuickAction('Ask')}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-white text-sm font-medium shadow-md bg-black hover:bg-gray-700"
                          >
                            <MessageCircle className="w-4 h-4" />
                            Ask a Question
                          </motion.button>
                        </div>
                      )}
                      {msg.showForm && <AppointmentForm onSubmit={handleFormSubmit} />}
                      <div className={`flex items-center gap-1 mt-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-[11px] text-gray-400">{msg.timestamp}</span>
                        {msg.role === 'user' && (
                          <svg width="14" height="10" viewBox="0 0 14 10" fill="none" className="text-gray-400">
                            <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isTyping && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center shadow-sm flex-shrink-0">
                    <BotIcon size={16} />
                  </div>
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1">
                      <motion.span animate={{ y: [0, -4, 0] }} transition={{ duration: 0.5, repeat: Infinity, delay: 0 }} className="w-2 h-2 bg-gray-400 rounded-full" />
                      <motion.span animate={{ y: [0, -4, 0] }} transition={{ duration: 0.5, repeat: Infinity, delay: 0.15 }} className="w-2 h-2 bg-gray-400 rounded-full" />
                      <motion.span animate={{ y: [0, -4, 0] }} transition={{ duration: 0.5, repeat: Infinity, delay: 0.3 }} className="w-2 h-2 bg-gray-400 rounded-full" />
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-100 px-4 py-3 bg-white flex-shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  sendMessage(inputValue)
                }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all placeholder:text-gray-400"
                />
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  disabled={!inputValue.trim() || isTyping}
                  className="w-10 h-10 rounded-full bg-black hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center shadow-md transition-colors"
                >
                  <Send className="w-4 h-4 text-white" />
                </motion.button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Trigger Button — only in popup mode */}
      {!embedded && (
      <AnimatePresence mode="wait">
        {!isOpen && (
          <motion.button
            key="chat-btn"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
            onClick={() => setIsOpen(true)}
            className="w-16 h-16 rounded-full bg-black shadow-xl shadow-black/30 flex items-center justify-center hover:shadow-2xl hover:shadow-black/40 transition-shadow group"
            aria-label="Open chat"
          >
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <MessageCircle className="w-7 h-7 text-white group-hover:scale-110 transition-transform" />
            </motion.div>
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
              <span className="text-[8px] text-white font-bold">1</span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
      )}
    </div>
  )
}

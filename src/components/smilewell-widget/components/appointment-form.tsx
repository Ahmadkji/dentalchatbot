'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Phone, User, Clock, Shield } from 'lucide-react'

export function AppointmentForm({
  onSubmit,
  primaryColor,
}: {
  onSubmit: (data: Record<string, string>) => Promise<void> | void
  primaryColor: string
}) {
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    date: '',
    time: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const canSubmit = Boolean(form.fullName.trim() && form.phone.trim() && form.date.trim() && form.time.trim())

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
          <p className="text-gray-400 text-xs">We'll submit your request and the clinic will confirm.</p>
        </div>
      </div>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (!canSubmit || isSubmitting) return
          setIsSubmitting(true)
          try {
            await onSubmit(form)
          } finally {
            setIsSubmitting(false)
          }
        }}
      >
        <div className="grid grid-cols-2 gap-3 mb-4">
          <label className="relative">
            <span className="sr-only">Full name</span>
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all"
              placeholder="Full name"
              autoComplete="name"
              required
              disabled={isSubmitting}
            />
          </label>
          <label className="relative">
            <span className="sr-only">Phone number</span>
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all"
              placeholder="Phone number"
              autoComplete="tel"
              required
              disabled={isSubmitting}
            />
          </label>
          <label className="relative">
            <span className="sr-only">Preferred date</span>
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all"
              required
              disabled={isSubmitting}
            />
          </label>
          <label className="relative">
            <span className="sr-only">Preferred time</span>
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all"
              required
              disabled={isSubmitting}
            />
          </label>
        </div>
        <motion.button
          type="submit"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={isSubmitting || !canSubmit}
          className="w-full py-3 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-md hover:brightness-110 transition-all text-sm disabled:cursor-not-allowed disabled:opacity-70"
          style={{ backgroundColor: primaryColor }}
        >
          <Calendar className="w-4 h-4" />
          {isSubmitting ? 'Submitting...' : 'Request Appointment'}
        </motion.button>
      </form>
      <div className="flex items-center gap-1.5 mt-3 justify-center">
        <Shield className="w-3 h-3 text-gray-400" />
        <span className="text-[11px] text-gray-400">Your information is secure and confidential.</span>
      </div>
    </motion.div>
  )
}

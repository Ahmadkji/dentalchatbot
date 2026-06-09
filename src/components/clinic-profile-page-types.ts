import type React from 'react'
import {
  Building2,
  Globe,
  MapPin,
  Phone,
  MessageSquare,
  ClockIcon,
  CalendarCheck,
  CreditCard,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'

// --- Types ---

export interface ClinicProfile {
  id: string
  name: string
  slug: string
  address: string
  city: string
  country: string
  primaryPhone: string
  whatsappNumber: string
  openingHours: string
  appointmentRules: string
  pricingNotes: string
  emergencyInstructions: string
  timezone: string
  isActive: boolean
}

export interface DetectedDetail {
  id: string
  field: string
  label: string
  value: string
  confidence: 'high' | 'medium' | 'low'
  targetField: string
  sourceSnippet: string
  canApply: boolean
  reason?: string
}

export interface FieldSection {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  fields: Array<{ key: keyof ClinicProfile; label: string }>
}

// --- Config ---

export const emptyProfile: ClinicProfile = {
  id: '',
  name: '',
  slug: '',
  address: '',
  city: '',
  country: '',
  primaryPhone: '',
  whatsappNumber: '',
  openingHours: '',
  appointmentRules: '',
  pricingNotes: '',
  emergencyInstructions: '',
  timezone: 'Asia/Karachi',
  isActive: true,
}

export const longTextFields = new Set([
  'address',
  'openingHours',
  'appointmentRules',
  'pricingNotes',
  'emergencyInstructions',
])

export const fieldIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  name: Building2,
  slug: Globe,
  address: MapPin,
  city: MapPin,
  country: Globe,
  primaryPhone: Phone,
  whatsappNumber: MessageSquare,
  openingHours: ClockIcon,
  appointmentRules: CalendarCheck,
  pricingNotes: CreditCard,
  emergencyInstructions: AlertCircle,
  timezone: ClockIcon,
  isActive: CheckCircle2,
}

export const detailIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  phone: Phone,
  whatsapp: Phone,
  address: MapPin,
  opening_hours: ClockIcon,
  pricing: CreditCard,
  pricing_notes: CreditCard,
  emergency: AlertCircle,
  emergency_instructions: AlertCircle,
  name: Globe,
}

export const confidenceColors: Record<string, string> = {
  high: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-50 text-slate-600 border-slate-200',
}

export const fieldSections: FieldSection[] = [
  {
    key: 'identity',
    label: 'Clinic Identity',
    icon: Building2,
    color: 'bg-blue-100 text-blue-700',
    fields: [
      { key: 'name', label: 'Clinic Name' },
      { key: 'slug', label: 'Slug' },
    ],
  },
  {
    key: 'location',
    label: 'Location & Contact',
    icon: MapPin,
    color: 'bg-emerald-100 text-emerald-700',
    fields: [
      { key: 'address', label: 'Address' },
      { key: 'city', label: 'City' },
      { key: 'country', label: 'Country' },
      { key: 'primaryPhone', label: 'Primary Phone' },
      { key: 'whatsappNumber', label: 'WhatsApp' },
    ],
  },
  {
    key: 'operations',
    label: 'Operations & Rules',
    icon: ClockIcon,
    color: 'bg-violet-100 text-violet-700',
    fields: [
      { key: 'openingHours', label: 'Opening Hours' },
      { key: 'appointmentRules', label: 'Appointment Rules' },
      { key: 'pricingNotes', label: 'Pricing Notes' },
      { key: 'emergencyInstructions', label: 'Emergency Instructions' },
    ],
  },
  {
    key: 'system',
    label: 'System',
    icon: Globe,
    color: 'bg-slate-100 text-slate-700',
    fields: [
      { key: 'timezone', label: 'Timezone' },
      { key: 'isActive', label: 'Active' },
    ],
  },
]

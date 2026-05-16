import 'server-only'

import type { User } from '@supabase/supabase-js'
import { formatClinicHoursSummary, type ClinicHourRecord } from '@/lib/clinics/hours'
import { getClinicReadiness } from '@/lib/clinics/readiness'
import type { createSupabaseRouteClient } from '@/lib/supabase/route-client'

type SupabaseRouteClient = NonNullable<Awaited<ReturnType<typeof createSupabaseRouteClient>>>

export interface CurrentClinic {
  id: string
  name: string
  slug: string
  country: string
  city: string
  address: string | null
  timezone: string
  phone: string
  whatsapp: string | null
  website_url: string | null
  map_link: string | null
  pricing_notes: string | null
  appointment_rules: string | null
  emergency_instructions: string | null
  status: 'active' | 'disabled' | 'deleted'
  owner_id: string | null
  profile_completed: boolean
  is_live: boolean
}

export interface CurrentMembership {
  clinic_id: string
  role: 'owner' | 'admin' | 'staff'
  status: 'active' | 'invited' | 'removed'
}

export interface CurrentProfile {
  id: string
  email: string
  full_name: string | null
  timezone: string
  onboarding_completed: boolean
  default_clinic_id: string | null
}

export interface CurrentClinicAiProfile {
  clinic_id: string
  name: string
  slug: string
  country: string
  city: string
  address: string | null
  timezone: string
  phone: string
  whatsapp: string | null
  website_url: string | null
  map_link: string | null
  pricing_notes: string | null
  appointment_rules: string | null
  emergency_instructions: string | null
  profile_completed: boolean
  is_live: boolean
  status: 'active' | 'disabled' | 'deleted'
  bot_name: string | null
  tone: string | null
  fallback_message: string | null
  medical_disclaimer: string | null
  emergency_message: string | null
  appointment_mode: string | null
  whatsapp_handoff_enabled: boolean | null
  lead_capture_enabled: boolean | null
  widget_enabled: boolean | null
  widget_title: string | null
  welcome_message: string | null
  primary_color: string | null
  widget_position: string | null
  show_whatsapp_button: boolean | null
  show_call_button: boolean | null
  show_location_button: boolean | null
  allowed_domains: string[] | null
  clinic_hours: ClinicHourRecord[]
  active_services: Array<{
    id: string
    name: string
    description: string | null
    category: string | null
    price_amount: number | null
    price_currency: string | null
    pricing_note: string | null
    duration_minutes: number
    sort_order: number
  }>
}

export async function getCurrentProfile(
  supabase: SupabaseRouteClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,full_name,timezone,onboarding_completed,default_clinic_id')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data as CurrentProfile | null
}

export async function getCurrentClinic(
  supabase: SupabaseRouteClient,
  user: Pick<User, 'id'>,
) {
  const profile = await getCurrentProfile(supabase, user.id)

  if (!profile?.onboarding_completed || !profile.default_clinic_id) {
    return { profile, clinic: null, membership: null }
  }

  const { data: membership, error: membershipError } = await supabase
    .from('clinic_members')
    .select('clinic_id,role,status')
    .eq('user_id', user.id)
    .eq('clinic_id', profile.default_clinic_id)
    .eq('status', 'active')
    .maybeSingle()

  if (membershipError) {
    throw membershipError
  }

  if (!membership) {
    return { profile, clinic: null, membership: null }
  }

  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .select('id,name,slug,country,city,address,timezone,phone,whatsapp,website_url,map_link,pricing_notes,appointment_rules,emergency_instructions,status,owner_id,profile_completed,is_live')
    .eq('id', profile.default_clinic_id)
    .neq('status', 'deleted')
    .maybeSingle()

  if (clinicError) {
    throw clinicError
  }

  return {
    profile,
    clinic: (clinic as CurrentClinic | null) ?? null,
    membership: membership as CurrentMembership | null,
  }
}

export async function getClinicHours(
  supabase: SupabaseRouteClient,
  clinicId: string,
) {
  const { data, error } = await supabase
    .from('clinic_hours')
    .select('id,clinic_id,day_of_week,is_open,open_time,close_time,break_start_time,break_end_time,notes')
    .eq('clinic_id', clinicId)
    .order('day_of_week', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as ClinicHourRecord[]
}

export async function getClinicServices(
  supabase: SupabaseRouteClient,
  clinicId: string,
  options?: { includeInactive?: boolean }
) {
  let query = supabase
    .from('services')
    .select('id,clinic_id,name,description,category,price_amount,price_currency,pricing_note,duration_minutes,is_active,sort_order,created_at,updated_at')
    .eq('clinic_id', clinicId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (!options?.includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) {
    throw error
  }

  return data ?? []
}

export async function getCurrentClinicSnapshot(
  supabase: SupabaseRouteClient,
  user: Pick<User, 'id'>,
) {
  const current = await getCurrentClinic(supabase, user)
  if (!current.clinic) {
    return { ...current, hours: [], services: [], readiness: { can_go_live: false, missing: ['onboarding'] } }
  }

  const [hours, services] = await Promise.all([
    getClinicHours(supabase, current.clinic.id),
    getClinicServices(supabase, current.clinic.id, { includeInactive: true }),
  ])

  const readiness = getClinicReadiness({
    clinic: current.clinic,
    hours,
    activeServicesCount: services.filter((service) => service.is_active).length,
  })

  return {
    ...current,
    hours,
    services,
    readiness,
  }
}

export async function getCurrentClinicAiProfile(
  supabase: SupabaseRouteClient,
  user: Pick<User, 'id'>,
) {
  const current = await getCurrentClinic(supabase, user)
  if (!current.clinic) {
    return { ...current, aiProfile: null }
  }

  const { data, error } = await supabase
    .from('clinic_ai_profile_view')
    .select('*')
    .eq('clinic_id', current.clinic.id)
    .maybeSingle()

  if (error) {
    throw error
  }

  return {
    ...current,
    aiProfile: (data as CurrentClinicAiProfile | null) ?? null,
  }
}

export function mapClinicToAppProfile(clinic: CurrentClinic, hours: ClinicHourRecord[] = []) {
  return {
    id: clinic.id,
    name: clinic.name,
    slug: clinic.slug,
    address: clinic.address ?? '',
    city: clinic.city,
    country: clinic.country,
    primaryPhone: clinic.phone,
    whatsappNumber: clinic.whatsapp ?? '',
    openingHours: formatClinicHoursSummary(hours),
    appointmentRules: clinic.appointment_rules ?? '',
    pricingNotes: clinic.pricing_notes ?? '',
    emergencyInstructions: clinic.emergency_instructions ?? '',
    timezone: clinic.timezone,
    modelMode: 'balanced',
    isActive: clinic.status === 'active',
    websiteUrl: clinic.website_url ?? '',
    mapLink: clinic.map_link ?? '',
    isLive: clinic.is_live,
    profileCompleted: clinic.profile_completed,
  }
}

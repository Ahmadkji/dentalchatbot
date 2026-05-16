import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getCurrentClinic } from '@/lib/clinics/current'
import { getKnowledgeSourceForClinic } from '@/lib/knowledge/sources'

interface DetectedDetail {
  field: string
  label: string
  value: string
  confidence: 'high' | 'medium' | 'low'
}

function extractPattern(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return match[0]
  }
  return null
}

function detectClinicDetails(content: string): DetectedDetail[] {
  const lower = content.toLowerCase()
  const details: DetectedDetail[] = []

  const phone = extractPattern(content, [
    /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
    /\+\d{1,3}\d{6,14}/,
  ])
  if (phone) {
    details.push({ field: 'phone', label: 'Phone', value: phone, confidence: 'high' })
  }

  const whatsapp = extractPattern(content, [
    /whatsapp[:\s]*\+?\d[\d\s-]{8,}/i,
    /\+1\d{10}/,
  ])
  if (whatsapp) {
    details.push({ field: 'whatsapp', label: 'WhatsApp', value: whatsapp.replace(/whatsapp[:\s]*/i, '').trim(), confidence: 'high' })
  }

  const addressPatterns = [
    /address[:\s]*.{10,80}(?:\d{5,6})?/i,
    /\d+\s+\w+\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr)[\w\s,]+(?:\d{5,6})?/i,
  ]
  const address = extractPattern(content, addressPatterns)
  if (address) {
    details.push({ field: 'address', label: 'Address', value: address.replace(/^address[:\s]*/i, '').trim(), confidence: 'medium' })
  }

  const hoursPatterns = [
    /(?:hours?|timings?|open)[:\s]*.{10,60}(?:pm|am|noon|midnight)/i,
    /(?:mon|tue|wed|thu|fri|sat|sun)[\w\s,-]*(?:pm|am)/i,
  ]
  const hours = extractPattern(content, hoursPatterns)
  if (hours) {
    details.push({ field: 'opening_hours', label: 'Opening Hours', value: hours.replace(/^(?:hours?|timings?|open)[:\s]*/i, '').trim(), confidence: 'medium' })
  }

  const serviceKeywords = [
    'root canal',
    'braces',
    'teeth whitening',
    'dental cleaning',
    'dental implants',
    'orthodontics',
    'extraction',
    'crown',
    'bridge',
    'denture',
    'filling',
    'scaling',
    'cosmetic',
    'physiotherapy',
    'skin treatment',
    'consultation',
    'checkup',
  ]
  const foundServices = serviceKeywords.filter((service) => lower.includes(service))
  if (foundServices.length > 0) {
    const unique = [...new Set(foundServices.map((service) => service.charAt(0).toUpperCase() + service.slice(1)))]
    details.push({ field: 'services', label: 'Services', value: unique.join(', '), confidence: 'high' })
  }

  const pricingPatterns = [
    /(?:price|pricing|fee|cost|rs\.|₹|\$)[\s\S]{0,80}(?:rs\.|₹|\$|consultation|treatment)/i,
    /(?:consultation|treatment)[\s\S]{0,40}(?:rs\.|₹|\$)\s*[\d,]+/i,
  ]
  const pricing = extractPattern(content, pricingPatterns)
  if (pricing) {
    details.push({ field: 'pricing', label: 'Pricing', value: pricing.trim().substring(0, 120), confidence: 'medium' })
  }

  if (lower.includes('emergency')) {
    const emergencyPatterns = [
      /emergency[\s\S]{0,60}(?:\d{3}[-.\s]?){2}\d{4}/i,
      /emergency[\s\S]{0,60}\+\d{1,3}\d{6,14}/i,
      /emergency[\s\S]{0,80}(?:call|phone|line|contact)/i,
    ]
    const emergency = extractPattern(content, emergencyPatterns)
    if (emergency) {
      details.push({ field: 'emergency', label: 'Emergency', value: emergency.trim().substring(0, 120), confidence: 'medium' })
    }
  }

  return details
}

export async function POST(request: NextRequest) {
  const { user, supabase, error: authError } = await requireAuth()
  if (authError) return authError
  if (!user || !supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { clinic } = await getCurrentClinic(supabase, user)
    if (!clinic) {
      return NextResponse.json({ error: 'Onboarding required' }, { status: 409 })
    }

    const body = await request.json().catch(() => null)
    const sourceId = String(body?.sourceId ?? '')

    if (!sourceId) {
      return NextResponse.json({ error: 'sourceId is required' }, { status: 400 })
    }

    const source = await getKnowledgeSourceForClinic(supabase, clinic.id, sourceId)
    if (!source) {
      return NextResponse.json({ error: 'Knowledge source not found' }, { status: 404 })
    }

    if (!source.content) {
      return NextResponse.json({ details: [] })
    }

    return NextResponse.json({ details: detectClinicDetails(source.content) })
  } catch (error) {
    console.error('Error detecting details:', error)
    return NextResponse.json({ error: 'Failed to detect clinic details' }, { status: 500 })
  }
}

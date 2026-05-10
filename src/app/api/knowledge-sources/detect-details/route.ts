import { clinicData } from '@/lib/clinic-data'
import { NextRequest, NextResponse } from 'next/server'

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

  // Phone detection
  const phone = extractPattern(content, [
    /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
    /\+\d{1,3}\d{6,14}/,
  ])
  if (phone) {
    details.push({ field: 'phone', label: 'Phone', value: phone, confidence: 'high' })
  }

  // WhatsApp detection
  const whatsapp = extractPattern(content, [
    /whatsapp[:\s]*\+?\d[\d\s-]{8,}/i,
    /\+1\d{10}/,
  ])
  if (whatsapp) {
    details.push({ field: 'whatsapp', label: 'WhatsApp', value: whatsapp.replace(/whatsapp[:\s]*/i, '').trim(), confidence: 'high' })
  }

  // Address detection
  const addressPatterns = [
    /address[:\s]*.{10,80}(?:\d{5,6})?/i,
    /\d+\s+\w+\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr)[\w\s,]+(?:\d{5,6})?/i,
  ]
  const address = extractPattern(content, addressPatterns)
  if (address) {
    details.push({ field: 'address', label: 'Address', value: address.replace(/^address[:\s]*/i, '').trim(), confidence: 'medium' })
  }

  // Opening hours detection
  const hoursPatterns = [
    /(?:hours?|timings?|open)[:\s]*.{10,60}(?:pm|am|noon|midnight)/i,
    /(?:mon|tue|wed|thu|fri|sat|sun)[\w\s,-]*(?:pm|am)/i,
  ]
  const hours = extractPattern(content, hoursPatterns)
  if (hours) {
    details.push({ field: 'opening_hours', label: 'Opening Hours', value: hours.replace(/^(?:hours?|timings?|open)[:\s]*/i, '').trim(), confidence: 'medium' })
  }

  // Services detection
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
  const foundServices = serviceKeywords.filter((s) => lower.includes(s))
  if (foundServices.length > 0) {
    const unique = [...new Set(foundServices.map((s) => s.charAt(0).toUpperCase() + s.slice(1)))]
    details.push({ field: 'services', label: 'Services', value: unique.join(', '), confidence: 'high' })
  }

  // Pricing detection
  const pricingPatterns = [
    /(?:price|pricing|fee|cost|rs\.|₹|\$)[\s\S]{0,80}(?:rs\.|₹|\$|consultation|treatment)/i,
    /(?:consultation|treatment)[\s\S]{0,40}(?:rs\.|₹|\$)\s*[\d,]+/i,
  ]
  const pricing = extractPattern(content, pricingPatterns)
  if (pricing) {
    details.push({ field: 'pricing', label: 'Pricing', value: pricing.trim().substring(0, 120), confidence: 'medium' })
  }

  // Doctor detection
  const doctorMatches = content.match(/dr\.?\s+[a-z]+(?:\s+[a-z]+)*/gi)
  if (doctorMatches && doctorMatches.length > 0) {
    const uniqueDoctors = [...new Set(doctorMatches.map((d) => d.trim()))]
    details.push({ field: 'doctors', label: 'Doctors', value: uniqueDoctors.join(', '), confidence: 'medium' })
  }

  // Emergency detection
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
  try {
    const body = await request.json()
    const { sourceId } = body

    if (!sourceId) {
      return NextResponse.json({ error: 'sourceId is required' }, { status: 400 })
    }

    const source = await clinicData.knowledgeSource.findUnique({ where: { id: sourceId } })
    if (!source) {
      return NextResponse.json({ error: 'Knowledge source not found' }, { status: 404 })
    }

    if (!source.content) {
      return NextResponse.json({ details: [] })
    }

    const details = detectClinicDetails(source.content)
    return NextResponse.json({ details })
  } catch (error) {
    console.error('Error detecting details:', error)
    return NextResponse.json({ error: 'Failed to detect clinic details' }, { status: 500 })
  }
}

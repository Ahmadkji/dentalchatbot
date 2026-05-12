import { importWebsiteContent } from '@/lib/knowledge-import'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'

interface DetectedDetail {
  field: string
  label: string
  value: string
  confidence: 'high' | 'medium' | 'low'
  targetField: string
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

  // Clinic name detection (from title or heading patterns)
  const titleMatch = content.match(/(?:clinic name|dental clinic|dental center)[:\s]*([^\n,]{5,60})/i)
    || content.match(/^([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*\s+(?:Dental|Clinic|Center|Care))/m)
  if (titleMatch) {
    details.push({
      field: 'name',
      label: 'Clinic Name',
      value: titleMatch[1] ? titleMatch[1].trim() : titleMatch[0].trim(),
      confidence: 'medium',
      targetField: 'name',
    })
  }

  // Phone detection
  const phone = extractPattern(content, [
    /(?:phone|tel|call)[:\s]*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/i,
    /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
    /\+\d{1,3}[-.\s]?\d{6,14}/,
  ])
  if (phone) {
    const cleaned = phone.replace(/^(?:phone|tel|call)[:\s]*/i, '').trim()
    details.push({
      field: 'phone',
      label: 'Primary Phone',
      value: cleaned,
      confidence: 'high',
      targetField: 'primaryPhone',
    })
  }

  // WhatsApp detection
  const whatsapp = extractPattern(content, [
    /whatsapp[:\s]*\+?\d[\d\s-]{8,}/i,
  ])
  if (whatsapp) {
    details.push({
      field: 'whatsapp',
      label: 'WhatsApp',
      value: whatsapp.replace(/whatsapp[:\s]*/i, '').trim(),
      confidence: 'high',
      targetField: 'whatsappNumber',
    })
  }

  // Address detection
  const addressPatterns = [
    /(?:address|location)[:\s]*.{10,100}(?:\d{5,6})?/i,
    /\d+\s+\w+\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr)[\w\s,]+(?:\d{5,6})?/i,
  ]
  const address = extractPattern(content, addressPatterns)
  if (address) {
    const cleaned = address.replace(/^(?:address|location)[:\s]*/i, '').trim()
    details.push({
      field: 'address',
      label: 'Address',
      value: cleaned,
      confidence: 'medium',
      targetField: 'address',
    })

    // Try to extract city from address
    const cityMatch = cleaned.match(/,\s*([A-Za-z\s]+?)(?:\s*,|\s+\d{5,6}|$)/)
    if (cityMatch && cityMatch[1].trim().length > 1) {
      details.push({
        field: 'city',
        label: 'City',
        value: cityMatch[1].trim(),
        confidence: 'low',
        targetField: 'city',
      })
    }
  }

  // Opening hours detection
  const hoursPatterns = [
    /(?:hours?|timings?|open(?:ing)?)[:\s]*.{10,80}(?:pm|am|noon|midnight)/i,
    /(?:mon|tue|wed|thu|fri|sat|sun)[\w\s,-]*(?:pm|am)/i,
  ]
  const hours = extractPattern(content, hoursPatterns)
  if (hours) {
    const cleaned = hours.replace(/^(?:hours?|timings?|open(?:ing)?)[:\s]*/i, '').trim()
    details.push({
      field: 'opening_hours',
      label: 'Opening Hours',
      value: cleaned,
      confidence: 'medium',
      targetField: 'openingHours',
    })
  }

  // Pricing detection
  const pricingPatterns = [
    /(?:consultation|pricing|fee|cost)[\s\S]{0,80}(?:rs\.|₹|\$)\s*[\d,]+/i,
    /(?:price|pricing|fee|cost|rs\.|₹|\$)[\s\S]{0,80}(?:consultation|treatment)/i,
  ]
  const pricing = extractPattern(content, pricingPatterns)
  if (pricing) {
    details.push({
      field: 'pricing',
      label: 'Pricing Notes',
      value: pricing.trim().substring(0, 200),
      confidence: 'medium',
      targetField: 'pricingNotes',
    })
  }

  // Emergency detection
  if (lower.includes('emergency')) {
    const emergencyPatterns = [
      /emergency[\s\S]{0,60}(?:\d{3}[-.\s]?){2}\d{4}/i,
      /emergency[\s\S]{0,60}\+\d{1,3}\d{6,14}/i,
      /emergency[\s\S]{0,100}(?:call|phone|line|contact|instructions)/i,
    ]
    const emergency = extractPattern(content, emergencyPatterns)
    if (emergency) {
      details.push({
        field: 'emergency',
        label: 'Emergency Instructions',
        value: emergency.trim().substring(0, 200),
        confidence: 'medium',
        targetField: 'emergencyInstructions',
      })
    }
  }

  return details
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError
  try {
    const body = await request.json()
    const { url } = body

    if (!url?.trim()) {
      return NextResponse.json({ error: 'Website URL is required' }, { status: 400 })
    }

    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`
    }

    // Validate URL
    try {
      const parsed = new URL(normalizedUrl)
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        return NextResponse.json({ error: 'Localhost URLs are not supported.' }, { status: 400 })
      }
      if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(parsed.hostname)) {
        return NextResponse.json({ error: 'Private IP addresses are not supported.' }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ error: 'Please enter a valid website URL.' }, { status: 400 })
    }

    const imported = await importWebsiteContent(normalizedUrl)
    const details = detectClinicDetails(imported.content)

    return NextResponse.json({
      url: imported.url,
      title: imported.title,
      contentPreview: imported.content.substring(0, 500),
      details,
    })
  } catch (error) {
    console.error('Error fetching clinic details from website:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch website content. Please check the URL and try again.' },
      { status: 500 }
    )
  }
}

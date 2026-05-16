import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'

const IMPORT_TIMEOUT_MS = 10_000
const MAX_HTML_BYTES = 2 * 1024 * 1024
const MAX_SITEMAP_BYTES = 1024 * 1024
const MAX_REDIRECTS = 5
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
])

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function isPrivateIpv4(hostname: string) {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
    return false
  }

  const octets = hostname.split('.').map((part) => Number(part))
  if (octets.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false
  }

  const [a, b] = octets
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  )
}

function isPrivateIpv6(hostname: string) {
  const normalized = hostname.toLowerCase()

  if (normalized === '::' || normalized === '::1') {
    return true
  }

  const mappedIpv4 = normalized.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (mappedIpv4) {
    return isPrivateIpv4(mappedIpv4[1])
  }

  return /^fc/i.test(normalized) || /^fd/i.test(normalized) || /^fe[89ab]/i.test(normalized)
}

function isPrivateIpAddress(hostname: string) {
  const ipVersion = isIP(hostname)

  if (ipVersion === 4) {
    return isPrivateIpv4(hostname)
  }

  if (ipVersion === 6) {
    return isPrivateIpv6(hostname)
  }

  return false
}

async function assertPublicHostname(url: URL) {
  const hostname = url.hostname.toLowerCase()

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.local') ||
    isPrivateIpAddress(hostname)
  ) {
    throw new Error('Private or local network URLs are not allowed.')
  }

  const resolved = await lookup(hostname, { all: true, verbatim: true })
  if (resolved.length === 0) {
    throw new Error('Could not resolve website hostname.')
  }

  if (resolved.some((entry) => isPrivateIpAddress(entry.address))) {
    throw new Error('Private or local network URLs are not allowed.')
  }
}

export function normalizeKnowledgeImportUrl(input: string) {
  const trimmed = input.trim()
  const hasScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed)
  const candidate = hasScheme ? trimmed : `https://${trimmed}`

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    throw new Error('Please enter a valid website URL.')
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http:// and https:// URLs are supported.')
  }

  const hostname = url.hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local') || isPrivateIpAddress(hostname)) {
    throw new Error('Private or local network URLs are not allowed.')
  }

  url.hash = ''
  if (url.pathname !== '/') {
    url.pathname = url.pathname.replace(/\/+$/, '') || '/'
  }

  return url
}

function assertContentLengthWithinLimit(response: Response, maxBytes: number) {
  const header = response.headers.get('content-length')
  if (!header) return

  const bytes = Number(header)
  if (Number.isFinite(bytes) && bytes > maxBytes) {
    throw new Error('Imported page is too large to process safely.')
  }
}

function assertAllowedContentType(response: Response) {
  const contentType = response.headers.get('content-type')?.toLowerCase()
  if (!contentType) return

  if (
    contentType.startsWith('text/') ||
    contentType.includes('xml') ||
    contentType.includes('html') ||
    contentType.includes('xhtml')
  ) {
    return
  }

  throw new Error('Imported URL must return text or XML content.')
}

async function fetchTextFromUrl(input: string, maxBytes: number) {
  let currentUrl = normalizeKnowledgeImportUrl(input)

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertPublicHostname(currentUrl)

    const response = await fetch(currentUrl, {
      headers: {
        'user-agent': 'ClinicKnowledgeImporter/1.0',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(IMPORT_TIMEOUT_MS),
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) {
        throw new Error('Website redirect is missing a destination URL.')
      }

      currentUrl = normalizeKnowledgeImportUrl(new URL(location, currentUrl).toString())
      continue
    }

    if (!response.ok) {
      throw new Error(`Website returned ${response.status}`)
    }

    assertAllowedContentType(response)
    assertContentLengthWithinLimit(response, maxBytes)

    const text = await response.text()
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      throw new Error('Imported page is too large to process safely.')
    }

    return {
      url: currentUrl.toString(),
      text,
    }
  }

  throw new Error('Website redirected too many times.')
}

function extractSnippet(text: string, patterns: string[], maxLength = 420) {
  const lower = text.toLowerCase()
  for (const pattern of patterns) {
    const idx = lower.indexOf(pattern.toLowerCase())
    if (idx === -1) continue
    const start = Math.max(0, idx - 80)
    const end = Math.min(text.length, idx + maxLength)
    return text.slice(start, end).trim()
  }
  return 'Not detected clearly from this page. Please verify manually.'
}

function buildDentalStructuredNotes(text: string) {
  const sections = [
    { title: 'Services', patterns: ['services', 'treatment', 'root canal', 'braces', 'teeth whitening', 'dental implants'] },
    { title: 'Timings', patterns: ['hours', 'timings', 'open', 'monday', 'saturday'] },
    { title: 'Location', patterns: ['address', 'location', 'near', 'landmark', 'city'] },
    { title: 'Contact Number', patterns: ['phone', 'call', 'whatsapp', 'contact'] },
    { title: 'Pricing Text', patterns: ['price', 'pricing', 'fee', 'cost', 'consultation'] },
    { title: 'Appointment Instructions', patterns: ['appointment', 'book', 'schedule', 'walk-in'] },
    { title: 'FAQs', patterns: ['faq', 'frequently asked', 'question'] },
  ]

  return sections
    .map((section) => `## ${section.title}\n${extractSnippet(text, section.patterns)}`)
    .join('\n\n')
}

export function extractTextFromHtml(html: string) {
  return collapseWhitespace(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<header[\s\S]*?<\/header>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
  )
}

export async function importWebsiteContent(url: string) {
  const { url: normalizedUrl, text: html } = await fetchTextFromUrl(url, MAX_HTML_BYTES)
  const text = extractTextFromHtml(html)

  if (!text) {
    throw new Error('No readable text found on website')
  }

  return {
    url: normalizedUrl,
    title: new URL(normalizedUrl).hostname,
    content: `${buildDentalStructuredNotes(text)}\n\n## Full Page Text\n${text}`,
  }
}

function parseSitemapUrls(xml: string): string[] {
  const matches = Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/gim))
  return matches
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value))
}

export async function importSitemapContent(inputUrl: string, maxPages = 20) {
  const { url: normalizedUrl, text: xml } = await fetchTextFromUrl(inputUrl, MAX_SITEMAP_BYTES)
  const urls = parseSitemapUrls(xml).slice(0, maxPages)

  if (urls.length === 0) {
    throw new Error('No page URLs found in sitemap.xml')
  }

  const pages: Array<{ url: string; title: string; content: string }> = []
  for (const pageUrl of urls) {
    try {
      const { url, text: html } = await fetchTextFromUrl(pageUrl, MAX_HTML_BYTES)
      const text = extractTextFromHtml(html)
      if (!text) continue
      pages.push({
        url,
        title: new URL(url).pathname || url,
        content: `${buildDentalStructuredNotes(text)}\n\n## Full Page Text\n${text}`,
      })
    } catch {
      // Skip broken page URLs to keep the sitemap import resilient.
    }
  }

  if (pages.length === 0) {
    throw new Error('No readable page content found from sitemap URLs')
  }

  return {
    sitemapUrl: normalizedUrl,
    pages,
  }
}

function csvToText(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/,/g, ' | ').trim())
    .filter(Boolean)
    .join('\n')
}

export async function extractTextFromUploadedFile(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer())
  const lowerName = file.name.toLowerCase()

  if (lowerName.endsWith('.txt')) {
    return buffer.toString('utf8')
  }

  if (lowerName.endsWith('.csv')) {
    return csvToText(buffer.toString('utf8'))
  }

  if (lowerName.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer })
    return collapseWhitespace(result.value)
  }

  if (lowerName.endsWith('.pdf')) {
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    await parser.destroy()
    return collapseWhitespace(result.text)
  }

  throw new Error('Unsupported file type')
}

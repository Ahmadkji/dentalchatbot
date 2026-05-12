import mammoth from 'mammoth'
import { PDFParse } from 'pdf-parse'

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
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
  const normalizedUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
  const response = await fetch(normalizedUrl, {
    headers: {
      'user-agent': 'ClinicKnowledgeImporter/1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`Website returned ${response.status}`)
  }

  const html = await response.text()
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
  const normalizedUrl = inputUrl.startsWith('http://') || inputUrl.startsWith('https://') ? inputUrl : `https://${inputUrl}`
  const sitemapRes = await fetch(normalizedUrl, {
    headers: {
      'user-agent': 'ClinicKnowledgeImporter/1.0',
    },
  })

  if (!sitemapRes.ok) {
    throw new Error(`Sitemap returned ${sitemapRes.status}`)
  }

  const xml = await sitemapRes.text()
  const urls = parseSitemapUrls(xml).slice(0, maxPages)

  if (urls.length === 0) {
    throw new Error('No page URLs found in sitemap.xml')
  }

  const pages: Array<{ url: string; title: string; content: string }> = []
  for (const pageUrl of urls) {
    try {
      const pageRes = await fetch(pageUrl, {
        headers: {
          'user-agent': 'ClinicKnowledgeImporter/1.0',
        },
      })
      if (!pageRes.ok) continue
      const html = await pageRes.text()
      const text = extractTextFromHtml(html)
      if (!text) continue
      pages.push({
        url: pageUrl,
        title: new URL(pageUrl).pathname || pageUrl,
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

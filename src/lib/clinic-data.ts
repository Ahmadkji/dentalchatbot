let clinicCounter = 0

function createId(): string {
  clinicCounter += 1
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `k${ts}${rand}${clinicCounter}`
}

type SortDirection = 'asc' | 'desc'
type BaseRow = {
  id: string
  createdAt: Date
  updatedAt: Date
}
type WhereClause<T> = Partial<T>
type OrderBy<T> =
  | Partial<Record<Extract<keyof T, string>, SortDirection>>
  | Array<Partial<Record<Extract<keyof T, string>, SortDirection>>>

function matchesWhere<T extends object>(item: T, where: WhereClause<T>): boolean {
  const record = item as Record<string, unknown>
  return Object.entries(where).every(([key, value]) => record[key] === value)
}

interface Table<T extends BaseRow> {
  data: T[]
  findMany(opts?: { where?: WhereClause<T>; orderBy?: OrderBy<T> }): T[]
  findUnique(opts: { where: { id: string } }): T | null
  findFirst(opts?: { where?: WhereClause<T>; orderBy?: OrderBy<T> }): T | null
  create(opts: { data: Partial<T> }): T
  update(opts: { where: { id: string }; data: Partial<T> }): T
  delete(opts: { where: { id: string } }): T
}

function sortRecords<T extends object>(rows: T[], orderBy?: OrderBy<T>): T[] {
  if (!orderBy) return rows

  const entries = (Array.isArray(orderBy) ? orderBy : [orderBy]).flatMap((entry) =>
    Object.entries(entry) as Array<[Extract<keyof T, string>, SortDirection]>,
  )

  let result = [...rows]
  for (const [key, direction] of entries) {
    result = result.sort((a, b) => {
      const va = a[key]
      const vb = b[key]

      if (va instanceof Date && vb instanceof Date) {
        return direction === 'asc' ? va.getTime() - vb.getTime() : vb.getTime() - va.getTime()
      }

      if (typeof va === 'string' && typeof vb === 'string') {
        return direction === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }

      if (typeof va === 'number' && typeof vb === 'number') {
        return direction === 'asc' ? va - vb : vb - va
      }

      return 0
    })
  }

  return result
}

function createTable<T extends BaseRow>(): Table<T> {
  return {
    data: [],
    findMany(opts) {
      const where = opts?.where
      const filtered = where ? this.data.filter((item) => matchesWhere(item, where)) : this.data
      return sortRecords(filtered, opts?.orderBy)
    },
    findUnique(opts) {
      return this.data.find((item) => item.id === opts.where.id) ?? null
    },
    findFirst(opts) {
      return this.findMany(opts)[0] ?? null
    },
    create(opts) {
      const now = new Date()
      const row = {
        ...opts.data,
        id: opts.data.id ?? createId(),
        createdAt: opts.data.createdAt ?? now,
        updatedAt: opts.data.updatedAt ?? now,
      } as T
      this.data.push(row)
      return row
    },
    update(opts) {
      const index = this.data.findIndex((item) => item.id === opts.where.id)
      if (index === -1) throw new Error('Record not found')
      this.data[index] = { ...this.data[index], ...opts.data, updatedAt: new Date() }
      return this.data[index]
    },
    delete(opts) {
      const index = this.data.findIndex((item) => item.id === opts.where.id)
      if (index === -1) throw new Error('Record not found')
      const [removed] = this.data.splice(index, 1)
      return removed
    },
  }
}

export interface Clinic {
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
  modelMode: 'fast' | 'balanced' | 'accurate'
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface KnowledgeSource {
  id: string
  clinicId: string
  title: string
  type: 'manual_text' | 'website' | 'file'
  content: string
  sourceUrl: string | null
  fileName: string | null
  fileType: string | null
  status: 'processing' | 'trained' | 'failed' | 'needs_refresh'
  chunkCount: number
  lastSyncedAt: Date | null
  errorMessage: string | null
  createdAt: Date
  updatedAt: Date
}

export interface KnowledgeChunk {
  id: string
  clinicId: string
  sourceId: string
  content: string
  order: number
  tokenEstimate: number
  createdAt: Date
  updatedAt: Date
}

export interface WidgetSetting {
  id: string
  clinicId: string
  botName: string
  welcomeMessage: string
  tooltipText: string
  showTooltip: boolean
  inputPlaceholder: string
  primaryColor: string
  textOnPrimary: string
  widgetPosition: 'bottom-right' | 'bottom-left'
  widgetSize: 'compact' | 'comfortable' | 'large'
  autoOpenDelay: 'off' | '5s' | '10s'
  ctaText: string
  ctaLink: string
  createdAt: Date
  updatedAt: Date
}

export interface QuickPrompt {
  id: string
  clinicId: string
  label: string
  message: string
  actionType: 'message' | 'appointment' | 'link'
  actionValue: string | null
  sortOrder: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const clinics = createTable<Clinic>()
const knowledgeSources = createTable<KnowledgeSource>()
const knowledgeChunks = createTable<KnowledgeChunk>()
const widgetSettings = createTable<WidgetSetting>()
const quickPrompts = createTable<QuickPrompt>()

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length * 0.75))
}

function splitIntoChunks(text: string): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (paragraphs.length === 0) return []

  const chunks: string[] = []
  let current = ''

  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph
    if (next.length <= 650) {
      current = next
      continue
    }

    if (current) chunks.push(current)

    if (paragraph.length <= 650) {
      current = paragraph
      continue
    }

    const sentences = paragraph.split(/(?<=[.!?])\s+/)
    let sentenceChunk = ''
    for (const sentence of sentences) {
      const candidate = sentenceChunk ? `${sentenceChunk} ${sentence}` : sentence
      if (candidate.length <= 650) {
        sentenceChunk = candidate
      } else {
        if (sentenceChunk) chunks.push(sentenceChunk)
        sentenceChunk = sentence
      }
    }
    current = sentenceChunk
  }

  if (current) chunks.push(current)
  return chunks
}

export async function rebuildKnowledgeSourceChunks(sourceId: string) {
  const source = knowledgeSources.findUnique({ where: { id: sourceId } })
  if (!source) {
    throw new Error('Knowledge source not found')
  }

  knowledgeChunks.data = knowledgeChunks.data.filter((chunk) => chunk.sourceId !== sourceId)

  const chunks = splitIntoChunks(source.content)
  chunks.forEach((content, index) => {
    knowledgeChunks.create({
      data: {
        clinicId: source.clinicId,
        sourceId,
        content,
        order: index + 1,
        tokenEstimate: estimateTokens(content),
      },
    })
  })

  knowledgeSources.update({
    where: { id: sourceId },
    data: {
      chunkCount: chunks.length,
      lastSyncedAt: new Date(),
      status: chunks.length > 0 ? 'trained' : 'failed',
      errorMessage: chunks.length > 0 ? null : 'No readable text found in source.',
    },
  })
}

function seedClinicData() {
  if (clinics.data.length > 0) return

  const clinic = clinics.create({
    data: {
      name: 'BrightSmile Dental Clinic',
      slug: 'brightsmile-dental-clinic',
      address: '123 Dental Street, Health City, HC 560001',
      city: 'Health City',
      country: 'Pakistan',
      primaryPhone: '(555) 100-2000',
      whatsappNumber: '+15551002000',
      openingHours: 'Mon-Sat from 5 PM to 10 PM. Closed on Friday.',
      appointmentRules: 'Appointments are preferred, but walk-ins are accepted before 8 PM. Patients can also request appointments through WhatsApp.',
      pricingNotes: 'Consultation fee starts from Rs. 1500. Final treatment pricing depends on the doctor review and treatment plan.',
      emergencyInstructions: 'If this is a medical emergency, call local emergency services or visit the nearest emergency department. For urgent dental pain, contact the clinic immediately on WhatsApp or phone.',
      timezone: 'Asia/Karachi',
      modelMode: 'balanced',
      isActive: true,
    },
  })

  const seedSources = [
    {
      title: 'Appointment Rules',
      content:
        'The clinic is open Monday to Saturday from 5 PM to 10 PM and closed on Friday.\n\nAppointments are preferred, but walk-ins are accepted before 8 PM.\n\nEmergency dental pain patients can contact the clinic on WhatsApp.',
    },
    {
      title: 'Pricing Notes',
      content:
        'Consultation fee starts from Rs. 1500.\n\nRoot canal and cosmetic treatment pricing is confirmed after dentist review.\n\nPatients should contact the clinic for exact treatment package pricing.',
    },
  ]

  seedSources.forEach((item) => {
    const source = knowledgeSources.create({
      data: {
        clinicId: clinic.id,
        title: item.title,
        type: 'manual_text',
        content: item.content,
        sourceUrl: null,
        fileName: null,
        fileType: null,
        status: 'processing',
        chunkCount: 0,
        lastSyncedAt: null,
        errorMessage: null,
      },
    })
    void rebuildKnowledgeSourceChunks(source.id)
  })

  const websiteSeeds: Array<{ title: string; url: string; content: string; status: KnowledgeSource['status']; chunkCount: number; errorMsg: string | null }> = [
    {
      title: 'Root Canal Treatment',
      url: 'https://brightsmileclinic.com/services/root-canal',
      content:
        'Root Canal Treatment\n\nRoot canal treatment is used to save a badly infected tooth. The procedure involves removing the damaged pulp, cleaning the root canal, and sealing the tooth.\n\nTreatment duration depends on the case and typically takes 60-90 minutes. Appointments are required for this procedure.\n\nPricing for root canal treatment starts from Rs. 3,000 and varies based on the complexity of the case. Consultation fee starts from Rs. 1,500.\n\nAfter-care instructions: Avoid chewing on the treated side for 24 hours. Take prescribed medication as directed. Contact the clinic if pain persists beyond 48 hours.',
      status: 'trained',
      chunkCount: 4,
      errorMsg: null,
    },
    {
      title: 'Contact Us',
      url: 'https://brightsmileclinic.com/contact',
      content:
        'Contact Us\n\nBrightSmile Dental Clinic\nAddress: 123 Dental Street, Health City, HC 560001\nPhone: (555) 100-2000\nWhatsApp: +15551002000\n\nOpening Hours: Mon-Sat, 5 PM - 10 PM. Closed on Friday and Sunday.\n\nWe are near City Hospital, on the 2nd floor, opposite the pharmacy. Free parking is available behind the building.\n\nFor dental emergencies, call our emergency line at (555) 100-2001.',
      status: 'trained',
      chunkCount: 3,
      errorMsg: null,
    },
    {
      title: 'Dental Services',
      url: 'https://brightsmileclinic.com/services/braces',
      content: '',
      status: 'failed',
      chunkCount: 0,
      errorMsg: 'This page could not be reached. The website may be blocking automated requests.',
    },
    {
      title: 'Pricing',
      url: 'https://brightsmileclinic.com/pricing',
      content:
        'Pricing\n\nConsultation fee starts from Rs. 1,500. Final treatment pricing depends on the doctor review and treatment plan.\n\nServices and estimated pricing:\nDental Cleaning: Rs. 2,000 - Rs. 3,000\nRoot Canal: Rs. 3,000 - Rs. 8,000\nBraces & Orthodontics: Rs. 50,000 - Rs. 150,000\nTeeth Whitening: Rs. 5,000 - Rs. 15,000\nDental Implants: Rs. 25,000 - Rs. 50,000 per implant\n\nWe accept most major dental insurance plans. Payment plans are available for treatments above Rs. 10,000.',
      status: 'needs_refresh',
      chunkCount: 4,
      errorMsg: null,
    },
  ]

  websiteSeeds.forEach((ws) => {
    const source = knowledgeSources.create({
      data: {
        clinicId: clinic.id,
        title: ws.title,
        type: 'website',
        content: ws.content,
        sourceUrl: ws.url,
        fileName: null,
        fileType: null,
        status: ws.status,
        chunkCount: ws.chunkCount,
        lastSyncedAt: ws.status === 'trained' ? new Date(Date.now() - 86400000) : null,
        errorMessage: ws.errorMsg,
      },
    })
    if (ws.status === 'trained' && ws.content) {
      void rebuildKnowledgeSourceChunks(source.id)
    }
  })

  widgetSettings.create({
    data: {
      clinicId: clinic.id,
      botName: 'BrightSmile Assistant',
      welcomeMessage: 'Hi, welcome to BrightSmile Dental Clinic. I can help with appointments, services, timings, and location.',
      tooltipText: 'Need help booking an appointment?',
      showTooltip: true,
      inputPlaceholder: 'Ask about appointments, timings, or services...',
      primaryColor: '#059669',
      textOnPrimary: '#FFFFFF',
      widgetPosition: 'bottom-right',
      widgetSize: 'comfortable',
      autoOpenDelay: 'off',
      ctaText: 'Book Appointment',
      ctaLink: 'https://wa.me/15551002000',
    },
  })

  const seedPrompts: Array<Omit<QuickPrompt, 'id' | 'createdAt' | 'updatedAt'>> = [
    {
      clinicId: clinic.id,
      label: 'Book Appointment',
      message: "I'd like to book an appointment",
      actionType: 'appointment',
      actionValue: null,
      sortOrder: 1,
      isActive: true,
    },
    {
      clinicId: clinic.id,
      label: 'Tooth Pain',
      message: 'I have tooth pain. What should I do?',
      actionType: 'message',
      actionValue: null,
      sortOrder: 2,
      isActive: true,
    },
    {
      clinicId: clinic.id,
      label: 'Braces',
      message: 'Tell me about braces and aligners.',
      actionType: 'message',
      actionValue: null,
      sortOrder: 3,
      isActive: true,
    },
    {
      clinicId: clinic.id,
      label: 'Root Canal',
      message: 'Tell me about root canal treatment.',
      actionType: 'message',
      actionValue: null,
      sortOrder: 4,
      isActive: true,
    },
    {
      clinicId: clinic.id,
      label: 'Teeth Cleaning',
      message: 'What is included in dental cleaning?',
      actionType: 'message',
      actionValue: null,
      sortOrder: 5,
      isActive: true,
    },
    {
      clinicId: clinic.id,
      label: 'Clinic Location',
      message: 'Where is the clinic located?',
      actionType: 'message',
      actionValue: null,
      sortOrder: 6,
      isActive: true,
    },
    {
      clinicId: clinic.id,
      label: 'WhatsApp Clinic',
      message: 'How can I contact you on WhatsApp?',
      actionType: 'link',
      actionValue: 'https://wa.me/15551002000',
      sortOrder: 7,
      isActive: true,
    },
    {
      clinicId: clinic.id,
      label: 'Consultation Fee',
      message: 'What is the consultation fee?',
      actionType: 'message',
      actionValue: null,
      sortOrder: 8,
      isActive: true,
    },
    {
      clinicId: clinic.id,
      label: 'Clinic Timings',
      message: 'What are your clinic timings?',
      actionType: 'message',
      actionValue: null,
      sortOrder: 9,
      isActive: true,
    },
  ]

  seedPrompts.forEach((prompt) => {
    quickPrompts.create({ data: prompt })
  })
}

seedClinicData()

export const clinicData = {
  clinic: {
    findMany: (opts?: Parameters<Table<Clinic>['findMany']>[0]) => Promise.resolve(clinics.findMany(opts)),
    findUnique: (opts: Parameters<Table<Clinic>['findUnique']>[0]) => Promise.resolve(clinics.findUnique(opts)),
    findFirst: (opts?: Parameters<Table<Clinic>['findFirst']>[0]) => Promise.resolve(clinics.findFirst(opts)),
    create: (opts: Parameters<Table<Clinic>['create']>[0]) => Promise.resolve(clinics.create(opts)),
    update: (opts: Parameters<Table<Clinic>['update']>[0]) => Promise.resolve(clinics.update(opts)),
    delete: (opts: Parameters<Table<Clinic>['delete']>[0]) => Promise.resolve(clinics.delete(opts)),
  },
  knowledgeSource: {
    findMany: (opts?: Parameters<Table<KnowledgeSource>['findMany']>[0]) => Promise.resolve(knowledgeSources.findMany(opts)),
    findUnique: (opts: Parameters<Table<KnowledgeSource>['findUnique']>[0]) => Promise.resolve(knowledgeSources.findUnique(opts)),
    findFirst: (opts?: Parameters<Table<KnowledgeSource>['findFirst']>[0]) => Promise.resolve(knowledgeSources.findFirst(opts)),
    create: (opts: Parameters<Table<KnowledgeSource>['create']>[0]) => Promise.resolve(knowledgeSources.create(opts)),
    update: (opts: Parameters<Table<KnowledgeSource>['update']>[0]) => Promise.resolve(knowledgeSources.update(opts)),
    delete: (opts: Parameters<Table<KnowledgeSource>['delete']>[0]) => Promise.resolve(knowledgeSources.delete(opts)),
  },
  knowledgeChunk: {
    findMany: (opts?: Parameters<Table<KnowledgeChunk>['findMany']>[0]) => Promise.resolve(knowledgeChunks.findMany(opts)),
    findUnique: (opts: Parameters<Table<KnowledgeChunk>['findUnique']>[0]) => Promise.resolve(knowledgeChunks.findUnique(opts)),
    findFirst: (opts?: Parameters<Table<KnowledgeChunk>['findFirst']>[0]) => Promise.resolve(knowledgeChunks.findFirst(opts)),
    create: (opts: Parameters<Table<KnowledgeChunk>['create']>[0]) => Promise.resolve(knowledgeChunks.create(opts)),
    update: (opts: Parameters<Table<KnowledgeChunk>['update']>[0]) => Promise.resolve(knowledgeChunks.update(opts)),
    delete: (opts: Parameters<Table<KnowledgeChunk>['delete']>[0]) => Promise.resolve(knowledgeChunks.delete(opts)),
  },
  widgetSetting: {
    findMany: (opts?: Parameters<Table<WidgetSetting>['findMany']>[0]) => Promise.resolve(widgetSettings.findMany(opts)),
    findUnique: (opts: Parameters<Table<WidgetSetting>['findUnique']>[0]) => Promise.resolve(widgetSettings.findUnique(opts)),
    findFirst: (opts?: Parameters<Table<WidgetSetting>['findFirst']>[0]) => Promise.resolve(widgetSettings.findFirst(opts)),
    create: (opts: Parameters<Table<WidgetSetting>['create']>[0]) => Promise.resolve(widgetSettings.create(opts)),
    update: (opts: Parameters<Table<WidgetSetting>['update']>[0]) => Promise.resolve(widgetSettings.update(opts)),
    delete: (opts: Parameters<Table<WidgetSetting>['delete']>[0]) => Promise.resolve(widgetSettings.delete(opts)),
  },
  quickPrompt: {
    findMany: (opts?: Parameters<Table<QuickPrompt>['findMany']>[0]) => Promise.resolve(quickPrompts.findMany(opts)),
    findUnique: (opts: Parameters<Table<QuickPrompt>['findUnique']>[0]) => Promise.resolve(quickPrompts.findUnique(opts)),
    findFirst: (opts?: Parameters<Table<QuickPrompt>['findFirst']>[0]) => Promise.resolve(quickPrompts.findFirst(opts)),
    create: (opts: Parameters<Table<QuickPrompt>['create']>[0]) => Promise.resolve(quickPrompts.create(opts)),
    update: (opts: Parameters<Table<QuickPrompt>['update']>[0]) => Promise.resolve(quickPrompts.update(opts)),
    delete: (opts: Parameters<Table<QuickPrompt>['delete']>[0]) => Promise.resolve(quickPrompts.delete(opts)),
  },
}

export async function getDefaultClinic() {
  return clinicData.clinic.findFirst({ orderBy: { createdAt: 'asc' } })
}

export async function getDefaultWidgetSettings() {
  const clinic = await getDefaultClinic()
  if (!clinic) return null
  return clinicData.widgetSetting.findFirst({ where: { clinicId: clinic.id } })
}

export async function createKnowledgeSource(input: {
  clinicId: string
  title: string
  type: 'manual_text' | 'website' | 'file'
  content: string
  sourceUrl?: string | null
  fileName?: string | null
  fileType?: string | null
}) {
  const source = await clinicData.knowledgeSource.create({
    data: {
      clinicId: input.clinicId,
      title: input.title,
      type: input.type,
      content: input.content,
      sourceUrl: input.sourceUrl ?? null,
      fileName: input.fileName ?? null,
      fileType: input.fileType ?? null,
      status: 'processing',
      chunkCount: 0,
      lastSyncedAt: null,
      errorMessage: null,
    },
  })

  await rebuildKnowledgeSourceChunks(source.id)
  return clinicData.knowledgeSource.findUnique({ where: { id: source.id } })
}

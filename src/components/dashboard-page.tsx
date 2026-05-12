'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  BookOpenText,
  CheckCircle2,
  MessageSquare,
  Target,
  TrendingUp,
  AlertCircle,
  Sparkles,
  ArrowUpDown,
  Trophy,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'

interface DashboardStats {
  totalConversations: number
  openConversations: number
  escalatedConversations: number
  resolvedConversations: number
  resolutionRate: number
  totalLeads: number
  newLeads: number
  contactedLeads: number
  bookedLeads: number
  leadCaptureRate: number
  helpfulRate: number
  sourceCount: number
  trainedSourceCount: number
  staleSourceCount: number
  totalKnowledgeChunks: number
  unansweredCount: number
  whatsappClicks: number
  callClicks: number
  locationClicks: number
  directionsClicks: number
  appointmentEventCount: number
  afterHoursLeadCount: number
}

interface ConversationRow {
  id: string
  visitorName: string
  status: string
  messageCount: number
  leadCaptured: boolean
  helpfulStatus: 'helpful' | 'not_helpful' | 'unreviewed'
  sourcePage: string | null
  updatedAt: string
}

interface LeadRow {
  id: string
  name: string
  status: string
  preferredContact: string
  source: string
  createdAt: string
}

interface SourceRow {
  id: string
  title: string
  type: 'manual_text' | 'website' | 'file'
  status: 'processing' | 'trained' | 'failed' | 'needs_refresh'
  chunkCount: number
  updatedAt: string
}

interface TopServiceRow {
  service: string
  count: number
}

interface UnansweredPreviewRow {
  id: string
  question: string
  sourcePage: string | null
  createdAt: string
  status: string
}

const statusStyles: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  closed: 'bg-slate-100 text-slate-700 border-slate-200',
  trained: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  processing: 'bg-sky-50 text-sky-700 border-sky-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  needs_refresh: 'bg-amber-50 text-amber-700 border-amber-200',
  new: 'bg-sky-50 text-sky-700 border-sky-200',
  contacted: 'bg-amber-50 text-amber-700 border-amber-200',
  booked: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  lost: 'bg-slate-100 text-slate-700 border-slate-200',
  spam: 'bg-red-50 text-red-700 border-red-200',
}

function RowStatus({ value }: { value: string }) {
  return (
    <Badge
      variant="outline"
      className={`text-[11px] font-medium ${statusStyles[value] || 'bg-slate-100 text-slate-700 border-slate-200'}`}
    >
      {value.replace('_', ' ')}
    </Badge>
  )
}

const cardNavTargets: Record<string, string> = {
  'Total Conversations': 'conversations',
  'Lead Capture Rate': 'leads',
  'Resolution Rate': 'conversations',
  'Helpful Score': 'conversations',
  'Knowledge Sources': 'knowledge-base',
  'Indexed Chunks': 'knowledge-base',
  'WhatsApp Clicks (Today)': 'customizations',
  'After-Hours Leads': 'leads',
  'Unanswered Questions': 'unanswered-questions',
}

export default function DashboardPage() {
  const { setActivePage } = useAppStore()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [sources, setSources] = useState<SourceRow[]>([])
  const [topServices, setTopServices] = useState<TopServiceRow[]>([])
  const [unansweredPreview, setUnansweredPreview] = useState<UnansweredPreviewRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/dashboard')
        if (!res.ok) throw new Error('Failed to load dashboard')
        const data = await res.json()
        setStats(data.stats || null)
        setConversations(data.recentConversations || [])
        setLeads(data.recentLeads || [])
        setSources(data.sourceHealth || [])
        setTopServices(data.topServicesAsked || [])
        setUnansweredPreview(data.unansweredPreview || [])
      } catch {
        setStats(null)
        setConversations([])
        setLeads([])
        setSources([])
        setTopServices([])
        setUnansweredPreview([])
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const pillTone: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    sky: 'bg-sky-50 text-sky-700 border-sky-200/60',
    amber: 'bg-amber-50 text-amber-700 border-amber-200/60',
    slate: 'bg-slate-50 text-slate-600 border-slate-200/60',
  }

  const cards = useMemo(() => {
    if (!stats) return []
    return [
      {
        label: 'Total Conversations',
        value: stats.totalConversations,
        details: [
          { label: 'Open', value: stats.openConversations, tone: 'sky' as const },
          { label: 'Escalated', value: stats.escalatedConversations, tone: 'amber' as const },
        ],
        icon: MessageSquare,
      },
      {
        label: 'Lead Capture Rate',
        value: `${stats.leadCaptureRate}%`,
        details: [
          { label: 'Total Leads', value: stats.totalLeads, tone: 'emerald' as const },
          { label: 'New', value: stats.newLeads, tone: 'sky' as const },
        ],
        icon: Target,
      },
      {
        label: 'Resolution Rate',
        value: `${stats.resolutionRate}%`,
        details: [
          { label: 'Resolved', value: stats.resolvedConversations, tone: 'emerald' as const },
        ],
        icon: CheckCircle2,
      },
      {
        label: 'Helpful Score',
        value: `${stats.helpfulRate}%`,
        details: [
          { label: 'Context', value: 'Reviewed convos', tone: 'slate' as const },
        ],
        icon: TrendingUp,
      },
      {
        label: 'Knowledge Sources',
        value: stats.sourceCount,
        details: [
          { label: 'Trained', value: stats.trainedSourceCount, tone: 'emerald' as const },
          { label: 'Stale', value: stats.staleSourceCount, tone: 'amber' as const },
        ],
        icon: BookOpenText,
      },
      {
        label: 'Indexed Chunks',
        value: stats.totalKnowledgeChunks,
        details: [
          { label: 'Status', value: 'Retrieval-ready', tone: 'emerald' as const },
        ],
        icon: Sparkles,
      },
      {
        label: 'WhatsApp Clicks (Today)',
        value: stats.whatsappClicks,
        details: [
          { label: 'Calls', value: stats.callClicks, tone: 'sky' as const },
          { label: 'Location', value: stats.locationClicks + stats.directionsClicks, tone: 'slate' as const },
        ],
        icon: MessageSquare,
      },
      {
        label: 'After-Hours Leads',
        value: stats.afterHoursLeadCount,
        details: [
          { label: 'Context', value: 'Outside hours', tone: 'amber' as const },
        ],
        icon: AlertCircle,
      },
      {
        label: 'Unanswered Questions',
        value: stats.unansweredCount,
        details: [
          { label: 'Status', value: 'Awaiting review', tone: 'amber' as const },
        ],
        icon: Target,
      },
    ]
  }, [stats])

  return (
    <div className="space-y-6 md:space-y-7">
      <section className="rounded-lg border bg-white overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50/80">
          <h2 className="text-sm font-semibold text-slate-700">Key Performance Indicators</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
              <TableHead className="w-10"></TableHead>
              <TableHead>Metric</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead className="hidden sm:table-cell">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 9 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="size-5 rounded" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="ml-auto h-5 w-16" /></TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex gap-1.5">
                        <Skeleton className="h-5 w-20 rounded-md" />
                        <Skeleton className="h-5 w-16 rounded-md" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              : cards.map((card) => (
                  <TableRow
                    key={card.label}
                    className="group cursor-pointer hover:bg-emerald-50/40 transition-colors"
                    onClick={() => setActivePage((cardNavTargets[card.label] as any) || 'dashboard')}
                  >
                    <TableCell>
                      <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                        <card.icon className="size-4" />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{card.label}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-lg font-semibold tracking-tight tabular-nums">{card.value}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1.5">
                        {card.details.map((d) => (
                          <span
                            key={d.label}
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${pillTone[d.tone]}`}
                          >
                            <span className="text-[10px] opacity-70">{d.label}</span>
                            <span className="font-semibold">{d.value}</span>
                          </span>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
            }
          </TableBody>
        </Table>
      </section>

      <section className="space-y-3">
        <div className="rounded-lg border bg-white overflow-hidden">
          <div className="px-4 py-2.5 border-b bg-slate-50/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="size-3.5 text-amber-500" />
              <h3 className="text-sm font-medium text-slate-700">Top Services Asked</h3>
            </div>
            <span className="text-[11px] text-muted-foreground">{topServices.length} services</span>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : topServices.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="w-10 text-center">#</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead className="text-right w-20">Count</TableHead>
                  <TableHead className="hidden sm:table-cell w-32">Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topServices.map((row, idx) => {
                  const maxCount = Math.max(...topServices.map((r) => r.count), 1)
                  const pct = Math.round((row.count / maxCount) * 100)
                  const medalColor = idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-orange-400' : 'text-slate-300'
                  return (
                    <TableRow key={row.service} className="group cursor-pointer hover:bg-emerald-50/40 transition-colors" onClick={() => setActivePage('conversations')}>
                      <TableCell className="text-center">
                        <span className={`text-xs font-bold ${medalColor}`}>{idx + 1}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium group-hover:text-emerald-600 transition-colors">{row.service}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="tabular-nums font-semibold">{row.count}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-emerald-500 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{pct}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-6 text-center">
              <p className="text-xs text-muted-foreground">No service-intent signals yet.</p>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Conversation Quality Queue</h2>
          <Button variant="ghost" size="sm" className="h-8 w-full text-xs sm:h-7 sm:w-auto" onClick={() => setActivePage('conversations')}>
            Open Inbox
          </Button>
        </div>
        <div className="rounded-md border bg-white">
          <Table className="min-w-[500px] sm:min-w-[620px]">
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead>Visitor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Messages</TableHead>
                <TableHead className="hidden sm:table-cell">Lead</TableHead>
                <TableHead className="hidden sm:table-cell">Feedback</TableHead>
                <TableHead className="hidden md:table-cell">Source Page</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : conversations.length > 0 ? (
                conversations.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-emerald-50/40 transition-colors"
                    onClick={() => setActivePage('conversations')}
                  >
                    <TableCell className="max-w-[180px] font-medium whitespace-normal break-words">
                      <div>{row.visitorName}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground md:hidden">{row.sourcePage || 'Direct'}</div>
                    </TableCell>
                    <TableCell><RowStatus value={row.status} /></TableCell>
                    <TableCell className="text-center tabular-nums">{row.messageCount}</TableCell>
                    <TableCell className="hidden sm:table-cell">{row.leadCaptured ? 'Captured' : 'No'}</TableCell>
                    <TableCell className="hidden sm:table-cell capitalize">{row.helpfulStatus.replace('_', ' ')}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {row.sourcePage || '—'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No conversation activity yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Bot Could Not Answer</h2>
          <Button variant="ghost" size="sm" className="h-8 w-full text-xs sm:h-7 sm:w-auto" onClick={() => setActivePage('unanswered-questions')}>
            Open Inbox
          </Button>
        </div>
        <div className="rounded-md border bg-white">
          <Table className="min-w-[420px] sm:min-w-[500px]">
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead>Question</TableHead>
                <TableHead className="hidden md:table-cell">Source Page</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-56" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : unansweredPreview.length > 0 ? (
                unansweredPreview.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-emerald-50/40 transition-colors"
                    onClick={() => setActivePage('unanswered-questions')}
                  >
                    <TableCell className="max-w-[220px] font-medium whitespace-normal break-words">{row.question}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{row.sourcePage || '—'}</TableCell>
                    <TableCell><RowStatus value={row.status} /></TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">No unanswered questions</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Lead Pipeline</h2>
            <Button variant="ghost" size="sm" className="h-8 w-full text-xs sm:h-7 sm:w-auto" onClick={() => setActivePage('leads')}>
              View Leads
            </Button>
          </div>
          <div className="rounded-md border bg-white">
            <Table className="min-w-[430px] sm:min-w-[500px]">
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Contact</TableHead>
                  <TableHead className="hidden md:table-cell">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : leads.length > 0 ? (
                  leads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer hover:bg-emerald-50/40 transition-colors"
                      onClick={() => setActivePage('leads')}
                    >
                      <TableCell className="max-w-[170px] font-medium whitespace-normal break-words">{lead.name}</TableCell>
                      <TableCell><RowStatus value={lead.status} /></TableCell>
                      <TableCell className="hidden sm:table-cell capitalize">{lead.preferredContact}</TableCell>
                      <TableCell className="hidden md:table-cell uppercase text-xs text-muted-foreground">{lead.source}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                      No leads yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Knowledge Source Health</h2>
            <Button variant="ghost" size="sm" className="h-8 w-full text-xs sm:h-7 sm:w-auto" onClick={() => setActivePage('knowledge-base')}>
              Manage Sources
            </Button>
          </div>
          <div className="rounded-md border bg-white">
            <Table className="min-w-[430px] sm:min-w-[500px]">
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead>Source</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Chunks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : sources.length > 0 ? (
                  sources.map((source) => (
                    <TableRow
                      key={source.id}
                      className="cursor-pointer hover:bg-emerald-50/40 transition-colors"
                      onClick={() => setActivePage('knowledge-base')}
                    >
                      <TableCell className="max-w-[180px] font-medium whitespace-normal break-words">{source.title}</TableCell>
                      <TableCell className="hidden sm:table-cell uppercase text-xs text-muted-foreground">{source.type.replace('_', ' ')}</TableCell>
                      <TableCell><RowStatus value={source.status} /></TableCell>
                      <TableCell className="text-center tabular-nums">{source.chunkCount}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <AlertCircle className="size-3.5" />
                        Add your first source to start training
                      </span>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-slate-50 p-4 sm:p-5">
        <h3 className="text-sm font-medium">SiteGPT-style flow for dental clinics</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Train from clinic content, monitor conversations, capture appointment-intent leads, and improve quality with helpful/not-helpful feedback.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button size="sm" className="w-full sm:w-auto" onClick={() => setActivePage('clinic-profile')}>Configure Bot Setup</Button>
          <Button size="sm" className="w-full sm:w-auto" variant="outline" onClick={() => setActivePage('widget-install')}>Customize Widget</Button>
        </div>
      </section>
    </div>
  )
}

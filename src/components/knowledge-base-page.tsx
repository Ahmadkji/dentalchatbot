'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Globe,
  Eye,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  BookText,
  Loader2,
  MapPin,
  Phone,
  ClockIcon,
  CreditCard,
  Stethoscope,
  ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'

// --- Types ---

type ImportType = 'single' | 'homepage' | 'sitemap'

interface KnowledgeSource {
  id: string
  title: string
  type: 'manual_text' | 'website' | 'file'
  content: string
  sourceUrl: string | null
  fileName: string | null
  status: 'processing' | 'trained' | 'failed' | 'needs_refresh'
  chunkCount: number
  lastSyncedAt: string | null
  errorMessage: string | null
  updatedAt: string
}

interface DetectedDetail {
  field: string
  label: string
  value: string
  confidence: 'high' | 'medium' | 'low'
}

// --- Config ---

const statusConfig: Record<KnowledgeSource['status'], { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  processing: { label: 'Processing', className: 'bg-amber-50 text-amber-700 border-amber-200', icon: Loader2 },
  trained: { label: 'Trained', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  failed: { label: 'Failed', className: 'bg-red-50 text-red-700 border-red-200', icon: AlertCircle },
  needs_refresh: { label: 'Needs Refresh', className: 'bg-sky-50 text-sky-700 border-sky-200', icon: RefreshCw },
}

const detailIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  phone: Phone,
  whatsapp: Phone,
  address: MapPin,
  opening_hours: ClockIcon,
  services: Stethoscope,
  pricing: CreditCard,
  doctors: Stethoscope,
  emergency: AlertCircle,
}

const emptyForm = { title: '', content: '' }

// --- Component ---

export default function KnowledgeBasePage() {
  const [sources, setSources] = useState<KnowledgeSource[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [submitting, setSubmitting] = useState(false)

  // Manual text dialogs
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSource, setEditingSource] = useState<KnowledgeSource | null>(null)
  const [form, setForm] = useState(emptyForm)

  // Website import dialog
  const [websiteDialogOpen, setWebsiteDialogOpen] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importType, setImportType] = useState<ImportType>('single')
  const [sitemapUrl, setSitemapUrl] = useState('')

  // File upload dialog
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // Content preview dialog
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [previewSource, setPreviewSource] = useState<KnowledgeSource | null>(null)

  // Smart detection dialog
  const [detectionDialogOpen, setDetectionDialogOpen] = useState(false)
  const [detectedDetails, setDetectedDetails] = useState<DetectedDetail[]>([])
  const [detecting, setDetecting] = useState(false)

  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteSource, setDeleteSource] = useState<KnowledgeSource | null>(null)

  // --- Data fetching ---

  const fetchSources = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/knowledge-sources?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch sources')
      const data = await res.json()
      setSources(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Failed to load knowledge base')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchSources()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [fetchSources])

  const filteredSources = useMemo(
    () =>
      sources.filter((source) => {
        const query = search.toLowerCase()
        return (
          source.title.toLowerCase().includes(query) ||
          source.content.toLowerCase().includes(query) ||
          (source.sourceUrl || '').toLowerCase().includes(query)
        )
      }),
    [search, sources]
  )

  // --- URL validation ---

  const validateUrl = (url: string): string | null => {
    if (!url.trim()) return 'Please enter a website URL.'
    let normalized = url.trim()
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${normalized}`
    }
    try {
      const parsed = new URL(normalized)
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        return 'Localhost URLs are not supported.'
      }
      if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(parsed.hostname)) {
        return 'Private IP addresses are not supported.'
      }
    } catch {
      return 'Please enter a valid website URL.'
    }
    const existing = sources.find(
      (s) => s.type === 'website' && s.sourceUrl?.replace(/\/+$/, '') === normalized.replace(/\/+$/, '')
    )
    if (existing) return 'This link has already been added.'
    return null
  }

  // --- Handlers: manual text ---

  const openCreate = () => {
    setEditingSource(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (source: KnowledgeSource) => {
    setEditingSource(source)
    setForm({ title: source.title, content: source.content })
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error('Title and content are required')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(editingSource ? `/api/knowledge-sources/${editingSource.id}` : '/api/knowledge-sources', {
        method: editingSource ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success(editingSource ? 'Knowledge updated' : 'Knowledge source added')
      setDialogOpen(false)
      setForm(emptyForm)
      setEditingSource(null)
      fetchSources()
    } catch {
      toast.error('Failed to save knowledge source')
    } finally {
      setSubmitting(false)
    }
  }

  // --- Handlers: website import ---

  const handleWebsiteImport = async () => {
    const urlToValidate = importType === 'sitemap' ? sitemapUrl : importUrl
    const error = validateUrl(urlToValidate)
    if (error) {
      toast.error(error)
      return
    }

    setSubmitting(true)

    if (importType === 'sitemap') {
      try {
        const res = await fetch('/api/knowledge-sources/import-sitemap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sitemapUrl: sitemapUrl.trim() }),
        })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || 'Failed to import sitemap')
        }
        const data = await res.json()
        toast.success(`Imported ${data.importedCount} pages from sitemap`)
        setWebsiteDialogOpen(false)
        setSitemapUrl('')
        setImportUrl('')
        fetchSources()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to import sitemap')
      } finally {
        setSubmitting(false)
      }
    } else {
      // Single page or homepage crawl
      try {
        const res = await fetch('/api/knowledge-sources/import-website', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: importUrl.trim() }),
        })
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || 'Failed to import website')
        }

        const imported = await res.json()
        toast.success(importType === 'homepage' ? 'Website homepage imported successfully' : 'Website page imported successfully')

        // Auto-detect details after successful import
        if (imported?.id) {
          try {
            const detRes = await fetch('/api/knowledge-sources/detect-details', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sourceId: imported.id }),
            })
            if (detRes.ok) {
              const detData = await detRes.json()
              if (detData.details && detData.details.length > 0) {
                setDetectedDetails(detData.details)
                setDetectionDialogOpen(true)
              }
            }
          } catch {
            // Detection failure is non-blocking
          }
        }

        setWebsiteDialogOpen(false)
        setImportUrl('')
        fetchSources()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not import this page. Please check the URL or try again.')
      } finally {
        setSubmitting(false)
      }
    }
  }

  // --- Handlers: file upload ---

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please choose a file')
      return
    }
    setSubmitting(true)
    try {
      const data = new FormData()
      data.append('file', selectedFile)
      const res = await fetch('/api/knowledge-sources/upload', { method: 'POST', body: data })
      if (!res.ok) throw new Error('Failed to upload file')
      toast.success('File imported into knowledge base')
      setUploadDialogOpen(false)
      setSelectedFile(null)
      fetchSources()
    } catch {
      toast.error('Failed to upload file')
    } finally {
      setSubmitting(false)
    }
  }

  // --- Handlers: refresh ---

  const handleRefreshAll = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/knowledge-sources/refresh', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to refresh sources')
      const data = await res.json()
      toast.success(`Refreshed ${data.refreshed}/${data.total} sources`)
      fetchSources()
    } catch {
      toast.error('Failed to refresh sources')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRefresh = async (source: KnowledgeSource) => {
    try {
      const res = await fetch(`/api/knowledge-sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: source.type === 'website', retrain: source.type !== 'website' }),
      })
      if (!res.ok) throw new Error('Failed to refresh source')
      toast.success(source.type === 'website' ? 'Website content refreshed' : 'Knowledge retrained')
      fetchSources()
    } catch {
      toast.error('Failed to refresh source')
    }
  }

  // --- Handlers: delete ---

  const confirmDelete = (source: KnowledgeSource) => {
    setDeleteSource(source)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteSource) return
    try {
      const res = await fetch(`/api/knowledge-sources/${deleteSource.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      toast.success('Knowledge source deleted')
      setDeleteDialogOpen(false)
      if (previewDialogOpen && previewSource?.id === deleteSource.id) {
        setPreviewDialogOpen(false)
        setPreviewSource(null)
      }
      setDeleteSource(null)
      fetchSources()
    } catch {
      toast.error('Failed to delete knowledge source')
    }
  }

  // --- Handlers: content preview ---

  const handleViewContent = async (source: KnowledgeSource) => {
    setPreviewSource(source)
    setPreviewDialogOpen(true)
    setDetectedDetails([])

    if (source.status === 'trained' && source.content) {
      setDetecting(true)
      try {
        const res = await fetch('/api/knowledge-sources/detect-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceId: source.id }),
        })
        if (res.ok) {
          const data = await res.json()
          setDetectedDetails(data.details || [])
        }
      } catch {
        setDetectedDetails([])
      } finally {
        setDetecting(false)
      }
    }
  }

  // --- Helpers ---

  const formatDate = (value: string | null) => {
    if (!value) return '\u2014'
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  }

  const formatRelativeDate = (value: string | null) => {
    if (!value) return '\u2014'
    const date = new Date(value)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000)
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return formatDate(value)
  }

  const getUrlPath = (url: string | null) => {
    if (!url) return null
    try {
      const parsed = new URL(url)
      return parsed.pathname === '/' ? parsed.hostname : parsed.pathname
    } catch {
      return url
    }
  }

  // Stats
  const stats = useMemo(() => {
    const trained = sources.filter((s) => s.status === 'trained').length
    const failed = sources.filter((s) => s.status === 'failed').length
    const totalChunks = sources.reduce((sum, s) => sum + s.chunkCount, 0)
    return { trained, failed, total: sources.length, totalChunks }
  }, [sources])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Knowledge Sources</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Train your dental chatbot with website pages, SOP docs, pricing references, and aftercare guidance.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setWebsiteDialogOpen(true)}>
            <Globe className="mr-1 size-4" />
            Import Website
          </Button>
          <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
            <Upload className="mr-1 size-4" />
            Upload File
          </Button>
          <Button variant="outline" onClick={handleRefreshAll} disabled={submitting}>
            <RefreshCw className="mr-1 size-4" />
            Refresh All
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={openCreate}>
            <Plus className="mr-1 size-4" />
            Add Knowledge
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="py-4">
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Sources</p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-emerald-600">{stats.trained}</div>
            <p className="text-xs text-muted-foreground">Trained & Active</p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="pt-0">
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <p className="text-xs text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="pt-0">
            <div className="text-2xl font-bold">{stats.totalChunks}</div>
            <p className="text-xs text-muted-foreground">Knowledge Chunks</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full min-w-[180px] sm:max-w-sm sm:flex-1">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search knowledge..."
            className="h-9 pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="trained">Trained</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="needs_refresh">Needs refresh</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-white">
        <Table className="min-w-[540px] sm:min-w-[650px]">
          <TableHeader>
            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
              <TableHead>Source Name</TableHead>
              <TableHead className="hidden sm:table-cell">Type</TableHead>
              <TableHead className="hidden md:table-cell">Reference</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Last Trained</TableHead>
              <TableHead className="text-center">Chunks</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                  <TableCell><Skeleton className="ml-auto h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : filteredSources.length > 0 ? (
              filteredSources.map((source) => {
                const status = statusConfig[source.status]
                const StatusIcon = status.icon
                return (
                  <TableRow key={source.id}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="font-medium text-sm">{source.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{source.content.slice(0, 80)}</div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="secondary" className="text-xs capitalize">
                        {source.type === 'website' ? <Globe className="mr-1 size-3" /> : source.type === 'file' ? <Upload className="mr-1 size-3" /> : <Pencil className="mr-1 size-3" />}
                        {source.type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-45 truncate">
                      {source.type === 'website' && source.sourceUrl ? (
                        <span className="flex items-center gap-1">
                          <Globe className="size-3 shrink-0" />
                          {getUrlPath(source.sourceUrl) || source.sourceUrl}
                        </span>
                      ) : (
                        source.fileName || 'Manual entry'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${status.className} text-xs`}>
                        <StatusIcon className={`mr-1 size-3 ${source.status === 'processing' ? 'animate-spin' : ''}`} />
                        {status.label}
                      </Badge>
                      {source.status === 'failed' && source.errorMessage && (
                        <p className="text-[11px] text-red-500 mt-0.5 max-w-45 truncate">{source.errorMessage}</p>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {formatRelativeDate(source.lastSyncedAt)}
                    </TableCell>
                    <TableCell className="text-center text-sm">{source.chunkCount}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewContent(source)}>
                            <Eye className="mr-2 size-4" />
                            View Content
                          </DropdownMenuItem>
                          {source.type !== 'website' && (
                            <DropdownMenuItem onClick={() => openEdit(source)}>
                              <Pencil className="mr-2 size-4" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {source.type === 'website' && source.sourceUrl && (
                            <DropdownMenuItem asChild>
                              <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="mr-2 size-4" />
                                Open URL
                              </a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleRefresh(source)}>
                            <RefreshCw className="mr-2 size-4" />
                            {source.type === 'website' ? 'Refresh' : 'Retrain'}
                          </DropdownMenuItem>
                          {source.status === 'failed' && source.type === 'website' && (
                            <DropdownMenuItem onClick={() => handleRefresh(source)}>
                              <RefreshCw className="mr-2 size-4" />
                              Retry Import
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600 focus:text-red-700" onClick={() => confirmDelete(source)}>
                            <Trash2 className="mr-2 size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                      <BookText className="size-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">No knowledge sources found</p>
                      <p className="text-xs text-muted-foreground mt-1">Import from your website, upload documents, or add knowledge manually.</p>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <Button size="sm" variant="outline" onClick={() => setWebsiteDialogOpen(true)}>
                        <Globe className="mr-1 size-4" />
                        Import Website
                      </Button>
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openCreate}>
                        <Plus className="mr-1 size-4" />
                        Add Knowledge
                      </Button>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ===== DIALOGS ===== */}

      {/* Add/Edit Manual Knowledge Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingSource ? 'Edit Knowledge Source' : 'Add Knowledge Source'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea
                rows={10}
                value={form.content}
                onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                placeholder="Paste appointment rules, pricing notes, emergency instructions, or other clinic information."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving...' : editingSource ? 'Save Changes' : 'Save Source'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Website Dialog (enhanced with import type) */}
      <Dialog open={websiteDialogOpen} onOpenChange={setWebsiteDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import From Website</DialogTitle>
            <DialogDescription>
              Enter a website URL to import content for your chatbot knowledge.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Import Type</Label>
              <RadioGroup value={importType} onValueChange={(v) => setImportType(v as ImportType)}>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="single" id="r-single" />
                  <Label htmlFor="r-single" className="font-normal cursor-pointer">
                    <span className="font-medium">Single page only</span>
                    <span className="block text-xs text-muted-foreground">Import content from one specific URL</span>
                  </Label>
                </div>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="homepage" id="r-homepage" />
                  <Label htmlFor="r-homepage" className="font-normal cursor-pointer">
                    <span className="font-medium">Website homepage</span>
                    <span className="block text-xs text-muted-foreground">Import the homepage (up to 5 pages crawl coming soon)</span>
                  </Label>
                </div>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="sitemap" id="r-sitemap" />
                  <Label htmlFor="r-sitemap" className="font-normal cursor-pointer">
                    <span className="font-medium">Sitemap / multiple pages</span>
                    <span className="block text-xs text-muted-foreground">Import from a sitemap.xml URL (up to 20 pages)</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {importType === 'sitemap' ? (
              <div className="space-y-2">
                <Label>Sitemap URL</Label>
                <Input
                  value={sitemapUrl}
                  onChange={(e) => setSitemapUrl(e.target.value)}
                  placeholder="https://yourclinic.com/sitemap.xml"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Website URL</Label>
                <Input
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://yourclinic.com/services/root-canal"
                />
              </div>
            )}

            {importType === 'homepage' && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                Full website crawling (up to 5 pages) is coming soon. For now, only the homepage content will be imported.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWebsiteDialogOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleWebsiteImport} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-1 size-4 animate-spin" />
                  Importing...
                </>
              ) : (
                'Import Website Content'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload File Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Training Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Supported files</Label>
            <Input type="file" accept=".pdf,.docx,.txt,.csv" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
            <p className="text-xs text-muted-foreground">Max file size 5 MB. Supported: PDF, DOCX, TXT, CSV.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleUpload} disabled={submitting}>
              {submitting ? 'Uploading...' : 'Upload File'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Content Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={(open) => { setPreviewDialogOpen(open); if (!open) { setPreviewSource(null); setDetectedDetails([]) } }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewSource?.title || 'Page Content'}</DialogTitle>
            {previewSource?.type === 'website' && previewSource.sourceUrl && (
              <DialogDescription className="flex items-center gap-1.5">
                <Globe className="size-3" />
                {previewSource.sourceUrl}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md bg-muted/50 p-3 text-center">
                <div className="text-lg font-semibold">{previewSource?.content?.length?.toLocaleString() || 0}</div>
                <div className="text-xs text-muted-foreground">Characters</div>
              </div>
              <div className="rounded-md bg-muted/50 p-3 text-center">
                <div className="text-lg font-semibold">{previewSource?.chunkCount || 0}</div>
                <div className="text-xs text-muted-foreground">Knowledge Chunks</div>
              </div>
              <div className="rounded-md bg-muted/50 p-3 text-center">
                <div className="text-sm font-medium">{formatDate(previewSource?.lastSyncedAt || null)}</div>
                <div className="text-xs text-muted-foreground">Last Trained</div>
              </div>
            </div>

            {/* Status */}
            {previewSource && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Status:</span>
                <Badge variant="outline" className={statusConfig[previewSource.status].className}>
                  {statusConfig[previewSource.status].label}
                </Badge>
                <span className="text-sm text-muted-foreground capitalize">({previewSource.type.replace('_', ' ')})</span>
              </div>
            )}

            {/* Error message */}
            {previewSource?.status === 'failed' && previewSource.errorMessage && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                <AlertCircle className="inline size-4 mr-1.5 -mt-0.5" />
                {previewSource.errorMessage}
              </div>
            )}

            {/* Extracted Content */}
            {previewSource?.content && (
              <div className="space-y-2">
                <Label>Extracted Content</Label>
                <Textarea readOnly rows={10} value={previewSource.content} className="font-mono text-xs bg-muted/30" />
              </div>
            )}

            {/* Smart Detection Results (website sources only) */}
            {previewSource?.type === 'website' && detectedDetails.length > 0 && (
              <Card className="py-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Detected From This Page</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2.5">
                    {detectedDetails.map((detail) => {
                      const Icon = detailIcons[detail.field] || CheckCircle2
                      return (
                        <div key={detail.field} className="flex items-start gap-2.5 text-sm">
                          <Icon className="size-4 text-emerald-600 mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-medium">{detail.label}:</span>{' '}
                            <span className="text-muted-foreground">{detail.value}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {detecting && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="size-4 animate-spin" />
                Detecting clinic details...
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>Close</Button>
            {previewSource && (
              <>
                <Button variant="outline" onClick={() => handleRefresh(previewSource)}>
                  <RefreshCw className="mr-1 size-4" />
                  {previewSource.type === 'website' ? 'Refresh Content' : 'Retrain'}
                </Button>
                <Button variant="destructive" onClick={() => confirmDelete(previewSource)}>
                  <Trash2 className="mr-1 size-4" />
                  Delete
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Smart Detection Dialog (shown after successful website import) */}
      <Dialog open={detectionDialogOpen} onOpenChange={setDetectionDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detected From Your Website</DialogTitle>
            <DialogDescription>
              We found these details on your website. You can apply them to your Bot Setup.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {detectedDetails.map((detail) => {
              const Icon = detailIcons[detail.field] || CheckCircle2
              return (
                <div key={detail.field} className="flex items-start gap-3 rounded-md border p-3">
                  <Icon className="size-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{detail.label}</div>
                    <div className="text-sm text-muted-foreground">{detail.value}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{detail.confidence}</Badge>
                </div>
              )
            })}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDetectionDialogOpen(false)}>Ignore</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                setDetectionDialogOpen(false)
                toast.success('Details applied to Bot Setup (demo)')
              }}
            >
              Apply to Bot Setup
              <ArrowRight className="ml-1 size-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete knowledge source?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <strong>{deleteSource?.title}</strong> from your chatbot knowledge.
              The chatbot will no longer use this content when answering patients.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteSource(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

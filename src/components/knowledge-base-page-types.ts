import type React from 'react'
import {
  Pencil,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Phone,
  MapPin,
  ClockIcon,
  CreditCard,
  Stethoscope,
} from 'lucide-react'

// --- Types ---

export type ImportType = 'single' | 'homepage' | 'sitemap'

export interface KnowledgeSource {
  id: string
  title: string
  type: 'manual_text' | 'website' | 'file' | 'faq'
  sourceType?: 'manual_text' | 'website_url' | 'file_upload' | 'faq'
  content: string
  sourceUrl: string | null
  fileName: string | null
  status: 'draft' | 'queued' | 'processing' | 'trained' | 'failed' | 'needs_review' | 'disabled'
  isActive?: boolean
  chunkCount: number
  trainedAt?: string | null
  lastSyncedAt: string | null
  errorMessage: string | null
  updatedAt: string
}

export interface DetectedDetail {
  field: string
  label: string
  value: string
  confidence: 'high' | 'medium' | 'low'
}

export interface KnowledgeJobProgress {
  id: string
  sourceId: string | null
  jobType: 'process_source_content' | 'import_website_source' | 'process_file_source' | 'import_sitemap'
  status: 'queued' | 'processing' | 'completed' | 'failed'
  totalPages: number
  processedPages: number
  failedPages: number
  currentPageUrl: string | null
  progressUpdatedAt: string | null
}

// --- Config ---

export const statusConfig: Record<KnowledgeSource['status'], { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  draft: { label: 'Draft', className: 'bg-slate-50 text-slate-700 border-slate-200', icon: Pencil },
  queued: { label: 'Optimizing', className: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: Loader2 },
  processing: { label: 'Processing', className: 'bg-amber-50 text-amber-700 border-amber-200', icon: Loader2 },
  trained: { label: 'Trained', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  failed: { label: 'Failed', className: 'bg-red-50 text-red-700 border-red-200', icon: AlertCircle },
  needs_review: { label: 'Needs Review', className: 'bg-sky-50 text-sky-700 border-sky-200', icon: RefreshCw },
  disabled: { label: 'Disabled', className: 'bg-slate-100 text-slate-600 border-slate-200', icon: AlertCircle },
}

export const detailIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  phone: Phone,
  whatsapp: Phone,
  address: MapPin,
  opening_hours: ClockIcon,
  services: Stethoscope,
  pricing: CreditCard,
  emergency: AlertCircle,
}

export const emptyForm = { title: '', content: '' }
